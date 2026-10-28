import React from 'react';
import { Mail, CheckCircle2, X, AlertCircle } from 'lucide-react';

interface GmailConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  recipientEmail: string;
  reservationCode: string;
  customerName: string;
  isSending?: boolean;
}

export const GmailConfirmModal: React.FC<GmailConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  recipientEmail,
  reservationCode,
  customerName,
  isSending = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-display font-bold text-lg text-white">
                Enviar Aviso via Gmail
              </h3>
              <span className="text-xs text-slate-400">
                Confirmação de envio pela API oficial do Gmail
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSending}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Destinatário:</span>
            <strong className="text-white font-medium">{recipientEmail}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Cliente:</span>
            <strong className="text-white font-medium">{customerName}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Reserva:</span>
            <strong className="text-amber-400 font-mono font-bold">{reservationCode}</strong>
          </div>
          <div className="pt-2 border-t border-slate-700/60 text-slate-300">
            Será disparado um e-mail formatado oficial do restaurante <strong>Qué Pasa</strong> através da sua caixa do Gmail.
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSending}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold transition-all shadow-lg shadow-red-900/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSending ? 'A enviar através do Gmail...' : 'Confirmar Envio'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
