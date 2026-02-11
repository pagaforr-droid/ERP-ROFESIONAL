
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Product, Combo } from '../types';
import { Search, ShoppingCart, Menu, X, Plus, Minus, Tag, Package, LogOut, FileText, User, ShieldCheck } from 'lucide-react';

interface CartItem {
  id: string; // ProductID or ComboID
  type: 'PRODUCT' | 'COMBO';
  name: string;
  quantity: number;
  unit: 'UND' | 'PKG' | 'COMBO';
  price: number;
  image?: string;
}

export const VirtualStore: React.FC = () => {
  const { products, promotions, combos, currentUser, clients, createOrder, logout } = useStore();
  
  // --- STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  // --- CLIENT CONTEXT ---
  const client = clients.find(c => c.id === currentUser?.client_id);
  const isAdminView = !client; // If no client linked, assume admin preview
  
  // Safe Access for admins who don't have a linked client
  const docType = (client?.doc_number?.length || 0) === 11 ? 'FACTURA' : 'BOLETA';

  // --- HELPERS ---
  const getProductPrice = (product: Product, unit: 'UND' | 'PKG') => {
    // Base Price (Directly from Store State - Confirmed)
    let price = unit === 'PKG' ? product.price_package : product.price_unit;
    
    // Check Promos
    const activePromo = promotions.find(p => 
      p.is_active && 
      p.product_ids.includes(product.id) && 
      new Date() >= new Date(p.start_date) && 
      new Date() <= new Date(p.end_date)
    );

    if (activePromo) {
      if (activePromo.type === 'PERCENTAGE_DISCOUNT') {
        price = price * (1 - activePromo.value / 100);
      } else if (activePromo.type === 'FIXED_PRICE' && unit === 'UND') {
        price = activePromo.value; // Only applies to units usually
      }
    }
    return price;
  };

  const categories = useMemo<string[]>(() => ['ALL', ...Array.from(new Set(products.map(p => p.category))) as string[]], [products]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    
    // Products (Pulling from store.products)
    const prods = products.filter(p => 
      (selectedCategory === 'ALL' || p.category === selectedCategory) &&
      (p.name.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term)) &&
      p.allow_sell // Only sellable items
    ).map(p => ({ ...p, itemType: 'PRODUCT' as const }));

    // Combos
    const cmbs = combos.filter(c => 
      c.is_active && 
      (selectedCategory === 'ALL') &&
      c.name.toLowerCase().includes(term)
    ).map(c => ({ ...c, itemType: 'COMBO' as const }));

    return [...cmbs, ...prods];
  }, [products, combos, searchTerm, selectedCategory]);

  // --- HANDLERS ---
  const addToCart = (item: Product | Combo, type: 'PRODUCT' | 'COMBO', unit: 'UND' | 'PKG' = 'UND') => {
    const existing = cart.find(x => x.id === item.id && x.unit === unit);
    const price = type === 'PRODUCT' ? getProductPrice(item as Product, unit) : (item as Combo).price;
    const name = item.name;
    const image = (item as any).image_url;

    if (existing) {
      setCart(cart.map(x => x.id === item.id && x.unit === unit ? { ...x, quantity: x.quantity + 1 } : x));
    } else {
      setCart([...cart, {
        id: item.id,
        type,
        name,
        quantity: 1,
        unit: type === 'COMBO' ? 'COMBO' : unit,
        price,
        image
      }]);
    }
    setIsCartOpen(true);
  };

  const updateQty = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  };

  const handleCheckout = () => {
    if (isAdminView) {
       alert("MODO ADMINISTRADOR: No tiene un cliente asignado para realizar el pedido real. Esta es solo una vista previa de funcionamiento.");
       return;
    }
    if (!client) return; 
    if (cart.length === 0) return;

    // Convert Cart to OrderItems
    const orderItems = cart.map(cItem => {
       return {
          product_id: cItem.id,
          product_name: cItem.type === 'COMBO' ? `COMBO: ${cItem.name}` : cItem.name,
          unit_type: cItem.unit,
          quantity: cItem.quantity,
          unit_price: cItem.price,
          total_price: cItem.price * cItem.quantity,
          is_promo: cItem.type === 'COMBO'
       };
    });

    const total = orderItems.reduce((acc, i) => acc + i.total_price, 0);

    createOrder({
       id: crypto.randomUUID(),
       code: `WEB-${Math.floor(Math.random()*100000)}`,
       seller_id: 'WEB', // System seller
       client_id: client.id,
       client_name: client.name,
       client_doc_type: client.doc_type,
       client_doc_number: client.doc_number,
       suggested_document_type: docType,
       payment_method: 'CONTADO', 
       delivery_date: new Date().toISOString(),
       created_at: new Date().toISOString(),
       total,
       status: 'pending',
       items: orderItems as any
    });

    alert("¡Pedido realizado con éxito! Nuestro equipo lo procesará en breve.");
    setCart([]);
    setIsCartOpen(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 font-sans">
      
      {/* --- ADMIN BANNER --- */}
      {isAdminView && (
         <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center text-xs font-bold shadow-md z-30">
            <div className="flex items-center">
               <ShieldCheck className="w-4 h-4 mr-2 text-green-400" />
               VISTA DE ADMINISTRADOR - Visualizando precios base del sistema
            </div>
            <div className="bg-slate-700 px-2 py-0.5 rounded">
               Stock y Precios sincronizados con PriceManager
            </div>
         </div>
      )}

      {/* --- HEADER --- */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
               {/* Logo Area */}
               <div className="bg-blue-600 p-1.5 rounded-lg">
                  <Package className="h-6 w-6 text-white" />
               </div>
               <span className="font-bold text-xl text-slate-800 hidden sm:block">Mi Tienda</span>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-lg mx-4">
               <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <input 
                     className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                     placeholder="Buscar productos, marcas..."
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
               <div className="text-right hidden md:block">
                  <div className="text-xs text-slate-500">Bienvenido,</div>
                  <div className="font-bold text-sm text-slate-800 truncate max-w-[150px]">
                     {client?.name || <span className="text-orange-600 italic">ADMINISTRADOR</span>}
                  </div>
               </div>
               <button 
                  className="relative p-2 text-slate-600 hover:text-blue-600 transition-colors"
                  onClick={() => setIsCartOpen(true)}
               >
                  <ShoppingCart className="h-6 w-6" />
                  {cart.length > 0 && (
                     <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs font-bold flex items-center justify-center rounded-full">
                        {cart.length}
                     </span>
                  )}
               </button>
               {currentUser?.role === 'CLIENT' && (
                  <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500" title="Cerrar Sesión">
                     <LogOut className="h-5 w-5" />
                  </button>
               )}
            </div>
          </div>
        </div>
        
        {/* Category Nav */}
        <div className="border-t border-slate-100 bg-white">
           <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
              <div className="flex space-x-8 h-10 items-center">
                 {categories.map(cat => (
                    <button 
                       key={cat}
                       onClick={() => setSelectedCategory(cat)}
                       className={`text-sm font-medium whitespace-nowrap border-b-2 h-full px-1 ${selectedCategory === cat ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                       {cat === 'ALL' ? 'Todo' : cat}
                    </button>
                 ))}
              </div>
           </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
         <div className="max-w-7xl mx-auto">
            
            {/* Banner Promos */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white flex flex-col justify-center shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                     <span className="bg-white/20 text-xs font-bold px-2 py-1 rounded uppercase mb-2 inline-block">Oferta Especial</span>
                     <h2 className="text-2xl font-bold mb-1">Combos Fiesteros</h2>
                     <p className="text-purple-100 text-sm mb-4">Ahorra hasta 20% en packs seleccionados</p>
                     <button onClick={() => { setSearchTerm(''); setSelectedCategory('ALL'); }} className="bg-white text-purple-700 px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-purple-50 w-fit">Ver Combos</button>
                  </div>
                  <Package className="absolute right-[-20px] bottom-[-20px] w-40 h-40 text-white/10 rotate-12" />
               </div>
               <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-6 text-white flex flex-col justify-center shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                     <span className="bg-white/20 text-xs font-bold px-2 py-1 rounded uppercase mb-2 inline-block">Liquidación</span>
                     <h2 className="text-2xl font-bold mb-1">Descuentos por Caja</h2>
                     <p className="text-rose-100 text-sm mb-4">Mejores precios para tu negocio</p>
                  </div>
                  <Tag className="absolute right-[-10px] bottom-[-10px] w-36 h-36 text-white/10" />
               </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
               {filteredItems.map((item: any) => {
                  const isCombo = item.itemType === 'COMBO';
                  const unitPrice = !isCombo ? getProductPrice(item, 'UND') : item.price;
                  const pkgPrice = !isCombo ? getProductPrice(item, 'PKG') : 0;
                  
                  return (
                     <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                        <div className="aspect-square bg-slate-100 relative overflow-hidden group">
                           {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                           ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                 {isCombo ? <Package className="w-16 h-16"/> : <Tag className="w-16 h-16"/>}
                              </div>
                           )}
                           {isCombo && <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded shadow">COMBO</div>}
                           {!isCombo && item.price_unit > unitPrice && <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow">OFERTA</div>}
                        </div>
                        
                        <div className="p-4 flex-1 flex flex-col">
                           <div className="text-xs text-slate-500 mb-1 font-bold">{isCombo ? 'Pack Promocional' : item.brand}</div>
                           <h3 className="font-bold text-slate-800 leading-tight mb-2 line-clamp-2">{item.name}</h3>
                           
                           <div className="mt-auto space-y-2">
                              {isCombo ? (
                                 <div className="flex justify-between items-center">
                                    <span className="text-xl font-bold text-purple-700">S/ {unitPrice.toFixed(2)}</span>
                                    <button onClick={() => addToCart(item, 'COMBO')} className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800"><Plus className="w-5 h-5"/></button>
                                 </div>
                              ) : (
                                 <>
                                    <div className="flex justify-between items-center border border-slate-100 rounded-lg p-2 bg-slate-50">
                                       <div>
                                          <span className="text-xs text-slate-500 block">Unidad</span>
                                          <span className="font-bold text-slate-900">S/ {unitPrice.toFixed(2)}</span>
                                       </div>
                                       <button onClick={() => addToCart(item, 'PRODUCT', 'UND')} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded"><Plus className="w-4 h-4"/></button>
                                    </div>
                                    {item.package_type && (
                                       <div className="flex justify-between items-center border border-slate-100 rounded-lg p-2">
                                          <div>
                                             <span className="text-xs text-slate-500 block">{item.package_type} x{item.package_content}</span>
                                             <span className="font-bold text-slate-900">S/ {pkgPrice.toFixed(2)}</span>
                                          </div>
                                          <button onClick={() => addToCart(item, 'PRODUCT', 'PKG')} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Plus className="w-4 h-4"/></button>
                                       </div>
                                    )}
                                 </>
                              )}
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>
      </main>

      {/* --- CART DRAWER --- */}
      {isCartOpen && (
         <div className="fixed inset-0 z-50 flex justify-end">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
            <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-fade-in-right">
               <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <h2 className="font-bold text-lg flex items-center"><ShoppingCart className="w-5 h-5 mr-2"/> Tu Pedido</h2>
                  <button onClick={() => setIsCartOpen(false)}><X className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {cart.map((item, idx) => (
                     <div key={`${item.id}-${item.unit}`} className="flex gap-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden">
                           {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Tag/></div>}
                        </div>
                        <div className="flex-1">
                           <h4 className="font-bold text-sm text-slate-800 line-clamp-2">{item.name}</h4>
                           <div className="text-xs text-slate-500 mb-2">{item.unit} | S/ {item.price.toFixed(2)}</div>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 bg-slate-100 rounded-lg p-1">
                                 <button onClick={() => updateQty(idx, -1)} className="p-1 hover:bg-white rounded shadow-sm"><Minus className="w-3 h-3"/></button>
                                 <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                 <button onClick={() => updateQty(idx, 1)} className="p-1 hover:bg-white rounded shadow-sm"><Plus className="w-3 h-3"/></button>
                              </div>
                              <span className="font-bold text-slate-900">S/ {(item.price * item.quantity).toFixed(2)}</span>
                           </div>
                        </div>
                     </div>
                  ))}
                  {cart.length === 0 && <div className="text-center text-slate-400 py-10">Tu carrito está vacío.</div>}
               </div>

               <div className="p-4 border-t border-slate-200 bg-slate-50">
                  {client ? (
                     <div className="mb-4 bg-blue-50 p-3 rounded border border-blue-100 text-sm text-blue-800">
                        <div className="font-bold flex items-center"><User className="w-3 h-3 mr-1"/> Datos Facturación</div>
                        <p>{client.doc_type}: {client.doc_number}</p>
                        <p className="text-xs mt-1">Se emitirá: <strong>{docType}</strong></p>
                     </div>
                  ) : (
                     <div className="mb-4 text-orange-600 bg-orange-50 p-2 rounded text-xs font-bold border border-orange-200">
                        * Vista Administrador: No se puede facturar sin cliente.
                     </div>
                  )}
                  
                  <div className="flex justify-between items-center mb-4">
                     <span className="text-slate-600 font-bold">Total a Pagar</span>
                     <span className="text-2xl font-bold text-slate-900">S/ {cart.reduce((a,b) => a + (b.price*b.quantity), 0).toFixed(2)}</span>
                  </div>
                  <button 
                     onClick={handleCheckout}
                     disabled={cart.length === 0}
                     className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all"
                  >
                     Confirmar Pedido
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
