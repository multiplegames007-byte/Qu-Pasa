import React, { useState } from 'react';
import { X, Calendar, Clock, Users, User, Phone, Mail, Plus } from 'lucide-react';
import { RestaurantTable, Reservation } from '../../types/index.ts';
import {
  addReservation,
  getDurationForGuests,
  getTodayStr,
  isTableAvailable
} from '../../services/storage.ts';

interface ManualReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  defaultDate?: string;
  defaultTableId?: number;
  onSuccess: (res: Reservation) => void;
}

export const ManualReservationModal: React.FC<ManualReservationModalProps> = ({
  isOpen,
  onClose,
  tables,
  defaultDate = getTodayStr(),
  defaultTableId,
  onSuccess,
}) => {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('20:00');
  const [guests, setGuests] = useState(2);
  const [tableId, setTableId] = useState<number>(defaultTableId || 1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+351 ');
  const [customerEmail, setCustomerEmail] = useState('');
  const [source, setSource] = useState<'telefone' | 'presencial'>('telefone');
  const [specialRequestsText, setSpecialRequestsText] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Por favor indique o nome do cliente.');
      return;
    }

    const durationMin = getDurationForGuests(guests);
    // Check if table is available
    const available = isTableAvailable(tableId, date, time, durationMin);
    if (!available) {
      setError(`A Mesa ${tableId} não se encontra livre para este horário (${time}) e duração (${durationMin}m). Escolha outra mesa.`);
      return;
    }

    const requests = specialRequestsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const newRes = addReservation({
      date,
      time,
      guests,
      tableId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim() || 'presencial@oquepasa.pt',
      specialRequests: requests,
      notes: specialRequestsText.trim(),
      internalNotes: internalNotes.trim(),
      status: 'confirmada',
      durationMinutes: durationMin,
      source,
    });

    onSuccess(newRes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-600" />
            <h3 className="font-serif-display text-lg font-bold text-slate-900 dark:text-white">
              Nova Reserva Manual (Staff)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Source Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Origem da Reserva
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSource('telefone')}
                className={`py-2 rounded-xl font-semibold border transition-all ${
                  source === 'telefone'
                    ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-300'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-400'
                }`}
              >
                📞 Telefone
              </button>
              <button
                type="button"
                onClick={() => setSource('presencial')}
                className={`py-2 rounded-xl font-semibold border transition-all ${
                  source === 'presencial'
                    ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-300'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-400'
                }`}
              >
                🚶 Presencial (Balcão / Walk-in)
              </button>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hora
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
                required
              />
            </div>
          </div>

          {/* Guests & Table */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nº de Pessoas
              </label>
              <select
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'pessoa' : 'pessoas'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mesa Atribuída
              </label>
              <select
                value={tableId}
                onChange={(e) => setTableId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Mesa {t.number} ({t.capacity} pax - {t.section})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome do Cliente *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: João Silveira"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Telemóvel
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email (opcional)
              </label>
              <input
                type="email"
                placeholder="cliente@email.pt"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
              />
            </div>
          </div>

          {/* Notes & Special Requests */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Alergias ou Pedidos Especiais
            </label>
            <input
              type="text"
              placeholder="Ex: Marisco, Aniversário, Cadeira de bebé"
              value={specialRequestsText}
              onChange={(e) => setSpecialRequestsText(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notas Internas da Equipa
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Cliente VIP, amigo do Chef, mesa de canto..."
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl dark:text-white"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 rounded-xl shadow-sm"
            >
              Criar Reserva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
