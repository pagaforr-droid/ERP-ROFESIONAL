import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Product, BatchAllocation, SaleItem, Client, Sale } from '../types';
import { Plus, Trash2, Search, Printer, Save, X, ChevronDown, RefreshCw, FilePlus, Eye } from 'lucide-react';
import { PrintableInvoice } from './PrintableInvoice';

export const NewSale: React.FC = () => {
  const { products, getBatchesForProduct, createSale, clients, company, priceLists, sales } = useStore();
  
  // --- REFS FOR FOCUS MANAGEMENT ---
  const productInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);

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

  // --- PRINT STATE ---
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);

  // --- FILTERING LOGIC ---
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
    c.doc_number.includes(clientSearch)
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
    setCart([]);
    setSelectedClientId('');
    setClientData({ name: '', doc_number: '', address: '', price_list_id: '' });
    setClientSearch('');
    setProductSearch('');
    // Reset to defaults
    const defaultSeries = company.series.find(s => s.type === 'FACTURA');
    setDocType('FACTURA');
    if(defaultSeries) {
       setSeries(defaultSeries.series);
       setDocNumber(String(defaultSeries.current_number).padStart(8, '0'));
    }
  };

  const loadSale = (sale: Sale) => {
     setIsViewMode(true);
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
     alert("Precios actualizados según la lista seleccionada.");
  };

  // --- HANDLERS: CLIENT ---
  const selectClient = (c: Client) => {
     setSelectedClientId(c.id);
     
     // Logic: Auto-select document type
     const newDocType: 'FACTURA' | 'BOLETA' = c.doc_number.length === 11 ? 'FACTURA' : 'BOLETA';
     setDocType(newDocType);
     
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
     
     // Move focus to Qty
     setTimeout(() => qtyInputRef.current?.focus(), 50);
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

     // 1. Stock Check (FIFO)
     const conversionFactor = unitType === 'PKG' ? (selectedProduct.package_content || 1) : 1;
     const requiredBaseUnits = quantity * conversionFactor;
     const availableBatches = getBatchesForProduct(selectedProduct.id);
     const totalStock = availableBatches.reduce((acc, b) => acc + b.quantity_current, 0);

     if (totalStock < requiredBaseUnits) {
        alert(`Stock insuficiente. Disponible: ${totalStock} unid. Requerido: ${requiredBaseUnits} unid.`);
        return;
     }

     // 2. Allocate Batches
     let remaining = requiredBaseUnits;
     const allocations: BatchAllocation[] = [];
     for (const batch of availableBatches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, batch.quantity_current);
        allocations.push({ batch_id: batch.id, batch_code: batch.code, quantity: take });
        remaining -= take;
     }

     // 3. Create Item
     const finalPrice = isBonus ? 0 : unitPrice;
     const total = isBonus ? 0 : calculateTotal(quantity, finalPrice, discountPercent);
     const discountAmt = (quantity * finalPrice) * (discountPercent / 100);

     const newItem: SaleItem = {
        id: crypto.randomUUID(),
        sale_id: '',
        product_id: selectedProduct.id,
        product_sku: selectedProduct.sku,
        product_name: selectedProduct.name,
        selected_unit: unitType,
        quantity_presentation: quantity,
        quantity_base: requiredBaseUnits,
        unit_price: finalPrice,
        total_price: total,
        discount_percent: discountPercent,
        discount_amount: discountAmt,
        is_bonus: isBonus,
        batch_allocations: allocations
     };

     setCart([...cart, newItem]);
     
     // 4. Reset & Refocus
     setSelectedProduct(null);
     setProductSearch('');
     setQuantity(1);
     setUnitPrice(0);
     setDiscountPercent(0);
     setIsBonus(false);
     setTimeout(() => productInputRef.current?.focus(), 50);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLInputElement> | 'ADD') => {
     if (e.key === 'Enter') {
        e.preventDefault();
        if (nextRef === 'ADD') {
           handleAddToCart();
        } else {
           nextRef.current?.focus();
           nextRef.current?.select();
        }
     }
  };

  // --- FINAL SAVE ---
  const handleSaveSale = () => {
    if (isViewMode) {
       // If viewing history, just print current
       const currentSale = sales.find(s => s.series === series && s.number === docNumber);
       if (currentSale) setSaleToPrint(currentSale);
       return;
    }

    if (cart.length === 0) return;
    if (!selectedClientId && !clientData.name) { alert("Ingrese datos del cliente"); return; }

    const newSaleData: Sale = {
      id: crypto.randomUUID(),
      document_type: docType,
      series,
      number: docNumber,
      payment_method: paymentMethod,
      client_name: clientData.name || 'CLIENTE VARIOS',
      client_ruc: clientData.doc_number || '00000000',
      client_address: clientData.address || '',
      subtotal,
      igv,
      total: grandTotal,
      status: 'completed',
      dispatch_status: 'pending',
      created_at: new Date().toISOString(),
      items: cart
    };

    createSale(newSaleData);
    
    // Trigger Print
    setSaleToPrint(newSaleData);

    handleNewSale();
    // Increment correlation mock
    setDocNumber(prev => String(parseInt(prev) + 1).padStart(8, '0'));
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
         <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200">
               <label className="font-bold text-slate-600 w-10">Tipo</label>
               <select className="border border-slate-300 rounded px-1 py-0.5 w-24 bg-white" value={docType} onChange={(e: any) => setDocType(e.target.value)} disabled={isViewMode}>
                  <option value="FACTURA">FACTURA</option>
                  <option value="BOLETA">BOLETA</option>
               </select>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200">
               <label className="font-bold text-slate-600">Serie</label>
               <input className="w-12 text-center border border-slate-300 rounded px-1 py-0.5 font-bold bg-slate-200 text-slate-700" value={series} readOnly />
               <input className="w-20 text-center border border-slate-300 rounded px-1 py-0.5 font-bold bg-white text-slate-900" value={docNumber} readOnly />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200">
               <label className="font-bold text-slate-600">Moneda</label>
               <select className="border border-slate-300 rounded px-1 py-0.5 w-20 bg-white" value={currency} onChange={e => setCurrency(e.target.value)} disabled={isViewMode}>
                  <option value="SOLES">SOLES</option>
                  <option value="DOLAR">DOLAR</option>
               </select>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200">
               <label className="font-bold text-slate-600">F. Emision</label>
               <input type="date" className="border border-slate-300 rounded px-1 py-0.5 w-24 bg-white" defaultValue={new Date().toISOString().split('T')[0]} disabled={isViewMode} />
            </div>
            {isViewMode && <div className="ml-4 px-3 py-1 bg-yellow-200 text-yellow-800 font-bold rounded animate-pulse">MODO VISUALIZACIÓN</div>}
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
                   <input className="w-full border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800 disabled:bg-slate-200" value={clientData.name} onChange={e => setClientData({...clientData, name: e.target.value})} disabled={isViewMode} />
               </div>
               <div className="col-span-2">
                   <label className="block text-[10px] font-bold text-slate-500 mb-0.5">RUC/DNI</label>
                   <input className="w-full border border-slate-300 rounded px-1 py-0.5 bg-slate-50 text-slate-800 font-mono disabled:bg-slate-200" value={clientData.doc_number} onChange={e => setClientData({...clientData, doc_number: e.target.value})} disabled={isViewMode} />
               </div>
               <div className="col-span-3">
                   <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Lista Precio</label>
                   <div className="flex gap-1">
                     <select 
                        className="w-full border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800 disabled:bg-slate-200" 
                        value={clientData.price_list_id} 
                        onChange={e => setClientData({...clientData, price_list_id: e.target.value})}
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
                   <input className="w-full border border-slate-300 rounded px-1 py-0.5 bg-slate-50 text-slate-600 disabled:bg-slate-200" value={clientData.address} onChange={e => setClientData({...clientData, address: e.target.value})} disabled={isViewMode} />
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
      </div>

      {/* === GRID SECTION === */}
      <div className="flex-1 bg-white border border-slate-400 flex flex-col shadow-sm">
         {/* Entry Row (Simulating Grid Input) */}
         {!isViewMode && (
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
                  onKeyDown={e => handleInputKeyDown(e, priceInputRef)}
                  disabled={!selectedProduct}
                />
             </div>

             <div className="w-20">
                <label className="block text-[10px] font-bold text-blue-800 mb-0.5">Unidad</label>
                <div className="relative">
                   <select 
                      className="w-full border border-blue-300 rounded py-1 px-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                      value={unitType}
                      onChange={e => handleUnitChange(e.target.value as any)}
                      disabled={!selectedProduct}
                   >
                      <option value="UND">UND</option>
                      {selectedProduct?.package_type && <option value="PKG">{selectedProduct.package_type}</option>}
                   </select>
                   <ChevronDown className="absolute right-1 top-1.5 w-3 h-3 text-slate-400 pointer-events-none" />
                </div>
             </div>

             <div className="w-20">
                <label className="block text-[10px] font-bold text-blue-800 mb-0.5 text-right">Precio</label>
                <input 
                  ref={priceInputRef}
                  type="number"
                  className="w-full border border-blue-300 rounded py-1 px-1 text-right text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={unitPrice}
                  onChange={e => setUnitPrice(Number(e.target.value))}
                  onKeyDown={e => handleInputKeyDown(e, discountInputRef)}
                  disabled={!selectedProduct || isBonus}
                />
             </div>

             <div className="w-14">
                <label className="block text-[10px] font-bold text-blue-800 mb-0.5 text-right">% Dsc</label>
                <input 
                   ref={discountInputRef}
                   type="number"
                   className="w-full border border-blue-300 rounded py-1 px-1 text-right text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                   value={discountPercent}
                   onChange={e => setDiscountPercent(Number(e.target.value))}
                   onKeyDown={e => handleInputKeyDown(e, 'ADD')}
                   disabled={!selectedProduct || isBonus}
                />
             </div>
             
             <div className="w-16 flex items-center justify-center pb-1">
                 <label className="flex items-center text-[10px] font-bold text-blue-800 cursor-pointer">
                    <input type="checkbox" className="mr-1" checked={isBonus} onChange={e => setIsBonus(e.target.checked)} />
                    Bonif.
                 </label>
             </div>

             <div className="w-24 bg-blue-100 rounded px-2 py-1 flex flex-col items-end border border-blue-200">
                <span className="text-[9px] text-blue-600 font-bold uppercase">Parcial</span>
                <span className="font-bold text-sm text-blue-900">{(isBonus ? 0 : currentTotal).toFixed(2)}</span>
             </div>

             <button 
                onClick={handleAddToCart}
                disabled={!selectedProduct}
                className="bg-accent hover:bg-blue-700 text-white p-1.5 rounded shadow-sm disabled:opacity-50"
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
            {cart.map((item, idx) => (
               <div key={item.id} className={`flex border-b border-slate-100 text-xs py-1 px-1 hover:bg-yellow-50 items-center ${item.is_bonus ? 'bg-green-50' : ''}`}>
                  <div className="w-8 text-center text-slate-400">{idx + 1}</div>
                  <div className="w-24 px-2 font-mono text-slate-600">{item.product_sku}</div>
                  <div className="flex-1 px-2 font-medium text-slate-800 truncate">
                     {item.product_name}
                     {item.is_bonus && <span className="ml-2 text-[9px] bg-green-200 text-green-800 px-1 rounded font-bold">BONIFICACIÓN</span>}
                  </div>
                  <div className="w-16 text-right px-2 font-bold">{item.quantity_presentation}</div>
                  <div className="w-20 text-center px-2 text-[10px] text-slate-500">{item.selected_unit === 'UND' ? 'UNIDAD' : 'CAJA'}</div>
                  <div className="w-20 text-right px-2 text-slate-600">{item.unit_price.toFixed(2)}</div>
                  <div className="w-16 text-right px-2 text-slate-500">{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</div>
                  <div className="w-24 text-right px-2 font-bold text-slate-900">{item.total_price.toFixed(2)}</div>
                  <div className="w-8 text-center">
                     {!isViewMode && (
                     <button onClick={() => setCart(cart.filter(x => x.id !== item.id))} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                     </button>
                     )}
                  </div>
               </div>
            ))}
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
                <br/>* Stock verificado por FIFO.
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
         <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl flex flex-col max-h-[80vh]">
               <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100 rounded-t-lg">
                  <h3 className="font-bold text-slate-700 flex items-center"><Search className="w-5 h-5 mr-2" /> Buscar Documento</h3>
                  <button onClick={() => setIsSearchModalOpen(false)} className="text-slate-500 hover:text-red-500"><X className="w-6 h-6" /></button>
               </div>
               <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <input 
                     autoFocus
                     className="w-full border border-slate-300 rounded p-2 text-lg" 
                     placeholder="Buscar por Nro Documento, RUC o Nombre Cliente..."
                     value={saleSearchTerm}
                     onChange={e => setSaleSearchTerm(e.target.value)}
                  />
               </div>
               <div className="flex-1 overflow-auto p-0">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                        <tr>
                           <th className="p-3">Documento</th>
                           <th className="p-3">Fecha</th>
                           <th className="p-3">Cliente</th>
                           <th className="p-3 text-right">Total</th>
                           <th className="p-3 text-center">Estado</th>
                           <th className="p-3"></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {filteredSales.map(s => (
                           <tr key={s.id} className="hover:bg-blue-50">
                              <td className="p-3 font-mono font-bold text-blue-700">{s.series}-{s.number}</td>
                              <td className="p-3 text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                              <td className="p-3">
                                 <div className="font-bold text-slate-800">{s.client_name}</div>
                                 <div className="text-xs text-slate-500">{s.client_ruc}</div>
                              </td>
                              <td className="p-3 text-right font-bold text-slate-900">S/ {s.total.toFixed(2)}</td>
                              <td className="p-3 text-center">
                                 <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">COMPLETADO</span>
                              </td>
                              <td className="p-3 text-right">
                                 <button 
                                    onClick={() => loadSale(s)}
                                    className="bg-white border border-slate-300 px-3 py-1 rounded text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center ml-auto"
                                 >
                                    <Eye className="w-3 h-3 mr-1" /> Ver
                                 </button>
                              </td>
                           </tr>
                        ))}
                        {filteredSales.length === 0 && (
                           <tr><td colSpan={6} className="p-8 text-center text-slate-400">No se encontraron documentos.</td></tr>
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