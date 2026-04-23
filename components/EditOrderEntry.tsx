import React, { useState, useEffect } from 'react';
import { useStore } from '../services/store';
import { Product, Order, AutoPromotion } from '../types';
import { Save, X, RefreshCw, Trash2, Loader2, Edit } from 'lucide-react';
import { supabase } from '../services/supabase';
import { calculateBaseQuantity } from '../utils/productUtils';

interface EditOrderProps {
  orderId: string;
  onClose: () => void;
}

export const EditOrderEntry: React.FC<EditOrderProps> = ({ orderId, onClose }) => {
  const { currentUser } = useStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [dbPriceLists, setDbPriceLists] = useState<any[]>([]);
  const [dbAutoPromos, setDbAutoPromos] = useState<AutoPromotion[]>([]);
  
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [priceListId, setPriceListId] = useState('');

  useEffect(() => {
    loadOrderFullData();
  }, [orderId]);

  const loadOrderFullData = async () => {
    setIsLoading(true);
    try {
      const [orderRes, itemsRes, prodsRes, plRes, apRes] = await Promise.all([
        supabase.from('orders').select('*').eq('id', orderId).single(),
        supabase.from('order_items').select('*').eq('order_id', orderId),
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('price_lists').select('*').order('name'),
        supabase.from('auto_promotions').select('*').eq('is_active', true)
      ]);

      if (orderRes.data) {
        setOrderData(orderRes.data);
        setPriceListId(orderRes.data.price_list_id || '');
      }
      
      if (itemsRes.data && prodsRes.data) {
        const mappedCart = itemsRes.data.map((item: any) => {
          const pRef = prodsRes.data.find(p => p.id === item.product_id) || {};
          const loadedUnitType = item.unit_type || item.selected_unit || 'UND';
          const conversionFactor = Number(loadedUnitType.split('/')[1]) || 1;
          const rawQuantity = item.quantity || item.quantity_presentation || item.quantity_base || 1;
          
          return {
            ...item,
            quantity: rawQuantity / conversionFactor,
            unit_type: loadedUnitType,
            product_ref: pRef,
            original_base_qty: rawQuantity
          };
        });
        setCart(mappedCart);
      }

      setDbProducts(prodsRes.data || []);
      setDbPriceLists(plRes.data || []);
      setDbAutoPromos(apRes.data || []);
    } catch (error) {
      console.error("Error cargando edición:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAllPrices = () => {
    const list = dbPriceLists.find(l => l.id === priceListId);
    const multiplier = list ? Number(list.multiplier || list.factor || 1) : 1;

    const newCart = cart.map(item => {
      if (item.is_bonus) return item;

      const p = item.product_ref;
      let basePrice = Number(p.price_unit || 0);
      
      if (item.unit_type === p.package_type) {
        basePrice = p.price_package ? Number(p.price_package) : basePrice * Number(p.package_content || 1);
      }

      const newUnitPrice = basePrice * multiplier;
      return {
        ...item,
        unit_price: newUnitPrice,
        total_price: newUnitPrice * item.quantity 
      };
    });

    setCart(newCart);
    applyElitePromotions(newCart);
  };

  const applyElitePromotions = (currentCart: any[]) => {
    let cleanCart = currentCart.filter(item => !item.auto_promo_id);
    
    const getBaseQuantity = (item: any) => {
        const conversionFactor = Number((item.unit_type || '').split('/')[1]) || 1;
        return item.quantity * conversionFactor;
    };

    const validPromos = dbAutoPromos.filter(ap => ap.is_active);

    validPromos.forEach(ap => {
      let applies = false;
      let multiplier = 0;

      if (ap.condition_type === 'BUY_X_PRODUCT') {
        const qtyBought = cleanCart.filter(i => {
            if (i.is_bonus) return false;
            if (ap.condition_product_ids?.length > 0) return ap.condition_product_ids.includes(i.product_id);
            if (ap.condition_product_id) return i.product_id === ap.condition_product_id;
            return true;
        }).reduce((sum, i) => sum + getBaseQuantity(i), 0); 
        
        if (qtyBought >= ap.condition_amount) {
          applies = true;
          multiplier = Math.floor(qtyBought / ap.condition_amount);
        }
      } 

      if (applies && multiplier > 0) {
        const rewardProduct = dbProducts.find(p => p.id === ap.reward_product_id);
        if (rewardProduct) {
          const rewardQty = ap.reward_quantity * multiplier;
          const isPkgMode = ap.reward_unit_type === 'PKG' || ap.reward_unit_type === rewardProduct.package_type;
          const conversionFactor = isPkgMode ? Number(rewardProduct.package_content || 1) : 1;
          const realUnitName = isPkgMode ? `${(rewardProduct.package_type || 'CAJA').toUpperCase()} / ${conversionFactor}` : `${(rewardProduct.unit_type || 'UND').toUpperCase()} / 1`;

          cleanCart.push({
            id: crypto.randomUUID(),
            product_id: rewardProduct.id,
            product_sku: rewardProduct.sku,
            product_name: rewardProduct.name,
            quantity: rewardQty,
            unit_type: realUnitName,
            selected_unit: realUnitName,
            unit_price: 0,
            discount_percent: 100,
            total_price: 0,
            is_bonus: true,
            auto_promo_id: ap.id,
            product_ref: rewardProduct
          });
        }
      }
    });

    setCart(cleanCart);
  };

  const handleSaveEdit = async () => {
    if (!orderData) return;
    setIsSaving(true);
    
    // Preparar el payload mapeando los campos para que la BD no se queje
    const itemsPayload = cart.map(c => {
        const conversionFactor = Number((c.unit_type || '').split('/')[1]) || 1;
        const qtyBase = c.quantity * conversionFactor;

        return {
            id: c.id,
            product_id: c.product_id,
            product_sku: c.product_sku || c.sku,
            product_name: c.product_name || c.name,
            quantity: qtyBase,
            quantity_presentation: c.quantity,
            quantity_base: qtyBase,
            unit_type: c.unit_type,
            selected_unit: c.unit_type,
            unit_price: c.unit_price,
            discount_percent: c.discount_percent || 0,
            discount_amount: 0,
            total_price: c.total_price,
            is_bonus: c.is_bonus || false,
            auto_promo_id: c.auto_promo_id || null
        };
    });

    const orderPayload = {
      ...orderData,
      total: cart.reduce((sum, i) => sum + i.total_price, 0),
      items: itemsPayload
    };

    try {
      const { error } = await supabase.rpc('update_order_transaction', {
        p_order_data: orderPayload
      });

      if (error) throw error;
      alert("Pedido actualizado magistralmente.");
      onClose();
    } catch (error: any) {
      alert("Error en edición: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
      <div className="fixed inset-0 bg-slate-900/50 z-[200] flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-xl flex items-center gap-3">
              <Loader2 className="animate-spin text-blue-600"/> 
              <span className="font-bold text-slate-700">Cargando pedido a memoria segura...</span>
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
          
          {/* HEADER */}
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black flex items-center">
                <Edit className="mr-2 w-5 h-5 text-blue-400"/> MODO EDICIÓN: {orderData?.code}
              </h2>
              <p className="text-sm text-slate-400">Cliente: {orderData?.client_name}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"><X/></button>
          </div>

          {/* CUERPO */}
          <div className="flex-1 overflow-auto bg-slate-100 p-4">
            <div className="flex items-center gap-4 mb-4 bg-white p-3 rounded border border-slate-200 shadow-sm">
              <div className="flex flex-col flex-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Lista de Precios del Cliente</label>
                <div className="flex gap-2">
                    <select 
                      className="border border-slate-300 rounded px-2 py-1.5 font-bold text-sm w-full outline-none focus:border-blue-500"
                      value={priceListId}
                      onChange={(e) => setPriceListId(e.target.value)}
                    >
                      <option value="">-- General --</option>
                      {dbPriceLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    <button 
                      onClick={handleUpdateAllPrices}
                      className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-1.5 rounded font-bold text-xs flex items-center shrink-0 transition-colors"
                    >
                      <RefreshCw size={14} className="mr-1"/> Recalcular Precios
                    </button>
                </div>
              </div>
            </div>

            {/* CARRITO */}
            <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3 text-center w-24">Cantidad</th>
                    <th className="p-3 text-center w-24">Und.</th>
                    <th className="p-3 text-right w-28">P. Unitario</th>
                    <th className="p-3 text-right w-32">Importe</th>
                    <th className="p-3 w-12 text-center"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {cart.map((item, idx) => (
                    <tr key={idx} className={item.is_bonus ? "bg-orange-50/50" : "hover:bg-slate-50"}>
                        <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3">
                            <div className="font-bold text-slate-800">{item.product_name}</div>
                            {item.is_bonus && <div className="text-[10px] text-orange-600 font-bold uppercase">Bonificación Automática</div>}
                        </td>
                        <td className="p-3 text-center">
                        {!item.is_bonus ? (
                            <input 
                            type="number" min="1"
                            className="w-16 text-center border border-slate-300 rounded py-1 font-bold outline-none focus:border-blue-500" 
                            value={item.quantity}
                            onChange={(e) => {
                                const newQty = Number(e.target.value);
                                if (newQty < 1) return;
                                const newCart = [...cart];
                                newCart[idx].quantity = newQty;
                                newCart[idx].total_price = newQty * newCart[idx].unit_price;
                                setCart(newCart);
                                applyElitePromotions(newCart); 
                            }}
                            />
                        ) : (
                            <span className="font-black text-orange-600">{item.quantity}</span>
                        )}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-500 uppercase">{item.unit_type}</td>
                        <td className="p-3 text-right text-slate-600">S/ {item.unit_price.toFixed(2)}</td>
                        <td className="p-3 text-right font-black text-slate-900">S/ {item.total_price.toFixed(2)}</td>
                        <td className="p-3 text-center">
                        {!item.auto_promo_id && (
                            <button 
                                onClick={() => {
                                    const newCart = cart.filter((_, i) => i !== idx);
                                    applyElitePromotions(newCart);
                                }}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <Trash2 size={16}/>
                            </button>
                        )}
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
          </div>

          {/* FOOTER ACCIONES */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
            <div>
              <span className="text-slate-500 font-bold text-[11px] uppercase tracking-widest">Total Calculado</span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                S/ {cart.reduce((sum, i) => sum + i.total_price, 0).toFixed(2)}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-6 py-2 rounded font-bold transition-colors">Cancelar</button>
              <button 
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="bg-blue-600 text-white px-6 py-2 rounded font-black shadow hover:bg-blue-700 flex items-center transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin w-5 h-5 mr-2"/> : <Save className="w-5 h-5 mr-2"/>}
                Guardar y Recalcular Kardex
              </button>
            </div>
          </div>
      </div>
    </div>
  );
};
