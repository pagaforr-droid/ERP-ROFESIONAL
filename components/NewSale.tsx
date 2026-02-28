import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Product, BatchAllocation, SaleItem, Client, Sale, AutoPromotion } from '../types';
import { Plus, Trash2, Search, Printer, Save, X, ChevronDown, RefreshCw, FilePlus, Eye, Zap } from 'lucide-react';
import { PrintableInvoice } from './PrintableInvoice';

export const NewSale: React.FC = () => {
   const { products, getBatchesForProduct, createSale, clients, company, priceLists, sales, getNextDocumentNumber, users, updateSaleDetailed, currentUser, autoPromotions } = useStore();

   // --- REFS FOR FOCUS MANAGEMENT ---
   const productInputRef = useRef<HTMLInputElement>(null);
   const qtyInputRef = useRef<HTMLInputElement>(null);
   const unitSelectRef = useRef<HTMLSelectElement>(null);
   const priceInputRef = useRef<HTMLInputElement>(null);
   const discountInputRef = useRef<HTMLInputElement>(null);
   const addButtonRef = useRef<HTMLButtonElement>(null);

   // --- ADMIN LOCK STATE ---
   const [priceLocked, setPriceLocked] = useState(true);

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
   // Default client or selected one
   const [selectedClientId, setSelectedClientId] = useState('');
   const [clientData, setClientData] = useState<Partial<Client>>({
      name: '', doc_number: '', address: '', price_list_id: ''
   });
   const [clientSearch, setClientSearch] = useState('');
   const [showClientSuggestions, setShowClientSuggestions] = useState(false);

   // --- LINE ENTRY STATE ---
   const [productSearch, setProductSearch] = useState('');
   const [showProductSuggestions, setShowProductSuggestions] = useState(false);
   const [highlightedIndex, setHighlightedIndex] = useState(0);

   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
   const [unitType, setUnitType] = useState<'UND' | 'PKG'>('UND');
   const [quantity, setQuantity] = useState<number>(1);
   const [unitPrice, setUnitPrice] = useState<number>(0); // Editable
   const [discountPercent, setDiscountPercent] = useState<number>(0);
   const [isBonus, setIsBonus] = useState(false);

   const [cart, setCart] = useState<SaleItem[]>([]);

   // --- SEARCH SALES MODAL STATE ---
   const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
   const [saleSearchTerm, setSaleSearchTerm] = useState('');
   const [isViewMode, setIsViewMode] = useState(false); // If true, we are viewing a past sale
   const [isEditMode, setIsEditMode] = useState(false); // If true, we are actively modifying a past sale
   const [originalSale, setOriginalSale] = useState<Sale | null>(null);

   // --- HISTORY MODAL STATE ---
   const [showHistoryModal, setShowHistoryModal] = useState<{ isOpen: boolean, sale: Sale | null }>({ isOpen: false, sale: null });

   // --- PRINT STATE ---
   const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);

   // --- FILTERING LOGIC ---
   const filteredClients = clients.filter(c =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.doc_number.includes(clientSearch) ||
      (c.code && c.code.toLowerCase().includes(clientSearch.toLowerCase()))
   );

   const filteredProducts = products.filter(p =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.includes(productSearch)
   );

   const filteredSales = sales.filter(s =>
      s.client_name.toLowerCase().includes(saleSearchTerm.toLowerCase()) ||
      s.number.includes(saleSearchTerm) ||
      s.client_ruc.includes(saleSearchTerm)
   );

   // --- CALCULATIONS ---
   const calculateTotal = (qty: number, price: number, discPct: number) => {
      const gross = qty * price;
      const discount = gross * (discPct / 100);
      return gross - discount;
   };

   const currentTotal = calculateTotal(quantity, unitPrice, discountPercent);

   const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0) / (1 + (company.igv_percent / 100));
   const igv = cart.reduce((sum, item) => sum + item.total_price, 0) - subtotal;
   const grandTotal = cart.reduce((sum, item) => sum + item.total_price, 0);

   // --- ACTIONS ---

   const handleNewSale = () => {
      setIsViewMode(false);
      setIsEditMode(false);
      setOriginalSale(null);
      setCart([]);
      setSelectedClientId('');
      setClientData({ name: '', doc_number: '', address: '', price_list_id: '' });
      setClientSearch('');
      setProductSearch('');

      // Set default based on active series
      const activeFacturaSeries = company.series.find(s => s.type === 'FACTURA' && s.is_active);
      setDocType('FACTURA');
      if (activeFacturaSeries) {
         setSeries(activeFacturaSeries.series);
         setDocNumber(String(activeFacturaSeries.current_number).padStart(8, '0'));
      } else {
         setSeries('');
         setDocNumber('');
      }
   };

   const loadSale = (sale: Sale, mode: 'VIEW' | 'EDIT' = 'VIEW') => {
      if (mode === 'EDIT' && (sale.sunat_status === 'SENT' || sale.sunat_status === 'ACCEPTED')) {
         alert('No se puede modificar un comprobante enviado o aceptado por SUNAT.');
         return;
      }
      setIsViewMode(mode === 'VIEW');
      setIsEditMode(mode === 'EDIT');
      if (mode === 'EDIT') setOriginalSale(sale);

      setDocType(sale.document_type as any);
      setSeries(sale.series);
      setDocNumber(sale.number);
      setClientData({
         name: sale.client_name,
         doc_number: sale.client_ruc,
         address: sale.client_address
      });
      setClientSearch(sale.client_name);
      setPaymentMethod(sale.payment_method);
      setCart(sale.items);
      setIsSearchModalOpen(false);
   };

   const handlePreview = () => {
      // Construct a temporary Sale object for preview
      const tempSale: Sale = {
         id: 'preview',
         document_type: docType,
         series: series,
         number: docNumber,
         payment_method: paymentMethod,
         client_name: clientData.name || 'CLIENTE MOSTRADOR',
         client_ruc: clientData.doc_number || '00000000',
         client_address: clientData.address || '',
         subtotal,
         igv,
         total: grandTotal,
         status: 'pending',
         dispatch_status: 'pending',
         created_at: new Date().toISOString(),
         items: cart
      };
      setSaleToPrint(tempSale);
   };

   // Recalculate prices based on selected Price List
   const removeFromCart = (index: number) => {
      const newItems = cart.filter((_, i) => i !== index);
      applyAutoPromotions(newItems);
   };
   const handleUpdatePrices = () => {
      if (cart.length === 0) return;
      if (!clientData.price_list_id) { alert("Seleccione una lista de precios primero."); return; }

      const updatedCart = cart.map(item => {
         const product = products.find(p => p.id === item.product_id);
         if (!product) return item;

         // Logic to simulate Price Lists (In real app this comes from DB)
         // Default: Base Price
         let newPrice = item.selected_unit === 'PKG' ? product.price_package : product.price_unit;

         // Mock Modifiers
         if (clientData.price_list_id === 'pl1') newPrice = newPrice * 0.92; // Mayorista (-8%)
         if (clientData.price_list_id === 'pl3') newPrice = newPrice * 1.05; // Horeca (+5%)

         // Keep bonus zero
         if (item.is_bonus) newPrice = 0;

         const newTotal = calculateTotal(item.quantity_presentation, newPrice, item.discount_percent);
         const newDiscountAmt = (item.quantity_presentation * newPrice) * (item.discount_percent / 100);

         return {
            ...item,
            unit_price: newPrice,
            total_price: newTotal,
            discount_amount: newDiscountAmt
         };
      });

      setCart(updatedCart);
      applyAutoPromotions(updatedCart);
      alert("Precios actualizados según la lista seleccionada.");
   };

   // --- AUTO PROMOTIONS LOGIC ---
   const applyAutoPromotions = (currentCart: SaleItem[]) => {
      // 1. Remove existing auto-promotions from cart first to recalculate cleanly
      let newCart = currentCart.filter(item => !item.auto_promo_id);

      // 2. Filter active auto promos for current conditions (channels, price list)
      const validPromos = autoPromotions.filter(ap => {
         if (!ap.is_active) return false;
         // Check dates
         const today = new Date().toISOString().split('T')[0];
         if (today < ap.start_date || today > ap.end_date) return false;
         // Check channel
         if (!ap.channels?.includes('IN_STORE')) return false;
         // Check price list
         if (ap.target_price_list_ids?.length > 0 &&
            clientData.price_list_id &&
            !ap.target_price_list_ids.includes('ALL') &&
            !ap.target_price_list_ids.includes(clientData.price_list_id)) return false;
         return true;
      });

      // 3. Check conditions and apply rewards
      validPromos.forEach(ap => {
         let applies = false;
         let multiplyFactor = 0; // How many times the reward is given

         if (ap.condition_type === 'BUY_X_PRODUCT') {
            const qtyBought = newCart
               .filter(item => item.product_id === ap.condition_product_id && !item.is_bonus)
               .reduce((sum, item) => sum + item.quantity_presentation, 0); // Simplified assuming UND/PKG math handled earlier or exact match

            if (qtyBought >= ap.condition_amount) {
               applies = true;
               multiplyFactor = Math.floor(qtyBought / ap.condition_amount);
            }
         } else if (ap.condition_type === 'SPEND_Y_TOTAL') {
            const totalSpent = newCart.reduce((sum, item) => sum + item.total_price, 0);
            if (totalSpent >= ap.condition_amount) {
               applies = true;
               multiplyFactor = Math.floor(totalSpent / ap.condition_amount);
            }
         } else if (ap.condition_type === 'SPEND_Y_CATEGORY') {
            const catSpent = newCart.reduce((sum, item) => {
               const p = products.find(prod => prod.id === item.product_id);
               if (p?.category === ap.condition_category) return sum + item.total_price;
               return sum;
            }, 0);
            if (catSpent >= ap.condition_amount) {
               applies = true;
               multiplyFactor = Math.floor(catSpent / ap.condition_amount);
            }
         }

         if (applies && multiplyFactor > 0) {
            const rewardProd = products.find(p => p.id === ap.reward_product_id);
            if (rewardProd) {
               const rewardQty = ap.reward_quantity * multiplyFactor;
               newCart.push({
                  id: crypto.randomUUID(),
                  product_id: rewardProd.id,
                  product_sku: rewardProd.sku,
                  product_name: rewardProd.name,
                  quantity_base: rewardQty * (rewardProd.package_content || 1), // Assuming base units, simpler for bonifications
                  batch_allocations: [], // Auto-allocate later
                  quantity: rewardQty, // Base quantity alias
                  quantity_presentation: rewardQty,
                  unit_price: 0,
                  discount_percent: 100,
                  discount_amount: 0, // Since unit price is 0
                  total_price: 0,
                  selected_unit: ap.reward_unit_type as 'UND' | 'PKG',
                  is_bonus: true,
                  auto_promo_id: ap.id // Tag it
               });
            }
         }
      });

      setCart(newCart);
   };

   // --- HANDLERS: CLIENT ---
   const selectClient = (c: Client) => {
      setSelectedClientId(c.id);

      // Logic: Auto-select document type
      const newDocType: 'FACTURA' | 'BOLETA' = c.doc_number.length === 11 ? 'FACTURA' : 'BOLETA';
      setDocType(newDocType);

      // Update series based on doc type automatically using store's active series
      const activeSeries = company.series.find(s => s.type === newDocType && s.is_active);
      if (activeSeries) {
         setSeries(activeSeries.series);
         setDocNumber(String(activeSeries.current_number).padStart(8, '0'));
      }

      // Auto-select Price List
      const priceList = c.price_list_id || '';

      setClientData({
         name: c.name,
         doc_number: c.doc_number,
         address: c.address,
         price_list_id: priceList
      });
      setClientSearch(c.name);
      setShowClientSuggestions(false);

      setPaymentMethod(c.payment_condition as any || 'CONTADO');
   };

   // --- HANDLERS: PRODUCT SEARCH & SELECTION ---
   const handleProductKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
         e.preventDefault();
         setHighlightedIndex(prev => (prev + 1) % filteredProducts.length);
      } else if (e.key === 'ArrowUp') {
         e.preventDefault();
         setHighlightedIndex(prev => (prev - 1 + filteredProducts.length) % filteredProducts.length);
      } else if (e.key === 'Enter') {
         e.preventDefault();
         if (filteredProducts.length > 0) {
            selectProduct(filteredProducts[highlightedIndex]);
         }
      } else if (e.key === 'Escape') {
         setShowProductSuggestions(false);
      }
   };

   const selectProduct = (p: Product) => {
      // --- DUPLICATE ALERT ---
      const isDuplicate = cart.some(item => item.product_id === p.id);
      if (isDuplicate) {
         const confirmAction = window.confirm(`¡ADVERTENCIA!\nEl producto "${p.name}" ya se encuentra en el detalle.\n¿Desea continuar agregándolo?`);
         if (!confirmAction) {
            setProductSearch('');
            setShowProductSuggestions(false);
            productInputRef.current?.focus();
            return;
         }
      }

      setSelectedProduct(p);
      setProductSearch(p.name);
      setShowProductSuggestions(false);
      setUnitType('UND'); // Default

      // Calculate Price based on current selected list
      let price = p.price_unit;
      if (clientData.price_list_id === 'pl1') price = price * 0.92;
      if (clientData.price_list_id === 'pl3') price = price * 1.05;

      setUnitPrice(price);
      setQuantity(1);
      setDiscountPercent(0);
      setIsBonus(false);

      // Lock prices by default for the new line
      setPriceLocked(true);

      // Move focus to Qty and highlight text
      setTimeout(() => {
         qtyInputRef.current?.focus();
         qtyInputRef.current?.select();
      }, 50);
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

   // --- HANDLERS: ADD TO CART ---
   const handleAddToCart = () => {
      if (!selectedProduct) return;
      if (quantity <= 0) { alert("Cantidad inválida"); return; }

      const prod = selectedProduct;
      const conversionFactor = unitType === 'PKG' ? (prod.package_content || 1) : 1;
      const requiredBaseUnits = quantity * conversionFactor;
      const availableBatches = getBatchesForProduct(prod.id);
      const totalStock = availableBatches.reduce((acc, b) => acc + b.quantity_current, 0);

      if (totalStock < requiredBaseUnits) {
         alert(`Stock insuficiente. Disponible: ${totalStock} unid. Requerido: ${requiredBaseUnits} unid.`);
         return;
      }

      // Allocate Batches
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
               ...existing,
               quantity_presentation: newQty,
               quantity: unitType === 'PKG' ? newQty * prod.units_per_package : newQty,
               total_price: newPrice,
               discount_percent: discountPercent,
               discount_amount: (newQty * unitPrice) * (discountPercent / 100)
            };
         } else {
            return;
         }
      } else {
         const newItem: SaleItem = {
            id: crypto.randomUUID(),
            sale_id: '',
            product_id: prod.id,
            product_sku: prod.sku,
            product_name: prod.name,
            selected_unit: unitType,
            quantity_presentation: quantity,
            quantity_base: requiredBaseUnits,
            unit_price: unitPrice,
            total_price: calculateTotal(quantity, unitPrice, discountPercent),
            discount_percent: discountPercent,
            discount_amount: (quantity * unitPrice) * (discountPercent / 100),
            is_bonus: isBonus,
            batch_allocations: selectedBatches
         };
         initialNewCart = [...initialNewCart, newItem];
      }

      applyAutoPromotions(initialNewCart);

      // Reset
      setSelectedProduct(null);
      setProductSearch('');
      setQuantity(1);
      setUnitPrice(0);
      setDiscountPercent(0);
      setIsBonus(false);
      setTimeout(() => productInputRef.current?.focus(), 50);
   };

   const handleInputKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<any> | 'ADD' | 'BONUS_TOGGLE') => {
      if (e.key === 'Enter') {
         e.preventDefault();
         if (nextRef === 'ADD') {
            addButtonRef.current?.focus();
         } else if (nextRef === 'BONUS_TOGGLE') {
            setIsBonus(prev => !prev);
         } else if (nextRef.current) {
            nextRef.current.focus();
            if (nextRef.current.select) {
               nextRef.current.select();
            }
         }
      } else if (e.key === 'Escape') {
         // Reset entry
         setSelectedProduct(null);
         setProductSearch('');
         setTimeout(() => productInputRef.current?.focus(), 50);
      }
   };

   // --- ADMIN AUTHORIZATION FOR BONUS / DISCOUNT ---
   const [showAdminAuthModal, setShowAdminAuthModal] = useState<{ isOpen: boolean, triggerAction: () => void, targetActionName: string }>({ isOpen: false, triggerAction: () => { }, targetActionName: '' });
   const [adminPasswordInput, setAdminPasswordInput] = useState('');

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
         alert("Contraseña incorrecta o el usuario no es administrador.");
      }
   };

   const tryAddToCart = () => {
      if (isBonus || discountPercent > 0) {
         requestAdminAuth(handleAddToCart, 'Autorizar Descuento / Bonificación');
      } else {
         handleAddToCart();
      }
   };

   // --- FINAL SAVE ---
   const handleSaveSale = () => {
      if (isViewMode && !isEditMode) {
         // If viewing history, just print current
         const currentSale = sales.find(s => s.series === series && s.number === docNumber);
         if (currentSale) setSaleToPrint(currentSale);
         return;
      }

      if (cart.length === 0) return;
      if (!selectedClientId && !clientData.name) { alert("Ingrese datos del cliente"); return; }
      if (!series) { alert("No hay una serie asignada a este tipo de documento. Configure una en los Ajustes de Empresa."); return; }

      // --- CONFIRMATION MODAL ---
      const confirmSave = window.confirm(`¿Está seguro que desea ${isEditMode ? 'MODIFICAR' : 'emitir'} el comprobante ${docType} ${series}?`);
      if (!confirmSave) return;

      const correlative = getNextDocumentNumber(docType, series);

      if (!correlative && !isEditMode) {
         alert("Error al obtener la serie. Verifique la configuración de la empresa.");
         return;
      }

      const newSaleData: Sale = {
         id: isEditMode && originalSale ? originalSale.id : crypto.randomUUID(),
         document_type: docType,
         series: isEditMode ? series : correlative!.series,
         number: isEditMode ? docNumber : correlative!.number,
         payment_method: paymentMethod,
         client_name: clientData.name || 'CLIENTE VARIOS',
         client_ruc: clientData.doc_number || '00000000',
         client_address: clientData.address || '',
         subtotal,
         igv,
         total: grandTotal,
         status: 'completed',
         dispatch_status: isEditMode && originalSale ? originalSale.dispatch_status : 'pending',
         created_at: isEditMode && originalSale ? originalSale.created_at : new Date().toISOString(),
         items: cart,
         sunat_status: isEditMode && originalSale ? originalSale.sunat_status : 'PENDING'
      };

      if (isEditMode && originalSale) {
         const result = updateSaleDetailed(newSaleData, originalSale, currentUser?.name || 'ADMIN');
         if (!result.success) {
            alert(result.msg);
            return;
         }
         alert(result.msg);
      } else {
         createSale(newSaleData);
      }

      // Trigger Print
      setSaleToPrint(newSaleData);

      handleNewSale(); // automatically resets to next doc number
   };

   return (
      <div className="flex flex-col h-full bg-slate-200 p-2 font-sans text-xs relative">

         {/* PRINT COMPONENT OVERLAY */}
         {saleToPrint && <PrintableInvoice company={company} sales={[saleToPrint]} onClose={() => setSaleToPrint(null)} />}

         {/* === HEADER SECTION === */}
         <div className="bg-white p-2 rounded shadow-sm border border-slate-300 mb-2 space-y-2 relative">
            {/* Top Actions */}
            <div className="absolute top-2 right-2 flex gap-2">
               <button onClick={handleNewSale} className="bg-slate-700 text-white px-3 py-1 rounded shadow text-xs font-bold hover:bg-slate-600 flex items-center">
                  <FilePlus className="w-3.5 h-3.5 mr-1" /> Nuevo (F2)
               </button>
               <button onClick={() => setIsSearchModalOpen(true)} className="bg-blue-600 text-white px-3 py-1 rounded shadow text-xs font-bold hover:bg-blue-500 flex items-center">
                  <Search className="w-3.5 h-3.5 mr-1" /> Buscar Doc (F3)
               </button>
            </div>

            {/* Row 1: Document Data */}
            <div className="flex items-center gap-3 mt-1 py-1">
               <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">Tipo</label>
                  <select
                     className="border border-slate-300 rounded px-2 py-1 flex-1 bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                     value={docType}
                     onChange={(e: any) => {
                        setDocType(e.target.value);
                        const activeSeries = company.series.find(s => s.type === e.target.value && s.is_active);
                        if (activeSeries) {
                           setSeries(activeSeries.series);
                           setDocNumber(String(activeSeries.current_number).padStart(8, '0'));
                        } else {
                           setSeries('');
                           setDocNumber('');
                        }
                     }}
                     disabled={isViewMode}
                  >
                     <option value="FACTURA">FACTURA</option>
                     <option value="BOLETA">BOLETA</option>
                  </select>
               </div>
               <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">Serie y Correlativo</label>
                  <select
                     className="w-20 text-center border border-slate-300 rounded px-1 py-1 text-sm font-bold bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                     value={series}
                     onChange={(e) => {
                        setSeries(e.target.value);
                        const sObj = company.series.find(s => s.type === docType && s.series === e.target.value);
                        if (sObj) setDocNumber(String(sObj.current_number).padStart(8, '0'));
                     }}
                     disabled={isViewMode}
                  >
                     {company.series.filter(s => s.type === docType && s.is_active).map(s => (
                        <option key={s.id} value={s.series}>{s.series}</option>
                     ))}
                  </select>
                  <input className="w-24 text-center border border-transparent px-1 py-1 text-sm font-bold bg-transparent text-slate-800 pointer-events-none" value={docNumber} readOnly />
               </div>
               <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">Moneda</label>
                  <select className="border border-slate-300 rounded px-2 py-1 text-sm bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={currency} onChange={e => setCurrency(e.target.value)} disabled={isViewMode}>
                     <option value="SOLES">SOLES</option>
                     <option value="DOLAR">DOLAR</option>
                  </select>
               </div>
               <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                  <label className="font-bold text-slate-700 text-sm">F. Emision</label>
                  <input type="date" className="border border-slate-300 rounded px-2 py-1 text-sm bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" defaultValue={new Date().toISOString().split('T')[0]} disabled={isViewMode} />
               </div>
            </div>
            {isViewMode && <div className="ml-4 px-3 py-1 bg-yellow-200 text-yellow-800 font-bold rounded animate-pulse">MODO VISUALIZACIÓN</div>}
            {isEditMode && <div className="ml-4 px-3 py-1 bg-red-600 text-white font-bold rounded animate-pulse relative pr-8">
               MODIFICANDO DOCUMENTO
               <button onClick={handleNewSale} className="absolute right-1 top-1.5 hover:text-red-200"><X className="w-4 h-4" /></button>
            </div>}
            {!series && !isViewMode && !isEditMode && <div className="ml-4 px-3 py-1 bg-red-100 text-red-800 text-[10px] font-bold rounded border border-red-300">¡DEBE CONFIGURAR UNA SERIE EN AJUSTES!</div>}
         </div>

         {/* Row 2: Client Data */}
         <div className="flex items-start gap-2">
            <div className="flex-1 grid grid-cols-12 gap-1 bg-slate-100 p-1.5 rounded border border-slate-200">
               <div className="col-span-2 relative">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Cod Cliente / Buscar</label>
                  <div className="relative">
                     <Search className="absolute left-1 top-1 w-3 h-3 text-slate-400" />
                     <input
                        className="w-full pl-5 pr-1 py-0.5 border border-slate-300 rounded text-slate-900 font-bold focus:bg-yellow-50 disabled:bg-slate-200"
                        placeholder="Buscar..."
                        value={clientSearch}
                        onChange={e => { setClientSearch(e.target.value); setShowClientSuggestions(true); }}
                        onFocus={() => setShowClientSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                        disabled={isViewMode}
                     />
                     {showClientSuggestions && clientSearch && (
                        <div className="absolute top-full left-0 w-[300px] bg-white border border-slate-400 shadow-xl z-50 max-h-48 overflow-auto">
                           {filteredClients.map(c => (
                              <div key={c.id} onMouseDown={() => selectClient(c)} className="p-2 hover:bg-blue-100 cursor-pointer border-b border-slate-100">
                                 <div className="font-bold text-slate-800">{c.name}</div>
                                 <div className="text-[10px] text-slate-500">{c.doc_number} | {c.address}</div>
                              </div>
                           ))}
                           {filteredClients.length === 0 && <div className="p-2 text-slate-400 italic">No encontrado</div>}
                        </div>
                     )}
                  </div>
               </div>
               <div className="col-span-5">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Razón Social</label>
                  <input className="w-full border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800 disabled:bg-slate-200" value={clientData.name} onChange={e => setClientData({ ...clientData, name: e.target.value })} disabled={isViewMode} />
               </div>
               <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">RUC/DNI</label>
                  <input className="w-full border border-slate-300 rounded px-1 py-0.5 bg-slate-50 text-slate-800 font-mono disabled:bg-slate-200" value={clientData.doc_number} onChange={e => setClientData({ ...clientData, doc_number: e.target.value })} disabled={isViewMode} />
               </div>
               <div className="col-span-3">
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
                        className="bg-blue-100 border border-blue-300 text-blue-700 px-1.5 rounded hover:bg-blue-200 disabled:opacity-50"
                        title="Actualizar Precios en Carrito"
                     >
                        <RefreshCw className="w-3.5 h-3.5" />
                     </button>
                  </div>
               </div>
               <div className="col-span-9">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Dirección</label>
                  <input className="w-full border border-slate-300 rounded px-1 py-0.5 bg-slate-50 text-slate-600 disabled:bg-slate-200" value={clientData.address} onChange={e => setClientData({ ...clientData, address: e.target.value })} disabled={isViewMode} />
               </div>
               <div className="col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Forma Pago</label>
                  <select className="w-full border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800 disabled:bg-slate-200" value={paymentMethod} onChange={(e: any) => setPaymentMethod(e.target.value)} disabled={isViewMode}>
                     <option value="CONTADO">CONTADO</option>
                     <option value="CREDITO">CREDITO</option>
                  </select>
               </div>
            </div>
         </div>
         {/* === GRID SECTION === */}
         <div className="flex-1 bg-white border border-slate-400 flex flex-col shadow-sm">
            {/* Entry Row (Simulating Grid Input) */}
            {(!isViewMode || isEditMode) && (
               <div className="bg-blue-50 border-b border-blue-200 p-1 flex items-end gap-1">
                  <div className="flex-1 relative">
                     <label className="block text-[10px] font-bold text-blue-800 mb-0.5 ml-1">Producto (Buscar por Nombre o Código)</label>
                     <div className="relative">
                        <Search className="absolute left-1.5 top-1.5 w-3 h-3 text-blue-400" />
                        <input
                           ref={productInputRef}
                           className="w-full pl-6 pr-2 py-1 border border-blue-300 rounded text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                           placeholder="PISTOLEAR O ESCRIBIR..."
                           value={productSearch}
                           onChange={e => { setProductSearch(e.target.value); setShowProductSuggestions(true); setHighlightedIndex(0); }}
                           onKeyDown={handleProductKeyDown}
                           onFocus={() => setShowProductSuggestions(true)}
                           onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                        />
                        {showProductSuggestions && productSearch && (
                           <div className="absolute top-full left-0 w-full bg-white border border-slate-400 shadow-2xl z-50 max-h-60 overflow-auto">
                              <table className="w-full text-left text-xs">
                                 <thead className="bg-slate-100 font-bold text-slate-600">
                                    <tr>
                                       <th className="p-2">Código</th>
                                       <th className="p-2">Producto</th>
                                       <th className="p-2 text-right">Precio Und</th>
                                       <th className="p-2 text-right">Stock</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {filteredProducts.map((p, idx) => {
                                       const stock = getBatchesForProduct(p.id).reduce((sum, b) => sum + b.quantity_current, 0);
                                       return (
                                          <tr
                                             key={p.id}
                                             onMouseDown={() => selectProduct(p)}
                                             className={`cursor-pointer ${idx === highlightedIndex ? 'bg-blue-200' : 'hover:bg-blue-50'}`}
                                          >
                                             <td className="p-2 font-mono text-blue-800 font-bold">{p.sku}</td>
                                             <td className="p-2 font-medium">{p.name}</td>
                                             <td className="p-2 text-right">S/ {p.price_unit.toFixed(2)}</td>
                                             <td className="p-2 text-right font-bold text-slate-700">{stock}</td>
                                          </tr>
                                       );
                                    })}
                                 </tbody>
                              </table>
                              {filteredProducts.length === 0 && <div className="p-2 text-center text-slate-400">Sin coincidencias</div>}
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="w-16">
                     <label className="block text-[10px] font-bold text-blue-800 mb-0.5 text-center">Cant.</label>
                     <input
                        ref={qtyInputRef}
                        type="number"
                        min="1"
                        className="w-full border border-blue-300 rounded py-1 px-1 text-center font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={quantity}
                        onChange={e => setQuantity(Number(e.target.value))}
                        onKeyDown={e => handleInputKeyDown(e, unitSelectRef)}
                        disabled={!selectedProduct}
                     />
                  </div>

                  <div className="w-20">
                     <label className="block text-[10px] font-bold text-blue-800 mb-0.5">Unidad</label>
                     <div className="relative">
                        <select
                           ref={unitSelectRef}
                           className="w-full border border-blue-300 rounded py-1 px-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                           value={unitType}
                           onChange={e => handleUnitChange(e.target.value as any)}
                           onKeyDown={e => handleInputKeyDown(e, addButtonRef as any)}
                           disabled={!selectedProduct}
                        >
                           <option value="UND">UND</option>
                           {selectedProduct?.package_type && <option value="PKG">{selectedProduct.package_type}</option>}
                        </select>
                        <ChevronDown className="absolute right-1 top-1.5 w-3 h-3 text-slate-400 pointer-events-none" />
                     </div>
                  </div>

                  <div className="w-20 relative">
                     <div className="flex justify-between items-center mb-0.5">
                        <label className="block text-[10px] font-bold text-blue-800">Precio</label>
                        {selectedProduct && (
                           <button
                              onClick={() => {
                                 if (priceLocked) requestAdminAuth(() => setPriceLocked(false), 'Desbloquear Precio/Descuento');
                                 else setPriceLocked(true);
                              }}
                              className={`text-[8px] px-1 rounded font-bold ${priceLocked ? 'bg-slate-200 text-slate-500 hover:bg-slate-300' : 'bg-red-500 text-white animate-pulse'}`}
                              title={priceLocked ? 'Desbloquear Precio (Admin)' : 'Bloquear Precio'}
                           >
                              {priceLocked ? 'BLOQ' : 'LIBRE'}
                           </button>
                        )}
                     </div>
                     <input
                        ref={priceInputRef}
                        type="number"
                        className="w-full border border-blue-300 rounded py-1 px-1 text-right text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-200"
                        value={unitPrice}
                        onChange={e => setUnitPrice(Number(e.target.value))}
                        onKeyDown={e => handleInputKeyDown(e, discountInputRef)}
                        disabled={!selectedProduct || isBonus || priceLocked}
                     />
                  </div>

                  <div className="w-14">
                     <label className="block text-[10px] font-bold text-blue-800 mb-0.5 text-right">% Dsc</label>
                     <input
                        ref={discountInputRef}
                        type="number"
                        className="w-full border border-blue-300 rounded py-1 px-1 text-right text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-200"
                        value={discountPercent}
                        onChange={e => setDiscountPercent(Number(e.target.value))}
                        onKeyDown={e => handleInputKeyDown(e, 'ADD')}
                        disabled={!selectedProduct || isBonus || priceLocked}
                     />
                  </div>

                  <div className="w-16 flex items-center justify-center pb-1">
                     <label className="flex items-center text-[10px] font-bold text-blue-800 cursor-pointer">
                        <input type="checkbox" className="mr-1" checked={isBonus} onChange={e => {
                           if (e.target.checked) requestAdminAuth(() => setIsBonus(true), 'Autorizar Bonificación');
                           else setIsBonus(false);
                        }} onKeyDown={e => handleInputKeyDown(e, 'ADD')} />
                        Bonif.
                     </label>
                  </div>

                  <div className="w-24 bg-blue-100 rounded px-2 py-1 flex flex-col items-end border border-blue-200">
                     <span className="text-[9px] text-blue-600 font-bold uppercase">Parcial</span>
                     <span className="font-bold text-sm text-blue-900">{(isBonus ? 0 : currentTotal).toFixed(2)}</span>
                  </div>

                  <button
                     ref={addButtonRef}
                     onClick={tryAddToCart}
                     disabled={!selectedProduct}
                     className="bg-accent hover:bg-blue-700 text-white p-1.5 rounded shadow-sm disabled:opacity-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
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
                        const prod = products.find(p => p.id === item.product_id);
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
                              <td className="p-2 w-16 text-right font-bold">{item.quantity_presentation}</td>
                              <td className="p-2 w-20 text-center text-[10px] text-slate-500">{item.selected_unit === 'UND' ? 'UNIDAD' : 'CAJA'}</td>
                              <td className="p-2 w-20 text-right text-slate-600">{item.unit_price.toFixed(2)}</td>
                              <td className="p-2 w-16 text-right text-slate-500">{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
                              <td className="p-2 w-24 text-right font-bold text-slate-900">{item.total_price.toFixed(2)}</td>
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
               <button onClick={handlePreview} className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded flex items-center shadow-sm hover:bg-slate-50">
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
         {
            isSearchModalOpen && (
               <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white w-full max-w-5xl rounded-lg shadow-2xl flex flex-col max-h-[85vh]">
                     <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100 rounded-t-lg">
                        <h3 className="font-bold text-slate-700 flex items-center text-lg"><Search className="w-5 h-5 mr-2" /> Buscar Documento</h3>
                        <button onClick={() => setIsSearchModalOpen(false)} className="text-slate-500 hover:text-red-500"><X className="w-6 h-6" /></button>
                     </div>
                     <div className="p-4 bg-slate-50 border-b border-slate-200">
                        <input
                           autoFocus
                           className="w-full border border-slate-300 rounded p-3 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                           placeholder="Buscar por Nro Documento, RUC o Nombre Cliente..."
                           value={saleSearchTerm}
                           onChange={e => setSaleSearchTerm(e.target.value)}
                        />
                     </div>
                     {/* Table Wrapper to handle sticky header corner cases */}
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
                              {filteredSales.map(s => (
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
                              {filteredSales.length === 0 && (
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
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                  <h3 className="font-bold text-slate-800 text-lg mb-2">Se requiere autorización</h3>
                  <p className="text-sm text-slate-600 mb-4">Ingrese la contraseña de administrador para: <strong>{showAdminAuthModal.targetActionName}</strong></p>

                  <input
                     id="admin-password-input"
                     type="password"
                     className="w-full border border-slate-300 rounded p-2 mb-4 text-center text-lg tracking-widest focus:ring-2 focus:ring-blue-500 outline-none"
                     placeholder="Contraseña..."
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