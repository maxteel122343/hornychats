import React, { useState } from 'react';
import { 
  X, Save, Settings, Layers, Palette, Eye, Sliders, Timer, Zap, Tag, DollarSign, 
  FolderOpen, ArrowLeft, Clock, MessageSquare, Plus, Trash2, Sparkles, AlertCircle, RotateCcw
} from 'lucide-react';
import { CardDefaults, PaidChatConfig, QuickPhrasesConfig } from '../types';

interface QuickSettingsModalProps {
  onClose: () => void;
  onSave: (defaults: CardDefaults, paidChat?: PaidChatConfig, phrases?: QuickPhrasesConfig) => void;
  initialDefaults: CardDefaults;
  theme?: 'dark' | 'light';
  paidChatConfig?: PaidChatConfig;
  quickPhrasesConfig?: QuickPhrasesConfig;
  initialTab?: 'general' | 'advanced' | 'paid_chat' | 'phrases';
  isRoomCreator?: boolean;
}

const CARD_COLORS = [
  '#0f172a', // Navy (Default)
  '#1e1b4b', // Indigo
  '#4c0519', // Rose
  '#022c22', // Emerald
  '#451a03', // Amber
  '#172554', // Blue
  '#000000', // Black
];

export const DEFAULT_CREATOR_PHRASES = [
  'Oi! Seja muito bem-vindo(a)! 👋',
  'Obrigado pelo carinho e apoio! ❤️',
  'Veja meus novos conteúdos na vitrine! ✨',
  'Gostou? Mande uma mensagem privada! 💬',
  'Estou online por aqui agora! 🚀',
  'Quer ver um vídeo exclusivo? 🎬'
];

export const DEFAULT_VISITOR_PHRASES = [
  'Oi linda! Tudo bem? 😍',
  'Adorei seu perfil e conteúdos! 🔥',
  'Como faço para acessar o VIP? 💎',
  'Pode mandar uma foto ou áudio? 📸',
  'Quer bater um papo no privado? 💬',
  'Você está online agora? ⏱️'
];

export const QuickSettingsModal: React.FC<QuickSettingsModalProps> = ({ 
  onClose, 
  onSave, 
  initialDefaults, 
  theme = 'dark',
  paidChatConfig: initialPaidChat,
  quickPhrasesConfig: initialPhrases,
  initialTab = 'general',
  isRoomCreator = true
}) => {
  const isDark = theme === 'dark';
  const [data, setData] = useState<CardDefaults>(initialDefaults);
  const [activeTab, setActiveTab] = useState<'general' | 'advanced' | 'paid_chat' | 'phrases'>(initialTab);

  // Paid Chat State (Cobrança Rotativa de Chat)
  const [paidChat, setPaidChat] = useState<PaidChatConfig>(initialPaidChat || {
    enabled: false,
    intervalMinutes: 5,
    costCredits: 10,
    warningSeconds: 60,
    autoDebitDefault: false
  });

  // Quick Phrases State (Balões de Frases)
  const [phrases, setPhrases] = useState<QuickPhrasesConfig>(initialPhrases || {
    creatorPhrases: [...DEFAULT_CREATOR_PHRASES],
    visitorPhrases: [...DEFAULT_VISITOR_PHRASES]
  });

  const [newCreatorPhrase, setNewCreatorPhrase] = useState('');
  const [newVisitorPhrase, setNewVisitorPhrase] = useState('');

  const handleChange = (field: keyof CardDefaults, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handlePaidChatChange = (field: keyof PaidChatConfig, value: any) => {
    setPaidChat(prev => ({ ...prev, [field]: value }));
  };

  // Phrases Handlers
  const handleAddCreatorPhrase = () => {
    const trimmed = newCreatorPhrase.trim();
    if (!trimmed) return;
    setPhrases(prev => ({
      ...prev,
      creatorPhrases: [...prev.creatorPhrases, trimmed]
    }));
    setNewCreatorPhrase('');
  };

  const handleRemoveCreatorPhrase = (index: number) => {
    setPhrases(prev => ({
      ...prev,
      creatorPhrases: prev.creatorPhrases.filter((_, i) => i !== index)
    }));
  };

  const handleAddVisitorPhrase = () => {
    const trimmed = newVisitorPhrase.trim();
    if (!trimmed) return;
    setPhrases(prev => ({
      ...prev,
      visitorPhrases: [...prev.visitorPhrases, trimmed]
    }));
    setNewVisitorPhrase('');
  };

  const handleRemoveVisitorPhrase = (index: number) => {
    setPhrases(prev => ({
      ...prev,
      visitorPhrases: prev.visitorPhrases.filter((_, i) => i !== index)
    }));
  };

  const handleResetPhrases = () => {
    setPhrases({
      creatorPhrases: [...DEFAULT_CREATOR_PHRASES],
      visitorPhrases: [...DEFAULT_VISITOR_PHRASES]
    });
  };

  const handleSaveAll = () => {
    onSave(data, paidChat, phrases);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`p-4 sm:p-7 rounded-none sm:rounded-[2.5rem] w-full h-full sm:h-auto max-w-2xl shadow-2xl relative sm:max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 border-0 sm:border ${
        isDark ? 'bg-[#0b1329] border-slate-800 text-white' : 'bg-white border-gray-200 text-slate-900'
      }`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between pb-3 sm:pb-4 mb-2 shrink-0 border-b ${
          isDark ? 'border-white/10 sm:border-transparent' : 'border-gray-200 sm:border-transparent'
        }`}>
          <div className="flex items-center gap-2 sm:gap-3.5">
            <button 
              type="button"
              onClick={onClose}
              className={`p-2 sm:hidden rounded-xl border ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-gray-100 border-gray-200 text-slate-700 hover:bg-gray-200'
              }`}
              title="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
              <Settings size={22} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className={`text-base sm:text-xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                AJUSTES & CONFIGURAÇÕES
              </h3>
              <p className={`text-[9px] sm:text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                TEMPO DE CHAT • BALÕES DE FRASES • CARDS
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl sm:rounded-full transition-all active:scale-95 shrink-0 border ${
              isDark 
                ? 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700' 
                : 'bg-gray-100 border-gray-200 text-slate-600 hover:text-slate-900 hover:bg-gray-200'
            }`}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs - Horizontally scrollable on mobile */}
        <div className={`flex gap-3 sm:gap-6 mb-4 border-b shrink-0 overflow-x-auto scrollbar-hide ${isDark ? 'border-slate-800/80' : 'border-gray-200'}`}>
          <button
            type="button"
            onClick={() => setActiveTab('paid_chat')}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative shrink-0 flex items-center gap-1.5 ${
              activeTab === 'paid_chat' 
                ? 'text-red-500 font-black' 
                : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
            }`}
          >
            <Clock size={15} />
            <span>TEMPO DE CHAT</span>
            {paidChat.enabled && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            {activeTab === 'paid_chat' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('phrases')}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative shrink-0 flex items-center gap-1.5 ${
              activeTab === 'phrases' 
                ? 'text-blue-500 font-black' 
                : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
            }`}
          >
            <MessageSquare size={15} />
            <span>FRASES BALÃO</span>
            {activeTab === 'phrases' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative shrink-0 ${
              activeTab === 'general' 
                ? (isDark ? 'text-emerald-400 font-extrabold' : 'text-emerald-600 font-extrabold') 
                : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
            }`}
          >
            CARDS (PADRÃO)
            {activeTab === 'general' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('advanced')}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative shrink-0 ${
              activeTab === 'advanced' 
                ? (isDark ? 'text-emerald-400 font-extrabold' : 'text-emerald-600 font-extrabold') 
                : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
            }`}
          >
            CUSTOS CARDS
            {activeTab === 'advanced' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 scrollbar-thin">
          
          {/* TAB 1: TEMPO DE CHAT PAGO (COBRANÇA ROTATIVA) */}
          {activeTab === 'paid_chat' && (
            <div className="space-y-5">
              
              {/* Main Activation Banner */}
              <div className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                paidChat.enabled 
                  ? (isDark ? 'bg-red-950/30 border-red-500/50' : 'bg-red-50 border-red-300')
                  : (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-gray-50 border-gray-200')
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                      paidChat.enabled
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                        : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-200 text-slate-500')
                    }`}>
                      <Clock size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          Cobrança Rotativa de Chat
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          paidChat.enabled 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                            : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-200 text-slate-600')
                        }`}>
                          {paidChat.enabled ? 'ATIVADO' : 'DESLIGADO'}
                        </span>
                      </div>
                      <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Exige renovação paga a cada intervalo de tempo para os participantes continuarem no chat.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={paidChat.enabled}
                    onClick={() => handlePaidChatChange('enabled', !paidChat.enabled)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      paidChat.enabled ? 'bg-red-500' : (isDark ? 'bg-slate-700' : 'bg-gray-300')
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        paidChat.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Time Interval & Cost Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Intervalo de Tempo */}
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-gray-50 border-gray-200'
                }`}>
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    INTERVALO DE TEMPO DO CHAT
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={paidChat.intervalMinutes}
                      onChange={(e) => handlePaidChatChange('intervalMinutes', Math.max(1, parseInt(e.target.value) || 1))}
                      className={`w-24 border rounded-xl p-3 text-center text-lg font-black outline-none transition-all ${
                        isDark 
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-red-500' 
                          : 'bg-white border-gray-200 text-slate-900 focus:border-red-500'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Minutos por ciclo
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[1, 2, 5, 10, 15, 30].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => handlePaidChatChange('intervalMinutes', mins)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          paidChat.intervalMinutes === mins
                            ? 'bg-red-500 text-white border-red-500 shadow-sm'
                            : (isDark ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white' : 'bg-white text-slate-600 border-gray-200 hover:bg-gray-100')
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Valor Cobrado por Ciclo */}
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-gray-50 border-gray-200'
                }`}>
                  <label className={`text-[10px] font-black uppercase tracking-widest block text-red-500`}>
                    VALOR COBRADO NA RENOVAÇÃO
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={paidChat.costCredits}
                      onChange={(e) => handlePaidChatChange('costCredits', Math.max(1, parseInt(e.target.value) || 1))}
                      className={`w-28 border rounded-xl p-3 text-center text-lg font-black outline-none transition-all ${
                        isDark 
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-red-500' 
                          : 'bg-white border-gray-200 text-slate-900 focus:border-red-500'
                      }`}
                    />
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                      Créditos por renovação
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[5, 10, 20, 50, 100].map(cr => (
                      <button
                        key={cr}
                        type="button"
                        onClick={() => handlePaidChatChange('costCredits', cr)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          paidChat.costCredits === cr
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : (isDark ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white' : 'bg-white text-slate-600 border-gray-200 hover:bg-gray-100')
                        }`}
                      >
                        {cr} cr
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tempo do Cronômetro Regressivo */}
              <div className={`p-4 rounded-2xl border space-y-2 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <label className={`text-[10px] font-black uppercase tracking-widest block text-red-400`}>
                      AVISO DE CRONÔMETRO REGRESSIVO EM VERMELHO
                    </label>
                    <p className={`text-[10px] mt-0.5 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Tempo de contagem regressiva em destaque vermelho exibido para o usuário antes do chat fechar.
                    </p>
                  </div>
                  <span className="text-xs font-black text-red-400 font-mono px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30">
                    {paidChat.warningSeconds || 60}s
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  {[30, 60, 90, 120].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handlePaidChatChange('warningSeconds', sec)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                        (paidChat.warningSeconds || 60) === sec
                          ? 'bg-red-600 text-white border-red-500 shadow-md'
                          : (isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-600 border-gray-200')
                      }`}
                    >
                      {sec >= 60 ? `${sec / 60} min (${sec}s)` : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Informative Preview Card */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                isDark ? 'bg-blue-600/10 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-blue-400" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold block uppercase tracking-wider text-[10px] text-blue-400 mb-0.5">
                    Como funciona a Renovação de Chat:
                  </span>
                  A cada <strong>{paidChat.intervalMinutes} minutos</strong>, surge para o usuário participante um modal com <strong>cronômetro regressivo vermelho de {paidChat.warningSeconds || 60}s</strong>.
                  O usuário pode pagar <strong>{paidChat.costCredits} créditos</strong> para renovar ou ativar o <strong>Débito Automático</strong> para renovar de forma contínua sem travar a conversa. Se não pagar, a sessão é pausada.
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: FRASES EM BALÃO (SUGESTÕES RÁPIDAS) */}
          {activeTab === 'phrases' && (
            <div className="space-y-6">
              
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div>
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    BALÕES DE FRASES RÁPIDAS (CHIPS)
                  </h4>
                  <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Frases em balão que aparecem acima do teclado para envio com 1 clique.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetPhrases}
                  className="text-[10px] font-bold text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
                  title="Restaurar frases originais"
                >
                  <RotateCcw size={12} />
                  <span>Restaurar Padrão</span>
                </button>
              </div>

              {/* SEÇÃO 1: Minhas Frases (Para o Criador Enviar) */}
              <div className={`p-4 sm:p-5 rounded-2xl border space-y-3.5 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs">
                    1
                  </div>
                  <div>
                    <span className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Minhas Frases Rápidas (Para Você Enviar)
                    </span>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Aparecem para você quando estiver na sua sala para responder instantaneamente.
                    </p>
                  </div>
                </div>

                {/* Add new creator phrase */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCreatorPhrase}
                    onChange={(e) => setNewCreatorPhrase(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCreatorPhrase()}
                    placeholder="Digite uma nova frase para você enviar..."
                    className={`flex-1 border rounded-xl px-3.5 py-2 text-xs font-bold outline-none transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500 placeholder-slate-600' 
                        : 'bg-white border-gray-200 text-slate-900 focus:border-blue-500 placeholder-slate-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleAddCreatorPhrase}
                    disabled={!newCreatorPhrase.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Plus size={14} />
                    <span>Adicionar</span>
                  </button>
                </div>

                {/* List of Creator Phrases */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {phrases.creatorPhrases.map((phrase, idx) => (
                    <div
                      key={idx}
                      className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                        isDark 
                          ? 'bg-slate-800 border-slate-700 text-slate-200' 
                          : 'bg-white border-gray-200 text-slate-800 shadow-xs'
                      }`}
                    >
                      <Sparkles size={12} className="text-amber-400 shrink-0" />
                      <span>{phrase}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCreatorPhrase(idx)}
                        className="text-slate-400 hover:text-red-400 transition-colors ml-1"
                        title="Remover frase"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEÇÃO 2: Frases Sugeridas para Visitantes */}
              <div className={`p-4 sm:p-5 rounded-2xl border space-y-3.5 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-xs">
                    2
                  </div>
                  <div>
                    <span className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Frases Sugeridas para Visitantes (Usuários da Sua Sala)
                    </span>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Aparecem acima do teclado de quem entrar na sua sala para facilitar a conversa.
                    </p>
                  </div>
                </div>

                {/* Add new visitor phrase */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVisitorPhrase}
                    onChange={(e) => setNewVisitorPhrase(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddVisitorPhrase()}
                    placeholder="Digite uma frase sugestiva para visitantes enviarem..."
                    className={`flex-1 border rounded-xl px-3.5 py-2 text-xs font-bold outline-none transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-white focus:border-purple-500 placeholder-slate-600' 
                        : 'bg-white border-gray-200 text-slate-900 focus:border-purple-500 placeholder-slate-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleAddVisitorPhrase}
                    disabled={!newVisitorPhrase.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Plus size={14} />
                    <span>Adicionar</span>
                  </button>
                </div>

                {/* List of Visitor Phrases */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {phrases.visitorPhrases.map((phrase, idx) => (
                    <div
                      key={idx}
                      className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                        isDark 
                          ? 'bg-slate-800 border-slate-700 text-slate-200' 
                          : 'bg-white border-gray-200 text-slate-800 shadow-xs'
                      }`}
                    >
                      <Sparkles size={12} className="text-purple-400 shrink-0" />
                      <span>{phrase}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveVisitorPhrase(idx)}
                        className="text-slate-400 hover:text-red-400 transition-colors ml-1"
                        title="Remover frase"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: CARDS GERAIS */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    TÍTULO PADRÃO
                  </label>
                  <input
                    type="text"
                    value={data.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="ex: Quick Capture"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500 placeholder-slate-600' 
                        : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white placeholder-slate-400'
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    CATEGORIA
                  </label>
                  <input
                    type="text"
                    value={data.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    placeholder="ex: Quick"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500 placeholder-slate-600' 
                        : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  DESCRIÇÃO PADRÃO
                </label>
                <textarea
                  value={data.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="ex: Captured via Quick Actions"
                  className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold min-h-[90px] resize-none transition-all ${
                    isDark 
                      ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500 placeholder-slate-600' 
                      : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white placeholder-slate-400'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    TAGS [SEPARADAS POR VÍRGULA]
                  </label>
                  <input
                    type="text"
                    value={data.tags}
                    onChange={(e) => handleChange('tags', e.target.value)}
                    placeholder="ex: quick, viral, exclusivo"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500 placeholder-slate-600' 
                        : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white placeholder-slate-400'
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    GRUPO / PASTA
                  </label>
                  <input
                    type="text"
                    value={data.group || 'Geral'}
                    onChange={(e) => handleChange('group', e.target.value)}
                    placeholder="ex: Geral"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500 placeholder-slate-600' 
                        : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              {/* Default Publication Destination Toggle */}
              <div className={`p-4 rounded-2xl border transition-all ${
                data.postToChat !== false
                  ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200')
                  : (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-gray-50 border-gray-200')
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Publicar no Chat por padrão
                      </span>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                        data.postToChat !== false
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : (isDark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-100 text-amber-700 border border-amber-200')
                      }`}>
                        {data.postToChat !== false ? 'Chat + Vitrine' : 'Apenas Vitrine'}
                      </span>
                    </div>
                    <p className={`text-[9px] mt-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {data.postToChat !== false
                        ? 'Ativado: O card aparecerá no chat e na vitrine.'
                        : 'Desativado: O card não aparecerá no chat, apenas na vitrine.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={data.postToChat !== false}
                    onClick={() => handleChange('postToChat', data.postToChat === false ? true : false)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      data.postToChat !== false ? 'bg-emerald-500' : (isDark ? 'bg-slate-700' : 'bg-gray-300')
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        data.postToChat !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AVANÇADO E CUSTOS DE CARDS */}
          {activeTab === 'advanced' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">
                    CUSTO EM CRÉDITOS DO CARD
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.creditCost}
                    onChange={(e) => handleChange('creditCost', Math.max(0, parseInt(e.target.value) || 0))}
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold ${
                      isDark ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500' : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    DURAÇÃO DO CARD (SEGUNDOS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.duration}
                    onChange={(e) => handleChange('duration', Math.max(0, parseInt(e.target.value) || 0))}
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold ${
                      isDark ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500' : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    REPETIÇÃO DO CARD (MINUTOS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.repeatInterval || 0}
                    onChange={(e) => handleChange('repeatInterval', Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0 para não repetir"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold ${
                      isDark ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500' : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    AUTO DELETE (SEGUNDOS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.expirySeconds || 0}
                    onChange={(e) => handleChange('expirySeconds', Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0 para nunca apagar"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold ${
                      isDark ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500' : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>
              </div>

              {/* Blur Slider */}
              <div className={`p-4 sm:p-5 rounded-2xl border space-y-2 ${
                isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex justify-between items-center">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    NÍVEL DE BLUR PADRÃO
                  </label>
                  <span className="text-emerald-500 font-black text-xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    {data.blurLevel}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={data.blurLevel}
                  onChange={(e) => handleChange('blurLevel', parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Define o nível de desfoque inicial na prévia para quem ainda não desbloqueou.</p>
              </div>

              {/* Card Color */}
              <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${
                isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-gray-50 border-gray-200'
              }`}>
                <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  COR DO CARD
                </label>
                <div className="flex flex-wrap gap-3">
                  {CARD_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleChange('cardColor', c)}
                      className={`w-9 h-9 rounded-xl border-2 transition-all active:scale-95 ${
                        data.cardColor === c ? 'border-emerald-500 scale-110 shadow-lg' : (isDark ? 'border-slate-700 hover:border-slate-500' : 'border-gray-300 hover:border-gray-400')
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className={`pt-4 mt-2 border-t flex items-center justify-end gap-3 shrink-0 ${
          isDark ? 'border-slate-800/80' : 'border-gray-200'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all active:scale-95 ${
              isDark 
                ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300' 
                : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-slate-700'
            }`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-7 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl uppercase tracking-wider text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 active:scale-95"
          >
            <Save size={16} />
            Salvar Configurações
          </button>
        </div>

      </div>
    </div>
  );
};

export default QuickSettingsModal;
