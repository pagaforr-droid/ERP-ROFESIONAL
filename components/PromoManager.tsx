
import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Promotion, Combo, Product } from '../types';
import { Tag, Package, Plus, Save, Trash2, Search, X, Gift } from 'lucide-react';

export const PromoManager: React.FC = () => {
  const { products, promotions, combos, addPromotion, updatePromotion, addCombo, updateCombo } = useStore();
  const [activeTab, setActiveTab] = useState<'PROMOS' | 'COMBOS'>('PROMOS');
  
  // --- PROMO FORM STATE ---
  const initialPromo: Partial<Promotion> = {
    name: '', type: 'PERCENTAGE_DISCOUNT', value: 0, product_ids: [], 
    start_date: new Date().toISOString().split('T')[0], 
    end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    is_active: true
  };
  const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);

  // --- COMBO FORM STATE ---
  const initialCombo: Partial<Combo> = {
    name: '', description: '', price: 0, items: [], 
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    is_active: true, image_url: ''
  };
  const [editingCombo, setEditingCombo] = useState<Partial<Combo> | null>(null);
  
  // Product Search for selectors
  const [prodSearch, setProdSearch] = useState('');

  // --- PROMOTION HANDLERS ---
  const handleSavePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPromo?.name || !editingPromo.value) return;
    const finalPromo = { ...editingPromo, id: editingPromo.id || crypto.randomUUID() } as Promotion;
    if (editingPromo.id) updatePromotion(finalPromo);
    else addPromotion(finalPromo);
    setEditingPromo(null);
  };

  const toggleProductInPromo = (productId: string) => {
    if (!editingPromo) return;
    const currentIds = editingPromo.product_ids || [];
    const newIds = currentIds.includes(productId) 
      ? currentIds.filter(id => id !== productId)
      : [...currentIds, productId];
    setEditingPromo({ ...editingPromo, product_ids: newIds });
  };

  // --- COMBO HANDLERS ---
  const handleSaveCombo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCombo?.name || !editingCombo.price || (editingCombo.items?.length || 0) === 0) return;
    const finalCombo = { ...editingCombo, id: editingCombo.id || crypto.randomUUID() } as Combo;
    if (editingCombo.id) updateCombo(finalCombo);
    else addCombo(finalCombo);
    setEditingCombo(null);
  };

  const addItemToCombo = (productId: string) => {
    if (!editingCombo) return;
    const currentItems = editingCombo.items || [];
    setEditingCombo({
      ...editingCombo,
      items: [...currentItems, { product_id: productId, quantity: 1, unit_type: 'UND' }]
    });
  };

  const updateComboItem = (index: number, field: string, value: any) => {
    if (!editingCombo || !editingCombo.items) return;
    const newItems = [...editingCombo.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditingCombo({ ...editingCombo, items: newItems });
  };

  const removeComboItem = (index: number) => {
    if (!editingCombo || !editingCombo.items) return;
    setEditingCombo({ ...editingCombo, items: editingCombo.items.filter((_, i) => i !== index) });
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <Gift className="mr-2 text-pink-600" /> Gestión de Ofertas y Combos
        </h2>
      </div>

      <div className="flex bg-white rounded-t-lg border-b border-slate-200">
        <button onClick={() => setActiveTab('PROMOS')} className={`px-6 py-3 font-bold text-sm border-b-2 ${activeTab === 'PROMOS' ? 'border-pink-600 text-pink-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
           <Tag className="w-4 h-4 mr-2 inline" /> Promociones (Descuentos)
        </button>
        <button onClick={() => setActiveTab('COMBOS')} className={`px-6 py-3 font-bold text-sm border-b-2 ${activeTab === 'COMBOS' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
           <Package className="w-4 h-4 mr-2 inline" /> Combos (Packs)
        </button>
      </div>

      <div className="flex-1 bg-white rounded-b-lg shadow border border-slate-200 p-6 overflow-auto">
        
        {/* --- PROMOS TAB --- */}
        {activeTab === 'PROMOS' && (
          <div className="flex gap-6 h-full">
             {/* List */}
             <div className="w-1/3 border-r border-slate-100 pr-6 flex flex-col">
                <button onClick={() => setEditingPromo(initialPromo)} className="w-full bg-slate-900 text-white py-2 rounded font-bold mb-4 flex items-center justify-center">
                   <Plus className="w-4 h-4 mr-2"/> Nueva Promoción
                </button>
                <div className="flex-1 overflow-auto space-y-2">
                   {promotions.map(p => (
                      <div key={p.id} onClick={() => setEditingPromo(p)} className={`p-3 rounded border cursor-pointer hover:bg-slate-50 ${editingPromo?.id === p.id ? 'border-pink-500 bg-pink-50' : 'border-slate-200'}`}>
                         <div className="font-bold text-slate-800">{p.name}</div>
                         <div className="flex justify-between items-center text-xs mt-1">
                            <span className={p.is_active ? 'text-green-600 font-bold' : 'text-red-500'}>{p.is_active ? 'ACTIVO' : 'INACTIVO'}</span>
                            <span className="font-mono">{p.type === 'PERCENTAGE_DISCOUNT' ? `-${p.value}%` : `S/ ${p.value}`}</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             {/* Form */}
             <div className="flex-1 pl-2">
                {editingPromo ? (
                   <form onSubmit={handleSavePromo} className="space-y-4">
                      <div className="flex justify-between items-center border-b pb-2 mb-4">
                         <h3 className="font-bold text-lg text-slate-700">{editingPromo.id ? 'Editar Promoción' : 'Nueva Promoción'}</h3>
                         <button type="button" onClick={() => setEditingPromo(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Oferta</label>
                            <input required className="w-full border border-slate-300 p-2 rounded" value={editingPromo.name} onChange={e => setEditingPromo({...editingPromo, name: e.target.value})} />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Tipo Descuento</label>
                            <select className="w-full border border-slate-300 p-2 rounded" value={editingPromo.type} onChange={e => setEditingPromo({...editingPromo, type: e.target.value as any})}>
                               <option value="PERCENTAGE_DISCOUNT">Porcentaje (%)</option>
                               <option value="FIXED_PRICE">Precio Fijo Unitario</option>
                            </select>
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Valor ({editingPromo.type === 'PERCENTAGE_DISCOUNT' ? '%' : 'S/'})</label>
                            <input type="number" required className="w-full border border-slate-300 p-2 rounded font-bold" value={editingPromo.value} onChange={e => setEditingPromo({...editingPromo, value: Number(e.target.value)})} />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Inicio</label>
                            <input type="date" className="w-full border border-slate-300 p-2 rounded" value={editingPromo.start_date} onChange={e => setEditingPromo({...editingPromo, start_date: e.target.value})} />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Fin</label>
                            <input type="date" className="w-full border border-slate-300 p-2 rounded" value={editingPromo.end_date} onChange={e => setEditingPromo({...editingPromo, end_date: e.target.value})} />
                         </div>
                         <div className="col-span-2">
                            <label className="flex items-center text-sm font-bold text-slate-700">
                               <input type="checkbox" className="mr-2 w-4 h-4" checked={editingPromo.is_active} onChange={e => setEditingPromo({...editingPromo, is_active: e.target.checked})} />
                               Promoción Activa
                            </label>
                         </div>
                      </div>

                      <div className="border-t pt-4">
                         <label className="block text-xs font-bold text-slate-600 mb-2">Productos Aplicables</label>
                         <div className="h-48 overflow-auto border border-slate-200 rounded p-2 grid grid-cols-2 gap-2">
                            {products.map(p => (
                               <label key={p.id} className="flex items-center p-2 hover:bg-slate-50 border rounded cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="mr-2" 
                                    checked={editingPromo.product_ids?.includes(p.id)}
                                    onChange={() => toggleProductInPromo(p.id)}
                                  />
                                  <div className="text-xs">
                                     <div className="font-bold text-slate-700">{p.name}</div>
                                     <div className="text-slate-500">{p.sku}</div>
                                  </div>
                               </label>
                            ))}
                         </div>
                      </div>

                      <div className="flex justify-end pt-4">
                         <button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded font-bold shadow flex items-center">
                            <Save className="w-4 h-4 mr-2" /> Guardar Promoción
                         </button>
                      </div>
                   </form>
                ) : (
                   <div className="h-full flex items-center justify-center text-slate-400">Seleccione o cree una promoción</div>
                )}
             </div>
          </div>
        )}

        {/* --- COMBOS TAB --- */}
        {activeTab === 'COMBOS' && (
          <div className="flex gap-6 h-full">
             {/* List */}
             <div className="w-1/3 border-r border-slate-100 pr-6 flex flex-col">
                <button onClick={() => setEditingCombo(initialCombo)} className="w-full bg-slate-900 text-white py-2 rounded font-bold mb-4 flex items-center justify-center">
                   <Plus className="w-4 h-4 mr-2"/> Nuevo Combo
                </button>
                <div className="flex-1 overflow-auto space-y-2">
                   {combos.map(c => (
                      <div key={c.id} onClick={() => setEditingCombo(c)} className={`p-3 rounded border cursor-pointer hover:bg-slate-50 ${editingCombo?.id === c.id ? 'border-purple-500 bg-purple-50' : 'border-slate-200'}`}>
                         <div className="font-bold text-slate-800">{c.name}</div>
                         <div className="flex justify-between items-center text-xs mt-1">
                            <span className={c.is_active ? 'text-green-600 font-bold' : 'text-red-500'}>{c.is_active ? 'ACTIVO' : 'INACTIVO'}</span>
                            <span className="font-bold text-slate-900">S/ {c.price.toFixed(2)}</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             {/* Form */}
             <div className="flex-1 pl-2">
                {editingCombo ? (
                   <form onSubmit={handleSaveCombo} className="space-y-4">
                      <div className="flex justify-between items-center border-b pb-2 mb-4">
                         <h3 className="font-bold text-lg text-slate-700">{editingCombo.id ? 'Editar Combo' : 'Nuevo Combo'}</h3>
                         <button type="button" onClick={() => setEditingCombo(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                      </div>
                      
                      {/* Basic Info */}
                      <div className="grid grid-cols-2 gap-4">
                         <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Combo</label>
                            <input required className="w-full border border-slate-300 p-2 rounded" value={editingCombo.name} onChange={e => setEditingCombo({...editingCombo, name: e.target.value})} />
                         </div>
                         <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Descripción</label>
                            <input className="w-full border border-slate-300 p-2 rounded" value={editingCombo.description} onChange={e => setEditingCombo({...editingCombo, description: e.target.value})} />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Precio Venta (S/)</label>
                            <input type="number" step="0.01" required className="w-full border border-slate-300 p-2 rounded font-bold text-green-700" value={editingCombo.price} onChange={e => setEditingCombo({...editingCombo, price: Number(e.target.value)})} />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Imagen URL</label>
                            <input className="w-full border border-slate-300 p-2 rounded" value={editingCombo.image_url} onChange={e => setEditingCombo({...editingCombo, image_url: e.target.value})} />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Inicio</label>
                            <input type="date" className="w-full border border-slate-300 p-2 rounded" value={editingCombo.start_date} onChange={e => setEditingCombo({...editingCombo, start_date: e.target.value})} />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Fin</label>
                            <input type="date" className="w-full border border-slate-300 p-2 rounded" value={editingCombo.end_date} onChange={e => setEditingCombo({...editingCombo, end_date: e.target.value})} />
                         </div>
                         <div className="col-span-2">
                            <label className="flex items-center text-sm font-bold text-slate-700">
                               <input type="checkbox" className="mr-2 w-4 h-4" checked={editingCombo.is_active} onChange={e => setEditingCombo({...editingCombo, is_active: e.target.checked})} />
                               Combo Activo
                            </label>
                         </div>
                      </div>

                      {/* Items Config */}
                      <div className="border-t pt-4">
                         <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-slate-600">Contenido del Combo</label>
                            <div className="relative w-64">
                               <input 
                                 className="w-full border border-slate-300 rounded p-1 pl-6 text-xs" 
                                 placeholder="Buscar producto para agregar..."
                                 value={prodSearch}
                                 onChange={e => setProdSearch(e.target.value)}
                               />
                               <Search className="absolute left-1 top-1.5 w-3 h-3 text-slate-400" />
                               {prodSearch && (
                                  <div className="absolute top-full left-0 w-full bg-white shadow-xl border border-slate-200 z-10 max-h-40 overflow-auto">
                                     {products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase())).map(p => (
                                        <div key={p.id} onClick={() => { addItemToCombo(p.id); setProdSearch(''); }} className="p-2 hover:bg-blue-50 cursor-pointer text-xs">
                                           {p.name}
                                        </div>
                                     ))}
                                  </div>
                               )}
                            </div>
                         </div>
                         
                         <div className="bg-slate-50 border border-slate-200 rounded p-2 space-y-2 max-h-60 overflow-auto">
                            {(editingCombo.items || []).map((item, idx) => {
                               const prod = products.find(p => p.id === item.product_id);
                               return (
                                  <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 shadow-sm">
                                     <span className="flex-1 text-xs font-bold text-slate-700">{prod?.name}</span>
                                     <input 
                                       type="number" className="w-16 border p-1 rounded text-center text-sm" 
                                       value={item.quantity} onChange={e => updateComboItem(idx, 'quantity', Number(e.target.value))} 
                                     />
                                     <select className="border p-1 rounded text-xs" value={item.unit_type} onChange={e => updateComboItem(idx, 'unit_type', e.target.value)}>
                                        <option value="UND">UND</option>
                                        <option value="PKG">CAJA</option>
                                     </select>
                                     <button type="button" onClick={() => removeComboItem(idx)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                               );
                            })}
                            {(editingCombo.items?.length || 0) === 0 && <div className="text-center text-slate-400 text-xs py-4">Agregue productos al combo</div>}
                         </div>
                      </div>

                      <div className="flex justify-end pt-4">
                         <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded font-bold shadow flex items-center">
                            <Save className="w-4 h-4 mr-2" /> Guardar Combo
                         </button>
                      </div>
                   </form>
                ) : (
                   <div className="h-full flex items-center justify-center text-slate-400">Seleccione o cree un combo</div>
                )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
