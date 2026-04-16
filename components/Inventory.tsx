import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../services/store';
import { Package, Calendar, DollarSign, Hash, Search, ArrowUpDown, TrendingDown, Layers, FileDown, Plus, Printer, AlertTriangle, CheckCircle, RefreshCw, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase, USE_MOCK_DB } from '../services/supabase';

export const Inventory: React.FC = () => {
  const store = useStore();
  const { addBatch } = store;
  
  const [activeTab, setActiveTab] = useState<'MONITOR' | 'INCOME'>('MONITOR');
  const [isDataVisible, setIsDataVisible] = useState(false); // <--- ESTADO DE RENDIMIENTO Y RENDER DIFERIDO

  // === ESTADOS SUPABASE ===
  const [realProducts, setRealProducts] = useState<any[]>([]);
  const [realBatches, setRealBatches] = useState<any[]>([]);
  const [realSuppliers, setRealSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!USE_MOCK_DB) {
        setIsLoading(true);
        try {
          const [pRes, bRes, sRes] = await Promise.all([
            supabase.from('products').select('*'),
            supabase.from('batches').select('*'),
            supabase.from('suppliers').select('*')
          ]);
          if (pRes.data) setRealProducts(pRes.data);
          if (bRes.data) setRealBatches(bRes.data);
          if (sRes.data) setRealSuppliers(sRes.data);
        } catch (error) {
          console.error("Error fetching Supabase data:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchData();
  }, [activeTab]);

  const products = USE_MOCK_DB ? store.products : realProducts;
  const batches = USE_MOCK_DB ? store.batches : realBatches;
  const suppliers = USE_MOCK_DB ? store.suppliers : realSuppliers;

  // === RECEPTION FORM STATE ===
  const [formData, setFormData] = useState({
    productId: '',
    code: '',
    quantity: 0,
    cost: 0,
    expirationDate: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId) return;

    // --- PROTECCIÓN: CONFIRMACIÓN ANTES DE INSERTAR LOTE ---
    if (!window.confirm("¿Está seguro de registrar este ingreso manual al Kardex? Esta acción actualizará el stock disponible.")) {
       return;
    }

    if (USE_MOCK_DB) {
      addBatch({
        id: crypto.randomUUID(),
        product_id: formData.productId,
        code: formData.code,
        quantity_initial: formData.quantity,
        quantity_current: formData.quantity,
        cost: formData.cost,
        expiration_date: formData.expirationDate,
        created_at: new Date().toISOString()
      });
      alert("¡Lote recepcionado correctamente (Mock)!");
    } else {
      try {
        const { error } = await supabase.from('batches').insert([{
          product_id: formData.productId,
          code: formData.code,
          quantity_initial: formData.quantity,
          quantity_current: formData.quantity,
          cost: formData.cost,
          expiration_date: formData.expirationDate || null
        }]);
        if (error) throw error;
        alert("¡Lote recepcionado correctamente en Supabase!");
      } catch (error: any) {
        alert("Error de BD: " + error.message);
        return;
      }
    }

    setFormData({ productId: '', code: '', quantity: 0, cost: 0, expirationDate: '' });
    setActiveTab('MONITOR');
    setIsDataVisible(false); // Resetear visibilidad al regresar al monitor
  };

  // === MONITOR STATE ===
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  
  const [sortField, setSortField] = useState<'name' | 'stock' | 'value'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Cuando cambian los filtros, se oculta la tabla y se fuerza a presionar Mostrar
  const handleFilterChange = (setter: Function, value: any) => {
      setter(value);
      setIsDataVisible(false);
  };

  const uniqueCategories = useMemo(() => Array.from(new Set((products || []).map(p => p?.category).filter(Boolean))), [products]);
  const activeSuppliers = useMemo(() => {
     const ids = Array.from(new Set((products || []).map(p => p?.supplier_id).filter(Boolean)));
     return ids.map(id => (suppliers || []).find(s => s?.id === id)).filter(Boolean) as typeof suppliers;
  }, [products, suppliers]);

  // Enriched Inventory Data - BLINDADO y CON MATEMATICA DE CAJAS
  const inventoryData = useMemo(() => {
    return (products || []).map(p => {
      const productBatches = (batches || []).filter(b => b?.product_id === p?.id);
      const stockBase = productBatches.reduce((acc, b) => acc + (b?.quantity_current || 0), 0);
      
      const factor = (p?.package_content || 0) > 0 ? p.package_content : 1;
      const stockPackages = Math.floor(stockBase / factor);
      const remainingBase = stockBase % factor;
      
      const supplierName = (suppliers || []).find(s => s?.id === p?.supplier_id)?.name || 'Sin Proveedor';
      const totalCostBatch = productBatches.reduce((acc, b) => acc + ((b?.cost || 0) * (b?.quantity_current || 0)), 0);
      const avgCost = stockBase > 0 ? totalCostBatch / stockBase : (p?.last_cost || 0);
      const totalValue = stockBase * avgCost;

      return {
        ...p,
        stockBase,
        stockPackages,
        remainingBase,
        supplierName,
        avgCost,
        totalValue,
        isLowStock: stockBase <= (p?.min_stock || 0)
      };
    });
  }, [products, batches, suppliers]);

  const filteredData = useMemo(() => {
    return inventoryData
      .filter(p => {
         if (searchQuery && !(p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) && !(p.sku || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
         if (selectedCategory && p.category !== selectedCategory) return false;
         if (selectedSupplier && p.supplier_id !== selectedSupplier) return false;
         return true;
      })
      .sort((a, b) => {
         let valA: string | number = '';
         let valB: string | number = '';
         if (sortField === 'name') { valA = a.name || ''; valB = b.name || ''; }
         if (sortField === 'stock') { valA = a.stockBase; valB = b.stockBase; }
         if (sortField === 'value') { valA = a.totalValue; valB = b.totalValue; }
         
         if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
         if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
         return 0;
      });
  }, [inventoryData, searchQuery, selectedCategory, selectedSupplier, sortField, sortOrder]);

  const totalCapital = inventoryData.reduce((acc, p) => acc + (p?.totalValue || 0), 0);
  const criticalStockCount = inventoryData.filter(p => p.isLowStock && p.stockBase > 0).length;
  const zeroStockCount = inventoryData.filter(p => p.stockBase <= 0).length;

  const handleSort = (field: 'name' | 'stock' | 'value') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  const exportExcel = () => {
    const dataToExport = filteredData.map(p => ({
      "Código SKU": p.sku || '',
      "Producto": p.name || '',
      "Categoría": p.category || '',
      "Proveedor": p.supplierName || '',
      "Stock Total (Base)": p.stockBase || 0,
      "Unidad Medida": p.unit_type || '',
      "Stock Empaques": p.stockPackages || 0,
      "Costo Prom. Unit": parseFloat((p.avgCost || 0).toFixed(4)),
      "Valorización Total": parseFloat((p.totalValue || 0).toFixed(2)),
      "Alerta": p.stockBase <= 0 ? 'AGOTADO' : (p.isLowStock ? 'STOCK BAJO' : 'OK')
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario_Valorizado");
    XLSX.writeFile(workbook, `Reporte_Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18); doc.setTextColor(40, 40, 40); doc.text("Reporte de Inventario Valorizado", 14, 22);
    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Capital Valorizado: S/ ${(totalCapital || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 36);

    const tableColumn = ["SKU", "Producto", "Categoría", "Proveedor", "Stock Real", "Costo Unit", "Total Val."];
    const tableRows = filteredData.map(p => [
      p.sku || '', p.name || '', p.category || '-', p.supplierName || '',
      `${p.stockBase} ${p.unit_type || 'U'} ${p.stockPackages > 0 ? `(${p.stockPackages} ${p.package_type || 'CJ'})` : ''}`,
      `S/ ${(p.avgCost || 0).toFixed(2)}`, `S/ ${(p.totalValue || 0).toFixed(2)}`
    ]);

    autoTable(doc, {
      head: [tableColumn], body: tableRows, startY: 42, theme: 'grid', styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59] }, alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } }
    });
    doc.save(`Inventario_Valorizado_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-4 font-sans max-w-7xl mx-auto">
      
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
          <Layers className="mr-3 h-7 w-7 text-accent" /> Control de Inventario y Reportes
        </h2>
        <div className="flex space-x-2 bg-slate-200 p-1 rounded-lg shrink-0">
          <button onClick={() => {setActiveTab('MONITOR'); setIsDataVisible(false);}} className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center ${activeTab === 'MONITOR' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-300'}`}>
            <TrendingDown className="w-4 h-4 mr-2" /> Monitor de Stock
          </button>
          <button onClick={() => {setActiveTab('INCOME'); setIsDataVisible(true);}} className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center ${activeTab === 'INCOME' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-300'}`}>
            <Plus className="w-4 h-4 mr-2" /> Ingreso Manual Lotes
          </button>
        </div>
      </div>

      {activeTab === 'MONITOR' ? (
        <div className="flex flex-col h-full space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Capital Valorizado</p>
                <p className="text-2xl font-black text-slate-800 mt-1">S/ {(totalCapital || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full"><DollarSign className="w-6 h-6 text-blue-600" /></div>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-orange-500 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stock Crítico o Bajo</p>
                <p className="text-2xl font-black text-orange-600 mt-1">{criticalStockCount}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-full"><AlertTriangle className="w-6 h-6 text-orange-600" /></div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-red-500 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Productos Agotados</p>
                <p className="text-2xl font-black text-red-600 mt-1">{zeroStockCount}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-full"><Package className="w-6 h-6 text-red-600" /></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end justify-between">
             <div className="flex flex-wrap gap-4 items-end">
                <div className="flex flex-col relative">
                    <label className="text-xs font-bold text-slate-600 mb-1">Buscar Producto</label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                      <input 
                          type="text" placeholder="SKU o Nombre..."
                          className="border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                          value={searchQuery} onChange={e => handleFilterChange(setSearchQuery, e.target.value)} 
                      />
                    </div>
                </div>

                <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-600 mb-1">Categoría</label>
                    <select className="border border-slate-300 rounded-lg py-2 px-3 text-sm w-48 focus:ring-2 focus:ring-blue-500" value={selectedCategory} onChange={e => handleFilterChange(setSelectedCategory, e.target.value)}>
                      <option value="">Todas las Categorías</option>
                      {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-600 mb-1">Proveedor</label>
                    <select className="border border-slate-300 rounded-lg py-2 px-3 text-sm w-56 focus:ring-2 focus:ring-blue-500" value={selectedSupplier} onChange={e => handleFilterChange(setSelectedSupplier, e.target.value)}>
                      <option value="">Todos los Proveedores</option>
                      {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                
                {/* BOTÓN MOSTRAR QUE CARGA LOS DATOS (RENDER DIFERIDO) */}
                <button 
                  onClick={() => setIsDataVisible(true)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-md flex items-center transition-all active:scale-95 text-sm h-[38px]"
                >
                  <Eye className="w-4 h-4 mr-2" /> Mostrar
                </button>
             </div>

             <div className="flex gap-2">
                <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center shadow-sm transition-colors text-sm">
                  <FileDown className="w-4 h-4 mr-2" /> Excel
                </button>
                <button onClick={exportPDF} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold flex items-center shadow-sm transition-colors text-sm">
                  <Printer className="w-4 h-4 mr-2" /> PDF
                </button>
             </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col relative">
            
            {/* PANTALLA DE ESPERA SI EL USUARIO AÚN NO HA HECHO CLIC EN MOSTRAR */}
            {!isDataVisible ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-20">
                  <Search className="w-16 h-16 text-slate-300 mb-4" />
                  <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Esperando Parámetros</h3>
                  <p className="text-slate-400 font-medium mt-2">Seleccione los filtros arriba y haga clic en "Mostrar" para cargar los datos.</p>
               </div>
            ) : null}

            <div className="overflow-auto flex-1 relative">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10 text-xs">
                  <tr>
                    <th className="p-3 w-24">Código</th>
                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center">Producto {sortField === 'name' && <ArrowUpDown className="w-3 h-3 ml-1 text-blue-500" />}</div>
                    </th>
                    <th className="p-3">Categoría / Marca</th>
                    <th className="p-3">Proveedor</th>
                    <th className="p-3 w-32 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => handleSort('stock')}>
                      <div className="flex items-center justify-end">Stock Total {sortField === 'stock' && <ArrowUpDown className="w-3 h-3 ml-1 text-blue-500" />}</div>
                    </th>
                    <th className="p-3 w-28 text-right">Costo Prom.</th>
                    <th className="p-3 w-36 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => handleSort('value')}>
                      <div className="flex items-center justify-end text-blue-700">Valorización {sortField === 'value' && <ArrowUpDown className="w-3 h-3 ml-1 text-blue-500" />}</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {isLoading && filteredData.length === 0 ? (
                      <tr><td colSpan={7} className="p-12 text-center text-slate-500 font-bold"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-blue-500"/> Sincronizando Inventario...</td></tr>
                  ) : filteredData.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-slate-400">No se encontraron productos en el inventario.</td></tr>
                  ) : filteredData.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-slate-500 text-xs">{p.sku}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800 leading-tight">{p.name}</div>
                        {p.isLowStock && p.stockBase > 0 && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold inline-block mt-1">Stock Bajo</span>}
                        {p.stockBase <= 0 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold inline-block mt-1">Agotado</span>}
                      </td>
                      <td className="p-3 text-slate-600 text-xs">{p.category || '-'} <span className="text-slate-400 font-mono text-[10px] block mt-0.5">{p.brand}</span></td>
                      <td className="p-3 text-slate-600 text-xs truncate max-w-[150px]">{p.supplierName}</td>
                      <td className="p-3 text-right">
                        <div className={`font-black ${p.stockBase <= 0 ? 'text-red-500' : (p.isLowStock ? 'text-orange-600' : 'text-slate-800')}`}>{p.stockBase} <span className="text-[10px] font-normal text-slate-500">{p.unit_type || 'U'}</span></div>
                        {/* ETIQUETA VISUAL CAJAS Y UNIDADES */}
                        {((p?.package_content || 1) > 1) && (p?.stockBase || 0) > 0 && (
                          <div className="text-[10px] text-blue-600 font-bold mt-1 bg-blue-50 inline-block px-2 py-0.5 rounded border border-blue-100 shadow-sm">
                             {p.stockPackages} {p.package_type || 'CAJAS'} y {p.remainingBase} {p.unit_type || 'UND'}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500 text-xs">
                        S/ {(p.avgCost || 0).toFixed(4)}
                      </td>
                      <td className="p-3 text-right font-black text-blue-700">
                        S/ {(p.totalValue || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-6 md:min-w-[500px]">
          <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center">
            <Package className="mr-2 h-5 w-5 text-accent" /> Ingreso Manual de Mercadería
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Seleccionar Producto</label>
              <select 
                required
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                value={formData.productId}
                onChange={e => setFormData({...formData, productId: e.target.value})}
              >
                <option value="">-- Buscar Producto --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Código de Lote</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input 
                    type="text" 
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                    placeholder="LOTE-001"
                    value={formData.code}
                    onChange={e => setFormData({...formData, code: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Cantidad Física Ingresada (Unidad Base)</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 font-bold text-right"
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Costo Unitario Asociado</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    min="0"
                    className="w-full border border-slate-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-blue-500 font-mono text-right"
                    value={formData.cost}
                    onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Fecha de Vencimiento (Caducidad)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input 
                    type="date" 
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-blue-500"
                    value={formData.expirationDate}
                    onChange={e => setFormData({...formData, expirationDate: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-700 shadow-md transition-all flex items-center justify-center text-sm">
              <Plus className="w-4 h-4 mr-2" />
              Guardar y Registrar Lote
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
