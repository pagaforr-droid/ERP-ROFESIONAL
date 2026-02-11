
import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Promotion, Combo } from '../types';
import { Tag, Package, Plus, Search, Gift, Edit, Trash2 } from 'lucide-react';
import { PromoForm } from './promo/PromoForm';
import { ComboForm } from './promo/ComboForm';

export const PromoManager: React.FC = () => {
   const { promotions, combos, addPromotion, updatePromotion, addCombo, updateCombo } = useStore();
   const [activeTab, setActiveTab] = useState<'PROMOS' | 'COMBOS'>('PROMOS');

   const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);
   const [editingCombo, setEditingCombo] = useState<Partial<Combo> | null>(null);

   const [isCreating, setIsCreating] = useState(false);
   const [searchTerm, setSearchTerm] = useState('');

   // --- HANDLERS ---
   const handleSavePromo = (promo: Promotion) => {
      if (editingPromo?.id) updatePromotion(promo);
      else addPromotion(promo);
      closeEditor();
   };

   const handleSaveCombo = (combo: Combo) => {
      if (editingCombo?.id) updateCombo(combo);
      else addCombo(combo);
      closeEditor();
   };

   const closeEditor = () => {
      setEditingPromo(null);
      setEditingCombo(null);
      setIsCreating(false);
   };

   const startCreate = () => {
      setIsCreating(true);
      if (activeTab === 'PROMOS') setEditingPromo({});
      else setEditingCombo({});
   };

   const startEditPromo = (p: Promotion) => {
      setEditingPromo(p);
      setIsCreating(true);
   };

   const startEditCombo = (c: Combo) => {
      setEditingCombo(c);
      setIsCreating(true);
   };

   const deletePromo = (id: string) => {
      if (confirm('¿Desactivar esta promoción?')) {
         const p = promotions.find(x => x.id === id);
         if (p) updatePromotion({ ...p, is_active: false });
      }
   };

   const deleteCombo = (id: string) => {
      if (confirm('¿Desactivar este combo?')) {
         const c = combos.find(x => x.id === id);
         if (c) updateCombo({ ...c, is_active: false });
      }
   };

   // --- RENDER HELPERS ---
   const filteredPromos = promotions.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
   const filteredCombos = combos.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

   return (
      <div className="h-full flex flex-col space-y-4">
         {/* HEADER */}
         <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
               <Gift className="mr-2 text-pink-600" /> Gestión de Ofertas y Combos
            </h2>
         </div>

         {/* TABS */}
         <div className="flex bg-white rounded-t-lg border-b border-slate-200">
            <button onClick={() => { setActiveTab('PROMOS'); closeEditor(); }} className={`px-6 py-3 font-bold text-sm border-b-2 ${activeTab === 'PROMOS' ? 'border-pink-600 text-pink-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
               <Tag className="w-4 h-4 mr-2 inline" /> Promociones
            </button>
            <button onClick={() => { setActiveTab('COMBOS'); closeEditor(); }} className={`px-6 py-3 font-bold text-sm border-b-2 ${activeTab === 'COMBOS' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
               <Package className="w-4 h-4 mr-2 inline" /> Combos
            </button>
         </div>

         <div className="flex-1 bg-white rounded-b-lg shadow border border-slate-200 p-6 overflow-hidden flex flex-col">
            {/* TOOLBAR */}
            {!isCreating && (
               <div className="flex justify-between mb-4">
                  <div className="relative w-64">
                     <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                     <input
                        className="w-full pl-8 border border-slate-300 p-2 rounded text-sm outline-none focus:ring-1"
                        placeholder={activeTab === 'PROMOS' ? "Buscar promoción..." : "Buscar combo..."}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                     />
                  </div>
                  <button onClick={startCreate} className="bg-slate-900 text-white px-4 py-2 rounded font-bold text-sm flex items-center hover:bg-slate-800">
                     <Plus className="w-4 h-4 mr-2" /> {activeTab === 'PROMOS' ? 'Nueva Promoción' : 'Nuevo Combo'}
                  </button>
               </div>
            )}

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-auto">
               {isCreating ? (
                  activeTab === 'PROMOS' ? (
                     <PromoForm initialData={editingPromo} onClose={closeEditor} onSave={handleSavePromo} />
                  ) : (
                     <ComboForm initialData={editingCombo} onClose={closeEditor} onSave={handleSaveCombo} />
                  )
               ) : (
                  activeTab === 'PROMOS' ? (
                     // PROMO LIST
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredPromos.map(p => (
                           <div key={p.id} className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow group relative">
                              {p.image_url ? (
                                 <img src={p.image_url} alt={p.name} className="w-full h-32 object-cover" />
                              ) : (
                                 <div className="w-full h-32 bg-slate-100 flex items-center justify-center text-slate-400">
                                    <Tag className="w-8 h-8 opacity-20" />
                                 </div>
                              )}
                              <div className="p-4">
                                 <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-slate-800">{p.name}</h3>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                       {p.is_active ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                 </div>
                                 <div className="text-2xl font-bold text-pink-600 mb-2">
                                    {p.type === 'PERCENTAGE_DISCOUNT' ? `-${p.value}%` : `S/ ${p.value}`}
                                 </div>
                                 <div className="text-xs text-slate-500 mb-4">
                                    <div>Válido: {p.start_date} - {p.end_date}</div>
                                    <div>Productos: {p.product_ids.length}</div>
                                    {p.channels && <div className="mt-1 flex gap-1">
                                       {p.channels.map(c => <span key={c} className="bg-slate-100 px-1 rounded border text-[10px]">{c === 'IN_STORE' ? 'Tienda' : 'App'}</span>)}
                                    </div>}
                                 </div>
                                 <div className="flex justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEditPromo(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => deletePromo(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     // COMBO LIST
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredCombos.map(c => (
                           <div key={c.id} className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow group">
                              {c.image_url ? (
                                 <img src={c.image_url} alt={c.name} className="w-full h-32 object-cover" />
                              ) : (
                                 <div className="w-full h-32 bg-slate-100 flex items-center justify-center text-slate-400">
                                    <Package className="w-8 h-8 opacity-20" />
                                 </div>
                              )}
                              <div className="p-4">
                                 <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-bold text-slate-800">{c.name}</h3>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                       {c.is_active ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                 </div>
                                 <p className="text-xs text-slate-500 line-clamp-2 mb-2">{c.description}</p>

                                 <div className="flex justify-between items-end">
                                    <div className="text-xl font-bold text-purple-700">S/ {c.price.toFixed(2)}</div>
                                    <div className="flex gap-2">
                                       <button onClick={() => startEditCombo(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                                       <button onClick={() => deleteCombo(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )
               )}
            </div>
         </div>
      </div>
   );
};
