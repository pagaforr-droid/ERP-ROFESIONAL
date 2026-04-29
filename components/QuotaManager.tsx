import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Quota, Seller, Supplier, Product } from '../types';
import { Save, Filter, Target, Users, LayoutGrid, Check, AlertCircle, Search, ChevronRight, Loader2, RefreshCw } from 'lucide-react';

type TargetType = 'GLOBAL' | 'SUPPLIER' | 'CATEGORY' | 'LINE';

export const QuotaManager: React.FC = () => {
   const [isLoading, setIsLoading] = useState(true);
   
   // Supabase Data States
   const [quotas, setQuotas] = useState<Quota[]>([]);
   const [sellers, setSellers] = useState<Seller[]>([]);
   const [suppliers, setSuppliers] = useState<Supplier[]>([]);
   const [products, setProducts] = useState<Product[]>([]);
   const [categories, setCategories] = useState<string[]>([]);
   
   // Form State
   const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
   });
   
   const [targetType, setTargetType] = useState<TargetType>('SUPPLIER');
   const [selectedSellerId, setSelectedSellerId] = useState<string>('');
   const [searchTerm, setSearchTerm] = useState('');
   
   // Local State for Edition
   // Key format: `${sellerId}_${targetId || 'GLOBAL'}`
   const [localQuotas, setLocalQuotas] = useState<Record<string, number>>({});
   const [isDirty, setIsDirty] = useState(false);
   const [saveSuccess, setSaveSuccess] = useState(false);
   const [isSaving, setIsSaving] = useState(false);

   const fetchData = async () => {
      setIsLoading(true);
      try {
         // Asegurar que exista la tabla quotas si no existe fallará pero es esperado
         const [quotasRes, sellersRes, suppliersRes, productsRes] = await Promise.all([
            supabase.from('quotas').select('*'),
            supabase.from('sellers').select('*').eq('is_active', true),
            supabase.from('suppliers').select('*'),
            supabase.from('products').select('*')
         ]);

         if (quotasRes.data) setQuotas(quotasRes.data);
         if (sellersRes.data) setSellers(sellersRes.data);
         if (suppliersRes.data) setSuppliers(suppliersRes.data);
         if (productsRes.data) {
            setProducts(productsRes.data);
            const cats = Array.from(new Set(productsRes.data.map(p => p.category).filter(Boolean))) as string[];
            setCategories(cats);
         }
      } catch (err) {
         console.error('Error fetching quota dependencies', err);
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      fetchData();
   }, []);

   // Populate local state when period/type changes
   useMemo(() => {
      const filtered = quotas.filter(q => q.period === selectedPeriod && q.target_type === targetType);
      const newLocal: Record<string, number> = {};
      filtered.forEach(q => {
         const targetId = q.target_id || 'GLOBAL';
         const key = `${q.seller_id}_${targetId}`;
         newLocal[key] = q.amount;
      });
      setLocalQuotas(newLocal);
      setIsDirty(false);
      setSaveSuccess(false);
      setSearchTerm(''); // Reset search when switching context
   }, [quotas, selectedPeriod, targetType]);

   // Ensure a seller is selected by default
   useMemo(() => {
      if (!selectedSellerId && sellers.length > 0) {
         setSelectedSellerId(sellers[0].id);
      }
   }, [sellers, selectedSellerId]);

   // Compute targets based on TargetType
   const targets = useMemo(() => {
      if (targetType === 'GLOBAL') {
         return [{ id: 'GLOBAL', name: 'Cuota General' }];
      } else if (targetType === 'SUPPLIER') {
         return suppliers.map(s => ({ id: s.id, name: s.name }));
      } else if (targetType === 'CATEGORY') {
         return categories.map(c => ({ id: c, name: c }));
      } else if (targetType === 'LINE') {
         const lines = Array.from(new Set(products.map(p => p.line).filter(Boolean)));
         return lines.map(l => ({ id: l, name: l }));
      }
      return [];
   }, [targetType, suppliers, categories, products]);

   // Filter targets if user searches
   const filteredTargets = useMemo(() => {
      if (!searchTerm) return targets;
      return targets.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
   }, [targets, searchTerm]);

   const handleQuotaChange = (sellerId: string, targetId: string, value: string) => {
      const num = parseFloat(value);
      const key = `${sellerId}_${targetId}`;
      setLocalQuotas(prev => ({
         ...prev,
         [key]: isNaN(num) ? 0 : num
      }));
      setIsDirty(true);
      setSaveSuccess(false);
   };

   const saveChanges = async () => {
      setIsSaving(true);
      const newQuotas: Quota[] = [];
      
      sellers.forEach(seller => {
         targets.forEach(col => {
            const key = `${seller.id}_${col.id}`;
            const amount = localQuotas[key] || 0;
            
            if (amount > 0) {
               const existing = quotas.find(q => 
                  q.period === selectedPeriod && 
                  q.target_type === targetType && 
                  q.seller_id === seller.id && 
                  (q.target_id || 'GLOBAL') === col.id
               );
               
               newQuotas.push({
                  id: existing ? existing.id : crypto.randomUUID(),
                  period: selectedPeriod,
                  seller_id: seller.id,
                  target_type: targetType,
                  target_id: col.id === 'GLOBAL' ? undefined : col.id,
                  amount: amount
               });
            }
         });
      });

      try {
         // Delete old quotas for this period and target type to recreate them
         await supabase.from('quotas')
            .delete()
            .eq('period', selectedPeriod)
            .eq('target_type', targetType);
            
         // Insert new ones
         if (newQuotas.length > 0) {
            const { error } = await supabase.from('quotas').insert(newQuotas);
            if (error) throw error;
         }

         setSaveSuccess(true);
         setIsDirty(false);
         // Refresh list
         fetchData();
         setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err: any) {
         alert('Error al guardar cuotas: ' + err.message);
      } finally {
         setIsSaving(false);
      }
   };

   const handleCopyPreviousMonth = async () => {
      if (!window.confirm(`¿Copiar las cuotas del mes anterior al periodo ${selectedPeriod}? Esto sobrescribirá las cuotas actuales en pantalla.`)) return;

      const current = new Date(`${selectedPeriod}-01T00:00:00`);
      current.setMonth(current.getMonth() - 1);
      const prevPeriod = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

      try {
         const { data: prevQuotas } = await supabase.from('quotas').select('*').eq('period', prevPeriod).eq('target_type', targetType);
         
         if (prevQuotas && prevQuotas.length > 0) {
            const newLocal: Record<string, number> = {};
            prevQuotas.forEach(q => {
               const targetId = q.target_id || 'GLOBAL';
               const key = `${q.seller_id}_${targetId}`;
               newLocal[key] = q.amount;
            });
            setLocalQuotas(newLocal);
            setIsDirty(true);
            setSaveSuccess(false);
            alert(`Se copiaron ${prevQuotas.length} cuotas del mes ${prevPeriod}. ¡Recuerda GUARDAR CAMBIOS!`);
         } else {
            alert(`No se encontraron cuotas para el tipo ${targetType} en el mes ${prevPeriod}.`);
         }
      } catch (err) {
         alert('Error al copiar cuotas');
      }
   };

   return (
      <div className="h-full flex flex-col font-sans text-slate-800 bg-slate-50 p-4 space-y-4">
         {/* HEADER */}
         <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div>
               <h2 className="text-2xl font-black flex items-center text-slate-800 tracking-tight">
                  <Target className="mr-3 w-8 h-8 text-blue-600" /> Gestión de Cuotas
               </h2>
               <p className="text-slate-500 text-sm font-medium mt-1">Configura las metas de venta por vendedor, categoría o proveedor.</p>
            </div>
            <div className="flex gap-3">
               <button onClick={fetchData} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 flex items-center font-bold transition-colors">
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Sincronizar
               </button>
               <button 
                  onClick={saveChanges} 
                  disabled={!isDirty || isSaving}
                  className={`px-5 py-2.5 rounded-xl font-bold flex items-center shadow-md transition-all ${
                     isDirty ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
               >
                  {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                  Guardar Cambios
               </button>
            </div>
         </div>

         {/* CONTROLS */}
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Periodo</label>
               <input 
                  type="month" 
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold focus:border-blue-500 focus:ring-0 outline-none transition-colors bg-slate-50"
               />
            </div>
            
            <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Tipo de Cuota</label>
               <select 
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as TargetType)}
                  className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold focus:border-blue-500 focus:ring-0 outline-none transition-colors bg-slate-50"
               >
                  <option value="GLOBAL">Meta General / Global</option>
                  <option value="SUPPLIER">Por Proveedor (Marca)</option>
                  <option value="CATEGORY">Por Categoría</option>
                  <option value="LINE">Por Línea de Negocio</option>
               </select>
            </div>

            <div className="md:col-span-2 flex items-end gap-3">
               <div className="flex-1 relative">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Buscar (Proveedor/Categoría)</label>
                  <Search className="w-5 h-5 text-slate-400 absolute left-3 top-10" />
                  <input 
                     type="text" 
                     placeholder="Buscar en columnas..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full border-2 border-slate-200 p-3 pl-10 rounded-xl font-medium focus:border-blue-500 outline-none transition-colors bg-slate-50"
                     disabled={targetType === 'GLOBAL'}
                  />
               </div>
               <button 
                  onClick={handleCopyPreviousMonth}
                  className="bg-amber-100 text-amber-700 hover:bg-amber-200 p-3 rounded-xl font-bold flex items-center border border-amber-200 transition-colors h-[52px]"
                  title="Copiar cuotas del mes anterior"
               >
                  Copiar Mes Anterior
               </button>
            </div>
         </div>

         {/* NOTIFICATIONS */}
         {saveSuccess && (
            <div className="bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center shadow-sm">
               <Check className="w-5 h-5 mr-2 text-green-600" />
               <strong className="font-bold">¡Guardado Exitoso!</strong>
               <span className="ml-2 font-medium">Las cuotas han sido actualizadas en la base de datos.</span>
            </div>
         )}

         {isDirty && !saveSuccess && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center shadow-sm">
               <AlertCircle className="w-5 h-5 mr-2 text-amber-600" />
               <span className="font-medium">Tienes cambios sin guardar. No olvides presionar "Guardar Cambios".</span>
            </div>
         )}

         {/* MAIN EDITOR AREA */}
         <div className="flex-1 flex gap-4 overflow-hidden min-h-[400px]">
            {/* SELLER LIST */}
            <div className="w-1/4 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
               <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center">
                  <Users className="w-5 h-5 text-slate-400 mr-2" />
                  <h3 className="font-bold text-slate-700">Fuerza de Ventas</h3>
               </div>
               <div className="flex-1 overflow-auto">
                  {isLoading ? (
                     <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
                  ) : sellers.map(seller => (
                     <button
                        key={seller.id}
                        onClick={() => setSelectedSellerId(seller.id)}
                        className={`w-full p-4 flex justify-between items-center border-b border-slate-50 transition-colors ${
                           selectedSellerId === seller.id 
                              ? 'bg-blue-50 border-l-4 border-l-blue-600 text-blue-800' 
                              : 'hover:bg-slate-50 text-slate-600 border-l-4 border-l-transparent'
                        }`}
                     >
                        <div className="text-left truncate">
                           <div className="font-bold truncate text-sm">{seller.name}</div>
                           <div className="text-xs opacity-60 uppercase tracking-wider">{seller.dni}</div>
                        </div>
                        <ChevronRight className={`w-4 h-4 ${selectedSellerId === seller.id ? 'text-blue-500' : 'text-slate-300'}`} />
                     </button>
                  ))}
                  {sellers.length === 0 && !isLoading && <div className="p-4 text-slate-400 text-center">No hay vendedores.</div>}
               </div>
            </div>

            {/* QUOTA GRID */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
               <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center">
                  <LayoutGrid className="w-5 h-5 text-slate-400 mr-2" />
                  <h3 className="font-bold text-slate-700 flex-1">
                     {sellers.find(s => s.id === selectedSellerId)?.name || 'Seleccione un Vendedor'} 
                     <span className="text-slate-400 font-normal ml-2 text-sm">/ {targetType}</span>
                  </h3>
                  
                  {/* Totals for current seller */}
                  <div className="text-sm font-bold bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-blue-700">
                     Total Asignado: S/ {
                        filteredTargets.reduce((sum, t) => {
                           const key = `${selectedSellerId}_${t.id}`;
                           return sum + (localQuotas[key] || 0);
                        }, 0).toFixed(2)
                     }
                  </div>
               </div>

               <div className="flex-1 overflow-auto p-2 bg-slate-50/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-2">
                     {filteredTargets.map(target => {
                        const key = `${selectedSellerId}_${target.id}`;
                        const val = localQuotas[key] || 0;
                        const hasQuota = val > 0;

                        return (
                           <div key={target.id} className={`flex flex-col bg-white p-4 rounded-xl border-2 transition-colors shadow-sm ${hasQuota ? 'border-blue-400' : 'border-slate-200 hover:border-slate-300'}`}>
                              <label className="text-sm font-bold text-slate-700 mb-2 truncate" title={target.name}>
                                 {target.name}
                              </label>
                              <div className="relative">
                                 <span className="absolute left-3 top-3.5 text-slate-400 font-bold">S/</span>
                                 <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={val || ''}
                                    onChange={(e) => handleQuotaChange(selectedSellerId, target.id, e.target.value)}
                                    className={`w-full pl-8 pr-3 py-3 rounded-lg font-mono font-bold outline-none transition-colors ${
                                       hasQuota ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-800 hover:bg-slate-100'
                                    }`}
                                    placeholder="0.00"
                                 />
                              </div>
                           </div>
                        );
                     })}
                     
                     {filteredTargets.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-400">
                           <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-20" />
                           <p>No se encontraron resultados para la búsqueda.</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};
