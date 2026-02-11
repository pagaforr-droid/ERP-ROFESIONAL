
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Product, Combo } from '../types';
import { Search, ShoppingCart, Package, X, Plus, Minus, Tag, Filter, User, ShieldCheck, Heart, Info } from 'lucide-react';

interface CartItem {
   id: string;
   type: 'PRODUCT' | 'COMBO';
   name: string;
   quantity: number;
   unit: 'UND' | 'PKG' | 'COMBO';
   price: number;
   image?: string;
   maxStock?: number;
}

export const VirtualStore: React.FC = () => {
   const { products, promotions, combos, currentUser, clients, createOrder, logout, batches } = useStore();

   // --- STATE ---
   const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'COMBOS' | 'OFFERS'>('PRODUCTS');
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedCategory, setSelectedCategory] = useState('ALL');
   const [isCartOpen, setIsCartOpen] = useState(false);
   const [cart, setCart] = useState<CartItem[]>([]);

   // --- CLIENT CONTEXT ---
   const client = clients.find(c => c.id === currentUser?.client_id);
   const isAdminView = !client;
   const docType = (client?.doc_number?.length || 0) === 11 ? 'FACTURA' : 'BOLETA';

   // --- HELPERS ---
   const getProductStock = (productId: string) => {
      return batches
         .filter(b => b.product_id === productId && new Date(b.expiration_date) > new Date())
         .reduce((sum, b) => sum + b.quantity_current, 0);
   };

   const getProductPrice = (product: Product, unit: 'UND' | 'PKG') => {
      let price = unit === 'PKG' ? product.price_package : product.price_unit;
      const activePromo = promotions.find(p =>
         p.is_active && p.product_ids.includes(product.id) &&
         new Date() >= new Date(p.start_date) && new Date() <= new Date(p.end_date)
      );

      if (activePromo) {
         if (activePromo.type === 'PERCENTAGE_DISCOUNT') {
            price = price * (1 - activePromo.value / 100);
         } else if (activePromo.type === 'FIXED_PRICE' && unit === 'UND') {
            price = activePromo.value;
         }
      }
      return price;
   };

   const getActivePromo = (productId: string) => {
      return promotions.find(p =>
         p.is_active && p.product_ids.includes(productId) &&
         new Date() >= new Date(p.start_date) && new Date() <= new Date(p.end_date)
      );
   };

   const categories = useMemo<string[]>(() => ['ALL', ...Array.from(new Set(products.map(p => p.category))) as string[]], [products]);

   const filteredItems = useMemo(() => {
      const term = searchTerm.toLowerCase();

      // 1. Filter Products
      const prods = products.filter(p =>
         (selectedCategory === 'ALL' || p.category === selectedCategory) &&
         (p.name.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term)) &&
         p.allow_sell
      );

      // 2. Filter Combos
      const cmbs = combos.filter(c =>
         c.is_active &&
         (selectedCategory === 'ALL') &&
         c.name.toLowerCase().includes(term)
      );

      // 3. Return based on Active Tab
      if (activeTab === 'COMBOS') {
         return cmbs.map(c => ({ ...c, itemType: 'COMBO' as const }));
      }

      if (activeTab === 'OFFERS') {
         // Products with promos OR Combos (usually offers)
         const promotedProds = prods.filter(p => getActivePromo(p.id));
         return [
            ...cmbs.map(c => ({ ...c, itemType: 'COMBO' as const })),
            ...promotedProds.map(p => ({ ...p, itemType: 'PRODUCT' as const }))
         ];
      }

      // Default: Products
      return prods.map(p => ({ ...p, itemType: 'PRODUCT' as const }));

   }, [products, combos, searchTerm, selectedCategory, activeTab]);

   // --- HANDLERS ---
   const addToCart = (item: Product | Combo, type: 'PRODUCT' | 'COMBO', unit: 'UND' | 'PKG' = 'UND', qty: number = 1) => {
      const existing = cart.find(x => x.id === item.id && x.unit === unit);
      const price = type === 'PRODUCT' ? getProductPrice(item as Product, unit) : (item as Combo).price;
      const name = item.name;
      const image = (item as any).image_url;
      // Stock logic would be clearer if real, for now just basic check or unlimited for Combos
      const stock = type === 'PRODUCT' ? getProductStock(item.id) : 999;

      if (existing) {
         const newQty = existing.quantity + qty;
         // if (newQty > stock) return alert("Stock insuficiente"); // Optional: Strict check
         setCart(cart.map(x => x.id === item.id && x.unit === unit ? { ...x, quantity: newQty } : x));
      } else {
         // if (qty > stock) return alert("Stock insuficiente");
         setCart([...cart, {
            id: item.id, type, name, quantity: qty, unit: type === 'COMBO' ? 'COMBO' : unit, price, image, maxStock: stock
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
         alert("MODO ADMIN: No se puede generar pedido real sin cliente.");
         return;
      }
      if (!client || cart.length === 0) return;

      const orderItems = cart.map(cItem => ({
         product_id: cItem.id,
         product_name: cItem.type === 'COMBO' ? `COMBO: ${cItem.name}` : cItem.name,
         unit_type: cItem.unit,
         quantity: cItem.quantity,
         unit_price: cItem.price,
         total_price: cItem.price * cItem.quantity,
         is_promo: cItem.type === 'COMBO'
      }));

      const total = orderItems.reduce((acc, i) => acc + i.total_price, 0);

      createOrder({
         id: crypto.randomUUID(),
         code: `WEB-${Math.floor(Math.random() * 100000)}`,
         seller_id: 'WEB',
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

      alert("¡Pedido enviado correctamente!");
      setCart([]);
      setIsCartOpen(false);
   };

   // --- SUB-COMPONENTS ---
   const ProductCard = ({ item }: { item: Product & { itemType: 'PRODUCT' } }) => {
      const [unit, setUnit] = useState<'UND' | 'PKG'>('UND');
      const [qty, setQty] = useState(1);

      const promo = getActivePromo(item.id);
      const price = getProductPrice(item, unit);
      const originalPrice = unit === 'PKG' ? item.price_package : item.price_unit;
      const hasDiscount = price < originalPrice;
      const stock = getProductStock(item.id);

      return (
         <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all flex flex-col items-stretch group h-full">
            <div className="relative aspect-square bg-slate-100 overflow-hidden">
               {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
               ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                     <Package className="w-16 h-16 opacity-50" />
                  </div>
               )}
               {hasDiscount && (
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-pulse">
                     OFERTA
                  </span>
               )}
               <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">
                  Stock: {stock}
               </div>
            </div>

            <div className="p-4 flex-1 flex flex-col">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{item.brand}</div>
               <h3 className="font-bold text-slate-800 text-sm leading-tight mb-2 line-clamp-2 min-h-[2.5em]">{item.name}</h3>

               <div className="mt-auto pt-4 border-t border-slate-50">
                  {/* Unit Selector */}
                  {item.package_type && (
                     <div className="flex bg-slate-100 rounded-lg p-1 mb-3">
                        <button onClick={() => setUnit('UND')} className={`flex-1 text-[10px] font-bold py-1 rounded ${unit === 'UND' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                           UNIDAD
                        </button>
                        <button onClick={() => setUnit('PKG')} className={`flex-1 text-[10px] font-bold py-1 rounded ${unit === 'PKG' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                           {item.package_type || 'CAJA'}
                        </button>
                     </div>
                  )}

                  {/* Price & Action */}
                  <div className="flex justify-between items-end">
                     <div>
                        {hasDiscount && <div className="text-xs text-slate-400 line-through">S/ {originalPrice.toFixed(2)}</div>}
                        <div className="text-xl font-bold text-slate-900">S/ {price.toFixed(2)}</div>
                     </div>

                     <button
                        onClick={() => addToCart(item, 'PRODUCT', unit, 1)}
                        disabled={stock <= 0}
                        className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        <Plus className="w-5 h-5" />
                     </button>
                  </div>
               </div>
            </div>
         </div>
      );
   };

   const ComboCard = ({ item }: { item: Combo & { itemType: 'COMBO' } }) => {
      return (
         <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden hover:shadow-md transition-all flex flex-col group h-full relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
            <div className="relative aspect-video bg-purple-50 overflow-hidden">
               {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
               ) : (
                  <div className="w-full h-full flex items-center justify-center text-purple-200">
                     <Tag className="w-16 h-16 opacity-50" />
                  </div>
               )}
               <div className="absolute bottom-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                  PACK
               </div>
            </div>

            <div className="p-4 flex-1 flex flex-col">
               <h3 className="font-bold text-slate-800 text-base mb-1">{item.name}</h3>
               <p className="text-xs text-slate-500 mb-4 line-clamp-2 flex-1">{item.description}</p>

               <div className="flex justify-between items-end">
                  <div className="text-2xl font-bold text-purple-700">S/ {item.price.toFixed(2)}</div>
                  <button onClick={() => addToCart(item, 'COMBO', 'UND', 1)} className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 active:scale-95 transition-all shadow-md shadow-purple-100">
                     <Plus className="w-5 h-5" />
                  </button>
               </div>
            </div>
         </div>
      );
   };

   return (
      <div className="h-full flex flex-col bg-slate-50 font-sans">

         {/* --- ADMIN BANNER --- */}
         {isAdminView && (
            <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center text-xs font-bold shadow-md z-30 sticky top-0">
               <div className="flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-2 text-green-400" />
                  VISTA DE ADMINISTRADOR
               </div>
               <div className="bg-slate-700 px-2 py-0.5 rounded">Precio Base</div>
            </div>
         )}

         {/* --- HEADER --- */}
         <header className="bg-white shadow-sm z-20 relative">
            <div className="max-w-7xl mx-auto px-4">
               <div className="flex justify-between items-center h-16">
                  <div className="flex items-center gap-3">
                     <div className="bg-blue-600 p-2 rounded-lg text-white transform rotate-3">
                        <Package className="h-5 w-5" />
                     </div>
                     <div>
                        <h1 className="font-bold text-lg text-slate-800 leading-none">Mi Tienda</h1>
                        <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Virtual</span>
                     </div>
                  </div>

                  {/* Global Search */}
                  <div className="flex-1 max-w-lg mx-6 hidden md:block">
                     <div className="relative group">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                           className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                           placeholder="Buscar en catálogo..."
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                        />
                     </div>
                  </div>

                  <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-slate-600 hover:text-blue-600 transition-colors">
                     <ShoppingCart className="h-6 w-6" />
                     {cart.length > 0 && (
                        <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full animate-bounce">
                           {cart.length}
                        </span>
                     )}
                  </button>
               </div>

               {/* Create Tabs Navigation */}
               <div className="flex space-x-6 mt-2 border-b border-slate-100 overflow-x-auto hide-scrollbar">
                  <button onClick={() => setActiveTab('PRODUCTS')} className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap px-2 ${activeTab === 'PRODUCTS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                     PRODUCTOS
                  </button>
                  <button onClick={() => setActiveTab('COMBOS')} className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap px-2 ${activeTab === 'COMBOS' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                     COMBOS Y PACKS
                  </button>
                  <button onClick={() => setActiveTab('OFFERS')} className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap px-2 ${activeTab === 'OFFERS' ? 'border-pink-500 text-pink-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                     OFERTAS
                  </button>
               </div>
            </div>
         </header>

         {/* --- MAIN CONTENT --- */}
         <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
            <div className="max-w-7xl mx-auto">

               {/* Filters Row */}
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  {/* Categories */}
                  <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-2 md:pb-0 hide-scrollbar">
                     <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                        <Filter className="w-4 h-4 text-slate-400 ml-2 mr-1" />
                        {categories.map(cat => (
                           <button
                              key={cat} onClick={() => setSelectedCategory(cat)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                           >
                              {cat === 'ALL' ? 'Todos' : cat}
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Mobile Search */}
                  <div className="w-full md:hidden">
                     <input
                        className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                        placeholder="Buscar en catálogo..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                     />
                  </div>
               </div>

               {/* Grid Results */}
               {filteredItems.length === 0 ? (
                  <div className="text-center py-20 opacity-50">
                     <Search className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                     <p className="text-xl font-bold text-slate-400">No encontramos resultados</p>
                     <p className="text-sm text-slate-400">Intenta con otra búsqueda o categoría</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                     {filteredItems.map((item: any) => (
                        item.itemType === 'COMBO'
                           ? <ComboCard key={item.id} item={item} />
                           : <ProductCard key={item.id} item={item} />
                     ))}
                  </div>
               )}
            </div>
         </main>

         {/* --- CART DRAWER --- */}
         {isCartOpen && (
            <div className="fixed inset-0 z-50 flex justify-end">
               <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)}></div>
               <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-slide-in-right">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                     <h2 className="font-bold text-lg flex items-center text-slate-800"><ShoppingCart className="w-5 h-5 mr-2 text-blue-600" /> Tu Carrito</h2>
                     <button onClick={() => setIsCartOpen(false)} className="bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                     {cart.map((item, idx) => (
                        <div key={`${item.id}-${item.unit}`} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex gap-3">
                           <div className="w-16 h-16 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden relative">
                              {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Tag /></div>}
                           </div>
                           <div className="flex-1">
                              <div className="flex justify-between items-start mb-1">
                                 <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{item.name}</h4>
                                 <button onClick={() => {
                                    const newCart = [...cart]; newCart.splice(idx, 1); setCart(newCart);
                                 }}><X className="w-4 h-4 text-slate-300 hover:text-red-500" /></button>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                 <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{item.unit === 'PKG' ? 'Caja' : item.unit}</span>
                                 <span className="text-xs text-slate-400">S/ {item.price.toFixed(2)} c/u</span>
                              </div>

                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                    <button onClick={() => updateQty(idx, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded shadow-sm text-slate-600"><Minus className="w-3 h-3" /></button>
                                    <span className="text-sm font-bold w-6 text-center tabular-nums">{item.quantity}</span>
                                    <button onClick={() => updateQty(idx, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded shadow-sm text-slate-600"><Plus className="w-3 h-3" /></button>
                                 </div>
                                 <span className="font-bold text-slate-900 text-sm">S/ {(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                           </div>
                        </div>
                     ))}
                     {cart.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                           <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
                           <p className="font-bold">Tu carrito está vacío</p>
                           <p className="text-xs">¡Agrega productos para comenzar!</p>
                        </div>
                     )}
                  </div>

                  <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                     <div className="flex justify-between items-center mb-4">
                        <div>
                           <span className="text-xs text-slate-400 font-bold block">TOTAL A PAGAR</span>
                           <span className="text-2xl font-bold text-slate-900">S/ {cart.reduce((a, b) => a + (b.price * b.quantity), 0).toFixed(2)}</span>
                        </div>
                        <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-full">{cart.reduce((a, b) => a + b.quantity, 0)} items</span>
                     </div>
                     <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
                     >
                        Confirmar Pedido <span className="text-blue-300">→</span>
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
