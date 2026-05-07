import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { Users, Shield, Edit, Save, Plus, Search, UserCheck, CheckSquare, Camera, RefreshCw, X, AlertCircle, CheckCircle2, Lock, Unlock, Mail, ShieldAlert } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'error' | 'success' | 'warning' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const getStyle = () => {
    if (type === 'error') return { border: 'border-rose-500', icon: <X className="w-6 h-6 text-rose-500 mr-3" />, text: 'text-rose-800', bg: 'bg-rose-50' };
    if (type === 'warning') return { border: 'border-amber-500', icon: <AlertCircle className="w-6 h-6 text-amber-500 mr-3" />, text: 'text-amber-800', bg: 'bg-amber-50' };
    if (type === 'success') return { border: 'border-emerald-500', icon: <CheckCircle2 className="w-6 h-6 text-emerald-500 mr-3" />, text: 'text-emerald-800', bg: 'bg-emerald-50' };
    return { border: 'border-indigo-500', icon: <AlertCircle className="w-6 h-6 text-indigo-500 mr-3" />, text: 'text-indigo-800', bg: 'bg-indigo-50' };
  };
  const s = getStyle();

  return (
    <div style={{ animation: 'slideDown 0.3s ease-out' }} className={`fixed top-10 left-1/2 transform -translate-x-1/2 z-[100] flex items-center p-4 rounded-xl shadow-2xl border-l-4 min-w-[350px] ${s.bg} ${s.border}`}>
      {s.icon}
      <div className="flex-1">
        <p className={`text-sm font-bold ${s.text}`}>{message}</p>
      </div>
      <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-600 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

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
   'LOGISTICS': ['dispatch', 'dispatch-liquidation', 'logistics', 'territory'],
   'CASHIER': ['cash-flow', 'collection-consolidation', 'credit-notes', 'purchases', 'clients', 'suppliers']
};

export const UserManagement: React.FC = () => {
   const [toasts, setToasts] = useState<Array<{ id: number, message: string, type: 'error' | 'success' | 'warning' | 'info' }>>([]);
   const showToast = (message: string, type: 'error' | 'success' | 'warning' | 'info') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
   };

   const [dbUsers, setDbUsers] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);
   
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [searchTerm, setSearchTerm] = useState('');
   const [activeTab, setActiveTab] = useState<'PROFILE' | 'PERMISSIONS'>('PROFILE');
   const [passwordInput, setPasswordInput] = useState('');

   const initialForm: Partial<User> = {
      username: '',
      name: '',
      role: 'SELLER',
      requires_attendance: false,
      is_active: true,
      permissions: ROLE_PRESETS['SELLER']
   };

   const [formData, setFormData] = useState<Partial<User>>(initialForm);

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
      setPasswordInput(''); // Reset password field
      setActiveTab('PROFILE');
      setIsModalOpen(true);
   };

   const handleNew = () => {
      setFormData(initialForm);
      setPasswordInput(''); // Reset password field
      setActiveTab('PROFILE');
      setIsModalOpen(true);
   };

   // --- SUPABASE SAVE / UPDATE (RPC Integration) ---
   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.username || !formData.name) {
         showToast("Complete los campos obligatorios", "warning");
         return;
      }

      setIsSaving(true);

      try {
         if (formData.id) {
            // ACTUALIZACIÓN DE USUARIO (SOLO ERP_USERS)
            const payload = {
                name: formData.name,
                username: formData.username,
                role: formData.role,
                permissions: formData.permissions,
                is_active: formData.is_active,
                requires_attendance: formData.requires_attendance,
                avatar_url: formData.avatar_url
            };
            const { data, error } = await supabase
               .from('erp_users')
               .update(payload)
               .eq('id', formData.id)
               .select();
               
            if (error) throw error;
            showToast("Perfil actualizado correctamente.", "success");
         } else {
            // CREACIÓN NUEVA (AUTH + ERP_USERS VÍA RPC)
            if (!passwordInput || passwordInput.length < 6) {
                showToast("Debes ingresar una contraseña de al menos 6 caracteres", "warning");
                setIsSaving(false);
                return;
            }

            const { data, error } = await supabase.rpc('create_erp_user_secure', {
                p_email: formData.username,
                p_password: passwordInput,
                p_name: formData.name,
                p_role: formData.role,
                p_permissions: formData.permissions,
                p_requires_attendance: formData.requires_attendance || false,
                p_avatar_url: formData.avatar_url || ''
            });

            if (error) throw error;
            showToast("Usuario creado con credenciales de acceso.", "success");
         }

         await fetchUsers(); 
         setIsModalOpen(false);
      } catch (error: any) {
         showToast(error.message || "Error al procesar la solicitud", "error");
      } finally {
         setIsSaving(false);
      }
   };

   const handleRoleChange = (role: string) => {
      const permissions = ROLE_PRESETS[role] || [];
      setFormData({ ...formData, role: role as any, permissions });
   };

   // Estilo iOS Toggle
   const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
      <button 
        type="button"
        onClick={onChange}
        className={`w-11 h-6 rounded-full relative transition-colors duration-300 ease-in-out focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform duration-300 ease-in-out shadow-sm ${checked ? 'translate-x-5.5 left-[1px]' : 'translate-x-0.5'}`} />
      </button>
   );

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
         case 'ADMIN': return <span className="bg-indigo-500/10 text-indigo-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 backdrop-blur-sm shadow-sm flex items-center justify-center gap-1 w-max"><ShieldAlert className="w-3 h-3"/> ADMINISTRADOR</span>;
         case 'SELLER': return <span className="bg-sky-500/10 text-sky-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-sky-500/20 shadow-sm">VENDEDOR</span>;
         case 'WAREHOUSE': return <span className="bg-amber-500/10 text-amber-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-amber-500/20 shadow-sm">ALMACÉN</span>;
         case 'LOGISTICS': return <span className="bg-slate-500/10 text-slate-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-slate-500/20 shadow-sm">LOGÍSTICA</span>;
         case 'CASHIER': return <span className="bg-emerald-500/10 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm">CAJA / FINANZAS</span>;
         default: return <span className="bg-slate-100 text-slate-800 text-[10px] px-2.5 py-1 rounded-md font-black uppercase tracking-widest border border-slate-200">{role}</span>;
      }
   };

   // --- CANVAS IMAGE COMPRESSION ---
   const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         const reader = new FileReader();
         reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 250;
                const MAX_HEIGHT = 250;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Compress to WebP at 0.7 quality
                const dataUrl = canvas.toDataURL('image/webp', 0.7);
                setFormData({ ...formData, avatar_url: dataUrl });
            };
            img.src = event.target?.result as string;
         };
         reader.readAsDataURL(file);
      }
   };

   return (
      <div className="h-full flex flex-col space-y-6 relative p-2">
         <style>{`
           @keyframes slideDown {
             from { transform: translate(-50%, -100%); opacity: 0; }
             to { transform: translate(-50%, 0); opacity: 1; }
           }
         `}</style>
         {toasts.map(t => (
            <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
         ))}

         {/* Header */}
         <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div>
               <h2 className="text-2xl font-black text-slate-800 flex items-center tracking-tight">
                  <div className="bg-indigo-100 p-2 rounded-xl mr-4 shadow-inner">
                     <Shield className="h-7 w-7 text-indigo-600" />
                  </div>
                  Gestión de Accesos y Usuarios
               </h2>
               <p className="text-sm text-slate-500 mt-1 ml-14 font-medium">Control corporativo de roles, credenciales y seguridad.</p>
            </div>
            <div className="flex gap-3">
               <div className="relative w-64 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                     className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                     placeholder="Buscar usuario o email..."
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
               <button onClick={fetchUsers} className="bg-white text-slate-600 border border-slate-200 w-11 rounded-xl flex items-center justify-center shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95">
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
               </button>
               <button onClick={handleNew} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center font-bold shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:bg-indigo-700 hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 transition-all active:scale-95">
                  <Plus className="w-4 h-4 mr-2" /> Nuevo Perfil
               </button>
            </div>
         </div>

         {/* Data Grid */}
         <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="overflow-y-auto flex-1 custom-scrollbar">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 backdrop-blur-md text-slate-500 font-black tracking-wider uppercase text-[10px] sticky top-0 z-10 border-b border-slate-200">
                     <tr>
                        <th className="p-5 pl-6">Usuario / Credencial</th>
                        <th className="p-5">Rol Principal</th>
                        <th className="p-5 text-center">Nivel de Acceso</th>
                        <th className="p-5 text-center">Asistencia</th>
                        <th className="p-5 text-center">Estado</th>
                        <th className="p-5 pr-6 text-right">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                           <tr key={i} className="animate-pulse bg-white">
                              <td className="p-5 pl-6 flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                                 <div className="space-y-2">
                                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                                    <div className="h-3 w-24 bg-slate-100 rounded"></div>
                                 </div>
                              </td>
                              <td className="p-5"><div className="h-6 w-24 bg-slate-200 rounded-md"></div></td>
                              <td className="p-5 text-center"><div className="h-6 w-20 bg-slate-200 rounded-md mx-auto"></div></td>
                              <td className="p-5 text-center"><div className="h-4 w-8 bg-slate-200 rounded mx-auto"></div></td>
                              <td className="p-5 text-center"><div className="h-6 w-16 bg-slate-200 rounded-full mx-auto"></div></td>
                              <td className="p-5 pr-6"><div className="h-8 w-8 bg-slate-200 rounded-lg ml-auto"></div></td>
                           </tr>
                        ))
                     ) : filteredUsers.length === 0 ? (
                        <tr>
                           <td colSpan={6} className="p-16">
                              <div className="flex flex-col items-center justify-center text-slate-400">
                                 <Shield className="w-16 h-16 mb-4 text-slate-200" />
                                 <p className="text-lg font-bold text-slate-600">No se encontraron perfiles</p>
                                 <p className="text-sm">Ajusta los filtros o crea un nuevo usuario.</p>
                              </div>
                           </td>
                        </tr>
                     ) : (
                        filteredUsers.map(user => (
                           <tr key={user.id} className="hover:bg-indigo-50/30 transition-colors group">
                              <td className="p-5 pl-6 flex items-center gap-4">
                                 {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.name} className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover" />
                                 ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 font-black text-sm border-2 border-white shadow-sm">
                                       {(user.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                 )}
                                 <div>
                                    <div className="font-bold text-slate-800">{user.name}</div>
                                    <div className="text-xs font-mono text-slate-500 mt-0.5">{user.username}</div>
                                 </div>
                              </td>
                              <td className="p-5">{getRoleBadge(user.role)}</td>
                              <td className="p-5 text-center">
                                 <span className="inline-flex items-center justify-center bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 group-hover:bg-white transition-colors">
                                    <Shield className="w-3 h-3 mr-1.5 opacity-50" />
                                    {user.permissions?.length || 0} Permisos
                                 </span>
                              </td>
                              <td className="p-5 text-center">
                                 {user.requires_attendance ? (
                                    <span className="inline-flex items-center justify-center text-emerald-600 font-bold text-xs"><CheckCircle2 className="w-4 h-4 mr-1" /> Requerida</span>
                                 ) : (
                                    <span className="text-slate-400 text-xs font-medium">Opcional</span>
                                 )}
                              </td>
                              <td className="p-5 text-center">
                                 {user.is_active ? (
                                    <span className="inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                 ) : (
                                    <span className="inline-flex w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
                                 )}
                              </td>
                              <td className="p-5 pr-6 text-right">
                                 <button onClick={() => handleEdit(user)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                                    <Edit className="w-4 h-4" />
                                 </button>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {/* --- ELITE MODAL --- */}
         {isModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                  
                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${formData.id ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                           {formData.id ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        </div>
                        <div>
                           <h3 className="font-black text-lg text-slate-800">
                              {formData.id ? 'Modificar Perfil de Acceso' : 'Nuevo Usuario Administrativo'}
                           </h3>
                           <p className="text-xs text-slate-500 font-medium">
                              {formData.id ? `ID: ${formData.id}` : 'Creación de credenciales seguras'}
                           </p>
                        </div>
                     </div>
                     <button onClick={() => !isSaving && setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" disabled={isSaving}>
                        <X className="w-5 h-5" />
                     </button>
                  </div>

                  {/* Modal Tabs */}
                  <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-2">
                     <button
                        onClick={() => setActiveTab('PROFILE')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-all relative ${activeTab === 'PROFILE' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                     >
                        Identidad & Credenciales
                     </button>
                     <button
                        onClick={() => setActiveTab('PERMISSIONS')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-all relative flex items-center gap-2 ${activeTab === 'PERMISSIONS' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                     >
                        Reglas de Acceso
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'PERMISSIONS' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                           {formData.permissions?.length || 0}
                        </span>
                     </button>
                  </div>

                  <form id="user-form" onSubmit={handleSubmit} className="flex-1 overflow-auto bg-slate-50/30">
                     {activeTab === 'PROFILE' && (
                        <div className="p-8 space-y-8">
                           {/* Avatar Section */}
                           <div className="flex items-center gap-6">
                              <div className="relative group w-24 h-24 shrink-0">
                                 {formData.avatar_url ? (
                                    <img src={formData.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover transition-transform group-hover:scale-105" />
                                 ) : (
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-400 text-3xl border-4 border-white shadow-sm transition-transform group-hover:scale-105">
                                       <Camera className="w-8 h-8 opacity-50" />
                                    </div>
                                 )}
                                 <label className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-900/60 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white backdrop-blur-[2px]">
                                    <Camera className="w-6 h-6 mb-1" />
                                    <span className="text-[10px] font-bold tracking-wider">SUBIR</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                                 </label>
                              </div>
                              <div className="flex-1">
                                 <h4 className="font-bold text-lg text-slate-800 mb-1">Fotografía del Perfil</h4>
                                 <p className="text-sm text-slate-500 mb-3 font-medium">Recomendado: 250x250px. La imagen será comprimida automáticamente a WebP para optimizar la base de datos.</p>
                                 {formData.avatar_url && (
                                    <button type="button" onClick={() => setFormData({ ...formData, avatar_url: undefined })} className="text-xs font-bold text-rose-500 hover:text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 transition-colors">
                                       Remover Foto
                                    </button>
                                 )}
                              </div>
                           </div>

                           <hr className="border-slate-100" />

                           {/* Basic Info */}
                           <div className="grid grid-cols-2 gap-8">
                              <div className="space-y-1.5">
                                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre Completo <span className="text-rose-500">*</span></label>
                                 <input required className="w-full bg-white border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-800 shadow-sm" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Juan Pérez" />
                              </div>
                              <div className="space-y-1.5">
                                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Asignación de Rol</label>
                                 <select
                                    className="w-full bg-white border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-indigo-700 shadow-sm appearance-none"
                                    value={formData.role}
                                    onChange={e => handleRoleChange(e.target.value)}
                                 >
                                    <option value="ADMIN">🛡️ ADMINISTRADOR (Acceso Total)</option>
                                    <option value="SELLER">💼 VENDEDOR (Operaciones Comerciales)</option>
                                    <option value="WAREHOUSE">📦 ALMACÉN (Inventario y Kardex)</option>
                                    <option value="LOGISTICS">🚚 LOGÍSTICA (Despachos y Rutas)</option>
                                    <option value="CASHIER">💰 CAJA / FINANZAS (Cobros y Pagos)</option>
                                 </select>
                              </div>
                           </div>

                           {/* Credentials */}
                           <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6">
                               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                   <Lock className="w-5 h-5 text-indigo-500" /> Credenciales de Autenticación
                               </h4>
                               <div className="grid grid-cols-2 gap-6">
                                  <div className="space-y-1.5 relative">
                                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Correo (Usuario) <span className="text-rose-500">*</span></label>
                                     <Mail className="absolute left-3 top-8 w-5 h-5 text-slate-400" />
                                     <input required type="email" disabled={!!formData.id} className="w-full bg-white border border-slate-200 p-3 pl-10 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-800 shadow-sm disabled:bg-slate-100 disabled:text-slate-500" value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="usuario@empresa.com" />
                                  </div>
                                  {!formData.id ? (
                                      <div className="space-y-1.5 relative">
                                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Contraseña de Acceso <span className="text-rose-500">*</span></label>
                                         <Lock className="absolute left-3 top-8 w-5 h-5 text-slate-400" />
                                         <input required type="password" minLength={6} className="w-full bg-white border border-slate-200 p-3 pl-10 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-800 shadow-sm" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="Mínimo 6 caracteres" />
                                      </div>
                                  ) : (
                                      <div className="flex items-center justify-center p-4 bg-white/50 border border-slate-200/50 rounded-xl mt-6">
                                          <p className="text-xs text-slate-500 font-medium flex items-center gap-2"><Lock className="w-4 h-4"/> La contraseña no se puede editar por esta vía.</p>
                                      </div>
                                  )}
                               </div>
                           </div>

                           {/* Status Toggles */}
                           <div className="flex gap-8">
                               <div className="flex items-center gap-4 bg-white px-5 py-4 rounded-xl border border-slate-200 shadow-sm flex-1">
                                   <ToggleSwitch checked={formData.is_active || false} onChange={() => setFormData({ ...formData, is_active: !formData.is_active })} />
                                   <div>
                                       <div className="font-bold text-sm text-slate-800">Estado de la Cuenta</div>
                                       <div className="text-xs text-slate-500 font-medium">Permite o bloquea el acceso al sistema.</div>
                                   </div>
                               </div>
                               <div className="flex items-center gap-4 bg-white px-5 py-4 rounded-xl border border-slate-200 shadow-sm flex-1">
                                   <ToggleSwitch checked={formData.requires_attendance || false} onChange={() => setFormData({ ...formData, requires_attendance: !formData.requires_attendance })} />
                                   <div>
                                       <div className="font-bold text-sm text-slate-800">Control de Asistencia</div>
                                       <div className="text-xs text-slate-500 font-medium">Obliga a registrar entrada/salida.</div>
                                   </div>
                               </div>
                           </div>
                        </div>
                     )}

                     {activeTab === 'PERMISSIONS' && (
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                           {PERMISSION_GROUPS.map((group) => {
                              const groupKeys = group.permissions.map(p => p.key);
                              const allSelected = groupKeys.every(k => formData.permissions?.includes(k));

                              return (
                                 <div key={group.name} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    <div className="bg-slate-50/80 p-4 border-b border-slate-100 flex justify-between items-center">
                                       <h4 className="font-black text-slate-700 text-sm tracking-wide uppercase">{group.name}</h4>
                                       <button
                                          type="button"
                                          onClick={() => toggleGroup(groupKeys)}
                                          className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors ${allSelected ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                                       >
                                          {allSelected ? 'DESMARCAR TODO' : 'MARCAR TODO'}
                                       </button>
                                    </div>
                                    <div className="p-2">
                                       {group.permissions.map(perm => (
                                          <label key={perm.key} className="flex items-center justify-between p-3 mx-2 my-1 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group/item">
                                             <span className={`text-sm font-medium transition-colors ${formData.permissions?.includes(perm.key) ? 'text-slate-900' : 'text-slate-500 group-hover/item:text-slate-700'}`}>
                                                {perm.label}
                                             </span>
                                             <ToggleSwitch 
                                                checked={formData.permissions?.includes(perm.key) || false} 
                                                onChange={() => togglePermission(perm.key)} 
                                             />
                                          </label>
                                       ))}
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     )}
                  </form>

                  {/* Modal Footer */}
                  <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                     <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="px-6 py-2.5 text-sm text-slate-500 hover:text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50">Cancelar</button>
                     <button type="submit" form="user-form" disabled={isSaving} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] flex items-center transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100">
                        {isSaving ? (
                           <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                           <Save className="w-4 h-4 mr-2" /> 
                        )}
                        {isSaving ? 'PROCESANDO...' : 'GUARDAR CREDENCIALES'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
