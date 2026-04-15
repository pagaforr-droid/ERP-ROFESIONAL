
import React, { useState } from 'react';
import { useStore } from '../services/store';
import { User, Lock, LogIn, AlertCircle, Box, Info, Truck } from 'lucide-react';
import { supabase, USE_MOCK_DB } from '../services/supabase';

export const Login: React.FC = () => {
  const { users, setCurrentUser, company, setDeliveryMode } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // New feature: Delivery Mode Selection
  const [selectedMode, setSelectedMode] = useState<'REGULAR' | 'EXPRESS_MISMO_DIA'>('REGULAR');

  // Cutoff rule: 4:00 PM (16:00)
  const currentHour = new Date().getHours();
  const isExpressDisabled = currentHour >= 16;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let validUser: any = null;

    if (USE_MOCK_DB) {
       const user = users.find(u => u.username === username);
       if (!user) { setError('Usuario no encontrado.'); return; }
       if (user.password !== password) { setError('Contraseña incorrecta.'); return; }
       validUser = user;
    } else {
       // Software Auth (Option B): Fetching directly against erp_users to bypass native RLS identity for quick deployment
       const { data, error } = await supabase
          .from('erp_users')
          .select('*')
          .eq('username', username)
          .eq('password', password)
          .maybeSingle();

       if (error || !data) {
          setError('Credenciales incorrectas o el usuario no existe.');
          return;
       }
       validUser = data;
    }

    if (!validUser.is_active) {
      setError('Esta cuenta ha sido desactivada. Contacte al administrador.');
      return;
    }

    setDeliveryMode(selectedMode);
    
    // State bridge: inject into Zustand explicitly
    if (!USE_MOCK_DB) {
       const storeUser = { ...validUser, permissions: validUser.permissions || [] };
       useStore.getState().setSupabaseSessionUser(storeUser);
    } else {
       setCurrentUser(validUser.id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 p-8 text-center border-b border-slate-700">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Box className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Tandao ERP</h1>
          <p className="text-slate-400 text-sm">Sistema de Gestión Integrada</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {company.name && (
            <div className="text-center mb-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ingresar a</p>
              <p className="text-lg font-bold text-slate-800">{company.name}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-slate-800"
                  placeholder="Ej. admin"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-slate-800"
                  placeholder="••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-2 uppercase flex items-center">
              <Truck className="w-4 h-4 mr-2" />
              Modalidad de Trabajo (Vendedores)
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border border-slate-300 rounded cursor-pointer bg-white hover:bg-slate-100 transition-colors">
                <input
                  type="radio"
                  name="deliveryMode"
                  value="REGULAR"
                  checked={selectedMode === 'REGULAR'}
                  onChange={() => setSelectedMode('REGULAR')}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-3 text-sm font-bold text-slate-800 flex-1">
                  Pedidos Regulares
                  <span className="block text-xs font-normal text-slate-500">Entrega día siguiente</span>
                </span>
              </label>

              <label className={`flex items-center p-3 border rounded transition-colors ${isExpressDisabled ? 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-60' : 'border-slate-300 cursor-pointer bg-white hover:bg-slate-100'}`}>
                <input
                  type="radio"
                  name="deliveryMode"
                  value="EXPRESS_MISMO_DIA"
                  checked={selectedMode === 'EXPRESS_MISMO_DIA'}
                  onChange={() => !isExpressDisabled && setSelectedMode('EXPRESS_MISMO_DIA')}
                  disabled={isExpressDisabled}
                  className="w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <span className="ml-3 text-sm font-bold text-slate-800 flex-1">
                  Pedidos Fuera de Ruta
                  <span className="block text-xs font-normal text-slate-500">
                    Entrega mismo día
                    {isExpressDisabled && <span className="text-red-500 ml-1 font-bold">(Deshabilitado después de las 4 PM)</span>}
                  </span>
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center animate-fade-in">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg shadow-lg flex items-center justify-center transition-transform active:scale-95"
          >
            <LogIn className="w-5 h-5 mr-2" /> INICIAR SESIÓN
          </button>
        </form>

        {/* Demo Hint */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
          <div className="group relative inline-block">
            <p className="text-xs text-slate-400 cursor-help flex items-center justify-center hover:text-slate-600">
              <Info className="w-3 h-3 mr-1" /> Credenciales Demo
            </p>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-xs p-3 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-left">
              <div className="mb-2"><strong>Admin:</strong> admin / 123456</div>
              <div className="mb-2"><strong>Vendedor:</strong> vendedor1 / 123</div>
              <div className="mb-2"><strong>Almacén:</strong> almacen / 123</div>
              <div><strong>Cliente (Tienda):</strong> cliente / 123</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
