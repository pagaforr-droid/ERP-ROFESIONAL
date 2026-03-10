import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../services/store';
import { Truck, MapPin, Camera, X, CheckCircle, Navigation, Info, PackageX, AlertTriangle, User, Loader2, PlayCircle, Clock, Flag } from 'lucide-react';
import { Sale, DispatchSheet } from '../types';

type ViewMode = 'DRIVER_SELECT' | 'DISPATCH_SELECT' | 'DELIVERY_LIST';

interface DeliveryModalState {
    isOpen: boolean;
    sale: Sale | null;
    actionType: 'delivered' | 'partial' | 'failed' | null;
}

export const MobileDelivery: React.FC = () => {
    const { drivers, vehicles, dispatchSheets, sales, sellers, updateSaleDeliveryStatus, updateDispatchStatus } = useStore();

    const [viewMode, setViewMode] = useState<ViewMode>('DRIVER_SELECT');
    const [currentDriverId, setCurrentDriverId] = useState('');
    const [currentDispatchId, setCurrentDispatchId] = useState('');

    // Modal State
    const [modal, setModal] = useState<DeliveryModalState>({ isOpen: false, sale: null, actionType: null });
    const [reason, setReason] = useState('');
    const [photoBase64, setPhotoBase64] = useState<string | undefined>();
    const [location, setLocation] = useState<{ lat: number, lng: number } | undefined>();
    const [isLocating, setIsLocating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Derived Data
    const currentDriver = drivers.find(d => d.id === currentDriverId);
    const driverVehicles = vehicles.filter(v => v.driver_id === currentDriverId);

    const activeDispatchSheets = useMemo(() => {
        if (!currentDriverId) return [];
        const vehicleIds = driverVehicles.map(v => v.id);
        return dispatchSheets.filter(ds =>
            vehicleIds.includes(ds.vehicle_id) &&
            (ds.status === 'pending' || ds.status === 'in_transit')
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [dispatchSheets, driverVehicles, currentDriverId]);

    const currentDispatch = dispatchSheets.find(ds => ds.id === currentDispatchId);

    // Sales for current dispatch sorted by Seller -> Document Type -> Number
    const dispatchSales = useMemo(() => {
        if (!currentDispatch) return [];

        const localSales = sales.filter(s => currentDispatch.sale_ids.includes(s.id));

        // We need to find the seller for each sale. Usually it's in the sale items or order, 
        // but assuming the app links it via origin_order_id or we can just sort by created_at.
        // Because `seller_id` is unfortunately not directly on `Sale` in standard DB (only order),
        // we'll try to sort by standard document criteria: Document Type -> Series -> Number

        return localSales.sort((a, b) => {
            // Sort 1: Document Type (Boleta first, then Factura)
            if (a.document_type === 'BOLETA' && b.document_type !== 'BOLETA') return -1;
            if (a.document_type !== 'BOLETA' && b.document_type === 'BOLETA') return 1;

            if (a.document_type === 'FACTURA' && b.document_type !== 'FACTURA') return -1;
            if (a.document_type !== 'FACTURA' && b.document_type === 'FACTURA') return 1;

            // Sort 2: Series
            if (a.series < b.series) return -1;
            if (a.series > b.series) return 1;

            // Sort 3: Number
            return a.number.localeCompare(b.number);
        });
    }, [sales, currentDispatch]);

    // Handlers
    const handleDriverSelect = (id: string) => {
        if (!id) return;
        setCurrentDriverId(id);
        setViewMode('DISPATCH_SELECT');
    };

    const handleDispatchSelect = (id: string) => {
        setCurrentDispatchId(id);
        setViewMode('DELIVERY_LIST');
    };

    const openActionModal = (sale: Sale, actionType: 'delivered' | 'partial' | 'failed') => {
        setModal({ isOpen: true, sale, actionType });
        setReason('');
        setPhotoBase64(undefined);
        setLocation(undefined);
    };

    const handleGetLocation = () => {
        setIsLocating(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                    setIsLocating(false);
                },
                (error) => {
                    alert("No se pudo obtener la ubicación. Revise permisos.");
                    setIsLocating(false);
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        } else {
            alert("Geolocalización no soportada en este dispositivo.");
            setIsLocating(false);
        }
    };

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoBase64(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleConfirmAction = async () => {
        if (!modal.sale || !modal.actionType) return;

        const requiresJustification = modal.actionType === 'failed' || modal.actionType === 'partial';
        if (requiresJustification && !reason.trim()) {
            alert("Debe ingresar un motivo para esta acción.");
            return;
        }
        if (requiresJustification && !photoBase64) {
            alert("Debe adjuntar una foto como evidencia.");
            return;
        }

        setIsProcessing(true);
        // Simulate network request
        await new Promise(res => setTimeout(res, 800));

        updateSaleDeliveryStatus(
            modal.sale.id,
            modal.actionType,
            {
                reason,
                photo: photoBase64,
                location
            }
        );

        setIsProcessing(false);
        setModal({ isOpen: false, sale: null, actionType: null });
    };

    const groupedSales = useMemo(() => {
        // Group by delivery status for UI visualization
        const pendingAndInTransit = dispatchSales.filter(s => s.dispatch_status === 'pending' || s.dispatch_status === 'assigned' || s.dispatch_status === 'in_transit');
        const deliveredOrClosed = dispatchSales.filter(s => s.dispatch_status === 'delivered' || s.dispatch_status === 'liquidated' || s.dispatch_status === 'failed' || s.dispatch_status === 'partial');
        return { pending: pendingAndInTransit, closed: deliveredOrClosed };
    }, [dispatchSales]);

    const allCompleted = dispatchSales.length > 0 && groupedSales.pending.length === 0;

    const handleFinishRoute = () => {
        if (!currentDispatchId) return;
        setIsProcessing(true);
        // Optional: Wait for simulated delay
        setTimeout(() => {
            updateDispatchStatus(currentDispatchId, 'completed');
            setIsProcessing(false);
            setShowFinishConfirm(false);
            alert("Ruta finalizada. Los datos ya están listos para liquidación.");
            setViewMode('DISPATCH_SELECT');
        }, 800);
    };

    // --- VIEWS ---

    if (viewMode === 'DRIVER_SELECT') {
        return (
            <div className="h-full bg-slate-100 p-4 flex flex-col justify-center items-center">
                <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center border-t-4 border-indigo-600">
                    <Truck className="w-16 h-16 mx-auto text-indigo-600 mb-4 bg-indigo-50 p-3 rounded-full" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Módulo de Reparto</h2>
                    <p className="text-slate-500 mb-6 text-sm">Seleccione el conductor para ver las planillas asignadas.</p>
                    <div className="space-y-3">
                        <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Conductor / Repartidor</label>
                        <select className="w-full p-4 border border-slate-300 rounded-lg text-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" onChange={(e) => handleDriverSelect(e.target.value)} value={currentDriverId}>
                            <option value="">-- Seleccionar --</option>
                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        );
    }

    if (viewMode === 'DISPATCH_SELECT') {
        return (
            <div className="h-full bg-slate-100 p-4 flex flex-col">
                <div className="flex items-center mb-6">
                    <button onClick={() => setViewMode('DRIVER_SELECT')} className="p-2 bg-white rounded-full shadow mr-3">
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Planillas de Despacho</h2>
                        <p className="text-sm text-slate-500">{currentDriver?.name}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {activeDispatchSheets.map(ds => {
                        const vehicle = vehicles.find(v => v.id === ds.vehicle_id);
                        return (
                            <div key={ds.id} onClick={() => handleDispatchSelect(ds.id)} className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-indigo-500 cursor-pointer hover:bg-indigo-50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-slate-800">Planilla N° {ds.code}</h3>
                                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold uppercase">{ds.status}</span>
                                </div>
                                <div className="text-sm text-slate-500 space-y-1">
                                    <p><MapPin className="w-4 h-4 inline mr-1" /> Vehículo: {vehicle?.plate} ({vehicle?.brand})</p>
                                    <p><PackageX className="w-4 h-4 inline mr-1" /> {ds.sale_ids.length} Documentos a repartir</p>
                                </div>
                            </div>
                        );
                    })}

                    {activeDispatchSheets.length === 0 && (
                        <div className="text-center p-8 bg-white rounded-xl shadow border border-slate-200 border-dashed">
                            <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">No hay planillas de despacho activas asignadas a su vehículo.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (viewMode === 'DELIVERY_LIST') {
        return (
            <div className="h-full flex flex-col bg-slate-100 relative">

                {/* ACTION MODAL */}
                {modal.isOpen && modal.sale && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className={`p-4 text-white flex justify-between items-center ${modal.actionType === 'delivered' ? 'bg-green-600' :
                                modal.actionType === 'partial' ? 'bg-amber-500' : 'bg-red-600'
                                }`}>
                                <h3 className="font-bold text-lg flex items-center">
                                    {modal.actionType === 'delivered' && <><CheckCircle className="w-5 h-5 mr-2" /> Entregado</>}
                                    {modal.actionType === 'partial' && <><AlertTriangle className="w-5 h-5 mr-2" /> Entrega Parcial</>}
                                    {modal.actionType === 'failed' && <><X className="w-5 h-5 mr-2" /> Rechazado / Cerrado</>}
                                </h3>
                                <button onClick={() => setModal({ isOpen: false, sale: null, actionType: null })} className="bg-white/20 p-1.5 rounded-full"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="p-5 overflow-y-auto flex-1">
                                <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <p className="font-bold text-slate-800 text-sm">{modal.sale.client_name}</p>
                                    <p className="text-xs text-slate-500">{modal.sale.document_type}: {modal.sale.series}-{modal.sale.number}</p>
                                    <p className="text-xs text-slate-500 mt-1">{modal.sale.client_address}</p>
                                    <p className="text-lg font-bold text-slate-900 mt-2">Total: S/ {modal.sale.total.toFixed(2)}</p>
                                </div>

                                {(modal.actionType === 'failed' || modal.actionType === 'partial') && (
                                    <>
                                        <div className="mb-4">
                                            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Motivo (Obligatorio)</label>
                                            <textarea
                                                className="w-full border-2 border-slate-300 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none"
                                                rows={3}
                                                placeholder={modal.actionType === 'failed' ? "Ej. Local cerrado, no tiene dinero..." : "Ej. Devolución de 1 caja rota..."}
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                            ></textarea>
                                        </div>

                                        <div className="mb-4">
                                            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Evidencia Fotográfica</label>
                                            {!photoBase64 ? (
                                                <div
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-500 cursor-pointer bg-slate-50 hover:bg-slate-100"
                                                >
                                                    <Camera className="w-8 h-8 mb-2" />
                                                    <span className="text-sm font-medium">Tocar para tomar foto</span>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <img src={photoBase64} alt="Evidencia" className="w-full h-48 object-cover rounded-lg border border-slate-200 shadow-sm" />
                                                    <button
                                                        onClick={() => setPhotoBase64(undefined)}
                                                        className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full shadow"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                className="hidden"
                                                ref={fileInputRef}
                                                onChange={handlePhotoCapture}
                                            />
                                        </div>

                                        <div className="mb-6">
                                            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Ubicación GPS</label>
                                            {location ? (
                                                <div className="bg-green-50 border border-green-200 text-green-700 p-2 rounded-lg flex items-center text-sm">
                                                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                                    Ubicación capturada con éxito.
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleGetLocation}
                                                    disabled={isLocating}
                                                    className="w-full py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg flex items-center justify-center font-bold text-sm"
                                                >
                                                    {isLocating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Navigation className="w-4 h-4 mr-2" />}
                                                    Obtener Ubicación Actual
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}

                                {modal.actionType === 'delivered' && (
                                    <p className="text-center text-slate-600 mb-6 font-medium">
                                        ¿Confirma que este pedido ha sido entregado exitosamente?
                                    </p>
                                )}

                                <button
                                    onClick={handleConfirmAction}
                                    disabled={isProcessing}
                                    className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center disabled:opacity-50 ${modal.actionType === 'delivered' ? 'bg-green-600 hover:bg-green-700' :
                                        modal.actionType === 'partial' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                >
                                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CONFIRMAR ACCIÓN'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* FINISH CONFIRM MODAL */}
                {showFinishConfirm && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden flex flex-col p-6 text-center">
                            <Flag className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Finalizar Ruta</h3>
                            <p className="text-slate-500 text-sm mb-6">¿Estás seguro que deseas cerrar esta ruta? Una vez cerrada, administración podrá auditar los resultados para su liquidación final.</p>

                            {!allCompleted && (
                                <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg mb-4 text-left border border-amber-200">
                                    <strong>Aviso:</strong> Aún tienes <strong>{groupedSales.pending.length} documentos pendientes</strong>. Al cerrar la ruta, administración podría marcar estos documentos como no visitados.
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowFinishConfirm(false)}
                                    className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleFinishRoute}
                                    disabled={isProcessing}
                                    className="flex-1 py-3 text-white font-bold bg-green-600 hover:bg-green-700 rounded-xl flex justify-center items-center shadow-md"
                                >
                                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Cierre'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* HEADER */}
                <div className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setViewMode('DISPATCH_SELECT')} className="bg-slate-800 p-1.5 rounded text-slate-300">
                                    <X className="w-4 h-4" />
                                </button>
                                <h2 className="text-lg font-bold">Planilla {currentDispatch?.code}</h2>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{currentDriver?.name}</p>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase block">Avance</span>
                            <span className="font-bold text-lg text-indigo-400">
                                {groupedSales.closed.length}/{dispatchSales.length}
                            </span>
                        </div>
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div
                            className="bg-indigo-500 h-1.5"
                            style={{ width: `${dispatchSales.length > 0 ? (groupedSales.closed.length / dispatchSales.length) * 100 : 0}%` }}
                        ></div>
                    </div>
                </div>

                {/* LIST */}
                <div className="flex-1 overflow-auto p-3 space-y-6">

                    {/* EN RUTA (PENDIENTES) */}
                    {groupedSales.pending.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center border-b border-slate-200 pb-1">
                                <PlayCircle className="w-4 h-4 mr-1 text-slate-400" /> Pendientes de Entrega ({groupedSales.pending.length})
                            </h3>
                            <div className="space-y-3">
                                {groupedSales.pending.map((s, idx) => (
                                    <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative pb-1">
                                        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-indigo-500"></div>
                                        <div className="p-3 pl-4">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{idx + 1}</span>
                                                <div className="text-right flex-1 ml-2">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.document_type === 'FACTURA' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>
                                                        {s.document_type}
                                                    </span>
                                                    <span className="font-mono text-xs font-bold text-slate-700 ml-1">{s.series}-{s.number}</span>
                                                </div>
                                            </div>
                                            <h4 className="font-bold text-sm text-slate-900 leading-tight mb-1">{s.client_name}</h4>
                                            <div className="text-xs text-slate-500 flex items-start mt-2">
                                                <MapPin className="w-3.5 h-3.5 mr-1 mt-0.5 shrink-0 text-slate-400" />
                                                <span className="leading-tight">{s.client_address}</span>
                                            </div>

                                            <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                                                <button
                                                    onClick={() => openActionModal(s, 'failed')}
                                                    className="flex-1 bg-red-50 text-red-700 font-bold text-[11px] py-2 rounded-lg border border-red-100"
                                                >CERRADO</button>
                                                <button
                                                    onClick={() => openActionModal(s, 'partial')}
                                                    className="flex-1 bg-amber-50 text-amber-700 font-bold text-[11px] py-2 rounded-lg border border-amber-100"
                                                >PARCIAL</button>
                                                <button
                                                    onClick={() => openActionModal(s, 'delivered')}
                                                    className="flex-1 bg-green-600 text-white font-bold text-[11px] py-2 rounded-lg shadow-sm"
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
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center border-b border-slate-200 pb-1">
                                <CheckCircle className="w-4 h-4 mr-1 text-slate-400" /> Gestionados ({groupedSales.closed.length})
                            </h3>
                            <div className="space-y-2 opacity-75">
                                {groupedSales.closed.map((s) => {
                                    let scColor = 'bg-slate-100 text-slate-600 border-slate-200';
                                    let scIcon = <CheckCircle className="w-4 h-4" />;
                                    let scText = 'Entregado';

                                    if (s.dispatch_status === 'failed') {
                                        scColor = 'bg-red-50 text-red-700 border-red-200';
                                        scIcon = <X className="w-4 h-4" />;
                                        scText = 'Cerrado/Rechazado';
                                    } else if (s.dispatch_status === 'partial') {
                                        scColor = 'bg-amber-50 text-amber-700 border-amber-200';
                                        scIcon = <AlertTriangle className="w-4 h-4" />;
                                        scText = 'Parcial';
                                    } else {
                                        scColor = 'bg-green-50 text-green-700 border-green-200';
                                    }

                                    return (
                                        <div key={s.id} className={`p-3 rounded-lg border ${scColor} flex justify-between items-center`}>
                                            <div>
                                                <div className="text-xs font-mono font-bold">{s.series}-{s.number}</div>
                                                <div className="text-[11px] truncate max-w-[200px]">{s.client_name}</div>
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase">
                                                {scIcon} {scText}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* BOTO DE CIERRE (Solo visible al final o si no hay pendientes) */}
                    {dispatchSales.length > 0 && (
                        <div className="mt-8 mb-4">
                            <button
                                onClick={() => setShowFinishConfirm(true)}
                                className={`w-full py-4 rounded-xl font-black text-white shadow-xl flex items-center justify-center transition-all ${allCompleted ? 'bg-indigo-600 hover:bg-indigo-700 animate-pulse' : 'bg-slate-800 hover:bg-slate-900'
                                    }`}
                            >
                                <Flag className="w-6 h-6 mr-2" />
                                TERMINAR REPARTO Y RUTA
                            </button>
                            {!allCompleted && (
                                <p className="text-center text-xs text-slate-500 mt-2 font-medium">Aún quedan pedidos pendientes por gestionar.</p>
                            )}
                        </div>
                    )}

                </div>
            </div>
        );
    }

    return null;
};
