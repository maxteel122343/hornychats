
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ChatRoom from './components/ChatRoom';
import Home from './components/Home';
import Gallery from './components/Gallery';
import AuthModal from './components/AuthModal';
import { Toast, ToastType, ToastOptions } from './components/Toast';
import { User } from './types';
import { supabase } from './lib/supabase';

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
  // Alterado para 'light' como padrão
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
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
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
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

  const syncUser = async (sbUser: any) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      if (profile && !error) {
        setUser({
          id: profile.id,
          name: profile.username || sbUser.email?.split('@')[0],
          credits: profile.credits ?? 50,
          earnings: profile.earnings ?? 0,
          free_credits: profile.free_credits ?? 0,
          last_free_claim_at: profile.last_free_claim_at,
          isLoggedIn: true,
          profilePhoto: profile.profile_photo,
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
    <Router>
      <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950 text-white selection:bg-indigo-500/30' : 'bg-gray-50 text-slate-900 selection:bg-red-500/30'}`}>
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
  );
};

export default App;
