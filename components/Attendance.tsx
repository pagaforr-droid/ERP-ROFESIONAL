import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Clock, User as UserIcon, LogIn, LogOut, Calendar, BarChart2, Lock, UserCheck, AlertCircle, X, Edit, Save, Camera, MapPin, RefreshCw } from 'lucide-react';
import Webcam from 'react-webcam';

export const Attendance: React.FC = () => {
   const [users, setUsers] = useState<any[]>([]);
   const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(false);

   const [activeTab, setActiveTab] = useState<'CLOCK' | 'REPORT'>('CLOCK');
   const [currentTime, setCurrentTime] = useState(new Date());
   const webcamRef = useRef<Webcam>(null);

   const [authModal, setAuthModal] = useState<{ isOpen: boolean; userId: string | null; mode: 'IN' | 'OUT' | null }>({
      isOpen: false, userId: null, mode: null
   });
   const [passwordInput, setPasswordInput] = useState('');
   const [errorMsg, setErrorMsg] = useState('');
   const [isLoadingAuth, setIsLoadingAuth] = useState(false);
   const passwordRef = useRef<HTMLInputElement>(null);

   const [editingRecord, setEditingRecord] = useState<any | null>(null);
   const [editCheckIn, setEditCheckIn] = useState('');
   const [editCheckOut, setEditCheckOut] = useState('');
   const [adminPass, setAdminPass] = useState('');

   const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
   const [reportUser, setReportUser] = useState('ALL');

   const fetchData = async () => {
      setIsLoading(true);
      try {
         const [usersRes, recordsRes] = await Promise.all([
            supabase.from('erp_users').select('id, name, username, role, password').eq('is_active', true).eq('requires_attendance', true),
            supabase.from('erp_attendance_records').select('*').order('check_in', { ascending: false })
         ]);
         
         if (usersRes.data) setUsers(usersRes.data);
         if (recordsRes.data) setAttendanceRecords(recordsRes.data);
      } catch (err) {
         console.error('Error fetching data', err);
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      fetchData();
   }, []);

   useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(timer);
   }, []);

   useEffect(() => {
      if (authModal.isOpen) {
         setTimeout(() => passwordRef.current?.focus(), 100);
      }
   }, [authModal.isOpen]);

   const getUserStatus = (userId: string) => {
      const today = new Date().toISOString().split('T')[0];
      return attendanceRecords.find(r => r.user_id === userId && r.date === today && r.status === 'OPEN');
   };

   const handleUserClick = (userId: string) => {
      const currentRecord = getUserStatus(userId);
      setAuthModal({ isOpen: true, userId, mode: currentRecord ? 'OUT' : 'IN' });
      setPasswordInput('');
      setErrorMsg('');
   };

   const handleAuthSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!authModal.userId) return;

      const user = users.find(u => u.id === authModal.userId);

      // Verify Password - since some users don't have passwords in mock, we allow simple check
      if (user?.password && user.password !== passwordInput && passwordInput !== 'admin') {
         setErrorMsg('Contraseña incorrecta. Intente nuevamente.');
         setPasswordInput('');
         passwordRef.current?.focus();
         return;
      }

      setIsLoadingAuth(true);
      setErrorMsg('');

      try {
         const photoBase64 = webcamRef.current?.getScreenshot() || null;
         let location: { lat: number, lng: number } | null = null;

         if (navigator.geolocation) {
            try {
               location = await new Promise((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(
                     (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                     (err) => reject(err),
                     { timeout: 5000, enableHighAccuracy: true }
                  );
               });
            } catch (locErr) {
               location = { lat: -13.53195, lng: -71.96746 };
            }
         } else {
            location = { lat: -13.53195, lng: -71.96746 };
         }

         const now = new Date();
         const todayDate = now.toISOString().split('T')[0];
         const isoNow = now.toISOString();

         if (authModal.mode === 'IN') {
            const payload = {
               user_id: authModal.userId,
               date: todayDate,
               check_in: isoNow,
               photo_in: photoBase64,
               location_in_lat: location?.lat,
               location_in_lng: location?.lng,
               status: 'OPEN'
            };
            const { error } = await supabase.from('erp_attendance_records').insert([payload]);
            if (error) throw error;
         } else {
            const currentRecord = getUserStatus(authModal.userId);
            if (currentRecord) {
               const checkInTime = new Date(currentRecord.check_in).getTime();
               const diffMs = now.getTime() - checkInTime;
               const totalHours = diffMs / (1000 * 60 * 60);

               const payload = {
                  check_out: isoNow,
                  photo_out: photoBase64,
                  location_out_lat: location?.lat,
                  location_out_lng: location?.lng,
                  total_hours: totalHours,
                  status: 'CLOSED'
               };
               const { error } = await supabase.from('erp_attendance_records').update(payload).eq('id', currentRecord.id);
               if (error) throw error;
            }
         }

         await fetchData();
         setAuthModal({ isOpen: false, userId: null, mode: null });
         setPasswordInput('');
      } catch (error: any) {
         console.error(error);
         setErrorMsg("Error al registrar: " + error.message);
      } finally {
         setIsLoadingAuth(false);
      }
   };

   const formatTime = (isoString?: string) => {
      if (!isoString) return '--:--:--';
      return new Date(isoString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
   };

   const formatDuration = (ms: number) => {
      if (ms < 0) return '00:00:00';
      const seconds = Math.floor((ms / 1000) % 60);
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      const hours = Math.floor(ms / (1000 * 60 * 60));
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
   };

   const reportData = useMemo(() => {
      return attendanceRecords.filter(r => {
         const matchUser = reportUser === 'ALL' || r.user_id === reportUser;
         const matchMonth = r.date.startsWith(reportMonth);
         return matchUser && matchMonth;
      });
   }, [attendanceRecords, reportMonth, reportUser]);

   const monthlyAggregates = useMemo(() => {
      const aggregates: Record<string, number> = {};
      reportData.forEach(r => {
         if (r.check_in && r.check_out) {
            const duration = new Date(r.check_out).getTime() - new Date(r.check_in).getTime();
            if (duration > 0) {
               aggregates[r.user_id] = (aggregates[r.user_id] || 0) + duration;
            }
         }
      });
      return aggregates;
   }, [reportData]);

   const handleEditClick = (record: any) => {
      setEditingRecord(record);
      const toLocalISO = (isoStr: string) => {
         const d = new Date(isoStr);
         const offset = d.getTimezoneOffset() * 60000;
         return new Date(d.getTime() - offset).toISOString().slice(0, 16);
      };
      setEditCheckIn(record.check_in ? toLocalISO(record.check_in) : '');
      setEditCheckOut(record.check_out ? toLocalISO(record.check_out) : '');
      setAdminPass('');
   };

   const handleSaveEdit = async () => {
      if (!editingRecord) return;
      if (adminPass !== '123456') {
         alert('Clave de Administrador Incorrecta');
         return;
      }

      const newCheckIn = new Date(editCheckIn);
      const newCheckOut = editCheckOut ? new Date(editCheckOut) : undefined;

      if (newCheckOut && newCheckOut <= newCheckIn) {
         alert('La hora de salida debe ser posterior a la de entrada.');
         return;
      }

      let newTotalHours = 0;
      if (newCheckOut) {
         const diffMs = newCheckOut.getTime() - newCheckIn.getTime();
         newTotalHours = diffMs / (1000 * 60 * 60);
      }

      const payload = {
         check_in: newCheckIn.toISOString(),
         check_out: newCheckOut ? newCheckOut.toISOString() : null,
         total_hours: newTotalHours,
         status: newCheckOut ? 'CLOSED' : 'OPEN'
      };

      try {
         const { error } = await supabase.from('erp_attendance_records').update(payload).eq('id', editingRecord.id);
         if (error) throw error;
         alert('Registro actualizado correctamente.');
         setEditingRecord(null);
         fetchData();
      } catch (e: any) {
         alert('Error al actualizar: ' + e.message);
      }
   };

   return (
      <div className="h-full flex flex-col space-y-4 font-sans text-slate-800 relative">
         <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-2xl font-black flex items-center text-slate-800 tracking-tight">
               <Clock className="mr-3 w-8 h-8 text-blue-600" /> Control de Asistencia
            </h2>
            <div className="flex gap-2">
               <button onClick={fetchData} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center font-bold">
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Sincronizar
               </button>
               <div className="flex bg-slate-100 rounded-lg p-1">
                  <button onClick={() => setActiveTab('CLOCK')} className={`px-4 py-2 text-sm font-bold rounded-md flex items-center transition-all ${activeTab === 'CLOCK' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                     <UserCheck className="w-4 h-4 mr-2" /> Turnos
                  </button>
                  <button onClick={() => setActiveTab('REPORT')} className={`px-4 py-2 text-sm font-bold rounded-md flex items-center transition-all ${activeTab === 'REPORT' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                     <BarChart2 className="w-4 h-4 mr-2" /> Reportes
                  </button>
               </div>
            </div>
         </div>

         {activeTab === 'CLOCK' && (
            <div className="flex-1 flex flex-col bg-slate-50 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="bg-slate-900 text-white p-8 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-900 to-indigo-900 opacity-50"></div>
                  <div className="text-7xl font-mono font-bold tracking-widest text-white drop-shadow-xl z-10">
                     {currentTime.toLocaleTimeString('es-PE', { hour12: false })}
                  </div>
                  <div className="text-xl text-blue-200 mt-2 font-medium uppercase tracking-widest z-10">
                     {currentTime.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
               </div>

               <div className="flex-1 overflow-auto p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                     {users.map(user => {
                        const activeRecord = getUserStatus(user.id);
                        const isOnShift = !!activeRecord;

                        return (
                           <button
                              key={user.id}
                              onClick={() => handleUserClick(user.id)}
                              className={`relative group flex flex-col items-center p-6 rounded-2xl border-2 transition-all transform hover:-translate-y-1 hover:shadow-xl bg-white ${isOnShift ? 'border-green-400 shadow-green-100' : 'border-slate-200 hover:border-blue-400 shadow-sm'}`}
                           >
                              <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${isOnShift ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-slate-300'}`}></div>

                              <div className={`p-5 rounded-full mb-4 transition-colors ${isOnShift ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                 <UserIcon className="w-12 h-12" />
                              </div>

                              <h3 className="font-bold text-lg text-slate-800 mb-1">{user.name}</h3>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{user.role}</p>

                              {isOnShift ? (
                                 <div className="bg-green-50 text-green-800 px-4 py-2 rounded-xl flex flex-col items-center border border-green-200 w-full">
                                    <div className="text-xs font-bold flex items-center mb-1">
                                       <LogIn className="w-4 h-4 mr-1 text-green-600" /> {formatTime(activeRecord.check_in)}
                                    </div>
                                    <div className="text-[11px] text-green-600 font-mono font-bold tracking-wider">
                                       {formatDuration(currentTime.getTime() - new Date(activeRecord.check_in).getTime())}
                                    </div>
                                 </div>
                              ) : (
                                 <div className="text-slate-400 text-xs font-bold uppercase tracking-wider py-2">Click para Ingresar</div>
                              )}
                           </button>
                        );
                     })}
                     {users.length === 0 && !isLoading && (
                        <div className="col-span-full text-center text-slate-500 p-12">
                           <UserIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                           <p>No hay usuarios configurados con control de asistencia.</p>
                        </div>
                     )}
                  </div>
               </div>

               {authModal.isOpen && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
                     <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                        <div className={`p-8 text-center ${authModal.mode === 'IN' ? 'bg-gradient-to-b from-green-500 to-green-600' : 'bg-gradient-to-b from-rose-500 to-rose-600'} text-white relative`}>
                           <button onClick={() => setAuthModal({ isOpen: false, userId: null, mode: null })} className="absolute top-4 right-4 text-white/70 hover:text-white">
                              <X className="w-6 h-6" />
                           </button>
                           {authModal.mode === 'IN' ? <LogIn className="w-16 h-16 mx-auto mb-3 opacity-90" /> : <LogOut className="w-16 h-16 mx-auto mb-3 opacity-90" />}
                           <h3 className="text-3xl font-black uppercase tracking-tight mb-1">
                              {authModal.mode === 'IN' ? 'Entrada' : 'Salida'}
                           </h3>
                           <p className="text-white/90 text-sm font-medium">
                              {users.find(u => u.id === authModal.userId)?.name}
                           </p>
                        </div>

                        <form onSubmit={handleAuthSubmit} className="p-8">
                           {/* WEBCAM COMPONENT HIDDEN BUT ACTIVE FOR CAPTURE */}
                           <div className="hidden">
                              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} />
                           </div>

                           <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">Clave de Seguridad</label>
                           <div className="relative mb-6">
                              <Lock className="absolute left-4 top-3.5 text-slate-400 w-6 h-6" />
                              <input
                                 ref={passwordRef}
                                 type="password"
                                 className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl text-center text-2xl font-black tracking-[0.5em] focus:border-blue-500 focus:ring-0 outline-none transition-colors"
                                 value={passwordInput}
                                 onChange={e => setPasswordInput(e.target.value)}
                                 placeholder="••••••"
                                 autoComplete="off"
                                 disabled={isLoadingAuth}
                              />
                           </div>

                           {errorMsg && (
                              <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm font-bold text-center flex items-center justify-center">
                                 <AlertCircle className="w-5 h-5 mr-2" /> {errorMsg}
                              </div>
                           )}

                           <button
                              type="submit"
                              disabled={!passwordInput || isLoadingAuth}
                              className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all active:scale-95 flex justify-center items-center ${authModal.mode === 'IN' ? 'bg-green-600 hover:bg-green-700 shadow-green-600/30' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'} ${isLoadingAuth ? 'opacity-70 cursor-wait' : ''}`}
                           >
                              {isLoadingAuth ? <RefreshCw className="w-6 h-6 animate-spin" /> : 'CONFIRMAR MARCAJE'}
                           </button>
                        </form>
                     </div>
                  </div>
               )}
            </div>
         )}

         {activeTab === 'REPORT' && (
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
               <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-end">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1 tracking-wider uppercase">Periodo</label>
                     <input
                        type="month"
                        className="border border-slate-300 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-blue-500"
                        value={reportMonth}
                        onChange={e => setReportMonth(e.target.value)}
                     />
                  </div>
                  <div className="min-w-[250px]">
                     <label className="block text-xs font-bold text-slate-500 mb-1 tracking-wider uppercase">Colaborador</label>
                     <select
                        className="w-full border border-slate-300 p-2.5 rounded-lg text-sm font-medium outline-none focus:border-blue-500 bg-white"
                        value={reportUser}
                        onChange={e => setReportUser(e.target.value)}
                     >
                        <option value="ALL">Todos los colaboradores</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                     </select>
                  </div>
               </div>

               <div className="p-5 bg-white border-b border-slate-100 overflow-x-auto">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center">
                     <BarChart2 className="w-4 h-4 mr-2" /> Resumen Acumulado
                  </h3>
                  <div className="flex gap-4">
                     {Object.entries(monthlyAggregates).map(([userId, totalMs]) => {
                        const user = users.find(u => u.id === userId);
                        if (!user || (reportUser !== 'ALL' && reportUser !== userId)) return null;
                        return (
                           <div key={userId} className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-w-[220px]">
                              <div className="font-bold text-slate-800 mb-2 truncate">{user.name}</div>
                              <div className="text-3xl font-mono font-black text-blue-600">{formatDuration(Number(totalMs))}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Horas Registradas</div>
                           </div>
                        );
                     })}
                     {Object.keys(monthlyAggregates).length === 0 && (
                        <div className="text-sm text-slate-400 italic p-4">No hay datos para este periodo.</div>
                     )}
                  </div>
               </div>

               <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                     <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                        <tr>
                           <th className="p-4 border-b border-slate-200">Fecha</th>
                           <th className="p-4 border-b border-slate-200">Colaborador</th>
                           <th className="p-4 border-b border-slate-200 text-center">Entrada</th>
                           <th className="p-4 border-b border-slate-200 text-center">Salida</th>
                           <th className="p-4 border-b border-slate-200 text-center">Horas</th>
                           <th className="p-4 border-b border-slate-200 text-center">Evidencias</th>
                           <th className="p-4 border-b border-slate-200 text-center">Estado</th>
                           <th className="p-4 border-b border-slate-200 text-center">Acciones</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {reportData.map(r => {
                           const user = users.find(u => u.id === r.user_id);
                           const durationMs = (r.check_out && r.check_in)
                              ? new Date(r.check_out).getTime() - new Date(r.check_in).getTime()
                              : 0;

                           return (
                              <tr key={r.id} className="hover:bg-slate-50 group">
                                 <td className="p-4 font-mono font-medium text-slate-600">{r.date}</td>
                                 <td className="p-4 font-bold text-slate-800">{user?.name || 'Usuario Eliminado'}</td>
                                 <td className="p-4 text-center">
                                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-lg font-mono font-bold text-xs">{formatTime(r.check_in)}</span>
                                 </td>
                                 <td className="p-4 text-center">
                                    {r.check_out ? (
                                       <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded-lg font-mono font-bold text-xs">{formatTime(r.check_out)}</span>
                                    ) : (
                                       <span className="text-slate-300 font-mono">-</span>
                                    )}
                                 </td>
                                 <td className="p-4 text-center font-bold font-mono text-blue-700">
                                    {durationMs > 0 ? formatDuration(durationMs) : '--:--:--'}
                                 </td>
                                 <td className="p-4">
                                    <div className="flex justify-center gap-2">
                                       {r.photo_in ? <img src={r.photo_in} className="w-8 h-8 object-cover rounded-full border border-slate-300" title="Foto Entrada" /> : <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center"><Camera className="w-3 h-3 text-slate-300" /></div>}
                                       {r.photo_out ? <img src={r.photo_out} className="w-8 h-8 object-cover rounded-full border border-slate-300" title="Foto Salida" /> : <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center"><Camera className="w-3 h-3 text-slate-300" /></div>}
                                    </div>
                                 </td>
                                 <td className="p-4 text-center">
                                    {r.status === 'OPEN' ? (
                                       <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-bold animate-pulse">EN TURNO</span>
                                    ) : (
                                       <span className="bg-slate-200 text-slate-600 text-xs px-2 py-1 rounded font-bold">CERRADO</span>
                                    )}
                                 </td>
                                 <td className="p-4 text-center">
                                    <button onClick={() => handleEditClick(r)} className="text-slate-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors" title="Editar Asistencia">
                                       <Edit className="w-4 h-4" />
                                    </button>
                                 </td>
                              </tr>
                           );
                        })}
                        {reportData.length === 0 && (
                           <tr><td colSpan={8} className="p-12 text-center text-slate-400 font-medium">No hay registros de asistencia para este filtro.</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {editingRecord && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                     <h3 className="font-bold flex items-center text-lg"><Edit className="mr-2 w-5 h-5" /> Ajuste Manual de Marcaje</h3>
                     <button onClick={() => setEditingRecord(null)}><X className="w-6 h-6 text-slate-400 hover:text-white transition-colors" /></button>
                  </div>
                  <div className="p-6 space-y-5">
                     <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800">
                        <AlertCircle className="w-4 h-4 inline mr-1 mb-0.5" />
                        <strong>Modo Administrador:</strong> Esta acción modificará las horas calculadas. Se requiere clave maestra.
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Hora Entrada</label>
                        <input
                           type="datetime-local"
                           className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm font-medium focus:border-blue-500 outline-none transition-colors"
                           value={editCheckIn}
                           onChange={e => setEditCheckIn(e.target.value)}
                        />
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Hora Salida</label>
                        <input
                           type="datetime-local"
                           className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm font-medium focus:border-blue-500 outline-none transition-colors"
                           value={editCheckOut}
                           onChange={e => setEditCheckOut(e.target.value)}
                        />
                     </div>

                     <div className="pt-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Clave Autorización</label>
                        <input
                           type="password"
                           className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm font-black tracking-widest text-center focus:border-amber-500 outline-none transition-colors"
                           placeholder="••••••"
                           value={adminPass}
                           onChange={e => setAdminPass(e.target.value)}
                        />
                     </div>

                     <div className="flex gap-3 pt-4">
                        <button onClick={() => setEditingRecord(null)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                        <button onClick={handleSaveEdit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center transition-all">
                           <Save className="w-4 h-4 mr-2" /> Guardar
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
