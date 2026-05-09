import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useStore } from '../services/store';
import { Product, BatchAllocation } from '../types';
import { Search, Plus, Trash2, FileText, CheckCircle, AlertCircle, RefreshCw, Eye, X } from 'lucide-react';
import { isPackageUnit, calculateBaseQuantity, allocateBatchesFIFO } from '../utils/productUtils';
import { PdfEngine } from './PdfEngine';

interface TransferCartItem {
  id: string; // temp id
  product: Product;
  selected_unit: string;
  quantity_presentation: number;
  quantity_base: number;
  batch_allocations: BatchAllocation[];
}

export const DamagedGoodsTransfer: React.FC = () => {
  const { currentUser } = useStore();
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');

  // === NEW TRANSFER STATE ===
  const [originWarehouse, setOriginWarehouse] = useState('CENTRAL');
  const [destWarehouse, setDestWarehouse] = useState('MERMAS');
  const [reason, setReason] = useState('TRASLADO A MERMAS');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  
  const [transferQty, setTransferQty] = useState<number | ''>('');
  const [unitType, setUnitType] = useState<string>('UND');

  const [cart, setCart] = useState<TransferCartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // === HISTORY STATE ===
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 1. Fetch active products
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from('products').select('*').eq('is_active', true);
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);

  // 2. Search products (auto-suggest)
  useEffect(() => {
    if (!searchTerm) {
      setFilteredProducts([]);
      return;
    }
    const lower = searchTerm.toLowerCase();
    const matches = products.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      p.sku.toLowerCase().includes(lower) || 
      (p.barcode && p.barcode.toLowerCase().includes(lower))
    ).slice(0, 10);
    setFilteredProducts(matches);
  }, [searchTerm, products]);

  // 3. Fetch batches when product selected
  useEffect(() => {
    const fetchBatches = async () => {
      if (!selectedProduct) {
        setAvailableBatches([]);
        return;
      }
      
      // Algorithm: FIFO Global (matching NewSale)
      const { data } = await supabase
        .from('batches')
        .select('*')
        .eq('product_id', selectedProduct.id)
        .gt('quantity_current', 0)
        .order('expiration_date', { ascending: true });

      setAvailableBatches(data || []);
      
      // Default unit
      if (selectedProduct.package_content > 1) {
         setUnitType(`${selectedProduct.package_type || 'CJA'}/${selectedProduct.package_content}`);
      } else {
         setUnitType(selectedProduct.unit_type || 'UND');
      }
    };
    fetchBatches();
  }, [selectedProduct]);

  // Total available stock calc
  const totalAvailableStock = availableBatches.reduce((acc, b) => acc + (b.quantity_current || 0), 0);

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setSearchTerm('');
    setFilteredProducts([]);
    setTransferQty('');
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const qty = Number(transferQty);
    if (isNaN(qty) || qty <= 0) {
      setMessage({ type: 'error', text: 'Ingrese una cantidad válida.' });
      return;
    }

    const { quantityBase: baseQuantity } = calculateBaseQuantity(selectedProduct, unitType, qty);
    
    if (baseQuantity > totalAvailableStock) {
      setMessage({ type: 'error', text: `Stock insuficiente. Disponible: ${totalAvailableStock} UND base. Requiere: ${baseQuantity} UND base.` });
      return;
    }

    const allocations = allocateBatchesFIFO(baseQuantity, availableBatches);

    const newItem: TransferCartItem = {
      id: Math.random().toString(36).substr(2, 9),
      product: selectedProduct,
      selected_unit: unitType,
      quantity_presentation: qty,
      quantity_base: baseQuantity,
      batch_allocations: allocations
    };

    setCart([...cart, newItem]);
    
    // Reset form
    setSelectedProduct(null);
    setTransferQty('');
    setSearchTerm('');
    setMessage(null);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleConfirmTransfer = async () => {
    if (cart.length === 0) return;
    if (!currentUser) {
      setMessage({ type: 'error', text: 'No hay usuario activo.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const payload = {
        origin_warehouse_id: originWarehouse,
        dest_warehouse_id: destWarehouse,
        reason: reason,
        user_id: currentUser.id,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity_base: item.quantity_base,
          quantity_presentation: item.quantity_presentation,
          selected_unit: item.selected_unit,
          batch_allocations: item.batch_allocations
        }))
      };

      const { data, error } = await supabase.rpc('process_transfer_document', { p_data: payload });

      if (error) throw error;

      if (data && data.success) {
        setMessage({ type: 'success', text: `Traslado ${data.document_number} procesado con éxito.` });
        setCart([]);
        
        // Optionally auto-open PDF
        const fullDoc = {
           document_number: data.document_number,
           origin_warehouse_id: originWarehouse,
           dest_warehouse_id: destWarehouse,
           reason: reason,
           user_name: currentUser.name,
           created_at: new Date().toISOString(),
           status: 'COMPLETADO',
           items: cart
        };
        PdfEngine.openDocument(fullDoc, 'TRASLADO', null); // Passing null for companyInfo, it will use defaults

      } else {
        throw new Error('Respuesta inválida del servidor.');
      }
    } catch (err: any) {
      console.error('Transfer error:', err);
      setMessage({ type: 'error', text: err.message || 'Ocurrió un error al procesar el traslado.' });
    } finally {
      setLoading(false);
    }
  };

  // --- HISTORY LOGIC ---
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('transfer_documents')
        .select(`
          *,
          transfer_items (
            *,
            product:products(*)
          ),
          user:user_id(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistory();
    }
  }, [activeTab]);

  const handlePrintDocument = (doc: any) => {
     const formattedDoc = {
        ...doc,
        user_name: doc.user?.name,
     };
     PdfEngine.openDocument(formattedDoc, 'TRASLADO', null);
  };

  const handleCancelDocument = async (docId: string) => {
      if (!window.confirm('¿Está seguro de anular este traslado? El stock retornará a su estado original.')) return;
      try {
         const { data, error } = await supabase.rpc('cancel_transfer_document', { p_document_id: docId });
         if (error) throw error;
         alert('Traslado anulado exitosamente.');
         fetchHistory();
      } catch (err: any) {
         alert(`Error al anular: ${err.message}`);
      }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-16rem)]">
      
      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button 
          onClick={() => setActiveTab('NEW')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 ${activeTab === 'NEW' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Nuevo Traslado
        </button>
        <button 
          onClick={() => setActiveTab('HISTORY')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Historial de Traslados
        </button>
      </div>

      {activeTab === 'NEW' && (
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        
        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        {/* Top Header Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Almacén Origen</label>
            <select 
              value={originWarehouse} 
              onChange={(e) => setOriginWarehouse(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-slate-50"
            >
              <option value="CENTRAL">CENTRAL</option>
              <option value="TIENDA1">TIENDA 1</option>
            </select>
          </div>
          <div>
             <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Almacén Destino</label>
             <select 
              value={destWarehouse} 
              onChange={(e) => setDestWarehouse(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="MERMAS">MERMAS (Cuarentena)</option>
              <option value="VENCIDOS">VENCIDOS</option>
            </select>
          </div>
          <div>
             <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Motivo</label>
             <select 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="TRASLADO A MERMAS">TRASLADO A MERMAS</option>
              <option value="VENCIMIENTO">VENCIMIENTO</option>
              <option value="REUBICACION">REUBICACIÓN INTERNA</option>
            </select>
          </div>
        </div>

        {/* Product Search & Add Row */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 flex gap-2 items-end relative">
           <div className="flex-1 relative">
             <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Buscar Producto</label>
             <div className="relative">
               <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
               <input
                 ref={searchInputRef}
                 type="text"
                 placeholder="Ej: Ron Cartavio..."
                 value={selectedProduct ? selectedProduct.name : searchTerm}
                 onChange={(e) => {
                   setSearchTerm(e.target.value);
                   if (selectedProduct) setSelectedProduct(null);
                 }}
                 className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
               />
               {selectedProduct && (
                 <button onClick={() => setSelectedProduct(null)} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                   <X className="w-4 h-4" />
                 </button>
               )}
             </div>
             
             {/* Auto-suggest dropdown */}
             {!selectedProduct && filteredProducts.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    >
                      <div className="font-medium text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{p.sku}</div>
                    </button>
                  ))}
                </div>
             )}
           </div>

           {selectedProduct && (
             <>
               <div className="w-24">
                 <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Disp.</label>
                 <input 
                   type="text" 
                   readOnly 
                   value={totalAvailableStock} 
                   className="w-full p-2 border border-slate-300 rounded text-sm bg-slate-100 text-center font-bold text-slate-600" 
                 />
               </div>
               <div className="w-32">
                 <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Unidad</label>
                 <select
                   value={unitType}
                   onChange={(e) => setUnitType(e.target.value)}
                   className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                 >
                   {selectedProduct.package_content > 1 && (
                     <option value={`${selectedProduct.package_type || 'CJA'}/${selectedProduct.package_content}`}>
                       {selectedProduct.package_type || 'CJA'} x {selectedProduct.package_content}
                     </option>
                   )}
                   <option value={selectedProduct.unit_type || 'UND'}>{selectedProduct.unit_type || 'UND'} x 1</option>
                 </select>
               </div>
               <div className="w-24">
                 <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Cant.</label>
                 <input 
                   type="number" 
                   min="1"
                   value={transferQty}
                   onChange={(e) => setTransferQty(Number(e.target.value) || '')}
                   onKeyDown={(e) => e.key === 'Enter' && handleAddToCart()}
                   className="w-full p-2 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500" 
                 />
               </div>
               <button 
                 onClick={handleAddToCart}
                 className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors h-[38px] w-[38px] flex items-center justify-center"
                 title="Agregar a lista"
               >
                 <Plus className="w-5 h-5" />
               </button>
             </>
           )}
        </div>

        {/* Cart Table */}
        <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden bg-white flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-600 uppercase bg-slate-100 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 w-16">#</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3 text-center">Cant.</th>
                  <th className="px-4 py-3 text-center">U.M.</th>
                  <th className="px-4 py-3">Lotes Asignados</th>
                  <th className="px-4 py-3 text-center w-20">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p className="text-base font-medium">Lista de traslado vacía</p>
                      <p className="text-sm">Busca un producto y agrégalo a la lista.</p>
                    </td>
                  </tr>
                ) : (
                  cart.map((item, idx) => {
                    const isPkg = isPackageUnit(item.selected_unit, item.product);
                    const umDisplay = isPkg ? `${item.product.package_type}x${item.product.package_content}` : 'UNDx1';
                    
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs">{item.product.sku}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{item.product.name}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-600">{item.quantity_presentation}</td>
                        <td className="px-4 py-3 text-center text-xs font-semibold text-slate-500">{umDisplay}</td>
                        <td className="px-4 py-3">
                           <div className="flex flex-col gap-1">
                             {item.batch_allocations.map(b => (
                               <span key={b.batch_id} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 inline-block w-max">
                                 {b.batch_code}: {b.quantity}u
                               </span>
                             ))}
                           </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleRemoveFromCart(item.id)} className="text-red-500 hover:text-red-700 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer Actions */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
             <div className="text-sm text-slate-600">
                Total Productos: <span className="font-bold text-slate-800">{cart.length}</span>
             </div>
             <button
               onClick={handleConfirmTransfer}
               disabled={cart.length === 0 || loading}
               className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
             >
               {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
               Confirmar Traslado
             </button>
          </div>
        </div>
      </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'HISTORY' && (
        <div className="flex-1 overflow-auto p-4 bg-slate-50/50">
           {loadingHistory ? (
             <div className="flex justify-center p-8"><RefreshCw className="w-8 h-8 animate-spin text-blue-500" /></div>
           ) : history.length === 0 ? (
             <div className="text-center p-12 text-slate-500">No hay traslados registrados.</div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {history.map(doc => (
                 <div key={doc.id} className={`bg-white rounded-xl border ${doc.status === 'CANCELED' ? 'border-red-200 opacity-75' : 'border-slate-200'} p-4 shadow-sm`}>
                   <div className="flex justify-between items-start mb-3">
                     <div>
                       <span className={`text-xs font-bold px-2 py-1 rounded ${doc.status === 'CANCELED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                         {doc.document_number}
                       </span>
                       <p className="text-xs text-slate-500 mt-1">{new Date(doc.created_at).toLocaleString()}</p>
                     </div>
                     <button onClick={() => handlePrintDocument(doc)} className="p-1.5 bg-slate-100 rounded text-slate-600 hover:bg-blue-50 hover:text-blue-600" title="Ver PDF">
                       <FileText className="w-4 h-4" />
                     </button>
                   </div>
                   
                   <div className="mb-3 text-sm">
                     <div className="flex justify-between border-b border-slate-100 py-1">
                       <span className="text-slate-500 text-xs">Origen:</span>
                       <span className="font-semibold text-slate-700 text-xs">{doc.origin_warehouse_id}</span>
                     </div>
                     <div className="flex justify-between border-b border-slate-100 py-1">
                       <span className="text-slate-500 text-xs">Destino:</span>
                       <span className="font-semibold text-slate-700 text-xs">{doc.dest_warehouse_id}</span>
                     </div>
                     <div className="flex justify-between py-1">
                       <span className="text-slate-500 text-xs">Motivo:</span>
                       <span className="font-medium text-slate-800 text-xs">{doc.reason}</span>
                     </div>
                   </div>

                   <div className="mt-2">
                     <p className="text-xs font-semibold text-slate-500 mb-1">Items ({doc.transfer_items?.length || 0}):</p>
                     <div className="text-xs text-slate-600 line-clamp-2">
                       {doc.transfer_items?.map((item: any) => `${item.quantity_presentation} ${item.product?.name}`).join(', ')}
                     </div>
                   </div>

                   {doc.status !== 'CANCELED' && (
                     <button 
                       onClick={() => handleCancelDocument(doc.id)}
                       className="mt-4 w-full py-1.5 border border-red-200 text-red-600 rounded text-xs font-semibold hover:bg-red-50 transition-colors"
                     >
                       Anular Traslado
                     </button>
                   )}
                   {doc.status === 'CANCELED' && (
                      <div className="mt-4 text-center text-xs font-bold text-red-500 uppercase">Anulado</div>
                   )}
                 </div>
               ))}
             </div>
           )}
        </div>
      )}

    </div>
  );
};
