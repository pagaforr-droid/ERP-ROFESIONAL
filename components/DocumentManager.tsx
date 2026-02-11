
import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Sale, LiquidationDocument } from '../types';
import { Search, Printer, Eye, FileText, Filter, X, Calendar, Download } from 'lucide-react';
import { PrintableInvoice } from './PrintableInvoice';

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
  const { sales, dispatchLiquidations, company } = useStore();

  // --- STATE ---
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('ALL'); // ALL, FACTURA, BOLETA, NOTA_CREDITO
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedDoc, setSelectedDoc] = useState<DisplayDocument | null>(null); // For Modal Detail
  const [printDoc, setPrintDoc] = useState<Sale | null>(null); // For Printing

  // --- DATA UNIFICATION ---
  const allDocuments: DisplayDocument[] = useMemo(() => {
    const docs: DisplayDocument[] = [];

    // 1. Process Sales (Facturas & Boletas)
    sales.forEach(sale => {
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
        items: sale.items,
        originalRef: sale
      });
    });

    // 2. Process Credit Notes from Liquidations
    dispatchLiquidations.forEach(liq => {
      liq.documents.forEach((doc: LiquidationDocument) => {
        if (doc.action === 'PARTIAL_RETURN' && doc.amount_credit_note > 0) {
           // Find original sale to get client data
           const originalSale = sales.find(s => s.id === doc.sale_id);
           
           docs.push({
             id: `${liq.id}-${doc.sale_id}`, // Virtual ID
             source: 'NC',
             documentType: 'NOTA_CREDITO',
             series: doc.credit_note_series?.split('-')[0] || 'NC01',
             number: doc.credit_note_series?.split('-')[1] || '000000',
             date: liq.date,
             clientName: originalSale?.client_name || 'CLIENTE DESCONOCIDO',
             clientDoc: originalSale?.client_ruc || '00000000',
             total: doc.amount_credit_note,
             items: doc.returned_items.map(ri => ({
                product_sku: 'RET-' + ri.product_id.substring(0,4),
                product_name: ri.product_name,
                quantity_presentation: ri.quantity_presentation,
                selected_unit: ri.unit_type === 'MIXTO' ? 'UND' : ri.unit_type,
                unit_price: ri.unit_price,
                total_price: ri.total_refund,
                discount_amount: 0,
                is_bonus: false
             })),
             originalRef: {
                ...originalSale, // Mock a Sale object for the Printer
                document_type: 'NOTA DE CREDITO',
                series: doc.credit_note_series?.split('-')[0] || 'NC01',
                number: doc.credit_note_series?.split('-')[1] || '000000',
                total: doc.amount_credit_note,
                subtotal: doc.amount_credit_note / 1.18,
                igv: doc.amount_credit_note - (doc.amount_credit_note / 1.18),
                items: doc.returned_items.map(ri => ({
                    product_sku: 'RET',
                    product_name: `DEVOLUCIÓN: ${ri.product_name}`,
                    quantity_presentation: ri.quantity_presentation,
                    selected_unit: 'UND',
                    unit_price: ri.unit_price,
                    total_price: ri.total_refund,
                    discount_amount: 0
                }))
             }
           });
        }
      });
    });

    // Sort by Date Descending
    return docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, dispatchLiquidations]);

  // --- FILTERING ---
  const filteredDocs = allDocuments.filter(d => {
     const docDate = d.date.split('T')[0];
     const dateMatch = docDate >= dateFrom && docDate <= dateTo;
     
     const typeMatch = filterType === 'ALL' || d.documentType === filterType;
     
     const term = searchTerm.toLowerCase();
     const searchMatch = d.clientName.toLowerCase().includes(term) || 
                         d.number.includes(term) || 
                         d.clientDoc.includes(term) ||
                         d.series.toLowerCase().includes(term);

     return dateMatch && typeMatch && searchMatch;
  });

  // --- HANDLERS ---
  const handlePrint = (doc: DisplayDocument) => {
     setPrintDoc(doc.originalRef);
  };

  const getBadgeColor = (type: string) => {
     if (type === 'FACTURA') return 'bg-purple-100 text-purple-800 border-purple-200';
     if (type === 'BOLETA') return 'bg-blue-100 text-blue-800 border-blue-200';
     if (type === 'NOTA_CREDITO') return 'bg-orange-100 text-orange-800 border-orange-200';
     return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="flex flex-col h-full space-y-4">
       {/* PRINT COMPONENT */}
       {printDoc && (
          <PrintableInvoice 
             company={company} 
             sales={[printDoc]} 
             onClose={() => setPrintDoc(null)} 
          />
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
                            {new Date(doc.date).toLocaleDateString()} <span className="text-[10px] text-slate-400">{new Date(doc.date).toLocaleTimeString().substring(0,5)}</span>
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

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                   <div className="text-xs text-slate-500">
                      Fecha Emisión: {new Date(selectedDoc.date).toLocaleString()}
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
    </div>
  );
};
