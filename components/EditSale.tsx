import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Product, BatchAllocation, SaleItem, Client, Sale, AutoPromotion, Promotion, Batch } from '../types';
import { Plus, Trash2, Search, Printer, Save, X, ChevronDown, Loader2, AlertTriangle, ShieldCheck, CheckCircle2, HelpCircle, AlertOctagon, Gift, Edit3, MapPin, Zap, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';
import { PdfEngine } from './PdfEngine';

const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const EditSale: React.FC = () => {
   const { users, currentUser } = useStore();

   const productInputRef = useRef<HTMLInputElement>(null);
   const qtyInputRef = useRef<HTMLInputElement>(null);
   const unitSelectRef = useRef<HTMLSelectElement>(null);
   const priceInputRef = useRef<HTMLInputElement>(null);
   const addButtonRef = useRef<HTMLButtonElement>(null);

   const [priceLocked, setPriceLocked] = useState(false); 
   const [isSaving, setIsSaving] = useState(false);

   const [dialog, setDialog] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'warning' | 'confirm' | 'info'; title: string; message: string; onConfirm?: () => void }>({
       isOpen: false, type: 'info', title: '', message: ''
   });

   const showDialog = (type: 'success' | 'error' | 'warning' | 'confirm' | 'info', title: string, message: string, onConfirm?: () => void) => {
       setDialog({ isOpen: true, type, title, message, onConfirm });
   };
   const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

   // --- ADMIN AUTH STATE ---
   const [showAdminAuthModal, setShowAdminAuthModal] = useState({ isOpen: false, triggerAction: () => { }, targetActionName: '' });
   const [adminPasswordInput, setAdminPasswordInput] = useState('');

   // --- MASTER DATA SUPABASE SYNC ---
   const [dbCompany, setDbCompany] = useState<any>(null); 
   const [dbSellers, setDbSellers] = useState<any[]>([]);
   const [dbPriceLists, setDbPriceLists] = useState<any[]>([]);
   const [dbZones, setDbZones] = useState<any[]>([]);
   const [cartProductsCache, setCartProductsCache] = useState<Record<string, Product>>({});

   // --- SALE STATE ---
   const [originalSale, setOriginalSale] = useState<Sale | null>(null);
   const [docType, setDocType] = useState<'FACTURA' | 'BOLETA'>('FACTURA');
   const [series, setSeries] = useState('');
   const [docNumber, setDocNumber] = useState('');
   const [paymentMethod, setPaymentMethod] = useState<'CONTADO' | 'CREDITO'>('CONTADO');

   // --- CLIENT STATE ---
   const [selectedClientId, setSelectedClientId] = useState('');
   const [clientData, setClientData] = useState<Partial<Client>>({ name: '', doc_number: '', address: '', price_list_id: '', city: '' });
   const [clientSearch, setClientSearch] = useState('');
   const [showClientSuggestions, setShowClientSuggestions] = useState(false);
   const [searchedClients, setSearchedClients] = useState<Client[]>([]);
   const [isSearchingClient, setIsSearchingClient] = useState(false);
   const [selectedSellerId, setSelectedSellerId] = useState('');
   const [clientCreditInfo, setClientCreditInfo] = useState({ limit: 0, debt: 0, overdue: false, isChecking: false });

   useEffect(() => {
       const fetchMasters = async () => {
           try {
               const [compRes, sellRes, plRes, zRes] = await Promise.all([
                   supabase.from('company_config').select('*').limit(1).maybeSingle(),
                   supabase.from('sellers').select('*').order('name'),
                   supabase.from('price_lists').select('*').order('name'),
                   supabase.from('zones').select('*')
               ]);
               
               if (compRes.data) setDbCompany(compRes.data);
               if (sellRes.data) setDbSellers(sellRes.data);
               if (plRes.data) setDbPriceLists(plRes.data);
               if (zRes.data) setDbZones(zRes.data);
           } catch (e) { console.error("Error cargando maestros:", e); }
       };
       fetchMasters();
   }, []);

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

   // --- LINE ENTRY STATE ---
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
                   const { data: bData } = await supabase.from('batches').select('*').in('product_id', pIds).gt('quantity_current', 0);
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
   const [cart, setCart] = useState<SaleItem[]>([]);

   const [isSearchModalOpen, setIsSearchModalOpen] = useState(true); 
   const [saleSearchTerm, setSaleSearchTerm] = useState('');
   const [searchedSales, setSearchedSales] = useState<Sale[]>([]);
   const [isSearchingSale, setIsSearchingSale] = useState(false);

   useEffect(() => {
       if (!isSearchModalOpen) return;
       const timer = setTimeout(async () => {
           setIsSearchingSale(true);
           try {
               let query = supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(15);
               if (saleSearchTerm.trim().length > 0) {
                  query = query.or(`number.ilike.%${saleSearchTerm}%,client_name.ilike.%${saleSearchTerm}%,client_ruc.ilike.%${saleSearchTerm}%`);
               }
               const { data, error } = await query;
               if (error) throw error;
               if (data) setSearchedSales(data as Sale[]);
           } catch (e) { console.error("Error buscando ventas:", e);
           } finally { setIsSearchingSale(false); }
       }, 400);
       return () => clearTimeout(timer);
   }, [saleSearchTerm, isSearchModalOpen]);

   const isItemPackage = (itemUnitName: string, prod: any) => {
       if (!prod || !itemUnitName) return false;
       return itemUnitName.toUpperCase() === (prod.package_type || '').toUpperCase() || itemUnitName.toUpperCase() === 'PKG' || itemUnitName.toUpperCase() === 'CJA';
   };

   // --- CALCULATIONS ---
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

   // =========================================================================
   // 🚨 BOTÓN MÁGICO: ACTUALIZAR PRECIOS SEGÚN LA LISTA SELECCIONADA
   // =========================================================================
   const handleUpdatePricesFromList = () => {
       if (cart.length === 0) return;
       if (!clientData.price_list_id) {
           showDialog('warning', 'Aviso', 'Por favor, seleccione una Lista de Precios primero.');
           return;
       }

       const multiplier = getMultiplier();

       const newCart = cart.map(item => {
           // Si el producto fue marcado como gratis (regalo), se respeta esa decisión
           if (item.is_bonus) return item;

           const product = cartProductsCache[item.product_id] || item.product;
           if (!product) return item;

           const isPkg = isItemPackage(item.selected_unit, product);
           const basePrice = isPkg ? Number(product.price_package || product.price_unit || 0) : Number(product.price_unit || 0);
           
           const newPrice = basePrice * multiplier;
           const newTotal = calculateTotal(Number(item.quantity_presentation), newPrice, Number(item.discount_percent || 0));

           return {
               ...item,
               unit_price: newPrice,
               total_price: newTotal
           };
       });

       setCart(newCart);
       showDialog('success', 'Precios Recalculados', 'Se han actualizado los precios de todos los productos en base a la nueva Lista de Precios seleccionada.');
   };

   const loadSale = async (sale: Sale) => {
      if (sale.sunat_status === 'SENT' || sale.sunat_status === 'ACCEPTED') {
          showDialog('error', 'Bloqueo SUNAT', 'Este documento ya fue declarado a SUNAT. No se puede modificar. Emita una Nota de Crédito.');
          return;
      }

      setIsSaving(true);
      try {
          let itemsToLoad: any[] = [];
          let finalCache = { ...cartProductsCache };
          
          const { data: saleItemsData, error: itemsErr } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);

          if (itemsErr) throw itemsErr;

          if (saleItemsData && saleItemsData.length > 0) {
              itemsToLoad = saleItemsData;
          } 
          else if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
              itemsToLoad = sale.items;
          } else if (typeof sale.items === 'string') {
              try { itemsToLoad = JSON.parse(sale.items); } catch(e) {}
          }

          if (itemsToLoad.length === 0) {
              alert("⚠️ ADVERTENCIA: El documento se cargó, pero el sistema no pudo encontrar el detalle. Deberá armarlo manualmente.");
          }

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
          if (sale.client_id) {
              const { data: cData } = await supabase.from('clients').select('*').eq('id', sale.client_id).single();
              if (cData) {
                  clientListId = cData.price_list_id || '';
                  clientCity = cData.city || '';
                  checkClientCredit(sale.client_id, cData.credit_limit || 0);
              }
          }

          const safeItems = itemsToLoad.map((item: any) => {
              const matchedProd = finalCache[item.product_id];
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

          setOriginalSale({ ...sale, items: safeItems });
          setDocType(sale.document_type as any); 
          setSeries(sale.series); 
          setDocNumber(sale.number); 
          setSelectedClientId(sale.client_id || ''); 
          setSelectedSellerId(sale.seller_id || ''); 
          setPaymentMethod(sale.payment_method); 
          setClientSearch(sale.client_name); 

          setClientData({ 
             name: sale.client_name, 
             doc_number: sale.client_ruc, 
             address: sale.client_address, 
             price_list_id: clientListId, 
             city: clientCity 
          });
          
          setCart(safeItems); 
          setIsSearchModalOpen(false);

      } catch (err: any) {
          showDialog('error', 'Error Fatal', 'Falla al cargar detalles del documento: ' + err.message);
      } finally {
          setIsSaving(false);
      }
   };

   const handlePreview = async () => {
      if (!originalSale) return;
      const seller = dbSellers.find(s => s.id === selectedSellerId);
      const tempSale: any = { 
         ...originalSale,
         client_name: clientData.name || 'CLIENTE VARIOS',
         client_ruc: clientData.doc_number || '00000000',
         client_address: clientData.address || '',
         seller_id: selectedSellerId || undefined,
         client_id: selectedClientId || undefined,
         payment_method: paymentMethod,
         payment_status: paymentMethod === 'CREDITO' ? 'PENDING' : 'PAID',
         balance: paymentMethod === 'CREDITO' ? grandTotal : 0,
         subtotal,
         igv,
         total: grandTotal,
         items: cart, 
         seller_name: seller ? seller.name : '',
         previous_debt: clientCreditInfo.debt 
      };
      
      try { await PdfEngine.openDocument(tempSale as Sale, docType, dbCompany); } 
      catch (err) { showDialog('error', 'Error', 'Error generando la vista previa.'); }
   };

   const requestAdminAuth = (action: () => void, actionName: string) => {
      setShowAdminAuthModal({ isOpen: true, triggerAction: action, targetActionName: actionName });
      setTimeout(() => document.getElementById('admin-password-input')?.focus(), 100);
   };

   const verifyAdminAndExecute = () => {
      const adminUser = users.find(u => u.role === 'ADMIN' && u.password === adminPasswordInput);
      if (adminUser) { 
         showAdminAuthModal.triggerAction(); 
         setShowAdminAuthModal({ isOpen: false, triggerAction: () => { }, targetActionName: '' }); 
         setAdminPasswordInput('');
      } else { 
         showDialog('error', 'Autorización Denegada', "Contraseña incorrecta o usuario no autorizado."); 
      }
   };

   const resetEntryForm = () => {
      setSelectedProduct(null); setProductSearch(''); setQuantity(1); setUnitPrice(0);
      setTimeout(() => productInputRef.current?.focus(), 50);
   }

   const handleAddToCart = () => {
      if (!selectedProduct) { showDialog('error', 'Error', 'Busque y seleccione un producto.'); return; }
      if (quantity <= 0) { showDialog('warning', 'Aviso', "Cantidad inválida"); return; }
      
      const prod = selectedProduct as any;
      const isPkgMode = unitMode === 'PKG';
      const conversionFactor = isPkgMode ? Number(prod.package_content || 1) : 1;
      const requiredBaseUnits = quantity * conversionFactor;
      const realUnitName = isPkgMode ? (prod.package_type || 'CAJA').toUpperCase() : (prod.unit_type || 'UND').toUpperCase();
      
      const availableBatches = loadedBatches[prod.id] || [];
      const totalStock = availableBatches.length > 0 ? availableBatches.reduce((acc, b) => acc + Number(b.quantity_current || 0), 0) : Number(prod.current_stock || prod.stock || 0);

      if (totalStock < requiredBaseUnits) { 
         alert(`Atención: Estás forzando stock negativo. Disponible: ${totalStock}. Continuará en modo auditoría.`); 
      }

      let remaining = requiredBaseUnits;
      const selectedBatches: BatchAllocation[] = [];
      for (const batch of availableBatches) {
         if (remaining <= 0) break;
         const take = Math.min(remaining, Number(batch.quantity_current || 0));
         selectedBatches.push({ batch_id: batch.id, batch_code: batch.code, quantity: take });
         remaining -= take;
      }

      const existingItemIndex = cart.findIndex(item => item.product_id === prod.id && item.selected_unit === realUnitName);

      if (existingItemIndex >= 0) {
         const existing = cart[existingItemIndex];
         const newQty = Number(existing.quantity_presentation || 0) + quantity;
         const newPrice = calculateTotal(newQty, unitPrice, 0); 
         const newCart = [...cart];
         newCart[existingItemIndex] = { 
            ...existing, 
            quantity_presentation: newQty, 
            quantity_base: isPkgMode ? newQty * Number(prod.package_content || 1) : newQty, 
            total_price: newPrice, 
            unit_price: unitPrice, 
            product: prod, 
            batch_allocations: [] 
         };
         setCart(newCart);
         resetEntryForm();
      } else {
         const newCart = [...cart, { 
            id: crypto.randomUUID(), 
            sale_id: originalSale?.id || '', 
            product_id: prod.id, 
            product_sku: prod.sku, 
            product_name: prod.name, 
            selected_unit: realUnitName, 
            quantity_presentation: quantity, 
            quantity_base: requiredBaseUnits, 
            unit_price: unitPrice, 
            total_price: calculateTotal(quantity, unitPrice, 0), 
            discount_percent: 0, 
            discount_amount: 0, 
            is_bonus: false, 
            batch_allocations: selectedBatches, 
            product: prod 
         }];
         setCart(newCart);
         resetEntryForm();
      }
   };

   // EDICIÓN LIBRE DE CANTIDAD Y PRECIO DIRECTO EN EL CARRITO
   const handleCartItemChange = (index: number, field: string, value: number) => {
      const updatedCart = [...cart];
      const item = updatedCart[index];
      
      let newQty = field === 'qty' ? value : item.quantity_presentation;
      let newPu = field === 'pu' ? value : item.unit_price;

      if (isNaN(newQty) || newQty <= 0) newQty = 1;
      if (isNaN(newPu) || newPu < 0) newPu = 0;

      const product = cartProductsCache[item.product_id] || item.product;
      const isPkg = isItemPackage(item.selected_unit, product);
      const conversionFactor = isPkg ? Number(product?.package_content || 1) : 1;

      updatedCart[index] = { 
          ...item, 
          quantity_presentation: newQty, 
          quantity_base: newQty * conversionFactor, 
          unit_price: newPu,
          total_price: calculateTotal(newQty, newPu, item.discount_percent), 
          is_bonus: newPu === 0 
      };
      setCart(updatedCart);
   };

   const setItemFree = (index: number) => {
       const updatedCart = [...cart];
       updatedCart[index] = {
           ...updatedCart[index],
           unit_price: 0,
           total_price: 0,
           discount_percent: 100,
           is_bonus: true
       };
       setCart(updatedCart);
   };

   const selectClient = async (c: Client) => {
      setSelectedClientId(c.id);
      let autoSellerId = '';
      if (c.zone_id) { const zone = dbZones.find(z => z.id === c.zone_id); if (zone && zone.assigned_seller_id) { autoSellerId = zone.assigned_seller_id; } }
      setSelectedSellerId(autoSellerId);

      setClientData({ name: c.name, doc_number: c.doc_number, address: c.address, price_list_id: c.price_list_id || '', city: c.city });
      setClientSearch(c.name); setShowClientSuggestions(false);
      if (c.payment_condition && c.payment_condition.toUpperCase().includes('CREDIT')) { setPaymentMethod('CREDITO'); } else { setPaymentMethod('CONTADO'); }
      checkClientCredit(c.id, c.credit_limit || 0);
   };

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

   const proceedSelectProduct = (p: Product & { current_stock?: number }) => {
      setCartProductsCache(prev => ({...prev, [p.id]: p}));
      setSelectedProduct(p); setProductSearch(p.name); setShowProductSuggestions(false); setUnitMode('BASE'); 
      setUnitPrice(Number(p.price_unit || 0) * getMultiplier()); setQuantity(1);
      setTimeout(() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); }, 50);
   };

   const handleUnitChange = (mode: 'BASE' | 'PKG') => {
      setUnitMode(mode);
      if (selectedProduct) {
         let price = mode === 'PKG' ? Number(selectedProduct.price_package || 0) : Number(selectedProduct.price_unit || 0);
         setUnitPrice(price * getMultiplier());
      }
   };

   const handleProductKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev + 1) % searchedProducts.length);
      } else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev - 1 + searchedProducts.length) % searchedProducts.length);
      } else if (e.key === 'Enter') { e.preventDefault(); if (searchedProducts.length > 0) proceedSelectProduct(searchedProducts[highlightedIndex]);
      } else if (e.key === 'Escape') { setShowProductSuggestions(false); }
   };

   const handleInputKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<any> | 'ADD') => {
      if (e.key === 'Enter') {
         e.preventDefault();
         if (nextRef === 'ADD') addButtonRef.current?.focus();
         else if (nextRef.current) { nextRef.current.focus(); if (nextRef.current.select) nextRef.current.select(); }
      } else if (e.key === 'Escape') { setSelectedProduct(null); setProductSearch(''); setTimeout(() => productInputRef.current?.focus(), 50); }
   };

   const executeSaveEdit = async () => {
      if (!originalSale) return;
      if (cart.length === 0) { showDialog('error', 'Error', 'El comprobante no puede estar vacío.'); return; }

      const seller = dbSellers.find(s => s.id === selectedSellerId);

      const updatedSaleData: any = {
         ...originalSale,
         client_name: clientData.name || 'CLIENTE VARIOS',
         client_ruc: clientData.doc_number || '00000000',
         client_address: clientData.address || '',
         seller_id: selectedSellerId || undefined,
         client_id: selectedClientId || undefined,
         payment_method: paymentMethod,
         payment_status: paymentMethod === 'CREDITO' ? 'PENDING' : 'PAID',
         balance: paymentMethod === 'CREDITO' ? grandTotal : 0,
         subtotal,
         igv,
         total: grandTotal,
         items: cart, 
         seller_name: seller ? seller.name : '',
         previous_debt: clientCreditInfo.debt
      };

      setIsSaving(true);

      try {
         const { data, error } = await supabase.rpc('update_sale_transaction', { p_sale_data: updatedSaleData });
         if (error) throw error;
         
         if (data && data.success) {
            showDialog('success', 'Comprobante Editado', `Modificación Guardada con éxito. El Kardex ha sido rectificado automáticamente.`);
            
            setOriginalSale(null);
            setCart([]);
            setClientSearch('');
            setClientData({ name: '', doc_number: '', address: '', price_list_id: '', city: '' });
            setIsSearchModalOpen(true);
         }
      } catch (err: any) { 
         showDialog('error', 'Error de Edición', err.message);
      } finally { 
         setIsSaving(false); 
      }
   };

   // ===============================================
   // RENDERIZADO VISUAL
   // ===============================================

   if (!originalSale && !isSearchModalOpen) {
       return (
           <div className="flex flex-col items-center justify-center h-full bg-slate-200">
               <AlertOctagon className="w-20 h-20 text-slate-400 mb-4" />
               <h2 className="text-2xl font-black text-slate-600 mb-2">Módulo de Auditoría y Edición</h2>
               <p className="text-slate-500 font-medium mb-6">Debe seleccionar un comprobante existente para modificarlo.</p>
               <button onClick={() => setIsSearchModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-amber-600/30 flex items-center transition-all active:scale-95">
                   <Search className="w-5 h-5 mr-2" /> Buscar Comprobante
               </button>
           </div>
       );
   }

   return (
      <div className="flex flex-col h-full bg-slate-200 p-2 font-sans text-xs relative">

         {/* --- ADMIN PASSWORD MODAL --- */}
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
                     <button
                        type="button"
                        onClick={() => setShowAdminAuthModal({ isOpen: false, triggerAction: () => { }, targetActionName: '' })}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 font-bold text-sm"
                     >
                        Cancelar (ESC)
                     </button>
                     <button
                        type="button"
                        onClick={verifyAdminAndExecute}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-sm"
                     >
                        Autorizar (ENTER)
                     </button>
                  </div>
               </div>
            </div>
         )}

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
               <Loader2 className="w-16 h-16 text-amber-500 animate-spin mb-4" />
               <h2 className="text-2xl font-black text-white tracking-widest">PROCESANDO AUDITORÍA...</h2>
               <p className="text-amber-200 font-medium mt-2">Leyendo y sincronizando base de datos...</p>
            </div>
         )}

         {/* === HEADER SECTION DE EDICIÓN === */}
         <div className="bg-amber-100 p-2 rounded shadow-sm border border-amber-300 mb-2 space-y-2 relative">
            <div className="absolute top-2 right-2 flex gap-2">
               <button type="button" onClick={() => { setOriginalSale(null); setCart([]); setIsSearchModalOpen(true); }} className="bg-slate-800 text-white px-3 py-1 rounded shadow text-xs font-bold hover:bg-slate-700 flex items-center">
                  <X className="w-3.5 h-3.5 mr-1" /> Descartar Cambios
               </button>
            </div>

            <div className="flex items-center gap-3 mt-1 py-1">
               <div className="flex items-center gap-2 bg-amber-50 px-2 py-1.5 rounded border border-amber-200 shadow-sm">
                  <Edit3 className="w-5 h-5 text-amber-600" />
                  <label className="font-black text-amber-900 text-sm">MODO EDICIÓN:</label>
                  <span className="font-bold text-amber-800 bg-amber-200 px-2 rounded uppercase">{docType} {series}-{docNumber}</span>
               </div>
               <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">Vendedor Asignado</label>
                  <select className="border border-slate-300 rounded px-2 py-1 text-sm bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={selectedSellerId} onChange={e => setSelectedSellerId(e.target.value)}>
                     <option value="">-- Sin Vendedor --</option>
                     {dbSellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
               <div className="text-[10px] text-amber-700 font-bold max-w-xs leading-tight">
                  ⚠️ Atención: Los cambios aquí afectan permanentemente el Kardex y los reportes financieros históricos.
               </div>
            </div>
         </div>

         {/* === CLIENT SECTION === */}
         <div className="flex items-start gap-2 mb-2">
            <div className="flex-1 grid grid-cols-12 gap-1 bg-slate-100 p-1.5 rounded border border-slate-200 relative">
               <div className="col-span-2 relative">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Cambiar Cliente (Cod / Buscar)</label>
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
               
               {/* BOTÓN MÁGICO DE ACTUALIZACIÓN DE PRECIOS */}
               <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Lista Precio Sugerida</label>
                  <div className="flex gap-1">
                     <select className="w-full border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800" value={clientData.price_list_id} onChange={e => setClientData({ ...clientData, price_list_id: e.target.value })}>
                        <option value="">-- General --</option>
                        {dbPriceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                     </select>
                     <button
                        type="button"
                        onClick={handleUpdatePricesFromList}
                        className="bg-amber-100 border border-amber-300 text-amber-700 px-1.5 rounded hover:bg-amber-200 transition-colors flex items-center justify-center shadow-sm"
                        title="Recalcular todos los precios según esta lista"
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
            </div>
         </div>

         {/* === GRID SECTION === */}
         <div className="flex-1 bg-white border border-slate-400 flex flex-col shadow-sm">
            {/* Entry Row */}
            <div className="bg-amber-50 border-b border-amber-200 p-1 flex items-end gap-1">
               <div className="flex-1 relative">
                  <label className="block text-[10px] font-bold text-amber-800 mb-0.5 ml-1">Añadir Producto</label>
                  <div className="relative">
                     <Search className="absolute left-1.5 top-1.5 w-3 h-3 text-amber-400" />
                     <input
                        ref={productInputRef}
                        className="w-full pl-6 pr-6 py-1 border border-amber-300 rounded text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none uppercase"
                        placeholder="BUSCAR..."
                        value={productSearch}
                        onChange={e => { setProductSearch(e.target.value); setShowProductSuggestions(true); setHighlightedIndex(0); }}
                        onKeyDown={handleProductKeyDown}
                        onFocus={() => setShowProductSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                     />
                     {isSearchingProd && <Loader2 className="absolute right-1.5 top-1.5 w-4 h-4 text-amber-500 animate-spin" />}
                     
                     {showProductSuggestions && searchedProducts.length > 0 && (
                        <div className="absolute top-full left-0 w-full bg-white border border-slate-400 shadow-2xl z-50 max-h-60 overflow-auto">
                           <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100 font-bold text-slate-600">
                                 <tr>
                                    <th className="p-2">Código</th>
                                    <th className="p-2">Producto</th>
                                    <th className="p-2 text-right">Stock</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {searchedProducts.map((p, idx) => (
                                    <tr key={p.id} onMouseDown={() => { proceedSelectProduct(p); }} className={`cursor-pointer ${idx === highlightedIndex ? 'bg-amber-200' : 'hover:bg-amber-50'}`}>
                                       <td className="p-2 font-mono text-slate-800 font-bold">{p.sku}</td>
                                       <td className="p-2 font-medium">{p.name}</td>
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
                  <label className="block text-[10px] font-bold text-amber-800 mb-0.5 text-center">Cant.</label>
                  <input ref={qtyInputRef} type="number" min="1" className="w-full border border-amber-300 rounded py-1 px-1 text-center font-bold text-slate-900 outline-none" value={quantity} onChange={e => setQuantity(Number(e.target.value))} disabled={!selectedProduct} onKeyDown={e => handleInputKeyDown(e, unitSelectRef)} />
               </div>

               <div className="w-24 relative">
                  <label className="block text-[10px] font-bold text-amber-800 mb-0.5">Unidad</label>
                  <select ref={unitSelectRef} className="w-full border border-amber-300 rounded py-1 px-1 text-xs bg-white outline-none appearance-none" value={unitMode} onChange={e => handleUnitChange(e.target.value as 'BASE' | 'PKG')} disabled={!selectedProduct} onKeyDown={e => handleInputKeyDown(e, priceInputRef)}>
                     <option value="BASE">{selectedProduct?.unit_type ? selectedProduct.unit_type.toUpperCase() : 'UND'}</option>
                     {selectedProduct?.package_type && <option value="PKG">{selectedProduct.package_type.toUpperCase()}</option>}
                  </select>
                  <ChevronDown className="absolute right-1 top-5 w-3 h-3 text-slate-400 pointer-events-none" />
               </div>

               <div className="w-20 relative">
                  <div className="flex justify-between items-center mb-0.5">
                     <label className="block text-[10px] font-bold text-amber-800">Prec Libre</label>
                     {selectedProduct && (
                        <button type="button" onClick={() => { if (priceLocked) requestAdminAuth(() => setPriceLocked(false), 'Desbloq Precio'); else setPriceLocked(true); }} className={`text-[8px] px-1 rounded font-bold ${priceLocked ? 'bg-slate-200 text-slate-500' : 'bg-red-500 text-white animate-pulse'}`}>{priceLocked ? 'BLOQ' : 'LIBRE'}</button>
                     )}
                  </div>
                  <input ref={priceInputRef} type="number" step="0.01" className="w-full border border-amber-300 rounded py-1 px-1 text-right text-slate-900 outline-none disabled:bg-slate-200" value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))} disabled={!selectedProduct || priceLocked} onKeyDown={e => handleInputKeyDown(e, 'ADD')} />
               </div>

               <button type="button" ref={addButtonRef} onClick={handleAddToCart} disabled={!selectedProduct} className="bg-amber-600 hover:bg-amber-700 text-white p-1.5 rounded shadow-sm disabled:opacity-50 outline-none mb-0.5">
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
               <div className="w-20 text-right px-2">Precio Libre</div>
               <div className="w-24 text-right px-2">Importe</div>
               <div className="w-20 text-center px-2">Regalo</div>
               <div className="w-8 text-center"></div>
            </div>

            {/* Body of Grid (EDICIÓN LIBRE) */}
            <div className="flex-1 overflow-auto bg-white">
               <table className="w-full text-left text-xs">
                  <tbody>
                     {cart.map((item, index) => {
                        return (
                           <tr key={item.id || index} className={`border-b border-slate-100 ${item.is_bonus ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                              <td className="p-2 w-8 text-center text-xs font-bold text-slate-700">{index + 1}</td>
                              <td className="p-2 w-24 font-mono text-slate-600">{item.product_sku}</td>
                              <td className="p-2 flex-1 font-bold text-xs text-slate-800">
                                 {item.product_name}
                                 {item.auto_promo_id && <span className="ml-2 text-[9px] bg-green-500 text-white px-1 py-0.5 rounded shadow-sm inline-flex items-center"><Zap className="w-2 h-2 mr-1" />PROMO</span>}
                                 {item.is_bonus && !item.auto_promo_id && <span className="ml-2 text-[9px] bg-orange-500 text-white px-1 py-0.5 rounded shadow-sm">GRATUITO</span>}
                              </td>
                              <td className="p-2 w-16 text-right font-bold">
                                 <input
                                    type="number" min="1"
                                    className="w-full text-right bg-amber-50 border border-amber-300 rounded px-1 py-0.5 outline-none font-black text-amber-900"
                                    value={item.quantity_presentation || ''}
                                    onChange={e => handleCartItemChange(index, 'qty', parseInt(e.target.value))}
                                 />
                              </td>
                              <td className="p-2 w-24 text-center text-[10px] text-slate-500 font-bold uppercase">
                                  {item.selected_unit}
                              </td>
                              <td className="p-2 w-20 text-right font-bold">
                                 <input
                                    type="number" step="0.01"
                                    className="w-full text-right bg-amber-50 border border-amber-300 rounded px-1 py-0.5 outline-none font-black text-amber-900"
                                    value={item.unit_price}
                                    onChange={e => handleCartItemChange(index, 'pu', parseFloat(e.target.value))}
                                 />
                              </td>
                              <td className="p-2 w-24 text-right font-bold text-slate-900 text-sm">S/ {Number(item.total_price || 0).toFixed(2)}</td>
                              <td className="p-2 w-20 text-center">
                                 <button type="button" onClick={() => setItemFree(index)} className="bg-orange-100 border border-orange-300 text-orange-700 px-2 py-1 rounded text-[10px] font-bold hover:bg-orange-200 transition-colors" title="Poner en Precio Cero (Regalo)">
                                    <Gift className="w-3 h-3 inline mr-1" /> GRATIS
                                 </button>
                              </td>
                              <td className="p-2 w-8 text-right">
                                 <button type="button" onClick={() => { const newC = [...cart]; newC.splice(index, 1); setCart(newC); }} className="text-red-400 hover:bg-red-50 p-1 rounded transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
               {cart.length === 0 && <div className="p-8 text-center text-slate-400 italic font-bold">No hay productos en esta venta. Use el buscador de arriba para añadir.</div>}
            </div>
         </div>

         {/* === FOOTER TOTALS === */}
         <div className="h-24 bg-slate-100 border-t border-slate-400 flex p-2 gap-4">
            <div className="flex-1 flex gap-2 items-end pb-2">
               <button type="button" onClick={handlePreview} className={`bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded flex items-center shadow-sm font-bold ${cart.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`} disabled={cart.length === 0}>
                  <Printer className="w-4 h-4 mr-2" /> Vista Previa
               </button>
               <div className="flex-1"></div>
               <div className="text-[11px] text-slate-600 font-medium">
                  Modo Edición Avanzada activado. Ajuste unidades y precios de manera libre.
               </div>
            </div>

            <div className="w-64 bg-white border border-slate-300 shadow-sm rounded p-2 grid grid-cols-2 gap-y-1">
               <div className="text-right text-slate-600 font-bold">Op. Gravada:</div>
               <div className="text-right font-mono text-slate-800">{subtotal.toFixed(2)}</div>
               <div className="text-right text-slate-600 font-bold">IGV ({dbCompany?.igv_percent || 18}%):</div>
               <div className="text-right font-mono text-slate-800">{igv.toFixed(2)}</div>
               <div className="col-span-2 border-t border-slate-200 my-1"></div>
               <div className="text-right text-slate-800 font-bold text-sm self-center">TOTAL A PAGAR:</div>
               <div className="text-right font-bold text-xl bg-slate-800 text-amber-400 px-2 rounded font-mono">
                  {grandTotal.toFixed(2)}
               </div>
            </div>

            <button type="button" onClick={() => showDialog('confirm', 'Confirmar Sobreescritura', `¿Está seguro de modificar el documento ${series}-${docNumber}? Esta acción alterará permanentemente el Kardex y los reportes.`, executeSaveEdit)} disabled={cart.length === 0 || isSaving} className={`w-32 bg-amber-600 text-white font-bold rounded shadow-lg flex flex-col items-center justify-center ${cart.length === 0 || isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-700'}`}>
               <Save className="w-6 h-6 mb-1" />
               SOBREESCRIBIR
            </button>
         </div>

         {/* === SEARCH MODAL (Obligatorio al iniciar) === */}
         {isSearchModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-5xl rounded-lg shadow-2xl flex flex-col max-h-[85vh] border-4 border-amber-500 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
                     <h3 className="font-black flex items-center text-lg"><Search className="w-5 h-5 mr-2 text-amber-500" /> BÚSQUEDA DE COMPROBANTE PARA EDICIÓN</h3>
                     {originalSale && <button type="button" onClick={() => setIsSearchModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>}
                  </div>
                  <div className="p-4 bg-slate-50 border-b border-slate-200 relative">
                     <input
                        autoFocus
                        className="w-full border-2 border-slate-300 rounded p-4 text-xl font-bold focus:border-amber-500 outline-none"
                        placeholder="Escriba Nro Documento (Ej. F001), RUC o Cliente..."
                        value={saleSearchTerm}
                        onChange={e => setSaleSearchTerm(e.target.value)}
                     />
                     <p className="text-[11px] text-amber-600 mt-2 font-bold">
                        ⚠️ ATENCIÓN: Solo se pueden auditar/editar documentos que NO hayan sido enviados a SUNAT.
                     </p>
                     {isSearchingSale && <Loader2 className="absolute right-8 top-8 w-6 h-6 text-amber-500 animate-spin" />}
                  </div>
                  <div className="flex-1 overflow-auto bg-white relative">
                     <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200 z-10 shadow-sm">
                           <tr>
                              <th className="p-4">Documento</th>
                              <th className="p-4">Fecha</th>
                              <th className="p-4">Cliente</th>
                              <th className="p-4 text-right">Total</th>
                              <th className="p-4 text-center">Estado SUNAT</th>
                              <th className="p-4 text-center">Acción</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {searchedSales.map(s => (
                              <tr key={s.id} className="hover:bg-amber-50 transition-colors">
                                 <td className="p-4"><span className="font-bold text-slate-800 text-[15px]">{s.series}-{s.number}</span></td>
                                 <td className="p-4"><span className="text-slate-600 font-medium text-[15px]">{new Date(s.created_at).toLocaleDateString()}</span></td>
                                 <td className="p-4">
                                    <div className="font-bold text-slate-800 text-[15px]">{s.client_name}</div>
                                    <div className="text-[13px] text-slate-500">{s.client_ruc}</div>
                                 </td>
                                 <td className="p-4 text-right"><span className="font-black text-slate-900 text-[16px]">S/ {Number(s.total || 0).toFixed(2)}</span></td>
                                 <td className="p-4 text-center">
                                    <span className={`px-3 py-1 rounded text-xs font-bold ring-1 ${s.sunat_status === 'ACCEPTED' ? 'bg-green-100 ring-green-300 text-green-800' : s.sunat_status === 'SENT' ? 'bg-blue-100 ring-blue-300 text-blue-800' : 'bg-slate-100 ring-slate-300 text-slate-800'}`}>{s.sunat_status || 'PENDING'}</span>
                                 </td>
                                 <td className="p-4 text-center">
                                    {(s.sunat_status === 'SENT' || s.sunat_status === 'ACCEPTED') ? (
                                       <span className="text-xs text-red-500 font-bold italic">BLOQUEADO</span>
                                    ) : (
                                       <button type="button" onClick={() => loadSale(s)} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded font-bold shadow transition-colors flex items-center justify-center w-full">
                                          <Edit3 className="w-4 h-4 mr-1" /> Editar
                                       </button>
                                    )}
                                 </td>
                              </tr>
                           ))}
                           {searchedSales.length === 0 && (
                              <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-base font-bold">No se encontraron documentos que coincidan con su búsqueda.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
