
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Wallet, CheckSquare, Square, Save, Printer, User, Filter, AlertCircle, FileText, Loader2, CheckCircle2, Clock, HelpCircle } from 'lucide-react';

export const CollectionConsolidation: React.FC = () => {
   const { collectionRecords, sellers, consolidateCollections } = useStore();

   // State
   const [selectedSeller, setSelectedSeller] = useState('ALL');
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

   // UX State
   const [isProcessing, setIsProcessing] = useState(false);
   const [showConfirmModal, setShowConfirmModal] = useState(false);
   const [showSuccessModal, setShowSuccessModal] = useState(false);
   const [lastTotal, setLastTotal] = useState(0);

   // Filter Pending Collections
   const pendingCollections = useMemo(() => {
      return collectionRecords
         .filter(r => r.status === 'PENDING_VALIDATION')
         .filter(r => selectedSeller === 'ALL' || r.seller_id === selectedSeller)
         .sort((a, b) => new Date(b.date_reported).getTime() - new Date(a.date_reported).getTime());
   }, [collectionRecords, selectedSeller]);

   // Totals Calculation
   const totals = useMemo(() => {
      return pendingCollections.reduce((acc, curr) => {
         if (selectedIds.has(curr.id)) {
            return acc + curr.amount_reported;
         }
         return acc;
      }, 0);
   }, [pendingCollections, selectedIds]);

   // Handlers
   const handleToggleSelect = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
   };

   const handleSelectAll = () => {
      if (selectedIds.size === pendingCollections.length && pendingCollections.length > 0) {
         setSelectedIds(new Set());
      } else {
         setSelectedIds(new Set(pendingCollections.map(r => r.id)));
      }
   };

   // Step 1: Request Confirmation
   const handleRequestConsolidate = () => {
      if (selectedIds.size === 0) return;
      setShowConfirmModal(true);
   };

   // Step 2: Execute Process
   const handleConfirmProcess = async () => {
      setShowConfirmModal(false);
      setLastTotal(totals);
      setIsProcessing(true);

      // Simulate network delay for "reloj" effect (Visible processing)
      await new Promise(resolve => setTimeout(resolve, 2500));

      try {
         // Convert Set to Array for the store action
         const idsArray = Array.from(selectedIds) as string[];
         consolidateCollections(idsArray);

         setSelectedIds(new Set());
         setIsProcessing(false);
         setShowSuccessModal(true);
      } catch (error) {
         console.error(error);
         setIsProcessing(false);
         alert("Ocurrió un error al procesar la planilla.");
      }
   };

   return (
      <div className="flex flex-col h-full space-y-4 font-sans text-sm relative">

         {/* CONFIRMATION MODAL */}
         {showConfirmModal && (
            <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 border-t-4 border-blue-500 animate-scale-up">
                  <div className="flex flex-col items-center text-center mb-6">
                     <div className="bg-blue-100 p-3 rounded-full mb-3">
                        <HelpCircle className="w-8 h-8 text-blue-600" />
                     </div>
                     <h3 className="text-lg font-bold text-slate-800">¿Procesar Planilla?</h3>
                     <p className="text-slate-500 text-sm mt-2">
                        Se liquidarán <strong>{selectedIds.size} documentos</strong> por un total de:
                     </p>
                     <div className="text-3xl font-bold text-slate-900 mt-2">
                        S/ {totals.toFixed(2)}
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <button
                        onClick={() => setShowConfirmModal(false)}
                        className="py-3 rounded-lg font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                     >
                        Cancelar
                     </button>
                     <button
                        onClick={handleConfirmProcess}
                        className="py-3 rounded-lg font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-lg transition-transform active:scale-95"
                     >
                        CONFIRMAR
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* PROCESSING OVERLAY (RELOJ) */}
         {isProcessing && (
            <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center backdrop-blur-sm rounded-lg animate-fade-in">
               <div className="bg-slate-900 p-6 rounded-full shadow-2xl mb-6 relative">
                  <Clock className="w-16 h-16 text-white animate-spin-slow" />
                  <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping"></div>
               </div>
               <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Procesando Planilla...</h2>
               <p className="text-slate-500 mt-2 font-medium">Validando pagos y generando ingresos</p>
            </div>
         )}

         {/* SUCCESS MODAL */}
         {showSuccessModal && (
            <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 text-center border-t-8 border-green-500 animate-slide-up">
                  <div className="mx-auto bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-inner">
                     <CheckCircle2 className="w-12 h-12 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">¡Planilla Procesada!</h3>
                  <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                     Se ha generado el ingreso a caja por <strong className="text-green-700 text-lg">S/ {lastTotal.toFixed(2)}</strong>.<br />
                     Los documentos han sido validados correctamente.
                  </p>
                  <button
                     onClick={() => setShowSuccessModal(false)}
                     className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold shadow hover:bg-slate-800 transition-transform active:scale-95"
                  >
                     Entendido, gracias
                  </button>
               </div>
            </div>
         )}

         <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
               <Wallet className="mr-2 text-green-600" /> Consolidación de Cobranzas
            </h2>
         </div>

         {/* Control Bar */}
         <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[250px]">
               <label className="block text-xs font-bold text-slate-500 mb-1">Filtrar por Vendedor</label>
               <select
                  className="w-full border border-slate-300 rounded p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedSeller}
                  onChange={e => setSelectedSeller(e.target.value)}
               >
                  <option value="ALL">Todos los Vendedores</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>

            <div className="flex items-center gap-4 ml-auto">
               <div className="bg-green-50 px-6 py-2 rounded-lg border border-green-200 flex flex-col items-end min-w-[180px]">
                  <span className="text-[10px] text-green-800 font-bold uppercase tracking-wider">Total a Recibir</span>
                  <span className="text-2xl font-bold text-green-700">S/ {totals.toFixed(2)}</span>
               </div>

               <button
                  onClick={handleRequestConsolidate}
                  disabled={selectedIds.size === 0 || isProcessing}
                  className="bg-slate-900 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:shadow-none flex items-center transition-all min-w-[200px] justify-center active:scale-95"
               >
                  <Save className="w-5 h-5 mr-2" /> PROCESAR PLANILLA
               </button>
            </div>
         </div>

         {/* List Area */}
         <div className="flex-1 bg-white rounded-lg shadow border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
               <div className="flex items-center gap-2">
                  <button onClick={handleSelectAll} className="flex items-center text-sm font-bold text-slate-700 hover:text-blue-600 transition-colors">
                     {selectedIds.size > 0 && selectedIds.size === pendingCollections.length ? <CheckSquare className="w-5 h-5 mr-2 text-blue-600" /> : <Square className="w-5 h-5 mr-2 text-slate-400" />}
                     Seleccionar Todo
                  </button>
                  <span className="text-xs font-medium text-slate-500 ml-4 bg-white px-2 py-1 rounded border border-slate-200">
                     {selectedIds.size} de {pendingCollections.length} seleccionados
                  </span>
               </div>
               <button onClick={() => window.print()} className="text-slate-500 hover:text-slate-800 flex items-center text-xs font-bold bg-white px-3 py-1 rounded border border-slate-200 hover:shadow-sm transition-all">
                  <Printer className="w-4 h-4 mr-1" /> Imprimir Vista Previa
               </button>
            </div>

            <div className="flex-1 overflow-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 shadow-sm">
                     <tr>
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3">Fecha Reporte</th>
                        <th className="p-3">Vendedor</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Documento Ref.</th>
                        <th className="p-3 text-right">Monto</th>
                        <th className="p-3 text-center">Estado</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {pendingCollections.map((rec, idx) => {
                        const seller = sellers.find(s => s.id === rec.seller_id);
                        const isSelected = selectedIds.has(rec.id);
                        return (
                           <tr
                              key={rec.id}
                              className={`cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                              onClick={() => handleToggleSelect(rec.id)}
                           >
                              <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                 <div className={`w-5 h-5 rounded border flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                    {isSelected && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                                 </div>
                              </td>
                              <td className="p-3 text-slate-600">
                                 <div className="font-medium">{new Date(rec.date_reported).toLocaleDateString()}</div>
                                 <div className="text-xs text-slate-400">{new Date(rec.date_reported).toLocaleTimeString()}</div>
                              </td>
                              <td className="p-3 font-medium text-slate-800">
                                 <div className="flex items-center">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center mr-2 text-xs font-bold text-slate-600">
                                       {seller?.name.charAt(0)}
                                    </div>
                                    {seller?.name || 'Desconocido'}
                                 </div>
                              </td>
                              <td className="p-3 font-bold text-slate-800">{rec.client_name}</td>
                              <td className="p-3 font-mono text-slate-600">{rec.document_ref}</td>
                              <td className="p-3 text-right font-bold text-slate-900">S/ {rec.amount_reported.toFixed(2)}</td>
                              <td className="p-3 text-center">
                                 <span className="bg-orange-100 text-orange-800 text-[10px] uppercase px-2 py-1 rounded font-bold border border-orange-200">
                                    Por Validar
                                 </span>
                              </td>
                           </tr>
                        );
                     })}
                     {pendingCollections.length === 0 && (
                        <tr>
                           <td colSpan={7} className="p-12 text-center">
                              <div className="flex flex-col items-center justify-center text-slate-400">
                                 <Wallet className="w-12 h-12 mb-3 opacity-20" />
                                 <p className="text-lg font-medium">Todo al día</p>
                                 <p className="text-sm">No hay cobranzas pendientes de consolidar.</p>
                              </div>
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
   );
};
