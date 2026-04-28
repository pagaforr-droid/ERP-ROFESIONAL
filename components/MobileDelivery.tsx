import React, { useState, useEffect, useMemo } from 'react';
import { Truck, MapPin, X, CheckCircle, Navigation, PackageX, AlertTriangle, Loader2, PlayCircle, Flag, ChevronRight } from 'lucide-react';
import { Sale, DispatchSheet } from '../types';
import { supabase } from '../services/supabase';

type ViewMode = 'DRIVER_SELECT' | 'DISPATCH_SELECT' | 'DELIVERY_LIST';

interface DeliveryModalState {
    isOpen: boolean;
    sale: Sale | null;
    actionType: 'delivered' | 'partial' | 'failed' | null;
}

export const MobileDelivery: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('DRIVER_SELECT');
    const [currentDriverId, setCurrentDriverId] = useState('');
    const [currentDispatchId, setCurrentDispatchId] = useState('');

    // Supabase Data
    const [dbDrivers, setDbDrivers] = useState<any[]>([]);
    const [dbVehicles, setDbVehicles] = useState<any[]>([]);
    const [dbDispatchSheets, setDbDispatchSheets] = useState<DispatchSheet[]>([]);
    const [dbSales, setDbSales] = useState<Sale[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Modal State
    const [modal, setModal] = useState<DeliveryModalState>({ isOpen: false, sale: null, actionType: null });
    const [reason, setReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);
    const [systemAlert, setSystemAlert] = useState<{ show: boolean, message: string, type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'info' });

    // Initial Load
    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoadingData(true);
            try {
                const [driversRes, vehiclesRes, dispatchRes] = await Promise.all([
                    supabase.from('drivers').select('*').order('name'),
                    supabase.from('vehicles').select('*'),
                    supabase.from('dispatch_sheets').select('*').in('status', ['pending', 'in_transit', 'assigned'])
                ]);
                if (driversRes.data) setDbDrivers(driversRes.data);
                if (vehiclesRes.data) setDbVehicles(vehiclesRes.data);
                if (dispatchRes.data) setDbDispatchSheets(dispatchRes.data as DispatchSheet[]);
            } catch (error) {
                console.error("Error loading delivery data:", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchInitialData();
    }, []);

    // Load Sales when a dispatch is selected
    useEffect(() => {
        const fetchSales = async () => {
            if (!currentDispatchId) return;
            setIsLoadingData(true);
            try {
                // Fetch junction table dispatch_sales
                const { data: dispatchSalesData } = await supabase.from('dispatch_sales').select('sale_id').eq('dispatch_sheet_id', currentDispatchId);
                const saleIds = dispatchSalesData?.map(ds => ds.sale_id) || [];
                
                if (saleIds.length > 0) {
                    const { data: salesData } = await supabase.from('sales').select('*').in('id', saleIds);
                    if (salesData) setDbSales(salesData as Sale[]);
                } else {
                    setDbSales([]);
                }
            } catch (error) {
                console.error("Error loading sales for dispatch:", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchSales();
    }, [currentDispatchId]);


    // Derived Data
    const currentDriver = dbDrivers.find(d => d.id === currentDriverId);
    const driverVehicles = dbVehicles.filter(v => v.driver_id === currentDriverId);

    const activeDispatchSheets = useMemo(() => {
        if (!currentDriverId) return [];
        const vehicleIds = driverVehicles.map(v => v.id);
        return dbDispatchSheets.filter(ds =>
            vehicleIds.includes(ds.vehicle_id)
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [dbDispatchSheets, driverVehicles, currentDriverId]);

    const currentDispatch = dbDispatchSheets.find(ds => ds.id === currentDispatchId);

    const dispatchSales = useMemo(() => {
        return [...dbSales].sort((a, b) => {
            if (a.document_type === 'BOLETA' && b.document_type !== 'BOLETA') return -1;
            if (a.document_type !== 'BOLETA' && b.document_type === 'BOLETA') return 1;
            if (a.series < b.series) return -1;
            if (a.series > b.series) return 1;
            return a.number.localeCompare(b.number);
        });
    }, [dbSales]);

    // Handlers
    const handleDriverSelect = (id: string) => {
        if (!id) return;
        setCurrentDriverId(id);
        setViewMode('DISPATCH_SELECT');
    };

    const handleDispatchSelect = async (id: string) => {
        setIsProcessing(true);
        try {
            // Optimistically update status if it was pending
            const dispatch = dbDispatchSheets.find(d => d.id === id);
            if (dispatch?.status === 'pending' || dispatch?.status === 'assigned') {
                await supabase.from('dispatch_sheets').update({ status: 'in_transit' }).eq('id', id);
                setDbDispatchSheets(prev => prev.map(d => d.id === id ? { ...d, status: 'in_transit' } : d));
            }
            setCurrentDispatchId(id);
            setViewMode('DELIVERY_LIST');
        } catch (error) {
            console.error("Error updating dispatch:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const openActionModal = (sale: Sale, actionType: 'delivered' | 'partial' | 'failed') => {
        setModal({ isOpen: true, sale, actionType });
        setReason('');
    };

    const handleConfirmAction = async () => {
        if (!modal.sale || !modal.actionType) return;

        const requiresJustification = modal.actionType === 'failed' || modal.actionType === 'partial';
        if (requiresJustification && !reason.trim()) {
            setSystemAlert({ show: true, message: "Debe ingresar un motivo para esta acción.", type: "error" });
            return;
        }

        setIsProcessing(true);

        // Captura GPS Silenciosa
        let currentLocation = null;
        if ("geolocation" in navigator) {
            try {
                currentLocation = await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
                        (error) => resolve(null), // Si falla, sigue el proceso sin alertar
                        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
                    );
                });
            } catch (e) {
                // Silencioso
            }
        }

        try {
            const updatePayload = {
                dispatch_status: modal.actionType,
                delivery_reason: reason || null,
                delivery_location: currentLocation
            };

            const { error } = await supabase.from('sales').update(updatePayload).eq('id', modal.sale.id);
            if (error) throw error;

            // Update local state
            setDbSales(prev => prev.map(s => s.id === modal.sale.id ? { ...s, ...updatePayload } : s));
            setModal({ isOpen: false, sale: null, actionType: null });
            
            // Auto trigger sync for dashboard (Supabase realtime handles this, but here we just confirm success)
        } catch (error: any) {
            console.error("Error saving delivery:", error);
            setSystemAlert({ show: true, message: "Error al guardar: " + error.message, type: "error" });
        } finally {
            setIsProcessing(false);
        }
    };

    const groupedSales = useMemo(() => {
        const pendingAndInTransit = dispatchSales.filter(s => s.dispatch_status === 'pending' || s.dispatch_status === 'assigned' || s.dispatch_status === 'in_transit');
        const deliveredOrClosed = dispatchSales.filter(s => s.dispatch_status === 'delivered' || s.dispatch_status === 'liquidated' || s.dispatch_status === 'failed' || s.dispatch_status === 'partial');
        return { pending: pendingAndInTransit, closed: deliveredOrClosed };
    }, [dispatchSales]);

    const allCompleted = dispatchSales.length > 0 && groupedSales.pending.length === 0;

    const handleFinishRoute = async () => {
        if (!currentDispatchId) return;
        setIsProcessing(true);
        try {
            const { error } = await supabase.from('dispatch_sheets').update({ status: 'delivered' }).eq('id', currentDispatchId);
            if (error) throw error;
            
            setDbDispatchSheets(prev => prev.filter(d => d.id !== currentDispatchId));
            setShowFinishConfirm(false);
            setSystemAlert({ show: true, message: "Ruta finalizada con éxito. Diríjase a oficina para liquidación.", type: "success" });
            setViewMode('DISPATCH_SELECT');
            setCurrentDispatchId('');
        } catch (error: any) {
            setSystemAlert({ show: true, message: "Error al cerrar ruta: " + error.message, type: "error" });
        } finally {
            setIsProcessing(false);
        }
    };

    // --- SYSTEM ALERT COMPONENT ---
    const SystemAlert = () => (
        systemAlert.show ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
                    {systemAlert.type === 'error' && <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />}
                    {systemAlert.type === 'success' && <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />}
                    {systemAlert.type === 'info' && <Info className="w-16 h-16 text-blue-500 mx-auto mb-4" />}
                    
                    <h3 className="text-xl font-black text-slate-800 mb-2">
                        {systemAlert.type === 'error' ? 'Aviso Importante' : 'Completado'}
                    </h3>
                    <p className="text-slate-600 mb-6 font-medium">{systemAlert.message}</p>
                    <button 
                        onClick={() => setSystemAlert({ ...systemAlert, show: false })}
                        className={`w-full py-3 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform ${systemAlert.type === 'error' ? 'bg-red-600 shadow-red-600/30' : 'bg-green-600 shadow-green-600/30'}`}
                    >
                        Entendido
                    </button>
                </div>
            </div>
        ) : null
    );

    // --- VIEWS ---

    if (isLoadingData && viewMode === 'DRIVER_SELECT') {
        return <div className="h-full flex items-center justify-center bg-slate-100"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
    }

    if (viewMode === 'DRIVER_SELECT') {
        return (
            <div className="h-full bg-gradient-to-b from-slate-900 to-indigo-950 p-4 flex flex-col justify-center items-center">
                <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl w-full max-w-sm text-center border border-white/20 animate-fade-in-up">
                    <div className="bg-indigo-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-indigo-400/30">
                        <Truck className="w-12 h-12 text-indigo-100" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2 tracking-tight">App Reparto</h2>
                    <p className="text-indigo-200 mb-8 text-sm font-medium">Seleccione su perfil de conductor para iniciar la jornada.</p>
                    
                    <div className="space-y-4">
                        {dbDrivers.map(d => (
                            <button 
                                key={d.id} 
                                onClick={() => handleDriverSelect(d.id)} 
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl text-left flex items-center justify-between transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-500/30 p-2 rounded-full"><Truck className="w-5 h-5 text-indigo-200" /></div>
                                    <div>
                                        <div className="text-white font-bold text-lg">{d.name}</div>
                                        <div className="text-indigo-300 text-xs font-medium">DNI: {d.dni}</div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-indigo-300 group-hover:translate-x-1 transition-transform" />
                            </button>
                        ))}
                        {dbDrivers.length === 0 && (
                            <div className="text-indigo-200 text-sm">No hay conductores registrados.</div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (viewMode === 'DISPATCH_SELECT') {
        return (
            <div className="h-full bg-slate-100 flex flex-col">
                <div className="bg-slate-900 text-white p-6 rounded-b-[2rem] shadow-lg sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setViewMode('DRIVER_SELECT')} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                            <X className="w-5 h-5 text-white" />
                        </button>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">Planillas Activas</h2>
                            <p className="text-indigo-200 text-sm font-medium">{currentDriver?.name}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-6">
                    {isLoadingData ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
                    ) : (
                        <>
                            {activeDispatchSheets.map(ds => {
                                const vehicle = dbVehicles.find(v => v.id === ds.vehicle_id);
                                return (
                                    <div key={ds.id} onClick={() => handleDispatchSelect(ds.id)} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 cursor-pointer active:scale-95 transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-black text-xl text-slate-800">RUT-{ds.code}</h3>
                                            <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-bold uppercase tracking-wider">{ds.status}</span>
                                        </div>
                                        <div className="text-sm text-slate-500 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <p className="flex items-center font-medium"><MapPin className="w-4 h-4 mr-2 text-indigo-400" /> {vehicle?.plate} ({vehicle?.brand})</p>
                                            <p className="flex items-center font-medium"><PackageX className="w-4 h-4 mr-2 text-indigo-400" /> Tocar para ver clientes</p>
                                        </div>
                                    </div>
                                );
                            })}

                            {activeDispatchSheets.length === 0 && (
                                <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
                                    <CheckCircle className="w-16 h-16 text-indigo-200 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Día Libre</h3>
                                    <p className="text-slate-500 text-sm">No tienes planillas de despacho activas asignadas a tu vehículo en este momento.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (viewMode === 'DELIVERY_LIST') {
        return (
            <div className="h-full flex flex-col bg-slate-100 relative">
                <SystemAlert />

                {/* ACTION MODAL */}
                {modal.isOpen && modal.sale && (
                    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4 animate-fade-in">
                        <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
                            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-1 sm:hidden"></div>
                            
                            <div className={`p-5 text-white flex justify-between items-center ${modal.actionType === 'delivered' ? 'bg-green-600' :
                                modal.actionType === 'partial' ? 'bg-amber-500' : 'bg-red-600'
                                }`}>
                                <h3 className="font-black text-xl flex items-center tracking-tight">
                                    {modal.actionType === 'delivered' && <><CheckCircle className="w-6 h-6 mr-2" /> Reportar Entrega</>}
                                    {modal.actionType === 'partial' && <><AlertTriangle className="w-6 h-6 mr-2" /> Entrega Parcial</>}
                                    {modal.actionType === 'failed' && <><X className="w-6 h-6 mr-2" /> Reportar Rechazo</>}
                                </h3>
                                <button onClick={() => setModal({ isOpen: false, sale: null, actionType: null })} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <p className="font-black text-slate-800 text-lg leading-tight mb-1">{modal.sale.client_name}</p>
                                    <p className="text-sm font-bold text-indigo-600 mb-2">{modal.sale.document_type}: {modal.sale.series}-{modal.sale.number}</p>
                                    <p className="text-sm text-slate-500 flex items-start bg-white p-2 rounded-lg border border-slate-100"><MapPin className="w-4 h-4 mr-1.5 shrink-0 text-slate-400 mt-0.5" /> {modal.sale.client_address}</p>
                                    <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-500">Monto a cobrar:</span>
                                        <span className="text-2xl font-black text-slate-900">S/ {modal.sale.total.toFixed(2)}</span>
                                    </div>
                                </div>

                                {(modal.actionType === 'failed' || modal.actionType === 'partial') && (
                                    <div className="mb-6">
                                        <label className="block text-xs font-black text-slate-600 mb-2 uppercase tracking-wider">Motivo de la incidencia (Obligatorio)</label>
                                        <textarea
                                            className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl p-3 text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                            rows={3}
                                            placeholder={modal.actionType === 'failed' ? "Ej. Local cerrado, cliente no tiene dinero..." : "Ej. Devolución de 1 caja rota..."}
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                        ></textarea>
                                    </div>
                                )}

                                <button
                                    onClick={handleConfirmAction}
                                    disabled={isProcessing}
                                    className={`w-full py-4 rounded-xl font-black text-white shadow-lg flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${modal.actionType === 'delivered' ? 'bg-green-600 shadow-green-600/30' :
                                        modal.actionType === 'partial' ? 'bg-amber-500 shadow-amber-500/30' : 'bg-red-600 shadow-red-600/30'
                                        }`}
                                >
                                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : 'ENVIAR REPORTE AL SISTEMA'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* FINISH CONFIRM MODAL */}
                {showFinishConfirm && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col p-8 text-center">
                            <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
                                <Flag className="w-10 h-10 text-indigo-600" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Finalizar Ruta</h3>
                            <p className="text-slate-500 text-sm mb-6 font-medium">Al cerrar la ruta, el sistema notificará a gerencia que el vehículo retorna al almacén para la liquidación de dinero.</p>

                            {!allCompleted && (
                                <div className="bg-amber-50 text-amber-800 text-sm p-4 rounded-xl mb-6 text-left border border-amber-200 flex items-start">
                                    <AlertTriangle className="w-5 h-5 mr-2 shrink-0 mt-0.5 text-amber-600" />
                                    <span>Tienes <strong>{groupedSales.pending.length} documentos pendientes</strong>. Al cerrar la ruta se informará como no visitados.</span>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowFinishConfirm(false)}
                                    className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleFinishRoute}
                                    disabled={isProcessing}
                                    className="flex-1 py-3 text-white font-bold bg-indigo-600 hover:bg-indigo-700 rounded-xl flex justify-center items-center shadow-lg shadow-indigo-600/30 transition-colors"
                                >
                                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Cierre'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* HEADER */}
                <div className="bg-slate-900 text-white p-5 rounded-b-[2rem] shadow-xl sticky top-0 z-10">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setViewMode('DISPATCH_SELECT')} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors text-white">
                                    <X className="w-4 h-4" />
                                </button>
                                <h2 className="text-xl font-black tracking-tight">RUT-{currentDispatch?.code}</h2>
                            </div>
                        </div>
                        <div className="text-right bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10">
                            <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider block mb-0.5">Avance</span>
                            <span className="font-black text-2xl text-white leading-none">
                                {groupedSales.closed.length}<span className="text-indigo-300 text-lg">/{dispatchSales.length}</span>
                            </span>
                        </div>
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-2 mt-2 overflow-hidden shadow-inner">
                        <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${dispatchSales.length > 0 ? (groupedSales.closed.length / dispatchSales.length) * 100 : 0}%` }}
                        ></div>
                    </div>
                </div>

                {/* LIST */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">

                    {isLoadingData ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
                    ) : (
                        <>
                            {/* EN RUTA (PENDIENTES) */}
                            {groupedSales.pending.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center ml-1">
                                        <PlayCircle className="w-4 h-4 mr-2 text-indigo-500" /> Pendientes ({groupedSales.pending.length})
                                    </h3>
                                    <div className="space-y-4">
                                        {groupedSales.pending.map((s, idx) => (
                                            <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
                                                <div className="absolute top-0 left-0 bottom-0 w-2 bg-indigo-500"></div>
                                                <div className="p-4 pl-5">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg"># {idx + 1}</span>
                                                        <div className="text-right">
                                                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg tracking-wider ${s.document_type === 'FACTURA' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                                                                {s.document_type}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <h4 className="font-black text-lg text-slate-900 leading-tight mb-1 pr-16">{s.client_name}</h4>
                                                    <div className="font-mono text-xs font-bold text-slate-500 mb-2">{s.series}-{s.number}</div>
                                                    <div className="text-xs text-slate-500 flex items-start bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                        <MapPin className="w-4 h-4 mr-1.5 shrink-0 text-slate-400 mt-0.5" />
                                                        <span className="leading-tight">{s.client_address}</span>
                                                    </div>

                                                    <div className="mt-4 flex gap-2">
                                                        <button
                                                            onClick={() => openActionModal(s, 'failed')}
                                                            className="flex-1 bg-red-50 text-red-700 font-bold text-xs py-3 rounded-xl border border-red-100 hover:bg-red-100 transition-colors"
                                                        >RECHAZO</button>
                                                        <button
                                                            onClick={() => openActionModal(s, 'partial')}
                                                            className="flex-1 bg-amber-50 text-amber-700 font-bold text-xs py-3 rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors"
                                                        >PARCIAL</button>
                                                        <button
                                                            onClick={() => openActionModal(s, 'delivered')}
                                                            className="flex-2 bg-green-600 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md hover:bg-green-700 transition-colors"
                                                        >ENTREGADO</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* COMPLETADOS */}
                            {groupedSales.closed.length > 0 && (
                                <div className="mt-8">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center ml-1">
                                        <CheckCircle className="w-4 h-4 mr-2 text-slate-400" /> Gestionados ({groupedSales.closed.length})
                                    </h3>
                                    <div className="space-y-3 opacity-80">
                                        {groupedSales.closed.map((s) => {
                                            let scColor = 'bg-slate-50 border-slate-200';
                                            let scBadge = 'bg-green-100 text-green-700';
                                            let scIcon = <CheckCircle className="w-4 h-4 mr-1" />;
                                            let scText = 'Entregado';

                                            if (s.dispatch_status === 'failed') {
                                                scBadge = 'bg-red-100 text-red-700';
                                                scIcon = <X className="w-4 h-4 mr-1" />;
                                                scText = 'Rechazado';
                                            } else if (s.dispatch_status === 'partial') {
                                                scBadge = 'bg-amber-100 text-amber-700';
                                                scIcon = <AlertTriangle className="w-4 h-4 mr-1" />;
                                                scText = 'Parcial';
                                            }

                                            return (
                                                <div key={s.id} className={`p-4 rounded-2xl border ${scColor} flex justify-between items-center bg-white shadow-sm`}>
                                                    <div className="pr-4">
                                                        <div className="text-xs font-mono font-bold text-slate-500 mb-0.5">{s.series}-{s.number}</div>
                                                        <div className="text-sm font-bold text-slate-800 line-clamp-1">{s.client_name}</div>
                                                    </div>
                                                    <div className={`flex items-center text-[10px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${scBadge}`}>
                                                        {scIcon} {scText}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* FIXED BOTTOM BAR FOR FINISH */}
                {dispatchSales.length > 0 && !isLoadingData && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-100 via-slate-100 to-transparent pt-12 pointer-events-none">
                        <button
                            onClick={() => setShowFinishConfirm(true)}
                            className={`w-full py-4 rounded-2xl font-black text-white shadow-2xl flex items-center justify-center transition-all pointer-events-auto active:scale-95 ${allCompleted ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/40 animate-bounce-slight' : 'bg-slate-800 hover:bg-slate-900 shadow-slate-900/30'
                                }`}
                        >
                            <Flag className="w-5 h-5 mr-2" />
                            TERMINAR REPARTO Y RUTA
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return null;
};
