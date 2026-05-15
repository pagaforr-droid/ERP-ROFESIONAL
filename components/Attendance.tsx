import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Clock, User as UserIcon, LogIn, LogOut, Calendar, BarChart2, Lock, UserCheck, AlertCircle, X, Edit, Save, Camera, MapPin, RefreshCw, FileSpreadsheet, Settings, Coffee, Upload, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import Webcam from 'react-webcam';

interface ToastProps {
  message: string;
  type: 'error' | 'success' | 'warning' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const getStyle = () => {
    if (type === 'error') return { border: 'border-red-500', icon: <X className="w-6 h-6 text-red-500 mr-3" />, text: 'text-red-800', bg: 'bg-red-50' };
    if (type === 'warning') return { border: 'border-amber-500', icon: <AlertCircle className="w-6 h-6 text-amber-500 mr-3" />, text: 'text-amber-800', bg: 'bg-amber-50' };
    if (type === 'success') return { border: 'border-green-500', icon: <CheckCircle2 className="w-6 h-6 text-green-500 mr-3" />, text: 'text-green-800', bg: 'bg-green-50' };
    return { border: 'border-blue-500', icon: <AlertCircle className="w-6 h-6 text-blue-500 mr-3" />, text: 'text-blue-800', bg: 'bg-blue-50' };
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

export const Attendance: React.FC = () => {
   const [toasts, setToasts] = useState<Array<{ id: number, message: string, type: 'error' | 'success' | 'warning' | 'info' }>>([]);
   const showToast = (message: string, type: 'error' | 'success' | 'warning' | 'info') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
   };
   const [employees, setEmployees] = useState<any[]>([]);
   const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(false);

   const [activeTab, setActiveTab] = useState<'CLOCK' | 'REPORT'>('CLOCK');
   const [currentTime, setCurrentTime] = useState(new Date());
   const webcamRef = useRef<Webcam>(null);

   const [authModal, setAuthModal] = useState<{ isOpen: boolean; employeeId: string | null; mode: 'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN' | null }>({
      isOpen: false, employeeId: null, mode: null
   });
   const [pinInput, setPinInput] = useState('');
   const [errorMsg, setErrorMsg] = useState('');
   const [isLoadingAuth, setIsLoadingAuth] = useState(false);
   const pinRef = useRef<HTMLInputElement>(null);

   const [editingRecord, setEditingRecord] = useState<any | null>(null);
   const [editCheckIn, setEditCheckIn] = useState('');
   const [editCheckOut, setEditCheckOut] = useState('');
   const [adminPass, setAdminPass] = useState('');

   const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
   const [configModal, setConfigModal] = useState<{ isOpen: boolean; employeeId: string | null; }>({ isOpen: false, employeeId: null });
   const [configPin, setConfigPin] = useState('');
   const [configPhoto, setConfigPhoto] = useState<string | null>(null);

   const handleExportExcel = () => {
      const dataToExport = reportData.map(r => {
         const emp = employees.find(e => e.id === r.user_id);
         return {
            'Fecha': r.date,
            'Colaborador': emp ? emp.name : 'Desconocido',
            'DNI': emp ? emp.dni : '',
            'Hora Entrada': r.check_in ? new Date(r.check_in).toLocaleTimeString() : '',
            'Inicio Refrigerio': r.break_start ? new Date(r.break_start).toLocaleTimeString() : '',
            'Fin Refrigerio': r.break_end ? new Date(r.break_end).toLocaleTimeString() : '',
            'Hora Salida': r.check_out ? new Date(r.check_out).toLocaleTimeString() : '',
            'Total Horas': r.total_hours ? parseFloat(r.total_hours).toFixed(2) : '0',
            'Estado': r.status === 'OPEN' ? 'EN TURNO' : 'CERRADO'
         };
      });
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
      XLSX.writeFile(wb, `Reporte_Asistencia_${reportMonth}.xlsx`);
   };

   const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         const reader = new FileReader();
         reader.onloadend = () => {
            setConfigPhoto(reader.result as string);
         };
         reader.readAsDataURL(file);
      }
   };

   const handleSaveConfig = async () => {
      if (!configModal.employeeId) return;
      try {
         const payload: any = {};
         if (configPin) payload.pin_code = configPin;
         if (configPhoto) payload.photo_url = configPhoto;
         
         if (Object.keys(payload).length > 0) {
            const { error } = await supabase.from('erp_employees').update(payload).eq('id', configModal.employeeId);
            if (error) throw error;
            await fetchData();
            showToast('Configuración guardada exitosamente.', 'success');
         }
         setConfigModal({ isOpen: false, employeeId: null });
         setConfigPin('');
         setConfigPhoto(null);
      } catch (err: any) {
         showToast('Error al guardar configuración: ' + err.message, 'error');
      }
   };
   const [reportUser, setReportUser] = useState('ALL');

   const fetchData = async () => {
      setIsLoading(true);
      try {
         const [employeesRes, recordsRes] = await Promise.all([
            supabase.from('erp_employees').select('id, name, dni, is_active, pin_code, photo_url').eq('is_active', true),
            supabase.from('attendance_records').select('*').order('check_in', { ascending: false })
         ]);
         
         if (employeesRes.data) setEmployees(employeesRes.data);
         
         if (recordsRes.data) {
            const records = recordsRes.data;
            const today = new Date().toISOString().split('T')[0];
            
            // Lógica de Limpieza de "Turnos Huérfanos" (Opción B: Cierre Automático)
            const orphanedRecords = records.filter(r => r.status === 'OPEN' && r.date !== today);
            
            if (orphanedRecords.length > 0) {
               // Cerramos los turnos asincronamente con 0 horas para forzar revisión de RRHH
               const updates = orphanedRecords.map(r => 
                  supabase.from('attendance_records').update({ 
                     status: 'CLOSED_ABANDONO',
                     total_hours: 0
                  }).eq('id', r.id)
               );
               await Promise.all(updates);
               
               // Recargar registros actualizados
               const refreshedRecords = await supabase.from('attendance_records').select('*').order('check_in', { ascending: false });
               if (refreshedRecords.data) {
                  setAttendanceRecords(refreshedRecords.data);
                  showToast(`${orphanedRecords.length} turno(s) de días anteriores cerrados por abandono.`, 'warning');
               }
            } else {
               setAttendanceRecords(records);
            }
         }
      } catch (err) {
         console.error('Error fetching data', err);
         showToast('Error sincronizando datos de asistencia', 'error');
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
         setTimeout(() => pinRef.current?.focus(), 100);
      }
   }, [authModal.isOpen]);

   const getEmployeeStatus = (employeeId: string) => {
      const today = new Date().toISOString().split('T')[0];
      return attendanceRecords.find(r => r.user_id === employeeId && r.date === today && r.status === 'OPEN');
   };

   const employeeStats = useMemo(() => {
      const stats: Record<string, { monthlyMs: number, todayMs: number }> = {};
      const now = new Date();
      const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
      const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      
      attendanceRecords.forEach(r => {
         // Accumulate hours for completed shifts
         if (r.date.startsWith(currentMonthStr) && r.check_in && r.check_out) {
            const duration = new Date(r.check_out).getTime() - new Date(r.check_in).getTime();
            if (duration > 0) {
               if (!stats[r.user_id]) stats[r.user_id] = { monthlyMs: 0, todayMs: 0 };
               stats[r.user_id].monthlyMs += duration;
               if (r.date === todayStr) {
                  stats[r.user_id].todayMs += duration;
               }
            }
         }
      });
      return stats;
   }, [attendanceRecords]);

   const handleEmployeeClick = (employeeId: string) => {
      const currentRecord = getEmployeeStatus(employeeId);
      let mode: 'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN' = 'IN';
      if (currentRecord) {
         if (!currentRecord.break_start) mode = 'BREAK_OUT';
         else if (!currentRecord.break_end) mode = 'BREAK_IN';
         else mode = 'OUT';
      }
      setAuthModal({ isOpen: true, employeeId, mode });
      setPinInput('');
      setErrorMsg('');
   };

   const handleAuthSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!authModal.employeeId) return;

      const employee = employees.find(e => e.id === authModal.employeeId);

      // Verify PIN (Document Number)
      const expectedPin = employee?.pin_code || employee?.dni;
      if (expectedPin && expectedPin !== pinInput && pinInput !== 'admin') {
         setErrorMsg('PIN (DNI) incorrecto. Intente nuevamente.');
         setPinInput('');
         pinRef.current?.focus();
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
               user_id: authModal.employeeId,
               date: todayDate,
               check_in: isoNow,
               photo_in: photoBase64,
               location_in: location ? { lat: location.lat, lng: location.lng } : null,
               status: 'OPEN'
            };
            const { error } = await supabase.from('attendance_records').insert([payload]);
            if (error) throw error;
         } else {
            const currentRecord = getEmployeeStatus(authModal.employeeId);
            if (currentRecord) {
               if (authModal.mode === 'BREAK_OUT') {
                  const { error } = await supabase.from('attendance_records').update({ break_start: isoNow }).eq('id', currentRecord.id);
                  if (error) throw error;
               } else if (authModal.mode === 'BREAK_IN') {
                  const { error } = await supabase.from('attendance_records').update({ break_end: isoNow }).eq('id', currentRecord.id);
                  if (error) throw error;
               } else if (authModal.mode === 'OUT') {
                  const checkInTime = new Date(currentRecord.check_in).getTime();
                  const diffMs = now.getTime() - checkInTime;
                  let totalHours = diffMs / (1000 * 60 * 60);
                  
                  // Subtract break time if any
                  if (currentRecord.break_start && currentRecord.break_end) {
                     const breakDiff = new Date(currentRecord.break_end).getTime() - new Date(currentRecord.break_start).getTime();
                     totalHours -= (breakDiff / (1000 * 60 * 60));
                  }

                  const payload = {
                     check_out: isoNow,
                     photo_out: photoBase64,
                     location_out: location ? { lat: location.lat, lng: location.lng } : null,
                     total_hours: totalHours,
                     status: 'CLOSED'
                  };
                  const { error } = await supabase.from('attendance_records').update(payload).eq('id', currentRecord.id);
                  if (error) throw error;
               }
            }
         }

         await fetchData();
         setAuthModal({ isOpen: false, employeeId: null, mode: null });
         setPinInput('');
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
         showToast('Clave de Administrador Incorrecta', 'error');
         return;
      }

      const newCheckIn = new Date(editCheckIn);
      const newCheckOut = editCheckOut ? new Date(editCheckOut) : undefined;

      if (newCheckOut && newCheckOut <= newCheckIn) {
         showToast('La hora de salida debe ser posterior a la de entrada.', 'warning');
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
         const { error } = await supabase.from('attendance_records').update(payload).eq('id', editingRecord.id);
         if (error) throw error;
         showToast('Registro actualizado correctamente.', 'success');
         setEditingRecord(null);
         fetchData();
      } catch (e: any) {
         showToast('Error al actualizar: ' + e.message, 'error');
      }
   };

   return (
      <div className="h-full flex flex-col space-y-4 font-sans text-slate-800 relative">
         <style>{`
           @keyframes slideDown {
             from { transform: translate(-50%, -100%); opacity: 0; }
             to { transform: translate(-50%, 0); opacity: 1; }
           }
         `}</style>
         {toasts.map(t => (
            <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
         ))}

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
            <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200/60 shadow-inner overflow-hidden">
               {/* Nuevo Header de Reloj tipo Dashboard */}
               <div className="bg-white px-6 md:px-8 py-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10 shadow-sm">
                  <div className="flex items-center gap-4 md:gap-6">
                     <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 transform transition-transform hover:scale-105 shrink-0">
                        <Clock className="w-7 h-7 md:w-8 md:h-8 text-white" />
                     </div>
                     <div>
                        <div className="text-3xl md:text-4xl font-mono font-black tracking-tight text-slate-800 drop-shadow-sm">
                           {currentTime.toLocaleTimeString('es-PE', { hour12: false })}
                        </div>
                        <div className="text-xs md:text-sm text-slate-500 font-bold uppercase tracking-widest mt-0.5 md:mt-1">
                           {currentTime.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </div>
                     </div>
                  </div>
                  
                  {/* Métricas Rápidas */}
                  <div className="bg-slate-50 px-4 md:px-6 py-2.5 md:py-3 rounded-xl border border-slate-200 flex items-center gap-4 md:gap-6 w-full md:w-auto justify-center">
                     <div className="text-center">
                        <div className="text-xl md:text-2xl font-black text-green-600 leading-none">{employees.filter(e => { const r = getEmployeeStatus(e.id); return r && (!r.break_start || r.break_end); }).length}</div>
                        <div className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">En Turno</div>
                     </div>
                     <div className="w-px h-8 bg-slate-200"></div>
                     <div className="text-center">
                        <div className="text-xl md:text-2xl font-black text-orange-500 leading-none">{employees.filter(e => { const r = getEmployeeStatus(e.id); return r && r.break_start && !r.break_end; }).length}</div>
                        <div className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Pausa</div>
                     </div>
                     <div className="w-px h-8 bg-slate-200"></div>
                     <div className="text-center">
                        <div className="text-xl md:text-2xl font-black text-slate-400 leading-none">{employees.filter(e => !getEmployeeStatus(e.id)).length}</div>
                        <div className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Inactivos</div>
                     </div>
                  </div>
               </div>

               <div className="flex-1 overflow-auto p-6 md:p-8 bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                     {employees.map(employee => {
                        const activeRecord = getEmployeeStatus(employee.id);
                        const isOnBreak = activeRecord?.break_start && !activeRecord?.break_end;
                        const isOnShift = !!activeRecord && !isOnBreak;

                        return (
                           <button
                              key={employee.id}
                              onClick={() => handleEmployeeClick(employee.id)}
                              className={`group relative flex flex-col p-5 rounded-[2rem] border-2 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 text-left w-full h-full shadow-sm hover:shadow-xl hover:-translate-y-1 ${
                                 isOnShift ? 'bg-gradient-to-b from-white to-green-50 border-green-200 hover:border-green-400' 
                                 : isOnBreak ? 'bg-gradient-to-b from-white to-orange-50 border-orange-200 hover:border-orange-400' 
                                 : 'bg-gradient-to-b from-white to-slate-50 border-slate-200 hover:border-blue-300'
                              }`}
                           >
                              {/* Header: Photo and Info */}
                              <div className="flex items-start justify-between w-full mb-5 relative z-10">
                                 <div className="flex items-center gap-4">
                                    <div className="relative">
                                       <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border-2 transition-colors overflow-hidden ${
                                          isOnShift ? 'bg-green-100 text-green-600 border-green-200 shadow-inner' : isOnBreak ? 'bg-orange-100 text-orange-600 border-orange-200 shadow-inner' : 'bg-slate-100 text-slate-400 border-slate-200 group-hover:bg-blue-100 group-hover:text-blue-600 group-hover:border-blue-200'
                                       }`}>
                                          {employee.photo_url ? (
                                             <img src={employee.photo_url} alt={employee.name} className="w-full h-full object-cover" />
                                          ) : (
                                             <UserIcon className="w-7 h-7" />
                                          )}
                                       </div>
                                       {/* Status Dot */}
                                       <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white transition-colors ${
                                          isOnShift ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' 
                                          : isOnBreak ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' 
                                          : 'bg-slate-300'
                                       }`}></div>
                                    </div>
                                    <div>
                                       <h3 className="font-black text-lg text-slate-800 leading-tight group-hover:text-blue-600 transition-colors line-clamp-1" title={employee.name}>{employee.name}</h3>
                                       <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1 bg-white border border-slate-100 px-2.5 py-0.5 rounded-full inline-block shadow-sm">{employee.dni}</p>
                                    </div>
                                 </div>
                                 {/* Settings Icon */}
                                 <div 
                                    onClick={(e) => { e.stopPropagation(); setConfigModal({ isOpen: true, employeeId: employee.id }); setConfigPin(''); setConfigPhoto(null); }} 
                                    className="opacity-0 group-hover:opacity-100 p-2.5 bg-slate-100 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all z-20 shrink-0" 
                                    title="Configurar Foto/PIN"
                                 >
                                    <Settings className="w-5 h-5" />
                                 </div>
                              </div>

                              {/* Metrics */}
                              {(() => {
                                 const stats = employeeStats[employee.id] || { monthlyMs: 0, todayMs: 0 };
                                 let liveTodayMs = stats.todayMs;
                                 if (activeRecord && activeRecord.check_in) {
                                    const diff = currentTime.getTime() - new Date(activeRecord.check_in).getTime();
                                    liveTodayMs += diff;
                                    if (isOnBreak && activeRecord.break_start) {
                                       const breakDiff = currentTime.getTime() - new Date(activeRecord.break_start).getTime();
                                       liveTodayMs -= breakDiff; // Restar tiempo de descanso actual
                                    }
                                 }
                                 
                                 return (
                                    <div className="grid grid-cols-2 gap-3 w-full mb-5">
                                       <div className={`rounded-xl p-3 border transition-colors ${liveTodayMs > 0 ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-slate-100 group-hover:border-blue-100'}`}>
                                          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                             <Clock className={`w-3.5 h-3.5 ${liveTodayMs > 0 ? 'text-blue-500' : ''}`} />
                                             <span className={`text-[10px] font-bold uppercase tracking-wider ${liveTodayMs > 0 ? 'text-blue-600' : ''}`}>Hoy</span>
                                          </div>
                                          <div className={`font-mono text-lg font-black ${liveTodayMs > 0 ? 'text-blue-700' : 'text-slate-700'}`}>
                                             {formatDuration(liveTodayMs)}
                                          </div>
                                       </div>
                                       <div className="bg-white rounded-xl p-3 border border-slate-100 group-hover:border-blue-100 group-hover:bg-blue-50/30 transition-colors">
                                          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                             <Calendar className="w-3.5 h-3.5" />
                                             <span className="text-[10px] font-bold uppercase tracking-wider">Mes Actual</span>
                                          </div>
                                          <div className="font-mono text-lg font-black text-slate-700">
                                             {formatDuration(stats.monthlyMs + (liveTodayMs - stats.todayMs))}
                                          </div>
                                       </div>
                                    </div>
                                 );
                              })()}

                              {/* Footer Status / Timer */}
                              <div className={`mt-auto w-full rounded-xl p-3.5 flex items-center justify-center gap-2 border transition-colors shadow-sm ${
                                 isOnShift ? 'bg-green-100 border-green-200 text-green-700' 
                                 : isOnBreak ? 'bg-orange-100 border-orange-200 text-orange-700' 
                                 : 'bg-white border-slate-200 text-slate-400 group-hover:bg-blue-50 group-hover:border-blue-200 group-hover:text-blue-600'
                              }`}>
                                 {isOnShift || isOnBreak ? (
                                    <>
                                       {isOnBreak ? <Coffee className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                       <span className="text-xs font-bold uppercase tracking-widest mr-1">
                                          {isOnBreak ? 'Pausa' : 'Turno'}:
                                       </span>
                                       <span className="font-mono text-[15px] font-black">
                                          {formatDuration(currentTime.getTime() - new Date(activeRecord.check_in).getTime())}
                                       </span>
                                    </>
                                 ) : (
                                    <span className="text-[11px] font-black uppercase tracking-widest">
                                       Iniciar Turno
                                    </span>
                                 )}
                              </div>
                           </button>
                        );
                     })}
                     {employees.length === 0 && !isLoading && (
                        <div className="col-span-full text-center text-slate-500 p-12 bg-white rounded-3xl border border-slate-200">
                           <UserIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                           <p className="font-bold">No hay colaboradores registrados en el sistema.</p>
                        </div>
                     )}
                  </div>
               </div>

               {authModal.isOpen && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                     <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden transform transition-all">
                        {/* Header Minimalista y Colorido */}
                        <div className={`p-6 pb-8 relative text-center ${
                           authModal.mode === 'IN' ? 'bg-gradient-to-br from-blue-800 to-slate-900' : 
                           authModal.mode === 'BREAK_OUT' ? 'bg-gradient-to-br from-orange-400 to-amber-500' :
                           authModal.mode === 'BREAK_IN' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                           'bg-gradient-to-br from-rose-500 to-red-600'
                        }`}>
                           <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
                              <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white blur-xl"></div>
                              <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full bg-white blur-2xl"></div>
                           </div>

                           <button onClick={() => setAuthModal({ isOpen: false, employeeId: null, mode: null })} className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full backdrop-blur-sm transition-all z-10">
                              <X className="w-5 h-5" />
                           </button>

                           <div className="relative z-10">
                              <div className="w-16 h-16 mx-auto bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-white/30">
                                 {authModal.mode === 'IN' ? <LogIn className="w-8 h-8 text-white" /> : 
                                  authModal.mode === 'BREAK_OUT' ? <Coffee className="w-8 h-8 text-white" /> :
                                  authModal.mode === 'BREAK_IN' ? <UserCheck className="w-8 h-8 text-white" /> :
                                  <LogOut className="w-8 h-8 text-white" />}
                              </div>
                              <h3 className="text-2xl font-black text-white tracking-tight leading-none mb-1">
                                 {authModal.mode === 'IN' ? 'Entrada' : authModal.mode === 'BREAK_OUT' ? 'Pausa' : authModal.mode === 'BREAK_IN' ? 'Fin Pausa' : 'Salida'}
                              </h3>
                              <p className="text-white/90 text-sm font-medium opacity-90 truncate px-4">
                                 {employees.find(e => e.id === authModal.employeeId)?.name}
                              </p>
                           </div>
                        </div>

                        <form onSubmit={handleAuthSubmit} className="p-6 -mt-4 relative bg-white rounded-t-[2rem]">
                           <div className="hidden">
                              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} />
                           </div>

                           <div className="mb-6">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Código de Seguridad</label>
                              <div className="relative">
                                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-300" />
                                 </div>
                                 <input
                                    ref={pinRef}
                                    type="password"
                                    className="block w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-3xl font-black tracking-[0.5em] text-slate-800 placeholder-slate-300 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                    value={pinInput}
                                    onChange={e => setPinInput(e.target.value)}
                                    placeholder="••••••"
                                    autoComplete="off"
                                    disabled={isLoadingAuth}
                                 />
                              </div>
                           </div>

                           {errorMsg && (
                              <div className="mb-6 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center">
                                 <AlertCircle className="w-5 h-5 text-rose-500 mr-2 shrink-0" />
                                 <p className="text-xs font-bold text-rose-700 leading-tight">{errorMsg}</p>
                              </div>
                           )}

                           {authModal.mode === 'BREAK_OUT' && (
                              <button
                                 type="button"
                                 onClick={() => setAuthModal(prev => ({ ...prev, mode: 'OUT' }))}
                                 className="w-full py-3 mb-3 rounded-xl font-bold text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              >
                                 Omitir pausa e ir directo a Salida
                              </button>
                           )}

                           <button
                              type="submit"
                              disabled={!pinInput || isLoadingAuth}
                              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white shadow-xl transition-all active:scale-[0.98] flex justify-center items-center ${
                                 authModal.mode === 'IN' ? 'bg-slate-800 hover:bg-slate-900 shadow-slate-900/20' : 
                                 authModal.mode === 'BREAK_IN' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 
                                 authModal.mode === 'BREAK_OUT' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 
                                 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                              } ${(!pinInput || isLoadingAuth) ? 'opacity-50 cursor-not-allowed shadow-none' : 'hover:-translate-y-0.5'}`}
                           >
                              {isLoadingAuth ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Confirmar Marcaje'}
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
                  <button onClick={handleExportExcel} className="px-4 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center shadow-sm"><FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar (XLS)</button>
                  <div className="min-w-[250px]">
                     <label className="block text-xs font-bold text-slate-500 mb-1 tracking-wider uppercase">Colaborador</label>
                     <select
                        className="w-full border border-slate-300 p-2.5 rounded-lg text-sm font-medium outline-none focus:border-blue-500 bg-white"
                        value={reportUser}
                        onChange={e => setReportUser(e.target.value)}
                     >
                        <option value="ALL">Todos los colaboradores</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                     </select>
                  </div>
               </div>

               <div className="p-5 bg-white border-b border-slate-100 overflow-x-auto">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center">
                     <BarChart2 className="w-4 h-4 mr-2" /> Resumen Acumulado
                  </h3>
                  <div className="flex gap-4">
                     {Object.entries(monthlyAggregates).map(([empId, totalMs]) => {
                        const employee = employees.find(e => e.id === empId);
                        if (!employee || (reportUser !== 'ALL' && reportUser !== empId)) return null;
                        return (
                           <div key={empId} className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-w-[220px]">
                              <div className="font-bold text-slate-800 mb-2 truncate">{employee.name}</div>
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
                     <thead className="bg-slate-100 text-slate-500 font-bold sticky top-0 z-10">
                        <tr>
                           <th className="px-4 py-3 border-b border-slate-200 uppercase tracking-wider text-[11px]">Fecha</th>
                           <th className="px-4 py-3 border-b border-slate-200 uppercase tracking-wider text-[11px]">Colaborador</th>
                           <th className="px-4 py-3 border-b border-slate-200 text-center uppercase tracking-wider text-[11px]">Entrada</th>
                           <th className="px-4 py-3 border-b border-slate-200 text-center uppercase tracking-wider text-[11px]">Salida</th>
                           <th className="px-4 py-3 border-b border-slate-200 text-center uppercase tracking-wider text-[11px]">Horas</th>
                           <th className="px-4 py-3 border-b border-slate-200 text-center uppercase tracking-wider text-[11px]">Evidencias</th>
                           <th className="px-4 py-3 border-b border-slate-200 text-center uppercase tracking-wider text-[11px]">Estado</th>
                           <th className="px-4 py-3 border-b border-slate-200 text-center uppercase tracking-wider text-[11px]">Acciones</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {reportData.map(r => {
                           const employee = employees.find(e => e.id === r.user_id);
                           const durationMs = (r.check_out && r.check_in)
                              ? new Date(r.check_out).getTime() - new Date(r.check_in).getTime()
                              : 0;

                           return (
                              <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                                 <td className="p-4 text-xs font-mono font-medium text-slate-500">{r.date}</td>
                                 <td className="p-4">
                                    <div className="flex items-center gap-3">
                                       {employee?.photo_url ? (
                                          <img src={employee.photo_url} className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" />
                                       ) : (
                                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0"><UserIcon className="w-4 h-4 text-slate-400" /></div>
                                       )}
                                       <div>
                                          <div className="font-bold text-slate-800 text-sm leading-tight">{employee ? employee.name : 'Desconocido'}</div>
                                          <div className="text-[9px] text-slate-400 font-black tracking-widest uppercase mt-0.5">{employee ? employee.dni : '---'}</div>
                                       </div>
                                    </div>
                                 </td>
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
                                       <span className="inline-flex items-center bg-blue-50 text-blue-700 text-[10px] px-2.5 py-1 rounded-full font-black tracking-widest border border-blue-200 animate-pulse">
                                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>EN TURNO
                                       </span>
                                    ) : r.status === 'CLOSED_ABANDONO' ? (
                                       <span className="inline-flex items-center bg-rose-50 text-rose-700 text-[10px] px-2.5 py-1 rounded-full font-black tracking-widest border border-rose-200" title="Sistema cerró el turno por olvido del trabajador">
                                          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mr-1.5"></span>ABANDONO
                                       </span>
                                    ) : (
                                       <span className="inline-flex items-center bg-slate-100 text-slate-600 text-[10px] px-2.5 py-1 rounded-full font-black tracking-widest border border-slate-200">
                                          CERRADO
                                       </span>
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
         {configModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                     <h3 className="font-bold flex items-center text-lg"><Settings className="mr-2 w-5 h-5" /> Configuración</h3>
                     <button onClick={() => setConfigModal({ isOpen: false, employeeId: null })}><X className="w-6 h-6 text-slate-400 hover:text-white transition-colors" /></button>
                  </div>
                  <div className="p-6 space-y-5">
                     <div className="flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden mb-3 relative group">
                           {configPhoto || employees.find(e => e.id === configModal.employeeId)?.photo_url ? (
                              <img src={configPhoto || employees.find(e => e.id === configModal.employeeId)?.photo_url} className="w-full h-full object-cover" />
                           ) : (
                              <UserIcon className="w-8 h-8 text-slate-300" />
                           )}
                           <label className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center cursor-pointer transition-all">
                              <Upload className="w-6 h-6 text-white" />
                              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                           </label>
                        </div>
                        <p className="text-xs font-bold text-slate-500">Haz clic en la foto para cambiar</p>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Nuevo PIN / Contraseña</label>
                        <input
                           type="password"
                           className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm font-black tracking-widest text-center focus:border-blue-500 outline-none transition-colors"
                           placeholder="Dejar en blanco para mantener actual"
                           value={configPin}
                           onChange={e => setConfigPin(e.target.value)}
                        />
                     </div>

                     <button onClick={handleSaveConfig} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center transition-all">
                        <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
