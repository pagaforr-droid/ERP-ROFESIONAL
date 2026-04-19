import React, { useState, useEffect } from 'react';

import { useStore } from '../services/store';

import { Promotion, Combo, AutoPromotion } from '../types';

import { Tag, Package, Plus, Search, Gift, Edit, Trash2, Zap, BarChart3, RefreshCw, Calendar } from 'lucide-react';

import { PromoForm } from './promo/PromoForm';

import { ComboForm } from './promo/ComboForm';

import { AutoPromoForm } from './promo/AutoPromoForm';

import { isPromoCurrentlyActive } from '../utils/promoUtils';

import { supabase, USE_MOCK_DB } from '../services/supabase';



export const PromoManager: React.FC = () => {

   const store = useStore();

   const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PROMOS' | 'COMBOS' | 'AUTO_PROMOS'>('DASHBOARD');



   const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);

   const [editingCombo, setEditingCombo] = useState<Partial<Combo> | null>(null);

   const [editingAutoPromo, setEditingAutoPromo] = useState<Partial<AutoPromotion> | null>(null);



   const [isCreating, setIsCreating] = useState(false);

   const [searchTerm, setSearchTerm] = useState('');

   

   // --- ESTADOS SUPABASE ---

   const [dbPromotions, setDbPromotions] = useState<Promotion[]>([]);

   const [dbCombos, setDbCombos] = useState<Combo[]>([]);

   const [dbAutoPromos, setDbAutoPromos] = useState<AutoPromotion[]>([]);

   const [isLoading, setIsLoading] = useState(false);



   // --- CARGA INICIAL DE DATOS ---

   useEffect(() => {

     fetchPromoData();

   }, []);



   const fetchPromoData = async () => {

      if (!USE_MOCK_DB) {

         setIsLoading(true);

         try {

            const [pRes, cRes, apRes] = await Promise.all([

               supabase.from('promotions').select('*').order('name'),

               supabase.from('combos').select('*').order('name'),

               supabase.from('auto_promotions').select('*').order('name')

            ]);

            if (pRes.data) setDbPromotions(pRes.data as Promotion[]);

            if (cRes.data) setDbCombos(cRes.data as Combo[]);

            if (apRes.data) setDbAutoPromos(apRes.data as AutoPromotion[]);

         } catch (error) {

            console.error("Error sincronizando promociones:", error);

         } finally {

            setIsLoading(false);

         }

      }

   };



   // Selector de fuente de datos (Nube o Local)

   const promotions = USE_MOCK_DB ? store.promotions : dbPromotions;

   const combos = USE_MOCK_DB ? store.combos : dbCombos;

   const autoPromotions = USE_MOCK_DB ? store.autoPromotions : dbAutoPromos;



   // --- HANDLERS (SUPABASE INYECTADO Y BLINDADO) ---

   const handleSavePromo = async (promo: Promotion) => {

      if (USE_MOCK_DB) {

         if (editingPromo?.id) store.updatePromotion(promo);

         else store.addPromotion(promo);

         closeEditor();

      } else {

         try {

            const payload = { ...promo };

            if (!payload.id) delete payload.id; // Supabase generará el UUID



            if (editingPromo?.id) {

               const { error } = await supabase.from('promotions').update(payload).eq('id', editingPromo.id);

               if (error) throw error;

            } else {

               const { data, error } = await supabase.from('promotions').insert([payload]).select();

               if (error) throw error;

               if (!data || data.length === 0) throw new Error("Bloqueo de seguridad (RLS). No se guardó en Supabase.");

            }

            fetchPromoData();

            closeEditor();

         } catch (err: any) { alert("Error DB Promoción: " + err.message); }

      }

   };



   const handleSaveCombo = async (combo: Combo) => {

      if (USE_MOCK_DB) {

         if (editingCombo?.id) store.updateCombo(combo);

         else store.addCombo(combo);

         closeEditor();

      } else {

         try {

            const payload = { ...combo };

            if (!payload.id) delete payload.id;



            if (editingCombo?.id) {

               const { error } = await supabase.from('combos').update(payload).eq('id', editingCombo.id);

               if (error) throw error;

            } else {

               const { data, error } = await supabase.from('combos').insert([payload]).select();

               if (error) throw error;

               if (!data || data.length === 0) throw new Error("Bloqueo de seguridad (RLS). No se guardó en Supabase.");

            }

            fetchPromoData();

            closeEditor();

         } catch (err: any) { alert("Error DB Combo: " + err.message); }

      }

   };



   const handleSaveAutoPromo = async (ap: AutoPromotion) => {

      if (USE_MOCK_DB) {

         if (editingAutoPromo?.id) store.updateAutoPromotion(ap);

         else store.addAutoPromotion(ap);

         closeEditor();

      } else {

         try {

            const payload: any = { ...ap };

            if (!payload.id) delete payload.id;

            

            // 1. Limpieza de campos vacíos a null

            if (payload.condition_product_id === '') payload.condition_product_id = null;

            if (payload.condition_supplier_id === '') payload.condition_supplier_id = null;

            if (payload.reward_product_id === '') payload.reward_product_id = null;



            // 2. ESCUDO VALIDADOR DE UUIDs (Evita que viajen datos "p1", "p2", etc.)

            const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

            

            if (payload.condition_product_id && !isUUID(payload.condition_product_id)) {

               throw new Error(`El producto condición seleccionado es de prueba (ID: ${payload.condition_product_id}). Seleccione un producto real de la base de datos.`);

            }

            if (payload.reward_product_id && !isUUID(payload.reward_product_id)) {

               throw new Error(`El producto premio seleccionado es de prueba (ID: ${payload.reward_product_id}). Seleccione un producto real de la base de datos.`);

            }

            if (payload.condition_supplier_id && !isUUID(payload.condition_supplier_id)) {

               throw new Error(`El proveedor seleccionado es de prueba. Seleccione un proveedor real de la base de datos.`);

            }



            // 3. Blindaje Numérico

            payload.condition_amount = Number(payload.condition_amount) || 0;

            payload.reward_quantity = Number(payload.reward_quantity) || 0;



            if (editingAutoPromo?.id) {

               const { error } = await supabase.from('auto_promotions').update(payload).eq('id', editingAutoPromo.id);

               if (error) throw error;

            } else {

               const { data, error } = await supabase.from('auto_promotions').insert([payload]).select();

               if (error) throw error;

               if (!data || data.length === 0) throw new Error("Bloqueo de seguridad (RLS) en la tabla auto_promotions.");

            }

            fetchPromoData();

            closeEditor();

         } catch (err: any) { 

            alert("Error DB Bonificación: " + err.message); 

         }

      }

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



   const startEditPromo = (p: Promotion) => { setEditingPromo(p); setIsCreating(true); };

   const startEditCombo = (c: Combo) => { setEditingCombo(c); setIsCreating(true); };

   const startEditAutoPromo = (ap: AutoPromotion) => { setEditingAutoPromo(ap); setIsCreating(true); };



   const deletePromo = async (id: string) => {

      if (window.confirm('¿Está seguro de desactivar esta promoción? (Dejará de aplicarse)')) {

         if (USE_MOCK_DB) {

            const p = promotions.find(x => x.id === id);

            if (p) store.updatePromotion({ ...p, is_active: false });

         } else {

            await supabase.from('promotions').update({ is_active: false }).eq('id', id);

            fetchPromoData();

         }

      }

   };



   const deleteCombo = async (id: string) => {

      if (window.confirm('¿Está seguro de desactivar este combo? (Dejará de ofrecerse en ventas)')) {

         if (USE_MOCK_DB) {

            const c = combos.find(x => x.id === id);

            if (c) store.updateCombo({ ...c, is_active: false });

         } else {

            await supabase.from('combos').update({ is_active: false }).eq('id', id);

            fetchPromoData();

         }

      }

   };



   const deleteAutoPromo = async (id: string) => {

      if (window.confirm('¿Está seguro de desactivar esta bonificación automática?')) {

         if (USE_MOCK_DB) {

            const ap = autoPromotions.find(x => x.id === id);

            if (ap) store.updateAutoPromotion({ ...ap, is_active: false });

         } else {

            await supabase.from('auto_promotions').update({ is_active: false }).eq('id', id);

            fetchPromoData();

         }

      }

   };



   // --- RENDER HELPERS (BLINDADOS) ---

   const filteredPromos = (promotions || []).filter(p => (p?.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

   const filteredCombos = (combos || []).filter(c => (c?.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

   const filteredAutoPromos = (autoPromotions || []).filter(ap => (ap?.name || '').toLowerCase().includes(searchTerm.toLowerCase()));



   return (

      <div className="h-full flex flex-col space-y-4">

         {/* HEADER */}

         <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">

            <h2 className="text-xl font-bold text-slate-800 flex items-center">

               <Gift className="mr-3 w-6 h-6 text-pink-600" /> Centro de Ofertas y Bonificaciones

            </h2>

            <button onClick={fetchPromoData} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm border border-slate-200 font-bold text-sm">

               <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin text-pink-600' : ''}`} /> Sincronizar

            </button>

         </div>



         {/* TABS */}

         <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-1">

            <button onClick={() => { setActiveTab('DASHBOARD'); closeEditor(); }} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'DASHBOARD' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>

               <BarChart3 className="w-4 h-4 mr-2" /> Panel de Ofertas

            </button>

            <button onClick={() => { setActiveTab('PROMOS'); closeEditor(); }} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'PROMOS' ? 'bg-pink-50 text-pink-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>

               <Tag className="w-4 h-4 mr-2" /> Prom. Clásicas

            </button>

            <button onClick={() => { setActiveTab('COMBOS'); closeEditor(); }} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'COMBOS' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>

               <Package className="w-4 h-4 mr-2" /> Combos Armados

            </button>

            <button onClick={() => { setActiveTab('AUTO_PROMOS'); closeEditor(); }} className={`flex-1 py-3 text-sm font-black flex items-center justify-center rounded-lg transition-all ${activeTab === 'AUTO_PROMOS' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>

               <Zap className="w-4 h-4 mr-2" /> Bonif. Automáticas

            </button>

         </div>



         <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden flex flex-col relative">

            

            {/* SPINNER CENTRAL PARA CARGA INICIAL */}

            {isLoading && activeTab !== 'DASHBOARD' && !isCreating && filteredPromos.length === 0 && filteredCombos.length === 0 && filteredAutoPromos.length === 0 && (

               <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-20 backdrop-blur-sm">

                  <RefreshCw className="w-12 h-12 text-pink-500 animate-spin mb-4" />

                  <p className="font-bold text-slate-500">Cargando motores de promoción...</p>

               </div>

            )}



            {/* TOOLBAR */}

            {activeTab !== 'DASHBOARD' && !isCreating && (

               <div className="flex justify-between items-end mb-6">

                  <div className="relative w-72">

                     <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Buscar por Nombre</label>

                     <Search className="absolute left-3 top-8 w-4 h-4 text-slate-400" />

                     <input

                        className="w-full pl-10 border-2 border-slate-200 p-2.5 rounded-lg text-sm font-bold focus:border-pink-500 outline-none transition-colors"

                        placeholder="Ej. Liquidación, 2x1..."

                        value={searchTerm}

                        onChange={e => setSearchTerm(e.target.value)}

                     />

                  </div>

                  <button onClick={startCreate} className={`text-white px-6 py-2.5 rounded-lg font-black shadow-md flex items-center transition-all active:scale-95 text-sm ${activeTab === 'PROMOS' ? 'bg-pink-600 hover:bg-pink-700' : activeTab === 'COMBOS' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`}>

                     <Plus className="w-5 h-5 mr-1" /> Nuevo {activeTab === 'PROMOS' ? 'Descuento' : activeTab === 'COMBOS' ? 'Combo' : 'Motor (Auto)'}

                  </button>

               </div>

            )}



            {/* MAIN CONTENT */}

            <div className="flex-1 overflow-auto">

               {activeTab === 'DASHBOARD' ? (

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">

                     <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">

                        <Tag className="w-32 h-32 absolute -right-6 -top-6 opacity-10" />

                        <h3 className="font-black text-sm uppercase tracking-widest text-pink-100 mb-2">Promociones Clásicas</h3>

                        <div className="text-6xl font-black tracking-tighter">{(promotions || []).filter(p => isPromoCurrentlyActive(p)).length}</div>

                        <p className="text-xs font-medium mt-4 text-pink-100">Descuentos fijos o porcentuales activos.</p>

                     </div>

                     <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">

                        <Package className="w-32 h-32 absolute -right-6 -top-6 opacity-10" />

                        <h3 className="font-black text-sm uppercase tracking-widest text-indigo-100 mb-2">Combos Armados</h3>

                        <div className="text-6xl font-black tracking-tighter">{(combos || []).filter(c => isPromoCurrentlyActive(c)).length}</div>

                        <p className="text-xs font-medium mt-4 text-indigo-100">Packs de productos con precio especial.</p>

                     </div>

                     <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">

                        <Zap className="w-32 h-32 absolute -right-6 -top-6 opacity-10" />

                        <h3 className="font-black text-sm uppercase tracking-widest text-emerald-100 mb-2">Bonif. Automáticas</h3>

                        <div className="text-6xl font-black tracking-tighter">{(autoPromotions || []).filter(ap => isPromoCurrentlyActive(ap)).length}</div>

                        <p className="text-xs font-medium mt-4 text-emerald-100">Reglas de premios automáticos activas.</p>

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

                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pr-2">

                        {filteredPromos.map(p => (

                           <div key={p.id} className="border-2 border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all group relative bg-white flex flex-col">

                              {p.image_url ? (

                                 <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover" />

                              ) : (

                                 <div className="w-full h-24 bg-pink-50 flex items-center justify-center text-pink-300 border-b border-slate-100">

                                    <Tag className="w-8 h-8 opacity-50" />

                                 </div>

                              )}

                              <div className="p-5 flex-1 flex flex-col">

                                  <div className="flex justify-between items-start mb-2">

                                     <h3 className="font-black text-slate-800 text-lg leading-tight line-clamp-2 pr-2">{p.name}</h3>

                                     <span className={`text-[9px] font-black px-2 py-1 rounded border shadow-sm shrink-0 ${isPromoCurrentlyActive(p) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>

                                        {isPromoCurrentlyActive(p) ? 'ACTIVO' : 'INACTIVO'}

                                     </span>

                                  </div>

                                 <div className="text-3xl font-black text-pink-600 mb-4">

                                    {p.type === 'PERCENTAGE_DISCOUNT' ? `-${p.value}%` : `S/ ${p.value}`}

                                 </div>

                                  <div className="text-xs font-bold text-slate-500 space-y-1 flex-1">

                                     <div className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {p.start_date} al {p.end_date}</div>

                                     <div className="flex items-center"><Package className="w-3 h-3 mr-1" /> Afecta a {p.product_ids?.length || 0} productos</div>

                                     {(p.channels || []).length > 0 && (

                                       <div className="mt-2 flex gap-1 flex-wrap pt-2">

                                        {p.channels.map(c => <span key={c} className="bg-slate-100 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase">{c === 'IN_STORE' ? 'Tienda' : c === 'SELLER_APP' ? 'App' : 'Directa'}</span>)}

                                       </div>

                                     )}

                                  </div>

                                 <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">

                                    <button onClick={() => startEditPromo(p)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit className="w-5 h-5" /></button>

                                    <button onClick={() => deletePromo(p.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>

                                 </div>

                              </div>

                           </div>

                        ))}

                        {filteredPromos.length === 0 && !isLoading && (

                           <div className="col-span-full py-12 text-center font-bold text-slate-400">No hay promociones creadas.</div>

                        )}

                     </div>

                  ) : activeTab === 'COMBOS' ? (

                     // COMBO LIST

                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pr-2">

                        {filteredCombos.map(c => (

                           <div key={c.id} className="border-2 border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all group relative bg-white flex flex-col">

                              {c.image_url ? (

                                 <img src={c.image_url} alt={c.name} className="w-full h-36 object-cover" />

                              ) : (

                                 <div className="w-full h-24 bg-purple-50 flex items-center justify-center text-purple-300 border-b border-slate-100">

                                    <Package className="w-8 h-8 opacity-50" />

                                 </div>

                              )}

                              <div className="p-5 flex-1 flex flex-col">

                                  <div className="flex justify-between items-start mb-2">

                                     <h3 className="font-black text-slate-800 text-lg leading-tight line-clamp-2 pr-2">{c.name}</h3>

                                     <span className={`text-[9px] font-black px-2 py-1 rounded border shadow-sm shrink-0 ${isPromoCurrentlyActive(c) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>

                                        {isPromoCurrentlyActive(c) ? 'ACTIVO' : 'INACTIVO'}

                                     </span>

                                  </div>

                                 <div className="text-3xl font-black text-purple-600 mb-4">

                                    S/ {(c.price || 0).toFixed(2)}

                                 </div>

                                  <div className="text-xs font-bold text-slate-500 space-y-1 flex-1">

                                     <div className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {c.start_date} al {c.end_date}</div>

                                     <div className="flex items-center"><Package className="w-3 h-3 mr-1" /> Contiene {(c.items || []).length} items</div>

                                     {(c.channels || []).length > 0 && (

                                       <div className="mt-2 flex gap-1 flex-wrap pt-2">

                                        {c.channels.map(ch => <span key={ch} className="bg-slate-100 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase">{ch === 'IN_STORE' ? 'Tienda' : ch === 'SELLER_APP' ? 'App' : 'Directa'}</span>)}

                                       </div>

                                     )}

                                  </div>

                                 <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">

                                    <button onClick={() => startEditCombo(c)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit className="w-5 h-5" /></button>

                                    <button onClick={() => deleteCombo(c.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>

                                 </div>

                              </div>

                           </div>

                        ))}

                        {filteredCombos.length === 0 && !isLoading && (

                           <div className="col-span-full py-12 text-center font-bold text-slate-400">No hay combos armados.</div>

                        )}

                     </div>

                  ) : activeTab === 'AUTO_PROMOS' ? (

                     // AUTO PROMO LIST

                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pr-2">

                        {filteredAutoPromos.map(ap => (

                           <div key={ap.id} className="border-2 border-green-200 bg-green-50 rounded-2xl overflow-hidden hover:shadow-xl transition-all group flex flex-col">

                              <div className="p-5 border-b border-green-200 bg-white">

                                  <div className="flex justify-between items-start mb-2">

                                     <h3 className="font-black text-green-800 text-lg flex items-center leading-tight pr-2">

                                        <Zap className="w-5 h-5 mr-2 text-green-500 shrink-0" /> {ap.name}

                                     </h3>

                                     <span className={`text-[9px] font-black px-2 py-1 rounded border shadow-sm shrink-0 ${isPromoCurrentlyActive(ap) ? 'bg-green-600 text-white border-green-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>

                                        {isPromoCurrentlyActive(ap) ? 'ACTIVO' : 'INACTIVO'}

                                     </span>

                                  </div>

                                 <p className="text-xs text-green-700 font-bold">{ap.description}</p>

                              </div>

                              <div className="p-5 bg-green-50/50 flex-1 flex flex-col">

                                  <div className="space-y-3 flex-1">

                                     <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">

                                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Gatillo (Condición)</span>

                                        <span className="font-bold text-sm text-slate-800">

                                           {ap.condition_type === 'BUY_X_PRODUCT' ? `Comprar ${ap.condition_amount} Und` : ap.condition_type === 'SPEND_Y_TOTAL' ? `Gastar S/ ${ap.condition_amount}` : `Gastar S/ ${ap.condition_amount} en Categoría`}

                                        </span>

                                     </div>

                                     <div className="bg-green-600 p-3 rounded-lg shadow-sm text-white">

                                        <span className="block text-[9px] font-black text-green-200 uppercase tracking-widest mb-1">Premio Automático</span>

                                        <span className="font-black text-sm flex items-center">

                                           <Gift className="w-4 h-4 mr-2" /> {ap.reward_quantity} {ap.reward_unit_type || 'Und'} GRATIS

                                        </span>

                                     </div>

                                     <div className="flex items-center text-xs font-bold text-slate-500 mt-4">

                                        <Calendar className="w-3 h-3 mr-2" /> Válido: {ap.start_date} al {ap.end_date}

                                     </div>

                                  </div>

                                 <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-green-200/50">

                                    <button onClick={() => startEditAutoPromo(ap)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit className="w-5 h-5" /></button>

                                    <button onClick={() => deleteAutoPromo(ap.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>

                                 </div>

                              </div>

                           </div>

                        ))}

                        {filteredAutoPromos.length === 0 && !isLoading && (

                           <div className="col-span-full py-12 text-center font-bold text-slate-400">No hay bonificaciones automáticas.</div>

                        )}

                     </div>

                  ) : null

               )}

            </div>

         </div>

      </div>

   );

};
