import React, { useState } from 'react';
import { X, Lock, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { RestaurantTable, BlockedPeriod } from '../../types/index.ts';
import { createOwnerBlock } from '../../services/api.ts';
import { getTodayStr } from '../../services/storage.ts';

interface BlockPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  onSuccess: (block: BlockedPeriod) => void;
}

export const BlockPeriodModal: React.FC<BlockPeriodModalProps> = ({
  isOpen,
  onClose,
  tables,
  onSuccess,
}) => {
  const [type, setType] = useState<'dia_inteiro' | 'horario' | 'mesa'>('dia_inteiro');
  const [date, setDate] = useState<string>(getTodayStr());
  const [startTime, setStartTime] = useState<string>('12:30');
  const [endTime, setEndTime] = useState<string>('16:00');
  const [tableId, setTableId] = useState<number>(1);
  const [reason, setReason] = useState<string>('Evento Privado');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Por favor indique o motivo do bloqueio.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const created = await createOwnerBlock({
        type,
        date,
        startTime: type === 'horario' ? startTime : undefined,
        endTime: type === 'horario' ? endTime : undefined,
        tableId: type === 'mesa' ? tableId : null,
        reason: reason.trim(),
      });
      onSuccess(created);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar bloqueio.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl text-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5 text-amber-600">
            <Lock className="w-5 h-5" />
            <h3 className="font-serif-display text-lg font-bold text-slate-900">
              Bloquear Mesa, Horário ou Dia
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {error}
            </div>
          )}

          {/* Type Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Tipo de Bloqueio
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('dia_inteiro')}
                className={`py-2.5 px-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                  type === 'dia_inteiro'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                Dia Inteiro
              </button>
              <button
                type="button"
                onClick={() => setType('horario')}
                className={`py-2.5 px-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                  type === 'horario'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                Horário / Turno
              </button>
              <button
                type="button"
                onClick={() => setType('mesa')}
                className={`py-2.5 px-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                  type === 'mesa'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                Mesa Específica
              </button>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Data a Bloquear *</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Conditional Time range */}
          {type === 'horario' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hora de Início</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hora de Fim</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* Conditional Table Selector */}
          {type === 'mesa' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Selecionar Mesa</label>
              <select
                value={tableId}
                onChange={(e) => setTableId(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Mesa {t.number} ({t.capacity} lugares - {t.section})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Motivo do Bloqueio *</label>
            <input
              type="text"
              required
              placeholder="Ex: Evento Privado, Manutenção, Folga da equipa..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="pt-3 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer border border-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 rounded-xl font-bold cursor-pointer shadow-xs"
            >
              {isLoading ? 'A Guardar...' : 'Ativar Bloqueio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
