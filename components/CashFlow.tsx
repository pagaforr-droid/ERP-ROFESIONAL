import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { CashMovement, ExpenseCategory, ScheduledTransaction } from '../types';
import { DollarSign, TrendingUp, TrendingDown, PieChart, Plus, Minus, Filter, Calendar, Save, Trash2, ArrowRight, Settings, Clock, User, AlertTriangle, CheckCircle, BarChart3, Briefcase, Store, Truck, Coins } from 'lucide-react';

type Tab = 'SESSION' | 'DASHBOARD' | 'MOVEMENTS' | 'PLANNER' | 'CONFIG';

export const CashFlow: React.FC = () => {
   const store = useStore();
   const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');

   // Filters & Global
   const [filterDateFrom, setFilterDateFrom] = useState(new Date().toISOString().split('T')[0]);
   const [filterDateTo, setFilterDateTo] = useState(new Date().toISOString().split('T')[0]);

   // --- DERIVED DATA ---

   const aggregatedMovements = useMemo(() => {
      const list: (CashMovement & { icon?: React.ReactNode })[] = [];

      // 1. Sales (Only Cash and NO Credit Notes)
      store.sales.filter(s => s.payment_method === 'CONTADO' && !s.document_type.includes('NOTA')).forEach(s => {
         list.push({
            id: `SALE-${s.id}`, type: 'INCOME', category_name: 'VENTA DIRECTA',
            description: `Comprobante Contado: ${s.series}-${s.number}`, amount: s.total, date: s.created_at,
            icon: <Store className="w-4 h-4 text-blue-500" />
         });
      });

      // 2. Purchases (Only Paid)
      store.purchases.filter(p => p.payment_status === 'PAID').forEach(p => {
         list.push({
            id: `PUR-${p.id}`, type: 'EXPENSE', category_name: 'COMPRA MERCADERIA',
            description: `Compra Proveedor: ${p.supplier_name}`, amount: p.total, date: p.issue_date,
            icon: <Briefcase className="w-4 h-4 text-rose-500" />
         });
      });

      // 3. Manual Expenses/Income & System-generated (Liquidations, Collections)
      store.cashMovements.forEach(m => {
         let DynamicIcon = m.type === 'INCOME' ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />;

         if (m.category_name === 'LIQUIDACION RUTA' || m.description.includes('Liquidación')) {
            DynamicIcon = <Truck className="w-4 h-4 text-emerald-600" />;
         } else if (m.category_name === 'COBRANZA MANUAL' || m.description.includes('Planilla de Cobranza')) {
            DynamicIcon = <Coins className="w-4 h-4 text-amber-500" />;
         }

         list.push({
            ...m,
            icon: DynamicIcon
         });
      });

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
            if (m.type === 'EXPENSE') acc[m.category_name] = (acc[m.category_name] || 0) + m.amount;
         });
         return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 5); // Top 5 Expenses
      }, []);

      const upcomingPayments = store.scheduledTransactions
         .filter(t => t.is_active)
         .sort((a, b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime())
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
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center"><BarChart3 className="w-4 h-4 mr-2" /> Top Gastos del Periodo</h4>
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
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center"><Clock className="w-4 h-4 mr-2" /> Próximos Vencimientos (Programados)</h4>
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
      const [editId, setEditId] = useState<string | null>(null);
      const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
      const [amount, setAmount] = useState(0);
      const [desc, setDesc] = useState('');
      const [catId, setCatId] = useState('');

      const openModal = (type: 'INCOME' | 'EXPENSE', movement?: CashMovement) => {
         setModalType(type);
         if (movement) {
            setEditId(movement.id);
            setCatId(movement.category_id || '');
            setAmount(movement.amount);
            setDesc(movement.description);
            setDate(movement.date.split('T')[0]);
         } else {
            setEditId(null);
            setCatId('');
            setAmount(0);
            setDesc('');
            setDate(new Date().toISOString().split('T')[0]);
         }
         setShowModal(true);
      };

      const handleSubmit = () => {
         if (amount <= 0 || !catId || !date) return;
         const cat = store.expenseCategories.find(c => c.id === catId);

         if (editId) {
            const existing = store.cashMovements.find(m => m.id === editId);
            if (existing) {
               store.updateCashMovement({
                  ...existing,
                  category_name: cat?.name || 'GENERIC',
                  category_id: catId,
                  amount,
                  description: desc || 'Movimiento manual',
                  date: new Date(date + 'T12:00:00Z').toISOString() // Force date string
               });
            }
         } else {
            store.addCashMovement({
               id: crypto.randomUUID(),
               type: modalType,
               category_name: cat?.name || 'GENERIC',
               category_id: catId,
               amount,
               description: desc || 'Movimiento manual',
               date: new Date(date + 'T12:00:00Z').toISOString(),
               user_id: store.currentUser?.name || store.currentUser?.id
            });
         }

         setShowModal(false);
      };

      const handleDelete = (id: string) => {
         if (confirm("¿Estás seguro de eliminar este movimiento? Afectará el cuadre de caja actual.")) {
            store.deleteCashMovement(id);
         }
      };

      return (
         <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-slate-700">Registro Detallado</h3>
               <div className="flex gap-2">
                  <button onClick={() => openModal('INCOME')} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-green-700 flex items-center shadow-sm">
                     <Plus className="w-4 h-4 mr-1" /> Ingreso
                  </button>
                  <button onClick={() => openModal('EXPENSE')} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-red-700 flex items-center shadow-sm">
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
                        <th className="p-3">Responsable</th>
                        <th className="p-3 text-right">Monto</th>
                        <th className="p-3 w-16"></th>
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
                           <td className="p-3">
                              <div className="flex items-center gap-2">
                                 {m.icon}
                                 <span className="font-bold text-slate-700 text-xs uppercase">{m.category_name}</span>
                              </div>
                           </td>
                           <td className="p-3 text-slate-600">
                              <div className="flex flex-col">
                                 <span>{m.description}</span>
                                 <span className="text-[9px] text-slate-400 font-mono mt-0.5">{m.id}</span>
                              </div>
                           </td>
                           <td className="p-3 text-slate-600">
                              <div className="flex items-center gap-1 text-xs">
                                 <User className="w-3 h-3 text-slate-400" />
                                 {m.user_id || 'SISTEMA'}
                              </div>
                           </td>
                           <td className={`p-3 text-right font-bold ${m.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                              {m.type === 'INCOME' ? '+' : '-'} S/ {m.amount.toFixed(2)}
                           </td>
                           <td className="p-3">
                              {/* Show Edit/Delete only for pure manual entries. Automatics have reference_id matching SALE or LIQ */}
                              {(!m.id.startsWith('SALE-') && !m.id.startsWith('PUR-') && !m.reference_id && m.category_name !== 'LIQUIDACION RUTA' && m.category_name !== 'COBRANZA MANUAL') && (
                                 <div className="flex gap-2 justify-end">
                                    <button onClick={() => openModal(m.type, m)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors"><Settings className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(m.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                 </div>
                              )}
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
                        {modalType === 'INCOME' ? <TrendingUp className="mr-2" /> : <TrendingDown className="mr-2" />}
                        Registrar {modalType === 'INCOME' ? 'Ingreso' : 'Gasto'}
                     </h3>
                     <div className="space-y-4">
                        <div>
                           <label className="block text-xs font-bold text-slate-600 mb-1">Fecha</label>
                           <input type="date" className="w-full border border-slate-300 p-2 rounded bg-slate-50 font-bold text-slate-700" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
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
         if (confirm("¿Confirmar pago de esta cuota? Se generará el egreso y se actualizará la próxima fecha.")) {
            store.processScheduledTransaction(txId, store.currentUser?.name || store.currentUser?.id || 'SISTEMA');
         }
      };

      const handleDeletePlanner = (txId: string) => {
         if (confirm("¿Eliminar este gasto programado? No se generarán más egresos automáticos para él.")) {
            store.deleteScheduledTransaction(txId);
         }
      };

      return (
         <div className="flex gap-6 h-full">
            <div className="flex-1 bg-white rounded-lg shadow border border-slate-200 flex flex-col">
               <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <div>
                     <h3 className="font-bold text-slate-700">Programación de Pagos</h3>
                     <p className="text-xs text-slate-500">Gastos fijos, alquileres y proveedores</p>
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
                                    <div className="flex items-center justify-center gap-2">
                                       <button onClick={() => handleProcess(t.id)} className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded text-xs font-bold border border-green-200 flex items-center transition-colors">
                                          <CheckCircle className="w-3 h-3 mr-1" /> Procesar Pago
                                       </button>
                                       <button onClick={() => handleDeletePlanner(t.id)} className="p-1 text-slate-400 hover:bg-red-100 hover:text-red-600 rounded transition-colors" title="Eliminar Programación">
                                          <Trash2 className="w-4 h-4" />
                                       </button>
                                    </div>
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
                                 <option value="SUPPLIER">Proveedor</option>
                              </select>
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">
                                 {beneficiaryType === 'SUPPLIER' ? 'Seleccionar Proveedor' : 'Nombre / Concepto'}
                              </label>
                              {beneficiaryType === 'SUPPLIER' ? (
                                 <select className="w-full border border-slate-300 p-2 rounded text-sm" onChange={e => {
                                    const sup = store.suppliers.find(x => x.id === e.target.value);
                                    setFormData({ ...formData, beneficiary_id: e.target.value, name: `PAGO RECURRENTE: ${sup?.name}` });
                                 }}>
                                    <option value="">-- Seleccionar --</option>
                                    {store.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                 </select>
                              ) : (
                                 <input className="w-full border border-slate-300 p-2 rounded text-sm" placeholder="Ej. Alquiler Local, Internet..." value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                              )}
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Categoría Gasto</label>
                              <select className="w-full border border-slate-300 p-2 rounded text-sm" value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })}>
                                 <option value="">-- Seleccionar --</option>
                                 {store.expenseCategories.filter(c => c.type === 'EXPENSE').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Monto Cuota (S/)</label>
                              <input type="number" className="w-full border border-slate-300 p-2 rounded text-sm font-bold" value={formData.amount} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} />
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Frecuencia</label>
                              <select className="w-full border border-slate-300 p-2 rounded text-sm" value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value as any })}>
                                 <option value="MONTHLY">Mensual</option>
                                 <option value="WEEKLY">Semanal</option>
                                 <option value="BIWEEKLY">Quincenal</option>
                                 <option value="ONETIME">Una sola vez (Diferido)</option>
                              </select>
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Primer Vencimiento</label>
                              <input type="date" className="w-full border border-slate-300 p-2 rounded text-sm" value={formData.next_due_date} onChange={e => setFormData({ ...formData, next_due_date: e.target.value })} />
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
      const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

      const handleAdd = () => {
         if (!name) return;
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

   // ====================
   // SESSION ARQUEO VIEW
   // ====================
   const SessionView = () => {
      const activeSession = store.currentCashSession;

      const [openingAmount, setOpeningAmount] = useState(0);

      // Denominations State for Closing
      const [b200, setB200] = useState(0); const [b100, setB100] = useState(0); const [b50, setB50] = useState(0); const [b20, setB20] = useState(0); const [b10, setB10] = useState(0);
      const [m5, setM5] = useState(0); const [m2, setM2] = useState(0); const [m1, setM1] = useState(0); const [m05, setM05] = useState(0); const [m02, setM02] = useState(0); const [m01, setM01] = useState(0);
      const [vouchers, setVouchers] = useState(0); const [transfers, setTransfers] = useState(0);

      // Live Calculation inside shift
      let liveIncome = 0; let liveExpense = 0;
      if (activeSession) {
         // Gather movements strictly within this session's time bound
         const mVs = store.cashMovements.filter(m => new Date(m.date) >= new Date(activeSession.open_time) && m.reference_id !== activeSession.id);
         liveIncome += mVs.filter(m => m.type === 'INCOME').reduce((a, b) => a + b.amount, 0);
         liveExpense += mVs.filter(m => m.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
         // Gather Sales
         const saleVs = store.sales.filter(s => s.payment_method === 'CONTADO' && !s.document_type.includes('NOTA') && new Date(s.created_at) >= new Date(activeSession.open_time));
         liveIncome += saleVs.reduce((a, b) => a + b.total, 0);
      }

      const expectedCurrentBalance = activeSession ? activeSession.system_opening_amount + liveIncome - liveExpense : 0;

      const totalCashDeclared = (b200 * 200) + (b100 * 100) + (b50 * 50) + (b20 * 20) + (b10 * 10) +
         (m5 * 5) + (m2 * 2) + (m1 * 1) + (m05 * 0.5) + (m02 * 0.2) + (m01 * 0.1);
      const totalDeclared = totalCashDeclared + vouchers + transfers;

      const handleOpen = () => {
         if (openingAmount < 0) return;
         store.openCashSession(openingAmount, store.currentUser?.name || store.currentUser?.id || 'SISTEMA');
         setOpeningAmount(0);
      };

      const handleClose = () => {
         if (!activeSession) return;
         if (confirm("¿Confirmar el cierre de caja y guardar el arqueo final? Esta acción no se puede deshacer.")) {
            store.closeCashSession(activeSession.id, {
               declared_cash: totalCashDeclared,
               declared_vouchers: vouchers,
               declared_transfers: transfers,
               declared_total: totalDeclared,
               details: { b200, b100, b50, b20, b10, m5, m2, m1, m05, m02, m01 }
            }, store.currentUser?.name || store.currentUser?.id || 'SISTEMA');

            // Reset inputs
            setB200(0); setB100(0); setB50(0); setB20(0); setB10(0);
            setM5(0); setM2(0); setM1(0); setM05(0); setM02(0); setM01(0);
            setVouchers(0); setTransfers(0);
         }
      };

      if (!activeSession) {
         return (
            <div className="flex flex-col items-center justify-center h-full animate-fade-in">
               <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center max-w-md w-full">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                     <Briefcase className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">Caja Cerrada</h3>
                  <p className="text-slate-500 mb-8">Inicia tu turno de caja ingresando el monto base inicial (sencillo) con el que arrancas.</p>

                  <div className="text-left mb-6">
                     <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Monto Inicial en Efectivo (S/)</label>
                     <input type="number"
                        className="w-full border-2 border-slate-200 focus:border-emerald-500 p-4 rounded-xl text-2xl font-black text-center text-slate-700 bg-slate-50 transition-colors"
                        value={openingAmount} onChange={e => setOpeningAmount(Number(e.target.value))} autoFocus />
                  </div>

                  <button onClick={handleOpen} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-md transition-all active:scale-95 text-lg">
                     APERTURAR CAJA
                  </button>

                  {/* Previous Sessions Lists */}
                  <div className="mt-8 text-left border-t border-slate-100 pt-6">
                     <h4 className="font-bold text-slate-600 mb-3 text-xs uppercase">Últimos Cierres Registrados</h4>
                     <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {store.cashSessions.filter(s => s.status === 'CLOSED').slice(0, 5).map(s => (
                           <div key={s.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                              <div>
                                 <p className="font-bold text-slate-700 text-sm">{new Date(s.close_time!).toLocaleString()}</p>
                                 <p className="text-xs text-slate-500">Cajero: {s.closed_by}</p>
                              </div>
                              <div className="text-right">
                                 <p className="font-bold text-slate-800">S/ {s.declared_total.toFixed(2)}</p>
                                 <p className={`text-xs font-bold ${s.difference < 0 ? 'text-red-500' : s.difference > 0 ? 'text-green-500' : 'text-slate-400'}`}>
                                    Dif: {s.difference > 0 ? '+' : ''}{s.difference.toFixed(2)}
                                 </p>
                              </div>
                           </div>
                        ))}
                        {store.cashSessions.filter(s => s.status === 'CLOSED').length === 0 && <p className="text-center text-xs italic text-slate-400 py-4">Sin historial previo.</p>}
                     </div>
                  </div>
               </div>
            </div>
         );
      }

      return (
         <div className="flex gap-6 h-full animate-fade-in">
            {/* Control Panel / Summary */}
            <div className="w-1/3 flex flex-col gap-4">
               <div className="bg-slate-900 p-6 rounded-2xl shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                     <Coins className="w-24 h-24" />
                  </div>
                  <div className="relative z-10 flex items-center justify-between">
                     <div>
                        <p className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> TURNO ACTIVO</p>
                        <p className="text-slate-300 text-xs">Cajero: <span className="text-white font-bold">{activeSession.opened_by}</span></p>
                        <p className="text-slate-300 text-xs">Abrió: <span className="text-white">{new Date(activeSession.open_time).toLocaleTimeString()}</span></p>
                     </div>
                  </div>

                  <div className="mt-6 space-y-3 relative z-10">
                     <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                        <span className="text-slate-400">Saldo Inicial</span>
                        <span className="text-white font-bold">S/ {activeSession.system_opening_amount.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                        <span className="text-slate-400">Total Ingresos (+ Ventas)</span>
                        <span className="text-emerald-400 font-bold">+ S/ {liveIncome.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                        <span className="text-slate-400">Total Egresos</span>
                        <span className="text-red-400 font-bold">- S/ {liveExpense.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center pt-2">
                        <span className="text-slate-300 font-bold uppercase text-xs">Debería Haber (Sistema)</span>
                        <span className="text-white text-2xl font-black">S/ {expectedCurrentBalance.toFixed(2)}</span>
                     </div>
                  </div>
               </div>

               <div className="bg-white p-6 rounded-2xl shadow border border-slate-200 flex-1 flex flex-col">
                  <h3 className="font-bold text-slate-800 flex items-center mb-4"><BarChart3 className="w-5 h-5 mr-2 text-indigo-500" /> Resumen de Declaración</h3>

                  <div className="space-y-4 flex-1">
                     <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 font-bold text-sm">Efectivo Físico</span>
                        <span className="text-slate-900 font-black">S/ {totalCashDeclared.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 font-bold text-sm">Tarjetas / Vouchers</span>
                        <span className="text-slate-900 font-black">S/ {vouchers.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 font-bold text-sm">Yape / Plin / Transf.</span>
                        <span className="text-slate-900 font-black">S/ {transfers.toFixed(2)}</span>
                     </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4 mt-auto">
                     <div className="flex justify-between items-center px-2 mb-4">
                        <span className="text-slate-800 font-bold text-lg">Total Físico:</span>
                        <span className="text-indigo-600 font-black text-2xl">S/ {totalDeclared.toFixed(2)}</span>
                     </div>

                     <div className={`p-4 rounded-xl text-center mb-6 animate-fade-in ${totalDeclared === 0 ? 'bg-slate-50 text-slate-500 border border-slate-200'
                           : (totalDeclared - expectedCurrentBalance) === 0 ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                              : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                        <p className="text-xs font-bold uppercase mb-1">Diferencia de Arqueo</p>
                        {totalDeclared === 0 ? (
                           <span className="font-bold text-lg">Ingresa los montos conteados</span>
                        ) : (
                           <span className="font-black text-2xl">
                              {(totalDeclared - expectedCurrentBalance) > 0 ? '+' : ''}{(totalDeclared - expectedCurrentBalance).toFixed(2)}
                           </span>
                        )}
                     </div>

                     <button onClick={handleClose} disabled={totalDeclared === 0 && expectedCurrentBalance > 0} className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-md transition-all active:scale-95 text-lg flex justify-center items-center">
                        <Save className="w-5 h-5 mr-2" /> GENERAR CIERRE
                     </button>
                  </div>
               </div>
            </div>

            {/* Detailed Count Interface */}
            <div className="flex-1 bg-white p-6 rounded-2xl shadow border border-slate-200 overflow-y-auto">
               <h3 className="font-bold text-xl text-slate-800 mb-6 flex items-center border-b border-slate-100 pb-4">
                  Contador de Billetes y Monedas
               </h3>

               <div className="grid grid-cols-2 gap-8">
                  {/* Billetes */}
                  <div>
                     <h4 className="font-bold text-slate-500 mb-4 text-xs uppercase tracking-widest border-l-4 border-emerald-500 pl-2">Billetes</h4>
                     <div className="space-y-3">
                        {[
                           { val: 200, label: 'S/ 200.00', state: b200, setter: setB200 },
                           { val: 100, label: 'S/ 100.00', state: b100, setter: setB100 },
                           { val: 50, label: 'S/ 50.00', state: b50, setter: setB50 },
                           { val: 20, label: 'S/ 20.00', state: b20, setter: setB20 },
                           { val: 10, label: 'S/ 10.00', state: b10, setter: setB10 },
                        ].map(item => (
                           <div key={item.val} className="flex items-center gap-3">
                              <span className="w-24 text-right font-bold text-slate-700">{item.label}</span>
                              <span className="text-slate-300">x</span>
                              <input type="number" min="0" className="w-20 border border-slate-300 p-2 rounded text-center font-bold text-lg text-emerald-700 bg-emerald-50 focus:ring-emerald-500" value={item.state} onChange={e => item.setter(Math.max(0, parseInt(e.target.value) || 0))} />
                              <span className="w-24 font-bold text-slate-400 text-right">= S/ {(item.val * item.state).toFixed(2)}</span>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Monedas */}
                  <div>
                     <h4 className="font-bold text-slate-500 mb-4 text-xs uppercase tracking-widest border-l-4 border-amber-500 pl-2">Monedas</h4>
                     <div className="space-y-3">
                        {[
                           { val: 5, label: 'S/ 5.00', state: m5, setter: setM5 },
                           { val: 2, label: 'S/ 2.00', state: m2, setter: setM2 },
                           { val: 1, label: 'S/ 1.00', state: m1, setter: setM1 },
                           { val: 0.5, label: 'S/ 0.50', state: m05, setter: setM05 },
                           { val: 0.2, label: 'S/ 0.20', state: m02, setter: setM02 },
                           { val: 0.1, label: 'S/ 0.10', state: m01, setter: setM01 },
                        ].map(item => (
                           <div key={item.val} className="flex items-center gap-3">
                              <span className="w-24 text-right font-bold text-slate-700">{item.label}</span>
                              <span className="text-slate-300">x</span>
                              <input type="number" min="0" className="w-20 border border-slate-300 p-2 rounded text-center font-bold text-lg text-amber-700 bg-amber-50 focus:ring-amber-500" value={item.state} onChange={e => item.setter(Math.max(0, parseInt(e.target.value) || 0))} />
                              <span className="w-24 font-bold text-slate-400 text-right">= S/ {(item.val * item.state).toFixed(2)}</span>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* Digital / Other */}
               <h4 className="font-bold text-slate-500 mt-10 border-b border-slate-100 pb-4 text-xs uppercase tracking-widest border-l-4 border-indigo-500 pl-2">Saldos No Efectivo (Digitales / Tarjetas)</h4>
               <div className="grid grid-cols-2 gap-8 mt-6">
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2">Total en Vouchers (Tarjetas / POS)</label>
                     <div className="flex items-center">
                        <span className="px-4 py-3 bg-slate-100 border border-slate-300 border-r-0 rounded-l font-bold text-slate-500">S/</span>
                        <input type="number" min="0" step="0.01" className="w-full border border-slate-300 p-3 rounded-r font-black text-xl text-indigo-700 focus:ring-indigo-500" value={vouchers} onChange={e => setVouchers(Math.max(0, parseFloat(e.target.value) || 0))} />
                     </div>
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2">Total en Yape / Plin / Transferencias</label>
                     <div className="flex items-center">
                        <span className="px-4 py-3 bg-slate-100 border border-slate-300 border-r-0 rounded-l font-bold text-slate-500">S/</span>
                        <input type="number" min="0" step="0.01" className="w-full border border-slate-300 p-3 rounded-r font-black text-xl text-indigo-700 focus:ring-indigo-500" value={transfers} onChange={e => setTransfers(Math.max(0, parseFloat(e.target.value) || 0))} />
                     </div>
                  </div>
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
               { id: 'SESSION', label: 'Arqueo Caja', icon: Store },
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
            {activeTab === 'SESSION' && <SessionView />}
            {activeTab === 'DASHBOARD' && <DashboardView />}
            {activeTab === 'MOVEMENTS' && <MovementsView />}
            {activeTab === 'PLANNER' && <PlannerView />}
            {activeTab === 'CONFIG' && <ConfigView />}
         </div>
      </div>
   );
};