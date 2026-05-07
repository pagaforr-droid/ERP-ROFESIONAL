import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useStore } from '../services/store';
import { AuditLog, FeatureFlags } from '../types';
import { X, Shield, Activity, Power, Save, Search, RefreshCw, AlertTriangle, Eye, Server, Lock } from 'lucide-react';

export const GodModePanel = ({ onClose }: { onClose: () => void }) => {
    const { currentUser, company, updateCompany } = useStore();
    const [activeTab, setActiveTab] = useState<'FEATURES' | 'AUDIT'>('FEATURES');
    const [isLoading, setIsLoading] = useState(false);
    
    // Feature Flags State
    const [flags, setFlags] = useState<FeatureFlags>(company.feature_flags || {});
    const [isSaving, setIsSaving] = useState(false);

    // Audit State
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [auditSearch, setAuditSearch] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    // Los módulos disponibles para hacer toggle (se basan en las vistas de App.tsx)
    const AVAILABLE_MODULES = [
        { id: 'pos', name: 'Punto de Venta (POS)', desc: 'Activa/Desactiva el módulo de facturación rápida' },
        { id: 'sales', name: 'Venta Directa', desc: 'Activa/Desactiva el carrito de venta B2B' },
        { id: 'advanced-orders', name: 'Pedidos Avanzados', desc: 'Módulo de pedidos mayoristas' },
        { id: 'purchases', name: 'Compras', desc: 'Módulo de compras a proveedores' },
        { id: 'dispatch', name: 'Despacho y Rutas', desc: 'Módulo de asignación de rutas' },
        { id: 'dispatch-liquidation', name: 'Liquidación Rutas', desc: 'Permite liquidar el retorno de mercadería' },
        { id: 'mobile-orders', name: 'App Vendedores', desc: 'Módulo móvil para vendedores en ruta' },
        { id: 'mobile-delivery', name: 'App Reparto', desc: 'Módulo móvil para choferes' },
        { id: 'kardex', name: 'Kardex', desc: 'Módulo de inventario avanzado' },
        { id: 'reports', name: 'Reportes & BI', desc: 'Panel de reportes gerenciales' },
        { id: 'accounting-reports', name: 'Reportes Contables', desc: 'Exportación de libros contables (SIRE)' },
        { id: 'sunat-manager', name: 'Facturación Electrónica', desc: 'Gestor de envío de comprobantes' },
        { id: 'cash-flow', name: 'Flujo de Caja', desc: 'Gestión de caja y bancos' }
    ];

    useEffect(() => {
        if (activeTab === 'AUDIT') {
            fetchLogs();
        }
    }, [activeTab]);

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            
            if (error) throw error;
            if (data) setLogs(data);
        } catch (error) {
            console.error("Error fetching audit logs", error);
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleSaveFlags = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('company_config')
                .update({ feature_flags: flags })
                .eq('id', company.id);
                
            if (error) throw error;
            
            updateCompany({ ...company, feature_flags: flags });
            alert("Feature Flags actualizados correctamente.");
        } catch (error) {
            console.error("Error saving flags", error);
            alert("Error al guardar flags");
        } finally {
            setIsSaving(false);
        }
    };

    const filteredLogs = logs.filter(log => 
        log.table_name.toLowerCase().includes(auditSearch.toLowerCase()) || 
        log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.record_id.toLowerCase().includes(auditSearch.toLowerCase()) ||
        (log.user_id && log.user_id.toLowerCase().includes(auditSearch.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-8 font-mono text-slate-300">
            <div className="w-full max-w-7xl h-full max-h-[90vh] bg-[#0d1117] border border-emerald-900 shadow-[0_0_50px_rgba(4,120,87,0.3)] rounded-lg flex flex-col overflow-hidden">
                
                {/* Header Táctico */}
                <div className="h-16 border-b border-slate-800 bg-[#161b22] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3 text-emerald-500">
                        <Server className="w-6 h-6" />
                        <h1 className="text-xl font-black tracking-widest">TRACEFLOW // GOD MODE</h1>
                        <span className="ml-4 px-2 py-0.5 text-[10px] bg-red-950 text-red-400 border border-red-900 rounded uppercase tracking-wider font-bold animate-pulse">
                            Restricted Area
                        </span>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-rose-400 transition-colors p-2 bg-[#0d1117] rounded border border-slate-800 hover:border-rose-900">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-64 border-r border-slate-800 bg-[#161b22] p-4 flex flex-col gap-2 shrink-0">
                        <button 
                            onClick={() => setActiveTab('FEATURES')}
                            className={`flex items-center gap-3 p-4 rounded-lg border transition-all text-sm font-bold tracking-wide ${activeTab === 'FEATURES' ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' : 'bg-transparent border-slate-800 hover:bg-slate-800 text-slate-500'}`}
                        >
                            <Power className="w-5 h-5" /> FEATURE FLAGS
                        </button>
                        <button 
                            onClick={() => setActiveTab('AUDIT')}
                            className={`flex items-center gap-3 p-4 rounded-lg border transition-all text-sm font-bold tracking-wide ${activeTab === 'AUDIT' ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' : 'bg-transparent border-slate-800 hover:bg-slate-800 text-slate-500'}`}
                        >
                            <Activity className="w-5 h-5" /> AUDIT TRAIL
                        </button>
                        <div className="mt-auto p-4 bg-slate-900/50 border border-slate-800 rounded-lg text-xs text-slate-500 font-sans">
                            <div className="flex items-center gap-2 mb-2 text-slate-400">
                                <Shield className="w-4 h-4" /> <strong>Super Admin Info</strong>
                            </div>
                            <div>User: {currentUser?.username}</div>
                            <div>Role: {currentUser?.role}</div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 bg-[#0d1117] overflow-y-auto p-6 custom-scrollbar relative">
                        {activeTab === 'FEATURES' && (
                            <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="mb-6 flex justify-between items-end border-b border-slate-800 pb-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Control de Módulos (Feature Flags)</h2>
                                        <p className="text-sm text-slate-400 font-sans">Activa o desactiva módulos para la empresa actual. Los módulos desactivados no se mostrarán en el menú lateral para ningún usuario, anulando sus permisos individuales.</p>
                                    </div>
                                    <button 
                                        onClick={handleSaveFlags}
                                        disabled={isSaving}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded shadow-lg shadow-emerald-900/50 flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4" /> {isSaving ? 'GUARDANDO...' : 'APLICAR CAMBIOS'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {AVAILABLE_MODULES.map(mod => {
                                        // Si no está definido en el estado, lo asumimos como encendido (true) por retrocompatibilidad
                                        const isEnabled = flags[mod.id] !== false; 
                                        
                                        return (
                                            <div key={mod.id} className={`p-4 rounded-lg border-2 flex items-center justify-between transition-colors ${isEnabled ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-[#161b22] border-slate-800 opacity-60'}`}>
                                                <div>
                                                    <div className={`font-bold ${isEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>{mod.name}</div>
                                                    <div className="text-xs text-slate-500 mt-1 font-sans">{mod.desc}</div>
                                                </div>
                                                <button
                                                    onClick={() => setFlags({ ...flags, [mod.id]: !isEnabled })}
                                                    className={`w-12 h-6 rounded-full relative transition-colors ${isEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                                >
                                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isEnabled ? 'left-7' : 'left-1'}`} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'AUDIT' && (
                            <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="mb-4 flex gap-4 items-center shrink-0">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input 
                                            type="text" 
                                            placeholder="Buscar tabla, UUID, ID registro..." 
                                            className="w-full bg-[#161b22] border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                                            value={auditSearch}
                                            onChange={(e) => setAuditSearch(e.target.value)}
                                        />
                                    </div>
                                    <button onClick={fetchLogs} className="p-2 bg-[#161b22] border border-slate-700 rounded-lg hover:border-emerald-500 text-slate-400 hover:text-emerald-400 transition-colors">
                                        <RefreshCw className={`w-5 h-5 ${loadingLogs ? 'animate-spin text-emerald-500' : ''}`} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-auto border border-slate-800 rounded-lg bg-[#161b22]">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-[#0d1117] text-slate-500 sticky top-0 border-b border-slate-800 z-10">
                                            <tr>
                                                <th className="p-3 font-medium uppercase tracking-wider">Timestamp</th>
                                                <th className="p-3 font-medium uppercase tracking-wider">Table</th>
                                                <th className="p-3 font-medium uppercase tracking-wider">Action</th>
                                                <th className="p-3 font-medium uppercase tracking-wider">Record ID</th>
                                                <th className="p-3 font-medium uppercase tracking-wider">User UID</th>
                                                <th className="p-3 font-medium uppercase tracking-wider">Payload</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {filteredLogs.map(log => (
                                                <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                                                    <td className="p-3 text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                                                    <td className="p-3 font-bold text-blue-400">{log.table_name}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.action === 'INSERT' ? 'bg-green-950 text-green-400 border border-green-900' : log.action === 'UPDATE' ? 'bg-orange-950 text-orange-400 border border-orange-900' : 'bg-red-950 text-red-400 border border-red-900'}`}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-slate-500 truncate max-w-[100px]">{log.record_id}</td>
                                                    <td className="p-3 text-slate-500 truncate max-w-[100px]">{log.user_id || 'System'}</td>
                                                    <td className="p-3">
                                                        <button 
                                                            onClick={() => setSelectedLog(log)}
                                                            className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1"
                                                        >
                                                            <Eye className="w-3 h-3" /> View JSON
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredLogs.length === 0 && !loadingLogs && (
                                                <tr>
                                                    <td colSpan={6} className="p-8 text-center text-slate-600">No logs found in this query.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Log Details Modal */}
                {selectedLog && (
                    <div className="absolute inset-0 bg-[#0d1117]/95 z-50 flex flex-col p-6 font-mono text-sm">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Lock className="w-5 h-5 text-emerald-500" /> Audit Record Details
                                </h3>
                                <div className="text-slate-500 text-xs mt-1">ID: {selectedLog.id}</div>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 flex gap-4 overflow-hidden">
                            {selectedLog.old_data && (
                                <div className="flex-1 flex flex-col bg-[#161b22] border border-rose-900/30 rounded-lg overflow-hidden">
                                    <div className="bg-rose-950/30 text-rose-400 font-bold p-2 text-xs border-b border-rose-900/30">OLD DATA</div>
                                    <pre className="flex-1 p-4 overflow-auto text-rose-300 text-xs custom-scrollbar">
                                        {JSON.stringify(selectedLog.old_data, null, 2)}
                                    </pre>
                                </div>
                            )}
                            {selectedLog.new_data && (
                                <div className="flex-1 flex flex-col bg-[#161b22] border border-emerald-900/30 rounded-lg overflow-hidden">
                                    <div className="bg-emerald-950/30 text-emerald-400 font-bold p-2 text-xs border-b border-emerald-900/30">NEW DATA</div>
                                    <pre className="flex-1 p-4 overflow-auto text-emerald-300 text-xs custom-scrollbar">
                                        {JSON.stringify(selectedLog.new_data, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
