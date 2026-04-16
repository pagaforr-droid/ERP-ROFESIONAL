import React, { useState, useEffect } from 'react';
import { useStore } from '../services/store';
import { Seller, Client } from '../types';
import { supabase, USE_MOCK_DB } from '../services/supabase';
import { Map, Users, User, Search, Save, Plus, ArrowRight, Filter, MapPin, RefreshCw, Briefcase, Map as MapIcon, Edit, Trash2 } from 'lucide-react';

type Tab = 'ZONES' | 'SELLERS' | 'ZONING';

export const TerritoryManagement: React.FC = () => {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('ZONES');
  
  const [realSellers, setRealSellers] = useState<Seller[]>([]);
  const [realClients, setRealClients] = useState<Client[]>([]);
  const [realZones, setRealZones] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    fetchTerritoryData();
  }, []);

  const fetchTerritoryData = async () => {
    if (!USE_MOCK_DB) {
      setIsLoading(true);
      try {
         const [sData, cData, zData] = await Promise.all([
            supabase.from('sellers').select('*').order('name'),
            supabase.from('clients').select('*').order('name'),
            supabase.from('zones').select('*').order('code')
         ]);
         
         if (sData.data) setRealSellers(sData.data as Seller[]);
         if (cData.data) setRealClients(cData.data as Client[]);
         if (zData.data) setRealZones(zData.data);
      } catch (err: any) {
         console.error("Error cargando territorio:", err.message);
      } finally {
         setIsLoading(false);
      }
    }
  };

  const sellers = USE_MOCK_DB ? store.sellers : realSellers;
  const clients = USE_MOCK_DB ? store.clients : realClients;
  const zones = USE_MOCK_DB ? store.zones : realZones;

  // States for Modals
  const [editingSeller, setEditingSeller] = useState<Partial<Seller> | null>(null);
  const [editingZone, setEditingZone] = useState<Partial<any> | null>(null);

  // Zoning State
  const [filterName, setFilterName] = useState('');
  const [filterAddress, setFilterAddress] = useState('');
  const [filterZone, setFilterZone] = useState('ALL');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [targetZone, setTargetZone] = useState('');

  // ==========================================
  // 1. LÓGICA DE ZONAS / RUTAS (¡LO NUEVO!)
  // ==========================================
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone || !editingZone.code || !editingZone.name) return;
    setIsSaving(true);
    
    try {
       if (USE_MOCK_DB) {
          // Si usas MOCK, tendrías que tener addZone en tu store, lo simulamos:
          alert("Añadido a memoria local (Mock)");
          setEditingZone(null);
       } else {
          const payload = { ...editingZone };
          if (editingZone.id) {
             const { data, error } = await supabase.from('zones').update(payload).eq('id', editingZone.id).select();
             if (error) throw error;
             if (data && data.length > 0) setRealZones(prev => prev.map(z => z.id === editingZone.id ? data[0] : z));
          } else {
             const newId = crypto.randomUUID();
             payload.id = newId;
             const { data, error } = await supabase.from('zones').insert([payload]).select();
             if (error) throw error;
             if (data && data.length > 0) setRealZones(prev => [...prev, data[0]]);
          }
          setEditingZone(null);
       }
    } catch (error: any) {
       alert("Error guardando Zona: " + error.message);
    } finally {
       setIsSaving(false);
    }
  };

  const handleDeleteZone = async (id: string) => {
     if(!confirm('¿Estás seguro de eliminar esta Zona? Solo se puede si no tiene clientes asignados.')) return;
     try {
        const { error } = await supabase.from('zones').delete().eq('id', id);
        if (error) throw error;
        setRealZones(prev => prev.filter(z => z.id !== id));
     } catch(e: any) {
        alert("No se puede eliminar la zona. Probablemente aún hay clientes asignados a ella.");
     }
  };

  const renderZonesTab = () => (
    <div className="flex gap-6 h-full animate-fade-in">
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
           <h3 className="font-black text-slate-800 flex items-center"><MapIcon className="w-5 h-5 mr-2 text-blue-600"/> Zonas y Rutas de Reparto</h3>
           <button onClick={() => setEditingZone({})} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center shadow-md hover:bg-black transition-colors">
             <Plus className="w-4 h-4 mr-1" /> Crear Nueva Zona
           </button>
        </div>
        <div className="overflow-auto flex-1 p-2">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-black uppercase text-xs tracking-wider sticky top-0 rounded-lg shadow-sm">
              <tr>
                <th className="p-4 rounded-tl-lg w-32 text-center">Código</th>
                <th className="p-4">Nombre de la Zona / Ruta</th>
                <th className="p-4">Vendedor Responsable</th>
                <th className="p-4 text-center">Total Clientes</th>
                <th className="p-4 rounded-tr-lg text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && zones.length === 0 ? (
                 <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-bold"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2"/> Cargando Zonas...</td></tr>
              ) : zones.length === 0 ? (
                 <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-bold">No hay zonas configuradas. Crea la primera.</td></tr>
              ) : zones.map(zone => {
                 const seller = sellers.find(s => s.id === zone.assigned_seller_id);
                 const clientCount = clients.filter(c => c.zone_id === zone.id).length;
                 return (
                    <tr key={zone.id} className="hover:bg-blue-50 transition-colors group">
                      <td className="p-4 font-mono font-black text-slate-700 text-center">
                         <span className="bg-slate-200 px-2 py-1 rounded border border-slate-300">{zone.code}</span>
                      </td>
                      <td className="p-4 font-bold text-slate-900 uppercase">{zone.name}</td>
                      <td className="p-4">
                         {seller ? (
                            <div className="font-bold text-blue-700 flex items-center"><User className="w-4 h-4 mr-1"/> {seller.name}</div>
                         ) : (
                            <span className="text-red-500 font-bold text-xs italic">SIN VENDEDOR ASIGNADO</span>
                         )}
                      </td>
                      <td className="p-4 text-center font-black text-slate-600">{clientCount}</td>
                      <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setEditingZone(zone)} className="text-blue-600 p-2 hover:bg-blue-100 rounded-lg mr-1"><Edit className="w-4 h-4"/></button>
                         <button onClick={() => handleDeleteZone(zone.id)} className="text-red-500 p-2 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                      </td>
                    </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingZone && (
        <div className="w-1/3 bg-white rounded-xl shadow-lg border border-slate-200 h-fit overflow-hidden animate-fade-in">
          <div className="bg-slate-900 p-4 text-white">
             <h3 className="font-bold text-lg flex items-center">
               <MapIcon className="w-5 h-5 mr-2"/> {editingZone.id ? 'Editar Zona' : 'Crear Zona'}
             </h3>
          </div>
          <form onSubmit={handleSaveZone} className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Código de Ruta *</label>
              <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 font-mono font-bold focus:border-blue-500 outline-none transition-colors" placeholder="Ej. R-01" value={editingZone.code || ''} onChange={e => setEditingZone({...editingZone, code: e.target.value.toUpperCase()})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Nombre de la Zona *</label>
              <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 font-bold uppercase focus:border-blue-500 outline-none transition-colors" placeholder="Ej. SUR WANCHAQ" value={editingZone.name || ''} onChange={e => setEditingZone({...editingZone, name: e.target.value.toUpperCase()})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Vendedor Titular Asignado</label>
              <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 font-bold bg-slate-50 focus:border-blue-500 outline-none transition-colors" value={editingZone.assigned_seller_id || ''} onChange={e => setEditingZone({...editingZone, assigned_seller_id: e.target.value})}>
                 <option value="">-- Seleccionar Vendedor --</option>
                 {sellers.filter(s => s.is_active).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                 ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <button type="button" onClick={() => setEditingZone(null)} disabled={isSaving} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isSaving} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-blue-700 flex items-center transition-colors disabled:opacity-50">
                {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  // ==========================================
  // 2. LÓGICA DE VENDEDORES
  // ==========================================
  const handleSaveSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeller || !editingSeller.name || !editingSeller.dni) return;
    setIsSaving(true);
    
    try {
       if (USE_MOCK_DB) {
         if (editingSeller.id) store.updateSeller(editingSeller as Seller);
         else store.addSeller({ ...editingSeller, id: crypto.randomUUID(), is_active: true } as Seller);
         setEditingSeller(null);
       } else {
         const payload = { ...editingSeller };
         if (editingSeller.id) {
            const { data, error } = await supabase.from('sellers').update(payload).eq('id', editingSeller.id).select();
            if (error) throw error;
            if (data && data.length > 0) setRealSellers(prev => prev.map(s => s.id === editingSeller.id ? data[0] as Seller : s));
         } else {
            const newId = crypto.randomUUID();
            payload.id = newId;
            payload.is_active = true;
            const { data, error } = await supabase.from('sellers').insert([payload]).select();
            if (error) throw error;
            if (data && data.length > 0) setRealSellers(prev => [...prev, data[0] as Seller]);
         }
         setEditingSeller(null);
       }
    } catch (error: any) {
      alert("Error guardando vendedor: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderSellersTab = () => (
    <div className="flex gap-6 h-full animate-fade-in">
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
           <h3 className="font-black text-slate-800 flex items-center"><Users className="w-5 h-5 mr-2 text-blue-600"/> Padrón de Fuerza de Ventas</h3>
           <button onClick={() => setEditingSeller({})} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center shadow-md hover:bg-black transition-colors">
             <Plus className="w-4 h-4 mr-1" /> Registrar Vendedor
           </button>
        </div>
        <div className="overflow-auto flex-1 p-2">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-black uppercase text-xs tracking-wider sticky top-0 rounded-lg">
              <tr>
                <th className="p-4 rounded-tl-lg">Documento</th>
                <th className="p-4">Nombres y Apellidos</th>
                <th className="p-4">Datos de Contacto</th>
                <th className="p-4 text-center">Estado Operativo</th>
                <th className="p-4 rounded-tr-lg text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && sellers.length === 0 ? (
                 <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-bold"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2"/> Sincronizando...</td></tr>
              ) : sellers.map(seller => (
                <tr key={seller.id} className="hover:bg-blue-50 transition-colors group">
                  <td className="p-4 font-mono font-bold text-slate-700">{seller.dni}</td>
                  <td className="p-4 font-black text-slate-900">{seller.name}</td>
                  <td className="p-4">
                     <div className="font-bold text-slate-700">{seller.phone || '-'}</div>
                     <div className="text-[10px] text-slate-400">{seller.email || 'Sin correo'}</div>
                  </td>
                  <td className="p-4 text-center">
                    {seller.is_active 
                      ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold text-[10px] uppercase border border-green-200">Activo</span>
                      : <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-[10px] uppercase border border-red-200">Inactivo</span>
                    }
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => setEditingSeller(seller)} className="text-blue-600 p-2 hover:bg-blue-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Edit className="w-4 h-4"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingSeller && (
        <div className="w-1/3 bg-white rounded-xl shadow-lg border border-slate-200 h-fit overflow-hidden animate-fade-in">
          <div className="bg-slate-900 p-4 text-white">
             <h3 className="font-bold text-lg flex items-center">
               <Briefcase className="w-5 h-5 mr-2"/> {editingSeller.id ? 'Ficha de Vendedor' : 'Alta de Vendedor'}
             </h3>
          </div>
          <form onSubmit={handleSaveSeller} className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Documento DNI/CE *</label>
              <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 font-mono font-bold focus:border-blue-500 outline-none transition-colors" value={editingSeller.dni || ''} onChange={e => setEditingSeller({...editingSeller, dni: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Nombres y Apellidos *</label>
              <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 font-bold uppercase focus:border-blue-500 outline-none transition-colors" value={editingSeller.name || ''} onChange={e => setEditingSeller({...editingSeller, name: e.target.value.toUpperCase()})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Dirección de Domicilio</label>
              <input className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 uppercase focus:border-blue-500 outline-none transition-colors" value={editingSeller.address || ''} onChange={e => setEditingSeller({...editingSeller, address: e.target.value.toUpperCase()})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Teléfono Movil</label>
                 <input className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 font-mono focus:border-blue-500 outline-none transition-colors" value={editingSeller.phone || ''} onChange={e => setEditingSeller({...editingSeller, phone: e.target.value})} />
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Estado</label>
                 <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-slate-900 font-bold bg-slate-50 focus:border-blue-500 outline-none transition-colors" value={editingSeller.is_active ? '1' : '0'} onChange={e => setEditingSeller({...editingSeller, is_active: e.target.value === '1'})}>
                    <option value="1">ACTIVO</option>
                    <option value="0">INACTIVO</option>
                 </select>
               </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <button type="button" onClick={() => setEditingSeller(null)} disabled={isSaving} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isSaving} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-blue-700 flex items-center transition-colors disabled:opacity-50">
                {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  // ==========================================
  // 3. LÓGICA DE ASIGNACIÓN MASIVA (ZONING)
  // ==========================================
  const filteredClients = clients.filter(c => {
    const matchesName = c.name.toLowerCase().includes(filterName.toLowerCase()) || (c.code && c.code.toLowerCase().includes(filterName.toLowerCase()));
    const matchesAddress = c.address.toLowerCase().includes(filterAddress.toLowerCase());
    const matchesZone = filterZone === 'ALL' || (filterZone === 'UNASSIGNED' ? !c.zone_id : c.zone_id === filterZone);
    return matchesName && matchesAddress && matchesZone;
  });

  const handleToggleClient = (id: string) => {
    setSelectedClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) setSelectedClients([]);
    else setSelectedClients(filteredClients.map(c => c.id));
  };

  const handleBatchAssign = async () => {
    if (!targetZone || selectedClients.length === 0) return;
    setIsAssigning(true);
    
    try {
       if (USE_MOCK_DB) {
          alert("Asignado en local");
       } else {
          const { data, error } = await supabase.from('clients').update({ zone_id: targetZone }).in('id', selectedClients).select('id, zone_id');
          if (error) throw error;
          if (data) setRealClients(prev => prev.map(c => selectedClients.includes(c.id) ? { ...c, zone_id: targetZone } : c));
       }
       alert(`✅ Operación Exitosa.\nSe asignaron ${selectedClients.length} clientes a su nueva ruta comercial.`);
       setSelectedClients([]);
    } catch (e: any) {
       alert('Error asignando zonas en BD: ' + e.message);
    } finally {
       setIsAssigning(false);
    }
  };

  const getSellerNameForZone = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return '---';
    const seller = sellers.find(s => s.id === zone.assigned_seller_id);
    return seller ? seller.name : 'Sin Asignar'; 
  };

  const renderZoningTab = () => (
    <div className="flex gap-6 h-full animate-fade-in">
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50 space-y-4">
           <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-800 flex items-center text-lg"><Filter className="w-5 h-5 mr-2 text-blue-600"/> Centro de Ruteo Inteligente</h3>
              <span className="text-xs font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">{filteredClients.length} Puntos de Entrega Visibles</span>
           </div>
           
           <div className="grid grid-cols-3 gap-4">
              <div className="relative">
                 <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                 <input className="w-full pl-10 border-2 border-slate-200 p-2.5 rounded-lg text-sm text-slate-900 font-bold shadow-inner focus:border-blue-500 outline-none transition-colors" placeholder="Filtrar Cliente o RUC..." value={filterName} onChange={e => setFilterName(e.target.value)} />
              </div>
              <div className="relative">
                 <MapPin className="absolute left-3 top-3 w-5 h-5 text-amber-500" />
                 <input className="w-full pl-10 border-2 border-slate-200 p-2.5 rounded-lg text-sm text-slate-900 font-bold bg-amber-50 focus:bg-white focus:border-amber-500 outline-none transition-colors" placeholder="Localidad (Ej. Wanchaq)..." value={filterAddress} onChange={e => setFilterAddress(e.target.value)} />
              </div>
              <select className="w-full border-2 border-slate-200 p-2.5 rounded-lg text-sm text-slate-900 font-bold bg-slate-50 focus:border-blue-500 outline-none transition-colors" value={filterZone} onChange={e => setFilterZone(e.target.value)}>
                 <option value="ALL">Mostrar Toda la Región</option>
                 <option value="UNASSIGNED">🔴 ALERTA: Clientes Sin Ruta Asignada</option>
                 <optgroup label="Zonas Específicas">
                    {zones.map(z => <option key={z.id} value={z.id}>Ruta {z.code} - {z.name}</option>)}
                 </optgroup>
              </select>
           </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
           <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-sm">
                 <tr>
                    <th className="p-4 w-12 text-center"><input type="checkbox" className="w-4 h-4 rounded border-slate-300 cursor-pointer" onChange={handleSelectAll} checked={selectedClients.length > 0 && selectedClients.length === filteredClients.length} /></th>
                    <th className="p-4">Razón Social del Cliente</th>
                    <th className="p-4">Dirección de Entrega Geográfica</th>
                    <th className="p-4">Zona y Vendedor Asignado</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {isLoading && clients.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-slate-500 font-bold"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500"/> Sincronizando Territorios...</td></tr>
                 ) : filteredClients.map(c => {
                    const zone = zones.find(z => z.id === c.zone_id);
                    const isSelected = selectedClients.includes(c.id);
                    return (
                      <tr key={c.id} className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : ''}`} onClick={() => handleToggleClient(c.id)}>
                        <td className="p-4 text-center border-l-4 border-transparent data-[selected=true]:border-blue-600" data-selected={isSelected} onClick={e => e.stopPropagation()}>
                           <input type="checkbox" className="w-4 h-4 rounded border-slate-300 cursor-pointer" checked={isSelected} onChange={() => handleToggleClient(c.id)} />
                        </td>
                        <td className="p-4">
                           <div className="font-black text-slate-900 text-base">{c.name}</div>
                           <div className="text-[10px] text-slate-400 font-mono font-bold mt-1 uppercase">Doc: {c.doc_number || c.code}</div>
                        </td>
                        <td className="p-4 text-slate-700 font-medium">{c.address}</td>
                        <td className="p-4">
                           {zone ? (
                              <div className="bg-slate-100 border border-slate-200 rounded-lg p-2 inline-block">
                                 <div className="font-black text-slate-800">Ruta: {zone.code}</div>
                                 <div className="text-[10px] text-blue-700 font-bold mt-0.5">{getSellerNameForZone(zone.id)}</div>
                              </div>
                           ) : <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black border border-red-200 shadow-sm animate-pulse">¡ALERTA! SIN RUTA</span>}
                        </td>
                      </tr>
                    );
                 })}
              </tbody>
           </table>
        </div>
      </div>

      <div className="w-80 bg-slate-900 text-white rounded-xl shadow-2xl p-6 flex flex-col h-fit sticky top-4 border border-slate-800">
         <div className="mb-6">
            <h3 className="font-black text-xl mb-1 text-white flex items-center"><Map className="w-5 h-5 mr-2 text-blue-400"/> Consola de Mando</h3>
            <p className="text-slate-400 text-xs font-medium">Transfiere los puntos de venta seleccionados a un nuevo escuadrón logístico.</p>
         </div>

         <div className={`p-5 rounded-xl border transition-all duration-300 ${selectedClients.length > 0 ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-800 border-slate-700'}`}>
            <div className="text-4xl font-black text-white mb-1 tracking-tighter">{selectedClients.length}</div>
            <div className="text-[10px] text-blue-300 uppercase font-black tracking-widest">Puntos en Memoria Activa</div>
         </div>

         <div className="space-y-5 mt-6 flex-1">
            <div>
               <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Sector Geográfico Destino</label>
               <select className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg p-3 text-white text-sm font-bold focus:border-blue-500 outline-none transition-colors" value={targetZone} onChange={e => setTargetZone(e.target.value)}>
                  <option value="">-- Seleccionar Base --</option>
                  {zones.map(z => <option key={z.id} value={z.id}>[ {z.code} ] - {z.name}</option>)}
               </select>
            </div>
            {targetZone && (
               <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 shadow-inner animate-fade-in">
                  <div className="text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-wider">Agente Táctico Responsable:</div>
                  <div className="font-black text-emerald-400 flex items-center text-sm"><User className="w-4 h-4 mr-2" />{getSellerNameForZone(targetZone)}</div>
               </div>
            )}
         </div>

         <div className="pt-6 mt-6 border-t border-slate-800">
            <button disabled={!targetZone || selectedClients.length === 0 || isAssigning} onClick={handleBatchAssign} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-black shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center transition-all active:scale-95 uppercase tracking-wide text-sm">
               {isAssigning ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <ArrowRight className="w-5 h-5 mr-2" />} {isAssigning ? 'Transfiriendo...' : 'Ejecutar Traspaso'}
            </button>
         </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-black text-slate-800 flex items-center">
          <Map className="mr-3 w-6 h-6 text-blue-600" /> Planificación de Territorios
        </h2>
        <button onClick={fetchTerritoryData} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm border border-slate-200 font-bold text-sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin text-blue-600' : ''}`} /> Sincronizar Mapas
        </button>
      </div>

      {/* LOS 3 PILARES: ZONAS | VENDEDORES | ASIGNACIÓN */}
      <div className="flex bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-1">
         <button className={`flex-1 py-3 font-black text-sm flex items-center justify-center rounded-lg transition-all ${activeTab === 'ZONES' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setActiveTab('ZONES')}>
            <MapIcon className="w-4 h-4 mr-2" /> 1. Creación de Zonas y Rutas
         </button>
         <button className={`flex-1 py-3 font-black text-sm flex items-center justify-center rounded-lg transition-all ${activeTab === 'SELLERS' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setActiveTab('SELLERS')}>
            <Users className="w-4 h-4 mr-2" /> 2. Control de Vendedores
         </button>
         <button className={`flex-1 py-3 font-black text-sm flex items-center justify-center rounded-lg transition-all ${activeTab === 'ZONING' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setActiveTab('ZONING')}>
            <Map className="w-4 h-4 mr-2" /> 3. Asignación Masiva
         </button>
      </div>

      <div className="flex-1 overflow-hidden">
         {activeTab === 'ZONES' && renderZonesTab()}
         {activeTab === 'SELLERS' && renderSellersTab()}
         {activeTab === 'ZONING' && renderZoningTab()}
      </div>
    </div>
  );
};
