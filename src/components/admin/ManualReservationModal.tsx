import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Users, User, Phone, Mail, Plus, Edit2, CheckCircle2 } from 'lucide-react';
import { RestaurantTable, Reservation } from '../../types/index.ts';
import {
  addReservation,
  updateReservation,
  getDurationForGuests,
  getTodayStr,
  isTableAvailable
} from '../../services/storage.ts';
import { updateOwnerReservation } from '../../services/api.ts';

interface ManualReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  defaultDate?: string;
  defaultTableId?: number;
  initialReservation?: Reservation | null;
  onSuccess: (res: Reservation) => void;
}

export const ManualReservationModal: React.FC<ManualReservationModalProps> = ({
  isOpen,
  onClose,
  tables,
  defaultDate = getTodayStr(),
  defaultTableId,
  initialReservation,
  onSuccess,
}) => {
  const isEditing = Boolean(initialReservation);

  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('20:00');
  const [guests, setGuests] = useState(2);
  const [tableId, setTableId] = useState<number>(defaultTableId || 1);
  const [status, setStatus] = useState<Reservation['status']>('confirmada');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+351 ');
  const [customerEmail, setCustomerEmail] = useState('');
  const [source, setSource] = useState<'telefone' | 'presencial' | 'online'>('telefone');
  const [specialRequestsText, setSpecialRequestsText] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialReservation) {
      setDate(initialReservation.date);
      setTime(initialReservation.time);
      setGuests(initialReservation.guests);
      setTableId(initialReservation.tableId);
      setStatus(initialReservation.status);
      setCustomerName(initialReservation.customerName);
      setCustomerPhone(initialReservation.customerPhone);
      setCustomerEmail(initialReservation.customerEmail);
      setSource(initialReservation.source || 'telefone');
      setSpecialRequestsText(initialReservation.specialRequests?.join(', ') || '');
      setInternalNotes(initialReservation.internalNotes || '');
    } else {
      setDate(defaultDate);
      setTime('20:00');
      setGuests(2);
      setTableId(defaultTableId || (tables.length > 0 ? tables[0].id : 1));
      setStatus('confirmada');
      setCustomerName('');
      setCustomerPhone('+351 ');
      setCustomerEmail('');
      setSource('telefone');
      setSpecialRequestsText('');
      setInternalNotes('');
    }
    setError(null);
  }, [initialReservation, isOpen, defaultDate, defaultTableId, tables]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Por favor indique o nome do cliente.');
      return;
    }

    const durationMin = getDurationForGuests(guests);
    // Check if table is available (exclude self if editing)
    const available = isTableAvailable(
      tableId,
      date,
      time,
      durationMin,
      undefined,
      initialReservation ? initialReservation.id : undefined
    );
    if (!available) {
      setError(`A Mesa ${tableId} não se encontra livre para este horário (${time}) e duração (${durationMin}m). Escolha outra mesa.`);
      return;
    }

    const requests = specialRequestsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (isEditing && initialReservation) {
      try {
        const updated = await updateOwnerReservation(initialReservation.id, {
          date,
          time,
          guests,
          tableId,
          status,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
          specialRequests: requests,
          notes: specialRequestsText.trim(),
          internalNotes: internalNotes.trim(),
          durationMinutes: durationMin,
          source,
        });
        onSuccess(updated);
        onClose();
      } catch (err: any) {
        // Fallback local update
        const local = updateReservation(initialReservation.id, {
          date,
          time,
          guests,
          tableId,
          status,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
          specialRequests: requests,
          notes: specialRequestsText.trim(),
          internalNotes: internalNotes.trim(),
          durationMinutes: durationMin,
          source,
        });
        if (local) onSuccess(local);
        onClose();
      }
    } else {
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
        status,
        durationMinutes: durationMin,
        source,
      });

      onSuccess(newRes);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/75 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Edit2 className="w-5 h-5 text-amber-500" />
            ) : (
              <Plus className="w-5 h-5 text-amber-500" />
            )}
            <div>
              <h3 className="font-serif-display text-lg font-normal text-neutral-900 dark:text-white">
                {isEditing ? `Editar Reserva · ${initialReservation?.code}` : 'Nova Reserva Manual'}
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {isEditing ? 'Atualize os dados e confirme as alterações' : 'Inserção direta pela equipa do restaurante'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm font-sans">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Source Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
              Origem da Reserva
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSource('telefone')}
                className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                  source === 'telefone'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                📞 Telefone
              </button>
              <button
                type="button"
                onClick={() => setSource('presencial')}
                className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                  source === 'presencial'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                🚶 Presencial (Balcão)
              </button>
            </div>
          </div>

          {/* Status selector (available especially when editing) */}
          {isEditing && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                Estado da Reserva
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Reservation['status'])}
                className="w-full px-3 py-2.5 text-base sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl dark:text-white font-medium"
              >
                <option value="confirmada">Confirmada</option>
                <option value="chegou">Chegou (À espera de mesa)</option>
                <option value="sentada">Sentada (Em serviço)</option>
                <option value="concluida">Concluída (Finalizada)</option>
                <option value="cancelada">Cancelada</option>
                <option value="noshow">Falta de Comparência (No-Show)</option>
              </select>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                Data
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 text-base sm:text-sm tabular-nums bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                Hora (Turnos 12:30, 14:00, 19:30, 21:00)
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2.5 text-base sm:text-sm tabular-nums bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl dark:text-white"
                required
              />
            </div>
          </div>

          {/* Guests & Table */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                Nº de Pessoas
              </label>
              <select
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-base sm:text-sm tabular-nums bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl dark:text-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'pessoa' : 'pessoas'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                Mesa Atribuída
              </label>
              <select
                value={tableId}
                onChange={(e) => setTableId(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-base sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl dark:text-white"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Mesa {t.number} ({t.capacity} pax)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer Details */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
              Nome do Cliente *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: João Silveira"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2.5 text-base sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                Telemóvel
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2.5 text-base sm:text-sm tabular-nums bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="cliente@email.pt"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2.5 text-base sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl dark:text-white"
              />
            </div>
          </div>

          {/* Notes & Special Requests */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
              Pedidos Especiais / Alergias
            </label>
            <input
              type="text"
              placeholder="Ex: Alergia a marisco, Aniversário..."
              value={specialRequestsText}
              onChange={(e) => setSpecialRequestsText(e.target.value)}
              className="w-full px-3 py-2.5 text-base sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
              Notas Internas da Equipa
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Cliente VIP habitual, prefere vinho branco..."
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="w-full px-3 py-2.5 text-base sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl dark:text-white"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-neutral-950 bg-amber-500 hover:bg-amber-600 rounded-xl shadow-sm cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditing ? 'Guardar Alterações' : 'Criar Reserva'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
