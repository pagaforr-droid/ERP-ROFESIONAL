
import React, { useState } from 'react';
import { useStore } from '../services/store';
import { User, Lock, LogIn, AlertCircle, Box, Info } from 'lucide-react';

export const Login: React.FC = () => {
  const { users, setCurrentUser, company } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = users.find(u => u.username === username);

    if (!user) {
      setError('Usuario no encontrado.');
      return;
    }

    if (!user.is_active) {
      setError('Esta cuenta ha sido desactivada. Contacte al administrador.');
      return;
    }

    if (user.password !== password) {
      setError('Contraseña incorrecta.');
      return;
    }

    // Success
    setCurrentUser(user.id);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 p-8 text-center border-b border-slate-700">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Box className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">TraceFlow ERP</h1>
          <p className="text-slate-400 text-sm">Sistema de Gestión de Distribución</p>
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
