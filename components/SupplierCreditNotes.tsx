import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Purchase, PurchaseItem, Product } from '../types';
import { Search, FileText, ArrowLeftRight, CheckCircle2, ShieldAlert, FilePlus, Calendar, Building2, Hash, X } from 'lucide-react';
import { supabase } from '../services/supabase';

// MOTIVOS SUNAT NC COMPRAS (Referencial)
const SUNAT_MOTIVOS_NC_COMPRAS = [
    { code: '01', desc: 'Anulación de la operación' },
    { code: '02', desc: 'Anulación por error en el RUC' },
    { code: '03', desc: 'Corrección por error en la descripción' },
    { code: '04', desc: 'Descuento global' },
    { code: '05', desc: 'Descuento por ítem' },
    { code: '06', desc: 'Devolución total' },
    { code: '07', desc: 'Devolución por ítem' },
    { code: '08', desc: 'Bonificación' },
    { code: '09', desc: 'Disminución en el valor' },
    { code: '10', desc: 'Otros Conceptos' }
];

export const SupplierCreditNotes: React.FC = () => {
    const { products, company } = useStore();

    // Cargar productos si no están en el store global
    useEffect(() => {
        if (products.length === 0) {
            const fetchProducts = async () => {
                const { data } = await supabase.from('products').select('*');
                if (data) useStore.setState({ products: data });
            };
            fetchProducts();
        }
    }, [products.length]);

    // UI State
    const [activeTab, setActiveTab] = useState<'EMITIR' | 'APLICAR'>('EMITIR');
    
    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'SUPPLIER' | 'NUMBER'>('NUMBER');
    const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [searchResults, setSearchResults] = useState<Purchase[]>([]);

    // Creation State
    const [originalPurchase, setOriginalPurchase] = useState<Purchase | null>(null);
    const [ncType, setNcType] = useState<'DEVOLUCION' | 'DESCUENTO'>('DEVOLUCION');
    const [returnQuantities, setReturnQuantities] = useState<Record<string, { qty_pkg: number, qty_base: number }>>({});
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [glosa, setGlosa] = useState('');
    const [sunatMotivo, setSunatMotivo] = useState('07');

    const [ncSeries, setNcSeries] = useState('');
    const [ncNumber, setNcNumber] = useState('');
    const [ncIssueDate, setNcIssueDate] = useState(new Date().toISOString().split('T')[0]);

    const isSavingRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);

    // Modal State
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
            let query = supabase.from('purchases').select('*, items:purchase_items(*)').in('document_type', ['FACTURA', 'BOLETA']).neq('payment_status', 'canceled');

            if (dateFrom) query = query.gte('issue_date', dateFrom);
            if (dateTo) query = query.lte('issue_date', dateTo);

            const { data, error } = await query.order('issue_date', { ascending: false }).limit(50);
            
            if (error) throw error;
            
            let results = data || [];

            if (searchTerm.trim()) {
                const term = searchTerm.trim().toUpperCase();
                if (searchType === 'NUMBER') {
                    results = results.filter((p: any) => {
                        const num = p.document_number || '';
                        const ser = p.document_series || '';
                        return num.includes(term) || `${ser}-${num}` === term;
                    });
                } else {
                    results = results.filter((p: any) => {
                        const sName = (p.supplier_name || '').toUpperCase();
                        return sName.includes(term);
                    });
                }
            }

            setSearchResults(results as Purchase[]);
            setOriginalPurchase(null);
        } catch (e) {
            console.error("Search error:", e);
        }
    }, [dateFrom, dateTo, searchTerm, searchType]);

    useEffect(() => {
        handleSearch();
    }, [handleSearch]);

    const handleSelectPurchase = (purchase: Purchase) => {
        setOriginalPurchase(purchase);
        setGlosa(`Referencia a ${purchase.document_type} ${purchase.document_series ? purchase.document_series + '-' : ''}${purchase.document_number}`);
        setSunatMotivo(ncType === 'DEVOLUCION' ? '07' : '04');
        setDiscountAmount(0);
        setNcSeries('');
        setNcNumber('');
        setNcIssueDate(new Date().toISOString().split('T')[0]);

        const initialReturns: Record<string, { qty_pkg: number, qty_base: number }> = {};
        (purchase.items || []).forEach((item) => {
            initialReturns[item.id] = { qty_pkg: 0, qty_base: 0 };
        });
        setReturnQuantities(initialReturns);
    };

    useEffect(() => {
        if (ncType === 'DEVOLUCION') setSunatMotivo('07');
        else setSunatMotivo('04');
    }, [ncType]);

    // Calculate Return Totals
    const returnedItemsList: PurchaseItem[] = useMemo(() => {
        if (!originalPurchase || ncType !== 'DEVOLUCION') return [];

        const list: PurchaseItem[] = [];
        (originalPurchase.items || []).forEach((item) => {
            const retState = returnQuantities[item.id];
            if (!retState) return;

            const totalReturnedBase = (retState.qty_pkg * item.factor) + retState.qty_base;
            if (totalReturnedBase <= 0) return;

            const ratio = item.quantity_base > 0 ? (totalReturnedBase / item.quantity_base) : 0;

            list.push({
                ...item,
                unit_type: 'UND',
                factor: 1,
                quantity_presentation: totalReturnedBase,
                quantity_base: totalReturnedBase,
                total_value: item.total_value * ratio,
                total_cost: item.total_cost * ratio
            });
        });
        return list;
    }, [originalPurchase, returnQuantities, ncType]);

    const returnGrandTotal = ncType === 'DEVOLUCION' 
        ? returnedItemsList.reduce((sum, item) => sum + item.total_cost, 0)
        : discountAmount;

    let returnSubtotal = 0;
    if (ncType === 'DEVOLUCION') {
        returnSubtotal = returnedItemsList.reduce((sum, item) => sum + item.total_value, 0);
    } else {
        returnSubtotal = discountAmount / (1 + (company.igv_percent / 100));
    }
    
    const returnIgv = returnGrandTotal - returnSubtotal;

    const handleGenerateNC = async () => {
        if (!originalPurchase) return;
        
        if (!ncSeries || !ncNumber) {
            showAlert('Debe ingresar la Serie y el Número de la Nota de Crédito física del proveedor.', 'warning');
            return;
        }

        if (ncType === 'DEVOLUCION' && returnedItemsList.length === 0) {
            showAlert('Debe devolver al menos un producto mayor a cero para generar la Nota de Crédito por Devolución.', 'warning');
            return;
        }

        if (ncType === 'DESCUENTO' && (discountAmount <= 0 || discountAmount > originalPurchase.total)) {
            showAlert(`El monto de descuento debe ser mayor a 0 y no puede exceder el total de la factura (S/ ${originalPurchase.total.toFixed(2)}).`, 'warning');
            return;
        }

        showConfirm(`¿Está seguro de generar una NOTA DE CRÉDITO por ${ncType} que afectará a la ${originalPurchase.document_type} ${originalPurchase.document_series || ''}-${originalPurchase.document_number}?`, async () => {
            if (isSavingRef.current) return;
            isSavingRef.current = true;
            setIsSaving(true);
            try {
                let itemsPayload: PurchaseItem[] = [];

                if (ncType === 'DEVOLUCION') {
                    itemsPayload = returnedItemsList;
                } else {
                    itemsPayload = [{
                        id: crypto.randomUUID(),
                        product_id: originalPurchase.items?.[0]?.product_id || '', // Need a valid ID
                        quantity_presentation: 1,
                        unit_type: 'UND',
                        factor: 1,
                        quantity_base: 0, // 0 = NO afecta stock
                        unit_price: returnGrandTotal,
                        unit_value: returnSubtotal,
                        total_value: returnSubtotal,
                        total_cost: returnGrandTotal,
                        batch_code: 'DESCUENTO',
                        expiration_date: new Date().toISOString().split('T')[0],
                        is_bonus: false
                    } as any];
                }

                const motivoText = SUNAT_MOTIVOS_NC_COMPRAS.find(m => m.code === sunatMotivo)?.desc || '';

                const ncPayload = {
                    id: crypto.randomUUID(),
                    origin_purchase_id: originalPurchase.id,
                    supplier_id: originalPurchase.supplier_id,
                    supplier_name: originalPurchase.supplier_name,
                    warehouse_id: originalPurchase.warehouse_id,
                    document_series: ncSeries.toUpperCase(),
                    document_number: ncNumber,
                    issue_date: ncIssueDate,
                    entry_date: ncIssueDate,
                    accounting_date: ncIssueDate,
                    subtotal: returnSubtotal,
                    igv: returnIgv,
                    total: returnGrandTotal,
                    currency: originalPurchase.currency || 'PEN',
                    nc_type: ncType,
                    observation: `[MOTIVO SUNAT: ${sunatMotivo} - ${motivoText}] ${glosa}`,
                    items: itemsPayload
                };

                const { data, error } = await supabase.rpc('process_supplier_credit_note', { p_nc_data: ncPayload });
                if (error) throw error;

                if (data && data.success) {
                    showAlert(`¡Nota de Crédito ${ncSeries}-${ncNumber} ingresada con éxito!`, 'info');
                    setOriginalPurchase(null);
                    handleSearch(); // Refresh list
                }
            } catch (e: any) {
                showAlert("Error al generar NC Proveedor: " + e.message, 'error');
            } finally {
                isSavingRef.current = false;
                setIsSaving(false);
            }
        });
    };

    return (
        <div className="flex flex-col h-full font-sans text-sm relative space-y-4 bg-slate-50">
            {modalConfig.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-fade-in-up">
                        {modalConfig.type === 'error' && <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />}
                        {modalConfig.type === 'warning' && <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />}
                        {modalConfig.type === 'info' && <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />}
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
                    <ArrowLeftRight className="mr-3 text-rose-600 w-6 h-6" /> Devoluciones a Proveedores (NC)
                </h2>
            </div>

            <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-1">
                <button
                    onClick={() => setActiveTab('EMITIR')}
                    className={`flex-1 py-3 font-black text-sm flex items-center justify-center rounded-lg transition-all ${activeTab === 'EMITIR' ? 'bg-rose-50 text-rose-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <FilePlus className="w-4 h-4 mr-2" /> Ingresar Nota de Crédito
                </button>
                <button
                    onClick={() => setActiveTab('APLICAR')}
                    className={`flex-1 py-3 font-black text-sm flex items-center justify-center rounded-lg transition-all ${activeTab === 'APLICAR' ? 'bg-rose-50 text-rose-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <FileText className="w-4 h-4 mr-2" /> Consultar Documentos
                </button>
            </div>

            {activeTab === 'APLICAR' ? (
                 <div className="flex-1 bg-white border border-slate-200 rounded p-8 flex flex-col items-center justify-center text-center shadow-sm">
                     <div className="w-20 h-20 bg-rose-50 text-rose-300 rounded-full flex items-center justify-center mb-6">
                         <FileText className="w-10 h-10" />
                     </div>
                     <h2 className="text-2xl font-black text-slate-800 mb-2">Historial de NC de Proveedores</h2>
                     <p className="text-slate-500 max-w-md">
                         Módulo en desarrollo para visualización y descarga directa de NC de proveedores. Actualmente se reflejan automáticamente en el Registro de Compras SIRE y en el Kardex.
                     </p>
                 </div>
            ) : (
                <>
                {!originalPurchase ? (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-4 items-end">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Factura Por</label>
                            <div className="flex bg-white rounded border border-slate-300 overflow-hidden">
                                <button 
                                    className={`px-3 py-2 text-xs font-bold flex items-center ${searchType === 'NUMBER' ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-slate-50'}`}
                                    onClick={() => setSearchType('NUMBER')}
                                ><Hash className="w-4 h-4 mr-1"/> Documento</button>
                                <div className="w-px bg-slate-300"></div>
                                <button 
                                    className={`px-3 py-2 text-xs font-bold flex items-center ${searchType === 'SUPPLIER' ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-slate-50'}`}
                                    onClick={() => setSearchType('SUPPLIER')}
                                ><Building2 className="w-4 h-4 mr-1"/> Proveedor</button>
                            </div>
                        </div>

                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                {searchType === 'NUMBER' ? 'Nro Documento (Ej. F001-00101)' : 'Nombre del Proveedor'}
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-rose-500 outline-none uppercase text-sm"
                                    placeholder={searchType === 'NUMBER' ? "F001-000101" : "Corporación..."}
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

                        <button onClick={handleSearch} className="bg-rose-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-rose-700 transition">
                            Buscar Compras
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto bg-white">
                        {searchResults.length > 0 ? (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 sticky top-0 text-xs text-slate-500 uppercase border-b border-slate-200">
                                    <tr>
                                        <th className="p-3">F. Emisión</th>
                                        <th className="p-3">Documento</th>
                                        <th className="p-3">Proveedor</th>
                                        <th className="p-3 text-right">Total</th>
                                        <th className="p-3 text-right">Saldo</th>
                                        <th className="p-3 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {searchResults.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3">{new Date(p.issue_date).toLocaleDateString()}</td>
                                            <td className="p-3 font-bold text-slate-700">{p.document_type} {p.document_series}-{p.document_number}</td>
                                            <td className="p-3">
                                                <div className="font-bold text-slate-800">{p.supplier_name}</div>
                                            </td>
                                            <td className="p-3 text-right font-bold text-slate-800">S/ {p.total.toFixed(2)}</td>
                                            <td className="p-3 text-right font-bold text-rose-600">S/ {(p.balance ?? p.total).toFixed(2)}</td>
                                            <td className="p-3 text-center">
                                                <button 
                                                    onClick={() => handleSelectPurchase(p)}
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
                                <p className="font-bold">No hay compras encontradas</p>
                                <p className="text-xs mt-1">Utilice los filtros superiores.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden h-[calc(100vh-140px)]">
                    {/* Header Doc Origen */}
                    <div className="bg-white border border-slate-200 rounded p-4 flex flex-wrap gap-6 items-center shadow-sm relative">
                        <button onClick={() => setOriginalPurchase(null)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1 bg-slate-50 rounded-full hover:bg-red-50">
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="flex items-center gap-4">
                            <div className="bg-rose-100 text-rose-700 p-3 rounded-lg"><FileText className="w-8 h-8"/></div>
                            <div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Doc Compra Seleccionado</div>
                                <div className="font-bold text-slate-800 text-xl">{originalPurchase.document_type} {originalPurchase.document_series}-{originalPurchase.document_number}</div>
                            </div>
                        </div>
                        <div className="w-px h-10 bg-slate-200 hidden sm:block"></div>
                        <div className="flex-1">
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Proveedor</div>
                            <div className="font-bold text-slate-800">{originalPurchase.supplier_name}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Saldo Adeudado / Total Fácturado</div>
                            <div className="font-black text-rose-600 text-xl">S/ {(originalPurchase.balance ?? originalPurchase.total).toFixed(2)} <span className="text-slate-400 text-sm font-medium">/ {originalPurchase.total.toFixed(2)}</span></div>
                        </div>
                    </div>

                    <div className="flex-1 flex gap-4 overflow-hidden">
                        {/* Panel Izquierdo: Configuración */}
                        <div className="w-80 bg-white border border-slate-200 rounded p-4 flex flex-col gap-5 shadow-sm overflow-y-auto">
                            <div>
                                <h3 className="font-bold text-slate-800 mb-3 uppercase text-xs tracking-wider border-b border-slate-100 pb-2">Tipo de Operación</h3>
                                <div className="flex flex-col gap-2">
                                    <label className={`cursor-pointer border p-3 rounded-lg flex items-start gap-3 transition ${ncType === 'DEVOLUCION' ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-300' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="nctype" className="mt-1" checked={ncType === 'DEVOLUCION'} onChange={() => setNcType('DEVOLUCION')} />
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm leading-tight">Devolución de Mercadería</div>
                                            <div className="text-[10px] text-slate-500 mt-1">Extraerá stock del Kardex. Debe existir stock disponible del lote ingresado.</div>
                                        </div>
                                    </label>
                                    <label className={`cursor-pointer border p-3 rounded-lg flex items-start gap-3 transition ${ncType === 'DESCUENTO' ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-300' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="nctype" className="mt-1" checked={ncType === 'DESCUENTO'} onChange={() => setNcType('DESCUENTO')} />
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm leading-tight">Descuento Comercial</div>
                                            <div className="text-[10px] text-slate-500 mt-1">Rebaja el saldo a pagar financieramente. No afecta el inventario.</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-800 mb-3 uppercase text-xs tracking-wider border-b border-slate-100 pb-2">Datos NC (Proveedor)</h3>
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <div className="w-1/3">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Serie *</label>
                                            <input 
                                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-2 text-sm font-bold text-slate-800 outline-none focus:border-rose-400 uppercase"
                                                value={ncSeries} onChange={e => setNcSeries(e.target.value)} placeholder="F001"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Número *</label>
                                            <input 
                                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-2 text-sm font-bold text-slate-800 outline-none focus:border-rose-400"
                                                value={ncNumber} onChange={e => setNcNumber(e.target.value.replace(/\D/g,''))} placeholder="000155"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Fecha de Emisión NC</label>
                                        <input 
                                            type="date"
                                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 outline-none focus:border-rose-400"
                                            value={ncIssueDate} onChange={e => setNcIssueDate(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Motivo SUNAT *</label>
                                        <select 
                                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-bold text-rose-700 outline-none focus:border-rose-400"
                                            value={sunatMotivo}
                                            onChange={(e) => setSunatMotivo(e.target.value)}
                                        >
                                            {SUNAT_MOTIVOS_NC_COMPRAS.map(m => <option key={m.code} value={m.code}>{m.code} - {m.desc}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Glosa Opcional</label>
                                        <textarea 
                                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 outline-none focus:border-rose-400 resize-none h-16"
                                            value={glosa}
                                            onChange={(e) => setGlosa(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Panel Derecho: Detalle */}
                        <div className="flex-1 bg-white border border-slate-200 rounded flex flex-col shadow-sm overflow-hidden">
                            {ncType === 'DEVOLUCION' ? (
                                <>
                                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-4 font-bold text-[10px] uppercase tracking-wider text-slate-600">
                                        <div className="flex-1">Producto Comprado</div>
                                        <div className="w-20 text-center">Cant. Ing.</div>
                                        <div className="w-20 text-right">Costo U.</div>
                                        <div className="w-48 text-center text-rose-700 bg-rose-100 px-2 py-1 rounded">Cant. a Devolver</div>
                                        <div className="w-24 text-right">Monto NC</div>
                                    </div>

                                    <div className="flex-1 overflow-auto divide-y divide-slate-100">
                                        {(originalPurchase.items || []).map((item) => {
                                            const prod = products.find(p => p.id === item.product_id);
                                            const retState = returnQuantities[item.id] || { qty_pkg: 0, qty_base: 0 };
                                            const originalQty = item.quantity_presentation;

                                            const totalReturnedBase = (retState.qty_pkg * item.factor) + retState.qty_base;
                                            const ratio = item.quantity_base > 0 ? (totalReturnedBase / item.quantity_base) : 0;
                                            const itemReturnTotal = item.total_cost * ratio;
                                            
                                            const hasPkg = item.factor > 1;

                                            return (
                                                <div key={item.id} className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors ${totalReturnedBase > 0 ? 'bg-rose-50/30' : ''}`}>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-slate-800 text-sm">{prod?.name || 'Desconocido'}</div>
                                                        <div className="text-[10px] text-slate-500">
                                                            {prod?.sku || '-'} | {item.unit_type} | Lote: {item.batch_code || 'S/L'}
                                                        </div>
                                                    </div>
                                                    <div className="w-20 text-center font-mono text-xs text-slate-500 bg-slate-100 py-1 rounded">
                                                        {originalQty} <span className="font-bold">{item.unit_type}</span>
                                                    </div>
                                                    <div className="w-20 text-right text-xs font-mono text-slate-600">
                                                        S/ {(item.unit_price || 0).toFixed(4)}
                                                    </div>
                                                    <div className="w-48 flex justify-center gap-2">
                                                        {hasPkg && (
                                                            <div className="flex flex-col items-center">
                                                                <input
                                                                    type="number" min="0" 
                                                                    className="w-16 border border-rose-200 rounded p-1 text-center font-bold text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none text-sm bg-white"
                                                                    value={retState.qty_pkg === 0 ? '' : retState.qty_pkg}
                                                                    onChange={e => {
                                                                        let q = Number(e.target.value);
                                                                        if (q < 0) q = 0;
                                                                        if ((q * item.factor) + retState.qty_base > item.quantity_base) {
                                                                            q = Math.floor((item.quantity_base - retState.qty_base) / item.factor);
                                                                        }
                                                                        setReturnQuantities(prev => ({ ...prev, [item.id]: { ...prev[item.id], qty_pkg: q } }));
                                                                    }}
                                                                    placeholder={prod?.package_type || 'CAJ'}
                                                                />
                                                                <span className="text-[9px] font-bold text-slate-400 mt-0.5">{prod?.package_type || 'CAJ'}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col items-center">
                                                            <input
                                                                type="number" min="0" 
                                                                className="w-16 border border-rose-200 rounded p-1 text-center font-bold text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none text-sm bg-white"
                                                                value={retState.qty_base === 0 ? '' : retState.qty_base}
                                                                onChange={e => {
                                                                    let q = Number(e.target.value);
                                                                    if (q < 0) q = 0;
                                                                    if ((retState.qty_pkg * item.factor) + q > item.quantity_base) {
                                                                        q = item.quantity_base - (retState.qty_pkg * item.factor);
                                                                    }
                                                                    setReturnQuantities(prev => ({ ...prev, [item.id]: { ...prev[item.id], qty_base: q } }));
                                                                }}
                                                                placeholder="UND"
                                                            />
                                                            <span className="text-[9px] font-bold text-slate-400 mt-0.5">UND</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-24 text-right font-black text-slate-800 text-sm">
                                                        S/ {itemReturnTotal.toFixed(2)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                                    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm max-w-md w-full">
                                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <span className="text-2xl font-black">%</span>
                                        </div>
                                        <h3 className="font-black text-slate-800 text-xl mb-2">Descuento Global Financiero</h3>
                                        <p className="text-sm text-slate-500 mb-6">Monto monetario (Inc. IGV) a descontar de la deuda con el proveedor.</p>
                                        
                                        <div className="relative mb-2">
                                            <span className="absolute left-4 top-4 font-black text-slate-400 text-xl">S/</span>
                                            <input 
                                                type="number" 
                                                className="w-full text-center text-4xl font-black text-slate-800 border-2 border-slate-200 rounded-xl py-3 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-50 transition-all"
                                                value={discountAmount || ''}
                                                onChange={e => {
                                                    let val = Number(e.target.value);
                                                    if (val > originalPurchase.total) val = originalPurchase.total;
                                                    if (val < 0) val = 0;
                                                    setDiscountAmount(val);
                                                }}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <p className="text-xs font-bold text-slate-400">Max Permitido: S/ {originalPurchase.total.toFixed(2)}</p>
                                    </div>
                                </div>
                            )}

                            {/* Accion Final */}
                            <div className="bg-slate-800 p-4 flex items-center justify-between text-white">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total a Descontar</span>
                                    <span className="text-3xl font-black text-rose-400">S/ {returnGrandTotal.toFixed(2)}</span>
                                </div>
                                <button
                                    onClick={handleGenerateNC}
                                    disabled={isSaving || returnGrandTotal <= 0}
                                    className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-3 rounded-lg font-black shadow-lg shadow-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all uppercase text-sm tracking-wider"
                                >
                                    <CheckCircle2 className="w-5 h-5 mr-2" /> 
                                    {isSaving ? 'Procesando...' : 'Registrar NC Proveedor'}
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
