import React, { useState } from 'react';
import { AutoPromotion, Product, Supplier } from '../../types';
import { useStore } from '../../services/store';
import { Save, X, Search, Plus, Trash2, MapPin } from 'lucide-react';
import { PERU_CITIES } from '../../utils/promoUtils';

interface Props {
    initialData?: Partial<AutoPromotion> | null;
    onClose: () => void;
    onSave: (data: AutoPromotion) => void;
}

export const AutoPromoForm: React.FC<Props> = ({ initialData, onClose, onSave }) => {
    const { products, suppliers, priceLists } = useStore();

    const [formData, setFormData] = useState<Partial<AutoPromotion>>({
        id: initialData?.id || crypto.randomUUID(),
        name: initialData?.name || '',
        description: initialData?.description || '',
        is_active: initialData?.is_active ?? true,
        start_date: initialData?.start_date || new Date().toISOString().split('T')[0],
        end_date: initialData?.end_date || new Date().toISOString().split('T')[0],
        condition_type: initialData?.condition_type || 'BUY_X_PRODUCT',
        condition_product_id: initialData?.condition_product_id || '',
        condition_category: initialData?.condition_category || '',
        condition_supplier_id: initialData?.condition_supplier_id || '',
        condition_amount: initialData?.condition_amount || 1,
        reward_product_id: initialData?.reward_product_id || '',
        reward_quantity: initialData?.reward_quantity || 1,
        reward_unit_type: initialData?.reward_unit_type || 'UND',
        channels: initialData?.channels || ['IN_STORE'],
        target_client_categories: initialData?.target_client_categories || [],
        target_price_list_ids: initialData?.target_price_list_ids || [],
        condition_product_ids: initialData?.condition_product_ids || [],
        target_cities: initialData?.target_cities || []
    });

    const [showProductSelector, setShowProductSelector] = useState(false);
    const [prodSearch, setProdSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    const toggleConditionProduct = (productId: string) => {
        const current = formData.condition_product_ids || [];
        if (current.includes(productId)) {
            setFormData({ ...formData, condition_product_ids: current.filter(id => id !== productId) });
        } else {
            setFormData({ ...formData, condition_product_ids: [...current, productId] });
        }
    };

    const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.sku.toLowerCase().includes(prodSearch.toLowerCase());
        const matchesCat = categoryFilter ? p.category === categoryFilter : true;
        return matchesSearch && matchesCat;
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return alert('Ingrese el nombre');
        if (formData.condition_type === 'BUY_X_PRODUCT' && (!formData.condition_product_ids || formData.condition_product_ids.length === 0)) return alert('Seleccione producto(s) condición');
        if (!formData.reward_product_id) return alert('Seleccione producto de premio');

        onSave(formData as AutoPromotion);
    };

    const toggleChannel = (ch: 'IN_STORE' | 'SELLER_APP' | 'DIRECT_SALE') => {
        const current = formData.channels || [];
        if (current.includes(ch)) {
            setFormData({ ...formData, channels: current.filter(c => c !== ch) });
        } else {
            setFormData({ ...formData, channels: [...current, ch] });
        }
    };

    const toggleCity = (city: string) => {
        const current = formData.target_cities || [];
        if (current.includes(city)) {
            setFormData({ ...formData, target_cities: current.filter(c => c !== city) });
        } else {
            setFormData({ ...formData, target_cities: [...current, city] });
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-xl font-bold text-slate-800">
                    {initialData?.id ? 'Editar Bonificación' : 'Nueva Bonificación Automática'}
                </h2>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="flex-1 overflow-auto pr-2">
                <form id="autoPromoForm" onSubmit={handleSubmit} className="space-y-6">

                    {/* Datos Generales */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-3 border-b pb-2">Datos Generales</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Promoción</label>
                                <input className="w-full border border-slate-300 p-2 rounded text-sm bg-white" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Descripción</label>
                                <textarea className="w-full border border-slate-300 p-2 rounded text-sm bg-white" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} required />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Inicio</label>
                                <input type="date" className="w-full border border-slate-300 p-2 rounded text-sm bg-white" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Fin</label>
                                <input type="date" className="w-full border border-slate-300 p-2 rounded text-sm bg-white" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} required />
                            </div>
                        </div>
                    </div>

                    {/* Condición */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h3 className="font-bold text-blue-800 mb-3 border-b border-blue-200 pb-2">Condición para aplicar</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-bold text-blue-900 mb-1">Tipo de Condición</label>
                                <select className="w-full border border-blue-300 p-2 rounded text-sm bg-white font-bold" value={formData.condition_type} onChange={e => setFormData({ ...formData, condition_type: e.target.value as any })}>
                                    <option value="BUY_X_PRODUCT">Por Volumen de Producto (Comprar X unidades)</option>
                                    <option value="SPEND_Y_TOTAL">Por Monto Total (Gastar S/ en total)</option>
                                    <option value="SPEND_Y_CATEGORY">Por Monto en Categoría (Gastar S/ en Categ.)</option>
                                </select>
                            </div>

                            {(formData.condition_type === 'BUY_X_PRODUCT' || formData.condition_type === 'SPEND_Y_TOTAL') && (
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-blue-900 mb-1">
                                        Productos Participantes (Multiselección) 
                                        {formData.condition_type === 'SPEND_Y_TOTAL' && <span className="font-normal text-xs ml-2 text-blue-700">- Si lo deja vacío aplica a monto total de la tienda</span>}
                                    </label>
                                    <div className="flex gap-2 mb-2 flex-wrap min-h-[3rem] p-2 border border-blue-300 rounded bg-white">
                                        {(formData.condition_product_ids || []).map(pid => {
                                            const p = products.find(prod => prod.id === pid);
                                            return p ? (
                                                <span key={p.id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold border border-blue-200">
                                                    {p.sku} - {p.name}
                                                    <button type="button" onClick={() => toggleConditionProduct(p.id)} className="hover:text-red-500 ml-1"><X className="w-3 h-3" /></button>
                                                </span>
                                            ) : null;
                                        })}
                                        {(formData.condition_product_ids || []).length === 0 && <span className="text-slate-400 text-xs italic self-center">Ningún producto seleccionado...</span>}
                                    </div>
                                    <button type="button" onClick={() => setShowProductSelector(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center shadow-sm">
                                        <Search className="w-3 h-3 mr-1" /> Buscar y Seleccionar Productos
                                    </button>
                                </div>
                            )}

                            {formData.condition_type === 'SPEND_Y_CATEGORY' && (
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-blue-900 mb-1">Categoría</label>
                                    <select className="w-full border border-blue-300 p-2 rounded text-sm bg-white" value={formData.condition_category} onChange={e => setFormData({ ...formData, condition_category: e.target.value })}>
                                        <option value="">Seleccione una Categoría...</option>
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="col-span-2">
                                <label className="block text-sm font-bold text-blue-900 mb-1">
                                    {formData.condition_type === 'BUY_X_PRODUCT' ? 'Cantidad Mínima requerida' : 'Monto Mínimo requerido (S/)'}
                                </label>
                                <input type="number" min="1" step="0.01" className="w-32 border border-blue-300 p-2 rounded text-sm bg-white font-bold text-blue-900" value={formData.condition_amount} onChange={e => setFormData({ ...formData, condition_amount: Number(e.target.value) })} required />
                            </div>
                        </div>
                    </div>

                    {/* Premio */}
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h3 className="font-bold text-green-800 mb-3 border-b border-green-200 pb-2">Premio a Bonificar</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-bold text-green-900 mb-1">Producto a Regalar</label>
                                <select className="w-full border border-green-300 p-2 rounded text-sm bg-white" value={formData.reward_product_id} onChange={e => setFormData({ ...formData, reward_product_id: e.target.value })} required>
                                    <option value="">Seleccione Producto Premio...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-green-900 mb-1">Cantidad a Regalar</label>
                                <input type="number" min="1" className="w-full border border-green-300 p-2 rounded text-sm bg-white font-bold text-green-900" value={formData.reward_quantity} onChange={e => setFormData({ ...formData, reward_quantity: Number(e.target.value) })} required />
                            </div>
                        </div>
                    </div>

                    {/* Restricciones */}
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <h3 className="font-bold text-purple-800 mb-3 border-b border-purple-200 pb-2">Segmentación (Opcional)</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-bold text-purple-900 mb-2">Canales Activos</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.channels?.includes('IN_STORE')} onChange={() => toggleChannel('IN_STORE')} className="w-4 h-4 text-purple-600 rounded" />
                                        <span className="text-sm font-medium text-purple-800">Tienda de Ventas (Interno)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.channels?.includes('SELLER_APP')} onChange={() => toggleChannel('SELLER_APP')} className="w-4 h-4 text-purple-600 rounded" />
                                        <span className="text-sm font-medium text-purple-800">App Vendedores</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.channels?.includes('DIRECT_SALE')} onChange={() => toggleChannel('DIRECT_SALE')} className="w-4 h-4 text-purple-600 rounded" />
                                        <span className="text-sm font-medium text-purple-800">Venta Directa</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-bold text-purple-900 flex items-center">
                                        <MapPin className="w-4 h-4 mr-1" /> Ciudades Destino
                                    </label>
                                    <span className="text-xs text-purple-600 font-medium">{formData.target_cities?.length === 0 ? 'Todas' : `${formData.target_cities?.length} sel.`}</span>
                                </div>
                                <div className="h-32 overflow-auto border border-purple-200 rounded p-2 text-xs grid grid-cols-2 md:grid-cols-3 gap-1 bg-white">
                                    {PERU_CITIES.map(c => (
                                        <label key={c} className="flex items-center p-1 rounded hover:bg-purple-100 cursor-pointer text-purple-900">
                                            <input type="checkbox" className="mr-2 rounded border-purple-300 text-purple-600 focus:ring-purple-500" checked={formData.target_cities?.includes(c) || false} onChange={() => toggleCity(c)} />
                                            <span className="truncate">{c}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-purple-900 mb-1">Listas de Precios Permitidas</label>
                                <select
                                    multiple
                                    className="w-full border border-purple-300 p-2 rounded text-sm bg-white"
                                    value={formData.target_price_list_ids || []}
                                    onChange={e => {
                                        const target = e.target as HTMLSelectElement;
                                        const values = Array.from(target.selectedOptions, option => option.value);
                                        setFormData({ ...formData, target_price_list_ids: values });
                                    }}
                                >
                                    <option value="ALL">-- TODAS LAS LISTAS --</option>
                                    {priceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                                </select>
                                <p className="text-xs text-purple-600 mt-1 italic">Si no se selecciona ninguna lista ('TODAS'), aplicará para todos. Mantenga 'Ctrl' presionado para seleccionar varias.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="isActive" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                        <label htmlFor="isActive" className="font-medium text-slate-700">Activado</label>
                    </div>

                </form>
            </div>

            <div className="mt-6 border-t pt-4 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded text-slate-700 font-bold hover:bg-slate-50 transition-colors">
                    Cancelar
                </button>
                <button type="submit" form="autoPromoForm" className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition-colors flex items-center">
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Bonificación
                </button>
            </div>

            {/* PRODUCT MULTI-SELECTOR MODAL */}
            {showProductSelector && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden border border-slate-200">
                        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">Seleccionar Productos Participantes</h3>
                            <button type="button" onClick={() => setShowProductSelector(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-4 border-b flex gap-2 bg-white">
                            <input
                                className="flex-1 border border-slate-300 p-2 rounded text-sm font-medium focus:ring-2 focus:ring-blue-500"
                                placeholder="Buscar por código SKU o nombre..."
                                value={prodSearch}
                                onChange={e => setProdSearch(e.target.value)}
                            />
                            <select
                                className="w-48 border border-slate-300 p-2 rounded text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                            >
                                <option value="">- Todas Categorías -</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 overflow-auto p-4 bg-slate-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {filteredProducts.map(p => {
                                    const isSelected = formData.condition_product_ids?.includes(p.id);
                                    return (
                                        <label key={p.id} className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${isSelected ? 'bg-blue-100 hover:bg-blue-200 border-blue-400' : 'bg-white hover:bg-blue-50 border-slate-200'}`}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mr-3"
                                                checked={isSelected}
                                                onChange={() => toggleConditionProduct(p.id)}
                                            />
                                            <div className="flex flex-col text-sm truncate">
                                                <span className="font-bold text-slate-800 truncate">{p.name}</span>
                                                <span className="text-[10px] text-slate-500 font-mono">{p.sku} | {p.category}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                                {filteredProducts.length === 0 && <div className="col-span-2 text-center py-8 text-slate-500 italic">No hay productos que coincidan.</div>}
                            </div>
                        </div>
                        <div className="p-4 border-t flex justify-between bg-white items-center">
                            <span className="text-sm font-bold text-blue-800 bg-blue-100 px-3 py-1 rounded-full border border-blue-200 shadow-inner">
                                {(formData.condition_product_ids || []).length} seleccionados
                            </span>
                            <button type="button" onClick={() => setShowProductSelector(false)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded shadow transition-colors">
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
