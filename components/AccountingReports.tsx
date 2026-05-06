import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { FileSpreadsheet, Calendar, Download, Building2, ShoppingBag, Receipt, AlertCircle, FileText, Loader2, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Sale, Purchase, Supplier } from '../types';

export const AccountingReports: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);

    // --- SUPABASE DATA STATES ---
    const [sales, setSales] = useState<Sale[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    // --- UI STATE ---
    const [activeTab, setActiveTab] = useState<'VENTAS' | 'COMPRAS' | 'CAJA' | 'KARDEX'>('VENTAS');
    
    // --- DATE FILTERS ---
    const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

    // --- FETCH DATA FROM SUPABASE ---
    const fetchData = async () => {
       setIsLoading(true);
       try {
          const startDate = `${dateFrom}T00:00:00.000Z`;
          const endDate = `${dateTo}T23:59:59.999Z`;

          const [salesRes, purchasesRes, suppliersRes] = await Promise.all([
             supabase.from('sales').select('*').gte('created_at', startDate).lte('created_at', endDate),
             supabase.from('purchases').select('*').gte('issue_date', startDate).lte('issue_date', endDate),
             supabase.from('suppliers').select('*')
          ]);

          if (salesRes.data) setSales(salesRes.data);
          if (purchasesRes.data) setPurchases(purchasesRes.data);
          if (suppliersRes.data) setSuppliers(suppliersRes.data);

       } catch (err) {
          console.error("Error fetching accounting data", err);
       } finally {
          setIsLoading(false);
       }
    };

    useEffect(() => {
       fetchData();
    }, [dateFrom, dateTo]); // Refetch when dates change

    // --- DATA PROCESSING: REGISTRO DE VENTAS (SIRE FORMAT BASE) ---
    const salesData = useMemo(() => {
        return sales.filter(s => {
            const isAccountingDoc = ['FACTURA', 'BOLETA', 'NOTA_CREDITO', 'NOTA_DEBITO'].includes(s.document_type || '');
            return isAccountingDoc;
        }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }, [sales]);

    // --- DATA PROCESSING: REGISTRO DE COMPRAS (SIRE FORMAT BASE) ---
    const purchasesData = useMemo(() => {
        return purchases.sort((a, b) => new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime());
    }, [purchases]);

    // --- EXPORT LOGIC: REGISTRO DE VENTAS (FORMATO 14.1 SIRE) ---
    const exportSalesToExcel = () => {
        if (salesData.length === 0) {
            alert("No hay datos para exportar en este rango de fechas.");
            return;
        }

        const exportData = salesData.map(sale => {
            const isCanceled = sale.status === 'canceled';
            const isNC = sale.document_type === 'NOTA_CREDITO';
            const multiplier = isCanceled ? 0 : (isNC ? -1 : 1);

            let docTypeCode = '03'; // Boleta
            if (sale.document_type === 'FACTURA') docTypeCode = '01';
            if (sale.document_type === 'NOTA_CREDITO') docTypeCode = '07';
            if (sale.document_type === 'NOTA_DEBITO') docTypeCode = '08';

            let clientIdType = '1'; // DNI
            if (sale.client_ruc && sale.client_ruc.length === 11) clientIdType = '6'; // RUC
            if (sale.document_type === 'BOLETA' && sale.client_name.toUpperCase() === 'CLIENTE VARIOS') clientIdType = '0';

            const total = isCanceled ? 0 : ((sale.total || 0) * multiplier);
            const baseImponible = isCanceled ? 0 : (total / 1.18);
            const igv = isCanceled ? 0 : (total - baseImponible);

            // Extract modified document from observation if it's a Credit Note
            let modDate = '';
            let modType = '';
            let modSerie = '';
            let modNumber = '';

            if (isNC && sale.observation) {
                // Example: Referencia a FACTURA F001-00101
                const match = sale.observation.match(/(FACTURA|BOLETA)\s+([F|B][A-Z0-9]{3})-([0-9]+)/i);
                if (match) {
                    modType = match[1].toUpperCase() === 'FACTURA' ? '01' : '03';
                    modSerie = match[2].toUpperCase();
                    modNumber = match[3];
                    // Attempt to find original date in memory
                    const origSale = sales.find(s => s.series === modSerie && s.number === modNumber && s.document_type === match[1].toUpperCase());
                    if (origSale) {
                        modDate = new Date(origSale.created_at).toLocaleDateString('es-PE');
                    }
                }
            }

            const estadoSire = isCanceled ? '2' : '1';

            return {
                'Periodo': dateFrom.substring(0, 7).replace('-', '') + '00',
                'CUO': sale.id,
                'Correlativo': 'M0001',
                'Fecha Emisión': new Date(sale.created_at).toLocaleDateString('es-PE'),
                'Fecha Vencimiento': '',
                'Tipo Comprobante': docTypeCode,
                'Serie': sale.series || '',
                'Número': sale.number || '',
                'Nro Final Ticket': '',
                'Tipo Doc Cliente': clientIdType,
                'RUC/DNI Cliente': isCanceled ? '0' : (sale.client_ruc || ''),
                'Razón Social Cliente': isCanceled ? 'ANULADO' : sale.client_name,
                'Valor Facturado Exportación': '0.00',
                'Base Imp. Operación Gravada': baseImponible.toFixed(2),
                'Descuento Base Imponible': '0.00',
                'IGV / IPM': igv.toFixed(2),
                'Descuento IGV / IPM': '0.00',
                'Monto Exonerado': '0.00',
                'Monto Inafecto': '0.00',
                'ISC': '0.00',
                'Base Imponible IVAP': '0.00',
                'IVAP': '0.00',
                'ICBPER': '0.00',
                'Otros Tributos': '0.00',
                'Importe Total': total.toFixed(2),
                'Moneda': 'PEN',
                'Tipo Cambio': '1.000',
                'Fecha Emisión Doc Modificado': modDate,
                'Tipo Doc Modificado': modType,
                'Serie Doc Modificado': modSerie,
                'Nro Doc Modificado': modNumber,
                'ID Contrato Socios': '',
                'Error Tipo 1': '',
                'Ind. Comprobante Cancelado': '1',
                'Estado SIRE': estadoSire
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        
        const colWidths = [
            { wch: 10 }, { wch: 38 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, 
            { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 40 }, 
            { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, 
            { wch: 16 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, 
            { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, 
            { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 12 }
        ];
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registro Ventas 14.1");
        
        XLSX.writeFile(wb, `Registro_Ventas_14_1_${dateFrom}_al_${dateTo}.xlsx`);
    };

    // --- EXPORT LOGIC: REGISTRO DE COMPRAS (FORMATO 8.1 SIRE) ---
    const exportPurchasesToExcel = () => {
        if (purchasesData.length === 0) {
            alert("No hay datos para exportar en este rango de fechas.");
            return;
        }

        const exportData = purchasesData.map(purchase => {
            const total = purchase.total || 0;
            const baseImponible = total / 1.18;
            const igv = total - baseImponible;

            const supplier = suppliers.find(s => s.id === purchase.supplier_id);
            
            let docTypeCode = '00';
            if (purchase.document_type === 'FACTURA') docTypeCode = '01';
            if (purchase.document_type === 'BOLETA') docTypeCode = '03';
            if (purchase.document_type === 'NOTA_CREDITO') docTypeCode = '07';
            
            let serie = purchase.document_number?.split('-')[0] || '';
            let numero = purchase.document_number?.split('-')[1] || purchase.document_number || '';

            return {
                'Periodo': dateFrom.substring(0, 7).replace('-', '') + '00',
                'CUO': purchase.id,
                'Correlativo': 'M0001',
                'Fecha Emisión': new Date(purchase.issue_date).toLocaleDateString('es-PE'),
                'Fecha Vencimiento': purchase.due_date ? new Date(purchase.due_date).toLocaleDateString('es-PE') : '',
                'Tipo Comprobante': docTypeCode,
                'Serie': serie,
                'Año Emisión DUA': '',
                'Número': numero,
                'Nro Final Ticket': '',
                'Tipo Doc Proveedor': '6',
                'Nro Doc Proveedor': supplier?.ruc || '',
                'Razón Social Proveedor': supplier?.name || 'PROVEEDOR DESCONOCIDO',
                'Base Imp. Gravadas': baseImponible.toFixed(2),
                'IGV Gravadas': igv.toFixed(2),
                'Base Imp. Mixtas': '0.00',
                'IGV Mixtas': '0.00',
                'Base Imp. No Gravadas': '0.00',
                'IGV No Gravadas': '0.00',
                'Adquisiciones No Gravadas': '0.00',
                'ISC': '0.00',
                'ICBPER': '0.00',
                'Otros Tributos': '0.00',
                'Importe Total': total.toFixed(2),
                'Moneda': purchase.currency || 'PEN',
                'Tipo de Cambio': (purchase.exchange_rate || 1.000).toFixed(3),
                'Fecha Emisión Doc Modificado': '',
                'Tipo Doc Modificado': '',
                'Serie Doc Modificado': '',
                'Cod DUA Referencia': '',
                'Nro Doc Modificado': '',
                'Fecha Constancia Depósito': '',
                'Nro Constancia Depósito': '',
                'Marca Retención': '',
                'Estado SIRE': '1'
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        
        const colWidths = [
            { wch: 10 }, { wch: 38 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, 
            { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 16 }, { wch: 16 }, 
            { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, 
            { wch: 15 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, 
            { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 20 }, 
            { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 12 }
        ];
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registro Compras 8.1");
        
        XLSX.writeFile(wb, `Registro_Compras_8_1_${dateFrom}_al_${dateTo}.xlsx`);
    };

    return (
        <div className="h-full flex flex-col font-sans text-slate-800 bg-slate-50 p-4 space-y-4">
            {/* HEADER */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-5">
                    <h2 className="text-2xl font-black flex items-center text-slate-800 tracking-tight">
                        <FileSpreadsheet className="mr-3 w-8 h-8 text-blue-600" /> Reportes Contables (SIRE)
                    </h2>
                    <div className="flex gap-3">
                        <button onClick={fetchData} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center font-bold">
                           <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Sincronizar
                        </button>
                        <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                            <button
                                onClick={() => setActiveTab('VENTAS')}
                                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center transition-all ${activeTab === 'VENTAS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Receipt className="w-4 h-4 mr-2" /> Ventas
                            </button>
                            <button
                                onClick={() => setActiveTab('COMPRAS')}
                                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center transition-all ${activeTab === 'COMPRAS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <ShoppingBag className="w-4 h-4 mr-2" /> Compras
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 items-end">
                    <div className="flex-1 max-w-xs">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Fecha Inicio</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                            <input
                                type="date"
                                className="w-full pl-10 pr-4 py-2 border-2 border-slate-200 rounded-xl font-bold focus:border-blue-500 outline-none transition-colors"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 max-w-xs">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Fecha Fin</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                            <input
                                type="date"
                                className="w-full pl-10 pr-4 py-2 border-2 border-slate-200 rounded-xl font-bold focus:border-blue-500 outline-none transition-colors"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 uppercase tracking-widest text-sm flex items-center">
                        <FileText className="w-4 h-4 mr-2" /> Vista Previa: Registro de {activeTab === 'VENTAS' ? 'Ventas' : 'Compras'}
                    </h3>
                    {activeTab === 'VENTAS' ? (
                        <button
                            onClick={exportSalesToExcel}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors"
                            disabled={isLoading}
                        >
                            <Download className="w-4 h-4 mr-2" /> Exportar SIRE (Ventas)
                        </button>
                    ) : (
                        <button
                            onClick={exportPurchasesToExcel}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors"
                            disabled={isLoading}
                        >
                            <Download className="w-4 h-4 mr-2" /> Exportar SIRE (Compras)
                        </button>
                    )}
                </div>

                <div className="p-4 bg-blue-50 border-b border-blue-100">
                    <div className="flex items-start text-sm text-blue-800">
                        <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                        <p>
                            <strong>Aviso Legal SUNAT:</strong> Este reporte está estructurado para facilitar la declaración a través del Módulo SIRE (Sistema Integrado de Registros Electrónicos). Valide los montos con su contador antes de realizar la declaración jurada mensual.
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                   {isLoading ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                         <Loader2 className="w-12 h-12 mb-4 animate-spin text-blue-500" />
                         <p className="font-bold">Generando reporte contable...</p>
                      </div>
                   ) : activeTab === 'VENTAS' ? (
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                                <tr>
                                    <th className="p-3 border-b border-slate-200">Fecha</th>
                                    <th className="p-3 border-b border-slate-200">Comprobante</th>
                                    <th className="p-3 border-b border-slate-200">Cliente (RUC/DNI)</th>
                                    <th className="p-3 border-b border-slate-200 text-right">Base Imp.</th>
                                    <th className="p-3 border-b border-slate-200 text-right">IGV</th>
                                    <th className="p-3 border-b border-slate-200 text-right">Total</th>
                                    <th className="p-3 border-b border-slate-200 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {salesData.map(s => {
                                    const isCanceled = s.status === 'canceled';
                                    const isNC = s.document_type === 'NOTA_CREDITO';
                                    const multiplier = isCanceled ? 0 : (isNC ? -1 : 1);
                                    
                                    const total = (s.total || 0) * multiplier;
                                    const base = total / 1.18;
                                    const igv = total - base;

                                    return (
                                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 font-mono text-slate-500">{new Date(s.created_at).toLocaleDateString('es-PE')}</td>
                                            <td className="p-3 font-bold text-slate-800">{s.document_type} {s.series}-{s.number}</td>
                                            <td className="p-3 text-slate-700">
                                                {isCanceled ? <span className="text-rose-500 font-bold">ANULADO</span> : (
                                                    <>
                                                        <span className="font-mono text-slate-500 mr-2">{s.client_ruc}</span>
                                                        <span className="font-bold">{s.client_name}</span>
                                                    </>
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-mono">{base.toFixed(2)}</td>
                                            <td className="p-3 text-right font-mono">{igv.toFixed(2)}</td>
                                            <td className="p-3 text-right font-mono font-bold text-blue-700">{total.toFixed(2)}</td>
                                            <td className="p-3 text-center">
                                                {isCanceled ? (
                                                    <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold">ANULADO</span>
                                                ) : (
                                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">ACTIVO</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {salesData.length === 0 && (
                                    <tr><td colSpan={7} className="p-8 text-center text-slate-400">No hay ventas contabilizables en este periodo.</td></tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                                <tr>
                                    <th className="p-3 border-b border-slate-200">Fecha Emi.</th>
                                    <th className="p-3 border-b border-slate-200">Comprobante</th>
                                    <th className="p-3 border-b border-slate-200">Proveedor (RUC)</th>
                                    <th className="p-3 border-b border-slate-200 text-right">Base Imp.</th>
                                    <th className="p-3 border-b border-slate-200 text-right">IGV</th>
                                    <th className="p-3 border-b border-slate-200 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {purchasesData.map(p => {
                                    const supplier = suppliers.find(s => s.id === p.supplier_id);
                                    const total = p.total || 0;
                                    const base = total / 1.18;
                                    const igv = total - base;

                                    return (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 font-mono text-slate-500">{new Date(p.issue_date).toLocaleDateString('es-PE')}</td>
                                            <td className="p-3 font-bold text-slate-800">{p.document_type} {p.document_number}</td>
                                            <td className="p-3 text-slate-700">
                                                <span className="font-mono text-slate-500 mr-2">{supplier?.ruc}</span>
                                                <span className="font-bold">{supplier?.name}</span>
                                            </td>
                                            <td className="p-3 text-right font-mono">{base.toFixed(2)}</td>
                                            <td className="p-3 text-right font-mono">{igv.toFixed(2)}</td>
                                            <td className="p-3 text-right font-mono font-bold text-blue-700">{total.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                                {purchasesData.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay compras en este periodo.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
