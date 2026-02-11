
import React, { useState, useEffect } from 'react';
import { useStore } from '../../services/store';
import { Combo, Product } from '../../types';
import { Save, X, Search, Trash2, Image as ImageIcon, Plus } from 'lucide-react';

interface ComboFormProps {
    initialData?: Partial<Combo> | null;
    onClose: () => void;
    onSave: (combo: Combo) => void;
}

export const ComboForm: React.FC<ComboFormProps> = ({ initialData, onClose, onSave }) => {
    const { products, sellers } = useStore();
    const [formData, setFormData] = useState<Partial<Combo>>({
        name: '', description: '', price: 0, items: [],
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        is_active: true, image_url: '',
        channels: ['IN_STORE', 'SELLER_APP'],
        allowed_seller_ids: []
    });

    const [prodSearch, setProdSearch] = useState('');
    const [showProductSearch, setShowProductSearch] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({ ...formData, ...initialData });
        }
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.price || (formData.items?.length || 0) === 0) return;
        onSave({ ...formData, id: formData.id || crypto.randomUUID() } as Combo);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, image_url: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleChannel = (channel: 'IN_STORE' | 'SELLER_APP') => {
        const current = formData.channels || [];
        const newChannels = current.includes(channel)
            ? current.filter(c => c !== channel)
            : [...current, channel];
        setFormData({ ...formData, channels: newChannels });
    };

    const toggleSeller = (sellerId: string) => {
        const current = formData.allowed_seller_ids || [];
        const newSellers = current.includes(sellerId)
            ? current.filter(s => s !== sellerId)
            : [...current, sellerId];
        setFormData({ ...formData, allowed_seller_ids: newSellers });
    };

    const addItem = (productId: string) => {
        const currentItems = formData.items || [];
        if (currentItems.find(i => i.product_id === productId)) return; // Already added

        setFormData({
            ...formData,
            items: [...currentItems, { product_id: productId, quantity: 1, unit_type: 'UND' }]
        });
        setProdSearch('');
        setShowProductSearch(false);
    };

    const updateItem = (index: number, field: string, value: any) => {
        if (!formData.items) return;
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData({ ...formData, items: newItems });
    };

    const removeItem = (index: number) => {
        if (!formData.items) return;
        setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-bold text-lg text-slate-700">{initialData?.id ? 'Editar Combo' : 'Nuevo Combo'}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-6">
                {/* Basic & Image */}
                <div className="flex gap-4">
                    {/* Image Upload Area */}
                    <div className="w-32 flex-shrink-0">
                        <label className="block text-xs font-bold text-slate-600 mb-1">Imagen</label>
                        <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 relative overflow-hidden group">
                            {formData.image_url ? (
                                <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon className="w-8 h-8 text-slate-300" />
                            )}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold pointer-events-none">
                                Cambiar
                            </div>
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImageUpload} />
                        </div>
                    </div>

                    {/* Info Fields */}
                    <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Combo</label>
                            <input required className="w-full border border-slate-300 p-2 rounded" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Pack Fiesta 2024" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Descripción</label>
                            <textarea className="w-full border border-slate-300 p-2 rounded h-20 text-xs" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Precio Venta (S/)</label>
                            <input type="number" step="0.01" required className="w-full border border-slate-300 p-2 rounded font-bold text-green-700 text-lg" value={formData.price} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-600 mb-1">Inicio</label>
                                <input type="date" className="w-full border border-slate-300 p-2 rounded text-xs" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-600 mb-1">Fin</label>
                                <input type="date" className="w-full border border-slate-300 p-2 rounded text-xs" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2">Canales Disponibles</label>
                        <div className="flex gap-4">
                            <label className="flex items-center cursor-pointer bg-slate-50 p-2 rounded border border-slate-200">
                                <input type="checkbox" className="mr-2" checked={formData.channels?.includes('IN_STORE')} onChange={() => toggleChannel('IN_STORE')} />
                                <span className="text-xs font-bold">Tienda</span>
                            </label>
                            <label className="flex items-center cursor-pointer bg-slate-50 p-2 rounded border border-slate-200">
                                <input type="checkbox" className="mr-2" checked={formData.channels?.includes('SELLER_APP')} onChange={() => toggleChannel('SELLER_APP')} />
                                <span className="text-xs font-bold">App Vendedores</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2">Restricción Vendedores</label>
                        <div className="h-24 overflow-auto border rounded p-2 text-xs bg-slate-50">
                            <div className="flex items-center mb-1 text-slate-400 italic">
                                {formData.allowed_seller_ids?.length === 0 ? 'Disponible para TODOS' : `${formData.allowed_seller_ids?.length} seleccionados`}
                            </div>
                            {sellers.map(s => (
                                <label key={s.id} className="flex items-center p-1 hover:bg-white rounded cursor-pointer">
                                    <input type="checkbox" className="mr-2" checked={formData.allowed_seller_ids?.includes(s.id)} onChange={() => toggleSeller(s.id)} />
                                    {s.name}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Items */}
                <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-slate-700">Contenido del Combo</label>

                        <div className="relative">
                            <button type="button" onClick={() => setShowProductSearch(!showProductSearch)} className="text-purple-600 hover:text-purple-800 text-xs font-bold flex items-center">
                                <Plus className="w-4 h-4 mr-1" /> Agregar Producto
                            </button>

                            {showProductSearch && (
                                <div className="absolute right-0 top-8 w-72 bg-white shadow-xl border border-slate-200 rounded-lg z-20">
                                    <input
                                        autoFocus
                                        className="w-full p-2 border-b text-xs outline-none"
                                        placeholder="Buscar..."
                                        value={prodSearch}
                                        onChange={e => setProdSearch(e.target.value)}
                                    />
                                    <div className="max-h-48 overflow-auto">
                                        {products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 20).map(p => (
                                            <div key={p.id} onClick={() => addItem(p.id)} className="p-2 hover:bg-purple-50 cursor-pointer text-xs border-b border-slate-50">
                                                {p.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 min-h-[100px]">
                        {(formData.items || []).map((item, idx) => {
                            const prod = products.find(p => p.id === item.product_id);
                            return (
                                <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded shadow-sm border border-slate-100">
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-slate-700">{prod?.name}</div>
                                        <div className="text-[10px] text-slate-400">{prod?.sku}</div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Cant.</label>
                                        <input
                                            type="number" className="w-16 border border-slate-300 p-1 rounded text-center text-sm font-bold"
                                            value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                                        />
                                    </div>

                                    <select className="border border-slate-300 p-1 rounded text-xs bg-white" value={item.unit_type} onChange={e => updateItem(idx, 'unit_type', e.target.value)}>
                                        <option value="UND">UND</option>
                                        <option value="PKG">CAJA</option>
                                    </select>

                                    <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-1">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                        {(formData.items?.length || 0) === 0 && (
                            <div className="flex items-center justify-center h-full text-slate-400 text-xs italic">
                                Agregue productos para armar el combo
                            </div>
                        )}
                    </div>
                </div>
            </form>

            <div className="p-4 border-t flex justify-between bg-slate-50 rounded-b-lg">
                <label className="flex items-center cursor-pointer">
                    <input type="checkbox" className="mr-2" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                    <span className="text-sm font-bold text-slate-700">Estado Activo</span>
                </label>
                <button onClick={handleSubmit} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded font-bold shadow flex items-center">
                    <Save className="w-4 h-4 mr-2" /> Guardar Combo
                </button>
            </div>
        </div>
    );
};
