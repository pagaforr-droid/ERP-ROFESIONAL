
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { DispatchSheet, Sale, LiquidationDocument, DispatchLiquidation } from '../types';
import { Search, CheckCircle, AlertTriangle, ArrowRight, Printer, XCircle, FileText, Ban, DollarSign, CreditCard, ShieldAlert, Save, Package, HelpCircle, User, Calendar, RotateCcw, Plus, ListChecks, Camera, MapPin, Image as ImageIcon, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type Tab = 'PENDING' | 'HISTORY';
type Step = 'LIST' | 'PROCESS' | 'SUMMARY';

// Helper interface for the sophisticated return logic
interface ReturnEntry {
   boxes: number;
   units: number;
}

// Robust UUID Generator Helper
const generateUUID = () => {
   if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
   }
   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
   });
};

export const DispatchLiquidationComp: React.FC = () => {
   const store = useStore();
   const [activeTab, setActiveTab] = useState<Tab>('PENDING');
   const [currentStep, setCurrentStep] = useState<Step>('LIST');

   // Selection State
   const [selectedDispatch, setSelectedDispatch] = useState<DispatchSheet | null>(null);

   // Processing State
   const [processedDocs, setProcessedDocs] = useState<Record<string, LiquidationDocument>>({});
   const [extraSaleIds, setExtraSaleIds] = useState<string[]>([]); // To track manually added documents

   // --- MODALS STATE ---
   const [activeModal, setActiveModal] = useState<'NONE' | 'VOID' | 'PARTIAL' | 'CONFIRM_FINALIZE' | 'ADD_EXTRA' | 'CHANGE_TYPE' | 'PHOTO'>('NONE');
   const [targetSaleId, setTargetSaleId] = useState<string | null>(null);
   const [photoTargetUrl, setPhotoTargetUrl] = useState<string | null>(null);

   // ADD EXTRA DOC State
   const [extraDocSearch, setExtraDocSearch] = useState('');

   // CHANGE DOC TYPE State
   const [newDocType, setNewDocType] = useState<'FACTURA' | 'BOLETA'>('BOLETA');

   // Summary Inputs
   const [cashDelivered, setCashDelivered] = useState<number>(0);
   const [yapeDelivered, setYapeDelivered] = useState<number>(0);
   const [voucherDelivered, setVoucherDelivered] = useState<number>(0);
   const [responsiblePerson, setResponsiblePerson] = useState<string>('');

   const totalDelivered = cashDelivered + yapeDelivered + voucherDelivered;

   // Partial Modal Data: Now tracks Boxes and Units separately
   const [returnEntries, setReturnEntries] = useState<Record<string, ReturnEntry>>({});
   const [partialBalanceType, setPartialBalanceType] = useState<'CONTADO' | 'CREDITO'>('CONTADO');

   // Void Modal Data
   const [voidReason, setVoidReason] = useState('');

   // --- HELPERS ---
   const getSalesForDispatch = () => {
      if (!selectedDispatch) return [];
      const baseSales = store.sales.filter(s => selectedDispatch.sale_ids.includes(s.id));
      const extraSales = store.sales.filter(s => extraSaleIds.includes(s.id));

      // Combine and filter out duplicates just in case
      const allSales = [...baseSales, ...extraSales];
      return allSales.filter((val, idx, self) => self.findIndex(t => t.id === val.id) === idx);
   };

   const dispatchSales = useMemo(() => getSalesForDispatch(), [selectedDispatch, store.sales, extraSaleIds]);
   const pendingDispatches = useMemo(() => store.dispatchSheets.filter(d => d.status !== 'completed'), [store.dispatchSheets]);
   const liquidatedDispatches = useMemo(() => store.dispatchLiquidations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [store.dispatchLiquidations]);

   const startLiquidation = (ds: DispatchSheet) => {
      setSelectedDispatch(ds);
      setExtraSaleIds([]); // Reset extra

      // Initialize docs based on original payment method
      const initial: Record<string, LiquidationDocument> = {};
      const sales = store.sales.filter(s => ds.sale_ids.includes(s.id));
      sales.forEach(s => {
         initial[s.id] = {
            sale_id: s.id,
            action: s.payment_method === 'CONTADO' ? 'PAID' : 'CREDIT',
            amount_collected: s.payment_method === 'CONTADO' ? s.total : 0,
            amount_credit: s.payment_method === 'CREDITO' ? s.total : 0,
            amount_void: 0,
            amount_credit_note: 0,
            returned_items: []
         };
      });
      setProcessedDocs(initial);
      setCashDelivered(0); // Reset UI fields
      setCurrentStep('PROCESS');
   };

   // --- ACTIONS LOGIC ---

   const handleQuickAction = (sale: Sale, action: 'PAID' | 'CREDIT') => {
      // Reset return entries if switching back to full payment/credit
      const doc: LiquidationDocument = {
         sale_id: sale.id,
         action: action,
         amount_collected: action === 'PAID' ? sale.total : 0,
         amount_credit: action === 'CREDIT' ? sale.total : 0,
         amount_void: 0,
         amount_credit_note: 0,
         returned_items: []
      };
      setProcessedDocs(prev => ({ ...prev, [sale.id]: doc }));
   };

   const openVoidModal = (saleId: string) => {
      setTargetSaleId(saleId);
      setVoidReason('');
      setActiveModal('VOID');
   };

   const confirmVoid = () => {
      if (!targetSaleId) return;
      if (voidReason.length < 5) { alert("Debe ingresar un motivo válido para la anulación."); return; }

      const sale = dispatchSales.find(s => s.id === targetSaleId);
      if (!sale) return;

      const doc: LiquidationDocument = {
         sale_id: sale.id,
         action: 'VOID',
         amount_collected: 0,
         amount_credit: 0,
         amount_void: sale.total,
         amount_credit_note: 0,
         reason: voidReason,
         returned_items: [] // All items imply return in void logic
      };
      setProcessedDocs(prev => ({ ...prev, [sale.id]: doc }));
      setActiveModal('NONE');
   };

   const openChangeTypeModal = (saleId: string) => {
      const sale = store.sales.find(s => s.id === saleId);
      if (!sale) return;
      if (sale.sunat_status === 'SENT' || sale.sunat_status === 'ACCEPTED') {
         alert("No se puede cambiar el tipo de un documento ya emitido a SUNAT.");
         return;
      }
      setTargetSaleId(saleId);
      setNewDocType(sale.document_type === 'FACTURA' ? 'BOLETA' : 'FACTURA');
      setActiveModal('CHANGE_TYPE');
   };

   const confirmChangeType = () => {
      if (!targetSaleId) return;

      const res = store.changeSaleDocumentType(targetSaleId, newDocType, 'ADMIN');
      if (res.success) {
         setActiveModal('NONE');
      } else {
         alert(res.msg);
      }
   };

   const openPartialModal = (saleId: string) => {
      setTargetSaleId(saleId);
      // Reset entries for this sale
      const initialEntries: Record<string, ReturnEntry> = {};
      const sale = dispatchSales.find(s => s.id === saleId);
      sale?.items.forEach((item, idx) => {
         const itemKey = `${item.id}_${item.is_bonus ? 'bonus' : 'regular'}_${idx}`;
         initialEntries[itemKey] = { boxes: 0, units: 0 };
      });
      setReturnEntries(initialEntries);

      // Set default balance type based on original sale
      setPartialBalanceType(sale?.payment_method === 'CREDITO' ? 'CREDITO' : 'CONTADO');
      setActiveModal('PARTIAL');
   };

   const handleReturnChange = (itemId: string, field: 'boxes' | 'units', value: number) => {
      const val = Math.max(0, value);
      setReturnEntries(prev => ({
         ...prev,
         [itemId]: { ...prev[itemId], [field]: val }
      }));
   };

   const confirmPartial = () => {
      if (!targetSaleId) return;
      const sale = dispatchSales.find(s => s.id === targetSaleId);
      if (!sale) return;

      let totalRefund = 0;
      const returnedItemsList: any[] = [];

      // Calculate Refund with Flexibility
      for (const [idx, item] of sale.items.entries()) {
         const itemKey = `${item.id}_${item.is_bonus ? 'bonus' : 'regular'}_${idx}`;
         const entry = returnEntries[itemKey];
         if (!entry || (entry.boxes === 0 && entry.units === 0)) continue;

         // Get Product Factor
         const product = store.products.find(p => p.id === item.product_id);
         const factor = product?.package_content || 1;

         // Calculate Units Returned
         const returnedBaseUnits = (entry.boxes * factor) + entry.units;

         // Validation: Cannot return more than sold
         if (returnedBaseUnits > item.quantity_base) {
            alert(`Error en ${item.product_name}: Estás devolviendo ${returnedBaseUnits} unidades, pero solo se vendieron ${item.quantity_base}.`);
            return;
         }

         if (returnedBaseUnits > 0) {
            // Proportional Refund Calculation
            const refundRatio = returnedBaseUnits / item.quantity_base;
            const refundAmount = item.total_price * refundRatio;

            totalRefund += refundAmount;

            returnedItemsList.push({
               product_id: item.product_id,
               product_name: item.product_name,
               quantity_base: returnedBaseUnits, // Update Kardex with this
               quantity_presentation: returnedBaseUnits, // Simplified for display
               unit_type: 'MIXTO', // Custom label
               unit_price: item.unit_price, // Reference
               total_refund: refundAmount
            });
         }
      }

      if (totalRefund === 0) { alert("No ha seleccionado ninguna devolución."); return; }

      // Float correction
      totalRefund = Number(totalRefund.toFixed(2));
      const saleTotal = Number(sale.total.toFixed(2));

      if (totalRefund >= saleTotal) {
         alert("El monto de devolución iguala o supera el total. Use la opción ANULAR.");
         return;
      }

      const remainder = saleTotal - totalRefund;

      // Assign remainder based on user selection
      const collected = partialBalanceType === 'CONTADO' ? remainder : 0;
      const credit = partialBalanceType === 'CREDITO' ? remainder : 0;

      const doc: LiquidationDocument = {
         sale_id: sale.id,
         action: 'PARTIAL_RETURN',
         amount_collected: Number(collected.toFixed(2)),
         amount_credit: Number(credit.toFixed(2)),
         amount_void: 0,
         amount_credit_note: totalRefund,
         credit_note_series: 'TBD', // Let the store assign a real series and correlative later
         balance_payment_method: partialBalanceType,
         returned_items: returnedItemsList
      };

      setProcessedDocs(prev => ({ ...prev, [sale.id]: doc }));
      setActiveModal('NONE');
   };

   const handleAddExtraDocument = (saleId: string) => {
      if (dispatchSales.find(s => s.id === saleId)) {
         alert("El documento ya está en la lista.");
         return;
      }
      const sale = store.sales.find(s => s.id === saleId);
      if (!sale) return;

      setExtraSaleIds(prev => [...prev, sale.id]);

      // Initialize its processed status
      setProcessedDocs(prev => ({
         ...prev,
         [sale.id]: {
            sale_id: sale.id,
            action: sale.payment_method === 'CONTADO' ? 'PAID' : 'CREDIT',
            amount_collected: sale.payment_method === 'CONTADO' ? sale.total : 0,
            amount_credit: sale.payment_method === 'CREDITO' ? sale.total : 0,
            amount_void: 0,
            amount_credit_note: 0,
            returned_items: []
         }
      }));
      setActiveModal('NONE');
      setExtraDocSearch('');
   };

   // --- FINALIZATION ---
   const totals = useMemo(() => {
      let cash = 0;
      let credit = 0;
      let voided = 0;
      let returns = 0;

      Object.values(processedDocs).forEach((doc: LiquidationDocument) => {
         cash += doc.amount_collected || 0;
         credit += doc.amount_credit || 0;
         voided += doc.amount_void || 0;
         returns += doc.amount_credit_note || 0;
      });

      return { cash, credit, voided, returns };
   }, [processedDocs]);

   const generateLiquidationPDF = () => {
      if (!selectedDispatch) return;

      const doc = new jsPDF({ format: 'A4', unit: 'mm' });
      const pageWidth = doc.internal.pageSize.width;

      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Liquidación de Ruta", pageWidth / 2, 20, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Hoja de Ruta: ${selectedDispatch.code}`, 15, 30);
      doc.text(`Fecha Impresión: ${new Date().toLocaleString()}`, 15, 36);
      doc.text(`Responsable: ${responsiblePerson || 'No especificado'}`, 15, 42);

      // Total Summaries
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(240, 240, 240);
      doc.rect(15, 48, pageWidth - 30, 22, "FD");

      doc.setFont("helvetica", "bold");
      doc.text("Resumen General", 20, 55);

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Caja Total TEÓRICA:", 20, 62);
      doc.text(`S/ ${totals.cash.toFixed(2)}`, 65, 62);

      doc.text("Ctas por Cobrar (Créditos):", 20, 67);
      doc.text(`S/ ${totals.credit.toFixed(2)}`, 65, 67);

      doc.text("Monto RENDIDO AL TERMINAR:", 100, 62);
      doc.text(`S/ ${totalDelivered.toFixed(2)}`, 145, 62);

      const diff = totalDelivered - totals.cash;
      doc.text("Diferencia Física:", 100, 67);
      if (diff > 0) {
         doc.setTextColor(0, 150, 0);
         doc.text(`+ S/ ${diff.toFixed(2)} (Sobrante)`, 145, 67);
      } else if (diff < 0) {
         doc.setTextColor(200, 0, 0);
         doc.text(`- S/ ${Math.abs(diff).toFixed(2)} (Faltante)`, 145, 67);
      } else {
         doc.text("S/ 0.00 (Cuadre Exacto)", 145, 67);
      }
      doc.setTextColor(0, 0, 0);

      // Details of rendering
      doc.text(`Efectivo: S/ ${cashDelivered.toFixed(2)} | Yape/Plin: S/ ${yapeDelivered.toFixed(2)} | Vouchers: S/ ${voucherDelivered.toFixed(2)}`, 100, 55);

      // DOCUMENT TABLE
      const tableData = dispatchSales.map(sale => {
         const pDoc = processedDocs[sale.id];
         let finalState = '-';
         if (!pDoc) return [sale.client_name, sale.number, 'ERROR', '-', '-', '-'];
         if (pDoc.action === 'PAID') finalState = 'COBRADO';
         if (pDoc.action === 'CREDIT') finalState = 'CREDITO';
         if (pDoc.action === 'VOID') finalState = 'ANULADO';
         if (pDoc.action === 'PARTIAL_RETURN') finalState = `PARCIAL (NC ${pDoc.credit_note_series || ''})`;

         const isExtra = extraSaleIds.includes(sale.id) ? '\n(Cobranza Adicional)' : '';

         return [
            sale.client_name + isExtra,
            `${sale.document_type.substring(0, 3)} ${sale.series}-${sale.number}`,
            finalState,
            pDoc.amount_collected > 0 ? pDoc.amount_collected.toFixed(2) : '-',
            pDoc.amount_credit > 0 ? pDoc.amount_credit.toFixed(2) : '-',
            (pDoc.amount_void + pDoc.amount_credit_note) > 0 ? (pDoc.amount_void + pDoc.amount_credit_note).toFixed(2) : '-'
         ];
      });

      autoTable(doc, {
         startY: 75,
         head: [['Cliente', 'Documento', 'Estado', 'Efectivo', 'Crédito', 'Devuelto (S/)']],
         body: tableData,
         theme: 'grid',
         styles: { fontSize: 7, cellPadding: 0.8 },
         headStyles: { fillColor: [50, 50, 50] },
      });

      let finalY = (doc as any).lastAutoTable.finalY + 15;

      // KARDEX RETURN TABLE
      const returnEntriesForPdf: any[] = [];
      const consolidatedReturns: Record<string, { name: string, baseQty: number, product_id: string }> = {};

      Object.values(processedDocs).forEach((pDoc: LiquidationDocument) => {
         const sale = dispatchSales.find(s => s.id === pDoc.sale_id);
         if (!sale) return;

         if (pDoc.action === 'VOID') {
            sale.items.forEach(i => {
               returnEntriesForPdf.push([i.product_name, `${sale.series}-${sale.number}`, `${i.quantity_presentation} ${i.selected_unit === 'PKG' ? 'CJA' : 'UND'} (Anulación)`, i.total_price.toFixed(2)]);
               if (!consolidatedReturns[i.product_id]) consolidatedReturns[i.product_id] = { name: i.product_name, baseQty: 0, product_id: i.product_id };
               consolidatedReturns[i.product_id].baseQty += i.quantity_base;
            });
         } else if (pDoc.action === 'PARTIAL_RETURN') {
            pDoc.returned_items.forEach(i => {
               returnEntriesForPdf.push([i.product_name, `${sale.series}-${sale.number}`, `${i.quantity_base} Base (NC)`, i.total_refund.toFixed(2)]);
               if (!consolidatedReturns[i.product_id]) consolidatedReturns[i.product_id] = { name: i.product_name, baseQty: 0, product_id: i.product_id };
               consolidatedReturns[i.product_id].baseQty += i.quantity_base;
            });
         }
      });

      if (returnEntriesForPdf.length > 0) {
         // CONSOLIDATED RETURNS
         doc.setFontSize(10);
         doc.setFont("helvetica", "bold");
         doc.text("CONSOLIDADO DE MERCADERÍA REGRESADA AL ALMACÉN", 15, finalY);

         const consolidatedRows = Object.values(consolidatedReturns).map(ret => {
            const product = store.products.find(p => p.id === ret.product_id);
            const factor = product?.package_content || 1;
            const cjas = Math.floor(ret.baseQty / factor);
            const unds = ret.baseQty % factor;
            const formatQty = `${cjas > 0 ? cjas + ' CJAS ' : ''}${unds > 0 || cjas === 0 ? unds + ' UNDS' : ''}`;
            return [ret.name, formatQty, ret.baseQty.toString()];
         });

         autoTable(doc, {
            startY: finalY + 5,
            head: [['Producto', 'Cant. (Cajas / Unidades)', 'Total Unid. Base']],
            body: consolidatedRows,
            theme: 'grid',
            headStyles: { fillColor: [150, 0, 0] },
            styles: { fontSize: 8, fontStyle: 'bold' }
         });
         finalY = (doc as any).lastAutoTable.finalY + 15;

         doc.setFontSize(10);
         doc.setFont("helvetica", "bold");
         doc.text("Detalle de Retorno por Documento", 15, finalY);

         autoTable(doc, {
            startY: finalY + 5,
            head: [['Producto', 'Documento Origen', 'Cant. Retornada', 'Valor (S/)']],
            body: returnEntriesForPdf,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 0.8 }
         });
         finalY = (doc as any).lastAutoTable.finalY + 15;
      } else {
         doc.setFontSize(8);
         doc.setFont("helvetica", "normal");
         doc.text("No hubo devoluciones físicas de mercadería en esta liquidación.", 15, finalY);
         finalY += 15;
      }

      // Check page break for signatures
      if (finalY > 250) {
         doc.addPage();
         finalY = 40;
      }

      // Signatures
      doc.setDrawColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.line(30, finalY, 80, finalY);
      doc.text("Firma Almacén (Recepción Kardex)", 55, finalY + 5, { align: 'center' });

      doc.line(130, finalY, 180, finalY);
      doc.text("Firma de " + (responsiblePerson || "Responsable de Liquidar"), 155, finalY + 5, { align: 'center' });

      // Open Blob
      const pdfBlob = doc.output('bloburl');
      window.open(pdfBlob, '_blank');
   };

   const handleRequestFinalize = () => {
      if (!selectedDispatch) { alert("Error: No hay despacho seleccionado."); return; }
      if (Object.keys(processedDocs).length === 0) { alert("Error: No hay documentos procesados."); return; }
      setActiveModal('CONFIRM_FINALIZE');
   };

   const executeFinalize = () => {
      try {
         const docsArray: LiquidationDocument[] = Object.values(processedDocs);

         // 3. Construct Payload
         const liquidationId = generateUUID();
         const liquidation: DispatchLiquidation = {
            id: liquidationId,
            dispatch_sheet_id: selectedDispatch!.id,
            date: new Date().toISOString(),
            total_cash_collected: Number(totals.cash.toFixed(2)),
            total_credit_receivable: Number(totals.credit.toFixed(2)),
            total_voided: Number(totals.voided.toFixed(2)),
            total_returns_value: Number(totals.returns.toFixed(2)),
            documents: docsArray
         };

         // 4. Execute Store Action
         console.log("Processing Liquidation:", liquidation);
         store.processDispatchLiquidation(liquidation);

         // 5. Reset UI
         setActiveModal('NONE');
         alert("¡Liquidación procesada con éxito! Se han generado los movimientos de caja y retorno de kardex.");
         setSelectedDispatch(null);
         setProcessedDocs({});
         setExtraSaleIds([]);
         setCashDelivered(0);
         setCurrentStep('LIST');
         setActiveTab('HISTORY');

      } catch (error) {
         console.error("Liquidation Error:", error);
         alert("Ocurrió un error crítico al procesar la liquidación. Por favor contacte soporte.");
      }
   };

   const handleRevertLiquidation = (liqId: string) => {
      if (!window.confirm("¿Está seguro de revertir esta liquidación? Esto eliminará el movimiento de caja y reactivará la Hoja de Ruta. Las devoluciones físicas no se desharán.")) return;

      const res = store.revertDispatchLiquidation(liqId, 'ADMIN');
      if (res.success) {
         alert(res.msg);
         // Auto-load the reverted dispatch to continue editing
         const liq = store.dispatchLiquidations.find(l => l.id === liqId);
         if (liq) {
            const ds = store.dispatchSheets.find(d => d.id === liq.dispatch_sheet_id);
            if (ds) {
               startLiquidation(ds);
               setActiveTab('PENDING');
            }
         }
      } else {
         alert(res.msg);
      }
   };

   // --- RENDERS ---

   if (currentStep === 'LIST') {
      return (
         <div className="h-full flex flex-col bg-slate-100">
            {/* Headers & Tabs */}
            <div className="bg-white p-4 border-b border-slate-200">
               <h1 className="text-2xl font-bold text-slate-800 flex items-center mb-4">
                  <ListChecks className="mr-2 text-blue-600" />
                  Módulo de Liquidación de Rutas
               </h1>
               <div className="flex border-b border-slate-200">
                  <button
                     onClick={() => setActiveTab('PENDING')}
                     className={`px-4 py-2 font-bold ${activeTab === 'PENDING' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                     Rutas Pendientes ({pendingDispatches.length})
                  </button>
                  <button
                     onClick={() => setActiveTab('HISTORY')}
                     className={`px-4 py-2 font-bold ${activeTab === 'HISTORY' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                     Historial de Liquidaciones
                  </button>
               </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
               {activeTab === 'PENDING' && (
                  <>
                     {pendingDispatches.length === 0 ? (
                        <div className="bg-white p-8 rounded-lg text-center text-slate-500 shadow-sm border border-slate-200 flex flex-col items-center">
                           <CheckCircle className="w-12 h-12 text-green-400 mb-2" />
                           <p>No hay rutas pendientes de liquidar.</p>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {pendingDispatches.map(ds => (
                              <div key={ds.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex flex-col hover:shadow-md transition-shadow">
                                 <div className="flex justify-between items-start border-b border-slate-100 pb-2 mb-2">
                                    <div className="font-bold text-lg text-slate-800">{ds.code}</div>
                                    <div className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-bold uppercase">PENDIENTE</div>
                                 </div>
                                 <div className="space-y-1 mb-4 flex-1">
                                    <div className="text-sm flex items-center text-slate-600"><Calendar className="w-4 h-4 mr-2" /> {new Date(ds.date).toLocaleDateString()}</div>
                                    <div className="text-sm flex items-center text-slate-600"><FileText className="w-4 h-4 mr-2" /> {ds.sale_ids.length} documentos asignados</div>
                                 </div>
                                 <button
                                    onClick={() => startLiquidation(ds)}
                                    className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 shadow flex justify-center items-center"
                                 >
                                    Comenzar Liquidación <ArrowRight className="w-4 h-4 ml-2" />
                                 </button>
                              </div>
                           ))}
                        </div>
                     )}
                  </>
               )}

               {activeTab === 'HISTORY' && (
                  <>
                     {liquidatedDispatches.length === 0 ? (
                        <div className="bg-white p-8 rounded-lg text-center text-slate-500 shadow-sm border border-slate-200">
                           <p>No hay registro de liquidaciones pasadas.</p>
                        </div>
                     ) : (
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                           <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                 <tr>
                                    <th className="p-3">Código Liquidación</th>
                                    <th className="p-3">Hoja de Ruta</th>
                                    <th className="p-3">Fecha</th>
                                    <th className="p-3 text-right">Monto Caja (S/)</th>
                                    <th className="p-3 text-center">Acciones</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {liquidatedDispatches.map(liq => (
                                    <tr key={liq.id} className="hover:bg-slate-50">
                                       <td className="p-3 font-bold text-slate-800">{liq.id}</td>
                                       <td className="p-3 text-slate-600">{store.dispatchSheets.find(ds => ds.id === liq.dispatch_sheet_id)?.code || 'N/A'}</td>
                                       <td className="p-3 text-slate-600">{new Date(liq.date).toLocaleString()}</td>
                                       <td className="p-3 text-right font-bold text-green-700">{liq.total_cash_collected.toFixed(2)}</td>
                                       <td className="p-3 text-center">
                                          <button
                                             onClick={() => handleRevertLiquidation(liq.id)}
                                             title="Revertir Liquidación (Admin)"
                                             className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded mr-2 transition-colors"
                                          >
                                             <RotateCcw className="w-4 h-4" />
                                          </button>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     )}
                  </>
               )}
            </div>
         </div>
      );
   }

   if (currentStep === 'PROCESS') {
      return (
         <div className="h-full flex flex-col bg-slate-100 relative">
            {/* Header */}
            <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center shadow-sm">
               <div>
                  <h2 className="text-xl font-bold text-slate-800">Procesando: {selectedDispatch?.code}</h2>
                  <p className="text-sm text-slate-500">{dispatchSales.length} documentos asignados</p>
               </div>
               <div className="flex gap-2">
                  <button
                     onClick={() => { setExtraDocSearch(''); setActiveModal('ADD_EXTRA'); }}
                     className="bg-slate-100 text-slate-700 px-4 py-2 border border-slate-300 rounded font-bold shadow-sm hover:bg-slate-200 flex items-center"
                  >
                     <Plus className="w-4 h-4 mr-2" /> Agregar Documento
                  </button>
                  <button onClick={() => setCurrentStep('SUMMARY')} className="bg-green-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-green-700 flex items-center">
                     Siguiente: Resumen <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
               </div>
            </div>

            <div className="flex-1 overflow-auto p-2 space-y-2">
               {dispatchSales.map(sale => {
                  const status = processedDocs[sale.id];
                  if (!status) return null; // Safety check

                  return (
                     <div key={sale.id} className={`bg-white p-2.5 rounded-lg shadow-sm border-l-4 flex flex-col gap-1.5 ${status.action === 'PAID' ? 'border-green-500' :
                        status.action === 'CREDIT' ? 'border-blue-500' :
                           status.action === 'VOID' ? 'border-red-500' : 'border-orange-500'
                        }`}>
                        {/* Top Row: Info */}
                        <div className="flex justify-between items-start">
                           <div>
                              <div className="font-bold text-slate-800 text-base flex items-center gap-2 leading-tight">
                                 {sale.client_name}
                                 {extraSaleIds.includes(sale.id) && (
                                    <span className="text-[9px] bg-blue-100 text-blue-800 px-1 py-0.5 rounded uppercase">AGREGADO MANUALMENTE</span>
                                 )}
                              </div>
                              <div className="text-slate-500 text-xs font-mono flex items-center gap-2 mt-0.5">
                                 {sale.document_type} {sale.series}-{sale.number}
                                 {status.action !== 'VOID' && status.action !== 'PAID' && (
                                    <button
                                       onClick={() => openChangeTypeModal(sale.id)}
                                       className="text-[10px] text-blue-600 hover:underline flex items-center ml-1"
                                    >
                                       Cambiar Tipo
                                    </button>
                                 )}
                              </div>
                           </div>
                           <div className="text-right">
                              <div className="font-bold text-lg text-slate-900 leading-tight">S/ {sale.total.toFixed(2)}</div>
                              <div className="text-[10px] font-bold text-slate-400">{sale.payment_method}</div>
                           </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-1.5 bg-slate-50 p-1.5 rounded justify-between items-center flex-wrap mt-0.5">
                           <div className="flex gap-1.5">
                              <button
                                 onClick={() => handleQuickAction(sale, 'PAID')}
                                 className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center border transition-all ${status.action === 'PAID' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-green-50'}`}
                              >
                                 <DollarSign className="w-3 h-3 mr-1" /> COBRADO
                              </button>
                              <button
                                 onClick={() => handleQuickAction(sale, 'CREDIT')}
                                 className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center border transition-all ${status.action === 'CREDIT' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-blue-50'}`}
                              >
                                 <CreditCard className="w-3 h-3 mr-1" /> CRÉDITO
                              </button>
                           </div>
                           <div className="flex gap-1.5">
                              <button
                                 onClick={() => openPartialModal(sale.id)}
                                 className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center border transition-all ${status.action === 'PARTIAL_RETURN' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-300 hover:bg-orange-50'}`}
                              >
                                 <AlertTriangle className="w-3 h-3 mr-1" /> PARCIAL (NC)
                              </button>
                              <button
                                 onClick={() => openVoidModal(sale.id)}
                                 className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center border transition-all ${status.action === 'VOID' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-red-50'}`}
                              >
                                 <Ban className="w-3 h-3 mr-1" /> ANULAR
                              </button>
                           </div>
                        </div>

                        {/* Contextual Status Info */}
                        {status.action === 'PARTIAL_RETURN' && (
                           <div className="text-xs bg-orange-50 text-orange-900 p-2 rounded border border-orange-200 flex justify-between items-center">
                              <span>
                                 <span className="font-bold block text-red-600">Devolución (NC): S/ {status.amount_credit_note.toFixed(2)}</span>
                                 <span className="text-[10px] text-slate-500">{status.credit_note_series}</span>
                              </span>
                              <span className="text-right">
                                 <span className="font-bold block">Saldo {status.balance_payment_method}:</span>
                                 <span className="text-lg font-bold">S/ {(status.amount_collected + status.amount_credit).toFixed(2)}</span>
                              </span>
                           </div>
                        )}
                        {status.action === 'VOID' && (
                           <div className="text-xs bg-red-50 text-red-900 p-2 rounded border border-red-200">
                              <span className="font-bold">ANULADO - Motivo:</span> {status.reason}
                           </div>
                        )}

                        {/* MOBILE DELIVERY EVIDENCE */}
                        {(sale.delivery_reason || sale.delivery_photo || sale.delivery_location) && (
                           <div className="text-xs bg-blue-50/50 p-2 rounded border border-blue-100 mt-1">
                              <div className="font-bold text-blue-900 mb-1 flex items-center">
                                 <FileText className="w-3 h-3 mr-1" /> Evidencia de Reparto Móvil ({sale.dispatch_status.toUpperCase()})
                              </div>
                              {sale.delivery_reason && (
                                 <p className="text-slate-700 italic border-l-2 border-blue-300 pl-2 mb-2">"{sale.delivery_reason}"</p>
                              )}
                              <div className="flex gap-2">
                                 {sale.delivery_photo && (
                                    <button
                                       onClick={() => { setPhotoTargetUrl(sale.delivery_photo || null); setActiveModal('PHOTO'); }}
                                       className="bg-white border border-slate-300 px-2 py-1 rounded shadow-sm text-slate-700 flex items-center hover:bg-slate-50 transition-colors"
                                    >
                                       <ImageIcon className="w-3 h-3 mr-1 text-blue-500" /> Ver Foto Adjunta
                                    </button>
                                 )}
                                 {sale.delivery_location && (
                                    <a
                                       href={`https://www.google.com/maps/search/?api=1&query=${sale.delivery_location.lat},${sale.delivery_location.lng}`}
                                       target="_blank"
                                       rel="noreferrer"
                                       className="bg-white border border-slate-300 px-2 py-1 rounded shadow-sm text-slate-700 flex items-center hover:bg-slate-50 transition-colors"
                                    >
                                       <MapPin className="w-3 h-3 mr-1 text-red-500" /> Ver Mapa GPS
                                    </a>
                                 )}
                              </div>
                           </div>
                        )}
                     </div>
                  );
               })}
            </div>
            {/* --- MODAL: VOID CONFIRMATION --- */}
            {activeModal === 'VOID' && (
               <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-md rounded-lg shadow-2xl p-6 border-t-4 border-red-600 animate-fade-in-up">
                     <div className="text-center mb-4">
                        <ShieldAlert className="w-12 h-12 text-red-600 mx-auto mb-2" />
                        <h3 className="text-xl font-bold text-slate-800">Confirmar Anulación</h3>
                        <p className="text-sm text-slate-500">Esta acción anulará el documento completo y retornará todo el stock al Kardex. Es irreversible.</p>
                     </div>
                     <div className="bg-red-50 p-3 rounded mb-4 border border-red-200 text-sm text-red-800 flex items-start">
                        <AlertTriangle className="w-5 h-5 mr-2 shrink-0" />
                        <p><strong>ATENCIÓN:</strong> Para proceder, ingrese un motivo válido y escriba la palabra <strong>ANULAR</strong> para confirmar su intención.</p>
                     </div>
                     <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Motivo de Anulación</label>
                        <textarea
                           className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                           rows={2}
                           placeholder="Ingrese el motivo..."
                           value={voidReason}
                           onChange={e => setVoidReason(e.target.value)}
                        ></textarea>
                     </div>
                     <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Escriba ANULAR</label>
                        <input
                           type="text"
                           className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-red-500 outline-none uppercase font-bold"
                           placeholder="ANULAR"
                           onChange={e => {
                              // we evaluate if the button can be clicked based on this in UI
                              e.target.dataset.confirm = e.target.value.toUpperCase();
                           }}
                           id="voidConfirmInput"
                        />
                     </div>
                     <div className="flex gap-2 justify-end">
                        <button onClick={() => setActiveModal('NONE')} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded">Cancelar</button>
                        <button
                           onClick={() => {
                              const input = document.getElementById('voidConfirmInput') as HTMLInputElement;
                              if (input?.value.toUpperCase() !== 'ANULAR') {
                                 alert("Debe escribir la palabra ANULAR para confirmar.");
                                 return;
                              }
                              confirmVoid();
                           }}
                           className="px-6 py-2 bg-red-600 text-white font-bold rounded shadow hover:bg-red-700"
                        >
                           Confirmar Anulación
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {/* --- MODAL: PARTIAL / NC --- */}
            {activeModal === 'PARTIAL' && targetSaleId && (
               <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-5xl rounded-lg shadow-2xl flex flex-col max-h-[90vh] border-t-4 border-indigo-500 animate-fade-in-up">
                     {/* Header */}
                     <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-indigo-50/50">
                        <div className="flex items-center text-indigo-800 font-bold text-xl">
                           <FileText className="mr-3 w-6 h-6 text-indigo-600" />
                           Notas de Crédito y Devoluciones
                        </div>
                        <button onClick={() => setActiveModal('NONE')}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                     </div>

                     {/* Details Header */}
                     {(() => {
                        const sale = dispatchSales.find(s => s.id === targetSaleId);
                        if (!sale) return null;
                        return (
                           <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-4">
                              <div>
                                 <div className="text-[10px] font-bold text-slate-500 uppercase">Documento Origen</div>
                                 <div className="font-bold text-slate-800">{sale.document_type} {sale.series}-{sale.number}</div>
                              </div>
                              <div>
                                 <div className="text-[10px] font-bold text-slate-500 uppercase">Cliente</div>
                                 <div className="font-bold text-slate-800">{sale.client_ruc} - {sale.client_name}</div>
                              </div>
                              <div className="text-right">
                                 <div className="text-[10px] font-bold text-slate-500 uppercase">Monto Total Facturado</div>
                                 <div className="font-bold text-xl text-slate-900">S/ {sale.total.toFixed(2)}</div>
                              </div>
                           </div>
                        );
                     })()}

                     <div className="flex-1 overflow-auto p-0">
                        <table className="w-full text-sm text-left border-collapse">
                           <thead className="bg-white border-b-2 border-slate-100 text-slate-500 font-bold text-[11px] sticky top-0 z-10">
                              <tr>
                                 <th className="p-4 uppercase">Producto Facturado</th>
                                 <th className="p-4 uppercase text-center w-24">Cant. Original</th>
                                 <th className="p-4 uppercase text-right w-24">Precio Unit.</th>
                                 <th className="p-4 uppercase text-center w-64 bg-slate-50 border-x border-slate-100">CANT. DEVOLVER</th>
                                 <th className="p-4 uppercase text-right w-32">Subtotal Dev.</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {dispatchSales.find(s => s.id === targetSaleId)?.items.map((item, idx) => {
                                 const itemKey = `${item.id}_${item.is_bonus ? 'bonus' : 'regular'}_${idx}`;
                                 const entries = returnEntries[itemKey] || { boxes: 0, units: 0 };
                                 const product = store.products.find(p => p.id === item.product_id);
                                 const factor = product?.package_content || 1;

                                 // Calculate Refund Preview
                                 const returnedBase = (entries.boxes * factor) + entries.units;
                                 const refundRatio = returnedBase / item.quantity_base;
                                 const refundAmt = item.total_price * refundRatio;

                                 return (
                                    <tr key={itemKey} className={`hover:bg-slate-50 transition-colors ${returnedBase > 0 ? 'bg-indigo-50/30' : ''}`}>
                                       <td className="p-4">
                                          <div className="font-bold text-slate-800 capitalize">{item.product_name.toLowerCase()}</div>
                                          <div className="text-[11px] text-slate-400 mt-1">{product?.sku || 'SKU'} <span className="mx-1">|</span> Factor: {factor} unds/caja</div>
                                       </td>
                                       <td className="p-4 text-center font-bold text-slate-700">
                                          {item.quantity_presentation} <span className="text-[10px] text-slate-400 font-normal">{item.selected_unit}</span>
                                       </td>
                                       <td className="p-4 text-right text-slate-600">
                                          S/ {item.unit_price.toFixed(2)}
                                       </td>

                                       <td className="p-4 bg-slate-50 border-x border-slate-100">
                                          <div className="flex flex-col gap-2">
                                             {!item.is_bonus && (
                                                <div className="flex items-center gap-1">
                                                   <input
                                                      type="number"
                                                      min="0"
                                                      className="w-16 border border-indigo-200 rounded p-1.5 text-center font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                      value={entries.boxes}
                                                      onChange={e => handleReturnChange(itemKey, 'boxes', parseInt(e.target.value) || 0)}
                                                   />
                                                   <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1.5 rounded border border-indigo-100 font-bold w-12 text-center">CJA</span>
                                                </div>
                                             )}
                                             <div className="flex items-center gap-1">
                                                <input
                                                   type="number"
                                                   min="0"
                                                   className="w-16 border border-indigo-200 rounded p-1.5 text-center font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                   value={entries.units}
                                                   onChange={e => handleReturnChange(itemKey, 'units', parseInt(e.target.value) || 0)}
                                                />
                                                <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1.5 rounded border border-indigo-100 font-bold w-12 text-center">UND</span>
                                             </div>
                                          </div>
                                       </td>
                                       <td className="p-4 text-right font-bold text-slate-900">
                                          S/ {refundAmt.toFixed(2)}
                                       </td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     </div>

                     <div className="p-4 bg-indigo-50/50 border-t border-indigo-100 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                           <ShieldAlert className="w-5 h-5 text-indigo-400" />
                           <p className="text-xs text-indigo-700 max-w-sm">
                              La nota de crédito afectará el saldo del comprobante y devolverá el stock disponible al Kardex inmediatamente.
                           </p>
                        </div>

                        <div className="flex items-center gap-6">
                           <div className="text-right">
                              <div className="text-[10px] font-bold text-indigo-500 uppercase">Destino Saldo</div>
                              <select
                                 className="mt-1 text-sm font-bold border border-indigo-200 rounded p-1 focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900"
                                 value={partialBalanceType}
                                 onChange={(e) => setPartialBalanceType(e.target.value as 'CONTADO' | 'CREDITO')}
                              >
                                 <option value="CONTADO">Cobrar Efectivo</option>
                                 <option value="CREDITO">Mantener Crédito</option>
                              </select>
                           </div>

                           <div className="text-right px-4 border-l border-indigo-200">
                              <div className="text-[10px] font-bold text-indigo-500 uppercase">Monto a Devolver (Inc. IGV)</div>
                              {(() => {
                                 let refund = 0;
                                 dispatchSales.find(s => s.id === targetSaleId)?.items.forEach((item, idx) => {
                                    const itemKey = `${item.id}_${item.is_bonus ? 'bonus' : 'regular'}_${idx}`;
                                    const entries = returnEntries[itemKey] || { boxes: 0, units: 0 };
                                    const factor = store.products.find(p => p.id === item.product_id)?.package_content || 1;
                                    const retBase = (entries.boxes * factor) + entries.units;
                                    refund += (retBase / item.quantity_base) * item.total_price;
                                 });
                                 return <div className="font-bold text-2xl text-indigo-600">S/ {refund.toFixed(2)}</div>;
                              })()}
                           </div>

                           <button onClick={confirmPartial} className="px-6 py-3 bg-indigo-400 text-white font-bold rounded shadow hover:bg-indigo-500 flex items-center transition-colors">
                              <FileText className="w-4 h-4 mr-2" /> GENERAR NOTA DE CRÉDITO
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* --- MODAL: ADD EXTRA DOCUMENT --- */}
            {activeModal === 'ADD_EXTRA' && (
               <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-lg rounded-lg shadow-2xl p-6 animate-fade-in-up">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center"><Plus className="mr-2" /> Agregar Documento a Hoja</h3>
                        <button onClick={() => setActiveModal('NONE')}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                     </div>
                     <p className="text-sm text-slate-600 mb-4">Busque un documento por RUC, Nombre o Número de Documento que desee liquidar en esta planilla.</p>

                     <div className="mb-4">
                        <div className="relative">
                           <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                           <input
                              autoFocus
                              type="text"
                              placeholder="Buscar factura o boleta..."
                              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              value={extraDocSearch}
                              onChange={(e) => setExtraDocSearch(e.target.value)}
                           />
                        </div>
                     </div>

                     <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg shadow-inner bg-slate-50">
                        {store.sales
                           .filter(s => s.status !== 'canceled' && s.dispatch_status !== 'liquidated' && !dispatchSales.find(ds => ds.id === s.id))
                           .filter(s => s.client_name.toLowerCase().includes(extraDocSearch.toLowerCase()) ||
                              s.client_ruc.includes(extraDocSearch) ||
                              s.number.includes(extraDocSearch))
                           .slice(0, 10)
                           .map(sale => (
                              <div key={sale.id} className="p-3 border-b border-slate-200 last:border-0 hover:bg-blue-50 flex justify-between items-center transition-colors">
                                 <div>
                                    <div className="font-bold text-sm text-slate-800">{sale.client_name}</div>
                                    <div className="text-xs text-slate-500 font-mono">{sale.document_type} {sale.series}-{sale.number} • <span className="text-slate-700 font-bold">S/ {sale.total.toFixed(2)}</span></div>
                                 </div>
                                 <button
                                    onClick={() => handleAddExtraDocument(sale.id)}
                                    className="bg-slate-200 hover:bg-blue-600 hover:text-white text-slate-700 px-3 py-1 rounded text-xs font-bold transition-colors"
                                 >
                                    Agregar
                                 </button>
                              </div>
                           ))}
                        {extraDocSearch && store.sales.filter(s => s.status !== 'canceled' && s.dispatch_status !== 'liquidated' && !dispatchSales.find(ds => ds.id === s.id)).filter(s => s.client_name.toLowerCase().includes(extraDocSearch.toLowerCase()) || s.client_ruc.includes(extraDocSearch) || s.number.includes(extraDocSearch)).length === 0 && (
                           <div className="p-4 text-center text-slate-500 text-sm">No se encontraron documentos disponibles.</div>
                        )}
                     </div>
                  </div>
               </div>
            )}

            {/* --- MODAL: CHANGE DOCUMENT TYPE --- */}
            {activeModal === 'CHANGE_TYPE' && targetSaleId && (
               <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-sm rounded-lg shadow-2xl p-6 border-t-4 border-blue-500 animate-fade-in-up">
                     <h3 className="text-lg font-bold text-slate-800 mb-2">Cambiar Tipo de Documento</h3>
                     {(() => {
                        const sale = store.sales.find(s => s.id === targetSaleId);
                        if (!sale) return null;
                        return (
                           <>
                              <p className="text-sm text-slate-600 mb-4">
                                 ¿Está seguro que desea cambiar el documento actual <strong>({sale.document_type} {sale.series}-{sale.number})</strong> a <strong>{newDocType}</strong>?
                                 Esta acción generará un nuevo correlativo.
                              </p>
                              <div className="flex gap-2 justify-end mt-6">
                                 <button onClick={() => setActiveModal('NONE')} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded">Cancelar</button>
                                 <button onClick={confirmChangeType} className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700">Confirmar</button>
                              </div>
                           </>
                        );
                     })()}
                  </div>
               </div>
            )}

            {/* --- MODAL: PHOTO VIEWER --- */}
            {activeModal === 'PHOTO' && photoTargetUrl && (
               <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setActiveModal('NONE')}>
                  <div className="relative w-full max-w-3xl flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                     <button
                        onClick={() => setActiveModal('NONE')}
                        className="absolute -top-12 right-0 text-white hover:text-red-400 bg-black/50 p-2 rounded-full transition-colors font-bold flex items-center"
                     >
                        <X className="w-6 h-6 mr-1" /> Cerrar
                     </button>
                     <img
                        src={photoTargetUrl}
                        alt="Evidencia"
                        className="max-h-[85vh] max-w-full rounded-lg shadow-2xl border-4 border-white/20 object-contain bg-black"
                     />
                     <div className="mt-4 bg-black/60 text-white px-4 py-2 rounded-lg text-sm flex items-center backdrop-blur text-center">
                        <Camera className="w-4 h-4 mr-2 text-blue-400" />
                        Imagen capturada por el repartidor desde la App Móvil
                     </div>
                  </div>
               </div>
            )}
         </div>
      );
   }

   if (currentStep === 'SUMMARY') {
      // --- PRINTABLE REPORTS VIEW ---
      const voidCount = Object.values(processedDocs).filter((d: LiquidationDocument) => d.action === 'VOID').length;
      const ncCount = Object.values(processedDocs).filter((d: LiquidationDocument) => d.action === 'PARTIAL_RETURN').length;

      return (
         <div className="h-full flex flex-col bg-slate-100 p-4">
            <div className="bg-white rounded-lg shadow-lg flex-1 flex flex-col overflow-hidden max-w-5xl mx-auto w-full border border-slate-200 relative">

               {/* --- CONFIRMATION MODAL --- */}
               {activeModal === 'CONFIRM_FINALIZE' && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                     <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-slate-300 animate-fade-in-up">
                        <div className="bg-slate-900 p-4 text-white">
                           <h3 className="text-lg font-bold flex items-center"><HelpCircle className="mr-2 text-accent" /> Confirmar Liquidación</h3>
                        </div>
                        <div className="p-6 space-y-4">
                           <p className="text-slate-600 text-sm">Está a punto de cerrar la Hoja de Ruta <strong>{selectedDispatch?.code}</strong>. Verifique los montos finales:</p>
                           <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-2 text-sm">
                              <div className="flex justify-between font-bold text-green-700 border-b border-slate-200 pb-2">
                                 <span>Efectivo a Caja (Teórico):</span>
                                 <span>S/ {totals.cash.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-blue-800 border-b border-slate-200 pb-2">
                                 <span>Entregado (Físico + Yape + Voucher):</span>
                                 <span>S/ {totalDelivered.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-blue-700 mt-2">
                                 <span>Créditos (Deuda):</span>
                                 <span>S/ {totals.credit.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-red-600">
                                 <span>Anulaciones/NC:</span>
                                 <span>S/ {(totals.voided + totals.returns).toFixed(2)}</span>
                              </div>
                           </div>
                           {totalDelivered !== totals.cash && (
                              <div className={`text-sm p-3 rounded font-bold border flex items-center ${totalDelivered > totals.cash ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                                 {totalDelivered > totals.cash ? (
                                    <span>⚠️ Sobrante de Caja: S/ {(totalDelivered - totals.cash).toFixed(2)}</span>
                                 ) : (
                                    <span>⚠️ Faltante de Caja: S/ {(totals.cash - totalDelivered).toFixed(2)}</span>
                                 )}
                              </div>
                           )}
                           <div className="text-xs text-slate-400 italic text-center">
                              * Esta acción es irreversible y actualizará el Kardex. El movimiento de caja se generará por el monto TEÓRICO: S/ {totals.cash.toFixed(2)}.
                           </div>
                        </div>
                        <div className="p-4 bg-slate-100 flex justify-end gap-3 border-t border-slate-200">
                           <button onClick={() => setActiveModal('NONE')} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded">Volver</button>
                           <button onClick={executeFinalize} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow flex items-center">
                              <CheckCircle className="w-4 h-4 mr-2" /> Confirmar y Cerrar
                           </button>
                        </div>
                     </div>
                  </div>
               )}

               {/* Toolbar */}
               <div className="p-4 border-b border-slate-200 bg-slate-800 text-white rounded-t-lg print:hidden">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h2 className="font-bold text-xl">Resumen de Liquidación</h2>
                        <p className="text-xs text-slate-400">Revise los totales antes de enviar a caja y elabore el reporte.</p>
                     </div>
                     <div className="flex gap-4 items-center">
                        <button onClick={generateLiquidationPDF} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold flex items-center border border-blue-400">
                           <Printer className="w-4 h-4 mr-2" /> Imprimir Reporte
                        </button>
                        <button onClick={handleRequestFinalize} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold flex items-center shadow-lg animate-pulse border border-green-400">
                           <CheckCircle className="w-4 h-4 mr-2" /> Finalizar y Procesar
                        </button>
                     </div>
                  </div>

                  {/* Payment Inputs Area */}
                  <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600 flex flex-wrap gap-4 items-end">
                     <div className="flex-1 min-w-[200px]">
                        <label className="block text-[11px] text-slate-300 mb-1 uppercase font-bold">Responsable de Liquidar</label>
                        <div className="relative">
                           <User className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                           <input
                              type="text"
                              className="w-full pl-8 pr-3 py-1.5 text-black rounded text-sm font-bold focus:ring-2 focus:ring-blue-500"
                              placeholder="Nombre/Firma"
                              value={responsiblePerson}
                              onChange={(e) => setResponsiblePerson(e.target.value)}
                           />
                        </div>
                     </div>
                     <div className="w-32">
                        <label className="block text-[11px] text-slate-300 mb-1 uppercase font-bold whitespace-nowrap">Efectivo Físico</label>
                        <div className="relative">
                           <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-sm">S/</span>
                           <input
                              type="number"
                              min="0" step="0.10"
                              className="w-full pl-6 pr-2 py-1.5 text-black rounded text-sm font-bold focus:ring-2 focus:ring-green-500 flex-1 border-b-2 border-green-500"
                              value={cashDelivered}
                              onChange={(e) => setCashDelivered(parseFloat(e.target.value) || 0)}
                           />
                        </div>
                     </div>
                     <div className="w-32">
                        <label className="block text-[11px] text-slate-300 mb-1 uppercase font-bold whitespace-nowrap text-[#6F00FF]">Yape / Plin</label>
                        <div className="relative">
                           <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-sm">S/</span>
                           <input
                              type="number"
                              min="0" step="0.10"
                              className="w-full pl-6 pr-2 py-1.5 text-black rounded text-sm font-bold focus:ring-2 focus:ring-[#6F00FF] flex-1 border-b-2 border-[#6F00FF]"
                              value={yapeDelivered}
                              onChange={(e) => setYapeDelivered(parseFloat(e.target.value) || 0)}
                           />
                        </div>
                     </div>
                     <div className="w-32">
                        <label className="block text-[11px] text-slate-300 mb-1 uppercase font-bold whitespace-nowrap text-orange-400">Vouchers / Dep.</label>
                        <div className="relative">
                           <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-sm">S/</span>
                           <input
                              type="number"
                              min="0" step="0.10"
                              className="w-full pl-6 pr-2 py-1.5 text-black rounded text-sm font-bold focus:ring-2 focus:ring-orange-500 flex-1 border-b-2 border-orange-500"
                              value={voucherDelivered}
                              onChange={(e) => setVoucherDelivered(parseFloat(e.target.value) || 0)}
                           />
                        </div>
                     </div>
                     <div className="bg-slate-900 border border-slate-600 px-4 py-1.5 rounded flex items-center gap-3">
                        <span className="text-[11px] text-slate-400 uppercase font-bold leading-tight">Total<br />Rendido</span>
                        <span className="text-xl font-bold text-white">S/ {totalDelivered.toFixed(2)}</span>
                     </div>
                  </div>
               </div>

               {/* REPORT CONTENT (Printable) */}
               <div className="flex-1 overflow-auto p-8 bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>

                  {/* 1. LIQUIDATION SUMMARY */}
                  <div className="mb-8 border-b pb-8">
                     <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold uppercase text-black">Liquidación de Despacho: {selectedDispatch?.code}</h1>
                        <p className="text-sm text-slate-600">Fecha: {new Date().toLocaleString()}</p>
                     </div>

                     <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="p-4 bg-green-50 border border-green-200 rounded text-center">
                           <div className="text-xs font-bold text-green-800 uppercase">Total Efectivo (Caja)</div>
                           <div className="text-2xl font-bold text-green-700">S/ {totals.cash.toFixed(2)}</div>
                        </div>
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded text-center">
                           <div className="text-xs font-bold text-blue-800 uppercase">Ctas por Cobrar (Créditos)</div>
                           <div className="text-2xl font-bold text-blue-700">S/ {totals.credit.toFixed(2)}</div>
                        </div>
                        <div className="p-4 bg-red-50 border border-red-200 rounded text-center">
                           <div className="text-xs font-bold text-red-800 uppercase">Anulados</div>
                           <div className="text-2xl font-bold text-red-700">S/ {totals.voided.toFixed(2)}</div>
                        </div>
                        <div className="p-4 bg-orange-50 border border-orange-200 rounded text-center">
                           <div className="text-xs font-bold text-orange-800 uppercase">Notas de Crédito</div>
                           <div className="text-2xl font-bold text-orange-700">S/ {totals.returns.toFixed(2)}</div>
                        </div>
                     </div>

                     <h3 className="font-bold border-b border-black mb-2 pb-1">Detalle de Documentos</h3>
                     <table className="w-full text-xs text-left mb-4">
                        <thead>
                           <tr className="border-b border-black">
                              <th className="py-1">Cliente</th>
                              <th className="py-1">Documento</th>
                              <th className="py-1 text-center">Estado Final</th>
                              <th className="py-1 text-right">Efectivo</th>
                              <th className="py-1 text-right">Crédito</th>
                              <th className="py-1 text-right">NC/Anulado</th>
                           </tr>
                        </thead>
                        <tbody>
                           {dispatchSales.map(sale => {
                              const doc = processedDocs[sale.id];
                              return (
                                 <tr key={sale.id} className="border-b border-slate-100">
                                    <td className="py-1">{sale.client_name}</td>
                                    <td className="py-1 font-mono">{sale.document_type.substring(0, 3)} {sale.series}-{sale.number}</td>
                                    <td className="py-1 text-center font-bold">
                                       {doc.action === 'PAID' && 'COBRADO'}
                                       {doc.action === 'CREDIT' && 'CREDITO'}
                                       {doc.action === 'VOID' && 'ANULADO'}
                                       {doc.action === 'PARTIAL_RETURN' && `PARCIAL (Saldo ${doc.balance_payment_method})`}
                                    </td>
                                    <td className="py-1 text-right">{doc.amount_collected > 0 ? doc.amount_collected.toFixed(2) : '-'}</td>
                                    <td className="py-1 text-right">{doc.amount_credit > 0 ? doc.amount_credit.toFixed(2) : '-'}</td>
                                    <td className="py-1 text-right">{(doc.amount_void + doc.amount_credit_note) > 0 ? (doc.amount_void + doc.amount_credit_note).toFixed(2) : '-'}</td>
                                 </tr>
                              );
                           })}
                        </tbody>
                     </table>
                  </div>

                  {/* 2. MERCHANDISE RETURN REPORT (Picking Inverso) */}
                  <div className="break-before-page">
                     <h2 className="text-xl font-bold uppercase text-black mb-4 border-b-2 border-black pb-2">
                        <FileText className="inline w-6 h-6 mr-2" />
                        Reporte de Retorno de Mercadería (Kardex)
                     </h2>
                     <p className="mb-4 text-sm">Certifica el reingreso físico de productos al almacén por anulaciones y notas de crédito de la ruta <strong>{selectedDispatch?.code}</strong>.</p>

                     <table className="w-full text-sm border-collapse border border-black">
                        <thead className="bg-slate-200">
                           <tr>
                              <th className="border border-black p-2">Producto</th>
                              <th className="border border-black p-2">Origen (Doc)</th>
                              <th className="border border-black p-2 text-center">Cant. Retornada</th>
                              <th className="border border-black p-2 text-right">Valor</th>
                           </tr>
                        </thead>
                        <tbody>
                           {Object.values(processedDocs).flatMap((doc: LiquidationDocument) => {
                              // Get Sales Info
                              const sale = dispatchSales.find(s => s.id === doc.sale_id);
                              const items: any[] = [];

                              // If Void, all items returned
                              if (doc.action === 'VOID' && sale) {
                                 sale.items.forEach(i => items.push({ ...i, returnedQty: `${i.quantity_presentation} ${i.selected_unit === 'PKG' ? 'CJA' : 'UND'}`, returnedVal: i.total_price, type: 'ANULACION' }));
                              }
                              // If Partial, specific items
                              if (doc.action === 'PARTIAL_RETURN') {
                                 doc.returned_items.forEach(i => items.push({ ...i, returnedQty: `${i.quantity_base} (Base)`, returnedVal: i.total_refund, type: `NC: ${doc.credit_note_series}` }));
                              }

                              return items.map((item, idx) => (
                                 <tr key={`${doc.sale_id}-${idx}`}>
                                    <td className="border border-black p-2">{item.product_name}</td>
                                    <td className="border border-black p-2 text-xs">
                                       {sale?.series}-{sale?.number} ({item.type})
                                    </td>
                                    <td className="border border-black p-2 text-center font-bold">
                                       {item.returnedQty}
                                    </td>
                                    <td className="border border-black p-2 text-right">
                                       S/ {item.returnedVal.toFixed(2)}
                                    </td>
                                 </tr>
                              ));
                           })}
                           {totals.voided === 0 && totals.returns === 0 && (
                              <tr><td colSpan={4} className="p-4 text-center italic">No hubo devoluciones de mercadería.</td></tr>
                           )}
                        </tbody>
                     </table>

                     <div className="mt-12 flex justify-between px-8">
                        <div className="border-t border-black w-40 text-center text-xs pt-1">Firma Almacén (Recibido)</div>
                        <div className="border-t border-black w-40 text-center text-xs pt-1">Firma Transportista (Entregado)</div>
                     </div>
                  </div>

               </div>
            </div>

            <style>{`
              @media print {
                 @page { size: A4; margin: 10mm; }
                 body * { visibility: hidden; }
                 .print\\:hidden { display: none !important; }
                 .bg-white, .bg-white * { visibility: visible; }
                 .break-before-page { page-break-before: always; }
              }
           `}</style>
         </div>
      );
   }

   return <div>Estado Desconocido</div>;
};
