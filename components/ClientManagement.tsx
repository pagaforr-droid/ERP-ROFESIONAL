import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Client } from '../types';
import { Search, Save, Plus, ArrowLeft, User, MapPin, Briefcase, FileText } from 'lucide-react';

export const ClientManagement: React.FC = () => {
   const { clients, zones, priceLists, addClient, updateClient } = useStore();
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
      ubigeo: '080108', // Cusco default
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
      apply_igv: true
   };

   const [formData, setFormData] = useState<Partial<Client>>(initialFormState);

   const filteredClients = clients.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.doc_number.includes(searchTerm)
   );

   const handleEdit = (c: Client) => {
      setFormData({ ...c });
      setViewMode('DETAIL');
   };

   const handleNew = () => {
      const nextCode = String(clients.length + 5000).padStart(6, '0');
      setFormData({ ...initialFormState, code: nextCode });
      setViewMode('DETAIL');
   };

   const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      if (formData.id) {
         updateClient(formData as Client);
      } else {
         addClient({ ...formData, id: crypto.randomUUID() } as Client);
      }
      setViewMode('LIST');
   };

   const getSellerForZone = (zoneId: string) => {
      const zone = zones.find(z => z.id === zoneId);
      return zone ? zone.assigned_seller_id : '---';
   };

   if (viewMode === 'DETAIL') {
      return (
         <div className="flex flex-col h-full bg-slate-100 rounded-lg border border-slate-300 overflow-hidden font-sans text-sm">
            {/* Toolbar */}
            <div className="bg-slate-700 text-white p-3 flex justify-between items-center shadow-sm">
               <h2 className="font-bold flex items-center">
                  {formData.id ? 'EDITAR CLIENTE' : 'NUEVO CLIENTE'} - {formData.code}
               </h2>
               <div className="flex gap-2">
                  <button type="button" onClick={handleSave} className="bg-accent hover:bg-blue-500 px-3 py-1 rounded flex items-center border border-blue-400">
                     <Save className="w-4 h-4 mr-1" /> Guardar
                  </button>
                  <button onClick={() => setViewMode('LIST')} className="bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded border border-slate-500">
                     <ArrowLeft className="w-4 h-4 mr-1 inline" /> Salir
                  </button>
               </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-200 border-b border-slate-300">
               <button
                  onClick={() => setActiveTab('MAIN')}
                  className={`px-4 py-3 font-bold ${activeTab === 'MAIN' ? 'bg-white border-t-2 border-blue-600 text-blue-700' : 'text-slate-600 hover:bg-slate-300'}`}
               >
                  Datos Principales
               </button>
               <button
                  onClick={() => setActiveTab('SECONDARY')}
                  className={`px-4 py-3 font-bold ${activeTab === 'SECONDARY' ? 'bg-white border-t-2 border-blue-600 text-blue-700' : 'text-slate-600 hover:bg-slate-300'}`}
               >
                  Datos Secundarios
               </button>
               <button className="px-4 py-3 font-bold text-slate-400 cursor-not-allowed">Sucursales</button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
               <form className="max-w-5xl mx-auto space-y-4">

                  {/* --- TAB: MAIN DATA --- */}
                  {activeTab === 'MAIN' && (
                     <div className="space-y-4">
                        {/* Identity Header */}
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
                           <label className="flex items-center text-slate-800 font-bold">
                              <input type="checkbox" className="mr-2 h-4 w-4" checked={formData.is_person} onChange={e => setFormData({ ...formData, is_person: e.target.checked })} />
                              Persona Natural
                           </label>
                           <div className="flex-1 flex gap-2 items-center">
                              <label className="font-bold w-20 text-right text-slate-700">Tipo Iden.</label>
                              <select className="border border-slate-300 p-2 rounded bg-yellow-50 text-slate-900" value={formData.doc_type} onChange={e => setFormData({ ...formData, doc_type: e.target.value as any })}>
                                 <option value="RUC">RUC</option>
                                 <option value="DNI">DNI</option>
                              </select>
                              <label className="font-bold ml-4 text-slate-700">Num. Iden.</label>
                              <div className="flex">
                                 <input className="border border-slate-300 p-2 rounded-l w-32 font-bold text-slate-900" value={formData.doc_number} onChange={e => setFormData({ ...formData, doc_number: e.target.value })} />
                                 <button type="button" className="bg-slate-200 px-3 border border-slate-300 border-l-0 rounded-r text-xs font-bold text-slate-600">« SUNAT</button>
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <label className="font-bold text-slate-700">Código</label>
                              <input className="border border-slate-300 p-2 rounded w-24 bg-white text-center text-slate-900 font-mono" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
                           </div>
                        </div>

                        {/* Primary Info */}
                        <div className="grid grid-cols-12 gap-y-4 gap-x-4">
                           <div className="col-span-12 flex items-center">
                              <label className="w-24 font-bold text-slate-700">Raz. Soc.</label>
                              <input className="flex-1 border border-slate-300 p-2 rounded uppercase text-slate-900" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                           </div>

                           <div className="col-span-12 flex items-center">
                              <label className="w-24 font-bold text-slate-700">Ubigeo</label>
                              <div className="flex-1 flex gap-2">
                                 <div className="relative w-32">
                                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                                    <input className="w-full border border-slate-300 p-2 pl-8 rounded bg-slate-50 text-slate-900" value={formData.ubigeo} onChange={e => setFormData({ ...formData, ubigeo: e.target.value })} />
                                 </div>
                                 <input className="flex-1 border border-slate-300 p-2 rounded bg-slate-100 text-slate-700" value="CUSCO - CUSCO - WANCHAQ" readOnly />
                              </div>
                           </div>

                           <div className="col-span-12 flex items-center">
                              <label className="w-24 font-bold text-slate-700">Dirección</label>
                              <input className="flex-1 border border-slate-300 p-2 rounded uppercase text-slate-900" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                           </div>

                           <div className="col-span-12 flex items-center">
                              <label className="w-24 font-bold text-slate-700">Referencia</label>
                              <input className="flex-1 border border-slate-300 p-2 rounded uppercase text-slate-900" value={formData.reference || ''} onChange={e => setFormData({ ...formData, reference: e.target.value })} />
                              <div className="ml-4 flex gap-4">
                                 <label className="flex items-center text-slate-700 font-medium"><input type="checkbox" className="mr-1" checked={formData.is_agent_retention} onChange={e => setFormData({ ...formData, is_agent_retention: e.target.checked })} /> Agente Retención</label>
                                 <label className="flex items-center text-slate-700 font-medium"><input type="checkbox" className="mr-1" checked={formData.is_agent_perception} onChange={e => setFormData({ ...formData, is_agent_perception: e.target.checked })} /> Agente Percepción</label>
                              </div>
                           </div>

                           <div className="col-span-6 flex items-center">
                              <label className="w-24 font-bold text-slate-700">Teléfono</label>
                              <input className="flex-1 border border-slate-300 p-2 rounded text-slate-900" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                           </div>

                           <div className="col-span-6 flex items-center">
                              <label className="w-24 font-bold text-slate-700">Lim. Cred.</label>
                              <input type="number" className="flex-1 border border-slate-300 p-2 rounded text-right text-slate-900" value={formData.credit_limit} onChange={e => setFormData({ ...formData, credit_limit: Number(e.target.value) })} />
                           </div>

                           <div className="col-span-12 flex items-center">
                              <label className="w-24 font-bold text-slate-700">Email</label>
                              <input className="flex-1 border border-slate-300 p-2 rounded lowercase text-slate-900" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                           </div>

                           <div className="col-span-12 flex items-center">
                              <label className="w-24 font-bold text-slate-700">Contacto</label>
                              <input className="flex-1 border border-slate-300 p-2 rounded uppercase text-slate-900" value={formData.contact_name || ''} onChange={e => setFormData({ ...formData, contact_name: e.target.value })} />
                           </div>
                        </div>
                     </div>
                  )}

                  {/* --- TAB: SECONDARY DATA --- */}
                  {activeTab === 'SECONDARY' && (
                     <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-6 space-y-4">
                           <div className="flex items-center">
                              <label className="w-24 font-bold text-slate-700">Canal</label>
                              <select className="flex-1 border border-slate-300 p-2 rounded bg-yellow-50 text-slate-900" value={formData.channel} onChange={e => setFormData({ ...formData, channel: e.target.value })}>
                                 <option value="MINORISTA">MINORISTA</option>
                                 <option value="MAYORISTA">MAYORISTA</option>
                              </select>
                           </div>
                           <div className="flex items-center">
                              <label className="w-24 font-bold text-slate-700">Giro</label>
                              <select className="flex-1 border border-slate-300 p-2 rounded bg-yellow-50 text-slate-900" value={formData.business_type} onChange={e => setFormData({ ...formData, business_type: e.target.value })}>
                                 <option value="BODEGA">BODEGA</option>
                                 <option value="LICORERIA">LICORERIA</option>
                                 <option value="RESTAURANTE">RESTAURANTE</option>
                              </select>
                           </div>
                           <div className="flex items-center">
                              <label className="w-24 font-bold text-slate-700">Zona</label>
                              <div className="flex-1 flex gap-2">
                                 <select className="flex-1 border border-slate-300 p-2 rounded bg-slate-50 text-slate-900" value={formData.zone_id} onChange={e => setFormData({ ...formData, zone_id: e.target.value })}>
                                    <option value="">-- Seleccionar Zona --</option>
                                    {zones.map(z => <option key={z.id} value={z.id}>{z.code} - {z.name}</option>)}
                                 </select>
                              </div>
                           </div>
                           {formData.zone_id && (
                              <div className="flex items-center">
                                 <label className="w-24"></label>
                                 <div className="text-xs text-blue-700 font-bold bg-blue-50 p-2 rounded w-full border border-blue-200">
                                    Vendedor Asignado: {getSellerForZone(formData.zone_id || '')}
                                 </div>
                              </div>
                           )}
                           <div className="flex items-center">
                              <label className="w-24 font-bold text-slate-700">F. Pago</label>
                              <select className="flex-1 border border-slate-300 p-2 rounded bg-yellow-50 text-slate-900" value={formData.payment_condition} onChange={e => setFormData({ ...formData, payment_condition: e.target.value })}>
                                 <option value="CONTADO">CONTADO</option>
                                 <option value="CREDITO 7 DIAS">CREDITO 7 DIAS</option>
                                 <option value="CREDITO 15 DIAS">CREDITO 15 DIAS</option>
                              </select>
                           </div>
                        </div>

                        <div className="col-span-6 space-y-4">
                           <div className="border border-slate-300 rounded p-3 bg-slate-50">
                              <label className="block text-xs font-bold mb-2 text-slate-700">Obs Cliente</label>
                              <textarea className="w-full border border-slate-300 p-2 h-20 rounded text-slate-900" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}></textarea>
                           </div>

                           <div className="space-y-3 pt-2">
                              <label className="flex items-center font-bold text-slate-800">
                                 <input type="checkbox" className="mr-2 h-4 w-4 text-blue-600" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                                 Activo
                              </label>
                              <label className="flex items-center font-medium text-slate-700">
                                 <input type="checkbox" className="mr-2 h-4 w-4" checked={formData.apply_igv} onChange={e => setFormData({ ...formData, apply_igv: e.target.checked })} />
                                 Afecto a IGV ?
                              </label>
                           </div>

                           <div className="border-t border-slate-200 pt-4 mt-4">
                              <label className="flex items-center font-bold text-slate-800 mb-2">
                                 <input type="checkbox" className="mr-2 h-4 w-4" checked={!!formData.price_list_id} readOnly />
                                 Trabajar con Lista de Precio para Este Cliente
                              </label>
                              <select className="w-full border border-slate-300 p-2 rounded bg-white shadow-sm text-slate-900" value={formData.price_list_id} onChange={e => setFormData({ ...formData, price_list_id: e.target.value })}>
                                 <option value="">-- Lista Predeterminada --</option>
                                 {priceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                              </select>
                              <p className="text-xs text-slate-500 mt-1 italic">
                                 Esta lista se seleccionará automáticamente al crear un pedido.
                              </p>
                           </div>
                        </div>
                     </div>
                  )}
               </form>
            </div>
         </div>
      );
   }

   // LIST VIEW
   return (
      <div className="space-y-4 h-full flex flex-col">
         <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
               <User className="mr-2" /> Maestro de Clientes
            </h2>
            <button onClick={handleNew} className="bg-slate-900 text-white px-4 py-2 rounded flex items-center hover:bg-slate-800">
               <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
            </button>
         </div>

         <div className="bg-white rounded shadow border border-slate-200 flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex gap-2 bg-slate-50">
               <div className="relative flex-1 max-w-lg">
                  <Search className="absolute left-2 top-2.5 text-slate-400 w-4 h-4" />
                  <input
                     className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded shadow-sm text-slate-900"
                     placeholder="Buscar por Razón Social o RUC..."
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
            </div>
            <div className="flex-1 overflow-auto">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-200 text-slate-700 sticky top-0 font-bold">
                     <tr>
                        <th className="p-3">Código</th>
                        <th className="p-3">Doc. Identidad</th>
                        <th className="p-3">Razón Social</th>
                        <th className="p-3">Dirección</th>
                        <th className="p-3">Zona / Vendedor</th>
                        <th className="p-3">Lista Precio</th>
                        <th className="p-3 text-center">Estado</th>
                        <th className="p-3"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {filteredClients.map(c => {
                        const zone = zones.find(z => z.id === c.zone_id);
                        const pl = priceLists.find(p => p.id === c.price_list_id);
                        return (
                           <tr key={c.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => handleEdit(c)}>
                              <td className="p-3 font-mono text-slate-600">{c.code}</td>
                              <td className="p-3 font-mono text-slate-800">
                                 <span className="text-xs bg-slate-200 px-1 rounded mr-1 font-bold">{c.doc_type}</span>
                                 {c.doc_number}
                              </td>
                              <td className="p-3 font-bold text-slate-800">{c.name}</td>
                              <td className="p-3 text-slate-600 text-xs truncate max-w-[200px]">{c.address}</td>
                              <td className="p-3 text-xs">
                                 {zone ? (
                                    <div>
                                       <span className="font-bold text-slate-800">{zone.code}</span>
                                       <div className="text-slate-600">{zone.assigned_seller_id}</div>
                                    </div>
                                 ) : <span className="text-slate-300">--</span>}
                              </td>
                              <td className="p-3">
                                 {pl ? <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full border border-green-200 font-bold">{pl.name}</span> : <span className="text-slate-400 text-xs">General</span>}
                              </td>
                              <td className="p-3 text-center">
                                 {c.is_active ? <span className="text-green-600 font-bold text-xs">ACTIVO</span> : <span className="text-red-500 text-xs font-bold">INACTIVO</span>}
                              </td>
                              <td className="p-3 text-right text-accent font-medium">Editar</td>
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