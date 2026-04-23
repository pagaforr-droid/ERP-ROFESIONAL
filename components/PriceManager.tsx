import React, { useState, useMemo, useEffect } from 'react';
import { PriceList, Seller, Product } from '../types';
import { supabase } from '../services/supabase';
import { 
  Calculator, Tag, Users, Save, DollarSign, Plus, RefreshCw, 
  TrendingDown, TrendingUp, Equal, Percent, CheckSquare, Square, 
  Search, AlertCircle, CheckCircle2, Loader2, X, Trash2,
  FileText, FileSpreadsheet, Filter, FileBarChart2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type Tab = 'CALCULATOR' | 'PRICELISTS' | 'SELLERS' | 'REPORTS';
type OperationMode = 'BASE' | 'DISCOUNT' | 'INCREASE';

// Toast Notification Component
const Notification = ({ msg, type, onClose }: { msg: string, type: 'success' | 'error', onClose: () => void }) => (
  <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-xl shadow-2xl border-l-4 animate-fade-in-down bg-white/95 backdrop-blur-sm ${type === 'success' ? 'border-emerald-500' : 'border-red-500'}`}>
    {type === 'success' ? <CheckCircle2 className="w-6 h-6 text-emerald-600 mr-3" /> : <AlertCircle className="w-6 h-6 text-red-600 mr-3" />}
    <div>
       <h4 className={`font-black text-sm ${type === 'success' ? 'text-emerald-900' : 'text-red-900'}`}>{type === 'success' ? 'Operación Exitosa' : 'Alerta del Sistema'}</h4>
       <p className="text-xs text-slate-600 font-bold">{msg}</p>
    </div>
    <button onClick={onClose} className="ml-6 text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 p-1.5 rounded-full"><X className="w-4 h-4" /></button>
  </div>
);

export const PriceManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('CALCULATOR');

  // --- ESTADOS DE BASE DE DATOS (100% SUPABASE) ---
  const [products, setProducts] = useState<Product[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
     fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pRes, plRes, sRes, supRes] = await Promise.all([
          supabase.from('products').select('*').order('name'),
          supabase.from('price_lists').select('*').order('name'),
          supabase.from('sellers').select('*').order('name'),
          supabase.from('suppliers').select('*').order('name')
      ]);
      if (pRes.data) setProducts(pRes.data as Product[]);
      if (plRes.data) setPriceLists(plRes.data as PriceList[]);
      if (sRes.data) setSellers(sRes.data as Seller[]);
      if (supRes.data) setSuppliers(supRes.data);
    } catch (error: any) {
      console.error("Error Sincronizando:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- TAB 1: CALCULATOR STATE ---
  const [selectedTargetList, setSelectedTargetList] = useState('BASE'); 
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [targetMargin, setTargetMargin] = useState<number>(30); // Porcentaje de ganancia sobre costo
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  // --- TAB 2: PRICELIST STATE ---
  const [editingList, setEditingList] = useState<Partial<PriceList> | null>(null);
  const [operationMode, setOperationMode] = useState<OperationMode>('BASE');
  const [percentageValue, setPercentageValue] = useState<number>(0);

  // --- TAB 3: SELLER ASSIGNMENT STATE ---
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // --- TAB 4: REPORTS STATE ---
  const [repSupplier, setRepSupplier] = useState('ALL');
  const [repCategory, setRepCategory] = useState('ALL');
  const [repSubcategory, setRepSubcategory] = useState('ALL');
  const [repBrand, setRepBrand] = useState('ALL');

  useEffect(() => {
     if (editingList) {
        const factor = editingList.factor || 1.0;
        if (factor === 1) {
           setOperationMode('BASE');
           setPercentageValue(0);
        } else if (factor < 1) {
           setOperationMode('DISCOUNT');
           setPercentageValue(Number(((1 - factor) * 100).toFixed(2)));
        } else {
           setOperationMode('INCREASE');
           setPercentageValue(Number(((factor - 1) * 100).toFixed(2)));
        }
     }
  }, [editingList]);

  // --- HELPERS ---
  const uniqueCategories = Array.from(new Set(products.map(p => p.category))).filter(Boolean).sort() as string[];
  const uniqueSubcategories = Array.from(new Set(products.filter(p => repCategory === 'ALL' || p.category === repCategory).map(p => p.subcategory))).filter(Boolean).sort() as string[];
  const uniqueBrands = Array.from(new Set(products.map(p => p.brand))).filter(Boolean).sort() as string[];
  
  const currentListFactor = useMemo(() => {
     if (selectedTargetList === 'BASE') return 1.0;
     const list = priceLists.find(l => l.id === selectedTargetList);
     return list ? list.factor : 1.0;
  }, [selectedTargetList, priceLists]);

  const currentListName = useMemo(() => {
     if (selectedTargetList === 'BASE') return 'PRECIO BASE (TIENDA)';
     return priceLists.find(l => l.id === selectedTargetList)?.name || 'Desconocido';
  }, [selectedTargetList, priceLists]);

  // ============================================================================
  // --- NÚCLEO MATEMÁTICO: CASCADA (COSTO -> PRECIO BASE -> OTRAS LISTAS) ---
  // ============================================================================
  const previewData = useMemo(() => {
     return products.filter(p => {
        const matchSup = selectedSupplier === 'ALL' || p.supplier_id === selectedSupplier;
        const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
        const matchSearch = searchTerm === '' || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        return matchSup && matchCat && matchSearch;
     }).map(p => {
        // Importe Unitario (con IGV) = Valor Unitario (last_cost, sin IGV) * 1.18
        const costWithIgv = p.last_cost ? p.last_cost * 1.18 : 0;
        
        // 1. CÁLCULO DIRECTO: Costo de Presentación Mínima (con IGV) + Margen% = NUEVO PRECIO BASE UNIDAD
        const newBasePriceUnit = costWithIgv * (1 + (targetMargin / 100));
        
        // 2. CÁLCULO CAJA: Precio Unidad * Contenido (Cálculo exacto, sin descuentos ocultos)
        const content = p.package_content || 1;
        const newBasePricePackage = newBasePriceUnit * content;

        // 3. PROYECCIÓN VISUAL
        const projectedListPrice = newBasePriceUnit * currentListFactor;

        // 4. IMPACTO / ALERTAS DE AUMENTO DE COSTO
        const priceChange = p.price_unit > 0 ? ((newBasePriceUnit - p.price_unit) / p.price_unit) * 100 : 0;
        
        // Evaluamos el margen actual con el precio vigente en tienda (usando el costo con IGV)
        const currentMargin = costWithIgv > 0 ? ((p.price_unit - costWithIgv) / costWithIgv) * 100 : 0;
        // Alerta si el margen actual cayó por debajo del 10% (indica un alza del costo reciente)
        const hasCostAlert = currentMargin < 10 && costWithIgv > 0;

        return {
           ...p,
           currentBasePrice: p.price_unit,
           calculatedBasePrice: newBasePriceUnit,
           calculatedPackagePrice: newBasePricePackage,
           finalPriceInList: projectedListPrice, 
           priceChange,
           currentMargin,
           hasCostAlert,
           costWithIgv
        };
     });
  }, [products, selectedSupplier, selectedCategory, searchTerm, targetMargin, currentListFactor]);

  // ============================================================================
  // --- GENERACIÓN DE DATOS PARA REPORTE MATRICIAL ---
  // ============================================================================
  const reportData = useMemo(() => {
    return products.filter(p => {
       const matchSup = repSupplier === 'ALL' || p.supplier_id === repSupplier;
       const matchCat = repCategory === 'ALL' || p.category === repCategory;
       const matchSub = repSubcategory === 'ALL' || p.subcategory === repSubcategory;
       const matchBrand = repBrand === 'ALL' || p.brand === repBrand;
       return matchSup && matchCat && matchSub && matchBrand;
    }).map(p => {
       const listPrices: Record<string, number> = {};
       priceLists.forEach(list => {
          listPrices[list.name] = p.price_unit * list.factor;
       });

       return {
          ...p,
          listPrices
       };
    });
  }, [products, repSupplier, repCategory, repSubcategory, repBrand, priceLists]);

  const toggleSelect = (id: string) => {
     const newSet = new Set(selectedIds);
     if (newSet.has(id)) newSet.delete(id);
     else newSet.add(id);
     setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
     if (selectedIds.size === previewData.length) setSelectedIds(new Set());
     else setSelectedIds(new Set(previewData.map(p => p.id)));
  };

  // --- 1. APLICAR PRECIOS MASIVOS (SUPABASE STRICT) ---
  const handleApplyPrices = async () => {
     if (selectedIds.size === 0) {
        setNotification({ msg: "Debe seleccionar al menos un producto.", type: 'error' });
        setTimeout(() => setNotification(null), 3000);
        return;
     }
     
     setIsSaving(true);

     try {
        const updates = previewData
           .filter(p => selectedIds.has(p.id))
           .map(p => ({
              id: p.id,
              price_unit: Number(p.calculatedBasePrice.toFixed(2)),
              price_package: Number(p.calculatedPackagePrice.toFixed(2)),
              profit_margin: targetMargin // Inyectamos el nuevo margen
           }));

        // Actualizaciones quirúrgicas en paralelo en Supabase
        const updatePromises = updates.map(updateData => 
           supabase.from('products').update({
              price_unit: updateData.price_unit,
              price_package: updateData.price_package,
              profit_margin: updateData.profit_margin
           }).eq('id', updateData.id).select()
        );
        
        await Promise.all(updatePromises);
        
        // Actualizar la vista local para que los cambios se reflejen al instante
        setProducts(prev => prev.map(p => {
           const u = updates.find(x => x.id === p.id);
           return u ? { ...p, ...u } as Product : p;
        }));
        
        setNotification({ msg: `Se inyectaron exitosamente los nuevos precios bases en ${updates.length} productos.`, type: 'success' });
        setSelectedIds(new Set());
     } catch (error: any) {
        setNotification({ msg: `Error de Base de Datos: ${error.message}`, type: 'error' });
     } finally {
        setTimeout(() => setNotification(null), 4000);
        setIsSaving(false);
     }
  };

  // --- 2. GESTIÓN DE LISTAS DE PRECIOS (CRUD BLINDADO) ---
  const handleSaveList = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!editingList?.name) return;
     setIsSaving(true);

     let finalFactor = 1.0;
     if (operationMode === 'DISCOUNT') finalFactor = 1 - (percentageValue / 100);
     else if (operationMode === 'INCREASE') finalFactor = 1 + (percentageValue / 100);

     try {
        const payload: any = {
           name: editingList.name.toUpperCase(),
           type: operationMode === 'BASE' ? 'BASE' : 'VARIATION',
           factor: Number(finalFactor.toFixed(4))
        };
        
        if (editingList.id) {
            const { data, error } = await supabase.from('price_lists').update(payload).eq('id', editingList.id).select();
            if (error) throw error;
            if (!data || data.length === 0) throw new Error("Bloqueo RLS. No se pudo actualizar en Supabase.");
            setPriceLists(prev => prev.map(l => l.id === editingList.id ? data[0] : l));
        } else {
            payload.id = crypto.randomUUID();
            const { data, error } = await supabase.from('price_lists').insert([payload]).select();
            if (error) throw error;
            if (!data || data.length === 0) throw new Error("Bloqueo RLS. La base de datos rechazó la inserción.");
            setPriceLists(prev => [...prev, data[0]]);
        }
        
        setEditingList(null);
        setNotification({ msg: "Regla Comercial guardada en la base de datos.", type: 'success' });
     } catch (error: any) {
        setNotification({ msg: "Error al guardar: " + error.message, type: 'error' });
     } finally {
        setIsSaving(false);
        setTimeout(() => setNotification(null), 4000);
     }
  };

  const handleDeleteList = async (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     if(!confirm('¿Eliminar esta lista? Si hay clientes o vendedores en esta lista, podrían perder su asignación.')) return;
     
     try {
        const { error } = await supabase.from('price_lists').delete().eq('id', id);
        if (error) throw error;
        setPriceLists(prev => prev.filter(l => l.id !== id));
        setNotification({ msg: "Lista eliminada permanentemente.", type: 'success' });
     } catch(err: any) {
        setNotification({ msg: "Error al eliminar: " + err.message, type: 'error' });
     } finally {
        setTimeout(() => setNotification(null), 3000);
     }
  }

  // --- 3. ASIGNACIÓN DE VENDEDORES ---
  const handlePendingAssignment = (sellerId: string, listId: string) => {
     setPendingAssignments(prev => ({ ...prev, [sellerId]: listId }));
     setHasChanges(true);
  };

  const getSellerListId = (seller: Seller) => {
     if (pendingAssignments[seller.id] !== undefined) return pendingAssignments[seller.id];
     return seller.price_list_id || '';
  };

  const saveAssignments = async () => {
     if (!hasChanges) return;
     setIsSaving(true);
     
     try {
        const updatePromises = Object.entries(pendingAssignments).map(([sellerId, listId]) => {
            const cleanListId = (listId === '' || !listId) ? null : listId;
            return supabase.from('sellers').update({ price_list_id: cleanListId }).eq('id', sellerId);
        });
        
        await Promise.all(updatePromises);
        await fetchData(); 
        
        setPendingAssignments({});
        setHasChanges(false);
        setNotification({ msg: "Matriz de asignaciones sincronizada con éxito.", type: 'success' });
     } catch(err:any) {
        setNotification({ msg: "Error al sincronizar matriz: " + err.message, type: 'error' });
     } finally {
        setIsSaving(false);
        setTimeout(() => setNotification(null), 3000);
     }
  };

  // --- 4. EXPORTACIÓN DE REPORTES ---
  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    
    // Configuración Base
    const primaryColor = [15, 23, 42]; // slate-900
    
    // Cabecera Documento
    doc.setFontSize(20);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Catálogo Maestro de Precios', 14, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 25);
    doc.text(`Total Registros: ${reportData.length}`, 14, 30);

    const tableColumn = [
      "SKU", 
      "Producto", 
      "Categoría",
      "U. Med", 
      "Caja", 
      "Costo Base", 
      "Precio Tienda", 
      ...priceLists.map(l => l.name)
    ];

    const tableRows = reportData.map(p => [
      p.sku,
      p.name,
      p.category || '-',
      p.unit_type,
      p.package_content.toString(),
      `S/ ${(p.last_cost * 1.18).toFixed(3)}`,
      `S/ ${p.price_unit.toFixed(2)}`,
      ...priceLists.map(l => `S/ ${p.listPrices[l.name].toFixed(2)}`)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: primaryColor as [number, number, number], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] }, // Verde para Precio Tienda
        ...priceLists.reduce((acc, _, i) => ({ ...acc, [7 + i]: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] } }), {})
      }
    });

    doc.save(`catalogo_precios_${new Date().getTime()}.pdf`);
  };

  const handleExportXLS = () => {
    const wsData = reportData.map(p => {
      const row: any = {
        'CÓDIGO SKU': p.sku,
        'NOMBRE DEL PRODUCTO': p.name,
        'LÍNEA': p.line || '-',
        'CATEGORÍA': p.category || '-',
        'SUBCATEGORÍA': p.subcategory || '-',
        'MARCA': p.brand || '-',
        'UNIDAD DE MEDIDA': p.unit_type,
        'FACTOR DE CAJA': p.package_content,
        'COSTO ÚLTIMA COMPRA (S/)': Number((p.last_cost * 1.18).toFixed(3)),
        'PRECIO BASE TIENDA (S/)': p.price_unit,
        'PRECIO CAJA CERRADA (S/)': p.price_package,
      };
      
      priceLists.forEach(l => {
         row[`PRECIO ${l.name} (S/)`] = p.listPrices[l.name];
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lista Precios");
    XLSX.writeFile(wb, `matriz_precios_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="h-full flex flex-col space-y-4 font-sans text-slate-800 relative bg-slate-50/50">
       {notification && <Notification msg={notification.msg} type={notification.type} onClose={() => setNotification(null)} />}

       {/* HEADER ELITE */}
       <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-200/60 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-green-100/50 to-blue-50/30 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          
          <div className="relative">
             <h2 className="text-2xl font-black flex items-center bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                <DollarSign className="mr-3 text-emerald-500 w-7 h-7" /> Ingeniería de Precios (Cloud)
             </h2>
             <p className="text-xs font-bold text-slate-400 mt-1 ml-10">Módulo centralizado con Supabase DB.</p>
          </div>
          
          <button onClick={fetchData} className="relative z-10 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl flex items-center transition-all shadow-sm border border-slate-200/80 font-bold text-sm hover:shadow-md active:scale-95 group">
             <RefreshCw className={`w-4 h-4 mr-2 text-slate-400 group-hover:text-emerald-500 transition-colors ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
             Sincronizar Maestro
          </button>
       </div>

       {/* TAB NAVIGATION ELITE */}
       <div className="flex bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden p-1.5 relative z-10">
          <button onClick={() => setActiveTab('CALCULATOR')} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-xl transition-all ${activeTab === 'CALCULATOR' ? 'bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-800 shadow-sm border border-emerald-200/50' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Calculator className="w-4 h-4 mr-2" /> 1. Generador Masivo
          </button>
          <button onClick={() => setActiveTab('PRICELISTS')} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-xl transition-all ${activeTab === 'PRICELISTS' ? 'bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-800 shadow-sm border border-blue-200/50' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Tag className="w-4 h-4 mr-2" /> 2. Reglas Derivadas
          </button>
          <button onClick={() => setActiveTab('SELLERS')} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-xl transition-all ${activeTab === 'SELLERS' ? 'bg-gradient-to-br from-purple-50 to-fuchsia-50 text-purple-800 shadow-sm border border-purple-200/50' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Users className="w-4 h-4 mr-2" /> 3. Matriz de Vendedores
          </button>
          <button onClick={() => setActiveTab('REPORTS')} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-xl transition-all ${activeTab === 'REPORTS' ? 'bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-md border border-slate-700' : 'text-slate-500 hover:bg-slate-50'}`}>
             <FileBarChart2 className="w-4 h-4 mr-2" /> 4. Reportes y Catálogos
          </button>
       </div>

       {/* MAIN WORKSPACE ELITE */}
       <div className="flex-1 bg-white/90 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col relative z-0">
          
          {/* --- TAB 1: MASS CALCULATOR --- */}
          {activeTab === 'CALCULATOR' && (
             <div className="flex flex-col h-full p-6 animate-fade-in">
                
                <div className="grid grid-cols-12 gap-5 mb-6 items-end bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 shadow-inner relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>

                   <div className="col-span-12 md:col-span-2 relative z-10">
                      <label className="block text-[10px] font-black text-emerald-700 uppercase mb-2 tracking-widest">Margen (Sobre Costo)</label>
                      <div className="relative">
                         <input 
                           type="number" 
                           className="w-full pl-4 pr-8 border-2 border-emerald-300 bg-white p-3 rounded-xl text-xl font-black text-emerald-900 focus:border-emerald-500 outline-none shadow-sm transition-all focus:shadow-emerald-200"
                           value={targetMargin}
                           onChange={e => setTargetMargin(Number(e.target.value))}
                        />
                         <span className="absolute right-4 top-3.5 text-emerald-600 font-black">%</span>
                      </div>
                   </div>

                   <div className="col-span-12 md:col-span-4 relative z-10">
                      <label className="block text-[10px] font-black text-blue-600 uppercase mb-2 tracking-widest">Simulación Visual en Lista</label>
                      <select 
                        className="w-full border-2 border-blue-200 bg-blue-50/50 p-3 rounded-xl text-sm font-bold text-blue-900 focus:border-blue-500 outline-none transition-colors shadow-sm"
                        value={selectedTargetList}
                        onChange={e => setSelectedTargetList(e.target.value)}
                      >
                         <option value="BASE">NO SIMULAR (MOSTRAR PRECIO TIENDA)</option>
                         {priceLists.map(l => <option key={l.id} value={l.id}>{l.name.toUpperCase()} (Factor: {l.factor}x)</option>)}
                      </select>
                   </div>

                   <div className="col-span-6 md:col-span-3 relative z-10">
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Proveedor</label>
                      <select className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl text-sm font-bold text-slate-700 focus:border-emerald-400 outline-none shadow-sm" value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                         <option value="ALL">TODOS LOS PROVEEDORES</option>
                         {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                   </div>
                   
                   <div className="col-span-6 md:col-span-3 relative z-10">
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Categoría</label>
                      <select className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl text-sm font-bold text-slate-700 focus:border-emerald-400 outline-none shadow-sm" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                         <option value="ALL">TODAS LAS CATEGORÍAS</option>
                         {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>

                   <div className="col-span-12 mt-2 relative z-10">
                      <div className="relative">
                         <Search className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                         <input 
                           className="w-full pl-12 border-2 border-slate-200 bg-white rounded-xl p-3.5 text-sm font-bold text-slate-800 focus:border-emerald-500 outline-none transition-colors shadow-sm placeholder:text-slate-400 placeholder:font-medium" 
                           placeholder="Filtrar matriz por nombre o código SKU..."
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                         />
                      </div>
                   </div>
                </div>

                <div className="flex-1 overflow-auto border border-slate-200/80 rounded-2xl bg-white relative shadow-sm">
                   <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-600 font-black sticky top-0 z-20 uppercase text-[10px] tracking-widest shadow-sm">
                         <tr>
                            <th className="p-4 w-12 text-center border-b border-slate-200">
                               <button onClick={toggleSelectAll} className="flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors">
                                  {selectedIds.size > 0 && selectedIds.size === previewData.length ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>}
                               </button>
                            </th>
                            <th className="p-4 border-b border-slate-200">Producto Maestro</th>
                            <th className="p-4 text-center border-b border-slate-200 bg-slate-100/50">Alertas</th>
                            <th className="p-4 text-right border-b border-slate-200 bg-slate-100/50">Costo Base</th>
                            <th className="p-4 text-right border-b border-slate-200">P. Tienda Actual</th>
                            
                            <th className="p-4 text-right bg-emerald-50 text-emerald-800 border-b border-emerald-200 border-l border-emerald-100">
                               Nuevo P. Base
                            </th>
                            <th className="p-4 text-center border-b border-slate-200">Var. Impacto</th>

                            {selectedTargetList !== 'BASE' && (
                               <th className="p-4 text-right bg-blue-50 text-blue-800 border-b border-blue-200 border-l border-r border-blue-100">
                                  Proyección {currentListName}
                               </th>
                            )}
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {isLoading && products.length === 0 ? (
                            <tr><td colSpan={8} className="p-20 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-4"/> <span className="font-bold text-slate-400">Cargando base de datos central...</span></td></tr>
                         ) : previewData.map(p => (
                            <tr key={p.id} className={`hover:bg-emerald-50/40 transition-colors cursor-pointer group ${selectedIds.has(p.id) ? 'bg-emerald-50/60' : ''}`} onClick={() => toggleSelect(p.id)}>
                               <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer border-slate-300 transition-all"
                                    checked={selectedIds.has(p.id)}
                                    onChange={() => toggleSelect(p.id)}
                                  />
                               </td>
                               <td className="p-4">
                                  <div className="font-black text-slate-800 text-sm group-hover:text-emerald-800 transition-colors">{p.name}</div>
                                  <div className="flex items-center gap-2 mt-1.5">
                                     <span className="text-[10px] font-mono font-black bg-slate-200 px-2 py-0.5 rounded text-slate-600">{p.sku}</span>
                                     <span className="text-[9px] font-black uppercase text-slate-400 border border-slate-200 px-1.5 rounded-sm">{p.category || 'SIN CAT'}</span>
                                  </div>
                               </td>
                               <td className="p-4 text-center">
                                  {p.hasCostAlert ? (
                                    <div className="group/tooltip relative inline-flex items-center justify-center">
                                       <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
                                       <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-[10px] font-bold p-2 rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
                                          ⚠️ Costo Elevado. Margen actual: {p.currentMargin.toFixed(1)}%. ¡Se requiere actualizar precio!
                                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                       </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 font-bold text-xs">-</span>
                                  )}
                               </td>
                               <td className="p-4 text-right text-slate-500 font-bold bg-slate-50/30">S/ {p.costWithIgv.toFixed(3)}</td>
                               <td className="p-4 text-right font-black text-slate-700">S/ {p.currentBasePrice.toFixed(2)}</td>
                               
                               <td className="p-4 text-right border-l border-emerald-100 bg-emerald-50/20">
                                  <div className="font-black text-emerald-700 text-base">S/ {p.calculatedBasePrice.toFixed(2)}</div>
                                  <div className="text-[10px] text-emerald-600 font-bold mt-1 tracking-wide">
                                     CAJA ({p.package_content}u): <span className="font-black">S/ {p.calculatedPackagePrice.toFixed(2)}</span>
                                  </div>
                               </td>
                               <td className="p-4 text-center">
                                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border shadow-sm flex items-center justify-center w-20 mx-auto ${
                                     p.priceChange > 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                                     p.priceChange < 0 ? 'bg-red-100 text-red-700 border-red-200' : 
                                     'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}>
                                     {p.priceChange > 0 ? <TrendingUp className="w-3 h-3 mr-1"/> : (p.priceChange < 0 ? <TrendingDown className="w-3 h-3 mr-1"/> : null)}
                                     {p.priceChange > 0 ? '+' : ''}{p.priceChange.toFixed(1)}%
                                  </span>
                               </td>

                               {selectedTargetList !== 'BASE' && (
                                  <td className="p-4 text-right font-black text-blue-700 bg-blue-50/30 border-l border-blue-100">
                                     S/ {p.finalPriceInList.toFixed(2)}
                                  </td>
                               )}
                            </tr>
                         ))}
                         {previewData.length === 0 && !isLoading && (
                            <tr><td colSpan={8} className="p-16 text-center text-slate-400 font-black uppercase tracking-widest">La matriz de filtros no generó resultados.</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>

                {selectedIds.size > 0 && (
                   <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-auto min-w-[500px] bg-slate-900/95 backdrop-blur-md text-white p-5 rounded-2xl shadow-2xl flex items-center justify-between gap-6 animate-fade-in-up border border-slate-700 z-30">
                      <div className="flex items-center">
                         <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-900 font-black text-xl w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-inner border border-emerald-300/50">
                            {selectedIds.size}
                         </div>
                         <div>
                            <p className="text-sm font-black uppercase tracking-widest text-slate-200">Lote en Memoria</p>
                            <p className="text-[11px] text-emerald-400 font-bold tracking-wide">Listos para inyección SQL</p>
                         </div>
                      </div>
                      
                      <div className="flex gap-3">
                         <button 
                           onClick={() => setSelectedIds(new Set())}
                           className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-bold transition-all border border-transparent hover:border-slate-700"
                           disabled={isSaving}
                         >
                            Cancelar
                         </button>
                         <button 
                           onClick={handleApplyPrices}
                           disabled={isSaving}
                           className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-2.5 rounded-xl font-black shadow-lg shadow-emerald-500/30 flex items-center transition-all disabled:opacity-50 hover:shadow-emerald-500/50 hover:-translate-y-0.5"
                         >
                            {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <Save className="w-5 h-5 mr-2" />}
                            {isSaving ? 'INJECTANDO...' : 'FIJAR PRECIOS'}
                         </button>
                      </div>
                   </div>
                )}
             </div>
          )}

          {/* --- TAB 2: PRICE LISTS --- */}
          {activeTab === 'PRICELISTS' && (
             <div className="flex gap-6 h-full p-6 animate-fade-in bg-slate-50/50">
                <div className="w-1/3 bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                   
                   <div className="flex justify-between items-center mb-6 relative z-10">
                      <h3 className="font-black text-slate-800 text-lg">Listas Derivadas</h3>
                      <button 
                        onClick={() => {
                           setEditingList({ name: '', factor: 1.0 });
                           setOperationMode('BASE');
                           setPercentageValue(0);
                        }} 
                        className="text-xs bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 font-black flex items-center transition-all shadow-md shadow-blue-600/20 active:scale-95"
                      >
                         <Plus className="w-4 h-4 mr-1.5" /> Nueva
                      </button>
                   </div>
                   
                   <div className="space-y-4 overflow-y-auto pr-2 relative z-10 custom-scrollbar">
                      <div className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-100 opacity-80">
                         <div className="flex justify-between items-start mb-2">
                             <div>
                                <div className="font-black text-slate-800 text-base">PRECIO BASE (TIENDA)</div>
                                <div className="text-[10px] text-slate-500 font-bold mt-1 tracking-wide">Pilar de Cálculo (1.00x)</div>
                             </div>
                             <div className="text-[9px] uppercase font-black px-2.5 py-1.5 rounded-lg border bg-white text-slate-600 border-slate-300 shadow-sm">
                                NEUTRAL
                             </div>
                         </div>
                      </div>

                      {priceLists.map(list => {
                         let label = "Precio Base";
                         let colorStyles = "bg-slate-100 text-slate-600 border-slate-200";
                         let value = "";

                         if (list.factor < 1) {
                            label = "Descuento";
                            colorStyles = "bg-emerald-50 text-emerald-700 border-emerald-200";
                            value = `-${((1 - list.factor) * 100).toFixed(0)}%`;
                         } else if (list.factor > 1) {
                            label = "Recargo";
                            colorStyles = "bg-blue-50 text-blue-700 border-blue-200";
                            value = `+${((list.factor - 1) * 100).toFixed(0)}%`;
                         }

                         return (
                            <div 
                              key={list.id} 
                              onClick={() => setEditingList(list)} 
                              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer group relative shadow-sm hover:shadow-md ${editingList?.id === list.id ? 'border-blue-500 bg-blue-50/10' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                            >
                               <div className="flex justify-between items-start mb-3">
                                  <div>
                                     <div className="font-black text-slate-800 group-hover:text-blue-700 transition-colors text-base">{list.name}</div>
                                     <div className="text-[10px] text-slate-400 font-mono mt-1 font-bold">{list.id.substring(0,8)}</div>
                                  </div>
                                  <div className={`text-[9px] uppercase font-black px-2.5 py-1.5 rounded-lg border shadow-sm ${colorStyles}`}>
                                     {label}
                                  </div>
                               </div>
                               <div className="flex justify-between items-end mt-4 border-t border-slate-100 pt-3">
                                  <div className="text-xs font-bold text-slate-500 tracking-wide">Multiplicador</div>
                                  <div className="text-xl font-black text-slate-800 flex items-center">
                                     <span className="text-sm text-slate-400 mr-2 font-bold">x{list.factor.toFixed(2)}</span>
                                     {value}
                                  </div>
                               </div>
                               
                               <button 
                                  onClick={(e) => handleDeleteList(list.id, e)} 
                                  className="absolute -top-3 -right-3 bg-white text-red-500 p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all border border-red-200 shadow-lg"
                               >
                                  <Trash2 className="w-4 h-4"/>
                               </button>
                            </div>
                         );
                      })}
                   </div>
                </div>
                
                <div className="flex-1 flex flex-col justify-center px-4">
                   {editingList ? (
                      <form onSubmit={handleSaveList} className="bg-white p-10 rounded-3xl shadow-xl border border-slate-200/80 max-w-xl mx-auto w-full relative overflow-hidden animate-fade-in-up">
                         <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                         
                         <h3 className="font-black text-2xl mb-8 text-slate-800 flex items-center">
                            <div className="bg-blue-100 p-2.5 rounded-xl mr-4 text-blue-600">
                               <Tag className="w-6 h-6" />
                            </div>
                            {editingList.id ? 'Modificar Regla Derivada' : 'Crear Regla Derivada'}
                         </h3>
                         
                         <div className="space-y-8">
                            <div className="relative">
                               <label className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-blue-600 uppercase tracking-widest z-10">Identificador Comercial</label>
                               <input 
                                 required 
                                 className="w-full border-2 border-slate-200 p-4 rounded-2xl text-xl font-black text-slate-800 focus:border-blue-500 outline-none transition-colors uppercase bg-slate-50 focus:bg-white shadow-inner" 
                                 value={editingList.name || ''} 
                                 onChange={e => setEditingList({...editingList, name: e.target.value.toUpperCase()})} 
                                 placeholder="Ej. MAYORISTA, HORECA, VIP..." 
                               />
                            </div>

                            <div>
                               <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Comportamiento (Sobre el Precio Base)</label>
                               <div className="grid grid-cols-3 gap-4">
                                  <button 
                                    type="button" 
                                    onClick={() => { setOperationMode('BASE'); setPercentageValue(0); }}
                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${operationMode === 'BASE' ? 'border-slate-800 bg-slate-800 text-white shadow-lg transform scale-[1.02]' : 'border-slate-200 text-slate-400 hover:border-slate-400 hover:bg-slate-50'}`}
                                  >
                                     <Equal className="w-7 h-7 mb-3" />
                                     <span className="text-[11px] font-black uppercase tracking-wide">Neutral</span>
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => { setOperationMode('DISCOUNT'); setPercentageValue(5); }}
                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${operationMode === 'DISCOUNT' ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg transform scale-[1.02]' : 'border-slate-200 text-slate-400 hover:border-emerald-300 hover:bg-emerald-50'}`}
                                  >
                                     <TrendingDown className="w-7 h-7 mb-3" />
                                     <span className="text-[11px] font-black uppercase tracking-wide">Descuento</span>
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => { setOperationMode('INCREASE'); setPercentageValue(10); }}
                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${operationMode === 'INCREASE' ? 'border-blue-500 bg-blue-500 text-white shadow-lg transform scale-[1.02]' : 'border-slate-200 text-slate-400 hover:border-blue-300 hover:bg-blue-50'}`}
                                  >
                                     <TrendingUp className="w-7 h-7 mb-3" />
                                     <span className="text-[11px] font-black uppercase tracking-wide">Recargo</span>
                                  </button>
                               </div>
                            </div>

                            {operationMode !== 'BASE' && (
                               <div className="animate-fade-in-down bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner">
                                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">
                                     {operationMode === 'DISCOUNT' ? 'Intensidad del Descuento' : 'Intensidad del Recargo'}
                                  </label>
                                  <div className="relative">
                                     <Percent className={`absolute left-5 top-5 w-6 h-6 ${operationMode === 'DISCOUNT' ? 'text-emerald-500' : 'text-blue-500'}`} />
                                     <input 
                                       type="number" 
                                       min="0.1" 
                                       max="100" 
                                       step="0.1"
                                       className={`w-full pl-14 pr-5 py-4 border-2 rounded-2xl text-4xl font-black focus:outline-none bg-white shadow-sm transition-colors ${operationMode === 'DISCOUNT' ? 'border-emerald-200 text-emerald-700 focus:border-emerald-500' : 'border-blue-200 text-blue-700 focus:border-blue-500'}`}
                                       value={percentageValue}
                                       onChange={e => setPercentageValue(Number(e.target.value))}
                                     />
                                  </div>
                                  
                                  <div className="mt-5 flex justify-between items-center text-sm border-t border-slate-200/80 pt-5">
                                     <span className="font-bold text-slate-500">Si un Precio Base es S/ 100.00 ➔</span>
                                     <span className={`font-black text-xl bg-white px-4 py-1.5 rounded-xl border shadow-sm ${operationMode === 'DISCOUNT' ? 'text-emerald-600 border-emerald-200' : 'text-blue-600 border-blue-200'}`}>
                                        S/ {operationMode === 'DISCOUNT' ? (100 * (1 - percentageValue/100)).toFixed(2) : (100 * (1 + percentageValue/100)).toFixed(2)}
                                     </span>
                                  </div>
                               </div>
                            )}

                            <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
                               <button type="button" onClick={() => setEditingList(null)} disabled={isSaving} className="px-6 py-3.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
                               <button type="submit" disabled={isSaving} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3.5 rounded-xl font-black hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center disabled:opacity-50">
                                  {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <Save className="w-5 h-5 mr-2" />}
                                  {isSaving ? 'GUARDANDO...' : 'GUARDAR REGLA'}
                               </button>
                            </div>
                         </div>
                      </form>
                   ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[2rem] p-12 bg-white/50 backdrop-blur-sm">
                         <div className="bg-slate-100 p-5 rounded-full mb-6 text-slate-300">
                            <Tag className="w-16 h-16" />
                         </div>
                         <p className="font-black text-2xl text-slate-400 uppercase tracking-widest mb-3">Motor de Reglas</p>
                         <p className="text-sm font-bold mt-2 text-center max-w-sm leading-relaxed">Selecciona una lista a la izquierda para modificarla o crea una nueva regla para segmentar tus precios automáticamente.</p>
                      </div>
                   )}
                </div>
             </div>
          )}

          {/* --- TAB 3: SELLER ASSIGNMENT --- */}
          {activeTab === 'SELLERS' && (
             <div className="flex flex-col h-full relative p-8 animate-fade-in bg-slate-50/50">
                
                {hasChanges && (
                   <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-6 animate-fade-in-down border border-slate-700">
                      <span className="text-sm font-black flex items-center uppercase tracking-widest">
                         <AlertCircle className="w-5 h-5 mr-3 text-yellow-400" /> Cambios pendientes
                      </span>
                      <button 
                         onClick={saveAssignments}
                         disabled={isSaving}
                         className="bg-purple-500 hover:bg-purple-400 text-slate-900 px-6 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-purple-500/30 flex items-center disabled:opacity-50 hover:-translate-y-0.5"
                      >
                         {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
                         SINCRONIZAR DB
                      </button>
                   </div>
                )}

                <div className="bg-gradient-to-r from-purple-100/80 to-purple-50/50 p-6 rounded-2xl border border-purple-200/80 mb-8 flex items-start shadow-sm backdrop-blur-sm">
                   <div className="bg-white p-3 rounded-2xl mr-5 shadow-sm border border-purple-100 text-purple-600">
                      <Users className="w-8 h-8" />
                   </div>
                   <div>
                      <h4 className="font-black text-purple-900 text-xl tracking-tight">Matriz de Precios por Vendedor</h4>
                      <p className="text-sm font-medium text-purple-700/80 mt-1.5 max-w-3xl leading-relaxed">
                         La lista asignada operará como la "Lista Predeterminada" en la ruta de cada vendedor. Todos los clientes nuevos y prospectos visualizarán estos precios en la App Móvil.
                      </p>
                   </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex-1">
                   <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 sticky top-0">
                         <tr>
                            <th className="p-5 w-20 text-center">Avatar</th>
                            <th className="p-5">Fuerza de Venta</th>
                            <th className="p-5">Lista Base Asignada</th>
                            <th className="p-5 text-center w-48">Impacto Global</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {sellers.length === 0 ? (
                            <tr><td colSpan={4} className="p-16 text-center text-slate-400 font-black tracking-widest uppercase">No hay vendedores registrados en la plataforma.</td></tr>
                         ) : sellers.map(seller => {
                            const currentListId = getSellerListId(seller);
                            const assignedList = priceLists.find(l => l.id === currentListId);
                            const isModified = pendingAssignments[seller.id] !== undefined;

                            return (
                               <tr key={seller.id} className={`transition-all duration-300 ${isModified ? 'bg-yellow-50/50 border-l-4 border-yellow-400' : 'hover:bg-slate-50/80 border-l-4 border-transparent'}`}>
                                  <td className="p-5 text-center">
                                     <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-black text-sm mx-auto shadow-md border border-slate-600">
                                        {seller.name.substring(0,2).toUpperCase()}
                                     </div>
                                  </td>
                                  <td className="p-5">
                                     <div className="font-black text-slate-800 text-lg">{seller.name}</div>
                                     <div className="text-xs text-slate-400 font-mono font-bold mt-1 tracking-wide">{seller.dni}</div>
                                  </td>
                                  <td className="p-5">
                                     <div className="relative max-w-md">
                                        <select 
                                          className={`w-full appearance-none border-2 rounded-xl p-3.5 pl-5 pr-12 text-sm font-black outline-none transition-all cursor-pointer ${isModified ? 'border-yellow-400 bg-white text-slate-900 shadow-md shadow-yellow-100' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-400 hover:bg-white hover:shadow-sm'}`}
                                          value={currentListId}
                                          onChange={e => handlePendingAssignment(seller.id, e.target.value)}
                                        >
                                           <option value="">[ PRECIO BASE / NEUTRAL ]</option>
                                           {priceLists.map(l => <option key={l.id} value={l.id}>{l.name.toUpperCase()}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-4 pointer-events-none text-slate-400 bg-white rounded-md p-0.5">
                                           <Filter className="w-4 h-4" />
                                        </div>
                                     </div>
                                  </td>
                                  <td className="p-5 text-center">
                                     <span className={`font-black text-sm px-4 py-2 rounded-xl border shadow-sm flex justify-center items-center ${assignedList ? (assignedList.factor < 1 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : assignedList.factor > 1 ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-slate-600 bg-slate-100 border-slate-200') : 'text-slate-500 bg-slate-100 border-slate-200'}`}>
                                        {assignedList ? `${assignedList.factor.toFixed(2)}x` : '1.00x'}
                                     </span>
                                  </td>
                               </tr>
                            );
                         })}
                      </tbody>
                   </table>
                </div>
             </div>
          )}

          {/* --- TAB 4: REPORTS --- */}
          {activeTab === 'REPORTS' && (
             <div className="flex flex-col h-full p-6 animate-fade-in bg-white relative">
                {/* Decoración de fondo */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-b from-slate-100 to-white rounded-full blur-3xl -mr-20 -mt-20 opacity-50 pointer-events-none"></div>

                <div className="flex justify-between items-end mb-6 relative z-10">
                   <div>
                      <h3 className="font-black text-2xl text-slate-800 flex items-center">
                         <FileBarChart2 className="w-7 h-7 mr-3 text-slate-700" /> Catálogo y Reportes
                      </h3>
                      <p className="text-sm font-medium text-slate-500 mt-1 ml-10">Genera reportes matriciales en PDF y Excel con filtros avanzados.</p>
                   </div>
                   <div className="flex gap-3">
                      <button onClick={handleExportXLS} className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-5 py-2.5 rounded-xl font-black text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center active:scale-95">
                         <FileSpreadsheet className="w-4 h-4 mr-2" />
                         XLSX
                      </button>
                      <button onClick={handleExportPDF} className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white px-5 py-2.5 rounded-xl font-black text-sm shadow-md shadow-red-500/20 transition-all flex items-center active:scale-95">
                         <FileText className="w-4 h-4 mr-2" />
                         PDF
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 shadow-inner relative z-10">
                   <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Proveedor</label>
                      <select className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl text-sm font-bold text-slate-700 focus:border-slate-400 outline-none shadow-sm" value={repSupplier} onChange={e => setRepSupplier(e.target.value)}>
                         <option value="ALL">Todos</option>
                         {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Categoría</label>
                      <select className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl text-sm font-bold text-slate-700 focus:border-slate-400 outline-none shadow-sm" value={repCategory} onChange={e => { setRepCategory(e.target.value); setRepSubcategory('ALL'); }}>
                         <option value="ALL">Todas</option>
                         {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Subcategoría</label>
                      <select className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl text-sm font-bold text-slate-700 focus:border-slate-400 outline-none shadow-sm" value={repSubcategory} onChange={e => setRepSubcategory(e.target.value)} disabled={repCategory === 'ALL'}>
                         <option value="ALL">Todas</option>
                         {uniqueSubcategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Marca</label>
                      <select className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl text-sm font-bold text-slate-700 focus:border-slate-400 outline-none shadow-sm" value={repBrand} onChange={e => setRepBrand(e.target.value)}>
                         <option value="ALL">Todas</option>
                         {uniqueBrands.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                </div>

                <div className="flex-1 overflow-auto border border-slate-200/80 rounded-2xl bg-white shadow-sm relative z-10 custom-scrollbar">
                   <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
                      <thead className="bg-slate-900 text-slate-300 font-black sticky top-0 z-20 uppercase text-[10px] tracking-widest shadow-md">
                         <tr>
                            <th className="p-4 border-b border-slate-700">Producto</th>
                            <th className="p-4 text-center border-b border-slate-700">U. Med / Caja</th>
                            <th className="p-4 text-right border-b border-slate-700">Costo Base</th>
                            <th className="p-4 text-right border-b border-slate-700 text-emerald-400">P. Base Tienda</th>
                            {priceLists.map(l => (
                               <th key={l.id} className="p-4 text-right border-b border-slate-700 text-blue-400 border-l border-slate-700/50">
                                  {l.name}
                               </th>
                            ))}
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {reportData.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                               <td className="p-4">
                                  <div className="font-black text-slate-800 text-sm">{p.name}</div>
                                  <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{p.sku} | {p.brand}</div>
                               </td>
                               <td className="p-4 text-center">
                                  <div className="font-black text-slate-600">{p.unit_type}</div>
                                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">Factor: {p.package_content}</div>
                               </td>
                               <td className="p-4 text-right font-bold text-slate-500">S/ {(p.last_cost * 1.18).toFixed(3)}</td>
                               <td className="p-4 text-right font-black text-emerald-700 bg-emerald-50/30">S/ {p.price_unit.toFixed(2)}</td>
                               {priceLists.map(l => (
                                  <td key={l.id} className="p-4 text-right font-black text-blue-700 bg-blue-50/10 border-l border-slate-50">
                                     S/ {p.listPrices[l.name].toFixed(2)}
                                  </td>
                               ))}
                            </tr>
                         ))}
                         {reportData.length === 0 && (
                            <tr><td colSpan={4 + priceLists.length} className="p-16 text-center text-slate-400 font-black uppercase tracking-widest">No hay datos para exportar con los filtros actuales.</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
          )}

       </div>
    </div>
  );
};
