
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../services/store';
import { PriceList, Seller } from '../types';
import { Calculator, Tag, Users, Save, DollarSign, Plus, RefreshCw, TrendingDown, TrendingUp, Equal, Percent, CheckSquare, Square, Search, AlertCircle, CheckCircle2, Loader2, X, MapPin, User, ChevronRight } from 'lucide-react';

type Tab = 'CALCULATOR' | 'PRICELISTS' | 'SELLERS';
type OperationMode = 'BASE' | 'DISCOUNT' | 'INCREASE';

// Toast Notification Component
const Notification = ({ msg, type, onClose }: { msg: string, type: 'success' | 'error', onClose: () => void }) => (
  <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-lg shadow-xl border-l-4 animate-fade-in-down bg-white ${type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
    {type === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-600 mr-3" /> : <AlertCircle className="w-5 h-5 text-red-600 mr-3" />}
    <div>
       <h4 className={`font-bold text-sm ${type === 'success' ? 'text-green-800' : 'text-red-800'}`}>{type === 'success' ? 'Éxito' : 'Error'}</h4>
       <p className="text-xs text-slate-600">{msg}</p>
    </div>
    <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
  </div>
);

export const PriceManager: React.FC = () => {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('CALCULATOR');

  // --- TAB 1: CALCULATOR STATE ---
  const [selectedTargetList, setSelectedTargetList] = useState('BASE'); 
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [targetMargin, setTargetMargin] = useState<number>(30); // Default 30%
  
  // Selection State
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

  // Sync internal Factor when editing starts
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
  const uniqueCategories = Array.from(new Set(store.products.map(p => p.category))).sort() as string[];
  
  // Get Factor of currently selected list
  const currentListFactor = useMemo(() => {
     if (selectedTargetList === 'BASE') return 1.0;
     const list = store.priceLists.find(l => l.id === selectedTargetList);
     return list ? list.factor : 1.0;
  }, [selectedTargetList, store.priceLists]);

  const currentListName = useMemo(() => {
     if (selectedTargetList === 'BASE') return 'PRECIO BASE (TIENDA)';
     return store.priceLists.find(l => l.id === selectedTargetList)?.name || 'Desconocido';
  }, [selectedTargetList, store.priceLists]);

  // --- CALCULATION LOGIC ---
  const previewData = useMemo(() => {
     return store.products.filter(p => {
        const matchSup = selectedSupplier === 'ALL' || p.supplier_id === selectedSupplier;
        const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
        const matchSearch = searchTerm === '' || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        return matchSup && matchCat && matchSearch;
     }).map(p => {
        // 1. Costo Base (GROSS / INC IGV)
        const cost = p.last_cost || 0;
        
        // 2. Calcular el Precio Objetivo FINAL (Inc. IGV)
        const targetFinalPriceUnit = cost * (1 + (targetMargin / 100));

        // 3. Ingeniería Inversa para hallar Base
        const requiredBasePriceUnit = targetFinalPriceUnit / currentListFactor;

        // 4. Calcular Precio Caja (Regla de negocio simple: x contenido x 0.95 descuento volumen)
        const content = p.package_content || 1;
        const bulkDiscount = content > 1 ? 0.95 : 1.0;
        const requiredBasePricePackage = requiredBasePriceUnit * content * bulkDiscount;

        // Calcular Variación solo si hay precio anterior
        const priceChange = p.price_unit > 0 ? ((requiredBasePriceUnit - p.price_unit) / p.price_unit) * 100 : 0;

        return {
           ...p,
           currentBasePrice: p.price_unit,
           calculatedBasePrice: requiredBasePriceUnit,
           calculatedPackagePrice: requiredBasePricePackage,
           finalPriceInList: targetFinalPriceUnit, 
           priceChange
        };
     });
  }, [store.products, selectedSupplier, selectedCategory, searchTerm, targetMargin, currentListFactor]);

  // --- SELECTION HANDLERS ---
  const toggleSelect = (id: string) => {
     const newSet = new Set(selectedIds);
     if (newSet.has(id)) newSet.delete(id);
     else newSet.add(id);
     setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
     if (selectedIds.size === previewData.length) {
        setSelectedIds(new Set());
     } else {
        setSelectedIds(new Set(previewData.map(p => p.id)));
     }
  };

  // --- APPLY CHANGES (CALCULATOR) ---
  const handleApplyPrices = async () => {
     if (selectedIds.size === 0) {
        setNotification({ msg: "Debe seleccionar al menos un producto.", type: 'error' });
        setTimeout(() => setNotification(null), 3000);
        return;
     }
     
     setIsSaving(true);

     // Simulate processing delay for better UX
     await new Promise(resolve => setTimeout(resolve, 800));

     const updates = previewData
        .filter(p => selectedIds.has(p.id))
        .map(p => ({
           id: p.id,
           price_unit: Number(p.calculatedBasePrice.toFixed(2)),
           price_package: Number(p.calculatedPackagePrice.toFixed(2)),
           profit_margin: targetMargin
        }));

     store.batchUpdateProductPrices(updates);
     
     setNotification({ msg: `Se actualizaron correctamente ${updates.length} productos.`, type: 'success' });
     setTimeout(() => setNotification(null), 4000);
     
     setSelectedIds(new Set());
     setIsSaving(false);
  };

  // --- LISTS & SELLERS LOGIC ---
  const handleSaveList = (e: React.FormEvent) => {
     e.preventDefault();
     if (!editingList?.name) return;
     let finalFactor = 1.0;
     if (operationMode === 'DISCOUNT') finalFactor = 1 - (percentageValue / 100);
     else if (operationMode === 'INCREASE') finalFactor = 1 + (percentageValue / 100);

     const list: PriceList = {
        id: editingList.id || crypto.randomUUID(),
        name: editingList.name,
        type: operationMode === 'BASE' ? 'BASE' : 'VARIATION',
        factor: Number(finalFactor.toFixed(4))
     };
     
     if (editingList.id) store.updatePriceList(list);
     else store.addPriceList(list);
     setEditingList(null);
     setNotification({ msg: "Lista de precios guardada.", type: 'success' });
     setTimeout(() => setNotification(null), 2000);
  };

  // --- SELLER ASSIGNMENT LOGIC ---
  const handlePendingAssignment = (sellerId: string, listId: string) => {
     setPendingAssignments(prev => {
        const newState = { ...prev, [sellerId]: listId };
        return newState;
     });
     setHasChanges(true);
  };

  const getSellerListId = (seller: Seller) => {
     if (pendingAssignments[seller.id] !== undefined) return pendingAssignments[seller.id];
     return seller.price_list_id || '';
  };

  const saveAssignments = () => {
     if (!hasChanges) return;
     
     Object.entries(pendingAssignments).forEach(([sellerId, listId]) => {
        const seller = store.sellers.find(s => s.id === sellerId);
        if (seller) {
           store.updateSeller({ ...seller, price_list_id: listId });
        }
     });
     
     setPendingAssignments({});
     setHasChanges(false);
     setNotification({ msg: "Asignaciones actualizadas correctamente.", type: 'success' });
     setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="h-full flex flex-col space-y-4 font-sans text-slate-800 relative">
       {/* NOTIFICATIONS */}
       {notification && <Notification msg={notification.msg} type={notification.type} onClose={() => setNotification(null)} />}

       <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center">
             <DollarSign className="mr-2 text-green-600" /> Gestión de Precios Inteligente
          </h2>
       </div>

       {/* TABS */}
       <div className="flex bg-white rounded-t-lg border-b border-slate-200">
          <button onClick={() => setActiveTab('CALCULATOR')} className={`px-6 py-3 text-sm font-bold flex items-center ${activeTab === 'CALCULATOR' ? 'text-green-700 border-b-2 border-green-600 bg-green-50' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Calculator className="w-4 h-4 mr-2" /> Calculadora Masiva
          </button>
          <button onClick={() => setActiveTab('PRICELISTS')} className={`px-6 py-3 text-sm font-bold flex items-center ${activeTab === 'PRICELISTS' ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Tag className="w-4 h-4 mr-2" /> Listas de Precios
          </button>
          <button onClick={() => setActiveTab('SELLERS')} className={`px-6 py-3 text-sm font-bold flex items-center ${activeTab === 'SELLERS' ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Users className="w-4 h-4 mr-2" /> Asignación Vendedores
          </button>
       </div>

       {/* CONTENT */}
       <div className="flex-1 bg-white rounded-b-lg shadow border border-slate-200 p-6 overflow-hidden flex flex-col relative">
          
          {/* --- TAB 1: MASS CALCULATOR --- */}
          {activeTab === 'CALCULATOR' && (
             <div className="flex flex-col h-full">
                
                {/* CONTROL PANEL */}
                <div className="grid grid-cols-12 gap-4 mb-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
                   
                   {/* Row 1: Strategy */}
                   <div className="col-span-12 md:col-span-4">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estrategia (Lista Objetivo)</label>
                      <select 
                        className="w-full border-2 border-slate-300 p-2 rounded text-sm font-bold text-slate-800 shadow-sm focus:border-green-500 outline-none"
                        value={selectedTargetList}
                        onChange={e => setSelectedTargetList(e.target.value)}
                      >
                         <option value="BASE">PRECIO BASE (TIENDA / ESTÁNDAR)</option>
                         {store.priceLists.map(l => <option key={l.id} value={l.id}>{l.name.toUpperCase()} (Factor: {l.factor}x)</option>)}
                      </select>
                   </div>

                   {/* Row 1: Filters */}
                   <div className="col-span-6 md:col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Filtrar Proveedor</label>
                      <select className="w-full border border-slate-300 p-2 rounded text-sm" value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                         <option value="ALL">Todos los Proveedores</option>
                         {store.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                   </div>
                   <div className="col-span-6 md:col-span-3">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Filtrar Categoría</label>
                      <select className="w-full border border-slate-300 p-2 rounded text-sm" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                         <option value="ALL">Todas las Categorías</option>
                         {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>

                   {/* Row 1: Margin Input */}
                   <div className="col-span-12 md:col-span-2">
                      <label className="block text-xs font-bold text-green-700 mb-1">Margen Objetivo</label>
                      <div className="relative">
                         <input 
                           type="number" 
                           className="w-full pl-3 pr-8 border-2 border-green-400 p-2 rounded text-lg font-bold text-green-800 focus:ring-green-500 outline-none"
                           value={targetMargin}
                           onChange={e => setTargetMargin(Number(e.target.value))}
                        />
                         <span className="absolute right-3 top-2.5 text-green-600 font-bold">%</span>
                      </div>
                   </div>

                   {/* Row 2: Search */}
                   <div className="col-span-12 mt-2">
                      <div className="relative">
                         <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                         <input 
                           className="w-full pl-9 border border-slate-300 rounded p-2 text-sm bg-white" 
                           placeholder="Buscar producto por nombre o código..."
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                         />
                      </div>
                   </div>
                </div>

                {/* TABLE PREVIEW */}
                <div className="flex-1 overflow-auto border border-slate-300 rounded-lg bg-white relative">
                   <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 shadow-sm uppercase text-xs tracking-wider">
                         <tr>
                            <th className="p-3 w-10 text-center border-b border-slate-200">
                               <button onClick={toggleSelectAll} className="flex items-center justify-center text-slate-500 hover:text-blue-600">
                                  {selectedIds.size > 0 && selectedIds.size === previewData.length ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>}
                               </button>
                            </th>
                            <th className="p-3 border-b border-slate-200">Producto / Código</th>
                            <th className="p-3 text-right border-b border-slate-200 bg-slate-50">Costo (Inc. IGV)</th>
                            <th className="p-3 text-right border-b border-slate-200">P. Base Actual</th>
                            
                            {selectedTargetList !== 'BASE' && (
                               <th className="p-3 text-right bg-blue-50 text-blue-800 border-b border-blue-200 border-l border-r">
                                  Simulación {currentListName}
                               </th>
                            )}

                            <th className="p-3 text-right bg-green-50 text-green-800 border-b border-green-200 border-l">
                               Nuevo P. Base
                            </th>
                            <th className="p-3 text-center border-b border-slate-200">Variación</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {previewData.map(p => (
                            <tr key={p.id} className={`hover:bg-blue-50 transition-colors ${selectedIds.has(p.id) ? 'bg-blue-50' : ''}`} onClick={() => toggleSelect(p.id)}>
                               <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    checked={selectedIds.has(p.id)}
                                    onChange={() => toggleSelect(p.id)}
                                  />
                               </td>
                               <td className="p-3">
                                  <div className="font-bold text-slate-700 text-sm">{p.name}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                     <span className="text-[10px] font-mono bg-slate-200 px-1.5 rounded text-slate-600">{p.sku}</span>
                                     <span className="text-[10px] text-slate-400">{p.category}</span>
                                  </div>
                               </td>
                               <td className="p-3 text-right text-slate-500 font-medium">S/ {p.last_cost.toFixed(2)}</td>
                               <td className="p-3 text-right font-medium text-slate-600">S/ {p.currentBasePrice.toFixed(2)}</td>
                               
                               {selectedTargetList !== 'BASE' && (
                                  <td className="p-3 text-right font-bold text-blue-700 bg-blue-50/50 border-l border-r border-blue-100">
                                     S/ {p.finalPriceInList.toFixed(2)}
                                  </td>
                               )}

                               <td className="p-3 text-right border-l border-green-100 bg-green-50/30">
                                  <div className="font-bold text-green-700 text-base">S/ {p.calculatedBasePrice.toFixed(2)}</div>
                                  <div className="text-[10px] text-green-600">Caja: S/ {p.calculatedPackagePrice.toFixed(2)}</div>
                               </td>
                               <td className="p-3 text-center">
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                                     p.priceChange > 0 ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                                     p.priceChange < 0 ? 'bg-red-100 text-red-700 border-red-200' : 
                                     'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}>
                                     {p.priceChange > 0 ? '+' : ''}{p.priceChange.toFixed(1)}%
                                  </span>
                               </td>
                            </tr>
                         ))}
                         {previewData.length === 0 && (
                            <tr><td colSpan={7} className="p-10 text-center text-slate-400 italic">No se encontraron productos con los filtros seleccionados.</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>

                {/* BOTTOM ACTION BAR (Appears when items are selected) */}
                {selectedIds.size > 0 && (
                   <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-auto min-w-[400px] bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between gap-6 animate-fade-in-up border border-slate-700 z-20">
                      <div className="flex items-center">
                         <div className="bg-green-500 text-slate-900 font-bold w-8 h-8 rounded-full flex items-center justify-center mr-3">
                            {selectedIds.size}
                         </div>
                         <div>
                            <p className="text-sm font-bold">Productos Seleccionados</p>
                            <p className="text-xs text-slate-400">Listos para actualizar precios</p>
                         </div>
                      </div>
                      
                      <div className="flex gap-2">
                         <button 
                           onClick={() => setSelectedIds(new Set())}
                           className="px-4 py-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
                           disabled={isSaving}
                         >
                            Cancelar
                         </button>
                         <button 
                           onClick={handleApplyPrices}
                           disabled={isSaving}
                           className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow flex items-center transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                         >
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <RefreshCw className="w-4 h-4 mr-2" />}
                            {isSaving ? 'Procesando...' : 'APLICAR CAMBIOS'}
                         </button>
                      </div>
                   </div>
                )}
             </div>
          )}

          {/* --- TAB 2: PRICE LISTS (REDESIGNED) --- */}
          {activeTab === 'PRICELISTS' && (
             <div className="flex gap-6 h-full">
                {/* LIST SELECTOR - Left Panel */}
                <div className="w-1/3 border-r border-slate-200 pr-6 flex flex-col">
                   <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-700">Listas Definidas</h3>
                      <button 
                        onClick={() => {
                           setEditingList({ name: '', factor: 1.0 });
                           setOperationMode('BASE');
                           setPercentageValue(0);
                        }} 
                        className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-full hover:bg-slate-700 flex items-center transition-colors shadow-sm"
                      >
                         <Plus className="w-3 h-3 mr-1" /> Nueva
                      </button>
                   </div>
                   <div className="space-y-3 overflow-y-auto pr-2">
                      {store.priceLists.map(list => {
                         // Derive visual info
                         let label = "Precio Base";
                         let colorStyles = "bg-slate-100 text-slate-600 border-slate-200";
                         let value = "";

                         if (list.factor < 1) {
                            label = "Descuento";
                            colorStyles = "bg-green-50 text-green-700 border-green-200";
                            value = `-${((1 - list.factor) * 100).toFixed(0)}%`;
                         } else if (list.factor > 1) {
                            label = "Aumento";
                            colorStyles = "bg-blue-50 text-blue-700 border-blue-200";
                            value = `+${((list.factor - 1) * 100).toFixed(0)}%`;
                         }

                         return (
                            <div 
                              key={list.id} 
                              onClick={() => setEditingList(list)} 
                              className={`p-4 rounded-xl border transition-all cursor-pointer group ${editingList?.id === list.id ? 'border-slate-800 bg-slate-50 ring-1 ring-slate-800' : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-md'}`}
                            >
                               <div className="flex justify-between items-start mb-2">
                                  <div>
                                     <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{list.name}</div>
                                     <div className="text-[10px] text-slate-400 font-mono mt-0.5">{list.id.substring(0,8)}</div>
                                  </div>
                                  <div className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${colorStyles}`}>
                                     {label}
                                  </div>
                               </div>
                               <div className="flex justify-between items-end mt-3 border-t border-slate-100 pt-2">
                                  <div className="text-xs text-slate-500">Factor Multiplicador</div>
                                  <div className="text-xl font-bold text-slate-700 flex items-center">
                                     <span className="text-xs text-slate-400 mr-2 font-normal">x{list.factor.toFixed(2)}</span>
                                     {value}
                                  </div>
                               </div>
                            </div>
                         );
                      })}
                   </div>
                </div>
                
                {/* EDITOR FORM - Right Panel */}
                <div className="flex-1 pl-4 flex flex-col justify-center">
                   {editingList ? (
                      <form onSubmit={handleSaveList} className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-lg mx-auto w-full relative overflow-hidden">
                         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                         <h3 className="font-bold text-xl mb-8 text-slate-800 flex items-center">
                            <Tag className="mr-3 text-slate-400 w-6 h-6" />
                            {editingList.id ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}
                         </h3>
                         
                         <div className="space-y-8">
                            {/* NAME */}
                            <div className="relative">
                               <label className="absolute -top-2.5 left-3 bg-white px-1 text-xs font-bold text-blue-600">Nombre de la Lista</label>
                               <input 
                                 required 
                                 className="w-full border-2 border-slate-200 p-4 rounded-xl text-lg font-bold text-slate-800 focus:border-blue-500 outline-none transition-colors bg-slate-50 focus:bg-white" 
                                 value={editingList.name || ''} 
                                 onChange={e => setEditingList({...editingList, name: e.target.value})} 
                                 placeholder="Ej. MAYORISTA, HORECA, VIP..." 
                               />
                            </div>

                            {/* LOGIC SELECTOR */}
                            <div>
                               <label className="block text-xs font-bold text-slate-400 uppercase mb-3 ml-1">Regla de Cálculo</label>
                               <div className="grid grid-cols-3 gap-3">
                                  <button 
                                    type="button" 
                                    onClick={() => { setOperationMode('BASE'); setPercentageValue(0); }}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${operationMode === 'BASE' ? 'border-slate-800 bg-slate-800 text-white shadow-lg transform scale-105' : 'border-slate-200 text-slate-400 hover:border-slate-400 hover:bg-slate-50'}`}
                                  >
                                     <Equal className="w-6 h-6 mb-2" />
                                     <span className="text-xs font-bold">Igual (Base)</span>
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => { setOperationMode('DISCOUNT'); setPercentageValue(5); }}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${operationMode === 'DISCOUNT' ? 'border-green-500 bg-green-500 text-white shadow-lg transform scale-105' : 'border-slate-200 text-slate-400 hover:border-green-300 hover:bg-green-50'}`}
                                  >
                                     <TrendingDown className="w-6 h-6 mb-2" />
                                     <span className="text-xs font-bold">Descuento</span>
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => { setOperationMode('INCREASE'); setPercentageValue(10); }}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${operationMode === 'INCREASE' ? 'border-blue-500 bg-blue-500 text-white shadow-lg transform scale-105' : 'border-slate-200 text-slate-400 hover:border-blue-300 hover:bg-blue-50'}`}
                                  >
                                     <TrendingUp className="w-6 h-6 mb-2" />
                                     <span className="text-xs font-bold">Aumento</span>
                                  </button>
                               </div>
                            </div>

                            {/* PERCENTAGE INPUT */}
                            {operationMode !== 'BASE' && (
                               <div className="animate-fade-in-down">
                                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">
                                     {operationMode === 'DISCOUNT' ? 'Porcentaje de Descuento' : 'Porcentaje de Recargo'}
                                  </label>
                                  <div className="relative">
                                     <Percent className={`absolute left-4 top-4 w-6 h-6 ${operationMode === 'DISCOUNT' ? 'text-green-500' : 'text-blue-500'}`} />
                                     <input 
                                       type="number" 
                                       min="0" 
                                       max="100" 
                                       step="0.1"
                                       className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl text-3xl font-bold focus:outline-none bg-white ${operationMode === 'DISCOUNT' ? 'border-green-100 text-green-600 focus:border-green-500' : 'border-blue-100 text-blue-600 focus:border-blue-500'}`}
                                       value={percentageValue}
                                       onChange={e => setPercentageValue(Number(e.target.value))}
                                     />
                                  </div>
                               </div>
                            )}

                            {/* SIMULATOR */}
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                               <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Vista Previa</h4>
                               <div className="flex justify-between items-center text-sm mb-2 text-slate-500">
                                  <span>Precio Base Ejemplo:</span>
                                  <span>S/ 100.00</span>
                               </div>
                               <div className="flex justify-between items-center text-lg font-bold border-t border-slate-200 pt-2">
                                  <span className="text-slate-800">Resultado:</span>
                                  <span className={operationMode === 'DISCOUNT' ? 'text-green-600' : operationMode === 'INCREASE' ? 'text-blue-600' : 'text-slate-800'}>
                                     S/ {operationMode === 'BASE' ? '100.00' : operationMode === 'DISCOUNT' ? (100 * (1 - percentageValue/100)).toFixed(2) : (100 * (1 + percentageValue/100)).toFixed(2)}
                                  </span>
                               </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                               <button type="button" onClick={() => setEditingList(null)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                               <button type="submit" className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 shadow-xl shadow-slate-200 transform active:scale-95 transition-all">
                                  Guardar Lista
                               </button>
                            </div>
                         </div>
                      </form>
                   ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-3xl p-10 bg-slate-50">
                         <Tag className="w-16 h-16 mb-4 opacity-50 text-slate-400" />
                         <p className="font-medium text-lg">Seleccione una lista para editar</p>
                         <p className="text-sm">o cree una nueva configuración</p>
                      </div>
                   )}
                </div>
             </div>
          )}

          {/* --- TAB 3: SELLER ASSIGNMENT (IMPROVED) --- */}
          {activeTab === 'SELLERS' && (
             <div className="flex flex-col h-full relative">
                
                {/* Changes Notification Bar */}
                {hasChanges && (
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 mt-4 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-fade-in-down border border-slate-700">
                      <span className="text-sm font-bold flex items-center">
                         <AlertCircle className="w-4 h-4 mr-2 text-yellow-400" /> 
                         Tiene cambios pendientes sin guardar
                      </span>
                      <button 
                         onClick={saveAssignments}
                         className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg"
                      >
                         GUARDAR CAMBIOS
                      </button>
                   </div>
                )}

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6 flex items-start">
                   <div className="bg-blue-100 p-2 rounded-full mr-3">
                      <Users className="w-5 h-5 text-blue-600" />
                   </div>
                   <div>
                      <h4 className="font-bold text-blue-800 text-sm">Asignación de Listas por Ruta</h4>
                      <p className="text-xs text-blue-600 mt-1">
                         Configure qué lista de precios predeterminada utilizará cada vendedor. 
                         Esto se aplicará automáticamente a los clientes de su ruta que no tengan una lista específica.
                      </p>
                   </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1">
                   <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
                         <tr>
                            <th className="p-4 w-16">Avatar</th>
                            <th className="p-4">Vendedor</th>
                            <th className="p-4">Zona Asignada</th>
                            <th className="p-4">Lista de Precios</th>
                            <th className="p-4 text-center">Factor Aplicado</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {store.sellers.map(seller => {
                            const currentListId = getSellerListId(seller);
                            const assignedList = store.priceLists.find(l => l.id === currentListId);
                            const zone = store.zones.find(z => z.assigned_seller_id === seller.id);
                            
                            const isModified = pendingAssignments[seller.id] !== undefined;

                            return (
                               <tr key={seller.id} className={`transition-colors ${isModified ? 'bg-yellow-50/50' : 'hover:bg-slate-50'}`}>
                                  <td className="p-4">
                                     <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold border-2 border-white shadow-sm">
                                        {seller.name.substring(0,2).toUpperCase()}
                                     </div>
                                  </td>
                                  <td className="p-4">
                                     <div className="font-bold text-slate-800">{seller.name}</div>
                                     <div className="text-xs text-slate-400 font-mono mt-0.5">{seller.dni}</div>
                                  </td>
                                  <td className="p-4">
                                     {zone ? (
                                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 flex w-fit items-center">
                                           <MapPin className="w-3 h-3 mr-1" /> {zone.name}
                                        </span>
                                     ) : (
                                        <span className="text-slate-300 text-xs italic">Sin Zona</span>
                                     )}
                                  </td>
                                  <td className="p-4">
                                     <div className="relative max-w-xs">
                                        <select 
                                          className={`w-full appearance-none border-2 rounded-lg p-2.5 pl-3 pr-8 text-sm font-bold outline-none transition-all cursor-pointer ${isModified ? 'border-yellow-400 bg-white text-slate-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 hover:bg-white'}`}
                                          value={currentListId}
                                          onChange={e => handlePendingAssignment(seller.id, e.target.value)}
                                        >
                                           <option value="">-- Precio Base (Estándar) --</option>
                                           {store.priceLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                        <ChevronRight className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none rotate-90" />
                                     </div>
                                  </td>
                                  <td className="p-4 text-center">
                                     <span className={`font-mono font-bold text-xs px-2 py-1 rounded ${assignedList ? (assignedList.factor < 1 ? 'text-green-600 bg-green-50' : assignedList.factor > 1 ? 'text-blue-600 bg-blue-50' : 'text-slate-500') : 'text-slate-400'}`}>
                                        {assignedList ? assignedList.factor.toFixed(2) + 'x' : '1.00x'}
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

       </div>
    </div>
  );
};
