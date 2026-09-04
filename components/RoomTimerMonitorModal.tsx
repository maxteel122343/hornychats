import React from 'react';
import { 
  X, Clock, Users, RefreshCw, AlertTriangle, CheckCircle2, 
  UserX, ShieldAlert, Sparkles, Play, Pause, Zap
} from 'lucide-react';
import { UserTimerState, PaidChatConfig, AppTheme } from '../types';

interface RoomTimerMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: AppTheme;
  roomName: string;
  config: PaidChatConfig;
  userTimers: Record<string, UserTimerState>;
  onGrantTime?: (userId: string) => void;
  onCloseUserRoom?: (userId: string) => void;
}

export const RoomTimerMonitorModal: React.FC<RoomTimerMonitorModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
  roomName,
  config,
  userTimers,
  onGrantTime,
  onCloseUserRoom
}) => {
  if (!isOpen) return null;

  const isGold = theme === 'gold';
  const isDark = theme === 'dark' || isGold;

  const timerList = Object.values(userTimers);

  // Stats calculation
  const totalUsers = timerList.length;
  const activeCount = timerList.filter(u => u.status === 'active').length;
  const warningCount = timerList.filter(u => u.status === 'warning').length;
  const renewedCount = timerList.filter(u => u.status === 'renewed' || u.renewalCount > 0).length;
  const expiredCount = timerList.filter(u => u.status === 'expired').length;
  const leftCount = timerList.filter(u => u.status === 'left').length;

  const formatTimer = (totalSeconds: number) => {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (user: UserTimerState) => {
    if (user.status === 'left') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
          <UserX size={10} /> Quitou da Sala
        </span>
      );
    }
    if (user.status === 'expired') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-950/70 text-red-400 border border-red-500/50 animate-pulse">
          <ShieldAlert size={10} /> Sala Fechada
        </span>
      );
    }
    if (user.status === 'warning' || (user.secondsRemaining <= (config.warningSeconds || 60) && user.secondsRemaining > 0)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-950/70 text-amber-400 border border-amber-500/50 animate-pulse">
          <AlertTriangle size={10} /> Em Aviso ({user.secondsRemaining}s)
        </span>
      );
    }
    if (user.status === 'renewed' || user.renewalCount > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-950/70 text-emerald-400 border border-emerald-500/40">
          <CheckCircle2 size={10} /> Ativo • Renovou ({user.renewalCount}x)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-950/70 text-blue-400 border border-blue-500/40">
        <Clock size={10} /> Ativo
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          isGold 
            ? 'bg-[#1A1712] border-[#A37B14]/40 text-[#F3F0EA]' 
            : isDark 
              ? 'bg-slate-900 border-slate-800 text-white' 
              : 'bg-white border-gray-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
          isGold ? 'border-[#A37B14]/20 bg-[#14120E]' : isDark ? 'border-slate-800 bg-slate-950/50' : 'border-gray-100 bg-gray-50/70'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isGold ? 'bg-[#A37B14]/20 text-[#A37B14] border border-[#A37B14]/30' : isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-100 text-amber-700'
            }`}>
              <Clock size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">Monitor de Tempo dos Usuários</h3>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isGold ? 'bg-[#A37B14]/15 border-[#A37B14]/30 text-[#A37B14]' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                }`}>
                  {config.timerMode === 'room_global' ? 'Global da Sala' : 'Individual'}
                </span>
              </div>
              <p className={`text-xs mt-0.5 truncate font-medium ${isGold ? 'text-[#A37B14]' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {roomName} • Ciclo de {config.intervalMinutes || 5} min • {config.paidRenewalEnabled ? `${config.costCredits} créditos/renovação` : 'Sem cobrança'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl border transition-all active:scale-95 ${
              isGold ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' : isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4 border-b text-center shrink-0 ${
          isGold ? 'border-[#A37B14]/15 bg-[#171410]' : isDark ? 'border-slate-800/80 bg-slate-900/50' : 'border-gray-100 bg-gray-50'
        }`}>
          <div className="p-2 rounded-xl bg-black/20 border border-white/5">
            <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Total Usuários</span>
            <span className="text-base sm:text-lg font-mono font-black">{totalUsers}</span>
          </div>
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <span className="text-[10px] font-black uppercase tracking-wider block opacity-80">Ativos</span>
            <span className="text-base sm:text-lg font-mono font-black">{activeCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <span className="text-[10px] font-black uppercase tracking-wider block opacity-80">Em Aviso</span>
            <span className="text-base sm:text-lg font-mono font-black">{warningCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <span className="text-[10px] font-black uppercase tracking-wider block opacity-80">Sala Fechada</span>
            <span className="text-base sm:text-lg font-mono font-black">{expiredCount}</span>
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {timerList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-70">
              <Users size={36} className="mb-2 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-widest">Nenhum visitante conectado no momento</p>
              <p className="text-[11px] mt-1 max-w-xs font-medium">
                Quando os usuários entrarem na sala com o tempo ativado, seus cronômetros individuais e histórico aparecerão aqui em tempo real.
              </p>
            </div>
          ) : (
            timerList.map((userTimer) => {
              const isExpired = userTimer.status === 'expired' || userTimer.secondsRemaining <= 0;
              const isWarning = userTimer.status === 'warning' || (userTimer.secondsRemaining <= (config.warningSeconds || 60) && userTimer.secondsRemaining > 0);

              return (
                <div 
                  key={userTimer.userId}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isExpired
                      ? (isDark ? 'bg-red-950/20 border-red-500/30' : 'bg-red-50/50 border-red-200')
                      : isWarning
                        ? (isDark ? 'bg-amber-950/20 border-amber-500/30' : 'bg-amber-50/50 border-amber-200')
                        : (isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-gray-50 border-gray-200')
                  }`}
                >
                  {/* User Profile & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/10 bg-slate-700 flex items-center justify-center font-black uppercase text-xs">
                      {userTimer.userPhoto ? (
                        <img src={userTimer.userPhoto} alt={userTimer.userName} className="w-full h-full object-cover" />
                      ) : (
                        userTimer.userName?.charAt(0) || 'U'
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold truncate max-w-[150px] sm:max-w-[200px]">
                          {userTimer.userName || 'Usuário'}
                        </h4>
                        {getStatusBadge(userTimer)}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] opacity-70">
                        <span>Entrou: {new Date(userTimer.enteredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span className="font-bold text-emerald-400">
                          Reiniciou {userTimer.renewalCount || 0}x
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Countdown Timer & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                    {/* Timer */}
                    <div className={`px-3 py-1.5 rounded-xl border text-center font-mono font-black text-xs sm:text-sm tracking-tight ${
                      isExpired
                        ? 'bg-red-600 text-white border-red-500 shadow-sm'
                        : isWarning
                          ? 'bg-amber-500 text-black border-amber-400 animate-pulse'
                          : (isGold ? 'bg-[#A37B14]/20 text-[#A37B14] border-[#A37B14]/40' : isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-800 border-gray-300')
                    }`}>
                      {userTimer.status === 'left' ? 'OFFLINE' : formatTimer(userTimer.secondsRemaining)}
                    </div>

                    {/* Quick Actions for Creator */}
                    <div className="flex items-center gap-1.5">
                      {onGrantTime && (
                        <button
                          type="button"
                          onClick={() => onGrantTime(userTimer.userId)}
                          title="Reiniciar tempo / Dar +tempo a este usuário"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95 shadow-xs cursor-pointer"
                        >
                          <RefreshCw size={11} />
                          <span>{isExpired ? 'Reabrir Sala' : '+Tempo'}</span>
                        </button>
                      )}

                      {onCloseUserRoom && !isExpired && userTimer.status !== 'left' && (
                        <button
                          type="button"
                          onClick={() => onCloseUserRoom(userTimer.userId)}
                          title="Encerrar tempo da sala para este usuário agora"
                          className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-black uppercase bg-red-600/80 hover:bg-red-600 text-white transition-all active:scale-95 shadow-xs cursor-pointer"
                        >
                          <UserX size={11} />
                          <span>Fechar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Info */}
        <div className={`p-3 sm:p-4 border-t text-[11px] flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 ${
          isGold ? 'border-[#A37B14]/20 bg-[#14120E] text-[#C5A880]' : isDark ? 'border-slate-800 bg-slate-950/70 text-slate-400' : 'border-gray-200 bg-gray-50 text-slate-600'
        }`}>
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-amber-400 shrink-0" />
            <span>Atualizações sincronizadas em tempo real via broadcast na sala.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider border transition-all active:scale-95 ${
              isGold ? 'bg-[#A37B14] hover:bg-[#B88C1A] text-black border-[#A37B14]' : isDark ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700' : 'bg-gray-200 hover:bg-gray-300 text-gray-800 border-gray-300'
            }`}
          >
            Fechar Monitor
          </button>
        </div>
      </div>
    </div>
  );
};
