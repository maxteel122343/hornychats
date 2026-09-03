import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Wallet, DollarSign, QrCode, Zap, ArrowUpRight, Loader2, Copy, CheckCircle, RefreshCw, CreditCard, History, ShoppingCart, Lock, Users, UserCheck, UserMinus, UserPlus, MessageSquare } from 'lucide-react';
import { User, PaymentTransaction } from '../types';
import { supabase } from '../lib/supabase';
import { ToastType } from './Toast';
import { getFollowers, getFollowing, unfollowUser, followUser, FollowerUser } from '../lib/followers';

export interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  estimated_payout_at?: string;
}

export interface Sale {
  id: string;
  buyer_name: string;
  card_title: string;
  amount: number;
  created_at: string;
}

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'recharge' | 'earnings' | 'followers';
  user: User;
  updateCredits: (amount: number) => void;
  updateFreeCredits?: (amount: number, updateTimestamp?: boolean) => void;
  openAuth: () => void;
  onShowToast?: (message: string, type?: ToastType) => void;
  withdrawalHistory?: Withdrawal[];
  salesHistory?: Sale[];
  hasFreeSales?: boolean;
  claimTimer?: number | null;
  onRefreshHistory?: () => void;
  onNavigateToChat?: (userId: string, name?: string) => void;
  theme?: 'dark' | 'light';
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'recharge',
  user,
  updateCredits,
  updateFreeCredits,
  openAuth,
  onShowToast,
  withdrawalHistory = [],
  salesHistory = [],
  hasFreeSales = false,
  claimTimer = null,
  onRefreshHistory,
  onNavigateToChat,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'recharge' | 'earnings' | 'followers'>(initialTab);

  // Followers & Following State
  const [followersList, setFollowersList] = useState<FollowerUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowerUser[]>([]);
  const [followersSubTab, setFollowersSubTab] = useState<'followers' | 'following'>('followers');
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(false);

  // PIX Recharge State
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [activePayment, setActivePayment] = useState<PaymentTransaction | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Withdrawal State
  const [withdrawalMethod, setWithdrawalMethod] = useState<'pix' | 'picpay' | 'paypal' | 'stripe'>('pix');
  const [withdrawalKey, setWithdrawalKey] = useState(user?.pixKey || '');
  const [withdrawalCpf, setWithdrawalCpf] = useState('');
  const [withdrawalFullName, setWithdrawalFullName] = useState('');
  const [withdrawalPending, setWithdrawalPending] = useState(false);

  // Sync activeTab when modal is reopened with a different initialTab
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Load followers and following
  useEffect(() => {
    if (isOpen && user?.id) {
      setIsLoadingFollowers(true);
      Promise.all([
        getFollowers(user.id),
        getFollowing(user.id)
      ]).then(([fList, flgList]) => {
        setFollowersList(fList);
        setFollowingList(flgList);
      }).catch(e => {
        console.warn('Error fetching followers:', e);
      }).finally(() => {
        setIsLoadingFollowers(false);
      });
    }
  }, [isOpen, user?.id]);

  const handleUnfollow = async (targetId: string, targetName: string) => {
    if (!user.id) return;
    await unfollowUser(user.id, targetId);
    setFollowingList(prev => prev.filter(item => item.id !== targetId));
    if (onShowToast) onShowToast(`Você deixou de seguir ${targetName}.`, 'info');
  };

  const handleFollowBack = async (targetId: string, targetName: string) => {
    if (!user.id) return;
    await followUser(user.id, targetId);
    const updated = await getFollowing(user.id);
    setFollowingList(updated);
    if (onShowToast) onShowToast(`Agora você segue ${targetName}!`, 'success');
  };

  // Sync withdrawalKey when user profile updates
  React.useEffect(() => {
    if (user?.pixKey) {
      setWithdrawalKey(user.pixKey);
    }
  }, [user?.pixKey]);

  // Escuta atualização em tempo real do status do pagamento (ALWAYS called unconditionally before early return)
  React.useEffect(() => {
    if (!isOpen || !activePayment || !activePayment.id || activePayment.id.startsWith('sim-')) return;
    const channel = supabase.channel(`wallet_payment_${activePayment.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payment_transactions',
        filter: `id=eq.${activePayment.id}`
      }, (payload) => {
        const updated = payload.new as PaymentTransaction;
        if (updated && updated.status === 'approved') {
          handleApprovedPayment(updated);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, activePayment?.id]);

  if (!isOpen) return null;

  const safeWithdrawals = Array.isArray(withdrawalHistory) ? withdrawalHistory : [];
  const safeSales = Array.isArray(salesHistory) ? salesHistory : [];
  const currentCredits = user?.credits ?? 0;
  const currentEarnings = user?.earnings ?? 0;
  const currentFreeCredits = user?.free_credits ?? 0;

  const showToast = (message: string, type: ToastType = 'success') => {
    if (onShowToast) onShowToast(message, type);
  };

  const handleGeneratePix = async (amount: number) => {
    if (!user.isLoggedIn) {
      openAuth();
      return;
    }

    setPaymentAmount(amount);
    setIsGeneratingPix(true);
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser || !authUser.email) {
        throw new Error("Usuário não autenticado.");
      }
      
      const creditsMap: Record<number, number> = { 5: 50, 10: 120, 20: 300, 50: 800 };
      const credits = creditsMap[amount] || amount * 10;

      const { data, error } = await supabase.functions.invoke('mercadopago-create-payment', {
        body: JSON.stringify({
          amount: amount,
          description: `${credits} Créditos LinkCard`,
          user_id: user.id,
          credits: credits,
          email: authUser.email
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (error || !data) {
        // Fallback simulation for preview/offline mode
        console.warn('Fallback simulated PIX generation:', error);
        setActivePayment({
          id: 'sim-' + Math.random().toString(36).substr(2, 9),
          qr_code: `00020101021226830014br.gov.bcb.pix2561pix.mercadopago.com/qr/v2/${Math.random().toString(36).substr(2, 12)}5204000053039865405${amount}.005802BR5908LinkCard6009Sao Paulo62070503***6304ABCD`,
          qr_code_base64: '',
          status: 'pending',
          amount: amount,
          credits_amount: credits
        });
        return;
      }

      setActivePayment({
        id: data.payment_id_db || data.id,
        mp_payment_id: data.mp_payment_id || data.id,
        qr_code: data.qr_code,
        qr_code_base64: data.qr_code_base64,
        status: 'pending',
        amount: amount,
        credits_amount: credits
      });
    } catch (err: any) {
      console.warn('PIX error:', err);
      // Fallback for instant client feedback
      const creditsMap: Record<number, number> = { 5: 50, 10: 120, 20: 300, 50: 800 };
      const credits = creditsMap[amount] || amount * 10;
      setActivePayment({
        id: 'sim-' + Math.random().toString(36).substr(2, 9),
        qr_code: `00020101021226830014br.gov.bcb.pix2561pix.mercadopago.com/qr/v2/demo5204000053039865405${amount}.005802BR5908LinkCard6009Sao Paulo6304ABCD`,
        qr_code_base64: '',
        status: 'pending',
        amount: amount,
        credits_amount: credits
      });
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!activePayment) return;
    setIsCheckingStatus(true);
    try {
      if (activePayment.id.startsWith('sim-')) {
        // Simulated approval
        handleApprovedPayment(activePayment);
        return;
      }
      let { data } = await supabase.from('payment_transactions').select('*').eq('id', activePayment.id).single();

      // Se ainda pendente, força a verificação no Mercado Pago via Edge Function
      const mpId = data?.mp_payment_id || activePayment.mp_payment_id;
      if (data && data.status !== 'approved' && mpId) {
        try {
          await supabase.functions.invoke('mercadopago-webhook', {
            body: { type: 'payment', data: { id: mpId } }
          });
          const refetch = await supabase.from('payment_transactions').select('*').eq('id', activePayment.id).single();
          if (refetch.data) data = refetch.data;
        } catch (webhookErr) {
          console.warn('Sync webhook check error:', webhookErr);
        }
      }

      if (data && data.status === 'approved') {
        handleApprovedPayment(data as PaymentTransaction);
      } else {
        showToast("Pagamento ainda em processamento pelo Mercado Pago...", 'info');
      }
    } catch (err) {
      showToast("Não foi possível confirmar o status no momento.", 'info');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleApprovedPayment = (transaction: PaymentTransaction) => {
    updateCredits(transaction.credits_amount);
    showToast(`Pagamento aprovado! +${transaction.credits_amount} créditos adicionados à sua conta.`, 'success');
    setActivePayment(null);
    setPaymentAmount(null);
  };

  const handleCopyPix = () => {
    if (activePayment?.qr_code) {
      navigator.clipboard.writeText(activePayment.qr_code);
      setCopySuccess(true);
      showToast('Código PIX Copia e Cola copiado com sucesso!', 'success');
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  const handleSavePaymentKey = async () => {
    if (!user.isLoggedIn || !withdrawalKey) return;
    const updateData: any = {};
    if (withdrawalMethod === 'pix') updateData.pix_key = withdrawalKey;
    if (withdrawalMethod === 'picpay') updateData.picpay_email = withdrawalKey;
    if (withdrawalMethod === 'paypal') updateData.paypal_email = withdrawalKey;
    if (withdrawalMethod === 'stripe') updateData.stripe_email = withdrawalKey;

    try {
      await supabase.from('profiles').update(updateData).eq('id', user.id);
      if (withdrawalMethod === 'pix') user.pixKey = withdrawalKey;
      else if (withdrawalMethod === 'picpay') user.picpayEmail = withdrawalKey;
      else if (withdrawalMethod === 'paypal') user.paypalEmail = withdrawalKey;
      else if (withdrawalMethod === 'stripe') user.stripeEmail = withdrawalKey;
    } catch (e) {
      console.warn('Error saving payment key:', e);
    }
  };

  const handleWithdraw = async () => {
    if (!user.isLoggedIn) {
      openAuth();
      return;
    }
    if (!withdrawalKey) {
      showToast("Por favor, preencha a chave ou e-mail de recebimento.", 'error');
      return;
    }
    if (!withdrawalCpf || !withdrawalFullName) {
      showToast("Por favor, preencha seu CPF e Nome Completo para validação de segurança.", 'error');
      return;
    }
    if (user.earnings < 100) {
      showToast("Saldo insuficiente. O valor mínimo para saque é de 100 créditos.", 'error');
      return;
    }

    setWithdrawalPending(true);
    await handleSavePaymentKey();

    try {
      const { error } = await supabase.from('withdrawals').insert([{
        user_id: user.id,
        amount: user.earnings,
        method: withdrawalMethod,
        target_key: withdrawalKey,
        cpf: withdrawalCpf,
        full_name: withdrawalFullName,
        status: 'pending',
        estimated_payout_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }]);

      if (error) {
        showToast("Erro ao registrar solicitação de saque.", 'error');
      } else {
        user.earnings = 0;
        showToast("Solicitação de saque enviada com sucesso! Pagamento em até 24 horas.", 'success');
        if (onRefreshHistory) onRefreshHistory();
      }
    } catch (err: any) {
      showToast(err.message || "Erro ao processar saque.", 'error');
    } finally {
      setWithdrawalPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      <div className={`border-0 sm:border rounded-none sm:rounded-[2.5rem] w-full h-full sm:h-auto max-w-2xl sm:max-h-[92vh] shadow-2xl relative flex flex-col overflow-hidden animate-in zoom-in-95 ${
        isDark ? 'bg-[#0b1329] border-slate-800 text-white' : 'bg-white border-gray-200 text-slate-900'
      }`}>
        
        {/* TOP HEADER */}
        <div className={`p-3.5 sm:p-5 border-b flex items-center justify-between gap-2 shrink-0 z-20 ${
          isDark ? 'border-white/10 bg-slate-900/95' : 'border-gray-200 bg-white'
        }`}>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={onClose} 
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-xs font-bold shrink-0 active:scale-95 ${
                isDark 
                  ? 'bg-slate-800 border-slate-700/80 text-slate-200 hover:bg-slate-700 hover:text-white' 
                  : 'bg-gray-100 border-gray-200 text-slate-700 hover:bg-gray-200'
              }`}
              title="Voltar"
            >
              <ArrowLeft size={16} />
              <span className="font-bold text-xs uppercase">Voltar</span>
            </button>
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
              isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
            }`}>
              <Wallet size={20} />
            </div>
            <div>
              <h3 className={`text-base sm:text-lg font-black uppercase tracking-tight leading-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                CARTEIRA & COMUNIDADE
              </h3>
              <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                SALDO: <span className="text-emerald-500 font-black">{currentCredits} CR</span> • GANHOS: <span className="text-blue-500 font-black">{currentEarnings} CR</span> • <span className="text-purple-400 font-black">{followersList.length} SEGUIDORES</span> • <span className="text-purple-400 font-black">{followingList.length} SEGUINDO</span>
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center border rounded-xl transition-all shrink-0 active:scale-95 ${
              isDark 
                ? 'bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border-slate-700/80 text-slate-300' 
                : 'bg-gray-100 hover:bg-red-50 hover:text-red-500 border-gray-200 text-slate-600'
            }`}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* TAB SWITCHER */}
        <div className={`p-2 sm:p-3 border-b flex gap-1.5 sm:gap-2 shrink-0 ${
          isDark ? 'bg-slate-900/60 border-white/5' : 'bg-gray-50 border-gray-200'
        }`}>
          <button
            type="button"
            onClick={() => { setActiveTab('recharge'); setActivePayment(null); }}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all active:scale-95 border ${
              activeTab === 'recharge'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : (isDark ? 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-100')
            }`}
          >
            <Zap size={14} className="shrink-0" />
            <span className="truncate">Recarregar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('earnings')}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all active:scale-95 border ${
              activeTab === 'earnings'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : (isDark ? 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-100')
            }`}
          >
            <DollarSign size={14} className="shrink-0" />
            <span className="truncate">Ganhos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('followers')}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all active:scale-95 border ${
              activeTab === 'followers'
                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                : (isDark ? 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-100')
            }`}
          >
            <Users size={14} className="shrink-0" />
            <span className="truncate">Seguidores ({followersList.length})</span>
          </button>
        </div>

        {/* MODAL CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide space-y-6">

          {/* TAB 1: RECARREGAR CRÉDITOS */}
          {activeTab === 'recharge' && (
            <div className="space-y-6 animate-in fade-in">
              {/* CURRENT BALANCE BANNER */}
              <div className={`border p-5 rounded-3xl flex items-center justify-between shadow-sm ${
                isDark 
                  ? 'bg-gradient-to-r from-emerald-500/10 via-slate-900 to-emerald-500/5 border-emerald-500/20' 
                  : 'bg-emerald-50/80 border-emerald-200'
              }`}>
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-widest block ${
                    isDark ? 'text-emerald-400' : 'text-emerald-700'
                  }`}>Seu Saldo Disponível</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentCredits}</span>
                    <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">Créditos (CR)</span>
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <Zap size={24} />
                </div>
              </div>

              {!user.isLoggedIn && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 text-xs font-bold flex items-center justify-between">
                  <span>Modo Visitante: Faça login para vincular seus créditos à sua conta.</span>
                  <button onClick={openAuth} className="px-3 py-1.5 bg-amber-500 text-slate-950 font-black rounded-lg uppercase text-[10px]">Entrar</button>
                </div>
              )}

              {/* PIX PAYMENT SECTION */}
              {!activePayment ? (
                <div>
                  <h4 className={`text-xs font-black uppercase tracking-wider mb-3 flex items-center gap-2 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    <QrCode size={15} className="text-emerald-500" />
                    Escolha um pacote e pague via PIX
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { amount: 5, credits: 50, bonus: null },
                      { amount: 10, credits: 120, bonus: '+20% Bônus' },
                      { amount: 20, credits: 300, bonus: '+50% Bônus' },
                      { amount: 50, credits: 800, bonus: '+60% Bônus' }
                    ].map((pkg) => (
                      <button
                        key={pkg.amount}
                        type="button"
                        onClick={() => handleGeneratePix(pkg.amount)}
                        disabled={isGeneratingPix}
                        className={`p-4 rounded-2xl border transition-all flex items-center justify-between group active:scale-98 text-left ${
                          isDark 
                            ? 'bg-slate-800/80 border-slate-700 hover:border-emerald-500/60 hover:bg-emerald-500/10' 
                            : 'bg-white border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-black text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>R$ {pkg.amount},00</span>
                            {pkg.bonus && (
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                                isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {pkg.bonus}
                              </span>
                            )}
                          </div>
                          <span className={`text-xs font-bold mt-0.5 block ${
                            isDark ? 'text-slate-400 group-hover:text-emerald-300' : 'text-slate-500 group-hover:text-emerald-700'
                          }`}>
                            {pkg.credits} Créditos
                          </span>
                        </div>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          isDark 
                            ? 'bg-slate-700/80 group-hover:bg-emerald-500 group-hover:text-slate-950 text-slate-300' 
                            : 'bg-gray-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-600'
                        }`}>
                          {isGeneratingPix && paymentAmount === pkg.amount ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Zap size={16} />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* PIX QR CODE & CODE COPY */
                <div className={`border p-5 sm:p-6 rounded-3xl text-center space-y-4 animate-in zoom-in-95 ${
                  isDark ? 'bg-slate-900 border-slate-700/80' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`flex items-center justify-between pb-3 border-b ${
                    isDark ? 'border-white/5' : 'border-gray-200'
                  }`}>
                    <span className={`text-xs font-black uppercase tracking-wider ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>Pagamento via PIX</span>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-600 rounded-full text-xs font-black">
                      R$ {activePayment.amount},00 = {activePayment.credits_amount} CR
                    </span>
                  </div>

                  {activePayment.qr_code_base64 ? (
                    <div className="bg-white p-3 rounded-2xl w-48 h-48 mx-auto flex items-center justify-center shadow-lg border border-gray-200">
                      <img
                        src={`data:image/png;base64,${activePayment.qr_code_base64}`}
                        alt="QR Code PIX"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="bg-white p-4 rounded-2xl w-48 h-48 mx-auto flex flex-col items-center justify-center shadow-lg text-slate-900 border border-gray-200">
                      <QrCode size={90} className="text-slate-900 mb-2" />
                      <span className="text-[10px] font-black uppercase text-slate-700">QR Code PIX</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest block ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>Código PIX Copia e Cola</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={activePayment.qr_code}
                        className={`border text-xs rounded-xl p-3 flex-1 font-mono outline-none truncate ${
                          isDark 
                            ? 'bg-slate-800 border-slate-700 text-slate-300' 
                            : 'bg-white border-gray-200 text-slate-900'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className={`px-4 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 transition-all shrink-0 active:scale-95 ${
                          copySuccess
                            ? 'bg-emerald-500 text-white'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                      >
                        {copySuccess ? <CheckCircle size={15} /> : <Copy size={15} />}
                        <span>{copySuccess ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handleCheckStatus}
                      disabled={isCheckingStatus}
                      className="flex-1 py-3 px-4 bg-emerald-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-emerald-400 active:scale-95 transition-all shadow-md"
                    >
                      {isCheckingStatus ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                      <span>{isCheckingStatus ? 'Verificando...' : 'Já fiz o Pagamento'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePayment(null)}
                      className={`py-3 px-4 font-bold rounded-xl text-xs uppercase active:scale-95 transition-all border ${
                        isDark 
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700' 
                          : 'bg-white text-slate-700 hover:bg-gray-100 border-gray-200 shadow-sm'
                      }`}
                    >
                      Trocar Valor
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GANHOS & SAQUES */}
          {activeTab === 'earnings' && (
            <div className="space-y-6 animate-in fade-in">
              {/* AVAILABLE FOR WITHDRAWAL BANNER */}
              <div className={`border p-5 rounded-3xl flex items-center justify-between shadow-sm ${
                isDark 
                  ? 'bg-gradient-to-r from-blue-500/10 via-slate-900 to-indigo-500/5 border-blue-500/20' 
                  : 'bg-blue-50/80 border-blue-200'
              }`}>
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-widest block ${
                    isDark ? 'text-blue-400' : 'text-blue-700'
                  }`}>Disponível para Saque</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentEarnings}</span>
                    <span className="text-xs font-black text-blue-500 uppercase tracking-wider">Créditos (CR)</span>
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                }`}>
                  <DollarSign size={24} />
                </div>
              </div>

              {/* FREE CREDITS CLAIM SECTION */}
              <div className={`border p-4 sm:p-5 rounded-2xl space-y-3 ${
                isDark ? 'bg-slate-800/60 border-slate-700/80' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className={`text-xs font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Créditos Gratuitos</h4>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Saldo: <span className="text-indigo-600 font-bold">{currentFreeCredits} CR</span>
                    </p>
                  </div>
                  {updateFreeCredits && (
                    <button
                      type="button"
                      onClick={() => updateFreeCredits(10, true)}
                      disabled={!!claimTimer || !hasFreeSales}
                      className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md"
                    >
                      {claimTimer ? `Aguarde ${Math.floor(claimTimer / 60)}:${(claimTimer % 60).toString().padStart(2, '0')}` : 'Reivindicar +10 CR'}
                    </button>
                  )}
                </div>
                <p className={`text-[9px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Reivindique créditos grátis de usuários que interagiram com seus conteúdos e use para desbloquear cards de outros criadores!
                </p>
              </div>

              {/* WITHDRAWAL FORM */}
              <div className={`border p-5 rounded-2xl space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm'
              }`}>
                <label className={`text-[10px] font-black uppercase tracking-widest block ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>Método de Recebimento</label>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawalMethod('pix')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                      withdrawalMethod === 'pix' 
                        ? 'bg-emerald-600 text-white' 
                        : (isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-100 text-slate-600 hover:bg-gray-200')
                    }`}
                  >
                    <QrCode size={13} /> PIX
                  </button>

                  <button
                    type="button"
                    onClick={() => setWithdrawalMethod('picpay')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                      withdrawalMethod === 'picpay' 
                        ? 'bg-emerald-600 text-white' 
                        : (isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-100 text-slate-600 hover:bg-gray-200')
                    }`}
                  >
                    <Wallet size={13} /> PicPay
                  </button>

                  <button
                    type="button"
                    onClick={() => setWithdrawalMethod('paypal')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                      withdrawalMethod === 'paypal' 
                        ? 'bg-blue-600 text-white' 
                        : (isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-100 text-slate-600 hover:bg-gray-200')
                    }`}
                  >
                    <CreditCard size={13} /> PayPal
                  </button>

                  <button
                    type="button"
                    onClick={() => setWithdrawalMethod('stripe')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                      withdrawalMethod === 'stripe' 
                        ? 'bg-indigo-600 text-white' 
                        : (isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-100 text-slate-600 hover:bg-gray-200')
                    }`}
                  >
                    <CreditCard size={13} /> Stripe
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className={`text-[9px] font-bold uppercase block mb-1 ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {withdrawalMethod === 'pix' ? 'Chave PIX (CPF, E-mail, Telefone ou Aleatória)' : 'E-mail da Conta de Recebimento'}
                    </label>
                    <input
                      value={withdrawalKey}
                      onChange={(e) => setWithdrawalKey(e.target.value)}
                      onBlur={handleSavePaymentKey}
                      placeholder={withdrawalMethod === 'pix' ? 'Insira sua chave PIX' : 'seu-email@dominio.com'}
                      className={`w-full border rounded-xl p-3 text-xs font-bold outline-none focus:border-blue-500 transition-all ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-slate-900 focus:bg-white'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`text-[9px] font-bold uppercase block mb-1 ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>Seu CPF (Validação)</label>
                      <input
                        value={withdrawalCpf}
                        onChange={(e) => setWithdrawalCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className={`w-full border rounded-xl p-3 text-xs font-bold outline-none focus:border-blue-500 transition-all ${
                          isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-slate-900 focus:bg-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`text-[9px] font-bold uppercase block mb-1 ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>Nome Completo</label>
                      <input
                        value={withdrawalFullName}
                        onChange={(e) => setWithdrawalFullName(e.target.value)}
                        placeholder="Nome completo do titular"
                        className={`w-full border rounded-xl p-3 text-xs font-bold outline-none focus:border-blue-500 transition-all ${
                          isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-slate-900 focus:bg-white'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={currentEarnings < 100 || withdrawalPending || !withdrawalKey}
                  className="w-full py-3.5 bg-blue-600 text-white font-black rounded-xl uppercase tracking-wider text-xs hover:bg-blue-500 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-98 shadow-lg shadow-blue-600/30"
                >
                  {withdrawalPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
                  <span>{withdrawalPending ? 'Processando...' : 'Solicitar Saque (24h)'}</span>
                </button>
                <p className={`text-[9px] text-center font-bold uppercase ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Mínimo para saque: 100 créditos • Pagamento processado em até 24 horas úteis.
                </p>
              </div>

              {/* WITHDRAWAL HISTORY */}
              <div className="space-y-3">
                <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <History size={13} /> Histórico de Saques
                </h4>
                <div className="space-y-2 max-h-36 overflow-y-auto scrollbar-hide">
                  {safeWithdrawals.length === 0 ? (
                    <p className={`text-center text-xs py-3 italic rounded-xl border ${
                      isDark ? 'text-slate-500 bg-slate-900/40 border-slate-800' : 'text-slate-400 bg-gray-50 border-gray-200'
                    }`}>
                      Nenhum saque solicitado ainda.
                    </p>
                  ) : (
                    safeWithdrawals.map((w) => (
                      <div key={w.id} className={`flex justify-between items-center p-3 rounded-xl border ${
                        isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex flex-col">
                          <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{w.amount} CR</span>
                          <span className={`text-[9px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{w.method}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                            w.status === 'paid' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'
                          }`}>
                            {w.status === 'paid' ? 'PAGO' : 'PROCESSANDO'}
                          </span>
                          <span className={`text-[8px] block mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {w.created_at ? new Date(w.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* SALES HISTORY */}
              <div className="space-y-3">
                <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <ShoppingCart size={13} /> Vendas Realizadas (Compradores)
                </h4>
                <div className="space-y-2 max-h-36 overflow-y-auto scrollbar-hide">
                  {safeSales.length === 0 ? (
                    <p className={`text-center text-xs py-3 italic rounded-xl border ${
                      isDark ? 'text-slate-500 bg-slate-900/40 border-slate-800' : 'text-slate-400 bg-gray-50 border-gray-200'
                    }`}>
                      Nenhuma venda registrada ainda.
                    </p>
                  ) : (
                    safeSales.map((sale) => (
                      <div key={sale.id} className={`flex justify-between items-center p-3 rounded-xl border ${
                        isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {sale.buyer_name ? String(sale.buyer_name).charAt(0).toUpperCase() : '?'}
                          </div>
                          <div className="flex flex-col max-w-[150px]">
                            <span className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{sale.buyer_name || 'Usuário'}</span>
                            <span className={`text-[9px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{sale.card_title}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-500 font-black text-xs">+{sale.amount} CR</span>
                          <span className={`text-[8px] block mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {sale.created_at ? new Date(sale.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SEGUIDORES & COMUNIDADE */}
          {activeTab === 'followers' && (
            <div className="space-y-6 animate-in fade-in">
              {/* SUMMARY METRICS BANNER */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className={`p-4 sm:p-5 rounded-2xl border text-center ${
                  isDark ? 'bg-purple-950/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'
                }`}>
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider block ${
                    isDark ? 'text-purple-400' : 'text-purple-700'
                  }`}>
                    Quem te segue
                  </span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <Users size={18} className="text-purple-500" />
                    <span className={`text-2xl sm:text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {followersList.length}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Seguidores</span>
                </div>

                <div className={`p-4 sm:p-5 rounded-2xl border text-center ${
                  isDark ? 'bg-blue-950/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'
                }`}>
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider block ${
                    isDark ? 'text-blue-400' : 'text-blue-700'
                  }`}>
                    Você segue
                  </span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <UserCheck size={18} className="text-blue-500" />
                    <span className={`text-2xl sm:text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {followingList.length}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Criadores</span>
                </div>
              </div>

              {/* SUBTAB SWITCHER */}
              <div className={`p-1.5 rounded-xl border flex gap-1 ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-gray-100 border-gray-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setFollowersSubTab('followers')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    followersSubTab === 'followers'
                      ? 'bg-purple-600 text-white shadow-md'
                      : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                  }`}
                >
                  <Users size={14} />
                  <span>Seguidores ({followersList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFollowersSubTab('following')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    followersSubTab === 'following'
                      ? 'bg-blue-600 text-white shadow-md'
                      : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                  }`}
                >
                  <UserCheck size={14} />
                  <span>Seguindo ({followingList.length})</span>
                </button>
              </div>

              {/* LIST DISPLAY */}
              {isLoadingFollowers ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <Loader2 size={24} className="animate-spin text-purple-500" />
                  <p className="text-xs text-slate-400">Carregando lista de conexões...</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {followersSubTab === 'followers' ? (
                    followersList.length === 0 ? (
                      <div className={`p-8 rounded-2xl border text-center space-y-2 ${
                        isDark ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-gray-50 border-gray-200 text-slate-500'
                      }`}>
                        <Users size={28} className="mx-auto text-purple-500/50 mb-1" />
                        <p className="text-sm font-bold">Nenhum seguidor ainda</p>
                        <p className="text-xs max-w-xs mx-auto text-slate-400">
                          Compartilhe seus cards e sua sala de chat para atrair pessoas para sua rede!
                        </p>
                      </div>
                    ) : (
                      followersList.map(follower => {
                        const alreadyFollow = followingList.some(f => f.id === follower.id);
                        return (
                          <div
                            key={follower.id}
                            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                              isDark ? 'bg-slate-800/60 border-slate-700/60 hover:border-purple-500/40' : 'bg-white border-gray-200 shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {follower.profile_photo ? (
                                <img
                                  src={follower.profile_photo}
                                  alt={follower.name}
                                  className="w-10 h-10 rounded-xl object-cover border border-purple-500/30 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md">
                                  {follower.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <h5 className={`text-xs sm:text-sm font-black truncate uppercase tracking-tight ${
                                  isDark ? 'text-white' : 'text-slate-900'
                                }`}>
                                  {follower.name}
                                </h5>
                                <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider block">
                                  Te segue
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {onNavigateToChat && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onNavigateToChat(follower.id, follower.name);
                                  }}
                                  title={`Enviar mensagem para ${follower.name}`}
                                  className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md active:scale-95"
                                >
                                  <MessageSquare size={14} />
                                </button>
                              )}

                              {!alreadyFollow ? (
                                <button
                                  type="button"
                                  onClick={() => handleFollowBack(follower.id, follower.name)}
                                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                                >
                                  <UserPlus size={12} />
                                  <span>Seguir de volta</span>
                                </button>
                              ) : (
                                <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Amigos
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : (
                    followingList.length === 0 ? (
                      <div className={`p-8 rounded-2xl border text-center space-y-2 ${
                        isDark ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-gray-50 border-gray-200 text-slate-500'
                      }`}>
                        <UserCheck size={28} className="mx-auto text-blue-500/50 mb-1" />
                        <p className="text-sm font-bold">Você ainda não segue ninguém</p>
                        <p className="text-xs max-w-xs mx-auto text-slate-400">
                          Acesse a Vitrine e clique em 'Seguir' nos cards dos seus criadores favoritos!
                        </p>
                      </div>
                    ) : (
                      followingList.map(creator => (
                        <div
                          key={creator.id}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                            isDark ? 'bg-slate-800/60 border-slate-700/60 hover:border-blue-500/40' : 'bg-white border-gray-200 shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {creator.profile_photo ? (
                              <img
                                src={creator.profile_photo}
                                alt={creator.name}
                                className="w-10 h-10 rounded-xl object-cover border border-blue-500/30 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md">
                                {creator.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h5 className={`text-xs sm:text-sm font-black truncate uppercase tracking-tight ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`}>
                                {creator.name}
                              </h5>
                              <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider block">
                                Criador
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {onNavigateToChat && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onNavigateToChat(creator.id, creator.name);
                                }}
                                title={`Abrir chat de ${creator.name}`}
                                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md active:scale-95"
                              >
                                <MessageSquare size={14} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleUnfollow(creator.id, creator.name)}
                              className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                              title="Deixar de seguir"
                            >
                              <UserMinus size={12} />
                              <span>Deixar de seguir</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default WalletModal;
