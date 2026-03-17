import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../services/store';
import { Printer, Search, Calendar, CheckSquare, Square, FileText, X } from 'lucide-react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { PdfDocument } from './PdfDocument';

export const PrintBatch: React.FC = () => {
    const { sales, dispatchSheets, company, markDocumentsAsPrinted, products, clients } = useStore();
    const companyInfo = company;

    // Filters
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [docType, setDocType] = useState('ALL');
    const [printStatusFilter, setPrintStatusFilter] = useState<'PENDING' | 'PRINTED'>('PENDING');
    const [searchTerm, setSearchTerm] = useState('');

    // Selection
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedDocsInfo, setSelectedDocsInfo] = useState<any[]>([]);

    useEffect(() => {
        setSelectedIds([]);
        setSelectedDocsInfo([]);
    }, [dateFrom, dateTo, docType, printStatusFilter, searchTerm]);

    // Print Preview Mode
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    // --- FILTER LOGIC ---
    const allDocuments = useMemo(() => {
        const mappedSales = sales.map(s => ({ ...s, _isGuia: false, date: s.created_at.split('T')[0] }));
        
        const mappedGuias = dispatchSheets.map(d => {
           // Aggregate items for Guia
           let guiaItems: any[] = [];
           let totalWeight = 0;
           
           const dSales = sales.filter(s => d.sale_ids.includes(s.id));
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
    }, [sales, dispatchSheets, products]);

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

    const handleOpenPreview = () => {
        // Validate SUNAT Rules before printing Guides
        const invalidGuias = selectedDocsInfo.filter(d => 
           d._isGuia && 
           !(d.type === 'GUIA_CONSOLIDADA') && // Consolidated allowed
           (d.sunat_status !== 'ACCEPTED') // Must be accepted otherwise
        );

        if (invalidGuias.length > 0) {
           alert(`No se pueden imprimir ${invalidGuias.length} Guía(s) de Remisión porque aún no han sido aceptadas por SUNAT. Envíelas primero desde el módulo SUNAT.`);
           return;
        }

        setIsPreviewOpen(true);
    };

    const handleMarkAsPrinted = () => {
        markDocumentsAsPrinted(selectedIds);
        setIsPreviewOpen(false);
        setSelectedIds([]);
        setSelectedDocsInfo([]);
    };

    return (
        <div className="h-full flex flex-col space-y-4 relative">
            
            {/* --- PDF NATIVE VIEWER OVERLAY --- */}
            {isPreviewOpen && (
                <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col">
                    <div className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-lg">
                        <div className="flex items-center gap-3">
                            <Printer className="w-5 h-5 text-blue-400" />
                            <h2 className="font-bold">Vista Previa Nativa PDF ({selectedDocsInfo.length} documentos)</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handleMarkAsPrinted}
                                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                            >
                                Marcar como Impresos (Finalizar)
                            </button>
                            <button 
                                onClick={() => setIsPreviewOpen(false)}
                                className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg text-sm font-bold transition-colors"
                                title="Cerrar Visor"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 w-full bg-slate-600 p-4">
                        {/* Currently showing only the first document in the UI viewer due to @react-pdf/renderer limitations dynamically rendering hundreds of pages in dev mode, but in production we can map over <Page> components. */}
                        {selectedDocsInfo.length > 0 && (
                            <PDFViewer width="100%" height="100%" className="border-0 rounded shadow-2xl">
                                <PdfDocument 
                                   data={selectedDocsInfo[0]} 
                                   type={selectedDocsInfo[0]._isGuia ? 'GUIA' : selectedDocsInfo[0].document_type} 
                                   companyInfo={companyInfo as any} 
                                />
                            </PDFViewer>
                        )}
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