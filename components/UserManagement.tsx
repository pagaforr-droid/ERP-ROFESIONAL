
import React, { useState } from 'react';
import { useStore } from '../services/store';
import { User, ViewState } from '../types';
import { Users, Shield, Edit, Save, Plus, Search, UserCheck, Lock, CheckSquare, Square } from 'lucide-react';

// Configuration for permission groups
const PERMISSION_GROUPS = [
  {
    name: 'Ventas & Pedidos',
    permissions: [
      { key: 'sales', label: 'Venta Directa' },
      { key: 'mobile-orders', label: 'App Vendedores' },
      { key: 'order-processing', label: 'Procesar Pedidos' },
      { key: 'print-batch', label: 'Impresión Lotes' },
      { key: 'document-manager', label: 'Historial Docs' },
    ]
  },
  {
    name: 'Logística & Almacén',
    permissions: [
      { key: 'inventory', label: 'Inventario (Recepción)' },
      { key: 'kardex', label: 'Kardex & Consultas' },
      { key: 'products', label: 'Maestro Productos' },
      { key: 'dispatch', label: 'Despacho & Rutas' },
      { key: 'dispatch-liquidation', label: 'Liquidación Rutas' },
      { key: 'logistics', label: 'Flota & Choferes' },
      { key: 'warehouses', label: 'Almacenes' },
    ]
  },
  {
    name: 'Finanzas & Administración',
    permissions: [
      { key: 'cash-flow', label: 'Flujo de Caja' },
      { key: 'reports', label: 'Reportes Gerenciales' },
      { key: 'purchases', label: 'Compras' },
      { key: 'company-settings', label: 'Configuración Global' },
    ]
  },
  {
    name: 'Gestión RRHH & Terceros',
    permissions: [
      { key: 'users', label: 'Usuarios & Accesos' },
      { key: 'attendance', label: 'Asistencia' },
      { key: 'clients', label: 'Clientes' },
      { key: 'suppliers', label: 'Proveedores' },
      { key: 'territory', label: 'Territorio (Zonas)' },
    ]
  }
];

// Presets based on roles
const ROLE_PRESETS: Record<string, string[]> = {
  'ADMIN': PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key)), // All
  'SELLER': ['sales', 'mobile-orders', 'clients', 'products', 'inventory'],
  'WAREHOUSE': ['inventory', 'kardex', 'products', 'dispatch', 'warehouses'],
  'LOGISTICS': ['dispatch', 'dispatch-liquidation', 'logistics', 'territory']
};

export const UserManagement: React.FC = () => {
  const { users, addUser, updateUser } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'PERMISSIONS'>('PROFILE');
  
  const initialForm: Partial<User> = {
    username: '',
    password: '',
    name: '',
    role: 'SELLER',
    requires_attendance: false,
    is_active: true,
    permissions: ROLE_PRESETS['SELLER']
  };

  const [formData, setFormData] = useState<Partial<User>>(initialForm);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (user: User) => {
    setFormData(user);
    setActiveTab('PROFILE');
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setFormData(initialForm);
    setActiveTab('PROFILE');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.name || !formData.password) {
       alert("Complete los campos obligatorios");
       return;
    }

    if (formData.id) {
      updateUser(formData as User);
    } else {
      addUser({ ...formData, id: crypto.randomUUID() } as User);
    }
    setIsModalOpen(false);
  };

  const handleRoleChange = (role: string) => {
     // Auto-apply preset permissions when role changes
     const permissions = ROLE_PRESETS[role] || [];
     setFormData({ ...formData, role: role as any, permissions });
  };

  const togglePermission = (key: string) => {
     const current = formData.permissions || [];
     if (current.includes(key)) {
        setFormData({ ...formData, permissions: current.filter(p => p !== key) });
     } else {
        setFormData({ ...formData, permissions: [...current, key] });
     }
  };

  const toggleGroup = (groupKeys: string[]) => {
     const current = formData.permissions || [];
     const allSelected = groupKeys.every(k => current.includes(k));
     
     if (allSelected) {
        // Deselect all in group
        setFormData({ ...formData, permissions: current.filter(p => !groupKeys.includes(p)) });
     } else {
        // Select all in group
        const newPerms = new Set([...current, ...groupKeys]);
        setFormData({ ...formData, permissions: Array.from(newPerms) });
     }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN': return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded font-bold border border-purple-200">ADMINISTRADOR</span>;
      case 'SELLER': return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold border border-blue-200">VENDEDOR</span>;
      case 'WAREHOUSE': return <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded font-bold border border-orange-200">ALMACÉN</span>;
      case 'LOGISTICS': return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded font-bold border border-gray-200">LOGÍSTICA</span>;
      default: return role;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <Shield className="mr-2 h-6 w-6 text-slate-600" /> Gestión de Usuarios y Permisos
        </h2>
        <button onClick={handleNew} className="bg-slate-900 text-white px-4 py-2 rounded flex items-center shadow hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Usuario
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
         <div className="relative max-w-md">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
            <input 
               className="w-full pl-8 border border-slate-300 p-2 rounded text-sm focus:outline-none focus:border-blue-500" 
               placeholder="Buscar por nombre o usuario..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      {/* User Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
         <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
               <tr>
                  <th className="p-4">Usuario</th>
                  <th className="p-4">Nombre Completo</th>
                  <th className="p-4">Rol Principal</th>
                  <th className="p-4 text-center">Acceso Áreas</th>
                  <th className="p-4 text-center">Control Asistencia</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                     <td className="p-4 font-mono font-bold text-slate-700">{user.username}</td>
                     <td className="p-4 font-medium">{user.name}</td>
                     <td className="p-4">{getRoleBadge(user.role)}</td>
                     <td className="p-4 text-center">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">
                           {user.permissions?.length || 0} módulos
                        </span>
                     </td>
                     <td className="p-4 text-center">
                        {user.requires_attendance ? (
                           <span className="text-green-600 flex justify-center items-center font-bold text-xs"><UserCheck className="w-4 h-4 mr-1"/> SÍ</span>
                        ) : (
                           <span className="text-slate-400 text-xs">NO</span>
                        )}
                     </td>
                     <td className="p-4 text-center">
                        {user.is_active ? <span className="text-green-600 font-bold text-xs">ACTIVO</span> : <span className="text-red-500 font-bold text-xs">INACTIVO</span>}
                     </td>
                     <td className="p-4 text-right">
                        <button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-800 font-bold flex items-center justify-end w-full">
                           <Edit className="w-4 h-4 mr-1" /> Editar
                        </button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>

      {/* --- USER EDIT MODAL --- */}
      {isModalOpen && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
               {/* Header */}
               <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                  <h3 className="font-bold text-lg flex items-center">
                     <UserCheck className="mr-2"/> {formData.id ? 'Editar Usuario & Permisos' : 'Crear Usuario'}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><span className="text-2xl">&times;</span></button>
               </div>

               {/* Tabs */}
               <div className="flex border-b border-slate-200 bg-slate-50">
                  <button 
                     onClick={() => setActiveTab('PROFILE')}
                     className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'PROFILE' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:bg-white'}`}
                  >
                     Datos de Perfil
                  </button>
                  <button 
                     onClick={() => setActiveTab('PERMISSIONS')}
                     className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'PERMISSIONS' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:bg-white'}`}
                  >
                     Permisos de Acceso ({formData.permissions?.length || 0})
                  </button>
               </div>

               {/* Content */}
               <form onSubmit={handleSubmit} className="flex-1 overflow-auto bg-white">
                  {activeTab === 'PROFILE' && (
                     <div className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                           <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Completo</label>
                              <input required className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Rol Principal</label>
                              <select 
                                 className="w-full border border-slate-300 p-2 rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                 value={formData.role} 
                                 onChange={e => handleRoleChange(e.target.value)}
                              >
                                 <option value="ADMIN">ADMINISTRADOR</option>
                                 <option value="SELLER">VENDEDOR</option>
                                 <option value="WAREHOUSE">ALMACÉN</option>
                                 <option value="LOGISTICS">LOGÍSTICA</option>
                              </select>
                              <p className="text-[10px] text-slate-400 mt-1">Al cambiar el rol, se restablecerán los permisos predeterminados.</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                           <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Usuario (Login)</label>
                              <input required className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Contraseña</label>
                              <input required type="text" className="w-full border border-slate-300 p-2 rounded font-mono focus:ring-2 focus:ring-blue-500 outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                           </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded border border-slate-200">
                           <h4 className="font-bold text-sm text-slate-700 mb-3">Configuración Adicional</h4>
                           <div className="space-y-3">
                              <label className="flex items-center text-sm font-medium text-slate-700 cursor-pointer">
                                 <input type="checkbox" className="mr-3 w-4 h-4 text-blue-600 rounded" checked={formData.requires_attendance} onChange={e => setFormData({...formData, requires_attendance: e.target.checked})} />
                                 Requiere marcar asistencia (Reloj Control)
                              </label>
                              <label className="flex items-center text-sm font-medium text-slate-700 cursor-pointer">
                                 <input type="checkbox" className="mr-3 w-4 h-4 text-green-600 rounded" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                                 Cuenta de usuario activa
                              </label>
                           </div>
                        </div>
                     </div>
                  )}

                  {activeTab === 'PERMISSIONS' && (
                     <div className="p-6 grid grid-cols-2 gap-6">
                        {PERMISSION_GROUPS.map((group) => {
                           const groupKeys = group.permissions.map(p => p.key);
                           const allSelected = groupKeys.every(k => formData.permissions?.includes(k));
                           
                           return (
                              <div key={group.name} className="border border-slate-200 rounded-lg overflow-hidden">
                                 <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center">
                                    <h4 className="font-bold text-slate-700 text-sm">{group.name}</h4>
                                    <button 
                                       type="button" 
                                       onClick={() => toggleGroup(groupKeys)}
                                       className="text-xs font-bold text-blue-600 hover:underline"
                                    >
                                       {allSelected ? 'Ninguno' : 'Todos'}
                                    </button>
                                 </div>
                                 <div className="p-3 grid grid-cols-1 gap-2">
                                    {group.permissions.map(perm => (
                                       <label key={perm.key} className="flex items-center p-2 rounded hover:bg-slate-50 cursor-pointer transition-colors">
                                          <div className={`w-5 h-5 border rounded flex items-center justify-center mr-3 transition-colors ${formData.permissions?.includes(perm.key) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                             <input 
                                                type="checkbox" 
                                                className="hidden"
                                                checked={formData.permissions?.includes(perm.key)}
                                                onChange={() => togglePermission(perm.key)}
                                             />
                                             {formData.permissions?.includes(perm.key) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                                          </div>
                                          <span className={`text-sm ${formData.permissions?.includes(perm.key) ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                                             {perm.label}
                                          </span>
                                       </label>
                                    ))}
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  )}
               </form>

               {/* Footer */}
               <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 font-bold rounded">Cancelar</button>
                  <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow flex items-center">
                     <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
