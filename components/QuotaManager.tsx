import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Quota } from '../types';
import { Save, Filter, Target, Users, LayoutGrid, Check, AlertCircle, Search, ChevronRight } from 'lucide-react';

type TargetType = 'GLOBAL' | 'SUPPLIER' | 'CATEGORY' | 'LINE';

export const QuotaManager: React.FC = () => {
   const store = useStore();
   
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

   // Populate local state when period/type changes
   useMemo(() => {
      const filtered = store.quotas.filter(q => q.period === selectedPeriod && q.target_type === targetType);
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
   }, [store.quotas, selectedPeriod, targetType]);

   // Ensure a seller is selected by default
   useMemo(() => {
      if (!selectedSellerId && store.sellers.length > 0) {
         setSelectedSellerId(store.sellers[0].id);
      }
   }, [store.sellers, selectedSellerId]);

   // Compute targets based on TargetType
   const targets = useMemo(() => {
      if (targetType === 'GLOBAL') {
         return [{ id: 'GLOBAL', name: 'Cuota General' }];
      } else if (targetType === 'SUPPLIER') {
         return store.suppliers.map(s => ({ id: s.id, name: s.name }));
      } else if (targetType === 'CATEGORY') {
         return store.categories.map(c => ({ id: c, name: c }));
      } else if (targetType === 'LINE') {
         const lines = Array.from(new Set(store.products.map(p => p.line).filter(Boolean)));
         return lines.map(l => ({ id: l, name: l }));
      }
      return [];
   }, [targetType, store.suppliers, store.categories, store.products]);

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

   const saveChanges = () => {
      const newQuotas: Quota[] = [];
      
      store.sellers.forEach(seller => {
         targets.forEach(col => {
            const key = `${seller.id}_${col.id}`;
            const amount = localQuotas[key] || 0;
            
            if (amount > 0) {
               const existing = store.quotas.find(q => 
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

      const existingIds = store.quotas
         .filter(q => q.period === selectedPeriod && q.target_type === targetType)
         .map(q => q.id);
      
      existingIds.forEach(id => store.deleteQuota(id));
      store.batchUpdateQuotas(newQuotas);
      
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
   };

   const calculateSellerTotal = (sellerId: string) => {
      return targets.reduce((sum, target) => {
         const key = `${sellerId}_${target.id}`;
         return sum + (localQuotas[key] || 0);
      }, 0);
   };

   const selectedSeller = store.sellers.find(s => s.id === selectedSellerId);

   return (
      <div className="flex flex-col h-full space-y-4 font-sans text-slate-800 animate-fade-in-up">
         {/* TOP BAR */}
         <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-blue-600 rounded-lg text-white shadow-md">
                  <Target className="w-6 h-6" />
               </div>
               <div>
                  <h2 className="text-xl font-bold text-slate-900">Gestión de Cuotas</h2>
                  <p className="text-xs text-slate-500">Configura los objetivos de venta para tu fuerza comercial</p>
               </div>
            </div>
            {saveSuccess && (
               <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold flex items-center text-sm">
                  <Check className="w-4 h-4 mr-2" /> Cambios Guardados Satisfactoriamente
               </div>
            )}
            <button 
               onClick={saveChanges}
               disabled={!isDirty}
               className={`px-4 py-2 rounded-lg font-bold flex items-center shadow-md transition-all ${
                  isDirty ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
               }`}
            >
               <Save className="w-4 h-4 mr-2" /> Guardar Cambios
            </button>
         </div>

         {/* CONTROLS */}
         <div className="bg-slate-800 text-white p-4 rounded-lg shadow-lg flex flex-wrap gap-4 items-end">
            <div>
               <label className="block text-xs font-bold text-slate-400 mb-1">Periodo (Mes/Año)</label>
               <input 
                  type="month" 
                  className="bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none w-48"
                  value={selectedPeriod}
                  onChange={e => setSelectedPeriod(e.target.value)}
               />
            </div>
            <div>
               <label className="block text-xs font-bold text-slate-400 mb-1">Nivel de Objetivo</label>
               <select 
                  className="bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none w-48"
                  value={targetType}
                  onChange={e => setTargetType(e.target.value as TargetType)}
               >
                  <option value="GLOBAL">Meta Global (Por Vendedor)</option>
                  <option value="SUPPLIER">Por Proveedor</option>
                  <option value="CATEGORY">Por Categoría</option>
                  <option value="LINE">Por Línea</option>
               </select>
            </div>

            <div className="flex-1 text-right">
               <div className="inline-flex items-center text-xs bg-slate-700 px-3 py-1.5 rounded text-blue-300 font-bold border border-slate-600">
                  <Filter className="w-3 h-3 mr-1" /> Editando {targets.length} {
                     targetType === 'SUPPLIER' ? 'proveedores' : 
                     targetType === 'CATEGORY' ? 'categorías' : 
                     targetType === 'LINE' ? 'líneas' : 'metas globales'
                  }
               </div>
            </div>
         </div>

         {/* SPLIT PANE EDITOR */}
         <div className="flex-1 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden flex min-h-[400px]">
            {/* LEFT SIDEBAR: Sellers */}
            <div className="w-1/3 max-w-sm border-r border-slate-200 bg-slate-50 flex flex-col">
               <div className="p-4 border-b border-slate-200 bg-white">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                     <Users className="w-4 h-4 text-slate-400" /> Fuerza de Ventas ({store.sellers.length})
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {store.sellers.map(seller => {
                     const total = calculateSellerTotal(seller.id);
                     const isSelected = selectedSellerId === seller.id;
                     return (
                        <button 
                           key={seller.id}
                           onClick={() => setSelectedSellerId(seller.id)}
                           className={`w-full text-left p-3 rounded-lg flex flex-col transition-all border
                              ${isSelected 
                                 ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                 : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:shadow-sm'}`}
                        >
                           <div className="font-bold text-sm truncate">{seller.name}</div>
                           <div className={`text-xs mt-1 font-mono ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                              Total: S/ {total.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                           </div>
                        </button>
                     );
                  })}
               </div>
            </div>

            {/* RIGHT PANEL: Targets for Selected Seller */}
            <div className="flex-1 flex flex-col bg-white">
               <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white z-10 shadow-sm relative">
                  <div>
                     <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        {selectedSeller?.name}
                        <ChevronRight className="w-4 h-4 mx-2 text-slate-400" />
                        <span className="text-blue-600 text-base">{
                           targetType === 'SUPPLIER' ? 'Proveedores' :
                           targetType === 'CATEGORY' ? 'Categorías' :
                           targetType === 'LINE' ? 'Líneas' : 'Meta Global'
                        }</span>
                     </h3>
                     <div className="text-xs text-slate-500 font-medium flex items-center mt-1">
                        <AlertCircle className="w-4 h-4 text-orange-400 mr-1" /> 
                        Deja en 0 o vacío si no aplica
                     </div>
                  </div>
                  <div className="relative">
                     <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                     <input 
                        type="text" 
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 transition-all"
                     />
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto bg-slate-50/50">
                  <table className="w-full text-sm text-left">
                     <thead className="text-slate-500 font-bold sticky top-0 z-10 bg-slate-100 shadow-sm border-b border-slate-200">
                        <tr>
                           <th className="p-4 uppercase text-xs">Objetivo</th>
                           <th className="p-4 w-64 text-right uppercase text-xs">Cuota Asignada (S/)</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-200">
                        {filteredTargets.map(target => {
                           if (!selectedSellerId) return null;
                           const key = `${selectedSellerId}_${target.id}`;
                           const val = localQuotas[key] || '';
                           
                           return (
                              <tr key={target.id} className="hover:bg-blue-50/30 transition-colors bg-white group">
                                 <td className="p-4 font-medium text-slate-700">
                                    {target.name}
                                 </td>
                                 <td className="p-3 text-right">
                                    <div className="relative inline-flex items-center justify-end w-full max-w-[200px]">
                                       <span className="absolute left-3 text-slate-400 text-xs font-bold">S/</span>
                                       <input 
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          placeholder="0.00"
                                          className={`w-full pl-8 pr-3 py-2 text-right font-mono font-bold text-sm bg-slate-50 border rounded-lg outline-none transition-all
                                             ${val 
                                                ? 'border-blue-400 text-blue-900 bg-blue-50 focus:ring-2 focus:ring-blue-500 shadow-sm' 
                                                : 'border-slate-200 text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-slate-300'}`}
                                          value={val}
                                          onChange={e => handleQuotaChange(selectedSellerId, target.id, e.target.value)}
                                       />
                                    </div>
                                 </td>
                              </tr>
                           );
                        })}
                        {filteredTargets.length === 0 && (
                           <tr>
                              <td colSpan={2} className="p-12 text-center">
                                 <div className="text-slate-400 mb-2">
                                    <Search className="w-8 h-8 mx-auto opacity-50" />
                                 </div>
                                 <div className="text-slate-500 font-medium">No se encontraron resultados para "{searchTerm}"</div>
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      </div>
   );
};
