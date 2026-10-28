import React, { useState } from 'react';
import { Lock, User, ArrowRight, Compass, ShieldCheck, Check } from 'lucide-react';
import { UserAccount } from '../../types/index.ts';
import { ownerLogin } from '../../services/api.ts';

interface AdminLoginProps {
  onLoginSuccess: (user: UserAccount) => void;
  onBackToHome?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onBackToHome }) => {
  const [username, setUsername] = useState('dono@barbaazul.pt');
  const [password, setPassword] = useState('barbaazul2026');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor preencha o email e a palavra-passe.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await ownerLogin(username.trim(), password.trim());
      onLoginSuccess(data.user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Credenciais de proprietário inválidas.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center px-4 py-8 relative">
      {onBackToHome && (
        <button
          onClick={onBackToHome}
          className="absolute top-5 left-5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>← Voltar ao Início</span>
        </button>
      )}
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-slate-800 border border-amber-500/40 text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <Compass className="w-9 h-9" />
          </div>
          <h1 className="font-serif-display text-2xl font-bold tracking-tight text-white">
            Qué Pasa
          </h1>
          <p className="text-xs text-slate-400">
            Acesso Exclusivo da Gerência · Aveiro
          </p>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200/90 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Área protegida por autenticação no servidor. Apenas o proprietário do restaurante tem acesso a este painel.
          </span>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email do Proprietário
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                autoComplete="username"
                inputMode="email"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-3 py-3 text-sm bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Palavra-passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-3 text-sm bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-amber-500 w-4 h-4 focus:ring-0"
              />
              <span>Manter sessão iniciada neste telemóvel</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
          >
            <span>{isLoading ? 'A verificar acesso...' : 'Entrar no Dashboard'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center text-[11px] text-slate-500">
          Credencial padrão configurada: <code>dono@barbaazul.pt</code> / <code>barbaazul2026</code>
        </div>
      </div>
    </div>
  );
};
