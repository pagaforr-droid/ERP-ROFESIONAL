
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { BarChart3, PieChart, Calendar, Download, Printer, Filter, TrendingUp, DollarSign, Users, Target, Layers, ShoppingBag, MapPin, X } from 'lucide-react';

// --- TYPES ---
type Dimension = 'SELLER' | 'CLIENT' | 'SUPPLIER' | 'CATEGORY' | 'BRAND' | 'ZONE' | 'MONTH';
type Tab = 'HISTORICAL' | 'PROJECTION';

interface AggregatedRow {
  id: string;
  label: string;
  value: number; // Primary Metric (Sales)
  cost: number;
  margin: number;
  clients: Set<string>; // For Coverage
  itemsSold: number;
  percentage: number; 
}

export const StrategicReports: React.FC = () => {
  const store = useStore();
  
  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<Tab>('HISTORICAL');
  const [viewType, setViewType] = useState<'TABLE' | 'CHART'>('TABLE');
  
  // --- DATE FILTERS ---
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]); // Start of current month
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  
  // --- DIMENSIONAL FILTERS (DRILL-DOWN) ---
  const [filterSeller, setFilterSeller] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterZone, setFilterZone] = useState('');

  // --- CONFIG ---
  const [groupBy, setGroupBy] = useState<Dimension>('SELLER');
  const [projectionGoal, setProjectionGoal] = useState<number>(50000); // Default Goal

  // --- ENGINE: CORE AGGREGATION LOGIC ---
  const processedData = useMemo(() => {
    // 1. Base Filter (Header Level: Dates & Sales Status)
    const validSales = store.sales.filter(s => {
       const date = s.created_at.split('T')[0];
       const isValidDate = date >= dateFrom && date <= dateTo;
       const isValidStatus = s.status !== 'canceled';
       
       // Header Level Filters (Seller & Zone linked to Client)
       const client = store.clients.find(c => c.id === s.client_id) || store.clients.find(c => c.doc_number === s.client_ruc);
       const zone = store.zones.find(z => z.id === client?.zone_id);
       
       const matchesSeller = !filterSeller || zone?.assigned_seller_id === filterSeller;
       const matchesZone = !filterZone || zone?.id === filterZone;

       return isValidDate && isValidStatus && matchesSeller && matchesZone;
    });

    // 2. Item Level Iteration & Grouping
    const groups: Record<string, AggregatedRow> = {};
    const uniqueClientsGlobal = new Set<string>();
    let totalGlobalSales = 0;
    let totalGlobalCost = 0;

    validSales.forEach(sale => {
       const client = store.clients.find(c => c.id === sale.client_id) || store.clients.find(c => c.doc_number === sale.client_ruc);
       const zone = store.zones.find(z => z.id === client?.zone_id);
       const seller = store.sellers.find(s => s.id === zone?.assigned_seller_id);

       // Iterate Items to apply Product Level Filters (Supplier / Category)
       sale.items.forEach(item => {
          const product = store.products.find(p => p.id === item.product_id);
          
          // --- ITEM FILTERS ---
          if (filterSupplier && product?.supplier_id !== filterSupplier) return;
          if (filterCategory && product?.category !== filterCategory) return;

          // --- IF MATCHES FILTERS, PROCESS ---
          
          // Determine Group Key
          let key = 'UNKNOWN';
          let label = 'Otros';

          switch (groupBy) {
             case 'SELLER':
                key = seller?.id || 'DIRECT';
                label = seller?.name || 'VENTA DIRECTA';
                break;
             case 'CLIENT':
                key = client?.id || sale.client_ruc;
                label = sale.client_name;
                break;
             case 'SUPPLIER':
                const sup = store.suppliers.find(s => s.id === product?.supplier_id);
                key = sup?.id || 'UNKNOWN';
                label = sup?.name || 'SIN PROVEEDOR';
                break;
             case 'CATEGORY':
                key = product?.category || 'OTROS';
                label = product?.category || 'OTROS';
                break;
             case 'BRAND':
                key = product?.brand || 'OTROS';
                label = product?.brand || 'OTROS';
                break;
             case 'ZONE':
                key = zone?.id || 'UNKNOWN';
                label = zone?.name || 'SIN ZONA';
                break;
             case 'MONTH':
                const d = new Date(sale.created_at);
                key = `${d.getFullYear()}-${d.getMonth()}`;
                label = d.toLocaleString('es-PE', { month: 'long', year: 'numeric' }).toUpperCase();
                break;
          }

          // Calculate Item Financials
          // Note: sale.total includes IGV. item.total_price includes IGV.
          const itemSaleValue = item.total_price;
          const itemCostValue = (product?.last_cost || 0) * (item.quantity_base || 0); // Cost usually Ex-IGV
          // Adjust cost to Inc-IGV for margin comparison equality or strip IGV from Sale. 
          // Best practice: Margin = (NetSale - Cost) / NetSale. 
          // Here simplistic: Sale(Inc) - (Cost(Ex) * 1.18) approx.
          
          // Init Group
          if (!groups[key]) {
             groups[key] = { id: key, label, value: 0, cost: 0, margin: 0, clients: new Set(), itemsSold: 0, percentage: 0 };
          }

          // Accumulate
          groups[key].value += itemSaleValue;
          groups[key].cost += itemCostValue;
          groups[key].itemsSold += item.quantity_presentation;
          groups[key].clients.add(sale.client_ruc); // Add client to this group's coverage

          // Globals (Only add if item matched filters)
          uniqueClientsGlobal.add(sale.client_ruc);
          totalGlobalSales += itemSaleValue;
          totalGlobalCost += itemCostValue;
       });
    });

    // 3. Finalize Calculations (Percentages & Arrays)
    const result = Object.values(groups).map(g => ({
       ...g,
       margin: g.value - (g.cost * 1.18), // Gross Profit Approx
       percentage: totalGlobalSales > 0 ? (g.value / totalGlobalSales) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    return {
       rows: result,
       kpis: {
          totalSales: totalGlobalSales,
          totalCost: totalGlobalCost,
          grossMargin: totalGlobalSales - (totalGlobalCost * 1.18),
          uniqueClients: uniqueClientsGlobal.size,
          itemsSold: result.reduce((acc, r) => acc + r.itemsSold, 0)
       }
    };
  }, [store.sales, dateFrom, dateTo, filterSeller, filterSupplier, filterCategory, filterZone, groupBy, store.clients, store.products, store.sellers, store.zones, store.suppliers]);

  // --- PROJECTION ENGINE ---
  const projectionData = useMemo(() => {
     if (activeTab !== 'PROJECTION') return null;

     const today = new Date();
     const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
     const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
     
     // Only consider sales from current month for run rate
     // Re-use logic but strictly for current month date range regardless of filter
     const currentMonthSales = processedData.kpis.totalSales; // Assuming user filtered for current month, or we force it.
     // For safety, let's assume the user selects "This Month" in filters for projection to make sense, 
     // OR we calculate Days Passed based on the selected `dateTo` - `dateFrom`.
     
     const start = new Date(dateFrom);
     const end = new Date(dateTo);
     const totalDaysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
     
     // Calculate days passed (limited to today if range extends to future)
     const now = new Date();
     let daysPassed = 0;
     
     if (end < now) {
        daysPassed = totalDaysInRange; // Past period
     } else if (start > now) {
        daysPassed = 0; // Future period
     } else {
        // Current running period
        daysPassed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 3600 * 24));
     }
     
     const dailyRunRate = daysPassed > 0 ? currentMonthSales / daysPassed : 0;
     const projectedSales = dailyRunRate * totalDaysInRange;
     const percentageOfGoal = (projectedSales / projectionGoal) * 100;

     return {
        currentSales: currentMonthSales,
        daysPassed,
        totalDays: totalDaysInRange,
        dailyAverage: dailyRunRate,
        projectedTotal: projectedSales,
        gap: projectionGoal - projectedSales,
        percentage: percentageOfGoal
     };

  }, [processedData, dateFrom, dateTo, projectionGoal, activeTab]);

  // --- HELPERS ---
  const clearFilters = () => {
     setFilterSeller('');
     setFilterSupplier('');
     setFilterCategory('');
     setFilterZone('');
  };

  const getUniqueCategories = () => Array.from(new Set(store.products.map(p => p.category))).sort() as string[];

  return (
    <div className="flex flex-col h-full space-y-4 font-sans text-slate-800">
       
       {/* --- TOP BAR: TITLE & TABS --- */}
       <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-slate-900 rounded-lg text-white">
                <PieChart className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-900">Inteligencia Comercial</h2>
                <p className="text-xs text-slate-500">Reportes Estratégicos y Proyecciones</p>
             </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
             <button 
                onClick={() => setActiveTab('HISTORICAL')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center ${activeTab === 'HISTORICAL' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <Layers className="w-4 h-4 mr-2" /> Histórico & Cubos
             </button>
             <button 
                onClick={() => setActiveTab('PROJECTION')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center ${activeTab === 'PROJECTION' ? 'bg-white shadow text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <TrendingUp className="w-4 h-4 mr-2" /> Proyección (Forecast)
             </button>
          </div>
       </div>

       {/* --- FILTERS AREA (Common for both tabs) --- */}
       <div className="bg-slate-800 text-white p-4 rounded-lg shadow-lg">
          <div className="flex flex-wrap gap-4 items-end">
             {/* Date Range */}
             <div className="flex items-center gap-2 bg-slate-700 p-1.5 rounded border border-slate-600">
                <Calendar className="w-4 h-4 text-slate-400 ml-1" />
                <input type="date" className="bg-transparent border-none text-xs font-bold text-white focus:ring-0 w-24" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <span className="text-slate-400">-</span>
                <input type="date" className="bg-transparent border-none text-xs font-bold text-white focus:ring-0 w-24" value={dateTo} onChange={e => setDateTo(e.target.value)} />
             </div>

             {/* Dimension Filters */}
             <div className="flex-1 grid grid-cols-4 gap-2">
                <select className="bg-slate-700 border border-slate-600 rounded text-xs p-2 focus:ring-1 focus:ring-accent outline-none" value={filterSeller} onChange={e => setFilterSeller(e.target.value)}>
                   <option value="">Todos Vendedores</option>
                   {store.sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="bg-slate-700 border border-slate-600 rounded text-xs p-2 focus:ring-1 focus:ring-accent outline-none" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
                   <option value="">Todos Proveedores</option>
                   {store.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="bg-slate-700 border border-slate-600 rounded text-xs p-2 focus:ring-1 focus:ring-accent outline-none" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                   <option value="">Todas Categorías</option>
                   {getUniqueCategories().map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="bg-slate-700 border border-slate-600 rounded text-xs p-2 focus:ring-1 focus:ring-accent outline-none" value={filterZone} onChange={e => setFilterZone(e.target.value)}>
                   <option value="">Todas Zonas</option>
                   {store.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
             </div>

             {/* Clear Button */}
             {(filterSeller || filterSupplier || filterCategory || filterZone) && (
                <button onClick={clearFilters} className="text-red-400 hover:text-red-300 p-2" title="Limpiar Filtros">
                   <X className="w-5 h-5" />
                </button>
             )}
          </div>
       </div>

       {/* --- CONTENT AREA --- */}
       <div className="flex-1 overflow-hidden flex flex-col">
          
          {activeTab === 'HISTORICAL' && (
             <>
               {/* KPIs ROW */}
               <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-600 flex justify-between items-center">
                     <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Ventas Filtradas</p>
                        <h3 className="text-2xl font-bold text-slate-800">S/ {processedData.kpis.totalSales.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                     </div>
                     <DollarSign className="w-8 h-8 text-blue-100" />
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500 flex justify-between items-center">
                     <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Cobertura (Clientes)</p>
                        <h3 className="text-2xl font-bold text-slate-800">{processedData.kpis.uniqueClients}</h3>
                        <p className="text-[10px] text-slate-400">Clientes únicos alcanzados</p>
                     </div>
                     <Users className="w-8 h-8 text-purple-100" />
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500 flex justify-between items-center">
                     <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Margen Bruto (Est)</p>
                        <h3 className="text-2xl font-bold text-slate-800">S/ {processedData.kpis.grossMargin.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                        <p className="text-[10px] text-green-600 font-bold">{processedData.kpis.totalSales > 0 ? ((processedData.kpis.grossMargin / (processedData.kpis.totalSales / 1.18)) * 100).toFixed(1) : 0}% Rentabilidad</p>
                     </div>
                     <TrendingUp className="w-8 h-8 text-green-100" />
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-orange-500 flex justify-between items-center">
                     <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Unidades / Bultos</p>
                        <h3 className="text-2xl font-bold text-slate-800">{processedData.kpis.itemsSold.toLocaleString()}</h3>
                        <p className="text-[10px] text-slate-400">Total items movidos</p>
                     </div>
                     <ShoppingBag className="w-8 h-8 text-orange-100" />
                  </div>
               </div>

               {/* MAIN TABLE/CHART CONTAINER */}
               <div className="flex-1 bg-white rounded-lg shadow border border-slate-200 flex flex-col overflow-hidden">
                  {/* Toolbar */}
                  <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                     <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-700">Agrupar resultados por:</span>
                        <select 
                           className="bg-white border border-slate-300 rounded text-sm p-1.5 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                           value={groupBy}
                           onChange={e => setGroupBy(e.target.value as Dimension)}
                        >
                           <option value="SELLER">Vendedor</option>
                           <option value="SUPPLIER">Proveedor</option>
                           <option value="CATEGORY">Categoría</option>
                           <option value="BRAND">Marca</option>
                           <option value="CLIENT">Cliente</option>
                           <option value="ZONE">Zona</option>
                           <option value="MONTH">Mes (Tendencia)</option>
                        </select>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => setViewType('TABLE')} className={`p-1.5 rounded ${viewType === 'TABLE' ? 'bg-slate-200 text-slate-800' : 'text-slate-400'}`}><Filter className="w-4 h-4"/></button>
                        <button onClick={() => setViewType('CHART')} className={`p-1.5 rounded ${viewType === 'CHART' ? 'bg-slate-200 text-slate-800' : 'text-slate-400'}`}><BarChart3 className="w-4 h-4"/></button>
                        <div className="w-px h-6 bg-slate-300 mx-1"></div>
                        <button onClick={() => window.print()} className="flex items-center gap-1 text-slate-600 hover:text-slate-900 text-xs font-bold px-2 py-1 bg-white border border-slate-300 rounded">
                           <Printer className="w-3 h-3" /> Imprimir
                        </button>
                     </div>
                  </div>

                  {/* Visualization */}
                  <div className="flex-1 overflow-auto p-0">
                     {processedData.rows.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                           <Filter className="w-12 h-12 mb-2 opacity-20" />
                           <p>No hay datos para mostrar con los filtros actuales.</p>
                        </div>
                     ) : viewType === 'TABLE' ? (
                        <table className="w-full text-sm text-left">
                           <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                              <tr>
                                 <th className="p-3 w-10 text-center">#</th>
                                 <th className="p-3">{groupBy === 'SELLER' ? 'Vendedor' : groupBy === 'CLIENT' ? 'Cliente' : groupBy === 'SUPPLIER' ? 'Proveedor' : 'Etiqueta'}</th>
                                 <th className="p-3 text-right">Venta Total (S/)</th>
                                 <th className="p-3 text-right text-blue-700">Participación</th>
                                 <th className="p-3 text-center">Cobertura (Clientes)</th>
                                 <th className="p-3 text-right">Rentabilidad</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {processedData.rows.map((row, idx) => (
                                 <tr key={row.id} className="hover:bg-blue-50 group transition-colors">
                                    <td className="p-3 text-center text-slate-500">{idx + 1}</td>
                                    <td className="p-3 font-medium text-slate-800">{row.label}</td>
                                    <td className="p-3 text-right font-bold text-slate-900">S/ {row.value.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                                    <td className="p-3">
                                       <div className="flex items-center justify-end gap-2">
                                          <span className="text-xs text-slate-500 w-10 text-right">{row.percentage.toFixed(1)}%</span>
                                          <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                             <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${row.percentage}%` }}></div>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="p-3 text-center">
                                       <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold">
                                          {row.clients.size}
                                       </span>
                                    </td>
                                    <td className="p-3 text-right">
                                       <div className="flex flex-col items-end">
                                          <span className="text-xs font-bold text-green-700">S/ {row.margin.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span>
                                          <span className="text-[10px] text-slate-400">
                                             {row.value > 0 ? ((row.margin / (row.value / 1.18)) * 100).toFixed(1) : 0}%
                                          </span>
                                       </div>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     ) : (
                        <div className="p-6 space-y-4">
                           {processedData.rows.map((row, idx) => (
                              <div key={row.id} className="group">
                                 <div className="flex justify-between items-end mb-1">
                                    <div className="flex items-center gap-2">
                                       <span className="bg-slate-200 text-slate-600 w-5 h-5 flex items-center justify-center rounded text-xs font-bold">{idx + 1}</span>
                                       <span className="font-bold text-slate-700">{row.label}</span>
                                    </div>
                                    <div className="text-right">
                                       <span className="font-bold text-slate-900">S/ {row.value.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                 </div>
                                 <div className="w-full bg-slate-100 h-8 rounded overflow-hidden relative">
                                    <div 
                                       className="h-full bg-blue-600 flex items-center px-2 text-white text-xs font-bold transition-all duration-700" 
                                       style={{ width: `${Math.max(row.percentage, 2)}%` }}
                                    >
                                       {row.percentage > 5 && `${row.percentage.toFixed(1)}%`}
                                    </div>
                                 </div>
                                 <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>Cobertura: {row.clients.size} clientes</span>
                                    <span>Margen: S/ {row.margin.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
             </>
          )}

          {activeTab === 'PROJECTION' && projectionData && (
             <div className="animate-fade-in-up h-full flex flex-col">
                <div className="grid grid-cols-2 gap-6 mb-6">
                   {/* GOAL SETTING */}
                   <div className="bg-slate-800 text-white p-6 rounded-lg shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                         <Target className="w-32 h-32" />
                      </div>
                      <h3 className="text-lg font-bold mb-4 flex items-center"><Target className="mr-2"/> Meta del Periodo (Mes)</h3>
                      <div className="flex items-center gap-4">
                         <div className="bg-white/10 p-2 rounded">
                            <label className="block text-xs text-slate-300 uppercase">Objetivo de Venta (S/)</label>
                            <input 
                               type="number" 
                               className="bg-transparent border-b border-white/30 text-2xl font-bold w-full focus:outline-none focus:border-accent"
                               value={projectionGoal}
                               onChange={e => setProjectionGoal(Number(e.target.value))}
                            />
                         </div>
                         <div className="flex-1 text-right">
                            <p className="text-sm text-slate-300">Venta Actual</p>
                            <p className="text-3xl font-bold text-green-400">S/ {projectionData.currentSales.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</p>
                         </div>
                      </div>
                      <div className="mt-6">
                         <div className="flex justify-between text-xs font-bold mb-1">
                            <span>Progreso: {projectionData.percentage.toFixed(1)}%</span>
                            <span>Faltante: S/ {Math.max(0, projectionData.gap).toLocaleString()}</span>
                         </div>
                         <div className="w-full bg-slate-700 rounded-full h-3">
                            <div 
                               className={`h-3 rounded-full transition-all duration-1000 ${projectionData.percentage >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                               style={{ width: `${Math.min(projectionData.percentage, 100)}%` }}
                            ></div>
                         </div>
                      </div>
                   </div>

                   {/* PROJECTION CARD */}
                   <div className="bg-white p-6 rounded-lg shadow border border-slate-200 flex flex-col justify-center">
                      <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center">
                         <TrendingUp className="mr-2 text-purple-600"/> Proyección Cierre de Mes
                      </h3>
                      <p className="text-sm text-slate-500 mb-6">Basado en el promedio diario actual (Run Rate)</p>
                      
                      <div className="flex justify-between items-end border-b border-slate-100 pb-4 mb-4">
                         <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Promedio Diario</p>
                            <p className="text-2xl font-bold text-slate-700">S/ {projectionData.dailyAverage.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase font-bold">Días Transcurridos</p>
                            <p className="text-xl font-bold text-slate-700">{projectionData.daysPassed} / {projectionData.totalDays}</p>
                         </div>
                      </div>

                      <div>
                         <p className="text-sm text-slate-500 mb-1">Proyección Final Estimada</p>
                         <div className="flex items-center gap-3">
                            <p className={`text-4xl font-bold ${projectionData.projectedTotal >= projectionGoal ? 'text-green-600' : 'text-orange-500'}`}>
                               S/ {projectionData.projectedTotal.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                            </p>
                            {projectionData.projectedTotal >= projectionGoal ? (
                               <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">SUPERAVIT</span>
                            ) : (
                               <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded font-bold">DÉFICIT</span>
                            )}
                         </div>
                      </div>
                   </div>
                </div>

                {/* Explanation */}
                <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-800 flex items-start gap-3">
                   <div className="bg-blue-200 p-1 rounded-full"><MapPin className="w-4 h-4 text-blue-700"/></div>
                   <div>
                      <strong>Nota sobre la Proyección:</strong>
                      <p className="mt-1">
                         El cálculo "Run Rate" toma las ventas acumuladas en el rango de fechas seleccionado y las divide por los días transcurridos para obtener una velocidad diaria. Luego, multiplica esta velocidad por los días totales del periodo para estimar el cierre.
                         <br/>* Ajuste los filtros de fecha para cambiar el periodo de análisis.
                      </p>
                   </div>
                </div>
             </div>
          )}

       </div>
    </div>
  );
};
