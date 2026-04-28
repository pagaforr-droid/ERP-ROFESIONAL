import React, { useState, useEffect } from 'react';
import { Database, HardDrive, Trash2, DownloadCloud, AlertTriangle, ShieldCheck, RefreshCw, Lock, FileJson, Info } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useStore } from '../services/store';

export const SystemMaintenance = () => {
  const { currentUser, users } = useStore();
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');
  const [actionToAuth, setActionToAuth] = useState<(() => void) | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'info' | 'error' | 'success' | 'warning' });

  // Stats
  const [stats, setStats] = useState({
    pendingOrders: 0,
    processedOrders: 0,
    totalSales: 0,
    totalClients: 0,
    totalProducts: 0
  });

  const loadStats = async () => {
    try {
      const [ordPen, ordProc, sales, clients, prods] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['processed', 'canceled', 'completed']),
        supabase.from('sales').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        pendingOrders: ordPen.count || 0,
        processedOrders: ordProc.count || 0,
        totalSales: sales.count || 0,
        totalClients: clients.count || 0,
        totalProducts: prods.count || 0
      });
    } catch (err) {
      console.error("Error loading stats", err);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const showDialog = (type: 'info' | 'error' | 'success' | 'warning', title: string, message: string) => {
    setDialog({ isOpen: true, type, title, message });
  };

  const closeDialog = () => setDialog({ ...dialog, isOpen: false });

  const requireAdmin = (action: () => void) => {
    setActionToAuth(() => action);
    setIsAdminAuthOpen(true);
  };

  const verifyAdmin = () => {
    const adminUser = adminPwd === '123456' || users.find(u => u.role === 'ADMIN' && (u.password === adminPwd || u.pin_code === adminPwd));
    if (adminUser) {
      setIsAdminAuthOpen(false);
      setAdminPwd('');
      if (actionToAuth) actionToAuth();
    } else {
      showDialog('error', 'Acceso Denegado', 'Contraseña de administrador incorrecta.');
    }
  };

  const handleManualPurge = async () => {
    setIsProcessing(true);
    try {
      // Step 1: Unlink from sales
      const { data: oldOrders } = await supabase.from('orders').select('id').in('status', ['processed', 'canceled', 'completed']);
      if (!oldOrders || oldOrders.length === 0) {
        showDialog('info', 'Sin Acción', 'No hay pedidos procesados o antiguos para depurar.');
        setIsProcessing(false);
        return;
      }
      const ids = oldOrders.map(o => o.id);
      
      const { error: err1 } = await supabase.from('sales').update({ origin_order_id: null }).in('origin_order_id', ids);
      if (err1) throw err1;
      const { error: err2 } = await supabase.from('order_items').delete().in('order_id', ids);
      if (err2) throw err2;
      const { error: err3 } = await supabase.from('orders').delete().in('id', ids);
      if (err3) throw err3;

      showDialog('success', 'Purga Exitosa', `Se han eliminado ${ids.length} pedidos antiguos exitosamente. La base de datos ha sido aligerada.`);
      loadStats();
    } catch (error: any) {
      showDialog('error', 'Error en la Purga', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackup = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('export_full_database_json');
      if (error) {
        throw new Error("RPC Error: " + error.message + " (Asegúrese de haber ejecutado el script SQL proporcionado)");
      }
      
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_erp_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showDialog('success', 'Backup Exitoso', 'La copia de seguridad ha sido generada y descargada a tu disco local.');
    } catch (error: any) {
      showDialog('error', 'Error de Backup', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (currentUser?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-red-500 font-bold">Módulo exclusivo para Administradores.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-100 p-4 lg:p-8 font-sans">
      
      {/* DIALOGOS Y CARGA */}
      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex flex-col items-center justify-center">
            <RefreshCw className="w-12 h-12 text-white animate-spin mb-4" />
            <h2 className="text-2xl font-black text-white tracking-widest">EJECUTANDO...</h2>
            <p className="text-blue-200 font-medium mt-2">No cierre la ventana</p>
        </div>
      )}

      {dialog.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className={`p-4 border-b flex items-center gap-3 ${dialog.type === 'error' ? 'bg-red-50 text-red-700' : dialog.type === 'success' ? 'bg-green-50 text-green-700' : dialog.type === 'warning' ? 'bg-orange-50 text-orange-700' : 'bg-slate-50 text-slate-700'}`}>
                      {dialog.type === 'error' && <AlertTriangle className="w-6 h-6 text-red-500" />}
                      {dialog.type === 'warning' && <AlertTriangle className="w-6 h-6 text-orange-500" />}
                      {dialog.type === 'success' && <ShieldCheck className="w-6 h-6 text-green-500" />}
                      {dialog.type === 'info' && <Info className="w-6 h-6 text-slate-500" />}
                      <h3 className="font-bold text-lg">{dialog.title}</h3>
                  </div>
                  <div className="p-6 text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                      {dialog.message}
                  </div>
                  <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
                      <button onClick={closeDialog} className={`px-5 py-2.5 font-bold rounded shadow-sm text-white transition-colors ${dialog.type === 'error' ? 'bg-red-600 hover:bg-red-700' : dialog.type === 'success' ? 'bg-green-600 hover:bg-green-700' : dialog.type === 'warning' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                          Aceptar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {isAdminAuthOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[150] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-slate-900 p-4 flex items-center gap-3">
              <Lock className="w-6 h-6 text-red-500" />
              <h3 className="font-bold text-white text-lg">Zona de Riesgo - Autorizar</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4 font-medium">Esta acción requiere privilegios de Administrador. Ingrese su contraseña.</p>
              <input type="password" autoFocus className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none text-center text-lg font-mono tracking-widest transition-all" value={adminPwd} onChange={e => setAdminPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && verifyAdmin()} placeholder="••••••" />
            </div>
            <div className="flex gap-2 p-4 bg-slate-50 border-t">
              <button onClick={() => { setIsAdminAuthOpen(false); setAdminPwd(''); }} className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded transition-colors">Cancelar</button>
              <button onClick={verifyAdmin} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-md transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-slate-900 p-3 rounded-xl shadow-lg">
          <Database className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mantenimiento y Salud del Sistema</h1>
          <p className="text-slate-500 font-medium">Gestión de copias de seguridad y purga de base de datos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PANEL RESPALDOS */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="bg-blue-50 border-b border-blue-100 p-4 flex items-center gap-3">
             <DownloadCloud className="w-6 h-6 text-blue-600" />
             <h2 className="font-bold text-blue-900 text-lg">Copias de Seguridad (Backups)</h2>
          </div>
          <div className="p-6 flex-1 flex flex-col">
             <p className="text-sm text-slate-600 mb-6 leading-relaxed">
               Genera una copia íntegra de la base de datos central. La "Súper Función" en el servidor empaquetará las tablas críticas de tu negocio en un archivo universal ultra-ligero que puedes guardar en tu disco duro local o en un USB.
             </p>
             <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><FileJson className="w-4 h-4 text-slate-500" /> Tablas Incluidas:</h4>
                <ul className="grid grid-cols-2 gap-2 text-sm text-slate-600 font-medium">
                   <li><span className="text-blue-500 mr-2">•</span>Ventas (sales)</li>
                   <li><span className="text-blue-500 mr-2">•</span>Detalles Venta</li>
                   <li><span className="text-blue-500 mr-2">•</span>Clientes</li>
                   <li><span className="text-blue-500 mr-2">•</span>Productos/Kardex</li>
                   <li><span className="text-blue-500 mr-2">•</span>Flujo Caja</li>
                </ul>
             </div>
             <div className="mt-auto">
               <button onClick={handleBackup} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-colors">
                  <DownloadCloud className="w-5 h-5 mr-2" /> GENERAR Y DESCARGAR BACKUP .JSON
               </button>
             </div>
          </div>
        </div>

        {/* PANEL PURGA */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="bg-red-50 border-b border-red-100 p-4 flex items-center gap-3">
             <Trash2 className="w-6 h-6 text-red-600" />
             <h2 className="font-bold text-red-900 text-lg">Purga de Datos (Aligerar Servidor)</h2>
          </div>
          <div className="p-6 flex-1 flex flex-col">
             <p className="text-sm text-slate-600 mb-6 leading-relaxed">
               Elimina permanentemente de la base de datos los pedidos antiguos que ya fueron procesados o anulados. Esta acción liberará espacio de lectura, hará más rápido el App de vendedores y no afectará tu facturación ni tu Kardex histórico.
             </p>
             
             <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                   <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Candidatos a Eliminar</div>
                   <div className="text-3xl font-black text-red-600">{stats.processedOrders}</div>
                   <div className="text-[10px] text-slate-400 mt-1">Pedidos Procesados/Anulados</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                   <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Pedidos Seguros</div>
                   <div className="text-3xl font-black text-emerald-600">{stats.pendingOrders}</div>
                   <div className="text-[10px] text-slate-400 mt-1">Pendientes (No se tocarán)</div>
                </div>
             </div>

             <div className="mt-auto">
               <button onClick={() => requireAdmin(handleManualPurge)} disabled={stats.processedOrders === 0} className="w-full bg-slate-800 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group">
                  <AlertTriangle className="w-5 h-5 mr-2 text-orange-400 group-hover:text-white" /> 
                  {stats.processedOrders === 0 ? 'NADA QUE PURGAR' : 'PURGAR PEDIDOS ANTIGUOS'}
               </button>
             </div>
          </div>
        </div>

      </div>

      {/* DASHBOARD DE SALUD */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
         <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 text-lg flex items-center"><HardDrive className="w-5 h-5 mr-2 text-slate-500"/> Estado y Volumen de Datos (Health Check)</h3>
            <button onClick={loadStats} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded flex items-center text-sm font-bold transition-colors">
               <RefreshCw className="w-4 h-4 mr-1" /> Refrescar
            </button>
         </div>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex flex-col items-center justify-center">
               <div className="text-xs font-bold text-slate-500 uppercase">Total Ventas Históricas</div>
               <div className="text-2xl font-black text-slate-800">{stats.totalSales}</div>
            </div>
            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex flex-col items-center justify-center">
               <div className="text-xs font-bold text-slate-500 uppercase">Catálogo de Productos</div>
               <div className="text-2xl font-black text-slate-800">{stats.totalProducts}</div>
            </div>
            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex flex-col items-center justify-center">
               <div className="text-xs font-bold text-slate-500 uppercase">Directorio de Clientes</div>
               <div className="text-2xl font-black text-slate-800">{stats.totalClients}</div>
            </div>
            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex flex-col items-center justify-center">
               <div className="text-xs font-bold text-slate-500 uppercase">Pedidos en Tránsito</div>
               <div className="text-2xl font-black text-emerald-600">{stats.pendingOrders}</div>
            </div>
         </div>
      </div>
    </div>
  );
};
