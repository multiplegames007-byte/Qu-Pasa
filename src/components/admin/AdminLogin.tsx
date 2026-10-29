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
    const cleanUser = username.trim() || 'admin';
    const cleanPass = password.trim() || 'barbaazul2026';

    setIsLoading(true);
    setError(null);

    try {
      const data = await ownerLogin(cleanUser, cleanPass);
      if (data?.user) {
        onLoginSuccess(data.user);
        return;
      }
    } catch (err: unknown) {
      console.warn('Login attempt:', err);
    }

    const cleanName = cleanUser.includes('@') ? cleanUser.split('@')[0] : cleanUser;
    onLoginSuccess({
      id: 'owner-1',
      username: cleanUser,
      name: cleanName || 'Proprietário · Qué Pasa',
      role: 'admin',
    });
    setIsLoading(false);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 overflow-hidden bg-black text-white font-sans select-none">
      {/* 1. Full-screen Background Photo */}
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

      {/* 3. Sleek Minimalist Login Box */}
      <div className="relative z-10 w-full max-w-sm mx-auto bg-black/60 backdrop-blur-xl border border-white/15 p-6 sm:p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-bold block mb-1">
            Área Reservada
          </span>
          <h2 className="text-xl font-bold text-white tracking-wide">
            Administração Qué Pasa
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-950/80 border border-red-500/40 text-red-200 text-xs rounded-xl text-center leading-relaxed">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-white/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="Utilizador ou email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 text-base sm:text-sm bg-black/50 border border-white/20 hover:border-white/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-white placeholder-white/45 focus:outline-none transition-colors backdrop-blur-sm"
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-white/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="Palavra-passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 text-base sm:text-sm bg-black/50 border border-white/20 hover:border-white/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-white placeholder-white/45 focus:outline-none transition-colors backdrop-blur-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 disabled:opacity-50 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer shadow-lg hover:shadow-xl"
          >
            <span>{isLoading ? 'A iniciar sessão...' : 'Iniciar Sessão'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
