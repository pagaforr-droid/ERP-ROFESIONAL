import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Product, Batch } from '../types';
import { Package, AlertCircle, RefreshCw, Search } from 'lucide-react';

interface StockRow {
  product: Product;
  batches: Batch[];
  total_base: number;
}

export const DamagedGoodsStock: React.FC = () => {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchStock = async () => {
    setLoading(true);
    try {
      // Fetch batches in MERMAS
      const { data: batchesData, error: batchesError } = await supabase
        .from('batches')
        .select('*')
        .eq('warehouse_id', 'MERMAS')
        .gt('quantity_current', 0);

      if (batchesError) throw batchesError;

      if (!batchesData || batchesData.length === 0) {
        setStock([]);
        return;
      }

      const productIds = [...new Set(batchesData.map(b => b.product_id))];

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (productsError) throw productsError;

      // Group by product
      const grouped: Record<string, StockRow> = {};
      
      batchesData.forEach(batch => {
        const prod = productsData.find(p => p.id === batch.product_id);
        if (!prod) return;

        if (!grouped[prod.id]) {
          grouped[prod.id] = {
            product: prod,
            batches: [],
            total_base: 0
          };
        }
        
        grouped[prod.id].batches.push(batch);
        grouped[prod.id].total_base += batch.quantity_current;
      });

      // Sort by name
      const rows = Object.values(grouped).sort((a, b) => a.product.name.localeCompare(b.product.name));
      setStock(rows);

    } catch (err: any) {
      console.error('Error fetching MERMAS stock:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const filteredStock = stock.filter(row => 
    row.product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    row.product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-16rem)]">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Stock en Cuarentena / Mermas
          </h2>
          <p className="text-sm text-slate-500">Mercadería aislada del inventario principal.</p>
        </div>
        <div className="flex gap-2">
           <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 w-64"
              />
           </div>
           <button
             onClick={fetchStock}
             className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
             title="Actualizar Stock"
           >
             <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50/50 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
          </div>
        ) : filteredStock.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Package className="w-16 h-16 mb-4 text-slate-300" />
            <p className="text-lg font-medium">El almacén de mermas está vacío</p>
            <p className="text-sm">No hay productos dañados o vencidos registrados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStock.map((row) => {
              const p = row.product;
              // Format quantity
              let formattedQty = `${row.total_base} UND`;
              if (p.package_content && p.package_content > 1) {
                const boxes = Math.floor(row.total_base / p.package_content);
                const remainder = row.total_base % p.package_content;
                if (boxes > 0) {
                   formattedQty = `${boxes} CAJA(S) ${remainder > 0 ? ` + ${remainder} UND` : ''}`;
                }
              }

              return (
                <div key={p.id} className="bg-white border border-red-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-xs font-mono bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100">
                      {p.sku}
                    </div>
                    <div className="font-bold text-red-600 text-lg">
                      {formattedQty}
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-800 line-clamp-2 min-h-[3rem] mb-2">{p.name}</h3>
                  
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Lotes ({row.batches.length})</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                      {row.batches.map(b => (
                        <div key={b.id} className="flex justify-between text-xs bg-slate-50 p-1.5 rounded border border-slate-100">
                          <span className="font-mono text-slate-600">{b.code || 'SIN LOTE'}</span>
                          <div className="flex gap-3 text-slate-500">
                            <span>Venc: {b.expiration_date ? new Date(b.expiration_date).toLocaleDateString() : 'N/A'}</span>
                            <span className="font-bold text-slate-700">{b.quantity_current} UND</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
