
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../services/store';
import { User, AttendanceRecord } from '../types';
import { Clock, User as UserIcon, LogIn, LogOut, Calendar, BarChart2, Lock, UserCheck, CheckCircle2, AlertCircle, X, Edit, Save } from 'lucide-react';

export const Attendance: React.FC = () => {
  const { users, attendanceRecords, clockIn, clockOut, updateAttendanceRecord } = useStore();
  const [activeTab, setActiveTab] = useState<'CLOCK' | 'REPORT'>('CLOCK');
  
  // Clock State
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Auth Modal State
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; userId: string | null; mode: 'IN' | 'OUT' | null }>({
     isOpen: false, userId: null, mode: null
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  // Edit Modal State (Admin)
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // Report State
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportUser, setReportUser] = useState('ALL');

  // --- TIMER ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Focus password input when modal opens
  useEffect(() => {
     if (authModal.isOpen) {
        setTimeout(() => passwordRef.current?.focus(), 100);
     }
  }, [authModal.isOpen]);

  const attendableUsers = useMemo(() => users.filter(u => u.requires_attendance && u.is_active), [users]);

  // --- HELPERS ---
  const getUserStatus = (userId: string) => {
     const today = new Date().toISOString().split('T')[0];
     // Find the record that is currently OPEN for today
     return attendanceRecords.find(r => r.user_id === userId && r.date === today && r.status === 'OPEN');
  };

  const handleUserClick = (userId: string) => {
     const currentRecord = getUserStatus(userId);
     const mode = currentRecord ? 'OUT' : 'IN';
     
     setAuthModal({ isOpen: true, userId, mode });
     setPasswordInput('');
     setErrorMsg('');
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!authModal.userId) return;

     const user = users.find(u => u.id === authModal.userId);
     
     // 1. Verify Password
     if (user?.password !== passwordInput) {
        setErrorMsg('Contraseña incorrecta. Intente nuevamente.');
        setPasswordInput('');
        passwordRef.current?.focus();
        return;
     }

     // 2. Execute Action
     if (authModal.mode === 'IN') {
        clockIn(authModal.userId);
     } else {
        clockOut(authModal.userId);
     }

     // 3. Close & Reset
     setAuthModal({ isOpen: false, userId: null, mode: null });
     setPasswordInput('');
  };

  const formatTime = (isoString?: string) => {
     if (!isoString) return '--:--:--';
     return new Date(isoString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (ms: number) => {
     const seconds = Math.floor((ms / 1000) % 60);
     const minutes = Math.floor((ms / (1000 * 60)) % 60);
     const hours = Math.floor(ms / (1000 * 60 * 60));
     return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // --- REPORT LOGIC ---
  const reportData = useMemo(() => {
     return attendanceRecords.filter(r => {
        const matchUser = reportUser === 'ALL' || r.user_id === reportUser;
        const matchMonth = r.date.startsWith(reportMonth);
        return matchUser && matchMonth;
     }).sort((a,b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime());
  }, [attendanceRecords, reportMonth, reportUser]);

  // Aggregate Total Hours per User for the selected month
  const monthlyAggregates = useMemo(() => {
     const aggregates: Record<string, number> = {}; // UserId -> Total MS
     
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

  // --- EDIT LOGIC ---
  const handleEditClick = (record: AttendanceRecord) => {
     setEditingRecord(record);
     // Format for datetime-local input (YYYY-MM-DDTHH:mm)
     const toLocalISO = (isoStr: string) => {
        const d = new Date(isoStr);
        // Adjust to local timezone for input
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().slice(0, 16);
     };

     setEditCheckIn(record.check_in ? toLocalISO(record.check_in) : '');
     setEditCheckOut(record.check_out ? toLocalISO(record.check_out) : '');
     setAdminPass('');
  };

  const handleSaveEdit = () => {
     if (!editingRecord) return;
     if (adminPass !== '123456') { // Mock Admin Password
        alert('Clave de Administrador Incorrecta');
        return;
     }
     
     // 1. Construct new dates
     const newCheckIn = new Date(editCheckIn);
     const newCheckOut = editCheckOut ? new Date(editCheckOut) : undefined;
     
     // 2. Validate
     if (newCheckOut && newCheckOut <= newCheckIn) {
        alert('La hora de salida debe ser posterior a la de entrada.');
        return;
     }

     // 3. Calc Duration
     let newTotalHours = 0;
     if (newCheckOut) {
        const diffMs = newCheckOut.getTime() - newCheckIn.getTime();
        newTotalHours = diffMs / (1000 * 60 * 60);
     }

     // 4. Update
     const updatedRecord: AttendanceRecord = {
        ...editingRecord,
        check_in: newCheckIn.toISOString(),
        check_out: newCheckOut ? newCheckOut.toISOString() : undefined,
        total_hours: newTotalHours,
        status: newCheckOut ? 'CLOSED' : 'OPEN'
     };

     updateAttendanceRecord(updatedRecord);
     setEditingRecord(null);
     alert('Registro actualizado correctamente.');
  };

  return (
    <div className="h-full flex flex-col space-y-4 font-sans text-slate-800 relative">
       
       <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center text-slate-800">
             <Clock className="mr-2 text-blue-600" /> Control de Asistencia
          </h2>
          <div className="flex bg-white rounded-lg border border-slate-300 p-1 shadow-sm">
             <button onClick={() => setActiveTab('CLOCK')} className={`px-4 py-2 text-sm font-bold rounded flex items-center transition-all ${activeTab === 'CLOCK' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>
                <UserCheck className="w-4 h-4 mr-2" /> Panel de Turnos
             </button>
             <button onClick={() => setActiveTab('REPORT')} className={`px-4 py-2 text-sm font-bold rounded flex items-center transition-all ${activeTab === 'REPORT' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>
                <BarChart2 className="w-4 h-4 mr-2" /> Reportes
             </button>
          </div>
       </div>

       {activeTab === 'CLOCK' && (
          <div className="flex-1 flex flex-col bg-slate-100 rounded-xl border border-slate-300 shadow-inner overflow-hidden relative">
             
             {/* HEADER CLOCK */}
             <div className="bg-slate-800 text-white p-6 flex flex-col items-center justify-center shadow-md z-10">
                <div className="text-6xl font-mono font-bold tracking-widest text-accent drop-shadow-lg">
                   {currentTime.toLocaleTimeString(undefined, { hour12: false })}
                </div>
                <div className="text-lg text-slate-300 mt-2 font-medium uppercase tracking-wide">
                   {currentTime.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
             </div>

             {/* USERS GRID */}
             <div className="flex-1 overflow-auto p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                   {attendableUsers.map(user => {
                      const activeRecord = getUserStatus(user.id);
                      const isOnShift = !!activeRecord;

                      return (
                         <button
                            key={user.id}
                            onClick={() => handleUserClick(user.id)}
                            className={`relative group flex flex-col items-center p-6 rounded-xl border-2 shadow-sm transition-all transform hover:scale-105 hover:shadow-xl ${
                               isOnShift 
                               ? 'bg-white border-green-500 ring-4 ring-green-50' 
                               : 'bg-white border-slate-200 hover:border-blue-400'
                            }`}
                         >
                            {/* Status Indicator */}
                            <div className={`absolute top-3 right-3 w-4 h-4 rounded-full ${isOnShift ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                            
                            {/* Icon */}
                            <div className={`p-4 rounded-full mb-4 ${isOnShift ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                               <UserIcon className="w-10 h-10" />
                            </div>

                            {/* Info */}
                            <h3 className="font-bold text-lg text-slate-800 mb-1">{user.name}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{user.role}</p>

                            {/* Active State Details */}
                            {isOnShift ? (
                               <div className="bg-green-50 text-green-800 px-3 py-1 rounded-full text-xs font-bold flex items-center border border-green-200">
                                  <LogIn className="w-3 h-3 mr-1" /> Entrada: {formatTime(activeRecord.check_in)}
                               </div>
                            ) : (
                               <div className="text-slate-400 text-xs font-medium">Click para Ingresar</div>
                            )}
                         </button>
                      );
                   })}
                </div>
             </div>

             {/* --- AUTH MODAL --- */}
             {authModal.isOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                   <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
                      <div className={`p-6 text-center ${authModal.mode === 'IN' ? 'bg-green-600' : 'bg-red-500'} text-white`}>
                         {authModal.mode === 'IN' ? <LogIn className="w-12 h-12 mx-auto mb-2" /> : <LogOut className="w-12 h-12 mx-auto mb-2" />}
                         <h3 className="text-2xl font-bold uppercase">
                            {authModal.mode === 'IN' ? 'Registrar Ingreso' : 'Registrar Salida'}
                         </h3>
                         <p className="text-white/80 text-sm mt-1">
                            {users.find(u => u.id === authModal.userId)?.name}
                         </p>
                      </div>
                      
                      <form onSubmit={handleAuthSubmit} className="p-8">
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-2 text-center">Ingrese su Contraseña</label>
                         <div className="relative mb-6">
                            <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                            <input 
                               ref={passwordRef}
                               type="password" 
                               className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg text-center text-xl font-bold tracking-widest focus:border-blue-500 focus:ring-0 outline-none transition-colors"
                               value={passwordInput}
                               onChange={e => setPasswordInput(e.target.value)}
                               placeholder="••••••"
                               autoComplete="off"
                            />
                         </div>
                         
                         {errorMsg && (
                            <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs font-bold text-center flex items-center justify-center">
                               <AlertCircle className="w-4 h-4 mr-1"/> {errorMsg}
                            </div>
                         )}

                         <div className="grid grid-cols-2 gap-3">
                            <button 
                               type="button" 
                               onClick={() => { setAuthModal({ isOpen: false, userId: null, mode: null }); setErrorMsg(''); }}
                               className="py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100 border border-slate-200"
                            >
                               Cancelar
                            </button>
                            <button 
                               type="submit" 
                               disabled={!passwordInput}
                               className={`py-3 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95 ${authModal.mode === 'IN' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                               CONFIRMAR
                            </button>
                         </div>
                      </form>
                   </div>
                </div>
             )}
          </div>
       )}

       {activeTab === 'REPORT' && (
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
             {/* FILTER BAR */}
             <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-end">
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Periodo (Mes)</label>
                   <input 
                      type="month" 
                      className="border border-slate-300 p-2 rounded text-sm font-bold"
                      value={reportMonth}
                      onChange={e => setReportMonth(e.target.value)}
                   />
                </div>
                <div className="min-w-[200px]">
                   <label className="block text-xs font-bold text-slate-500 mb-1">Colaborador</label>
                   <select 
                      className="w-full border border-slate-300 p-2 rounded text-sm"
                      value={reportUser}
                      onChange={e => setReportUser(e.target.value)}
                   >
                      <option value="ALL">Todos</option>
                      {attendableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                   </select>
                </div>
             </div>

             {/* MONTHLY SUMMARY CARDS */}
             <div className="p-4 bg-slate-50 border-b border-slate-200 overflow-x-auto">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center">
                   <BarChart2 className="w-3 h-3 mr-1"/> Resumen Acumulado Mes
                </h3>
                <div className="flex gap-4">
                   {Object.entries(monthlyAggregates).map(([userId, totalMs]) => {
                      const user = users.find(u => u.id === userId);
                      if (!user || (reportUser !== 'ALL' && reportUser !== userId)) return null;
                      return (
                         <div key={userId} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm min-w-[200px]">
                            <div className="font-bold text-slate-800 mb-1">{user.name}</div>
                            <div className="text-2xl font-mono font-bold text-blue-700">{formatDuration(Number(totalMs))}</div>
                            <div className="text-[10px] text-slate-400">Horas Totales Acumuladas</div>
                         </div>
                      );
                   })}
                   {Object.keys(monthlyAggregates).length === 0 && (
                      <div className="text-sm text-slate-400 italic">No hay datos acumulados para este periodo.</div>
                   )}
                </div>
             </div>

             {/* TABLE */}
             <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                   <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                      <tr>
                         <th className="p-3">Fecha</th>
                         <th className="p-3">Colaborador</th>
                         <th className="p-3 text-center">Hora Entrada</th>
                         <th className="p-3 text-center">Hora Salida</th>
                         <th className="p-3 text-center">Tiempo (HH:MM:SS)</th>
                         <th className="p-3 text-center">Estado</th>
                         <th className="p-3 text-center">Acciones</th>
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
                               <td className="p-3 font-mono text-slate-600">{r.date}</td>
                               <td className="p-3 font-bold text-slate-800">{user?.name}</td>
                               <td className="p-3 text-center text-green-700 font-medium bg-green-50/50 rounded">{formatTime(r.check_in)}</td>
                               <td className="p-3 text-center text-red-700 font-medium bg-red-50/50 rounded">{formatTime(r.check_out)}</td>
                               <td className="p-3 text-center font-bold font-mono text-blue-800">
                                  {durationMs > 0 ? formatDuration(durationMs) : '--:--:--'}
                               </td>
                               <td className="p-3 text-center">
                                  {r.status === 'OPEN' ? (
                                     <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold animate-pulse">EN TURNO</span>
                                  ) : (
                                     <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded font-bold">CERRADO</span>
                                  )}
                               </td>
                               <td className="p-3 text-center">
                                  <button onClick={() => handleEditClick(r)} className="text-slate-400 hover:text-blue-600" title="Editar Asistencia (Admin)">
                                     <Edit className="w-4 h-4" />
                                  </button>
                               </td>
                            </tr>
                         );
                      })}
                      {reportData.length === 0 && (
                         <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No hay registros de asistencia para este filtro.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
       )}

       {/* EDIT MODAL (ADMIN ONLY) */}
       {editingRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
             <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                   <h3 className="font-bold flex items-center"><Edit className="mr-2 w-4 h-4"/> Editar Asistencia</h3>
                   <button onClick={() => setEditingRecord(null)}><X className="w-5 h-5 text-slate-400 hover:text-white"/></button>
                </div>
                <div className="p-6 space-y-4">
                   <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 text-xs text-yellow-800 mb-4">
                      <strong>Solo Administrador:</strong> Esta acción recalculará las horas trabajadas. Ingrese la clave de autorización.
                   </div>
                   
                   <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Hora Entrada</label>
                      <input 
                         type="datetime-local" 
                         className="w-full border border-slate-300 rounded p-2 text-sm"
                         value={editCheckIn}
                         onChange={e => setEditCheckIn(e.target.value)}
                      />
                   </div>
                   
                   <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Hora Salida</label>
                      <input 
                         type="datetime-local" 
                         className="w-full border border-slate-300 rounded p-2 text-sm"
                         value={editCheckOut}
                         onChange={e => setEditCheckOut(e.target.value)}
                      />
                   </div>

                   <div className="pt-4 border-t border-slate-100">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Clave Admin (123456)</label>
                      <input 
                         type="password"
                         className="w-full border border-slate-300 rounded p-2 text-sm font-bold tracking-widest text-center"
                         placeholder="••••••"
                         value={adminPass}
                         onChange={e => setAdminPass(e.target.value)}
                      />
                   </div>

                   <div className="flex justify-end gap-2 pt-2">
                      <button onClick={() => setEditingRecord(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded">Cancelar</button>
                      <button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold shadow flex items-center">
                         <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                      </button>
                   </div>
                </div>
             </div>
          </div>
       )}
    </div>
  );
};
