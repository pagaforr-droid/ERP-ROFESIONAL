import re

with open('components/Attendance.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { Clock, User as UserIcon, LogIn, LogOut, Calendar, BarChart2, Lock, UserCheck, AlertCircle, X, Edit, Save, Camera, MapPin, RefreshCw } from 'lucide-react';",
    "import { Clock, User as UserIcon, LogIn, LogOut, Calendar, BarChart2, Lock, UserCheck, AlertCircle, X, Edit, Save, Camera, MapPin, RefreshCw, FileSpreadsheet, Settings, Coffee, Upload } from 'lucide-react';\nimport * as XLSX from 'xlsx';"
)

# 2. State & Excel & Modals
content = content.replace(
    "const [authModal, setAuthModal] = useState<{ isOpen: boolean; employeeId: string | null; mode: 'IN' | 'OUT' | null }>({",
    "const [authModal, setAuthModal] = useState<{ isOpen: boolean; employeeId: string | null; mode: 'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN' | null }>({"
)

state_additions = """   const [configModal, setConfigModal] = useState<{ isOpen: boolean; employeeId: string | null; }>({ isOpen: false, employeeId: null });
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
            alert('Configuración guardada exitosamente.');
         }
         setConfigModal({ isOpen: false, employeeId: null });
         setConfigPin('');
         setConfigPhoto(null);
      } catch (err: any) {
         alert('Error al guardar configuración: ' + err.message);
      }
   };
"""
content = content.replace(
    "const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));",
    "const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));\n" + state_additions
)

# 3. Employee click
content = content.replace(
    "const handleEmployeeClick = (employeeId: string) => {\n      const currentRecord = getEmployeeStatus(employeeId);\n      setAuthModal({ isOpen: true, employeeId, mode: currentRecord ? 'OUT' : 'IN' });",
    """const handleEmployeeClick = (employeeId: string) => {
      const currentRecord = getEmployeeStatus(employeeId);
      let mode: 'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN' = 'IN';
      if (currentRecord) {
         if (!currentRecord.break_start) mode = 'BREAK_OUT';
         else if (!currentRecord.break_end) mode = 'BREAK_IN';
         else mode = 'OUT';
      }
      setAuthModal({ isOpen: true, employeeId, mode });"""
)

# 4. Auth Submit logic
auth_submit_old = """         if (authModal.mode === 'IN') {
            const payload = {
               user_id: authModal.employeeId, // Usamos la columna user_id existente
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
               const checkInTime = new Date(currentRecord.check_in).getTime();
               const diffMs = now.getTime() - checkInTime;
               const totalHours = diffMs / (1000 * 60 * 60);

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
         }"""

auth_submit_new = """         if (authModal.mode === 'IN') {
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
         }"""
content = content.replace(auth_submit_old, auth_submit_new)

# 5. PIN Verification
content = content.replace(
    "if (employee?.dni && employee.dni !== pinInput && pinInput !== 'admin') {",
    "const expectedPin = employee?.pin_code || employee?.dni;\n      if (expectedPin && expectedPin !== pinInput && pinInput !== 'admin') {"
)

# 6. handleSaveEdit bug fix
content = content.replace(
    "const { error } = await supabase.from('erp_attendance_records').update(payload).eq('id', editingRecord.id);",
    "const { error } = await supabase.from('attendance_records').update(payload).eq('id', editingRecord.id);"
)

# 7. Card Colors and Config Button
card_old = """                           <button
                              key={employee.id}
                              onClick={() => handleEmployeeClick(employee.id)}
                              className={`relative group flex flex-col items-center p-6 rounded-2xl border-2 transition-all transform hover:-translate-y-1 hover:shadow-xl bg-white ${isOnShift ? 'border-green-400 shadow-green-100' : 'border-slate-200 hover:border-blue-400 shadow-sm'}`}
                           >
                              <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${isOnShift ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-slate-300'}`}></div>

                              <div className={`p-5 rounded-full mb-4 transition-colors ${isOnShift ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                 <UserIcon className="w-12 h-12" />
                              </div>

                              <h3 className="font-bold text-lg text-slate-800 mb-1">{employee.name}</h3>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">DNI: {employee.dni}</p>

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
                           </button>"""

card_new = """                           <button
                              key={employee.id}
                              onClick={() => handleEmployeeClick(employee.id)}
                              className={`relative group flex flex-col items-center p-6 rounded-2xl border-2 transition-all transform hover:-translate-y-1 hover:shadow-xl bg-white ${isOnShift ? (activeRecord?.break_start && !activeRecord?.break_end ? 'border-orange-400 shadow-orange-100' : 'border-green-400 shadow-green-100') : 'border-slate-200 hover:border-blue-400 shadow-sm'}`}
                           >
                              <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${isOnShift ? (activeRecord?.break_start && !activeRecord?.break_end ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]') : 'bg-slate-300'}`}></div>
                              
                              <div onClick={(e) => { e.stopPropagation(); setConfigModal({ isOpen: true, employeeId: employee.id }); setConfigPin(''); setConfigPhoto(null); }} className="absolute top-3 left-3 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors z-10" title="Configurar Foto/PIN">
                                 <Settings className="w-4 h-4" />
                              </div>

                              <div className={`p-1 rounded-full mb-4 transition-colors ${isOnShift ? (activeRecord?.break_start && !activeRecord?.break_end ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600') : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                 {employee.photo_url ? (
                                    <img src={employee.photo_url} alt={employee.name} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" />
                                 ) : (
                                    <div className="p-4"><UserIcon className="w-8 h-8" /></div>
                                 )}
                              </div>

                              <h3 className="font-bold text-lg text-slate-800 mb-1">{employee.name}</h3>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">DNI: {employee.dni}</p>

                              {isOnShift ? (
                                 <div className={`px-4 py-2 rounded-xl flex flex-col items-center border w-full ${activeRecord?.break_start && !activeRecord?.break_end ? 'bg-orange-50 text-orange-800 border-orange-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                                    <div className="text-xs font-bold flex items-center mb-1">
                                       {activeRecord?.break_start && !activeRecord?.break_end ? (
                                          <><Coffee className={`w-4 h-4 mr-1 text-orange-600`} /> EN REFRIGERIO</>
                                       ) : (
                                          <><LogIn className="w-4 h-4 mr-1 text-green-600" /> {formatTime(activeRecord.check_in)}</>
                                       )}
                                    </div>
                                    <div className={`text-[11px] font-mono font-bold tracking-wider ${activeRecord?.break_start && !activeRecord?.break_end ? 'text-orange-600' : 'text-green-600'}`}>
                                       {formatDuration(currentTime.getTime() - new Date(activeRecord.check_in).getTime())}
                                    </div>
                                 </div>
                              ) : (
                                 <div className="text-slate-400 text-xs font-bold uppercase tracking-wider py-2">Click para Ingresar</div>
                              )}
                           </button>"""
content = content.replace(card_old, card_new)

# 8. Report Export Excel
content = content.replace(
    '<div className="min-w-[250px]">',
    '<button onClick={handleExportExcel} className="px-4 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center shadow-sm"><FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar (XLS)</button>\n                  <div className="min-w-[250px]">'
)

# 9. Auth Modal UI (Out, Break, etc)
auth_modal_ui_old = """                           <h3 className="text-3xl font-black uppercase tracking-tight mb-1">
                              {authModal.mode === 'IN' ? 'Entrada' : 'Salida'}
                           </h3>"""
auth_modal_ui_new = """                           <h3 className="text-3xl font-black uppercase tracking-tight mb-1">
                              {authModal.mode === 'IN' ? 'Entrada' : authModal.mode === 'BREAK_OUT' ? 'Refrigerio' : authModal.mode === 'BREAK_IN' ? 'Fin Refrigerio' : 'Salida'}
                           </h3>"""
content = content.replace(auth_modal_ui_old, auth_modal_ui_new)

auth_btn_old = """                           <button
                              type="submit"
                              disabled={!pinInput || isLoadingAuth}
                              className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all active:scale-95 flex justify-center items-center ${authModal.mode === 'IN' ? 'bg-green-600 hover:bg-green-700 shadow-green-600/30' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'} ${isLoadingAuth ? 'opacity-70 cursor-wait' : ''}`}
                           >
                              {isLoadingAuth ? <RefreshCw className="w-6 h-6 animate-spin" /> : 'CONFIRMAR MARCAJE'}
                           </button>"""

auth_btn_new = """                           {authModal.mode === 'BREAK_OUT' && (
                              <button
                                 type="button"
                                 onClick={() => setAuthModal(prev => ({ ...prev, mode: 'OUT' }))}
                                 className="w-full py-3 mb-3 rounded-xl font-bold text-sm text-rose-600 border-2 border-rose-200 hover:bg-rose-50 transition-all"
                              >
                                 OMITIR REFRIGERIO (FINALIZAR TURNO)
                              </button>
                           )}
                           <button
                              type="submit"
                              disabled={!pinInput || isLoadingAuth}
                              className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all active:scale-95 flex justify-center items-center ${authModal.mode === 'IN' || authModal.mode === 'BREAK_IN' ? 'bg-green-600 hover:bg-green-700 shadow-green-600/30' : authModal.mode === 'BREAK_OUT' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'} ${isLoadingAuth ? 'opacity-70 cursor-wait' : ''}`}
                           >
                              {isLoadingAuth ? <RefreshCw className="w-6 h-6 animate-spin" /> : 'CONFIRMAR MARCAJE'}
                           </button>"""
content = content.replace(auth_btn_old, auth_btn_new)

# 10. Add Config Modal at end
config_modal = """
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
"""
content = content.replace("      </div>\n   );\n};\n", config_modal + "   );\n};\n")

with open('components/Attendance.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
