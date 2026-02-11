import React from 'react';
import { useStore } from '../services/store';
import { TrendingUp, Package, Truck, AlertOctagon } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { sales, dispatchSheets, products, batches } = useStore();

  const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
  const activeRoutes = dispatchSheets.filter(d => d.status === 'in_transit' || d.status === 'pending').length;
  
  // Low Stock Logic (Total stock across all batches)
  const lowStockProducts = products.filter(p => {
    const totalStock = batches
      .filter(b => b.product_id === p.id)
      .reduce((sum, b) => sum + b.quantity_current, 0);
    return totalStock < p.min_stock;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Panel Principal</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Ventas Totales</p>
              <p className="text-2xl font-bold text-slate-900">S/ {totalSales.toFixed(2)}</p>
            </div>
            <div className="p-2 bg-green-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Rutas Activas</p>
              <p className="text-2xl font-bold text-slate-900">{activeRoutes}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-full">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Alertas Stock Bajo</p>
              <p className="text-2xl font-bold text-red-600">{lowStockProducts.length}</p>
            </div>
            <div className="p-2 bg-red-100 rounded-full">
              <AlertOctagon className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Lotes Activos</p>
              <p className="text-2xl font-bold text-slate-900">{batches.filter(b => b.quantity_current > 0).length}</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-full">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-4">Ventas Recientes</h3>
          <ul className="space-y-3">
            {sales.slice(0, 5).map(sale => (
              <li key={sale.id} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0">
                <div>
                  <p className="font-medium text-slate-900">{sale.client_name}</p>
                  <p className="text-xs text-slate-500">{new Date(sale.created_at).toLocaleDateString()} - {sale.document_type} {sale.number}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-medium">S/ {sale.total.toFixed(2)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sale.dispatch_status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                    {sale.dispatch_status === 'pending' ? 'Pendiente' : 'Entregado'}
                  </span>
                </div>
              </li>
            ))}
            {sales.length === 0 && <li className="text-slate-400 text-sm">No hay ventas recientes.</li>}
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-4">Alertas de Stock</h3>
          <ul className="space-y-3">
            {lowStockProducts.slice(0, 5).map(prod => (
              <li key={prod.id} className="flex justify-between items-center bg-red-50 p-2 rounded">
                <span className="text-sm font-medium text-slate-700">{prod.name}</span>
                <span className="text-xs font-bold text-red-600">Stock Bajo</span>
              </li>
            ))}
             {lowStockProducts.length === 0 && <li className="text-slate-400 text-sm">Niveles de inventario saludables.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};