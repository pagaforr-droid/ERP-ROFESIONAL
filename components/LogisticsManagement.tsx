import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Transporter, Driver, Vehicle } from '../types';
import { Truck, Users, User, Plus, Save, ArrowLeft, Search } from 'lucide-react';

type Tab = 'TRANSPORTISTAS' | 'CHOFERES' | 'VEHICULOS';

export const LogisticsManagement: React.FC = () => {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('VEHICULOS');
  const [viewMode, setViewMode] = useState<'LIST' | 'FORM'>('LIST');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Forms State
  const [transporterForm, setTransporterForm] = useState<Partial<Transporter>>({});
  const [driverForm, setDriverForm] = useState<Partial<Driver>>({});
  const [vehicleForm, setVehicleForm] = useState<Partial<Vehicle>>({});

  const handleNew = () => {
    setEditingId(null);
    setTransporterForm({});
    setDriverForm({});
    setVehicleForm({});
    setViewMode('FORM');
  };

  const handleEdit = (id: string, item: any) => {
    setEditingId(id);
    if (activeTab === 'TRANSPORTISTAS') setTransporterForm(item);
    if (activeTab === 'CHOFERES') setDriverForm(item);
    if (activeTab === 'VEHICULOS') setVehicleForm(item);
    setViewMode('FORM');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'TRANSPORTISTAS') {
       if(!transporterForm.ruc || !transporterForm.name) return;
       const data = { ...transporterForm, id: editingId || crypto.randomUUID() } as Transporter;
       store.addTransporter(data); // In real app, check for update vs add
    } else if (activeTab === 'CHOFERES') {
       if(!driverForm.dni || !driverForm.name) return;
       const data = { ...driverForm, id: editingId || crypto.randomUUID() } as Driver;
       store.addDriver(data);
    } else if (activeTab === 'VEHICULOS') {
       if(!vehicleForm.plate || !vehicleForm.transporter_id || !vehicleForm.driver_id) return;
       const data = { ...vehicleForm, id: editingId || crypto.randomUUID() } as Vehicle;
       if (editingId) store.updateVehicle(data);
       else store.addVehicle(data);
    }
    setViewMode('LIST');
  };

  const renderList = () => {
    if (activeTab === 'TRANSPORTISTAS') {
      return (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-200 text-slate-700 font-bold">
            <tr>
              <th className="p-3">RUC</th>
              <th className="p-3">Razón Social</th>
              <th className="p-3">Certificado MTC</th>
              <th className="p-3">Dirección</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {store.transporters.map(t => (
              <tr key={t.id} className="border-t hover:bg-slate-50">
                <td className="p-3 font-mono text-slate-800">{t.ruc}</td>
                <td className="p-3 font-medium text-slate-900">{t.name}</td>
                <td className="p-3 text-slate-600">{t.certificate_mtc || '-'}</td>
                <td className="p-3 text-slate-600">{t.address}</td>
                <td className="p-3 text-right text-accent cursor-pointer font-medium" onClick={() => handleEdit(t.id, t)}>Editar</td>
              </tr>
            ))}
             {store.transporters.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin registros</td></tr>}
          </tbody>
        </table>
      );
    }
    if (activeTab === 'CHOFERES') {
      return (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-200 text-slate-700 font-bold">
            <tr>
              <th className="p-3">DNI</th>
              <th className="p-3">Nombres</th>
              <th className="p-3">Licencia</th>
              <th className="p-3">Teléfono</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {store.drivers.map(d => (
              <tr key={d.id} className="border-t hover:bg-slate-50">
                <td className="p-3 font-mono text-slate-800">{d.dni}</td>
                <td className="p-3 font-medium text-slate-900">{d.name}</td>
                <td className="p-3 font-mono text-slate-800">{d.license}</td>
                <td className="p-3 text-slate-600">{d.phone}</td>
                <td className="p-3 text-right text-accent cursor-pointer font-medium" onClick={() => handleEdit(d.id, d)}>Editar</td>
              </tr>
            ))}
            {store.drivers.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin registros</td></tr>}
          </tbody>
        </table>
      );
    }
    if (activeTab === 'VEHICULOS') {
      return (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-200 text-slate-700 font-bold">
            <tr>
              <th className="p-3">Placa</th>
              <th className="p-3">Unidad</th>
              <th className="p-3">Transportista</th>
              <th className="p-3">Chofer Actual</th>
              <th className="p-3 text-right">Capacidad</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {store.vehicles.map(v => {
              const trans = store.transporters.find(t => t.id === v.transporter_id);
              const driver = store.drivers.find(d => d.id === v.driver_id);
              return (
                <tr key={v.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold bg-slate-100 text-slate-900">{v.plate}</td>
                  <td className="p-3 text-slate-800">{v.brand} {v.model}</td>
                  <td className="p-3 text-slate-600 text-xs">{trans?.name || 'S/A'}</td>
                  <td className="p-3 text-slate-600 text-xs">{driver?.name || 'S/A'}</td>
                  <td className="p-3 text-right text-slate-800">{v.capacity_kg} Kg</td>
                  <td className="p-3 text-right text-accent cursor-pointer font-medium" onClick={() => handleEdit(v.id, v)}>Editar</td>
                </tr>
              );
            })}
             {store.vehicles.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">Sin registros</td></tr>}
          </tbody>
        </table>
      );
    }
    return null;
  };

  const renderForm = () => {
    return (
       <div className="bg-white p-6 rounded shadow border border-slate-200 max-w-2xl mx-auto">
          <h3 className="font-bold text-lg mb-4 flex items-center text-slate-800">
             {editingId ? 'Editar' : 'Crear'} {activeTab === 'TRANSPORTISTAS' ? 'Transportista' : activeTab === 'CHOFERES' ? 'Chofer' : 'Vehículo'}
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
             {activeTab === 'TRANSPORTISTAS' && (
                <>
                   <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold text-slate-700 mb-1">RUC</label><input required className="w-full border border-slate-300 p-2 rounded text-slate-900" value={transporterForm.ruc || ''} onChange={e => setTransporterForm({...transporterForm, ruc: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold text-slate-700 mb-1">Certificado MTC</label><input className="w-full border border-slate-300 p-2 rounded text-slate-900" value={transporterForm.certificate_mtc || ''} onChange={e => setTransporterForm({...transporterForm, certificate_mtc: e.target.value})} /></div>
                   </div>
                   <div><label className="block text-xs font-bold text-slate-700 mb-1">Razón Social</label><input required className="w-full border border-slate-300 p-2 rounded text-slate-900" value={transporterForm.name || ''} onChange={e => setTransporterForm({...transporterForm, name: e.target.value})} /></div>
                   <div><label className="block text-xs font-bold text-slate-700 mb-1">Dirección</label><input className="w-full border border-slate-300 p-2 rounded text-slate-900" value={transporterForm.address || ''} onChange={e => setTransporterForm({...transporterForm, address: e.target.value})} /></div>
                </>
             )}

             {activeTab === 'CHOFERES' && (
                <>
                   <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold text-slate-700 mb-1">DNI</label><input required className="w-full border border-slate-300 p-2 rounded text-slate-900" value={driverForm.dni || ''} onChange={e => setDriverForm({...driverForm, dni: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold text-slate-700 mb-1">Licencia</label><input required className="w-full border border-slate-300 p-2 rounded text-slate-900" value={driverForm.license || ''} onChange={e => setDriverForm({...driverForm, license: e.target.value})} /></div>
                   </div>
                   <div><label className="block text-xs font-bold text-slate-700 mb-1">Nombres Completos</label><input required className="w-full border border-slate-300 p-2 rounded text-slate-900" value={driverForm.name || ''} onChange={e => setDriverForm({...driverForm, name: e.target.value})} /></div>
                   <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label><input className="w-full border border-slate-300 p-2 rounded text-slate-900" value={driverForm.phone || ''} onChange={e => setDriverForm({...driverForm, phone: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold text-slate-700 mb-1">Dirección</label><input className="w-full border border-slate-300 p-2 rounded text-slate-900" value={driverForm.address || ''} onChange={e => setDriverForm({...driverForm, address: e.target.value})} /></div>
                   </div>
                </>
             )}

             {activeTab === 'VEHICULOS' && (
                <>
                  <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-xs text-yellow-800 mb-4 font-medium">
                     Para registrar un vehículo, primero debe existir el Transportista y el Chofer en el sistema.
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold text-slate-700 mb-1">Placa</label><input required className="w-full border border-slate-300 p-2 rounded bg-slate-100 font-bold text-center text-slate-900" value={vehicleForm.plate || ''} onChange={e => setVehicleForm({...vehicleForm, plate: e.target.value.toUpperCase()})} /></div>
                      <div><label className="block text-xs font-bold text-slate-700 mb-1">Carga Util (Kg)</label><input type="number" className="w-full border border-slate-300 p-2 rounded text-slate-900" value={vehicleForm.capacity_kg || ''} onChange={e => setVehicleForm({...vehicleForm, capacity_kg: Number(e.target.value)})} /></div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold text-slate-700 mb-1">Marca</label><input className="w-full border border-slate-300 p-2 rounded text-slate-900" value={vehicleForm.brand || ''} onChange={e => setVehicleForm({...vehicleForm, brand: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold text-slate-700 mb-1">Modelo</label><input className="w-full border border-slate-300 p-2 rounded text-slate-900" value={vehicleForm.model || ''} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})} /></div>
                   </div>
                   <div className="border-t border-slate-200 pt-4 mt-2 space-y-3">
                      <div>
                         <label className="block text-xs font-bold text-slate-700 mb-1">Empresa de Transporte</label>
                         <select required className="w-full border border-slate-300 p-2 rounded bg-white text-slate-900" value={vehicleForm.transporter_id || ''} onChange={e => setVehicleForm({...vehicleForm, transporter_id: e.target.value})}>
                            <option value="">-- Seleccionar Transportista --</option>
                            {store.transporters.map(t => <option key={t.id} value={t.id}>{t.name} (RUC: {t.ruc})</option>)}
                         </select>
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-700 mb-1">Chofer Asignado</label>
                         <select required className="w-full border border-slate-300 p-2 rounded bg-white text-slate-900" value={vehicleForm.driver_id || ''} onChange={e => setVehicleForm({...vehicleForm, driver_id: e.target.value})}>
                            <option value="">-- Seleccionar Chofer --</option>
                            {store.drivers.map(d => <option key={d.id} value={d.id}>{d.name} (Lic: {d.license})</option>)}
                         </select>
                      </div>
                   </div>
                </>
             )}

             <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 mt-4">
                <button type="button" onClick={() => setViewMode('LIST')} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">Cancelar</button>
                <button type="submit" className="bg-accent text-white px-6 py-2 rounded font-bold shadow-sm hover:bg-blue-700">Guardar</button>
             </div>
          </form>
       </div>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <Truck className="mr-2" /> Gestión Logística (Flota)
        </h2>
        {viewMode === 'LIST' && (
          <button onClick={handleNew} className="bg-slate-900 text-white px-4 py-2 rounded flex items-center hover:bg-slate-800 shadow">
            <Plus className="w-4 h-4 mr-2" /> Nuevo
          </button>
        )}
      </div>

      <div className="flex bg-white rounded-t-lg border-b border-slate-200">
         <button 
            className={`px-6 py-3 font-bold text-sm flex items-center ${activeTab === 'VEHICULOS' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => { setActiveTab('VEHICULOS'); setViewMode('LIST'); }}
         >
            <Truck className="w-4 h-4 mr-2" /> Vehículos
         </button>
         <button 
            className={`px-6 py-3 font-bold text-sm flex items-center ${activeTab === 'TRANSPORTISTAS' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => { setActiveTab('TRANSPORTISTAS'); setViewMode('LIST'); }}
         >
            <Truck className="w-4 h-4 mr-2" /> Transportistas
         </button>
         <button 
            className={`px-6 py-3 font-bold text-sm flex items-center ${activeTab === 'CHOFERES' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => { setActiveTab('CHOFERES'); setViewMode('LIST'); }}
         >
            <User className="w-4 h-4 mr-2" /> Choferes
         </button>
      </div>

      <div className="bg-white p-4 rounded-b-lg shadow border border-t-0 border-slate-200 flex-1 overflow-auto">
         {viewMode === 'LIST' ? renderList() : renderForm()}
      </div>
    </div>
  );
};