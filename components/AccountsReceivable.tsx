import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { 
  TrendingUp, AlertTriangle, CheckCircle, Clock, 
  Search, Filter, ChevronRight, Download, History, 
  Calendar, User, FileText, ArrowUpRight, ArrowDownRight,
  XCircle, BadgeDollarSign, UserSquare2
} from 'lucide-react';
import { Sale, CollectionRecord } from '../types';
import * as XLSX from 'xlsx';

import { supabase } from '../services/supabase';

export const AccountsReceivable: React.FC = () => {
  const { sales, clients, sellers, collectionRecords, collectionPlanillas } = useStore();

  React.useEffect(() => {
     const initData = async () => {
        const { data: salesData } = await supabase.from('sales').select('*');
        const { data: clientsData } = await supabase.from('clients').select('*');
        const { data: sellersData } = await supabase.from('sellers').select('*');
        
        if (salesData) useStore.setState({ sales: salesData as any[] });
        if (clientsData) useStore.setState({ clients: clientsData as any[] });
        if (sellersData) useStore.setState({ sellers: sellersData as any[] });
     };
     initData();
  }, []);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<string>('ALL');
  const [daysFilter, setDaysFilter] = useState<'ALL' | 'VENCIDO' | '0-15' | '16-30' | '31+'>('ALL');
  
  // Modals
  const [showHistoryModalTarget, setShowHistoryModalTarget] = useState<string | null>(null);

  // Constants
  const TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);

  // Helper to calculate due date and days diff
  const calculateAging = (sale: Sale) => {
    const client = clients.find(c => c.id === sale.client_id || c.doc_number === sale.client_ruc);
    const conditionDays = parseInt(client?.payment_condition || '0') || 0;
    
    const issueDate = new Date(sale.created_at);
    issueDate.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + conditionDays);
    
    const diffTime = TODAY.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // > 0 means overdue
    
    return { dueDate, diffDays, conditionDays };
  };

  // Memoized Data Preparation
  const receivables = useMemo(() => {
    return sales
      .filter(s => {
        const balance = s.balance ?? s.total;
        return balance > 0 && s.status !== 'canceled' && s.document_type !== 'NOTA_CREDITO';
      })
      .map(sale => {
        const aging = calculateAging(sale);
        const seller = sellers.find(sll => sll.id === sale.seller_id);
        const balance = sale.balance ?? sale.total;
        return {
          ...sale,
          ...aging,
          sellerName: seller?.name || 'No Asignado',
          currentBalance: balance
        };
      })
      .sort((a, b) => b.diffDays - a.diffDays); // Most overdue first
  }, [sales, clients, sellers]);

  // Apply Filters
  const filteredReceivables = useMemo(() => {
    return receivables.filter(r => {
      // 1. Search (Client or Doc)
      const matchesSearch = 
        r.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.client_ruc?.includes(searchTerm) ||
        `${r.series}-${r.number}`.toLowerCase().includes(searchTerm.toLowerCase());
      if (searchTerm && !matchesSearch) return false;

      // 2. Seller
      if (selectedSeller !== 'ALL' && r.seller_id !== selectedSeller) return false;

      // 3. Days Filter
      if (daysFilter === 'VENCIDO' && r.diffDays <= 0) return false;
      if (daysFilter === '0-15' && (r.diffDays <= 0 || r.diffDays > 15)) return false;
      if (daysFilter === '16-30' && (r.diffDays < 16 || r.diffDays > 30)) return false;
      if (daysFilter === '31+' && r.diffDays < 31) return false;

      return true;
    });
  }, [receivables, searchTerm, selectedSeller, daysFilter]);

  // KPIs Calculation
  const kpis = useMemo(() => {
    let totalDebt = 0;
    let overdueDebt = 0;
    let currentDebt = 0;
    let debt30Plus = 0;

    const sellerDebtMap: Record<string, { name: string; amount: number }> = {};

    receivables.forEach(r => {
      totalDebt += r.currentBalance;
      if (r.diffDays > 0) {
        overdueDebt += r.currentBalance;
      } else {
        currentDebt += r.currentBalance;
      }

      if (r.diffDays >= 31) {
        debt30Plus += r.currentBalance;
      }

      // Seller Ranking
      const sId = r.seller_id || 'unassigned';
      if (!sellerDebtMap[sId]) {
        sellerDebtMap[sId] = { name: r.sellerName, amount: 0 };
      }
      sellerDebtMap[sId].amount += r.currentBalance;
    });

    const topSellers = Object.values(sellerDebtMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return { totalDebt, overdueDebt, currentDebt, debt30Plus, topSellers };
  }, [receivables]);

  // Handlers
  const handleExportExcel = () => {
    const data = filteredReceivables.map(r => ({
      'Vendedor': r.sellerName,
      'Cliente': r.client_name,
      'RUC/DNI': r.client_ruc,
      'Documento': `${r.series}-${r.number}`,
      'Fecha Emisión': new Date(r.created_at).toLocaleDateString(),
      'Días Crédito': r.conditionDays,
      'Fecha Vencimiento': r.dueDate.toLocaleDateString(),
      'Estado': r.diffDays > 0 ? `Vencido (${r.diffDays} días)` : 'Al día',
      'Total Factura': r.total,
      'Saldo Deudor': r.currentBalance
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cuentas por Cobrar");
    XLSX.writeFile(wb, `Reporte_CxC_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 space-y-6 animate-fade-in p-4 overflow-hidden">
      
      {/* HEADER */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center tracking-tight">
            <TrendingUp className="mr-3 text-blue-600 w-8 h-8" /> 
            Cuentas por Cobrar (CxC)
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-medium ml-11">
            Gestión de cartera, morosidad y antigüedad de deuda.
          </p>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2.5 rounded-xl border border-emerald-200 transition-all shadow-sm hover:shadow active:scale-95"
        >
          <Download className="w-4 h-4 mr-2" /> Exportar Reporte
        </button>
      </div>

      {/* ELITE DASHBOARD KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        {/* KPI 1 */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 relative overflow-hidden group hover:border-blue-200 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Deuda Total</p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tighter">
                <span className="text-lg text-slate-400 font-bold mr-1">S/</span>
                {kpis.totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
              <BadgeDollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 text-xs font-semibold text-slate-500 flex items-center">
            <span>{receivables.length} documentos pendientes</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 relative overflow-hidden group hover:border-red-200 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Deuda Vencida</p>
              <h3 className="text-3xl font-black text-red-600 tracking-tighter">
                <span className="text-lg text-red-400 font-bold mr-1">S/</span>
                {kpis.overdueDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="bg-red-100 p-2.5 rounded-xl text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 text-xs font-bold text-red-500 flex items-center bg-red-50 w-max px-2 py-1 rounded-md border border-red-100">
            <ArrowUpRight className="w-3 h-3 mr-1" />
            Riesgo de Morosidad
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 relative overflow-hidden group hover:border-amber-200 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vencido {'>'} 30 Días</p>
              <h3 className="text-3xl font-black text-amber-600 tracking-tighter">
                <span className="text-lg text-amber-400 font-bold mr-1">S/</span>
                {kpis.debt30Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="bg-amber-100 p-2.5 rounded-xl text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 text-xs font-semibold text-slate-500 flex items-center">
            {(kpis.totalDebt > 0 ? (kpis.debt30Plus / kpis.totalDebt) * 100 : 0).toFixed(1)}% del total
          </div>
        </div>

        {/* KPI 4: TOP SELLER */}
        <div className="bg-slate-900 rounded-2xl p-5 shadow-lg relative overflow-hidden group text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 opacity-50"></div>
          <div className="absolute -right-6 -bottom-6 opacity-10">
            <UserSquare2 className="w-32 h-32" />
          </div>
          <div className="relative z-10 h-full flex flex-col">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Top Vendedores (Morosidad)</p>
            <div className="flex-1 flex flex-col gap-2 justify-center">
              {kpis.topSellers.map((s, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-300 truncate max-w-[120px]">{i + 1}. {s.name}</span>
                  <span className="text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded">S/ {(s.amount / 1000).toFixed(1)}k</span>
                </div>
              ))}
              {kpis.topSellers.length === 0 && <span className="text-sm text-slate-500">Sin datos</span>}
            </div>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4 shrink-0">
        {/* Search */}
        <div className="flex-1 min-w-[250px] relative group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por cliente, RUC o documento..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter: Seller */}
        <div className="w-48">
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
              value={selectedSeller}
              onChange={e => setSelectedSeller(e.target.value)}
            >
              <option value="ALL">Todos los Vendedores</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronRight className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
          </div>
        </div>

        {/* Filter: Aging */}
        <div className="w-48">
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
              value={daysFilter}
              onChange={e => setDaysFilter(e.target.value as any)}
            >
              <option value="ALL">Todas las deudas</option>
              <option value="VENCIDO">Solo Vencidos</option>
              <option value="0-15">Vencidos 0 a 15 días</option>
              <option value="16-30">Vencidos 16 a 30 días</option>
              <option value="31+">Vencidos +31 días</option>
            </select>
            <ChevronRight className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* MAIN TABLE */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/80 backdrop-blur-md text-slate-600 font-bold sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="p-4 pl-6">Documento</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Emisión / Vcto.</th>
                <th className="p-4">Estado (Antigüedad)</th>
                <th className="p-4 text-right">Saldo Deudor</th>
                <th className="p-4 w-16 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReceivables.map((rec) => {
                const isOverdue = rec.diffDays > 0;
                
                let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                let badgeText = 'Al día';
                if (isOverdue) {
                  if (rec.diffDays > 30) {
                    badgeClass = 'bg-red-50 text-red-700 border-red-200';
                    badgeText = `Vencido (${rec.diffDays} días)`;
                  } else if (rec.diffDays > 15) {
                    badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                    badgeText = `Vencido (${rec.diffDays} días)`;
                  } else {
                    badgeClass = 'bg-orange-50 text-orange-700 border-orange-200';
                    badgeText = `Vencido (${rec.diffDays} días)`;
                  }
                }

                return (
                  <tr key={rec.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="font-mono font-bold text-slate-800">{rec.series}-{rec.number}</div>
                      <div className="text-[11px] text-slate-500 font-medium flex items-center mt-1">
                        <User className="w-3 h-3 mr-1" /> {rec.sellerName}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 truncate max-w-[250px]" title={rec.client_name}>{rec.client_name}</div>
                      <div className="text-xs text-slate-500 font-medium">{rec.client_ruc}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-slate-700">{new Date(rec.created_at).toLocaleDateString()}</div>
                      <div className={`text-xs font-bold mt-0.5 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                        Vence: {rec.dueDate.toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border flex w-max items-center shadow-sm ${badgeClass}`}>
                        {isOverdue ? <AlertTriangle className="w-3 h-3 mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                        {badgeText}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-black text-slate-900 text-lg tracking-tight">S/ {rec.currentBalance.toFixed(2)}</div>
                      {rec.currentBalance < rec.total && (
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
                          De: S/ {rec.total.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-center">
                      <button
                        onClick={() => setShowHistoryModalTarget(rec.id)}
                        className="text-slate-400 hover:text-blue-600 bg-white hover:bg-blue-50 p-2 rounded-lg transition-all border border-transparent hover:border-blue-200 shadow-sm opacity-0 group-hover:opacity-100"
                        title="Ver Historial de Pagos"
                      >
                        <History className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredReceivables.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-16">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <div className="bg-slate-50 p-4 rounded-full border border-slate-100 mb-4">
                        <CheckCircle className="w-12 h-12 text-slate-300" />
                      </div>
                      <p className="text-lg font-bold text-slate-600">Cartera Sana</p>
                      <p className="text-sm mt-1">No hay documentos pendientes con los filtros aplicados.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredReceivables.length > 0 && (
              <tfoot className="bg-slate-50 sticky bottom-0 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="p-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">
                    Total Filtrado:
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-black text-xl text-blue-700">
                      S/ {filteredReceivables.reduce((sum, r) => sum + r.currentBalance, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* HISTORY MODAL (Reused logic from CollectionConsolidation) */}
      {showHistoryModalTarget && (() => {
        const sale = sales.find(s => s.id === showHistoryModalTarget);
        if (!sale) return null;
        const historyRecords = collectionRecords.filter(r => r.sale_id === sale.id);
        const currentBalance = sale.balance !== undefined ? sale.balance : sale.total;
        
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:hidden animate-fade-in backdrop-blur-sm">
            <div className="bg-white border-2 border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh] animate-scale-up">
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <h2 className="font-bold flex items-center text-sm uppercase tracking-wider">
                  <History className="w-5 h-5 mr-3 text-blue-400" /> 
                  Historial de Pagos - {sale.series}-{sale.number}
                </h2>
                <button onClick={() => setShowHistoryModalTarget(null)} className="text-slate-300 hover:text-white hover:bg-white/10 p-1.5 rounded-xl transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 bg-slate-50 flex-1 overflow-auto">
                <div className="mb-6 bg-white p-4 border border-slate-200 rounded-xl shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-500 text-xs uppercase">Cliente</span>
                    <span className="text-slate-800 font-bold text-sm">{sale.client_name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-500 text-xs uppercase">Total Facturado</span>
                    <span className="text-slate-600 font-black text-sm">S/ {sale.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-red-50 p-2 rounded-lg border border-red-100 mt-1">
                    <span className="font-bold text-red-700 text-xs uppercase">Saldo Pendiente Actual</span>
                    <span className="text-red-700 font-black text-lg tracking-tight">S/ {currentBalance.toFixed(2)}</span>
                  </div>
                </div>
                
                {historyRecords.length > 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3 pl-4">Fecha Pago</th>
                          <th className="p-3">Recaudador / Medio</th>
                          <th className="p-3 text-right">Importe</th>
                          <th className="p-3 pr-4 text-center">Estado Caja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historyRecords.map(r => {
                          const sellerMatch = sellers.find(s => s.id === r.seller_id);
                          let statusLabel = 'Pendiente Caja';
                          let statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
                          
                          if (r.status === 'VALIDATED') {
                             statusLabel = 'En Planilla';
                             statusColor = 'text-blue-700 bg-blue-50 border-blue-200';
                          }
                          
                          if (r.planilla_id) {
                             const pl = collectionPlanillas.find(p => p.id === r.planilla_id);
                             if (pl?.status === 'ACTIVE') {
                                statusLabel = pl.code ? `Liquidado (${pl.code})` : 'Liquidado';
                                statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                             } else if (pl?.status === 'ANNULLED') {
                                statusLabel = 'Anulado';
                                statusColor = 'text-red-700 bg-red-50 border-red-200 line-through';
                             }
                          }

                          return (
                            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 pl-4">
                                <div className="font-bold text-slate-700">{new Date(r.date_reported).toLocaleDateString()}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {new Date(r.date_reported).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-800 flex items-center">
                                  <User className="w-3 h-3 mr-1 text-slate-400" />
                                  {sellerMatch?.name || r.seller_id}
                                </div>
                                <div className="text-[9px] font-black text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded inline-block mt-1 uppercase tracking-widest">
                                  {r.payment_method}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <div className="font-black text-emerald-600 text-sm tracking-tight">S/ {r.amount_reported.toFixed(2)}</div>
                              </td>
                              <td className="p-3 pr-4 text-center align-middle">
                                <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold border inline-flex items-center shadow-sm ${statusColor}`}>
                                  {statusLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10 bg-white border border-slate-200 rounded-xl border-dashed">
                    <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="font-medium">Este documento no tiene pagos registrados en el sistema.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
