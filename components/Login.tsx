import React, { useState, useEffect } from 'react';
import { useStore } from '../services/store';
import { User, Lock, LogIn, AlertCircle, Box, Truck, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';

export const Login: React.FC = () => {
  const { setCurrentUser, company, setDeliveryMode } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // New feature: Delivery Mode Selection
  const [selectedMode, setSelectedMode] = useState<'REGULAR' | 'EXPRESS_MISMO_DIA'>('REGULAR');

  // Cutoff rule: 4:00 PM (16:00)
  const currentHour = new Date().getHours();
  const isExpressDisabled = currentHour >= 16;

  // Fetch company info on mount so we can display the logo
  useEffect(() => {
    if (company.ruc === '') {
      supabase.from('company_config').select('*').limit(1).maybeSingle().then(({ data }) => {
        if (data) {
          useStore.getState().updateCompany(data);
        }
      });
    }
  }, [company.ruc]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Native Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (authError || !authData.user) {
        setError('Email o contraseña incorrecta.');
        setIsLoading(false);
        return;
      }

      // Fetch ERP profile using auth_id
      const { data: profile, error: profileError } = await supabase
        .from('erp_users')
        .select('*')
        .eq('auth_id', authData.user.id)
        .single();

      if (profileError || !profile) {
        setError('El perfil de usuario ERP no está configurado. Contacte a soporte.');
        setIsLoading(false);
        return;
      }

      if (!profile.is_active) {
        setError('Esta cuenta ha sido desactivada. Contacte al administrador.');
        setIsLoading(false);
        return;
      }

      setDeliveryMode(selectedMode);
      
      const storeUser = { ...profile, permissions: profile.permissions || [] };
      useStore.getState().setSupabaseSessionUser(storeUser);
      
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado al iniciar sesión.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]"></div>
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]"></div>
      </div>

      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-full max-w-[420px] overflow-hidden flex flex-col border border-white/20 relative z-10 animate-fade-in-up">
        
        {/* Header - Brand Presentation */}
        <div className="pt-10 pb-6 px-8 text-center flex flex-col items-center">
          {company.logo_url ? (
            <img 
              src={company.logo_url} 
              alt={company.name || "Logo"} 
              className="h-20 w-auto object-contain drop-shadow-md mb-4"
            />
          ) : (
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 w-20 h-20 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-600/30">
              <Box className="w-10 h-10 text-white" />
            </div>
          )}
          
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            {company.name ? `Portal de Acceso` : 'Tandao ERP'}
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            {company.name ? company.name : 'Sistema de Gestión Integrada'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="px-8 pb-10 space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-black text-slate-500 uppercase tracking-widest z-10 transition-colors group-focus-within:text-blue-600">
                Correo Electrónico
              </label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  autoFocus
                  required
                  type="email"
                  className="w-full pl-11 pr-4 py-3.5 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold text-slate-800 bg-slate-50 focus:bg-white"
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="relative group">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-black text-slate-500 uppercase tracking-widest z-10 transition-colors group-focus-within:text-blue-600">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  required
                  type="password"
                  className="w-full pl-11 pr-4 py-3.5 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold text-slate-800 bg-slate-50 focus:bg-white"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-100">
            <label className="text-xs font-black text-slate-700 mb-3 uppercase flex items-center tracking-wide">
              <Truck className="w-4 h-4 mr-2 text-indigo-500" />
              Modalidad Operativa
            </label>
            <div className="space-y-2.5">
              <label className={`flex items-start p-3 border-2 rounded-xl cursor-pointer transition-all ${selectedMode === 'REGULAR' ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                <div className="mt-0.5">
                   {selectedMode === 'REGULAR' ? <CheckCircle2 className="w-5 h-5 text-indigo-600" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300" />}
                </div>
                <input
                  type="radio"
                  name="deliveryMode"
                  value="REGULAR"
                  checked={selectedMode === 'REGULAR'}
                  onChange={() => setSelectedMode('REGULAR')}
                  className="hidden"
                />
                <span className="ml-3 text-sm font-black text-slate-800 flex-1">
                  Pedidos Regulares
                  <span className="block text-[11px] font-bold text-slate-500 mt-0.5">Despacho para el día siguiente</span>
                </span>
              </label>

              <label className={`flex items-start p-3 border-2 rounded-xl transition-all ${isExpressDisabled ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed' : selectedMode === 'EXPRESS_MISMO_DIA' ? 'border-emerald-500 bg-emerald-50/50 shadow-sm cursor-pointer' : 'border-slate-200 bg-white hover:border-emerald-300 cursor-pointer'}`}>
                <div className="mt-0.5">
                   {selectedMode === 'EXPRESS_MISMO_DIA' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300" />}
                </div>
                <input
                  type="radio"
                  name="deliveryMode"
                  value="EXPRESS_MISMO_DIA"
                  checked={selectedMode === 'EXPRESS_MISMO_DIA'}
                  onChange={() => !isExpressDisabled && setSelectedMode('EXPRESS_MISMO_DIA')}
                  disabled={isExpressDisabled}
                  className="hidden"
                />
                <span className="ml-3 text-sm font-black text-slate-800 flex-1">
                  Pedidos Fuera de Ruta
                  <span className="block text-[11px] font-bold text-slate-500 mt-0.5">
                    Despacho para hoy mismo
                    {isExpressDisabled && <span className="text-red-500 block mt-1 font-black">(Cierre de ventana: 4:00 PM)</span>}
                  </span>
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg text-sm font-bold flex items-start animate-fade-in-down shadow-sm">
              <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black py-4 rounded-xl shadow-xl shadow-blue-600/20 flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center">
                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 AUTENTICANDO...
              </span>
            ) : (
              <>
                 <LogIn className="w-5 h-5 mr-2" />
                 ACCEDER AL SISTEMA
              </>
            )}
          </button>
        </form>
      </div>
      
      {/* Footer Branding */}
      <div className="absolute bottom-6 text-center w-full z-0">
        <p className="text-xs font-bold text-slate-500/50 uppercase tracking-widest">
          Powered by Tandao Systems © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};
