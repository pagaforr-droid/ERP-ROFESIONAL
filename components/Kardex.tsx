
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Product, Batch } from '../types';
import { Package, ArrowUpRight, ArrowDownLeft, Search, Filter, Calendar, BarChart3, FileText, Layers, RefreshCw, Printer, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type ViewTab = 'INVENTORY' | 'MOVEMENTS' | 'BATCHES' | 'ANALYTICS';

interface Movement {
  id: string;
  date: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  docType: string;
  docNumber: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reference: string; // Proveedor o Cliente
}

export const Kardex: React.FC = () => {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<ViewTab>('INVENTORY');
  
  // --- FILTERS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterSupplier, setFilterSupplier] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // --- DATA COMPUTATION ---

  // 1. INVENTORY SUMMARY (Snapshot)
  const inventorySnapshot = useMemo(() => {
    return store.products.map(p => {
       const productBatches = store.batches.filter(b => b.product_id === p.id && b.quantity_current > 0);
       const totalStock = productBatches.reduce((acc, b) => acc + b.quantity_current, 0);
       // Weighted Average Cost Calculation
       const totalValue = productBatches.reduce((acc, b) => acc + (b.quantity_current * b.cost), 0);
       const avgCost = totalStock > 0 ? totalValue / totalStock : p.last_cost;

       return {
          ...p,
          totalStock,
          avgCost,
          totalValue,
          supplierName: store.suppliers.find(s => s.id === p.supplier_id)?.name || 'Varios'
       };
    }).filter(p => {
       const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.includes(searchTerm);
       const matchCat = filterCategory === 'ALL' || p.category === filterCategory;
       const matchSup = filterSupplier === 'ALL' || p.supplier_id === filterSupplier;
       return matchSearch && matchCat && matchSup;
    }).sort((a,b) => b.totalValue - a.totalValue);
  }, [store.products, store.batches, searchTerm, filterCategory, filterSupplier]);

  // 2. MOVEMENTS (Timeline)
  const movements = useMemo(() => {
     const list: Movement[] = [];

     // A. PURCHASES (IN)
     store.purchases.forEach(p => {
        if (p.issue_date < dateFrom || p.issue_date > dateTo) return;
        p.items.forEach(item => {
           const prod = store.products.find(x => x.id === item.product_id);
           if (!prod) return;
           // Apply Filters
           if (searchTerm && !prod.name.toLowerCase().includes(searchTerm.toLowerCase())) return;
           
           list.push({
              id: `PUR-${p.id}-${item.product_id}`,
              date: p.issue_date,
              type: 'IN',
              docType: 'COMPRA',
              docNumber: p.document_number,
              productName: prod.name,
              sku: prod.sku,
              quantity: item.quantity_base,
              // FIX: Use Total Cost (Inc IGV) / Base Quantity to get the displayed Unit Price (Gross)
              // This ensures Quantity * UnitPrice = Total displayed
              unitPrice: item.quantity_base > 0 ? item.total_cost / item.quantity_base : 0, 
              total: item.total_cost,
              reference: p.supplier_name
           });
        });
     });

     // B. SALES (OUT)
     store.sales.forEach(s => {
        const date = s.created_at.split('T')[0];
        if (date < dateFrom || date > dateTo || s.status === 'canceled') return;
        
        s.items.forEach(item => {
           const prod = store.products.find(x => x.id === item.product_id);
           if (!prod) return;
           // Apply Filters
           if (searchTerm && !prod.name.toLowerCase().includes(searchTerm.toLowerCase())) return;

           list.push({
              id: `SALE-${s.id}-${item.id}`,
              date: date,
              type: 'OUT',
              docType: s.document_type,
              docNumber: `${s.series}-${s.number}`,
              productName: prod.name,
              sku: prod.sku,
              quantity: item.quantity_base, // Sold base units
              // FIX: Consistent calculation for Sales too
              unitPrice: item.quantity_base > 0 ? item.total_price / item.quantity_base : 0,
              total: item.total_price,
              reference: s.client_name
           });
        });
     });

     // C. RETURNS (IN via NC) - From Dispatch Liquidations
     store.dispatchLiquidations.forEach(liq => {
        const date = liq.date.split('T')[0];
        if (date < dateFrom || date > dateTo) return;

        liq.documents.forEach(doc => {
           if (doc.action === 'PARTIAL_RETURN' || doc.action === 'VOID') {
              const sale = store.sales.find(s => s.id === doc.sale_id);
              
              // If VOID, all items returned
              if (doc.action === 'VOID' && sale) {
                 sale.items.forEach(item => {
                    const prod = store.products.find(x => x.id === item.product_id);
                    if (!prod || (searchTerm && !prod.name.toLowerCase().includes(searchTerm.toLowerCase()))) return;
                    list.push({
                       id: `VOID-${doc.sale_id}-${item.id}`,
                       date, type: 'IN', docType: 'ANULACION', docNumber: `${sale.series}-${sale.number}`,
                       productName: prod.name, sku: prod.sku, quantity: item.quantity_base, unitPrice: 0, total: 0, reference: 'REINGRESO ALMACEN'
                    });
                 });
              }
              // If Partial, specific items
              if (doc.action === 'PARTIAL_RETURN') {
                 doc.returned_items.forEach(ret => {
                    const prod = store.products.find(x => x.id === ret.product_id);
                    if (!prod || (searchTerm && !prod.name.toLowerCase().includes(searchTerm.toLowerCase()))) return;
                    list.push({
                       id: `RET-${doc.sale_id}-${ret.product_id}`,
                       date, type: 'IN', docType: 'NOTA CREDITO', docNumber: doc.credit_note_series || 'NC-000',
                       productName: prod.name, sku: prod.sku, quantity: ret.quantity_base, 
                       unitPrice: ret.quantity_base > 0 ? ret.total_refund / ret.quantity_base : 0, 
                       total: ret.total_refund, reference: sale?.client_name || 'CLIENTE'
                    });
                 });
              }
           }
        });
     });

     return list.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [store.sales, store.purchases, store.dispatchLiquidations, store.products, dateFrom, dateTo, searchTerm]);

  // --- ANALYTICS DATA ---
  const analyticsData = useMemo(() => {
     const byCategory: Record<string, number> = {};
     const bySupplier: Record<string, number> = {};
     
     inventorySnapshot.forEach(p => {
        byCategory[p.category] = (byCategory[p.category] || 0) + p.totalValue;
        bySupplier[p.supplierName] = (bySupplier[p.supplierName] || 0) + p.totalValue;
     });

     const catChart = Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6);
     const supChart = Object.entries(bySupplier).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6);

     return { catChart, supChart, totalValuation: inventorySnapshot.reduce((acc, i) => acc + i.totalValue, 0) };
  }, [inventorySnapshot]);

  // --- COLORS ---
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // --- HELPERS ---
  const uniqueCategories = Array.from(new Set(store.products.map(p => p.category))).sort() as string[];

  return (
    <div className="flex flex-col h-full space-y-4 font-sans text-slate-800">
       
       {/* HEADER */}
       <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                <Package className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-900">Kardex & Inventarios</h2>
                <p className="text-xs text-slate-500">Control de stock, movimientos y valorización</p>
             </div>
          </div>
          <div className="flex bg-white border border-slate-200 rounded-lg p-1">
             <button onClick={() => setActiveTab('INVENTORY')} className={`px-4 py-2 text-xs font-bold rounded flex items-center transition-all ${activeTab === 'INVENTORY' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Layers className="w-4 h-4 mr-2" /> Inventario Físico
             </button>
             <button onClick={() => setActiveTab('MOVEMENTS')} className={`px-4 py-2 text-xs font-bold rounded flex items-center transition-all ${activeTab === 'MOVEMENTS' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                <RefreshCw className="w-4 h-4 mr-2" /> Kardex Movimientos
             </button>
             <button onClick={() => setActiveTab('BATCHES')} className={`px-4 py-2 text-xs font-bold rounded flex items-center transition-all ${activeTab === 'BATCHES' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Calendar className="w-4 h-4 mr-2" /> Lotes y Vencimientos
             </button>
             <button onClick={() => setActiveTab('ANALYTICS')} className={`px-4 py-2 text-xs font-bold rounded flex items-center transition-all ${activeTab === 'ANALYTICS' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                <BarChart3 className="w-4 h-4 mr-2" /> Reportes Estratégicos
             </button>
          </div>
       </div>

       {/* GLOBAL FILTERS */}
       <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-wrap gap-4 items-end">
             <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold text-slate-600 mb-1">Buscar Producto / SKU</label>
                <div className="relative">
                   <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                   <input 
                      className="w-full pl-8 border border-slate-300 p-2 rounded text-sm focus:ring-1 focus:ring-orange-500 outline-none" 
                      placeholder="Ej. Whisky, 1050..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                   />
                </div>
             </div>
             
             {activeTab !== 'MOVEMENTS' && (
                <>
                   <div className="w-48">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Filtrar Categoría</label>
                      <select className="w-full border border-slate-300 p-2 rounded text-sm" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                         <option value="ALL">Todas las Categorías</option>
                         {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                   <div className="w-48">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Filtrar Proveedor</label>
                      <select className="w-full border border-slate-300 p-2 rounded text-sm" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
                         <option value="ALL">Todos los Proveedores</option>
                         {store.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                   </div>
                </>
             )}

             {activeTab === 'MOVEMENTS' && (
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded border border-slate-200">
                   <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                   <input type="date" className="bg-transparent border-none text-xs font-bold text-slate-600" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                   <span className="text-slate-300">-</span>
                   <input type="date" className="bg-transparent border-none text-xs font-bold text-slate-600" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
             )}

             <button onClick={() => window.print()} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded font-bold shadow-sm hover:bg-slate-50 flex items-center">
                <Printer className="w-4 h-4 mr-2" /> Exportar
             </button>
          </div>
       </div>

       {/* CONTENT AREA */}
       <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          
          {/* TAB: INVENTORY */}
          {activeTab === 'INVENTORY' && (
             <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                         <th className="p-3">Código</th>
                         <th className="p-3">Producto</th>
                         <th className="p-3">Categoría / Marca</th>
                         <th className="p-3 text-right">Stock Total</th>
                         <th className="p-3 text-right">Costo Prom.</th>
                         <th className="p-3 text-right text-blue-700">Valor Total</th>
                         <th className="p-3 text-center">Estado</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {inventorySnapshot.map(p => (
                         <tr key={p.id} className="hover:bg-slate-50 group">
                            <td className="p-3 font-mono text-slate-600 font-bold">{p.sku}</td>
                            <td className="p-3">
                               <div className="font-bold text-slate-800">{p.name}</div>
                               <div className="text-[10px] text-slate-500">{p.supplierName}</div>
                            </td>
                            <td className="p-3 text-xs">
                               <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200 mr-1">{p.category}</span>
                               <span className="text-slate-400">{p.brand}</span>
                            </td>
                            <td className="p-3 text-right font-bold text-lg">
                               {p.totalStock} <span className="text-[10px] font-normal text-slate-400">Und</span>
                            </td>
                            <td className="p-3 text-right font-mono text-slate-600">S/ {p.avgCost.toFixed(2)}</td>
                            <td className="p-3 text-right font-bold text-blue-700">S/ {p.totalValue.toFixed(2)}</td>
                            <td className="p-3 text-center">
                               {p.totalStock <= p.min_stock ? (
                                  <span className="flex items-center justify-center text-red-600 text-[10px] font-bold bg-red-50 px-2 py-1 rounded border border-red-100 animate-pulse">
                                     <AlertTriangle className="w-3 h-3 mr-1" /> BAJO STOCK
                                  </span>
                               ) : (
                                  <span className="text-green-600 text-[10px] font-bold bg-green-50 px-2 py-1 rounded border border-green-100">
                                     OPTIMO
                                  </span>
                               )}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                   <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                      <tr>
                         <td colSpan={5} className="p-3 text-right uppercase text-slate-600">Total Valorizado Almacén:</td>
                         <td className="p-3 text-right text-blue-800 text-lg">S/ {inventorySnapshot.reduce((a,b)=>a+b.totalValue, 0).toLocaleString()}</td>
                         <td></td>
                      </tr>
                   </tfoot>
                </table>
             </div>
          )}

          {/* TAB: MOVEMENTS (KARDEX) */}
          {activeTab === 'MOVEMENTS' && (
             <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                         <th className="p-3 w-32">Fecha</th>
                         <th className="p-3 w-24 text-center">Tipo</th>
                         <th className="p-3">Documento</th>
                         <th className="p-3">Producto</th>
                         <th className="p-3 text-right">Cant.</th>
                         <th className="p-3 text-right">Precio Unit</th>
                         <th className="p-3 text-right">Total</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {movements.map((m, idx) => (
                         <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-600 font-mono text-xs">{m.date}</td>
                            <td className="p-3 text-center">
                               {m.type === 'IN' ? (
                                  <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center justify-center w-fit mx-auto border border-green-200">
                                     <ArrowDownLeft className="w-3 h-3 mr-1" /> ENTRADA
                                  </span>
                               ) : (
                                  <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center justify-center w-fit mx-auto border border-red-200">
                                     <ArrowUpRight className="w-3 h-3 mr-1" /> SALIDA
                                  </span>
                               )}
                            </td>
                            <td className="p-3 text-xs">
                               <div className="font-bold text-slate-700">{m.docType} {m.docNumber}</div>
                               <div className="text-slate-500 truncate max-w-[150px]">{m.reference}</div>
                            </td>
                            <td className="p-3">
                               <div className="font-bold text-slate-800">{m.productName}</div>
                               <div className="text-[10px] text-slate-400 font-mono">SKU: {m.sku}</div>
                            </td>
                            <td className={`p-3 text-right font-bold ${m.type === 'IN' ? 'text-green-700' : 'text-red-700'}`}>
                               {m.type === 'IN' ? '+' : '-'}{m.quantity}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-600">
                               {m.unitPrice > 0 ? `S/ ${m.unitPrice.toFixed(2)}` : '-'}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-800">
                               {m.total > 0 ? `S/ ${m.total.toFixed(2)}` : '-'}
                            </td>
                         </tr>
                      ))}
                      {movements.length === 0 && (
                         <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No hay movimientos en el rango de fechas seleccionado.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
          )}

          {/* TAB: BATCHES (LOTES) */}
          {activeTab === 'BATCHES' && (
             <div className="flex-1 overflow-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {store.products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => {
                      const batches = store.batches.filter(b => b.product_id === product.id && b.quantity_current > 0).sort((a,b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());
                      if (batches.length === 0) return null;

                      return (
                         <div key={product.id} className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                               <div>
                                  <h4 className="font-bold text-slate-800 text-sm">{product.name}</h4>
                                  <p className="text-xs text-slate-500 font-mono">{product.sku}</p>
                               </div>
                               <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded font-bold">
                                  {batches.reduce((a,b)=>a+b.quantity_current,0)} Und
                               </span>
                            </div>
                            
                            <div className="space-y-2 mt-2 flex-1">
                               {batches.map(batch => {
                                  const daysLeft = Math.ceil((new Date(batch.expiration_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                  const isExpiring = daysLeft < 30;
                                  return (
                                     <div key={batch.id} className={`text-xs p-2 rounded border flex justify-between items-center ${isExpiring ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                                        <div>
                                           <div className="font-bold text-slate-700">Lote: {batch.code}</div>
                                           <div className={`text-[10px] ${isExpiring ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                                              Vence: {batch.expiration_date} ({daysLeft} días)
                                           </div>
                                        </div>
                                        <div className="text-right">
                                           <div className="font-bold text-slate-900">{batch.quantity_current} Und</div>
                                           <div className="text-[9px] text-slate-400">Ini: {batch.quantity_initial}</div>
                                        </div>
                                     </div>
                                  );
                               })}
                            </div>
                         </div>
                      );
                   })}
                </div>
             </div>
          )}

          {/* TAB: ANALYTICS */}
          {activeTab === 'ANALYTICS' && (
             <div className="flex-1 overflow-auto p-6 animate-fade-in-up">
                <div className="grid grid-cols-3 gap-6 mb-8">
                   <div className="bg-slate-800 text-white p-6 rounded-lg shadow-lg">
                      <p className="text-slate-400 text-xs font-bold uppercase mb-1">Valorización Total Inventario</p>
                      <h3 className="text-3xl font-bold">S/ {analyticsData.totalValuation.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                   </div>
                   <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                      <p className="text-slate-500 text-xs font-bold uppercase mb-1">Productos Activos</p>
                      <h3 className="text-3xl font-bold text-slate-800">{inventorySnapshot.length}</h3>
                   </div>
                   <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                      <p className="text-slate-500 text-xs font-bold uppercase mb-1">Productos Bajo Stock</p>
                      <h3 className="text-3xl font-bold text-red-600">{inventorySnapshot.filter(p => p.totalStock <= p.min_stock).length}</h3>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-8 h-80">
                   <div className="bg-white p-4 rounded-lg shadow border border-slate-200 flex flex-col">
                      <h4 className="font-bold text-slate-700 mb-4 text-center">Inversión por Categoría</h4>
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={analyticsData.catChart} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                               {analyticsData.catChart.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                               ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `S/ ${value.toLocaleString()}`} />
                            <Legend />
                         </PieChart>
                      </ResponsiveContainer>
                   </div>

                   <div className="bg-white p-4 rounded-lg shadow border border-slate-200 flex flex-col">
                      <h4 className="font-bold text-slate-700 mb-4 text-center">Top Proveedores (Valor Stock)</h4>
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={analyticsData.supChart} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                            <Tooltip formatter={(value: number) => `S/ ${value.toLocaleString()}`} cursor={{fill: 'transparent'}} />
                            <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]}>
                               {analyticsData.supChart.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                               ))}
                            </Bar>
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
             </div>
          )}

       </div>
    </div>
  );
};
