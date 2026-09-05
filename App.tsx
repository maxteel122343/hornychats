
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ChatRoom from './components/ChatRoom';
import Home from './components/Home';
import Gallery from './components/Gallery';
import AuthModal from './components/AuthModal';
import { Toast, ToastType, ToastOptions } from './components/Toast';
import { User, AppTheme } from './types';
import { supabase } from './lib/supabase';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-white text-center">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-4">
            <h2 className="text-xl font-black text-red-500 uppercase tracking-wide">Ocorreu um erro inesperado</h2>
            <p className="text-sm text-slate-400">
              Desculpe pelo transtorno. Clique no botão abaixo para recarregar a tela.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-wider text-xs transition-all shadow-lg active:scale-95"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [user, setUser] = useState<User>(() => {
    const today = new Date().toISOString().split('T')[0];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('guest_user');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const lastClaimDate = parsed.last_free_claim_at ? parsed.last_free_claim_at.split('T')[0] : null;
          const paid = parsed.paid_credits !== undefined ? parsed.paid_credits : Math.max(0, (parsed.credits || 0) - (parsed.free_credits || 0));

          // Renovação diária de 20 créditos gratuitos para o visitante
          if (!lastClaimDate || lastClaimDate !== today) {
            const renewedUser = {
              ...parsed,
              free_credits: 20,
              paid_credits: paid,
              credits: paid + 20,
              last_free_claim_at: new Date().toISOString()
            };
            localStorage.setItem('guest_user', JSON.stringify(renewedUser));
            return renewedUser;
          }
          return parsed;
        } catch (e) {}
      }
    }
    const newGuest: User = {
      id: 'guest_' + Math.random().toString(36).substr(2, 5),
      name: 'Visitante',
      credits: 20,
      free_credits: 20,
      paid_credits: 0,
      earnings: 0,
      isHost: false,
      isLoggedIn: false,
      last_free_claim_at: new Date().toISOString()
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('guest_user', JSON.stringify(newGuest));
    }
    return newGuest;
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  // Padrão 'gold' (Gold Prime light)
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_theme') as AppTheme;
      if (saved === 'gold' || saved === 'dark' || saved === 'light') return saved;
    }
    return 'gold';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      let next: AppTheme = 'gold';
      if (prev === 'gold') next = 'light';
      else if (prev === 'light') next = 'dark';
      else next = 'gold';
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_theme', next);
      }
      return next;
    });
  };

  const [toast, setToast] = useState<{ 
    message: string; 
    type: ToastType; 
    isVisible: boolean;
    subMessage?: string;
    link?: string;
    duration?: number;
    shareText?: string;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showToast = (message: string, type: ToastType = 'info', options?: ToastOptions) => {
    setToast({ 
      message, 
      type, 
      isVisible: true,
      subMessage: options?.subMessage,
      link: options?.link,
      duration: options?.duration,
      shareText: options?.shareText
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_theme', theme);
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('theme-gold');
      document.body.classList.remove('theme-gold');
    } else if (theme === 'gold') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('theme-gold');
      document.body.classList.add('theme-gold');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.remove('theme-gold');
      document.body.classList.remove('theme-gold');
    }
  }, [theme]);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        syncUser(session.user);
      }
    }).catch(err => {
      console.warn("Initial session lookup error:", err);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        syncUser(session.user);
      } else {
        let guestUser: User;
        const saved = localStorage.getItem('guest_user');
        if (saved) {
          try {
            guestUser = JSON.parse(saved);
          } catch (e) {
            guestUser = {
              id: 'guest_' + Math.random().toString(36).substr(2, 5),
              name: 'Visitante',
              credits: 50,
              earnings: 0,
              isHost: false,
              isLoggedIn: false
            };
            localStorage.setItem('guest_user', JSON.stringify(guestUser));
          }
        } else {
          guestUser = {
            id: 'guest_' + Math.random().toString(36).substr(2, 5),
            name: 'Visitante',
            credits: 50,
            earnings: 0,
            isHost: false,
            isLoggedIn: false
          };
          localStorage.setItem('guest_user', JSON.stringify(guestUser));
        }
        setUser(guestUser);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sincronização em Tempo Real do Perfil (Créditos, Ganhos, etc.)
  useEffect(() => {
    if (!user.isLoggedIn || !user.id || user.id.startsWith('guest_')) return;

    const channel = supabase.channel(`profile_realtime_${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`
      }, (payload) => {
        const updated = payload.new as any;
        if (updated) {
          const newPhoto = updated.profile_photo || updated.avatar_url || updated.photo_url;
          if (newPhoto) {
            localStorage.setItem(`linkcard_avatar_${user.id}`, newPhoto);
            localStorage.setItem('linkcard_user_photo', newPhoto);
          }
          setUser(prev => ({
            ...prev,
            credits: updated.credits !== undefined ? updated.credits : prev.credits,
            free_credits: updated.free_credits !== undefined ? updated.free_credits : prev.free_credits,
            earnings: updated.earnings !== undefined ? updated.earnings : prev.earnings,
            profilePhoto: newPhoto !== undefined ? newPhoto : prev.profilePhoto,
            pixKey: updated.pix_key !== undefined ? updated.pix_key : prev.pixKey,
            picpayEmail: updated.picpay_email !== undefined ? updated.picpay_email : prev.picpayEmail,
            paypalEmail: updated.paypal_email !== undefined ? updated.paypal_email : prev.paypalEmail,
            stripeEmail: updated.stripe_email !== undefined ? updated.stripe_email : prev.stripeEmail,
            last_free_claim_at: updated.last_free_claim_at !== undefined ? updated.last_free_claim_at : prev.last_free_claim_at
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.isLoggedIn, user.id]);

  const syncUser = async (sbUser: any) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      if (profile && !error) {
        const loadedPhoto = profile.profile_photo 
          || profile.avatar_url 
          || profile.photo_url 
          || localStorage.getItem(`linkcard_avatar_${profile.id}`)
          || localStorage.getItem('linkcard_user_photo') 
          || undefined;

        if (loadedPhoto) {
          localStorage.setItem(`linkcard_avatar_${profile.id}`, loadedPhoto);
          localStorage.setItem('linkcard_user_photo', loadedPhoto);
        }

        const rawPaid = profile.paid_credits !== undefined 
          ? profile.paid_credits 
          : Math.max(0, (profile.credits ?? 0) - (profile.free_credits ?? 0));
        const rawFree = profile.free_credits !== undefined ? profile.free_credits : 20;
        const todayStr = new Date().toISOString().split('T')[0];
        const lastClaimDate = profile.last_free_claim_at ? profile.last_free_claim_at.split('T')[0] : null;

        let currentFree = rawFree;
        let currentPaid = rawPaid;
        let currentClaimAt = profile.last_free_claim_at || new Date().toISOString();
        let needsDbSync = false;

        // Renovação diária de 20 créditos gratuitos para o criador/usuário autenticado
        if (!lastClaimDate || lastClaimDate !== todayStr) {
          currentFree = 20; // Renova os 20 créditos gratuitos diários
          currentClaimAt = new Date().toISOString();
          needsDbSync = true;
        }

        const currentTotal = currentPaid + currentFree;

        if (needsDbSync) {
          supabase.from('profiles').update({
            free_credits: currentFree,
            paid_credits: currentPaid,
            credits: currentTotal,
            last_free_claim_at: currentClaimAt
          }).eq('id', profile.id).then(({ error }) => {
            if (error) console.warn("Erro ao atualizar renovação diária no perfil:", error);
          });
        }

        setUser({
          id: profile.id,
          name: profile.username || sbUser.email?.split('@')[0],
          credits: currentTotal,
          earnings: profile.earnings ?? 0,
          free_credits: currentFree,
          paid_credits: currentPaid,
          last_free_claim_at: currentClaimAt,
          isLoggedIn: true,
          profilePhoto: loadedPhoto,
          isHost: true // Authenticated users can be hosts
        });
      } else {
        // Create profile if not exists with 20 daily free credits
        const newProfile = {
          id: sbUser.id,
          username: sbUser.email?.split('@')[0],
          credits: 20,
          earnings: 0,
          free_credits: 20,
          paid_credits: 0,
          last_free_claim_at: new Date().toISOString()
        };
        await supabase.from('profiles').insert([newProfile]);
        setUser({ ...newProfile, isLoggedIn: true, name: newProfile.username, isHost: true });
      }
    } catch (e) {
      console.warn("syncUser profile query error:", e);
      setUser(prev => ({
        ...prev,
        id: sbUser.id,
        name: sbUser.email?.split('@')[0] || prev.name,
        isLoggedIn: true,
        isHost: true
      }));
    }
  };

  const updateCredits = async (amount: number) => {
    setUser(prev => {
      let paid = prev.paid_credits !== undefined ? prev.paid_credits : Math.max(0, prev.credits - (prev.free_credits || 0));
      let free = prev.free_credits !== undefined ? prev.free_credits : 0;

      if (amount > 0) {
        // Recarga ou depósito (ex: Pix) -> adiciona aos créditos pagos permanentes
        paid += amount;
      } else if (amount < 0) {
        // Cobrança / gasto (ex: renovação de chat, compra de card)
        // Consome primeiro os créditos gratuitos diários; se faltar, debita dos créditos pagos
        const cost = Math.abs(amount);
        if (free >= cost) {
          free -= cost;
        } else {
          const remainder = cost - free;
          free = 0;
          paid = Math.max(0, paid - remainder);
        }
      }

      const total = paid + free;
      const updatedUser: User = {
        ...prev,
        credits: total,
        free_credits: free,
        paid_credits: paid
      };

      if (typeof window !== 'undefined' && !prev.isLoggedIn) {
        localStorage.setItem('guest_user', JSON.stringify(updatedUser));
      }

      if (prev.isLoggedIn) {
        supabase
          .from('profiles')
          .update({ 
            credits: total,
            free_credits: free,
            paid_credits: paid
          })
          .eq('id', prev.id)
          .then(({ error }) => {
            if (error) console.warn("Erro ao atualizar créditos no DB:", error);
          });
      }

      return updatedUser;
    });
  };

  const updateFreeCredits = async (amount: number, updateTimestamp: boolean = false) => {
    setUser(prev => {
      const newFree = Math.max(0, (prev.free_credits || 0) + amount);
      const paid = prev.paid_credits !== undefined ? prev.paid_credits : Math.max(0, prev.credits - (prev.free_credits || 0));
      const total = paid + newFree;
      const now = new Date().toISOString();

      const updatedUser: User = {
        ...prev,
        free_credits: newFree,
        paid_credits: paid,
        credits: total,
        last_free_claim_at: updateTimestamp ? now : prev.last_free_claim_at
      };

      if (typeof window !== 'undefined' && !prev.isLoggedIn) {
        localStorage.setItem('guest_user', JSON.stringify(updatedUser));
      }

      if (prev.isLoggedIn) {
        const updateData: any = { 
          free_credits: newFree, 
          paid_credits: paid, 
          credits: total 
        };
        if (updateTimestamp) updateData.last_free_claim_at = now;

        supabase
          .from('profiles')
          .update(updateData)
          .eq('id', prev.id)
          .then(({ error }) => {
            if (error) console.warn("Erro ao atualizar free_credits no DB:", error);
          });
      }

      return updatedUser;
    });
  };

  return (
    <ErrorBoundary>
      <Router>
        <div className={`min-h-screen w-full max-w-full overflow-x-hidden transition-colors duration-300 ${
          theme === 'gold'
            ? 'bg-[#F3F0EA] text-[#1A1712] selection:bg-[#A37B14]/25'
            : theme === 'dark'
            ? 'bg-slate-950 text-white selection:bg-indigo-500/30'
            : 'bg-gray-50 text-slate-900 selection:bg-red-500/30'
        }`}>
          <Routes>
            <Route
              path="/"
              element={<Home user={user} openAuth={() => setIsAuthModalOpen(true)} theme={theme} toggleTheme={toggleTheme} onShowToast={showToast} />}
            />
            <Route
              path="/chat/:roomId"
              element={<ChatRoom user={user} updateCredits={updateCredits} updateFreeCredits={updateFreeCredits} openAuth={() => setIsAuthModalOpen(true)} theme={theme} toggleTheme={toggleTheme} onShowToast={showToast} />}
            />
            <Route
              path="/gallery"
              element={<Gallery user={user} onShowToast={showToast} updateCredits={updateCredits} theme={theme} toggleTheme={toggleTheme} />}
            />
          </Routes>
          {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} onShowToast={showToast} />}
          <Toast
            message={toast.message}
            type={toast.type}
            isVisible={toast.isVisible}
            subMessage={toast.subMessage}
            link={toast.link}
            duration={toast.duration}
            shareText={toast.shareText}
            theme={theme}
            onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
