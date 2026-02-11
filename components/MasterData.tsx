import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Users, Truck, Home, Briefcase, Plus, Save } from 'lucide-react';

type MasterType = 'clients' | 'suppliers' | 'warehouses' | 'drivers' | 'transporters';

interface Props {
  type: MasterType;
}

export const MasterData: React.FC<Props> = ({ type }) => {
  const store = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const config = {
    clients: { title: 'Clientes', icon: Users, data: store.clients, add: store.addClient },
    suppliers: { title: 'Proveedores', icon: Briefcase, data: store.suppliers, add: store.addSupplier },
    warehouses: { title: 'Almacenes', icon: Home, data: store.warehouses, add: store.addWarehouse },
    drivers: { title: 'Choferes', icon: Users, data: store.drivers, add: store.addDriver },
    transporters: { title: 'Transportistas', icon: Truck, data: store.transporters, add: store.addTransporter },
  }[type];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    config.add({ ...formData, id: crypto.randomUUID() });
    setIsModalOpen(false);
    setFormData({});
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <config.icon className="mr-2" /> {config.title}
        </h2>
        <button 
          onClick={() => { setFormData({}); setIsModalOpen(true); }}
          className="bg-accent text-white px-4 py-2 rounded flex items-center hover:bg-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" /> Nuevo
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border border-slate-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
            <tr>
              {type === 'clients' && <><th className="p-3">RUC/DNI</th><th className="p-3">Nombre</th><th className="p-3">Dirección</th></>}
              {type === 'suppliers' && <><th className="p-3">RUC</th><th className="p-3">Razón Social</th><th className="p-3">Dirección</th></>}
              {type === 'warehouses' && <><th className="p-3">Nombre</th><th className="p-3">Dirección</th></>}
              {type === 'drivers' && <><th className="p-3">Licencia</th><th className="p-3">Nombre</th><th className="p-3">Teléfono</th></>}
              {type === 'transporters' && <><th className="p-3">RUC</th><th className="p-3">Empresa</th></>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {config.data.map((item: any) => (
              <tr key={item.id} className="hover:bg-slate-50">
                {type === 'clients' && <><td className="p-3 font-mono">{item.ruc}</td><td className="p-3 font-medium">{item.name}</td><td className="p-3 text-slate-500">{item.address}</td></>}
                {type === 'suppliers' && <><td className="p-3 font-mono">{item.ruc}</td><td className="p-3 font-medium">{item.name}</td><td className="p-3 text-slate-500">{item.address}</td></>}
                {type === 'warehouses' && <><td className="p-3 font-medium">{item.name}</td><td className="p-3 text-slate-500">{item.address}</td></>}
                {type === 'drivers' && <><td className="p-3 font-mono">{item.license}</td><td className="p-3 font-medium">{item.name}</td><td className="p-3 text-slate-500">{item.phone}</td></>}
                {type === 'transporters' && <><td className="p-3 font-mono">{item.ruc}</td><td className="p-3 font-medium">{item.name}</td></>}
              </tr>
            ))}
            {config.data.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No hay registros.</td></tr>}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Nuevo {config.title}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              {(type === 'clients' || type === 'suppliers' || type === 'transporters') && (
                <div>
                  <label className="block text-sm text-slate-600">RUC / DNI</label>
                  <input required className="w-full border p-2 rounded" value={formData.ruc || ''} onChange={e => setFormData({...formData, ruc: e.target.value})} />
                </div>
              )}
              {(type === 'drivers') && (
                 <div>
                  <label className="block text-sm text-slate-600">Licencia</label>
                  <input required className="w-full border p-2 rounded" value={formData.license || ''} onChange={e => setFormData({...formData, license: e.target.value})} />
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-600">Nombre / Razón Social</label>
                <input required className="w-full border p-2 rounded" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              {(type !== 'transporters' && type !== 'drivers') && (
                <div>
                  <label className="block text-sm text-slate-600">Dirección</label>
                  <input className="w-full border p-2 rounded" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
              )}
              {(type === 'clients' || type === 'drivers') && (
                <div>
                  <label className="block text-sm text-slate-600">Teléfono</label>
                  <input className="w-full border p-2 rounded" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              )}
              
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};