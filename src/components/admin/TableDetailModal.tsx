import React, { useState } from 'react';
import {
  X,
  Users,
  Clock,
  UserCheck,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Link2,
  Unlink,
  Edit,
  Power,
  ArrowRightLeft
} from 'lucide-react';
import { RestaurantTable, Reservation, TableStatus } from '../../types/index.ts';
import {
  updateReservation,
  updateTable,
  saveTables,
  getTables
} from '../../services/storage.ts';

interface TableDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: RestaurantTable | null;
  allTables: RestaurantTable[];
  currentStatus: TableStatus;
  currentReservation?: Reservation;
  onRefresh: () => void;
  isAdmin: boolean;
}

export const TableDetailModal: React.FC<TableDetailModalProps> = ({
  isOpen,
  onClose,
  table,
  allTables,
  currentStatus,
  currentReservation,
  onRefresh,
  isAdmin,
}) => {
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [newCapacity, setNewCapacity] = useState<number>(table?.capacity || 4);
  const [isReassigning, setIsReassigning] = useState(false);
  const [targetTableId, setTargetTableId] = useState<number>(1);
  const [joinPartnerId, setJoinPartnerId] = useState<number>(0);

  if (!isOpen || !table) return null;

  const handleUpdateStatus = (newResStatus: Reservation['status']) => {
    if (currentReservation) {
      updateReservation(currentReservation.id, { status: newResStatus });
      onRefresh();
    }
  };

  const handleSaveCapacity = () => {
    updateTable(table.id, { capacity: newCapacity });
    setIsEditingCapacity(false);
    onRefresh();
  };

  const handleToggleActive = () => {
    updateTable(table.id, { isActive: !table.isActive });
    onRefresh();
  };

  const handleJoinTables = () => {
    if (!joinPartnerId) return;
    const tables = getTables();
    const updated = tables.map((t) => {
      if (t.id === table.id) return { ...t, joinedWithId: joinPartnerId };
      if (t.id === joinPartnerId) return { ...t, joinedWithId: table.id };
      return t;
    });
    saveTables(updated);
    setJoinPartnerId(0);
    onRefresh();
  };

  const handleSeparateTables = () => {
    const partnerId = table.joinedWithId;
    const tables = getTables();
    const updated = tables.map((t) => {
      if (t.id === table.id || t.id === partnerId) {
        return { ...t, joinedWithId: null };
      }
      return t;
    });
    saveTables(updated);
    onRefresh();
  };

  const handleReassignReservation = () => {
    if (currentReservation && targetTableId) {
      updateReservation(currentReservation.id, { tableId: targetTableId });
      setIsReassigning(false);
      onRefresh();
      onClose();
    }
  };

  const getStatusBadge = () => {
    switch (currentStatus) {
      case 'sentada':
        return <span className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Sentada / Em Refeição</span>;
      case 'chegou':
        return <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Cliente Chegou</span>;
      case 'reservada':
        return <span className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Reservada</span>;
      case 'a_limpar':
        return <span className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-2.5 py-1 rounded-full text-xs font-bold uppercase">A Limpar</span>;
      case 'bloqueada':
        return <span className="bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Bloqueada (Hold)</span>;
      case 'livre':
      default:
        return <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 rounded-full text-xs font-bold uppercase">Livre</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base">
              M{table.number}
            </div>
            <div>
              <h3 className="font-serif-display text-lg font-bold text-slate-900 dark:text-white">
                Mesa {table.number}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Capacidade: {table.capacity} lugares · {table.isActive ? 'Ativa' : 'Desativada'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Status Bar */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Estado Atual:</span>
            {getStatusBadge()}
          </div>

          {/* Current Reservation Card (if any) */}
          {currentReservation ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-semibold text-slate-500">Reserva Ativa</span>
                <span className="font-mono font-bold text-sky-700 dark:text-sky-400">{currentReservation.code}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Cliente</span>
                  <strong className="text-slate-800 dark:text-slate-200 text-sm">{currentReservation.customerName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Horário</span>
                  <strong className="text-slate-800 dark:text-slate-200 text-sm">{currentReservation.time} ({currentReservation.durationMinutes}m)</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Pessoas</span>
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">{currentReservation.guests} pax</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Telemóvel</span>
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">{currentReservation.customerPhone}</span>
                </div>
              </div>

              {currentReservation.specialRequests.length > 0 && (
                <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300">
                  <span className="font-bold block mb-0.5">Pedidos / Alergias:</span>
                  <span>{currentReservation.specialRequests.join(' · ')}</span>
                </div>
              )}

              {/* Status Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-2">
                {currentReservation.status === 'confirmada' && (
                  <button
                    onClick={() => handleUpdateStatus('chegou')}
                    className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Marcar Chegada</span>
                  </button>
                )}

                {(currentReservation.status === 'confirmada' || currentReservation.status === 'chegou') && (
                  <button
                    onClick={() => handleUpdateStatus('sentada')}
                    className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Sentar Cliente</span>
                  </button>
                )}

                {currentReservation.status === 'sentada' && (
                  <button
                    onClick={() => handleUpdateStatus('concluida')}
                    className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Concluir Refeição (Limpar)</span>
                  </button>
                )}

                <button
                  onClick={() => setIsReassigning(!isReassigning)}
                  className="py-2 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Trocar de Mesa</span>
                </button>

                <button
                  onClick={() => handleUpdateStatus('noshow')}
                  className="py-2 px-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 rounded-xl text-xs font-semibold"
                >
                  No-Show
                </button>
              </div>

              {/* Reassign Dialog */}
              {isReassigning && (
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl space-y-2 mt-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Mover reserva para outra mesa:
                  </span>
                  <div className="flex gap-2">
                    <select
                      value={targetTableId}
                      onChange={(e) => setTargetTableId(Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white"
                    >
                      {allTables
                        .filter((t) => t.id !== table.id && t.isActive)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            Mesa {t.number} ({t.capacity} pax - {t.section})
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleReassignReservation}
                      className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shrink-0"
                    >
                      Mover
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/50 text-xs text-emerald-800 dark:text-emerald-300 text-center">
              Nenhuma reserva ativa sentada nesta mesa no momento. A mesa está disponível para novas reservas ou clientes de balcão.
            </div>
          )}

          {/* Joined Table Status / Actions */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Configuração e União de Mesas
            </span>

            {table.joinedWithId ? (
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <Link2 className="w-4 h-4 text-amber-600" />
                  <span>Unida com a <strong>Mesa {table.joinedWithId}</strong> para grupos maiores</span>
                </div>
                <button
                  onClick={handleSeparateTables}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Separar</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={joinPartnerId}
                  onChange={(e) => setJoinPartnerId(Number(e.target.value))}
                  className="w-full text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white"
                >
                  <option value={0}>Juntar com mesa vizinha...</option>
                  {allTables
                    .filter((t) => t.id !== table.id && !t.joinedWithId && t.isActive)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        Juntar com Mesa {t.number} ({table.capacity + t.capacity} lugares total)
                      </option>
                    ))}
                </select>
                <button
                  disabled={!joinPartnerId}
                  onClick={handleJoinTables}
                  className="px-4 py-2 bg-amber-600 disabled:opacity-50 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shrink-0 transition-colors"
                >
                  Juntar
                </button>
              </div>
            )}
          </div>

          {/* Admin Table Controls (Capacity, Toggle Active) */}
          {isAdmin && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Controlo da Mesa (Administrador)
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Capacity Edit */}
                {!isEditingCapacity ? (
                  <button
                    onClick={() => setIsEditingCapacity(true)}
                    className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5"
                  >
                    <Edit className="w-3.5 h-3.5 text-slate-500" />
                    <span>Capacidade ({table.capacity} pax)</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={newCapacity}
                      onChange={(e) => setNewCapacity(Number(e.target.value))}
                      className="w-16 p-1.5 text-xs border rounded-lg dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      onClick={handleSaveCapacity}
                      className="p-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold"
                    >
                      Salvar
                    </button>
                  </div>
                )}

                {/* Toggle Active */}
                <button
                  onClick={handleToggleActive}
                  className={`p-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    table.isActive
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{table.isActive ? 'Desativar Mesa' : 'Ativar Mesa'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
