import React from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-serif-display text-lg font-bold text-slate-900">
              Política de Privacidade e RGPD
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto space-y-4 text-sm text-slate-600 leading-relaxed">
          <p>
            O restaurante <strong>Qué Pasa</strong> (sito no Cais dos Mercantéis, nº 14, 3800-228 Aveiro) está comprometido com a proteção e confidencialidade dos seus dados pessoais, em estrito cumprimento com o Regulamento Geral sobre a Proteção de Dados (RGPD - Regulamento UE 2016/679).
          </p>

          <h4 className="font-semibold text-slate-800 text-sm pt-1">1. Finalidade do Tratamento</h4>
          <p>
            Os dados recolhidos (nome, número de telemóvel, endereço de email e notas alimentares/alergias) destinam-se exclusivamente à gestão, confirmação e acompanhamento da sua reserva de mesa, envio de lembretes e garantia de segurança alimentar.
          </p>

          <h4 className="font-semibold text-slate-800 text-sm pt-1">2. Prazo de Conservação</h4>
          <p>
            Os dados relativos à reserva são conservados apenas durante o período necessário à prestação do serviço e cumprimento de obrigações legais, sendo expurgados ou anonimizados periodicamente.
          </p>

          <h4 className="font-semibold text-slate-800 text-sm pt-1">3. Direitos do Titular dos Dados</h4>
          <p>
            Nos termos da lei, pode a qualquer momento exercer os seus direitos de <strong>Acesso, Retificação e Apagamento («Direito ao Esquecimento»)</strong> através de contacto com a gerência pelo email <code>reservas@quepasa.pt</code>.
          </p>

          <h4 className="font-semibold text-slate-800 text-sm pt-1">4. Não Transmissão a Terceiros</h4>
          <p>
            Os seus dados nunca serão comercializados, cedidos ou partilhados com entidades externas para efeitos publicitários ou de marketing não solicitado.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
          >
            Compreendido e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
