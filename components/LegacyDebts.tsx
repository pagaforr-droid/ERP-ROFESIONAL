// LegacyDebts Component - Final Sync [PROCESO, EDITAR, REVERTIR, ELIMINAR]
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { LegacyDebt, LegacyCollectionSheet, LegacyCollectionSheetDetail, User } from '../types';
import { Upload, Search, DollarSign, Download, Filter, FileText, CheckCircle, XCircle, FileSpreadsheet, Loader2, ListPlus, Trash2, Printer, Lock, RotateCcw, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useStore } from '../services/store';

type Tab = 'IMPORT' | 'DEUDAS' | 'PLANILLA' | 'HISTORIAL' | 'REPORTS';

interface CartItem {
    debt: LegacyDebt;
    amount: number;
}

export const LegacyDebts: React.FC = () => {
    const { currentUser } = useStore();
    const [activeTab, setActiveTab] = useState<Tab>('DEUDAS');
    const [debts, setDebts] = useState<LegacyDebt[]>([]);
    const [sheets, setSheets] = useState<LegacyCollectionSheet[]>([]);
    const [sheetDetails, setSheetDetails] = useState<Record<string, LegacyCollectionSheetDetail[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [systemAlert, setSystemAlert] = useState<{ show: boolean, message: string, type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'info' });

    // Manage Tab State
    const [searchTerm, setSearchTerm] = useState('');
    const [sellerFilter, setSellerFilter] = useState('');

    // Payment Modal State (Individual)
    const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean, debt: LegacyDebt | null }>({ isOpen: false, debt: null });
    const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Planilla State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [responsibleName, setResponsibleName] = useState('');
    const [confirmProcessModal, setConfirmProcessModal] = useState(false);
    const [editingSheetId, setEditingSheetId] = useState<string | null>(null);

    // Revert & Delete Modals
    const [revertModal, setRevertModal] = useState<{ isOpen: boolean, sheetId: string | null }>({ isOpen: false, sheetId: null });
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, sheetId: string | null }>({ isOpen: false, sheetId: null });
    const [adminPassword, setAdminPassword] = useState('');

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

    const fetchSheets = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('legacy_collection_sheets').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setSheets(data || []);
        } catch (error: any) {
            console.error("Error fetching sheets:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSheetDetails = async (sheetId: string) => {
        if (sheetDetails[sheetId]) return; // Already fetched
        try {
            const { data, error } = await supabase.from('legacy_collection_sheet_details')
                .select('*, legacy_debt:legacy_debts(*)')
                .eq('sheet_id', sheetId);
            if (error) throw error;
            setSheetDetails(prev => ({ ...prev, [sheetId]: data || [] }));
        } catch (error: any) {
            console.error("Error fetching details:", error);
        }
    };

    useEffect(() => {
        if (activeTab === 'DEUDAS' || activeTab === 'PLANILLA' || activeTab === 'REPORTS') {
            fetchDebts();
        } else if (activeTab === 'HISTORIAL') {
            fetchSheets();
        }
    }, [activeTab]);

    const uniqueSellers = Array.from(new Set(debts.map(d => d.seller_name).filter(Boolean))).sort();

    // --- CART (PLANILLA) LOGIC ---
    const addToCart = (debt: LegacyDebt) => {
        if (cart.find(c => c.debt.id === debt.id)) return;
        setCart([...cart, { debt, amount: debt.balance }]);
        setSystemAlert({ show: true, message: 'Agregado a la planilla.', type: 'success' });
    };

    const removeFromCart = (debtId: string) => {
        setCart(cart.filter(c => c.debt.id !== debtId));
    };

    const updateCartAmount = (debtId: string, amount: number) => {
        setCart(cart.map(c => c.debt.id === debtId ? { ...c, amount } : c));
    };

    const cartTotal = cart.reduce((acc, curr) => acc + curr.amount, 0);

    const handleProcessClick = () => {
        if (!responsibleName.trim()) {
            setSystemAlert({ show: true, message: 'Debe ingresar el responsable de la planilla.', type: 'error' });
            return;
        }
        if (cart.length === 0) {
            setSystemAlert({ show: true, message: 'La planilla está vacía.', type: 'error' });
            return;
        }

        // Validate amounts
        for (const item of cart) {
            if (item.amount <= 0 || item.amount > item.debt.balance) {
                setSystemAlert({ show: true, message: `Monto inválido para el documento ${item.debt.doc_number}.`, type: 'error' });
                return;
            }
        }
        
        setConfirmProcessModal(true);
    };

    const handleProcessPlanilla = async () => {
        setIsProcessing(true);
        try {
            const itemsToProcess = cart.map(c => ({ debt_id: c.debt.id, amount: c.amount }));
            
            let data, error;

            if (editingSheetId) {
                const res = await supabase.rpc('update_legacy_sheet', {
                    p_sheet_id: editingSheetId,
                    p_responsible_name: responsibleName,
                    p_items: itemsToProcess,
                    p_user_id: currentUser?.id
                });
                data = res.data;
                error = res.error;
            } else {
                const res = await supabase.rpc('process_legacy_sheet', {
                    p_responsible_name: responsibleName,
                    p_items: itemsToProcess,
                    p_user_id: currentUser?.id
                });
                data = res.data;
                error = res.error;
            }

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            setSystemAlert({ show: true, message: editingSheetId ? 'Planilla actualizada correctamente.' : 'Planilla procesada exitosamente. Se ha inyectado a caja.', type: 'success' });
            setCart([]);
            setResponsibleName('');
            setEditingSheetId(null);
            fetchDebts();
            fetchSheets(); setActiveTab('HISTORIAL');
        } catch (error: any) {
            setSystemAlert({ show: true, message: `Error al procesar planilla: ${error.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRevertSheet = async () => {
        if (!revertModal.sheetId) return;

        // Verify Admin Password
        try {
            setIsProcessing(true);
            const { data: users, error: userError } = await supabase.from('erp_users').select('*').eq('role', 'ADMIN');
            if (userError) throw userError;

            const adminMatch = users.find((u: User) => u.password === adminPassword || u.pin_code === adminPassword);
            if (!adminMatch && adminPassword !== '123456') { // Fallback demo password
                throw new Error("Contraseña de administrador incorrecta.");
            }

            const { data, error } = await supabase.rpc('revert_legacy_sheet', {
                p_sheet_id: revertModal.sheetId,
                p_user_id: currentUser?.id
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            setSystemAlert({ show: true, message: 'Planilla revertida correctamente. Caja actualizada.', type: 'success' });
            setRevertModal({ isOpen: false, sheetId: null });
            setAdminPassword('');
            fetchSheets();
        } catch (error: any) {
            setSystemAlert({ show: true, message: `Error al revertir: ${error.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteSheet = async () => {
        if (!deleteModal.sheetId) return;

        try {
            setIsProcessing(true);
            const { data: users, error: userError } = await supabase.from('erp_users').select('*').eq('role', 'ADMIN');
            if (userError) throw userError;

            const adminMatch = users.find((u: User) => u.password === adminPassword || u.pin_code === adminPassword);
            if (!adminMatch && adminPassword !== '123456') { // Fallback demo password
                throw new Error("Contraseña de administrador incorrecta.");
            }

            const { data, error } = await supabase.rpc('delete_legacy_sheet', {
                p_sheet_id: deleteModal.sheetId,
                p_user_id: currentUser?.id
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            setSystemAlert({ show: true, message: 'Planilla eliminada definitivamente. Caja actualizada.', type: 'success' });
            setDeleteModal({ isOpen: false, sheetId: null });
            setAdminPassword('');
            fetchSheets();
            fetchDebts();
        } catch (error: any) {
            setSystemAlert({ show: true, message: `Error al eliminar: ${error.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEditSheet = async (sheet: LegacyCollectionSheet) => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('legacy_collection_sheet_details')
                .select('*, legacy_debt:legacy_debts(*)')
                .eq('sheet_id', sheet.id);
            if (error) throw error;
            
            const details = data || [];
            
            const newCart: CartItem[] = details.map((d: any) => {
                // Restore the balance in the UI so the user can edit the amount up to the original debt
                const restoredBalance = Number(d.legacy_debt.balance) + Number(d.amount_collected);
                return {
                    debt: { ...d.legacy_debt, balance: restoredBalance },
                    amount: d.amount_collected
                };
            });

            setCart(newCart);
            setResponsibleName(sheet.responsible_name);
            setEditingSheetId(sheet.id);
            setActiveTab('PLANILLA');
            setSystemAlert({ show: true, message: 'Planilla cargada para edición. Los saldos han sido restaurados temporalmente para su corrección.', type: 'info' });
        } catch (error: any) {
            setSystemAlert({ show: true, message: `Error cargando planilla: ${error.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // --- FILE UPLOAD ---
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
                setActiveTab('DEUDAS');
            } catch (error: any) {
                setSystemAlert({ show: true, message: `Error importando Excel: ${error.message}`, type: 'error' });
            } finally {
                setIsLoading(false);
                if (e.target) e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([{
            'VENDEDOR': 'EJEMPLO VENDEDOR',
            'CLIENTE': 'EJEMPLO CLIENTE',
            'FECHA DOC': '2024-01-01',
            'FECHA VEN': '2024-01-31',
            'TIPO DOC': 'FA',
            'NUMERO DOC': 'F001-000123',
            'SALDO': 1500.50
        }]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Migracion");
        XLSX.writeFile(wb, `Plantilla_Importacion_Migracion.xlsx`);
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

    const printSheetPDF = async (sheet: LegacyCollectionSheet) => {
        let details = sheetDetails[sheet.id];
        if (!details) {
            const { data, error } = await supabase.from('legacy_collection_sheet_details')
                .select('*, legacy_debt:legacy_debts(*)')
                .eq('sheet_id', sheet.id);
            if (error) {
                console.error("Error fetching details for PDF:", error);
                setSystemAlert({ show: true, message: 'Error cargando detalles para el PDF.', type: 'error' });
                return;
            }
            details = data || [];
            setSheetDetails(prev => ({ ...prev, [sheet.id]: details }));
        }

        const doc = new jsPDF();
        
        // Header
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("PLANILLA DE COBRANZA", 14, 20);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`ID Planilla: ${sheet.id.split('-')[0].toUpperCase()}`, 14, 28);
        doc.text(`Fecha: ${new Date(sheet.created_at).toLocaleString()}`, 14, 34);

        // Info Block
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("DATOS DE LA PLANILLA", 14, 50);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Responsable: ${sheet.responsible_name}`, 14, 58);
        doc.text(`Estado: ${sheet.status === 'PROCESSED' ? 'PROCESADO' : 'REVERTIDO'}`, 14, 64);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Recaudado: S/ ${sheet.total_amount.toFixed(2)}`, 14, 70);

        // Agrupar por vendedor
        const groupedBySeller: Record<string, any[]> = {};
        let generalTotal = 0;

        details.forEach((d: any) => {
            const seller = d.legacy_debt?.seller_name || 'SIN VENDEDOR';
            if (!groupedBySeller[seller]) groupedBySeller[seller] = [];
            groupedBySeller[seller].push(d);
            generalTotal += Number(d.amount_collected);
        });

        const tableBody: any[] = [];
        
        for (const [seller, items] of Object.entries(groupedBySeller)) {
            // Header del Vendedor
            tableBody.push([
                { content: `VENDEDOR: ${seller}`, colSpan: 4, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', textColor: [50, 50, 50] } }
            ]);

            let sellerSubtotal = 0;
            items.forEach((d: any) => {
                tableBody.push([
                    d.legacy_debt?.client_name || 'Desconocido',
                    `${d.legacy_debt?.doc_type} ${d.legacy_debt?.doc_number}`,
                    `S/ ${Number(d.previous_balance).toFixed(2)}`,
                    `S/ ${Number(d.amount_collected).toFixed(2)}`
                ]);
                sellerSubtotal += Number(d.amount_collected);
            });

            // Subtotal del Vendedor
            tableBody.push([
                { content: 'SUBTOTAL VENDEDOR', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
                { content: `S/ ${sellerSubtotal.toFixed(2)}`, styles: { fontStyle: 'bold', textColor: [79, 70, 229] } }
            ]);
        }

        // Total General
        tableBody.push([
            { content: 'TOTAL GENERAL DE LA PLANILLA', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [79, 70, 229], textColor: 255 } },
            { content: `S/ ${generalTotal.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [79, 70, 229], textColor: 255 } }
        ]);

        autoTable(doc, {
            startY: 80,
            head: [['Cliente', 'Documento', 'Deuda Anterior', 'Monto Cobrado']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 },
            styles: { fontSize: 9 }
        });

        doc.save(`Planilla_Cobranza_${sheet.id.split('-')[0]}.pdf`);
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
                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('IMPORT')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'IMPORT' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-slate-100'}`}>
                        Importar
                    </button>
                    <button onClick={() => setActiveTab('DEUDAS')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'DEUDAS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-100 hover:bg-slate-100'}`}>
                        Deudas
                    </button>
                    <button onClick={() => setActiveTab('PLANILLA')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'PLANILLA' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-slate-100'}`}>
                        Crear Planilla {cart.length > 0 && <span className="ml-2 bg-white text-indigo-600 px-2 py-0.5 rounded-full text-xs">{cart.length}</span>}
                    </button>
                    <button onClick={() => setActiveTab('HISTORIAL')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'HISTORIAL' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-slate-100'}`}>
                        Historial Planillas
                    </button>
                    <button onClick={() => setActiveTab('REPORTS')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'REPORTS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-slate-100'}`}>
                        Reportes
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                    </div>
                )}

                {/* --- TAB: IMPORT --- */}
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
                        <div className="flex flex-col sm:flex-row gap-4">
                            <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold cursor-pointer transition-colors shadow-lg hover:shadow-xl flex items-center justify-center">
                                <Upload className="w-5 h-5 mr-2" />
                                Seleccionar Archivo Excel
                                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={isLoading} />
                            </label>
                            <button onClick={downloadTemplate} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-8 py-3 rounded-xl font-bold transition-colors border border-slate-300 shadow-sm flex items-center justify-center">
                                <Download className="w-5 h-5 mr-2" />
                                Descargar Plantilla
                            </button>
                        </div>
                    </div>
                )}

                {/* --- TAB: DEUDAS & REPORTS --- */}
                {(activeTab === 'DEUDAS' || activeTab === 'REPORTS') && (
                    <div className="flex flex-col h-full">
                        <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-6 border-b border-slate-200">
                            {editingSheetId && (
                                <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg font-bold flex items-center border border-amber-200 w-full md:w-auto">
                                    <Pencil className="w-5 h-5 mr-2" /> Editando Planilla
                                </div>
                            )}
                            <div className="flex-1 w-full relative">
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
                                        <th className="p-4">Vencimiento</th>
                                        <th className="p-4 text-right">Saldo Deuda</th>
                                        {activeTab === 'DEUDAS' && <th className="p-4 text-center">Acción</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredDebts.length > 0 ? filteredDebts.map((debt) => {
                                        const inCart = cart.some(c => c.debt.id === debt.id);
                                        return (
                                            <tr key={debt.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-medium text-slate-700">{debt.seller_name}</td>
                                                <td className="p-4 font-bold text-slate-800">{debt.client_name}</td>
                                                <td className="p-4">
                                                    <span className="bg-slate-200 px-2 py-1 rounded text-xs font-bold text-slate-700 mr-2">{debt.doc_type}</span>
                                                    <span className="font-mono text-slate-600">{debt.doc_number}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${new Date(debt.due_date) < new Date() ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {debt.due_date}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-black text-rose-600 text-base">S/ {debt.balance.toFixed(2)}</td>
                                                {activeTab === 'DEUDAS' && (
                                                    <td className="p-4 text-center">
                                                        <button 
                                                            onClick={() => inCart ? removeFromCart(debt.id) : addToCart(debt)} 
                                                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors border flex items-center mx-auto gap-1 ${inCart ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white'}`}
                                                        >
                                                            {inCart ? <><Trash2 className="w-3 h-3" /> Quitar</> : <><ListPlus className="w-3 h-3" /> A Planilla</>}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                                                No hay deudas pendientes.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- TAB: PLANILLA CART --- */}
                {activeTab === 'PLANILLA' && (
                    <div className="flex flex-col h-full bg-slate-50">
                        <div className="p-6 bg-white border-b border-slate-200 flex flex-col md:flex-row gap-6 items-start md:items-end">
                            <div className="flex-1 w-full">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Responsable de la Planilla</label>
                                <input
                                    type="text"
                                    placeholder="Ej. Juan Pérez (Cobrador)"
                                    className="w-full border-2 border-slate-200 p-3 rounded-xl text-slate-800 font-bold focus:border-indigo-500 outline-none"
                                    value={responsibleName}
                                    onChange={(e) => setResponsibleName(e.target.value)}
                                />
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 w-full md:w-64">
                                <p className="text-xs text-indigo-500 font-bold uppercase mb-1">Total a Recaudar</p>
                                <p className="text-3xl font-black text-indigo-700">S/ {cartTotal.toFixed(2)}</p>
                            </div>
                            {editingSheetId && (
                                <button 
                                    onClick={() => {
                                        setCart([]);
                                        setResponsibleName('');
                                        setEditingSheetId(null);
                                    }}
                                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-4 rounded-xl font-bold transition-colors w-full md:w-auto"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button 
                                onClick={handleProcessClick}
                                disabled={isProcessing || cart.length === 0}
                                className={`${editingSheetId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:bg-slate-300 text-white px-8 py-4 rounded-xl font-black shadow-lg flex items-center justify-center transition-colors w-full md:w-auto`}
                            >
                                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : editingSheetId ? <><Pencil className="w-6 h-6 mr-2" /> Actualizar Planilla</> : <><CheckCircle className="w-6 h-6 mr-2" /> Procesar a Caja</>}
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-6">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <FileSpreadsheet className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="font-bold">La planilla está vacía.</p>
                                    <p className="text-sm">Ve a la pestaña "Deudas" y agrega documentos.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {cart.map((item, index) => (
                                        <div key={item.debt.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-4">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center shrink-0">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-800">{item.debt.client_name}</p>
                                                <p className="text-sm text-slate-500">{item.debt.doc_type} {item.debt.doc_number} • Vendedor: {item.debt.seller_name}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xs text-slate-400 font-bold mb-1">Saldo Original</p>
                                                <p className="font-bold text-slate-600">S/ {item.debt.balance.toFixed(2)}</p>
                                            </div>
                                            <div className="w-48 shrink-0 relative">
                                                <label className="text-xs text-indigo-500 font-bold absolute -top-5 left-0">Monto a Cobrar</label>
                                                <input
                                                    type="number"
                                                    className="w-full border-2 border-indigo-200 bg-indigo-50/50 p-2.5 rounded-lg text-indigo-700 font-black text-right focus:border-indigo-500 outline-none"
                                                    value={item.amount || ''}
                                                    onChange={(e) => updateCartAmount(item.debt.id, Number(e.target.value))}
                                                    max={item.debt.balance}
                                                />
                                            </div>
                                            <button onClick={() => removeFromCart(item.debt.id)} className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- TAB: HISTORIAL PLANILLAS --- */}
                {activeTab === 'HISTORIAL' && (
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Responsable</th>
                                    <th className="p-4 text-right">Total Recaudado</th>
                                    <th className="p-4 text-center">Estado</th>
                                    <th className="p-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sheets.length > 0 ? sheets.map((sheet) => (
                                    <React.Fragment key={sheet.id}>
                                        <tr className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-slate-600">{new Date(sheet.created_at).toLocaleString()}</td>
                                            <td className="p-4 font-bold text-slate-800">{sheet.responsible_name}</td>
                                            <td className="p-4 text-right font-black text-emerald-600 text-base">S/ {sheet.total_amount.toFixed(2)}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${sheet.status === 'PROCESSED' ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'}`}>
                                                    {sheet.status === 'PROCESSED' ? 'PROCESADO' : 'REVERTIDO'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center flex justify-center gap-2">
                                                <button onClick={() => printSheetPDF(sheet)} className="bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white p-2 rounded-lg transition-colors">
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                {sheet.status === 'PROCESSED' && (
                                                    <>
                                                        <button onClick={() => handleEditSheet(sheet)} className="bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white px-3 py-2 rounded-lg font-bold text-xs transition-colors flex items-center">
                                                            <Pencil className="w-3 h-3 mr-1" /> Editar
                                                        </button>
                                                        <button onClick={() => setRevertModal({ isOpen: true, sheetId: sheet.id })} className="bg-red-50 text-red-500 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg font-bold text-xs transition-colors flex items-center">
                                                            <RotateCcw className="w-3 h-3 mr-1" /> Revertir
                                                        </button>
                                                    </>
                                                )}
                                                <button onClick={() => setDeleteModal({ isOpen: true, sheetId: sheet.id })} className="bg-slate-50 text-slate-500 hover:bg-slate-800 hover:text-white px-3 py-2 rounded-lg font-bold text-xs transition-colors flex items-center">
                                                    <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                                            No hay planillas generadas aún.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- REVERT MODAL --- */}
            {revertModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
                        <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                            <RotateCcw className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 text-center mb-2">Revertir Planilla</h3>
                        <p className="text-sm text-slate-500 text-center mb-6">Esta acción anulará el ingreso en caja y restaurará la deuda a los clientes. Requiere PIN de administrador.</p>
                        
                        <div className="mb-6 relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                autoFocus
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-red-500 outline-none text-center font-black tracking-widest"
                                placeholder="PIN / CONTRASEÑA"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => { setRevertModal({ isOpen: false, sheetId: null }); setAdminPassword(''); }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleRevertSheet}
                                disabled={isProcessing || !adminPassword}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center"
                            >
                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- CONFIRM PROCESS MODAL --- */}
            {confirmProcessModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
                        <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 text-center mb-2">Confirmar Planilla</h3>
                        <p className="text-sm text-slate-500 text-center mb-6">
                            ¿Estás seguro de procesar esta planilla? Se generará un ingreso en caja por <strong className="text-slate-800">S/ {cartTotal.toFixed(2)}</strong>.
                        </p>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmProcessModal(false)}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => {
                                    setConfirmProcessModal(false);
                                    handleProcessPlanilla();
                                }}
                                disabled={isProcessing}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg flex items-center justify-center"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* --- DELETE MODAL --- */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
                        <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-800">
                            <Trash2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 text-center mb-2">Eliminar Definitivamente</h3>
                        <p className="text-sm text-slate-500 text-center mb-6">Esta acción borrará la planilla y eliminará sus movimientos de caja. No se puede deshacer. Requiere PIN de administrador.</p>
                        
                        <div className="mb-6 relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                autoFocus
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-500 outline-none text-center font-black tracking-widest"
                                placeholder="PIN / CONTRASEÑA"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => { setDeleteModal({ isOpen: false, sheetId: null }); setAdminPassword(''); }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDeleteSheet}
                                disabled={isProcessing || !adminPassword}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center"
                            >
                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
