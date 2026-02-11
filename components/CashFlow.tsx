import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { CashMovement, ExpenseCategory, ScheduledTransaction } from '../types';
import { DollarSign, TrendingUp, TrendingDown, PieChart, Plus, Minus, Filter, Calendar, Save, Trash2, ArrowRight, Settings, Clock, User, AlertTriangle, CheckCircle, BarChart3, Briefcase } from 'lucide-react';

type Tab = 'DASHBOARD' | 'MOVEMENTS' | 'PLANNER' | 'CONFIG';

export const CashFlow: React.FC = () => {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');
  
  // Filters & Global
  const [filterDateFrom, setFilterDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [filterDateTo, setFilterDateTo] = useState(new Date().toISOString().split('T')[0]);

  // --- DERIVED DATA ---
  
  const aggregatedMovements = useMemo(() => {
    const list: CashMovement[] = [];
    // 1. Sales (Only Cash)
    store.sales.filter(s => s.payment_method === 'CONTADO').forEach(s => {
      list.push({
        id: `SALE-${s.id}`, type: 'INCOME', category_name: 'VENTA MERCADERIA',
        description: `Venta: ${s.series}-${s.number}`, amount: s.total, date: s.created_at
      });
    });
    // 2. Purchases (Only Paid)
    store.purchases.filter(p => p.payment_status === 'PAID').forEach(p => {
      list.push({
        id: `PUR-${p.id}`, type: 'EXPENSE', category_name: 'COMPRA MERCADERIA',
        description: `Compra: ${p.supplier_name}`, amount: p.total, date: p.issue_date
      });
    });
    // 3. Manual
    store.cashMovements.forEach(m => list.push(m));
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [store.sales, store.purchases, store.cashMovements]);

  const filteredMovements = aggregatedMovements.filter(m => {
     const d = m.date.split('T')[0];
     return d >= filterDateFrom && d <= filterDateTo;
  });

  const totalIncome = filteredMovements.filter(m => m.type === 'INCOME').reduce((acc, m) => acc + m.amount, 0);
  const totalExpense = filteredMovements.filter(m => m.type === 'EXPENSE').reduce((acc, m) => acc + m.amount, 0);
  const balance = totalIncome - totalExpense;

  // --- SUB-COMPONENTS ---

  const DashboardView = () => {
     // Calculate Category Breakdown
     const breakdown = useMemo(() => {
        const acc: Record<string, number> = {};
        filteredMovements.forEach(m => {
           if(m.type === 'EXPENSE') acc[m.category_name] = (acc[m.category_name] || 0) + m.amount;
        });
        return Object.entries(acc).sort((a,b) => b[1] - a[1]).slice(0, 5); // Top 5 Expenses
     }, []);

     const upcomingPayments = store.scheduledTransactions
        .filter(t => t.is_active)
        .sort((a,b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime())
        .slice(0, 3);

     return (
        <div className="space-y-6 animate-fade-in-up">
           {/* KPI Cards */}
           <div className="grid grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                 <div className="flex justify-between items-start">
                    <div>
                       <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Ingresos Totales</p>
                       <h3 className="text-2xl font-bold text-green-600 mt-1">S/ {totalIncome.toFixed(2)}</h3>
                    </div>
                    <div className="bg-green-100 p-2 rounded-full"><TrendingUp className="text-green-600 w-6 h-6" /></div>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                 <div className="flex justify-between items-start">
                    <div>
                       <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Egresos Totales</p>
                       <h3 className="text-2xl font-bold text-red-600 mt-1">S/ {totalExpense.toFixed(2)}</h3>
                    </div>
                    <div className="bg-red-100 p-2 rounded-full"><TrendingDown className="text-red-600 w-6 h-6" /></div>
                 </div>
              </div>
              <div className="bg-slate-800 p-6 rounded-lg shadow border border-slate-700">
                 <div className="flex justify-between items-start">
                    <div>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">Flujo Neto</p>
                       <h3 className={`text-2xl font-bold mt-1 ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          S/ {balance.toFixed(2)}
                       </h3>
                    </div>
                    <div className="bg-slate-700 p-2 rounded-full"><PieChart className="text-white w-6 h-6" /></div>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-6 h-80">
              {/* Expense Breakdown */}
              <div className="bg-white p-6 rounded-lg shadow border border-slate-200 flex flex-col">
                 <h4 className="font-bold text-slate-800 mb-4 flex items-center"><BarChart3 className="w-4 h-4 mr-2"/> Top Gastos del Periodo</h4>
                 <div className="space-y-4 flex-1 overflow-auto">
                    {breakdown.map(([cat, amount], idx) => (
                       <div key={idx} className="relative">
                          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                             <span>{cat}</span>
                             <span>S/ {amount.toFixed(2)}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                             <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(amount / totalExpense) * 100}%` }}></div>
                          </div>
                       </div>
                    ))}
                    {breakdown.length === 0 && <div className="text-center text-slate-400 italic mt-10">Sin datos de egresos</div>}
                 </div>
              </div>

              {/* Upcoming Payments Alert */}
              <div className="bg-white p-6 rounded-lg shadow border border-slate-200 flex flex-col">
                 <h4 className="font-bold text-slate-800 mb-4 flex items-center"><Clock className="w-4 h-4 mr-2"/> Próximos Vencimientos (Programados)</h4>
                 <div className="space-y-3">
                    {upcomingPayments.map(t => {
                       const daysLeft = Math.ceil((new Date(t.next_due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                       const isOverdue = daysLeft < 0;
                       return (
                          <div key={t.id} className={`p-3 rounded border flex justify-between items-center ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                             <div>
                                <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                                <p className="text-xs text-slate-500">{t.frequency} - Vence: {t.next_due_date}</p>
                             </div>
                             <div className="text-right">
                                <p className="font-bold text-slate-900">S/ {t.amount.toFixed(2)}</p>
                                <p className={`text-[10px] font-bold ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>
                                   {isOverdue ? `Vencido hace ${Math.abs(daysLeft)} días` : `En ${daysLeft} días`}
                                </p>
                             </div>
                          </div>
                       );
                    })}
                    {upcomingPayments.length === 0 && <div className="text-center text-slate-400 italic mt-10">No hay pagos programados próximos.</div>}
                 </div>
              </div>
           </div>
        </div>
     );
  };

  const MovementsView = () => {
     const [showModal, setShowModal] = useState(false);
     const [modalType, setModalType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
     
     // Form State
     const [amount, setAmount] = useState(0);
     const [desc, setDesc] = useState('');
     const [catId, setCatId] = useState('');

     const handleSubmit = () => {
        if(amount <= 0 || !catId) return;
        const cat = store.expenseCategories.find(c => c.id === catId);
        store.addCashMovement({
           id: crypto.randomUUID(),
           type: modalType,
           category_name: cat?.name || 'GENERIC',
           category_id: catId,
           amount,
           description: desc || 'Movimiento manual',
           date: new Date().toISOString()
        });
        setShowModal(false);
        setAmount(0); setDesc(''); setCatId('');
     };

     return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow overflow-hidden">
           <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-700">Registro Detallado</h3>
              <div className="flex gap-2">
                 <button onClick={() => { setModalType('INCOME'); setShowModal(true); }} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-green-700 flex items-center shadow-sm">
                    <Plus className="w-4 h-4 mr-1"/> Ingreso
                 </button>
                 <button onClick={() => { setModalType('EXPENSE'); setShowModal(true); }} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-red-700 flex items-center shadow-sm">
                    <Minus className="w-4 h-4 mr-1" /> Gasto
                 </button>
              </div>
           </div>
           
           <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                 <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                    <tr>
                       <th className="p-3">Fecha</th>
                       <th className="p-3">Tipo</th>
                       <th className="p-3">Categoría</th>
                       <th className="p-3">Descripción</th>
                       <th className="p-3 text-right">Monto</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {filteredMovements.map((m, idx) => (
                       <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-500 whitespace-nowrap">
                             {new Date(m.date).toLocaleDateString()} <span className="text-[10px] text-slate-400">{new Date(m.date).toLocaleTimeString()}</span>
                          </td>
                          <td className="p-3">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.type === 'INCOME' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {m.type === 'INCOME' ? 'INGRESO' : 'EGRESO'}
                             </span>
                          </td>
                          <td className="p-3 font-bold text-slate-700 text-xs uppercase">{m.category_name}</td>
                          <td className="p-3 text-slate-600">{m.description}</td>
                          <td className={`p-3 text-right font-bold ${m.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                             {m.type === 'INCOME' ? '+' : '-'} S/ {m.amount.toFixed(2)}
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           {/* Generic Modal */}
           {showModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                 <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                    <h3 className={`font-bold text-lg mb-4 flex items-center ${modalType === 'INCOME' ? 'text-green-700' : 'text-red-700'}`}>
                       {modalType === 'INCOME' ? <TrendingUp className="mr-2"/> : <TrendingDown className="mr-2"/>}
                       Registrar {modalType === 'INCOME' ? 'Ingreso' : 'Gasto'}
                    </h3>
                    <div className="space-y-4">
                       <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Categoría</label>
                          <select className="w-full border border-slate-300 p-2 rounded" value={catId} onChange={e => setCatId(e.target.value)}>
                             <option value="">-- Seleccionar --</option>
                             {store.expenseCategories.filter(c => c.type === modalType && c.is_active).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                             ))}
                          </select>
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Monto (S/)</label>
                          <input type="number" autoFocus className="w-full border border-slate-300 p-2 rounded text-lg font-bold" value={amount} onChange={e => setAmount(Number(e.target.value))} />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Descripción</label>
                          <textarea className="w-full border border-slate-300 p-2 rounded" rows={3} value={desc} onChange={e => setDesc(e.target.value)}></textarea>
                       </div>
                       <div className="flex justify-end gap-2 pt-2">
                          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded">Cancelar</button>
                          <button onClick={handleSubmit} className={`px-6 py-2 text-white font-bold rounded shadow ${modalType === 'INCOME' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>Guardar</button>
                       </div>
                    </div>
                 </div>
              </div>
           )}
        </div>
     );
  };

  const PlannerView = () => {
     const [showForm, setShowForm] = useState(false);
     const [formData, setFormData] = useState<Partial<ScheduledTransaction>>({ frequency: 'MONTHLY', amount: 0, next_due_date: new Date().toISOString().split('T')[0] });

     // Beneficiary Logic
     const [beneficiaryType, setBeneficiaryType] = useState<'EMPLOYEE' | 'SUPPLIER' | 'OTHER'>('OTHER');

     const handleSaveSchedule = () => {
        if (!formData.name || !formData.amount || !formData.category_id) return;
        store.addScheduledTransaction({
           id: crypto.randomUUID(),
           is_active: true,
           name: formData.name,
           category_id: formData.category_id,
           amount: Number(formData.amount),
           frequency: formData.frequency as any,
           next_due_date: formData.next_due_date as string,
           beneficiary_type: beneficiaryType,
           beneficiary_id: formData.beneficiary_id
        });
        setShowForm(false);
        setFormData({ frequency: 'MONTHLY', amount: 0, next_due_date: new Date().toISOString().split('T')[0] });
     };

     const handleProcess = (txId: string) => {
        if(confirm("¿Confirmar pago de esta cuota? Se generará el egreso y se actualizará la próxima fecha.")){
           store.processScheduledTransaction(txId);
        }
     };

     return (
        <div className="flex gap-6 h-full">
           <div className="flex-1 bg-white rounded-lg shadow border border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                 <div>
                    <h3 className="font-bold text-slate-700">Programación de Pagos</h3>
                    <p className="text-xs text-slate-500">Gastos fijos, alquileres y planilla</p>
                 </div>
                 <button onClick={() => setShowForm(true)} className="bg-slate-900 text-white px-4 py-2 rounded text-sm font-bold flex items-center shadow">
                    <Clock className="w-4 h-4 mr-2" /> Nueva Programación
                 </button>
              </div>
              <div className="flex-1 overflow-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                       <tr>
                          <th className="p-3">Concepto</th>
                          <th className="p-3">Categoría</th>
                          <th className="p-3">Frecuencia</th>
                          <th className="p-3">Próximo Vencimiento</th>
                          <th className="p-3 text-right">Monto</th>
                          <th className="p-3 text-center">Acción</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {store.scheduledTransactions.filter(t => t.is_active).map(t => {
                          const cat = store.expenseCategories.find(c => c.id === t.category_id);
                          const daysLeft = Math.ceil((new Date(t.next_due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                          const isOverdue = daysLeft < 0;
                          return (
                             <tr key={t.id} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-800">{t.name}</td>
                                <td className="p-3 text-slate-600 text-xs uppercase">{cat?.name}</td>
                                <td className="p-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">{t.frequency}</span></td>
                                <td className="p-3">
                                   <div className={`flex items-center ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                      {isOverdue && <AlertTriangle className="w-3 h-3 mr-1" />}
                                      {t.next_due_date}
                                   </div>
                                </td>
                                <td className="p-3 text-right font-bold text-slate-900">S/ {t.amount.toFixed(2)}</td>
                                <td className="p-3 text-center">
                                   <button onClick={() => handleProcess(t.id)} className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded text-xs font-bold border border-green-200 flex items-center mx-auto transition-colors">
                                      <CheckCircle className="w-3 h-3 mr-1" /> Procesar Pago
                                   </button>
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>

           {/* Schedule Form Modal */}
           {showForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                 <div className="bg-white p-6 rounded-lg shadow-xl w-[500px]">
                    <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center"><Clock className="mr-2" /> Programar Gasto Recurrente</h3>
                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="block text-xs font-bold text-slate-600 mb-1">Tipo Beneficiario</label>
                             <select className="w-full border border-slate-300 p-2 rounded text-sm" value={beneficiaryType} onChange={e => setBeneficiaryType(e.target.value as any)}>
                                <option value="OTHER">Otro / General</option>
                                <option value="EMPLOYEE">Empleado (Sueldo)</option>
                                <option value="SUPPLIER">Proveedor</option>
                             </select>
                          </div>
                          <div>
                             <label className="block text-xs font-bold text-slate-600 mb-1">
                                {beneficiaryType === 'EMPLOYEE' ? 'Seleccionar Empleado' : beneficiaryType === 'SUPPLIER' ? 'Seleccionar Proveedor' : 'Nombre / Concepto'}
                             </label>
                             {beneficiaryType === 'EMPLOYEE' ? (
                                <select className="w-full border border-slate-300 p-2 rounded text-sm" onChange={e => {
                                   const emp = [...store.drivers, ...store.sellers].find(x => x.id === e.target.value);
                                   setFormData({...formData, beneficiary_id: e.target.value, name: `SUELDO: ${emp?.name}`});
                                }}>
                                   <option value="">-- Seleccionar --</option>
                                   <optgroup label="Choferes">
                                      {store.drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                   </optgroup>
                                   <optgroup label="Vendedores">
                                      {store.sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                   </optgroup>
                                </select>
                             ) : beneficiaryType === 'SUPPLIER' ? (
                                <select className="w-full border border-slate-300 p-2 rounded text-sm" onChange={e => {
                                   const sup = store.suppliers.find(x => x.id === e.target.value);
                                   setFormData({...formData, beneficiary_id: e.target.value, name: `PAGO RECURRENTE: ${sup?.name}`});
                                }}>
                                   <option value="">-- Seleccionar --</option>
                                   {store.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                             ) : (
                                <input className="w-full border border-slate-300 p-2 rounded text-sm" placeholder="Ej. Alquiler Local, Internet..." value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                             )}
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="block text-xs font-bold text-slate-600 mb-1">Categoría Gasto</label>
                             <select className="w-full border border-slate-300 p-2 rounded text-sm" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                                <option value="">-- Seleccionar --</option>
                                {store.expenseCategories.filter(c => c.type === 'EXPENSE').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                             </select>
                          </div>
                          <div>
                             <label className="block text-xs font-bold text-slate-600 mb-1">Monto Cuota (S/)</label>
                             <input type="number" className="w-full border border-slate-300 p-2 rounded text-sm font-bold" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="block text-xs font-bold text-slate-600 mb-1">Frecuencia</label>
                             <select className="w-full border border-slate-300 p-2 rounded text-sm" value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value as any})}>
                                <option value="MONTHLY">Mensual</option>
                                <option value="WEEKLY">Semanal</option>
                                <option value="BIWEEKLY">Quincenal</option>
                                <option value="ONETIME">Una sola vez (Diferido)</option>
                             </select>
                          </div>
                          <div>
                             <label className="block text-xs font-bold text-slate-600 mb-1">Primer Vencimiento</label>
                             <input type="date" className="w-full border border-slate-300 p-2 rounded text-sm" value={formData.next_due_date} onChange={e => setFormData({...formData, next_due_date: e.target.value})} />
                          </div>
                       </div>

                       <div className="flex justify-end gap-2 pt-4">
                          <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded">Cancelar</button>
                          <button onClick={handleSaveSchedule} className="px-6 py-2 bg-slate-900 text-white font-bold rounded shadow hover:bg-slate-800">Guardar Programación</button>
                       </div>
                    </div>
                 </div>
              </div>
           )}
        </div>
     );
  };

  const ConfigView = () => {
     const [name, setName] = useState('');
     const [type, setType] = useState<'INCOME'|'EXPENSE'>('EXPENSE');

     const handleAdd = () => {
        if(!name) return;
        store.addExpenseCategory({
           id: crypto.randomUUID(),
           name: name.toUpperCase(),
           type,
           is_active: true
        });
        setName('');
     };

     return (
        <div className="flex gap-6 h-full">
           <div className="w-1/3 bg-white p-6 rounded-lg shadow border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4">Nueva Categoría</h3>
              <div className="space-y-3">
                 <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Nombre</label>
                    <input className="w-full border border-slate-300 p-2 rounded" placeholder="Ej. PUBLICIDAD, VENTAS EXTRA..." value={name} onChange={e => setName(e.target.value)} />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tipo Flujo</label>
                    <div className="flex gap-2">
                       <button onClick={() => setType('INCOME')} className={`flex-1 py-2 rounded text-sm font-bold border ${type === 'INCOME' ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-slate-200 text-slate-500'}`}>Ingreso</button>
                       <button onClick={() => setType('EXPENSE')} className={`flex-1 py-2 rounded text-sm font-bold border ${type === 'EXPENSE' ? 'bg-red-100 border-red-300 text-red-800' : 'bg-white border-slate-200 text-slate-500'}`}>Egreso</button>
                    </div>
                 </div>
                 <button onClick={handleAdd} className="w-full bg-slate-900 text-white py-2 rounded font-bold mt-2">Crear Categoría</button>
              </div>
           </div>

           <div className="flex-1 bg-white rounded-lg shadow border border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-700">Categorías Existentes</div>
              <div className="flex-1 overflow-auto p-4 grid grid-cols-2 gap-4 content-start">
                 {store.expenseCategories.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-3 border rounded hover:bg-slate-50">
                       <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-3 ${c.type === 'INCOME' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span className="font-bold text-slate-700 text-sm">{c.name}</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-bold">{c.type === 'INCOME' ? 'INGRESO' : 'EGRESO'}</span>
                          <button onClick={() => store.deleteExpenseCategory(c.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
     );
  };

  return (
    <div className="flex flex-col h-full space-y-4 font-sans text-sm">
      {/* Top Bar */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <DollarSign className="mr-2 h-6 w-6 text-green-600" /> Finanzas y Flujo de Caja
        </h2>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
           <Calendar className="w-4 h-4 text-slate-400 ml-2" />
           <input type="date" className="text-xs border-none focus:ring-0 text-slate-600 font-bold" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
           <span className="text-slate-300">-</span>
           <input type="date" className="text-xs border-none focus:ring-0 text-slate-600 font-bold" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex space-x-1 bg-slate-200 p-1 rounded-lg w-fit">
         {[
            { id: 'DASHBOARD', label: 'Dashboard', icon: PieChart },
            { id: 'MOVEMENTS', label: 'Movimientos', icon: ArrowRight },
            { id: 'PLANNER', label: 'Programación (Sueldos/Fijos)', icon: Clock },
            { id: 'CONFIG', label: 'Categorías', icon: Settings }
         ].map(tab => (
            <button 
               key={tab.id}
               onClick={() => setActiveTab(tab.id as Tab)}
               className={`px-4 py-2 rounded-md font-bold text-xs flex items-center transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
               <tab.icon className="w-4 h-4 mr-2" /> {tab.label}
            </button>
         ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
         {activeTab === 'DASHBOARD' && <DashboardView />}
         {activeTab === 'MOVEMENTS' && <MovementsView />}
         {activeTab === 'PLANNER' && <PlannerView />}
         {activeTab === 'CONFIG' && <ConfigView />}
      </div>
    </div>
  );
};