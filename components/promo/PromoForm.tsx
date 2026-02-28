
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../services/store';
import { Promotion, Product } from '../../types';
import { Save, X, Search, CheckSquare, Square, Image as ImageIcon, Filter } from 'lucide-react';

interface PromoFormProps {
    initialData?: Partial<Promotion> | null;
    onClose: () => void;
    onSave: (promo: Promotion) => void;
}

export const PromoForm: React.FC<PromoFormProps> = ({ initialData, onClose, onSave }) => {
    const { products, sellers } = useStore();
    const [formData, setFormData] = useState<Partial<Promotion>>({
        name: '', type: 'PERCENTAGE_DISCOUNT', value: 0, product_ids: [],
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        is_active: true,
        channels: ['IN_STORE'],
        allowed_seller_ids: [], // Empty means all
        image_url: '',
        min_quantity: 1
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('');

    // Extraer categorías únicas para el filtro
    const categories = useMemo(() => {
        const cats = products.map(p => p.category).filter(Boolean);
        return Array.from(new Set(cats));
    }, [products]);

    // Extraer marcas/proveedores únicos
    const brands = useMemo(() => {
        const brs = products.map(p => p.brand).filter(Boolean);
        return Array.from(new Set(brs));
    }, [products]);

    useEffect(() => {
        if (initialData) {
            setFormData({ ...formData, ...initialData });
        }
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.value) return;
        onSave({ ...formData, id: formData.id || crypto.randomUUID() } as Promotion);
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

    const toggleProduct = (productId: string) => {
        const currentIds = formData.product_ids || [];
        const newIds = currentIds.includes(productId)
            ? currentIds.filter(id => id !== productId)
            : [...currentIds, productId];
        setFormData({ ...formData, product_ids: newIds });
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

    // Filtered Products for efficient rendering
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.includes(searchTerm);
            const matchesCategory = categoryFilter ? p.category === categoryFilter : true;
            const matchesSupplier = supplierFilter ? p.brand === supplierFilter : true;
            return matchesSearch && matchesCategory && matchesSupplier;
        }).slice(0, 100); // Limit to 100 for performance if searching empty
    }, [products, searchTerm, categoryFilter, supplierFilter]);

    // Add all filtered to selection
    const selectAllFiltered = () => {
        const filteredIds = filteredProducts.map(p => p.id);
        const currentIds = formData.product_ids || [];
        const newIds = Array.from(new Set([...currentIds, ...filteredIds]));
        setFormData({ ...formData, product_ids: newIds });
    };

    // Remove all filtered from selection
    const deselectAllFiltered = () => {
        const filteredIds = filteredProducts.map(p => p.id);
        const currentIds = formData.product_ids || [];
        const newIds = currentIds.filter(id => !filteredIds.includes(id));
        setFormData({ ...formData, product_ids: newIds });
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-bold text-lg text-slate-700">{initialData?.id ? 'Editar Promoción' : 'Nueva Promoción'}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-6">
                {/* Basic Info & Image */}
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

                    <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Oferta</label>
                            <input required className="w-full border border-slate-300 p-2 rounded" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Descuento Verano 2024" />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Tipo Descuento</label>
                            <select className="w-full border border-slate-300 p-2 rounded" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                                <option value="PERCENTAGE_DISCOUNT">Porcentaje (%)</option>
                                <option value="FIXED_PRICE">Precio Fijo Unitario (S/)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Valor</label>
                            <input type="number" required className="w-full border border-slate-300 p-2 rounded font-bold" value={formData.value} onChange={e => setFormData({ ...formData, value: Number(e.target.value) })} />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Cant. Mínima</label>
                            <input type="number" className="w-full border border-slate-300 p-2 rounded" value={formData.min_quantity} onChange={e => setFormData({ ...formData, min_quantity: Number(e.target.value) })} />
                        </div>

                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-600 mb-1">Inicio</label>
                                <input type="date" className="w-full border border-slate-300 p-2 rounded" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-600 mb-1">Fin</label>
                                <input type="date" className="w-full border border-slate-300 p-2 rounded" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2">Canales Disponibles</label>
                        <div className="space-y-2">
                            <label className="flex items-center cursor-pointer">
                                <input type="checkbox" className="mr-2" checked={formData.channels?.includes('IN_STORE')} onChange={() => toggleChannel('IN_STORE')} />
                                <span className="text-sm">Venta en Tienda (Punto de Venta)</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input type="checkbox" className="mr-2" checked={formData.channels?.includes('SELLER_APP')} onChange={() => toggleChannel('SELLER_APP')} />
                                <span className="text-sm">App Vendedores (Móvil)</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2">Restricción Vendedores</label>
                        <div className="h-24 overflow-auto border rounded p-2 text-xs">
                            <div className="flex items-center mb-1 text-slate-400 italic">
                                {formData.allowed_seller_ids?.length === 0 ? 'Disponible para TODOS' : `${formData.allowed_seller_ids?.length} seleccionados`}
                            </div>
                            {sellers.map(s => (
                                <label key={s.id} className="flex items-center p-1 hover:bg-slate-50">
                                    <input type="checkbox" className="mr-2" checked={formData.allowed_seller_ids?.includes(s.id)} onChange={() => toggleSeller(s.id)} />
                                    {s.name}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Product Selection */}
                <div className="border-t pt-4 flex flex-col h-72">
                    <div className="flex justify-between items-end mb-2">
                        <label className="block text-xs font-bold text-slate-600">Productos Aplicables ({formData.product_ids?.length} sel.)</label>

                        <div className="flex gap-2 items-center">
                            <button type="button" onClick={selectAllFiltered} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 font-bold">Seleccionar Visibles</button>
                            <button type="button" onClick={deselectAllFiltered} className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 font-bold">Deseleccionar Visibles</button>
                            <div className="h-4 w-px bg-slate-300 mx-1"></div>
                            <div className="relative w-32">
                                <Search className="absolute left-2 top-1.5 w-3 h-3 text-slate-400" />
                                <input
                                    className="w-full pl-6 border border-slate-300 rounded p-1 text-[10px]"
                                    placeholder="Buscar producto..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <select className="border border-slate-300 p-1 rounded text-[10px] bg-white w-32" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                                <option value="">- Todas las Categorías -</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select className="border border-slate-300 p-1 rounded text-[10px] bg-white w-32" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
                                <option value="">- Todas las Marcas -</option>
                                {brands.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto border border-slate-200 rounded">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="p-2 w-8"><Square className="w-3 h-3" /></th>
                                    <th className="p-2">Producto</th>
                                    <th className="p-2">SKU</th>
                                    <th className="p-2 text-right">Precio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredProducts.map(p => {
                                    const isSelected = formData.product_ids?.includes(p.id);
                                    return (
                                        <tr key={p.id} className={`hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-pink-50' : ''}`} onClick={() => toggleProduct(p.id)}>
                                            <td className="p-2 text-center">
                                                <input type="checkbox" checked={isSelected} readOnly className="pointer-events-none" />
                                            </td>
                                            <td className="p-2 font-medium">{p.name}</td>
                                            <td className="p-2 text-slate-500">{p.sku}</td>
                                            <td className="p-2 text-right">S/ {p.price_unit.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                                {filteredProducts.length === 0 && (
                                    <tr><td colSpan={4} className="p-4 text-center text-slate-400">No se encontraron productos</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </form>

            <div className="p-4 border-t flex justify-between bg-slate-50 rounded-b-lg">
                <label className="flex items-center cursor-pointer">
                    <input type="checkbox" className="mr-2" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                    <span className="text-sm font-bold text-slate-700">Estado Activo</span>
                </label>
                <button onClick={handleSubmit} className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded font-bold shadow flex items-center">
                    <Save className="w-4 h-4 mr-2" /> Guardar Promoción
                </button>
            </div>
        </div>
    );
};
