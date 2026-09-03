
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, LayoutGrid, MessageCircle, LogIn, TrendingUp, User as UserIcon, LogOut, Sun, Moon, Sparkles } from 'lucide-react';
import { User, AppTheme } from '../types';
import { supabase } from '../lib/supabase';
import { ToastType, ToastOptions } from './Toast';

interface HomeProps {
  user: User;
  openAuth: () => void;
  theme: AppTheme;
  toggleTheme: () => void;
  onShowToast?: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const Home: React.FC<HomeProps> = ({ user, openAuth, theme, toggleTheme, onShowToast }) => {
  const navigate = useNavigate();
  const personalRoomId = user.id;
  const isDark = theme === 'dark';
  const isGold = theme === 'gold';

  const handleStartChat = () => {
    navigate(`/chat/${personalRoomId}`);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/#/chat/${personalRoomId}`;
    navigator.clipboard.writeText(link);
    if (onShowToast) {
      onShowToast('Link do seu chat copiado com sucesso!', 'success', {
        link,
        subMessage: 'O link da sua sala exclusiva está pronto para envio.',
        shareText: `Venha conversar comigo no meu chat exclusivo! Acesse pelo link: ${link}`
      });
    } else {
      alert('Seu link de convite foi copiado: ' + link);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const colors = {
    text: isGold ? 'text-[#1A1712]' : isDark ? 'text-white' : 'text-slate-900',
    subText: isGold ? 'text-[#6E675C]' : isDark ? 'text-slate-400' : 'text-slate-600',
    cardBg: isGold ? 'bg-[#FFFCF8] border border-[#1A1712]/10 shadow-xs' : isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-xl',
    primary: isGold ? 'bg-[#1A1712]' : isDark ? 'bg-indigo-600' : 'bg-red-600',
    primaryText: isGold ? 'text-[#A37B14]' : isDark ? 'text-indigo-400' : 'text-red-600',
    glass: isGold ? 'bg-[#FFFCF8] border border-[#1A1712]/10 shadow-xs' : isDark ? 'glass' : 'bg-white/80 backdrop-blur-md border border-gray-200 shadow-sm'
  };

  return (
    <div className={`max-w-4xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8 animate-in fade-in duration-700 ${isDark ? '' : 'text-slate-900'}`}>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-2xl shadow-xl ${colors.primary} shadow-indigo-600/20`}>
            <UserIcon size={20} className="text-white" />
          </div>
          <h1 className={`text-xl md:text-2xl font-black tracking-tighter uppercase ${colors.text}`}>Meu Painel</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide no-scrollbar">
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-2xl ${colors.glass} hover:opacity-80 transition-all ${colors.text} flex-shrink-0`}
            title={`Tema atual: ${theme}. Clique para alternar.`}
          >
            {theme === 'gold' ? <Sparkles size={18} className="text-[#A37B14]" /> : isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => navigate('/gallery')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl ${colors.glass} hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest ${colors.text} flex-shrink-0`}
          >
            <LayoutGrid size={16} />
            <span className="sm:inline">Vitrine</span>
          </button>
          {user.isLoggedIn ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest flex-shrink-0"
            >
              <LogOut size={16} />
              <span className="sm:inline">Sair</span>
            </button>
          ) : (
            <button
              onClick={openAuth}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl ${isDark ? 'bg-white text-slate-950 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'} transition-all font-black text-[10px] uppercase tracking-widest flex-shrink-0`}
            >
              <LogIn size={16} />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <div className={`p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] ${colors.cardBg} flex flex-col justify-between space-y-8 md:space-y-10 relative overflow-hidden`}>
          <div className={`absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 ${isDark ? 'bg-indigo-600/10' : 'bg-red-600/10'} blur-3xl -mr-10 -mt-10 rounded-full`}></div>
          <div>
            <h2 className={`text-2xl md:text-4xl font-black mb-4 md:mb-6 leading-tight ${colors.text} uppercase tracking-tighter`}>Convide e interaja agora.</h2>
            <p className={`${colors.subText} text-base md:text-lg font-medium`}>Você é o host do seu próprio espaço. Crie cards e monetize suas interações.</p>
          </div>

          <div className="space-y-4">
            <div className={`p-4 md:p-5 rounded-[1.5rem] md:rounded-3xl ${isDark ? 'bg-black/40 border-white/5' : 'bg-gray-50 border-gray-200'} border flex items-center justify-between group`}>
              <div className="overflow-hidden">
                <span className="text-[9px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Link de Host</span>
                <code className={`${colors.primaryText} text-xs md:text-sm truncate block font-bold`}>.../chat/{personalRoomId}</code>
              </div>
              <button onClick={copyLink} className={`p-3 md:p-4 rounded-xl md:rounded-2xl transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-white hover:bg-gray-100 text-slate-900 border border-gray-100'}`}>
                <Share2 size={18} />
              </button>
            </div>

            <button
              onClick={handleStartChat}
              className={`w-full flex items-center justify-center gap-3 md:gap-4 ${colors.primary} text-white font-black py-4 md:py-6 rounded-[1.5rem] md:rounded-[2rem] hover:opacity-90 transition-all transform active:scale-95 shadow-2xl uppercase tracking-[0.1em] md:tracking-[0.2em] text-xs md:text-sm`}
            >
              <MessageCircle size={20} />
              ACESSAR MEU CHAT
            </button>
          </div>
        </div>

        <div className="space-y-6 md:space-y-8">
          <div className={`p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] ${colors.cardBg}`}>
            <h3 className={`text-base md:text-lg font-black mb-6 md:mb-8 flex items-center gap-3 uppercase tracking-widest ${colors.text}`}>
              <TrendingUp size={20} className={colors.primaryText} />
              Sua Carteira
            </h3>
            <div className="space-y-4 md:space-y-6">
              <div className={`flex justify-between items-center p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border shadow-inner ${isDark ? 'bg-black/40 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                <span className="text-slate-500 font-black uppercase text-[9px] tracking-widest">Saldo</span>
                <div className="flex items-center gap-2">
                  <span className="font-black text-3xl md:text-4xl text-emerald-400">{user.credits}</span>
                  <span className="text-[9px] font-black text-emerald-400/50 uppercase tracking-widest">CR</span>
                </div>
              </div>

              {!user.isLoggedIn && (
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <p className={`text-[10px] md:text-xs leading-relaxed font-bold ${isDark ? 'text-indigo-200' : 'text-red-800'}`}>
                    CONTA VISITANTE: Faça login para que seus créditos e cards criados não sejam perdidos ao limpar o cache.
                  </p>
                  <button onClick={openAuth} className={`mt-3 text-[9px] font-black uppercase text-white ${colors.primary} px-3 py-1.5 rounded-lg hover:opacity-90 transition-all`}>Logar Agora</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 md:pt-10">
        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 md:mb-6 px-1">Tópicos em Alta</h4>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide no-scrollbar -mx-4 px-4 sm:flex-wrap sm:mx-0 sm:px-0">
          {['Call Premium', 'VIP Content', 'Podcasts', 'Gaming Live', 'Consultoria', 'Meet 1on1'].map((cat) => (
            <div key={cat} className={`px-5 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl border text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all flex-shrink-0 ${isDark ? 'glass border-white/5 hover:bg-indigo-600 hover:text-white' : 'bg-white border-gray-200 hover:bg-red-600 hover:text-white shadow-sm'}`}>
              {cat}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
