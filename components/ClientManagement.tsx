import React, { useState, useEffect } from 'react';
import { useStore } from '../services/store';
import { Client } from '../types';
import { supabase, USE_MOCK_DB } from '../services/supabase';
import { PERU_CITIES } from '../utils/promoUtils';
import { Search, Save, Plus, ArrowLeft, User, MapPin, Briefcase, FileText, Trash2, RefreshCw } from 'lucide-react';

export const ClientManagement: React.FC = () => {
   const { clients: mockClients, addClient: mockAddClient, updateClient: mockUpdateClient } = useStore();
   
   const [realClients, setRealClients] = useState<Client[]>([]);
   const [realZones, setRealZones] = useState<any[]>([]);
   const [realPriceLists, setRealPriceLists] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [isSaving, setIsSaving] = useState(false);

   useEffect(() => {
     fetchData();
   }, []);

   const fetchData = async () => {
     if (!USE_MOCK_DB) {
       setIsLoading(true);
       try {
         const [clientsRes, zonesRes, plRes] = await Promise.all([
           supabase.from('clients').select('*').order('name'),
           supabase.from('zones').select('*').order('name'),
           supabase.from('price_lists').select('*').order('name')
         ]);
         
         if (clientsRes.data) setRealClients(clientsRes.data as Client[]);
         if (zonesRes.data) setRealZones(zonesRes.data);
         if (plRes.data) setRealPriceLists(plRes.data);
       } catch (err: any) {
         console.error("Error cargando datos de clientes:", err.message);
       } finally {
         setIsLoading(false);
       }
     }
   };

   const clients = USE_MOCK_DB ? mockClients : realClients;
   const zones = USE_MOCK_DB ? useStore.getState().zones : realZones;
   const priceLists = USE_MOCK_DB ? useStore.getState().priceLists : realPriceLists;

   const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>('LIST');
   const [activeTab, setActiveTab] = useState<'MAIN' | 'SECONDARY' | 'BRANCHES'>('MAIN');
   const [searchTerm, setSearchTerm] = useState('');

   const initialFormState: Partial<Client> = {
      code: '',
      doc_type: 'RUC',
      doc_number: '',
      name: '',
      is_person: false,
      address: '',
      ubigeo: '080101', 
      phone: '',
      email: '',
      channel: 'MINORISTA',
      business_type: 'BODEGA',
      zone_id: '',
      price_list_id: '',
      payment_condition: 'CONTADO',
      credit_limit: 0,
      is_active: true,
      is_agent_perception: false,
      is_agent_retention: false,
      apply_igv: true,
      branches: []
   };

   const [formData, setFormData] = useState<Partial<Client>>(initialFormState);
   const [newBranch, setNewBranch] = useState('');

   const filteredClients = clients.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.doc_number.includes(searchTerm) ||
      (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase()))
   );

   const handleEdit = (c: Client) => {
      setFormData({ ...c, branches: c.branches || [] });
      setViewMode('DETAIL');
   };

   const handleNew = () => {
      const nextCode = `CLI-${String(Date.now()).slice(-6)}`;
      setFormData({ ...initialFormState, code: nextCode });
      setViewMode('DETAIL');
   };

   const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      
      try {
         const payload: any = { ...formData };
         if (!payload.zone_id) payload.zone_id = null;
         if (!payload.price_list_id) payload.price_list_id = null;

         if (USE_MOCK_DB) {
            if (formData.id) mockUpdateClient(payload as Client);
            else mockAddClient({ ...payload, id: crypto.randomUUID() } as Client);
            setViewMode('LIST');
         } else {
            if (formData.id) {
               const { data, error } = await supabase.from('clients').update(payload).eq('id', formData.id).select();
               if (error) throw error;
               if (data && data.length > 0) {
                  setRealClients(prev => prev.map(c => c.id === formData.id ? data[0] as Client : c));
               }
            } else {
               const newId = crypto.randomUUID();
               payload.id = newId;
               const { data, error } = await supabase.from('clients').insert([payload]).select();
               if (error) throw error;
               if (data && data.length > 0) {
                  setRealClients(prev => [...prev, data[0] as Client]);
               }
            }
            setViewMode('LIST');
         }
      } catch (err: any) {
         alert("Error guardando cliente: " + err.message);
      } finally {
         setIsSaving(false);
      }
   };

   const getSellerForZone = (zoneId: string) => {
      const zone = zones.find(z => z.id === zoneId);
      return zone ? zone.assigned_seller_id : '---';
   };

   if (viewMode === 'DETAIL') {
      return (
         <div className="flex flex-col h-full bg-slate-100 rounded-lg border border-slate-300 overflow-hidden font-sans text-sm relative">
            <div className="bg-slate-700 text-white p-3 flex justify-between items-center shadow-md z-10">
               <h2 className="font-bold flex items-center">
                  {formData.id ? 'EDITAR CLIENTE' : 'NUEVO CLIENTE'} - <span className="ml-2 font-mono text-blue-300">{formData.code}</span>
               </h2>
               <button onClick={() => !isSaving && setViewMode('LIST')} disabled={isSaving} className="bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded font-bold text-xs border border-slate-500 disabled:opacity-50 transition-colors">
                  <ArrowLeft className="w-4 h-4 mr-1 inline" /> Volver
               </button>
            </div>

            <div className="flex bg-slate-200 border-b border-slate-300 z-10 shadow-sm">
               <button onClick={() => setActiveTab('MAIN')} className={`px-6 py-3 font-bold transition-colors ${activeTab === 'MAIN' ? 'bg-white border-t-4 border-blue-600 text-blue-800' : 'text-slate-600 hover:bg-slate-300 border-t-4 border-transparent'}`}>
                  1. Datos Principales
               </button>
               <button onClick={() => setActiveTab('SECONDARY')} className={`px-6 py-3 font-bold transition-colors ${activeTab === 'SECONDARY' ? 'bg-white border-t-4 border-blue-600 text-blue-800' : 'text-slate-600 hover:bg-slate-300 border-t-4 border-transparent'}`}>
                  2. Datos Secundarios
               </button>
               <button onClick={() => setActiveTab('BRANCHES')} className={`px-6 py-3 font-bold transition-colors ${activeTab === 'BRANCHES' ? 'bg-white border-t-4 border-blue-600 text-blue-800' : 'text-slate-600 hover:bg-slate-300 border-t-4 border-transparent'}`}>
                  3. Sucursales de Entrega
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
               <form id="client-form" onSubmit={handleSave} className="max-w-4xl mx-auto space-y-6 pb-20">
                  {activeTab === 'MAIN' && (
                     <div className="space-y-6 animate-fade-in">
                        <fieldset className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                           <div className="flex items-center gap-6 border-b border-slate-200 pb-4 mb-4">
                              <label className="flex items-center text-slate-800 font-bold cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                                 <input type="checkbox" className="mr-2 h-4 w-4 text-blue-600" checked={formData.is_person} onChange={e => setFormData({ ...formData, is_person: e.target.checked })} />
                                 Persona Natural
                              </label>
                              <div className="flex-1 flex gap-3 items-center justify-end">
                                 <select className="border-2 border-slate-200 p-2 rounded-lg bg-yellow-50 text-slate-900 font-bold focus:border-blue-500 outline-none" value={formData.doc_type} onChange={e => setFormData({ ...formData, doc_type: e.target.value as any })}>
                                    <option value="RUC">RUC</option>
                                    <option value="DNI">DNI</option>
                                    <option value="CE">C.E.</option>
                                 </select>
                                 <div className="flex">
                                    <input required className="border-2 border-slate-200 p-2 rounded-l-lg w-40 font-mono font-bold text-slate-900 focus:border-blue-500 outline-none" placeholder="Número..." value={formData.doc_number} onChange={e => setFormData({ ...formData, doc_number: e.target.value })} />
                                    <button type="button" className="bg-slate-800 hover:bg-slate-700 text-white px-4 rounded-r-lg text-xs font-bold transition-colors">« SUNAT</button>
                                 </div>
                              </div>
                           </div>

                           <div className="space-y-4">
                              <div>
                                 <label className="block text-xs font-bold text-slate-700 mb-1">RAZÓN SOCIAL / NOMBRE COMPLETO *</label>
                                 <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg uppercase font-bold text-slate-900 focus:border-blue-500 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })} />
                              </div>
                              <div>
                                 <label className="block text-xs font-bold text-slate-700 mb-1">DIRECCIÓN FISCAL *</label>
                                 <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg uppercase text-slate-900 focus:border-blue-500 outline-none" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value.toUpperCase() })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">UBIGEO</label>
                                    <input className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 focus:border-blue-500 outline-none font-mono" value={formData.ubigeo} onChange={e => setFormData({ ...formData, ubigeo: e.target.value })} placeholder="Ej. 080101" />
                                 </div>
                                 <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">CIUDAD / DISTRITO</label>
                                    <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg bg-white text-slate-900 focus:border-blue-500 outline-none" value={formData.city || ''} onChange={e => setFormData({ ...formData, city: e.target.value })}>
                                       <option value="">-- Seleccionar --</option>
                                       {PERU_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                 </div>
                              </div>
                           </div>
                        </fieldset>

                        <div className="grid grid-cols-2 gap-6">
                           <fieldset className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                              <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Contacto</h3>
                              <div>
                                 <label className="block text-xs font-bold text-slate-700 mb-1">Persona de Contacto</label>
                                 <input className="w-full border-2 border-slate-200 p-2 rounded-lg uppercase text-slate-900 focus:border-blue-500 outline-none" value={formData.contact_name || ''} onChange={e => setFormData({ ...formData, contact_name: e.target.value.toUpperCase() })} />
                              </div>
                              <div>
                                 <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono / Celular</label>
                                 <input className="w-full border-2 border-slate-200 p-2 rounded-lg text-slate-900 focus:border-blue-500 outline-none font-mono" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                              </div>
                              <div>
                                 <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
                                 <input type="email" className="w-full border-2 border-slate-200 p-2 rounded-lg lowercase text-slate-900 focus:border-blue-500 outline-none" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                              </div>
                           </fieldset>

                           <fieldset className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                              <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Crédito y Facturación</h3>
                              <div>
                                 <label className="block text-xs font-bold text-slate-700 mb-1">Condición de Pago</label>
                                 <select className="w-full border-2 border-slate-200 p-2 rounded-lg bg-yellow-50 text-slate-900 font-bold focus:border-blue-500 outline-none" value={formData.payment_condition} onChange={e => setFormData({ ...formData, payment_condition: e.target.value })}>
                                    <option value="CONTADO">CONTADO</option>
                                    <option value="CREDITO 7 DIAS">CRÉDITO 7 DÍAS</option>
                                    <option value="CREDITO 15 DIAS">CRÉDITO 15 DÍAS</option>
                                    <option value="CREDITO 30 DIAS">CRÉDITO 30 DÍAS</option>
                                 </select>
                              </div>
                              <div>
                                 <label className="block text-xs font-bold text-slate-700 mb-1">Límite de Crédito Aprobado (S/)</label>
                                 <input type="number" className="w-full border-2 border-slate-200 p-2 rounded-lg text-right font-bold text-slate-900 focus:border-blue-500 outline-none" value={formData.credit_limit} onChange={e => setFormData({ ...formData, credit_limit: Number(e.target.value) })} />
                              </div>
                              <div className="space-y-2 pt-2">
                                 <label className="flex items-center font-bold text-slate-700 cursor-pointer">
                                    <input type="checkbox" className="mr-2 h-4 w-4 text-emerald-600 rounded" checked={formData.is_agent_retention} onChange={e => setFormData({ ...formData, is_agent_retention: e.target.checked })} /> Agente de Retención
                                 </label>
                                 <label className="flex items-center font-bold text-slate-700 cursor-pointer">
                                    <input type="checkbox" className="mr-2 h-4 w-4 text-emerald-600 rounded" checked={formData.is_agent_perception} onChange={e => setFormData({ ...formData, is_agent_perception: e.target.checked })} /> Agente de Percepción
                                 </label>
                              </div>
                           </fieldset>
                        </div>
                     </div>
                  )}

                  {activeTab === 'SECONDARY' && (
                     <div className="grid grid-cols-2 gap-6 animate-fade-in">
                        <fieldset className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                           <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Clasificación Comercial</h3>
                           <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Canal de Venta</label>
                              <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 focus:border-blue-500 outline-none" value={formData.channel} onChange={e => setFormData({ ...formData, channel: e.target.value })}>
                                 <option value="MINORISTA">MINORISTA</option>
                                 <option value="MAYORISTA">MAYORISTA</option>
                                 <option value="HORECA">HORECA</option>
                              </select>
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Giro de Negocio</label>
                              <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 focus:border-blue-500 outline-none" value={formData.business_type} onChange={e => setFormData({ ...formData, business_type: e.target.value })}>
                                 <option value="BODEGA">BODEGA / BAZAR</option>
                                 <option value="LICORERIA">LICORERÍA</option>
                                 <option value="RESTAURANTE">RESTAURANTE / BAR</option>
                                 <option value="MINIMARKET">MINIMARKET</option>
                              </select>
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Lista de Precios Asignada</label>
                              <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg bg-blue-50 font-bold text-blue-900 focus:border-blue-500 outline-none" value={formData.price_list_id || ''} onChange={e => setFormData({ ...formData, price_list_id: e.target.value })}>
                                 <option value="">-- PRECIO REGULAR (GENERAL) --</option>
                                 {priceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                              </select>
                           </div>
                        </fieldset>

                        <fieldset className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                           <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Logística y Territorio</h3>
                           <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Zona de Reparto Asignada</label>
                              <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg bg-emerald-50 font-bold text-emerald-900 focus:border-emerald-500 outline-none" value={formData.zone_id || ''} onChange={e => setFormData({ ...formData, zone_id: e.target.value })}>
                                 <option value="">-- CLIENTE SIN ZONA ASIGNADA --</option>
                                 {zones.map(z => <option key={z.id} value={z.id}>{z.code} - {z.name}</option>)}
                              </select>
                              {formData.zone_id && (
                                 <div className="mt-2 text-xs text-emerald-700 font-bold bg-emerald-100 p-2 rounded-lg border border-emerald-200">
                                    Vendedor a cargo: {getSellerForZone(formData.zone_id)}
                                 </div>
                              )}
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Referencia Logística</label>
                              <textarea className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 focus:border-blue-500 outline-none uppercase h-20" placeholder="Ej. A dos cuadras del paradero..." value={formData.reference || ''} onChange={e => setFormData({ ...formData, reference: e.target.value })}></textarea>
                           </div>
                           <div className="flex items-center space-x-6 pt-2">
                              <label className="flex items-center font-bold text-slate-700 cursor-pointer">
                                 <input type="checkbox" className="mr-2 h-4 w-4 text-blue-600 rounded" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} /> Cliente Activo
                              </label>
                              <label className="flex items-center font-bold text-slate-700 cursor-pointer">
                                 <input type="checkbox" className="mr-2 h-4 w-4 text-blue-600 rounded" checked={formData.apply_igv} onChange={e => setFormData({ ...formData, apply_igv: e.target.checked })} /> Afecto a IGV
                              </label>
                           </div>
                        </fieldset>
                     </div>
                  )}

                  {activeTab === 'BRANCHES' && (
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
                        <div className="bg-blue-50 border border-blue-200 p-5 rounded-lg mb-6 shadow-inner">
                           <h3 className="font-bold text-blue-900 mb-2 flex items-center"><MapPin className="w-5 h-5 mr-2" /> Registrar Nueva Sucursal / Local</h3>
                           <p className="text-xs text-blue-700 mb-3">Si este cliente tiene múltiples puntos de entrega, agréguelos aquí para poder seleccionarlos durante el pedido.</p>
                           <div className="flex gap-2">
                              <input
                                 className="flex-1 border-2 border-blue-200 rounded-lg px-4 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-blue-500 uppercase"
                                 placeholder="Ingrese la dirección exacta de entrega..."
                                 value={newBranch}
                                 onChange={e => setNewBranch(e.target.value)}
                                 onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                       e.preventDefault();
                                       if (newBranch.trim()) {
                                          setFormData({ ...formData, branches: [...(formData.branches || []), newBranch.trim().toUpperCase()] });
                                          setNewBranch('');
                                       }
                                    }
                                 }}
                              />
                              <button
                                 type="button"
                                 onClick={() => {
                                    if (newBranch.trim()) {
                                       setFormData({ ...formData, branches: [...(formData.branches || []), newBranch.trim().toUpperCase()] });
                                       setNewBranch('');
                                    }
                                 }}
                                 className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center hover:bg-blue-700 transition-colors shadow-md"
                              >
                                 <Plus className="w-5 h-5 mr-1" /> Añadir
                              </button>
                           </div>
                        </div>

                        <table className="w-full text-left border-collapse">
                           <thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase border-y border-slate-200">
                              <tr>
                                 <th className="p-3 w-16 text-center">#</th>
                                 <th className="p-3 w-full">Dirección de Entrega Registrada</th>
                                 <th className="p-3 text-center">Acción</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {(!formData.branches || formData.branches.length === 0) ? (
                                 <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-medium">Este cliente no tiene sucursales adicionales. Se usará su dirección fiscal.</td></tr>
                              ) : formData.branches.map((branch, index) => (
                                 <tr key={index} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4 font-bold text-slate-400 text-center">{index + 1}</td>
                                    <td className="p-4 text-slate-800 font-bold flex items-center"><MapPin className="w-4 h-4 mr-2 text-slate-300" /> {branch}</td>
                                    <td className="p-4 text-center">
                                       <button
                                          type="button"
                                          onClick={() => {
                                             if (confirm('¿Eliminar esta sucursal de entrega?')) {
                                                const newBranches = [...formData.branches!];
                                                newBranches.splice(index, 1);
                                                setFormData({ ...formData, branches: newBranches });
                                             }
                                          }}
                                          className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                          title="Eliminar Sucursal"
                                       >
                                          <Trash2 className="w-5 h-5" />
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  )}
               </form>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
               <div className="text-xs font-bold text-slate-500">
                 Asegúrese de revisar la Zona y Condición de Pago asignada.
               </div>
               <button type="submit" form="client-form" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-blue-600/30 flex items-center transition-all active:scale-95 disabled:opacity-50">
                 {isSaving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                 {isSaving ? 'GUARDANDO CLIENTE...' : 'GUARDAR CLIENTE'}
               </button>
            </div>
         </div>
      );
   }

   return (
      <div className="space-y-4 h-full flex flex-col">
         <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-black text-slate-800 flex items-center">
               <User className="mr-3 w-6 h-6 text-blue-600" /> Directorio de Clientes
            </h2>
            <div className="flex gap-2">
               <button onClick={fetchData} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg flex items-center transition-colors shadow-sm border border-slate-200" title="Sincronizar DB">
                 <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
               </button>
               <button onClick={handleNew} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg flex items-center shadow-lg hover:bg-black transition-colors font-bold text-sm">
                  <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
               </button>
            </div>
         </div>

         <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex gap-2 bg-slate-50">
               <div className="relative flex-1 max-w-xl">
                  <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                  <input
                     className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg shadow-inner text-slate-900 font-medium focus:border-blue-500 outline-none transition-colors"
                     placeholder="Buscar por Razón Social, RUC o Código CLI..."
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
            </div>
            <div className="flex-1 overflow-auto">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 font-black uppercase tracking-wider text-[10px] shadow-sm z-10">
                     <tr>
                        <th className="p-4 border-b border-slate-200">Código / ID</th>
                        <th className="p-4 border-b border-slate-200">Razón Social y Contacto</th>
                        <th className="p-4 border-b border-slate-200">Ubicación Fiscal</th>
                        <th className="p-4 border-b border-slate-200 text-center">Ruta Comercial</th>
                        <th className="p-4 border-b border-slate-200 text-center">Estado</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {isLoading && realClients.length === 0 ? (
                         <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-bold"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500"/> Sincronizando Clientes...</td></tr>
                     ) : filteredClients.length === 0 ? (
                         <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-bold">No hay clientes que coincidan con la búsqueda.</td></tr>
                     ) : filteredClients.map(c => {
                        const zone = zones.find(z => z.id === c.zone_id);
                        const pl = priceLists.find(p => p.id === c.price_list_id);
                        return (
                           <tr key={c.id} className="hover:bg-blue-50 cursor-pointer transition-colors group" onClick={() => handleEdit(c)}>
                              <td className="p-4">
                                 <div className="font-mono text-slate-900 font-bold">{c.doc_number}</div>
                                 <div className="text-[10px] text-slate-400 font-bold mt-1">{c.code} <span className="bg-slate-200 text-slate-600 px-1 rounded ml-1">{c.doc_type}</span></div>
                              </td>
                              <td className="p-4">
                                 <div className="font-black text-slate-800 text-base">{c.name}</div>
                                 <div className="text-xs text-slate-500 font-medium mt-1 flex items-center"><Briefcase className="w-3 h-3 mr-1" /> {c.business_type} | {c.channel}</div>
                              </td>
                              <td className="p-4">
                                 <div className="text-slate-700 font-medium truncate max-w-[250px]">{c.address}</div>
                                 <div className="text-[10px] text-slate-400 uppercase font-bold mt-1 flex items-center"><MapPin className="w-3 h-3 mr-1"/> {c.city || 'UBIGEO: ' + c.ubigeo}</div>
                              </td>
                              <td className="p-4 text-center">
                                 {zone ? (
                                    <div className="bg-slate-100 border border-slate-200 rounded-lg p-1.5 inline-block">
                                       <div className="font-black text-slate-800">{zone.code}</div>
                                       <div className="text-[9px] text-slate-500 font-bold">{zone.assigned_seller_id}</div>
                                    </div>
                                 ) : <span className="text-xs font-bold text-slate-300 italic">SIN ZONA</span>}
                                 {pl && <div className="mt-1"><span className="bg-green-100 text-green-800 text-[9px] px-2 py-0.5 rounded-full border border-green-200 font-bold">{pl.name}</span></div>}
                              </td>
                              <td className="p-4 text-center">
                                 {c.is_active ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">ACTIVO</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200">INACTIVO</span>}
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
   );
};
