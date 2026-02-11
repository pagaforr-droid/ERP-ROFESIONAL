import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Printer, Search, Filter, Calendar, CheckSquare, Square, FileText } from 'lucide-react';
import { PrintableInvoice } from './PrintableInvoice';
import { Sale } from '../types';

export const PrintBatch: React.FC = () => {
   const { sales, clients, company } = useStore();

   // Filters
   const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
   const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
   const [docType, setDocType] = useState('ALL');
   const [searchTerm, setSearchTerm] = useState('');

   // Selection
   const [selectedIds, setSelectedIds] = useState<string[]>([]);

   // Print State
   const [isPrinting, setIsPrinting] = useState(false);

   // --- FILTER LOGIC ---
   const filteredSales = sales.filter(s => {
      const date = s.created_at.split('T')[0];
      const matchesDate = date >= dateFrom && date <= dateTo;
      const matchesType = docType === 'ALL' || s.document_type === docType;
      const matchesSearch = s.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         s.number.includes(searchTerm) ||
         s.series.includes(searchTerm);

      return matchesDate && matchesType && matchesSearch;
   });

   const handleToggleSelect = (id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
   };

   const handleSelectAll = () => {
      if (selectedIds.length === filteredSales.length) {
         setSelectedIds([]);
      } else {
         setSelectedIds(filteredSales.map(s => s.id));
      }
   };

   const salesToPrint = sales.filter(s => selectedIds.includes(s.id));

   return (
      <div className="h-full flex flex-col space-y-4">
         {/* PRINT OVERLAY */}
         {isPrinting && (
            <PrintableInvoice
               company={company}
               sales={salesToPrint}
               onClose={() => setIsPrinting(false)}
            />
         )}

         <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
               <Printer className="mr-2 text-accent" /> Impresión Masiva de Documentos
            </h2>
            {selectedIds.length > 0 && (
               <button
                  onClick={() => setIsPrinting(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded font-bold shadow-lg flex items-center animate-pulse"
               >
                  <Printer className="w-5 h-5 mr-2" /> IMPRIMIR ({selectedIds.length}) DOCUMENTOS
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
                     onClick={() => { setDateFrom(new Date().toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]); setDocType('ALL'); setSearchTerm(''); }}
                     className="text-xs text-blue-600 font-bold hover:underline"
                  >
                     Limpiar Filtros
                  </button>
               </div>
            </div>
         </div>

         {/* --- GRID --- */}
         <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
               <div className="flex items-center gap-2">
                  <button onClick={handleSelectAll} className="flex items-center text-sm font-bold text-slate-700 hover:text-blue-600">
                     {selectedIds.length > 0 && selectedIds.length === filteredSales.length ? <CheckSquare className="w-5 h-5 mr-1 text-blue-600" /> : <Square className="w-5 h-5 mr-1 text-slate-400" />}
                     Seleccionar Todo
                  </button>
                  <span className="text-xs text-slate-500 ml-4">{selectedIds.length} seleccionados de {filteredSales.length} encontrados</span>
               </div>
            </div>
            <div className="flex-1 overflow-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                     <tr>
                        <th className="p-3 w-10"></th>
                        <th className="p-3">Documento</th>
                        <th className="p-3">Emisión</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 text-center">Estado Imp.</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {filteredSales.map(s => (
                        <tr
                           key={s.id}
                           className={`hover:bg-blue-50 cursor-pointer ${selectedIds.includes(s.id) ? 'bg-blue-50' : ''}`}
                           onClick={() => handleToggleSelect(s.id)}
                        >
                           <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                              <input
                                 type="checkbox"
                                 checked={selectedIds.includes(s.id)}
                                 onChange={() => handleToggleSelect(s.id)}
                                 className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                              />
                           </td>
                           <td className="p-3">
                              <span className={`font-bold font-mono px-2 py-0.5 rounded text-xs ${s.document_type === 'FACTURA' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                 {s.document_type.substring(0, 1)}
                              </span>
                              <span className="font-bold text-slate-700 ml-2">{s.series}-{s.number}</span>
                           </td>
                           <td className="p-3 text-slate-600">{new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString().substring(0, 5)}</td>
                           <td className="p-3 font-medium text-slate-800">
                              {s.client_name}
                              <div className="text-xs text-slate-400 font-mono">{s.client_ruc}</div>
                           </td>
                           <td className="p-3 text-right font-bold text-slate-900">S/ {s.total.toFixed(2)}</td>
                           <td className="p-3 text-center">
                              <FileText className="w-4 h-4 mx-auto text-slate-400" />
                           </td>
                        </tr>
                     ))}
                     {filteredSales.length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">No se encontraron documentos con los filtros actuales.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
   );
};