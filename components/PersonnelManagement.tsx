import React, { useState } from 'react';
import { Users, Plus, Pencil, Trash2, DollarSign, Calendar, FileText, CheckCircle, AlertTriangle, Printer, Banknote, History, Save, X } from 'lucide-react';
import { useStore } from '../services/store';
import { Employee, SalaryAdvance, PayrollRecord, CashMovement } from '../types';
import { PdfEngine } from './PdfEngine';

export function PersonnelManagement() {
  const { employees, salaryAdvances, payrollRecords, currentCashSession, addEmployee, updateEmployee, processPayroll, addSalaryAdvance, updateSalaryAdvance, deleteSalaryAdvance, cashMovements, updateCashMovement, deleteCashMovement, addCashMovement, currentUser, company } = useStore();
  
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll'>('employees');
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [editAdvDate, setEditAdvDate] = useState('');
  const [editAdvAmount, setEditAdvAmount] = useState(0);
  const [editAdvReason, setEditAdvReason] = useState('');

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

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

  const handleOpenEmployeeModal = (emp?: Employee) => {
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
      setEmpNextDue(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]); // End of month
      setEmpLegal(13); // Default ONP approx
    }
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployee) {
      updateEmployee({
        ...selectedEmployee,
        dni: empDni,
        name: empName,
        role: empRole,
        start_date: empStart,
        base_salary: empSalary,
        payment_frequency: empFreq,
        next_due_date: empNextDue,
        legal_deduction_percent: empLegal
      });
    } else {
      addEmployee({
        id: 'EMP-' + Date.now(),
        dni: empDni,
        name: empName,
        role: empRole,
        start_date: empStart,
        base_salary: empSalary,
        payment_frequency: empFreq,
        next_due_date: empNextDue,
        legal_deduction_percent: empLegal,
        is_active: true
      });
    }
    setIsEmployeeModalOpen(false);
  };

  const handleOpenAdvanceModal = (emp: Employee) => {
    if (!currentCashSession || currentCashSession.status !== 'OPEN') {
      alert("ATENCIÓN: Debe abrir su caja para poder entregar un Válido/Adelanto de dinero.");
      return;
    }
    setSelectedEmployee(emp);
    setAdvAmount(0);
    setAdvReason('');
    setIsAdvanceModalOpen(true);
  };

  const handleSaveAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !currentUser) return;

    if (advAmount <= 0) {
      alert("El monto debe ser mayor a 0.");
      return;
    }

    const maxAdvance = selectedEmployee.base_salary * 0.4;
    // Calculation of pending advances
    const pendingSum = salaryAdvances
      .filter(a => a.employee_id === selectedEmployee.id && a.status === 'PENDING')
      .reduce((sum, a) => sum + a.amount, 0);

    if (pendingSum + advAmount > maxAdvance) {
      const confirmWarning = window.confirm(`ALERTA: El empleado ya tiene S/${pendingSum} prestados. Sumando S/${advAmount} superará el 40% (S/${maxAdvance.toFixed(2)}) de límite preventivo de su sueldo (S/${selectedEmployee.base_salary}). ¿Desea continuar de todas formas?`);
      if (!confirmWarning) return;
    }

    const advanceId = 'ADV-' + Date.now();
    
    // 1. Create advance debt
    addSalaryAdvance({
      id: advanceId,
      employee_id: selectedEmployee.id,
      amount: advAmount,
      date: new Date().toISOString(),
      reason: advReason,
      status: 'PENDING'
    });

    // 2. Outflow from Cash (Arqueo)
    const movement: CashMovement = {
       id: 'CM-' + Date.now(),
       type: 'EXPENSE',
       category_name: 'ADELANTO_PERSONAL',
       description: `Vale/Adelanto: ${selectedEmployee.name} - ${advReason}`,
       amount: advAmount,
       date: new Date().toISOString(),
       reference_id: advanceId,
       user_id: currentUser.id
    };
    addCashMovement(movement);

    setIsAdvanceModalOpen(false);
    alert(`Se entregó S/ ${advAmount.toFixed(2)} a ${selectedEmployee.name} correctamente con retiro de Caja.`);
  };

  const handleOpenHistoryModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsHistoryModalOpen(true);
    setEditingAdvanceId(null);
  };

  const handleStartEditAdvance = (adv: SalaryAdvance) => {
    setEditingAdvanceId(adv.id);
    setEditAdvDate(adv.date.split('T')[0]);
    setEditAdvAmount(adv.amount);
    setEditAdvReason(adv.reason || '');
  };

  const handleSaveEditAdvance = (adv: SalaryAdvance) => {
    if (editAdvAmount <= 0) {
      alert("El monto debe ser mayor a 0.");
      return;
    }

    if (!window.confirm(`¿Confirmar edición de este adelanto a S/ ${editAdvAmount.toFixed(2)}?\n\nLa Caja Chica se actualizará automáticamente.`)) return;

    // 1. Update Advance
    updateSalaryAdvance({
      ...adv,
      date: new Date(editAdvDate).toISOString(),
      amount: editAdvAmount,
      reason: editAdvReason
    });

    // 2. Sync associated CashMovement
    const cashMov = cashMovements.find(cm => cm.reference_id === adv.id);
    if (cashMov) {
       updateCashMovement({
          ...cashMov,
          amount: editAdvAmount,
          date: new Date(editAdvDate).toISOString(),
          description: `Vale/Adelanto (Editado): ${selectedEmployee?.name} - ${editAdvReason}`
       });
    }

    setEditingAdvanceId(null);
  };

  const handleDeleteAdvance = (adv: SalaryAdvance) => {
    if(!window.confirm(`ATENCIÓN: ¿Está seguro de eliminar el adelanto por S/ ${adv.amount.toFixed(2)}?\n\nEste vale se anulará y el dinero DEBERÁ ser devuelto físicamente a la Caja Chica.`)) return;

    // 1. Delete Advance
    deleteSalaryAdvance(adv.id);

    // 2. Delete Cash Movement
    const cashMov = cashMovements.find(cm => cm.reference_id === adv.id);
    if (cashMov) {
       deleteCashMovement(cashMov.id);
    }
  };

  const handleProcessPayroll = (emp: Employee) => {
    if (!currentCashSession || currentCashSession.status !== 'OPEN') {
      alert("Debe tener una Caja Abierta para poder realizar la liquidación de fin de mes y el pago en efectivo.");
      return;
    }

    const pendingSum = salaryAdvances
      .filter(a => a.employee_id === emp.id && a.status === 'PENDING')
      .reduce((sum, a) => sum + a.amount, 0);

    const base = emp.base_salary;
    const descLey = base * (emp.legal_deduction_percent / 100);
    const net = base - descLey - pendingSum;

    if (net < 0) {
      alert(`Error crítico: El Neto a liquidar es negativo (S/ ${net.toFixed(2)}). Revisa los adelantos.`);
      return;
    }

    if (window.confirm(`¿Confirmar Liquidación para ${emp.name}?\nSueldo Base: S/${base}\nDescuentos Ley: -S/${descLey.toFixed(2)}\nAdelantos a cuenta: -S/${pendingSum.toFixed(2)}\nLíquido a Pagar en Caja: S/${net.toFixed(2)}`)) {
      if(currentUser) {
         processPayroll(emp.id, currentUser.id);
         alert("La Nómina ha sido procesada correctamente y el vale contable expedido!");
      }
    }
  };

  const handlePrintBoleta = (rec: PayrollRecord) => {
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

  const getPendingAdvancesSum = (empId: string) => {
    return salaryAdvances
      .filter(a => a.employee_id === empId && a.status === 'PENDING')
      .reduce((sum, a) => sum + a.amount, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
            Gestión Humana y Planillas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Administre sueldos, contratos, vales adelantados y cierre de nómina (MTPE).
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('employees')}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${
              activeTab === 'employees' 
              ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Personal
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-lg border transition-all flex items-center justify-center gap-2 ${
              activeTab === 'payroll' 
              ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Banknote className="h-4 w-4" />
            Liquidación Nómina
          </button>
        </div>
      </div>

      {activeTab === 'employees' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Directorio de Colaboradores</h2>
            <button
              onClick={() => handleOpenEmployeeModal()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nuevo Colaborador
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Empleado y Contrato</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Adelantos (Pendientes)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Próx. Liquidación</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {employees.map(emp => {
                  const pendingAdv = getPendingAdvancesSum(emp.id);
                  const base = emp.base_salary;
                  const isDue = new Date(emp.next_due_date) <= new Date();

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                             {emp.name.substring(0, 2).toUpperCase()}
                           </div>
                           <div>
                             <p className="font-bold text-slate-900">{emp.name}</p>
                             <p className="text-xs text-slate-500">{emp.role} • Sueldo: S/ {base.toFixed(2)}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${pendingAdv > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            S/ {pendingAdv.toFixed(2)}
                          </span>
                          <button 
                            onClick={() => handleOpenAdvanceModal(emp)}
                            className="bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 p-1.5 rounded-md transition-colors tooltip"
                            title="Entregar Adelanto de Efectivo"
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenHistoryModal(emp)}
                            className="bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 p-1.5 rounded-md transition-colors tooltip"
                            title="Ver Historial de Adelantos"
                          >
                            <History className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className={`text-sm font-semibold flex items-center gap-1 ${isDue ? 'text-amber-600' : 'text-slate-700'}`}>
                             <Calendar className="h-3 w-3" /> {emp.next_due_date}
                           </span>
                           <span className="text-[10px] text-slate-500 uppercase tracking-wider">{emp.payment_frequency}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenEmployeeModal(emp)}
                          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Editar Ficha"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                      No hay personal registrado en planilla. Registre su primer colaborador.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="p-6 border-b border-slate-200">
             <h2 className="text-lg font-bold text-slate-800">Módulo de Retenciones y Pagos (Boleta MTPE)</h2>
             <p className="text-sm text-slate-500 mt-1">Calcule automáticamente el pago de mes y emita la boleta restando los adelantos.</p>
           </div>
           
           <div className="p-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {employees.map(emp => {
                 const pendingAdv = getPendingAdvancesSum(emp.id);
                 const base = emp.base_salary;
                 const descLey = base * (emp.legal_deduction_percent / 100);
                 const net = base - descLey - pendingAdv;
                 const isDue = new Date(emp.next_due_date) <= new Date();

                 return (
                    <div key={emp.id} className={`border rounded-xl p-5 relative overflow-hidden transition-all ${isDue ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}>
                       {isDue && (
                          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg">
                             PAGO PENDIENTE
                          </div>
                       )}
                       <h3 className="font-bold text-lg text-slate-900">{emp.name}</h3>
                       <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{emp.role}</p>
                       
                       <div className="space-y-2 text-sm bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Remuneración Bruta:</span>
                            <span className="font-medium">S/ {base.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>Dto. Ley ({emp.legal_deduction_percent}%):</span>
                            <span>-S/ {descLey.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-rose-600 font-medium">
                            <span>Adelantos/Vales Consumidos:</span>
                            <span>-S/ {pendingAdv.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center text-lg font-bold">
                            <span className="text-slate-900">Neto a Liquidar:</span>
                            <span className="text-emerald-600">S/ {net.toFixed(2)}</span>
                          </div>
                       </div>
                       
                       <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => handleProcessPayroll(emp)}
                            className="flex-1 bg-slate-900 hover:bg-black text-white px-3 py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                          >
                            <Banknote className="h-4 w-4" /> Ejecutar Pago
                          </button>
                       </div>
                    </div>
                 )
              })}
           </div>
           
           <div className="bg-slate-50 p-6 border-t border-slate-200">
             <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
               <FileText className="h-4 w-4" /> Historial de Planillas Generadas
             </h3>
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                   <thead>
                      <tr className="text-slate-500 border-b border-slate-200">
                         <th className="pb-2 font-semibold">TICKET ID</th>
                         <th className="pb-2 font-semibold">Fecha Liquidación</th>
                         <th className="pb-2 font-semibold">Colaborador</th>
                         <th className="pb-2 font-semibold font-mono text-right">Líquido Pagado</th>
                         <th className="pb-2 font-semibold text-right">Boleta A4</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {payrollRecords.slice().reverse().map(rec => {
                         const empName = employees.find(e => e.id === rec.employee_id)?.name || 'Desconocido';
                         return (
                            <tr key={rec.id} className="hover:bg-white text-slate-700">
                               <td className="py-3 font-mono text-xs">{rec.id}</td>
                               <td className="py-3">{new Date(rec.issue_date).toLocaleString()}</td>
                               <td className="py-3 font-semibold">{empName}</td>
                               <td className="py-3 text-emerald-600 font-bold text-right font-mono">S/ {rec.net_paid.toFixed(2)}</td>
                               <td className="py-3 text-right">
                                  <button onClick={() => handlePrintBoleta(rec)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors" title="Descargar Boleta de Pago PDF">
                                     <Printer className="h-4 w-4" />
                                  </button>
                               </td>
                            </tr>
                         )
                      })}
                      {payrollRecords.length === 0 && (
                         <tr><td colSpan={5} className="py-4 text-center text-slate-400">Sin historial de liquidaciones</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
           </div>
        </div>
      )}

      {/* Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Pencil className="h-5 w-5 text-indigo-600" />
                {selectedEmployee ? 'Ficha de Colaborador' : 'Nuevo Colaborador'}
              </h3>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-slate-400 hover:text-rose-500 text-lg p-2 transition-colors">✕</button>
            </div>
            
            <form onSubmit={handleSaveEmployee} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                   <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b pb-2">Datos Personales</h4>
                   <div>
                     <label className="block text-xs font-semibold text-slate-600 mb-1">DNI</label>
                     <input required type="text" value={empDni} onChange={e=>setEmpDni(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                   </div>
                   <div>
                     <label className="block text-xs font-semibold text-slate-600 mb-1">Nombres Completos</label>
                     <input required type="text" value={empName} onChange={e=>setEmpName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                   </div>
                   <div>
                     <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo</label>
                     <input required type="text" value={empRole} onChange={e=>setEmpRole(e.target.value)} placeholder="Ej. Vendedor, Cajero" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                   </div>
                   <div>
                     <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha Ingreso</label>
                     <input required type="date" value={empStart} onChange={e=>setEmpStart(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                   </div>
                </div>

                <div className="space-y-4">
                   <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b pb-2">Configuración Planilla</h4>
                   <div>
                     <label className="block text-xs font-semibold text-slate-600 mb-1">Sueldo Bruto Base (S/)</label>
                     <input required type="number" min="0" step="0.01" value={empSalary} onChange={e=>setEmpSalary(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono font-bold text-emerald-700" />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                     <div>
                       <label className="block text-xs font-semibold text-slate-600 mb-1">Frecuencia</label>
                       <select value={empFreq} onChange={e=>setEmpFreq(e.target.value as any)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none">
                          <option value="WEEKLY">Semanal</option>
                          <option value="BIWEEKLY">Quincenal</option>
                          <option value="MONTHLY">Mensual</option>
                       </select>
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-slate-600 mb-1">Dcto. Ley (%)</label>
                       <input required type="number" step="0.1" value={empLegal} onChange={e=>setEmpLegal(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" title="AFP o ONP" />
                     </div>
                   </div>
                   <div>
                     <label className="block text-xs font-semibold text-slate-600 mb-1">Próxima Fecha de Liquidación/Pago</label>
                     <input required type="date" value={empNextDue} onChange={e=>setEmpNextDue(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" />
                   </div>
                   <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-xs text-amber-800 flex items-start gap-2">
                         <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                         Los descuentos legales (S/ {(empSalary * (empLegal / 100)).toFixed(2)}) de Essalud/AFP/ONP aplican directo al base configurado.
                      </p>
                   </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsEmployeeModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-md">
                   <CheckCircle className="h-4 w-4" /> Guardar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advance Modal */}
      {isAdvanceModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-rose-500 p-6 text-white text-center relative">
               <button onClick={() => setIsAdvanceModalOpen(false)} className="absolute top-4 right-4 text-white/70 hover:text-white">✕</button>
               <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="h-8 w-8" />
               </div>
               <h3 className="text-xl font-bold">Vale Físico / Adelanto Sueldo</h3>
               <p className="text-rose-100 text-sm opacity-90">{selectedEmployee.name}</p>
            </div>
            
            <form onSubmit={handleSaveAdvance} className="p-6 space-y-5">
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                <p className="text-xs text-rose-800 font-semibold text-center uppercase tracking-wide">La caja descontará este dinero de inmediato.</p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Monto del Adelanto (S/)</label>
                <input 
                  autoFocus
                  required 
                  type="number" min="0.1" step="0.01" 
                  value={advAmount || ''} 
                  onChange={e=>setAdvAmount(Number(e.target.value))} 
                  className="w-full text-center text-3xl font-bold font-mono text-rose-600 py-4 border-2 border-slate-200 focus:border-rose-500 rounded-xl outline-none transition-colors"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Motivo / Concepto (Aparecerá en boleta)</label>
                <input 
                  required 
                  type="text" 
                  value={advReason} 
                  onChange={e=>setAdvReason(e.target.value)} 
                  placeholder="Ej. Quincena, Prestamo emergencia"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none transition-all" 
                />
              </div>
              
              <button type="submit" className="w-full py-3.5 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-all shadow-lg hover:shadow-rose-500/30 flex items-center justify-center gap-2">
                 Emitir Vale de Caja por S/ {advAmount.toFixed(2)}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* History Modal */}
      {isHistoryModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-600" />
                  Historial de Adelantos
                </h3>
                <p className="text-sm text-slate-500 mt-1">{selectedEmployee.name}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-rose-500 text-lg p-2 transition-colors">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-slate-50 border-b border-slate-200">
                       <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Fecha</th>
                       <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Motivo</th>
                       <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Monto</th>
                       <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Estado</th>
                       {currentUser?.role === 'ADMIN' && <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Acciones</th>}
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {salaryAdvances
                        .filter(a => a.employee_id === selectedEmployee.id)
                        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(adv => (
                        <tr key={adv.id} className="hover:bg-slate-50">
                           {editingAdvanceId === adv.id ? (
                              <>
                                 <td className="px-4 py-2">
                                    <input type="date" value={editAdvDate} onChange={e=>setEditAdvDate(e.target.value)} className="w-full px-2 py-1 border rounded text-sm"/>
                                 </td>
                                 <td className="px-4 py-2">
                                    <input type="text" value={editAdvReason} onChange={e=>setEditAdvReason(e.target.value)} className="w-full px-2 py-1 border rounded text-sm"/>
                                 </td>
                                 <td className="px-4 py-2 text-right">
                                    <input type="number" step="0.01" value={editAdvAmount} onChange={e=>setEditAdvAmount(Number(e.target.value))} className="w-24 px-2 py-1 border rounded text-sm text-right font-mono"/>
                                 </td>
                                 <td className="px-4 py-2 text-center text-xs">
                                    {adv.status === 'PAID' ? <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">CANCELADO</span> : <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded">PENDIENTE</span>}
                                 </td>
                                 {currentUser?.role === 'ADMIN' && (
                                    <td className="px-4 py-2 text-right flex justify-end gap-1">
                                       <button onClick={() => handleSaveEditAdvance(adv)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Guardar">
                                          <Save className="h-4 w-4" />
                                       </button>
                                       <button onClick={() => setEditingAdvanceId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded" title="Cancelar">
                                          <X className="h-4 w-4" />
                                       </button>
                                    </td>
                                 )}
                              </>
                           ) : (
                              <>
                                 <td className="px-4 py-3 text-sm">{new Date(adv.date).toLocaleDateString()}</td>
                                 <td className="px-4 py-3 text-sm">{adv.reason || '-'}</td>
                                 <td className="px-4 py-3 text-sm font-mono text-right font-bold">S/ {adv.amount.toFixed(2)}</td>
                                 <td className="px-4 py-3 text-center text-xs">
                                    {adv.status === 'PAID' ? <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">CANCELADO</span> : <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded">PENDIENTE</span>}
                                 </td>
                                 {currentUser?.role === 'ADMIN' && (
                                    <td className="px-4 py-3 text-right">
                                       <div className="flex justify-end gap-1">
                                          <button disabled={adv.status === 'PAID'} onClick={() => handleStartEditAdvance(adv)} className={`p-1.5 rounded ${adv.status === 'PAID' ? 'text-slate-300' : 'text-indigo-600 hover:bg-indigo-50'}`} title={adv.status === 'PAID' ? "No editable porque ya fue descontado en planilla" : "Editar Adelanto"}>
                                             <Pencil className="h-4 w-4" />
                                          </button>
                                          <button disabled={adv.status === 'PAID'} onClick={() => handleDeleteAdvance(adv)} className={`p-1.5 rounded ${adv.status === 'PAID' ? 'text-slate-300' : 'text-rose-600 hover:bg-rose-50'}`} title="Eliminar Adelanto">
                                             <Trash2 className="h-4 w-4" />
                                          </button>
                                       </div>
                                    </td>
                                 )}
                              </>
                           )}
                        </tr>
                     ))}
                     {salaryAdvances.filter(a => a.employee_id === selectedEmployee.id).length === 0 && (
                        <tr><td colSpan={currentUser?.role === 'ADMIN' ? 5 : 4} className="px-4 py-8 text-center text-slate-500">Este empleado no tiene registro de adelantos.</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
               
               {currentUser?.role !== 'ADMIN' && salaryAdvances.filter(a => a.employee_id === selectedEmployee.id).length > 0 && (
                  <div className="mt-4 p-3 bg-indigo-50/50 rounded-lg text-xs text-indigo-800 text-center">
                     Contacte a un Administrador si necesita modificar o revertir un vale de caja entregado.
                  </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
