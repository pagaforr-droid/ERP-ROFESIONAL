import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Package, 
  Truck, AlertOctagon, Briefcase, Activity, Calendar, Wallet, PieChart as PieChartIcon 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid 
} from 'recharts';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalSalesToday: 0,
    todaySalesCount: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    todayIncome: 0,
    todayExpense: 0,
    quotaDataInfo: { data: [], percentage: 0, totalSales: 0, quota: 0 },
    sellerStats: [] as any[],
    deliveryData: [] as any[],
    activeRoutesCount: 0,
    criticalStockProducts: [] as any[]
  });

  const currentMonth = new Date().toISOString().substring(0, 7);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        // Ensure we cover from the very start of the month to include timezone offsets
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        
        // 1. Fetch Sales (This month + Active Debt)
        const { data: recentSales } = await supabase
          .from('sales')
          .select('id, total, balance, status, dispatch_status, created_at, seller_id')
          .or(`created_at.gte.${startOfMonth},balance.gt.0`)
          .neq('status', 'canceled');
          
        const validSales = recentSales || [];
        
        // Calculate Sales KPIs
        let totalSalesToday = 0;
        let todaySalesCount = 0;
        let accountsReceivable = 0;
        let totalSalesThisMonth = 0;
        
        validSales.forEach(s => {
           const saleDate = new Date(s.created_at);
           const isTodayStr = saleDate.getFullYear() === today.getFullYear() && 
                              saleDate.getMonth() === today.getMonth() && 
                              saleDate.getDate() === today.getDate();
           
           if (isTodayStr) {
              totalSalesToday += s.total;
              todaySalesCount++;
           }
           if (s.balance > 0) {
              accountsReceivable += s.balance;
           }
           if (s.created_at >= startOfMonth) {
              totalSalesThisMonth += s.total;
           }
        });
        
        // 2. Fetch Accounts Payable
        const { data: purchases } = await supabase
          .from('purchases')
          .select('balance')
          .gt('balance', 0);
        const accountsPayable = (purchases || []).reduce((acc, p) => acc + (p.balance || 0), 0);
        
        // 3. Fetch Cash Movements (Today)
        const { data: cashMovements } = await supabase
          .from('cash_movements')
          .select('type, amount, date')
          .gte('date', todayStr);
          
        let todayIncome = 0;
        let todayExpense = 0;
        (cashMovements || []).forEach(c => {
           const movDate = new Date(c.date);
           if (movDate.getDate() === today.getDate() && movDate.getMonth() === today.getMonth()) {
              if (c.type === 'INCOME') todayIncome += c.amount;
              if (c.type === 'EXPENSE') todayExpense += c.amount;
           }
        });
        
        // 4. Fetch Sellers and Calculate Performance
        const { data: sellers } = await supabase.from('sellers').select('id, name').eq('is_active', true);
        const sellerStatsRaw = (sellers || []).map(seller => {
           const sellerSales = validSales.filter(s => s.seller_id === seller.id);
           const salesToday = sellerSales.filter(s => {
              const saleDate = new Date(s.created_at);
              return saleDate.getFullYear() === today.getFullYear() && 
                     saleDate.getMonth() === today.getMonth() && 
                     saleDate.getDate() === today.getDate();
           }).reduce((sum, s) => sum + s.total, 0);
           const totalDebt = sellerSales.reduce((sum, s) => sum + (s.balance || 0), 0);
           return {
              name: seller.name.split(' ')[0],
              fullName: seller.name,
              salesToday: salesToday,
              debt: totalDebt
           };
        }).sort((a, b) => b.salesToday - a.salesToday);
        
        // 5. Fetch Quotas
        const { data: quotas } = await supabase.from('quotas').select('amount').eq('period', currentMonth).eq('target_type', 'GLOBAL');
        const globalQuotaAmount = quotas && quotas.length > 0 ? quotas[0].amount : 0;
        
        const achieved = Math.min(totalSalesThisMonth, globalQuotaAmount || totalSalesThisMonth || 1);
        const missing = Math.max(0, (globalQuotaAmount || 0) - totalSalesThisMonth);

        const quotaData = [
          { name: 'Avance', value: achieved, color: '#8b5cf6' },
          { name: 'Faltante', value: missing, color: '#e2e8f0' }
        ];
        const quotaPercentage = globalQuotaAmount > 0 
          ? Math.min(100, Math.round((totalSalesThisMonth / globalQuotaAmount) * 100)) 
          : (totalSalesThisMonth > 0 ? 100 : 0);
        
        const quotaDataInfo = { data: quotaData, percentage: quotaPercentage, totalSales: totalSalesThisMonth, quota: globalQuotaAmount };
        
        // 6. Delivery Status
        const { data: dispatchSheets } = await supabase
          .from('dispatch_sheets')
          .select('id, status, sale_ids')
          .gte('date', todayStr)
          .neq('status', 'canceled');
          
        let pendingCount = 0;
        let inTransitCount = 0;
        let deliveredCount = 0;
        let partialCount = 0;
        
        const dispatchSaleIds = (dispatchSheets || []).flatMap(d => d.sale_ids || []);
        
        if (dispatchSaleIds.length > 0) {
           const { data: dispatchSales } = await supabase
              .from('sales')
              .select('dispatch_status')
              .in('id', dispatchSaleIds);
              
           (dispatchSales || []).forEach(s => {
               if (s.dispatch_status === 'pending' || s.dispatch_status === 'assigned') pendingCount++;
               else if (s.dispatch_status === 'in_transit') inTransitCount++;
               else if (s.dispatch_status === 'delivered' || s.dispatch_status === 'liquidated') deliveredCount++;
               else if (s.dispatch_status === 'partial' || s.dispatch_status === 'failed') partialCount++;
           });
        }
        
        const activeRoutesCount = (dispatchSheets || []).filter(d => d.status === 'in_transit' || d.status === 'pending').length;
        
        const deliveryData = [
          { name: 'Entregados', value: deliveredCount, color: '#10b981' },
          { name: 'En Ruta', value: inTransitCount, color: '#3b82f6' },
          { name: 'Pendientes', value: pendingCount, color: '#f59e0b' },
          { name: 'Fallidos', value: partialCount, color: '#ef4444' }
        ].filter(d => d.value > 0);
        
        // 7. Critical Stock
        const { data: products } = await supabase.from('products').select('id, name, sku, category, package_content, package_type').eq('is_active', true);
        const { data: batches } = await supabase.from('batches').select('product_id, quantity_current, warehouse_id');
        
        const criticalStockProductsRaw = (products || []).map(p => {
           const totalStockUnits = (batches || [])
              .filter(b => b.product_id === p.id && b.warehouse_id !== 'MERMAS')
              .reduce((sum, b) => sum + b.quantity_current, 0);
              
           const factor = p.package_content || 1;
           const stockBoxes = totalStockUnits / factor;
           return {
              ...p,
              stockUnits: totalStockUnits,
              stockBoxes
           };
        }).filter(p => p.stockBoxes < 10)
          .sort((a, b) => a.stockBoxes - b.stockBoxes);

        // Update State
        setMetrics({
           totalSalesToday,
           todaySalesCount,
           accountsReceivable,
           accountsPayable,
           todayIncome,
           todayExpense,
           quotaDataInfo,
           sellerStats: sellerStatsRaw,
           deliveryData,
           activeRoutesCount,
           criticalStockProducts: criticalStockProductsRaw
        });
        
      } catch (err) {
         console.error("Error loading dashboard data:", err);
      } finally {
         setLoading(false);
      }
    };
    
    loadDashboardData();
  }, [currentMonth]);

  const formatCurrency = (val: number) => `S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-10 w-10 text-indigo-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-slate-500 font-medium animate-pulse">Conectando con Supabase...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard Estratégico</h2>
          <p className="text-sm text-slate-500">Resumen en tiempo real de operaciones y métricas clave conectadas a Supabase.</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
          <Calendar className="h-5 w-5 text-indigo-500" />
          <span className="font-medium text-indigo-700">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>
      
      {/* 1. KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas Hoy */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Activity className="h-16 w-16 text-emerald-500" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Ventas de Hoy</h3>
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(metrics.totalSalesToday)}</p>
            <p className="text-xs text-slate-500 mt-1">{metrics.todaySalesCount} comprobantes emitidos</p>
          </div>
        </div>

        {/* Cuentas por Cobrar */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Briefcase className="h-16 w-16 text-blue-500" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Por Cobrar (Clientes)</h3>
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-3xl font-bold text-blue-700">{formatCurrency(metrics.accountsReceivable)}</p>
            <p className="text-xs text-slate-500 mt-1">Deuda acumulada activa</p>
          </div>
        </div>

        {/* Cuentas por Pagar */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Package className="h-16 w-16 text-rose-500" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Por Pagar (Prov.)</h3>
            <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-3xl font-bold text-rose-700">{formatCurrency(metrics.accountsPayable)}</p>
            <p className="text-xs text-slate-500 mt-1">Obligaciones pendientes</p>
          </div>
        </div>

        {/* Movimiento Caja Hoy */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Wallet className="h-16 w-16 text-violet-500" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Flujo Caja (Hoy)</h3>
            <div className="p-2 bg-violet-100 rounded-lg text-violet-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.todayIncome - metrics.todayExpense)}</p>
            <div className="flex gap-2 text-xs mt-1">
              <span className="text-emerald-600">+{formatCurrency(metrics.todayIncome)}</span>
              <span className="text-slate-300">|</span>
              <span className="text-rose-600">-{formatCurrency(metrics.todayExpense)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Company Quota Pie Chart */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-indigo-500" />
              Avance de Cuota ({currentMonth})
            </h3>
            <p className="text-sm text-slate-500 mb-6">Progreso global de ventas frente a la meta mensual.</p>
          </div>
          
          <div className="h-64 relative flex items-center justify-center">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={metrics.quotaDataInfo.data}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={80}
                   paddingAngle={5}
                   dataKey="value"
                   stroke="none"
                 >
                   {metrics.quotaDataInfo.data.map((entry: any, index: number) => (
                     <Cell key={`cell-${index}`} fill={entry.color} />
                   ))}
                 </Pie>
                 <Tooltip formatter={(value: number) => formatCurrency(value)} />
               </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-slate-800">{metrics.quotaDataInfo.percentage}%</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Meta</span>
             </div>
          </div>
          <div className="mt-4 flex justify-between items-center text-sm border-t border-slate-100 pt-4">
            <div>
              <p className="text-slate-500">Ventas Mes</p>
              <p className="font-bold text-indigo-700">{formatCurrency(metrics.quotaDataInfo.totalSales)}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Meta Global</p>
              <p className="font-bold text-slate-800">{metrics.quotaDataInfo.quota > 0 ? formatCurrency(metrics.quotaDataInfo.quota) : 'No definida'}</p>
            </div>
          </div>
        </div>

        {/* Sellers Performance Bar Chart */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-blue-500" />
            Rendimiento y Deuda por Vendedor (Hoy)
          </h3>
          <p className="text-sm text-slate-500 mb-6">Comparativa de ventas de hoy vs deuda acumulada histórica.</p>
          
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.sellerStats.slice(0, 10)}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `S/${val/1000}k`} />
                <YAxis yAxisId="right" orientation="right" stroke="#ef4444" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `S/${val/1000}k`} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar yAxisId="left" dataKey="salesToday" name="Ventas (Hoy)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} label={{ position: 'top', formatter: (val: number) => val > 0 ? `S/${(val/1000).toFixed(1)}k` : '', fill: '#3b82f6', fontSize: 11, fontWeight: 'bold' }} />
                <Bar yAxisId="right" dataKey="debt" name="Deuda (Total)" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} label={{ position: 'top', formatter: (val: number) => val > 0 ? `S/${(val/1000).toFixed(1)}k` : '', fill: '#ef4444', fontSize: 11, fontWeight: 'bold' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. Bottom Row: Delivery Progress & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Delivery Status */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Truck className="h-5 w-5 text-emerald-500" />
              Estado de Reparto
            </h3>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">
              {metrics.activeRoutesCount} Rutas Activas
            </span>
          </div>
          
          {metrics.deliveryData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.deliveryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {metrics.deliveryData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-slate-400">
              <Truck className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No hay despachos programados hoy.</p>
            </div>
          )}
        </div>

        {/* Critical Stock */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
            <AlertOctagon className="h-5 w-5 text-rose-500" />
            Stock Crítico ({'< 10 Cajas'})
          </h3>
          <p className="text-sm text-slate-500 mb-4">Productos que requieren reposición inmediata (por debajo del límite crítico).</p>
          
          <div className="flex-1 overflow-auto rounded-lg border border-slate-100 bg-slate-50">
            {metrics.criticalStockProducts.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 sticky top-0 shadow-sm">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Producto</th>
                    <th className="py-3 px-4 font-semibold">Categoría</th>
                    <th className="py-3 px-4 font-semibold text-right">Stock Físico</th>
                    <th className="py-3 px-4 font-semibold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.criticalStockProducts.slice(0, 8).map(prod => (
                    <tr key={prod.id} className="bg-white hover:bg-rose-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{prod.name}</p>
                        <p className="text-xs text-slate-400">SKU: {prod.sku}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{prod.category}</td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-bold text-slate-800">{prod.stockBoxes.toFixed(1)} {prod.package_type || 'Cajas'}</p>
                        <p className="text-xs text-slate-500">({prod.stockUnits} un.)</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${prod.stockBoxes <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>
                          {prod.stockBoxes <= 0 ? 'Agotado' : 'Por Agotar'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                <Package className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Todos los productos tienen niveles de inventario saludables.</p>
              </div>
            )}
          </div>
          {metrics.criticalStockProducts.length > 8 && (
            <p className="text-xs text-slate-500 text-center mt-3 font-medium">
              + {metrics.criticalStockProducts.length - 8} productos más en estado crítico. Revisa el reporte de inventario.
            </p>
          )}
        </div>

      </div>
    </div>
  );
};