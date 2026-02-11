
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { FileCheck, Search, Filter, AlertCircle, CheckCircle, ArrowRight, CheckSquare, Square, FileOutput, Loader2, X, HelpCircle, FileText } from 'lucide-react';

export const OrderProcessing: React.FC = () => {
  const { orders, sellers, batchProcessOrders, clients, zones } = useStore();
  
  // Filters
  const [filterSeller, setFilterSeller] = useState('ALL');
  const [filterZone, setFilterZone] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'processed' | 'rejected'>('pending');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modal State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{facturas: number, boletas: number} | null>(null);

  // Filter Logic
  const filteredOrders = orders.filter(o => {
     const client = clients.find(c => c.id === o.client_id);
     const clientZoneId = client?.zone_id || 'UNASSIGNED';

     const matchSeller = filterSeller === 'ALL' || o.seller_id === filterSeller;
     const matchZone = filterZone === 'ALL' || clientZoneId === filterZone;
     const matchStatus = o.status === filterStatus;
     
     return matchSeller && matchZone && matchStatus;
  });

  // --- SELECTION HANDLERS ---
  const handleToggleSelect = (id: string) => {
     const newSet = new Set(selectedIds);
     if (newSet.has(id)) newSet.delete(id);
     else newSet.add(id);
     setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
     if (selectedIds.size === filteredOrders.length && filteredOrders.length > 0) {
        setSelectedIds(new Set());
     } else {
        setSelectedIds(new Set(filteredOrders.map(o => o.id)));
     }
  };

  // --- PROCESSING LOGIC ---
  
  // 1. Prepare Summary for Modal
  const processSummary = useMemo(() => {
     if (!isConfirmOpen && !processResult) return null;
     
     let facturas = 0;
     let boletas = 0;
     let totalAmount = 0;

     // If we have a result, use that. Otherwise calculate from selection.
     const idsToProcess = selectedIds; 

     idsToProcess.forEach(id => {
        const order = orders.find(o => o.id === id);
        if (order) {
           const isFactura = (order.client_doc_number || '').length === 11;
           if (isFactura) facturas++; else boletas++;
           totalAmount += order.total;
        }
     });

     return { count: idsToProcess.size, facturas, boletas, totalAmount };
  }, [isConfirmOpen, selectedIds, orders, processResult]);

  // 2. Open Modal
  const handleRequestProcess = () => {
     if (selectedIds.size === 0) return;
     setProcessResult(null);
     setIsConfirmOpen(true);
  };

  // 3. Execute
  const executeProcess = async () => {
     setIsProcessing(true);
     
     // Capture summary before processing (as status change removes them from list)
     const summary = processSummary; 

     try {
       // UI Delay for feedback
       await new Promise(resolve => setTimeout(resolve, 1500));

       // Action
       batchProcessOrders(Array.from(selectedIds));
       
       // Update Local State for Result View
       setProcessResult({
          facturas: summary?.facturas || 0,
          boletas: summary?.boletas || 0
       });
       
       // Clear selection immediately
       setSelectedIds(new Set());
       
     } catch (error) {
       console.error("Error processing orders:", error);
       alert("Ocurrió un error al procesar.");
       setIsConfirmOpen(false);
     } finally {
       setIsProcessing(false);
     }
  };

  const closeAndReset = () => {
     setIsConfirmOpen(false);
     setProcessResult(null);
  };

  return (
    <div className="h-full flex flex-col space-y-4 font-sans text-sm relative">
       
       {/* --- CONFIRMATION MODAL --- */}
       {isConfirmOpen && processSummary && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
             <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-scale-up">
                
                {/* HEAD */}
                <div className={`p-4 border-b border-slate-200 flex justify-between items-center ${processResult ? 'bg-green-600 text-white' : 'bg-slate-50'}`}>
                   <h3 className={`font-bold flex items-center ${processResult ? 'text-white' : 'text-slate-800'}`}>
                      {processResult ? <CheckCircle className="w-5 h-5 mr-2" /> : <HelpCircle className="w-5 h-5 mr-2 text-blue-600" />}
                      {processResult ? '¡Proceso Exitoso!' : 'Confirmar Proceso'}
                   </h3>
                   {!isProcessing && !processResult && (
                      <button onClick={closeAndReset} className="text-slate-400 hover:text-slate-600">
                         <X className="w-5 h-5" />
                      </button>
                   )}
                </div>
                
                {/* BODY */}
                <div className="p-6">
                   {processResult ? (
                      <div className="text-center space-y-4">
                         <p className="text-slate-600">Se han generado los siguientes documentos:</p>
                         <div className="flex justify-center gap-4">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center min-w-[80px]">
                               <div className="text-2xl font-bold text-blue-700">{processResult.facturas}</div>
                               <div className="text-[10px] font-bold text-blue-600 uppercase">Facturas</div>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-center min-w-[80px]">
                               <div className="text-2xl font-bold text-purple-700">{processResult.boletas}</div>
                               <div className="text-[10px] font-bold text-purple-600 uppercase">Boletas</div>
                            </div>
                         </div>
                         <button 
                            onClick={closeAndReset}
                            className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-slate-800 mt-4"
                         >
                            Cerrar y Continuar
                         </button>
                      </div>
                   ) : (
                      <>
                         <p className="text-slate-600 text-sm mb-4">
                            Se generarán los siguientes documentos electrónicos:
                         </p>
                         
                         <div className="space-y-2 mb-6">
                            <div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-100">
                               <div className="flex items-center font-bold text-blue-800">
                                  <FileText className="w-4 h-4 mr-2" /> FACTURAS
                               </div>
                               <span className="text-lg font-bold text-slate-700">{processSummary.facturas}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-purple-50 rounded border border-purple-100">
                               <div className="flex items-center font-bold text-purple-800">
                                  <FileText className="w-4 h-4 mr-2" /> BOLETAS
                               </div>
                               <span className="text-lg font-bold text-slate-700">{processSummary.boletas}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-2">
                               <span className="font-bold text-slate-500">Total Venta:</span>
                               <span className="font-bold text-xl text-green-600">S/ {processSummary.totalAmount.toFixed(2)}</span>
                            </div>
                         </div>

                         <button 
                            onClick={executeProcess}
                            disabled={isProcessing}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-bold shadow-lg disabled:opacity-70 flex items-center justify-center transition-all active:scale-95"
                         >
                            {isProcessing ? (
                               <>
                                  <Loader2 className="w-5 h-5 mr-2 animate-spin" /> PROCESANDO...
                               </>
                            ) : (
                               <>
                                  <CheckCircle className="w-5 h-5 mr-2" /> GENERAR DOCUMENTOS
                               </>
                            )}
                         </button>
                      </>
                   )}
                </div>
             </div>
          </div>
       )}

       <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
             <FileCheck className="mr-2 text-accent" /> Procesamiento de Pedidos
          </h2>
       </div>

       {/* FILTER BAR */}
       <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
             <label className="block text-xs font-bold text-slate-600 mb-1">Filtrar por Vendedor</label>
             <select className="w-full border border-slate-300 rounded p-2 text-sm" value={filterSeller} onChange={e => setFilterSeller(e.target.value)}>
                <option value="ALL">Todos los Vendedores</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
          </div>
          <div className="flex-1 min-w-[200px]">
             <label className="block text-xs font-bold text-slate-600 mb-1">Filtrar por Zona</label>
             <select className="w-full border border-slate-300 rounded p-2 text-sm" value={filterZone} onChange={e => setFilterZone(e.target.value)}>
                <option value="ALL">Todas las Zonas</option>
                {zones.map(z => <option key={z.id} value={z.id}>{z.code} - {z.name}</option>)}
             </select>
          </div>
          <div className="w-40">
             <label className="block text-xs font-bold text-slate-600 mb-1">Estado</label>
             <select className="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                <option value="pending">Pendientes</option>
                <option value="processed">Procesados</option>
             </select>
          </div>
          
          {filterStatus === 'pending' && (
             <button 
                type="button"
                onClick={handleRequestProcess}
                disabled={selectedIds.size === 0}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center transition-all min-w-[200px] justify-center active:scale-95"
             >
                <FileOutput className="w-5 h-5 mr-2" />
                PROCESAR ({selectedIds.size})
             </button>
          )}
       </div>

       {/* TABLE */}
       <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-4">
             {filterStatus === 'pending' && (
                <button onClick={handleSelectAll} className="flex items-center text-sm font-bold text-slate-700 hover:text-blue-600">
                   {selectedIds.size > 0 && selectedIds.size === filteredOrders.length ? <CheckSquare className="w-5 h-5 mr-1 text-blue-600" /> : <Square className="w-5 h-5 mr-1 text-slate-400" />}
                   Seleccionar Todo
                </button>
             )}
             <span className="text-xs text-slate-500 font-medium">
                {filteredOrders.length} pedidos encontrados
             </span>
          </div>

          <div className="overflow-auto flex-1">
             <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                   <tr>
                      {filterStatus === 'pending' && <th className="p-3 w-10 text-center"></th>}
                      <th className="p-3">Código</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Vendedor / Zona</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3 text-center">Tipo Doc</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-center">Estado</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {filteredOrders.map(order => {
                      const seller = sellers.find(s => s.id === order.seller_id);
                      const client = clients.find(c => c.id === order.client_id);
                      const zone = zones.find(z => z.id === client?.zone_id);
                      const isSelected = selectedIds.has(order.id);

                      return (
                         <tr 
                           key={order.id} 
                           className={`hover:bg-blue-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                           onClick={() => filterStatus === 'pending' && handleToggleSelect(order.id)}
                         >
                            {filterStatus === 'pending' && (
                               <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected} 
                                    onChange={() => handleToggleSelect(order.id)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                               </td>
                            )}
                            <td className="p-3 font-mono text-slate-600">{order.code}</td>
                            <td className="p-3 text-slate-500">{new Date(order.created_at).toLocaleDateString()} <span className="text-[10px]">{new Date(order.created_at).toLocaleTimeString().slice(0,5)}</span></td>
                            <td className="p-3">
                               <div className="text-xs font-bold text-slate-700">{seller?.name}</div>
                               <div className="text-[10px] text-slate-500 bg-slate-100 px-1 rounded w-fit mt-0.5">{zone?.name || 'Sin Zona'}</div>
                            </td>
                            <td className="p-3 font-medium text-slate-800">
                               {order.client_name}
                               <div className="text-xs text-slate-400 font-mono">{order.client_doc_number}</div>
                            </td>
                            <td className="p-3 text-center">
                               <span className={`px-2 py-0.5 rounded text-xs font-bold ${order.suggested_document_type === 'FACTURA' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                  {order.suggested_document_type}
                               </span>
                            </td>
                            <td className="p-3 text-right font-bold text-slate-900">S/ {order.total.toFixed(2)}</td>
                            <td className="p-3 text-center">
                               {order.status === 'processed' ? (
                                  <span className="text-green-600 flex items-center justify-center font-bold text-xs">
                                     <CheckCircle className="w-3 h-3 mr-1" /> Procesado
                                  </span>
                               ) : (
                                  <span className="text-yellow-600 font-bold text-xs bg-yellow-50 px-2 py-1 rounded">Pendiente</span>
                               )}
                            </td>
                         </tr>
                      );
                   })}
                   {filteredOrders.length === 0 && (
                      <tr><td colSpan={8} className="p-10 text-center text-slate-400 italic">No hay pedidos que coincidan con los filtros.</td></tr>
                   )}
                </tbody>
             </table>
          </div>
       </div>
    </div>
  );
};
