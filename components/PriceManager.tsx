import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../services/store';
import { PriceList, Seller, Product } from '../types';
import { supabase, USE_MOCK_DB } from '../services/supabase';
import { Calculator, Tag, Users, Save, DollarSign, Plus, RefreshCw, TrendingDown, TrendingUp, Equal, Percent, CheckSquare, Square, Search, AlertCircle, CheckCircle2, Loader2, X, Trash2 } from 'lucide-react';

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

  // --- ESTADOS DE BASE DE DATOS (NUBE) ---
  const [realProducts, setRealProducts] = useState<Product[]>([]);
  const [realPriceLists, setRealPriceLists] = useState<PriceList[]>([]);
  const [realSellers, setRealSellers] = useState<Seller[]>([]);
  const [realSuppliers, setRealSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
     fetchData();
  }, []);

  const fetchData = async () => {
     if (!USE_MOCK_DB) {
        setIsLoading(true);
        try {
           const [pRes, plRes, sRes, supRes] = await Promise.all([
              supabase.from('products').select('*').order('name'),
              supabase.from('price_lists').select('*').order('name'),
              supabase.from('sellers').select('*').order('name'),
              supabase.from('suppliers').select('*').order('name')
           ]);
           if (pRes.data) setRealProducts(pRes.data as Product[]);
           if (plRes.data) setRealPriceLists(plRes.data as PriceList[]);
           if (sRes.data) setRealSellers(sRes.data as Seller[]);
           if (supRes.data) setRealSuppliers(supRes.data);
        } catch (error: any) {
           console.error("Error Sincronizando:", error.message);
        } finally {
           setIsLoading(false);
        }
     }
  };

  const products = USE_MOCK_DB ? store.products : realProducts;
  const priceLists = USE_MOCK_DB ? store.priceLists : realPriceLists;
  const sellers = USE_MOCK_DB ? store.sellers : realSellers;
  const suppliers = USE_MOCK_DB ? store.suppliers : realSuppliers;

  // --- TAB 1: CALCULATOR STATE ---
  const [selectedTargetList, setSelectedTargetList] = useState('BASE'); 
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [targetMargin, setTargetMargin] = useState<number>(30); // Default 30%
  
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
  
  const currentListFactor = useMemo(() => {
     if (selectedTargetList === 'BASE') return 1.0;
     const list = priceLists.find(l => l.id === selectedTargetList);
     return list ? list.factor : 1.0;
  }, [selectedTargetList, priceLists]);

  const currentListName = useMemo(() => {
     if (selectedTargetList === 'BASE') return 'PRECIO BASE (TIENDA)';
     return priceLists.find(l => l.id === selectedTargetList)?.name || 'Desconocido';
  }, [selectedTargetList, priceLists]);

  // --- CALCULATION LOGIC ---
  const previewData = useMemo(() => {
     return products.filter(p => {
        const matchSup = selectedSupplier === 'ALL' || p.supplier_id === selectedSupplier;
        const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
        const matchSearch = searchTerm === '' || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        return matchSup && matchCat && matchSearch;
     }).map(p => {
        const cost = p.last_cost || 0;
        const targetFinalPriceUnit = cost * (1 + (targetMargin / 100));
        const requiredBasePriceUnit = targetFinalPriceUnit / currentListFactor;
        
        const content = p.package_content || 1;
        const bulkDiscount = content > 1 ? 0.95 : 1.0;
        const requiredBasePricePackage = requiredBasePriceUnit * content * bulkDiscount;

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
  }, [products, selectedSupplier, selectedCategory, searchTerm, targetMargin, currentListFactor]);

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
              profit_margin: targetMargin
           }));

        if (USE_MOCK_DB) {
           store.batchUpdateProductPrices(updates);
        } else {
           // Actualizaciones quirúrgicas en paralelo para no sobreescribir stock accidentalmente
           const updatePromises = updates.map(updateData => 
              supabase.from('products').update({
                 price_unit: updateData.price_unit,
                 price_package: updateData.price_package,
                 profit_margin: updateData.profit_margin
              }).eq('id', updateData.id)
           );
           await Promise.all(updatePromises);
           
           // Actualizar vista local
           setRealProducts(prev => prev.map(p => {
              const u = updates.find(x => x.id === p.id);
              return u ? { ...p, ...u } as Product : p;
           }));
        }
        
        setNotification({ msg: `Se actualizaron exitosamente ${updates.length} productos.`, type: 'success' });
        setSelectedIds(new Set());
     } catch (error: any) {
        setNotification({ msg: `Error de BD: ${error.message}`, type: 'error' });
     } finally {
        setTimeout(() => setNotification(null), 4000);
        setIsSaving(false);
     }
  };

  // --- 2. GESTIÓN DE LISTAS DE PRECIOS (CRUD) ---
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
           factor: Number(finalFactor.toFixed(4)),
           is_active: true
        };
        
        if (USE_MOCK_DB) {
           payload.id = editingList.id || crypto.randomUUID();
           if (editingList.id) store.updatePriceList(payload as PriceList);
           else store.addPriceList(payload as PriceList);
        } else {
           if (editingList.id) {
              const { data, error } = await supabase.from('price_lists').update(payload).eq('id', editingList.id).select();
              if (error) throw error;
              if(data) setRealPriceLists(prev => prev.map(l => l.id === editingList.id ? data[0] : l));
           } else {
              payload.id = crypto.randomUUID();
              const { data, error } = await supabase.from('price_lists').insert([payload]).select();
              if (error) throw error;
              if(data) setRealPriceLists(prev => [...prev, data[0]]);
           }
        }
        setEditingList(null);
        setNotification({ msg: "Lista de precios configurada.", type: 'success' });
     } catch (error: any) {
        setNotification({ msg: "Error al guardar lista: " + error.message, type: 'error' });
     } finally {
        setIsSaving(false);
        setTimeout(() => setNotification(null), 3000);
     }
  };

  const handleDeleteList = async (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     if(!confirm('¿Eliminar esta lista? Se desvinculará de los vendedores asignados.')) return;
     
     try {
        if (!USE_MOCK_DB) {
           const { error } = await supabase.from('price_lists').delete().eq('id', id);
           if (error) throw error;
           setRealPriceLists(prev => prev.filter(l => l.id !== id));
        } else {
           alert("Simulación de borrado local.");
        }
     } catch(err: any) {
        alert("Error al eliminar: " + err.message);
     }
  }

  // --- 3. ASIGNACIÓN DE VENDEDORES (UUID NULL FIX) ---
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
        if (USE_MOCK_DB) {
           Object.entries(pendingAssignments).forEach(([sellerId, listId]) => {
              const seller = store.sellers.find(s => s.id === sellerId);
              if (seller) store.updateSeller({ ...seller, price_list_id: listId });
           });
        } else {
           const updatePromises = Object.entries(pendingAssignments).map(([sellerId, listId]) => {
              // BLINDAJE UUID: Convertimos el string vacío a NULL estricto
              const cleanListId = (listId === '' || !listId) ? null : listId;
              return supabase.from('sellers').update({ price_list_id: cleanListId }).eq('id', sellerId);
           });
           
           await Promise.all(updatePromises);
           await fetchData(); // Recargar matriz de vendedores
        }
        
        setPendingAssignments({});
        setHasChanges(false);
        setNotification({ msg: "Matriz de asignaciones sincronizada.", type: 'success' });
     } catch(err:any) {
        setNotification({ msg: "Error al asignar: " + err.message, type: 'error' });
     } finally {
        setIsSaving(false);
        setTimeout(() => setNotification(null), 3000);
     }
  };

  return (
    <div className="h-full flex flex-col space-y-4 font-sans text-slate-800 relative">
       {notification && <Notification msg={notification.msg} type={notification.type} onClose={() => setNotification(null)} />}

       <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-black flex items-center">
             <DollarSign className="mr-2 text-green-600 w-6 h-6" /> Ingeniería de Precios
          </h2>
          <button onClick={fetchData} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg flex items-center transition-colors shadow-sm border border-slate-200" title="Sincronizar Base de Datos">
             <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-green-600' : ''}`} />
          </button>
       </div>

       <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-1">
          <button onClick={() => setActiveTab('CALCULATOR')} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'CALCULATOR' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Calculator className="w-4 h-4 mr-2" /> 1. Calculadora Masiva Base
          </button>
          <button onClick={() => setActiveTab('PRICELISTS')} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'PRICELISTS' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Tag className="w-4 h-4 mr-2" /> 2. Reglas y Listas de Precio
          </button>
          <button onClick={() => setActiveTab('SELLERS')} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'SELLERS' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Users className="w-4 h-4 mr-2" /> 3. Matriz de Vendedores
          </button>
       </div>

       <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
          
          {/* --- TAB 1: MASS CALCULATOR --- */}
          {activeTab === 'CALCULATOR' && (
             <div className="flex flex-col h-full p-6">
                <div className="grid grid-cols-12 gap-4 mb-6 items-end bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-inner">
                   
                   <div className="col-span-12 md:col-span-4">
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">Proyectar Hacia (Lista Objetivo)</label>
                      <select 
                        className="w-full border-2 border-slate-300 p-2.5 rounded-lg text-sm font-bold text-slate-800 focus:border-green-500 outline-none transition-colors"
                        value={selectedTargetList}
                        onChange={e => setSelectedTargetList(e.target.value)}
                      >
                         <option value="BASE">PRECIO BASE (1.00x)</option>
                         {priceLists.map(l => <option key={l.id} value={l.id}>{l.name.toUpperCase()} (Factor: {l.factor}x)</option>)}
                      </select>
                   </div>

                   <div className="col-span-6 md:col-span-3">
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">Proveedor</label>
                      <select className="w-full border-2 border-slate-300 p-2.5 rounded-lg text-sm font-bold text-slate-800 focus:border-green-500 outline-none" value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                         <option value="ALL">TODOS LOS PROVEEDORES</option>
                         {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                   </div>
                   
                   <div className="col-span-6 md:col-span-3">
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">Categoría</label>
                      <select className="w-full border-2 border-slate-300 p-2.5 rounded-lg text-sm font-bold text-slate-800 focus:border-green-500 outline-none" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                         <option value="ALL">TODAS LAS CATEGORÍAS</option>
                         {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>

                   <div className="col-span-12 md:col-span-2">
                      <label className="block text-[10px] font-black text-green-700 uppercase mb-2 tracking-wider">Margen Objetivo</label>
                      <div className="relative">
                         <input 
                           type="number" 
                           className="w-full pl-4 pr-8 border-2 border-green-400 p-2.5 rounded-lg text-xl font-black text-green-800 focus:border-green-600 outline-none shadow-sm"
                           value={targetMargin}
                           onChange={e => setTargetMargin(Number(e.target.value))}
                        />
                         <span className="absolute right-3 top-3 text-green-600 font-black">%</span>
                      </div>
                   </div>

                   <div className="col-span-12 mt-2">
                      <div className="relative">
                         <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                         <input 
                           className="w-full pl-10 border-2 border-slate-200 rounded-lg p-3 text-sm font-medium focus:border-green-500 outline-none transition-colors" 
                           placeholder="Filtrar matriz por nombre o código SKU..."
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                         />
                      </div>
                   </div>
                </div>

                <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white relative shadow-sm">
                   <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-600 font-black sticky top-0 z-10 uppercase text-[10px] tracking-wider shadow-sm">
                         <tr>
                            <th className="p-4 w-12 text-center border-b border-slate-200">
                               <button onClick={toggleSelectAll} className="flex items-center justify-center text-slate-400 hover:text-green-600 transition-colors">
                                  {selectedIds.size > 0 && selectedIds.size === previewData.length ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>}
                               </button>
                            </th>
                            <th className="p-4 border-b border-slate-200">Identificación Producto</th>
                            <th className="p-4 text-right border-b border-slate-200 bg-slate-50">Costo Vencido</th>
                            <th className="p-4 text-right border-b border-slate-200">Precio Base Actual</th>
                            
                            {selectedTargetList !== 'BASE' && (
                               <th className="p-4 text-right bg-blue-50 text-blue-800 border-b border-blue-200 border-l border-r">
                                  Proyección {currentListName}
                               </th>
                            )}

                            <th className="p-4 text-right bg-green-50 text-green-800 border-b border-green-200 border-l">
                               Nuevo Precio Base
                            </th>
                            <th className="p-4 text-center border-b border-slate-200">Impacto</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {isLoading && products.length === 0 ? (
                            <tr><td colSpan={7} className="p-12 text-center"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-green-500 mb-3"/></td></tr>
                         ) : previewData.map(p => (
                            <tr key={p.id} className={`hover:bg-green-50/50 transition-colors cursor-pointer ${selectedIds.has(p.id) ? 'bg-green-50' : ''}`} onClick={() => toggleSelect(p.id)}>
                               <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded text-green-600 focus:ring-green-500 cursor-pointer border-slate-300"
                                    checked={selectedIds.has(p.id)}
                                    onChange={() => toggleSelect(p.id)}
                                  />
                               </td>
                               <td className="p-4">
                                  <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                     <span className="text-[10px] font-mono font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-600">{p.sku}</span>
                                     <span className="text-[10px] font-bold text-slate-400">{p.category || 'SIN CAT'}</span>
                                  </div>
                               </td>
                               <td className="p-4 text-right text-slate-500 font-bold">S/ {p.last_cost.toFixed(2)}</td>
                               <td className="p-4 text-right font-bold text-slate-700">S/ {p.currentBasePrice.toFixed(2)}</td>
                               
                               {selectedTargetList !== 'BASE' && (
                                  <td className="p-4 text-right font-black text-blue-700 bg-blue-50/30 border-l border-r border-blue-100">
                                     S/ {p.finalPriceInList.toFixed(2)}
                                  </td>
                               )}

                               <td className="p-4 text-right border-l border-green-100 bg-green-50/30">
                                  <div className="font-black text-green-700 text-base">S/ {p.calculatedBasePrice.toFixed(2)}</div>
                                  <div className="text-[10px] text-green-600 font-bold mt-0.5">Caja: S/ {p.calculatedPackagePrice.toFixed(2)}</div>
                               </td>
                               <td className="p-4 text-center">
                                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border shadow-sm ${
                                     p.priceChange > 0 ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                                     p.priceChange < 0 ? 'bg-red-100 text-red-700 border-red-200' : 
                                     'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}>
                                     {p.priceChange > 0 ? '+' : ''}{p.priceChange.toFixed(1)}%
                                  </span>
                               </td>
                            </tr>
                         ))}
                         {previewData.length === 0 && !isLoading && (
                            <tr><td colSpan={7} className="p-10 text-center text-slate-400 font-bold">La matriz de filtros no generó resultados.</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>

                {selectedIds.size > 0 && (
                   <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-auto min-w-[450px] bg-slate-900 text-white p-5 rounded-2xl shadow-2xl flex items-center justify-between gap-6 animate-fade-in-up border-2 border-slate-700 z-20">
                      <div className="flex items-center">
                         <div className="bg-green-500 text-slate-900 font-black text-xl w-10 h-10 rounded-full flex items-center justify-center mr-4 shadow-inner">
                            {selectedIds.size}
                         </div>
                         <div>
                            <p className="text-sm font-black uppercase tracking-wide">Lote en Memoria</p>
                            <p className="text-xs text-green-400 font-bold">Listos para inyectar a Base de Datos</p>
                         </div>
                      </div>
                      
                      <div className="flex gap-3">
                         <button 
                           onClick={() => setSelectedIds(new Set())}
                           className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-bold transition-colors"
                           disabled={isSaving}
                         >
                            Cancelar
                         </button>
                         <button 
                           onClick={handleApplyPrices}
                           disabled={isSaving}
                           className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl font-black shadow-lg shadow-green-600/30 flex items-center transition-all disabled:opacity-50"
                         >
                            {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <RefreshCw className="w-5 h-5 mr-2" />}
                            {isSaving ? 'Inyectando...' : 'APLICAR PRECIOS'}
                         </button>
                      </div>
                   </div>
                )}
             </div>
          )}

          {/* --- TAB 2: PRICE LISTS --- */}
          {activeTab === 'PRICELISTS' && (
             <div className="flex gap-6 h-full p-6 animate-fade-in">
                <div className="w-1/3 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col shadow-inner">
                   <div className="flex justify-between items-center mb-4">
                      <h3 className="font-black text-slate-800">Listas Dinámicas</h3>
                      <button 
                        onClick={() => {
                           setEditingList({ name: '', factor: 1.0 });
                           setOperationMode('BASE');
                           setPercentageValue(0);
                        }} 
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-bold flex items-center transition-colors shadow-sm"
                      >
                         <Plus className="w-3 h-3 mr-1" /> Nueva
                      </button>
                   </div>
                   <div className="space-y-3 overflow-y-auto pr-2">
                      {priceLists.map(list => {
                         let label = "Precio Base";
                         let colorStyles = "bg-slate-200 text-slate-600 border-slate-300";
                         let value = "";

                         if (list.factor < 1) {
                            label = "Descuento";
                            colorStyles = "bg-green-100 text-green-700 border-green-300";
                            value = `-${((1 - list.factor) * 100).toFixed(0)}%`;
                         } else if (list.factor > 1) {
                            label = "Recargo";
                            colorStyles = "bg-blue-100 text-blue-700 border-blue-300";
                            value = `+${((list.factor - 1) * 100).toFixed(0)}%`;
                         }

                         return (
                            <div 
                              key={list.id} 
                              onClick={() => setEditingList(list)} 
                              className={`p-4 rounded-xl border-2 transition-all cursor-pointer group relative ${editingList?.id === list.id ? 'border-blue-600 bg-white shadow-md' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                            >
                               <div className="flex justify-between items-start mb-2">
                                  <div>
                                     <div className="font-black text-slate-800 group-hover:text-blue-600 transition-colors">{list.name}</div>
                                     <div className="text-[9px] text-slate-400 font-mono mt-0.5">{list.id.substring(0,8)}</div>
                                  </div>
                                  <div className={`text-[9px] uppercase font-black px-2 py-1 rounded border ${colorStyles}`}>
                                     {label}
                                  </div>
                               </div>
                               <div className="flex justify-between items-end mt-3 border-t border-slate-100 pt-2">
                                  <div className="text-xs font-bold text-slate-500">Factor / Variación</div>
                                  <div className="text-lg font-black text-slate-800 flex items-center">
                                     <span className="text-xs text-slate-400 mr-2 font-bold">x{list.factor.toFixed(2)}</span>
                                     {value}
                                  </div>
                               </div>
                               
                               <button 
                                  onClick={(e) => handleDeleteList(list.id, e)} 
                                  className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all border border-red-200 shadow-sm"
                               >
                                  <Trash2 className="w-3 h-3"/>
                               </button>
                            </div>
                         );
                      })}
                   </div>
                </div>
                
                <div className="flex-1 flex flex-col justify-center px-4">
                   {editingList ? (
                      <form onSubmit={handleSaveList} className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-lg mx-auto w-full relative overflow-hidden">
                         <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
                         <h3 className="font-black text-xl mb-8 text-slate-800 flex items-center">
                            <Tag className="mr-3 text-blue-600 w-6 h-6" />
                            {editingList.id ? 'Modificar Regla Comercial' : 'Crear Regla Comercial'}
                         </h3>
                         
                         <div className="space-y-8">
                            <div className="relative">
                               <label className="absolute -top-2.5 left-3 bg-white px-1 text-[10px] font-black text-blue-600 uppercase tracking-wider">Identificador de la Lista</label>
                               <input 
                                 required 
                                 className="w-full border-2 border-slate-200 p-4 rounded-xl text-lg font-black text-slate-800 focus:border-blue-500 outline-none transition-colors uppercase bg-slate-50 focus:bg-white" 
                                 value={editingList.name || ''} 
                                 onChange={e => setEditingList({...editingList, name: e.target.value.toUpperCase()})} 
                                 placeholder="Ej. MAYORISTA, HORECA, VIP..." 
                               />
                            </div>

                            <div>
                               <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3 ml-1">Comportamiento del Motor</label>
                               <div className="grid grid-cols-3 gap-3">
                                  <button 
                                    type="button" 
                                    onClick={() => { setOperationMode('BASE'); setPercentageValue(0); }}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${operationMode === 'BASE' ? 'border-slate-800 bg-slate-800 text-white shadow-md transform scale-105' : 'border-slate-200 text-slate-400 hover:border-slate-400 hover:bg-slate-50'}`}
                                  >
                                     <Equal className="w-6 h-6 mb-2" />
                                     <span className="text-[10px] font-black uppercase">Neutral</span>
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => { setOperationMode('DISCOUNT'); setPercentageValue(5); }}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${operationMode === 'DISCOUNT' ? 'border-green-500 bg-green-500 text-white shadow-md transform scale-105' : 'border-slate-200 text-slate-400 hover:border-green-300 hover:bg-green-50'}`}
                                  >
                                     <TrendingDown className="w-6 h-6 mb-2" />
                                     <span className="text-[10px] font-black uppercase">Descuento</span>
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => { setOperationMode('INCREASE'); setPercentageValue(10); }}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${operationMode === 'INCREASE' ? 'border-blue-500 bg-blue-500 text-white shadow-md transform scale-105' : 'border-slate-200 text-slate-400 hover:border-blue-300 hover:bg-blue-50'}`}
                                  >
                                     <TrendingUp className="w-6 h-6 mb-2" />
                                     <span className="text-[10px] font-black uppercase">Recargo</span>
                                  </button>
                               </div>
                            </div>

                            {operationMode !== 'BASE' && (
                               <div className="animate-fade-in-down bg-slate-50 p-5 rounded-xl border border-slate-200">
                                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">
                                     {operationMode === 'DISCOUNT' ? 'Intensidad del Descuento' : 'Intensidad del Recargo'}
                                  </label>
                                  <div className="relative">
                                     <Percent className={`absolute left-4 top-4 w-6 h-6 ${operationMode === 'DISCOUNT' ? 'text-green-500' : 'text-blue-500'}`} />
                                     <input 
                                       type="number" 
                                       min="0.1" 
                                       max="100" 
                                       step="0.1"
                                       className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl text-3xl font-black focus:outline-none bg-white shadow-inner ${operationMode === 'DISCOUNT' ? 'border-green-200 text-green-700 focus:border-green-500' : 'border-blue-200 text-blue-700 focus:border-blue-500'}`}
                                       value={percentageValue}
                                       onChange={e => setPercentageValue(Number(e.target.value))}
                                     />
                                  </div>
                                  
                                  <div className="mt-4 flex justify-between items-center text-sm">
                                     <span className="font-bold text-slate-500">Ejemplo S/ 100.00 ➔</span>
                                     <span className={`font-black text-lg ${operationMode === 'DISCOUNT' ? 'text-green-600' : 'text-blue-600'}`}>
                                        S/ {operationMode === 'DISCOUNT' ? (100 * (1 - percentageValue/100)).toFixed(2) : (100 * (1 + percentageValue/100)).toFixed(2)}
                                     </span>
                                  </div>
                               </div>
                            )}

                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                               <button type="button" onClick={() => setEditingList(null)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                               <button type="submit" disabled={isSaving} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black hover:bg-blue-700 shadow-lg shadow-blue-600/30 transform active:scale-95 transition-all flex items-center disabled:opacity-50">
                                  {isSaving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin"/> : <Save className="w-5 h-5 mr-2" />}
                                  Guardar Motor
                               </button>
                            </div>
                         </div>
                      </form>
                   ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-3xl p-10 bg-slate-50">
                         <Tag className="w-16 h-16 mb-4 opacity-30 text-blue-600" />
                         <p className="font-black text-xl text-slate-400 uppercase tracking-widest">Motor Inactivo</p>
                         <p className="text-sm font-medium mt-2">Seleccione o cree una regla comercial a la izquierda.</p>
                      </div>
                   )}
                </div>
             </div>
          )}

          {/* --- TAB 3: SELLER ASSIGNMENT --- */}
          {activeTab === 'SELLERS' && (
             <div className="flex flex-col h-full relative p-6 animate-fade-in">
                
                {hasChanges && (
                   <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-fade-in-down border-2 border-slate-700">
                      <span className="text-sm font-black flex items-center uppercase tracking-wide">
                         <AlertCircle className="w-4 h-4 mr-2 text-yellow-400" /> Cambios detectados en la matriz
                      </span>
                      <button 
                         onClick={saveAssignments}
                         disabled={isSaving}
                         className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-full text-xs font-black transition-all shadow-lg shadow-purple-600/30 flex items-center disabled:opacity-50"
                      >
                         {isSaving ? <RefreshCw className="w-3 h-3 mr-2 animate-spin"/> : null}
                         SINCRONIZAR
                      </button>
                   </div>
                )}

                <div className="bg-purple-50 p-5 rounded-xl border border-purple-200 mb-6 flex items-start shadow-sm">
                   <div className="bg-purple-100 p-2.5 rounded-full mr-4 shadow-inner">
                      <Users className="w-6 h-6 text-purple-700" />
                   </div>
                   <div>
                      <h4 className="font-black text-purple-900 text-lg">Matriz de Precios por Vendedor</h4>
                      <p className="text-xs font-medium text-purple-700 mt-1">
                         La lista seleccionada se inyectará automáticamente en la App Móvil del vendedor y se aplicará a todos los clientes de su ruta que no tengan una lista personalizada.
                      </p>
                   </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1">
                   <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-wider border-b border-slate-200 sticky top-0">
                         <tr>
                            <th className="p-4 w-16 text-center">Avatar</th>
                            <th className="p-4">Fuerza de Venta</th>
                            <th className="p-4">Lista Asignada (Inyección Automática)</th>
                            <th className="p-4 text-center">Multiplicador</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {sellers.length === 0 ? (
                            <tr><td colSpan={4} className="p-10 text-center text-slate-400 font-bold">No hay vendedores registrados en la base de datos.</td></tr>
                         ) : sellers.map(seller => {
                            const currentListId = getSellerListId(seller);
                            const assignedList = priceLists.find(l => l.id === currentListId);
                            const isModified = pendingAssignments[seller.id] !== undefined;

                            return (
                               <tr key={seller.id} className={`transition-colors ${isModified ? 'bg-yellow-50' : 'hover:bg-slate-50'}`}>
                                  <td className="p-4 text-center">
                                     <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-black text-xs mx-auto shadow-md">
                                        {seller.name.substring(0,2).toUpperCase()}
                                     </div>
                                  </td>
                                  <td className="p-4">
                                     <div className="font-black text-slate-800 text-base">{seller.name}</div>
                                     <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">{seller.dni}</div>
                                  </td>
                                  <td className="p-4">
                                     <div className="relative max-w-sm">
                                        <select 
                                          className={`w-full appearance-none border-2 rounded-xl p-3 pl-4 pr-10 text-sm font-black outline-none transition-all cursor-pointer ${isModified ? 'border-yellow-400 bg-white text-slate-900 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-400 hover:bg-white'}`}
                                          value={currentListId}
                                          onChange={e => handlePendingAssignment(seller.id, e.target.value)}
                                        >
                                           <option value="">[ PRECIO BASE / ESTÁNDAR ]</option>
                                           {priceLists.map(l => <option key={l.id} value={l.id}>{l.name.toUpperCase()}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-3.5 pointer-events-none bg-slate-200 text-slate-600 rounded p-0.5">
                                           <TrendingUp className="w-3 h-3" />
                                        </div>
                                     </div>
                                  </td>
                                  <td className="p-4 text-center">
                                     <span className={`font-mono font-black text-xs px-3 py-1.5 rounded-lg border shadow-sm ${assignedList ? (assignedList.factor < 1 ? 'text-green-700 bg-green-50 border-green-200' : assignedList.factor > 1 ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-slate-600 bg-slate-100 border-slate-200') : 'text-slate-500 bg-slate-100 border-slate-200'}`}>
                                        {assignedList ? assignedList.factor.toFixed(2) + 'X' : '1.00X'}
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
