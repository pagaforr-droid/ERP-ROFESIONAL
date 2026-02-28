
import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Promotion, Combo, AutoPromotion } from '../types';
import { Tag, Package, Plus, Search, Gift, Edit, Trash2, Zap, BarChart3 } from 'lucide-react';
import { PromoForm } from './promo/PromoForm';
import { ComboForm } from './promo/ComboForm';
import { AutoPromoForm } from './promo/AutoPromoForm';

export const PromoManager: React.FC = () => {
   const { promotions, combos, autoPromotions, addPromotion, updatePromotion, addCombo, updateCombo, addAutoPromotion, updateAutoPromotion } = useStore();
   const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PROMOS' | 'COMBOS' | 'AUTO_PROMOS'>('DASHBOARD');

   const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);
   const [editingCombo, setEditingCombo] = useState<Partial<Combo> | null>(null);
   const [editingAutoPromo, setEditingAutoPromo] = useState<Partial<AutoPromotion> | null>(null);

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

   const handleSaveAutoPromo = (ap: AutoPromotion) => {
      if (editingAutoPromo?.id) updateAutoPromotion(ap);
      else addAutoPromotion(ap);
      closeEditor();
   };

   const closeEditor = () => {
      setEditingPromo(null);
      setEditingCombo(null);
      setEditingAutoPromo(null);
      setIsCreating(false);
   };

   const startCreate = () => {
      setIsCreating(true);
      if (activeTab === 'PROMOS') setEditingPromo({});
      else if (activeTab === 'COMBOS') setEditingCombo({});
      else if (activeTab === 'AUTO_PROMOS') setEditingAutoPromo({});
   };

   const startEditPromo = (p: Promotion) => {
      setEditingPromo(p);
      setIsCreating(true);
   };

   const startEditCombo = (c: Combo) => {
      setEditingCombo(c);
      setIsCreating(true);
   };

   const startEditAutoPromo = (ap: AutoPromotion) => {
      setEditingAutoPromo(ap);
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

   const deleteAutoPromo = (id: string) => {
      if (confirm('¿Desactivar esta bonificación automática?')) {
         const ap = autoPromotions.find(x => x.id === id);
         if (ap) updateAutoPromotion({ ...ap, is_active: false });
      }
   };

   // --- RENDER HELPERS ---
   const filteredPromos = promotions.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
   const filteredCombos = combos.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
   const filteredAutoPromos = autoPromotions.filter(ap => ap.name.toLowerCase().includes(searchTerm.toLowerCase()));

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
            <button onClick={() => { setActiveTab('DASHBOARD'); closeEditor(); }} className={`px-6 py-3 font-bold text-sm border-b-2 ${activeTab === 'DASHBOARD' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
               <BarChart3 className="w-4 h-4 mr-2 inline" /> Dashboard
            </button>
            <button onClick={() => { setActiveTab('PROMOS'); closeEditor(); }} className={`px-6 py-3 font-bold text-sm border-b-2 ${activeTab === 'PROMOS' ? 'border-pink-600 text-pink-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
               <Tag className="w-4 h-4 mr-2 inline" /> Prom. Clásicas
            </button>
            <button onClick={() => { setActiveTab('COMBOS'); closeEditor(); }} className={`px-6 py-3 font-bold text-sm border-b-2 ${activeTab === 'COMBOS' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
               <Package className="w-4 h-4 mr-2 inline" /> Combos
            </button>
            <button onClick={() => { setActiveTab('AUTO_PROMOS'); closeEditor(); }} className={`px-6 py-3 font-bold text-sm border-b-2 ${activeTab === 'AUTO_PROMOS' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
               <Zap className="w-4 h-4 mr-2 inline" /> Prom. Automáticas
            </button>
         </div>

         <div className="flex-1 bg-white rounded-b-lg shadow border border-slate-200 p-6 overflow-hidden flex flex-col">
            {/* TOOLBAR */}
            {activeTab !== 'DASHBOARD' && !isCreating && (
               <div className="flex justify-between mb-4">
                  <div className="relative w-64">
                     <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                     <input
                        className="w-full pl-8 border border-slate-300 p-2 rounded text-sm outline-none focus:ring-1"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                     />
                  </div>
                  <button onClick={startCreate} className="bg-slate-900 text-white px-4 py-2 rounded font-bold text-sm flex items-center hover:bg-slate-800">
                     <Plus className="w-4 h-4 mr-2" /> Nueva {activeTab === 'PROMOS' ? 'Promoción' : activeTab === 'COMBOS' ? 'Combo' : 'Bonificación'}
                  </button>
               </div>
            )}

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-auto">
               {activeTab === 'DASHBOARD' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-6 rounded-xl text-white shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="font-bold text-lg">Promociones Activas</h3>
                           <Tag className="w-8 h-8 opacity-50" />
                        </div>
                        <div className="text-4xl font-bold">{promotions.filter(p => p.is_active).length}</div>
                     </div>
                     <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-xl text-white shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="font-bold text-lg">Combos Activos</h3>
                           <Package className="w-8 h-8 opacity-50" />
                        </div>
                        <div className="text-4xl font-bold">{combos.filter(c => c.is_active).length}</div>
                     </div>
                     <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-xl text-white shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="font-bold text-lg">Bonif. Automáticas Activas</h3>
                           <Zap className="w-8 h-8 opacity-50" />
                        </div>
                        <div className="text-4xl font-bold">{autoPromotions.filter(ap => ap.is_active).length}</div>
                     </div>
                  </div>
               ) : isCreating ? (
                  activeTab === 'PROMOS' ? (
                     <PromoForm initialData={editingPromo} onClose={closeEditor} onSave={handleSavePromo} />
                  ) : activeTab === 'COMBOS' ? (
                     <ComboForm initialData={editingCombo} onClose={closeEditor} onSave={handleSaveCombo} />
                  ) : (
                     <AutoPromoForm initialData={editingAutoPromo} onClose={closeEditor} onSave={handleSaveAutoPromo} />
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
                  ) : activeTab === 'AUTO_PROMOS' ? (
                     // AUTO PROMO LIST
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredAutoPromos.map(ap => (
                           <div key={ap.id} className="border border-green-200 bg-green-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow group">
                              <div className="p-4 border-b border-green-200">
                                 <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-bold text-green-900 flex items-center">
                                       <Zap className="w-4 h-4 mr-1 text-green-600" /> {ap.name}
                                    </h3>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${ap.is_active ? 'bg-green-600 text-white' : 'bg-red-100 text-red-700'}`}>
                                       {ap.is_active ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                 </div>
                                 <p className="text-xs text-green-700 font-medium">{ap.description}</p>
                              </div>
                              <div className="p-4 bg-white text-xs text-slate-600">
                                 <div className="mb-2"><strong>Condición:</strong> {ap.condition_type === 'BUY_X_PRODUCT' ? `Comprar ${ap.condition_amount} und` : ap.condition_type === 'SPEND_Y_TOTAL' ? `Gastar S/${ap.condition_amount}` : `Gastar S/${ap.condition_amount} en Categ`}</div>
                                 <div className="mb-2"><strong>Premio:</strong> {ap.reward_quantity} {ap.reward_unit_type}</div>
                                 <div><strong>Válido:</strong> {ap.start_date} - {ap.end_date}</div>

                                 <div className="flex justify-end gap-2 mt-4">
                                    <button onClick={() => startEditAutoPromo(ap)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => deleteAutoPromo(ap.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : null
               )}
            </div>
         </div>
      </div>
   );
};
