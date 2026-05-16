import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../services/store';
import { Truck, CheckSquare, FileText, Filter, Search, XCircle, RefreshCw, Eye, AlertTriangle } from 'lucide-react';
import { Sale, DispatchSheet } from '../types';
import { supabase } from '../services/supabase';
import { PdfEngine } from './PdfEngine';

export const GuiaManager: React.FC = () => {
    const { company, transporters, drivers, vehicles, generateGuiasFromSales } = useStore();

    const [activeTab, setActiveTab] = useState<'pendientes' | 'emitidas'>('pendientes');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [docTypeFilter, setDocTypeFilter] = useState<'ALL' | 'FACTURA' | 'BOLETA'>('ALL');

    const [realSales, setRealSales] = useState<Sale[]>([]);
    const [realDispatchSheets, setRealDispatchSheets] = useState<DispatchSheet[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // Generación Modal
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [transportModality, setTransportModality] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE');
    const [guiaTransporterId, setGuiaTransporterId] = useState('');
    const [guiaDriverId, setGuiaDriverId] = useState('');
    const [guiaVehicleId, setGuiaVehicleId] = useState('');
    
    // View Modal
    const [viewDoc, setViewDoc] = useState<any>(null);

    const [systemModal, setSystemModal] = useState<{ isOpen: boolean, type: 'error' | 'warning' | 'info' | 'success', message: string }>({ isOpen: false, type: 'info', message: '' });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Cargar últimos documentos (limitamos a 500 para rendimiento)
            const { data: salesData } = await supabase.from('sales').select('*').in('document_type', ['FACTURA', 'BOLETA']).order('created_at', { ascending: false }).limit(500);
            const { data: dsData } = await supabase.from('dispatch_sheets').select('*').order('created_at', { ascending: false }).limit(500);
            
            if (salesData) {
                setRealSales(salesData as Sale[]);
                useStore.setState({ sales: salesData as Sale[] });
            }
            if (dsData) {
                setRealDispatchSheets(dsData as DispatchSheet[]);
                useStore.setState({ dispatchSheets: dsData as DispatchSheet[] });
            }

            // Load logistics entities if missing
            const state = useStore.getState();
            if (state.transporters.length === 0) {
                 const { data } = await supabase.from('transporters').select('*');
                 if (data) useStore.setState({ transporters: data as any[] });
            }
            if (state.vehicles.length === 0) {
                 const { data } = await supabase.from('vehicles').select('*');
                 if (data) useStore.setState({ vehicles: data as any[] });
            }
            if (state.drivers.length === 0) {
                 const { data } = await supabase.from('drivers').select('*');
                 if (data) useStore.setState({ drivers: data as any[] });
            }
            if (!state.company.series || state.company.series.length === 0) {
                 const { data } = await supabase.from('document_series').select('*').eq('is_active', true);
                 if (data && data.length > 0) {
                      useStore.getState().updateCompany({ ...state.company, series: data as any[] });
                 }
            }

        } catch (error) {
            console.error("Error fetching Guia docs:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Effect for auto-selecting Driver when Vehicle is chosen (Private Modality)
    useEffect(() => {
        if (transportModality === 'PRIVATE' && guiaVehicleId) {
            const vehicle = vehicles.find(v => v.id === guiaVehicleId);
            if (vehicle) {
                if (vehicle.transporter_id && !guiaTransporterId) {
                    setGuiaTransporterId(vehicle.transporter_id);
                }
                if (vehicle.driver_id) {
                    setGuiaDriverId(vehicle.driver_id);
                }
            }
        }
    }, [guiaVehicleId, vehicles, transportModality]);

    // Lógica para filtrar pendientes
    const pendientes = useMemo(() => {
        let filtered = realSales.filter(s => !s.guide_vehicle_id && s.dispatch_status !== 'assigned' && s.status !== 'canceled');
        
        if (docTypeFilter !== 'ALL') {
            filtered = filtered.filter(s => s.document_type === docTypeFilter);
        }

        if (searchTerm) {
            filtered = filtered.filter(s => 
                (s.series + '-' + s.number).toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.client_name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (dateFilter) {
            filtered = filtered.filter(s => s.created_at.startsWith(dateFilter));
        }

        // Ordenar por fecha y hora descendente
        return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [realSales, searchTerm, dateFilter, docTypeFilter]);

    // Lógica para guías emitidas
    const emitidas = useMemo(() => {
        // Asumimos que las Guías de Remisión Remitente tienen el formato G001, etc.
        // O provienen de generateGuiasFromSales
        let filtered = realDispatchSheets.filter(d => d.code.startsWith('T') || d.code.startsWith('G') || d.code.includes('-'));
        // Refinamos el filtro: dispatch_sheets que solo tienen 1 venta podrían considerarse GRE individuales, o filtramos por código.
        // Para asegurar compatibilidad, tomaremos las que comiencen con "T" o "G" (T001, G001).
        filtered = filtered.filter(d => /^[TG]\d{3}-/.test(d.code));

        if (searchTerm) {
            filtered = filtered.filter(d => d.code.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        if (dateFilter) {
            filtered = filtered.filter(d => d.date.startsWith(dateFilter));
        }

        return filtered;
    }, [realDispatchSheets, searchTerm, dateFilter]);

    const handleToggleSelectAll = () => {
        if (selectedIds.size === pendientes.length && pendientes.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(pendientes.map(p => p.id)));
        }
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleOpenGenerateGuias = () => {
        if (selectedIds.size === 0) {
            setSystemModal({ isOpen: true, type: 'warning', message: "No hay documentos seleccionados." });
            return;
        }
        setIsGenerateModalOpen(true);
    };

    const handleConfirmGenerateGuias = async () => {
        if (transportModality === 'PRIVATE') {
            if (!guiaTransporterId || !guiaDriverId || !guiaVehicleId) {
                setSystemModal({ isOpen: true, type: 'warning', message: "Para transporte privado, debe seleccionar empresa, conductor y vehículo." });
                return;
            }
        } else {
            if (!guiaTransporterId) {
                setSystemModal({ isOpen: true, type: 'warning', message: "Para transporte público, debe seleccionar la empresa de transporte." });
                return;
            }
        }
        
        try {
            const idsArray = Array.from(selectedIds) as string[];
            await generateGuiasFromSales(idsArray, transportModality, guiaTransporterId, guiaDriverId, guiaVehicleId);
            
            setIsGenerateModalOpen(false);
            setSelectedIds(new Set());
            await fetchData();
            setSystemModal({ isOpen: true, type: 'success', message: `Se generaron ${idsArray.length} Guías de Remisión existosamente.` });
        } catch (error: any) {
            setSystemModal({ isOpen: true, type: 'error', message: error.message || 'Error al generar guías.' });
        }
    };

    const handleViewPdf = async (guia: DispatchSheet) => {
        try {
            // Reconstruimos la data para la plantilla
            let originSale: Sale | null = null;
            if (guia.sale_ids && guia.sale_ids.length > 0) {
                // Fetch de la venta y sus items si es necesario, o buscarla en realSales (aunque realSales puede no tener todas)
                const s = realSales.find(x => x.id === guia.sale_ids[0]);
                if (s) {
                    originSale = s;
                } else {
                     const { data } = await supabase.from('sales').select('*, sale_items(*)').eq('id', guia.sale_ids[0]).maybeSingle();
                     if (data) originSale = data as any;
                }
            }

            const transporter = transporters.find(t => t.id === originSale?.guide_transporter_id);
            const vehicle = vehicles.find(v => v.id === originSale?.guide_vehicle_id);
            const driver = drivers.find(d => d.id === originSale?.guide_driver_id);

            const printData = {
                ...guia,
                _isGuia: true, // flag para asegurar
                sale_ref: originSale ? `${originSale.series}-${originSale.number}` : null,
                client_ruc: originSale?.client_ruc,
                client_name: originSale?.client_name,
                delivery_address: originSale?.client_address,
                items: originSale?.items || [],
                guide_transport_modality: originSale?.guide_transport_modality || 'PUBLIC',
                transporter_name: transporter?.name,
                transporter_ruc: transporter?.ruc,
                vehicle_plate: vehicle?.plate,
                driver_name: driver?.name,
                driver_license: driver?.license,
            };

            await PdfEngine.openDocument(printData, 'GUIA', company);
        } catch (error: any) {
             setSystemModal({ isOpen: true, type: 'error', message: 'No se pudo generar el PDF. ' + error.message });
        }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-full relative flex flex-col h-[calc(100vh-4rem)]">
            {systemModal.isOpen && (
                <div className="absolute inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-scale-up">
                        {systemModal.type === 'error' && <div className="w-12 h-12 text-red-500 mx-auto mb-4 bg-red-50 p-2 rounded-full flex items-center justify-center"><span className="text-2xl font-black">X</span></div>}
                        {systemModal.type === 'warning' && <div className="w-12 h-12 text-orange-500 mx-auto mb-4 bg-orange-50 p-2 rounded-full flex items-center justify-center"><AlertTriangle className="w-8 h-8" /></div>}
                        {systemModal.type === 'success' && <div className="w-12 h-12 text-green-500 mx-auto mb-4 bg-green-50 p-2 rounded-full flex items-center justify-center"><span className="text-2xl font-black">✓</span></div>}
                        {systemModal.type === 'info' && <div className="w-12 h-12 text-blue-500 mx-auto mb-4 bg-blue-50 p-2 rounded-full flex items-center justify-center"><span className="text-2xl font-black">i</span></div>}
                        <h3 className="text-lg font-black text-slate-800 mb-2">
                            {systemModal.type === 'error' ? 'Error' : systemModal.type === 'warning' ? 'Atención' : systemModal.type === 'success' ? 'Éxito' : 'Información'}
                        </h3>
                        <p className="text-sm text-slate-600 mb-6 whitespace-pre-line">{systemModal.message}</p>
                        <button onClick={() => setSystemModal({ ...systemModal, isOpen: false })} className="px-8 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700">Aceptar</button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <span className="bg-blue-600 text-white p-2 rounded-lg"><Truck className="w-6 h-6" /></span>
                        Guías de Remisión (GRE)
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">Generación y control de Guías de Remisión Remitente (Transporte Público y Privado).</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                <div className="flex border-b border-slate-200 bg-slate-50 flex-shrink-0">
                    <button
                        className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'pendientes' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                        onClick={() => setActiveTab('pendientes')}
                    >
                        Comprobantes sin Guía ({pendientes.length})
                    </button>
                    <button
                        className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'emitidas' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                        onClick={() => setActiveTab('emitidas')}
                    >
                        Guías Emitidas ({emitidas.length})
                    </button>
                </div>

                <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between flex-shrink-0">
                    <div className="flex gap-4 flex-1">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder={activeTab === 'pendientes' ? "Buscar por documento o cliente..." : "Buscar por número de guía..."}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <input
                            type="date"
                            className="border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                        />
                        {activeTab === 'pendientes' && (
                            <select
                                className="border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-bold"
                                value={docTypeFilter}
                                onChange={(e) => setDocTypeFilter(e.target.value as any)}
                            >
                                <option value="ALL">Todos los Tipos</option>
                                <option value="FACTURA">Solo Facturas</option>
                                <option value="BOLETA">Solo Boletas</option>
                            </select>
                        )}
                    </div>
                    <button onClick={fetchData} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 flex items-center gap-2 transition-colors border border-slate-300">
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                </div>

                <div className="flex-1 overflow-auto bg-slate-50">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 sticky top-0 z-10 text-xs uppercase text-slate-600 font-black shadow-sm">
                            <tr>
                                {activeTab === 'pendientes' && (
                                    <th className="p-4 border-b border-slate-200 w-12 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={selectedIds.size === pendientes.length && pendientes.length > 0}
                                            onChange={handleToggleSelectAll}
                                        />
                                    </th>
                                )}
                                <th className="p-4 border-b border-slate-200">Fecha</th>
                                <th className="p-4 border-b border-slate-200">Documento</th>
                                {activeTab === 'pendientes' ? (
                                    <>
                                        <th className="p-4 border-b border-slate-200">Cliente</th>
                                        <th className="p-4 border-b border-slate-200">Vendedor</th>
                                        <th className="p-4 border-b border-slate-200 text-right">Monto</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-4 border-b border-slate-200">Vehículo</th>
                                        <th className="p-4 border-b border-slate-200">Estado</th>
                                        <th className="p-4 border-b border-slate-200 text-center">Acciones</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activeTab === 'pendientes' && pendientes.map((sale) => {
                                const isFactura = sale.document_type === 'FACTURA';
                                const rowBg = selectedIds.has(sale.id) ? 'bg-blue-50' : (isFactura ? 'bg-blue-50/20' : 'bg-orange-50/20');
                                const d = new Date(sale.created_at);
                                const timeString = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                return (
                                <tr key={sale.id} className={`hover:bg-blue-50/50 transition-colors ${rowBg}`}>
                                    <td className="p-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={selectedIds.has(sale.id)}
                                            onChange={() => handleToggleSelect(sale.id)}
                                        />
                                    </td>
                                    <td className="p-4 text-sm text-slate-600">
                                        <div className="font-bold">{d.toLocaleDateString()}</div>
                                        <div className="text-xs text-slate-400">{timeString}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className={`font-bold text-[10px] px-2 py-0.5 inline-block rounded mb-1 ${isFactura ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-orange-100 text-orange-800 border border-orange-200'}`}>
                                            {sale.document_type}
                                        </div>
                                        <div className="text-sm font-black text-slate-700">{sale.series}-{sale.number}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800 line-clamp-1">{sale.client_name}</div>
                                        <div className="text-xs text-slate-500">RUC/DNI: {sale.client_ruc}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-700 text-sm">{sale.seller_name || 'No asignado'}</div>
                                    </td>
                                    <td className="p-4 text-right font-black text-slate-800 text-base">S/ {sale.total.toFixed(2)}</td>
                                </tr>
                            )})}
                            {activeTab === 'emitidas' && emitidas.map((guia) => {
                                const vehicle = vehicles.find(v => v.id === guia.vehicle_id);
                                return (
                                    <tr key={guia.id} className="hover:bg-slate-50 transition-colors bg-white">
                                        <td className="p-4 text-sm text-slate-600">{new Date(guia.date).toLocaleDateString()}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">GUIA DE REMISIÓN</div>
                                            <div className="text-xs text-blue-600 font-bold">{guia.code}</div>
                                        </td>
                                        <td className="p-4">
                                            {vehicle ? (
                                                <>
                                                    <div className="font-bold text-slate-800">Placa: {vehicle.plate}</div>
                                                    <div className="text-xs text-slate-500">{vehicle.brand}</div>
                                                </>
                                            ) : (
                                                <div className="text-sm text-slate-500 italic">No especificado / Tercero</div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                                guia.sunat_status === 'ACCEPTED' ? 'bg-green-100 text-green-800 border-green-300' :
                                                guia.sunat_status === 'REJECTED' ? 'bg-red-100 text-red-800 border-red-300' :
                                                guia.sunat_status === 'SENT' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                                'bg-yellow-100 text-yellow-800 border-yellow-300'
                                            }`}>
                                                {guia.sunat_status || 'LOCAL'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                             <button onClick={() => handleViewPdf(guia)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver PDF">
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {(activeTab === 'pendientes' && pendientes.length === 0) && (
                                <tr><td colSpan={5} className="p-12 text-center text-slate-400 font-medium">No hay comprobantes pendientes de guía.</td></tr>
                            )}
                            {(activeTab === 'emitidas' && emitidas.length === 0) && (
                                <tr><td colSpan={5} className="p-12 text-center text-slate-400 font-medium">No hay guías emitidas.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {activeTab === 'pendientes' && (
                    <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex-shrink-0 z-20">
                        <div className="text-sm font-bold text-slate-500">
                            {selectedIds.size} documentos seleccionados
                        </div>
                        <button
                            onClick={handleOpenGenerateGuias}
                            disabled={selectedIds.size === 0}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2
                                ${selectedIds.size === 0
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                                }`}
                        >
                            <FileText className="w-5 h-5" /> Generar Guías para Lote
                        </button>
                    </div>
                )}
            </div>

            {/* Modal Generar Guías */}
            {isGenerateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-[550px] border border-slate-200 overflow-hidden animate-scale-up">
                        <div className="bg-slate-50 border-b border-slate-200 p-5 flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Truck className="w-6 h-6 text-blue-600" />
                                Nueva Guía de Remisión (GRE)
                            </h2>
                            <button onClick={() => setIsGenerateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800">
                                <p className="font-bold text-sm mb-1">Resumen de Generación</p>
                                <p className="text-xs">Se generarán <span className="font-extrabold">{selectedIds.size}</span> guías de remisión (Tipo Remitente). Por favor, defina la modalidad de traslado según la normativa SUNAT.</p>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Modalidad de Traslado (SUNAT)</label>
                                    <div className="flex gap-4">
                                        <label className={`flex-1 flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-colors ${transportModality === 'PRIVATE' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 hover:border-blue-300'}`}>
                                            <input 
                                                type="radio" 
                                                name="modality" 
                                                checked={transportModality === 'PRIVATE'} 
                                                onChange={() => setTransportModality('PRIVATE')}
                                                className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="font-bold text-sm">Transporte Privado (01)</span>
                                        </label>
                                        <label className={`flex-1 flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-colors ${transportModality === 'PUBLIC' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 hover:border-blue-300'}`}>
                                            <input 
                                                type="radio" 
                                                name="modality" 
                                                checked={transportModality === 'PUBLIC'} 
                                                onChange={() => setTransportModality('PUBLIC')}
                                                className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="font-bold text-sm">Transporte Público (02)</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            {transportModality === 'PUBLIC' ? 'Empresa de Transporte Contratada (Courier)' : 'Empresa de Transporte (Propietaria)'}
                                        </label>
                                        <select
                                            className="w-full border-2 border-slate-200 rounded-lg px-4 py-2 bg-white focus:border-blue-500 focus:ring-0 text-sm font-bold"
                                            value={guiaTransporterId}
                                            onChange={(e) => setGuiaTransporterId(e.target.value)}
                                        >
                                            <option value="">-- Seleccionar Empresa --</option>
                                            {transporters.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} (RUC: {t.ruc})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {transportModality === 'PRIVATE' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-1">Vehículo de Traslado</label>
                                                <select
                                                    className="w-full border-2 border-slate-200 rounded-lg px-4 py-2 bg-white focus:border-blue-500 focus:ring-0 text-sm font-bold"
                                                    value={guiaVehicleId}
                                                    onChange={(e) => setGuiaVehicleId(e.target.value)}
                                                >
                                                    <option value="">-- Seleccionar Vehículo --</option>
                                                    {vehicles.filter(v => !guiaTransporterId || v.transporter_id === guiaTransporterId).map(v => (
                                                        <option key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-1">Conductor Asignado</label>
                                                <select
                                                    className="w-full border-2 border-slate-200 rounded-lg px-4 py-2 bg-white focus:border-blue-500 focus:ring-0 text-sm font-bold"
                                                    value={guiaDriverId}
                                                    onChange={(e) => setGuiaDriverId(e.target.value)}
                                                >
                                                    <option value="">-- Seleccionar Conductor --</option>
                                                    {drivers.map(d => (
                                                        <option key={d.id} value={d.id}>{d.name} (DNI: {d.dni})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {transportModality === 'PUBLIC' && (
                                    <div className="text-xs text-slate-500 flex items-start gap-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <span className="text-blue-500 font-bold">Nota:</span>
                                        Para Transporte Público (Modalidad 02), SUNAT solo requiere los datos de la Empresa de Transportes. El transportista emitirá su propia Guía para el vehículo y conductor.
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="border-t border-slate-200 p-5 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsGenerateModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmGenerateGuias}
                                className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                            >
                                <CheckSquare className="w-5 h-5" /> Generar Guías
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
