
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Order, OrderItem, Client, Product, Sale } from '../types';
import { Search, ShoppingCart, User, ArrowRight, Save, Plus, Minus, X, ChevronLeft, MapPin, Clock, Edit, FileText, Wallet, CheckCircle, TrendingUp, Loader2, Hourglass, DollarSign, LogOut } from 'lucide-react';

type ViewMode = 'SELLER_SELECT' | 'CLIENT_LIST' | 'CLIENT_DETAIL' | 'PRODUCT_SELECT';
type ClientTab = 'ORDER' | 'COLLECTION';

export const MobileOrders: React.FC = () => {
  const { clients, products, sellers, createOrder, updateOrder, zones, orders, sales, reportCollection, collectionRecords, getBatchesForProduct } = useStore();
  
  // --- NAVIGATION STATE ---
  const [viewMode, setViewMode] = useState<ViewMode>('SELLER_SELECT');
  const [clientTab, setClientTab] = useState<ClientTab>('ORDER');
  
  // --- CONTEXT STATE ---
  const [currentSellerId, setCurrentSellerId] = useState('');
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  
  // --- FILTER STATE ---
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [listTab, setListTab] = useState<'CLIENTS' | 'HISTORY' | 'COLLECTIONS'>('CLIENTS');
  
  // --- ORDER FORM STATE ---
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [cart, setCart] = useState<OrderItem[]>([]);
  
  // --- PRODUCT SELECTOR STATE ---
  const [prodSearch, setProdSearch] = useState('');
  const [selectedProd, setSelectedProd] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<'UND' | 'PKG'>('UND');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');

  // --- MODALS STATE ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false); // New: Custom Exit Modal
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- DERIVED DATA ---
  const currentSeller = sellers.find(s => s.id === currentSellerId);
  const docType = (currentClient ? (currentClient.doc_number.length === 11 ? 'FACTURA' : 'BOLETA') : 'BOLETA') as 'FACTURA' | 'BOLETA';
  
  const categories = useMemo<string[]>(() => ['TODOS', ...Array.from(new Set(products.map(p => p.category))).sort() as string[]], [products]);

  // Collection Totals (Reported Today)
  const todaysCollections = useMemo(() => {
     if (!currentSellerId) return [];
     const today = new Date().toISOString().split('T')[0];
     return collectionRecords.filter(r => 
        r.seller_id === currentSellerId && 
        r.date_reported.startsWith(today)
     ).sort((a,b) => new Date(b.date_reported).getTime() - new Date(a.date_reported).getTime());
  }, [collectionRecords, currentSellerId]);

  const totalCollectedToday = todaysCollections.reduce((acc, m) => acc + m.amount_reported, 0);

  // Intelligent Client Filter
  const filteredClients = useMemo(() => {
     if (!currentSellerId) return [];
     
     // 1. Filter by Territory
     const sellerZoneIds = zones.filter(z => z.assigned_seller_id === currentSellerId).map(z => z.id);
     let baseClients = clients;
     if (sellerZoneIds.length > 0) {
        baseClients = clients.filter(c => sellerZoneIds.includes(c.zone_id));
     }

     // 2. Intelligent Search Filter
     if (!clientSearchTerm) return baseClients;
     
     const term = clientSearchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
     
     return baseClients.filter(c => {
        const name = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const code = c.code.toLowerCase();
        const doc = c.doc_number;
        const addr = c.address.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        return name.includes(term) || code.includes(term) || doc.includes(term) || addr.includes(term);
     });
  }, [clients, zones, currentSellerId, clientSearchTerm]);

  const filteredOrders = useMemo(() => {
     if (!currentSellerId) return [];
     return orders.filter(o => o.seller_id === currentSellerId).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, currentSellerId]);

  const filteredProducts = useMemo(() => {
     const term = prodSearch.toLowerCase();
     return products.filter(p => {
       const matchesSearch = p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
       const matchesCategory = selectedCategory === 'TODOS' || p.category === selectedCategory;
       return matchesSearch && matchesCategory;
     });
  }, [products, prodSearch, selectedCategory]);

  const pendingBills = useMemo(() => {
     if (!currentClient) return [];
     return sales
        .filter(s => (s.client_id === currentClient.id || s.client_ruc === currentClient.doc_number) 
                  && s.payment_method === 'CREDITO' 
                  && s.payment_status === 'PENDING'
                  && s.status !== 'canceled')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [sales, currentClient]);

  const cartTotal = cart.reduce((acc, item) => acc + item.total_price, 0);

  // --- HANDLERS ---

  const confirmExitApp = () => {
     // Force reset all state
     setCurrentSellerId('');
     setCurrentClient(null);
     setListTab('CLIENTS');
     setClientSearchTerm('');
     setProdSearch('');
     setCart([]);
     setEditingOrderId(null);
     setSelectedCategory('TODOS');
     setIsPaymentModalOpen(false);
     setIsExitModalOpen(false);
     
     // Redirect view
     setViewMode('SELLER_SELECT');
  };

  const handleSellerSelect = (id: string) => {
    if (!id) return;
    setCurrentSellerId(id);
    setViewMode('CLIENT_LIST');
    setListTab('CLIENTS');
  };

  const handleClientSelect = (client: Client) => {
    setEditingOrderId(null); 
    setCurrentClient(client);
    setPaymentMethod(client.payment_condition === 'CONTADO' ? 'CONTADO' : 'CREDITO');
    setCart([]);
    setClientTab('ORDER'); // Default to order
    setViewMode('CLIENT_DETAIL');
  };

  const handleEditOrder = (order: Order) => {
     if (order.status !== 'pending') { alert("Solo se pueden editar pedidos pendientes."); return; }
     const client = clients.find(c => c.id === order.client_id) || null;
     setCurrentClient(client);
     setPaymentMethod(order.payment_method);
     setCart(order.items);
     setEditingOrderId(order.id);
     setClientTab('ORDER');
     setViewMode('CLIENT_DETAIL');
  };

  const handleProductClick = (p: Product) => {
     setSelectedProd(p);
     setUnit('UND'); // Default to minimum unit
     setQty(1);
  };

  const handleAddProduct = () => {
    if (!selectedProd) return;
    
    // Check Stock
    const factor = unit === 'PKG' ? (selectedProd.package_content || 1) : 1;
    const required = qty * factor;
    const available = getBatchesForProduct(selectedProd.id).reduce((acc, b) => acc + b.quantity_current, 0);
    
    if (required > available) {
       alert(`Stock insuficiente. Disponible: ${available} unid. (Usted requiere ${required})`);
       return;
    }

    const price = unit === 'PKG' ? selectedProd.price_package : selectedProd.price_unit;
    
    const newItem: OrderItem = {
      product_id: selectedProd.id,
      product_name: selectedProd.name,
      unit_type: unit,
      quantity: qty,
      unit_price: price,
      total_price: price * qty
    };
    
    setCart([...cart, newItem]);
    setSelectedProd(null);
    setQty(1);
    setProdSearch('');
    setViewMode('CLIENT_DETAIL'); 
  };

  const handleSaveOrder = () => {
    if (!currentClient || !currentSellerId || cart.length === 0) return;
    
    const commonData = {
      seller_id: currentSellerId,
      client_id: currentClient.id,
      client_name: currentClient.name,
      client_doc_type: currentClient.doc_type,
      client_doc_number: currentClient.doc_number,
      suggested_document_type: docType,
      payment_method: paymentMethod,
      delivery_date: new Date().toISOString(),
      total: cartTotal,
      status: 'pending' as const,
      items: cart
    };

    if (editingOrderId) {
      updateOrder({ ...orders.find(o => o.id === editingOrderId)!, ...commonData });
      alert("Pedido ACTUALIZADO con éxito.");
    } else {
      createOrder({ id: crypto.randomUUID(), code: `PED-${Math.floor(Math.random() * 100000)}`, created_at: new Date().toISOString(), ...commonData });
      alert("Pedido guardado con éxito. Stock comprometido temporalmente.");
    }

    setViewMode('CLIENT_LIST'); 
    setListTab('HISTORY');
    setCart([]);
    setCurrentClient(null);
    setEditingOrderId(null);
  };

  const openPaymentModal = (sale: Sale) => {
     if (!currentSellerId) {
        alert("Error de sesión: No se ha detectado el vendedor activo. Reinicie la ruta.");
        return;
     }
     setSelectedSale(sale);
     setPaymentAmount(sale.balance !== undefined ? sale.balance : sale.total);
     setIsPaymentModalOpen(true);
  };

  const confirmPayment = async () => {
     if (!selectedSale || !currentSellerId) return;
     if (paymentAmount <= 0) { alert("El monto debe ser mayor a 0"); return; }
     
     const currentBalance = selectedSale.balance !== undefined ? selectedSale.balance : selectedSale.total;
     if (paymentAmount > currentBalance) { 
        alert("El monto no puede ser mayor al saldo pendiente."); 
        return; 
     }

     setIsProcessing(true);
     await new Promise(resolve => setTimeout(resolve, 800)); // Simulating network
     
     reportCollection(selectedSale.id, currentSellerId, paymentAmount);
     
     setIsProcessing(false);
     setIsPaymentModalOpen(false);
     setPaymentAmount(0);
     setSelectedSale(null);
  };

  // --- VIEWS ---

  if (viewMode === 'SELLER_SELECT') {
    return (
      <div className="h-full bg-slate-100 p-4 flex flex-col justify-center items-center">
         <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center border-t-4 border-blue-600">
            <User className="w-16 h-16 mx-auto text-blue-600 mb-4 bg-blue-50 p-3 rounded-full" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">App Fuerza de Ventas</h2>
            <p className="text-slate-500 mb-6 text-sm">Seleccione su perfil para iniciar la ruta del día.</p>
            <div className="space-y-3">
              <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vendedor Asignado</label>
              <select className="w-full p-4 border border-slate-300 rounded-lg text-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" onChange={(e) => handleSellerSelect(e.target.value)} value={currentSellerId}>
                 <option value="">-- Seleccionar --</option>
                 {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
         </div>
         <p className="mt-8 text-xs text-slate-400">TraceFlow Mobile v1.2</p>
      </div>
    );
  }

  if (viewMode === 'CLIENT_LIST') {
    return (
      <div className="h-full flex flex-col bg-slate-100 relative">
         {/* CUSTOM EXIT MODAL */}
         {isExitModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-fade-in">
               <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 text-center">
                  <LogOut className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-800 mb-2">¿Cerrar Sesión de Ruta?</h3>
                  <p className="text-slate-500 text-sm mb-6">Volverá a la pantalla de selección de vendedor.</p>
                  <div className="flex gap-3">
                     <button onClick={() => setIsExitModalOpen(false)} className="flex-1 py-3 border border-slate-300 rounded-lg font-bold text-slate-600">Cancelar</button>
                     <button onClick={confirmExitApp} className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold shadow-lg">Cerrar Sesión</button>
                  </div>
               </div>
            </div>
         )}

         <div className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
            <div className="flex justify-between items-center mb-4">
               <div>
                  <h2 className="text-lg font-bold">Ruta del Día</h2>
                  <p className="text-xs text-slate-400">{currentSeller?.name}</p>
               </div>
               <div className="flex flex-col items-end">
                  <span className="text-[10px] text-slate-400 uppercase">Mi Cobranza (Hoy)</span>
                  <span className="text-sm font-bold text-orange-400">S/ {totalCollectedToday.toFixed(2)}</span>
               </div>
               <button 
                  type="button"
                  onClick={() => setIsExitModalOpen(true)} 
                  className="bg-red-900/50 hover:bg-red-800 text-red-200 text-xs border border-red-800 px-3 py-1 rounded ml-3 flex items-center transition-colors shadow-sm"
               >
                  <LogOut className="w-3 h-3 mr-1" /> Salir
               </button>
            </div>
            
            <div className="flex bg-slate-800 rounded p-1 gap-1">
               <button onClick={() => setListTab('CLIENTS')} className={`flex-1 py-2 rounded text-sm font-bold flex items-center justify-center ${listTab === 'CLIENTS' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}>
                  <User className="w-4 h-4 mr-2" /> Clientes
               </button>
               <button onClick={() => setListTab('HISTORY')} className={`flex-1 py-2 rounded text-sm font-bold flex items-center justify-center ${listTab === 'HISTORY' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}>
                  <Clock className="w-4 h-4 mr-2" /> Pedidos
               </button>
               <button onClick={() => setListTab('COLLECTIONS')} className={`flex-1 py-2 rounded text-sm font-bold flex items-center justify-center ${listTab === 'COLLECTIONS' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  <Wallet className="w-4 h-4 mr-2" /> Cobros
               </button>
            </div>

            {listTab === 'CLIENTS' && (
               <div className="relative mt-3">
                  <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                  <input 
                     className="w-full pl-10 p-2 rounded-lg text-slate-900 font-bold outline-none text-sm" 
                     placeholder="Buscar Cliente, Código o RUC..." 
                     value={clientSearchTerm}
                     onChange={e => setClientSearchTerm(e.target.value)}
                  />
               </div>
            )}
         </div>

         <div className="flex-1 overflow-auto p-2 space-y-2">
            {listTab === 'CLIENTS' && (
               <>
                  {filteredClients.map(c => {
                     const debt = sales
                        .filter(s => (s.client_id === c.id || s.client_ruc === c.doc_number) 
                                  && s.payment_method === 'CREDITO' 
                                  && s.payment_status === 'PENDING'
                                  && s.status !== 'canceled'
                                  && s.collection_status !== 'REPORTED')
                        .reduce((sum, s) => sum + (s.balance !== undefined ? s.balance : s.total), 0);

                     return (
                       <div key={c.id} onClick={() => handleClientSelect(c)} className="bg-white p-4 rounded-lg shadow-sm active:bg-blue-50 cursor-pointer flex justify-between items-center border-l-4 border-transparent hover:border-accent">
                          <div className="flex-1">
                             <div className="flex justify-between">
                                <h3 className="font-bold text-slate-800">{c.name}</h3>
                                {debt > 0 && <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Deuda: S/ {debt.toFixed(0)}</span>}
                             </div>
                             <div className="text-sm text-slate-500 flex items-center mt-1">
                                <span className="font-mono text-xs bg-slate-100 px-1 rounded mr-2">{c.code}</span>
                                <MapPin className="w-3 h-3 mr-1" /> {c.address}
                             </div>
                          </div>
                          <ArrowRight className="text-slate-300 ml-2" />
                       </div>
                     );
                  })}
                  {filteredClients.length === 0 && <div className="p-8 text-center text-slate-400">No se encontraron clientes.</div>}
               </>
            )}

            {listTab === 'HISTORY' && (
               <>
                  {filteredOrders.map(o => (
                     <div key={o.id} className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-start">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs font-bold text-slate-500">{o.code}</span>
                              <span className={`text-[10px] px-2 rounded-full font-bold uppercase ${o.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                 {o.status === 'pending' ? 'Pendiente' : 'Procesado'}
                              </span>
                           </div>
                           <h3 className="font-bold text-slate-800 text-sm">{o.client_name}</h3>
                           <p className="text-xs text-slate-500 mt-1">{new Date(o.created_at).toLocaleTimeString()} - {o.items.length} Items</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                           <span className="font-bold text-slate-900">S/ {o.total.toFixed(2)}</span>
                           {o.status === 'pending' && (
                              <button onClick={() => handleEditOrder(o)} className="bg-blue-50 text-accent px-3 py-1 rounded-lg text-xs font-bold flex items-center">
                                 <Edit className="w-3 h-3 mr-1" /> Editar
                              </button>
                           )}
                        </div>
                     </div>
                  ))}
                  {filteredOrders.length === 0 && <div className="p-8 text-center text-slate-400">No has registrado pedidos hoy.</div>}
               </>
            )}

            {listTab === 'COLLECTIONS' && (
               <>
                  {todaysCollections.map(m => (
                     <div key={m.id} className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between border-l-4 border-orange-500">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${m.status === 'VALIDATED' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                 {m.status === 'VALIDATED' ? 'VALIDADO' : 'REPORTADO'}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">{new Date(m.date_reported).toLocaleTimeString()}</span>
                           </div>
                           <p className="font-bold text-slate-800 text-sm">{m.client_name}</p>
                           <p className="text-xs text-slate-500">{m.document_ref}</p>
                        </div>
                        <div className="text-right">
                           <span className="block text-lg font-bold text-slate-900">S/ {m.amount_reported.toFixed(2)}</span>
                        </div>
                     </div>
                  ))}
                  {todaysCollections.length === 0 && (
                     <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                        <Wallet className="w-12 h-12 mb-2 opacity-30" />
                        <p>No se han reportado cobros hoy.</p>
                     </div>
                  )}
               </>
            )}
         </div>
      </div>
    );
  }

  // ... (Rest of component remains unchanged)
  if (viewMode === 'CLIENT_DETAIL') {
     return (
       <div className="h-full flex flex-col bg-slate-100 relative">
          
          {/* PAYMENT MODAL */}
          {isPaymentModalOpen && selectedSale && (
             <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white w-full rounded-t-2xl p-6 shadow-2xl animate-slide-up">
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <h3 className="text-lg font-bold text-slate-800">Reportar Cobro</h3>
                         <p className="text-sm text-slate-500">{selectedSale.series}-{selectedSale.number}</p>
                      </div>
                      <button onClick={() => setIsPaymentModalOpen(false)} className="bg-slate-100 p-2 rounded-full"><X className="w-5 h-5 text-slate-500"/></button>
                   </div>
                   
                   <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                      <div className="flex justify-between items-center text-sm mb-2">
                         <span className="text-slate-600 font-bold">Total Documento:</span>
                         <span className="font-medium">S/ {selectedSale.total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-red-600 border-t border-slate-200 pt-2">
                         <span className="font-bold">Saldo Pendiente:</span>
                         <span className="font-bold text-lg">S/ {(selectedSale.balance !== undefined ? selectedSale.balance : selectedSale.total).toFixed(2)}</span>
                      </div>
                   </div>

                   <div className="mb-6">
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Monto a Cobrar</label>
                      <div className="relative">
                         <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
                         <input 
                           type="number" 
                           autoFocus
                           className="w-full pl-12 pr-4 py-4 text-3xl font-bold text-slate-800 border-2 border-slate-300 rounded-xl focus:border-green-500 focus:ring-0 outline-none"
                           value={paymentAmount}
                           onChange={e => setPaymentAmount(Number(e.target.value))}
                         />
                      </div>
                   </div>

                   <button 
                      onClick={confirmPayment}
                      disabled={isProcessing}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center disabled:opacity-50"
                   >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin"/> : 'CONFIRMAR COBRO'}
                   </button>
                </div>
             </div>
          )}

          {/* Header */}
          <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
             <div className="flex justify-between items-start mb-2">
                <div>
                   <h2 className="font-bold text-lg text-slate-900 leading-tight">{currentClient?.name}</h2>
                   <div className="text-xs text-slate-500">{currentClient?.doc_type}: {currentClient?.doc_number}</div>
                </div>
                <button onClick={() => setViewMode('CLIENT_LIST')} className="bg-slate-100 p-2 rounded-full text-slate-600"><X className="w-4 h-4" /></button>
             </div>
             
             {/* Tabs */}
             <div className="flex gap-2 mt-4 border-b border-slate-200">
                <button onClick={() => setClientTab('ORDER')} className={`flex-1 py-2 text-sm font-bold border-b-2 ${clientTab === 'ORDER' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
                   <ShoppingCart className="w-4 h-4 inline mr-1" /> Pedido
                </button>
                <button onClick={() => setClientTab('COLLECTION')} className={`flex-1 py-2 text-sm font-bold border-b-2 ${clientTab === 'COLLECTION' ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-400'}`}>
                   <Wallet className="w-4 h-4 inline mr-1" /> Cobranzas ({pendingBills.filter(s => s.collection_status !== 'REPORTED').length})
                </button>
             </div>
          </div>

          {clientTab === 'ORDER' && (
             <>
                <div className="flex gap-2 px-4 py-2 bg-white border-b border-slate-100">
                   <div className={`px-3 py-1 rounded-lg text-xs font-bold border ${editingOrderId ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                      {docType}
                   </div>
                   <select className="bg-yellow-50 text-yellow-800 px-2 py-1 rounded-lg text-xs font-bold border border-yellow-100 outline-none" value={paymentMethod} onChange={(e: any) => setPaymentMethod(e.target.value)}>
                      <option value="CONTADO">CONTADO</option>
                      <option value="CREDITO">CREDITO</option>
                   </select>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-3 pb-32">
                   {cart.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                         <ShoppingCart className="w-12 h-12 mb-2 opacity-50" />
                         <p>Carrito vacío</p>
                         <button onClick={() => setViewMode('PRODUCT_SELECT')} className="mt-4 text-accent font-bold">Agregar Productos</button>
                      </div>
                   ) : (
                      cart.map((item, idx) => {
                         const productInfo = products.find(p => p.id === item.product_id);
                         let unitLabel = item.unit_type === 'PKG' && productInfo ? `${productInfo.package_type || 'CAJA'}*${productInfo.package_content}` : item.unit_type;
                         return (
                            <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
                               <div>
                                  <div className="font-medium text-sm text-slate-800">{item.product_name}</div>
                                  <div className="text-xs text-slate-500 font-bold mt-1">
                                     {item.quantity} {unitLabel} <span className="text-slate-400 px-1">|</span> S/ {item.unit_price.toFixed(2)}
                                  </div>
                               </div>
                               <div className="flex items-center gap-3">
                                  <span className="font-bold text-slate-900">S/ {item.total_price.toFixed(2)}</span>
                                  <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-400"><X className="w-4 h-4" /></button>
                               </div>
                            </div>
                         );
                      })
                   )}
                   
                   <button onClick={() => setViewMode('PRODUCT_SELECT')} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-bold flex items-center justify-center gap-2 hover:bg-slate-50">
                      <Plus className="w-5 h-5" /> Agregar Item
                   </button>
                </div>

                <div className="bg-white border-t border-slate-200 p-4 sticky bottom-0 safe-area-bottom">
                   <div className="flex justify-between items-end mb-4">
                      <span className="text-slate-500 font-medium">Total Pedido</span>
                      <span className="text-2xl font-bold text-slate-900">S/ {cartTotal.toFixed(2)}</span>
                   </div>
                   <button onClick={handleSaveOrder} disabled={cart.length === 0} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2">
                      <Save className="w-5 h-5" /> {editingOrderId ? 'ACTUALIZAR' : 'GUARDAR'}
                   </button>
                </div>
             </>
          )}

          {clientTab === 'COLLECTION' && (
             <div className="flex-1 overflow-auto p-4 space-y-3 bg-slate-100">
                {pendingBills.filter(s => s.collection_status !== 'REPORTED').length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center">
                      <CheckCircle className="w-16 h-16 mb-4 text-green-200" />
                      <p>Este cliente no tiene<br/>deudas pendientes.</p>
                   </div>
                ) : (
                   pendingBills
                     .filter(s => s.collection_status !== 'REPORTED') // Hide fully collected
                     .map(bill => {
                      const isPartial = bill.collection_status === 'PARTIAL';
                      const currentBalance = bill.balance !== undefined ? bill.balance : bill.total;
                      
                      return (
                         <div key={bill.id} className={`bg-white p-4 rounded-xl shadow-sm border-l-4 flex flex-col gap-2 ${isPartial ? 'border-orange-400' : 'border-red-500'}`}>
                            <div className="flex justify-between items-start">
                               <div>
                                  <div className="text-xs text-slate-500 font-bold uppercase">{bill.document_type}</div>
                                  <div className="font-mono font-bold text-slate-800 text-lg">{bill.series}-{bill.number}</div>
                                  <div className="text-xs text-slate-400">{new Date(bill.created_at).toLocaleDateString()}</div>
                               </div>
                               <div className="text-right">
                                  <div className="text-sm font-bold text-slate-400 line-through">Total: S/ {bill.total.toFixed(2)}</div>
                                  <div className="text-xl font-bold text-red-600">Saldo: S/ {currentBalance.toFixed(2)}</div>
                               </div>
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex justify-end">
                               <button 
                                  onClick={() => openPaymentModal(bill)}
                                  className="px-4 py-2 rounded-lg font-bold text-sm shadow flex items-center transition-all bg-green-600 text-white hover:bg-green-700 active:scale-95"
                               >
                                  <Wallet className="w-4 h-4 mr-2" /> REPORTAR COBRO
                               </button>
                            </div>
                         </div>
                      );
                   })
                )}
             </div>
          )}
       </div>
     );
  }

  if (viewMode === 'PRODUCT_SELECT') {
     return (
       <div className="h-full flex flex-col bg-white">
          <div className="p-4 border-b border-slate-200 flex flex-col gap-2 sticky top-0 bg-white z-10">
             <div className="flex items-center gap-2">
               <button onClick={() => setViewMode('CLIENT_DETAIL')}><ChevronLeft className="w-6 h-6 text-slate-600" /></button>
               <div className="flex-1 relative">
                  <input 
                    autoFocus
                    className="w-full bg-slate-100 p-2 pl-8 rounded-lg uppercase placeholder:normal-case" 
                    placeholder="Buscar producto o SKU..." 
                    value={prodSearch}
                    onChange={e => setProdSearch(e.target.value)}
                  />
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
               </div>
             </div>
             
             {/* CATEGORY TABS (Scrollable) */}
             <div className="overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
                <div className="flex space-x-2">
                   {categories.map(cat => (
                      <button 
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedCategory === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
                      >
                         {cat}
                      </button>
                   ))}
                </div>
             </div>
          </div>
          
          <div className="flex-1 overflow-auto">
             {selectedProd ? (
                <div className="p-6 flex flex-col items-center animate-fade-in-up">
                   <div className="w-full text-left mb-4">
                      <h3 className="text-xl font-bold text-slate-800 leading-tight">{selectedProd.name}</h3>
                      <div className="flex justify-between items-center mt-1">
                         <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">{selectedProd.sku}</span>
                         <span className="text-xs text-green-600 font-bold">
                            Stock Disponible: {getBatchesForProduct(selectedProd.id).reduce((acc, b) => acc + b.quantity_current, 0)}
                         </span>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-6 mb-8">
                      <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold">-</button>
                      <span className="text-4xl font-bold text-slate-800">{qty}</span>
                      <button onClick={() => setQty(qty + 1)} className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold">+</button>
                   </div>

                   <div className="flex gap-2 bg-slate-100 p-1 rounded-lg mb-8 w-full">
                      <button onClick={() => setUnit('UND')} className={`flex-1 py-3 rounded-md font-bold transition-all text-sm ${unit === 'UND' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
                        UNIDAD <br/><span className="text-xs font-normal">S/ {selectedProd.price_unit.toFixed(2)}</span>
                      </button>
                      <button onClick={() => setUnit('PKG')} className={`flex-1 py-3 rounded-md font-bold transition-all text-sm ${unit === 'PKG' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
                        {selectedProd.package_type || 'CAJA'} <br/><span className="text-xs font-normal">S/ {selectedProd.price_package.toFixed(2)}</span>
                      </button>
                   </div>

                   <div className="w-full space-y-3">
                      <button onClick={handleAddProduct} className="w-full bg-accent text-white py-4 rounded-xl font-bold text-lg shadow-lg">
                         Agregar S/ {(qty * (unit === 'PKG' ? selectedProd.price_package : selectedProd.price_unit)).toFixed(2)}
                      </button>
                      <button onClick={() => setSelectedProd(null)} className="w-full text-slate-500 py-3 font-medium">Cancelar</button>
                   </div>
                </div>
             ) : (
                <div className="divide-y divide-slate-100">
                   {filteredProducts.map(p => {
                      const stock = getBatchesForProduct(p.id).reduce((acc, b) => acc + b.quantity_current, 0);
                      return (
                         <div key={p.id} onClick={() => handleProductClick(p)} className="p-4 active:bg-slate-50 flex justify-between items-center cursor-pointer">
                            <div className="flex-1 pr-2">
                               <div className="font-medium text-slate-800 text-sm leading-tight">{p.name}</div>
                               <div className="text-xs text-slate-500 mt-1 flex gap-2">
                                  <span className="font-mono bg-slate-50 px-1 rounded">{p.sku}</span>
                                  <span>{stock} Und. Disp</span>
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="font-bold text-slate-900 text-sm">S/ {p.price_unit.toFixed(2)}</div>
                               <Plus className="text-accent bg-blue-50 p-1 rounded-full w-6 h-6 ml-auto mt-1" />
                            </div>
                         </div>
                      );
                   })}
                   {filteredProducts.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">No se encontraron productos.</div>}
                </div>
             )}
          </div>
       </div>
     );
  }

  return <div>Estado Desconocido</div>;
};
