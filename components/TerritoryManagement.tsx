import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Seller, Client } from '../types';
import { Map, Users, User, Search, Save, Plus, ArrowRight, Filter, MapPin } from 'lucide-react';

type Tab = 'SELLERS' | 'ZONING';

export const TerritoryManagement: React.FC = () => {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('ZONING');
  
  // Seller State
  const [editingSeller, setEditingSeller] = useState<Partial<Seller> | null>(null);

  // Zoning State
  const [filterName, setFilterName] = useState('');
  const [filterAddress, setFilterAddress] = useState('');
  const [filterZone, setFilterZone] = useState('ALL');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [targetZone, setTargetZone] = useState('');

  // --- SELLERS LOGIC ---
  const handleSaveSeller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeller || !editingSeller.name || !editingSeller.dni) return;
    
    if (editingSeller.id) {
      store.updateSeller(editingSeller as Seller);
    } else {
      store.addSeller({ ...editingSeller, id: crypto.randomUUID(), is_active: true } as Seller);
    }
    setEditingSeller(null);
  };

  // --- ZONING LOGIC ---
  const filteredClients = store.clients.filter(c => {
    const matchesName = c.name.toLowerCase().includes(filterName.toLowerCase()) || c.code.includes(filterName);
    const matchesAddress = c.address.toLowerCase().includes(filterAddress.toLowerCase());
    const matchesZone = filterZone === 'ALL' || 
                        (filterZone === 'UNASSIGNED' ? !c.zone_id : c.zone_id === filterZone);
    return matchesName && matchesAddress && matchesZone;
  });

  const handleToggleClient = (id: string) => {
    setSelectedClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredClients.map(c => c.id));
    }
  };

  const handleBatchAssign = () => {
    if (!targetZone || selectedClients.length === 0) return;
    store.batchUpdateClientZone(selectedClients, targetZone);
    setSelectedClients([]);
    alert(`Se asignaron ${selectedClients.length} clientes a la nueva zona.`);
  };

  // Helper to find seller name from zone
  const getSellerNameForZone = (zoneId: string) => {
    const zone = store.zones.find(z => z.id === zoneId);
    if (!zone) return '---';
    const seller = store.sellers.find(s => s.id === zone.assigned_seller_id);
    return seller ? seller.name : zone.assigned_seller_id; // Fallback for mock strings
  };

  const renderSellersTab = () => (
    <div className="flex gap-6 h-full">
      {/* Left: List */}
      <div className="flex-1 bg-white rounded shadow border border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-slate-700">Listado de Vendedores</h3>
           <button onClick={() => setEditingSeller({})} className="bg-slate-900 text-white px-3 py-1 rounded text-sm flex items-center">
             <Plus className="w-3 h-3 mr-1" /> Nuevo
           </button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
              <tr>
                <th className="p-3">DNI</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">Teléfono</th>
                <th className="p-3">Estado</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {store.sellers.map(seller => (
                <tr key={seller.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-800">{seller.dni}</td>
                  <td className="p-3 font-medium text-slate-900">{seller.name}</td>
                  <td className="p-3 text-slate-600">{seller.phone}</td>
                  <td className="p-3">
                    {seller.is_active 
                      ? <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">Activo</span>
                      : <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">Inactivo</span>
                    }
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditingSeller(seller)} className="text-accent font-bold hover:underline">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Form */}
      {editingSeller && (
        <div className="w-1/3 bg-white p-6 rounded shadow border border-slate-200 h-fit">
          <h3 className="font-bold text-lg mb-4 text-slate-800">
            {editingSeller.id ? 'Editar Vendedor' : 'Nuevo Vendedor'}
          </h3>
          <form onSubmit={handleSaveSeller} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">DNI</label>
              <input required className="w-full border border-slate-300 p-2 rounded text-slate-900" value={editingSeller.dni || ''} onChange={e => setEditingSeller({...editingSeller, dni: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo</label>
              <input required className="w-full border border-slate-300 p-2 rounded text-slate-900" value={editingSeller.name || ''} onChange={e => setEditingSeller({...editingSeller, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dirección</label>
              <input className="w-full border border-slate-300 p-2 rounded text-slate-900" value={editingSeller.address || ''} onChange={e => setEditingSeller({...editingSeller, address: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
              <input className="w-full border border-slate-300 p-2 rounded text-slate-900" value={editingSeller.phone || ''} onChange={e => setEditingSeller({...editingSeller, phone: e.target.value})} />
            </div>
             <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
              <input type="email" className="w-full border border-slate-300 p-2 rounded text-slate-900" value={editingSeller.email || ''} onChange={e => setEditingSeller({...editingSeller, email: e.target.value})} />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setEditingSeller(null)} className="px-4 py-2 text-slate-600 font-medium">Cancelar</button>
              <button type="submit" className="bg-accent text-white px-6 py-2 rounded font-bold shadow-sm hover:bg-blue-700">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  const renderZoningTab = () => (
    <div className="flex gap-4 h-full">
      {/* LEFT: Filter & Select */}
      <div className="flex-1 flex flex-col bg-white rounded shadow border border-slate-200">
        <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3">
           <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-700 flex items-center"><Filter className="w-4 h-4 mr-2"/> Filtros Inteligentes</h3>
              <span className="text-xs font-medium text-slate-500">{filteredClients.length} clientes encontrados</span>
           </div>
           
           <div className="grid grid-cols-3 gap-3">
              <div className="relative">
                 <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                 <input 
                   className="w-full pl-8 border border-slate-300 p-2 rounded text-sm text-slate-900" 
                   placeholder="Buscar Cliente / RUC..." 
                   value={filterName}
                   onChange={e => setFilterName(e.target.value)}
                 />
              </div>
              <div className="relative">
                 <MapPin className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                 <input 
                   className="w-full pl-8 border border-slate-300 p-2 rounded text-sm text-slate-900 font-medium bg-yellow-50 focus:bg-white transition-colors" 
                   placeholder="Dirección (ej. Wanchaq)..." 
                   value={filterAddress}
                   onChange={e => setFilterAddress(e.target.value)}
                 />
              </div>
              <select 
                 className="w-full border border-slate-300 p-2 rounded text-sm text-slate-900"
                 value={filterZone}
                 onChange={e => setFilterZone(e.target.value)}
              >
                 <option value="ALL">Todas las Zonas</option>
                 <option value="UNASSIGNED">-- Sin Zona Asignada --</option>
                 {store.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
           </div>
        </div>

        <div className="flex-1 overflow-auto">
           <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                 <tr>
                    <th className="p-3 w-10">
                      <input type="checkbox" onChange={handleSelectAll} checked={selectedClients.length > 0 && selectedClients.length === filteredClients.length} />
                    </th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Dirección</th>
                    <th className="p-3">Zona Actual</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {filteredClients.map(c => {
                    const zone = store.zones.find(z => z.id === c.zone_id);
                    return (
                      <tr key={c.id} className={`hover:bg-blue-50 cursor-pointer ${selectedClients.includes(c.id) ? 'bg-blue-50' : ''}`} onClick={() => handleToggleClient(c.id)}>
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                           <input type="checkbox" checked={selectedClients.includes(c.id)} onChange={() => handleToggleClient(c.id)} />
                        </td>
                        <td className="p-3">
                           <div className="font-bold text-slate-800">{c.name}</div>
                           <div className="text-xs text-slate-500 font-mono">{c.code}</div>
                        </td>
                        <td className="p-3 text-slate-700">
                           {/* Highlight match */}
                           {filterAddress && c.address.toLowerCase().includes(filterAddress.toLowerCase()) ? (
                              <span>
                                 {c.address.substring(0, c.address.toLowerCase().indexOf(filterAddress.toLowerCase()))}
                                 <span className="bg-yellow-200 font-bold text-slate-900 px-1 rounded">{c.address.substr(c.address.toLowerCase().indexOf(filterAddress.toLowerCase()), filterAddress.length)}</span>
                                 {c.address.substring(c.address.toLowerCase().indexOf(filterAddress.toLowerCase()) + filterAddress.length)}
                              </span>
                           ) : c.address}
                        </td>
                        <td className="p-3">
                           {zone ? <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-bold">{zone.code}</span> : <span className="text-red-400 text-xs italic">Sin Asignar</span>}
                        </td>
                      </tr>
                    );
                 })}
                 {filteredClients.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-400">No se encontraron clientes con los filtros actuales.</td></tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>

      {/* RIGHT: Action Panel */}
      <div className="w-72 bg-slate-800 text-white rounded shadow-lg p-6 flex flex-col space-y-6 h-fit sticky top-4">
         <div>
            <h3 className="font-bold text-lg mb-1">Asignación Masiva</h3>
            <p className="text-slate-400 text-xs">Mueve los clientes seleccionados a una nueva zona y vendedor.</p>
         </div>

         <div className="bg-slate-700 p-4 rounded-lg border border-slate-600">
            <div className="text-2xl font-bold text-accent mb-1">{selectedClients.length}</div>
            <div className="text-xs text-slate-300 uppercase tracking-wide">Clientes Seleccionados</div>
         </div>

         <div className="space-y-4">
            <div>
               <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Zona Destino</label>
               <select 
                  className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm focus:border-accent outline-none"
                  value={targetZone}
                  onChange={e => setTargetZone(e.target.value)}
               >
                  <option value="">-- Seleccionar Zona --</option>
                  {store.zones.map(z => <option key={z.id} value={z.id}>{z.code} - {z.name}</option>)}
               </select>
            </div>

            {targetZone && (
               <div className="p-3 bg-slate-700/50 rounded border border-slate-600/50">
                  <div className="text-xs text-slate-400 mb-1">Vendedor Asignado:</div>
                  <div className="font-bold text-white flex items-center">
                     <User className="w-4 h-4 mr-2 text-accent" />
                     {getSellerNameForZone(targetZone)}
                  </div>
               </div>
            )}
         </div>

         <button 
            disabled={!targetZone || selectedClients.length === 0}
            onClick={handleBatchAssign}
            className="w-full bg-accent hover:bg-blue-500 text-white py-3 rounded font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center transition-all"
         >
            <ArrowRight className="w-5 h-5 mr-2" /> Asignar Zona
         </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <Map className="mr-2" /> Gestión de Territorio
        </h2>
      </div>

      <div className="flex bg-white rounded-t-lg border-b border-slate-200">
         <button 
            className={`px-6 py-3 font-bold text-sm flex items-center ${activeTab === 'ZONING' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('ZONING')}
         >
            <Map className="w-4 h-4 mr-2" /> Asignación de Zonas
         </button>
         <button 
            className={`px-6 py-3 font-bold text-sm flex items-center ${activeTab === 'SELLERS' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('SELLERS')}
         >
            <Users className="w-4 h-4 mr-2" /> Fuerza de Ventas (Vendedores)
         </button>
      </div>

      <div className="flex-1 overflow-hidden">
         {activeTab === 'SELLERS' ? renderSellersTab() : renderZoningTab()}
      </div>
    </div>
  );
};