import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Sale, SaleItem } from '../types';
import { Search, FileText, ArrowLeftRight, CheckCircle2, ShieldAlert, FilePlus } from 'lucide-react';
import { PrintableInvoice } from './PrintableInvoice';

export const CreditNotes: React.FC = () => {
    const { sales, products, company, createCreditNote, getNextDocumentNumber, currentUser } = useStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [originalSale, setOriginalSale] = useState<Sale | null>(null);

    // State to track how many units of each item are being returned
    // Key is the item.id 
    const [returnQuantities, setReturnQuantities] = useState<Record<string, { qty: number, unit: 'UND' | 'PKG' }>>({});

    const [generatedNC, setGeneratedNC] = useState<Sale | null>(null);

    const handleSearch = () => {
        if (!searchTerm) return;

        const term = searchTerm.trim().toUpperCase();
        // Search by exact series-number e.g. F001-000101 or just the number
        const found = sales.find(s =>
            (s.document_type === 'FACTURA' || s.document_type === 'BOLETA') &&
            (s.number.includes(term) || `${s.series}-${s.number}` === term)
        );

        if (found) {
            setOriginalSale(found);
            // Reset returns
            const initialReturns: Record<string, { qty: number, unit: 'UND' | 'PKG' }> = {};
            found.items.forEach(item => {
                initialReturns[item.id] = { qty: 0, unit: item.selected_unit as 'UND' | 'PKG' };
            });
            setReturnQuantities(initialReturns);
            setGeneratedNC(null);
        } else {
            alert('No se encontró ninguna Factura o Boleta con ese número.');
            setOriginalSale(null);
        }
    };

    // Calculate Return Totals
    const returnedItemsList: SaleItem[] = useMemo(() => {
        if (!originalSale) return [];

        const list: SaleItem[] = [];
        originalSale.items.forEach(item => {
            const retState = returnQuantities[item.id];
            if (!retState || retState.qty <= 0) return;

            const product = products.find(p => p.id === item.product_id);
            const packageContent = product?.package_content || 1;

            const retBaseQty = retState.unit === 'PKG' ? retState.qty * packageContent : retState.qty;

            let originalBaseQty = item.quantity_base;
            if (!originalBaseQty) {
                originalBaseQty = item.selected_unit === 'PKG' ? item.quantity_presentation * packageContent : item.quantity_presentation;
            }

            const ratio = retBaseQty / originalBaseQty;

            // Compute correct prices: Total price to refund = original total_price * ratio
            const originalGross = item.quantity_presentation * item.unit_price;
            const proportionalGross = originalGross * ratio;
            const discountPct = item.discount_percent || 0;
            const discountAmt = proportionalGross * (discountPct / 100);
            const total = proportionalGross - discountAmt;

            // New unit price for the CN document line
            const newUnitPrice = retState.unit === item.selected_unit
                ? item.unit_price
                : (retState.unit === 'UND' ? (item.unit_price / packageContent) : (item.unit_price * packageContent));

            // Proportional allocations
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
                id: crypto.randomUUID(), // new unique ID for the CN line
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
    }, [originalSale, returnQuantities, products]);

    const returnGrandTotal = returnedItemsList.reduce((sum, item) => sum + item.total_price, 0);
    const returnSubtotal = returnGrandTotal / (1 + (company.igv_percent / 100));
    const returnIgv = returnGrandTotal - returnSubtotal;

    const handleGenerateNC = () => {
        if (!originalSale) return;
        if (returnedItemsList.length === 0) {
            alert('Debe devolver al menos un producto mayor a cero para generar la Nota de Crédito.');
            return;
        }

        const confirm = window.confirm(`¿Está seguro de generar una NOTA DE CRÉDITO por un valor de S/ ${returnGrandTotal.toFixed(2)} que afectará a la ${originalSale.document_type} ${originalSale.series}-${originalSale.number}?`);
        if (!confirm) return;

        const correlative = getNextDocumentNumber('NOTA_CREDITO');
        if (!correlative) {
            alert('No hay una serie de Nota de Crédito activa en Configuración.');
            return;
        }

        const newNC: Sale = {
            id: crypto.randomUUID(),
            document_type: 'NOTA_CREDITO', // Ensure this matches types.ts DocumentSeries
            series: correlative.series,
            number: correlative.number,
            payment_method: 'CONTADO', // N/A effectively
            client_id: originalSale.client_id,
            client_name: originalSale.client_name,
            client_ruc: originalSale.client_ruc,
            client_address: originalSale.client_address,
            subtotal: returnSubtotal,
            igv: returnIgv,
            total: returnGrandTotal,
            status: 'completed',
            dispatch_status: 'delivered', // already resolved
            created_at: new Date().toISOString(),
            items: returnedItemsList,
            sunat_status: 'PENDING',
            observation: `Devolución referente a ${originalSale.document_type} ${originalSale.series}-${originalSale.number}`
        };

        createCreditNote(newNC, originalSale.id, returnedItemsList);
        setGeneratedNC(newNC);
        alert('¡Nota de Crédito generada y Kardex actualizado con éxito!');
    };

    return (
        <div className="flex flex-col h-full font-sans text-sm relative space-y-4">

            {generatedNC && (
                <PrintableInvoice company={company} sales={[generatedNC]} onClose={() => setGeneratedNC(null)} />
            )}

            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                    <ArrowLeftRight className="mr-2 text-indigo-600 w-6 h-6" /> Notas de Crédito y Devoluciones
                </h2>
            </div>

            <div className="bg-white p-4 justify-between rounded-lg shadow-sm border border-slate-200 flex items-end gap-4">
                <div className="flex-1 max-w-sm">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Comprobante Origen</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                            placeholder="Ej. F001-000101 o 000120"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                </div>
                <button
                    onClick={handleSearch}
                    className="bg-slate-800 text-white px-6 py-2 rounded font-bold shadow hover:bg-slate-700 transition"
                >
                    Buscar Comprobante
                </button>
            </div>

            {originalSale && (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    {/* Original Doc Header */}
                    <div className="bg-slate-50 border border-slate-200 rounded p-4 grid grid-cols-4 gap-4">
                        <div>
                            <div className="text-xs text-slate-500 font-bold uppercase">Documento Origen</div>
                            <div className="font-bold text-slate-800 text-lg">{originalSale.document_type} {originalSale.series}-{originalSale.number}</div>
                        </div>
                        <div className="col-span-2">
                            <div className="text-xs text-slate-500 font-bold uppercase">Cliente</div>
                            <div className="font-bold text-slate-800">{originalSale.client_ruc} - {originalSale.client_name}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-500 font-bold uppercase">Monto Total Facturado</div>
                            <div className="font-bold text-slate-800 text-lg">S/ {originalSale.total.toFixed(2)}</div>
                        </div>
                    </div>

                    {/* Items Grid for Return */}
                    <div className="flex-1 bg-white border border-slate-200 rounded flex flex-col overflow-hidden">
                        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-4 font-bold text-xs uppercase text-slate-600">
                            <div className="flex-1">Producto Facturado</div>
                            <div className="w-24 text-center">Cant. Original</div>
                            <div className="w-24 text-right">Precio Unit.</div>
                            <div className="w-24 text-right">Dsc %</div>
                            <div className="w-48 text-center text-indigo-700 bg-indigo-50 px-2 rounded">Cant. Devolver</div>
                            <div className="w-24 text-right">Subtotal Dev.</div>
                        </div>

                        <div className="flex-1 overflow-auto divide-y divide-slate-100">
                            {originalSale.items.map(item => {
                                const originalQty = item.quantity_presentation;
                                const product = products.find(p => p.id === item.product_id);
                                const packageContent = product?.package_content || 1;

                                const retState = returnQuantities[item.id] || { qty: 0, unit: item.selected_unit as 'UND' | 'PKG' };
                                const returnQty = retState.qty;
                                const returnUnit = retState.unit;

                                // Max base
                                const maxBaseQty = item.quantity_base || (item.selected_unit === 'PKG' ? item.quantity_presentation * packageContent : item.quantity_presentation);

                                // Return subtotal UI preview
                                const retBaseQty = returnUnit === 'PKG' ? returnQty * packageContent : returnQty;
                                const ratio = maxBaseQty > 0 ? (retBaseQty / maxBaseQty) : 0;
                                const itemReturnTotalUI = item.total_price * ratio;

                                return (
                                    <div key={item.id} className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors ${returnQty > 0 ? 'bg-indigo-50/30' : ''}`}>
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-800">{item.product_name}</div>
                                            <div className="text-[10px] text-slate-500">{item.product_sku} | {item.selected_unit === 'UND' ? 'Unidad' : 'Caja'} {item.is_bonus && '| Bonif.'}</div>
                                        </div>
                                        <div className="w-24 text-center font-bold text-slate-600">
                                            {originalQty}
                                        </div>
                                        <div className="w-24 text-right text-slate-600">
                                            S/ {item.unit_price.toFixed(2)}
                                        </div>
                                        <div className="w-24 text-right text-slate-500">
                                            {item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}
                                        </div>
                                        <div className="w-48 flex items-center gap-1 justify-center">
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-16 border border-indigo-200 rounded p-1 text-center font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                value={returnQty}
                                                onChange={e => {
                                                    let q = Number(e.target.value);
                                                    if (returnUnit === 'PKG' && q * packageContent > maxBaseQty) q = Math.floor(maxBaseQty / packageContent);
                                                    else if (returnUnit === 'UND' && q > maxBaseQty) q = maxBaseQty;
                                                    if (q < 0) q = 0;
                                                    setReturnQuantities(prev => ({ ...prev, [item.id]: { ...prev[item.id], qty: q } }));
                                                }}
                                                disabled={item.is_bonus} // If it's a bonus, returning it yields 0 value. Could allow return but value is 0.
                                                title={item.is_bonus ? "Las bonificaciones devuelven stock pero no valor monetario" : ""}
                                            />
                                            <select
                                                className="w-20 border border-indigo-200 rounded p-1 text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white font-mono"
                                                value={returnUnit}
                                                onChange={e => setReturnQuantities(prev => ({ ...prev, [item.id]: { qty: 0, unit: e.target.value as 'UND' | 'PKG' } }))}
                                                disabled={item.is_bonus}
                                            >
                                                <option value="UND">UND</option>
                                                {product?.package_type && <option value="PKG">{product.package_type.substring(0, 3).toUpperCase()}</option>}
                                            </select>
                                        </div>
                                        <div className="w-24 text-right font-bold text-slate-800">
                                            S/ {itemReturnTotalUI.toFixed(2)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Totals & Submit */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-800">
                            <ShieldAlert className="w-5 h-5" />
                            <span className="text-xs font-medium">La nota de crédito afectará el saldo del comprobante y devolverá el stock disponible al Kardex inmediatamente.</span>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <div className="text-xs font-bold text-indigo-400 uppercase">Monto a Devolver (Inc. IGV)</div>
                                <div className="text-2xl font-bold text-indigo-700">S/ {returnGrandTotal.toFixed(2)}</div>
                            </div>
                            <button
                                onClick={handleGenerateNC}
                                disabled={returnGrandTotal <= 0 && returnedItemsList.length === 0}
                                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all"
                            >
                                <FilePlus className="w-5 h-5 mr-2" /> GENERAR NOTA DE CRÉDITO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!originalSale && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <ArrowLeftRight className="w-16 h-16 mb-4 opacity-20" />
                    <p className="font-bold text-lg mb-1">Módulo de Devoluciones</p>
                    <p className="text-sm">Busque un comprobante válido para iniciar la reversión de inventario y generación de nota de crédito.</p>
                </div>
            )}
        </div>
    );
};
