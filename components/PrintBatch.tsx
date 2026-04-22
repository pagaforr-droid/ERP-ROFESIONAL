import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../services/store';
import { Printer, Search, Calendar, CheckSquare, Square, FileText, X } from 'lucide-react';
import { PdfEngine } from './PdfEngine';

import { supabase } from '../services/supabase';
import { Loader2 } from 'lucide-react';

export const PrintBatch: React.FC = () => {
    const { company, markDocumentsAsPrinted, products, clients } = useStore();
    const companyInfo = company;
    
    const [dbSales, setDbSales] = useState<any[]>([]);
    const [dbDispatchSheets, setDbDispatchSheets] = useState<any[]>([]);
    const [dbCompany, setDbCompany] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Filters
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [docType, setDocType] = useState('ALL');
    const [printStatusFilter, setPrintStatusFilter] = useState<'PENDING' | 'PRINTED'>('PENDING');
    const [searchTerm, setSearchTerm] = useState('');

    // Selection
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedDocsInfo, setSelectedDocsInfo] = useState<any[]>([]);
    
    // Modal state
    const [alertMessage, setAlertMessage] = useState<string | null>(null);

    useEffect(() => {
        setSelectedIds([]);
        setSelectedDocsInfo([]);
    }, [dateFrom, dateTo, docType, printStatusFilter, searchTerm]);

    // Print Preview Mode
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    // --- FILTER LOGIC ---
    const allDocuments = useMemo(() => {
        const mappedSales = dbSales.map(s => ({ ...s, _isGuia: false, date: s.created_at.split('T')[0] }));
        
        const mappedGuias = dbDispatchSheets.map(d => {
           // Aggregate items for Guia
           let guiaItems: any[] = [];
           let totalWeight = 0;
           
           const dSales = dbSales.filter(s => d.sale_ids.includes(s.id));
           dSales.forEach(sale => {
              sale.items.forEach(item => {
                 const prod = products.find(p => p.id === item.product_id);
                 const existingItem = guiaItems.find(gi => gi.product_id === item.product_id);
                 if (existingItem) {
                    existingItem.quantity += item.quantity_base;
                 } else {
                    guiaItems.push({
                       product_id: item.product_id,
                       product: prod,
                       quantity: item.quantity_base,
                       unit_price: 0,
                    });
                 }
              });
           });

           const isConsolidated = d.sale_ids.length > 1;
           const firstSale = dSales.length > 0 ? dSales[0] : null;

           let clientName = 'Documentos Itinerantes';
           let clientId = '';
           let deliveryAddress = '';
           let refDoc = '';
           
           if (!isConsolidated && firstSale) {
               clientName = firstSale.client_name || 'Cliente Genérico';
               clientId = firstSale.client_id || '';
               deliveryAddress = firstSale.client_address || ''; // Corrected to client_address
               refDoc = `${firstSale.document_type} ${firstSale.series}-${firstSale.number}`;
           }

           return { 
               ...d, 
               _isGuia: true, 
               document_type: 'GUIA', 
               client_name: clientName,
               client_id: clientId,
               delivery_address: deliveryAddress,
               ref_doc: refDoc,
               guide_transporter_id: firstSale?.guide_transporter_id || '',
               guide_driver_id: firstSale?.guide_driver_id || '',
               guide_vehicle_id: firstSale?.guide_vehicle_id || d.vehicle_id || '',
               items: guiaItems,
               total: 0,
               series: d.code.split('-')[0] || 'T001',
               number: d.code.split('-')[1] || '000000',
               date: d.date.split('T')[0]
           };
        });
        
        return [...mappedSales, ...mappedGuias];
    }, [dbSales, dbDispatchSheets, products]);

    // --- DB FETCH LOGIC ---
    const fetchDocuments = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Sales
            let salesQuery = supabase.from('sales').select('*, items:sale_items(*)').neq('status', 'canceled');
            if (dateFrom) salesQuery = salesQuery.gte('created_at', `${dateFrom}T00:00:00`);
            if (dateTo) salesQuery = salesQuery.lte('created_at', `${dateTo}T23:59:59`);
            
            const { data: salesData, error: salesError } = await salesQuery;
            if (salesError) throw salesError;
            
            setDbSales(salesData || []);

            // 2. Fetch Dispatch Sheets
            let dispatchQuery = supabase.from('dispatch_sheets').select('*');
            if (dateFrom) dispatchQuery = dispatchQuery.gte('date', `${dateFrom}`);
            if (dateTo) dispatchQuery = dispatchQuery.lte('date', `${dateTo}`);
            
            const { data: dispatchData, error: dispatchError } = await dispatchQuery;
            if (dispatchError) throw dispatchError;
            
            setDbDispatchSheets(dispatchData || []);
            
            // 3. Fetch Company Config
            const { data: compData } = await supabase.from('company_config').select('*').limit(1).maybeSingle();
            if (compData) setDbCompany(compData);
            
        } catch (error) {
            console.error("Error fetching docs", error);
            setAlertMessage("Error cargando documentos de la base de datos.");
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch initial data on mount
    useEffect(() => {
        fetchDocuments();
    }, []);

    const filteredDocs = allDocuments.filter(s => {
        const date = s.date;
        const matchesDate = date >= dateFrom && date <= dateTo;
        
        // Handle Guia Document Type
        let matchesType = false;
        if (docType === 'ALL') matchesType = true;
        else if (docType === 'GUIA' && s._isGuia) matchesType = true;
        else if (s.document_type === docType) matchesType = true;
        else if (docType === 'NOTA_CREDITO' && s.document_type === 'NOTA DE CREDITO') matchesType = true;

        const matchesPrintStatus = printStatusFilter === 'PENDING' ? !s.printed : s.printed;
        
        const matchesSearch = s.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.number?.includes(searchTerm) ||
            s.series?.includes(searchTerm);

        return matchesDate && matchesType && matchesPrintStatus && matchesSearch;
    });

    const handleToggleSelect = (doc: any) => {
        setSelectedIds(prev => prev.includes(doc.id) ? prev.filter(x => x !== doc.id) : [...prev, doc.id]);
        setSelectedDocsInfo(prev => prev.find(x => x.id === doc.id) ? prev.filter(x => x.id !== doc.id) : [...prev, doc]);
    };

    const handleSelectAll = () => {
        if (selectedIds.length === filteredDocs.length) {
            setSelectedIds([]);
            setSelectedDocsInfo([]);
        } else {
            setSelectedIds(filteredDocs.map(s => s.id as string));
            setSelectedDocsInfo(filteredDocs);
        }
    };

    const handleOpenPreview = async () => {
        // Validate SUNAT Rules before printing Guides
        const invalidGuias = selectedDocsInfo.filter(d => 
           d._isGuia && 
           !(d.type === 'GUIA_CONSOLIDADA') && // Consolidated allowed
           (d.sunat_status !== 'ACCEPTED') // Must be accepted otherwise
        );

        if (invalidGuias.length > 0) {
           setAlertMessage(`No se pueden imprimir ${invalidGuias.length} Guía(s) de Remisión porque aún no han sido aceptadas por SUNAT. Envíelas primero desde el módulo SUNAT.`);
           return;
        }

        setIsPrinting(true);
        try {
            await PdfEngine.openDocument(selectedDocsInfo, 'BATCH', dbCompany || companyInfo);
            setIsPreviewOpen(true);
        } catch (error) {
            console.error(error);
            setAlertMessage("Error generando el archivo PDF.");
        } finally {
            setIsPrinting(false);
        }
    };

    const handleMarkAsPrinted = () => {
        markDocumentsAsPrinted(selectedIds);
        setIsPreviewOpen(false);
        setSelectedIds([]);
        setSelectedDocsInfo([]);
    };

    return (
        <div className="h-full flex flex-col space-y-4 relative">
            
            {/* --- CUSTOM ALERT MODAL --- */}
            {alertMessage && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 text-center animate-scale-up">
                        <div className="bg-amber-100 text-amber-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <X className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">Aviso</h3>
                        <p className="text-slate-600 text-sm mb-6">{alertMessage}</p>
                        <button 
                            onClick={() => setAlertMessage(null)}
                            className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold shadow-lg"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* --- PDF GENERATION SUCCESS MODAL --- */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                            <h2 className="font-bold flex items-center">
                                <Printer className="w-5 h-5 mr-2 text-blue-400" /> Confirmar Impresión
                            </h2>
                            <button onClick={() => setIsPreviewOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 text-center">
                            <FileText className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h3 className="text-xl font-black text-slate-800 mb-2">PDF Generado Exitosamente</h3>
                            <p className="text-slate-600 text-sm mb-6">El documento de {selectedDocsInfo.length} páginas se ha abierto en una nueva pestaña. ¿Desea marcar estos documentos como impresos para que no vuelvan a aparecer en la bandeja de pendientes?</p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsPreviewOpen(false)}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors"
                                >
                                    Cerrar
                                </button>
                                <button 
                                    onClick={handleMarkAsPrinted}
                                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-lg transition-colors"
                                >
                                    Marcar como Impresos
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                    <Printer className="mr-2 text-accent" /> Impresión de Documentos (Motor PDF)
                </h2>
                {selectedIds.length > 0 && (
                    <button
                        onClick={handleOpenPreview}
                        className={`px-6 py-2 rounded font-bold shadow-lg flex items-center transition-all bg-slate-900 hover:bg-slate-800 text-white animate-pulse`}
                    >
                        <Printer className="w-5 h-5 mr-2" />
                        VISTA PREVIA PDF ({selectedIds.length})
                    </button>
                )}
            </div>

            {/* --- SMART FILTERS --- */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Desde</label>
                        <div className="relative">
                            <Calendar className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                            <input type="date" className="pl-8 border border-slate-300 p-2 rounded text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Hasta</label>
                        <div className="relative">
                            <Calendar className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                            <input type="date" className="pl-8 border border-slate-300 p-2 rounded text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                        </div>
                    </div>
                    <div className="w-40">
                        <label className="block text-xs font-bold text-slate-600 mb-1">Tipo Documento</label>
                        <select className="w-full border border-slate-300 p-2 rounded text-sm" value={docType} onChange={e => setDocType(e.target.value)}>
                            <option value="ALL">TODOS</option>
                            <option value="FACTURA">FACTURA</option>
                            <option value="BOLETA">BOLETA</option>
                            <option value="NOTA_CREDITO">NOTA DE CRÉDITO</option>
                            <option value="GUIA">GUÍA DE REMISIÓN</option>
                        </select>
                    </div>
                    <div className="w-40">
                        <label className="block text-xs font-bold text-slate-600 mb-1">Estado Impresión</label>
                        <select className="w-full border border-slate-300 p-2 rounded text-sm bg-white" value={printStatusFilter} onChange={e => setPrintStatusFilter(e.target.value as any)}>
                            <option value="PENDING">POR IMPRIMIR</option>
                            <option value="PRINTED">YA IMPRESOS</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-600 mb-1">Búsqueda Rápida</label>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                className="w-full pl-8 border border-slate-300 p-2 rounded text-sm"
                                placeholder="Cliente, Serie o Correlativo..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <button 
                            onClick={fetchDocuments} 
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm flex items-center transition-colors disabled:opacity-50 h-[38px]"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                            Buscar en BD
                        </button>
                    </div>
                </div>
            </div>

            {/* --- GRID --- */}
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <button onClick={handleSelectAll} className="flex items-center text-sm font-bold text-slate-700 hover:text-blue-600">
                            {selectedIds.length > 0 && selectedIds.length === filteredDocs.length ? <CheckSquare className="w-5 h-5 mr-1 text-blue-600" /> : <Square className="w-5 h-5 mr-1 text-slate-400" />}
                            Seleccionar Todo
                        </button>
                        <span className="text-xs text-slate-500 ml-4">{selectedIds.length} seleccionados de {filteredDocs.length} visualizados</span>
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                            <tr>
                                <th className="p-3 w-10"></th>
                                <th className="p-3">Documento</th>
                                <th className="p-3">Emisión</th>
                                <th className="p-3">Cliente / Destino</th>
                                <th className="p-3 text-center">Estado SUNAT</th>
                                <th className="p-3 text-center">Estado Imp.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDocs.map(s => (
                                <tr
                                    key={s.id}
                                    className={`hover:bg-blue-50 cursor-pointer ${selectedIds.includes(s.id as string) ? 'bg-blue-50' : ''}`}
                                    onClick={() => handleToggleSelect(s)}
                                >
                                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(s.id as string)}
                                            onChange={() => handleToggleSelect(s)}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <span className={`font-bold font-mono px-2 py-0.5 rounded text-xs ${s.document_type === 'FACTURA' ? 'bg-purple-100 text-purple-800' : s.document_type === 'GUIA' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {s.document_type === 'GUIA' ? 'GR' : s.document_type.substring(0, 1)}
                                        </span>
                                        <span className="font-bold text-slate-700 ml-2">{s.series}-{s.number}</span>
                                    </td>
                                    <td className="p-3 text-slate-600">{new Date(s.date).toLocaleDateString()}</td>
                                    <td className="p-3 font-medium text-slate-800">
                                        {s.client_name}
                                    </td>
                                    <td className="p-3 text-center">
                                       {s.sunat_status === 'ACCEPTED' ? (
                                           <span className="text-green-600 font-bold text-[10px]"><FileText className="w-3 h-3 inline mr-1" />ACEPTADO</span>
                                       ) : s._isGuia && s.type !== 'GUIA_CONSOLIDADA' ? (
                                           <span className="text-red-500 font-bold text-[10px]">REQUERIDO</span>
                                       ) : (
                                           <span className="text-slate-400 font-bold text-[10px]">PENDIENTE</span>
                                       )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {s.printed ? (
                                            <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-1 rounded">IMPRESO</span>
                                        ) : (
                                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded border border-amber-200">PENDIENTE</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredDocs.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No se encontraron documentos.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};