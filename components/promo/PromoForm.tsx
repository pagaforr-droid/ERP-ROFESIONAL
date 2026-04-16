import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../services/store';
import { Promotion, Product } from '../../types';
import { Save, X, Search, Square, Image as ImageIcon, MapPin } from 'lucide-react';
import { PERU_CITIES } from '../../utils/promoUtils';
import { supabase, USE_MOCK_DB } from '../../services/supabase';

interface PromoFormProps {
    initialData?: Partial<Promotion> | null;
    onClose: () => void;
    onSave: (promo: Promotion) => void;
}

export const PromoForm: React.FC<PromoFormProps> = ({ initialData, onClose, onSave }) => {
    const store = useStore();
    const [dbProducts, setDbProducts] = useState<Product[]>([]);
    const [dbSellers, setDbSellers] = useState<any[]>([]);

    useEffect(() => {
        const fetchMasterData = async () => {
            if (!USE_MOCK_DB) {
                try {
                    const [pRes, slRes] = await Promise.all([
                        supabase.from('products').select('*').eq('is_active', true).order('name'),
                        supabase.from('sellers').select('*').order('name')
                    ]);
                    if (pRes.data) setDbProducts(pRes.data as Product[]);
                    if (slRes.data) setDbSellers(slRes.data as any[]);
                } catch (error) {
                    console.error("Error fetching data for PromoForm:", error);
                }
            }
        };
        fetchMasterData();
    }, []);

    const products = USE_MOCK_DB ? store.products : dbProducts;
    const sellers = USE_MOCK_DB ? store.sellers : dbSellers;

    const [formData, setFormData] = useState<Partial<Promotion>>({
        id: initialData?.id || crypto.randomUUID(),
        name: '', type: 'PERCENTAGE_DISCOUNT', value: 0, product_ids: [],
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        is_active: true,
        channels: ['IN_STORE'],
        allowed_seller_ids: [], // Empty means all
        image_url: '',
        min_quantity: 1,
        target_cities: []
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('');

    const categories = useMemo(() => Array.from(new Set((products || []).map(p => p?.category).filter(Boolean))), [products]);
    const brands = useMemo(() => Array.from(new Set((products || []).map(p => p?.brand).filter(Boolean))), [products]);

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({ ...prev, ...initialData }));
        }
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.value) return alert('Ingrese nombre y valor de descuento');
        onSave(formData as Promotion);
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

    const toggleChannel = (channel: 'IN_STORE' | 'SELLER_APP' | 'DIRECT_SALE') => {
        const current = formData.channels || [];
        const newChannels = current.includes(channel)
            ? current.filter(c => c !== channel)
            : [...current, channel];
        setFormData({ ...formData, channels: newChannels });
    };

    const toggleCity = (city: string) => {
        const current = formData.target_cities || [];
        const newCities = current.includes(city)
            ? current.filter(c => c !== city)
            : [...current, city];
        setFormData({ ...formData, target_cities: newCities });
    };

    const toggleSeller = (sellerId: string) => {
        const current = formData.allowed_seller_ids || [];
        const newSellers = current.includes(sellerId)
            ? current.filter(s => s !== sellerId)
            : [...current, sellerId];
        setFormData({ ...formData, allowed_seller_ids: newSellers });
    };

    const filteredProducts = useMemo(() => {
        return (products || []).filter(p => {
            const matchesSearch = (p?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p?.sku || '').includes(searchTerm);
            const matchesCategory = categoryFilter ? p?.category === categoryFilter : true;
            const matchesSupplier = supplierFilter ? p?.brand === supplierFilter : true;
            return matchesSearch && matchesCategory && matchesSupplier;
        }).slice(0, 100);
    }, [products, searchTerm, categoryFilter, supplierFilter]);

    const selectAllFiltered = () => {
        const filteredIds = filteredProducts.map(p => p.id);
        const currentIds = formData.product_ids || [];
        const newIds = Array.from(new Set([...currentIds, ...filteredIds]));
        setFormData({ ...formData, product_ids: newIds });
    };

    const deselectAllFiltered = () => {
        const filteredIds = filteredProducts.map(p => p.id);
        const currentIds = formData.product_ids || [];
        const newIds = currentIds.filter(id => !filteredIds.includes(id));
        setFormData({ ...formData, product_ids: newIds });
    };

    return (
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-xl font-bold text-slate-800">
                    {initialData?.id ? 'Editar Promoción Clásica' : 'Nueva Promoción Clásica'}
                </h2>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="flex-1 overflow-auto pr-2">
                <form id="promoForm" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    
                    {/* Columna Izquierda */}
                    <div className="space-y-6">
                        {/* Datos Generales */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h3 className="font-bold text-slate-700 mb-3 border-b pb-2">Datos Generales</h3>
                            <div className="flex gap-4">
                                {/* Image Upload Area */}
                                <div className="w-28 flex-shrink-0">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Imagen</label>
                                    <div className="w-28 h-28 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-white relative overflow-hidden group">
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

                                <div className="flex-1 grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Oferta</label>
                                        <input required className="w-full border border-slate-300 p-2 rounded text-sm bg-white" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Descuento Verano 2024" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Tipo Descuento</label>
                                        <select className="w-full border border-slate-300 p-2 rounded text-sm bg-white font-bold text-pink-700" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                                            <option value="PERCENTAGE_DISCOUNT">Porcentaje (%)</option>
                                            <option value="FIXED_PRICE">Precio Fijo Unitario (S/)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Valor</label>
                                        <input type="number" required className="w-full border border-slate-300 p-2 rounded text-sm bg-white font-bold" value={formData.value} onChange={e => setFormData({ ...formData, value: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Cant. Mínima</label>
                                        <input type="number" className="w-full border border-slate-300 p-2 rounded text-sm bg-white" value={formData.min_quantity} onChange={e => setFormData({ ...formData, min_quantity: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Inicio</label>
                                        <input type="date" className="w-full border border-slate-300 p-2 rounded text-xs bg-white" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Fin</label>
                                        <input type="date" className="w-full border border-slate-300 p-2 rounded text-xs bg-white" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Segmentación */}
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h3 className="font-bold text-purple-800 mb-3 border-b border-purple-200 pb-2">Segmentación (Opcional)</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-purple-900 mb-2">Canales Disponibles</label>
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

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-purple-900 flex items-center">
                                                <MapPin className="w-4 h-4 mr-1" /> Ciudades Destino
                                            </label>
                                            <span className="text-[10px] text-purple-600 font-medium">{formData.target_cities?.length === 0 ? 'Todas' : `${formData.target_cities?.length} sel.`}</span>
                                        </div>
                                        <div className="h-28 overflow-auto border border-purple-200 rounded p-2 text-xs bg-white">
                                            {PERU_CITIES.map(c => (
                                                <label key={c} className="flex items-center p-1 rounded hover:bg-purple-100 cursor-pointer text-purple-900">
                                                    <input type="checkbox" className="mr-2 rounded border-purple-300 text-purple-600" checked={formData.target_cities?.includes(c) || false} onChange={() => toggleCity(c)} />
                                                    <span className="truncate">{c}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-purple-900 mb-1">Restricción Vendedores</label>
                                        <div className="h-28 overflow-auto border border-purple-200 rounded p-2 text-xs bg-white">
                                            <div className="flex items-center mb-1 text-slate-400 italic">
                                                {formData.allowed_seller_ids?.length === 0 ? 'Disponible para TODOS' : `${formData.allowed_seller_ids?.length} sel.`}
                                            </div>
                                            {sellers.map(s => (
                                                <label key={s.id} className="flex items-center p-1 hover:bg-purple-100 rounded cursor-pointer text-purple-900">
                                                    <input type="checkbox" className="mr-2 rounded border-purple-300 text-purple-600" checked={formData.allowed_seller_ids?.includes(s.id)} onChange={() => toggleSeller(s.id)} />
                                                    {s.name}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Columna Derecha */}
                    <div className="space-y-6 h-full flex flex-col">
                        {/* Productos Aplicables */}
                        <div className="bg-pink-50 p-4 rounded-lg border border-pink-200 flex-1 flex flex-col shadow-sm min-h-[400px]">
                            <h3 className="font-bold text-pink-800 mb-3 border-b border-pink-200 pb-2">
                                Productos Aplicables <span className="bg-pink-200 text-pink-800 px-2 py-0.5 rounded-full text-xs ml-2">{formData.product_ids?.length} seleccionados</span>
                            </h3>

                            <div className="flex gap-2 items-center mb-3 flex-wrap">
                                <div className="relative flex-1 min-w-[120px]">
                                    <Search className="absolute left-2 top-2 w-3 h-3 text-slate-400" />
                                    <input
                                        className="w-full pl-7 border border-slate-300 rounded p-1.5 text-xs bg-white"
                                        placeholder="Buscar producto..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <select className="border border-slate-300 p-1.5 rounded text-xs bg-white w-32" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                                    <option value="">- Todas Categorías -</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select className="border border-slate-300 p-1.5 rounded text-xs bg-white w-32" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
                                    <option value="">- Todas las Marcas -</option>
                                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <button type="button" onClick={selectAllFiltered} className="text-[10px] bg-pink-600 text-white px-2 py-1.5 rounded hover:bg-pink-700 font-bold whitespace-nowrap">Marcar Visibles</button>
                                <button type="button" onClick={deselectAllFiltered} className="text-[10px] bg-white text-pink-700 border border-pink-300 px-2 py-1.5 rounded hover:bg-pink-100 font-bold whitespace-nowrap">Desmarcar Visibles</button>
                            </div>

                            <div className="flex-1 overflow-auto border border-pink-200 rounded bg-white">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-pink-100 sticky top-0 z-10 text-pink-900 border-b border-pink-200">
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
                                                <tr key={p.id} className={`hover:bg-pink-50 cursor-pointer transition-colors ${isSelected ? 'bg-pink-50/50 font-bold text-pink-900' : ''}`} onClick={() => toggleProduct(p.id)}>
                                                    <td className="p-2 text-center">
                                                        <input type="checkbox" checked={isSelected} readOnly className="pointer-events-none text-pink-600 rounded border-slate-300 focus:ring-pink-500" />
                                                    </td>
                                                    <td className="p-2">{p.name}</td>
                                                    <td className="p-2 text-slate-500">{p.sku}</td>
                                                    <td className="p-2 text-right">S/ {(p.price_unit || 0).toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                        {filteredProducts.length === 0 && (
                                            <tr><td colSpan={4} className="p-4 text-center text-slate-400">No se encontraron productos coincidentes</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <div className="mt-6 border-t pt-4 flex justify-between items-center">
                <div className="flex gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded text-slate-700 font-bold hover:bg-slate-50 transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" form="promoForm" className="bg-pink-600 text-white px-6 py-2 rounded font-bold hover:bg-pink-700 transition-colors flex items-center shadow-sm">
                        <Save className="w-4 h-4 mr-2" /> 
                        Guardar Promoción
                    </button>
                </div>
                
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="isActivePromo" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="w-5 h-5 text-red-500 rounded border-slate-300 focus:ring-red-500" />
                    <label htmlFor="isActivePromo" className="font-bold text-slate-700">Activado</label>
                </div>
            </div>
        </div>
    );
};
