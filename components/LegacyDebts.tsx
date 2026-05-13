import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { LegacyDebt } from '../types';
import { Upload, Search, DollarSign, Download, Filter, FileText, CheckCircle, XCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useStore } from '../services/store';

type Tab = 'IMPORT' | 'MANAGE' | 'REPORTS';

export const LegacyDebts: React.FC = () => {
    const { currentUser } = useStore();
    const [activeTab, setActiveTab] = useState<Tab>('MANAGE');
    const [debts, setDebts] = useState<LegacyDebt[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [systemAlert, setSystemAlert] = useState<{ show: boolean, message: string, type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'info' });

    // Manage Tab State
    const [searchTerm, setSearchTerm] = useState('');
    const [sellerFilter, setSellerFilter] = useState('');

    // Payment Modal State
    const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean, debt: LegacyDebt | null }>({ isOpen: false, debt: null });
    const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Fetch Debts
    const fetchDebts = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('legacy_debts').select('*').eq('is_active', true).order('due_date', { ascending: true });
            if (error) throw error;
            setDebts(data || []);
        } catch (error: any) {
            console.error("Error fetching legacy debts:", error);
            setSystemAlert({ show: true, message: 'Error cargando cuentas por cobrar.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'MANAGE' || activeTab === 'REPORTS') {
            fetchDebts();
        }
    }, [activeTab]);

    // Unique Sellers for Filters
    const uniqueSellers = Array.from(new Set(debts.map(d => d.seller_name).filter(Boolean))).sort();

    // Handlers
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) throw new Error("El archivo está vacío.");

                const formattedDebts = data.map((row: any) => {
                    // Validar columnas y formatear
                    const getVal = (keyStr: string) => {
                        const key = Object.keys(row).find(k => k.toLowerCase().includes(keyStr.toLowerCase()));
                        return key ? row[key] : '';
                    };

                    const parseDate = (val: any) => {
                        if (!val) return new Date().toISOString().split('T')[0];
                        if (typeof val === 'number') {
                            const date = new Date((val - (25567 + 2)) * 86400 * 1000);
                            return date.toISOString().split('T')[0];
                        }
                        return val;
                    };

                    const balance = Number(getVal('saldo') || getVal('balance') || getVal('monto') || 0);

                    return {
                        seller_name: String(getVal('vendedor') || 'SIN VENDEDOR').toUpperCase(),
                        client_name: String(getVal('cliente') || 'SIN CLIENTE').toUpperCase(),
                        doc_date: parseDate(getVal('fecha doc') || getVal('fecha')),
                        due_date: parseDate(getVal('fecha ven') || getVal('vencimiento') || getVal('fecha doc') || getVal('fecha')),
                        doc_type: String(getVal('tipo') || getVal('doc')).toUpperCase(),
                        doc_number: String(getVal('numero') || getVal('num') || getVal('comprobante')).toUpperCase(),
                        original_amount: balance,
                        balance: balance,
                        is_active: true
                    };
                });

                const { error } = await supabase.from('legacy_debts').insert(formattedDebts);
                if (error) throw error;

                setSystemAlert({ show: true, message: `Se importaron ${formattedDebts.length} registros exitosamente.`, type: 'success' });
                setActiveTab('MANAGE');
            } catch (error: any) {
                setSystemAlert({ show: true, message: `Error importando Excel: ${error.message}`, type: 'error' });
            } finally {
                setIsLoading(false);
                if (e.target) e.target.value = ''; // Reset input
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleProcessPayment = async () => {
        if (!paymentModal.debt || !paymentAmount || paymentAmount <= 0) return;
        if (paymentAmount > paymentModal.debt.balance) {
            setSystemAlert({ show: true, message: 'El pago no puede superar el saldo actual.', type: 'error' });
            return;
        }

        setIsProcessing(true);
        try {
            const { data, error } = await supabase.rpc('process_legacy_collection', {
                p_debt_id: paymentModal.debt.id,
                p_amount: Number(paymentAmount),
                p_user_id: currentUser?.id
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            setSystemAlert({ show: true, message: 'Pago registrado exitosamente. Se ha inyectado a caja.', type: 'success' });
            setPaymentModal({ isOpen: false, debt: null });
            setPaymentAmount('');
            fetchDebts();
        } catch (error: any) {
            setSystemAlert({ show: true, message: `Error al procesar pago: ${error.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    // Reports Handlers
    const filteredDebts = debts.filter(d => {
        const matchesSearch = d.client_name.toLowerCase().includes(searchTerm.toLowerCase()) || d.doc_number.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSeller = sellerFilter ? d.seller_name === sellerFilter : true;
        return matchesSearch && matchesSeller;
    });

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredDebts.map(d => ({
            'VENDEDOR': d.seller_name,
            'CLIENTE': d.client_name,
            'FECHA EMISION': d.doc_date,
            'FECHA VENCIMIENTO': d.due_date,
            'TIPO DOC': d.doc_type,
            'NUMERO DOC': d.doc_number,
            'SALDO PENDIENTE': d.balance
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Saldos");
        XLSX.writeFile(wb, `Cuentas_Por_Cobrar_Migracion_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("Reporte de Cuentas por Cobrar (Migración)", 14, 15);
        doc.setFontSize(10);
        if (sellerFilter) doc.text(`Vendedor: ${sellerFilter}`, 14, 22);

        autoTable(doc, {
            startY: 25,
            head: [['Vendedor', 'Cliente', 'Doc', 'Número', 'Emisión', 'Vencimiento', 'Saldo']],
            body: filteredDebts.map(d => [
                d.seller_name,
                d.client_name,
                d.doc_type,
                d.doc_number,
                d.doc_date,
                d.due_date,
                `S/ ${d.balance.toFixed(2)}`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] }
        });

        doc.save(`Reporte_Cuentas_Cobrar_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            {systemAlert.show && (
                <div className={`mb-4 p-4 rounded-lg flex items-center justify-between ${systemAlert.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : systemAlert.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
                    <div className="flex items-center">
                        {systemAlert.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <XCircle className="w-5 h-5 mr-2" />}
                        <span className="font-bold">{systemAlert.message}</span>
                    </div>
                    <button onClick={() => setSystemAlert({ ...systemAlert, show: false })}><XCircle className="w-5 h-5 opacity-50 hover:opacity-100" /></button>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center">
                        <FileSpreadsheet className="w-6 h-6 mr-3 text-indigo-600" /> Cuentas por Cobrar (Migración)
                    </h1>
                    <p className="text-slate-500 text-sm">Gestiona y cobra saldos iniciales de sistemas anteriores.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setActiveTab('IMPORT')} className={`px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'IMPORT' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
                        Importar
                    </button>
                    <button onClick={() => setActiveTab('MANAGE')} className={`px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'MANAGE' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
                        Planilla Cobranza
                    </button>
                    <button onClick={() => setActiveTab('REPORTS')} className={`px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'REPORTS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
                        Reportes
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                    </div>
                )}

                {activeTab === 'IMPORT' && (
                    <div className="p-10 flex flex-col items-center justify-center h-full text-center">
                        <div className="bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center mb-6">
                            <Upload className="w-12 h-12 text-indigo-500" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Importar Saldos Iniciales</h2>
                        <p className="text-slate-500 mb-8 max-w-md">
                            Sube un archivo Excel (.xlsx). El sistema buscará automáticamente las columnas: <br/>
                            <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs text-slate-600">Vendedor, Cliente, Fecha Doc, Fecha Ven, Tipo, Numero, Saldo</span>
                        </p>
                        <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold cursor-pointer transition-colors shadow-lg hover:shadow-xl">
                            Seleccionar Archivo Excel
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={isLoading} />
                        </label>
                    </div>
                )}

                {(activeTab === 'MANAGE' || activeTab === 'REPORTS') && (
                    <div className="flex flex-col h-full">
                        <div className="p-4 border-b border-slate-200 flex gap-4 bg-slate-50">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por cliente o número de documento..."
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="relative w-64">
                                <Filter className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none appearance-none bg-white font-medium text-slate-700"
                                    value={sellerFilter}
                                    onChange={(e) => setSellerFilter(e.target.value)}
                                >
                                    <option value="">Todos los Vendedores</option>
                                    {uniqueSellers.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            {activeTab === 'REPORTS' && (
                                <div className="ml-auto flex gap-2">
                                    <button onClick={exportToExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold transition-colors">
                                        <FileSpreadsheet className="w-4 h-4" /> Excel
                                    </button>
                                    <button onClick={exportToPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-colors">
                                        <FileText className="w-4 h-4" /> PDF
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="p-4">Vendedor</th>
                                        <th className="p-4">Cliente</th>
                                        <th className="p-4">Documento</th>
                                        <th className="p-4">Emisión</th>
                                        <th className="p-4">Vencimiento</th>
                                        <th className="p-4 text-right">Saldo Deuda</th>
                                        {activeTab === 'MANAGE' && <th className="p-4 text-center">Acción</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredDebts.length > 0 ? filteredDebts.map((debt) => (
                                        <tr key={debt.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 font-medium text-slate-700">{debt.seller_name}</td>
                                            <td className="p-4 font-bold text-slate-800">{debt.client_name}</td>
                                            <td className="p-4">
                                                <span className="bg-slate-200 px-2 py-1 rounded text-xs font-bold text-slate-700 mr-2">{debt.doc_type}</span>
                                                <span className="font-mono text-slate-600">{debt.doc_number}</span>
                                            </td>
                                            <td className="p-4 text-slate-500">{debt.doc_date}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${new Date(debt.due_date) < new Date() ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {debt.due_date}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-black text-rose-600 text-base">S/ {debt.balance.toFixed(2)}</td>
                                            {activeTab === 'MANAGE' && (
                                                <td className="p-4 text-center">
                                                    <button onClick={() => setPaymentModal({ isOpen: true, debt })} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors border border-indigo-200 hover:border-indigo-600 flex items-center mx-auto gap-1">
                                                        <DollarSign className="w-3 h-3" /> Cobrar
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                                                No hay deudas pendientes que coincidan con los filtros.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {paymentModal.isOpen && paymentModal.debt && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
                        <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center">
                            <DollarSign className="w-6 h-6 mr-2 text-emerald-500" /> Registrar Cobranza
                        </h3>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                            <p className="text-xs text-slate-500 font-bold uppercase mb-1">Cliente</p>
                            <p className="font-bold text-slate-800 mb-3">{paymentModal.debt.client_name}</p>
                            
                            <div className="flex justify-between">
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Documento</p>
                                    <p className="font-medium text-slate-700">{paymentModal.debt.doc_type} {paymentModal.debt.doc_number}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Saldo Actual</p>
                                    <p className="font-black text-rose-600">S/ {paymentModal.debt.balance.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Monto a Cobrar (S/)</label>
                            <input
                                type="number"
                                autoFocus
                                className="w-full text-2xl font-black text-slate-900 p-3 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-right"
                                placeholder="0.00"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                                max={paymentModal.debt.balance}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => { setPaymentModal({ isOpen: false, debt: null }); setPaymentAmount(''); }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleProcessPayment}
                                disabled={isProcessing || !paymentAmount}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center"
                            >
                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Pago'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
