import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Product, Client, Order, AutoPromotion, Promotion, Batch } from '../types';
import { Search, Plus, Trash2, Printer, Save, X, ChevronDown, RefreshCw, FilePlus, Zap, MapPin, Loader2, AlertTriangle, ShieldCheck, CheckCircle2, HelpCircle } from 'lucide-react';
import { supabase } from '../services/supabase';

// Interfaz para los items del carrito
interface CartItem {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_type: string;
  unit_price: number;
  discount_percent: number;
  total_price: number;
  is_bonus: boolean;
  auto_promo_id?: string;
  promo_name?: string;
  product_ref: Product;
}

export const AdvancedOrderEntry: React.FC = () => {
  const { users, currentUser } = useStore();

  // --- REFS ---
  const productInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // --- MAESTROS ---
  const [dbCompany, setDbCompany] = useState<any>(null);
  const [dbSellers, setDbSellers] = useState<any[]>([]);
  const [dbPriceLists, setDbPriceLists] = useState<any[]>([]);
  const [dbAutoPromos, setDbAutoPromos] = useState<AutoPromotion[]>([]);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  
  // --- ESTADO CABECERA (PEDIDO) ---
  const [docType] = useState('PEDIDO'); // Fijo
  const [series, setSeries] = useState('PE01');
  const [docNumber, setDocNumber] = useState('Cargando...');
  const [currency, setCurrency] = useState('SOLES');
  const [sellerId, setSellerId] = useState('');

  // --- ESTADO CLIENTE ---
  const [clientSearch, setClientSearch] = useState('');
  const [searchedClients, setSearchedClients] = useState<Client[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  const [clientName, setClientName] = useState('');
  const [clientDoc, setClientDoc] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [priceListId, setPriceListId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CONTADO');
  const [showBranchSelector, setShowBranchSelector] = useState(false);

  // --- ESTADO INGRESO PRODUCTO ---
  const [productSearch, setProductSearch] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<(Product & { current_stock: number })[]>([]);
  const [isSearchingProd, setIsSearchingProd] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [entryQty, setEntryQty] = useState<number>(1);
  const [entryUnit, setEntryUnit] = useState('UND');
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [entryDiscount, setEntryDiscount] = useState<number>(0);
  const [entryBonus, setEntryBonus] = useState(false);

  // --- CARRITO ---
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // --- UI STATES ---
  const [isSaving, setIsSaving] = useState(false);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState({ isOpen: false, action: () => {}, targetName: '' });
  const [adminPwd, setAdminPwd] = useState('');

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [compRes, sellRes, plRes, apRes, prodRes, serRes] = await Promise.all([
          supabase.from('company_config').select('*').limit(1).maybeSingle(),
          supabase.from('sellers').select('*').order('name'),
          supabase.from('price_lists').select('*').order('name'),
          supabase.from('auto_promotions').select('*').eq('is_active', true),
          supabase.from('products').select('*').eq('is_active', true),
          supabase.from('document_series').select('*').eq('type', 'PEDIDO').eq('is_active', true).limit(1).maybeSingle()
        ]);
        
        if (compRes.data) setDbCompany(compRes.data);
        if (sellRes.data) setDbSellers(sellRes.data);
        if (plRes.data) setDbPriceLists(plRes.data);
        if (apRes.data) setDbAutoPromos(apRes.data);
        if (prodRes.data) setDbProducts(prodRes.data as Product[]);
        if (serRes.data) {
          setSeries(serRes.data.series);
          setDocNumber(String(serRes.data.current_number + 1).padStart(8, '0'));
        }
      } catch (e) {
        console.error("Error inicializando maestros:", e);
      }
    };
    fetchMasters();
  }, []);

  // ==========================================
  // BUSCADORES
  // ==========================================
  useEffect(() => {
    if (clientSearch.length < 3) { setSearchedClients([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingClient(true);
      const { data } = await supabase.from('clients').select('*').or(`name.ilike.%${clientSearch}%,doc_number.ilike.%${clientSearch}%`).limit(10);
      if (data) setSearchedClients(data as Client[]);
      setIsSearchingClient(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  useEffect(() => {
    if (productSearch.length < 2) { setSearchedProducts([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingProd(true);
      try {
        const { data: pData } = await supabase.from('products').select('*').or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`).eq('is_active', true).limit(10);
        if (pData && pData.length > 0) {
          const pIds = pData.map(p => p.id);
          const { data: bData } = await supabase.from('batches').select('product_id, quantity_current').in('product_id', pIds).gt('quantity_current', 0);
          
          const enriched = pData.map(p => {
            const stock = (bData || []).filter(b => b.product_id === p.id).reduce((sum, b) => sum + Number(b.quantity_current), 0);
            return { ...p, current_stock: stock };
          });
          setSearchedProducts(enriched);
        } else {
          setSearchedProducts([]);
        }
      } catch (error) { console.error(error); } finally { setIsSearchingProd(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // ==========================================
  // HANDLERS DE SELECCIÓN
  // ==========================================
  const handleSelectClient = (c: Client) => {
    setSelectedClient(c);
    setClientName(c.name);
    setClientDoc(c.doc_number);
    setClientAddress(c.address);
    setPriceListId(c.price_list_id || '');
    setPaymentMethod(c.payment_condition?.toUpperCase().includes('CREDIT') ? 'CREDITO' : 'CONTADO');
    setClientSearch('');
    setSearchedClients([]);
    
    // Autoasignar vendedor de su zona si existe
    if (c.zone_id) {
       // Buscar en DB local si tuvieras zones cargadas, o dejarlo manual.
    }
  };

  const getMultiplier = (listId: string) => {
    if (!listId) return 1;
    const list = dbPriceLists.find(pl => pl.id === listId);
    return list ? Number(list.multiplier || list.factor || 1) : 1;
  };

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setProductSearch(p.name);
    setSearchedProducts([]);
    
    setEntryUnit(p.unit_type || 'UND');
    setEntryQty(1);
    
    const multiplier = getMultiplier(priceListId);
    setEntryPrice(Number(p.price_unit || 0) * multiplier);
    setEntryDiscount(0);
    setEntryBonus(false);

    setTimeout(() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); }, 50);
  };

  // ==========================================
  // MOTOR DE PROMOCIONES
  // ==========================================
  const applyPromotions = (currentCart: CartItem[], listId: string) => {
    // 1. Limpiar regalos actuales para recalcular
    let cleanCart = currentCart.filter(item => !item.auto_promo_id);

    // 2. Filtrar Promos que apliquen a esta lista
    const validPromos = dbAutoPromos.filter(ap => {
      if (ap.target_price_list_ids && ap.target_price_list_ids.length > 0 && listId) {
        if (!ap.target_price_list_ids.includes('ALL') && !ap.target_price_list_ids.includes(listId)) return false;
      }
      return true;
    });

    // 3. Evaluar
    validPromos.forEach(ap => {
      let applies = false;
      let multiplier = 0;

      if (ap.condition_type === 'BUY_X_PRODUCT') {
        const qtyBought = cleanCart
          .filter(i => (ap.condition_product_ids?.includes(i.product_id) || i.product_id === ap.condition_product_id) && !i.is_bonus)
          .reduce((sum, i) => sum + i.quantity, 0);

        if (qtyBought >= ap.condition_amount) {
          applies = true;
          multiplier = Math.floor(qtyBought / ap.condition_amount);
        }
      }

      if (applies && multiplier > 0) {
        const rewardProd = dbProducts.find(p => p.id === ap.reward_product_id);
        if (rewardProd) {
          cleanCart.push({
            id: crypto.randomUUID(),
            product_id: rewardProd.id,
            sku: rewardProd.sku,
            name: rewardProd.name,
            quantity: ap.reward_quantity * multiplier,
            unit_type: ap.reward_unit_type || 'UND',
            unit_price: 0,
            discount_percent: 100,
            total_price: 0,
            is_bonus: true,
            auto_promo_id: ap.id,
            promo_name: ap.name,
            product_ref: rewardProd
          });
        }
      }
    });

    setCart(cleanCart);
  };

  // ==========================================
  // LÓGICA DE CARRITO
  // ==========================================
  const executeAddToCart = () => {
    if (!selectedProduct) return;
    
    const gross = entryQty * entryPrice;
    const finalPrice = gross - (gross * (entryDiscount / 100));

    const newItem: CartItem = {
      id: crypto.randomUUID(),
      product_id: selectedProduct.id,
      sku: selectedProduct.sku,
      name: selectedProduct.name,
      quantity: entryQty,
      unit_type: entryUnit,
      unit_price: entryPrice,
      discount_percent: entryDiscount,
      total_price: entryBonus ? 0 : finalPrice,
      is_bonus: entryBonus,
      product_ref: selectedProduct
    };

    let tempCart = [...cart];
    const existingIdx = tempCart.findIndex(i => i.product_id === newItem.product_id && !i.is_bonus && !i.auto_promo_id);
    
    if (existingIdx >= 0) {
      tempCart[existingIdx].quantity += entryQty;
      const tGross = tempCart[existingIdx].quantity * tempCart[existingIdx].unit_price;
      tempCart[existingIdx].total_price = tGross - (tGross * (tempCart[existingIdx].discount_percent / 100));
    } else {
      tempCart.push(newItem);
    }

    applyPromotions(tempCart, priceListId);

    // Reset Form
    setSelectedProduct(null);
    setProductSearch('');
    setEntryQty(1);
    setEntryPrice(0);
    setEntryDiscount(0);
    setEntryBonus(false);
    setTimeout(() => productInputRef.current?.focus(), 50);
  };

  const handleUpdateCartPrices = () => {
    const multiplier = getMultiplier(priceListId);
    let tempCart = cart.map(item => {
      if (item.is_bonus || item.auto_promo_id) return item;
      const baseP = Number(item.product_ref?.price_unit || 0);
      const newP = baseP * multiplier;
      const tGross = item.quantity * newP;
      return {
        ...item,
        unit_price: newP,
        total_price: tGross - (tGross * (item.discount_percent / 100))
      };
    });
    applyPromotions(tempCart, priceListId);
  };

  const handleCartQtyChange = (id: string, newQty: number) => {
    if (isNaN(newQty) || newQty <= 0) return;
    let tempCart = cart.map(item => {
      if (item.id === id) {
        const tGross = newQty * item.unit_price;
        return { ...item, quantity: newQty, total_price: tGross - (tGross * (item.discount_percent / 100)) };
      }
      return item;
    });
    applyPromotions(tempCart, priceListId);
  };

  // ==========================================
  // CÁLCULOS FINALES
  // ==========================================
  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0) / 1.18;
  const igv = cart.reduce((sum, item) => sum + item.total_price, 0) - subtotal;
  const total = cart.reduce((sum, item) => sum + item.total_price, 0);

  // ==========================================
  // ADMINISTRADOR AUTH
  // ==========================================
  const verifyAdmin = () => {
    const admin = users.find(u => u.role === 'ADMIN' && u.password === adminPwd);
    if (admin) {
      showAdminAuthModal.action();
      setShowAdminAuthModal({ isOpen: false, action: () => {}, targetName: '' });
      setAdminPwd('');
    } else {
      alert("Contraseña incorrecta.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 p-4 font-sans text-xs">
      
      {/* CABECERA AL ESTILO DE LA IMAGEN */}
      <div className="bg-white p-3 rounded shadow-sm border border-slate-200 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
            <span className="font-bold text-slate-700">Tipo</span>
            <select className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900" disabled>
              <option>PEDIDO</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
            <span className="font-bold text-slate-700">Serie y Correlativo</span>
            <select className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900" value={series} onChange={e => setSeries(e.target.value)}>
              {dbSeries.length > 0 ? dbSeries.map(s => <option key={s.id} value={s.series}>{s.series}</option>) : <option>{series}</option>}
            </select>
            <input className="w-24 text-center bg-transparent font-bold text-slate-900" value={docNumber} readOnly />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
            <span className="font-bold text-slate-700">Moneda</span>
            <select className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900" value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="SOLES">SOLES</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
            <span className="font-bold text-slate-700">Vendedor</span>
            <select className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900 w-40" value={sellerId} onChange={e => setSellerId(e.target.value)}>
              <option value="">-- Sin Vendedor --</option>
              {dbSellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => window.location.reload()} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded font-bold shadow-sm flex items-center">
            <FilePlus className="w-4 h-4 mr-2" /> Nuevo (F2)
          </button>
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded font-bold shadow-sm flex items-center">
            <Search className="w-4 h-4 mr-2" /> Buscar Pedido (F3)
          </button>
        </div>
      </div>

      {/* SECCIÓN CLIENTE */}
      <div className="bg-white p-3 rounded shadow-sm border border-slate-200 mb-2">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-3 relative">
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Cod / Buscar</label>
            <div className="relative">
              <Search className="absolute left-2 top-1.5 w-4 h-4 text-slate-400" />
              <input 
                className="w-full pl-8 pr-2 py-1 border border-slate-300 rounded text-sm font-medium focus:ring-1 focus:ring-blue-500 outline-none" 
                placeholder="RUC o Nombre..." 
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
              />
              {searchedClients.length > 0 && clientSearch && (
                <div className="absolute top-full left-0 w-[400px] bg-white border border-slate-300 shadow-xl rounded z-50 mt-1">
                  {searchedClients.map(c => (
                    <div key={c.id} onMouseDown={() => handleSelectClient(c)} className="p-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100">
                      <div className="font-bold text-slate-800">{c.name}</div>
                      <div className="text-[10px] text-slate-500">{c.doc_number}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="col-span-4">
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Razón Social</label>
            <input className="w-full py-1 px-2 border border-slate-300 rounded text-sm font-bold text-slate-800 bg-slate-50" value={clientName} onChange={e => setClientName(e.target.value)} />
          </div>
          
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 mb-1">RUC/DNI</label>
            <input className="w-full py-1 px-2 border border-slate-300 rounded text-sm font-mono font-bold text-slate-800 bg-slate-50" value={clientDoc} onChange={e => setClientDoc(e.target.value)} />
          </div>
          
          <div className="col-span-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Lista Precio</label>
                <select className="w-full py-1 px-2 border border-slate-300 rounded text-sm font-bold text-slate-800" value={priceListId} onChange={e => setPriceListId(e.target.value)}>
                  <option value="">-- General --</option>
                  {dbPriceLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Forma Pago</label>
                <div className="flex gap-1">
                  <button onClick={handleUpdateCartPrices} className="bg-blue-100 text-blue-700 px-2 rounded hover:bg-blue-200" title="Actualizar precios del carrito">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <select className="w-full py-1 px-2 border border-slate-300 rounded text-sm font-bold text-slate-800" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="CONTADO">CONTADO</option>
                    <option value="CREDITO">CRÉDITO</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">Dirección de Entrega</label>
          <div className="flex relative">
            <input className="flex-1 py-1 px-2 border border-slate-300 rounded text-sm text-slate-700 bg-slate-50" value={clientAddress} onChange={e => setClientAddress(e.target.value)} />
            {selectedClient?.branches && selectedClient.branches.length > 0 && (
              <button onClick={() => setShowBranchSelector(!showBranchSelector)} className="absolute right-0 h-full px-3 border-l border-slate-300 text-blue-600 hover:bg-blue-50 flex items-center">
                <MapPin className="w-4 h-4 mr-1" /><ChevronDown className="w-3 h-3" />
              </button>
            )}
            {showBranchSelector && (
              <div className="absolute top-full right-0 w-[400px] bg-white border border-slate-300 shadow-xl rounded mt-1 z-50 overflow-hidden">
                <div className="bg-slate-100 p-2 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">Seleccionar Sucursal</div>
                <div className="max-h-48 overflow-y-auto">
                  {[selectedClient.address, ...selectedClient.branches].map((addr, i) => (
                    <div key={i} onClick={() => { setClientAddress(addr); setShowBranchSelector(false); }} className="p-2 border-b border-slate-100 hover:bg-blue-50 cursor-pointer flex gap-2 text-sm text-slate-700">
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                      <span className={clientAddress === addr ? 'font-bold text-blue-800' : ''}>{addr}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ENTRADA DE PRODUCTOS */}
      <div className="bg-white border border-slate-300 shadow-sm flex flex-col flex-1 rounded-t-lg overflow-hidden">
        
        {/* Barra de Búsqueda de Productos */}
        <div className="bg-blue-50 border-b border-blue-200 p-2 flex gap-2 items-end">
          <div className="flex-1 relative">
            <label className="block text-[10px] font-bold text-blue-800 mb-1">Producto (Búsqueda en Nube)</label>
            <div className="relative">
              <Search className="absolute left-2 top-2 w-4 h-4 text-blue-400" />
              <input 
                ref={productInputRef}
                className="w-full pl-8 pr-2 py-1.5 border border-blue-300 rounded text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                placeholder="PISTOLEAR O ESCRIBIR..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
              {searchedProducts.length > 0 && productSearch && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow-2xl rounded mt-1 z-50 max-h-60 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-xs font-bold text-slate-600">
                      <tr><th className="p-2">Código</th><th className="p-2">Producto</th><th className="p-2 text-right">Precio</th><th className="p-2 text-right text-blue-600">Stock</th></tr>
                    </thead>
                    <tbody>
                      {searchedProducts.map(p => (
                        <tr key={p.id} onMouseDown={() => handleSelectProduct(p)} className="hover:bg-blue-50 cursor-pointer text-sm border-b border-slate-50">
                          <td className="p-2 font-mono font-bold text-blue-800">{p.sku}</td>
                          <td className="p-2 text-slate-800">{p.name}</td>
                          <td className="p-2 text-right text-slate-600">S/ {Number(p.price_unit).toFixed(2)}</td>
                          <td className="p-2 text-right font-black text-slate-800">{p.current_stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="w-20">
            <label className="block text-[10px] font-bold text-blue-800 mb-1 text-center">Cant.</label>
            <input ref={qtyInputRef} type="number" min="1" className="w-full py-1.5 px-2 border border-blue-300 rounded text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={entryQty} onChange={e => setEntryQty(Number(e.target.value))} />
          </div>

          <div className="w-24">
            <label className="block text-[10px] font-bold text-blue-800 mb-1 text-center">Unidad</label>
            <select className="w-full py-1.5 px-2 border border-blue-300 rounded text-sm font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={entryUnit} onChange={e => setEntryUnit(e.target.value)}>
              <option value="UND">UND</option>
              {selectedProduct?.package_type && <option value="PKG">{selectedProduct.package_type}</option>}
            </select>
          </div>

          <div className="w-24">
            <label className="block text-[10px] font-bold text-blue-800 mb-1 text-center">Precio</label>
            <input type="number" className="w-full py-1.5 px-2 border border-blue-300 rounded text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={entryPrice} onChange={e => setEntryPrice(Number(e.target.value))} />
          </div>

          <div className="w-20">
            <label className="block text-[10px] font-bold text-blue-800 mb-1 text-center">% Dsc</label>
            <input type="number" className="w-full py-1.5 px-2 border border-blue-300 rounded text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={entryDiscount} onChange={e => setEntryDiscount(Number(e.target.value))} />
          </div>

          <div className="w-20 flex items-center justify-center pb-2">
            <label className="flex items-center gap-1 text-[11px] font-bold text-blue-800 cursor-pointer">
              <input type="checkbox" checked={entryBonus} onChange={e => {
                if (e.target.checked) setShowAdminAuthModal({ isOpen: true, action: () => setEntryBonus(true), targetName: 'Activar Bonificación Manual' });
                else setEntryBonus(false);
              }} />
              Bonif.
            </label>
          </div>

          <button onClick={executeAddToCart} disabled={!selectedProduct} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded shadow disabled:opacity-50 transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* GRILLA */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-300">
              <tr>
                <th className="p-2 text-center w-10">#</th>
                <th className="p-2 w-28">CÓDIGO</th>
                <th className="p-2">DESCRIPCIÓN PRODUCTO</th>
                <th className="p-2 text-center w-20">CANT</th>
                <th className="p-2 text-center w-24">UNIDAD</th>
                <th className="p-2 text-right w-24">PRECIO</th>
                <th className="p-2 text-right w-20">DSC %</th>
                <th className="p-2 text-right w-28">IMPORTE</th>
                <th className="p-2 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.map((item, idx) => (
                <tr key={item.id} className={item.is_bonus ? 'bg-orange-50/50' : 'hover:bg-slate-50'}>
                  <td className="p-2 text-center font-bold text-slate-500">{idx + 1}</td>
                  <td className="p-2 font-mono text-slate-700">{item.sku}</td>
                  <td className="p-2">
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      {item.name}
                      {item.auto_promo_id && <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm flex items-center"><Zap className="w-3 h-3 mr-1"/> {item.promo_name}</span>}
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    {!item.is_bonus ? (
                      <input 
                        type="number" min="1"
                        className="w-16 text-center border border-slate-300 rounded px-1 py-1 font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
                        value={item.quantity}
                        onChange={e => handleCartQtyChange(item.id, Number(e.target.value))}
                      />
                    ) : (
                      <span className="font-black text-orange-600">{item.quantity}</span>
                    )}
                  </td>
                  <td className="p-2 text-center font-bold text-slate-500">{item.unit_type}</td>
                  <td className="p-2 text-right text-slate-700">S/ {item.unit_price.toFixed(2)}</td>
                  <td className="p-2 text-right text-slate-500">{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
                  <td className="p-2 text-right font-black text-slate-900 text-sm">S/ {item.total_price.toFixed(2)}</td>
                  <td className="p-2 text-center">
                    <button onClick={() => setCart(evalPromotions(cart.filter(c => c.id !== item.id), priceListId))} disabled={item.is_bonus && !!item.auto_promo_id} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded disabled:opacity-30">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-slate-400 font-medium italic border-dashed border-2 border-slate-200 mt-4 m-4 rounded">No hay productos. Utilice la barra superior para agregar un artículo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER TOTALES */}
      <div className="bg-slate-100 border-t border-slate-300 mt-2 p-2 flex justify-between items-end gap-4 shrink-0 rounded-b-lg">
        <div className="flex flex-col justify-end">
          <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded shadow-sm font-bold hover:bg-slate-50 flex items-center">
            <Printer className="w-4 h-4 mr-2" /> Vista Previa
          </button>
          <div className="text-[10px] text-slate-500 mt-2 italic">
            * El stock será reservado al presionar Guardar.<br/>
            * Las promociones se recalcularán automáticamente al editar cantidades.
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="bg-white border border-slate-300 shadow-sm rounded p-3 grid grid-cols-2 gap-x-6 gap-y-1 w-64">
             <div className="text-right text-slate-500 font-bold">Op. Gravada:</div>
             <div className="text-right font-mono text-slate-800 font-medium">{subtotal.toFixed(2)}</div>
             <div className="text-right text-slate-500 font-bold">IGV (18%):</div>
             <div className="text-right font-mono text-slate-800 font-medium">{igv.toFixed(2)}</div>
             <div className="col-span-2 border-t border-slate-200 my-1"></div>
             <div className="text-right text-slate-800 font-black text-sm self-center">TOTAL A PAGAR:</div>
             <div className="text-right font-black text-xl bg-slate-800 text-amber-400 px-2 rounded font-mono shadow-inner tracking-widest">
                {total.toFixed(2)}
             </div>
          </div>

          <button 
            disabled={cart.length === 0 || !clientData.name || isSaving}
            className="bg-amber-600 hover:bg-amber-700 text-white w-36 h-20 rounded-lg shadow-lg flex flex-col items-center justify-center font-black transition-colors disabled:opacity-50 active:scale-95"
          >
             {isSaving ? <Loader2 className="w-6 h-6 animate-spin mb-1" /> : <Save className="w-6 h-6 mb-1" />}
             GUARDAR (F10)
          </button>
        </div>
      </div>

      {/* MODAL ADMIN */}
      {showAdminAuthModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
            <h3 className="font-black text-slate-800 text-lg mb-1 flex items-center"><ShieldCheck className="w-5 h-5 mr-2 text-blue-600"/> Autorización Requerida</h3>
            <p className="text-sm text-slate-500 mb-4 pb-4 border-b border-slate-100">Ingrese la credencial administrativa para: <strong className="text-slate-800">{showAdminAuthModal.targetName}</strong></p>
            <input
               id="admin-password-input" type="password" placeholder="••••••••"
               className="w-full border-2 border-slate-200 rounded-lg p-3 mb-4 text-center text-2xl tracking-[0.5em] focus:border-blue-500 outline-none transition-colors"
               value={adminPwd} onChange={e => setAdminPwd(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') verifyAdmin(); if (e.key === 'Escape') setShowAdminAuthModal({ isOpen: false, action: () => {}, targetName: '' }); }}
            />
            <div className="flex gap-2">
               <button onClick={() => setShowAdminAuthModal({ isOpen: false, action: () => {}, targetName: '' })} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-lg font-bold hover:bg-slate-200">Cancelar</button>
               <button onClick={verifyAdmin} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold shadow hover:bg-blue-700">Autorizar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
