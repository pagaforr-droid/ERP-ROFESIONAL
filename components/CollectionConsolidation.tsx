
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Wallet, CheckSquare, Square, Save, Printer, User, Filter, AlertCircle, FileText, Loader2, CheckCircle2, Clock, HelpCircle, History, Download, XCircle, Search, Trash2 } from 'lucide-react';
import { CollectionPlanilla, CollectionRecord } from '../types';

export const CollectionConsolidation: React.FC = () => {
   const { collectionRecords, collectionPlanillas, sellers, consolidateCollections, currentUser, annulCollectionPlanilla, removeRecordFromPlanilla, sales, manualLiquidation } = useStore();

   // Layout State
   const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'MANUAL'>('PENDING');

   // Manual Tab State
   const [showManualSearchModal, setShowManualSearchModal] = useState(false);
   const [manualSearch, setManualSearch] = useState('');
   const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set());

   // Filters
   const [selectedSeller, setSelectedSeller] = useState('ALL');
   const [dateFilter, setDateFilter] = useState('');

   // Selection
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
   const [selectedPlanillaId, setSelectedPlanillaId] = useState<string | null>(null);

   // UX State
   const [isProcessing, setIsProcessing] = useState(false);
   const [showConfirmModal, setShowConfirmModal] = useState<'PENDING' | 'MANUAL' | null>(null);
   const [showSuccessModal, setShowSuccessModal] = useState(false);
   const [showAnnulModal, setShowAnnulModal] = useState<string | null>(null); // Planilla ID to annul
   const [lastTotal, setLastTotal] = useState(0);

   // --- DATA PREPARATION ---

   const pendingCollections = useMemo(() => {
      return collectionRecords
         .filter(r => r.status === 'PENDING_VALIDATION')
         .filter(r => selectedSeller === 'ALL' || r.seller_id === selectedSeller)
         .sort((a, b) => new Date(b.date_reported).getTime() - new Date(a.date_reported).getTime());
   }, [collectionRecords, selectedSeller]);

   const historyPlanillas = useMemo(() => {
      return collectionPlanillas
         .filter(p => !dateFilter || p.date.startsWith(dateFilter))
         .filter(p => {
            // Only filter by seller if user explicitly chose it
            if (selectedSeller === 'ALL') return true;

            // Check if any record in this planilla belongs to the selected seller
            const recs = collectionRecords.filter(r => p.records.includes(r.id));
            return recs.some(r => r.seller_id === selectedSeller);
         })
         .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
   }, [collectionPlanillas, dateFilter, selectedSeller, collectionRecords]);

   const totals = useMemo(() => {
      return pendingCollections.reduce((acc, curr) => {
         if (selectedIds.has(curr.id)) {
            return acc + curr.amount_reported;
         }
         return acc;
      }, 0);
   }, [pendingCollections, selectedIds]);

   const selectedPlanilla = useMemo(() => {
      if (!selectedPlanillaId) return null;
      return collectionPlanillas.find(p => p.id === selectedPlanillaId);
   }, [selectedPlanillaId, collectionPlanillas]);

   const selectedPlanillaRecords = useMemo(() => {
      if (!selectedPlanilla) return [];
      return collectionRecords.filter(r => selectedPlanilla.records.includes(r.id));
   }, [selectedPlanilla, collectionRecords]);

   // --- DATA PREPARATION (MANUAL) ---
   const manualPendingSales = useMemo(() => {
      const searchLower = manualSearch.toLowerCase();
      return sales
         .filter(s => {
            const currentBalance = s.balance !== undefined ? s.balance : s.total;
            return currentBalance > 0 && s.status !== 'canceled';
         })
         .filter(s => {
            if (!searchLower) return true;
            return s.client_name.toLowerCase().includes(searchLower) ||
               (s.client_ruc && s.client_ruc.includes(searchLower)) ||
               `${s.series}-${s.number}`.toLowerCase().includes(searchLower);
         })
         .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
   }, [sales, manualSearch]);

   const manualTotals = useMemo(() => {
      return manualPendingSales.reduce((acc, curr) => {
         if (manualSelectedIds.has(curr.id)) {
            return acc + (curr.balance !== undefined ? curr.balance : curr.total);
         }
         return acc;
      }, 0);
   }, [manualPendingSales, manualSelectedIds]);

   const manualSelectedSales = useMemo(() => {
      return sales.filter(s => manualSelectedIds.has(s.id));
   }, [sales, manualSelectedIds]);

   // --- HANDLERS (PENDING) ---

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

   const handleRequestConsolidate = () => {
      if (selectedIds.size === 0) return;
      setShowConfirmModal('PENDING');
   };

   const handleConfirmProcess = async () => {
      setShowConfirmModal(null);
      setLastTotal(totals);
      setIsProcessing(true);

      // Simulate network
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
         const idsArray = Array.from(selectedIds) as string[];
         consolidateCollections(idsArray, currentUser?.id || 'ADMIN');

         setSelectedIds(new Set());
         setIsProcessing(false);
         setShowSuccessModal(true);
      } catch (error) {
         console.error(error);
         setIsProcessing(false);
         alert("Ocurrió un error al procesar la planilla.");
      }
   };

   // --- HANDLERS (MANUAL) ---

   const handleManualToggleSelect = (id: string) => {
      const newSet = new Set(manualSelectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setManualSelectedIds(newSet);
   };

   const handleManualRequestConsolidate = () => {
      if (manualSelectedIds.size === 0) return;
      setShowConfirmModal('MANUAL');
   };

   const handleManualConfirmProcess = async () => {
      setShowConfirmModal(null);
      setLastTotal(manualTotals);
      setIsProcessing(true);

      // Simulate network
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
         const payments = Array.from(manualSelectedIds).map(id => {
            const sale = sales.find(s => s.id === id);
            return { saleId: id as string, amount: sale?.balance !== undefined ? sale.balance : (sale?.total || 0) };
         });

         manualLiquidation(payments, currentUser?.id || 'ADMIN');

         setManualSelectedIds(new Set());
         setManualSearch(''); // Clear search on success
         setIsProcessing(false);
         setShowSuccessModal(true);
      } catch (error) {
         console.error(error);
         setIsProcessing(false);
         alert("Ocurrió un error al procesar la planilla manual.");
      }
   };

   // --- HANDLERS (HISTORY) ---

   const handleExportExcel = (planilla: CollectionPlanilla, records: CollectionRecord[]) => {
      // Create CSV manually ensuring Excel compatibility
      const separator = '\t';
      const lines = [];

      // Header
      lines.push(`PLANILLA DE COBRANZAS: ${planilla.code}`);
      lines.push(`FECHA EMISION: ${new Date(planilla.date).toLocaleString()}`);
      lines.push(`TOTAL: S/ ${planilla.total_amount.toFixed(2)}`);
      lines.push(''); // Empty line

      // Table Header
      lines.push(['FECHA DOC', 'VENDEDOR', 'CLIENTE', 'NRO DOCUMENTO', 'IMPORTE COBRADO', 'METODO'].join(separator));

      // Data
      records.forEach(r => {
         const seller = sellers.find(s => s.id === r.seller_id)?.name || 'N/A';
         lines.push([
            new Date(r.date_reported).toLocaleDateString(),
            seller,
            r.client_name,
            r.document_ref,
            r.amount_reported.toFixed(2),
            r.payment_method || 'CASH'
         ].join(separator));
      });

      const csvContent = lines.join('\r\n');

      // BOM for Excel UTF-8
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Planilla_${planilla.code}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
   };

   const handlePrintA4 = (planillaId: string) => {
      // Ideally we would route or trigger a specialized print view.
      // Temporarily simulating via window print, but restricting to Planilla container
      // To do this deeply we should build a Print Wrapper. Setting global focus for print:
      setSelectedPlanillaId(planillaId);
      setTimeout(() => {
         window.print();
      }, 500);
   };

   const handleAnnulPlanilla = (planillaId: string) => {
      setShowAnnulModal(planillaId);
   };

   const confirmAnnulPlanilla = () => {
      if (showAnnulModal) {
         annulCollectionPlanilla(showAnnulModal, currentUser?.id);
         setShowAnnulModal(null);
         if (selectedPlanillaId === showAnnulModal) {
            setSelectedPlanillaId(null);
         }
      }
   };

   const handleRemoveRecordFromPlanilla = (recordId: string) => {
      if (!selectedPlanillaId) return;
      if (!window.confirm("¿Está seguro de extraer este documento de la planilla guardada? Esto recalculará los saldos automáticamente y devolverá el voucher a estado Pendiente.")) return;
      removeRecordFromPlanilla(selectedPlanillaId, recordId);
   };

   // --- RENDER HELPERS ---

   // This section is what's visible when "Printing"
   const renderPrintablePlanilla = () => {
      if (!selectedPlanilla) return null;
      const records = selectedPlanillaRecords;
      return (
         <div className="hidden print:block absolute inset-0 bg-white z-[9999] p-8 text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="text-center border-b-2 border-black pb-4 mb-6">
               <h1 className="text-2xl font-bold uppercase tracking-wider">LIQUIDACIÓN DE COBRANZAS</h1>
               <h2 className="text-xl font-bold mt-1">PLANILLA N° {selectedPlanilla.code}</h2>
               <div className="flex justify-between mt-4 text-sm font-bold text-gray-700">
                  <span>FECHA: {new Date(selectedPlanilla.date).toLocaleDateString()} {new Date(selectedPlanilla.date).toLocaleTimeString()}</span>
                  <span>GENERADO POR: {currentUser?.name || selectedPlanilla.user_id || 'SISTEMA'}</span>
               </div>
            </div>

            <table className="w-full text-sm border-collapse mb-8">
               <thead>
                  <tr className="bg-gray-100 border-y-2 border-black text-left">
                     <th className="py-2 px-1">N°</th>
                     <th className="py-2 px-1">Vendedor</th>
                     <th className="py-2 px-1">Cliente</th>
                     <th className="py-2 px-1">Documento</th>
                     <th className="py-2 px-1">Fecha Recibo</th>
                     <th className="py-2 px-1 text-right">Importe</th>
                  </tr>
               </thead>
               <tbody>
                  {records.map((r, i) => {
                     const seller = sellers.find(s => s.id === r.seller_id)?.name || 'N/A';
                     return (
                        <tr key={r.id} className="border-b border-gray-300">
                           <td className="py-2 px-1">{i + 1}</td>
                           <td className="py-2 px-1 max-w-[120px] truncate">{seller}</td>
                           <td className="py-2 px-1 max-w-[200px] truncate">{r.client_name}</td>
                           <td className="py-2 px-1">{r.document_ref}</td>
                           <td className="py-2 px-1">{new Date(r.date_reported).toLocaleDateString()}</td>
                           <td className="py-2 px-1 text-right font-bold">S/ {r.amount_reported.toFixed(2)}</td>
                        </tr>
                     );
                  })}
               </tbody>
               <tfoot>
                  <tr className="border-t-2 border-black text-lg">
                     <td colSpan={5} className="py-3 px-1 text-right font-bold uppercase">TOTAL INGRESADO A CAJA:</td>
                     <td className="py-3 px-1 text-right font-bold text-black min-w-[120px]">
                        S/ {selectedPlanilla.total_amount.toFixed(2)}
                     </td>
                  </tr>
               </tfoot>
            </table>

            <div className="flex justify-between mt-20 px-10">
               <div className="text-center">
                  <div className="border-t border-black w-48 mx-auto mb-2"></div>
                  <p className="font-bold text-sm">ENCARGADO DE COBRANZAS</p>
               </div>
               <div className="text-center">
                  <div className="border-t border-black w-48 mx-auto mb-2"></div>
                  <p className="font-bold text-sm">V. B. CAJA INTERNA</p>
               </div>
            </div>
         </div>
      );
   };


   return (
      <div className="flex flex-col h-full space-y-4 font-sans text-sm relative print:bg-white print:p-0">

         {renderPrintablePlanilla()}

         {/* CONFIRMATION & RELOJ MODALS (Omitted for brevity, kept exactly same as before for Pending process) */}
         {showConfirmModal && (
            <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-fade-in print:hidden">
               <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 border-t-4 border-blue-500 animate-scale-up">
                  <div className="flex flex-col items-center text-center mb-6">
                     <div className="bg-blue-100 p-3 rounded-full mb-3">
                        <HelpCircle className="w-8 h-8 text-blue-600" />
                     </div>
                     <h3 className="text-lg font-bold text-slate-800">¿Crear Planilla?</h3>
                     <p className="text-slate-500 text-sm mt-2">
                        Se ingresarán <strong>{showConfirmModal === 'MANUAL' ? manualSelectedIds.size : selectedIds.size} cobros</strong> a caja por:
                     </p>
                     <div className="text-3xl font-bold text-slate-900 mt-2">
                        S/ {showConfirmModal === 'MANUAL' ? manualTotals.toFixed(2) : totals.toFixed(2)}
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
                        onClick={showConfirmModal === 'MANUAL' ? handleManualConfirmProcess : handleConfirmProcess}
                        className="py-3 rounded-lg font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-lg transition-transform active:scale-95"
                     >
                        CONFIRMAR
                     </button>
                  </div>
               </div>
            </div>
         )}

         {isProcessing && (
            <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center backdrop-blur-sm rounded-lg animate-fade-in print:hidden">
               <div className="bg-slate-900 p-6 rounded-full shadow-2xl mb-6 relative">
                  <Clock className="w-16 h-16 text-white animate-spin-slow" />
                  <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping"></div>
               </div>
               <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Procesando Planilla...</h2>
               <p className="text-slate-500 mt-2 font-medium">Validando pagos y generando ingresos</p>
            </div>
         )}

         {showSuccessModal && (
            <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-fade-in print:hidden">
               <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 text-center border-t-8 border-green-500 animate-slide-up">
                  <div className="mx-auto bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-inner">
                     <CheckCircle2 className="w-12 h-12 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">¡Planilla Generada!</h3>
                  <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                     Se ha generado el ingreso a caja por <strong className="text-green-700 text-lg">S/ {lastTotal.toFixed(2)}</strong>.<br />
                     Puede revisar el formato de impresión A4 en el Historial.
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

         {showAnnulModal && (
            <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-fade-in print:hidden">
               <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 border-t-4 border-red-500 animate-scale-up">
                  <div className="flex flex-col items-center text-center mb-6">
                     <div className="bg-red-100 p-3 rounded-full mb-3">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                     </div>
                     <h3 className="text-lg font-bold text-slate-800">¿Anular esta Planilla?</h3>
                     <p className="text-slate-500 text-sm mt-2">
                        Esta acción es de alto riesgo financiero. Se <strong>descontará</strong> de caja el monto total y los documentos regresarán al estado de "Por Validar".
                     </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <button
                        onClick={() => setShowAnnulModal(null)}
                        className="py-3 rounded-lg font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                     >
                        Cancelar
                     </button>
                     <button
                        onClick={confirmAnnulPlanilla}
                        className="py-3 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg transition-transform active:scale-95"
                     >
                        SÍ, ANULAR
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* MANUAL SEARCH MODAL */}
         {showManualSearchModal && (
            <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-fade-in print:hidden">
               <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl border-t-4 border-blue-600 animate-scale-up overflow-hidden">

                  {/* Modal Header */}
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                     <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                           <Search className="w-5 h-5 mr-2 text-blue-600" /> Buscar Documentos para Cobrar
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Seleccione los documentos pendientes para agregarlos a la planilla.</p>
                     </div>
                     <button
                        onClick={() => setShowManualSearchModal(false)}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-lg transition-all"
                     >
                        ✕
                     </button>
                  </div>

                  {/* Modal Search Bar */}
                  <div className="p-4 bg-white border-b border-slate-200">
                     <div className="relative">
                        <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                        <input
                           type="text"
                           autoFocus
                           placeholder="Buscar por Nombre del Cliente, RUC, DNI o Nro Documento (Ej. F001-123)"
                           className="w-full border-2 border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-slate-700 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                           value={manualSearch}
                           onChange={(e) => setManualSearch(e.target.value)}
                        />
                     </div>
                  </div>

                  {/* Modal Results Table */}
                  <div className="flex-1 overflow-auto bg-slate-50 p-4">
                     {manualSearch.length > 0 ? (
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                           <table className="w-full text-sm text-left">
                              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                 <tr>
                                    <th className="p-3 w-12 text-center">Sel.</th>
                                    <th className="p-3">Doc Ref.</th>
                                    <th className="p-3">Fecha</th>
                                    <th className="p-3">Cliente</th>
                                    <th className="p-3 text-right">Saldo Deudor</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {manualPendingSales.map((sale) => {
                                    const isSelected = manualSelectedIds.has(sale.id);
                                    const currentBalance = sale.balance !== undefined ? sale.balance : sale.total;
                                    return (
                                       <tr
                                          key={sale.id}
                                          className={`cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'}`}
                                          onClick={() => handleManualToggleSelect(sale.id)}
                                       >
                                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                             <div className={`w-5 h-5 rounded border flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                                {isSelected && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                                             </div>
                                          </td>
                                          <td className="p-3 font-mono text-slate-700 font-medium">{sale.series}-{sale.number}</td>
                                          <td className="p-3 text-slate-600">{new Date(sale.created_at).toLocaleDateString()}</td>
                                          <td className="p-3 font-medium text-slate-800">
                                             {sale.client_name}
                                             <div className="text-[10px] text-slate-400 font-mono mt-0.5">{sale.client_ruc}</div>
                                          </td>
                                          <td className="p-3 text-right font-bold text-slate-900 bg-blue-50/30">S/ {currentBalance.toFixed(2)}</td>
                                       </tr>
                                    );
                                 })}
                                 {manualPendingSales.length === 0 && (
                                    <tr>
                                       <td colSpan={5} className="p-12 text-center text-slate-500">
                                          No se encontraron documentos pendientes con esa búsqueda.
                                       </td>
                                    </tr>
                                 )}
                              </tbody>
                           </table>
                        </div>
                     ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                           <Search className="w-16 h-16 mb-4 opacity-20 text-blue-500" />
                           <p className="text-xl font-bold text-slate-600">Busque un Documento</p>
                           <p className="text-sm mt-2 text-slate-500">Escriba arriba para encontrar documentos pendientes.</p>
                        </div>
                     )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
                     <div className="text-sm text-slate-600">
                        Seleccionados: <strong className="text-blue-700">{manualSelectedIds.size} docs</strong>
                     </div>
                     <button
                        onClick={() => setShowManualSearchModal(false)}
                        className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-all active:scale-95"
                     >
                        Confirmar y Cerrar
                     </button>
                  </div>
               </div>
            </div>
         )}


         {/* HEADER & TABS */}
         <div className="flex justify-between items-center print:hidden">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
               <Wallet className="mr-2 text-blue-600" /> Liquidaciones de Cobranzas
            </h2>
         </div>

         <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-lg w-max print:hidden">
            <button
               onClick={() => { setActiveTab('PENDING'); setSelectedPlanillaId(null); }}
               className={`px-4 py-2 rounded-md font-bold text-sm transition-all focus:outline-none ${activeTab === 'PENDING' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200'}`}
            >
               <span className="flex items-center"><Clock className="w-4 h-4 mr-2" /> Vouchers Recibidos</span>
            </button>
            <button
               onClick={() => { setActiveTab('MANUAL'); setSelectedPlanillaId(null); }}
               className={`px-4 py-2 rounded-md font-bold text-sm transition-all focus:outline-none ${activeTab === 'MANUAL' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200'}`}
            >
               <span className="flex items-center"><Search className="w-4 h-4 mr-2" /> Cobranza Manual</span>
            </button>
            <button
               onClick={() => { setActiveTab('HISTORY'); setSelectedPlanillaId(null); }}
               className={`px-4 py-2 rounded-md font-bold text-sm transition-all focus:outline-none ${activeTab === 'HISTORY' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200'}`}
            >
               <span className="flex items-center"><History className="w-4 h-4 mr-2" /> Planillas de Caja (Historial)</span>
            </button>
         </div>

         {/* FILTER BAR - COMMON */}
         <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex flex-wrap items-center gap-4 print:hidden">
            <div className="flex-1 min-w-[200px] max-w-xs">
               <label className="block text-xs font-bold text-slate-500 mb-1">Filtrar Vendedor</label>
               <select
                  className="w-full border border-slate-300 rounded p-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedSeller}
                  onChange={e => setSelectedSeller(e.target.value)}
               >
                  <option value="ALL">Todos los Vendedores</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>

            {activeTab === 'HISTORY' && (
               <div className="flex-1 min-w-[150px] max-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha</label>
                  <input
                     type="date"
                     className="w-full border border-slate-300 rounded p-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                     value={dateFilter}
                     onChange={(e) => setDateFilter(e.target.value)}
                  />
               </div>
            )}

            {activeTab === 'PENDING' && (
               <div className="flex items-center gap-4 ml-auto">
                  <div className="bg-blue-50 px-6 py-1.5 rounded-lg border border-blue-100 flex flex-col items-end min-w-[180px]">
                     <span className="text-[10px] text-blue-800 font-bold uppercase tracking-wider">Total Seleccionado</span>
                     <span className="text-xl font-bold text-blue-700">S/ {totals.toFixed(2)}</span>
                  </div>
                  <button
                     onClick={handleRequestConsolidate}
                     disabled={selectedIds.size === 0 || isProcessing}
                     className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold shadow hover:bg-slate-800 disabled:opacity-50 disabled:shadow-none flex items-center transition-all active:scale-95"
                  >
                     <Save className="w-4 h-4 mr-2" /> CREAR PLANILLA CAJA
                  </button>
               </div>
            )}

            {activeTab === 'MANUAL' && (
               <>
                  <div className="flex-1 min-w-[250px] max-w-md">
                     <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Documento / Cliente</label>
                     <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                           type="text"
                           placeholder="Ej. Juan Perez, F001-123, 1045..."
                           className="w-full border border-slate-300 rounded pl-9 pr-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                           value={manualSearch}
                           onChange={(e) => setManualSearch(e.target.value)}
                        />
                     </div>
                  </div>
                  <div className="flex items-center gap-4 ml-auto">
                     <div className="bg-blue-50 px-6 py-1.5 rounded-lg border border-blue-100 flex flex-col items-end min-w-[180px]">
                        <span className="text-[10px] text-blue-800 font-bold uppercase tracking-wider">Monto a Cobrar</span>
                        <span className="text-xl font-bold text-blue-700">S/ {manualTotals.toFixed(2)}</span>
                     </div>
                     <button
                        onClick={handleManualRequestConsolidate}
                        disabled={manualSelectedIds.size === 0 || isProcessing}
                        className="bg-green-700 text-white px-6 py-2.5 rounded-lg font-bold shadow hover:bg-green-800 disabled:opacity-50 disabled:shadow-none flex items-center transition-all active:scale-95"
                     >
                        <Wallet className="w-4 h-4 mr-2" /> PROCESAR COBRANZA
                     </button>
                  </div>
               </>
            )}
         </div>

         {/* MAIN CONTENT AREA */}
         <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col print:hidden">

            {activeTab === 'PENDING' && (
               <>
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                     <div className="flex items-center gap-2">
                        <button onClick={handleSelectAll} className="flex items-center text-sm font-bold text-slate-700 hover:text-blue-600 transition-colors">
                           {selectedIds.size > 0 && selectedIds.size === pendingCollections.length ? <CheckSquare className="w-5 h-5 mr-2 text-blue-600" /> : <Square className="w-5 h-5 mr-2 text-slate-400" />}
                           Seleccionar Todo
                        </button>
                        <span className="text-xs font-medium text-slate-500 ml-4 bg-white px-2 py-1 rounded border border-slate-200">
                           {selectedIds.size} de {pendingCollections.length} listos
                        </span>
                     </div>
                  </div>

                  <div className="flex-1 overflow-auto">
                     <table className="w-full text-sm text-left relative">
                        <thead className="bg-white text-slate-600 font-bold sticky top-0 shadow-sm border-b">
                           <tr>
                              <th className="p-3 w-12 text-center">Sel.</th>
                              <th className="p-3">Recibido el</th>
                              <th className="p-3">Vendedor</th>
                              <th className="p-3">Cliente</th>
                              <th className="p-3">Doc Ref.</th>
                              <th className="p-3 text-right">Monto (S/)</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {pendingCollections.map((rec) => {
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
                                       <div className="text-xs text-slate-400">{new Date(rec.date_reported).toLocaleTimeString().slice(0, 5)}</div>
                                    </td>
                                    <td className="p-3 font-medium text-slate-800">{seller?.name || 'Desconocido'}</td>
                                    <td className="p-3 font-bold text-slate-800">{rec.client_name}</td>
                                    <td className="p-3 font-mono text-slate-600">{rec.document_ref}</td>
                                    <td className="p-3 text-right font-bold text-slate-900">{rec.amount_reported.toFixed(2)}</td>
                                 </tr>
                              );
                           })}
                           {pendingCollections.length === 0 && (
                              <tr>
                                 <td colSpan={6} className="p-16 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                       <CheckCircle2 className="w-12 h-12 mb-3 opacity-30 text-green-500" />
                                       <p className="text-lg font-bold text-slate-600">Bandeja Limpia</p>
                                       <p className="text-sm">No hay vouchers pendientes de consolidar en este momento.</p>
                                    </div>
                                 </td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </>
            )}

            {activeTab === 'MANUAL' && (
               <>
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                     <div>
                        <h3 className="font-bold text-slate-800 flex items-center">
                           <Wallet className="w-5 h-5 mr-2 text-green-600" /> Planilla Manual de Cobranza
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Agregue documentos de diferentes clientes y procese su pago en conjunto.</p>
                     </div>
                     <button
                        onClick={() => setShowManualSearchModal(true)}
                        className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 hover:bg-blue-200 transition-colors flex items-center"
                     >
                        <Search className="w-4 h-4 mr-2" /> Buscar y Agregar Documentos
                     </button>
                  </div>

                  <div className="flex-1 overflow-auto">
                     {manualSelectedSales.length > 0 ? (
                        <table className="w-full text-sm text-left relative">
                           <thead className="bg-white text-slate-600 font-bold sticky top-0 shadow-sm border-b z-10">
                              <tr>
                                 <th className="p-3 w-12 text-center">Sel.</th>
                                 <th className="p-3">Doc Ref.</th>
                                 <th className="p-3">Fecha Emisión</th>
                                 <th className="p-3">Cliente</th>
                                 <th className="p-3 text-right">Saldo a Cobrar</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {manualSelectedSales.map((sale) => {
                                 const currentBalance = sale.balance !== undefined ? sale.balance : sale.total;
                                 return (
                                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors duration-150">
                                       <td className="p-3 text-center">
                                          <button
                                             onClick={() => handleManualToggleSelect(sale.id)}
                                             className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                                             title="Quitar de la planilla"
                                          >
                                             <Trash2 className="w-4 h-4" />
                                          </button>
                                       </td>
                                       <td className="p-3 font-mono text-slate-700 font-medium">{sale.series}-{sale.number}</td>
                                       <td className="p-3 text-slate-600">{new Date(sale.created_at).toLocaleDateString()}</td>
                                       <td className="p-3 font-medium text-slate-800">
                                          {sale.client_name}
                                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{sale.client_ruc}</div>
                                       </td>
                                       <td className="p-3 text-right font-bold text-green-700 bg-green-50/30">S/ {currentBalance.toFixed(2)}</td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
                           <div className="bg-slate-100 p-6 rounded-full mb-4 border border-slate-200 shadow-inner">
                              <Wallet className="w-16 h-16 opacity-30 text-slate-500" />
                           </div>
                           <h3 className="text-xl font-bold text-slate-600">Planilla en Blanco</h3>
                           <p className="text-sm mt-2 text-slate-500 max-w-sm text-center">
                              Inicie buscando y seleccionando facturas pendientes. Todos los cobros se enviarán a caja al procesar.
                           </p>
                           <button
                              onClick={() => setShowManualSearchModal(true)}
                              className="mt-6 px-6 py-2.5 bg-slate-800 text-white font-bold rounded-lg shadow hover:bg-slate-700 transition-all active:scale-95 flex items-center"
                           >
                              <Search className="w-4 h-4 mr-2" /> Empezar a buscar
                           </button>
                        </div>
                     )}
                  </div>
               </>
            )}

            {activeTab === 'HISTORY' && (
               <div className="flex flex-1 overflow-hidden">
                  {/* PLANILLAS LIST */}
                  <div className={`${selectedPlanillaId ? 'w-1/3' : 'w-full'} border-r border-slate-200 flex flex-col transition-all duration-300 bg-slate-50`}>
                     <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {historyPlanillas.length === 0 && (
                           <p className="text-center text-slate-500 py-10">No se encontraron planillas con los filtros aplicados.</p>
                        )}
                        {historyPlanillas.map(plan => {
                           const isSelected = selectedPlanillaId === plan.id;
                           return (
                              <div
                                 key={plan.id}
                                 onClick={() => setSelectedPlanillaId(plan.id)}
                                 className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-white border-blue-400 shadow-md ring-1 ring-blue-400' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'} ${plan.status === 'ANNULLED' ? 'opacity-70 grayscale' : ''}`}
                              >
                                 <div className="flex justify-between items-start mb-2">
                                    <div className="font-bold text-slate-800 flex items-center">
                                       <FileText className="w-4 h-4 mr-1 text-slate-500" />
                                       {plan.code}
                                    </div>
                                    {plan.status === 'ANNULLED' ? (
                                       <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200">ANULADO</span>
                                    ) : (
                                       <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">CAJA</span>
                                    )}
                                 </div>
                                 <div className="flex justify-between items-end">
                                    <div>
                                       <div className="text-xs text-slate-500">{new Date(plan.date).toLocaleDateString()} {new Date(plan.date).toLocaleTimeString().slice(0, 5)}</div>
                                       <div className="text-xs text-slate-400 mt-1">{plan.record_count} docs</div>
                                    </div>
                                    <div className="font-bold text-lg text-slate-900">
                                       S/ {plan.total_amount.toFixed(2)}
                                    </div>
                                 </div>
                              </div>
                           )
                        })}
                     </div>
                  </div>

                  {/* PLANILLA DETAILS */}
                  {selectedPlanillaId && selectedPlanilla && (
                     <div className="w-2/3 flex flex-col bg-white overflow-hidden animate-slide-left">
                        {/* Toolbar */}
                        <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center gap-2">
                           <div>
                              <h3 className="font-bold text-lg text-slate-800">{selectedPlanilla.code}</h3>
                              <p className="text-xs text-slate-500">Detenalle de recaudación financiera</p>
                           </div>
                           <div className="flex gap-2">
                              {selectedPlanilla.status === 'ACTIVE' && (
                                 <button
                                    onClick={() => handleAnnulPlanilla(selectedPlanilla.id)}
                                    className="flex items-center text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded border border-red-200 transition-colors"
                                    title="Revertirá el ingreso a caja y mandará todo a Pendiente"
                                 >
                                    <XCircle className="w-4 h-4 mr-1" /> Anular Planilla
                                 </button>
                              )}
                              <button
                                 onClick={() => handleExportExcel(selectedPlanilla, selectedPlanillaRecords)}
                                 className="flex items-center text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded border border-green-200 transition-colors"
                              >
                                 <Download className="w-4 h-4 mr-1" /> Excel (.xls)
                              </button>
                              <button
                                 onClick={() => handlePrintA4(selectedPlanilla.id)}
                                 className="flex items-center text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 px-3 py-1.5 rounded border border-slate-300 shadow-sm transition-colors"
                              >
                                 <Printer className="w-4 h-4 mr-1" /> Imprimir A4
                              </button>
                              <button onClick={() => setSelectedPlanillaId(null)} className="ml-2 text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded">
                                 ✕
                              </button>
                           </div>
                        </div>

                        {/* Detail List */}
                        <div className="flex-1 overflow-auto p-4">
                           {selectedPlanilla.status === 'ANNULLED' && (
                              <div className="mb-4 bg-red-50 p-3 rounded-lg border border-red-200 text-red-700 text-sm flex gap-2 items-start">
                                 <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                 <p>Esta planilla ha sido anulada. El flujo financiero hacia caja fue retirado y los vouchers reasignados a bandeja de pendientes de los vendedores originales temporalmente.</p>
                              </div>
                           )}

                           <table className="w-full text-sm text-left">
                              <thead className="bg-slate-100 text-slate-700 font-bold">
                                 <tr>
                                    <th className="p-2">Doc Ref.</th>
                                    <th className="p-2">Vendedor</th>
                                    <th className="p-2">Cliente</th>
                                    <th className="p-2 text-right">Monto</th>
                                    <th className="p-2 w-10"></th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {selectedPlanillaRecords.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                       <td className="p-2 font-mono text-slate-600">{r.document_ref}</td>
                                       <td className="p-2 font-medium text-slate-800">{sellers.find(s => s.id === r.seller_id)?.name}</td>
                                       <td className="p-2 text-slate-700 truncate max-w-[150px]">{r.client_name}</td>
                                       <td className="p-2 text-right font-bold text-slate-900">S/ {r.amount_reported.toFixed(2)}</td>
                                       <td className="p-2 text-center">
                                          {selectedPlanilla.status === 'ACTIVE' && (
                                             <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoveRecordFromPlanilla(r.id); }}
                                                className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                                                title="Extraer documento de esta planilla"
                                             >
                                                <Trash2 className="w-4 h-4" />
                                             </button>
                                          )}
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                              <tfoot>
                                 <tr>
                                    <td colSpan={3} className="p-3 text-right font-bold text-slate-600 border-t border-slate-200">TOTAL GENERADO:</td>
                                    <td className="p-3 text-right font-bold text-xl text-green-700 border-t border-slate-200">S/ {selectedPlanilla.total_amount.toFixed(2)}</td>
                                    <td className="border-t border-slate-200"></td>
                                 </tr>
                              </tfoot>
                           </table>
                        </div>
                     </div>
                  )}
               </div>
            )}

         </div>
      </div>
   );
};

