import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Product, BatchAllocation, SaleItem, Client, Sale, AutoPromotion, Promotion, Batch } from '../types';
import { Plus, Trash2, Search, Printer, Save, X, ChevronDown, RefreshCw, FilePlus, Eye, Zap, MapPin, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { generateMassiveInvoicePDF } from '../utils/invoicePdfGenerator';
import { isPromoValidForContext } from '../utils/promoUtils';
import { supabase, USE_MOCK_DB } from '../services/supabase';

// Utilidad Anti-Mocks
const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const NewSale: React.FC = () => {
   const { products, getBatchesForProduct, createSale, clients, company, priceLists, sales, getNextDocumentNumber, users, updateSaleDetailed, currentUser, autoPromotions, promotions, sellers, zones } = useStore();

   // --- REFS FOR FOCUS MANAGEMENT ---
   const productInputRef = useRef<HTMLInputElement>(null);
   const qtyInputRef = useRef<HTMLInputElement>(null);
   const unitSelectRef = useRef<HTMLSelectElement>(null);
   const priceInputRef = useRef<HTMLInputElement>(null);
   const discountInputRef = useRef<HTMLInputElement>(null);
   const addButtonRef = useRef<HTMLButtonElement>(null);

   // --- ADMIN LOCK STATE ---
   const [priceLocked, setPriceLocked] = useState(true);
   const [isSaving, setIsSaving] = useState(false);

   // --- HEADER STATE ---
   const [docType, setDocType] = useState<'FACTURA' | 'BOLETA'>('FACTURA');
   const [series, setSeries] = useState(company.series.find(s => s.type === 'FACTURA')?.series || 'F001');
   const [docNumber, setDocNumber] = useState(String(company.series.find(s => s.type === 'FACTURA')?.current_number || 1).padStart(8, '0'));

   // Update series when doc type changes
   useEffect(() => {
      const ser = company.series.find(s => s.type === docType);
      if (ser) {
         setSeries(ser.series);
         setDocNumber(String(ser.current_number).padStart(8, '0'));
      }
   }, [docType, company.series]);

   const [paymentMethod, setPaymentMethod] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
   const [currency, setCurrency] = useState('SOLES');
   const [exchangeRate, setExchangeRate] = useState(3.750);

   // --- CLIENT STATE ---
   const [selectedClientId, setSelectedClientId] = useState('');
   const [clientData, setClientData] = useState<Partial<Client>>({ name: '', doc_number: '', address: '', price_list_id: '', city: '' });
   const [clientSearch, setClientSearch] = useState('');
   const [showClientSuggestions, setShowClientSuggestions] = useState(false);
   const [searchedClients, setSearchedClients] = useState<Client[]>([]);
   const [isSearchingClient, setIsSearchingClient] = useState(false);
   const [showBranchSelector, setShowBranchSelector] = useState(false);
   const [selectedSellerId, setSelectedSellerId] = useState('');

   // --- CREDIT RISK STATE ---
   const [clientCreditInfo, setClientCreditInfo] = useState({ limit: 0, debt: 0, overdue: false, isChecking: false });

   useEffect(() => {
       if (USE_MOCK_DB || clientSearch.length < 3) {
           setSearchedClients([]);
           return;
       }
       const timer = setTimeout(async () => {
           setIsSearchingClient(true);
           const { data } = await supabase.from('clients')
               .select('*')
               .or(`name.ilike.%${clientSearch}%,doc_number.ilike.%${clientSearch}%`)
               .limit(10);
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
       if (USE_MOCK_DB || productSearch.length < 2) {
           setSearchedProducts([]);
           return;
       }
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
                       const stock = prodBatches.reduce((sum, b) => sum + b.quantity_current, 0);
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
   const [unitType, setUnitType] = useState<'UND' | 'PKG'>('UND');
   const [quantity, setQuantity] = useState<number>(1);
   const [unitPrice, setUnitPrice] = useState<number>(0); 
   const [discountPercent, setDiscountPercent] = useState<number>(0);
   const [isBonus, setIsBonus] = useState(false);
   const [cart, setCart] = useState<SaleItem[]>([]);

   // --- SEARCH SALES MODAL STATE ---
   const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
   const [saleSearchTerm, setSaleSearchTerm] = useState('');
   const [searchedSales, setSearchedSales] = useState<Sale[]>([]);
   const [isSearchingSale, setIsSearchingSale] = useState(false);
   const [isViewMode, setIsViewMode] = useState(false); 
   const [isEditMode, setIsEditMode] = useState(false); 
   const [originalSale, setOriginalSale] = useState<Sale | null>(null);
   const [showHistoryModal, setShowHistoryModal] = useState<{ isOpen: boolean, sale: Sale | null }>({ isOpen: false, sale: null });

   useEffect(() => {
       if (USE_MOCK_DB || saleSearchTerm.length < 3) { setSearchedSales([]); return; }
       const timer = setTimeout(async () => {
           setIsSearchingSale(true);
           const { data } = await supabase.from('sales').select('*').or(`number.ilike.%${saleSearchTerm}%,client_name.ilike.%${saleSearchTerm}%,client_ruc.ilike.%${saleSearchTerm}%`).order('created_at', { ascending: false }).limit(20);
           if (data) setSearchedSales(data as Sale[]);
           setIsSearchingSale(false);
       }, 500);
       return () => clearTimeout(timer);
   }, [saleSearchTerm]);

   const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);

   const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.doc_number.includes(clientSearch) || (c.code && c.code.toLowerCase().includes(clientSearch.toLowerCase())));
   const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()) || (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase())));
   const filteredSales = sales.filter(s => s.client_name.toLowerCase().includes(saleSearchTerm.toLowerCase()) || s.number.includes(saleSearchTerm) || s.client_ruc.includes(saleSearchTerm));

   const displayClients = USE_MOCK_DB ? filteredClients : searchedClients;
   const displayProducts = USE_MOCK_DB ? filteredProducts.map(p => ({...p, current_stock: getBatchesForProduct(p.id).reduce((s,b)=>s+b.quantity_current,0)})) : searchedProducts;
   const displaySales = USE_MOCK_DB ? filteredSales : searchedSales;

   // --- CALCULATIONS ---
   const calculateTotal = (qty: number, price: number, discPct: number) => { const gross = qty * price; return gross - (gross * (discPct / 100)); };
   const currentTotal = calculateTotal(quantity, unitPrice, discountPercent);
   const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0) / (1 + (company.igv_percent / 100));
   const igv = cart.reduce((sum, item) => sum + item.total_price, 0) - subtotal;
   const grandTotal = cart.reduce((sum, item) => sum + item.total_price, 0);

   // --- ACTIONS ---
   const handleNewSale = () => {
      setIsViewMode(false); setIsEditMode(false); setOriginalSale(null); setCart([]); setSelectedClientId(''); setClientSearch(''); setProductSearch(''); setSelectedSellerId('');
      setClientData({ name: '', doc_number: '', address: '', price_list_id: '', city: '' });
      setClientCreditInfo({ limit: 0, debt: 0, overdue: false, isChecking: false });
      const activeFacturaSeries = company.series.find(s => s.type === 'FACTURA' && s.is_active);
      setDocType('FACTURA');
      if (activeFacturaSeries) { setSeries(activeFacturaSeries.series); setDocNumber(String(activeFacturaSeries.current_number).padStart(8, '0')); } 
      else { setSeries(''); setDocNumber(''); }
   };

   const loadSale = async (sale: Sale, mode: 'VIEW' | 'EDIT' = 'VIEW') => {
      if (mode === 'EDIT' && (sale.sunat_status === 'SENT' || sale.sunat_status === 'ACCEPTED')) { alert('No se puede modificar un comprobante enviado o aceptado por SUNAT.'); return; }
      let itemsToLoad = sale.items;
      if (!USE_MOCK_DB) { const { data } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id); if (data) itemsToLoad = data as SaleItem[]; }
      setIsViewMode(mode === 'VIEW'); setIsEditMode(mode === 'EDIT');
      if (mode === 'EDIT') setOriginalSale({ ...sale, items: itemsToLoad });
      setDocType(sale.document_type as any); setSeries(sale.series); setDocNumber(sale.number);
      setClientData({ name: sale.client_name, doc_number: sale.client_ruc, address: sale.client_address });
      setClientSearch(sale.client_name); setPaymentMethod(sale.payment_method); setSelectedSellerId(sale.seller_id || ''); setCart(itemsToLoad); setIsSearchModalOpen(false);
   };

   const handlePreview = () => {
      const tempSale: Sale = { id: 'preview', document_type: docType, series: series, number: docNumber, payment_method: paymentMethod, client_name: clientData.name || 'CLIENTE MOSTRADOR', client_ruc: clientData.doc_number || '00000000', client_address: clientData.address || '', subtotal, igv, total: grandTotal, status: 'pending', dispatch_status: 'pending', created_at: new Date().toISOString(), items: cart };
      generateMassiveInvoicePDF(company, [tempSale]);
   };

   const removeFromCart = (index: number) => { const newItems = cart.filter((_, i) => i !== index); applyAutoPromotions(newItems); };

   // --- CHECK CREDIT LIMIT ---
   const checkClientCredit = async (clientId: string, creditLimit: number = 0) => {
      if (USE_MOCK_DB) { setClientCreditInfo({ limit: creditLimit, debt: 0, overdue: false, isChecking: false }); return; }
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

   const selectClient = (c: Client) => {
      setSelectedClientId(c.id);
      const newDocType: 'FACTURA' | 'BOLETA' = c.doc_number.length === 11 ? 'FACTURA' : 'BOLETA';
      setDocType(newDocType);
      
      const activeSeries = company.series.find(s => s.type === newDocType && s.is_active);
      if (activeSeries) { setSeries(activeSeries.series); setDocNumber(String(activeSeries.current_number).padStart(8, '0')); }

      let autoSellerId = '';
      if (c.zone_id) { const zone = zones.find(z => z.id === c.zone_id); if (zone && zone.assigned_seller_id) { autoSellerId = zone.assigned_seller_id; } }
      setSelectedSellerId(autoSellerId);

      setClientData({ name: c.name, doc_number: c.doc_number, address: c.address, price_list_id: c.price_list_id || '', city: c.city });
      setClientSearch(c.name);
      setShowClientSuggestions(false);
      
      // Auto-detección de crédito según perfil del cliente
      if (c.payment_condition && c.payment_condition.toUpperCase().includes('CREDIT')) {
         setPaymentMethod('CREDITO');
      } else {
         setPaymentMethod('CONTADO');
      }

      // Trigger Credit Check
      checkClientCredit(c.id, c.credit_limit || 0);
   };

   // --- PRODUCT SEARCH & ADD ---
   const handleProductKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev + 1) % displayProducts.length);
      } else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev - 1 + displayProducts.length) % displayProducts.length);
      } else if (e.key === 'Enter') { e.preventDefault(); if (displayProducts.length > 0) selectProduct(displayProducts[highlightedIndex]);
      } else if (e.key === 'Escape') { setShowProductSuggestions(false); }
   };

   const selectProduct = (p: Product & { current_stock?: number }) => {
      const isDuplicate = cart.some(item => item.product_id === p.id);
      if (isDuplicate) {
         if (!window.confirm(`¡ADVERTENCIA!\nEl producto "${p.name}" ya se encuentra en el detalle.\n¿Desea continuar agregándolo?`)) {
            setProductSearch(''); setShowProductSuggestions(false); productInputRef.current?.focus(); return;
         }
      }
      setSelectedProduct(p); setProductSearch(p.name); setShowProductSuggestions(false); setUnitType('UND'); 

      let price = p.price_unit;
      if (clientData.price_list_id === 'pl1') price = price * 0.92;
      if (clientData.price_list_id === 'pl3') price = price * 1.05;

      let defaultDiscount = 0;
      const activePromo = promotions.find(promo => promo.product_ids.includes(p.id) && isPromoValidForContext(promo, 'IN_STORE', clientData.city, selectedSellerId || currentUser?.id, currentUser?.role));
      if (activePromo) {
         if (activePromo.type === 'PERCENTAGE_DISCOUNT') defaultDiscount = activePromo.value;
         else if (activePromo.type === 'FIXED_PRICE') price = activePromo.value;
      }
      setUnitPrice(price); setQuantity(1); setDiscountPercent(defaultDiscount); setIsBonus(false); setPriceLocked(true);
      setTimeout(() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); }, 50);
   };

   const handleUnitChange = (type: 'UND' | 'PKG') => {
      setUnitType(type);
      if (selectedProduct) {
         let price = type === 'PKG' ? selectedProduct.price_package : selectedProduct.price_unit;
         if (clientData.price_list_id === 'pl1') price = price * 0.92;
         if (clientData.price_list_id === 'pl3') price = price * 1.05;
         setUnitPrice(price);
      }
   };

   const handleAddToCart = () => {
      if (!selectedProduct) return;
      if (quantity <= 0) { alert("Cantidad inválida"); return; }
      const prod = selectedProduct as any;
      const conversionFactor = unitType === 'PKG' ? (prod.package_content || 1) : 1;
      const requiredBaseUnits = quantity * conversionFactor;
      
      const availableBatches = USE_MOCK_DB ? getBatchesForProduct(prod.id) : (loadedBatches[prod.id] || []);
      const totalStock = availableBatches.reduce((acc, b) => acc + b.quantity_current, 0);

      if (totalStock < requiredBaseUnits) { alert(`Stock insuficiente. Disponible: ${totalStock} unid. Requerido: ${requiredBaseUnits} unid.`); return; }

      let remaining = requiredBaseUnits;
      const selectedBatches: BatchAllocation[] = [];
      for (const batch of availableBatches) {
         if (remaining <= 0) break;
         const take = Math.min(remaining, batch.quantity_current);
         selectedBatches.push({ batch_id: batch.id, batch_code: batch.code, quantity: take });
         remaining -= take;
      }

      let initialNewCart = [...cart];
      const existingItemIndex = initialNewCart.findIndex(item => item.product_id === prod.id && item.selected_unit === unitType && !item.is_bonus && !item.auto_promo_id);

      if (existingItemIndex >= 0) {
         if (window.confirm(`El producto "${prod.name}" ya existe en la lista. ¿Desea sumar la cantidad?`)) {
            const existing = initialNewCart[existingItemIndex];
            const newQty = existing.quantity_presentation + quantity;
            const newPrice = calculateTotal(newQty, unitPrice, discountPercent);
            initialNewCart[existingItemIndex] = {
               ...existing, quantity_presentation: newQty, quantity_base: unitType === 'PKG' ? newQty * (prod.package_content || 1) : newQty,
               total_price: newPrice, discount_percent: discountPercent, discount_amount: (newQty * unitPrice) * (discountPercent / 100), batch_allocations: selectedBatches
            };
         } else { return; }
      } else {
         initialNewCart.push({
            id: crypto.randomUUID(), sale_id: '', product_id: prod.id, product_sku: prod.sku, product_name: prod.name,
            selected_unit: unitType, quantity_presentation: quantity, quantity_base: requiredBaseUnits, unit_price: unitPrice,
            total_price: calculateTotal(quantity, unitPrice, discountPercent), discount_percent: discountPercent,
            discount_amount: (quantity * unitPrice) * (discountPercent / 100), is_bonus: isBonus, batch_allocations: selectedBatches
         });
      }
      applyAutoPromotions(initialNewCart);
      setSelectedProduct(null); setProductSearch(''); setQuantity(1); setUnitPrice(0); setDiscountPercent(0); setIsBonus(false);
      setTimeout(() => productInputRef.current?.focus(), 50);
   };

   const handleCartItemQtyChange = (index: number, newQtyStr: string) => {
      const newQty = parseInt(newQtyStr, 10);
      if (isNaN(newQty) || newQty <= 0) return;
      const item = cart[index];
      const product = USE_MOCK_DB ? products.find(p => p.id === item.product_id) : searchedProducts.find(p => p.id === item.product_id) || products.find(p => p.id === item.product_id);
      if (!product) return;

      const conversionFactor = item.selected_unit === 'PKG' ? (product.package_content || 1) : 1;
      const requiredBaseUnits = newQty * conversionFactor;
      const availableBatches = USE_MOCK_DB ? getBatchesForProduct(product.id) : (loadedBatches[product.id] || []);
      const totalStock = availableBatches.reduce((acc, b) => acc + b.quantity_current, 0);

      if (totalStock < requiredBaseUnits) { alert(`Stock insuficiente. Disponible: ${totalStock} unid. Requerido: ${requiredBaseUnits} unid.`); return; }

      let remaining = requiredBaseUnits;
      const selectedBatches: BatchAllocation[] = [];
      for (const batch of availableBatches) {
         if (remaining <= 0) break;
         const take = Math.min(remaining, batch.quantity_current);
         selectedBatches.push({ batch_id: batch.id, batch_code: batch.code, quantity: take });
         remaining -= take;
      }

      const updatedCart = [...cart];
      const newPrice = calculateTotal(newQty, item.unit_price, item.discount_percent);
      updatedCart[index] = {
         ...item, quantity_presentation: newQty, quantity_base: requiredBaseUnits, total_price: newPrice,
         discount_amount: (newQty * item.unit_price) * (item.discount_percent / 100), batch_allocations: selectedBatches
      };
      setCart(updatedCart); applyAutoPromotions(updatedCart);
   };

   const handleUpdatePrices = () => {
      if (cart.length === 0) return;
      const updatedCart = cart.map(item => {
         const product = products.find(p => p.id === item.product_id);
         if (!product) return item;
         let newPrice = item.selected_unit === 'PKG' ? product.price_package : product.price_unit;
         if (clientData.price_list_id === 'pl1') newPrice = newPrice * 0.92; 
         if (clientData.price_list_id === 'pl3') newPrice = newPrice * 1.05; 
         if (item.is_bonus) newPrice = 0;
         const newTotal = calculateTotal(item.quantity_presentation, newPrice, item.discount_percent);
         const newDiscountAmt = (item.quantity_presentation * newPrice) * (item.discount_percent / 100);
         return { ...item, unit_price: newPrice, total_price: newTotal, discount_amount: newDiscountAmt };
      });
      setCart(updatedCart); applyAutoPromotions(updatedCart); 
      alert("Precios y Promociones actualizadas según el cliente y la lista seleccionada.");
   };

   const handleInputKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<any> | 'ADD' | 'BONUS_TOGGLE') => {
      if (e.key === 'Enter') {
         e.preventDefault();
         if (nextRef === 'ADD') addButtonRef.current?.focus();
         else if (nextRef === 'BONUS_TOGGLE') setIsBonus(prev => !prev);
         else if (nextRef.current) { nextRef.current.focus(); if (nextRef.current.select) nextRef.current.select(); }
      } else if (e.key === 'Escape') { setSelectedProduct(null); setProductSearch(''); setTimeout(() => productInputRef.current?.focus(), 50); }
   };

   // --- ADMIN AUTHORIZATION ---
   const [showAdminAuthModal, setShowAdminAuthModal] = useState({ isOpen: false, triggerAction: () => { }, targetActionName: '' });
   const [adminPasswordInput, setAdminPasswordInput] = useState('');

   const requestAdminAuth = (action: () => void, actionName: string) => {
      setShowAdminAuthModal({ isOpen: true, triggerAction: action, targetActionName: actionName });
      setTimeout(() => document.getElementById('admin-password-input')?.focus(), 100);
   };

   const verifyAdminAndExecute = () => {
      const adminUser = users.find(u => u.role === 'ADMIN' && u.password === adminPasswordInput);
      if (adminUser) { showAdminAuthModal.triggerAction(); setShowAdminAuthModal({ isOpen: false, triggerAction: () => { }, targetActionName: '' }); setAdminPasswordInput('');
      } else { alert("Contraseña incorrecta o usuario no autorizado."); }
   };

   const tryAddToCart = () => {
      if (isBonus || discountPercent > 0) requestAdminAuth(handleAddToCart, 'Autorizar Descuento / Bonificación');
      else handleAddToCart();
   };

   // --- AUTO PROMOTIONS ---
   const applyAutoPromotions = (currentCart: SaleItem[]) => {
      let newCart = currentCart.filter(item => !item.auto_promo_id);
      const validPromos = autoPromotions.filter(ap => {
         if (!isPromoValidForContext(ap, 'IN_STORE', clientData.city, selectedSellerId || currentUser?.id, currentUser?.role)) return false;
         if (ap.target_price_list_ids?.length > 0 && clientData.price_list_id && !ap.target_price_list_ids.includes('ALL') && !ap.target_price_list_ids.includes(clientData.price_list_id)) return false;
         return true;
      });

      validPromos.forEach(ap => {
         let applies = false; let multiplyFactor = 0; 
         if (ap.condition_type === 'BUY_X_PRODUCT') {
            const qtyBought = newCart.filter(item => (!ap.condition_product_ids?.length || ap.condition_product_ids.includes(item.product_id)) && !item.is_bonus).reduce((sum, item) => sum + item.quantity_base, 0);
            if (qtyBought >= ap.condition_amount) { applies = true; multiplyFactor = Math.floor(qtyBought / ap.condition_amount); }
         } else if (ap.condition_type === 'SPEND_Y_TOTAL') {
            const conditionItemKeys = ap.condition_product_ids || [];
            const totalSpent = newCart.reduce((sum, item) => {
               if (conditionItemKeys.length > 0 && !conditionItemKeys.includes(item.product_id)) return sum;
               return sum + item.total_price;
            }, 0);
            if (totalSpent >= ap.condition_amount) { applies = true; multiplyFactor = Math.floor(totalSpent / ap.condition_amount); }
         } else if (ap.condition_type === 'SPEND_Y_CATEGORY') {
            const catSpent = newCart.reduce((sum, item) => {
               const p = products.find(prod => prod.id === item.product_id);
               if (p?.category === ap.condition_category) return sum + item.total_price;
               return sum;
            }, 0);
            if (catSpent >= ap.condition_amount) { applies = true; multiplyFactor = Math.floor(catSpent / ap.condition_amount); }
         }

         if (applies && multiplyFactor > 0) {
            const rewardProd = products.find(p => p.id === ap.reward_product_id);
            if (rewardProd) {
               const rewardQty = ap.reward_quantity * multiplyFactor;
               newCart.push({
                  id: crypto.randomUUID(), sale_id: '', product_id: rewardProd.id, product_sku: rewardProd.sku, product_name: rewardProd.name,
                  quantity_base: rewardQty * (rewardProd.package_content || 1), batch_allocations: [], quantity: rewardQty, quantity_presentation: rewardQty,
                  unit_price: 0, discount_percent: 100, discount_amount: 0, total_price: 0, selected_unit: ap.reward_unit_type as 'UND' | 'PKG',
                  is_bonus: true, auto_promo_id: ap.id 
               } as any);
            }
         }
      });
      setCart(newCart);
   };

   // --- FINAL SAVE (RPC TITANIUM LOCK + CREDIT RISK) ---
   const handleSaveSale = async () => {
      if (isViewMode && !isEditMode) {
         const currentSale = sales.find(s => s.series === series && s.number === docNumber);
         if (currentSale) generateMassiveInvoicePDF(company, [currentSale]);
         return;
      }

      if (cart.length === 0) return;
      if (!selectedClientId && !clientData.name) { alert("Ingrese datos del cliente"); return; }
      if (!series) { alert("No hay una serie asignada. Configure una en los Ajustes de Empresa."); return; }

      // Anti-Mock Shield
      if (selectedClientId && !isUUID(selectedClientId) && !USE_MOCK_DB) { alert("Cliente de prueba detectado. Seleccione uno real."); return; }
      if (!USE_MOCK_DB && cart.some(i => !isUUID(i.product_id))) { alert("Hay productos de prueba. Use productos reales."); return; }

      // --- CREDIT RISK BARRIER ---
      if (paymentMethod === 'CREDITO') {
          if (clientCreditInfo.overdue) {
              alert("❌ BLOQUEO DE CRÉDITO ❌\n\nEl cliente mantiene comprobantes vencidos (más de 7 días sin pago). No se le puede emitir más crédito hasta que regularice su deuda.");
              return;
          }
          if ((clientCreditInfo.debt + grandTotal) > clientCreditInfo.limit) {
              alert(`❌ LÍMITE DE CRÉDITO EXCEDIDO ❌\n\nLímite Aprobado: S/ ${clientCreditInfo.limit.toFixed(2)}\nDeuda Vigente: S/ ${clientCreditInfo.debt.toFixed(2)}\nDisponible Actual: S/ ${Math.max(0, clientCreditInfo.limit - clientCreditInfo.debt).toFixed(2)}\n\nEl monto de este pedido (S/ ${grandTotal.toFixed(2)}) supera el saldo disponible. Requiere autorización o pago al contado.`);
              return;
          }
      }

      const confirmSave = window.confirm(`¿Emitir comprobante ${docType} ${series} por S/ ${grandTotal.toFixed(2)}?`);
      if (!confirmSave) return;

      const correlative = getNextDocumentNumber(docType, series);
      if (!correlative && !isEditMode) { alert("Error al obtener la serie."); return; }

      const newSaleData: Sale = {
         id: isEditMode && originalSale ? originalSale.id : crypto.randomUUID(),
         document_type: docType,
         series: isEditMode ? series : correlative!.series,
         number: isEditMode ? docNumber : correlative!.number,
         payment_method: paymentMethod,
         payment_status: paymentMethod === 'CREDITO' ? 'PENDING' : 'PAID',
         balance: paymentMethod === 'CREDITO' ? grandTotal : 0,
         client_name: clientData.name || 'CLIENTE VARIOS',
         client_ruc: clientData.doc_number || '00000000',
         client_address: clientData.address || '',
         seller_id: selectedSellerId || undefined,
         client_id: selectedClientId || undefined,
         subtotal,
         igv,
         total: grandTotal,
         status: 'completed',
         dispatch_status: isEditMode && originalSale ? originalSale.dispatch_status : 'pending',
         created_at: isEditMode && originalSale ? originalSale.created_at : new Date().toISOString(),
         items: cart,
         sunat_status: isEditMode && originalSale ? originalSale.sunat_status : 'PENDING'
      };

      setIsSaving(true);

      if (!USE_MOCK_DB && !isEditMode) {
         try {
            const { data, error } = await supabase.rpc('process_sale_transaction', { p_sale_data: newSaleData });
            if (error) throw error;
            if (data && data.success) {
               alert("Venta guardada y stock descontado exitosamente.");
               generateMassiveInvoicePDF(company, [newSaleData]);
               handleNewSale();
            }
         } catch (err: any) { alert(`Error crítico: ${err.message}`);
         } finally { setIsSaving(false); }
      } else {
         if (isEditMode && originalSale) {
            const result = updateSaleDetailed(newSaleData, originalSale, currentUser?.name || 'ADMIN');
            if (!result.success) { alert(result.msg); setIsSaving(false); return; }
            alert(result.msg);
         } else { createSale(newSaleData); }
         generateMassiveInvoicePDF(company, [newSaleData]);
         handleNewSale();
         setIsSaving(false);
      }
   };

   return (
      <div className="flex flex-col h-full bg-slate-200 p-2 font-sans text-xs relative">

         {isSaving && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded">
               <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
               <h2 className="text-2xl font-black text-white tracking-widest">PROCESANDO TRANSACCIÓN...</h2>
               <p className="text-blue-200 font-medium mt-2">Asegurando stock y registrando lote por FIFO</p>
            </div>
         )}

         {/* === HEADER SECTION === */}
         <div className="bg-white p-2 rounded shadow-sm border border-slate-300 mb-2 space-y-2 relative">
            <div className="absolute top-2 right-2 flex gap-2">
               <button onClick={handleNewSale} className="bg-slate-700 text-white px-3 py-1 rounded shadow text-xs font-bold hover:bg-slate-600 flex items-center">
                  <FilePlus className="w-3.5 h-3.5 mr-1" /> Nuevo (F2)
               </button>
               <button onClick={() => setIsSearchModalOpen(true)} className="bg-blue-600 text-white px-3 py-1 rounded shadow text-xs font-bold hover:bg-blue-500 flex items-center">
                  <Search className="w-3.5 h-3.5 mr-1" /> Buscar Doc (F3)
               </button>
            </div>

            <div className="flex items-center gap-3 mt-1 py-1">
               <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">Tipo</label>
                  <select
                     className="border border-slate-300 rounded px-2 py-1 flex-1 bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                     value={docType}
                     onChange={(e: any) => {
                        setDocType(e.target.value);
                        const activeSeries = company.series.find(s => s.type === e.target.value && s.is_active);
                        if (activeSeries) { setSeries(activeSeries.series); setDocNumber(String(activeSeries.current_number).padStart(8, '0'));
                        } else { setSeries(''); setDocNumber(''); }
                     }}
                     disabled={isViewMode}
                  >
                     <option value="FACTURA">FACTURA</option>
                     <option value="BOLETA">BOLETA</option>
                  </select>
               </div>
               <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">Serie y Correlativo</label>
                  <select className="w-20 text-center border border-slate-300 rounded px-1 py-1 text-sm font-bold bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={series} onChange={(e) => { setSeries(e.target.value); const sObj = company.series.find(s => s.type === docType && s.series === e.target.value); if (sObj) setDocNumber(String(sObj.current_number).padStart(8, '0')); }} disabled={isViewMode}>
                     {company.series.filter(s => s.type === docType && s.is_active).map(s => <option key={s.id} value={s.series}>{s.series}</option>)}
                  </select>
                  <input className="w-24 text-center border border-transparent px-1 py-1 text-sm font-bold bg-transparent text-slate-800 pointer-events-none" value={docNumber} readOnly />
               </div>
               <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">Moneda</label>
                  <select className="border border-slate-300 rounded px-2 py-1 text-sm bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={currency} onChange={e => setCurrency(e.target.value)} disabled={isViewMode}><option value="SOLES">SOLES</option></select>
               </div>
               <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">Vendedor</label>
                  <select className="border border-slate-300 rounded px-2 py-1 text-sm bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={selectedSellerId} onChange={e => setSelectedSellerId(e.target.value)} disabled={isViewMode}>
                     <option value="">-- Sin Vendedor --</option>
                     {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
            </div>
            {isViewMode && <div className="ml-4 px-3 py-1 bg-yellow-200 text-yellow-800 font-bold rounded animate-pulse w-fit">MODO VISUALIZACIÓN</div>}
            {isEditMode && <div className="ml-4 px-3 py-1 bg-red-600 text-white font-bold rounded animate-pulse relative pr-8 w-fit">
               MODIFICANDO DOCUMENTO <button onClick={handleNewSale} className="absolute right-1 top-1.5 hover:text-red-200"><X className="w-4 h-4" /></button>
            </div>}
            {!series && !isViewMode && !isEditMode && <div className="ml-4 px-3 py-1 bg-red-100 text-red-800 text-[10px] font-bold rounded border border-red-300 w-fit">¡DEBE CONFIGURAR UNA SERIE EN AJUSTES!</div>}
         </div>

         {/* === CLIENT SECTION (CON ALERTA DE CRÉDITO Y LISTA DE PRECIOS RESTAURADA) === */}
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
                               <div>Límite Autorizado: <strong className="font-mono">S/ {clientCreditInfo.limit.toFixed(2)}</strong></div>
                               <div>Deuda Vigente: <strong className="font-mono">S/ {clientCreditInfo.debt.toFixed(2)}</strong></div>
                               <div>Saldo Disponible: <strong className="font-mono">S/ {Math.max(0, clientCreditInfo.limit - clientCreditInfo.debt).toFixed(2)}</strong></div>
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
                        className="w-full pl-5 pr-1 py-0.5 border border-slate-300 rounded text-slate-900 font-bold focus:bg-yellow-50 disabled:bg-slate-200"
                        placeholder="RUC o Nombre..."
                        value={clientSearch}
                        onChange={e => { setClientSearch(e.target.value); setShowClientSuggestions(true); }}
                        onFocus={() => setShowClientSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                        disabled={isViewMode}
                     />
                     {isSearchingClient && <Loader2 className="absolute right-1 top-1 w-3 h-3 text-blue-500 animate-spin" />}
                     {showClientSuggestions && clientSearch && displayClients.length > 0 && (
                        <div className="absolute top-full left-0 w-[400px] bg-white border border-slate-400 shadow-xl z-50 max-h-48 overflow-auto">
                           {displayClients.map(c => (
                              <div key={c.id} onMouseDown={() => selectClient(c)} className="p-2 hover:bg-blue-100 cursor-pointer border-b border-slate-100">
                                 <div className="font-bold text-slate-800">{c.name}</div>
                                 <div className="text-[10px] text-slate-500">{c.doc_number} | {c.address}</div>
                              </div>
                           ))}
                        </div>
                     )}
                     {showClientSuggestions && clientSearch && displayClients.length === 0 && !isSearchingClient && (
                         <div className="absolute top-full left-0 w-[300px] bg-white border border-slate-400 shadow-xl z-50 p-2 text-slate-400 italic">No encontrado</div>
                     )}
                  </div>
               </div>
               <div className="col-span-4">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Razón Social</label>
                  <input className="w-full border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800 disabled:bg-slate-200" value={clientData.name} onChange={e => setClientData({ ...clientData, name: e.target.value })} disabled={isViewMode} />
               </div>
               <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">RUC/DNI</label>
                  <input className="w-full border border-slate-300 rounded px-1 py-0.5 bg-slate-50 text-slate-800 font-mono disabled:bg-slate-200" value={clientData.doc_number} onChange={e => setClientData({ ...clientData, doc_number: e.target.value })} disabled={isViewMode} />
               </div>

               {/* RESTAURADO: LISTA DE PRECIOS */}
               <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Lista Precio</label>
                  <div className="flex gap-1">
                     <select
                        className="w-full border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800 disabled:bg-slate-200"
                        value={clientData.price_list_id}
                        onChange={e => setClientData({ ...clientData, price_list_id: e.target.value })}
                        disabled={isViewMode}
                     >
                        <option value="">-- General --</option>
                        {priceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                     </select>
                     <button
                        onClick={handleUpdatePrices}
                        disabled={isViewMode}
                        className="bg-blue-100 border border-blue-300 text-blue-700 px-1.5 rounded hover:bg-blue-200 disabled:opacity-50 flex items-center justify-center transition-colors"
                        title="Actualizar Precios y Promociones en el Carrito"
                     >
                        <RefreshCw className="w-3.5 h-3.5" />
                     </button>
                  </div>
               </div>

               <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Forma Pago</label>
                  <select className="w-full border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800 disabled:bg-slate-200 font-bold" value={paymentMethod} onChange={(e: any) => setPaymentMethod(e.target.value)} disabled={isViewMode}>
                     <option value="CONTADO">CONTADO</option>
                     <option value="CREDITO">CRÉDITO</option>
                  </select>
               </div>

               <div className="col-span-12 relative mt-1">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Dirección de Entrega</label>
                  <div className="flex bg-slate-50 border border-slate-300 rounded">
                     <input className="w-full px-2 py-0.5 bg-transparent text-slate-600 disabled:text-slate-500 outline-none" value={clientData.address} onChange={e => setClientData({ ...clientData, address: e.target.value })} disabled={isViewMode} />
                     {(() => {
                        const fullClient = clients.find(c => c.doc_number === clientData.doc_number) || searchedClients.find(c => c.doc_number === clientData.doc_number);
                        if (fullClient && fullClient.branches && fullClient.branches.length > 0 && !isViewMode) {
                           return (
                              <button type="button" onClick={() => setShowBranchSelector(!showBranchSelector)} className="px-2 border-l border-slate-300 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors" title="Seleccionar otra sucursal">
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
                           const fullClient = clients.find(c => c.doc_number === clientData.doc_number) || searchedClients.find(c => c.doc_number === clientData.doc_number);
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
            {/* Entry Row (Simulating Grid Input) */}
            {(!isViewMode || isEditMode) && (
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
                        
                        {showProductSuggestions && displayProducts.length > 0 && (
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
                                    {displayProducts.map((p, idx) => (
                                       <tr key={p.id} onMouseDown={() => selectProduct(p as any)} className={`cursor-pointer ${idx === highlightedIndex ? 'bg-blue-200' : 'hover:bg-blue-50'}`}>
                                          <td className="p-2 font-mono text-blue-800 font-bold">{p.sku}</td>
                                          <td className="p-2 font-medium">{p.name}</td>
                                          <td className="p-2 text-right">S/ {p.price_unit.toFixed(2)}</td>
                                          <td className={`p-2 text-right font-black ${p.current_stock > 0 ? 'text-green-600' : 'text-red-500'}`}>{p.current_stock}</td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        )}
                        {showProductSuggestions && productSearch && displayProducts.length === 0 && !isSearchingProd && <div className="absolute top-full left-0 w-full p-2 text-center text-slate-400 bg-white border border-slate-400 shadow-2xl z-50">Sin coincidencias</div>}
                     </div>
                  </div>

                  <div className="w-16">
                     <label className="block text-[10px] font-bold text-blue-800 mb-0.5 text-center">Cant.</label>
                     <input ref={qtyInputRef} type="number" min="1" className="w-full border border-blue-300 rounded py-1 px-1 text-center font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={quantity} onChange={e => setQuantity(Number(e.target.value))} onKeyDown={e => handleInputKeyDown(e, unitSelectRef)} disabled={!selectedProduct} />
                  </div>

                  <div className="w-20 relative">
                     <label className="block text-[10px] font-bold text-blue-800 mb-0.5">Unidad</label>
                     <select ref={unitSelectRef} className="w-full border border-blue-300 rounded py-1 px-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none" value={unitType} onChange={e => handleUnitChange(e.target.value as any)} onKeyDown={e => handleInputKeyDown(e, addButtonRef as any)} disabled={!selectedProduct}>
                        <option value="UND">UND</option>
                        {selectedProduct?.package_type && <option value="PKG">{selectedProduct.package_type}</option>}
                     </select>
                     <ChevronDown className="absolute right-1 top-5 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>

                  <div className="w-20 relative">
                     <div className="flex justify-between items-center mb-0.5">
                        <label className="block text-[10px] font-bold text-blue-800">Precio</label>
                        {selectedProduct && (
                           <button onClick={() => { if (priceLocked) requestAdminAuth(() => setPriceLocked(false), 'Desbloq Precio'); else setPriceLocked(true); }} className={`text-[8px] px-1 rounded font-bold ${priceLocked ? 'bg-slate-200 text-slate-500' : 'bg-red-500 text-white animate-pulse'}`}>{priceLocked ? 'BLOQ' : 'LIBRE'}</button>
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

                  <button ref={addButtonRef} onClick={tryAddToCart} disabled={!selectedProduct} className="bg-accent hover:bg-blue-700 text-white p-1.5 rounded shadow-sm disabled:opacity-50 focus:ring-2 focus:ring-blue-500 outline-none">
                     <Plus className="w-5 h-5" />
                  </button>
               </div>
            )}

            {/* Header of Grid */}
            <div className="bg-slate-200 border-b border-slate-300 text-slate-700 font-bold text-[11px] uppercase flex px-1 py-1.5">
               <div className="w-8 text-center">#</div>
               <div className="w-24 px-2">Código</div>
               <div className="flex-1 px-2">Descripción Producto</div>
               <div className="w-16 text-right px-2">Cant</div>
               <div className="w-20 text-center px-2">Unidad</div>
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
                        const prod = USE_MOCK_DB ? products.find(p => p.id === item.product_id) : searchedProducts.find(p => p.id === item.product_id) || products.find(p => p.id === item.product_id);
                        const autoPromo = item.auto_promo_id ? autoPromotions.find(ap => ap.id === item.auto_promo_id) : null;
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
                                 {(!item.is_bonus && !item.auto_promo_id && !isViewMode) ? (
                                    <input
                                       type="number"
                                       min="1"
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
                                 ) : item.quantity_presentation}
                              </td>
                              <td className="p-2 w-20 text-center text-[10px] text-slate-500">{item.selected_unit === 'UND' ? 'UNIDAD' : 'CAJA'}</td>
                              <td className="p-2 w-20 text-right text-slate-600">S/ {item.unit_price.toFixed(2)}</td>
                              <td className="p-2 w-16 text-right text-slate-500">{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
                              <td className="p-2 w-24 text-right font-bold text-slate-900 text-sm">S/ {item.total_price.toFixed(2)}</td>
                              <td className="p-2 w-8 text-right">
                                 <button
                                    onClick={() => removeFromCart(index)}
                                    className={`text-red-400 hover:bg-red-50 p-1 rounded transition-colors ${item.auto_promo_id ? 'opacity-50 cursor-not-allowed hidden' : ''}`}
                                    disabled={isViewMode || !!item.auto_promo_id}
                                 >
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
               {cart.length === 0 && <div className="p-8 text-center text-slate-400 italic">No hay productos. Use la barra superior para agregar (ENTER para seleccionar).</div>}
            </div>
         </div>

         {/* === FOOTER TOTALS === */}
         <div className="h-24 bg-slate-100 border-t border-slate-400 flex p-2 gap-4">
            <div className="flex-1 flex gap-2 items-end">
               <button onClick={handlePreview} className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded flex items-center shadow-sm hover:bg-slate-50 font-bold">
                  <Printer className="w-4 h-4 mr-2" /> Vista Previa
               </button>
               <div className="flex-1"></div>
               <div className="text-[10px] text-slate-500 italic max-w-xs">
                  * Precios incluyen IGV según configuración global.
                  <br />* Stock verificado por FIFO.
               </div>
            </div>

            <div className="w-64 bg-white border border-slate-300 shadow-sm rounded p-2 grid grid-cols-2 gap-y-1">
               <div className="text-right text-slate-600 font-bold">Op. Gravada:</div>
               <div className="text-right font-mono text-slate-800">{subtotal.toFixed(2)}</div>

               <div className="text-right text-slate-600 font-bold">IGV (18%):</div>
               <div className="text-right font-mono text-slate-800">{igv.toFixed(2)}</div>

               <div className="col-span-2 border-t border-slate-200 my-1"></div>

               <div className="text-right text-slate-800 font-bold text-sm self-center">TOTAL A PAGAR:</div>
               <div className="text-right font-bold text-xl bg-slate-800 text-green-400 px-2 rounded font-mono">
                  {grandTotal.toFixed(2)}
               </div>
            </div>

            <button
               onClick={handleSaveSale}
               disabled={isViewMode && !saleToPrint}
               className={`w-32 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow-lg flex flex-col items-center justify-center ${(isViewMode && !saleToPrint) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
               <Save className="w-6 h-6 mb-1" />
               {isViewMode ? 'IMPRIMIR' : 'GUARDAR (F10)'}
            </button>
         </div>

         {/* === SEARCH MODAL === */}
         {isSearchModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-5xl rounded-lg shadow-2xl flex flex-col max-h-[85vh]">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100 rounded-t-lg">
                     <h3 className="font-bold text-slate-700 flex items-center text-lg"><Search className="w-5 h-5 mr-2" /> Buscar Documento</h3>
                     <button onClick={() => setIsSearchModalOpen(false)} className="text-slate-500 hover:text-red-500"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="p-4 bg-slate-50 border-b border-slate-200 relative">
                     <input
                        autoFocus
                        className="w-full border border-slate-300 rounded p-3 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Buscar por Nro Documento, RUC o Nombre Cliente..."
                        value={saleSearchTerm}
                        onChange={e => setSaleSearchTerm(e.target.value)}
                     />
                     {isSearchingSale && <Loader2 className="absolute right-8 top-7 w-5 h-5 text-blue-500 animate-spin" />}
                  </div>
                  <div className="flex-1 overflow-auto bg-white rounded-b-lg relative">
                     <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200 z-10 shadow-sm">
                           <tr>
                              <th className="p-4">Documento</th>
                              <th className="p-4">Fecha</th>
                              <th className="p-4">Cliente</th>
                              <th className="p-4 text-right">Total</th>
                              <th className="p-4 text-center">Estado</th>
                              <th className="p-4"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {displaySales.map(s => (
                              <tr key={s.id} className="hover:bg-blue-50 transition-colors">
                                 <td className="p-4">
                                    <span className="font-bold text-blue-700 text-[15px]">{s.series}-{s.number}</span>
                                 </td>
                                 <td className="p-4">
                                    <span className="text-slate-600 font-medium text-[15px]">{new Date(s.created_at).toLocaleDateString()}</span>
                                 </td>
                                 <td className="p-4">
                                    <div className="font-bold text-slate-800 text-[15px]">{s.client_name}</div>
                                    <div className="text-[13px] text-slate-500">{s.client_ruc}</div>
                                 </td>
                                 <td className="p-4 text-right">
                                    <span className="font-black text-slate-900 text-[16px]">S/ {s.total.toFixed(2)}</span>
                                 </td>
                                 <td className="p-4 text-center">
                                    <span className={`px-3 py-1 rounded text-xs font-bold ring-1 ${s.sunat_status === 'ACCEPTED' ? 'bg-green-100 ring-green-300 text-green-800' : s.sunat_status === 'SENT' ? 'bg-blue-100 ring-blue-300 text-blue-800' : 'bg-slate-100 ring-slate-300 text-slate-800'}`}>{s.sunat_status || 'PENDING'}</span>
                                 </td>
                                 <td className="p-4 text-right flex gap-2 justify-end">
                                    <button
                                       onClick={() => setShowHistoryModal({ isOpen: true, sale: s })}
                                       className="bg-white border border-slate-300 px-3 py-1.5 rounded text-[13px] font-bold text-slate-700 hover:bg-slate-100 shadow-sm flex items-center transition-all hover:border-slate-400"
                                       title="Ver Historial"
                                    >
                                       H.
                                    </button>
                                    <button
                                       onClick={() => loadSale(s, 'VIEW')}
                                       className="bg-white border border-slate-300 px-4 py-1.5 rounded text-[13px] font-bold text-slate-700 hover:bg-slate-100 shadow-sm flex items-center transition-all hover:border-slate-400"
                                    >
                                       <Eye className="w-4 h-4 mr-1.5 text-slate-500" /> Ver
                                    </button>
                                    <button
                                       onClick={() => requestAdminAuth(() => loadSale(s, 'EDIT'), 'Modificar Documento')}
                                       disabled={s.sunat_status === 'SENT' || s.sunat_status === 'ACCEPTED'}
                                       className="bg-yellow-500 border border-yellow-600 px-4 py-1.5 rounded text-[13px] font-bold text-white hover:bg-yellow-600 shadow-sm flex items-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                       title={s.sunat_status === 'SENT' || s.sunat_status === 'ACCEPTED' ? 'No se puede modificar doc enviado a SUNAT' : 'Modificar Doc'}
                                    >
                                       Modificar
                                    </button>
                                 </td>
                              </tr>
                           ))}
                           {displaySales.length === 0 && (
                              <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-base">No se encontraron documentos que coincidan con su búsqueda.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}

         {/* === HISTORY MODAL === */}
         {showHistoryModal.isOpen && showHistoryModal.sale && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center bg-slate-100 rounded-t-lg mb-4">
                     <h3 className="font-bold text-slate-800 text-lg flex items-center"><Eye className="w-5 h-5 mr-2 text-slate-500" /> Historial de Documento: {showHistoryModal.sale.series}-{showHistoryModal.sale.number}</h3>
                     <button onClick={() => setShowHistoryModal({ isOpen: false, sale: null })} className="text-slate-500 hover:text-red-500"><X className="w-6 h-6" /></button>
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
                           {/* Base creation event */}
                           <tr className="hover:bg-slate-50">
                              <td className="p-3 border-b border-slate-100">{new Date(showHistoryModal.sale.created_at).toLocaleString()}</td>
                              <td className="p-3 border-b border-slate-100 font-bold text-green-700">CREADO</td>
                              <td className="p-3 border-b border-slate-100 italic">Sistema</td>
                              <td className="p-3 border-b border-slate-100 text-slate-500">Documento Inicial</td>
                           </tr>
                           {/* Render actual history events */}
                           {showHistoryModal.sale.history && showHistoryModal.sale.history.map((evt, idx) => (
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
                     <button onClick={() => setShowHistoryModal({ isOpen: false, sale: null })} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded">
                        Cerrar
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* === ADMIN PASSWORD MODAL === */}
         {showAdminAuthModal.isOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
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
                        onClick={() => setShowAdminAuthModal({ isOpen: false, triggerAction: () => { }, targetActionName: '' })}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 font-bold text-sm"
                     >
                        Cancelar (ESC)
                     </button>
                     <button
                        onClick={verifyAdminAndExecute}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-sm"
                     >
                        Autorizar (ENTER)
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
