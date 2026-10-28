import React, { useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'full' }> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed and running as standalone app, hide button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all shadow-sm ${
          variant === 'full' ? 'w-full py-3 px-4 justify-center text-sm' : 'py-2 px-3 text-xs'
        }`}
      >
        <Download className="w-4 h-4" />
        <span>Instalar App no Telemóvel</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold border border-amber-500/30 transition-all ${
            variant === 'full' ? 'w-full py-3 px-4 justify-center text-sm' : 'py-2 px-3 text-xs'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Adicionar ao Ecrã Principal (iOS)</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-white space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Smartphone className="w-5 h-5" />
                  <span>Instalar no iPhone / iPad</span>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p>Para usar o Dashboard como uma App em ecrã inteiro no seu telemóvel:</p>
                <div className="p-3 bg-slate-800/80 rounded-xl space-y-2 border border-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                    <span>Toque no botão <strong>Partilhar</strong> na barra inferior do Safari (ícone com um quadrado e seta para cima).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                    <span>Deslize para baixo e toque em <strong>"Adicionar ao ecrã principal"</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                    <span>Confirme no canto superior direito tocando em <strong>Adicionar</strong>.</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs"
              >
                Compreendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
