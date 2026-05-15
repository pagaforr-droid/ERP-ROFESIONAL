
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Sale, LiquidationDocument } from '../types';
import { Search, Printer, Eye, FileText, Filter, X, Calendar, Download, Trash2, Copy, Lock, Loader2, ArrowDown } from 'lucide-react';
import { PdfEngine } from './PdfEngine';
import { supabase } from '../services/supabase';

// Normalized interface for display purposes
interface DisplayDocument {
   id: string;
   source: 'SALE' | 'NC'; // To know origin
   documentType: string;
   series: string;
   number: string;
   date: string;
   clientName: string;
   clientDoc: string;
   total: number;
   items: any[]; // Normalized items
   originalRef?: any; // Keep reference to original object for printing
}

export const DocumentManager: React.FC = () => {
   const { dispatchLiquidations, dispatchSheets, sellers, users, company, vehicles, transporters, drivers } = useStore();
   const [dbDocuments, setDbDocuments] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(false);

   // --- STATE ---
   const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
   const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
   const [filterType, setFilterType] = useState('ALL'); // ALL, FACTURA, BOLETA, NOTA_CREDITO
   const [searchTerm, setSearchTerm] = useState('');

   const [page, setPage] = useState(0);
   const [hasMore, setHasMore] = useState(true);
   const PAGE_SIZE = 50;

   const [selectedDoc, setSelectedDoc] = useState<DisplayDocument | null>(null); // For Modal Detail
   
   // --- ACTION MODAL STATE ---
   const [actionState, setActionState] = useState<{ type: 'ANNUL' | 'CLONE', doc: DisplayDocument } | null>(null);
   const [adminPassword, setAdminPassword] = useState('');
   const [cloneSeries, setCloneSeries] = useState('');
   const [isProcessingAction, setIsProcessingAction] = useState(false);
   const isSavingRef = React.useRef(false);
   const { currentUser, annulSale } = useStore();

   const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: 'info'|'warning'|'error'|'success', message: string}>({ isOpen: false, type: 'info', message: '' });
   const showAlert = (message: string, type: 'info'|'warning'|'error'|'success' = 'info') => setModalConfig({ isOpen: true, type, message });

   // --- DATA UNIFICATION ---
   const allDocuments: DisplayDocument[] = useMemo(() => {
      const docs: DisplayDocument[] = [];

      // 1. Process DB Documents (Facturas & Boletas)
      dbDocuments.forEach(sale => {
         docs.push({
            id: sale.id,
            source: 'SALE',
            documentType: sale.document_type,
            series: sale.series,
            number: sale.number,
            date: sale.created_at,
            clientName: sale.client_name,
            clientDoc: sale.client_ruc,
            total: sale.total,
            items: sale.items || [],
            originalRef: sale
         });
      });

      // Sort by Date Descending
      return docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
   }, [dbDocuments, dispatchLiquidations]);

   // --- DB FETCH LOGIC ---
   const fetchDocuments = async (pageNum = 0, append = false) => {
       setIsLoading(true);
       try {
           let query = supabase.from('sales').select('*, items:sale_items(*)').neq('status', 'canceled');
           
           if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
           if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);
           
           if (filterType !== 'ALL') {
               if (filterType === 'NOTA_CREDITO') query = query.eq('document_type', 'NOTA DE CREDITO');
               else query = query.eq('document_type', filterType);
           }

           if (searchTerm) {
               query = query.or(`client_name.ilike.%${searchTerm}%,client_ruc.ilike.%${searchTerm}%,number.ilike.%${searchTerm}%,series.ilike.%${searchTerm}%`);
           }
           
           const from = pageNum * PAGE_SIZE;
           const to = from + PAGE_SIZE - 1;

           const { data, error } = await query.order('created_at', { ascending: false }).range(from, to);
           if (error) throw error;
           
           const newDocs = data || [];
           if (append) {
               setDbDocuments(prev => [...prev, ...newDocs]);
           } else {
               setDbDocuments(newDocs);
           }
           setHasMore(newDocs.length === PAGE_SIZE);
           setPage(pageNum);
       } catch (error) {
           console.error("Error fetching docs", error);
           showAlert("Error cargando documentos de la base de datos.", 'error');
       } finally {
           setIsLoading(false);
       }
   };

   // Fetch initial data on mount
   React.useEffect(() => {
       const fetchCatalogs = async () => {
          const state = useStore.getState();
          // Siempre obtener las planillas más recientes porque cambian constantemente
          const { data: dsData } = await supabase.from('dispatch_sheets').select('*, dispatch_sales(sale_id)');
          if (dsData) {
             const mappedDs = dsData.map((d: any) => ({
                ...d,
                sale_ids: d.dispatch_sales ? d.dispatch_sales.map((ds: any) => ds.sale_id) : []
             }));
             useStore.setState({ dispatchSheets: mappedDs });
          }

          // Siempre obtener las liquidaciones más recientes
          const { data: liqData } = await supabase.from('dispatch_liquidations').select('*');
          if (liqData) useStore.setState({ dispatchLiquidations: liqData as any[] });
          if (state.vehicles.length === 0) {
             const { data } = await supabase.from('vehicles').select('*');
             if (data) useStore.setState({ vehicles: data as any[] });
          }
          if (state.transporters.length === 0) {
             const { data } = await supabase.from('transporters').select('*');
             if (data) useStore.setState({ transporters: data as any[] });
          }
          if (state.drivers.length === 0) {
             const { data } = await supabase.from('drivers').select('*');
             if (data) useStore.setState({ drivers: data as any[] });
          }
          if (state.sellers.length === 0) {
             const { data } = await supabase.from('sellers').select('*');
             if (data) useStore.setState({ sellers: data as any[] });
          }
          if (state.users.length === 0) {
             const { data } = await supabase.from('erp_users').select('*');
             if (data) useStore.setState({ users: data as any[] });
          }
       };
       fetchCatalogs();
       fetchDocuments(0, false);
   }, []);

   // --- FILTERING ---
   // Filtrado ahora es manejado 100% por Supabase (Server-side)
   const filteredDocs = allDocuments;

   // --- HANDLERS ---
   const handlePrint = async (doc: DisplayDocument) => {
      if (doc.originalRef) {
         try {
            await PdfEngine.openDocument([doc.originalRef], 'BATCH', company);
         } catch (error) {
            console.error(error);
            showAlert("Error al generar el documento PDF.", 'error');
         }
      }
   };

   const getBadgeColor = (type: string) => {
      if (type === 'FACTURA') return 'bg-purple-100 text-purple-800 border-purple-200';
      if (type === 'BOLETA') return 'bg-blue-100 text-blue-800 border-blue-200';
      if (type.includes('NOTA')) return 'bg-orange-100 text-orange-800 border-orange-200';
      return 'bg-gray-100 text-gray-800';
   };

   const openActionModal = (type: 'ANNUL' | 'CLONE', doc: DisplayDocument) => {
      setActionState({ type, doc });
      setAdminPassword('');
      if (type === 'CLONE') {
         setCloneDocType(doc.documentType);
         const activeSeriesList = company.series.filter(s => s.type === doc.documentType && s.is_active);
         if (activeSeriesList.length > 0) setCloneSeries(activeSeriesList[0].series);
      }
   };

   const confirmAction = async () => {
      if (!actionState) return;
      if (!adminPassword) { showAlert('Ingrese la contraseña de administrador.', 'warning'); return; }
      
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      setIsProcessingAction(true);
      try {
         const { data: userAuth, error: authError } = await supabase.rpc('validate_admin_password', {
            p_password: adminPassword
         });
         
         if (authError || !userAuth) {
             throw new Error("Contraseña incorrecta o permisos insuficientes.");
         }
         
         // 1. ANULAR DOCUMENTO (Común para ambos flujos)
         const { success, msg } = await annulSale(actionState.doc.id, currentUser?.id || '');
         if (!success) throw new Error(msg);
         
         if (actionState.type === 'CLONE') {
            // 2. CREAR NUEVO DOCUMENTO CLONADO
            const originalSale = actionState.doc.originalRef;
            
            const clonedSalePayload = {
               id: crypto.randomUUID(),
               document_type: cloneDocType,
               series: cloneSeries,
               number: "A_GENERAR",
               client_id: originalSale.client_id,
               client_name: originalSale.client_name,
               client_ruc: originalSale.client_ruc,
               client_address: originalSale.client_address,
               seller_id: originalSale.seller_id,
               payment_method: originalSale.payment_method,
               subtotal: originalSale.subtotal,
               igv: originalSale.igv,
               total: originalSale.total,
               status: 'completed',
               items: originalSale.items.map((item: any) => ({
                   ...item,
                   id: crypto.randomUUID(),
                   sale_id: undefined
               }))
            };
            
            const { error: cloneError } = await supabase.rpc('process_sale_transaction', { p_sale_data: clonedSalePayload });
            if (cloneError) throw cloneError;
            
            showAlert(`Documento original anulado y clonado exitosamente a la serie ${cloneSeries}. Actualice la vista.`, 'success');
         } else {
            showAlert('Documento anulado con éxito. El stock ha sido restituido al Kardex.', 'success');
         }
         
         setActionState(null);
         fetchDocuments(); // Refresh data from Supabase
      } catch (error: any) {
         showAlert("Error: " + error.message, 'error');
      } finally {
         isSavingRef.current = false;
         setIsProcessingAction(false);
      }
   };

   return (
      <div className="flex flex-col h-full space-y-4">

         {/* --- CUSTOM ALERT MODAL --- */}
         {modalConfig.isOpen && (
            <div className="absolute inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-scale-up">
                  {modalConfig.type === 'error' && <X className="w-12 h-12 text-red-500 mx-auto mb-4 bg-red-50 p-2 rounded-full" />}
                  {modalConfig.type === 'warning' && <Lock className="w-12 h-12 text-amber-500 mx-auto mb-4 bg-amber-50 p-2 rounded-full" />}
                  {modalConfig.type === 'success' && <FileText className="w-12 h-12 text-emerald-500 mx-auto mb-4 bg-emerald-50 p-2 rounded-full" />}
                  {modalConfig.type === 'info' && <FileText className="w-12 h-12 text-blue-500 mx-auto mb-4 bg-blue-50 p-2 rounded-full" />}
                  
                  <h3 className="text-lg font-black text-slate-800 mb-2">
                     {modalConfig.type === 'error' ? 'Error' : modalConfig.type === 'warning' ? 'Aviso' : modalConfig.type === 'success' ? 'Éxito' : 'Información'}
                  </h3>
                  <p className="text-sm text-slate-600 mb-6">{modalConfig.message}</p>
                  
                  <div className="flex justify-center">
                     <button onClick={() => setModalConfig({...modalConfig, isOpen: false})} className="px-8 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700">Aceptar</button>
                  </div>
               </div>
            </div>
         )}

         {/* HEADER */}
         <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
               <FileText className="mr-2 text-slate-600" /> Historial de Documentos
            </h2>
            <div className="text-sm text-slate-500">
               Mostrando {filteredDocs.length} registros
            </div>
         </div>

         {/* FILTERS */}
         <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <div className="flex flex-wrap gap-4 items-end">
               <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Desde</label>
                  <div className="relative">
                     <Calendar className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                     <input type="date" className="pl-8 border border-slate-300 p-2 rounded text-sm text-slate-700" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  </div>
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Hasta</label>
                  <div className="relative">
                     <Calendar className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                     <input type="date" className="pl-8 border border-slate-300 p-2 rounded text-sm text-slate-700" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  </div>
               </div>
               <div className="w-48">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipo Documento</label>
                  <select className="w-full border border-slate-300 p-2 rounded text-sm text-slate-700" value={filterType} onChange={e => setFilterType(e.target.value)}>
                     <option value="ALL">TODOS</option>
                     <option value="FACTURA">FACTURA ELECTRONICA</option>
                     <option value="BOLETA">BOLETA DE VENTA</option>
                     <option value="NOTA_CREDITO">NOTA DE CRÉDITO</option>
                  </select>
               </div>
               <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Búsqueda (Cliente, Serie, Nro)</label>
                  <div className="relative">
                     <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                     <input
                        className="w-full pl-8 border border-slate-300 p-2 rounded text-sm text-slate-700"
                        placeholder="Ej. F001, Juan Perez, 2060..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                     />
                  </div>
               </div>
               <div>
                  <button 
                     onClick={() => fetchDocuments(0, false)} 
                     disabled={isLoading}
                     className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm flex items-center transition-colors disabled:opacity-50 h-[38px]"
                  >
                     {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                     Buscar en BD
                  </button>
               </div>
            </div>
         </div>

         {/* TABLE */}
         <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 border-b border-slate-200">
                     <tr>
                        <th className="p-3 w-32">Fecha</th>
                        <th className="p-3 w-32 text-center">Tipo</th>
                        <th className="p-3 w-32">Documento</th>
                        <th className="p-3 flex-1">Cliente / Razón Social</th>
                        <th className="p-3 w-32 text-right">Total</th>
                        <th className="p-3 w-32 text-center">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {filteredDocs.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50 group">
                           <td className="p-3 text-slate-600">
                              {new Date(doc.date).toLocaleDateString()} <span className="text-[10px] text-slate-400">{new Date(doc.date).toLocaleTimeString().substring(0, 5)}</span>
                           </td>
                           <td className="p-3 text-center">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold border ${getBadgeColor(doc.documentType)}`}>
                                 {doc.documentType.replace('_', ' ')}
                              </span>
                           </td>
                           <td className="p-3 font-mono font-bold text-slate-700">
                              {doc.series}-{doc.number}
                           </td>
                           <td className="p-3">
                              <div className="font-bold text-slate-800">{doc.clientName}</div>
                              <div className="text-xs text-slate-500 font-mono">{doc.clientDoc}</div>
                           </td>
                           <td className="p-3 text-right font-bold text-slate-900">
                              S/ {doc.total.toFixed(2)}
                           </td>
                           <td className="p-3 text-center">
                              <div className="flex justify-center gap-2">
                                 <button
                                    onClick={() => setSelectedDoc(doc)}
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Ver Detalle"
                                 >
                                    <Eye className="w-4 h-4" />
                                 </button>
                                 <button
                                    onClick={() => handlePrint(doc)}
                                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                    title="Reimprimir"
                                 >
                                    <Printer className="w-4 h-4" />
                                 </button>
                                 {currentUser?.role === 'ADMIN' && doc.originalRef?.status !== 'canceled' && (
                                    <>
                                       <button
                                          onClick={() => openActionModal('CLONE', doc)}
                                          className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                          title="Clonar Documento"
                                       >
                                          <Copy className="w-4 h-4" />
                                       </button>
                                       <button
                                          onClick={() => openActionModal('ANNUL', doc)}
                                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                          title="Anular Documento"
                                       >
                                          <Trash2 className="w-4 h-4" />
                                       </button>
                                    </>
                                 )}
                              </div>
                           </td>
                        </tr>
                     ))}
                     {filteredDocs.length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No se encontraron documentos.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>

            {hasMore && filteredDocs.length > 0 && (
               <div className="p-4 flex justify-center bg-white border-t border-slate-200">
                  <button 
                     onClick={() => fetchDocuments(page + 1, true)}
                     disabled={isLoading}
                     className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-full flex items-center transition-colors shadow-sm disabled:opacity-50"
                  >
                     {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDown className="w-4 h-4 mr-2" />}
                     Cargar siguientes 50 comprobantes
                  </button>
               </div>
            )}
         </div>

         {/* DETAIL MODAL */}
         {selectedDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
               <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                  <div className="bg-slate-800 p-4 text-white flex justify-between items-start">
                     <div>
                        <h3 className="text-lg font-bold flex items-center">
                           {selectedDoc.documentType.replace('_', ' ')}: {selectedDoc.series}-{selectedDoc.number}
                        </h3>
                        <p className="text-xs text-slate-300">{selectedDoc.clientName} ({selectedDoc.clientDoc})</p>
                     </div>
                     <button onClick={() => setSelectedDoc(null)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                  </div>

                  <div className="flex-1 overflow-auto p-0">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                           <tr>
                              <th className="p-3">Cant.</th>
                              <th className="p-3">Unid.</th>
                              <th className="p-3">Descripción</th>
                              <th className="p-3 text-right">P. Unit</th>
                              <th className="p-3 text-right">Total</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {selectedDoc.items.map((item: any, idx: number) => (
                              <tr key={idx}>
                                 <td className="p-3 font-bold text-center">{item.quantity_presentation}</td>
                                 <td className="p-3 text-xs text-slate-500">{item.selected_unit}</td>
                                 <td className="p-3 text-slate-800">
                                    {item.product_name}
                                    {item.is_bonus && <span className="ml-2 text-[9px] bg-green-100 text-green-800 px-1 rounded">BONIF</span>}
                                 </td>
                                 <td className="p-3 text-right text-slate-600">{item.unit_price.toFixed(2)}</td>
                                 <td className="p-3 text-right font-bold text-slate-900">{item.total_price.toFixed(2)}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-start">
                     <div className="text-xs text-slate-500 space-y-1">
                        <div><span className="font-bold text-slate-700">Fecha Emisión:</span> {new Date(selectedDoc.date).toLocaleString()}</div>
                        <div><span className="font-bold text-slate-700">Vendedor Asignado:</span> {
                           sellers.find(s => s.id === selectedDoc.originalRef?.seller_id)?.name || 'Sin Vendedor'
                        }</div>
                        <div><span className="font-bold text-slate-700">Usuario Creador:</span> {
                           selectedDoc.originalRef?.created_by_user_id
                              ? users.find(u => u.id === selectedDoc.originalRef?.created_by_user_id)?.name || 'Desconocido'
                              : (users.find(u => u.id === selectedDoc.originalRef?.seller_id)?.name || sellers.find(s => s.id === selectedDoc.originalRef?.seller_id)?.name || 'Sistema (Legacy)')
                        }</div>
                        <div><span className="font-bold text-slate-700">Planilla de Reparto:</span> {
                           (() => {
                              const ds = dispatchSheets.find(d => d.sale_ids?.includes(selectedDoc.id));
                              if (!ds) return 'No Asignado a Ruta';
                              const vehicle = vehicles.find(v => v.id === ds.vehicle_id);
                              const transporter = transporters.find(t => t.id === vehicle?.transporter_id);
                              const driver = drivers.find(dr => dr.id === vehicle?.driver_id);
                              const driverName = driver?.name || 'Desconocido';
                              
                              const liq = dispatchLiquidations.find(l => l.dispatch_sheet_id === ds.id);
                              return (
                                 <span>
                                    {liq ? `Liquidado en Hoja ${ds.code}` : `En Ruta ${ds.code}`}
                                    <br/><span className="text-[10px] text-slate-400">Chofer: {driverName}</span>
                                 </span>
                              );
                           })()
                        }</div>
                     </div>
                     <div className="text-right">
                        <span className="text-sm font-bold text-slate-600 mr-4">TOTAL DOCUMENTO:</span>
                        <span className="text-xl font-bold text-slate-900">S/ {selectedDoc.total.toFixed(2)}</span>
                     </div>
                  </div>

                  <div className="p-3 bg-white border-t border-slate-200 flex justify-end gap-2">
                     <button onClick={() => setSelectedDoc(null)} className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-medium">Cerrar</button>
                     <button onClick={() => handlePrint(selectedDoc)} className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 font-bold flex items-center">
                        <Printer className="w-4 h-4 mr-2" /> Reimprimir
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* ACTION MODAL (ANNUL/CLONE) */}
         {actionState && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
               <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-scale-up flex flex-col">
                  <div className="p-6">
                     <div className="flex justify-center mb-4">
                        <div className={`p-3 rounded-full ${actionState.type === 'ANNUL' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                           {actionState.type === 'ANNUL' ? <Trash2 className="w-10 h-10" /> : <Copy className="w-10 h-10" />}
                        </div>
                     </div>
                     <h3 className="text-xl font-black text-slate-800 text-center mb-2">
                        {actionState.type === 'ANNUL' ? 'Anular Documento' : 'Clonar Documento'}
                     </h3>
                     <p className="text-slate-500 text-sm text-center mb-6">
                        {actionState.type === 'ANNUL' 
                           ? `Se anulará el documento ${actionState.doc.series}-${actionState.doc.number} y se retornará el stock al Kardex.`
                           : `Se anulará el documento ${actionState.doc.series}-${actionState.doc.number} y se creará uno nuevo con la misma información.`}
                     </p>

                     {actionState.type === 'CLONE' && (
                        <div className="mb-4 space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                           <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Documento Destino</label>
                              <select 
                                 className="w-full border border-slate-300 rounded p-2 text-sm font-bold bg-white"
                                 value={cloneDocType}
                                 onChange={(e) => {
                                    const type = e.target.value;
                                    setCloneDocType(type);
                                    const activeSeriesList = company.series.filter(s => s.type === type && s.is_active);
                                    if (activeSeriesList.length > 0) setCloneSeries(activeSeriesList[0].series);
                                 }}
                              >
                                 <option value="FACTURA">FACTURA</option>
                                 <option value="BOLETA">BOLETA</option>
                              </select>
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Serie Destino</label>
                              <select 
                                 className="w-full border border-slate-300 rounded p-2 text-sm font-bold bg-white"
                                 value={cloneSeries}
                                 onChange={(e) => setCloneSeries(e.target.value)}
                              >
                                 {company.series.filter(s => s.type === cloneDocType && s.is_active).map(s => (
                                    <option key={s.id} value={s.series}>{s.series}</option>
                                 ))}
                              </select>
                           </div>
                        </div>
                     )}

                     <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center">
                           <Lock className="w-3 h-3 mr-1" /> Contraseña de Administrador
                        </label>
                        <input 
                           type="password" 
                           className="w-full border-2 border-slate-300 p-3 rounded-lg text-center font-black tracking-widest focus:border-blue-500 outline-none"
                           value={adminPassword}
                           onChange={e => setAdminPassword(e.target.value)}
                           placeholder="••••••"
                           autoFocus
                        />
                     </div>

                     <div className="flex gap-3">
                        <button 
                           onClick={() => setActionState(null)} 
                           disabled={isProcessingAction}
                           className="flex-1 py-3 bg-slate-100 rounded-lg font-bold text-slate-600 disabled:opacity-50"
                        >
                           Cancelar
                        </button>
                        <button 
                           onClick={confirmAction} 
                           disabled={isProcessingAction || !adminPassword}
                           className={`flex-1 py-3 text-white rounded-lg font-bold shadow-lg flex justify-center items-center disabled:opacity-50 ${actionState.type === 'ANNUL' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                           {isProcessingAction ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
