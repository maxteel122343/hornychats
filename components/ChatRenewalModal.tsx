import React from 'react';
import { Clock, AlertTriangle, Zap, CheckCircle2, Wallet, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { AppTheme } from '../types';

interface ChatRenewalModalProps {
  isOpen: boolean;
  isHost?: boolean;
  onClose: () => void;
  onRenew: () => void;
  onOpenWallet: () => void;
  secondsRemaining: number;
  totalWarningSeconds?: number;
  costCredits: number;
  intervalMinutes: number;
  userCredits: number;
  autoDebit: boolean;
  onToggleAutoDebit: (enabled: boolean) => void;
  roomName?: string;
  creatorName?: string;
  theme?: AppTheme;
  isExpired?: boolean;
  isFreeRenewal?: boolean;
}

export const ChatRenewalModal: React.FC<ChatRenewalModalProps> = ({
  isOpen,
  isHost = false,
  onClose,
  onRenew,
  onOpenWallet,
  secondsRemaining,
  totalWarningSeconds = 60,
  costCredits,
  intervalMinutes,
  userCredits,
  autoDebit,
  onToggleAutoDebit,
  roomName = 'Sala Exclusiva',
  creatorName,
  theme = 'dark',
  isExpired = false,
  isFreeRenewal = false
}) => {
  // O modal de renovação NUNCA deve ser exibido para o criador da sala
  if (!isOpen || isHost) return null;

  const isDark = theme === 'dark';
  const effectiveCost = isFreeRenewal ? 0 : costCredits;
  const hasEnoughCredits = isFreeRenewal || userCredits >= effectiveCost;

  const formatSeconds = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const mins = Math.floor(s / 60);
    const remainderSecs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${remainderSecs.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / totalWarningSeconds) * 100));

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-md rounded-[2.5rem] shadow-2xl border overflow-hidden relative flex flex-col animate-in zoom-in-95 duration-200 ${
          isDark ? 'bg-[#0f172a] border-red-500/40 text-white' : 'bg-white border-red-400 text-slate-900'
        }`}
      >
        {/* Top Accent Gradient Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />

        <div className="p-6 sm:p-7 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-500 flex items-center justify-center shrink-0 animate-pulse">
                <Clock size={24} className="text-red-500 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                  {isExpired ? 'TEMPO ESGOTADO' : 'TEMPO ESGOTANDO'}
                </span>
                <h3 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isExpired ? 'Sessão de Chat Pausada' : 'Renovar Tempo de Chat'}
                </h3>
                <p className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {roomName} {creatorName ? `• ${creatorName}` : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-full transition-all active:scale-90 ${
                isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-gray-100 text-slate-500 hover:text-slate-900'
              }`}
              title="Fechar aviso"
            >
              <X size={18} />
            </button>
          </div>

          {/* Red Countdown Display */}
          <div className={`p-4 sm:p-5 rounded-3xl border text-center relative overflow-hidden ${
            isDark 
              ? 'bg-red-950/30 border-red-500/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.15)]' 
              : 'bg-red-50/90 border-red-300 shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]'
          }`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-red-400 block mb-1">
              {isExpired ? 'Sua sessão encerrou' : 'Tempo restante para encerramento'}
            </span>

            {/* Huge Red Digits */}
            <div className="text-4xl sm:text-5xl font-black tracking-tight text-red-500 font-mono drop-shadow-sm flex items-center justify-center gap-2">
              <span className="animate-pulse">{formatSeconds(secondsRemaining)}</span>
            </div>

            {/* Animated Progress Bar */}
            <div className="w-full bg-red-950/40 rounded-full h-2 mt-3 overflow-hidden border border-red-500/30">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-[10px] mt-2 font-medium text-red-400">
              {isExpired 
                ? 'Para voltar a enviar mensagens e continuar na conversa, renove sua sessão agora.'
                : 'Se o cronômetro zerar sem pagamento, a conversa será pausada até a renovação.'}
            </p>
          </div>

          {/* Pricing & Duration Details */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-gray-50 border-gray-200'
          }`}>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Tarifa da Sala
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isFreeRenewal ? 'Gratuito' : `${costCredits} Créditos`}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  / a cada {intervalMinutes} min
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Seu Saldo
              </span>
              <span className={`text-sm font-black mt-0.5 inline-block ${
                isFreeRenewal 
                  ? 'text-emerald-500' 
                  : hasEnoughCredits 
                    ? 'text-emerald-500' 
                    : 'text-red-500'
              }`}>
                {userCredits} Créditos
              </span>
            </div>
          </div>

          {/* Auto-Debit Toggle (Débito Automático) - only if paid */}
          {!isFreeRenewal && (
            <div className={`p-4 rounded-2xl border transition-all ${
              autoDebit 
                ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200') 
                : (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-gray-50 border-gray-200')
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    autoDebit 
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20' 
                      : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-200 text-slate-600')
                  }`}>
                    <Zap size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Débito Automático
                      </span>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                        autoDebit 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-200 text-slate-600')
                      }`}>
                        {autoDebit ? 'ATIVADO' : 'DESLIGADO'}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-0.5 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Renova sozinho a cada ciclo de tempo sem interromper sua conversa.
                    </p>
                  </div>
                </div>

                {/* Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoDebit}
                  onClick={() => onToggleAutoDebit(!autoDebit)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoDebit ? 'bg-emerald-500' : (isDark ? 'bg-slate-700' : 'bg-gray-300')
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      autoDebit ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {hasEnoughCredits ? (
              <button
                type="button"
                onClick={onRenew}
                className="w-full py-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white font-black rounded-2xl uppercase tracking-[0.15em] text-xs shadow-xl hover:opacity-95 transform active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                <span>{isFreeRenewal ? 'Reiniciar Ciclo do Chat (Gratuito)' : `Renovar Chat Agora (-${costCredits} Créditos)`}</span>
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onOpenWallet}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl uppercase tracking-[0.15em] text-xs shadow-xl transform active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  <Wallet size={16} />
                  <span>Recarregar Créditos (Saldo Insuficiente)</span>
                </button>
                <p className="text-[10px] text-center text-red-400 font-semibold">
                  Você precisa de mais {costCredits - userCredits} créditos para continuar.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`w-full py-2.5 text-center text-[11px] font-bold tracking-wider uppercase transition-all ${
                isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isExpired ? 'Continuar como espectador (apenas leitura)' : 'Lembrar depois'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatRenewalModal;
