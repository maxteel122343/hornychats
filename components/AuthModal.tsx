
import React, { useState } from 'react';
import { X, LogIn, UserPlus, Mail, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  onClose: () => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onShowToast }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (onShowToast) onShowToast('Cadastro realizado! Verifique seu e-mail se necessário.', 'success');
        else alert('Cadastro realizado! Verifique seu e-mail se necessário.');
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 rounded-[3rem] w-full max-w-md shadow-2xl relative transition-all">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400">
          <X size={24} />
        </button>

        <div className="flex flex-col items-center gap-6">
          <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 dark:bg-indigo-600/10 dark:text-indigo-500">
            {isLogin ? <LogIn size={32} /> : <UserPlus size={32} />}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
              {isLogin ? 'Bem-vindo' : 'Criar Conta'}
            </h2>
            <p className="text-sm text-slate-500 mt-2 font-medium">Salve seus créditos e vitrine.</p>
          </div>

          <form onSubmit={handleAuth} className="w-full space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-sm outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-900 dark:text-white font-medium"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-sm outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-900 dark:text-white font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.3em] shadow-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (isLogin ? 'Entrar' : 'Cadastrar')}
            </button>
          </form>

          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 transition-all tracking-widest"
          >
            {isLogin ? 'Criar nova conta' : 'Já tenho conta'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
