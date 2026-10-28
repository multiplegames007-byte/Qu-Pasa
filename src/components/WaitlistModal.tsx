import React, { useState } from 'react';
import { X, Clock, CheckCircle2, User, Phone, Mail, AlertCircle } from 'lucide-react';
import { addToWaitlist } from '../services/storage.ts';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  defaultTime: string;
  defaultGuests: number;
  onSuccess: () => void;
}

export const WaitlistModal: React.FC<WaitlistModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  defaultTime,
  defaultGuests,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+351 ');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor indique o seu nome completo.');
      return;
    }
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.length < 9) {
      setError('Por favor indique um contacto telefónico válido.');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError('Por favor indique um email válido.');
      return;
    }

    const [h] = defaultTime.split(':').map(Number);
    const shift = (h || 13) < 17 ? 'almoco' : 'jantar';

    addToWaitlist({
      date: defaultDate,
      shift,
      preferredTime: defaultTime || '20:00',
      guests: defaultGuests,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      customerEmail: email.trim(),
      notes: notes.trim(),
    });

    setSubmitted(true);
    setTimeout(() => {
      onSuccess();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="font-serif-display text-lg font-bold text-slate-900">
              Lista de Espera Prioritária
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h4 className="text-lg font-bold text-slate-900">Inscrição Confirmada!</h4>
            <p className="text-sm text-slate-600">
              Assim que uma mesa de {defaultGuests} pessoas ficar disponível para <strong>{defaultDate}</strong>, entraremos de imediato em contacto por SMS e chamada.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
              Não temos mesas disponíveis online para a hora exata selecionada, mas gerimos cancelamentos de última hora com aviso imediato.
            </div>

            <div className="text-xs text-slate-600 flex justify-between pb-1 border-b border-slate-100">
              <span><strong>Data:</strong> {defaultDate}</span>
              <span><strong>Hora pretendida:</strong> {defaultTime || 'Flexível'}</span>
              <span><strong>Pessoas:</strong> {defaultGuests}</span>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Ana Rodrigues"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Telemóvel (para aviso imediato) *</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  placeholder="+351 912 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="exemplo@email.pt"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Observações (opcional)</label>
              <textarea
                rows={2}
                placeholder="Ex: Aceitamos mesa a partir das 20h30"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="w-2/3 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-md"
              >
                Entrar na Lista de Espera
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
