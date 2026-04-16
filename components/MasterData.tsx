import React, { useState, useEffect } from 'react';
import { useStore } from '../services/store';
import { supabase, USE_MOCK_DB } from '../services/supabase';
import { Users, Truck, Home, Briefcase, Plus, Save, Search, Edit, Trash2, RefreshCw, X } from 'lucide-react';

type MasterType = 'clients' | 'suppliers' | 'warehouses' | 'drivers' | 'transporters';

interface Props {
  type: MasterType;
}

export const MasterData: React.FC<Props> = ({ type }) => {
  const store = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const [realData, setRealData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --- CONFIGURACIÓN DINÁMICA DE LA VISTA ---
  const config = {
    clients: { title: 'Directorio de Clientes', icon: Users, data: store.clients, add: store.addClient },
    suppliers: { title: 'Directorio de Proveedores', icon: Briefcase, data: store.suppliers, add: store.addSupplier },
    warehouses: { title: 'Locales y Almacenes', icon: Home, data: store.warehouses, add: store.addWarehouse },
    drivers: { title: 'Registro de Choferes', icon: Users, data: store.drivers, add: store.addDriver },
    transporters: { title: 'Empresas de Transporte', icon: Truck, data: store.transporters, add: store.addTransporter },
  }[type];

  // --- SINCRONIZACIÓN CON SUPABASE ---
  useEffect(() => {
    fetchData();
  }, [type]);

  const fetchData = async () => {
    if (!USE_MOCK_DB) {
       setIsLoading(true);
       try {
          const { data, error } = await supabase.from(type).select('*').order('name');
          if (error) throw error;
          if (data) setRealData(data);
       } catch (err: any) {
          console.error(`Error cargando ${type}:`, err.message);
       } finally {
          setIsLoading(false);
       }
    }
  };

  const renderedData = USE_MOCK_DB ? config.data : realData;

  const filteredData = renderedData.filter((item: any) => {
     const searchStr = `${item.name} ${item.doc_number || ''} ${item.ruc || ''} ${item.license || ''}`.toLowerCase();
     return searchStr.includes(searchTerm.toLowerCase());
  });

  // --- ACCIONES DE INTERFAZ ---
  const handleNew = () => {
    setEditingId(null);
    setFormData({});
    setIsModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    // Transformación inversa (De DB a UI)
    setFormData({
       ...item,
       ruc: item.doc_number || item.ruc || '', // Retrocompatibilidad visual
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
     if (!confirm(`¿Está seguro de eliminar este registro del módulo ${config.title}?`)) return;
     
     if (USE_MOCK_DB) {
        alert("Eliminación simulada (Solo local).");
     } else {
        setIsLoading(true);
        try {
           const { error } = await supabase.from(type).delete().eq('id', id);
           if (error) throw error;
           setRealData(prev => prev.filter(item => item.id !== id));
        } catch (err: any) {
           alert("No se puede eliminar porque está siendo usado en otros registros (Ej. Ventas o Pedidos).");
        } finally {
           setIsLoading(false);
        }
     }
  };

  // --- MAPEO INTELIGENTE Y GUARDADO ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
       // 1. Mapear datos de la UI a la estructura estricta de la Base de Datos
       const payload: any = {
          name: (formData.name || '').toUpperCase(),
       };

       if (formData.address) payload.address = formData.address.toUpperCase();
       if (formData.phone) payload.phone = formData.phone;

       // Lógica específica para Clientes, Proveedores y Transportistas
       if (type === 'clients' || type === 'suppliers' || type === 'transporters') {
          payload.doc_number = formData.ruc; 
          payload.doc_type = (formData.ruc && formData.ruc.length === 8) ? 'DNI' : 'RUC';
          payload.is_active = true;
          
          if (type === 'clients' && !editingId) {
             payload.code = `CLI-${String(Date.now()).slice(-6)}`; // Exigencia de DB
             payload.is_person = true;
          }
       }

       // Lógica para Choferes
       if (type === 'drivers') {
          payload.license = (formData.license || '').toUpperCase();
       }

       if (USE_MOCK_DB) {
          config.add({ ...payload, id: editingId || crypto.randomUUID() });
       } else {
          if (editingId) {
             // Actualizar
             const { data, error } = await supabase.from(type).update(payload).eq('id', editingId).select();
             if (error) throw error;
             if (data && data.length > 0) {
                setRealData(prev => prev.map(item => item.id === editingId ? data[0] : item));
             }
          } else {
             // Insertar
             const newId = crypto.randomUUID();
             payload.id = newId;
             const { data, error } = await supabase.from(type).insert([payload]).select();
             if (error) throw error;
             if (data && data.length > 0) {
                setRealData(prev => [...prev, data[0]]);
             }
          }
       }
       setIsModalOpen(false);
       setFormData({});
    } catch (error: any) {
       alert('Error BD: ' + error.message);
    } finally {
       setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-black text-slate-800 flex items-center">
          <config.icon className="mr-3 text-blue-600 w-6 h-6" /> {config.title}
        </h2>
        <div className="flex gap-2">
           <button onClick={fetchData} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg flex items-center transition-colors shadow-sm border border-slate-200" title="Actualizar">
             <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
           </button>
           <button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg flex items-center shadow-md shadow-blue-600/30 transition-colors font-bold text-sm">
             <Plus className="w-4 h-4 mr-2" /> Nuevo Registro
           </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-md">
             <Search className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
             <input
               className="w-full pl-10 pr-4 py-2 border-2 border-slate-200 rounded-lg text-slate-800 shadow-inner focus:border-blue-500 outline-none font-medium"
               placeholder="Buscar por nombre o documento..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
           <table className="w-full text-sm text-left">
             <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-black tracking-wider sticky top-0 shadow-sm z-10">
               <tr>
                 {(type === 'clients' || type === 'suppliers' || type === 'transporters') && <th className="p-4 border-b border-slate-200">Documento</th>}
                 {type === 'drivers' && <th className="p-4 border-b border-slate-200">Licencia</th>}
                 <th className="p-4 border-b border-slate-200">Nombre / Razón Social</th>
                 {(type !== 'transporters' && type !== 'drivers') && <th className="p-4 border-b border-slate-200">Dirección</th>}
                 {(type === 'clients' || type === 'drivers') && <th className="p-4 border-b border-slate-200">Teléfono</th>}
                 <th className="p-4 border-b border-slate-200 text-right">Acciones</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {isLoading && realData.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-bold"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2"/> Cargando {config.title}...</td></tr>
               ) : filteredData.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-bold">No hay registros encontrados.</td></tr>
               ) : filteredData.map((item: any) => (
                 <tr key={item.id} className="hover:bg-blue-50 transition-colors group">
                   {(type === 'clients' || type === 'suppliers' || type === 'transporters') && (
                      <td className="p-4 font-mono font-bold text-slate-700">
                         <span className="text-[10px] bg-slate-200 text-slate-600 px-1 py-0.5 rounded mr-2">{item.doc_type || 'DOC'}</span>
                         {item.doc_number || item.ruc}
                      </td>
                   )}
                   {type === 'drivers' && <td className="p-4 font-mono font-bold text-slate-700">{item.license}</td>}
                   <td className="p-4 font-bold text-slate-900">{item.name}</td>
                   {(type !== 'transporters' && type !== 'drivers') && <td className="p-4 text-slate-500 truncate max-w-xs">{item.address || '-'}</td>}
                   {(type === 'clients' || type === 'drivers') && <td className="p-4 text-slate-600">{item.phone || '-'}</td>}
                   <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(item)} className="text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition-colors mr-1" title="Editar"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>

      {/* MODAL DE CREACIÓN / EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
               <h3 className="font-bold flex items-center">
                  <config.icon className="w-5 h-5 mr-2" /> {editingId ? 'Editar Registro' : `Nuevo Registro de ${config.title}`}
               </h3>
               <button onClick={() => !isSaving && setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {(type === 'clients' || type === 'suppliers' || type === 'transporters') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">RUC / DNI *</label>
                  <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-blue-500 outline-none font-mono" value={formData.ruc || ''} onChange={e => setFormData({...formData, ruc: e.target.value})} placeholder="Ingrese los 8 o 11 dígitos" />
                </div>
              )}
              
              {(type === 'drivers') && (
                 <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Licencia de Conducir *</label>
                  <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-blue-500 outline-none uppercase font-mono" value={formData.license || ''} onChange={e => setFormData({...formData, license: e.target.value.toUpperCase()})} />
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre / Razón Social *</label>
                <input required className="w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-blue-500 outline-none uppercase font-bold" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
              </div>
              
              {(type !== 'transporters' && type !== 'drivers') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dirección Principal</label>
                  <input className="w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-blue-500 outline-none uppercase" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} />
                </div>
              )}
              
              {(type === 'clients' || type === 'drivers' || type === 'suppliers') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono / Celular</label>
                  <input className="w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-blue-500 outline-none" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              )}
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md flex items-center disabled:opacity-50">
                  {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {isSaving ? 'Guardando...' : 'Guardar Datos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
