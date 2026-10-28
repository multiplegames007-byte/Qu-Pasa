import React, { useState } from 'react';
import {
  X,
  Search,
  Calendar,
  Clock,
  Users,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit2,
  Download,
  AlertCircle
} from 'lucide-react';
import { Reservation, RestaurantSettings } from '../types/index.ts';
import {
  getReservationByCodeAndPhone,
  updateReservation,
  deleteReservation,
  deleteCustomerGdpr,
  generateIcsFile
} from '../services/storage.ts';

interface ManageBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RestaurantSettings;
}

export const ManageBookingModal: React.FC<ManageBookingModalProps> = ({
  isOpen,
  onClose,
  settings,
}) => {
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [searched, setSearched] = useState(false);
  const [currentRes, setCurrentRes] = useState<Reservation | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editGuests, setEditGuests] = useState(2);
  const [editNotes, setEditNotes] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cancellation confirm
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  // GDPR deletion confirm
  const [showGdprConfirm, setShowGdprConfirm] = useState(false);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setFeedbackMsg(null);

    if (!code.trim() || !phone.trim()) {
      setSearchError('Por favor preencha o código de reserva e o telemóvel.');
      return;
    }

    const res = getReservationByCodeAndPhone(code, phone);
    setSearched(true);
    if (res) {
      setCurrentRes(res);
      setEditDate(res.date);
      setEditTime(res.time);
      setEditGuests(res.guests);
      setEditNotes(res.notes || '');
    } else {
      setCurrentRes(null);
      setSearchError('Não encontramos nenhuma reserva com este código e telemóvel. Verifique os dados indicados.');
    }
  };

  const handleSaveEdits = () => {
    if (!currentRes) return;
    const updated = updateReservation(currentRes.id, {
      date: editDate,
      time: editTime,
      guests: editGuests,
      notes: editNotes,
    });
    if (updated) {
      setCurrentRes(updated);
      setIsEditing(false);
      setFeedbackMsg({ type: 'success', text: 'Reserva alterada com sucesso!' });
    }
  };

  const handleCancelReservation = () => {
    if (!currentRes) return;
    const updated = updateReservation(currentRes.id, { status: 'cancelada' });
    if (updated) {
      setCurrentRes(updated);
      setShowCancelConfirm(false);
      setFeedbackMsg({ type: 'success', text: 'A sua reserva foi cancelada com sucesso.' });
    }
  };

  const handleGdprDelete = () => {
    if (!currentRes) return;
    deleteCustomerGdpr(currentRes.customerPhone);
    deleteReservation(currentRes.id);
    setShowGdprConfirm(false);
    setCurrentRes(null);
    setSearched(false);
    setFeedbackMsg({
      type: 'success',
      text: 'Os seus dados pessoais foram completamente apagados e anonimizados nos termos do RGPD.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-serif-display text-lg font-bold text-slate-900">
              Gerir a Minha Reserva
            </h3>
            <p className="text-xs text-slate-500">
              Consulte, altere, cancele ou apague os seus dados de reserva
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Feedback Banner */}
          {feedbackMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Search Form */}
          {!currentRes && (
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-3 text-xs text-sky-900 leading-relaxed">
                Introduza o <strong>Código de Reserva</strong> recebido no ecrã ou email (ex: <code>OQP-7102</code>) e o número de <strong>telemóvel</strong> associado.
              </div>

              {searchError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código de Reserva *
                </label>
                <input
                  type="text"
                  placeholder="Ex: OQP-7102"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2.5 uppercase font-mono tracking-wider text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telemóvel *
                </label>
                <input
                  type="tel"
                  placeholder="Ex: 912 345 678 ou +351 912..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>Localizar Reserva</span>
              </button>
            </form>
          )}

          {/* Reservation Details View */}
          {currentRes && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-xs text-slate-400 font-medium">Reserva</span>
                  <div className="font-mono text-lg font-bold text-sky-900">{currentRes.code}</div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold uppercase ${
                      currentRes.status === 'confirmada'
                        ? 'bg-emerald-100 text-emerald-800'
                        : currentRes.status === 'sentada'
                        ? 'bg-blue-100 text-blue-800'
                        : currentRes.status === 'cancelada'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {currentRes.status}
                  </span>
                </div>
              </div>

              {!isEditing ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block">Titular</span>
                      <strong className="text-slate-800 text-sm">{currentRes.customerName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Mesa</span>
                      <strong className="text-slate-800 text-sm">
                        Mesa {currentRes.tableId}
                        {currentRes.joinedTableId ? ` + ${currentRes.joinedTableId}` : ''}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Data e Hora</span>
                      <strong className="text-slate-800 text-sm">
                        {currentRes.date} às {currentRes.time}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Nº de Pessoas</span>
                      <strong className="text-slate-800 text-sm">{currentRes.guests} pessoas</strong>
                    </div>
                  </div>

                  {currentRes.specialRequests.length > 0 && (
                    <div className="text-xs text-slate-600 bg-amber-50/60 p-3 rounded-lg border border-amber-200/60">
                      <span className="font-semibold text-amber-900 block mb-1">Pedidos Especiais:</span>
                      <span>{currentRes.specialRequests.join(' · ')}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => generateIcsFile(currentRes)}
                        className="py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar .ICS</span>
                      </button>

                      {currentRes.status === 'confirmada' && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="py-2.5 px-3 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Alterar Dados</span>
                        </button>
                      )}
                    </div>

                    {currentRes.status === 'confirmada' && (
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="w-full py-2.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition-colors"
                      >
                        Cancelar Reserva
                      </button>
                    )}

                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                      <button
                        onClick={() => {
                          setCurrentRes(null);
                          setSearched(false);
                        }}
                        className="text-slate-500 hover:underline"
                      >
                        Pesquisar outra reserva
                      </button>

                      <button
                        onClick={() => setShowGdprConfirm(true)}
                        className="text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
                        title="Eliminar os meus dados nos termos do Artigo 17º do RGPD"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Apagar dados (RGPD)</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Editing View */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Data</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hora</label>
                    <input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Número de Pessoas
                    </label>
                    <select
                      value={editGuests}
                      onChange={(e) => setEditGuests(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          {n} pessoas
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Notas adicionais
                    </label>
                    <textarea
                      rows={2}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="w-1/2 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleSaveEdits}
                      className="w-1/2 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
                    >
                      Guardar Alterações
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cancellation Confirmation Dialog */}
          {showCancelConfirm && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Confirmar Cancelamento</span>
              </div>
              <p className="text-xs text-rose-700">
                Tem a certeza que deseja cancelar a sua reserva? A sua mesa ficará imediatamente disponível para outros clientes.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="w-1/2 py-2 bg-white text-slate-700 text-xs font-medium rounded-lg border border-slate-300"
                >
                  Manter Reserva
                </button>
                <button
                  onClick={handleCancelReservation}
                  className="w-1/2 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg shadow-sm"
                >
                  Sim, Cancelar
                </button>
              </div>
            </div>
          )}

          {/* GDPR Erasure Confirmation Dialog */}
          {showGdprConfirm && (
            <div className="p-4 bg-slate-100 border border-slate-300 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                <Trash2 className="w-5 h-5 text-slate-700 shrink-0" />
                <span>Exercer Direito ao Apagamento (RGPD)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ao confirmar, todos os seus dados pessoais (nome, telemóvel, email e notas) serão <strong>permanentemente eliminados e anonimizados</strong> da base de dados do restaurante.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowGdprConfirm(false)}
                  className="w-1/2 py-2 bg-white text-slate-700 text-xs font-medium rounded-lg border border-slate-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGdprDelete}
                  className="w-1/2 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg"
                >
                  Apagar os Meus Dados
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
