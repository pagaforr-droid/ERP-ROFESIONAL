import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { FileSpreadsheet, Calendar, Download, Building2, ShoppingBag, Receipt, AlertCircle, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Sale, Purchase } from '../types';

export const AccountingReports: React.FC = () => {
    const store = useStore();
    
    // --- UI STATE ---
    const [activeTab, setActiveTab] = useState<'VENTAS' | 'COMPRAS' | 'CAJA' | 'KARDEX'>('VENTAS');
    
    // --- DATE FILTERS ---
    const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]); // Start of current month
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

    // --- DATA PROCESSING: REGISTRO DE VENTAS (SIRE FORMAT BASE) ---
    const salesData = useMemo(() => {
        return store.sales.filter(s => {
            const date = s.created_at.split('T')[0];
            const isValidDate = date >= dateFrom && date <= dateTo;
            // Facturas, Boletas, NC, ND
            const isAccountingDoc = ['FACTURA', 'BOLETA', 'NOTA_CREDITO', 'NOTA_DEBITO'].includes(s.document_type || '');
            return isValidDate && isAccountingDoc;
        }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }, [store.sales, dateFrom, dateTo]);

    // --- DATA PROCESSING: REGISTRO DE COMPRAS (SIRE FORMAT BASE) ---
    const purchasesData = useMemo(() => {
        // Assuming you have a purchases array in your store. If not, this is a placeholder/safe fallback.
        const purchases: Purchase[] = (store as any).purchases || [];
        return purchases.filter(p => {
            const date = p.issue_date.split('T')[0];
            return date >= dateFrom && date <= dateTo;
        }).sort((a, b) => new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime());
    }, [store, dateFrom, dateTo]);

    // --- EXPORT LOGIC: REGISTRO DE VENTAS ---
    const exportSalesToExcel = () => {
        if (salesData.length === 0) {
            alert("No hay datos para exportar en este rango de fechas.");
            return;
        }

        // Map to SIRE-like structure (Simplified for general accounting use)
        const exportData = salesData.map(sale => {
            const isCanceled = sale.status === 'canceled';
            const isNC = sale.document_type === 'NOTA_CREDITO';
            
            // If canceled, amounts are usually reported as 0 or the document is marked. SUNAT SIRE requires 0s for annulled.
            const multiplier = isCanceled ? 0 : (isNC ? -1 : 1);

            let docTypeCode = '03'; // Boleta
            if (sale.document_type === 'FACTURA') docTypeCode = '01';
            if (sale.document_type === 'NOTA_CREDITO') docTypeCode = '07';
            if (sale.document_type === 'NOTA_DEBITO') docTypeCode = '08';

            let clientIdType = '1'; // DNI format
            if (sale.client_ruc && sale.client_ruc.length === 11) clientIdType = '6'; // RUC
            if (sale.document_type === 'BOLETA' && sale.client_name.toUpperCase() === 'CLIENTE VARIOS') clientIdType = '0'; // Sin RUC/DNI

            // Calculations (assuming sale.total is with IGV)
            // If the system handles exonerated, this logic needs expansion. 
            // Assuming standard 18% IGV for all for this basic version.
            const total = (sale.total || 0) * multiplier;
            const baseImponible = total / 1.18;
            const igv = total - baseImponible;

            return {
                'Periodo': dateFrom.substring(0, 7).replace('-', ''), // e.g., 202603
                'Fecha de Emisión': new Date(sale.created_at).toLocaleDateString('es-PE'),
                'Fecha Vencimiento': '', // Often same for cash sales
                'Tipo Comprobante': docTypeCode,
                'Serie': sale.series || '',
                'Número': sale.number || '',
                'Tipo Doc. Identidad': clientIdType,
                'Número Doc. Identidad': isCanceled ? '0' : (sale.client_ruc || ''),
                'Razón Social / Nombres': isCanceled ? 'ANULADO' : sale.client_name,
                'Valor Facturado Exportación': 0.00,
                'Base Imponible Operación Gravada': baseImponible.toFixed(2),
                'Descuento Base Imponible': 0.00,
                'IGV / IPM': igv.toFixed(2),
                'Descuento IGV / IPM': 0.00,
                'Monto Exonerado': 0.00,
                'Monto Inafecto': 0.00,
                'ISC': 0.00,
                'ICBPER': 0.00,
                'Otros Tributos': 0.00,
                'Importe Total': total.toFixed(2),
                'Moneda': 'PEN',
                'Tipo Cambio': 1.000,
                'Fecha Emisión Doc Modificado': '', // For NC
                'Tipo Doc Modificado': '', // For NC
                'Serie Doc Modificado': '', // For NC
                'Número Doc Modificado': '', // For NC
                'Estado Venta': isCanceled ? 'ANULADO' : 'ACTIVO'
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Auto-sizing columns (basic approach)
        const colWidths = [
            { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, 
            { wch: 18 }, { wch: 18 }, { wch: 40 }, { wch: 22 }, { wch: 28 }, 
            { wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, 
            { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 8 }
        ];
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registro Ventas");
        
        XLSX.writeFile(wb, `Registro_Ventas_${dateFrom}_al_${dateTo}.xlsx`);
    };

    // --- EXPORT LOGIC: REGISTRO DE COMPRAS ---
    const exportPurchasesToExcel = () => {
        if (purchasesData.length === 0) {
            alert("No hay datos para exportar en este rango de fechas.");
            return;
        }

        const exportData = purchasesData.map(purchase => {
            // Calculations
            const total = purchase.total || 0;
            const baseImponible = total / 1.18; // Assuming entirely gravado 18% for simplicity
            const igv = total - baseImponible;

            // Find supplier info
            const supplier = store.suppliers.find(s => s.id === purchase.supplier_id);

            return {
                'Periodo': dateFrom.substring(0, 7).replace('-', ''),
                'Fecha de Emisión': new Date(purchase.issue_date).toLocaleDateString('es-PE'),
                'Fecha Vencimiento': new Date(purchase.due_date).toLocaleDateString('es-PE'),
                'Tipo Comprobante': purchase.document_type === 'FACTURA' ? '01' : (purchase.document_type === 'BOLETA' ? '03' : '00'),
                'Serie': purchase.document_number?.split('-')[0] || '',
                'Número': purchase.document_number?.split('-')[1] || purchase.document_number || '',
                'Tipo Doc. Proveedor': '6', // RUC assumed for suppliers
                'Número Doc. Proveedor': supplier?.ruc || '',
                'Razón Social Proveedor': supplier?.name || 'PROVEEDOR DESCONOCIDO',
                'Base Imponible Destino Ventas Gravadas': baseImponible.toFixed(2),
                'IGV / IPM Destino Ventas Gravadas': igv.toFixed(2),
                'Base Imponible Destino Ventas Gravadas y No Gravadas': 0.00,
                'IGV / IPM Destino Ventas Gravadas y No Gravadas': 0.00,
                'Base Imponible Destino Ventas No Gravadas': 0.00,
                'IGV / IPM Destino Ventas No Gravadas': 0.00,
                'Valor Adquisiciones No Gravadas': 0.00,
                'ISC': 0.00,
                'ICBPER': 0.00,
                'Otros Conceptos': 0.00,
                'Importe Total': total.toFixed(2),
                'Moneda': 'PEN',
                'Tipo Cambio': 1.000,
                'Estado': purchase.payment_status === 'PAID' ? 'PAGADO' : 'PENDIENTE'
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registro Compras");
        XLSX.writeFile(wb, `Registro_Compras_${dateFrom}_al_${dateTo}.xlsx`);
    };

    return (
        <div className="flex flex-col h-full space-y-4 font-sans text-slate-800">
            
            {/* --- HEADER --- */}
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-600 rounded-xl text-white shadow-inner">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reportes Contables (SUNAT)</h2>
                        <p className="text-sm text-slate-500 font-medium">Exportación estructurada para SIRE, Concar y SISCONT</p>
                    </div>
                </div>
                
                {/* GLOBAL FILTERS */}
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-300 shadow-sm">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-500 uppercase">Desde</span>
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-sm font-bold text-slate-800 focus:ring-0 w-32 outline-none" 
                            value={dateFrom} 
                            onChange={e => setDateFrom(e.target.value)} 
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-300 shadow-sm">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-500 uppercase">Hasta</span>
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-sm font-bold text-slate-800 focus:ring-0 w-32 outline-none" 
                            value={dateTo} 
                            onChange={e => setDateTo(e.target.value)} 
                        />
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT AREA --- */}
            <div className="flex gap-6 h-full overflow-hidden">
                
                {/* SIDEBAR NAVIGATION */}
                <div className="w-64 flex flex-col gap-2">
                    <button 
                        onClick={() => setActiveTab('VENTAS')}
                        className={`text-left px-4 py-4 rounded-xl font-bold transition-all flex items-center gap-3 border ${activeTab === 'VENTAS' ? 'bg-white border-blue-500 text-blue-700 shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'}`}
                    >
                        <Receipt className={`w-5 h-5 ${activeTab === 'VENTAS' ? 'text-blue-500' : 'text-slate-400'}`} />
                        <div>
                            Registro de Ventas
                            <div className={`text-[10px] font-normal ${activeTab === 'VENTAS' ? 'text-blue-500' : 'text-slate-400'}`}>Formato 14.1 (SIRE)</div>
                        </div>
                    </button>
                    
                    <button 
                        onClick={() => setActiveTab('COMPRAS')}
                        className={`text-left px-4 py-4 rounded-xl font-bold transition-all flex items-center gap-3 border ${activeTab === 'COMPRAS' ? 'bg-white border-blue-500 text-blue-700 shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'}`}
                    >
                        <ShoppingBag className={`w-5 h-5 ${activeTab === 'COMPRAS' ? 'text-blue-500' : 'text-slate-400'}`} />
                        <div>
                            Registro de Compras
                            <div className={`text-[10px] font-normal ${activeTab === 'COMPRAS' ? 'text-blue-500' : 'text-slate-400'}`}>Formato 8.1 (SIRE)</div>
                        </div>
                    </button>

                    <button 
                        onClick={() => setActiveTab('CAJA')}
                        className={`text-left px-4 py-4 rounded-xl font-bold transition-all flex items-center gap-3 border ${activeTab === 'CAJA' ? 'bg-white border-blue-500 text-blue-700 shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'}`}
                    >
                        <FileText className={`w-5 h-5 ${activeTab === 'CAJA' ? 'text-blue-500' : 'text-slate-400'}`} />
                        <div>
                            Libro Caja y Bancos
                            <div className={`text-[10px] font-normal ${activeTab === 'CAJA' ? 'text-blue-500' : 'text-slate-400'}`}>Detalle Movimientos</div>
                        </div>
                    </button>
                </div>

                {/* TAB CONTENT */}
                <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                    
                    {/* VENTAS TAB */}
                    {activeTab === 'VENTAS' && (
                        <>
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">Pre-visualización: Registro de Ventas</h3>
                                    <p className="text-sm text-slate-500 mt-1">Se encontraron <span className="font-bold text-blue-600">{salesData.length}</span> documentos contables en el rango seleccionado.</p>
                                </div>
                                <button 
                                    onClick={exportSalesToExcel}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-all"
                                >
                                    <FileSpreadsheet className="w-5 h-5" /> Exportar SIRE (Excel)
                                </button>
                            </div>
                            
                            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 m-4 flex items-start gap-3 rounded-r text-sm text-orange-800">
                                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                                <div>
                                    <strong className="font-bold">Nota Contable:</strong> Los documentos anulados (Estado: Anulado) aparecerán en el Excel con montos S/ 0.00 y los datos del cliente vacíos o indicando "ANULADO", conforme a la normativa de SUNAT para mantener el correlativo.
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-4 pt-0">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                                        <tr>
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3">Tipo</th>
                                            <th className="p-3">Serie-Nro</th>
                                            <th className="p-3">Cliente</th>
                                            <th className="p-3 text-right text-blue-700">Base Imp.</th>
                                            <th className="p-3 text-right text-blue-700">IGV</th>
                                            <th className="p-3 text-right font-black">Total</th>
                                            <th className="p-3 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {salesData.slice(0, 100).map((sale) => {
                                            const isCanceled = sale.status === 'canceled';
                                            const multiplier = isCanceled ? 0 : (sale.document_type === 'NOTA_CREDITO' ? -1 : 1);
                                            const total = (sale.total || 0) * multiplier;
                                            const base = total / 1.18;
                                            const igv = total - base;

                                            return (
                                                <tr key={sale.id} className={`hover:bg-slate-50 transition-colors ${isCanceled ? 'opacity-50' : ''}`}>
                                                    <td className="p-3 text-slate-600">{new Date(sale.created_at).toLocaleDateString()}</td>
                                                    <td className="p-3 font-bold text-slate-700">{sale.document_type}</td>
                                                    <td className="p-3 font-medium">{sale.series}-{sale.number}</td>
                                                    <td className="p-3 max-w-[200px] truncate" title={sale.client_name}>{isCanceled ? 'ANULADO' : sale.client_name}</td>
                                                    <td className="p-3 text-right">S/ {base.toFixed(2)}</td>
                                                    <td className="p-3 text-right">S/ {igv.toFixed(2)}</td>
                                                    <td className="p-3 text-right font-bold">S/ {total.toFixed(2)}</td>
                                                    <td className="p-3 text-center">
                                                        {isCanceled ? 
                                                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">ANULADO</span> : 
                                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">ACTIVO</span>
                                                        }
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {salesData.length === 0 && (
                                            <tr><td colSpan={8} className="p-8 text-center text-slate-400">No hay ventas registradas en este mes.</td></tr>
                                        )}
                                        {salesData.length > 100 && (
                                            <tr><td colSpan={8} className="p-4 text-center text-slate-500 font-bold bg-slate-50">Mostrando los primeros 100 registros. Exporte a Excel para ver todos.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* COMPRAS TAB */}
                    {activeTab === 'COMPRAS' && (
                        <>
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">Pre-visualización: Registro de Compras</h3>
                                    <p className="text-sm text-slate-500 mt-1">Se encontraron <span className="font-bold text-blue-600">{purchasesData.length}</span> compras en el rango seleccionado.</p>
                                </div>
                                <button 
                                    onClick={exportPurchasesToExcel}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-all"
                                >
                                    <FileSpreadsheet className="w-5 h-5" /> Exportar SIRE (Excel)
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-auto p-4">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                                        <tr>
                                            <th className="p-3">F. Emisión</th>
                                            <th className="p-3">Doc. Proveedor</th>
                                            <th className="p-3">Proveedor</th>
                                            <th className="p-3 text-right text-blue-700">Base Imp.</th>
                                            <th className="p-3 text-right text-blue-700">IGV</th>
                                            <th className="p-3 text-right font-black">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {purchasesData.map((purchase) => {
                                            const total = purchase.total || 0;
                                            const base = total / 1.18;
                                            const igv = total - base;
                                            const supplier = store.suppliers.find(s => s.id === purchase.supplier_id);

                                            return (
                                                <tr key={purchase.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-3 text-slate-600">{new Date(purchase.issue_date).toLocaleDateString()}</td>
                                                    <td className="p-3 font-medium">{purchase.document_type} {purchase.document_number}</td>
                                                    <td className="p-3 max-w-[200px] truncate" title={supplier?.name || 'Varios'}>{supplier?.name || 'PROVEEDOR VARIOS'}</td>
                                                    <td className="p-3 text-right">S/ {base.toFixed(2)}</td>
                                                    <td className="p-3 text-right">S/ {igv.toFixed(2)}</td>
                                                    <td className="p-3 text-right font-bold">S/ {total.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                        {purchasesData.length === 0 && (
                                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay compras registradas en este mes.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* CAJA / BANCOS TAB */}
                    {activeTab === 'CAJA' && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                            <div className="bg-slate-100 p-6 rounded-full mb-4">
                                <FileText className="w-16 h-16 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">Libro de Caja y Bancos</h3>
                            <p className="max-w-md">Esta sección está en desarrollo. Permite exportar los movimientos consolidados de ingresos y egresos para conciliación bancaria.</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
