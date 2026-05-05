import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../services/store';
import { isPackageUnit, calculateBaseQuantity } from '../utils/productUtils';
import { Sale, SaleItem, DocumentSeries, NCType } from '../types';
import { Search, FileText, ArrowLeftRight, CheckCircle2, ShieldAlert, FilePlus, Calendar, User, Hash, X } from 'lucide-react';
import { PdfEngine } from './PdfEngine';
import { supabase } from '../services/supabase';

// MOTIVOS SUNAT
const SUNAT_MOTIVOS_NC = [
    { code: '01', desc: 'Anulación de la operación' },
    { code: '02', desc: 'Anulación por error en el RUC' },
    { code: '03', desc: 'Corrección por error en la descripción' },
    { code: '04', desc: 'Descuento global' },
    { code: '05', desc: 'Descuento por ítem' },
    { code: '06', desc: 'Devolución total' },
    { code: '07', desc: 'Devolución por ítem' },
    { code: '08', desc: 'Bonificación' },
    { code: '09', desc: 'Disminución en el valor' },
    { code: '10', desc: 'Otros Conceptos' },
    { code: '13', desc: 'Por Diferencia de Precio' }
];

export const CreditNotes: React.FC = () => {
    const { sales, products, company, syncCreditNoteResult } = useStore();

    // UI State
    const [activeTab, setActiveTab] = useState<'EMITIR' | 'APLICAR'>('EMITIR');
    
    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'CLIENT' | 'NUMBER'>('CLIENT');
    const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [searchResults, setSearchResults] = useState<Sale[]>([]);

    // Creation State
    const [originalSale, setOriginalSale] = useState<Sale | null>(null);
    const [ncType, setNcType] = useState<NCType>('DEVOLUCION');
    const [returnQuantities, setReturnQuantities] = useState<Record<string, { qty: number, unit: string }>>({});
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [glosa, setGlosa] = useState('');
    const [sunatMotivo, setSunatMotivo] = useState('07');

    const isSavingRef = React.useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [dbSeries, setDbSeries] = useState<any[]>([]);
    const [selectedSeries, setSelectedSeries] = useState('');

    // --- Modal State ---
    const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: 'info'|'warning'|'error'|'confirm', message: string, onConfirm?: () => void}>({
        isOpen: false, type: 'info', message: ''
    });

    const showAlert = (message: string, type: 'info'|'warning'|'error' = 'info') => {
        setModalConfig({ isOpen: true, type, message });
    };

    const showConfirm = (message: string, onConfirm: () => void) => {
        setModalConfig({ isOpen: true, type: 'confirm', message, onConfirm });
    };

    const handleSearch = React.useCallback(async () => {
        try {
            let query = supabase.from('sales').select('*, items:sale_items(*, batch_allocations(*))').in('document_type', ['FACTURA', 'BOLETA']).neq('status', 'canceled');

            if (dateFrom) {
                query = query.gte('created_at', `${dateFrom}T00:00:00`);
            }
            if (dateTo) {
                query = query.lte('created_at', `${dateTo}T23:59:59`);
            }

            const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
            
            if (error) throw error;
            
            let results = data || [];

            if (searchTerm.trim()) {
                const term = searchTerm.trim().toUpperCase();
                if (searchType === 'NUMBER') {
                    results = results.filter((s: any) => {
                        const num = s.number || '';
                        const ser = s.series || '';
                        return num.includes(term) || `${ser}-${num}` === term;
                    });
                } else {
                    results = results.filter((s: any) => {
                        const cName = (s.client_name || '').toUpperCase();
                        const cRuc = s.client_ruc || '';
                        return cName.includes(term) || cRuc.includes(term);
                    });
                }
            }

            setSearchResults(results as Sale[]);
            setOriginalSale(null);
        } catch (e) {
            console.error("Search error:", e);
        }
    }, [dateFrom, dateTo, searchTerm, searchType]);

    useEffect(() => {
        const fetchSeries = async () => {
            const { data } = await supabase.from('document_series').select('*').eq('type', 'NOTA_CREDITO').eq('is_active', true);
            if (data && data.length > 0) {
                setDbSeries(data);
                setSelectedSeries(data[0].series);
            }
        };
        fetchSeries();
    }, []);

    useEffect(() => {
        handleSearch();
    }, [handleSearch]);

    const handleSelectSale = (sale: Sale) => {
        setOriginalSale(sale);
        setGlosa(`Referencia a ${sale.document_type} ${sale.series}-${sale.number}`);
        setSunatMotivo('07'); // Default: Devolución por item
        setNcType('DEVOLUCION');
        setDiscountAmount(0);

        const isFactura = sale.document_type === 'FACTURA';
        const compatibleSeries = dbSeries.filter(s => s.series.startsWith(isFactura ? 'F' : 'B'));
        if (compatibleSeries.length > 0) {
            setSelectedSeries(compatibleSeries[0].series);
        } else {
            setSelectedSeries('');
        }

        const initialReturns: Record<string, { qty: number, unit: string }> = {};
        sale.items.forEach((item, idx) => {
            const itemKey = `${item.id}_${item.is_bonus ? 'bonus' : 'regular'}_${idx}`;
            initialReturns[itemKey] = { qty: 0, unit: item.selected_unit }; // Default to original unit invoiced
        });
        setReturnQuantities(initialReturns);
    };

    // Calculate Return Totals (DEVOLUCION)
    const returnedItemsList: SaleItem[] = useMemo(() => {
        if (!originalSale || ncType !== 'DEVOLUCION') return [];

        const list: SaleItem[] = [];
        originalSale.items.forEach((item, idx) => {
            const itemKey = `${item.id}_${item.is_bonus ? 'bonus' : 'regular'}_${idx}`;
            const retState = returnQuantities[itemKey];
            if (!retState || retState.qty <= 0) return;

            const product = products.find(p => p.id === item.product_id);
            const packageContent = product?.package_content || 1;

            const originalIsPkg = isPackageUnit(item.selected_unit, product);
            const originalBaseQty = item.quantity_base || (originalIsPkg ? item.quantity_presentation * packageContent : item.quantity_presentation);

            const retIsPkg = isPackageUnit(retState.unit, product);
            const retBaseQty = retIsPkg ? retState.qty * packageContent : retState.qty;

            const ratio = originalBaseQty > 0 ? (retBaseQty / originalBaseQty) : 0;

            const originalGross = item.quantity_presentation * item.unit_price;
            const proportionalGross = originalGross * ratio;
            const discountPct = item.discount_percent || 0;
            const discountAmt = proportionalGross * (discountPct / 100);
            const total = proportionalGross - discountAmt;

            // Strict adherence to original unit_price as requested by user.
            let newUnitPrice = item.unit_price;
            if (retIsPkg !== originalIsPkg) {
                 if (!retIsPkg && originalIsPkg) newUnitPrice = item.unit_price / packageContent;
                 if (retIsPkg && !originalIsPkg) newUnitPrice = item.unit_price * packageContent;
            }

            let retAllocations = [];
            if (item.batch_allocations) {
                let remainingBaseToReturn = retBaseQty;
                retAllocations = item.batch_allocations.map(alloc => {
                    if (remainingBaseToReturn <= 0) return { ...alloc, quantity: 0 };
                    const take = Math.min(alloc.quantity, remainingBaseToReturn);
                    remainingBaseToReturn -= take;
                    return { ...alloc, quantity: take };
                }).filter(a => a.quantity > 0);
            }

            list.push({
                ...item,
                id: crypto.randomUUID(),
                selected_unit: retState.unit,
                quantity_presentation: retState.qty,
                quantity_base: retBaseQty,
                unit_price: newUnitPrice,
                total_price: total,
                discount_amount: discountAmt,
                batch_allocations: retAllocations
            });
        });
        return list;
    }, [originalSale, returnQuantities, products, ncType]);

    const returnGrandTotal = ncType === 'DEVOLUCION' 
        ? returnedItemsList.reduce((sum, item) => sum + item.total_price, 0)
        : discountAmount;

    let returnSubtotal = 0;
    if (ncType === 'DEVOLUCION') {
        returnSubtotal = returnedItemsList.reduce((sum, item) => {
            const itemSub = item.total_price / (1 + (company.igv_percent / 100));
            return sum + itemSub;
        }, 0);
    } else {
        returnSubtotal = discountAmount / (1 + (company.igv_percent / 100));
    }
    
    // Se calcula el IGV como diferencia global para evitar desfases de 0.01
    const returnIgv = returnGrandTotal - returnSubtotal;

    const handleGenerateNC = async () => {
        if (!originalSale) return;
        
        if (ncType === 'DEVOLUCION' && returnedItemsList.length === 0) {
            showAlert('Debe devolver al menos un producto mayor a cero para generar la Nota de Crédito por Devolución.', 'warning');
            return;
        }

        if (ncType === 'DESCUENTO' && (discountAmount <= 0 || discountAmount > originalSale.total)) {
            showAlert(`El monto de descuento debe ser mayor a 0 y no puede exceder el total de la factura (S/ ${originalSale.total.toFixed(2)}).`, 'warning');
            return;
        }

        if (!selectedSeries) {
            showAlert('No hay una serie de Nota de Crédito activa en Configuración.', 'error');
            return;
        }

        showConfirm(`¿Está seguro de generar una NOTA DE CRÉDITO por ${ncType} que afectará a la ${originalSale.document_type} ${originalSale.series}-${originalSale.number}?`, async () => {
            if (isSavingRef.current) return;
            isSavingRef.current = true;
            setIsSaving(true);
            try {
                let itemsPayload: SaleItem[] = [];

                if (ncType === 'DEVOLUCION') {
                    itemsPayload = returnedItemsList;
                } else {
                    // Descuento: 1 item dummy representativo que NO afecta kardex
                    itemsPayload = [{
                        id: crypto.randomUUID(),
                        product_id: originalSale.items[0].product_id, // valid UUID
                        product_sku: 'DSCTO',
                        product_name: 'DESCUENTO COMERCIAL APLICADO',
                        selected_unit: 'UND',
                        quantity_presentation: 1,
                        quantity_base: 0, // 0 = NO KARDEX
                        unit_price: returnSubtotal,
                        total_price: returnGrandTotal,
                        discount_percent: 0,
                        discount_amount: 0,
                        is_bonus: false,
                        batch_allocations: [] // NO ALLOCATIONS = NO KARDEX
                    } as any];
                }

                const motivoText = SUNAT_MOTIVOS_NC.find(m => m.code === sunatMotivo)?.desc || '';

                const ncPayload = {
                    id: crypto.randomUUID(),
                    series: selectedSeries,
                    client_id: originalSale.client_id,
                    client_name: originalSale.client_name,
                    client_ruc: originalSale.client_ruc,
                    client_address: originalSale.client_address,
                    seller_id: originalSale.seller_id,
                    seller_name: originalSale.seller_name,
                    payment_method: originalSale.payment_method || 'CONTADO',
                    subtotal: returnSubtotal,
                    igv: returnIgv,
                    total: returnGrandTotal,
                    observation: `[MOTIVO SUNAT: ${sunatMotivo} - ${motivoText}] ${glosa}`,
                    items: itemsPayload
                };

                const { data, error } = await supabase.rpc('process_credit_note_transaction', { p_nc_data: ncPayload });
                if (error) throw error;

                if (data && data.success) {
                    const finalNC = { ...ncPayload, number: data.real_number, document_type: 'NOTA_CREDITO', created_at: new Date().toISOString() } as Sale;
                    syncCreditNoteResult(finalNC, originalSale.id);
                    await PdfEngine.openDocument([finalNC], 'NOTA_CREDITO', company);
                    showAlert(`¡Nota de Crédito ${selectedSeries}-${data.real_number} generada con éxito!`, 'info');
                    setOriginalSale(null);
                    setSearchResults([]);
                }
            } catch (e: any) {
                showAlert("Error al generar NC: " + e.message, 'error');
            } finally {
                isSavingRef.current = false;
                setIsSaving(false);
            }
        });
    };

    return (
        <div className="flex flex-col h-full font-sans text-sm relative space-y-4">
            {modalConfig.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-fade-in-up">
                        {modalConfig.type === 'error' && <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />}
                        {modalConfig.type === 'warning' && <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />}
                        {modalConfig.type === 'info' && <CheckCircle2 className="w-12 h-12 text-indigo-500 mx-auto mb-4" />}
                        {modalConfig.type === 'confirm' && <ShieldAlert className="w-12 h-12 text-blue-500 mx-auto mb-4" />}
                        
                        <h3 className="text-lg font-black text-slate-800 mb-2">
                            {modalConfig.type === 'error' ? 'Error Detectado' : modalConfig.type === 'warning' ? 'Aviso Importante' : modalConfig.type === 'confirm' ? 'Confirmación Requerida' : 'Operación Exitosa'}
                        </h3>
                        <p className="text-sm text-slate-600 mb-6">{modalConfig.message}</p>
                        
                        <div className="flex gap-3 justify-center">
                            {modalConfig.type === 'confirm' ? (
                                <>
                                    <button onClick={() => setModalConfig({...modalConfig, isOpen: false})} className="px-6 py-2 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Cancelar</button>
                                    <button onClick={() => { setModalConfig({...modalConfig, isOpen: false}); modalConfig.onConfirm?.(); }} className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700">Confirmar</button>
                                </>
                            ) : (
                                <button onClick={() => setModalConfig({...modalConfig, isOpen: false})} className="px-8 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700">Entendido</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-black text-slate-800 flex items-center">
                    <ArrowLeftRight className="mr-3 text-indigo-600 w-6 h-6" /> Gestión de Notas de Crédito
                </h2>
            </div>

            <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-1">
                <button
                    onClick={() => setActiveTab('EMITIR')}
                    className={`flex-1 py-3 font-black text-sm flex items-center justify-center rounded-lg transition-all ${activeTab === 'EMITIR' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <FilePlus className="w-4 h-4 mr-2" /> Emitir Nota de Crédito
                </button>
                <button
                    onClick={() => setActiveTab('APLICAR')}
                    className={`flex-1 py-3 font-black text-sm flex items-center justify-center rounded-lg transition-all ${activeTab === 'APLICAR' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Aplicación / Consulta (Pendientes)
                </button>
            </div>

            {activeTab === 'APLICAR' ? (
                 <div className="flex-1 bg-white border border-slate-200 rounded p-8 flex flex-col items-center justify-center text-center shadow-sm">
                     <div className="w-20 h-20 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mb-6">
                         <ArrowLeftRight className="w-10 h-10" />
                     </div>
                     <h2 className="text-2xl font-black text-slate-800 mb-2">Módulo en Desarrollo</h2>
                     <p className="text-slate-500 max-w-md">
                         Aquí aparecerán las Notas de Crédito que generaron un <strong>"Saldo a Favor"</strong> (aplicadas a facturas ya canceladas). Podrá aplicarlas como pago a futuras facturas del cliente.
                     </p>
                 </div>
            ) : (
                <>
                {!originalSale ? (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-4 items-end">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Por</label>
                            <div className="flex bg-white rounded border border-slate-300 overflow-hidden">
                                <button 
                                    className={`px-3 py-2 text-xs font-bold flex items-center ${searchType === 'NUMBER' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                                    onClick={() => setSearchType('NUMBER')}
                                ><Hash className="w-4 h-4 mr-1"/> Número</button>
                                <div className="w-px bg-slate-300"></div>
                                <button 
                                    className={`px-3 py-2 text-xs font-bold flex items-center ${searchType === 'CLIENT' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                                    onClick={() => setSearchType('CLIENT')}
                                ><User className="w-4 h-4 mr-1"/> Cliente</button>
                            </div>
                        </div>

                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                {searchType === 'NUMBER' ? 'Nro Documento (Ej. F001-00101)' : 'Nombre o RUC del Cliente'}
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none uppercase text-sm"
                                    placeholder={searchType === 'NUMBER' ? "F001-000101" : "Distribuidora..."}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Desde</label>
                            <div className="relative">
                                <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                                <input type="date" className="pl-8 pr-3 py-2 border border-slate-300 rounded outline-none text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Hasta</label>
                            <div className="relative">
                                <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                                <input type="date" className="pl-8 pr-3 py-2 border border-slate-300 rounded outline-none text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                            </div>
                        </div>

                        <button onClick={handleSearch} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-indigo-700 transition">
                            Buscar Documentos
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto bg-white">
                        {searchResults.length > 0 ? (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 sticky top-0 text-xs text-slate-500 uppercase border-b border-slate-200">
                                    <tr>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3">Documento</th>
                                        <th className="p-3">Cliente</th>
                                        <th className="p-3 text-right">Total</th>
                                        <th className="p-3 text-center">Estado</th>
                                        <th className="p-3 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {searchResults.map(sale => (
                                        <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3">{new Date(sale.created_at).toLocaleDateString()}</td>
                                            <td className="p-3 font-bold text-slate-700">{sale.document_type} {sale.series}-{sale.number}</td>
                                            <td className="p-3">
                                                <div className="font-bold text-slate-800">{sale.client_name}</div>
                                                <div className="text-xs text-slate-500">{sale.client_ruc}</div>
                                            </td>
                                            <td className="p-3 text-right font-bold text-slate-800">S/ {sale.total.toFixed(2)}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${sale.status === 'canceled' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {sale.status === 'canceled' ? 'ANULADO' : 'ACTIVO'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <button 
                                                    disabled={sale.status === 'canceled'}
                                                    onClick={() => handleSelectSale(sale)}
                                                    className="bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-700 disabled:opacity-50"
                                                >
                                                    Elegir
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <Search className="w-12 h-12 mb-4 opacity-20" />
                                <p className="font-bold">No hay resultados de búsqueda</p>
                                <p className="text-xs mt-1">Utilice los filtros superiores para encontrar un documento válido.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden h-[calc(100vh-140px)]">
                    <div className="bg-white border border-slate-200 rounded p-4 flex flex-wrap gap-6 items-center shadow-sm relative">
                        <button onClick={() => setOriginalSale(null)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1 bg-slate-50 rounded-full hover:bg-red-50">
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="flex items-center gap-4">
                            <div className="bg-indigo-100 text-indigo-700 p-3 rounded-lg"><FileText className="w-8 h-8"/></div>
                            <div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Doc Origen Seleccionado</div>
                                <div className="font-bold text-slate-800 text-xl">{originalSale.document_type} {originalSale.series}-{originalSale.number}</div>
                            </div>
                        </div>
                        <div className="w-px h-10 bg-slate-200 hidden sm:block"></div>
                        <div className="flex-1">
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Cliente</div>
                            <div className="font-bold text-slate-800">{originalSale.client_ruc} - {originalSale.client_name}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Saldo / Total Fácturado</div>
                            <div className="font-black text-indigo-700 text-xl">S/ {(originalSale.balance ?? originalSale.total).toFixed(2)} <span className="text-slate-400 text-sm font-medium">/ {originalSale.total.toFixed(2)}</span></div>
                        </div>
                    </div>

                    <div className="flex-1 flex gap-4 overflow-hidden">
                        {/* Panel Izquierdo: Configuración */}
                        <div className="w-80 bg-white border border-slate-200 rounded p-4 flex flex-col gap-5 shadow-sm overflow-y-auto">
                            <div>
                                <h3 className="font-bold text-slate-800 mb-3 uppercase text-xs tracking-wider border-b border-slate-100 pb-2">Tipo de Operación</h3>
                                <div className="flex flex-col gap-2">
                                    <label className={`cursor-pointer border p-3 rounded-lg flex items-start gap-3 transition ${ncType === 'DEVOLUCION' ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="nctype" className="mt-1" checked={ncType === 'DEVOLUCION'} onChange={() => setNcType('DEVOLUCION')} />
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm leading-tight">Devolución de Mercadería</div>
                                            <div className="text-[10px] text-slate-500 mt-1">El stock regresará al Kardex inmediatamente. Requiere indicar qué productos se devuelven.</div>
                                        </div>
                                    </label>
                                    <label className={`cursor-pointer border p-3 rounded-lg flex items-start gap-3 transition ${ncType === 'DESCUENTO' ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="nctype" className="mt-1" checked={ncType === 'DESCUENTO'} onChange={() => setNcType('DESCUENTO')} />
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm leading-tight">Descuento Comercial</div>
                                            <div className="text-[10px] text-slate-500 mt-1">Rebaja el saldo a cobrar financieramente. No afecta el Kardex de inventario.</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-800 mb-3 uppercase text-xs tracking-wider border-b border-slate-100 pb-2">Datos Emisión</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Serie Nota Crédito</label>
                                        <select 
                                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400"
                                            value={selectedSeries}
                                            onChange={(e) => setSelectedSeries(e.target.value)}
                                        >
                                            {dbSeries
                                                .filter(s => {
                                                    if (!originalSale) return true;
                                                    const isFactura = originalSale.document_type === 'FACTURA';
                                                    return s.series.startsWith(isFactura ? 'F' : 'B');
                                                })
                                                .map(s => <option key={s.id} value={s.series}>{s.series}</option>)}
                                            {dbSeries.filter(s => {
                                                if (!originalSale) return true;
                                                const isFactura = originalSale.document_type === 'FACTURA';
                                                return s.series.startsWith(isFactura ? 'F' : 'B');
                                            }).length === 0 && <option value="">No hay series compatibles</option>}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Motivo SUNAT *</label>
                                        <select 
                                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm font-bold text-indigo-700 outline-none focus:border-indigo-400"
                                            value={sunatMotivo}
                                            onChange={(e) => setSunatMotivo(e.target.value)}
                                        >
                                            {SUNAT_MOTIVOS_NC.map(m => <option key={m.code} value={m.code}>{m.code} - {m.desc}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Motivo / Glosa Opcional</label>
                                        <textarea 
                                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 resize-none h-20"
                                            value={glosa}
                                            onChange={(e) => setGlosa(e.target.value)}
                                            placeholder="Motivo de la nota..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Panel Derecho: Detalle de Productos o Descuento */}
                        <div className="flex-1 bg-white border border-slate-200 rounded flex flex-col shadow-sm overflow-hidden">
                            {ncType === 'DEVOLUCION' ? (
                                <>
                                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-4 font-bold text-[10px] uppercase tracking-wider text-slate-600">
                                        <div className="flex-1">Producto Facturado</div>
                                        <div className="w-20 text-center">Unds. Orig.</div>
                                        <div className="w-20 text-right">Precio U.</div>
                                        <div className="w-44 text-center text-indigo-700 bg-indigo-100 px-2 py-1 rounded">Cant. a Devolver</div>
                                        <div className="w-24 text-right">Monto NC</div>
                                    </div>

                                    <div className="flex-1 overflow-auto divide-y divide-slate-100">
                                        {originalSale.items.map((item, idx) => {
                                            const itemKey = `${item.id}_${item.is_bonus ? 'bonus' : 'regular'}_${idx}`;
                                            const originalQty = item.quantity_presentation;
                                            const product = products.find(p => p.id === item.product_id);
                                            const packageContent = product?.package_content || 1;

                                            const retState = returnQuantities[itemKey] || { qty: 0, unit: item.selected_unit as 'UND' | 'PKG' };
                                            const returnQty = retState.qty;
                                            const returnUnit = retState.unit;

                                            const maxBaseQty = item.quantity_base || (item.selected_unit === 'PKG' ? item.quantity_presentation * packageContent : item.quantity_presentation);
                                            const retBaseQty = returnUnit === 'PKG' ? returnQty * packageContent : returnQty;
                                            const ratio = maxBaseQty > 0 ? (retBaseQty / maxBaseQty) : 0;
                                            const itemReturnTotalUI = item.total_price * ratio;

                                            return (
                                                <div key={itemKey} className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors ${returnQty > 0 ? 'bg-indigo-50/30' : ''}`}>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-slate-800 text-sm">{item.product_name}</div>
                                                        <div className="text-[10px] text-slate-500">{item.product_sku} | {item.selected_unit === 'UND' ? 'Unidades' : 'Cajas'} {item.is_bonus && '| Bonif.'}</div>
                                                    </div>
                                                    <div className="w-20 text-center font-mono text-xs text-slate-500 bg-slate-100 py-1 rounded">
                                                        {originalQty} <span className="font-bold">{item.selected_unit}</span>
                                                    </div>
                                                    <div className="w-20 text-right text-xs font-mono text-slate-600">
                                                        S/ {item.unit_price.toFixed(2)}
                                                    </div>
                                                    <div className="w-44 flex items-center gap-1 justify-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="w-16 border border-indigo-200 rounded p-1.5 text-center font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                                            value={returnQty === 0 ? '' : returnQty}
                                                            onChange={e => {
                                                                let q = Number(e.target.value);
                                                                const retIsPkg = isPackageUnit(returnUnit, product);
                                                                if (retIsPkg && q * packageContent > maxBaseQty) q = Math.floor(maxBaseQty / packageContent);
                                                                else if (!retIsPkg && q > maxBaseQty) q = maxBaseQty;
                                                                if (q < 0) q = 0;
                                                                setReturnQuantities(prev => ({ ...prev, [itemKey]: { ...prev[itemKey], qty: q } }));
                                                            }}
                                                        />
                                                        <select
                                                            className="w-20 border border-indigo-200 rounded p-1.5 text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
                                                            value={returnUnit}
                                                            onChange={e => setReturnQuantities(prev => ({ ...prev, [itemKey]: { qty: 0, unit: e.target.value } }))}
                                                        >
                                                            <option value={item.selected_unit}>{item.selected_unit}</option>
                                                            {item.selected_unit !== (product?.unit_type || 'UND') && (
                                                                <option value={product?.unit_type || 'UND'}>{product?.unit_type || 'UND'}</option>
                                                            )}
                                                        </select>
                                                    </div>
                                                    <div className="w-24 text-right font-black text-slate-800 text-sm">
                                                        S/ {itemReturnTotalUI.toFixed(2)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                                    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm max-w-md w-full">
                                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <span className="text-2xl font-black">%</span>
                                        </div>
                                        <h3 className="font-black text-slate-800 text-xl mb-2">Descuento Global</h3>
                                        <p className="text-sm text-slate-500 mb-6">Ingrese el monto monetario (incluido IGV) que desea descontarle a la factura original.</p>
                                        
                                        <div className="relative mb-2">
                                            <span className="absolute left-4 top-4 font-black text-slate-400 text-xl">S/</span>
                                            <input 
                                                type="number" 
                                                className="w-full text-center text-4xl font-black text-slate-800 border-2 border-slate-200 rounded-xl py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                                                value={discountAmount || ''}
                                                onChange={e => {
                                                    let val = Number(e.target.value);
                                                    if (val > originalSale.total) val = originalSale.total;
                                                    if (val < 0) val = 0;
                                                    setDiscountAmount(val);
                                                }}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <p className="text-xs font-bold text-slate-400">Max Permitido: S/ {originalSale.total.toFixed(2)}</p>
                                    </div>
                                </div>
                            )}

                            {/* Accion Final */}
                            <div className="bg-slate-800 p-4 flex items-center justify-between text-white">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto Total Nota de Crédito</span>
                                    <span className="text-3xl font-black text-emerald-400">S/ {returnGrandTotal.toFixed(2)}</span>
                                </div>
                                <button
                                    onClick={handleGenerateNC}
                                    disabled={isSaving || returnGrandTotal <= 0}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-3 rounded-lg font-black shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all uppercase text-sm tracking-wider"
                                >
                                    <CheckCircle2 className="w-5 h-5 mr-2" /> 
                                    {isSaving ? 'Procesando...' : 'Emitir Nota Crédito'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </>
            )}
        </div>
    );
};
