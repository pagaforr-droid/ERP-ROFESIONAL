
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { DispatchSheet, Sale, LiquidationDocument, DispatchLiquidation } from '../types';
import { Search, CheckCircle, AlertTriangle, ArrowRight, Printer, XCircle, FileText, Ban, DollarSign, CreditCard, ShieldAlert, Save, Package, HelpCircle } from 'lucide-react';

type Step = 'SEARCH' | 'PROCESS' | 'SUMMARY';

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
   const [currentStep, setCurrentStep] = useState<Step>('SEARCH');

   // Search State
   const [searchCode, setSearchCode] = useState('');
   const [selectedDispatch, setSelectedDispatch] = useState<DispatchSheet | null>(null);

   // Processing State
   const [processedDocs, setProcessedDocs] = useState<Record<string, LiquidationDocument>>({});

   // --- MODALS STATE ---
   const [activeModal, setActiveModal] = useState<'NONE' | 'VOID' | 'PARTIAL' | 'CONFIRM_FINALIZE'>('NONE');
   const [targetSaleId, setTargetSaleId] = useState<string | null>(null);

   // Partial Modal Data: Now tracks Boxes and Units separately
   const [returnEntries, setReturnEntries] = useState<Record<string, ReturnEntry>>({});
   const [partialBalanceType, setPartialBalanceType] = useState<'CONTADO' | 'CREDITO'>('CONTADO');

   // Void Modal Data
   const [voidReason, setVoidReason] = useState('');

   // --- HELPERS ---
   const getSalesForDispatch = () => {
      if (!selectedDispatch) return [];
      return store.sales.filter(s => selectedDispatch.sale_ids.includes(s.id));
   };

   const dispatchSales = useMemo(() => getSalesForDispatch(), [selectedDispatch, store.sales]);

   const handleSearch = () => {
      const code = searchCode.trim().toUpperCase();
      const ds = store.dispatchSheets.find(d => d.code === code || d.code.includes(code));
      if (ds) {
         if (ds.status === 'completed') {
            alert("Esta hoja de ruta ya fue liquidada.");
            return;
         }
         setSelectedDispatch(ds);
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
         setCurrentStep('PROCESS');
      } else {
         alert("Despacho no encontrado. Verifique el código (ej. HR-1234)");
      }
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

   const openPartialModal = (saleId: string) => {
      setTargetSaleId(saleId);
      // Reset entries for this sale
      const initialEntries: Record<string, ReturnEntry> = {};
      const sale = dispatchSales.find(s => s.id === saleId);
      sale?.items.forEach(item => {
         initialEntries[item.id] = { boxes: 0, units: 0 };
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
      for (const item of sale.items) {
         const entry = returnEntries[item.id];
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
         setSearchCode('');
         setSelectedDispatch(null);
         setProcessedDocs({});
         setCurrentStep('SEARCH');

      } catch (error) {
         console.error("Liquidation Error:", error);
         alert("Ocurrió un error crítico al procesar la liquidación. Por favor contacte soporte.");
      }
   };

   // --- RENDERS ---

   if (currentStep === 'SEARCH') {
      return (
         <div className="h-full flex flex-col items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-lg text-center">
               <h2 className="text-2xl font-bold text-slate-800 mb-2">Liquidación de Despachos</h2>
               <p className="text-slate-500 mb-6">Ingrese el código de la Hoja de Ruta para comenzar</p>
               <div className="flex gap-2">
                  <input
                     autoFocus
                     className="flex-1 border border-slate-300 rounded-lg p-3 text-lg font-bold text-center uppercase"
                     placeholder="Ej. HR-1234"
                     value={searchCode}
                     onChange={e => setSearchCode(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                  <button onClick={handleSearch} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700">
                     <Search className="w-6 h-6" />
                  </button>
               </div>
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
               <button onClick={() => setCurrentStep('SUMMARY')} className="bg-green-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-green-700 flex items-center">
                  Siguiente: Resumen <ArrowRight className="w-4 h-4 ml-2" />
               </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
               {dispatchSales.map(sale => {
                  const status = processedDocs[sale.id];
                  return (
                     <div key={sale.id} className={`bg-white p-4 rounded-lg shadow-sm border-l-4 flex flex-col gap-3 ${status.action === 'PAID' ? 'border-green-500' :
                           status.action === 'CREDIT' ? 'border-blue-500' :
                              status.action === 'VOID' ? 'border-red-500' : 'border-orange-500'
                        }`}>
                        {/* Top Row: Info */}
                        <div className="flex justify-between items-start">
                           <div>
                              <div className="font-bold text-slate-800 text-lg">{sale.client_name}</div>
                              <div className="text-slate-500 text-sm font-mono">{sale.document_type} {sale.series}-{sale.number}</div>
                           </div>
                           <div className="text-right">
                              <div className="font-bold text-xl text-slate-900">S/ {sale.total.toFixed(2)}</div>
                              <div className="text-xs font-bold text-slate-400">{sale.payment_method}</div>
                           </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 bg-slate-50 p-2 rounded justify-between items-center">
                           <div className="flex gap-2">
                              <button
                                 onClick={() => handleQuickAction(sale, 'PAID')}
                                 className={`px-3 py-1.5 rounded text-xs font-bold flex items-center border transition-all ${status.action === 'PAID' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-green-50'}`}
                              >
                                 <DollarSign className="w-3 h-3 mr-1" /> COBRADO
                              </button>
                              <button
                                 onClick={() => handleQuickAction(sale, 'CREDIT')}
                                 className={`px-3 py-1.5 rounded text-xs font-bold flex items-center border transition-all ${status.action === 'CREDIT' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-blue-50'}`}
                              >
                                 <CreditCard className="w-3 h-3 mr-1" /> CRÉDITO
                              </button>
                           </div>
                           <div className="flex gap-2">
                              <button
                                 onClick={() => openPartialModal(sale.id)}
                                 className={`px-3 py-1.5 rounded text-xs font-bold flex items-center border transition-all ${status.action === 'PARTIAL_RETURN' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-300 hover:bg-orange-50'}`}
                              >
                                 <AlertTriangle className="w-3 h-3 mr-1" /> PARCIAL (NC)
                              </button>
                              <button
                                 onClick={() => openVoidModal(sale.id)}
                                 className={`px-3 py-1.5 rounded text-xs font-bold flex items-center border transition-all ${status.action === 'VOID' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-red-50'}`}
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
                     <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Motivo de Anulación (Obligatorio)</label>
                        <textarea
                           className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                           rows={3}
                           placeholder="Ingrese el motivo..."
                           value={voidReason}
                           onChange={e => setVoidReason(e.target.value)}
                        ></textarea>
                     </div>
                     <div className="flex gap-2 justify-end">
                        <button onClick={() => setActiveModal('NONE')} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded">Cancelar</button>
                        <button onClick={confirmVoid} className="px-6 py-2 bg-red-600 text-white font-bold rounded shadow hover:bg-red-700">Confirmar Anulación</button>
                     </div>
                  </div>
               </div>
            )}

            {/* --- MODAL: PARTIAL / NC --- */}
            {activeModal === 'PARTIAL' && targetSaleId && (
               <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl flex flex-col max-h-[90vh] border-t-4 border-orange-500 animate-fade-in-up">
                     <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-orange-50">
                        <div>
                           <h3 className="font-bold text-orange-800 flex items-center text-lg"><FileText className="mr-2" /> Generar Nota de Crédito (Parcial)</h3>
                           <p className="text-xs text-orange-700">Ingrese la cantidad de cajas o unidades a devolver por producto.</p>
                        </div>
                        <button onClick={() => setActiveModal('NONE')}><XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                     </div>

                     <div className="flex-1 overflow-auto p-4">
                        <table className="w-full text-sm text-left border-collapse">
                           <thead className="bg-slate-100 text-slate-700 font-bold">
                              <tr>
                                 <th className="p-2 border-b">Producto</th>
                                 <th className="p-2 border-b text-center">Vendido</th>
                                 <th className="p-2 border-b text-center bg-red-50 text-red-800 w-24">Dev. Cajas</th>
                                 <th className="p-2 border-b text-center bg-red-50 text-red-800 w-24">Dev. Unid</th>
                                 <th className="p-2 border-b text-right">Reembolso</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {dispatchSales.find(s => s.id === targetSaleId)?.items.map(item => {
                                 const entries = returnEntries[item.id] || { boxes: 0, units: 0 };
                                 const product = store.products.find(p => p.id === item.product_id);
                                 const factor = product?.package_content || 1;

                                 // Calculate Refund Preview
                                 const returnedBase = (entries.boxes * factor) + entries.units;
                                 const refundRatio = returnedBase / item.quantity_base;
                                 const refundAmt = item.total_price * refundRatio;

                                 return (
                                    <tr key={item.id} className={returnedBase > 0 ? 'bg-orange-50' : ''}>
                                       <td className="p-2">
                                          <div className="font-bold text-slate-700">{item.product_name}</div>
                                          <div className="text-[10px] text-slate-400">Factor: {factor}</div>
                                       </td>
                                       <td className="p-2 text-center">
                                          <div className="font-bold text-slate-800">{item.quantity_presentation} {item.selected_unit}</div>
                                          <div className="text-[10px] text-slate-500">({item.quantity_base} unid. base)</div>
                                       </td>
                                       <td className="p-2 text-center bg-red-50">
                                          <input
                                             type="number"
                                             min="0"
                                             className="w-16 border border-red-300 rounded p-1 text-center font-bold text-red-900"
                                             value={entries.boxes}
                                             onChange={e => handleReturnChange(item.id, 'boxes', parseInt(e.target.value) || 0)}
                                          />
                                       </td>
                                       <td className="p-2 text-center bg-red-50">
                                          <input
                                             type="number"
                                             min="0"
                                             className="w-16 border border-red-300 rounded p-1 text-center font-bold text-red-900"
                                             value={entries.units}
                                             onChange={e => handleReturnChange(item.id, 'units', parseInt(e.target.value) || 0)}
                                          />
                                       </td>
                                       <td className="p-2 text-right font-bold text-red-600">
                                          S/ {refundAmt.toFixed(2)}
                                       </td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     </div>

                     <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-6">
                        {/* Logic for Remainder */}
                        <div className="bg-white p-3 rounded border border-slate-300 shadow-sm">
                           <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Destino del Saldo Restante</label>
                           <div className="flex gap-2">
                              <button
                                 onClick={() => setPartialBalanceType('CONTADO')}
                                 className={`flex-1 py-2 rounded text-xs font-bold border ${partialBalanceType === 'CONTADO' ? 'bg-green-100 border-green-400 text-green-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                              >
                                 COBRAR EFECTIVO
                              </button>
                              <button
                                 onClick={() => setPartialBalanceType('CREDITO')}
                                 className={`flex-1 py-2 rounded text-xs font-bold border ${partialBalanceType === 'CREDITO' ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                              >
                                 MANTENER CRÉDITO
                              </button>
                           </div>
                           <p className="text-[10px] text-slate-400 mt-2 leading-tight">
                              * El saldo se calculará restando el total de la Nota de Crédito al total original del documento.
                           </p>
                        </div>

                        {/* Totals Preview */}
                        <div className="flex flex-col justify-center items-end text-sm space-y-1">
                           {(() => {
                              const sale = dispatchSales.find(s => s.id === targetSaleId);
                              const totalSale = sale?.total || 0;
                              let refund = 0;

                              // Re-calc total refund for preview
                              sale?.items.forEach(item => {
                                 const entries = returnEntries[item.id] || { boxes: 0, units: 0 };
                                 const factor = store.products.find(p => p.id === item.product_id)?.package_content || 1;
                                 const retBase = (entries.boxes * factor) + entries.units;
                                 refund += (retBase / item.quantity_base) * item.total_price;
                              });

                              const balance = totalSale - refund;

                              return (
                                 <>
                                    <div className="flex justify-between w-full">
                                       <span className="text-slate-500">Total Original:</span>
                                       <span className="font-bold">S/ {totalSale.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between w-full text-red-600">
                                       <span className="font-bold">(-) Nota Crédito:</span>
                                       <span className="font-bold">S/ {refund.toFixed(2)}</span>
                                    </div>
                                    <div className="w-full border-t border-slate-300 my-1"></div>
                                    <div className="flex justify-between w-full text-lg">
                                       <span className="font-bold text-slate-800">Nuevo Saldo:</span>
                                       <span className={`font-bold ${partialBalanceType === 'CONTADO' ? 'text-green-600' : 'text-blue-600'}`}>S/ {balance.toFixed(2)}</span>
                                    </div>
                                 </>
                              );
                           })()}
                        </div>
                     </div>

                     <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
                        <button onClick={() => setActiveModal('NONE')} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded">Cancelar</button>
                        <button onClick={confirmPartial} className="px-6 py-2 bg-orange-600 text-white font-bold rounded shadow hover:bg-orange-700 flex items-center">
                           <Save className="w-4 h-4 mr-2" /> Generar NC y Guardar
                        </button>
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
                                 <span>Efectivo a Caja:</span>
                                 <span>S/ {totals.cash.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-blue-700">
                                 <span>Créditos (Deuda):</span>
                                 <span>S/ {totals.credit.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-red-600">
                                 <span>Anulaciones/NC:</span>
                                 <span>S/ {(totals.voided + totals.returns).toFixed(2)}</span>
                              </div>
                           </div>
                           <div className="text-xs text-slate-400 italic text-center">
                              * Esta acción es irreversible y actualizará el Kardex.
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
               <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-800 text-white rounded-t-lg print:hidden">
                  <div>
                     <h2 className="font-bold text-xl">Resumen de Liquidación</h2>
                     <p className="text-xs text-slate-400">Revise los totales antes de enviar a caja.</p>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold flex items-center">
                        <Printer className="w-4 h-4 mr-2" /> Imprimir Reportes
                     </button>
                     <button onClick={handleRequestFinalize} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold flex items-center shadow-lg animate-pulse">
                        <CheckCircle className="w-4 h-4 mr-2" /> Finalizar y Procesar
                     </button>
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
