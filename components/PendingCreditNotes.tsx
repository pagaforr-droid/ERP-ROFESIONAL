import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Sale } from '../types';
import { Search, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useStore } from '../services/store';

export const PendingCreditNotes: React.FC = () => {
    const { user } = useStore();
    const [pendingNCs, setPendingNCs] = useState<Sale[]>([]);
    const [selectedNC, setSelectedNC] = useState<Sale | null>(null);
    const [clientInvoices, setClientInvoices] = useState<Sale[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);
    const [applyAmount, setApplyAmount] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);
    
    // Notification State
    const [notification, setNotification] = useState<{show: boolean, type: 'success'|'error', msg: string}>({show: false, type: 'success', msg: ''});

    const fetchPendingNCs = async () => {
        try {
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .eq('document_type', 'NOTA_CREDITO')
                .gt('balance', 0)
                .neq('status', 'canceled')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setPendingNCs(data as Sale[]);
        } catch (e) {
            console.error("Error fetching pending NCs:", e);
        }
    };

    const fetchClientInvoices = async (clientId: string) => {
        try {
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .in('document_type', ['FACTURA', 'BOLETA'])
                .eq('client_id', clientId)
                .gt('balance', 0)
                .neq('status', 'canceled')
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            setClientInvoices(data as Sale[]);
        } catch (e) {
            console.error("Error fetching client invoices:", e);
        }
    };

    useEffect(() => {
        fetchPendingNCs();
    }, []);

    const handleSelectNC = (nc: Sale) => {
        setSelectedNC(nc);
        setSelectedInvoice(null);
        setApplyAmount(0);
        if (nc.client_id) {
            fetchClientInvoices(nc.client_id);
        }
    };

    const handleSelectInvoice = (invoice: Sale) => {
        setSelectedInvoice(invoice);
        if (selectedNC) {
            const maxApplicable = Math.min(selectedNC.balance || 0, invoice.balance || 0);
            setApplyAmount(maxApplicable);
        }
    };

    const handleApply = async () => {
        if (!selectedNC || !selectedInvoice || applyAmount <= 0) return;
        
        if (applyAmount > (selectedNC.balance || 0) || applyAmount > (selectedInvoice.balance || 0)) {
            setNotification({ show: true, type: 'error', msg: 'El monto supera el saldo disponible.' });
            return;
        }

        setIsSaving(true);
        try {
            const { data, error } = await supabase.rpc('apply_credit_note_to_invoice', {
                p_nc_id: selectedNC.id,
                p_invoice_id: selectedInvoice.id,
                p_amount: applyAmount,
                p_user_id: user?.id || null
            });

            if (error) throw error;

            setNotification({ show: true, type: 'success', msg: 'Saldo aplicado correctamente.' });
            
            // Refrescar datos
            setSelectedNC(null);
            setSelectedInvoice(null);
            setApplyAmount(0);
            fetchPendingNCs();

            // Ocultar notificacion despues de 3s
            setTimeout(() => setNotification({show: false, type: 'success', msg: ''}), 3000);

        } catch (e: any) {
            setNotification({ show: true, type: 'error', msg: 'Error: ' + e.message });
            setTimeout(() => setNotification({show: false, type: 'success', msg: ''}), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 gap-4">
            {notification.show && (
                <div className={`p-4 rounded-lg flex items-center font-bold text-sm ${notification.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <ShieldAlert className="w-5 h-5 mr-2" />}
                    {notification.msg}
                </div>
            )}

            <div className="flex gap-4 h-[calc(100vh-180px)]">
                {/* Lado Izquierdo: NCs Pendientes */}
                <div className="w-1/2 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
                    <div className="bg-indigo-50 p-3 border-b border-indigo-100">
                        <h3 className="font-black text-indigo-800 flex items-center text-sm">
                            <ArrowRight className="w-4 h-4 mr-2" /> Notas de Crédito con Saldo a Favor
                        </h3>
                    </div>
                    <div className="flex-1 overflow-auto p-2">
                        {pendingNCs.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold flex-col">
                                <Search className="w-10 h-10 mb-2 opacity-20" />
                                No hay Notas de Crédito pendientes
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {pendingNCs.map(nc => (
                                    <div 
                                        key={nc.id} 
                                        onClick={() => handleSelectNC(nc)}
                                        className={`p-3 rounded border cursor-pointer transition-all ${selectedNC?.id === nc.id ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-bold text-slate-800 text-sm">{nc.series}-{nc.number}</div>
                                            <div className="font-black text-emerald-600 text-sm">S/ {nc.balance?.toFixed(2)}</div>
                                        </div>
                                        <div className="text-xs text-slate-500 font-bold">{nc.client_name}</div>
                                        <div className="text-[10px] text-slate-400">{new Date(nc.created_at).toLocaleDateString()}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lado Derecho: Facturas del Cliente */}
                <div className="w-1/2 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
                    <div className="bg-slate-50 p-3 border-b border-slate-200">
                        <h3 className="font-black text-slate-800 flex items-center text-sm">
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Facturas Pendientes del Cliente
                        </h3>
                    </div>
                    <div className="flex-1 overflow-auto p-2">
                        {!selectedNC ? (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold text-center px-6">
                                Seleccione una Nota de Crédito de la izquierda para ver las facturas del cliente.
                            </div>
                        ) : clientInvoices.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold text-center px-6">
                                El cliente no tiene facturas o boletas con deuda pendiente.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {clientInvoices.map(inv => (
                                    <div 
                                        key={inv.id} 
                                        onClick={() => handleSelectInvoice(inv)}
                                        className={`p-3 rounded border cursor-pointer transition-all ${selectedInvoice?.id === inv.id ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-bold text-slate-800 text-sm">{inv.document_type} {inv.series}-{inv.number}</div>
                                            <div className="font-black text-red-500 text-sm">Deuda: S/ {inv.balance?.toFixed(2)}</div>
                                        </div>
                                        <div className="text-[10px] text-slate-400">{new Date(inv.created_at).toLocaleDateString()}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Panel de Aplicación */}
            {selectedNC && selectedInvoice && (
                <div className="bg-white p-4 border border-indigo-200 rounded-lg shadow-md flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4 text-sm">
                        <div className="bg-indigo-100 text-indigo-800 p-2 rounded">
                            <div className="text-[10px] font-bold uppercase">Nota Crédito</div>
                            <div className="font-black">{selectedNC.series}-{selectedNC.number}</div>
                        </div>
                        <ArrowRight className="text-slate-300" />
                        <div className="bg-slate-100 text-slate-800 p-2 rounded">
                            <div className="text-[10px] font-bold uppercase">Factura a Pagar</div>
                            <div className="font-black">{selectedInvoice.series}-{selectedInvoice.number}</div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Monto a Aplicar</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 font-bold text-slate-400">S/</span>
                                <input 
                                    type="number" 
                                    className="pl-8 pr-3 py-2 border-2 border-indigo-200 rounded font-black text-indigo-700 outline-none focus:border-indigo-500 w-32"
                                    value={applyAmount || ''}
                                    onChange={e => {
                                        let v = Number(e.target.value);
                                        const max = Math.min(selectedNC.balance || 0, selectedInvoice.balance || 0);
                                        if (v > max) v = max;
                                        if (v < 0) v = 0;
                                        setApplyAmount(v);
                                    }}
                                />
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleApply}
                            disabled={isSaving || applyAmount <= 0}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded font-black disabled:opacity-50 mt-4"
                        >
                            {isSaving ? 'Aplicando...' : 'Confirmar Aplicación'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
