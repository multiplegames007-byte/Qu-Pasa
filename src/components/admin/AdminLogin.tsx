import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Lock, Mail } from 'lucide-react';
import { UserAccount } from '../../types/index.ts';
import { ownerLogin } from '../../services/api.ts';

interface AdminLoginProps {
  onLoginSuccess: (user: UserAccount) => void;
  onBackToHome?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onBackToHome }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      const message = err instanceof Error ? err.message : 'Credenciais inválidas.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 overflow-hidden bg-black text-white font-sans select-none">
      {/* 1. Full-screen Background Photo (Same as initial Landing Screen) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src="/quepasa-poster.jpg"
          alt="Qué Pasa · Nikkei · Barba Azul"
          className="w-full h-full object-cover object-center"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              '/src/assets/images/quepasa_nikkei_poster_1793031254762.jpg';
          }}
        />
        {/* Subtle dark tint to ensure text contrast while respecting the poster */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      </div>

      {/* 2. Top-left Back Button */}
      {onBackToHome && (
        <button
          type="button"
          onClick={onBackToHome}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 px-3.5 py-2 rounded-xl bg-black/50 hover:bg-black/70 text-neutral-300 hover:text-white text-xs font-bold border border-white/15 backdrop-blur-md flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar</span>
        </button>
      )}

      {/* 3. Sleek Minimalist Login Box (Without title or subtitle) */}
      <div className="relative z-10 w-full max-w-sm mx-auto bg-black/45 backdrop-blur-xl border border-white/15 p-6 sm:p-8 rounded-3xl shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-950/70 border border-red-500/40 text-red-200 text-xs rounded-xl text-center">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-white/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                autoComplete="username"
                inputMode="email"
                required
                placeholder="Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 text-base sm:text-sm bg-black/40 border border-white/20 hover:border-white/40 focus:border-white rounded-xl text-white placeholder-white/45 focus:outline-none transition-colors backdrop-blur-sm"
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-white/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                autoComplete="current-password"
                required
                placeholder="Palavra-passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 text-base sm:text-sm bg-black/40 border border-white/20 hover:border-white/40 focus:border-white rounded-xl text-white placeholder-white/45 focus:outline-none transition-colors backdrop-blur-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 bg-white hover:bg-neutral-100 text-neutral-950 disabled:opacity-50 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer shadow-lg hover:shadow-xl"
          >
            <span>{isLoading ? 'A entrar...' : 'Entrar'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
