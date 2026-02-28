import React, { useState } from 'react';
import { AutoPromotion, Product, Supplier } from '../../types';
import { useStore } from '../../services/store';
import { Save, X, Search, Plus, Trash2 } from 'lucide-react';

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
        end_date: initialData?.end_date || new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
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
        target_price_list_ids: initialData?.target_price_list_ids || []
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return alert('Ingrese el nombre');
        if (formData.condition_type === 'BUY_X_PRODUCT' && !formData.condition_product_id) return alert('Seleccione producto condición');
        if (!formData.reward_product_id) return alert('Seleccione producto de premio');

        onSave(formData as AutoPromotion);
    };

    const toggleChannel = (ch: 'IN_STORE' | 'SELLER_APP') => {
        const current = formData.channels || [];
        if (current.includes(ch)) {
            setFormData({ ...formData, channels: current.filter(c => c !== ch) });
        } else {
            setFormData({ ...formData, channels: [...current, ch] });
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

                            {formData.condition_type === 'BUY_X_PRODUCT' && (
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-blue-900 mb-1">Producto Condición</label>
                                    <select className="w-full border border-blue-300 p-2 rounded text-sm bg-white" value={formData.condition_product_id} onChange={e => setFormData({ ...formData, condition_product_id: e.target.value })}>
                                        <option value="">Seleccione Producto...</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {formData.condition_type === 'SPEND_Y_CATEGORY' && (
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-blue-900 mb-1">Categoría</label>
                                    <input className="w-full border border-blue-300 p-2 rounded text-sm bg-white" placeholder="Ej: CERVEZA" value={formData.condition_category} onChange={e => setFormData({ ...formData, condition_category: e.target.value.toUpperCase() })} />
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
        </div>
    );
};
