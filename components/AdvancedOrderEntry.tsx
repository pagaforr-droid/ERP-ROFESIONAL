import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useStore } from '../services/store';
import { Search, Save, Plus, Trash2, X, AlertTriangle, RefreshCw, FilePlus, ShoppingBag } from 'lucide-react';

export const AdvancedOrderEntry: React.FC = () => {
  const { currentUser } = useStore();

  // ==========================================
  // 1. ESTADOS PRINCIPALES (LIMPIOS)
  // ==========================================
  const [cart, setCart] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [searchedClients, setSearchedClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  
  const [productSearch, setProductSearch] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [entryQty, setEntryQty] = useState(1);
  const [entryPrice, setEntryPrice] = useState(0);

  const [docType, setDocType] = useState('FACTURA'); // Sugerido
  const [pedidoSeries, setPedidoSeries] = useState('');
  const [pedidoNumber, setPedidoNumber] = useState('');
  const [priceListId, setPriceListId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CONTADO');
  
  const [isSaving, setIsSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  // Maestros
  const [dbPriceLists, setDbPriceLists] = useState<any[]>([]);
  const [dbAutoPromos, setDbAutoPromos] = useState<any[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]); // Para extraer regalos

  // ==========================================
  // 2. CARGA INICIAL DE DATOS
  // ==========================================
  useEffect(() => {
    const init = async () => {
      // Cargar Listas de Precios
      const { data: lists } = await supabase.from('price_lists').select('*');
      if (lists) setDbPriceLists(lists);

      // Cargar Promociones Activas
      const { data: promos } = await supabase.from('auto_promotions').select('*').eq('is_active', true);
      if (promos) setDbAutoPromos(promos);

      // Cargar Catálogo (necesario para buscar regalos rápido)
      const { data: prods } = await supabase.from('products').select('*');
      if (prods) setDbProducts(prods);

      // Buscar la serie de PEDIDOS
      const { data: seriesData } = await supabase.from('document_series').select('*').eq('type', 'PEDIDO').eq('is_active', true).limit(1).maybeSingle();
      if (seriesData) {
        setPedidoSeries(seriesData.series);
        setPedidoNumber(String(seriesData.current_number + 1).padStart(8, '0'));
      }
    };
    init();
  }, []);

  // ==========================================
  // 3. BUSCADORES EN TIEMPO REAL
  // ==========================================
  useEffect(() => {
    if (clientSearch.length < 3) { setSearchedClients([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('clients').select('*').or(`name.ilike.%${clientSearch}%,doc_number.ilike.%${clientSearch}%`).limit(8);
      if (data) setSearchedClients(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  useEffect(() => {
    if (productSearch.length < 2) { setSearchedProducts([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('products').select('*').or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`).eq('is_active', true).limit(10);
      if (data) setSearchedProducts(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // ==========================================
  // 4. LÓGICA DE CARRITO Y PROMOCIONES
  // ==========================================
  const calculateTotals = (currentCart: any[]) => {
    const total = currentCart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const subtotal = total / 1.18;
    const igv = total - subtotal;
    return { subtotal, igv, total };
  };

  const evalPromotions = (baseCart: any[]) => {
    // Primero, limpiamos las promociones viejas (is_bonus = true)
    let newCart = baseCart.filter(item => !item.is_bonus);
    
    // Evaluamos cada promoción activa
    dbAutoPromos.forEach(promo => {
      let applies = false;
      let multiplier = 0;

      // Condición: Comprar X cantidad de un producto
      if (promo.condition_type === 'BUY_X_PRODUCT') {
        const qtyBought = newCart
          .filter(item => item.product_id === promo.condition_product_id)
          .reduce((sum, item) => sum + item.quantity, 0);
        
        if (qtyBought >= promo.condition_amount) {
          applies = true;
          multiplier = Math.floor(qtyBought / promo.condition_amount);
        }
      }

      // Condición: Gastar Y monto total
      if (promo.condition_type === 'SPEND_Y_TOTAL') {
        const totalSpent = calculateTotals(newCart).total;
        if (totalSpent >= promo.condition_amount) {
          applies = true;
          multiplier = Math.floor(totalSpent / promo.condition_amount);
        }
      }

      // Si aplica, inyectamos el regalo
      if (applies && multiplier > 0) {
        const rewardProduct = dbProducts.find(p => p.id === promo.reward_product_id);
        if (rewardProduct) {
          newCart.push({
            id: crypto.randomUUID(),
            product_id: rewardProduct.id,
            sku: rewardProduct.sku,
            name: rewardProduct.name,
            quantity: promo.reward_quantity * multiplier,
            unit_price: 0,
            total_price: 0,
            is_bonus: true,
            promo_name: promo.name
          });
        }
      }
    });

    return newCart;
  };

  const handleAddProduct = () => {
    if (!selectedProduct) return;
    if (entryQty <= 0) return;

    const newItem = {
      id: crypto.randomUUID(),
      product_id: selectedProduct.id,
      sku: selectedProduct.sku,
      name: selectedProduct.name,
      quantity: entryQty,
      unit_price: entryPrice,
      total_price: entryQty * entryPrice,
      is_bonus: false
    };

    // Verificar si ya existe en el carrito
    const existingIndex = cart.findIndex(i => i.product_id === newItem.product_id && !i.is_bonus);
    let updatedCart = [...cart];

    if (existingIndex >= 0) {
      updatedCart[existingIndex].quantity += entryQty;
      updatedCart[existingIndex].total_price = updatedCart[existingIndex].quantity * updatedCart[existingIndex].unit_price;
    } else {
      updatedCart.push(newItem);
    }

    // Aplicar Promociones Automáticas
    updatedCart = evalPromotions(updatedCart);
    setCart(updatedCart);

    // Resetear inputs
    setSelectedProduct(null);
    setProductSearch('');
    setEntryQty(1);
    setEntryPrice(0);
  };

  const handleUpdatePrices = () => {
    if (!priceListId) {
      showAlert("Seleccione una Lista de Precios primero.");
      return;
    }

    const list = dbPriceLists.find(l => l.id === priceListId);
    const factor = list ? (list.multiplier || list.factor || 1) : 1;

    let updatedCart = cart.map(item => {
      if (item.is_bonus) return item; // No tocar regalos
      
      const prodMaster = dbProducts.find(p => p.id === item.product_id);
      if (!prodMaster) return item;

      const newPrice = Number(prodMaster.price_unit || 0) * factor;
      return {
        ...item,
        unit_price: newPrice,
        total_price: item.quantity * newPrice
      };
    });

    updatedCart = evalPromotions(updatedCart);
    setCart(updatedCart);
    showAlert("Precios actualizados masivamente.", true);
  };

  // ==========================================
  // 5. GUARDAR PEDIDO EN SUPABASE
  // ==========================================
  const handleSaveOrder = async () => {
    if (!selectedClient) { showAlert("Debe seleccionar un cliente."); return; }
    if (cart.length === 0) { showAlert("El pedido no puede estar vacío."); return; }
    if (!pedidoSeries) { showAlert("Configure una serie para PEDIDO en ajustes."); return; }

    setIsSaving(true);
    const totals = calculateTotals(cart);

    const orderPayload = {
      id: crypto.randomUUID(),
      code: `${pedidoSeries}-${pedidoNumber}`, // Temporal, el SQL lo ajusta
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      client_doc_type: selectedClient.doc_number?.length === 11 ? 'RUC' : 'DNI',
      client_doc_number: selectedClient.doc_number,
      seller_id: currentUser?.id,
      suggested_document_type: docType,
      payment_method: paymentMethod,
      total: totals.total,
      delivery_address: selectedClient.address || '',
      status: 'pending',
      items: cart.map(c => ({
        id: crypto.randomUUID(),
        product_id: c.product_id,
        product_sku: c.sku,
        product_name: c.name,
        quantity_base: c.quantity,
        quantity_presentation: c.quantity,
        unit_price: c.unit_price,
        total_price: c.unit_price * c.quantity,
        is_bonus: c.is_bonus,
        selected_unit: 'UND'
      }))
    };

    try {
      const { data, error } = await supabase.rpc('process_order_transaction', { p_order_data: orderPayload });
      if (error) throw error;

      showAlert(`¡Pedido guardado con éxito! Código: ${data.real_code}`, true);
      
      // Resetear todo
      setCart([]);
      setSelectedClient(null);
      setClientSearch('');
      setPedidoNumber(String(Number(pedidoNumber) + 1).padStart(8, '0'));
    } catch (error: any) {
      showAlert("Error al guardar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const showAlert = (msg: string, isSuccess = false) => {
    setAlertMsg(msg);
    setTimeout(() => setAlertMsg(''), 4000);
  };

  const { subtotal, igv, total } = calculateTotals(cart);

  return (
    <div className="flex flex-col h-full bg-slate-100 p-4 font-sans text-sm">
      
      {/* ALERTAS */}
      {alertMsg && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <span className="font-bold">{alertMsg}</span>
        </div>
      )}

      {/* CABECERA PRINCIPAL */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800">Generador de Pedidos</h1>
            <p className="text-xs text-slate-500 font-medium">Módulo nativo de reserva de stock y preventa</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-slate-50 p-2 rounded border border-slate-200 flex items-center gap-2">
            <span className="font-bold text-slate-500">Documento Final:</span>
            <select className="bg-white border border-slate-300 rounded px-2 py-1 font-bold" value={docType} onChange={e => setDocType(e.target.value)}>
              <option value="FACTURA">Factura</option>
              <option value="BOLETA">Boleta</option>
            </select>
          </div>
          <div className="bg-blue-50 p-2 rounded border border-blue-200 flex items-center gap-2">
            <span className="font-bold text-blue-800">Pedido N°:</span>
            <span className="text-lg font-black text-blue-900">{pedidoSeries}-{pedidoNumber || '...'}</span>
          </div>
        </div>
      </div>

      {/* DATOS DEL CLIENTE */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 grid grid-cols-12 gap-4">
        <div className="col-span-4 relative">
          <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Cliente (RUC/Nombre)</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              placeholder="Ej. Juan Perez..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
            />
            {searchedClients.length > 0 && clientSearch && (
              <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow-xl rounded-lg mt-1 z-50 overflow-hidden">
                {searchedClients.map(c => (
                  <div key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(c.name); setPriceListId(c.price_list_id || ''); setSearchedClients([]); }} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100">
                    <div className="font-bold text-slate-800">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.doc_number}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="col-span-3">
          <label className="block text-xs font-bold text-slate-500 mb-1">Lista de Precios Aplicable</label>
          <div className="flex gap-2">
            <select className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none font-medium" value={priceListId} onChange={e => setPriceListId(e.target.value)}>
              <option value="">-- General --</option>
              {dbPriceLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button onClick={handleUpdatePrices} className="bg-blue-100 text-blue-700 p-2 rounded-lg hover:bg-blue-200" title="Recalcular carrito con esta lista">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="col-span-3">
          <label className="block text-xs font-bold text-slate-500 mb-1">Condición de Pago</label>
          <select className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none font-bold text-slate-700" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            <option value="CONTADO">AL CONTADO</option>
            <option value="CREDITO">A CRÉDITO</option>
          </select>
        </div>

        <div className="col-span-2 flex items-end">
           {selectedClient && (
             <div className="w-full bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-emerald-800 text-xs font-bold text-center">
               Cliente Seleccionado OK
             </div>
           )}
        </div>
      </div>

      {/* ENTRADA DE PRODUCTOS */}
      <div className="bg-white p-4 rounded-t-xl shadow-sm border border-slate-200 border-b-0 flex gap-3 items-end">
        <div className="flex-1 relative">
          <label className="block text-xs font-bold text-blue-800 mb-1">Agregar Producto (Código o Nombre)</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-blue-400" />
            <input 
              className="w-full pl-9 pr-3 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 outline-none font-bold text-slate-800 uppercase"
              placeholder="Buscar producto..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
            />
            {searchedProducts.length > 0 && productSearch && (
              <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow-2xl rounded-lg mt-1 z-50 overflow-hidden max-h-64 overflow-y-auto">
                {searchedProducts.map(p => (
                  <div key={p.id} onClick={() => { setSelectedProduct(p); setProductSearch(p.name); setEntryPrice(p.price_unit || 0); setEntryQty(1); setSearchedProducts([]); }} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-800">{p.sku} - {p.name}</div>
                      <div className="text-xs text-slate-500">Precio Base: S/ {p.price_unit}</div>
                    </div>
                    <div className="font-black text-blue-700 bg-blue-100 px-2 py-1 rounded">Stock: {p.stock || p.current_stock || 0}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-24">
          <label className="block text-xs font-bold text-blue-800 mb-1 text-center">Cant.</label>
          <input type="number" min="1" className="w-full border-2 border-blue-200 rounded-lg py-2 px-2 text-center font-black text-lg outline-none" value={entryQty} onChange={e => setEntryQty(Number(e.target.value))} />
        </div>

        <div className="w-32">
          <label className="block text-xs font-bold text-blue-800 mb-1 text-center">Precio Libre</label>
          <input type="number" className="w-full border-2 border-blue-200 rounded-lg py-2 px-2 text-right font-bold outline-none" value={entryPrice} onChange={e => setEntryPrice(Number(e.target.value))} />
        </div>

        <button onClick={handleAddProduct} disabled={!selectedProduct} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg disabled:opacity-50 transition-colors shadow-md shadow-blue-500/30">
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* GRILLA DE DETALLES */}
      <div className="flex-1 bg-white border border-slate-200 shadow-sm overflow-auto rounded-b-xl">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-300">
            <tr>
              <th className="p-3">Código</th>
              <th className="p-3">Descripción</th>
              <th className="p-3 text-center">Cantidad</th>
              <th className="p-3 text-right">Precio Unit.</th>
              <th className="p-3 text-right">Subtotal</th>
              <th className="p-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cart.map((item, idx) => (
              <tr key={item.id} className={item.is_bonus ? 'bg-orange-50' : 'hover:bg-slate-50'}>
                <td className="p-3 font-mono font-bold text-slate-600">{item.sku}</td>
                <td className="p-3">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    {item.name}
                    {item.is_bonus && <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center"><Zap className="w-3 h-3 mr-1"/> REGALO: {item.promo_name}</span>}
                  </div>
                </td>
                <td className="p-3 text-center">
                  {!item.is_bonus ? (
                    <input 
                      type="number" 
                      className="w-20 text-center bg-white border border-slate-300 rounded px-2 py-1 font-bold"
                      value={item.quantity}
                      onChange={e => {
                        const newCart = [...cart];
                        newCart[idx].quantity = Number(e.target.value);
                        newCart[idx].total_price = newCart[idx].quantity * newCart[idx].unit_price;
                        setCart(evalPromotions(newCart));
                      }}
                    />
                  ) : (
                    <span className="font-black text-orange-600">{item.quantity}</span>
                  )}
                </td>
                <td className="p-3 text-right font-medium">S/ {item.unit_price.toFixed(2)}</td>
                <td className="p-3 text-right font-black text-slate-900">S/ {item.total_price.toFixed(2)}</td>
                <td className="p-3 text-center">
                  <button onClick={() => setCart(evalPromotions(cart.filter((_, i) => i !== idx)))} disabled={item.is_bonus} className="text-red-400 hover:bg-red-100 p-2 rounded-lg transition-colors disabled:opacity-30">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {cart.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-400 font-medium text-base border-dashed border-2 border-slate-200">
                  El carrito está vacío. Agregue productos para comenzar el pedido.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER TOTALS */}
      <div className="mt-4 bg-slate-900 rounded-xl p-4 shadow-xl flex justify-between items-center text-white">
        <div className="text-slate-400 text-xs">
          Generador de Pedidos Tandao v2.0 <br/>
          * Los pedidos reservan stock al guardarse mediante FIFO.
        </div>
        
        <div className="flex gap-8 items-center">
          <div className="text-right">
            <div className="text-slate-400 font-medium mb-1">Subtotal</div>
            <div className="font-mono text-lg">S/ {subtotal.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-slate-400 font-medium mb-1">IGV (18%)</div>
            <div className="font-mono text-lg">S/ {igv.toFixed(2)}</div>
          </div>
          <div className="text-right border-l border-slate-700 pl-8">
            <div className="text-blue-400 font-bold mb-1 uppercase tracking-widest">Total Pedido</div>
            <div className="font-mono text-4xl font-black text-white">S/ {total.toFixed(2)}</div>
          </div>
          
          <button 
            onClick={handleSaveOrder} 
            disabled={cart.length === 0 || isSaving} 
            className="ml-4 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-black text-lg shadow-lg shadow-blue-900/50 flex items-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />}
            GUARDAR PEDIDO
          </button>
        </div>
      </div>
    </div>
  );
};
