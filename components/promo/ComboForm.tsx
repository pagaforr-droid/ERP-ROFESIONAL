import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../services/store';
import { Combo, Product } from '../../types';
import { Save, X, Search, Trash2, Image as ImageIcon, Plus, MapPin, Package } from 'lucide-react';
import { PERU_CITIES } from '../../utils/promoUtils';

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
        allowed_seller_ids: [],
        target_cities: []
    });

    const [prodSearch, setProdSearch] = useState('');
    const [showProductSearch, setShowProductSearch] = useState(false);
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

    // Filtered Products for efficient rendering
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.sku.toLowerCase().includes(prodSearch.toLowerCase());
            const matchesCategory = categoryFilter ? p.category === categoryFilter : true;
            const matchesSupplier = supplierFilter ? p.brand === supplierFilter : true;
            return matchesSearch && matchesCategory && matchesSupplier;
        }).slice(0, 30); // Limit
    }, [products, prodSearch, categoryFilter, supplierFilter]);

    useEffect(() => {
        if (initialData) {
            setFormData({ ...formData, ...initialData });
        }
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) { alert('Ingrese el nombre del combo'); return; }
        if (formData.price === undefined || formData.price < 0) { alert('Ingrese un precio válido para el combo'); return; }
        if ((formData.items?.length || 0) === 0) { alert('Agregue al menos un producto al combo'); return; }
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
        <div className="h-full flex flex-col bg-white rounded-lg shadow-xl border border-slate-200">
            <div className="flex justify-between items-center p-4 border-b pb-4">
                <h3 className="font-bold text-xl text-slate-800 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-purple-600" /> 
                    {initialData?.id ? 'Editar Combo' : 'Nuevo Combo'}
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <form id="comboForm" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    
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

                                {/* Info Fields */}
                                <div className="flex-1 grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Combo</label>
                                        <input required className="w-full border border-slate-300 p-2 rounded text-sm bg-white" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Pack Fiesta 2024" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Descripción</label>
                                        <textarea className="w-full border border-slate-300 p-2 rounded h-16 text-xs bg-white" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3 mt-3">
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Precio Total (S/)</label>
                                    <input type="number" step="0.01" required className="w-full border border-slate-300 p-2 rounded font-bold text-purple-700 text-sm bg-white" value={formData.price} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Inicio</label>
                                    <input type="date" className="w-full border border-slate-300 p-2 rounded text-xs bg-white" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Fin</label>
                                    <input type="date" className="w-full border border-slate-300 p-2 rounded text-xs bg-white" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        {/* Segmentación */}
                        <div className="bg-fuchsia-50 p-4 rounded-lg border border-fuchsia-200">
                            <h3 className="font-bold text-fuchsia-800 mb-3 border-b border-fuchsia-200 pb-2">Segmentación (Opcional)</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-fuchsia-900 mb-2">Canales Disponibles</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center cursor-pointer">
                                            <input type="checkbox" className="mr-2 rounded text-fuchsia-600 focus:ring-fuchsia-500" checked={formData.channels?.includes('IN_STORE')} onChange={() => toggleChannel('IN_STORE')} />
                                            <span className="text-xs font-medium text-fuchsia-800">Tienda (Interno)</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input type="checkbox" className="mr-2 rounded text-fuchsia-600 focus:ring-fuchsia-500" checked={formData.channels?.includes('SELLER_APP')} onChange={() => toggleChannel('SELLER_APP')} />
                                            <span className="text-xs font-medium text-fuchsia-800">App Vendedores</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input type="checkbox" className="mr-2 rounded text-fuchsia-600 focus:ring-fuchsia-500" checked={formData.channels?.includes('DIRECT_SALE')} onChange={() => toggleChannel('DIRECT_SALE')} />
                                            <span className="text-xs font-medium text-fuchsia-800">Venta Directa</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-fuchsia-900 flex items-center">
                                                <MapPin className="w-3 h-3 mr-1" /> Ciudades Destino
                                            </label>
                                            <span className="text-[10px] text-fuchsia-600 font-medium">{formData.target_cities?.length === 0 ? 'Todas' : `${formData.target_cities?.length} sel.`}</span>
                                        </div>
                                        <div className="h-28 overflow-auto border border-fuchsia-200 rounded p-2 text-xs bg-white">
                                            {PERU_CITIES.map(c => (
                                                <label key={c} className="flex items-center p-1 rounded hover:bg-fuchsia-100 cursor-pointer">
                                                    <input type="checkbox" className="mr-2 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" checked={formData.target_cities?.includes(c) || false} onChange={() => toggleCity(c)} />
                                                    <span className="truncate text-fuchsia-900">{c}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-fuchsia-900 mb-1">Restricción Vendedores</label>
                                        <div className="h-28 overflow-auto border border-fuchsia-200 rounded p-2 text-xs bg-white">
                                            <div className="flex items-center mb-1 text-slate-400 italic">
                                                {formData.allowed_seller_ids?.length === 0 ? 'Disponible para TODOS' : `${formData.allowed_seller_ids?.length} seleccionados`}
                                            </div>
                                            {sellers.map(s => (
                                                <label key={s.id} className="flex items-center p-1 hover:bg-fuchsia-100 rounded cursor-pointer text-fuchsia-900">
                                                    <input type="checkbox" className="mr-2 rounded text-fuchsia-600 focus:ring-fuchsia-500" checked={formData.allowed_seller_ids?.includes(s.id)} onChange={() => toggleSeller(s.id)} />
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
                        {/* Contenido del Combo */}
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 flex-1 flex flex-col shadow-sm min-h-[400px]">
                            <div className="flex justify-between items-end mb-4 border-b border-purple-200 pb-2">
                                <h3 className="font-bold text-purple-800">
                                    Contenido del Combo <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs ml-2">{formData.items?.length || 0} ítems</span>
                                </h3>

                                <div className="relative">
                                    <button type="button" onClick={() => setShowProductSearch(!showProductSearch)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center shadow-sm transition-colors">
                                        <Plus className="w-3 h-3 mr-1" /> Agregar Producto
                                    </button>

                                    {showProductSearch && (
                                        <div className="absolute right-0 top-10 w-[450px] bg-white shadow-2xl border border-slate-200 rounded-lg z-20 overflow-hidden">
                                            <div className="bg-slate-50 p-3 border-b flex flex-col gap-2">
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-2 w-4 h-4 text-slate-400" />
                                                    <input
                                                        autoFocus
                                                        className="w-full pl-8 p-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-500"
                                                        placeholder="Buscar por nombre o SKU..."
                                                        value={prodSearch}
                                                        onChange={e => setProdSearch(e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <select className="flex-1 border border-slate-300 p-1.5 rounded text-[10px] bg-white focus:ring-1 focus:ring-purple-500" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                                                        <option value="">Todas las Categorías</option>
                                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                    <select className="flex-1 border border-slate-300 p-1.5 rounded text-[10px] bg-white focus:ring-1 focus:ring-purple-500" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
                                                        <option value="">Todas las Marcas</option>
                                                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="max-h-[300px] overflow-auto">
                                                {filteredProducts.map(p => (
                                                    <div key={p.id} onClick={() => addItem(p.id)} className="p-3 hover:bg-purple-50 cursor-pointer text-xs border-b border-slate-50 flex justify-between items-center group transition-colors">
                                                        <div className="flex-1 min-w-0 pr-2">
                                                            <div className="font-bold text-slate-700 truncate">{p.name}</div>
                                                            <div className="text-[10px] text-slate-500">{p.sku} | {p.brand} | {p.category}</div>
                                                        </div>
                                                        <div className="font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">S/ {p.price_unit.toFixed(2)}</div>
                                                        <div className="opacity-0 group-hover:opacity-100 ml-2 text-purple-600 bg-purple-100 p-1 rounded-full"><Plus className="w-3 h-3" /></div>
                                                    </div>
                                                ))}
                                                {filteredProducts.length === 0 && <div className="p-6 text-center text-slate-400 text-xs italic">No hay productos que coincidan con la búsqueda.</div>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 bg-white border border-purple-200 rounded-lg p-2 space-y-2 overflow-auto">
                                {(formData.items || []).map((item, idx) => {
                                    const prod = products.find(p => p.id === item.product_id);
                                    return (
                                        <div key={idx} className="flex items-center gap-3 bg-purple-50/30 p-3 rounded shadow-sm border border-purple-100 hover:border-purple-300 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-purple-900 truncate">{prod?.name}</div>
                                                <div className="text-[10px] text-purple-600">{prod?.sku}</div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <label className="text-[10px] uppercase font-bold text-purple-600">Cant.</label>
                                                <input
                                                    type="number" min="1" className="w-16 border border-purple-200 p-1 rounded text-center text-sm font-bold text-purple-900 focus:ring-purple-500 focus:border-purple-500"
                                                    value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                                                />
                                            </div>

                                            <select className="border border-purple-200 p-1 rounded text-xs bg-white text-purple-900 focus:ring-purple-500 focus:border-purple-500" value={item.unit_type} onChange={e => updateItem(idx, 'unit_type', e.target.value)}>
                                                <option value="UND">UND</option>
                                                <option value="PKG">CAJA</option>
                                            </select>

                                            <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors" title="Quitar producto">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                                {(formData.items?.length || 0) === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs italic gap-4 opacity-70">
                                        <Package className="w-12 h-12 text-purple-200" />
                                        <span>El combo está vacío. Agregue productos participanes.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <div className="p-4 border-t flex justify-between items-center bg-white rounded-b-lg">
                <div className="flex gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded text-slate-700 font-bold hover:bg-slate-50 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSubmit} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded font-bold shadow flex items-center transition-colors">
                        <Save className="w-4 h-4 mr-2" /> Guardar Combo
                    </button>
                </div>
                
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="isActiveCombo" className="w-5 h-5 text-red-500 rounded border-slate-300 focus:ring-red-500" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                    <label htmlFor="isActiveCombo" className="font-bold text-slate-700">Estado Activo</label>
                </div>
            </div>
        </div>
    );
};
