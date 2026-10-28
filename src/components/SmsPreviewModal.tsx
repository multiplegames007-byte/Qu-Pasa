import React, { useState } from 'react';
import { X, MessageSquare, CheckCheck, Smartphone, Send, RotateCw, ShieldCheck } from 'lucide-react';
import { Reservation } from '../types/index.ts';

interface SmsPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  onResend?: () => Promise<void>;
}

export const SmsPreviewModal: React.FC<SmsPreviewModalProps> = ({
  isOpen,
  onClose,
  reservation,
  onResend,
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  if (!isOpen || !reservation) return null;

  const smsText =
    reservation.smsMessage ||
    `Qué Pasa: A sua mesa está confirmada! para ${reservation.date} às ${reservation.time} (${reservation.guests} pax, Mesa ${reservation.tableId}). Cais dos Mercantéis 14, Aveiro. Tolerância 20m. Tel: 234 424 208.`;

  const handleResendClick = async () => {
    if (!onResend) return;
    setIsResending(true);
    try {
      await onResend();
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } catch {
      // error handled by parent or toast
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm sm:max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">
                SMS Enviado ao Cliente
              </h3>
              <p className="text-[11px] text-slate-400">
                Notificação automática oficial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Smartphone Shell Mockup */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-950/40">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-inner space-y-3">
            {/* Phone Top Bar */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 border-b border-slate-800 pb-2">
              <span className="font-semibold text-slate-300">Qué Pasa SMS</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCheck className="w-3.5 h-3.5" /> Entregue
              </span>
            </div>

            {/* Recipient info */}
            <div className="text-center py-1">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold flex items-center justify-center mx-auto text-xs">
                QP
              </div>
              <div className="text-xs font-bold text-white mt-1">Qué Pasa · Aveiro</div>
              <div className="text-[11px] font-mono text-slate-400">
                {reservation.customerPhone}
              </div>
            </div>

            {/* SMS Message Bubble */}
            <div className="space-y-1 pt-1">
              <div className="text-[10px] text-center text-slate-500">
                Hoje, {reservation.time} · SMS de Confirmação
              </div>
              <div className="bg-emerald-600 text-white rounded-2xl rounded-bl-sm p-3.5 text-xs sm:text-sm leading-relaxed shadow-md">
                <p className="whitespace-pre-line">{smsText}</p>
                <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-100/80 mt-2">
                  <span>{new Date(reservation.smsSentAt || reservation.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                  <CheckCheck className="w-3 h-3 text-emerald-200" />
                </div>
              </div>
            </div>

            {/* Carrier info */}
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Disparado automaticamente para o telemóvel selecionado ({reservation.customerPhone}).
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
          {onResend ? (
            <button
              onClick={handleResendClick}
              disabled={isResending}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              <span>{resendSuccess ? 'SMS Reenviado!' : isResending ? 'A reenviar...' : 'Reenviar SMS'}</span>
            </button>
          ) : (
            <div className="text-[11px] text-slate-500">
              Código: <strong className="text-slate-300 font-mono">{reservation.code}</strong>
            </div>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
