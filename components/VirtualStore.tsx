
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Product, Combo } from '../types';
import { Search, ShoppingCart, Package, X, Plus, Minus, Tag, Filter, User, ShieldCheck, Heart, Info, LogOut } from 'lucide-react';
import { calculatePromotions, isPromoActive } from '../utils/promotions';

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
   const { products, promotions, combos, currentUser, clients, createOrder, logout, batches, autoPromotions } = useStore();

   // --- STATE ---
   const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'COMBOS' | 'OFFERS'>('PRODUCTS');
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedCategory, setSelectedCategory] = useState('ALL');
   const [isCartOpen, setIsCartOpen] = useState(false);
   const [cart, setCart] = useState<any[]>([]); // Using any to be compatible with OrderItem temporarily in this view
   const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
   const [checkoutData, setCheckoutData] = useState({
      phone: '',
      docType: 'BOLETA',
      address: '',
      notes: ''
   });

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

   const getComboStock = (comboId: string) => {
      const combo = combos.find(c => c.id === comboId);
      if (!combo) return 0;
      let minPossible = Infinity;
      combo.items.forEach(cItem => {
         const prod = products.find(p => p.id === cItem.product_id);
         if (!prod) { minPossible = 0; return; }
         const factor = cItem.unit_type === 'PKG' ? (prod.package_content || 1) : 1;
         const requiredPerCombo = cItem.quantity * factor;
         if (requiredPerCombo <= 0) return;
         const currentProdStock = getProductStock(prod.id);
         const possible = Math.floor(currentProdStock / requiredPerCombo);
         if (possible < minPossible) minPossible = possible;
      });
      return minPossible === Infinity ? 0 : minPossible;
   };

   const getProductPrice = (product: Product, unit: 'UND' | 'PKG') => {
      let price = unit === 'PKG' ? product.price_package : product.price_unit;
      const activePromo = promotions.find(p =>
         p.product_ids.includes(product.id) && isPromoActive(p.start_date, p.end_date, p.is_active)
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
         p.product_ids.includes(productId) && isPromoActive(p.start_date, p.end_date, p.is_active)
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
         isPromoActive(c.start_date, c.end_date, c.is_active) &&
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
      const existing = cart.find(x => x.product_id === item.id && x.unit_type === unit);
      const price = type === 'PRODUCT' ? getProductPrice(item as Product, unit) : (item as Combo).price;
      const name = item.name;
      const image = (item as any).image_url;
      const stock = type === 'PRODUCT' ? getProductStock(item.id) : getComboStock(item.id);
      
      const factor = type === 'PRODUCT' ? (unit === 'PKG' ? ((item as Product).package_content || 1) : 1) : 1;
      const requiredStock = qty * factor;

      let newCart = [...cart];
      if (existing) {
         const newQty = existing.quantity + qty;
         const newRequired = newQty * factor;
         if (newRequired > stock) {
             alert(`Stock insuficiente. Disponible: ${stock}`);
             return;
         }
         newCart = newCart.map(x => x.product_id === item.id && x.unit_type === unit ? { ...x, quantity: newQty, total_price: price * newQty } : x);
      } else {
         if (requiredStock > stock) {
             alert(`Stock insuficiente. Disponible: ${stock}`);
             return;
         }
         newCart.push({
            product_id: item.id, type, product_name: name, quantity: qty, unit_type: type === 'COMBO' ? 'COMBO' : unit, unit_price: price, total_price: price * qty, image, maxStock: stock, is_promo: type === 'COMBO' && false // COMBO is not an auto promo
         });
      }

      setCart(calculatePromotions(newCart, autoPromotions, products));
      setIsCartOpen(true);
   };

   const updateQty = (index: number, delta: number) => {
      let newCart = [...cart];
      newCart[index].quantity += delta;
      newCart[index].total_price = newCart[index].unit_price * newCart[index].quantity;
      if (newCart[index].quantity <= 0) {
         newCart.splice(index, 1);
      }
      setCart(calculatePromotions(newCart, autoPromotions, products));
   };

   const handleCheckoutLaunch = () => {
      if (isAdminView) {
         alert("MODO ADMIN: No se puede generar pedido real sin cliente.");
         return;
      }
      if (!client || cart.length === 0) return;

      setCheckoutData({
         phone: '',
         docType: (client.doc_number?.length || 0) === 11 ? 'FACTURA' : 'BOLETA',
         address: client.address || '',
         notes: ''
      });
      setIsCheckoutModalOpen(true);
   };

   const confirmCheckout = () => {
      if (!checkoutData.phone.trim()) {
         alert("El número de teléfono/celular es obligatorio.");
         return;
      }

      const orderItems = cart.map((cItem: any) => ({
         product_id: cItem.product_id,
         product_name: cItem.type === 'COMBO' ? `COMBO: ${cItem.product_name}` : cItem.product_name,
         unit_type: cItem.unit_type,
         quantity: cItem.quantity,
         unit_price: cItem.unit_price,
         total_price: cItem.total_price,
         is_promo: cItem.is_promo || cItem.type === 'COMBO'
      }));

      const total = orderItems.reduce((acc, i) => acc + i.total_price, 0);
      const combinedNotes = `Teléfono: ${checkoutData.phone}\n${checkoutData.notes ? 'Notas: ' + checkoutData.notes : ''}`;

      createOrder({
         id: crypto.randomUUID(),
         code: `WEB-${Math.floor(Math.random() * 100000)}`,
         seller_id: 'WEB',
         client_id: client!.id,
         client_name: client!.name,
         client_doc_type: client!.doc_type,
         client_doc_number: client!.doc_number,
         suggested_document_type: checkoutData.docType as any,
         payment_method: 'CONTADO',
         delivery_date: new Date().toISOString(),
         created_at: new Date().toISOString(),
         total,
         status: 'pending',
         observation: combinedNotes,
         delivery_address: checkoutData.address,
         items: orderItems as any
      });

      alert("¡Pedido enviado correctamente! Nos comunicaremos contigo en breve.");
      setCart([]);
      setIsCheckoutModalOpen(false);
      setIsCartOpen(false);
   };

   // --- SUB-COMPONENTS ---
   const ProductCard: React.FC<{ item: Product & { itemType: 'PRODUCT' } }> = ({ item }) => {
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

   const ComboCard: React.FC<{ item: Combo & { itemType: 'COMBO' } }> = ({ item }) => {
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

                  <div className="flex items-center gap-1 md:gap-4">
                     <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-slate-600 hover:text-blue-600 transition-colors">
                        <ShoppingCart className="h-6 w-6" />
                        {cart.length > 0 && (
                           <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full animate-bounce">
                              {cart.length}
                           </span>
                        )}
                     </button>

                     <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

                     <div className="flex items-center gap-2">
                        {!isAdminView && (
                           <div className="hidden md:flex flex-col items-end mr-2">
                              <span className="text-xs font-bold text-slate-800">{currentUser?.name}</span>
                              <span className="text-[10px] text-slate-500">{client?.doc_number}</span>
                           </div>
                        )}
                        <button
                           onClick={logout}
                           className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors text-sm font-bold shadow-sm"
                           title="Cerrar Sesión"
                        >
                           <LogOut className="w-4 h-4" />
                           <span className="hidden md:inline">Salir</span>
                        </button>
                     </div>
                  </div>
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
                     {cart.map((item, idx) => {
                        if (item.is_promo) {
                           return (
                              <div key={`${item.product_id}-${item.unit_type}-${idx}`} className="bg-green-50 p-3 rounded-xl shadow-sm border border-green-200 flex gap-3 animate-fade-in-up">
                                 <div className="w-16 h-16 bg-green-100 rounded-lg flex-shrink-0 flex items-center justify-center text-green-500">
                                    <Tag className="w-8 h-8" />
                                 </div>
                                 <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                       <div className="flex items-center">
                                          <div className="bg-green-200 text-green-800 text-[10px] px-1.5 py-0.5 rounded mr-2 font-bold uppercase">Premio</div>
                                          <h4 className="font-bold text-sm text-green-900 line-clamp-1">{item.product_name}</h4>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-4">
                                       <span className="text-sm font-bold w-6 tabular-nums text-green-800">{item.quantity}</span>
                                       <span className="text-[10px] font-bold bg-green-200 text-green-800 px-1.5 py-0.5 rounded uppercase">{item.unit_type === 'PKG' ? 'Caja' : item.unit_type}</span>
                                       <span className="font-bold text-green-700 text-sm italic ml-auto">¡GRATIS!</span>
                                    </div>
                                 </div>
                              </div>
                           );
                        }

                        return (
                           <div key={`${item.product_id}-${item.unit_type}`} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex gap-3">
                              <div className="w-16 h-16 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden relative">
                                 {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Tag /></div>}
                              </div>
                              <div className="flex-1">
                                 <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{item.product_name}</h4>
                                    <button onClick={() => {
                                       const newCart = [...cart]; newCart.splice(idx, 1); setCart(calculatePromotions(newCart, autoPromotions, products));
                                    }}><X className="w-4 h-4 text-slate-300 hover:text-red-500" /></button>
                                 </div>
                                 <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{item.unit_type === 'PKG' ? 'Caja' : item.unit_type}</span>
                                    <span className="text-xs text-slate-400">S/ {item.unit_price.toFixed(2)} c/u</span>
                                 </div>

                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                       <button onClick={() => updateQty(idx, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded shadow-sm text-slate-600"><Minus className="w-3 h-3" /></button>
                                       <span className="text-sm font-bold w-6 text-center tabular-nums">{item.quantity}</span>
                                       <button onClick={() => updateQty(idx, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded shadow-sm text-slate-600"><Plus className="w-3 h-3" /></button>
                                    </div>
                                    <span className="font-bold text-slate-900 text-sm">S/ {item.total_price.toFixed(2)}</span>
                                 </div>
                              </div>
                           </div>
                        )
                     })}
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
                           <span className="text-2xl font-bold text-slate-900">S/ {cart.reduce((a, b) => a + b.total_price, 0).toFixed(2)}</span>
                        </div>
                        <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-full">{cart.reduce((a, b) => a + b.quantity, 0)} items</span>
                     </div>
                     <button
                        onClick={handleCheckoutLaunch}
                        disabled={cart.length === 0}
                        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
                     >
                        Confirmar Pedido <span className="text-blue-300">→</span>
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* --- CHECKOUT CONFIRMATION MODAL --- */}
         {isCheckoutModalOpen && !isAdminView && client && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
               <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsCheckoutModalOpen(false)}></div>
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col animate-scale-up overflow-hidden">
                  <div className="bg-blue-600 p-6 text-white text-center">
                     <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-90" />
                     <h2 className="text-2xl font-black tracking-tight">Casi Listo</h2>
                     <p className="text-blue-100 text-sm mt-1">Confirma tus datos para finalizar el pedido</p>
                  </div>

                  <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[60vh]">

                     {/* Client Info Readonly */}
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                           <User className="w-5 h-5" />
                        </div>
                        <div>
                           <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Cliente</div>
                           <div className="font-bold text-slate-800 leading-none mb-1">{client.name}</div>
                           <div className="text-sm text-slate-500">{client.doc_type}: {client.doc_number}</div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Doc Type Selection */}
                        <div className="col-span-1">
                           <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Comprobante</label>
                           <select
                              value={checkoutData.docType}
                              onChange={e => setCheckoutData({ ...checkoutData, docType: e.target.value })}
                              className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-slate-50 text-slate-800 font-medium py-2 px-3"
                           >
                              <option value="BOLETA">Boleta de Venta</option>
                              {(client.doc_number?.length === 11) && <option value="FACTURA">Factura Electrónica</option>}
                           </select>
                           {client.doc_number?.length !== 11 && (
                              <p className="text-[10px] text-slate-400 mt-1 italic">* Factura solo disponible con RUC válido 11 dígitos.</p>
                           )}
                        </div>

                        {/* Phone Number */}
                        <div className="col-span-1">
                           <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Celular / Teléfono <span className="text-red-500">*</span></label>
                           <input
                              type="tel"
                              value={checkoutData.phone}
                              onChange={e => setCheckoutData({ ...checkoutData, phone: e.target.value })}
                              placeholder="Ej: 987654321"
                              className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-slate-50 text-slate-800 font-medium py-2 px-3"
                              autoFocus
                           />
                        </div>
                     </div>

                     {/* Delivery Address */}
                     <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Dirección de Envío</label>
                        <input
                           type="text"
                           value={checkoutData.address}
                           onChange={e => setCheckoutData({ ...checkoutData, address: e.target.value })}
                           placeholder="Ingresa la dirección detallada"
                           className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-slate-50 text-slate-800 py-2 px-3"
                        />
                     </div>

                     {/* Notes */}
                     <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Notas u Observaciones (Opcional)</label>
                        <textarea
                           value={checkoutData.notes}
                           onChange={e => setCheckoutData({ ...checkoutData, notes: e.target.value })}
                           placeholder="Referencia de llegada, horario disponible, etc."
                           className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-slate-50 text-slate-800 py-2 px-3 resize-none h-20"
                        ></textarea>
                     </div>

                  </div>

                  <div className="bg-slate-50 border-t border-slate-100 p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                     <div className="w-full md:w-auto text-center md:text-left">
                        <span className="text-xs text-slate-500 font-bold block">TOTAL A PAGAR</span>
                        <span className="text-3xl font-black text-blue-600 leading-none">
                           S/ {cart.reduce((a, b) => a + b.total_price, 0).toFixed(2)}
                        </span>
                     </div>
                     <div className="flex w-full md:w-auto gap-3">
                        <button
                           onClick={() => setIsCheckoutModalOpen(false)}
                           className="flex-1 md:flex-none px-6 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                        >
                           Volver
                        </button>
                        <button
                           onClick={confirmCheckout}
                           className="flex-1 md:flex-none px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center"
                        >
                           ¡Enviar Pedido!
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
