
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Wallet, CheckSquare, Square, Save, Printer, User, Filter, AlertCircle, FileText, Loader2, CheckCircle2, Clock, HelpCircle, History, Download, XCircle, Search, Trash2, Edit, UserPlus, ChevronRight } from 'lucide-react';
import { CollectionPlanilla, CollectionRecord, Client } from '../types';
import * as XLSX from 'xlsx';

export const CollectionConsolidation: React.FC = () => {
   const { collectionRecords, collectionPlanillas, sellers, consolidateCollections, currentUser, annulCollectionPlanilla, revertPlanillaForEdit, removeRecordFromPlanilla, sales, manualLiquidation, users, clients } = useStore();

   // Layout State
   const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'MANUAL'>('PENDING');

   // Editing State
   const [editingPlanillaData, setEditingPlanillaData] = useState<{ id: string, code: string, type: 'MANUAL' | 'PENDING' } | null>(null);

   // Filters & Selection
   const [selectedSeller, setSelectedSeller] = useState('ALL');
   const [dateFilter, setDateFilter] = useState('');
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
   const [selectedPlanillaId, setSelectedPlanillaId] = useState<string | null>(null);

   // UX State
   const [isProcessing, setIsProcessing] = useState(false);
   const [showConfirmModal, setShowConfirmModal] = useState<'PENDING' | 'MANUAL' | null>(null);
   const [showSuccessModal, setShowSuccessModal] = useState(false);

   // Admin Auth & Actions
   const [showAnnulModal, setShowAnnulModal] = useState<string | null>(null); // Planilla ID to annul
   const [showEditPlanillaId, setShowEditPlanillaId] = useState<string | null>(null); // Planilla ID to edit
   const [showAdminAuthModal, setShowAdminAuthModal] = useState<"ANNUL" | "EDIT" | null>(null);
   const [adminAuthInput, setAdminAuthInput] = useState('');
   const [adminAuthError, setAdminAuthError] = useState('');
   const [lastTotal, setLastTotal] = useState(0);

   interface ManualCartItem {
      saleId: string;
      clientName: string;
      clientDoc: string;
      docRef: string;
      date: string;
      total: number;
      balance: number;
      amountToPay: number;
   }

   // --- MANUAL COLLECTION STATE (Refactored) ---
   const [manualCart, setManualCart] = useState<ManualCartItem[]>([]);
   const [planillaDate, setPlanillaDate] = useState(new Date().toISOString().split('T')[0]);
   const [planillaGlosa, setPlanillaGlosa] = useState('');

   // Modal Search State
   const [manualSelectedClient, setManualSelectedClient] = useState<Client | null>(null);
   const [manualSearch, setManualSearch] = useState('');
   const [manualClientSearch, setManualClientSearch] = useState('');
   const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set());
   const [manualAmounts, setManualAmounts] = useState<Record<string, number>>({});
   const [showManualSearchModal, setShowManualSearchModal] = useState(false);

   // History Modal State
   const [showHistoryModalTarget, setShowHistoryModalTarget] = useState<string | null>(null);

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

   // Client Selection Search
   const manualClientsFound = useMemo(() => {
      const q = manualClientSearch.toLowerCase();
      if (!q) return [];
      return clients.filter(c =>
         c.name.toLowerCase().includes(q) ||
         (c.doc_number && c.doc_number.toLowerCase().includes(q))
      ).slice(0, 10);
   }, [clients, manualClientSearch]);

   // Filter sales ONLY for selected client
   const manualPendingSales = useMemo(() => {
      if (!manualSelectedClient) return [];

      const searchLower = manualSearch.toLowerCase();
      return sales
         .filter(s => s.client_id === manualSelectedClient.id || s.client_ruc === manualSelectedClient.doc_number)
         .filter(s => {
            const currentBalance = s.balance !== undefined ? s.balance : s.total;
            return currentBalance > 0 && s.status !== 'canceled';
         })
         .filter(s => {
            if (!searchLower) return true;
            return `${s.series}-${s.number}`.toLowerCase().includes(searchLower);
         })
         .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
   }, [sales, manualSearch, manualSelectedClient]);

   const manualTotals = useMemo(() => {
      return manualCart.reduce((sum, item) => sum + item.amountToPay, 0);
   }, [manualCart]);

   const manualSelectedSales = useMemo(() => {
      // This is for the modal now
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
         consolidateCollections(
            idsArray,
            currentUser?.id || 'ADMIN',
            editingPlanillaData?.type === 'PENDING' ? {
               editPlanillaId: editingPlanillaData.id,
               editPlanillaCode: editingPlanillaData.code
            } : undefined
         );

         setSelectedIds(new Set());
         if (editingPlanillaData?.type === 'PENDING') setEditingPlanillaData(null);
         setIsProcessing(false);
         setShowSuccessModal(true);
      } catch (error) {
         console.error(error);
         setIsProcessing(false);
         alert("Ocurrió un error al procesar la planilla.");
      }
   };

   // --- HANDLERS (MANUAL CART) ---

   const handleSelectClientForManual = (client: Client) => {
      setManualSelectedClient(client);
      setManualSelectedIds(new Set());
      setManualAmounts({});
      setManualSearch('');
      setManualClientSearch('');
   };

   const handleClearManualClient = () => {
      setManualSelectedClient(null);
      setManualSelectedIds(new Set());
      setManualAmounts({});
      setManualSearch('');
   };

   const handleManualToggleSelect = (id: string, defAmount: number) => {
      const newSet = new Set(manualSelectedIds);
      const newAmounts = { ...manualAmounts };

      if (newSet.has(id)) {
         newSet.delete(id);
         delete newAmounts[id];
      } else {
         newSet.add(id);
         newAmounts[id] = defAmount;
      }

      setManualSelectedIds(newSet);
      setManualAmounts(newAmounts);
   };

   const handleManualAmountChange = (id: string, val: string, max: number) => {
      let numericVal = parseFloat(val);
      if (isNaN(numericVal)) numericVal = 0;
      if (numericVal < 0) numericVal = 0;
      if (numericVal > max) numericVal = max;

      setManualAmounts(prev => ({
         ...prev,
         [id]: Number(numericVal.toFixed(2))
      }));
   };

   const handleAddModalSelectionToCart = () => {
      const newCartItems: ManualCartItem[] = [];
      const currentCartIds = new Set(manualCart.map(c => c.saleId));

      manualSelectedIds.forEach(id => {
         if (!currentCartIds.has(id)) {
            const sale = sales.find(s => s.id === id);
            if (sale) {
               newCartItems.push({
                  saleId: sale.id,
                  clientName: sale.client_name,
                  clientDoc: sale.client_ruc || 'S/D',
                  docRef: `${sale.series}-${sale.number}`,
                  date: sale.created_at,
                  total: sale.total,
                  balance: sale.balance !== undefined ? sale.balance : sale.total,
                  amountToPay: manualAmounts[id] || 0
               });
            }
         }
      });

      setManualCart(prev => [...prev, ...newCartItems]);
      setShowManualSearchModal(false);

      // Keep selected client but clear the selections inside it perfectly matching user workflow 
      // (though usually closing modal is enough, clearing ensures pristine state next open)
      setManualSelectedIds(new Set());
      setManualAmounts({});
   };

   const handleRemoveFromCart = (saleId: string) => {
      setManualCart(prev => prev.filter(c => c.saleId !== saleId));
   };

   const handleCartAmountChange = (saleId: string, val: string, max: number) => {
      let numericVal = parseFloat(val);
      if (isNaN(numericVal)) numericVal = 0;
      if (numericVal < 0) numericVal = 0;
      if (numericVal > max) numericVal = max;

      setManualCart(prev => prev.map(c =>
         c.saleId === saleId ? { ...c, amountToPay: Number(numericVal.toFixed(2)) } : c
      ));
   };

   const handleManualRequestConsolidate = () => {
      if (manualCart.length === 0) return;
      setShowConfirmModal('MANUAL');
   };

   const handleManualConfirmProcess = async () => {
      setShowConfirmModal(null);
      setLastTotal(manualTotals);
      setIsProcessing(true);

      // Simulate network
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
         const payments = manualCart.map(item => ({
            saleId: item.saleId,
            amount: item.amountToPay
         }));

         manualLiquidation(payments, currentUser?.id || 'ADMIN', {
            date: new Date(planillaDate).toISOString(),
            glosa: planillaGlosa,
            ...(editingPlanillaData?.type === 'MANUAL' ? {
               editPlanillaId: editingPlanillaData.id,
               editPlanillaCode: editingPlanillaData.code
            } : {})
         });

         // Clear cart and headers on success
         setManualCart([]);
         setPlanillaGlosa('');
         if (editingPlanillaData?.type === 'MANUAL') setEditingPlanillaData(null);
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
      // Create data for Excel
      const excelData = [];

      // Header Section
      excelData.push(['PLANILLA DE COBRANZAS', planilla.code, '', '', '', '']);
      excelData.push(['FECHA EMISION', new Date(planilla.date).toLocaleString(), '', '', '', '']);
      excelData.push(['TOTAL GENERADO', `S/ ${planilla.total_amount.toFixed(2)}`, '', '', '', '']);
      excelData.push(['GENERADO POR', currentUser?.name || planilla.user_id || 'SISTEMA', '', '', '', '']);
      excelData.push([]); // Empty row

      // Headers
      excelData.push(['N°', 'FECHA DOC', 'VENDEDOR', 'CLIENTE', 'NRO DOCUMENTO', 'IMPORTE (S/)']);

      // Data Rows
      records.forEach((r, i) => {
         const seller = sellers.find(s => s.id === r.seller_id)?.name || 'N/A';
         excelData.push([
            i + 1,
            new Date(r.date_reported).toLocaleDateString(),
            seller,
            r.client_name,
            r.document_ref,
            r.amount_reported, // Keep number for easy summing in Excel
         ]);
      });

      // Total row
      excelData.push([]);
      excelData.push(['', '', '', '', 'TOTAL:', planilla.total_amount]);

      // Create Workshet
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Simple styling to make it look professional (Set column widths)
      ws['!cols'] = [
         { wch: 5 },  // N°
         { wch: 15 }, // Fecha Doc
         { wch: 25 }, // Vendedor
         { wch: 40 }, // Cliente
         { wch: 15 }, // Nro Documento
         { wch: 15 }, // Importe
      ];

      // Apply bold to headers
      const range = XLSX.utils.decode_range(ws['!ref'] || "A1:F1");
      for (let C = range.s.c; C <= range.e.c; ++C) {
         const addr = XLSX.utils.encode_cell({ r: 5, c: C }); // Row 6 (0-indexed 5) has headers
         if (!ws[addr]) continue;
         ws[addr].s = { font: { bold: true } };
      }

      // Create Workbook and Export
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Planilla ${planilla.code}`);

      XLSX.writeFile(wb, `Planilla_${planilla.code}.xlsx`);
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

   const initiateAdminAuth = (action: "ANNUL" | "EDIT", planillaId: string) => {
      setAdminAuthInput('');
      setAdminAuthError('');
      if (action === "ANNUL") {
         setShowAnnulModal(planillaId);
         setShowAdminAuthModal("ANNUL");
      } else {
         setShowEditPlanillaId(planillaId);
         setShowAdminAuthModal("EDIT");
      }
   };

   const processAdminAuth = () => {
      // Validate Admin Password
      const adminUsers = users.filter(u => u.role === 'ADMIN');
      const isValid = adminUsers.some(admin => admin.password === adminAuthInput);

      if (!isValid) {
         setAdminAuthError('Contraseña incorrecta o permisos insuficientes.');
         return;
      }

      // If valid, proceed with action
      if (showAdminAuthModal === "ANNUL") {
         confirmAnnulPlanilla();
      } else if (showAdminAuthModal === "EDIT") {
         confirmEditPlanilla();
      }

      setShowAdminAuthModal(null);
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

   const confirmEditPlanilla = () => {
      if (showEditPlanillaId) {
         // 1. Find the Planilla and Records before reverting
         const p = collectionPlanillas.find(x => x.id === showEditPlanillaId);
         if (!p) return;

         const planillaRecords = collectionRecords.filter(r => p.records.includes(r.id));
         const wasManual = planillaRecords.every(r => r.seller_id === 'MANUAL');

         // 2. Extorno (Revertir para editar sin anular) to put the balances and records back
         revertPlanillaForEdit(showEditPlanillaId);
         setEditingPlanillaData({ id: p.id, code: p.code, type: wasManual ? 'MANUAL' : 'PENDING' });

         if (wasManual && planillaRecords.length > 0) {
            // Restore Manual workflow state (CART)
            const restoredCartItems: ManualCartItem[] = [];

            planillaRecords.forEach(r => {
               const sale = sales.find(s => s.id === r.sale_id);
               if (sale) {
                  // After revertPlanillaForEdit, the balance in store is already returned!
                  const currentReturnedBalance = sale.balance !== undefined ? sale.balance : sale.total;

                  restoredCartItems.push({
                     saleId: sale.id,
                     clientName: sale.client_name || r.client_name,
                     clientDoc: sale.client_ruc || 'S/D',
                     docRef: r.document_ref,
                     date: sale.created_at,
                     total: sale.total,
                     balance: currentReturnedBalance,
                     amountToPay: r.amount_reported
                  });
               }
            });

            setPlanillaDate(p.date ? p.date.split('T')[0] : new Date().toISOString().split('T')[0]);
            setPlanillaGlosa(p.glosa || '');
            setManualCart(restoredCartItems);
            setActiveTab('MANUAL');

         } else {
            // Normal Pending Restoration
            setActiveTab('PENDING');
            setSelectedIds(new Set(p.records.filter(id => {
               const rec = collectionRecords.find(r => r.id === id);
               return rec && rec.seller_id !== 'MANUAL';
            })));
         }

         setSelectedPlanillaId(null);
         setShowEditPlanillaId(null);
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

         {showHistoryModalTarget && (() => {
            const sale = sales.find(s => s.id === showHistoryModalTarget);
            if (!sale) return null;
            // Removed r.seller_id !== 'MANUAL' to show ALL payments regardless of origin
            const historyRecords = collectionRecords.filter(r => r.sale_id === sale.id);
            return (
               <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:hidden animate-fade-in">
                  <div className="bg-white border-2 border-slate-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[80vh]">
                     <div className="bg-slate-800 text-white p-3 flex justify-between items-center">
                        <h2 className="font-bold flex items-center text-sm uppercase tracking-wider">
                           <History className="w-4 h-4 mr-2" /> Historial de Pagos - {sale.series}-{sale.number}
                        </h2>
                        <button onClick={() => setShowHistoryModalTarget(null)} className="text-slate-300 hover:text-white transition-colors bg-white/10 p-1 rounded-full">
                           <XCircle className="w-5 h-5" />
                        </button>
                     </div>
                     <div className="p-4 bg-slate-50 flex-1 overflow-auto">
                        <div className="mb-4 text-sm bg-white p-3 border border-slate-200 rounded-lg">
                           <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-slate-700">Cliente:</span>
                              <span className="text-slate-600">{sale.client_name}</span>
                           </div>
                           <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-slate-700">Total Inicial de Factura:</span>
                              <span className="text-slate-600 font-bold">S/ {sale.total.toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-700">Saldo Pendiente Actual:</span>
                              <span className="text-red-600 font-bold">S/ {(sale.balance !== undefined ? sale.balance : sale.total).toFixed(2)}</span>
                           </div>
                        </div>
                        {historyRecords.length > 0 ? (
                           <table className="w-full text-xs text-left bg-white border border-slate-200 rounded shadow-sm">
                              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                 <tr>
                                    <th className="p-3 w-32 border-r border-slate-200">Fecha Pago</th>
                                    <th className="p-3 border-r border-slate-200">Vendedor / Medio</th>
                                    <th className="p-3 text-right border-r border-slate-200">Monto Pagado</th>
                                    <th className="p-3 w-40 text-center">Estado Planilla</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {historyRecords.map(r => {
                                    const sellerMatch = sellers.find(s => s.id === r.seller_id);
                                    let statusLabel = 'Recibido (Pendiente)';
                                    let statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
                                    if (r.status === 'VALIDATED') {
                                       statusLabel = 'En Planilla';
                                       statusColor = 'text-blue-700 bg-blue-50 border-blue-200';
                                    }
                                    if (r.planilla_id) {
                                       const pl = collectionPlanillas.find(p => p.id === r.planilla_id);
                                       if (pl?.status === 'ACTIVE') {
                                          statusLabel = pl.code ? `Liquidado (${pl.code})` : 'Liquidado';
                                          statusColor = 'text-green-700 bg-green-50 border-green-200';
                                       } else if (pl?.status === 'ANNULLED') {
                                          statusLabel = pl.code ? `Anulado (${pl.code})` : 'Anulado';
                                          statusColor = 'text-red-700 bg-red-50 border-red-200 line-through';
                                       }
                                    }
                                    return (
                                       <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                          <td className="p-3 text-slate-700 font-medium">
                                             <div className="flex flex-col">
                                                <span>{new Date(r.date_reported).toLocaleDateString()}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{new Date(r.date_reported).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                             </div>
                                          </td>
                                          <td className="p-3">
                                             <div className="font-bold text-slate-800">{sellerMatch?.name || r.seller_id}</div>
                                             <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded inline-block mt-1 uppercase tracking-wider">{r.payment_method}</div>
                                          </td>
                                          <td className="p-3 text-right font-bold text-green-700 text-sm">S/ {r.amount_reported.toFixed(2)}</td>
                                          <td className="p-3 text-center">
                                             <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold border whitespace-nowrap inline-block shadow-sm ${statusColor}`}>
                                                {statusLabel}
                                             </span>
                                          </td>
                                       </tr>
                                    );
                                 })}
                              </tbody>
                           </table>
                        ) : (
                           <div className="text-center text-slate-400 py-8 bg-white border border-slate-200 rounded dashed">
                              Este documento no tiene pagos registrados.
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            );
         })()}

         {showManualSearchModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:hidden animate-fade-in">
               <div className="bg-white border-2 border-slate-800 rounded-lg shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="bg-slate-800 text-white p-3 flex justify-between items-center">
                     <h2 className="font-bold flex items-center text-sm uppercase tracking-wider">
                        <Search className="w-4 h-4 mr-2" /> Buscador de Cuentas por Cobrar (Cliente)
                     </h2>
                     <button onClick={() => setShowManualSearchModal(false)} className="text-slate-300 hover:text-white transition-colors bg-white/10 p-1 rounded-full">
                        <XCircle className="w-5 h-5" />
                     </button>
                  </div>

                  {/* Modal Body: Two columns layout */}
                  <div className="flex flex-1 overflow-hidden min-h-[400px]">

                     {/* LEFT COL: Search Client */}
                     <div className="w-1/3 border-r border-slate-200 flex flex-col bg-slate-50">
                        <div className="p-3 border-b border-slate-200 bg-white">
                           <label className="text-xs font-bold text-slate-500 mb-1 block">Código / Nombre / Cliente / RUC</label>
                           <input
                              type="text"
                              autoFocus
                              className="w-full border-2 border-slate-300 rounded px-2 py-1.5 focus:border-blue-500 focus:ring-blue-100 outline-none transition-all text-sm font-medium"
                              placeholder="Escriba para buscar..."
                              value={manualClientSearch}
                              onChange={(e) => setManualClientSearch(e.target.value)}
                           />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                           {manualClientsFound.map((client) => {
                              const isSel = manualSelectedClient?.id === client.id;
                              return (
                                 <div
                                    key={client.id}
                                    onClick={() => handleSelectClientForManual(client)}
                                    className={`p-2 border rounded cursor-pointer transition-all ${isSel ? 'bg-blue-600 border-blue-700 text-white shadow' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400'}`}
                                 >
                                    <div className="text-xs text-opacity-80 font-mono mb-0.5">{client.doc_type}: {client.doc_number}</div>
                                    <div className="font-bold text-sm leading-tight truncate" title={client.name}>{client.name}</div>
                                 </div>
                              );
                           })}
                           {manualClientSearch && manualClientsFound.length === 0 && (
                              <div className="text-center text-slate-400 text-xs py-4">No se hallaron coincidencias.</div>
                           )}
                        </div>
                     </div>

                     {/* RIGHT COL: Pending Sales for selected client */}
                     <div className="w-2/3 flex flex-col bg-white overflow-hidden relative">
                        {manualSelectedClient ? (
                           <>
                              <div className="p-2 border-b border-slate-200 bg-slate-100 flex items-center justify-between">
                                 <div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Documentos Pendientes</div>
                                    <div className="font-bold text-sm text-slate-800 truncate max-w-[300px]">{manualSelectedClient.name}</div>
                                 </div>
                                 <div>
                                    <input
                                       type="text"
                                       placeholder="Filtrar doc (F001...)"
                                       value={manualSearch}
                                       onChange={(e) => setManualSearch(e.target.value)}
                                       className="border border-slate-300 rounded text-xs px-2 py-1 outline-none focus:border-blue-500"
                                    />
                                 </div>
                              </div>
                              <div className="flex-1 overflow-auto bg-white">
                                 <table className="w-full text-xs text-left">
                                    <thead className="bg-white sticky top-0 shadow-sm font-bold text-slate-600">
                                       <tr>
                                          <th className="p-2 w-8 text-center">Sel.</th>
                                          <th className="p-2">Documento</th>
                                          <th className="p-2 hidden sm:table-cell">F.Doc</th>
                                          <th className="p-2 text-right">Total.Doc</th>
                                          <th className="p-2 text-right">Saldo</th>
                                          <th className="p-2 text-right w-24">A Cobrar</th>
                                       </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                       {manualPendingSales.map(sale => {
                                          const isSelected = manualSelectedIds.has(sale.id);
                                          const currentBalance = sale.balance !== undefined ? sale.balance : sale.total;
                                          const amountToPay = manualAmounts[sale.id] || 0;
                                          return (
                                             <tr key={sale.id} className={isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}>
                                                <td className="p-2 text-center align-middle" onClick={() => handleManualToggleSelect(sale.id, currentBalance)}>
                                                   <div className={`w-4 h-4 rounded border flex items-center justify-center mx-auto cursor-pointer ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                                      {isSelected && <CheckSquare className="w-2.5 h-2.5 text-white" />}
                                                   </div>
                                                </td>
                                                <td className="p-2 font-mono font-medium text-slate-700">{sale.series}-{sale.number}</td>
                                                <td className="p-2 text-slate-500 hidden sm:table-cell">{new Date(sale.created_at).toLocaleDateString()}</td>
                                                <td className="p-2 text-right font-bold text-slate-500">S/ {sale.total.toFixed(2)}</td>
                                                <td className="p-2 text-right font-bold text-red-600">S/ {currentBalance.toFixed(2)}</td>
                                                <td className="p-2 text-right">
                                                   <input
                                                      type="number"
                                                      min="0.01"
                                                      step="0.01"
                                                      max={currentBalance}
                                                      disabled={!isSelected}
                                                      className="w-full min-w-[70px] text-right font-bold text-slate-900 border border-slate-300 rounded px-1 py-1 outline-none focus:border-blue-500 disabled:opacity-30 disabled:bg-transparent"
                                                      value={amountToPay === 0 ? '' : amountToPay}
                                                      onChange={(e) => handleManualAmountChange(sale.id, e.target.value, currentBalance)}
                                                   />
                                                </td>
                                             </tr>
                                          );
                                       })}
                                       {manualPendingSales.length === 0 && (
                                          <tr><td colSpan={5} className="text-center p-8 text-slate-400">Sin facturas vigentes.</td></tr>
                                       )}
                                    </tbody>
                                 </table>
                              </div>
                           </>
                        ) : (
                           <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8">
                              <Search className="w-16 h-16 mb-4 opacity-30" />
                              <p className="font-medium text-slate-400">Seleccione un cliente a la izquierda</p>
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="bg-slate-100 border-t border-slate-200 p-3 flex justify-between items-center">
                     <div className="font-bold text-slate-600 text-sm">
                        Seleccionados: {manualSelectedIds.size} Dcmtos.
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => setShowManualSearchModal(false)} className="px-4 py-1.5 rounded font-bold text-slate-600 hover:bg-slate-200 border border-slate-300 bg-white">
                           Cerrar
                        </button>
                        <button
                           onClick={handleAddModalSelectionToCart}
                           disabled={manualSelectedIds.size === 0}
                           className="px-6 py-1.5 rounded font-bold text-white bg-green-600 hover:bg-green-700 shadow flex items-center disabled:opacity-50"
                        >
                           <CheckSquare className="w-4 h-4 mr-2" /> Agregar a Planilla
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* CONFIRMATION & RELOJ MODALS */}
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

         {/* ADMIN AUTH MODAL */}
         {showAdminAuthModal && (
            <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-fade-in print:hidden">
               <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 border-t-4 border-slate-800 animate-scale-up">
                  <div className="flex flex-col items-center text-center mb-6">
                     <div className="bg-slate-100 p-3 rounded-full mb-3">
                        <User className="w-8 h-8 text-slate-700" />
                     </div>
                     <h3 className="text-lg font-bold text-slate-800">
                        {showAdminAuthModal === 'ANNUL' ? 'Autorización para Anular' : 'Autorización para Editar'}
                     </h3>
                     <p className="text-slate-500 text-sm mt-2">
                        Esta acción requiere privilegios de <strong className="text-slate-700">Administrador</strong>.
                        Ingrese la contraseña maestra para continuar.
                     </p>
                  </div>

                  <div className="mb-4">
                     <input
                        type="password"
                        autoFocus
                        placeholder="Contraseña de Administrador"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold tracking-widest text-slate-800 shadow-inner bg-slate-50"
                        value={adminAuthInput}
                        onChange={(e) => setAdminAuthInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && processAdminAuth()}
                     />
                     {adminAuthError && (
                        <p className="text-xs text-red-500 font-bold mt-2 text-center animate-shake">{adminAuthError}</p>
                     )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                     <button
                        onClick={() => { setShowAdminAuthModal(null); setShowAnnulModal(null); setShowEditPlanillaId(null); }}
                        className="py-2.5 rounded-lg font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                     >
                        Cancelar
                     </button>
                     <button
                        onClick={processAdminAuth}
                        className={`py-2.5 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95 ${showAdminAuthModal === 'ANNUL' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                     >
                        {showAdminAuthModal === 'ANNUL' ? 'ANULAR' : 'EDITAR'}
                     </button>
                  </div>
               </div>
            </div>
         )}


         {/* MANUAL SEARCH MODAL -> DEPRECATED. Keep just in case, but logic moved to Tab. Leaving for syntax completion */}
         {showManualSearchModal && (
            <div className="hidden" />
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
                  {editingPlanillaData?.type === 'PENDING' && (
                     <div className="bg-amber-100 text-amber-800 px-4 py-1.5 rounded-lg border border-amber-300 font-bold text-sm flex items-center shadow-sm animate-pulse-fast">
                        <Edit className="w-4 h-4 mr-2" /> Editando Planilla {editingPlanillaData.code}
                        <button onClick={() => setEditingPlanillaData(null)} className="ml-3 text-amber-600 hover:text-amber-900 transition-colors" title="Cancelar Edición"><XCircle className="w-4 h-4" /></button>
                     </div>
                  )}
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
                  <div className="flex-1 min-w-[150px] max-w-[200px]">
                     <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Contable</label>
                     <input
                        type="date"
                        className="w-full border border-slate-300 rounded p-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={planillaDate}
                        onChange={(e) => setPlanillaDate(e.target.value)}
                     />
                  </div>
                  <div className="flex-1 min-w-[250px] max-w-sm">
                     <label className="block text-xs font-bold text-slate-500 mb-1">Glosa / Observación</label>
                     <input
                        type="text"
                        placeholder="Motivo o detalle del ingreso..."
                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={planillaGlosa}
                        onChange={(e) => setPlanillaGlosa(e.target.value)}
                     />
                  </div>
                  <div className="flex items-center gap-3 ml-auto">
                     {editingPlanillaData?.type === 'MANUAL' && (
                        <div className="bg-amber-100 text-amber-800 px-4 py-1.5 rounded border border-amber-300 font-bold text-sm flex items-center shadow-sm animate-pulse-fast">
                           <Edit className="w-4 h-4 mr-2" /> Editando: {editingPlanillaData.code}
                           <button onClick={() => setEditingPlanillaData(null)} className="ml-3 text-amber-600 hover:text-amber-900 transition-colors" title="Cancelar Edición"><XCircle className="w-4 h-4" /></button>
                        </div>
                     )}
                     <button
                        onClick={() => setShowManualSearchModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow-sm hover:bg-blue-700 flex items-center transition-colors text-sm border border-blue-700"
                     >
                        <Search className="w-4 h-4 mr-2" /> Buscar Documentos
                     </button>
                     <div className="bg-green-50 px-4 py-1.5 rounded border border-green-200 flex flex-col items-end min-w-[140px]">
                        <span className="text-[10px] text-green-800 font-bold uppercase tracking-wider">Total Carrito</span>
                        <span className="text-lg font-bold text-green-700">S/ {manualTotals.toFixed(2)}</span>
                     </div>
                     <button
                        onClick={handleManualRequestConsolidate}
                        disabled={manualCart.length === 0 || isProcessing}
                        className="bg-slate-900 text-white px-5 py-2 rounded font-bold shadow hover:bg-slate-800 disabled:opacity-50 flex items-center transition-all text-sm border border-slate-950"
                     >
                        <Save className="w-4 h-4 mr-2" /> PROCESAR
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
               <div className="flex-1 flex flex-col bg-slate-50 p-4 overflow-hidden">
                  {manualCart.length > 0 ? (
                     <div className="bg-white rounded shadow-sm border border-slate-200 flex-1 overflow-auto">
                        <table className="w-full text-sm text-left relative">
                           <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                              <tr>
                                 <th className="p-3 w-10 text-center">N°</th>
                                 <th className="p-3">Cliente</th>
                                 <th className="p-3">Doc Ref.</th>
                                 <th className="p-3 text-right">Total.Doc</th>
                                 <th className="p-3 text-right">Saldo Deudor</th>
                                 <th className="p-3 text-right w-40">Importe a Pagar (S/)</th>
                                 <th className="p-3 w-20 text-center">Acción</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {manualCart.map((item, i) => (
                                 <tr key={item.saleId} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-3 text-center text-slate-400 font-medium">{i + 1}</td>
                                    <td className="p-3 text-slate-800 font-bold truncate max-w-[200px]" title={item.clientName}>{item.clientName}<br /><span className="text-xs text-slate-500 font-normal">{item.clientDoc}</span></td>
                                    <td className="p-3 font-mono text-slate-700 font-medium">
                                       {item.docRef}<br />
                                       <span className="text-[10px] text-slate-400 font-sans">{new Date(item.date).toLocaleDateString()}</span>
                                    </td>
                                    <td className="p-3 text-right font-bold text-slate-500">S/ {item.total?.toFixed(2) || (0).toFixed(2)}</td>
                                    <td className="p-3 text-right font-bold text-red-600">S/ {item.balance.toFixed(2)}</td>
                                    <td className="p-3 text-right">
                                       <input
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          max={item.balance}
                                          className="w-28 text-right font-bold text-slate-900 border-2 border-slate-300 rounded px-2 py-1 outline-none focus:border-blue-500 focus:ring-blue-200 shadow-inner"
                                          value={item.amountToPay === 0 ? '' : item.amountToPay}
                                          onChange={(e) => handleCartAmountChange(item.saleId, e.target.value, item.balance)}
                                       />
                                    </td>
                                    <td className="p-3">
                                       <div className="flex justify-center items-center gap-1">
                                          <button
                                             onClick={() => setShowHistoryModalTarget(item.saleId)}
                                             className="text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50 transition-colors"
                                             title="Ver Historial de Pagos de este Documento"
                                          >
                                             <History className="w-5 h-5" />
                                          </button>
                                          <button
                                             onClick={() => handleRemoveFromCart(item.saleId)}
                                             className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                                             title="Quitar Seleccion"
                                          >
                                             <Trash2 className="w-5 h-5" />
                                          </button>
                                       </div>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  ) : (
                     <div className="flex flex-col items-center justify-center flex-1 text-slate-400 py-16 bg-white rounded border border-slate-200 border-dashed">
                        <div className="bg-slate-50 p-6 rounded-full border border-slate-100 mb-4">
                           <Wallet className="w-16 h-16 opacity-30 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-600">Planilla Vacía</h3>
                        <p className="text-sm mt-2 text-slate-500 max-w-sm text-center">
                           Aún no ha agregado documentos a esta planilla de cobranza múltiple.
                        </p>
                        <button
                           onClick={() => setShowManualSearchModal(true)}
                           className="mt-6 font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-6 py-2 rounded-lg border border-blue-200 transition-colors flex items-center"
                        >
                           <Search className="w-4 h-4 mr-2" />
                           Buscar Cuentas por Cobrar
                        </button>
                     </div>
                  )}
               </div>
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
                                 <>
                                    <button
                                       onClick={() => initiateAdminAuth("EDIT", selectedPlanilla.id)}
                                       className="flex items-center text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded border border-blue-200 transition-colors"
                                       title="Anulará la planilla y seleccionará los documentos, listo para modificar y volver a procesar."
                                    >
                                       <Edit className="w-4 h-4 mr-1" /> Editar
                                    </button>
                                    <button
                                       onClick={() => initiateAdminAuth("ANNUL", selectedPlanilla.id)}
                                       className="flex items-center text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded border border-red-200 transition-colors"
                                       title="Revertirá el ingreso a caja y mandará todo a Pendiente"
                                    >
                                       <XCircle className="w-4 h-4 mr-1" /> Anular
                                    </button>
                                 </>
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

