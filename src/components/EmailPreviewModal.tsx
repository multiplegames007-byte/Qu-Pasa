import React from 'react';
import { X, Mail, Calendar, MapPin, Clock, Users, CheckCircle2 } from 'lucide-react';
import { Reservation, RestaurantSettings } from '../types/index.ts';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  settings: RestaurantSettings;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  reservation,
  settings,
}) => {
  if (!isOpen || !reservation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Email Client Header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-100 border-b border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-sky-600" />
            <span className="font-medium text-slate-700">Simulação de Notificação por Email</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Email Meta */}
        <div className="px-6 py-3 border-b border-slate-100 text-xs space-y-1.5 bg-slate-50/50">
          <div className="flex">
            <span className="w-16 font-semibold text-slate-500">De:</span>
            <span className="text-slate-800 font-medium">Qué Pasa &lt;{settings.email}&gt;</span>
          </div>
          <div className="flex">
            <span className="w-16 font-semibold text-slate-500">Para:</span>
            <span className="text-slate-800">{reservation.customerName} &lt;{reservation.customerEmail}&gt;</span>
          </div>
          <div className="flex">
            <span className="w-16 font-semibold text-slate-500">Assunto:</span>
            <span className="text-slate-900 font-semibold">
              Mesa Confirmada · Código {reservation.code} · Qué Pasa
            </span>
          </div>
        </div>

        {/* Email Content Body */}
        <div className="px-6 py-6 overflow-y-auto space-y-6 text-slate-700 font-sans text-sm">
          {/* Brand Banner */}
          <div className="text-center pb-4 border-b border-slate-100">
            <h1 className="font-serif-display text-2xl font-bold tracking-tight text-slate-900">
              Qué Pasa
            </h1>
            <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold mt-0.5">
              Aveiro
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>A sua mesa está confirmada com sucesso!</span>
            </div>
            <p>
              Olá <strong>{reservation.customerName}</strong>,
            </p>
            <p className="text-slate-600">
              Estamos ansiosos por recebê-lo(a) para uma experiência gastronómica memorável junto aos canais de Aveiro.
            </p>
          </div>

          {/* Reservation Card inside Email */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Código de Reserva</span>
              <span className="font-mono text-base font-bold text-sky-900 bg-sky-100 px-3 py-1 rounded-md">
                {reservation.code}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-slate-500">Data</div>
                  <div className="font-semibold text-slate-800">{reservation.date}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-slate-500">Hora</div>
                  <div className="font-semibold text-slate-800">{reservation.time} ({reservation.durationMinutes} min)</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-slate-500">Lugares</div>
                  <div className="font-semibold text-slate-800">{reservation.guests} pessoas (Mesa {reservation.tableId})</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-slate-500">Local</div>
                  <div className="font-semibold text-slate-800">Cais dos Mercantéis, 14</div>
                </div>
              </div>
            </div>

            {reservation.specialRequests.length > 0 && (
              <div className="pt-2 border-t border-slate-200 text-xs">
                <span className="font-medium text-slate-600">Notas / Pedidos Especiais: </span>
                <span className="text-slate-800">{reservation.specialRequests.join(' · ')}</span>
              </div>
            )}
          </div>

          {/* Useful notes */}
          <div className="text-xs text-slate-500 space-y-2 border-t border-slate-100 pt-4">
            <p>
              • <strong>Tolerância de chegada:</strong> {settings.noShowGraceMinutes || 20} minutos a partir da hora marcada. Caso se atrase, agradecemos que nos contacte por telefone para <strong>{settings.phone || '234 424 208'}</strong>.
            </p>
            <p>
              • <strong>Alterações ou cancelamento:</strong> Pode gerir a sua reserva em qualquer altura no nosso site através do código <strong>{reservation.code}</strong> e do seu telemóvel.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors shadow-sm"
          >
            Fechar Pré-visualização
          </button>
        </div>
      </div>
    </div>
  );
};
