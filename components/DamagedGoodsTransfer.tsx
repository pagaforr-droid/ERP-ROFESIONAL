import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useStore } from '../services/store';
import { AlertCircle, ArrowRightLeft, CheckCircle, Package, Search, Trash2, RefreshCw } from 'lucide-react';
import { Product } from '../types';

export const DamagedGoodsTransfer: React.FC = () => {
  const { currentUser } = useStore();
  const [originWarehouse, setOriginWarehouse] = useState('CENTRAL');
  const [destWarehouse, setDestWarehouse] = useState('MERMAS');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  
  const [transferQty, setTransferQty] = useState<number | ''>('');
  const [unitType, setUnitType] = useState<'BASE' | 'PACKAGE'>('BASE');
  const [reason, setReason] = useState('DAÑADO_MERMA');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: 'success' | 'error', message: string}>({ isOpen: false, type: 'success', message: '' });

  // Buscar productos
  useEffect(() => {
    const fetchProducts = async () => {
      if (searchTerm.length < 2) {
        setProducts([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
        .limit(10);
        
      if (!error && data) {
        setProducts(data as Product[]);
      }
    };
    
    const timeoutId = setTimeout(() => fetchProducts(), 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Buscar lotes cuando se selecciona un producto y origen
  useEffect(() => {
    const fetchBatches = async () => {
      if (!selectedProduct) {
        setBatches([]);
        setSelectedBatchId(null);
        return;
      }
      
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('product_id', selectedProduct.id)
        .eq('warehouse_id', originWarehouse)
        .gt('quantity_current', 0)
        .order('expiration_date', { ascending: true });
        
      if (!error && data) {
        setBatches(data);
      }
    };
    
    fetchBatches();
  }, [selectedProduct, originWarehouse]);

  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  const packageContent = selectedProduct?.package_content || 1;
  const isPackageAllowed = packageContent > 1;

  const maxAllowedQty = selectedBatch ? (unitType === 'PACKAGE' ? Math.floor(selectedBatch.quantity_current / packageContent) : selectedBatch.quantity_current) : 0;

  const handleTransfer = async () => {
    if (!selectedBatch || !transferQty || transferQty <= 0) {
      setModalConfig({ isOpen: true, type: 'error', message: 'Seleccione un lote y una cantidad válida mayor a 0.' });
      return;
    }
    
    if (transferQty > maxAllowedQty) {
      setModalConfig({ isOpen: true, type: 'error', message: `No hay suficiente stock. El máximo permitido es ${maxAllowedQty} ${unitType === 'PACKAGE' ? 'Cajas' : 'Unidades'}.` });
      return;
    }

    if (originWarehouse === destWarehouse) {
      setModalConfig({ isOpen: true, type: 'error', message: 'El almacén de origen y destino no pueden ser el mismo.' });
      return;
    }

    setIsProcessing(true);
    
    // Convertir a unidades base para el backend
    const qtyBase = unitType === 'PACKAGE' ? (transferQty as number) * packageContent : (transferQty as number);

    try {
      const { data, error } = await supabase.rpc('transfer_damaged_goods', {
        p_batch_id: selectedBatch.id,
        p_qty: qtyBase,
        p_dest_warehouse: destWarehouse,
        p_reason: reason,
        p_user_id: currentUser?.id
      });

      if (error) throw error;
      
      setModalConfig({ isOpen: true, type: 'success', message: 'Traslado registrado exitosamente en el Kardex.' });
      
      // Limpiar formulario
      setTransferQty('');
      setSearchTerm('');
      setSelectedProduct(null);
      setSelectedBatchId(null);
      
    } catch (err: any) {
      console.error(err);
      setModalConfig({ isOpen: true, type: 'error', message: 'Error en la transacción: ' + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fade-in relative p-6">
      
      {/* MODAL */}
      {modalConfig.isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-scale-up">
            {modalConfig.type === 'error' ? (
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            ) : (
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            )}
            <h3 className="text-lg font-black text-slate-800 mb-2">
              {modalConfig.type === 'error' ? 'Error' : 'Operación Exitosa'}
            </h3>
            <p className="text-sm text-slate-600 mb-6">{modalConfig.message}</p>
            <button onClick={() => setModalConfig({...modalConfig, isOpen: false})} className={`px-8 py-2 rounded-lg font-bold text-white ${modalConfig.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
              Aceptar
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
        <div className="bg-red-100 text-red-600 p-2.5 rounded-lg">
          <Trash2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Traslado de Mercadería</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gestión de Daños, Vencimientos y Mermas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">1. Almacén Origen</label>
          <select className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-sm font-bold focus:border-blue-500 outline-none" value={originWarehouse} onChange={(e) => setOriginWarehouse(e.target.value)}>
            <option value="CENTRAL">CENTRAL (Almacén Principal)</option>
          </select>
        </div>
        
        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
          <label className="block text-xs font-black text-red-500 uppercase tracking-wider mb-2">2. Almacén Destino (Recepción)</label>
          <select className="w-full bg-white border border-red-300 p-2.5 rounded-lg text-sm font-bold text-red-700 focus:border-red-500 outline-none" value={destWarehouse} onChange={(e) => setDestWarehouse(e.target.value)}>
            <option value="MERMAS">MERMAS (Almacén de Dañados)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        {/* SELECCIÓN DE PRODUCTO */}
        <div className="flex flex-col">
          <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">3. Buscar Producto Físico</label>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input 
              className="w-full pl-10 border-2 border-slate-200 p-2.5 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
              placeholder="Buscar por Nombre o Código (SKU)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {!selectedProduct && products.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm flex-1 overflow-y-auto max-h-64">
              {products.map(p => (
                <div 
                  key={p.id} 
                  className="p-3 border-b border-slate-100 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                  onClick={() => {
                    setSelectedProduct(p);
                    setSearchTerm('');
                    setProducts([]);
                  }}
                >
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{p.sku}</div>
                  </div>
                  <Package className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          )}

          {selectedProduct && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 relative mb-4">
              <button 
                className="absolute top-2 right-2 text-blue-400 hover:text-blue-600 text-xs font-bold underline"
                onClick={() => { setSelectedProduct(null); setSelectedBatchId(null); }}
              >
                Cambiar Producto
              </button>
              <div className="font-black text-slate-900">{selectedProduct.name}</div>
              <div className="text-sm font-mono text-slate-500 mb-2">{selectedProduct.sku}</div>
              <div className="text-xs font-bold text-blue-700 bg-blue-100 inline-block px-2 py-1 rounded">
                Unidad Mínima: {selectedProduct.unit_type} | Empaque: {selectedProduct.package_content} Und
              </div>
            </div>
          )}

          {/* LISTA DE LOTES */}
          {selectedProduct && batches.length > 0 && (
            <div className="mt-4">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">4. Seleccionar Lote Específico</label>
              <div className="space-y-2">
                {batches.map(b => (
                  <div 
                    key={b.id}
                    className={`p-3 rounded-lg border-2 cursor-pointer flex justify-between items-center transition-colors ${selectedBatchId === b.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    onClick={() => setSelectedBatchId(b.id)}
                  >
                    <div>
                      <div className="font-black text-slate-800 text-sm">{b.code}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Vence: {b.expiration_date || 'S/F'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-lg text-slate-900">{b.quantity_current}</div>
                      <div className="text-[10px] text-slate-400 font-bold">Stock Base</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {selectedProduct && batches.length === 0 && (
            <div className="bg-orange-50 text-orange-700 p-4 rounded-lg text-sm font-bold flex items-center border border-orange-200 mt-4">
              <AlertCircle className="w-5 h-5 mr-2" /> No hay stock disponible de este producto en el almacén de origen.
            </div>
          )}
        </div>

        {/* EJECUCIÓN DE TRASLADO */}
        {selectedBatchId && selectedBatch && (
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col justify-center">
            <h3 className="font-black text-slate-800 mb-4 flex items-center">
              <ArrowRightLeft className="w-5 h-5 mr-2 text-blue-600" /> Parámetros del Traslado
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Motivo del Traslado</label>
                <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-sm font-bold bg-white focus:border-blue-500 outline-none" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="DAÑADO_MERMA">Producto Dañado / Roto</option>
                  <option value="VENCIMIENTO">Producto Vencido</option>
                  <option value="DEFECTO_FABRICA">Defecto de Fábrica</option>
                  <option value="OTROS">Otros</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Unidad de Medida</label>
                  <div className="flex bg-slate-200 p-1 rounded-lg">
                    <button 
                      className={`flex-1 py-2 text-xs font-black rounded shadow-sm transition-colors ${unitType === 'BASE' ? 'bg-white text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                      onClick={() => setUnitType('BASE')}
                    >
                      UND
                    </button>
                    {isPackageAllowed && (
                      <button 
                        className={`flex-1 py-2 text-xs font-black rounded shadow-sm transition-colors ${unitType === 'PACKAGE' ? 'bg-white text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setUnitType('PACKAGE')}
                      >
                        CAJAS
                      </button>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Cantidad a Trasladar</label>
                  <input 
                    type="number"
                    min="1"
                    max={maxAllowedQty}
                    className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-xl font-black text-center focus:border-blue-500 outline-none text-slate-900"
                    value={transferQty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) setTransferQty(val);
                      else setTransferQty('');
                    }}
                  />
                  <div className="text-[10px] text-right font-bold text-slate-400 mt-1">Máximo: {maxAllowedQty} {unitType === 'PACKAGE' ? 'Cajas' : 'Unidades'}</div>
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-slate-200">
                <button 
                  onClick={handleTransfer}
                  disabled={isProcessing || !transferQty || transferQty <= 0 || transferQty > maxAllowedQty}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500 text-white p-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center transition-colors shadow-lg shadow-red-600/30 active:scale-[0.98]"
                >
                  {isProcessing ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Trash2 className="w-5 h-5 mr-2" />}
                  {isProcessing ? 'Procesando...' : 'Confirmar Traslado Definitivo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
