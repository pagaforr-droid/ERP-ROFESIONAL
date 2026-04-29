import React, { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, DollarSign, Calendar, FileText, CheckCircle, AlertTriangle, Printer, Banknote, History, Save, X, Loader2, RefreshCw } from 'lucide-react';
import { useStore } from '../services/store';
import { Employee, SalaryAdvance, PayrollRecord, CashMovement } from '../types';
import { PdfEngine } from './PdfEngine';
import { supabase } from '../services/supabase';

export function PersonnelManagement() {
  const { currentCashSession, addCashMovement, updateCashMovement, deleteCashMovement, currentUser, company } = useStore();
  
  // Local Supabase State
  const [employees, setEmployees] = useState<any[]>([]);
  const [salaryAdvances, setSalaryAdvances] = useState<any[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'employees' | 'payroll'>('employees');
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [editAdvDate, setEditAdvDate] = useState('');
  const [editAdvAmount, setEditAdvAmount] = useState(0);
  const [editAdvReason, setEditAdvReason] = useState('');

  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Form states Employee
  const [empDni, setEmpDni] = useState('');
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empStart, setEmpStart] = useState('');
  const [empSalary, setEmpSalary] = useState(0);
  const [empFreq, setEmpFreq] = useState<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('MONTHLY');
  const [empNextDue, setEmpNextDue] = useState('');
  const [empLegal, setEmpLegal] = useState(0);

  // Form states Advance
  const [advAmount, setAdvAmount] = useState(0);
  const [advReason, setAdvReason] = useState('');

  const fetchData = async () => {
     setIsLoading(true);
     try {
        const [empRes, advRes, payRes] = await Promise.all([
           supabase.from('erp_employees').select('*').order('name'),
           supabase.from('erp_salary_advances').select('*').order('date', { ascending: false }),
           supabase.from('erp_payroll_records').select('*').order('issue_date', { ascending: false })
        ]);
        if (empRes.data) setEmployees(empRes.data);
        if (advRes.data) setSalaryAdvances(advRes.data);
        if (payRes.data) setPayrollRecords(payRes.data);
     } catch (err) {
        console.error("Error fetching personnel data", err);
     } finally {
        setIsLoading(false);
     }
  };

  useEffect(() => {
     fetchData();
  }, []);

  const handleOpenEmployeeModal = (emp?: any) => {
    if (emp) {
      setSelectedEmployee(emp);
      setEmpDni(emp.dni);
      setEmpName(emp.name);
      setEmpRole(emp.role);
      setEmpStart(emp.start_date);
      setEmpSalary(emp.base_salary);
      setEmpFreq(emp.payment_frequency);
      setEmpNextDue(emp.next_due_date);
      setEmpLegal(emp.legal_deduction_percent);
    } else {
      setSelectedEmployee(null);
      setEmpDni('');
      setEmpName('');
      setEmpRole('');
      setEmpStart(new Date().toISOString().split('T')[0]);
      setEmpSalary(1025); // RMV Peru
      setEmpFreq('MONTHLY');
      setEmpNextDue(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]);
      setEmpLegal(13); // ONP/AFP approx
    }
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
       const payload = {
          dni: empDni,
          name: empName,
          role: empRole,
          start_date: empStart,
          base_salary: empSalary,
          payment_frequency: empFreq,
          next_due_date: empNextDue,
          legal_deduction_percent: empLegal,
          is_active: true
       };

       if (selectedEmployee) {
          const { error } = await supabase.from('erp_employees').update(payload).eq('id', selectedEmployee.id);
          if (error) throw error;
       } else {
          const { error } = await supabase.from('erp_employees').insert([payload]);
          if (error) throw error;
       }
       setIsEmployeeModalOpen(false);
       fetchData();
    } catch (err: any) {
       alert('Error al guardar empleado: ' + err.message);
    }
  };

  const handleOpenAdvanceModal = (emp: any) => {
    if (!currentCashSession || currentCashSession.status !== 'OPEN') {
      alert("ATENCIÓN: Debe abrir su caja para poder entregar un Válido/Adelanto de dinero.");
      return;
    }
    setSelectedEmployee(emp);
    setAdvAmount(0);
    setAdvReason('');
    setIsAdvanceModalOpen(true);
  };

  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !currentUser) return;

    if (advAmount <= 0) {
      alert("El monto debe ser mayor a 0.");
      return;
    }

    const maxAdvance = selectedEmployee.base_salary * 0.4;
    const pendingSum = salaryAdvances
      .filter(a => a.employee_id === selectedEmployee.id && a.status === 'PENDING')
      .reduce((sum, a) => sum + Number(a.amount), 0);

    if (pendingSum + advAmount > maxAdvance) {
      const confirmWarning = window.confirm(`ALERTA: El empleado ya tiene S/${pendingSum} prestados. Sumando S/${advAmount} superará el 40% (S/${maxAdvance.toFixed(2)}) de límite preventivo. ¿Desea continuar de todas formas?`);
      if (!confirmWarning) return;
    }

    try {
       // Insert Advance
       const { data: newAdv, error: advErr } = await supabase.from('erp_salary_advances').insert([{
          employee_id: selectedEmployee.id,
          amount: advAmount,
          reason: advReason,
          status: 'PENDING'
       }]).select().single();
       if (advErr) throw advErr;

       // Create Cash Movement record
       const cmPayload = {
          type: 'EXPENSE',
          category_name: 'ADELANTO_PERSONAL',
          description: `Vale/Adelanto: ${selectedEmployee.name} - ${advReason}`,
          amount: advAmount,
          date: new Date().toISOString(),
          reference_id: newAdv.id,
          user_id: currentUser.id
       };

       const { data: newCm, error: cmErr } = await supabase.from('cash_movements').insert([cmPayload]).select().single();
       if (cmErr) throw cmErr;

       // Also update local store for immediate UI feedback in other modules
       addCashMovement(newCm);

       setIsAdvanceModalOpen(false);
       fetchData();
       alert(`Se entregó S/ ${advAmount.toFixed(2)} a ${selectedEmployee.name} correctamente con retiro de Caja.`);
    } catch (err: any) {
       alert('Error al procesar adelanto: ' + err.message);
    }
  };

  const handleOpenHistoryModal = (emp: any) => {
    setSelectedEmployee(emp);
    setIsHistoryModalOpen(true);
    setEditingAdvanceId(null);
  };

  const handleStartEditAdvance = (adv: any) => {
    setEditingAdvanceId(adv.id);
    setEditAdvDate(adv.date.split('T')[0]);
    setEditAdvAmount(adv.amount);
    setEditAdvReason(adv.reason || '');
  };

  const handleSaveEditAdvance = async (adv: any) => {
    if (editAdvAmount <= 0) {
      alert("El monto debe ser mayor a 0.");
      return;
    }

    if (!window.confirm(`¿Confirmar edición de este adelanto a S/ ${editAdvAmount.toFixed(2)}?\n\nLa Caja Chica se actualizará automáticamente.`)) return;

    try {
       const { error: advErr } = await supabase.from('erp_salary_advances').update({
          date: new Date(editAdvDate).toISOString(),
          amount: editAdvAmount,
          reason: editAdvReason
       }).eq('id', adv.id);
       if (advErr) throw advErr;

       // Attempt to update cash movement in DB and Store
       const { data: cmMatch } = await supabase.from('cash_movements').select('*').eq('reference_id', adv.id).single();
       if (cmMatch) {
          const updatedCm = { ...cmMatch, amount: editAdvAmount, date: new Date(editAdvDate).toISOString(), description: `Vale/Adelanto (Editado): ${selectedEmployee?.name} - ${editAdvReason}` };
          await supabase.from('cash_movements').update(updatedCm).eq('id', cmMatch.id);
          updateCashMovement(updatedCm);
       }

       setEditingAdvanceId(null);
       fetchData();
    } catch (err: any) {
       alert("Error al editar adelanto: " + err.message);
    }
  };

  const handleDeleteAdvance = async (adv: any) => {
    if(!window.confirm(`ATENCIÓN: ¿Está seguro de eliminar el adelanto por S/ ${adv.amount.toFixed(2)}?\n\nEste vale se anulará y el dinero DEBERÁ ser devuelto físicamente a la Caja Chica.`)) return;

    try {
       const { error } = await supabase.from('erp_salary_advances').delete().eq('id', adv.id);
       if (error) throw error;

       const { data: cmMatch } = await supabase.from('cash_movements').select('*').eq('reference_id', adv.id).single();
       if (cmMatch) {
          await supabase.from('cash_movements').delete().eq('id', cmMatch.id);
          deleteCashMovement(cmMatch.id);
       }

       fetchData();
    } catch (err: any) {
       alert("Error al eliminar: " + err.message);
    }
  };

  const handleProcessPayroll = async (emp: any) => {
    if (!currentCashSession || currentCashSession.status !== 'OPEN') {
      alert("Debe tener una Caja Abierta para poder realizar la liquidación de fin de mes y el pago en efectivo.");
      return;
    }

    const pendingSum = salaryAdvances
      .filter(a => a.employee_id === emp.id && a.status === 'PENDING')
      .reduce((sum, a) => sum + Number(a.amount), 0);

    const base = Number(emp.base_salary);
    const descLey = base * (emp.legal_deduction_percent / 100);
    const net = base - descLey - pendingSum;

    if (net < 0) {
      alert(`Error crítico: El Neto a liquidar es negativo (S/ ${net.toFixed(2)}). Revisa los adelantos.`);
      return;
    }

    if (window.confirm(`¿Confirmar Liquidación para ${emp.name}?\nSueldo Base: S/${base}\nDescuentos Ley: -S/${descLey.toFixed(2)}\nAdelantos a cuenta: -S/${pendingSum.toFixed(2)}\nLíquido a Pagar en Caja: S/${net.toFixed(2)}`)) {
      if(currentUser) {
         try {
            // 1. Insert Payroll Record
            const period = new Date().toISOString().slice(0, 7);
            const prPayload = {
               employee_id: emp.id,
               period: period,
               base_amount: base,
               legal_deductions: descLey,
               advances_amount: pendingSum,
               net_paid: net
            };
            const { data: newPr, error: prErr } = await supabase.from('erp_payroll_records').insert([prPayload]).select().single();
            if (prErr) throw prErr;

            // 2. Mark advances as PAID
            await supabase.from('erp_salary_advances').update({ status: 'PAID' }).eq('employee_id', emp.id).eq('status', 'PENDING');

            // 3. Cash Movement
            const cmPayload = {
               type: 'EXPENSE',
               category_name: 'PAGO_PLANILLA',
               description: `Pago Planilla: ${emp.name} (${period})`,
               amount: net,
               date: new Date().toISOString(),
               reference_id: newPr.id,
               user_id: currentUser.id
            };
            const { data: newCm, error: cmErr } = await supabase.from('cash_movements').insert([cmPayload]).select().single();
            if (!cmErr) addCashMovement(newCm);

            alert("La Nómina ha sido procesada correctamente y el vale contable expedido!");
            fetchData();
         } catch (err: any) {
            alert("Error al procesar nómina: " + err.message);
         }
      }
    }
  };

  const handlePrintBoleta = (rec: any) => {
    const emp = employees.find(e => e.id === rec.employee_id);
    if(!emp) return;
    
    PdfEngine.openDocument({
      _isBoletaPago: true,
      id: rec.id,
      employee: emp,
      period: rec.period,
      base_amount: rec.base_amount,
      legal_deductions: rec.legal_deductions,
      advances_amount: rec.advances_amount,
      net_paid: rec.net_paid,
      issue_date: rec.issue_date
    }, 'BOLETA_PAGO', company);
  };

  return (
    <div className="h-full flex flex-col space-y-4 font-sans text-slate-800 relative bg-slate-50 p-4">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-black flex items-center text-slate-800 tracking-tight">
          <Users className="mr-3 w-8 h-8 text-blue-600" /> RRHH y Planillas
        </h2>
        <div className="flex gap-2">
           <button onClick={fetchData} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center font-bold transition-colors">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Sincronizar
           </button>
           <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 shadow-inner">
             <button
               onClick={() => setActiveTab('employees')}
               className={`px-6 py-2 text-sm font-bold rounded-md flex items-center transition-all ${activeTab === 'employees' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <Users className="w-4 h-4 mr-2" /> Personal
             </button>
             <button
               onClick={() => setActiveTab('payroll')}
               className={`px-6 py-2 text-sm font-bold rounded-md flex items-center transition-all ${activeTab === 'payroll' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <DollarSign className="w-4 h-4 mr-2" /> Pagos
             </button>
           </div>
        </div>
      </div>

      {activeTab === 'employees' && (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nómina Activa</h3>
            <button onClick={() => handleOpenEmployeeModal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center font-bold text-sm shadow-md shadow-blue-500/20 transition-all active:scale-95">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Empleado
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {employees.map(emp => {
                const pendingSum = salaryAdvances.filter(a => a.employee_id === emp.id && a.status === 'PENDING').reduce((sum, a) => sum + Number(a.amount), 0);
                const hasAdvances = pendingSum > 0;

                return (
                  <div key={emp.id} className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow relative group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-lg text-slate-800 leading-tight">{emp.name}</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{emp.role} • {emp.dni}</p>
                      </div>
                      <button onClick={() => handleOpenEmployeeModal(emp)} className="text-slate-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Sueldo Base</div>
                        <div className="font-mono font-bold text-slate-800 text-sm">S/ {Number(emp.base_salary).toFixed(2)}</div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Próx. Pago</div>
                        <div className="font-mono font-bold text-slate-800 text-sm">{emp.next_due_date}</div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenAdvanceModal(emp)} className="flex-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition-colors">
                          <Banknote className="w-4 h-4 mr-1.5" /> Dar Adelanto
                        </button>
                        <button onClick={() => handleProcessPayroll(emp)} className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition-colors">
                          <CheckCircle className="w-4 h-4 mr-1.5" /> Procesar Mes
                        </button>
                      </div>
                      
                      {hasAdvances && (
                        <button onClick={() => handleOpenHistoryModal(emp)} className="w-full flex items-center justify-between mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 transition-colors">
                          <span className="flex items-center text-xs font-bold">
                            <AlertTriangle className="w-4 h-4 mr-2 text-rose-500" />
                            Adelantos Pendientes
                          </span>
                          <span className="font-mono font-bold">S/ {pendingSum.toFixed(2)}</span>
                        </button>
                      )}
                      {!hasAdvances && (
                         <button onClick={() => handleOpenHistoryModal(emp)} className="w-full flex items-center justify-center mt-2 p-2.5 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors text-xs font-bold">
                           <History className="w-4 h-4 mr-2" /> Historial de Adelantos
                         </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {employees.length === 0 && !isLoading && (
                 <div className="col-span-full py-12 text-center text-slate-400">
                    No hay empleados registrados.
                 </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
           <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center">
               <History className="w-4 h-4 mr-2" /> Historial de Planillas Generadas
            </h3>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                <tr>
                  <th className="p-4 border-b border-slate-200">Fecha Emisión</th>
                  <th className="p-4 border-b border-slate-200">Empleado</th>
                  <th className="p-4 border-b border-slate-200 text-center">Periodo</th>
                  <th className="p-4 border-b border-slate-200 text-right">Sueldo Base</th>
                  <th className="p-4 border-b border-slate-200 text-right">Desc. Ley</th>
                  <th className="p-4 border-b border-slate-200 text-right">Adelantos a Cta.</th>
                  <th className="p-4 border-b border-slate-200 text-right">Líquido Pagado</th>
                  <th className="p-4 border-b border-slate-200 text-center">Boleta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrollRecords.map(pr => {
                  const emp = employees.find(e => e.id === pr.employee_id);
                  return (
                    <tr key={pr.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono text-slate-500">{new Date(pr.issue_date).toLocaleDateString('es-PE')}</td>
                      <td className="p-4 font-bold text-slate-800">{emp?.name || 'Empleado Borrado'}</td>
                      <td className="p-4 text-center font-bold text-slate-600">{pr.period}</td>
                      <td className="p-4 text-right font-mono">S/ {Number(pr.base_amount).toFixed(2)}</td>
                      <td className="p-4 text-right font-mono text-rose-600">-S/ {Number(pr.legal_deductions).toFixed(2)}</td>
                      <td className="p-4 text-right font-mono text-amber-600">-S/ {Number(pr.advances_amount).toFixed(2)}</td>
                      <td className="p-4 text-right font-mono font-black text-blue-700">S/ {Number(pr.net_paid).toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <button onClick={() => handlePrintBoleta(pr)} className="text-slate-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors" title="Imprimir Boleta">
                          <Printer className="w-5 h-5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {payrollRecords.length === 0 && (
                   <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">No hay registros de planillas pagadas.</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {/* Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
              <h3 className="font-bold flex items-center text-xl"><Users className="mr-3 w-6 h-6" /> {selectedEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
              <button onClick={() => setIsEmployeeModalOpen(false)}><X className="w-6 h-6 text-slate-400 hover:text-white transition-colors" /></button>
            </div>
            <form onSubmit={handleSaveEmployee} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">DNI</label>
                  <input type="text" required className="w-full border-2 border-slate-200 rounded-xl p-3 font-medium outline-none focus:border-blue-500 transition-colors" value={empDni} onChange={e => setEmpDni(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nombres Completos</label>
                  <input type="text" required className="w-full border-2 border-slate-200 rounded-xl p-3 font-medium outline-none focus:border-blue-500 transition-colors" value={empName} onChange={e => setEmpName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Cargo / Rol</label>
                  <input type="text" required className="w-full border-2 border-slate-200 rounded-xl p-3 font-medium outline-none focus:border-blue-500 transition-colors" value={empRole} onChange={e => setEmpRole(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Frecuencia Pago</label>
                  <select className="w-full border-2 border-slate-200 rounded-xl p-3 font-medium outline-none focus:border-blue-500 transition-colors" value={empFreq} onChange={e => setEmpFreq(e.target.value as any)}>
                    <option value="WEEKLY">Semanal</option>
                    <option value="BIWEEKLY">Quincenal</option>
                    <option value="MONTHLY">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Sueldo Base (S/)</label>
                  <input type="number" required min="0" step="0.01" className="w-full border-2 border-slate-200 rounded-xl p-3 font-mono font-bold outline-none focus:border-blue-500 transition-colors" value={empSalary} onChange={e => setEmpSalary(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Descuento ONP/AFP (%)</label>
                  <input type="number" required min="0" max="100" step="0.01" className="w-full border-2 border-slate-200 rounded-xl p-3 font-mono font-bold outline-none focus:border-blue-500 transition-colors" value={empLegal} onChange={e => setEmpLegal(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsEmployeeModalOpen(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all">
                  <Save className="w-5 h-5 mr-2" /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advance Modal */}
      {isAdvanceModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-amber-500 text-white p-6 flex justify-between items-center">
              <h3 className="font-bold flex items-center text-xl text-amber-950"><Banknote className="mr-3 w-6 h-6 text-amber-900" /> Nuevo Adelanto</h3>
              <button onClick={() => setIsAdvanceModalOpen(false)}><X className="w-6 h-6 text-amber-900/50 hover:text-amber-900 transition-colors" /></button>
            </div>
            <form onSubmit={handleSaveAdvance} className="p-8 space-y-5">
               <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm font-medium text-amber-800 mb-2">
                  Adelanto para: <strong>{selectedEmployee.name}</strong><br/>
                  La salida de dinero se registrará en la Caja Chica automáticamente.
               </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Monto (S/)</label>
                <input type="number" autoFocus required min="1" step="0.01" className="w-full border-2 border-slate-200 rounded-xl p-4 text-2xl font-black font-mono text-center outline-none focus:border-amber-500 transition-colors" value={advAmount || ''} onChange={e => setAdvAmount(Number(e.target.value))} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Motivo / Concepto</label>
                <input type="text" required className="w-full border-2 border-slate-200 rounded-xl p-3 font-medium outline-none focus:border-amber-500 transition-colors" value={advReason} onChange={e => setAdvReason(e.target.value)} placeholder="Ej: Adelanto quincena..." />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsAdvanceModalOpen(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-amber-500/30 flex items-center justify-center transition-all">
                  Generar Vale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <h3 className="font-bold flex items-center text-lg"><History className="mr-3 w-5 h-5" /> Historial de Adelantos - {selectedEmployee.name}</h3>
              <button onClick={() => setIsHistoryModalOpen(false)}><X className="w-6 h-6 text-slate-400 hover:text-white transition-colors" /></button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              <table className="w-full text-left text-sm">
                <thead className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 sticky top-0">
                  <tr>
                    <th className="p-4 rounded-tl-xl">Fecha</th>
                    <th className="p-4">Motivo</th>
                    <th className="p-4 text-right">Monto</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-center rounded-tr-xl">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salaryAdvances.filter(a => a.employee_id === selectedEmployee.id).map(adv => (
                    <tr key={adv.id} className="hover:bg-slate-50">
                      {editingAdvanceId === adv.id ? (
                        <>
                          <td className="p-2"><input type="date" className="border border-slate-300 rounded p-1 w-full text-xs" value={editAdvDate} onChange={e => setEditAdvDate(e.target.value)} /></td>
                          <td className="p-2"><input type="text" className="border border-slate-300 rounded p-1 w-full text-xs" value={editAdvReason} onChange={e => setEditAdvReason(e.target.value)} /></td>
                          <td className="p-2"><input type="number" className="border border-slate-300 rounded p-1 w-full text-right text-xs font-mono" value={editAdvAmount} onChange={e => setEditAdvAmount(Number(e.target.value))} /></td>
                          <td className="p-2 text-center text-xs font-bold text-slate-500">{adv.status}</td>
                          <td className="p-2 text-center">
                            <button onClick={() => handleSaveEditAdvance(adv)} className="text-green-600 hover:text-green-800 p-1 mx-1" title="Guardar"><Save className="w-4 h-4" /></button>
                            <button onClick={() => setEditingAdvanceId(null)} className="text-slate-400 hover:text-slate-600 p-1 mx-1" title="Cancelar"><X className="w-4 h-4" /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-4 font-mono text-slate-500">{new Date(adv.date).toLocaleDateString('es-PE')}</td>
                          <td className="p-4 font-medium text-slate-700">{adv.reason || '-'}</td>
                          <td className="p-4 text-right font-mono font-bold">S/ {Number(adv.amount).toFixed(2)}</td>
                          <td className="p-4 text-center">
                            {adv.status === 'PENDING' ? (
                              <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded font-bold">PENDIENTE</span>
                            ) : (
                              <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded font-bold">LIQUIDADO</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {adv.status === 'PENDING' && (
                              <>
                                <button onClick={() => handleStartEditAdvance(adv)} className="text-slate-400 hover:text-blue-600 p-1 mx-1" title="Editar"><Pencil className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteAdvance(adv)} className="text-slate-400 hover:text-rose-600 p-1 mx-1" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                              </>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {salaryAdvances.filter(a => a.employee_id === selectedEmployee.id).length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No hay historial de adelantos.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
