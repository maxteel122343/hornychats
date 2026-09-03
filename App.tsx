
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
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('guest_user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    const newGuest = {
      id: 'guest_' + Math.random().toString(36).substr(2, 5),
      name: 'Visitante',
      credits: 50,
      free_credits: 50,
      earnings: 0,
      isHost: false,
      isLoggedIn: false
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

        setUser({
          id: profile.id,
          name: profile.username || sbUser.email?.split('@')[0],
          credits: profile.credits ?? 50,
          earnings: profile.earnings ?? 0,
          free_credits: profile.free_credits ?? 0,
          last_free_claim_at: profile.last_free_claim_at,
          isLoggedIn: true,
          profilePhoto: loadedPhoto,
          isHost: true // Authenticated users can be hosts
        });
      } else {
        // Create profile if not exists
        const newProfile = {
          id: sbUser.id,
          username: sbUser.email?.split('@')[0],
          credits: 50,
          earnings: 0,
          free_credits: 50
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
    const newCredits = user.credits + amount;
    setUser(prev => ({ ...prev, credits: newCredits }));

    if (user.isLoggedIn) {
      await supabase
        .from('profiles')
        .update({ credits: newCredits })
        .eq('id', user.id);
    }
  };

  const updateFreeCredits = async (amount: number, updateTimestamp: boolean = false) => {
    const newFreeCredits = (user.free_credits || 0) + amount;
    const newTotalCredits = user.credits + amount;
    const now = new Date().toISOString();

    setUser(prev => ({
      ...prev,
      free_credits: newFreeCredits,
      credits: newTotalCredits,
      last_free_claim_at: updateTimestamp ? now : prev.last_free_claim_at
    }));

    if (user.isLoggedIn) {
      const updateData: any = { free_credits: newFreeCredits, credits: newTotalCredits };
      if (updateTimestamp) updateData.last_free_claim_at = now;

      await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);
    }
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
            onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
