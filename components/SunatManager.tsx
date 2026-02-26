import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Send, RefreshCw, Filter, Search, FileText, CheckSquare, FileWarning, Eye } from 'lucide-react';
import { Sale, DispatchSheet } from '../types';

export const SunatManager: React.FC = () => {
    const { sales, dispatchSheets, updateSunatStatus } = useStore();

    const [activeTab, setActiveTab] = useState<'facturas' | 'boletas' | 'notas_credito' | 'guias'>('facturas');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXCEPTED'>('ALL');

    const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Calculate Days since emission
    const getDaysSince = (dateStr: string) => {
        const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };

    // Logic to get Expiration based on rules: Facturas (3 days), Boletas (6 days), Guias (Same day/1 day)
    const getExpirationStatus = (type: 'FACTURA' | 'BOLETA' | 'NOTA DE CREDITO' | 'GUIA', emissionDate: string) => {
        const days = getDaysSince(emissionDate);
        let limit = 3;
        if (type === 'FACTURA') limit = 3;
        if (type === 'BOLETA') limit = 6;
        if (type === 'NOTA DE CREDITO') limit = 3; // SUNAT rule: NC related to Facturas have the same 3 calendar day limit.
        if (type === 'GUIA') limit = 1;

        if (days > limit) return { text: 'VENCIDO', color: 'text-red-600 bg-red-100 border-red-300' };
        if (days === limit) return { text: 'VENCE HOY', color: 'text-orange-600 bg-orange-100 border-orange-300' };
        return { text: `Quedan ${limit - days} días`, color: 'text-slate-600 bg-slate-100 border-slate-300' };
    };

    // Process and combine relevant documents
    const documents = useMemo(() => {
        let filtered: any[] = [];
        if (activeTab === 'facturas' || activeTab === 'boletas' || activeTab === 'notas_credito') {
            // Filter sales
            const typeFilter = activeTab === 'facturas' ? 'FACTURA' : (activeTab === 'boletas' ? 'BOLETA' : 'NOTA DE CREDITO');
            filtered = sales.filter(s => s.document_type === typeFilter);
        } else if (activeTab === 'guias') {
            filtered = dispatchSheets.map(d => ({
                ...d,
                document_type: 'GUIA',
                series: d.code.split('-')[0],
                number: d.code.split('-')[1],
                created_at: d.date,
                client_name: 'Varios (Consolidado)',
                total: 0
            }));
        }

        // Apply Search
        if (searchTerm) {
            filtered = filtered.filter(d =>
                (d.series + '-' + d.number).toLowerCase().includes(searchTerm.toLowerCase()) ||
                (d.client_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
            );
        }

        // Apply Status Filter
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(d => (d.sunat_status || 'PENDING') === statusFilter);
        }

        return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [sales, dispatchSheets, activeTab, searchTerm, statusFilter]);

    // Derived Selection State
    const allSelectableIds = useMemo(() => {
        return documents.filter(d => {
            const status = d.sunat_status || 'PENDING';
            return status === 'PENDING' || status === 'REJECTED';
        }).map(d => d.id);
    }, [documents]);

    const isAllSelected = documents.length > 0 &&
        allSelectableIds.length > 0 &&
        allSelectableIds.every(id => selectedIds.has(id));

    // Metrics
    const metrics = useMemo(() => {
        let pending = 0, accepted = 0, rejected = 0, expired = 0;

        const allDocs = [...sales, ...dispatchSheets.map(d => ({ ...d, document_type: 'GUIA', created_at: d.date }))];

        allDocs.forEach(d => {
            const status = d.sunat_status || 'PENDING';
            if (status === 'PENDING') {
                pending++;
                let type: any = 'FACTURA';
                if (d.document_type === 'BOLETA') type = 'BOLETA';
                if (d.document_type === 'NOTA DE CREDITO') type = 'NOTA DE CREDITO';
                if (d.document_type === 'GUIA') type = 'GUIA';

                const exp = getExpirationStatus(type, d.created_at);
                if (exp.text === 'VENCIDO') expired++;
            }
            else if (status === 'ACCEPTED') accepted++;
            else if (status === 'REJECTED') rejected++;
        });

        return { pending, accepted, rejected, expired };
    }, [sales, dispatchSheets]);

    // Handlers
    const handleSendToSunat = async (type: 'sale' | 'dispatch', id: string) => {
        setSendingIds(prev => new Set(prev).add(id));

        // Simulate API Delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Simulate 90% Success Rate
        const isSuccess = Math.random() > 0.1;

        if (isSuccess) {
            updateSunatStatus(type, id, 'ACCEPTED', 'Comprobante aceptado exitosamente por SUNAT.');
        } else {
            updateSunatStatus(type, id, 'REJECTED', 'Error de conexión o comprobante rechazado (Simulación).');
        }

        setSendingIds(prev => {
            const n = new Set(prev);
            n.delete(id);
            return n;
        });

        // Remove from selected after processing
        setSelectedIds(prev => {
            const n = new Set(prev);
            n.delete(id);
            return n;
        });
    };

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(allSelectableIds));
        }
    };

    const handleToggleSelect = (id: string, isSelectable: boolean) => {
        if (!isSelectable) return;

        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSendSelected = async () => {
        if (selectedIds.size === 0) return;

        const type = activeTab === 'guias' ? 'dispatch' : 'sale';

        // Mark all selected as sending
        const idsArray = Array.from(selectedIds) as string[];
        setSendingIds(prev => {
            const n = new Set(prev);
            idsArray.forEach(id => n.add(id));
            return n;
        });

        // Simulate Batch API Request Delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        idsArray.forEach(id => {
            const isSuccess = Math.random() > 0.1;
            if (isSuccess) {
                updateSunatStatus(type, id, 'ACCEPTED', 'Comprobante aceptado exitosamente por SUNAT (Lote).');
            } else {
                updateSunatStatus(type, id, 'REJECTED', 'Error de conexión o comprobante rechazado (Simulación Lote).');
            }
        });

        // Clear sending and selected states
        setSendingIds(prev => {
            const n = new Set(prev);
            idsArray.forEach(id => n.delete(id));
            return n;
        });
        setSelectedIds(new Set());
    };

    const handleCheckTickets = async () => {
        // Simulate checking ticket status (for pending responses from SUNAT)
        if (documents.length === 0) return;

        const pendingDocs = documents.filter(d => (d.sunat_status || 'PENDING') === 'SENT');
        if (pendingDocs.length === 0) {
            alert('No hay tickets pendientes de respuesta en esta vista.');
            return;
        }

        const type = activeTab === 'guias' ? 'dispatch' : 'sale';

        setSendingIds(prev => {
            const n = new Set(prev);
            pendingDocs.forEach(d => n.add(d.id));
            return n;
        });

        await new Promise(resolve => setTimeout(resolve, 1500));

        pendingDocs.forEach(d => {
            updateSunatStatus(type, d.id as string, 'ACCEPTED', 'Ticket resuelto: Aceptado exitosamente por SUNAT.');
        });

        setSendingIds(prev => {
            const n = new Set(prev);
            pendingDocs.forEach(d => n.delete(d.id));
            return n;
        });

        alert(`Se actualizaron ${pendingDocs.length} tickets pendientes.`);
    };

    const StatusBadge = ({ status }: { status?: string }) => {
        const s = status || 'PENDING';
        switch (s) {
            case 'PENDING': return <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 border border-yellow-300 px-2 py-1 rounded text-xs font-bold"><Clock className="w-3 h-3" /> PENDIENTE</span>;
            case 'SENT': return <span className="flex items-center gap-1 bg-blue-100 text-blue-800 border border-blue-300 px-2 py-1 rounded text-xs font-bold"><RefreshCw className="w-3 h-3 animate-spin" /> ENVIANDO</span>;
            case 'ACCEPTED': return <span className="flex items-center gap-1 bg-green-100 text-green-800 border border-green-300 px-2 py-1 rounded text-xs font-bold"><CheckCircle2 className="w-3 h-3" /> ACEPTADO</span>;
            case 'REJECTED': return <span className="flex items-center gap-1 bg-red-100 text-red-800 border border-red-300 px-2 py-1 rounded text-xs font-bold"><XCircle className="w-3 h-3" /> RECHAZADO</span>;
            case 'EXCEPTED': return <span className="flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-300 px-2 py-1 rounded text-xs font-bold"><FileWarning className="w-3 h-3" /> EXCEPTUADO</span>;
            default: return null;
        }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-full">

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <span className="bg-red-600 text-white p-2 rounded-lg"><FileText className="w-6 h-6" /></span>
                        Facturación Electrónica SUNAT
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">Gestiona y envía comprobantes y guías a través de proveedor (PSE/OSE) a SUNAT.</p>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-4">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <Clock className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-blue-900">Configuración de Proveedor de Facturación (PSE/OSE)</h3>
                    <p className="text-sm text-blue-800 mt-1">Para el envío a producción, necesitas configurar tus credenciales API, el RUC de tu empresa, el certificado digital (.pfx) o el token proporcionado por tu PSE/OSE (ej. Nubefact, APIPeru, Facturador PRO). Ve a <span className="font-bold bg-white px-2 py-0.5 rounded text-xs border border-blue-200">Configuración {">"} Facturación Electrónica</span> para completar los datos reales de conexión.</p>
                </div>
            </div>

            {/* Elite Dashboard Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between border-b-4 border-b-yellow-400">
                    <div>
                        <p className="text-sm font-bold text-slate-500">Documentos Pendientes</p>
                        <p className="text-3xl font-black text-slate-800">{metrics.pending}</p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-full text-yellow-600">
                        <Clock className="w-8 h-8" />
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between border-b-4 border-b-green-500">
                    <div>
                        <p className="text-sm font-bold text-slate-500">Aceptados</p>
                        <p className="text-3xl font-black text-slate-800">{metrics.accepted}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-full text-green-600">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between border-b-4 border-b-red-500">
                    <div>
                        <p className="text-sm font-bold text-slate-500">Rechazados</p>
                        <p className="text-3xl font-black text-slate-800">{metrics.rejected}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-full text-red-600">
                        <XCircle className="w-8 h-8" />
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between border-b-4 border-b-orange-500 bg-orange-50/30">
                    <div>
                        <p className="text-sm font-bold text-slate-500">Alerta: Por Vencer / Vencidos</p>
                        <p className="text-3xl font-black text-orange-600">{metrics.expired}</p>
                    </div>
                    <div className="bg-orange-100 p-3 rounded-full text-orange-600 animate-pulse">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[650px]">
                {/* Header / Tabs */}
                <div className="border-b border-slate-200 bg-slate-50 p-2 flex items-center justify-between">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('facturas')}
                            className={`px-6 py-3 font-bold text-sm rounded-lg transition-all ${activeTab === 'facturas' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:bg-slate-200'}`}
                        >
                            Facturas
                        </button>
                        <button
                            onClick={() => setActiveTab('boletas')}
                            className={`px-6 py-3 font-bold text-sm rounded-lg transition-all ${activeTab === 'boletas' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:bg-slate-200'}`}
                        >
                            Boletas
                        </button>
                        <button
                            onClick={() => setActiveTab('notas_credito')}
                            className={`px-6 py-3 font-bold text-sm rounded-lg transition-all ${activeTab === 'notas_credito' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:bg-slate-200'}`}
                        >
                            Notas de Crédito
                        </button>
                        <button
                            onClick={() => setActiveTab('guias')}
                            className={`px-6 py-3 font-bold text-sm rounded-lg transition-all ${activeTab === 'guias' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:bg-slate-200'}`}
                        >
                            Guias de Remisión
                        </button>
                    </div>
                    <div className="flex gap-2 pr-2">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar Serie-Correlativo..."
                                className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64 font-medium"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Filter className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <select
                                className="pl-9 pr-8 py-2 border border-slate-300 bg-white rounded-lg text-sm outline-none font-bold text-slate-700 appearance-none"
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value as any)}
                            >
                                <option value="ALL">Todos los Estados</option>
                                <option value="PENDING">Pendientes</option>
                                <option value="ACCEPTED">Aceptados</option>
                                <option value="REJECTED">Rechazados</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto bg-slate-50 relative">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={isAllSelected}
                                        onChange={handleToggleSelectAll}
                                        disabled={allSelectableIds.length === 0}
                                    />
                                </th>
                                <th className="p-4">Documento</th>
                                <th className="p-4">F. Emisión</th>
                                <th className="p-4">Cliente</th>
                                <th className="p-4 text-center">Estado SUNAT</th>
                                <th className="p-4 text-center">Condición Envio</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {documents.map(d => {
                                const status = d.sunat_status || 'PENDING';
                                const isSending = sendingIds.has(d.id);
                                const exp = getExpirationStatus(
                                    activeTab === 'guias' ? 'GUIA' :
                                        (activeTab === 'notas_credito' ? 'NOTA DE CREDITO' :
                                            (activeTab === 'facturas' ? 'FACTURA' : 'BOLETA')),
                                    d.created_at
                                );

                                return (
                                    <tr key={d.id} className="hover:bg-blue-50 transition-colors group">
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                checked={selectedIds.has(d.id)}
                                                onChange={() => handleToggleSelect(d.id, Boolean((status === 'PENDING' || status === 'REJECTED') && !isSending))}
                                                disabled={!((status === 'PENDING' || status === 'REJECTED') && !isSending)}
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-blue-700 text-[15px]">{d.series}-{d.number}</div>
                                            <div className="text-[11px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{activeTab === 'guias' ? 'GUIA RM' : d.document_type}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-800">{new Date(d.created_at).toLocaleDateString()}</div>
                                            <div className="text-xs text-slate-500">{new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800 text-[14px] truncate max-w-[250px]">{d.client_name}</div>
                                            {d.total > 0 && <div className="text-[12px] font-bold text-slate-500 mt-0.5">S/ {d.total.toFixed(2)}</div>}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center">
                                                <StatusBadge status={isSending ? 'SENT' : status} />
                                            </div>
                                            {d.sunat_message && status !== 'PENDING' && !isSending && (
                                                <div className="text-[10px] mt-1 text-slate-400 max-w-[150px] mx-auto truncate" title={d.sunat_message}>
                                                    {d.sunat_message}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {status === 'PENDING' && !isSending ? (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${exp.color} whitespace-nowrap`}>
                                                    {exp.text}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 text-xs font-bold">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button className="text-slate-400 hover:text-blue-600 p-1 transition-colors" title="Ver Documento">
                                                    <Eye className="w-5 h-5" />
                                                </button>
                                                {(status === 'PENDING' || status === 'REJECTED') && (
                                                    <button
                                                        onClick={() => handleSendToSunat(activeTab === 'guias' ? 'dispatch' : 'sale', d.id)}
                                                        disabled={isSending}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all
                                             ${isSending ? 'bg-blue-100 text-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}
                                          `}
                                                    >
                                                        {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                        {isSending ? 'Enviando...' : 'Enviar'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {documents.length === 0 && (
                                <tr><td colSpan={7} className="p-12 text-center text-slate-400 text-base font-medium">No se encontraron documentos en esta bandeja.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Multi-actions */}
                <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                    <div className="text-sm font-bold text-slate-500">
                        {documents.length} documentos encontrados {selectedIds.size > 0 && <span className="text-blue-600 ml-2">({selectedIds.size} seleccionados)</span>}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleCheckTickets}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold border border-slate-300 transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Consultar Tickets
                        </button>
                        <button
                            onClick={handleSendSelected}
                            disabled={selectedIds.size === 0 || sendingIds.size > 0}
                            className={`px-6 py-2 rounded-lg text-sm font-bold shadow-md transition-all flex items-center gap-2
                                ${selectedIds.size === 0 || sendingIds.size > 0
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                    : 'bg-slate-800 hover:bg-slate-900 text-white shadow-slate-200'
                                }`}
                        >
                            {sendingIds.size > 0 ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {sendingIds.size > 0 ? 'Enviando Lote...' : `Enviar Seleccionados (${selectedIds.size})`}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
