import React, { useState, useMemo, useEffect } from 'react';
import { supabase, USE_MOCK_DB } from '../services/supabase';
import { Product, Batch, Purchase, Sale, DispatchLiquidation } from '../types';
import { Package, ArrowUpRight, ArrowDownLeft, Search, Filter, Calendar, BarChart3, FileText, Layers, RefreshCw, Printer, AlertTriangle, ArrowUpDown, FileDown, Plus, DollarSign, Hash, Briefcase, CheckCircle, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  reference: string;
}

export const Kardex: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ViewTab>('INVENTORY');
  const [isDataVisible, setIsDataVisible] = useState(false); // <--- NUEVO ESTADO DE RENDIMIENTO
  
  // --- ESTADOS SUPABASE ---
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [dbBatches, setDbBatches] = useState<Batch[]>([]);
  const [dbSuppliers, setDbSuppliers] = useState<any[]>([]);
  const [dbPurchases, setDbPurchases] = useState<Purchase[]>([]);
  const [dbSales, setDbSales] = useState<Sale[]>([]);
  const [dbLiquidations, setDbLiquidations] = useState<DispatchLiquidation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
     fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
     if (!USE_MOCK_DB) {
        setIsLoading(true);
        try {
           const [pRes, bRes, sRes, purRes, salRes, liqRes] = await Promise.all([
              supabase.from('products').select('*').eq('is_active', true),
              supabase.from('batches').select('*').gt('quantity_current', 0),
              supabase.from('suppliers').select('*'),
              supabase.from('purchases').select('*, items:purchase_items(*)'),
              supabase.from('sales').select('*, items:sale_items(*)').neq('status', 'canceled'),
              supabase.from('dispatch_liquidations').select('*')
           ]);
           if (pRes.data) setDbProducts(pRes.data as Product[]);
           if (bRes.data) setDbBatches(bRes.data as Batch[]);
           if (sRes.data) setDbSuppliers(sRes.data);
           if (purRes.data) setDbPurchases(purRes.data as any[]);
           if (salRes.data) setDbSales(salRes.data as any[]);
           if (liqRes.data) setDbLiquidations(liqRes.data as any[]);
        } catch (error) {
           console.error("Error sincronizando Kardex:", error);
        } finally {
           setIsLoading(false);
        }
     }
  };

  // --- FILTERS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState<'CENTRAL'|'MERMAS'>('CENTRAL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterSupplier, setFilterSupplier] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // --- SORTING ---
  const [sortField, setSortField] = useState<'sku'|'name'|'category'|'supplier'|'stock'|'value'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Cuando cambian los filtros, ocultamos los datos hasta que presione Mostrar
  const handleFilterChange = (setter: Function, value: any) => {
     setter(value);
     setIsDataVisible(false);
  };

  // --- DATA COMPUTATION ---
  const inventorySnapshot = useMemo(() => {
    return (dbProducts || []).map(p => {
       const productBatches = (dbBatches || []).filter(b => b.product_id === p.id && b.quantity_current > 0 && 
           (filterWarehouse === 'CENTRAL' ? b.warehouse_id !== 'MERMAS' : b.warehouse_id === 'MERMAS')
       );
       const totalStock = productBatches.reduce((acc, b) => acc + (b.quantity_current || 0), 0);
       const totalValue = filterWarehouse === 'MERMAS' ? 0 : productBatches.reduce((acc, b) => acc + ((b.quantity_current || 0) * (b.cost || 0)), 0);
       const avgCost = filterWarehouse === 'MERMAS' ? 0 : (totalStock > 0 ? totalValue / totalStock : (p.last_cost || 0));

       // MATEMÁTICA DE CAJAS Y UNIDADES 
       const factor = (p.package_content || 0) > 0 ? p.package_content : 1;
       const stockPackages = Math.floor(totalStock / factor);
       const remainingBase = totalStock % factor;

       return {
          ...p,
          totalStock,
          stockPackages,
          remainingBase,
          avgCost,
          totalValue,
          supplierName: (dbSuppliers || []).find(s => s.id === p.supplier_id)?.name || 'Varios'
       };
    }).filter(p => {
       const matchSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
       const matchCat = filterCategory === 'ALL' || p.category === filterCategory;
       const matchSup = filterSupplier === 'ALL' || p.supplier_id === filterSupplier;
       return matchSearch && matchCat && matchSup;
    }).sort((a,b) => {
       let valA: string | number = '';
       let valB: string | number = '';
       if (sortField === 'sku') { valA = a.sku || ''; valB = b.sku || ''; }
       if (sortField === 'name') { valA = a.name || ''; valB = b.name || ''; }
       if (sortField === 'category') { valA = a.category || ''; valB = b.category || ''; }
       if (sortField === 'supplier') { valA = a.supplierName || ''; valB = b.supplierName || ''; }
       if (sortField === 'stock') { valA = a.totalStock; valB = b.totalStock; }
       if (sortField === 'value') { valA = a.totalValue; valB = b.totalValue; }
       
       if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
       if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
       return 0;
    });
  }, [dbProducts, dbBatches, dbSuppliers, searchTerm, filterCategory, filterSupplier, sortField, sortOrder, filterWarehouse]);

  const movements = useMemo(() => {
     const list: Movement[] = [];

     (dbPurchases || []).forEach(p => {
        if (!p.issue_date || p.issue_date < dateFrom || p.issue_date > dateTo) return;
        (p.items || []).forEach(item => {
           const prod = (dbProducts || []).find(x => x.id === item.product_id);
           if (!prod || (searchTerm && !(prod.name || '').toLowerCase().includes(searchTerm.toLowerCase()))) return;
           list.push({
              id: `PUR-${p.id}-${item.product_id}`,
              date: p.issue_date, type: 'IN', docType: 'COMPRA', docNumber: p.document_number || 'S/N',
              productName: prod.name || 'Desconocido', sku: prod.sku || 'S/N', quantity: item.quantity_base || 0,
              unitPrice: item.quantity_base > 0 ? (item.total_cost || 0) / item.quantity_base : 0, 
              total: item.total_cost || 0, reference: p.supplier_name || 'Desconocido'
           });
        });
     });

     (dbSales || []).forEach(s => {
        const date = (s.created_at || new Date().toISOString()).split('T')[0];
        if (date < dateFrom || date > dateTo) return;
        (s.items || []).forEach(item => {
           const prod = (dbProducts || []).find(x => x.id === item.product_id);
           if (!prod || (searchTerm && !(prod.name || '').toLowerCase().includes(searchTerm.toLowerCase()))) return;
           list.push({
              id: `SALE-${s.id}-${item.id}`,
              date: date, type: 'OUT', docType: s.document_type || 'VENTA', docNumber: `${s.series || ''}-${s.number || ''}`,
              productName: prod.name || 'Desconocido', sku: prod.sku || 'S/N', quantity: item.quantity_base || 0, 
              unitPrice: item.quantity_base > 0 ? (item.total_price || 0) / item.quantity_base : 0,
              total: item.total_price || 0, reference: s.client_name || 'Desconocido'
           });
        });
     });

     (dbLiquidations || []).forEach(liq => {
        const date = (liq.date || new Date().toISOString()).split('T')[0];
        if (date < dateFrom || date > dateTo) return;
        (liq.documents || []).forEach(doc => {
           if (doc.action === 'PARTIAL_RETURN' || doc.action === 'VOID') {
              const sale = (dbSales || []).find(s => s.id === doc.sale_id);
              if (doc.action === 'VOID' && sale) {
                 (sale.items || []).forEach(item => {
                    const prod = (dbProducts || []).find(x => x.id === item.product_id);
                    if (!prod || (searchTerm && !(prod.name || '').toLowerCase().includes(searchTerm.toLowerCase()))) return;
                    list.push({
                       id: `VOID-${doc.sale_id}-${item.id}`,
                       date, type: 'IN', docType: 'ANULACION', docNumber: `${sale.series || ''}-${sale.number || ''}`,
                       productName: prod.name || '', sku: prod.sku || '', quantity: item.quantity_base || 0, unitPrice: 0, total: 0, reference: 'REINGRESO ALMACEN'
                    });
                 });
              }
              if (doc.action === 'PARTIAL_RETURN') {
                 (doc.returned_items || []).forEach(ret => {
                    const prod = (dbProducts || []).find(x => x.id === ret.product_id);
                    if (!prod || (searchTerm && !(prod.name || '').toLowerCase().includes(searchTerm.toLowerCase()))) return;
                    list.push({
                       id: `RET-${doc.sale_id}-${ret.product_id}`,
                       date, type: 'IN', docType: 'NOTA CREDITO', docNumber: doc.credit_note_series || 'NC-000',
                       productName: prod.name || '', sku: prod.sku || '', quantity: ret.quantity_base || 0, 
                       unitPrice: ret.quantity_base > 0 ? (ret.total_refund || 0) / ret.quantity_base : 0, 
                       total: ret.total_refund || 0, reference: sale?.client_name || 'CLIENTE'
                    });
                 });
              }
           }
        });
     });

     return list.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dbSales, dbPurchases, dbLiquidations, dbProducts, dateFrom, dateTo, searchTerm]);

  const analyticsData = useMemo(() => {
     const byCategory: Record<string, number> = {};
     const bySupplier: Record<string, number> = {};
     inventorySnapshot.forEach(p => {
        byCategory[p.category || 'OTROS'] = (byCategory[p.category || 'OTROS'] || 0) + (p.totalValue || 0);
        bySupplier[p.supplierName || 'OTROS'] = (bySupplier[p.supplierName || 'OTROS'] || 0) + (p.totalValue || 0);
     });
     const catChart = Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6);
     const supChart = Object.entries(bySupplier).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6);
     return { catChart, supChart, totalValuation: inventorySnapshot.reduce((acc, i) => acc + (i.totalValue || 0), 0) };
  }, [inventorySnapshot]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  const uniqueCategories = Array.from(new Set((dbProducts || []).map(p => p.category).filter(Boolean))).sort() as string[];

  const handleSort = (field: 'sku'|'name'|'category'|'supplier'|'stock'|'value') => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder(field === 'name' || field === 'sku' ? 'asc' : 'desc'); }
  };

  const currentTotalValuation = useMemo(() => inventorySnapshot.reduce((a,b)=>a+(b.totalValue || 0), 0), [inventorySnapshot]);

  const exportExcel = () => {
    const dataToExport = inventorySnapshot.map(p => ({
      "Código SKU": p.sku || '', "Producto": p.name || '', "Categoría": p.category || '', "Marca": p.brand || '', "Proveedor": p.supplierName || '',
      "Stock Total": p.totalStock || 0, "Costo Prom. Unit": parseFloat((p.avgCost || 0).toFixed(4)), "Valorización Total": parseFloat((p.totalValue || 0).toFixed(2)),
      "Estado": (p.totalStock || 0) <= (p.min_stock || 0) ? 'BAJO STOCK' : 'OPTIMO'
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kardex_Inventario");
    XLSX.writeFile(workbook, `Reporte_Kardex_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18); doc.setTextColor(40, 40, 40); doc.text("Reporte de Kardex e Inventario Valorizado", 14, 22);
    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Filtros: Categoría (${filterCategory}), Proveedor (${filterSupplier})`, 14, 36);
    doc.text(`Total Capital Valorizado: S/ ${currentTotalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 42);

    const tableColumn = ["SKU", "Producto", "Categoría / Marca", "Proveedor", "Stock Total", "Costo Prom", "Valor Total"];
    const tableRows = inventorySnapshot.map(p => [
      p.sku || '', p.name || '', `${p.category || '-'} / ${p.brand || '-'}`, p.supplierName || '', `${p.totalStock || 0} ${p.unit_type || 'U'}`, `S/ ${(p.avgCost || 0).toFixed(2)}`, `S/ ${(p.totalValue || 0).toFixed(2)}`
    ]);

    autoTable(doc, {
      head: [tableColumn], body: tableRows, startY: 48, theme: 'grid', styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42] }, alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216] } }
    });
    doc.save(`Reporte_Kardex_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="flex flex-col h-full space-y-4 font-sans text-slate-800">
       <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
             <div className="bg-orange-100 p-2.5 rounded-lg text-orange-600 shadow-inner">
                <Package className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-xl font-black text-slate-900">Centro de Control de Inventario</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kardex, Lotes y Valorización de Activos</p>
             </div>
          </div>
          <div className="flex gap-2">
             <button onClick={fetchMasterData} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm border border-slate-200 font-bold text-sm">
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin text-orange-600' : ''}`} /> Sincronizar
             </button>
             <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-md flex items-center transition-colors text-sm">
                <FileDown className="w-4 h-4 mr-2" /> Excel
             </button>
             <button onClick={exportPDF} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold shadow-md flex items-center transition-colors text-sm">
                <Printer className="w-4 h-4 mr-2" /> PDF
             </button>
          </div>
       </div>

       <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-1">
          <button onClick={() => {setActiveTab('INVENTORY'); setIsDataVisible(false);}} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'INVENTORY' ? 'bg-orange-50 text-orange-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Layers className="w-4 h-4 mr-2" /> 1. Inventario Físico
          </button>
          <button onClick={() => {setActiveTab('MOVEMENTS'); setIsDataVisible(false);}} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'MOVEMENTS' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <ArrowUpDown className="w-4 h-4 mr-2" /> 2. Kardex Movimientos
          </button>
          <button onClick={() => {setActiveTab('BATCHES'); setIsDataVisible(false);}} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'BATCHES' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Calendar className="w-4 h-4 mr-2" /> 3. Lotes y Vencimientos
          </button>
          <button onClick={() => {setActiveTab('ANALYTICS'); setIsDataVisible(true);}} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'ANALYTICS' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <BarChart3 className="w-4 h-4 mr-2" /> 4. Reportes y Capital
          </button>
       </div>

       {/* ÁREA DE FILTROS + BOTÓN MOSTRAR */}
       {activeTab !== 'ANALYTICS' && (
         <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-wrap gap-4 items-end">
               <div className="flex-1 min-w-[200px]">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Buscador Universal</label>
                  <div className="relative">
                     <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                     <input className="w-full pl-10 border-2 border-slate-200 p-2.5 rounded-lg text-sm font-bold focus:border-orange-500 outline-none transition-colors" placeholder="Buscar por SKU o Nombre..." value={searchTerm} onChange={e => handleFilterChange(setSearchTerm, e.target.value)} />
                  </div>
               </div>
               
               {activeTab !== 'MOVEMENTS' && (
                  <>
                     <div className="w-56">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Ubicación Lógica</label>
                        <select className={`w-full border-2 p-2.5 rounded-lg text-sm font-bold focus:outline-none transition-colors ${filterWarehouse === 'MERMAS' ? 'bg-red-50 text-red-700 border-red-300 focus:border-red-500' : 'bg-slate-50 text-slate-800 border-slate-200 focus:border-orange-500'}`} value={filterWarehouse} onChange={e => handleFilterChange(setFilterWarehouse, e.target.value as any)}>
                           <option value="CENTRAL">📦 ALMACÉN CENTRAL</option>
                           <option value="MERMAS">⚠️ CUARENTENA / MERMAS</option>
                        </select>
                     </div>
                     <div className="w-48">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Categoría</label>
                        <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-sm font-bold bg-white focus:border-orange-500 outline-none" value={filterCategory} onChange={e => handleFilterChange(setFilterCategory, e.target.value)}>
                           <option value="ALL">Todas las Familias</option>
                           {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>
                     <div className="w-56">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Proveedor Origen</label>
                        <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-sm font-bold bg-white focus:border-orange-500 outline-none" value={filterSupplier} onChange={e => handleFilterChange(setFilterSupplier, e.target.value)}>
                           <option value="ALL">Todos los Proveedores</option>
                           {(dbSuppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                     </div>
                  </>
               )}

               {activeTab === 'MOVEMENTS' && (
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border-2 border-slate-200">
                     <Calendar className="w-5 h-5 text-slate-400 ml-2" />
                     <input type="date" className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none cursor-pointer" value={dateFrom} onChange={e => handleFilterChange(setDateFrom, e.target.value)} />
                     <span className="text-slate-300 font-bold">-</span>
                     <input type="date" className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2" value={dateTo} onChange={e => handleFilterChange(setDateTo, e.target.value)} />
                  </div>
               )}

               {/* BOTÓN MOSTRAR: ESTE ES EL GATILLO QUE PERMITE VER LOS DATOS */}
               <button 
                  onClick={() => setIsDataVisible(true)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-black shadow-md flex items-center transition-all active:scale-95 text-sm h-[44px]"
               >
                  <Eye className="w-4 h-4 mr-2" /> MOSTRAR
               </button>
            </div>
         </div>
       )}

       <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
          
          {!isDataVisible && activeTab !== 'ANALYTICS' ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-20">
                <Search className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Esperando Parámetros</h3>
                <p className="text-slate-400 font-medium mt-2">Seleccione los filtros arriba y haga clic en "MOSTRAR" para cargar los datos.</p>
             </div>
          ) : null}

          {/* TAB: INVENTORY */}
          {activeTab === 'INVENTORY' && (
             <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left border-collapse">
                   <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-sm border-b border-slate-200">
                       <tr>
                          <th className="p-4 w-28 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('sku')}>
                             <div className="flex items-center">Código {sortField === 'sku' && <ArrowUpDown className="w-3 h-3 ml-1 text-slate-500" />}</div>
                          </th>
                          <th className="p-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('name')}>
                             <div className="flex items-center">Producto {sortField === 'name' && <ArrowUpDown className="w-3 h-3 ml-1 text-slate-500" />}</div>
                          </th>
                          <th className="p-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('category')}>
                             <div className="flex items-center">Categoría / Marca {sortField === 'category' && <ArrowUpDown className="w-3 h-3 ml-1 text-slate-500" />}</div>
                          </th>
                          <th className="p-4 text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('stock')}>
                             <div className="flex items-center justify-end">Stock Total Base {sortField === 'stock' && <ArrowUpDown className="w-3 h-3 ml-1 text-slate-500" />}</div>
                          </th>
                          <th className="p-4 text-right">Costo Promedio (Base)</th>
                          <th className="p-4 text-right text-blue-700 cursor-pointer hover:bg-slate-200 transition-colors bg-blue-50/30 border-l border-blue-100" onClick={() => handleSort('value')}>
                             <div className="flex items-center justify-end">Capital Inmovilizado {sortField === 'value' && <ArrowUpDown className="w-3 h-3 ml-1 text-blue-500" />}</div>
                          </th>
                          <th className="p-4 text-center">Salud de Stock</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {isLoading && inventorySnapshot.length === 0 ? (
                         <tr><td colSpan={7} className="p-12 text-center text-slate-500 font-bold"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-orange-500"/> Sincronizando Activos...</td></tr>
                      ) : inventorySnapshot.length === 0 ? (
                         <tr><td colSpan={7} className="p-12 text-center text-slate-400 font-medium">No se encontraron productos con los filtros actuales.</td></tr>
                      ) : inventorySnapshot.map(p => (
                         <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="p-4 font-mono font-bold text-slate-500">{p.sku}</td>
                            <td className="p-4">
                               <div className="font-black text-slate-800 text-base">{p.name}</div>
                               <div className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center"><Briefcase className="w-3 h-3 mr-1" /> {p.supplierName}</div>
                            </td>
                            <td className="p-4">
                               <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-600 border border-slate-200 mr-2">{p.category || 'SIN CAT'}</span>
                               <span className="text-xs text-slate-500 font-bold">{p.brand}</span>
                            </td>
                            <td className="p-4 text-right">
                               <div className="font-black text-slate-900 text-lg">
                                  {p.totalStock} <span className="text-xs text-slate-400 font-bold ml-1">{p.unit_type || 'U'}</span>
                               </div>
                               {/* ETIQUETA VISUAL DE CAJAS/UNIDADES */}
                               {((p.package_content || 1) > 1) && (p.totalStock || 0) > 0 && (
                                  <div className="text-[10px] text-blue-600 font-bold mt-1 bg-blue-50 inline-block px-2 py-0.5 rounded border border-blue-100 shadow-sm">
                                     {p.stockPackages} {p.package_type || 'CAJAS'} y {p.remainingBase} {p.unit_type || 'UND'}
                                  </div>
                               )}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-slate-500">S/ {(p.avgCost || 0).toFixed(4)}</td>
                            <td className="p-4 text-right font-black text-blue-700 bg-blue-50/10 border-l border-blue-50 text-lg">S/ {(p.totalValue || 0).toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="p-4 text-center">
                               {(p.totalStock || 0) <= 0 ? (
                                  <span className="flex items-center justify-center text-red-600 text-[10px] font-black bg-red-100 px-3 py-1 rounded-full border border-red-200 shadow-sm">
                                     <AlertTriangle className="w-3 h-3 mr-1" /> AGOTADO
                                  </span>
                               ) : (p.totalStock || 0) <= (p.min_stock || 0) ? (
                                  <span className="flex items-center justify-center text-orange-600 text-[10px] font-black bg-orange-100 px-3 py-1 rounded-full border border-orange-200 shadow-sm animate-pulse">
                                     <AlertTriangle className="w-3 h-3 mr-1" /> STOCK BAJO
                                  </span>
                               ) : (
                                  <span className="flex items-center justify-center text-green-600 text-[10px] font-black bg-green-100 px-3 py-1 rounded-full border border-green-200 shadow-sm">
                                     <CheckCircle className="w-3 h-3 mr-1" /> ÓPTIMO
                                  </span>
                               )}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                   <tfoot className="bg-slate-800 text-white font-black sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                      <tr>
                         <td colSpan={5} className="p-4 text-right uppercase tracking-wider text-xs text-slate-400">Capitalización Total en Almacén:</td>
                         <td className="p-4 text-right text-emerald-400 text-xl border-l border-slate-700">S/ {inventorySnapshot.reduce((a,b)=>a+(b.totalValue||0), 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                         <td></td>
                      </tr>
                   </tfoot>
                </table>
             </div>
          )}

          {/* TAB: MOVEMENTS (KARDEX) */}
          {activeTab === 'MOVEMENTS' && (
             <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left border-collapse">
                   <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                      <tr>
                         <th className="p-4 w-32">Fecha (UTC)</th>
                         <th className="p-4 w-28 text-center">Naturaleza</th>
                         <th className="p-4">Documento Origen</th>
                         <th className="p-4">Producto Movilizado</th>
                         <th className="p-4 text-right">Cant. Base</th>
                         <th className="p-4 text-right">P. Unitario</th>
                         <th className="p-4 text-right">Importe Total</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {isLoading && movements.length === 0 ? (
                         <tr><td colSpan={7} className="p-12 text-center text-slate-500 font-bold"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-blue-500"/> Sincronizando Movimientos...</td></tr>
                      ) : movements.length === 0 ? (
                         <tr><td colSpan={7} className="p-12 text-center text-slate-400 font-medium">No hay movimientos registrados en este rango de fechas.</td></tr>
                      ) : movements.map((m, idx) => (
                         <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-slate-500 font-mono text-xs font-bold">{m.date}</td>
                            <td className="p-4 text-center">
                               {m.type === 'IN' ? (
                                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-[9px] font-black flex items-center justify-center w-full border border-green-200 shadow-sm">
                                     <ArrowDownLeft className="w-3 h-3 mr-1" /> INGRESO
                                  </span>
                               ) : (
                                  <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-[9px] font-black flex items-center justify-center w-full border border-red-200 shadow-sm">
                                     <ArrowUpRight className="w-3 h-3 mr-1" /> SALIDA
                                  </span>
                               )}
                            </td>
                            <td className="p-4">
                               <div className="font-bold text-slate-800">{m.docType} {m.docNumber}</div>
                               <div className="text-[10px] text-slate-500 font-bold mt-0.5 truncate max-w-[200px]">{m.reference}</div>
                            </td>
                            <td className="p-4">
                               <div className="font-bold text-slate-900">{m.productName}</div>
                               <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {m.sku}</div>
                            </td>
                            <td className={`p-4 text-right font-black text-lg ${m.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                               {m.type === 'IN' ? '+' : '-'}{m.quantity}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-slate-500">
                               {(m.unitPrice || 0) > 0 ? `S/ ${(m.unitPrice || 0).toFixed(2)}` : '-'}
                            </td>
                            <td className="p-4 text-right font-black text-slate-800">
                               {(m.total || 0) > 0 ? `S/ ${(m.total || 0).toFixed(2)}` : '-'}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          )}

          {/* TAB: BATCHES (LOTES) */}
          {activeTab === 'BATCHES' && (
             <div className="flex-1 overflow-auto p-6 bg-slate-50">
                {isLoading && (dbBatches || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 font-bold"><RefreshCw className="w-8 h-8 animate-spin mb-4 text-purple-500"/> Sincronizando Lotes...</div>
                ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {(dbProducts || []).filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase())).map(product => {
                         const batches = (dbBatches || []).filter(b => b.product_id === product.id && b.quantity_current > 0 && (filterWarehouse === 'CENTRAL' ? b.warehouse_id !== 'MERMAS' : b.warehouse_id === 'MERMAS')).sort((a,b) => new Date(a.expiration_date || '2099-01-01').getTime() - new Date(b.expiration_date || '2099-01-01').getTime());
                         if (batches.length === 0) return null;

                         return (
                            <div key={product.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
                               <div className="bg-slate-900 p-4 text-white">
                                  <div className="flex justify-between items-start">
                                     <div className="pr-4">
                                        <h4 className="font-black text-sm leading-tight line-clamp-2">{product.name}</h4>
                                        <p className="text-[10px] text-slate-400 font-mono mt-1">{product.sku}</p>
                                     </div>
                                     <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-lg font-black shadow-inner whitespace-nowrap">
                                        {batches.reduce((a,b)=>a+(b.quantity_current||0),0)} Und
                                     </div>
                                  </div>
                               </div>
                               
                               <div className="p-4 space-y-3 flex-1 bg-slate-50 overflow-y-auto max-h-[300px]">
                                  {batches.map(batch => {
                                     const expDate = batch.expiration_date ? new Date(batch.expiration_date) : null;
                                     const daysLeft = (expDate && !isNaN(expDate.getTime())) ? Math.ceil((expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 999;
                                     const isExpiring = daysLeft < 45; 
                                     const isCritical = daysLeft < 15;

                                     return (
                                        <div key={batch.id} className={`p-3 rounded-xl border-2 transition-colors flex justify-between items-center ${isCritical ? 'bg-red-50 border-red-200 shadow-sm' : isExpiring ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
                                           <div>
                                              <div className="font-black text-slate-800 flex items-center text-sm">
                                                 <Hash className="w-3 h-3 mr-1 text-slate-400"/> {batch.code}
                                              </div>
                                              {batch.expiration_date ? (
                                                 <div className={`text-[10px] mt-1 font-bold flex items-center ${isCritical ? 'text-red-600' : isExpiring ? 'text-orange-600' : 'text-slate-500'}`}>
                                                    <Calendar className="w-3 h-3 mr-1"/> Vence: {batch.expiration_date} ({daysLeft}d)
                                                 </div>
                                              ) : (
                                                 <div className="text-[10px] mt-1 font-bold text-slate-400 flex items-center"><Calendar className="w-3 h-3 mr-1"/> Sin Vencimiento</div>
                                              )}
                                           </div>
                                           <div className="text-right flex flex-col items-end">
                                              <div className="font-black text-xl text-slate-900">{batch.quantity_current}</div>
                                              <div className="text-[9px] text-slate-400 font-bold mb-2">Ingresó: {batch.quantity_initial}</div>
                                           </div>
                                        </div>
                                     );
                                  })}
                               </div>
                            </div>
                         );
                      })}
                   </div>
                )}
             </div>
          )}

          {/* TAB: ANALYTICS */}
          {activeTab === 'ANALYTICS' && (
             <div className="flex-1 overflow-auto p-8 bg-slate-50 animate-fade-in-up">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                   <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden border border-slate-800">
                      <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign className="w-24 h-24" /></div>
                      <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Valorización de Almacén Central</p>
                      <h3 className="text-4xl font-black tracking-tighter">S/ {(analyticsData.totalValuation || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                   </div>
                   <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-slate-200">
                      <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Productos Activos en Catálogo</p>
                      <h3 className="text-4xl font-black text-blue-600 tracking-tighter">{inventorySnapshot.length}</h3>
                   </div>
                   <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-red-100">
                      <p className="text-red-500 text-xs font-black uppercase tracking-widest mb-2">Productos Críticos (Bajo Stock)</p>
                      <h3 className="text-4xl font-black text-red-600 tracking-tighter">{inventorySnapshot.filter(p => p.totalStock <= (p.min_stock || 0)).length}</h3>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-96">
                   <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-200 flex flex-col">
                      <h4 className="font-black text-slate-800 mb-6 text-center uppercase tracking-wider text-sm">Distribución de Capital por Categoría</h4>
                      <div className="flex-1">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                               <Pie data={analyticsData.catChart} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                                  {analyticsData.catChart.map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                               </Pie>
                               <Tooltip formatter={(value: number) => `S/ ${value.toLocaleString()}`} />
                               <Legend />
                            </PieChart>
                         </ResponsiveContainer>
                      </div>
                   </div>

                   <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-200 flex flex-col">
                      <h4 className="font-black text-slate-800 mb-6 text-center uppercase tracking-wider text-sm">Top Inversión por Proveedor</h4>
                      <div className="flex-1">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData.supChart} layout="vertical" margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                               <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                               <XAxis type="number" hide />
                               <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 10, fill: '#475569', fontWeight: 'bold'}} />
                               <Tooltip formatter={(value: number) => `S/ ${value.toLocaleString()}`} cursor={{fill: '#f1f5f9'}} />
                               <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]}>
                                  {analyticsData.supChart.map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                               </Bar>
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
                </div>
             </div>
          )}

       </div>
    </div>
  );
};
