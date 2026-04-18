import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Product, BatchAllocation, SaleItem, Client, Order, AutoPromotion, Promotion, Batch } from '../types';
import { Plus, Trash2, Search, Printer, Save, X, ChevronDown, RefreshCw, FilePlus, Eye, Zap, MapPin, Loader2, AlertTriangle, ShieldCheck, CheckCircle2, HelpCircle } from 'lucide-react';
import { isPromoValidForContext } from '../utils/promoUtils';
import { supabase } from '../services/supabase';
import { PdfEngine } from './PdfEngine';

const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const AdvancedOrderEntry: React.FC = () => {
   const { users, currentUser } = useStore();

   const productInputRef = useRef<HTMLInputElement>(null);
   const qtyInputRef = useRef<HTMLInputElement>(null);
   const unitSelectRef = useRef<HTMLSelectElement>(null);
   const priceInputRef = useRef<HTMLInputElement>(null);
   const discountInputRef = useRef<HTMLInputElement>(null);
   const addButtonRef = useRef<HTMLButtonElement>(null);

   const [priceLocked, setPriceLocked] = useState(true);
   const [isSaving, setIsSaving] = useState(false);

   const [dialog, setDialog] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'warning' | 'confirm' | 'info'; title: string; message: string; onConfirm?: () => void }>({
       isOpen: false, type: 'info', title: '', message: ''
   });

   const showDialog = (type: 'success' | 'error' | 'warning' | 'confirm' | 'info', title: string, message: string, onConfirm?: () => void) => {
       setDialog({ isOpen: true, type, title, message, onConfirm });
   };
   const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

   // --- MASTER DATA SUPABASE SYNC (100% CLOUD) ---
   const [dbCompany, setDbCompany] = useState<any>(null); 
   const [dbSellers, setDbSellers] = useState<any[]>([]);
   const [dbPriceLists, setDbPriceLists] = useState<any[]>([]);
   const [dbZones, setDbZones] = useState<any[]>([]);
   const [dbPromos, setDbPromos] = useState<Promotion[]>([]);
   const [dbAutoPromos, setDbAutoPromos] = useState<AutoPromotion[]>([]);
   const [dbRewardProducts, setDbRewardProducts] = useState<Product[]>([]);
   const [dbSeries, setDbSeries] = useState<any[]>([]);
   const [cartProductsCache, setCartProductsCache] = useState<Record<string, Product>>({});

   const [docType, setDocType] = useState<'FACTURA' | 'BOLETA'>('FACTURA');
   const [series, setSeries] = useState('');
   const [docNumber, setDocNumber] = useState('');

   useEffect(() => {
       const fetchMasters = async () => {
           try {
               const [compRes, sellRes, plRes, zRes, pRes, apRes, serRes] = await Promise.all([
                   supabase.from('company_config').select('*').limit(1).maybeSingle(),
                   supabase.from('sellers').select('*').order('name'),
                   supabase.from('price_lists').select('*').order('name'),
                   supabase.from('zones').select('*'),
                   supabase.from('promotions').select('*').eq('is_active', true),
                   supabase.from('auto_promotions').select('*').eq('is_active', true),
                   supabase.from('document_series').select('*').eq('is_active', true).order('series')
               ]);
               
               if (compRes.data) setDbCompany(compRes.data);
               if (sellRes.data) setDbSellers(sellRes.data);
               if (plRes.data) setDbPriceLists(plRes.data);
               if (zRes.data) setDbZones(zRes.data);
               if (pRes.data) setDbPromos(pRes.data);
               if (serRes.data) {
                   setDbSeries(serRes.data);
                   const initialPedido = serRes.data.find((s: any) => s.type === 'PEDIDO');
                   if (initialPedido) {
                       setSeries(initialPedido.series);
                       setDocNumber(String(initialPedido.current_number + 1).padStart(8, '0'));
                   }
               }
               if (apRes.data) {
                   setDbAutoPromos(apRes.data);
                   const rewardIds = apRes.data.map(ap => ap.reward_product_id).filter(Boolean);
                   if (rewardIds.length > 0) {
                       const { data: rpData } = await supabase.from('products').select('*').in('id', rewardIds);
                       if (rpData) setDbRewardProducts(rpData as Product[]);
                   }
               }
           } catch (e) { console.error("Error cargando maestros:", e); }
       };
       fetchMasters();
   }, []);

   const fetchLiveSeries = async () => {
       const { data } = await supabase.from('document_series').select('*').eq('is_active', true);
       if (data) {
           setDbSeries(data);
           const current = data.find(s => s.type === 'PEDIDO' && s.series === series);
           if (current) {
               setDocNumber(String(current.current_number + 1).padStart(8, '0'));
           }
       }
   };

   const [paymentMethod, setPaymentMethod] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
   const [currency, setCurrency] = useState('SOLES');

   const [selectedClientId, setSelectedClientId] = useState('');
   const [clientData, setClientData] = useState<Partial<Client>>({ name: '', doc_number: '', address: '', price_list_id: '', city: '' });
   const [clientSearch, setClientSearch] = useState('');
   const [showClientSuggestions, setShowClientSuggestions] = useState(false);
   const [searchedClients, setSearchedClients] = useState<Client[]>([]);
   const [isSearchingClient, setIsSearchingClient] = useState(false);
   const [showBranchSelector, setShowBranchSelector] = useState(false);
   const [selectedSellerId, setSelectedSellerId] = useState('');

   const [clientCreditInfo, setClientCreditInfo] = useState({ limit: 0, debt: 0, overdue: false, isChecking: false });

   useEffect(() => {
       if (clientSearch.length < 3) { setSearchedClients([]); return; }
       const timer = setTimeout(async () => {
           setIsSearchingClient(true);
           const { data } = await supabase.from('clients').select('*').or(`name.ilike.%${clientSearch}%,doc_number.ilike.%${clientSearch}%`).limit(10);
           if (data) setSearchedClients(data as Client[]);
           setIsSearchingClient(false);
       }, 400); 
       return () => clearTimeout(timer);
   }, [clientSearch]);

   const [productSearch, setProductSearch] = useState('');
   const [showProductSuggestions, setShowProductSuggestions] = useState(false);
   const [highlightedIndex, setHighlightedIndex] = useState(0);
   const [searchedProducts, setSearchedProducts] = useState<(Product & { current_stock: number })[]>([]);
   const [loadedBatches, setLoadedBatches] = useState<Record<string, Batch[]>>({}); 
   const [isSearchingProd, setIsSearchingProd] = useState(false);

   useEffect(() => {
       if (productSearch.length < 2) { setSearchedProducts([]); return; }
       const timer = setTimeout(async () => {
           setIsSearchingProd(true);
           try {
               const { data: pData } = await supabase.from('products').select('*').or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`).eq('is_active', true).limit(15);
               if (pData && pData.length > 0) {
                   const pIds = pData.map(p => p.id);
                   const { data: bData } = await supabase.from('batches').select('*').in('product_id', pIds).gt('quantity_current', 0).order('expiration_date', { ascending: true });
                   const batchCache: Record<string, Batch[]> = {};
                   const enriched = pData.map(p => {
                       const prodBatches = (bData || []).filter(b => b.product_id === p.id) as Batch[];
                       batchCache[p.id] = prodBatches;
                       const stock = prodBatches.length > 0 ? prodBatches.reduce((sum, b) => sum + Number(b.quantity_current || 0), 0) : Number(p.current_stock || p.stock || 0);
                       return { ...p, current_stock: stock };
                   });
                   setLoadedBatches(prev => ({ ...prev, ...batchCache }));
                   setSearchedProducts(enriched);
               } else { setSearchedProducts([]); }
           } catch (error) { console.error(error); } finally { setIsSearchingProd(false); }
       }, 350);
       return () => clearTimeout(timer);
   }, [productSearch]);

   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
   const [unitMode, setUnitMode] = useState<'BASE' | 'PKG'>('BASE'); 
   const [quantity, setQuantity] = useState<number>(1);
   const [unitPrice, setUnitPrice] = useState<number>(0); 
   const [discountPercent, setDiscountPercent] = useState<number>(0);
   const [isBonus, setIsBonus] = useState(false);
   const [cart, setCart] = useState<SaleItem[]>([]);

   const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
   const [orderSearchTerm, setOrderSearchTerm] = useState('');
   const [searchedOrders, setSearchedOrders] = useState<Order[]>([]);
   const [isSearchingOrder, setIsSearchingOrder] = useState(false);
   const [isEditMode, setIsEditMode] = useState(false); 
   const [originalOrder, setOriginalOrder] = useState<Order | null>(null);
   const [showHistoryModal, setShowHistoryModal] = useState<{ isOpen: boolean, order: Order | null }>({ isOpen: false, order: null });

   useEffect(() => {
       if (!isSearchModalOpen) return;
       const timer = setTimeout(async () => {
           setIsSearchingOrder(true);
           try {
               let query = supabase.from('orders').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(10);
               if (orderSearchTerm.trim().length > 0) query = query.or(`code.ilike.%${orderSearchTerm}%,client_name.ilike.%${orderSearchTerm}%,client_doc_number.ilike.%${orderSearchTerm}%`);
               const { data, error } = await query;
               if (error) throw error;
               if (data) setSearchedOrders(data as Order[]);
           } catch (e) { console.error("Error buscando pedidos:", e);
           } finally { setIsSearchingOrder(false); }
       }, 400);
       return () => clearTimeout(timer);
   }, [orderSearchTerm, isSearchModalOpen]);

   const isItemPackage = (itemUnitName: string, prod: any) => {
       if (!prod || !itemUnitName) return false;
       return itemUnitName.toUpperCase() === (prod.package_type || '').toUpperCase() || itemUnitName.toUpperCase() === 'PKG' || itemUnitName.toUpperCase() === 'CJA';
   };

   const calculateTotal = (qty: number, price: number, discPct: number) => { 
       const gross = Number(qty) * Number(price); 
       return gross - (gross * (Number(discPct) / 100)); 
   };
   
   const subtotal = cart.reduce((sum, item) => sum + Number(item.total_price || 0), 0) / (1 + (Number(dbCompany?.igv_percent || 18) / 100));
   const igv = cart.reduce((sum, item) => sum + Number(item.total_price || 0), 0) - subtotal;
   const grandTotal = cart.reduce((sum, item) => sum + Number(item.total_price || 0), 0);

   const getMultiplier = () => {
      if (!clientData.price_list_id) return 1;
      const list = dbPriceLists.find(pl => pl.id === clientData.price_list_id);
      const val = list ? (list.multiplier ?? list.factor_multiplier ?? list.factor ?? list.value ?? 1) : 1;
      return Number(val) || 1;
   };

   const handleNewOrder = () => {
      setIsEditMode(false); 
      setOriginalOrder(null); 
      setCart([]); 
      setSelectedClientId(''); 
      setClientSearch(''); 
      setProductSearch(''); 
      setSelectedSellerId('');
      setClientData({ name: '', doc_number: '', address: '', price_list_id: '', city: '' });
      setClientCreditInfo({ limit: 0, debt: 0, overdue: false, isChecking: false });
      
      setDocType('FACTURA');
      const activePedidoSeries = dbSeries.find(s => s.type === 'PEDIDO');
      if (activePedidoSeries) { 
         setSeries(activePedidoSeries.series); 
         setDocNumber(String(activePedidoSeries.current_number + 1).padStart(8, '0')); 
      } else { 
         setSeries(''); setDocNumber(''); 
      }
   };

   const loadOrder = async (order: Order) => {
      if (order.status !== 'pending') {
          showDialog('error', 'Bloqueado', 'Solo se pueden editar pedidos en estado pendiente.');
          return;
      }

      setIsSaving(true);
      try {
          let itemsToLoad: any[] = [];
          let finalCache = { ...cartProductsCache };
          
          const { data: orderItemsData, error: itemsErr } = await supabase.from('order_items').select(`*, product:products (*)`).eq('order_id', order.id);

          if (itemsErr) throw itemsErr;

          if (orderItemsData && orderItemsData.length > 0) {
              itemsToLoad = orderItemsData;
          } else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
              itemsToLoad = order.items; 
          }

          if (itemsToLoad.length === 0) alert("⚠️ ADVERTENCIA: El pedido se cargó sin detalles.");

          const pIds = itemsToLoad.map((i: any) => i.product_id).filter(Boolean);
          if (pIds.length > 0) {
              const { data: pData } = await supabase.from('products').select('*').in('id', pIds);
              if (pData) {
                  pData.forEach(p => finalCache[p.id] = p as Product);
                  setCartProductsCache(prev => ({...prev, ...finalCache}));
              }
          }

          let clientListId = '';
          let clientCity = '';
          if (order.client_id) {
              const { data: cData } = await supabase.from('clients').select('*').eq('id', order.client_id).single();
              if (cData) {
                  setSelectedClientId(cData.id);
                  clientListId = cData.price_list_id || '';
                  clientCity = cData.city || '';
                  checkClientCredit(order.client_id, cData.credit_limit || 0);
              }
          }

          const safeItems = itemsToLoad.map((item: any) => {
              const matchedProd = item.product || finalCache[item.product_id];
              const q_pres = Number(item.quantity_presentation || item.quantity || 1);
              const q_base = Number(item.quantity_base || item.quantity || 1);
              const p_unit = Number(item.unit_price || item.price || 0);
              const p_total = Number(item.total_price || item.amount || (q_pres * p_unit) || 0);
              
              return { 
                  ...item, 
                  id: item.id || crypto.randomUUID(), 
                  unit_price: p_unit, 
                  total_price: p_total, 
                  discount_percent: Number(item.discount_percent || 0), 
                  discount_amount: Number(item.discount_amount || 0), 
                  quantity_presentation: q_pres, 
                  quantity_base: q_base, 
                  selected_unit: item.selected_unit || item.unit_type || 'UND',
                  is_bonus: item.is_bonus === true || item.is_bonus === 'true' || p_unit === 0,
                  product: matchedProd 
              };
          });

          setOriginalOrder(order);
          setIsEditMode(true);
          
          setDocType((order.suggested_document_type as any) || 'FACTURA'); 
          if (order.code && order.code.includes('-')) {
             const [s, n] = order.code.split('-');
             setSeries(s); setDocNumber(n);
          } else {
             setDocNumber(order.code);
          }

          setSelectedSellerId(order.seller_id || ''); 
          setPaymentMethod(order.payment_method as any || 'CONTADO'); 
          setClientSearch(order.client_name); 

          setClientData({ 
             name: order.client_name, 
             doc_number: order.client_doc_number, 
             address: order.delivery_address, 
             price_list_id: clientListId, 
             city: clientCity 
          });
          
          setCart(safeItems); 
          setIsSearchModalOpen(false);

      } catch (err: any) {
          showDialog('error', 'Error Fatal', 'Falla al cargar detalles del pedido: ' + err.message);
      } finally {
          setIsSaving(false);
      }
   };

   const handlePreview = async () => {
      const seller = dbSellers.find(s => s.id === selectedSellerId);
      const tempOrder: any = { 
         id: 'preview', document_type: docType, series: series, number: docNumber, payment_method: paymentMethod, payment_status: paymentMethod === 'CREDITO' ? 'PENDING' : 'PAID', balance: paymentMethod === 'CREDITO' ? grandTotal : 0, client_name: clientData.name || 'CLIENTE MOSTRADOR', client_ruc: clientData.doc_number || '00000000', client_address: clientData.address || '', subtotal, igv, total: grandTotal, status: 'completed', dispatch_status: 'pending', created_at: new Date().toISOString(), items: cart, sunat_status: 'PENDING',
         seller_name: seller ? seller.name : '',
         previous_debt: clientCreditInfo.debt 
      };
      
      try { await PdfEngine.openDocument(tempOrder, docType, dbCompany); } catch (err) { showDialog('error', 'Error', 'Error generando la vista previa.'); }
   };

   const removeFromCart = (index: number) => { const newItems = cart.filter((_, i) => i !== index); applyAutoPromotions(newItems, true); };

   const checkClientCredit = async (clientId: string, creditLimit: number = 0) => {
      setClientCreditInfo({ limit: creditLimit, debt: 0, overdue: false, isChecking: true });
      try {
          const { data: unpaidSales } = await supabase.from('sales').select('created_at, total, balance').eq('client_id', clientId).eq('payment_status', 'PENDING').neq('status', 'canceled');
          let debt = 0; let hasOverdue = false;
          const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (unpaidSales) {
              unpaidSales.forEach(s => {
                  const amount = s.balance !== undefined && s.balance !== null ? Number(s.balance) : Number(s.total);
                  debt += amount;
                  if (new Date(s.created_at) < sevenDaysAgo && amount > 0) hasOverdue = true;
              });
          }
          setClientCreditInfo({ limit: creditLimit, debt, overdue: hasOverdue, isChecking: false });
      } catch(e) { console.error(e); setClientCreditInfo(prev => ({...prev, isChecking: false})); }
   }

   const selectClient = async (c: Client) => {
      setSelectedClientId(c.id);
      const newDocType: 'FACTURA' | 'BOLETA' = c.doc_number.length === 11 ? 'FACTURA' : 'BOLETA';
      setDocType(newDocType); 

      let autoSellerId = '';
      if (c.zone_id) { const zone = dbZones.find(z => z.id === c.zone_id); if (zone && zone.assigned_seller_id) { autoSellerId = zone.assigned_seller_id; } }
      setSelectedSellerId(autoSellerId);

      setClientData({ name: c.name, doc_number: c.doc_number, address: c.address, price_list_id: c.price_list_id || '', city: c.city });
      setClientSearch(c.name); setShowClientSuggestions(false);
      
      if (c.payment_condition && c.payment_condition.toUpperCase().includes('CREDIT')) { setPaymentMethod('CREDITO'); } else { setPaymentMethod('CONTADO'); }
      checkClientCredit(c.id, c.credit_limit || 0);
   };

   const handleProductKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev + 1) % searchedProducts.length);
      } else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev - 1 + searchedProducts.length) % searchedProducts.length);
      } else if (e.key === 'Enter') { e.preventDefault(); if (searchedProducts.length > 0) selectProduct(searchedProducts[highlightedIndex]);
      } else if (e.key === 'Escape') { setShowProductSuggestions(false); }
   };

   const proceedSelectProduct = (p: Product & { current_stock?: number }) => {
      setCartProductsCache(prev => ({...prev, [p.id]: p}));
      setSelectedProduct(p); setProductSearch(p.name); setShowProductSuggestions(false); setUnitMode('BASE'); 

      let price = Number(p.price_unit || 0) * getMultiplier();
      let defaultDiscount = 0;
      const activePromo = dbPromos.find(promo => {
          if (!promo.product_ids.includes(p.id)) return false;
          if (!isPromoValidForContext(promo, 'IN_STORE', clientData.city, selectedSellerId || currentUser?.id, currentUser?.role)) return false;
          if (promo.target_price_list_ids?.length > 0 && clientData.price_list_id && !promo.target_price_list_ids.includes('ALL') && !promo.target_price_list_ids.includes(clientData.price_list_id)) return false;
          return true;
      });

      if (activePromo) {
         if (activePromo.type === 'PERCENTAGE_DISCOUNT') defaultDiscount = activePromo.value;
         else if (activePromo.type === 'FIXED_PRICE') price = activePromo.value;
      }
      setUnitPrice(price); setQuantity(1); setDiscountPercent(defaultDiscount); setIsBonus(false); setPriceLocked(true);
      setTimeout(() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); }, 50);
   };

   const selectProduct = (p: Product & { current_stock?: number }) => {
      const isDuplicate = cart.some(item => item.product_id === p.id);
      if (isDuplicate) { showDialog('confirm', 'Producto Duplicado', `El producto "${p.name}" ya se encuentra en el detalle.\n¿Desea agregar una nueva línea de todas formas?`, () => proceedSelectProduct(p));
      } else { proceedSelectProduct(p); }
   };

   const handleUnitChange = (mode: 'BASE' | 'PKG') => {
      setUnitMode(mode);
      if (selectedProduct) {
         let price = mode === 'PKG' ? Number(selectedProduct.price_package || 0) : Number(selectedProduct.price_unit || 0);
         price = price * getMultiplier();
         setUnitPrice(price);
      }
   };

   const resetEntryForm = () => {
      setSelectedProduct(null); setProductSearch(''); setQuantity(1); setUnitPrice(0); setDiscountPercent(0); setIsBonus(false);
      setTimeout(() => productInputRef.current?.focus(), 50);
   }

   const executeAddToCart = () => {
      if (!selectedProduct) { showDialog('error', 'Error', 'Por favor, busque y seleccione un producto primero.'); return; }
      if (quantity <= 0) { showDialog('warning', 'Aviso', "Cantidad inválida"); return; }
      
      const prod = selectedProduct as any;
      const isPkgMode = unitMode === 'PKG';
      const conversionFactor = isPkgMode ? Number(prod.package_content || 1) : 1;
      const requiredBaseUnits = quantity * conversionFactor;
      
      const realUnitName = isPkgMode ? (prod.package_type || 'CAJA').toUpperCase() : (prod.unit_type || 'UND').toUpperCase();
      
      const availableBatches = loadedBatches[prod.id] || [];
      const totalStock = availableBatches.length > 0 ? availableBatches.reduce((acc, b) => acc + Number(b.quantity_current || 0), 0) : Number(prod.current_stock || prod.stock || 0);

      if (totalStock < requiredBaseUnits) { showDialog('error', 'Stock Insuficiente', `Disponible: ${totalStock} unid.\nRequerido: ${requiredBaseUnits} unid.`); return; }

      let initialNewCart = [...cart];
      const existingItemIndex = initialNewCart.findIndex(item => item.product_id === prod.id && item.selected_unit === realUnitName && !item.is_bonus && !item.auto_promo_id);

      if (existingItemIndex >= 0) {
         showDialog('confirm', 'Sumar Cantidad', `El producto "${prod.name}" ya existe en la lista con la misma presentación.\n¿Desea sumar la cantidad?`, () => {
            const existing = initialNewCart[existingItemIndex];
            const newQty = Number(existing.quantity_presentation || 0) + quantity;
            const newPrice = calculateTotal(newQty, unitPrice, discountPercent); 
            initialNewCart[existingItemIndex] = { ...existing, quantity_presentation: newQty, quantity_base: isPkgMode ? newQty * Number(prod.package_content || 1) : newQty, total_price: newPrice, discount_percent: discountPercent, discount_amount: (newQty * unitPrice) * (discountPercent / 100), batch_allocations: [], product: prod };
            applyAutoPromotions(initialNewCart, true);
            resetEntryForm();
         });
         return;
      } else {
         initialNewCart.push({ id: crypto.randomUUID(), sale_id: '', product_id: prod.id, product_sku: prod.sku, product_name: prod.name, selected_unit: realUnitName, quantity_presentation: quantity, quantity_base: requiredBaseUnits, unit_price: unitPrice, total_price: calculateTotal(quantity, unitPrice, discountPercent), discount_percent: discountPercent, discount_amount: (quantity * unitPrice) * (discountPercent / 100), is_bonus: isBonus, batch_allocations: [], product: prod });
         applyAutoPromotions(initialNewCart, true);
         resetEntryForm();
      }
   };

   const handleAddToCart = () => { if (isBonus || discountPercent > 0) requestAdminAuth(executeAddToCart, 'Autorizar Descuento / Bonificación'); else executeAddToCart(); };

   const handleCartItemQtyChange = (index: number, newQtyStr: string) => {
      const newQty = parseInt(newQtyStr, 10);
      if (isNaN(newQty) || newQty <= 0) return;
      const item = cart[index];
      const product = cartProductsCache[item.product_id] || item.product;
      if (!product) return;

      const isPkg = isItemPackage(item.selected_unit, product);
      const conversionFactor = isPkg ? Number(product.package_content || 1) : 1;
      const requiredBaseUnits = newQty * conversionFactor;
      
      const availableBatches = loadedBatches[product.id] || [];
      const totalStock = availableBatches.length > 0 ? availableBatches.reduce((acc, b) => acc + Number(b.quantity_current || 0), 0) : Number(product.current_stock || product.stock || 0);

      if (totalStock < requiredBaseUnits) { showDialog('error', 'Stock Insuficiente', `Disponible: ${totalStock} unid.\nRequerido: ${requiredBaseUnits} unid.`); return; }

      const updatedCart = [...cart];
      const newPrice = calculateTotal(newQty, Number(item.unit_price || 0), Number(item.discount_percent || 0));
      updatedCart[index] = { ...item, quantity_presentation: newQty, quantity_base: requiredBaseUnits, total_price: newPrice, discount_amount: (newQty * Number(item.unit_price || 0)) * (Number(item.discount_percent || 0) / 100), batch_allocations: [], product: product };
      applyAutoPromotions(updatedCart, true);
   };

   const handleUpdatePrices = (silent = false) => {
      if (cart.length === 0) return;
      if (!clientData.price_list_id && silent !== true) { showDialog('warning', 'Aviso', "Seleccione una lista de precios primero."); return; }

      const multiplier = getMultiplier();

      const updatedCart = cart.map(item => {
         if (item.is_bonus || item.auto_promo_id) return item; 
         const product = cartProductsCache[item.product_id] || item.product;
         if (!product) return item;
         
         const isPkg = isItemPackage(item.selected_unit, product);
         let basePrice = isPkg ? Number(product.price_package || product.price_unit || 0) : Number(product.price_unit || 0);
         let newPrice = basePrice * multiplier;

         let newDisc = 0;
         const activePromo = dbPromos.find(promo => {
             if (!promo.product_ids.includes(product.id)) return false;
             if (!isPromoValidForContext(promo, 'IN_STORE', clientData.city, selectedSellerId || currentUser?.id, currentUser?.role)) return false;
             if (promo.target_price_list_ids?.length > 0 && clientData.price_list_id && !promo.target_price_list_ids.includes('ALL') && !promo.target_price_list_ids.includes(clientData.price_list_id)) return false;
             return true;
         });

         if (activePromo) {
            if (activePromo.type === 'PERCENTAGE_DISCOUNT') newDisc = activePromo.value;
            else if (activePromo.type === 'FIXED_PRICE') newPrice = activePromo.value;
         }

         const newTotal = calculateTotal(Number(item.quantity_presentation || 0), newPrice, newDisc);
         const newDiscountAmt = (Number(item.quantity_presentation || 0) * newPrice) * (newDisc / 100);
         
         return { ...item, unit_price: newPrice, total_price: newTotal, discount_percent: newDisc, discount_amount: newDiscountAmt, product: product };
      });
      applyAutoPromotions(updatedCart, silent); 
   };

   const handleInputKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<any> | 'ADD' | 'BONUS_TOGGLE') => {
      if (e.key === 'Enter') {
         e.preventDefault();
         if (nextRef === 'ADD') addButtonRef.current?.focus();
         else if (nextRef === 'BONUS_TOGGLE') setIsBonus(prev => !prev);
         else if (nextRef.current) { nextRef.current.focus(); if (nextRef.current.select) nextRef.current.select(); }
      } else if (e.key === 'Escape') { setSelectedProduct(null); setProductSearch(''); setTimeout(() => productInputRef.current?.focus(), 50); }
   };

   const applyAutoPromotionsWithContext = (currentCart: SaleItem[], p_list_id: string, p_city: string, p_seller: string, silent = false) => {
      let newCart = currentCart.filter(item => !item.auto_promo_id);
      const validPromos = dbAutoPromos.filter(ap => {
         if (!isPromoValidForContext(ap, 'IN_STORE', p_city, p_seller || currentUser?.id, currentUser?.role)) return false;
         if (ap.target_price_list_ids?.length > 0 && p_list_id && !ap.target_price_list_ids.includes('ALL') && !ap.target_price_list_ids.includes(p_list_id)) return false;
         return true;
      });

      validPromos.forEach(ap => {
         let applies = false; let multiplyFactor = 0; 
         if (ap.condition_type === 'BUY_X_PRODUCT') {
            const qtyBought = newCart.filter(item => {
                if (item.is_bonus) return false;
                const hasList = ap.condition_product_ids && ap.condition_product_ids.length > 0;
                const hasSingle = !!ap.condition_product_id;
                if (hasList) return ap.condition_product_ids.includes(item.product_id);
                if (hasSingle) return item.product_id === ap.condition_product_id;
                return true; 
            }).reduce((sum, item) => sum + Number(item.quantity_base || 0), 0);
            
            if (qtyBought >= ap.condition_amount) { applies = true; multiplyFactor = Math.floor(qtyBought / ap.condition_amount); }
         } else if (ap.condition_type === 'SPEND_Y_TOTAL') {
            const conditionItemKeys = ap.condition_product_ids || [];
            const totalSpent = newCart.reduce((sum, item) => {
               if (conditionItemKeys.length > 0 && !conditionItemKeys.includes(item.product_id)) return sum;
               return sum + Number(item.total_price || 0);
            }, 0);
            if (totalSpent >= ap.condition_amount) { applies = true; multiplyFactor = Math.floor(totalSpent / ap.condition_amount); }
         } else if (ap.condition_type === 'SPEND_Y_CATEGORY') {
            const catSpent = newCart.reduce((sum, item) => {
               const p = cartProductsCache[item.product_id];
               if (p?.category === ap.condition_category) return sum + Number(item.total_price || 0);
               return sum;
            }, 0);
            if (catSpent >= ap.condition_amount) { applies = true; multiplyFactor = Math.floor(catSpent / ap.condition_amount); }
         }

         if (applies && multiplyFactor > 0) {
            const rewardProd = dbRewardProducts.find(p => p.id === ap.reward_product_id) || cartProductsCache[ap.reward_product_id];
            if (rewardProd) {
               const rewardQty = ap.reward_quantity * multiplyFactor;
               const isPkgMode = ap.reward_unit_type === 'PKG';
               const conversionFactor = isPkgMode ? Number(rewardProd.package_content || 1) : 1;
               
               const realUnitName = isPkgMode ? (rewardProd.package_type || 'CAJA').toUpperCase() : (rewardProd.unit_type || 'UND').toUpperCase();

               newCart.push({ id: crypto.randomUUID(), sale_id: '', product_id: rewardProd.id, product_sku: rewardProd.sku, product_name: rewardProd.name, quantity_base: rewardQty * conversionFactor, batch_allocations: [], quantity: rewardQty, quantity_presentation: rewardQty, unit_price: 0, discount_percent: 100, discount_amount: 0, total_price: 0, selected_unit: realUnitName, is_bonus: true, auto_promo_id: ap.id, product: rewardProd } as any);
            }
         }
      });
      
      setCart(newCart);
      if (silent !== true) showDialog('success', 'Precios Actualizados', "Precios y Promociones actualizadas según el cliente y la lista seleccionada.");
   };

   // =========================================================================
   // 🚨 GUARDAR / ACTUALIZAR PEDIDO (Usa las nuevas funciones SQL)
   // =========================================================================
   const executeSaveOrder = async () => {
      if (!series && !isEditMode) { showDialog('error', 'Error', "No hay serie asignada de PEDIDO."); return; }

      const seller = dbSellers.find(s => s.id === selectedSellerId);

      const orderPayload: any = {
         id: isEditMode && originalOrder ? originalOrder.id : crypto.randomUUID(), 
         code: isEditMode && originalOrder ? originalOrder.code : `${series}-${docNumber}`,
         seller_id: selectedSellerId || undefined,
         client_id: selectedClientId || undefined,
         client_name: clientData.name || 'CLIENTE VARIOS',
         client_doc_type: (clientData.doc_number?.length === 11) ? 'RUC' : 'DNI',
         client_doc_number: clientData.doc_number || '00000000',
         suggested_document_type: docType,
         payment_method: paymentMethod,
         total: grandTotal,
         delivery_address: clientData.address || '',
         items: cart
      };

      setIsSaving(true);

      try {
         const rpcName = isEditMode ? 'update_order_transaction' : 'process_order_transaction';
         const { data, error } = await supabase.rpc(rpcName, { p_order_data: orderPayload });
         
         if (error) throw error;
         
         if (data && data.success) {
            const finalCode = isEditMode ? orderPayload.code : data.real_code;
            showDialog('success', isEditMode ? 'Pedido Actualizado' : 'Pedido Creado', `El pedido ${finalCode} se ha guardado exitosamente y el stock ha sido reservado.`);
            
            await fetchLiveSeries();
            handleNewOrder();
         }
      } catch (err: any) { 
         showDialog('error', 'Error Crítico', err.message);
      } finally { 
         setIsSaving(false); 
      }
   };

   const handleSaveOrderClick = async () => {
      if (cart.length === 0) return;
      if (!selectedClientId && !clientData.name) { showDialog('warning', 'Faltan Datos', "Ingrese datos del cliente"); return; }
      if (!series && !isEditMode) { showDialog('error', 'Falta Serie', "No hay una serie asignada en el sistema para PEDIDOS."); return; }

      if (paymentMethod === 'CREDITO') {
          if (clientCreditInfo.overdue) {
              showDialog('error', 'Bloqueo de Crédito', "❌ BLOQUEO DE CRÉDITO ❌\n\nEl cliente mantiene comprobantes vencidos (más de 7 días sin pago). No se le puede emitir más crédito hasta que regularice su deuda.");
              return;
          }
          if ((clientCreditInfo.debt + grandTotal) > clientCreditInfo.limit) {
              showDialog('warning', 'Límite Excedido', `❌ LÍMITE DE CRÉDITO EXCEDIDO ❌\n\nLímite Aprobado: S/ ${Number(clientCreditInfo.limit || 0).toFixed(2)}\nDeuda Vigente: S/ ${Number(clientCreditInfo.debt || 0).toFixed(2)}\nDisponible Actual: S/ ${Math.max(0, Number(clientCreditInfo.limit) - Number(clientCreditInfo.debt)).toFixed(2)}\n\nEl monto de este pedido (S/ ${grandTotal.toFixed(2)}) supera el saldo disponible. Requiere autorización o pago al contado.`);
              return;
          }
      }

      showDialog('confirm', isEditMode ? 'Modificar Pedido' : 'Confirmar Pedido', `¿Está seguro que desea ${isEditMode ? 'MODIFICAR' : 'CREAR'} el pedido para ${clientData.name}? El stock será reservado en el Kardex.`, executeSaveOrder);
   };

   return (
      <div className="flex flex-col h-full bg-slate-200 p-2 font-sans text-xs relative">

         {/* --- PROFESSIONAL CUSTOM DIALOG --- */}
         {dialog.isOpen && (
             <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                 <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                     <div className={`p-4 border-b flex items-center gap-3 ${dialog.type === 'error' ? 'bg-red-50 text-red-700' : dialog.type === 'success' ? 'bg-green-50 text-green-700' : dialog.type === 'confirm' ? 'bg-blue-50 text-blue-700' : dialog.type === 'warning' ? 'bg-orange-50 text-orange-700' : 'bg-slate-50 text-slate-700'}`}>
                         {dialog.type === 'error' && <AlertTriangle className="w-6 h-6 text-red-500" />}
                         {dialog.type === 'warning' && <AlertTriangle className="w-6 h-6 text-orange-500" />}
                         {dialog.type === 'success' && <ShieldCheck className="w-6 h-6 text-green-500" />}
                         {dialog.type === 'confirm' && <HelpCircle className="w-6 h-6 text-blue-500" />}
                         {dialog.type === 'info' && <CheckCircle2 className="w-6 h-6 text-slate-500" />}
                         <h3 className="font-bold text-lg">{dialog.title}</h3>
                     </div>
                     <div className="p-6 text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                         {dialog.message}
                     </div>
                     <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
                         {dialog.type === 'confirm' && (
                             <button type="button" onClick={closeDialog} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded shadow-sm transition-colors">
                                 Cancelar
                             </button>
                         )}
                         <button
                             type="button"
                             onClick={() => {
                                 if (dialog.onConfirm) dialog.onConfirm();
                                 closeDialog();
                             }}
                             className={`px-5 py-2.5 font-bold rounded shadow-sm text-white transition-colors ${dialog.type === 'error' ? 'bg-red-600 hover:bg-red-700' : dialog.type === 'success' ? 'bg-green-600 hover:bg-green-700' : dialog.type === 'warning' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                         >
                             {dialog.type === 'confirm' ? 'Confirmar' : 'Aceptar'}
                         </button>
                     </div>
                 </div>
             </div>
         )}

         {isSaving && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded">
               <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
               <h2 className="text-2xl font-black text-white tracking-widest">PROCESANDO PEDIDO...</h2>
               <p className="text-blue-200 font-medium mt-2">Asegurando y reservando stock</p>
            </div>
         )}

         {/* === HEADER SECTION === */}
         <div className="bg-white p-2 rounded shadow-sm border border-slate-300 mb-2 space-y-2 relative">
            <div className="absolute top-2 right-2 flex gap-2">
               <button type="button" onClick={handleNewOrder} className="bg-slate-700 text-white px-3 py-1 rounded shadow text-xs font-bold hover:bg-slate-600 flex items-center">
                  <FilePlus className="w-3.5 h-3.5 mr-1" /> Nuevo (F2)
               </button>
               <button type="button" onClick={() => setIsSearchModalOpen(true)} className="bg-blue-600 text-white px-3 py-1 rounded shadow text-xs font-bold hover:bg-blue-500 flex items-center">
                  <Search className="w-3.5 h-3.5 mr-1" /> Cargar/Editar Pedido
               </button>
            </div>

            <div className="flex items-center gap-3 mt-1 py-1">
               <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">Convertir a</label>
                  <select
                     className="border border-slate-300 rounded px-2 py-1 flex-1 bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                     value={docType}
                     onChange={(e: any) => setDocType(e.target.value)}
                  >
                     <option value="FACTURA">FACTURA</option>
                     <option value="BOLETA">BOLETA</option>
                  </select>
               </div>
               <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">Nro. Pedido</label>
                  <select className="w-20 text-center border border-slate-300 rounded px-1 py-1 text-sm font-bold bg-white text-slate-900 outline-none" disabled>
                     <option value={series}>{series}</option>
                  </select>
                  <input className="w-24 text-center border border-transparent px-1 py-1 text-sm font-bold bg-transparent text-slate-800 pointer-events-none" value={isEditMode ? docNumber : 'AUTOGEN'} readOnly />
               </div>
               <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">Vendedor</label>
                  <select className="border border-slate-300 rounded px-2 py-1 text-sm bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={selectedSellerId} onChange={e => setSelectedSellerId(e.target.value)}>
                     <option value="">-- Sin Vendedor --</option>
                     {dbSellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
            </div>
            
            {isEditMode && <div className="ml-4 px-3 py-1 bg-red-600 text-white font-bold rounded animate-pulse relative pr-8 w-fit">
               MODIFICANDO PEDIDO: {originalOrder?.code}
               <button onClick={handleNewOrder} className="absolute right-1 top-1.5 hover:text-red-200"><X className="w-4 h-4" /></button>
            </div>}
         </div>

         {/* === CLIENT SECTION === */}
         <div className="flex items-start gap-2 mb-2">
            <div className="flex-1 grid grid-cols-12 gap-1 bg-slate-100 p-1.5 rounded border border-slate-200 relative">
               
               {paymentMethod === 'CREDITO' && selectedClientId && (
                   <div className={`col-span-12 mb-2 p-2 rounded border shadow-sm flex items-center justify-between ${clientCreditInfo.overdue ? 'bg-red-100 border-red-300 text-red-800' : (clientCreditInfo.debt + grandTotal > clientCreditInfo.limit) ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                       <div>
                           <div className="flex items-center gap-2">
                               <ShieldCheck className="w-4 h-4" />
                               <span className="font-black uppercase tracking-wider text-[11px]">Perfil Crediticio del Cliente</span>
                               {clientCreditInfo.isChecking && <Loader2 className="w-3 h-3 animate-spin ml-2" />}
                           </div>
                           <div className="flex gap-6 mt-1 text-xs">
                               <div>Límite Autorizado: <strong className="font-mono">S/ {Number(clientCreditInfo.limit || 0).toFixed(2)}</strong></div>
                               <div>Deuda Vigente: <strong className="font-mono">S/ {Number(clientCreditInfo.debt || 0).toFixed(2)}</strong></div>
                               <div>Saldo Disponible: <strong className="font-mono">S/ {Math.max(0, Number(clientCreditInfo.limit) - Number(clientCreditInfo.debt)).toFixed(2)}</strong></div>
                           </div>
                       </div>
                       <div className="text-right flex flex-col justify-end">
                           {clientCreditInfo.overdue && <div className="font-black text-xs text-red-600 flex items-center bg-white px-2 py-1 rounded shadow-sm border border-red-200"><AlertTriangle className="w-4 h-4 mr-1"/> BLOQUEO X MOROSIDAD (&gt;7 DÍAS)</div>}
                           {(clientCreditInfo.debt + grandTotal > clientCreditInfo.limit) && !clientCreditInfo.overdue && <div className="font-black text-xs text-orange-600 flex items-center bg-white px-2 py-1 rounded shadow-sm border border-orange-200"><AlertTriangle className="w-4 h-4 mr-1"/> PEDIDO EXCEDE LÍMITE</div>}
                       </div>
                   </div>
               )}

               <div className="col-span-2 relative">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Cod / Buscar</label>
                  <div className="relative">
                     <Search className="absolute left-1 top-1 w-3 h-3 text-slate-400" />
                     <input
                        className="w-full pl-5 pr-1 py-0.5 border border-slate-300 rounded text-slate-900 font-bold focus:bg-yellow-50"
                        placeholder="RUC o Nombre..."
                        value={clientSearch}
                        onChange={e => { setClientSearch(e.target.value); setShowClientSuggestions(true); }}
                        onFocus={() => setShowClientSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                     />
                     {isSearchingClient && <Loader2 className="absolute right-1 top-1 w-3 h-3 text-blue-500 animate-spin" />}
                     {showClientSuggestions && clientSearch && searchedClients.length > 0 && (
                        <div className="absolute top-full left-0 w-[400px] bg-white border border-slate-400 shadow-xl z-50 max-h-48 overflow-auto">
                           {searchedClients.map(c => (
                              <div key={c.id} onMouseDown={() => selectClient(c)} className="p-2 hover:bg-blue-100 cursor-pointer border-b border-slate-100">
                                 <div className="font-bold text-slate-800">{c.name}</div>
                                 <div className="text-[10px] text-slate-500">{c.doc_number} | {c.address}</div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
               <div className="col-span-4">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Razón Social</label>
                  <input className="w-full border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800" value={clientData.name} onChange={e => setClientData({ ...clientData, name: e.target.value })} />
               </div>
               <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">RUC/DNI</label>
                  <input className="w-full border border-slate-300 rounded px-1 py-0.5 bg-slate-50 text-slate-800 font-mono" value={clientData.doc_number} onChange={e => setClientData({ ...clientData, doc_number: e.target.value })} />
               </div>

               <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Lista Precio</label>
                  <div className="flex gap-1">
                     <select
                        className="w-full border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800"
                        value={clientData.price_list_id}
                        onChange={e => setClientData({ ...clientData, price_list_id: e.target.value })}
                     >
                        <option value="">-- General --</option>
                        {dbPriceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                     </select>
                     <button
                        type="button"
                        onClick={() => handleUpdatePrices(false)}
                        className="bg-blue-100 border border-blue-300 text-blue-700 px-1.5 rounded hover:bg-blue-200 transition-colors"
                        title="Actualizar Precios y Promociones en el Carrito"
                     >
                        <RefreshCw className="w-3.5 h-3.5" />
                     </button>
                  </div>
               </div>

               <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Forma Pago</label>
                  <select className="w-full border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800 font-bold" value={paymentMethod} onChange={(e: any) => setPaymentMethod(e.target.value)}>
                     <option value="CONTADO">CONTADO</option>
                     <option value="CREDITO">CRÉDITO</option>
                  </select>
               </div>

               <div className="col-span-12 relative mt-1">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Dirección de Entrega</label>
                  <div className="flex bg-slate-50 border border-slate-300 rounded">
                     <input className="w-full px-2 py-0.5 bg-transparent text-slate-600 outline-none" value={clientData.address} onChange={e => setClientData({ ...clientData, address: e.target.value })} />
                     {(() => {
                        const fullClient = searchedClients.find(c => c.doc_number === clientData.doc_number);
                        if (fullClient && fullClient.branches && fullClient.branches.length > 0) {
                           return (
                              <button type="button" onClick={() => setShowBranchSelector(!showBranchSelector)} className="px-2 border-l border-slate-300 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors">
                                 <MapPin className="w-4 h-4" /><ChevronDown className="w-3 h-3 ml-0.5" />
                              </button>
                           );
                        }
                        return null;
                     })()}
                  </div>
                  {showBranchSelector && (
                     <div className="absolute top-full right-0 mt-1 w-[400px] bg-white border border-slate-300 shadow-xl rounded z-50 overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-xs text-slate-600 uppercase">Seleccione Dirección de Entrega</div>
                        {(() => {
                           const fullClient = searchedClients.find(c => c.doc_number === clientData.doc_number);
                           if (!fullClient) return null;
                           const allAddresses = [fullClient.address, ...(fullClient.branches || [])];
                           return (
                              <div className="max-h-48 overflow-y-auto">
                                 {allAddresses.map((addr, idx) => (
                                    <div key={idx} onClick={() => { setClientData({ ...clientData, address: addr }); setShowBranchSelector(false); }} className="px-3 py-2 border-b border-slate-100 hover:bg-blue-50 cursor-pointer flex items-start gap-2">
                                       <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${clientData.address === addr ? 'text-blue-600' : 'text-slate-400'}`} />
                                       <div>
                                          <div className={`text-sm ${clientData.address === addr ? 'font-bold text-blue-900' : 'font-medium text-slate-700'}`}>{addr}</div>
                                          {idx === 0 && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 rounded uppercase font-bold">Sede Principal</span>}
                                          {idx > 0 && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 rounded uppercase font-bold">Sucursal</span>}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           );
                        })()}
                     </div>
                  )}
               </div>
            </div>
         </div>

         {/* === GRID SECTION === */}
         <div className="flex-1 bg-white border border-slate-400 flex flex-col shadow-sm">
            <div className="bg-blue-50 border-b border-blue-200 p-1 flex items-end gap-1">
               <div className="flex-1 relative">
                  <label className="block text-[10px] font-bold text-blue-800 mb-0.5 ml-1">Producto (Búsqueda en Nube)</label>
                  <div className="relative">
                     <Search className="absolute left-1.5 top-1.5 w-3 h-3 text-blue-400" />
                     <input
                        ref={productInputRef}
                        className="w-full pl-6 pr-6 py-1 border border-blue-300 rounded text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                        placeholder="PISTOLEAR O ESCRIBIR..."
                        value={productSearch}
                        onChange={e => { setProductSearch(e.target.value); setShowProductSuggestions(true); setHighlightedIndex(0); }}
                        onKeyDown={handleProductKeyDown}
                        onFocus={() => setShowProductSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                     />
                     {isSearchingProd && <Loader2 className="absolute right-1.5 top-1.5 w-4 h-4 text-blue-500 animate-spin" />}
                     
                     {showProductSuggestions && searchedProducts.length > 0 && (
                        <div className="absolute top-full left-0 w-full bg-white border border-slate-400 shadow-2xl z-50 max-h-60 overflow-auto">
                           <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100 font-bold text-slate-600">
                                 <tr>
                                    <th className="p-2">Código</th>
                                    <th className="p-2">Producto</th>
                                    <th className="p-2 text-right">Precio Und</th>
                                    <th className="p-2 text-right text-blue-700">Stock Real</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {searchedProducts.map((p, idx) => (
                                    <tr key={p.id} onMouseDown={() => proceedSelectProduct(p as any)} className={`cursor-pointer ${idx === highlightedIndex ? 'bg-blue-200' : 'hover:bg-blue-50'}`}>
                                       <td className="p-2 font-mono text-blue-800 font-bold">{p.sku}</td>
                                       <td className="p-2 font-medium">{p.name}</td>
                                       <td className="p-2 text-right">S/ {Number(p.price_unit || 0).toFixed(2)}</td>
                                       <td className={`p-2 text-right font-black ${p.current_stock > 0 ? 'text-green-600' : 'text-red-500'}`}>{p.current_stock}</td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     )}
                  </div>
               </div>

               <div className="w-16">
                  <label className="block text-[10px] font-bold text-blue-800 mb-0.5 text-center">Cant.</label>
                  <input ref={qtyInputRef} type="number" min="1" className="w-full border border-blue-300 rounded py-1 px-1 text-center font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={quantity} onChange={e => setQuantity(Number(e.target.value))} onKeyDown={e => handleInputKeyDown(e, unitSelectRef)} disabled={!selectedProduct} />
               </div>

               <div className="w-24 relative">
                  <label className="block text-[10px] font-bold text-blue-800 mb-0.5">Unidad</label>
                  <select ref={unitSelectRef} className="w-full border border-blue-300 rounded py-1 px-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none" value={unitMode} onChange={e => handleUnitChange(e.target.value as 'BASE' | 'PKG')} onKeyDown={e => handleInputKeyDown(e, addButtonRef as any)} disabled={!selectedProduct}>
                     <option value="BASE">{selectedProduct?.unit_type ? selectedProduct.unit_type.toUpperCase() : 'UND'}</option>
                     {selectedProduct?.package_type && <option value="PKG">{selectedProduct.package_type.toUpperCase()}</option>}
                  </select>
                  <ChevronDown className="absolute right-1 top-5 w-3 h-3 text-slate-400 pointer-events-none" />
               </div>

               <div className="w-20 relative">
                  <div className="flex justify-between items-center mb-0.5">
                     <label className="block text-[10px] font-bold text-blue-800">Precio</label>
                     {selectedProduct && (
                        <button type="button" onClick={() => { if (priceLocked) requestAdminAuth(() => setPriceLocked(false), 'Desbloq Precio'); else setPriceLocked(true); }} className={`text-[8px] px-1 rounded font-bold ${priceLocked ? 'bg-slate-200 text-slate-500' : 'bg-red-500 text-white animate-pulse'}`}>{priceLocked ? 'BLOQ' : 'LIBRE'}</button>
                     )}
                  </div>
                  <input ref={priceInputRef} type="number" className="w-full border border-blue-300 rounded py-1 px-1 text-right text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-200" value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))} onKeyDown={e => handleInputKeyDown(e, discountInputRef)} disabled={!selectedProduct || isBonus || priceLocked} />
               </div>

               <div className="w-14">
                  <label className="block text-[10px] font-bold text-blue-800 mb-0.5 text-right">% Dsc</label>
                  <input ref={discountInputRef} type="number" className="w-full border border-blue-300 rounded py-1 px-1 text-right text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-200" value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} onKeyDown={e => handleInputKeyDown(e, 'ADD')} disabled={!selectedProduct || isBonus || priceLocked} />
               </div>

               <div className="w-16 flex items-center justify-center pb-1">
                  <label className="flex items-center text-[10px] font-bold text-blue-800 cursor-pointer">
                     <input type="checkbox" className="mr-1" checked={isBonus} onChange={e => { if (e.target.checked) requestAdminAuth(() => setIsBonus(true), 'Autorizar Bonificación'); else setIsBonus(false); }} onKeyDown={e => handleInputKeyDown(e, 'ADD')} />
                     Bonif.
                  </label>
               </div>

               <button type="button" ref={addButtonRef} onClick={handleAddToCart} disabled={!selectedProduct} className="bg-accent hover:bg-blue-700 text-white p-1.5 rounded shadow-sm disabled:opacity-50 focus:ring-2 focus:ring-blue-500 outline-none">
                  <Plus className="w-5 h-5" />
               </button>
            </div>

            {/* Header of Grid */}
            <div className="bg-slate-200 border-b border-slate-300 text-slate-700 font-bold text-[11px] uppercase flex px-1 py-1.5">
               <div className="w-8 text-center">#</div>
               <div className="w-24 px-2">Código</div>
               <div className="flex-1 px-2">Descripción Producto</div>
               <div className="w-16 text-right px-2">Cant</div>
               <div className="w-24 text-center px-2">Unidad</div>
               <div className="w-20 text-right px-2">Precio</div>
               <div className="w-16 text-right px-2">Dsc %</div>
               <div className="w-24 text-right px-2">Importe</div>
               <div className="w-8 text-center"></div>
            </div>

            {/* Body of Grid */}
            <div className="flex-1 overflow-auto bg-white">
               <table className="w-full text-left text-xs">
                  <tbody>
                     {cart.map((item, index) => {
                        const prod = cartProductsCache[item.product_id] || item.product;
                        const autoPromo = item.auto_promo_id ? dbAutoPromos.find(ap => ap.id === item.auto_promo_id) : null;
                        return (
                           <tr key={item.id} className={`border-b border-slate-100 ${item.is_bonus ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                              <td className="p-2 w-8 text-center text-xs font-bold text-slate-700">{index + 1}</td>
                              <td className="p-2 w-24 font-mono text-slate-600">{item.product_sku}</td>
                              <td className="p-2 flex-1">
                                 <div className="font-bold text-xs text-slate-800">
                                    {item.product_name}
                                    {autoPromo && <span className="ml-2 text-[9px] bg-green-500 text-white px-1 py-0.5 rounded shadow-sm inline-flex items-center"><Zap className="w-2 h-2 mr-1" />{autoPromo.name}</span>}
                                    {item.is_bonus && !autoPromo && <span className="ml-2 text-[9px] bg-orange-500 text-white px-1 py-0.5 rounded shadow-sm">BONIF</span>}
                                 </div>
                                 <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                    {prod?.sku} | {prod?.brand}
                                 </div>
                              </td>
                              <td className="p-2 w-16 text-right font-bold">
                                 <input
                                    type="number" min="1"
                                    className="w-full text-right bg-blue-50 border border-blue-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={item.quantity_presentation || ''}
                                    onChange={e => {
                                       const val = e.target.value;
                                       const newCart = [...cart];
                                       newCart[index] = { ...newCart[index], quantity_presentation: val as any };
                                       setCart(newCart);
                                    }}
                                    onBlur={e => {
                                       let val = parseInt(e.target.value, 10);
                                       if (isNaN(val) || val <= 0) val = 1; 
                                       handleCartItemQtyChange(index, val.toString());
                                    }}
                                    onKeyDown={e => {
                                       if (e.key === 'Enter') {
                                          e.preventDefault();
                                          (e.target as HTMLInputElement).blur(); 
                                       }
                                    }}
                                 />
                              </td>
                              <td className="p-2 w-24 text-center text-[10px] text-slate-500 font-bold uppercase">
                                  {item.selected_unit}
                              </td>
                              <td className="p-2 w-20 text-right text-slate-600">S/ {Number(item.unit_price || 0).toFixed(2)}</td>
                              <td className="p-2 w-16 text-right text-slate-500">{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
                              <td className="p-2 w-24 text-right font-bold text-slate-900 text-sm">S/ {Number(item.total_price || 0).toFixed(2)}</td>
                              <td className="p-2 w-8 text-right">
                                 <button type="button" onClick={() => removeFromCart(index)} disabled={!!item.auto_promo_id} className={`text-red-400 hover:bg-red-50 p-1 rounded transition-colors ${item.auto_promo_id ? 'opacity-50 cursor-not-allowed hidden' : ''}`}>
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
               {cart.length === 0 && <div className="p-8 text-center text-slate-400 italic font-bold">No hay productos en este pedido. Use el buscador de arriba para añadir.</div>}
            </div>
         </div>

         {/* === FOOTER TOTALS === */}
         <div className="h-24 bg-slate-100 border-t border-slate-400 flex p-2 gap-4">
            <div className="flex-1 flex gap-2 items-end pb-2">
               <button type="button" onClick={handlePreview} disabled={cart.length === 0} className={`bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded flex items-center shadow-sm font-bold ${cart.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}>
                  <Printer className="w-4 h-4 mr-2" /> Vista Previa
               </button>
               <div className="flex-1"></div>
               <div className="text-[11px] text-slate-600 font-medium">
                  * Este módulo generará un PEDIDO que reservará stock.<br/>
                  * El sistema re-evaluará las promociones automáticamente si modifica cantidades.
               </div>
            </div>

            <div className="w-64 bg-white border border-slate-300 shadow-sm rounded p-2 grid grid-cols-2 gap-y-1">
               <div className="text-right text-slate-600 font-bold">Op. Gravada:</div>
               <div className="text-right font-mono text-slate-800">{subtotal.toFixed(2)}</div>
               <div className="text-right text-slate-600 font-bold">IGV ({dbCompany?.igv_percent || 18}%):</div>
               <div className="text-right font-mono text-slate-800">{igv.toFixed(2)}</div>
               <div className="col-span-2 border-t border-slate-200 my-1"></div>
               <div className="text-right text-slate-800 font-bold text-sm self-center">TOTAL A PAGAR:</div>
               <div className="text-right font-bold text-xl bg-slate-800 text-blue-400 px-2 rounded font-mono">
                  {grandTotal.toFixed(2)}
               </div>
            </div>

            <button type="button" onClick={handleSaveOrderClick} disabled={cart.length === 0 || isSaving} className={`w-32 bg-blue-600 text-white font-bold rounded shadow-lg flex flex-col items-center justify-center ${cart.length === 0 || isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}>
               <Save className="w-6 h-6 mb-1" />
               {isEditMode ? 'SOBREESCRIBIR' : 'GUARDAR'}
            </button>
         </div>

         {/* === SEARCH MODAL === */}
         {isSearchModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-5xl rounded-lg shadow-2xl flex flex-col max-h-[85vh] border-4 border-blue-500 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
                     <h3 className="font-black flex items-center text-lg"><Search className="w-5 h-5 mr-2 text-blue-400" /> BÚSQUEDA DE PEDIDOS (PENDIENTES)</h3>
                     <button type="button" onClick={() => setIsSearchModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="p-4 bg-slate-50 border-b border-slate-200 relative">
                     <input
                        autoFocus
                        className="w-full border-2 border-slate-300 rounded p-4 text-xl font-bold focus:border-blue-500 outline-none"
                        placeholder="Escriba Nro Pedido (Ej. PE01), RUC o Cliente..."
                        value={orderSearchTerm}
                        onChange={e => setOrderSearchTerm(e.target.value)}
                     />
                     {isSearchingOrder && <Loader2 className="absolute right-8 top-8 w-6 h-6 text-blue-500 animate-spin" />}
                  </div>
                  <div className="flex-1 overflow-auto bg-white relative">
                     <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200 z-10 shadow-sm">
                           <tr>
                              <th className="p-4">Documento</th>
                              <th className="p-4">Fecha</th>
                              <th className="p-4">Cliente</th>
                              <th className="p-4 text-right">Total</th>
                              <th className="p-4 text-center">Acción</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {searchedOrders.map(o => (
                              <tr key={o.id} className="hover:bg-blue-50 transition-colors">
                                 <td className="p-4"><span className="font-bold text-slate-800 text-[15px]">{o.code}</span></td>
                                 <td className="p-4"><span className="text-slate-600 font-medium text-[15px]">{new Date(o.created_at).toLocaleDateString()}</span></td>
                                 <td className="p-4">
                                    <div className="font-bold text-slate-800 text-[15px]">{o.client_name}</div>
                                    <div className="text-[13px] text-slate-500">{o.client_doc_number}</div>
                                 </td>
                                 <td className="p-4 text-right"><span className="font-black text-slate-900 text-[16px]">S/ {Number(o.total || 0).toFixed(2)}</span></td>
                                 <td className="p-4 text-center flex justify-center gap-2">
                                    <button type="button" onClick={() => setShowHistoryModal({ isOpen: true, order: o })} className="bg-white border border-slate-300 px-3 py-1.5 rounded text-[13px] font-bold text-slate-700 hover:bg-slate-100 shadow-sm flex items-center transition-all hover:border-slate-400" title="Ver Historial">
                                       H.
                                    </button>
                                    <button type="button" onClick={() => loadOrder(o)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold shadow transition-colors flex items-center justify-center w-32">
                                       <Edit3 className="w-4 h-4 mr-2" /> Editar
                                    </button>
                                 </td>
                              </tr>
                           ))}
                           {searchedOrders.length === 0 && (
                              <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-base font-bold">No hay pedidos pendientes que coincidan.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}

         {/* === HISTORY MODAL === */}
         {showHistoryModal.isOpen && showHistoryModal.order && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center bg-slate-100 rounded-t-lg mb-4">
                     <h3 className="font-bold text-slate-800 text-lg flex items-center"><Eye className="w-5 h-5 mr-2 text-slate-500" /> Historial de Documento: {showHistoryModal.order.code}</h3>
                     <button type="button" onClick={() => setShowHistoryModal({ isOpen: false, order: null })} className="text-slate-500 hover:text-red-500"><X className="w-6 h-6" /></button>
                  </div>

                  <div className="flex-1 overflow-auto border border-slate-200 rounded">
                     <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                           <tr>
                              <th className="p-3 border-b border-slate-200">Fecha</th>
                              <th className="p-3 border-b border-slate-200">Acción</th>
                              <th className="p-3 border-b border-slate-200">Usuario</th>
                              <th className="p-3 border-b border-slate-200">Detalles</th>
                           </tr>
                        </thead>
                        <tbody>
                           <tr className="hover:bg-slate-50">
                              <td className="p-3 border-b border-slate-100">{new Date(showHistoryModal.order.created_at).toLocaleString()}</td>
                              <td className="p-3 border-b border-slate-100 font-bold text-green-700">CREADO</td>
                              <td className="p-3 border-b border-slate-100 italic">Sistema</td>
                              <td className="p-3 border-b border-slate-100 text-slate-500">Documento Inicial</td>
                           </tr>
                           {/* Render actual history events si existen */}
                           {showHistoryModal.order.history && showHistoryModal.order.history.map((evt: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                 <td className="p-3 border-b border-slate-100">{new Date(evt.date).toLocaleString()}</td>
                                 <td className="p-3 border-b border-slate-100 font-bold text-blue-700">{evt.action}</td>
                                 <td className="p-3 border-b border-slate-100 font-medium">{evt.user_id}</td>
                                 <td className="p-3 border-b border-slate-100 text-slate-600">{evt.details || '-'}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>

                  <div className="mt-4 flex justify-end">
                     <button type="button" onClick={() => setShowHistoryModal({ isOpen: false, order: null })} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded">
                        Cerrar
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* === ADMIN PASSWORD MODAL === */}
         {showAdminAuthModal.isOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
               <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                  <h3 className="font-bold text-slate-800 text-lg mb-2">Se requiere autorización</h3>
                  <p className="text-sm text-slate-600 mb-4">Ingrese la contraseña de administrador para: <strong className="text-red-600">{showAdminAuthModal.targetActionName}</strong></p>

                  <input
                     id="admin-password-input"
                     type="password"
                     className="w-full border-2 border-slate-300 rounded p-2 mb-4 text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 outline-none"
                     placeholder="••••"
                     value={adminPasswordInput}
                     onChange={e => setAdminPasswordInput(e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter') verifyAdminAndExecute(); else if (e.key === 'Escape') setShowAdminAuthModal({ isOpen: false, triggerAction: () => { }, targetActionName: '' }); }}
                  />

                  <div className="flex gap-2 justify-end">
                     <button type="button" onClick={() => setShowAdminAuthModal({ isOpen: false, triggerAction: () => { }, targetActionName: '' })} className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 font-bold text-sm">
                        Cancelar (ESC)
                     </button>
                     <button type="button" onClick={verifyAdminAndExecute} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-sm">
                        Autorizar (ENTER)
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
