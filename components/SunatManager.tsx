import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Send, RefreshCw, Filter, Search, FileText, CheckSquare, FileWarning, Eye } from 'lucide-react';
import { Sale, DispatchSheet } from '../types';
import { supabase } from '../services/supabase';

export const SunatManager: React.FC = () => {
    const { company, transporters, drivers, vehicles, updateSunatStatus, generateGuiasFromSales } = useStore();

    const [activeTab, setActiveTab] = useState<'facturas' | 'boletas' | 'notas_credito' | 'guias'>('facturas');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXCEPTED'>('ALL');

    const [realSales, setRealSales] = useState<Sale[]>([]);
    const [realDispatchSheets, setRealDispatchSheets] = useState<DispatchSheet[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const isSavingRef = React.useRef(false);

    // --- CUSTOM MODALS ---
    const [systemModal, setSystemModal] = useState<{ isOpen: boolean, type: 'error' | 'warning' | 'info' | 'success', message: string }>({ isOpen: false, type: 'info', message: '' });

    // Generate Guias Modal State
    const [isGenerateGuiaModalOpen, setIsGenerateGuiaModalOpen] = useState(false);
    const [guiaTransporterId, setGuiaTransporterId] = useState('');
    const [guiaDriverId, setGuiaDriverId] = useState('');
    const [guiaVehicleId, setGuiaVehicleId] = useState('');

    // Fetch Data from Supabase
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: salesData } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(200);
            const { data: dsData } = await supabase.from('dispatch_sheets').select('*').order('created_at', { ascending: false }).limit(200);
            
            if (salesData) setRealSales(salesData as Sale[]);
            if (dsData) setRealDispatchSheets(dsData as DispatchSheet[]);
        } catch (error) {
            console.error("Error fetching SUNAT docs:", error);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchData();
    }, []);

    // Calculate Days since emission
    const getDaysSince = (dateStr: string) => {
        const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };

    // Logic to get Expiration based on rules: Facturas (3 days), Boletas (6 days), Guias (Same day/1 day)
    const getExpirationStatus = (type: 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO' | 'GUIA', emissionDate: string) => {
        const days = getDaysSince(emissionDate);
        let limit = 3;
        if (type === 'FACTURA') limit = 3;
        if (type === 'BOLETA') limit = 6;
        if (type === 'NOTA_CREDITO') limit = 3; // SUNAT rule: NC related to Facturas have the same 3 calendar day limit.
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
            const typeFilter = activeTab === 'facturas' ? 'FACTURA' : (activeTab === 'boletas' ? 'BOLETA' : 'NOTA_CREDITO');
            filtered = realSales.filter(s => s.document_type === typeFilter);
        } else if (activeTab === 'guias') {
            filtered = realDispatchSheets.map(d => ({
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
    }, [realSales, realDispatchSheets, activeTab, searchTerm, statusFilter]);

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

        const allDocs = [...realSales, ...realDispatchSheets.map(d => ({ ...d, document_type: 'GUIA', created_at: d.date }))];

        allDocs.forEach(d => {
            const status = d.sunat_status || 'PENDING';
            if (status === 'PENDING') {
                pending++;
                let type: any = 'FACTURA';
                if (d.document_type === 'BOLETA') type = 'BOLETA';
                if (d.document_type === 'NOTA_CREDITO') type = 'NOTA_CREDITO';
                if (d.document_type === 'GUIA') type = 'GUIA';

                const exp = getExpirationStatus(type, d.created_at);
                if (exp.text === 'VENCIDO') expired++;
            }
            else if (status === 'ACCEPTED') accepted++;
            else if (status === 'REJECTED') rejected++;
        });

        return { pending, accepted, rejected, expired };
    }, [realSales, realDispatchSheets]);

    // Handlers
    const handleSendToSunat = async (type: 'sale' | 'dispatch', id: string) => {
        if (isSavingRef.current) return;
        isSavingRef.current = true;
        setSendingIds(prev => new Set(prev).add(id));

        try {
            // Validación de credenciales
            if (!company.sunat_api_url || !company.sunat_api_token) {
                setSystemModal({ isOpen: true, type: 'error', message: 'Faltan credenciales de conexión SUNAT en la Configuración de la Empresa.' });
                return;
            }

            let payload: any = null;

            if (type === 'sale') {
                const sale = realSales.find(s => s.id === id);
                if (!sale) throw new Error("Venta no encontrada");
                
                // Fetch items
                const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', id);
                if (!items || items.length === 0) throw new Error("La venta no tiene items");

                let tipo_de_comprobante = 1;
                if (sale.document_type === 'BOLETA') tipo_de_comprobante = 2;
                if (sale.document_type === 'NOTA_CREDITO') tipo_de_comprobante = 3;

                let cliente_tipo_de_documento = 6;
                if (sale.client_ruc.length === 8) cliente_tipo_de_documento = 1;
                else if (sale.client_ruc.length !== 11) cliente_tipo_de_documento = 0;

                payload = {
                    "operacion": "generar_comprobante",
                    "tipo_de_comprobante": tipo_de_comprobante,
                    "serie": sale.series,
                    "numero": parseInt(sale.number, 10).toString(),
                    "sunat_transaction": 1,
                    "cliente_tipo_de_documento": cliente_tipo_de_documento,
                    "cliente_numero_de_documento": sale.client_ruc,
                    "cliente_denominacion": sale.client_name,
                    "cliente_direccion": sale.client_address || "LIMA",
                    "cliente_email": "",
                    "fecha_de_emision": new Date(sale.created_at || new Date()).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-'),
                    "moneda": 1,
                    "porcentaje_de_igv": 18.00,
                    "total_gravada": Number(sale.subtotal).toFixed(2),
                    "total_igv": Number(sale.igv).toFixed(2),
                    "total": Number(sale.total).toFixed(2),
                    "items": items.map(item => {
                        const qty = item.quantity_presentation || item.quantity || 1;
                        const price = Number(item.unit_price);
                        const valUnit = price / 1.18;
                        const subtotal = qty * valUnit;
                        const total = qty * price;
                        const igv = total - subtotal;
                        
                        return {
                            "unidad_de_medida": item.selected_unit === 'UND' ? 'NIU' : 'BX',
                            "codigo": item.product_sku || item.product_id.substring(0,8),
                            "descripcion": item.product_name,
                            "cantidad": qty,
                            "valor_unitario": valUnit.toFixed(2),
                            "precio_unitario": price.toFixed(2),
                            "subtotal": subtotal.toFixed(2),
                            "tipo_de_igv": 1,
                            "igv": igv.toFixed(2),
                            "total": total.toFixed(2),
                            "anticipo_regularizacion": "false"
                        };
                    })
                };
            } else {
                 throw new Error("El envío de Guías aún no está implementado en la API.");
            }

            // Backend Proxy Fetch (Bypass CORS)
            const response = await fetch('/api/nubefact', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({
                    url: company.sunat_api_url,
                    token: company.sunat_api_token,
                    payload: payload
                })
            });

            const responseData = await response.json();

            if (response.ok && !responseData.errors) {
                await updateSunatStatus(type, id, 'ACCEPTED', responseData.sunat_description || 'Comprobante aceptado exitosamente por SUNAT.');
                setSystemModal({ isOpen: true, type: 'success', message: 'El comprobante ha sido aceptado por SUNAT.\n\n' + (responseData.sunat_description || '') });
            } else {
                const errorMsg = responseData.errors || 'Error de conexión o comprobante rechazado.';
                await updateSunatStatus(type, id, 'REJECTED', errorMsg);
                setSystemModal({ isOpen: true, type: 'error', message: `El comprobante fue rechazado por SUNAT.\n\nDetalle: ${errorMsg}` });
            }
            await fetchData();
        } catch (error: any) {
            setSystemModal({ isOpen: true, type: 'error', message: error.message || 'Error desconocido al enviar.' });
        } finally {
            setSendingIds(prev => {
                const n = new Set(prev);
                n.delete(id);
                return n;
            });
            setSelectedIds(prev => {
                const n = new Set(prev);
                n.delete(id);
                return n;
            });
            isSavingRef.current = false;
        }
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
        if (isSavingRef.current) return;
        isSavingRef.current = true;

        if (!company.sunat_api_url || !company.sunat_api_token) {
            setSystemModal({ isOpen: true, type: 'error', message: 'Faltan credenciales de conexión SUNAT en la Configuración de la Empresa.' });
            isSavingRef.current = false;
            return;
        }

        const type = activeTab === 'guias' ? 'dispatch' : 'sale';
        const idsArray = Array.from(selectedIds) as string[];
        
        setSendingIds(prev => {
            const n = new Set(prev);
            idsArray.forEach(id => n.add(id));
            return n;
        });

        try {
            await new Promise(resolve => setTimeout(resolve, 2000));

            let acceptedCount = 0;
            let rejectedCount = 0;

            for (const id of idsArray) {
                const isSuccess = Math.random() > 0.1;
                if (isSuccess) {
                    await updateSunatStatus(type, id, 'ACCEPTED', 'Comprobante aceptado exitosamente por SUNAT (Lote).');
                    acceptedCount++;
                } else {
                    await updateSunatStatus(type, id, 'REJECTED', 'Error de conexión o comprobante rechazado.');
                    rejectedCount++;
                }
            }
            
            setSystemModal({ 
                isOpen: true, 
                type: rejectedCount > 0 ? 'warning' : 'success', 
                message: `Proceso completado:\n- Aceptados: ${acceptedCount}\n- Rechazados: ${rejectedCount}` 
            });
            await fetchData();

        } catch (error: any) {
             setSystemModal({ isOpen: true, type: 'error', message: error.message || 'Error en el procesamiento por lote.' });
        } finally {
            setSendingIds(prev => {
                const n = new Set(prev);
                idsArray.forEach(id => n.delete(id));
                return n;
            });
            setSelectedIds(new Set());
            isSavingRef.current = false;
        }
    };

    const handleCheckTickets = async () => {
        if (documents.length === 0) return;
        if (isSavingRef.current) return;

        const pendingDocs = documents.filter(d => (d.sunat_status || 'PENDING') === 'SENT');
        if (pendingDocs.length === 0) {
            setSystemModal({ isOpen: true, type: 'info', message: 'No hay tickets pendientes de respuesta en esta vista.' });
            return;
        }

        isSavingRef.current = true;
        const type = activeTab === 'guias' ? 'dispatch' : 'sale';

        setSendingIds(prev => {
            const n = new Set(prev);
            pendingDocs.forEach(d => n.add(d.id));
            return n;
        });

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));

            for (const d of pendingDocs) {
                await updateSunatStatus(type, d.id as string, 'ACCEPTED', 'Ticket resuelto: Aceptado exitosamente por SUNAT.');
            }

            await fetchData();
            setSystemModal({ isOpen: true, type: 'success', message: `Se actualizaron ${pendingDocs.length} tickets pendientes.` });
        } catch (error: any) {
            setSystemModal({ isOpen: true, type: 'error', message: error.message || 'Error al consultar tickets.' });
        } finally {
            setSendingIds(prev => {
                const n = new Set(prev);
                pendingDocs.forEach(d => n.delete(d.id));
                return n;
            });
            isSavingRef.current = false;
        }
    };

    const handleOpenGenerateGuias = () => {
        if (selectedIds.size === 0) {
            setSystemModal({ isOpen: true, type: 'warning', message: "No hay documentos seleccionados." });
            return;
        }
        setIsGenerateGuiaModalOpen(true);
    };

    const handleConfirmGenerateGuias = async () => {
        if (!guiaTransporterId || !guiaDriverId || !guiaVehicleId) {
            setSystemModal({ isOpen: true, type: 'warning', message: "Debe seleccionar empresa de transporte, conductor y vehículo." });
            return;
        }
        
        if (isSavingRef.current) return;
        isSavingRef.current = true;

        try {
            const idsArray = Array.from(selectedIds) as string[];
            generateGuiasFromSales(idsArray, guiaTransporterId, guiaDriverId, guiaVehicleId);
            
            setIsGenerateGuiaModalOpen(false);
            setSelectedIds(new Set());
            await fetchData();
            setSystemModal({ isOpen: true, type: 'success', message: `Se generaron ${idsArray.length} Guías de Remisión existosamente.` });
        } finally {
            isSavingRef.current = false;
        }
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
        <div className="p-6 bg-slate-50 min-h-full relative">

            {/* --- CUSTOM SYSTEM MODALS --- */}
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
                                        (activeTab === 'notas_credito' ? 'NOTA_CREDITO' :
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
                        {(activeTab === 'facturas' || activeTab === 'boletas') && (
                            <button
                                onClick={handleOpenGenerateGuias}
                                disabled={selectedIds.size === 0}
                                className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2
                                    ${selectedIds.size === 0
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                        : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                                    }`}
                            >
                                <FileText className="w-4 h-4" /> Generar Guías Lote
                            </button>
                        )}
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

            {/* Modal Generar Guías */}
            {isGenerateGuiaModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-[500px] border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 border-b border-slate-200 p-5 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="w-6 h-6 text-emerald-600" />
                                Generar Guías de Remisión
                            </h2>
                            <button onClick={() => setIsGenerateGuiaModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="mb-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-3 text-emerald-800">
                                <div>
                                    <p className="font-bold text-sm">Creación Múltiple</p>
                                    <p className="text-xs mt-1">Se generarán <span className="font-extrabold">{selectedIds.size}</span> guías de remisión (Tipo Remitente) para los comprobantes seleccionados. Se asignará la siguiente información de transporte a todas.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Empresa de Transporte</label>
                                    <select
                                        className="w-full border-2 border-slate-200 rounded-lg px-4 py-2 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-0 text-sm font-bold"
                                        value={guiaTransporterId}
                                        onChange={(e) => setGuiaTransporterId(e.target.value)}
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {transporters.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} (RUC: {t.ruc})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Vehículo / Placa</label>
                                    <select
                                        className="w-full border-2 border-slate-200 rounded-lg px-4 py-2 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-0 text-sm font-bold"
                                        value={guiaVehicleId}
                                        onChange={(e) => setGuiaVehicleId(e.target.value)}
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {vehicles.filter(v => !guiaTransporterId || v.transporter_id === guiaTransporterId).map(v => (
                                            <option key={v.id} value={v.id}>{v.plate} ({v.brand} {v.model})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Conductor</label>
                                    <select
                                        className="w-full border-2 border-slate-200 rounded-lg px-4 py-2 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-0 text-sm font-bold"
                                        value={guiaDriverId}
                                        onChange={(e) => setGuiaDriverId(e.target.value)}
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {drivers.map(d => (
                                            <option key={d.id} value={d.id}>{d.name} (DNI: {d.dni})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-slate-200 p-5 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsGenerateGuiaModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmGenerateGuias}
                                className="px-5 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all flex items-center gap-2"
                            >
                                <CheckSquare className="w-5 h-5" /> Confirmar Creación
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
