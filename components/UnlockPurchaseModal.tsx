import React, { useState } from 'react';
import { 
  X, Lock, Unlock, Sparkles, Zap, ShieldCheck, 
  CreditCard, Play, Volume2, Image as ImageIcon, 
  Camera, Phone, MessageSquare, Loader2, CheckCircle2, 
  AlertCircle, ArrowRight, User as UserIcon
} from 'lucide-react';
import { User, MediaCard, CardType, AppTheme } from '../types';

interface UnlockPurchaseModalProps {
  card: MediaCard;
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onConfirmPurchase: (card: MediaCard, useFreeCredits: boolean) => Promise<boolean>;
  onOpenRecharge?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  theme?: AppTheme;
}

export const UnlockPurchaseModal: React.FC<UnlockPurchaseModalProps> = ({
  card,
  user,
  isOpen,
  onClose,
  onConfirmPurchase,
  onOpenRecharge,
  onShowToast,
  theme = 'dark'
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentOption, setPaymentOption] = useState<'regular' | 'free'>('regular');

  if (!isOpen || !card) return null;

  const isDark = theme === 'dark';
  const isGold = theme === 'gold';
  const cost = card.creditCost || 0;
  const regularCredits = user.credits || 0;
  const freeCredits = user.free_credits || 0;

  const hasEnoughRegular = regularCredits >= cost;
  const hasEnoughFree = freeCredits >= cost;
  const canAfford = (paymentOption === 'free' && hasEnoughFree) || (paymentOption === 'regular' && hasEnoughRegular);

  const getMediaIcon = (type: CardType) => {
    switch (type) {
      case CardType.VIDEO: return <Play size={16} className={isDark ? "text-blue-400" : "text-blue-600"} />;
      case CardType.AUDIO: return <Volume2 size={16} className={isDark ? "text-purple-400" : "text-purple-600"} />;
      case CardType.IMAGE: return <ImageIcon size={16} className={isDark ? "text-emerald-400" : "text-emerald-600"} />;
      case CardType.VIDEO_CALL: return <Camera size={16} className={isDark ? "text-pink-400" : "text-pink-600"} />;
      case CardType.AUDIO_CALL: return <Phone size={16} className={isDark ? "text-amber-400" : "text-amber-600"} />;
      case CardType.CHAT: return <MessageSquare size={16} className={isDark ? "text-cyan-400" : "text-cyan-600"} />;
      default: return <Play size={16} className={isDark ? "text-blue-400" : "text-blue-600"} />;
    }
  };

  const handlePurchase = async () => {
    if (!canAfford) {
      if (onShowToast) {
        onShowToast(`Saldo insuficiente! Você precisa de ${cost} créditos.`, 'error');
      }
      return;
    }

    setIsProcessing(true);
    try {
      const success = await onConfirmPurchase(card, paymentOption === 'free');
      if (success) {
        if (onShowToast) {
          onShowToast(`Acesso ao card "${card.title}" adquirido com sucesso!`, 'success');
        }
        onClose();
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
      if (onShowToast) {
        onShowToast(err.message || 'Erro ao processar pagamento.', 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      id="unlock-purchase-modal"
      className="fixed inset-0 z-[800] flex items-center justify-center p-0 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className={`border-0 sm:border rounded-none sm:rounded-[2.5rem] w-full h-full sm:h-auto max-w-lg shadow-2xl relative overflow-hidden flex flex-col sm:max-h-[92vh] animate-in zoom-in-95 duration-200 ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-slate-900'
      }`}>
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

        {/* TOP BAR */}
        <div className={`flex items-center justify-between p-4 sm:p-5 pb-3 border-b shrink-0 ${
          isDark ? 'border-slate-800/80' : 'border-gray-200 bg-gray-50/50'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'
            }`}>
              <Lock size={18} />
            </div>
            <div>
              <h3 className={`text-sm sm:text-base font-black uppercase tracking-tight leading-none ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Adquirir Acesso à Mídia
              </h3>
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1 block ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Desbloqueio de Conteúdo Exclusivo
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl sm:rounded-full transition-all active:scale-95 disabled:opacity-50 shrink-0 ${
              isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-slate-600 hover:text-slate-900'
            }`}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* CARD PREVIEW SUMMARY */}
          <div className={`rounded-2xl p-3.5 flex items-center gap-4 border ${
            isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-gray-50 border-gray-200 shadow-sm'
          }`}>
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-black flex-shrink-0 border border-white/10">
              <img
                src={card.thumbnail || card.mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80'}
                alt={card.title}
                className="w-full h-full object-cover filter blur-[2px] brightness-75 scale-105"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="p-2 rounded-full bg-amber-500 text-slate-950 shadow-lg">
                  <Lock size={16} />
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`p-1 rounded-md border ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
                }`}>
                  {getMediaIcon(card.type)}
                </span>
                <span className={`text-[9px] font-black uppercase tracking-wider ${
                  isDark ? 'text-indigo-400' : 'text-indigo-600'
                }`}>
                  {card.category || card.type}
                </span>
                {card.duration > 0 && (
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    • {Math.floor(card.duration / 60)}:{(card.duration % 60).toString().padStart(2, '0')} min
                  </span>
                )}
              </div>

              <h4 className={`text-sm sm:text-base font-black uppercase tracking-tight truncate leading-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {card.title}
              </h4>

              {/* Creator Chip */}
              <div className="flex items-center gap-1.5 mt-2">
                {card.creatorPhoto ? (
                  <img
                    src={card.creatorPhoto}
                    alt={card.creatorName || 'Criador'}
                    className="w-4 h-4 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[8px] font-black">
                    {(card.creatorName || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className={`text-[10px] font-bold truncate ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Por {card.creatorName || 'Criador do Card'}
                </span>
              </div>
            </div>
          </div>

          {/* PRICE & BREAKDOWN */}
          <div className={`border rounded-2xl p-4 sm:p-5 ${
            isDark 
              ? 'bg-gradient-to-br from-indigo-950/40 via-slate-900 to-purple-950/40 border-indigo-500/30' 
              : 'bg-indigo-50/70 border-indigo-200 shadow-sm'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${
              isDark ? 'border-indigo-500/20' : 'border-indigo-100'
            }`}>
              <span className={`text-xs font-black uppercase tracking-wider ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Valor para Desbloquear
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`text-2xl font-black tracking-tight ${
                  isDark ? 'text-amber-400' : 'text-amber-600'
                }`}>
                  {cost}
                </span>
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'text-amber-300' : 'text-amber-700'
                }`}>
                  Créditos
                </span>
              </div>
            </div>

            {/* BALANCE COMPARISON */}
            <div className="pt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium flex items-center gap-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <CreditCard size={14} className={isDark ? "text-indigo-400" : "text-indigo-600"} /> Seu saldo atual:
                </span>
                <span className={`font-black ${hasEnoughRegular ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-rose-400' : 'text-rose-600')}`}>
                  {regularCredits} CR
                </span>
              </div>

              {freeCredits > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-medium flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <Sparkles size={14} className={isDark ? "text-amber-400" : "text-amber-600"} /> Seus créditos grátis:
                  </span>
                  <span className={`font-black ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                    {freeCredits} CR
                  </span>
                </div>
              )}

              <div className={`flex items-center justify-between text-xs pt-2 border-t ${
                isDark ? 'border-white/5' : 'border-indigo-100'
              }`}>
                <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Saldo restante após compra:</span>
                <span className={`font-black ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  {paymentOption === 'free'
                    ? `${Math.max(0, freeCredits - cost)} CR grátis`
                    : `${Math.max(0, regularCredits - cost)} CR`}
                </span>
              </div>
            </div>
          </div>

          {/* PAYMENT OPTION SELECTOR IF HAS FREE CREDITS */}
          {hasEnoughFree && (
            <div className="space-y-2">
              <label className={`text-[10px] font-black uppercase tracking-widest block px-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Forma de Pagamento
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentOption('regular')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paymentOption === 'regular'
                      ? (isDark ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md' : 'bg-indigo-50 border-indigo-500 text-slate-900 shadow-sm')
                      : (isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800' : 'bg-gray-50 border-gray-200 text-slate-600 hover:bg-gray-100')
                  }`}
                >
                  <p className="text-xs font-black uppercase">Saldo Normal</p>
                  <p className={`text-[10px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{regularCredits} CR disponíveis</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentOption('free')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paymentOption === 'free'
                      ? (isDark ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md' : 'bg-amber-50 border-amber-400 text-amber-900 shadow-sm')
                      : (isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800' : 'bg-gray-50 border-gray-200 text-slate-600 hover:bg-gray-100')
                  }`}
                >
                  <p className="text-xs font-black uppercase flex items-center gap-1">
                    <Sparkles size={12} /> Créditos Grátis
                  </p>
                  <p className={`text-[10px] font-medium mt-0.5 ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}>{freeCredits} CR disponíveis</p>
                </button>
              </div>
            </div>
          )}

          {/* INSUFFICIENT BALANCE WARNING & RECHARGE PROMPT */}
          {!canAfford && (
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50 border-rose-200'
            }`}>
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className={isDark ? "text-rose-400 flex-shrink-0 mt-0.5" : "text-rose-600 flex-shrink-0 mt-0.5"} />
                <div>
                  <h5 className={`text-xs font-black uppercase tracking-tight ${
                    isDark ? 'text-rose-300' : 'text-rose-700'
                  }`}>
                    Saldo Insuficiente
                  </h5>
                  <p className={`text-[11px] mt-0.5 leading-relaxed font-medium ${
                    isDark ? 'text-rose-200/80' : 'text-rose-600'
                  }`}>
                    Você possui <b>{regularCredits} CR</b>. Faltam <b>{cost - regularCredits} CR</b> para adquirir acesso completo a esta mídia.
                  </p>
                </div>
              </div>

              {onOpenRecharge && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRecharge();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
                >
                  <Zap size={16} />
                  <span>Recarregar Créditos via PIX</span>
                </button>
              )}
            </div>
          )}

          {/* SECURITY BADGE */}
          <div className={`flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}>
            <ShieldCheck size={14} className={isDark ? "text-emerald-400" : "text-emerald-600"} />
            <span>Acesso vitalício à mídia liberado imediatamente após confirmação</span>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className={`p-5 pt-3 border-t flex items-center gap-3 ${
          isDark ? 'border-slate-800/80 bg-slate-950/60' : 'border-gray-200 bg-gray-50'
        }`}>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className={`flex-1 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 border ${
              isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/5' : 'bg-white hover:bg-gray-100 text-slate-700 border-gray-200'
            }`}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handlePurchase}
            disabled={!canAfford || isProcessing}
            className={`flex-[2] py-3.5 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              canAfford
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                : (isDark ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-gray-200 text-slate-400 border border-gray-300')
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <Unlock size={16} />
                <span>Confirmar & Pagar ({cost} CR)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
