import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { Users, Shield, Edit, Save, Plus, Search, UserCheck, CheckSquare, Camera, RefreshCw } from 'lucide-react';

// Configuration for permission groups
const PERMISSION_GROUPS = [
   {
      name: 'Ventas & Pedidos',
      permissions: [
         { key: 'sales', label: 'Venta Directa' },
         { key: 'advanced-orders', label: 'Pedido Avanzado' },
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
         { key: 'accounting-reports', label: 'Reportes Contables' },
         { key: 'collection-consolidation', label: 'Cobranzas' },
         { key: 'credit-notes', label: 'Notas de Crédito' },
         { key: 'sunat-manager', label: 'Facturación SUNAT' },
         { key: 'purchases', label: 'Compras' },
         { key: 'company-settings', label: 'Configuración Global' },
      ]
   },
   {
      name: 'Gestión RRHH & Terceros',
      permissions: [
         { key: 'users', label: 'Usuarios & Accesos' },
         { key: 'quota-manager', label: 'Gestión de Cuotas' },
         { key: 'personnel-management', label: 'Planilla y Personal' },
         { key: 'attendance', label: 'Asistencia' },
         { key: 'clients', label: 'Clientes' },
         { key: 'suppliers', label: 'Proveedores' },
         { key: 'territory', label: 'Territorio (Zonas)' },
      ]
   }
];

const ROLE_PRESETS: Record<string, string[]> = {
   'ADMIN': PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key)),
   'SELLER': ['sales', 'advanced-orders', 'mobile-orders', 'clients', 'products', 'inventory'],
   'WAREHOUSE': ['inventory', 'kardex', 'products', 'dispatch', 'warehouses'],
   'LOGISTICS': ['dispatch', 'dispatch-liquidation', 'logistics', 'territory']
};

export const UserManagement: React.FC = () => {
   const [dbUsers, setDbUsers] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [isSaving, setIsSaving] = useState(false);
   
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [searchTerm, setSearchTerm] = useState('');
   const [activeTab, setActiveTab] = useState<'PROFILE' | 'PERMISSIONS'>('PROFILE');

   const initialForm: Partial<User> = {
      username: '',
      name: '',
      role: 'SELLER',
      requires_attendance: false,
      is_active: true,
      permissions: ROLE_PRESETS['SELLER']
   };

   const [formData, setFormData] = useState<Partial<User>>(initialForm);

   // --- SUPABASE FETCH ---
   useEffect(() => {
      fetchUsers();
   }, []);

   const fetchUsers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
         .from('erp_users')
         .select('*')
         .order('name', { ascending: true });
         
      if (data) setDbUsers(data);
      if (error) console.error("Error cargando usuarios:", error);
      setIsLoading(false);
   };

   const filteredUsers = dbUsers.filter(u =>
      (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.username?.toLowerCase() || '').includes(searchTerm.toLowerCase())
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

   // --- SUPABASE SAVE / UPDATE ---
   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.username || !formData.name) {
         alert("Complete los campos obligatorios");
         return;
      }

      setIsSaving(true);

      try {
         const payload = {
            name: formData.name,
            username: formData.username,
            role: formData.role,
            permissions: formData.permissions,
            is_active: formData.is_active,
            requires_attendance: formData.requires_attendance,
            avatar_url: formData.avatar_url
         };

         if (formData.id) {
            // Actualizar usuario existente
            const { error } = await supabase
               .from('erp_users')
               .update(payload)
               .eq('id', formData.id);
            if (error) throw error;
         } else {
            // Crear nuevo usuario (Solo Perfil DB)
            const { error } = await supabase
               .from('erp_users')
               .insert([payload]);
            if (error) throw error;
            alert("Perfil creado en Supabase.\n\nIMPORTANTE: Para que este usuario pueda iniciar sesión, debes ir a Supabase -> Authentication, crearle una cuenta con este mismo correo y pegar su 'Auth ID' en la tabla erp_users.");
         }

         await fetchUsers(); // Recargar la tabla con los datos frescos
         setIsModalOpen(false);
      } catch (error: any) {
         alert("Error al guardar en Supabase: " + error.message);
      } finally {
         setIsSaving(false);
      }
   };

   const handleRoleChange = (role: string) => {
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
         setFormData({ ...formData, permissions: current.filter(p => !groupKeys.includes(p)) });
      } else {
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
         default: return <span className="bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded font-bold border border-slate-200">{role}</span>;
      }
   };

   const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         if (file.size > 1024 * 1024) { 
            alert("La imagen es muy grande. Máximo 1MB.");
            return;
         }
         const reader = new FileReader();
         reader.onloadend = () => {
            setFormData({ ...formData, avatar_url: reader.result as string });
         };
         reader.readAsDataURL(file);
      }
   };

   return (
      <div className="h-full flex flex-col space-y-4">
         <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
               <Shield className="mr-2 h-6 w-6 text-slate-600" /> Gestión de Usuarios y Permisos
            </h2>
            <div className="flex gap-2">
               <button onClick={fetchUsers} className="bg-white text-slate-600 border border-slate-300 px-4 py-2 rounded flex items-center shadow-sm hover:bg-slate-50 transition-colors">
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
               </button>
               <button onClick={handleNew} className="bg-slate-900 text-white px-4 py-2 rounded flex items-center shadow hover:bg-slate-800 transition-colors">
                  <Plus className="w-4 h-4 mr-2" /> Nuevo Usuario
               </button>
            </div>
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
         <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="overflow-y-auto flex-1">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 shadow-sm">
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
                     {isLoading && dbUsers.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-slate-500">Cargando usuarios desde Supabase...</td></tr>
                     ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-slate-500">No se encontraron usuarios.</td></tr>
                     ) : (
                        filteredUsers.map(user => (
                           <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 flex items-center gap-3">
                                 {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full border border-slate-300 object-cover" />
                                 ) : (
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs border border-slate-300">
                                       {(user.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                 )}
                                 <span className="font-mono font-bold text-slate-700">{user.username}</span>
                              </td>
                              <td className="p-4 font-medium">{user.name}</td>
                              <td className="p-4">{getRoleBadge(user.role)}</td>
                              <td className="p-4 text-center">
                                 <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">
                                    {user.permissions?.length || 0} módulos
                                 </span>
                              </td>
                              <td className="p-4 text-center">
                                 {user.requires_attendance ? (
                                    <span className="text-green-600 flex justify-center items-center font-bold text-xs"><UserCheck className="w-4 h-4 mr-1" /> SÍ</span>
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
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {/* --- USER EDIT MODAL --- */}
         {isModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Header */}
                  <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                     <h3 className="font-bold text-lg flex items-center">
                        <UserCheck className="mr-2" /> {formData.id ? 'Editar Usuario & Permisos' : 'Crear Usuario DB'}
                     </h3>
                     <button onClick={() => !isSaving && setIsModalOpen(false)} className="text-slate-400 hover:text-white disabled:opacity-50" disabled={isSaving}>
                        <span className="text-2xl">&times;</span>
                     </button>
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
                  <form id="user-form" onSubmit={handleSubmit} className="flex-1 overflow-auto bg-white">
                     {activeTab === 'PROFILE' && (
                        <div className="p-8 space-y-6">
                           <div className="grid grid-cols-2 gap-6">
                              <div>
                                 <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Completo</label>
                                 <input required className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
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

                           <div className="grid grid-cols-1 gap-6">
                              <div>
                                 <label className="block text-xs font-bold text-slate-600 mb-1">Correo Electrónico (Login)</label>
                                 <input required type="email" className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="usuario@empresa.com" />
                                 {!formData.id && <p className="text-[10px] font-bold text-amber-600 mt-1">Nota: Las contraseñas se configuran en el panel de Authentication de Supabase por seguridad.</p>}
                              </div>
                           </div>

                           {/* AVATAR UPLOAD */}
                           <div className="bg-slate-50 p-4 rounded border border-slate-200 flex items-center gap-4">
                              <div className="relative group w-16 h-16 shrink-0">
                                 {formData.avatar_url ? (
                                    <img src={formData.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-slate-300 object-cover" />
                                 ) : (
                                    <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-400 text-xl border-2 border-dashed border-slate-300 group-hover:bg-slate-300 transition-colors">
                                       ?
                                    </div>
                                 )}
                                 <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                                    <Camera className="w-5 h-5 mb-1" />
                                    <span className="text-[9px] font-bold">Cambiar</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                                 </label>
                              </div>
                              <div className="flex-1">
                                 <h4 className="font-bold text-sm text-slate-700">Foto de Perfil</h4>
                                 <p className="text-xs text-slate-500 mb-1">Haga clic en la imagen para subir una nueva foto (Máx 1MB).</p>
                                 {formData.avatar_url && (
                                    <button type="button" onClick={() => setFormData({ ...formData, avatar_url: undefined })} className="text-[10px] font-bold text-red-600 hover:underline">
                                       ELIMINAR IMAGEN
                                    </button>
                                 )}
                              </div>
                           </div>

                           <div className="bg-slate-50 p-4 rounded border border-slate-200">
                              <h4 className="font-bold text-sm text-slate-700 mb-3">Configuración Adicional</h4>
                              <div className="space-y-3">
                                 <label className="flex items-center text-sm font-medium text-slate-700 cursor-pointer">
                                    <input type="checkbox" className="mr-3 w-4 h-4 text-blue-600 rounded" checked={formData.requires_attendance} onChange={e => setFormData({ ...formData, requires_attendance: e.target.checked })} />
                                    Requiere marcar asistencia (Reloj Control)
                                 </label>
                                 <label className="flex items-center text-sm font-medium text-slate-700 cursor-pointer">
                                    <input type="checkbox" className="mr-3 w-4 h-4 text-green-600 rounded" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
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
                     <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="px-4 py-2 text-slate-600 hover:bg-slate-200 font-bold rounded disabled:opacity-50">Cancelar</button>
                     <button type="submit" form="user-form" disabled={isSaving} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow flex items-center disabled:opacity-50">
                        {isSaving ? (
                           <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                           <Save className="w-4 h-4 mr-2" /> 
                        )}
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
