
import React, { useState, useEffect, useRef } from 'react';
import { Lock, Play, Volume2, Camera, Phone, MessageSquare, Eye, Clock, Tag, MoreVertical, X, Check, Maximize2, DownloadCloud, Timer, ImageOff, Trash2, Edit, AlertTriangle, LogIn, Link as LinkIcon, DoorOpen, CalendarClock } from 'lucide-react';
import { MediaCard, CardType } from '../types';
import { ToastType, ToastOptions } from './Toast';

interface MediaCardItemProps {
  card: MediaCard;
  canManage: boolean;
  onUnlock: () => boolean | Promise<boolean>;
  isHostMode: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (card: MediaCard) => void;
  onInsertToRoom?: (card: MediaCard) => void;
  onSchedule?: (card: MediaCard) => void;
  onShowToast?: (message: string, type?: ToastType, options?: ToastOptions) => void;
  theme?: 'dark' | 'light';
}

const MediaCardItem: React.FC<MediaCardItemProps> = ({ 
  card, 
  canManage, 
  onUnlock, 
  isHostMode, 
  onDelete, 
  onEdit, 
  onInsertToRoom, 
  onSchedule, 
  onShowToast,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';
  const [isUnlocked, setIsUnlocked] = useState(canManage);
  const [showSession, setShowSession] = useState(false);
  const [timeLeft, setTimeLeft] = useState(card.duration);
  const [callStatus, setCallStatus] = useState<'none' | 'requesting' | 'accepted' | 'declined'>('none');
  const [imgError, setImgError] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    let timer: any;
    // Only run timer if we have a finite duration (>0)
    // If cards use 0 for "infinite", we shouldn't close it automatically.
    // Assuming card.duration 0 means infinite.
    if (showSession && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && card.duration > 0) {
      // Auto-close only if it had a duration and it expired
      setShowSession(false);
      setTimeLeft(card.duration);
    }
    return () => clearInterval(timer);
  }, [showSession, timeLeft, card.duration]);

  useEffect(() => {
    if (card.expirySeconds && card.expirySeconds > 0) {
      if (card.id === 'preview') {
        setExpiresIn(card.expirySeconds);
        return;
      }
      const expirationTime = card.createdAt + (card.expirySeconds * 1000);
      const updateExpiry = () => {
        const now = Date.now();
        const diff = Math.floor((expirationTime - now) / 1000);
        if (diff <= 0) setExpiresIn(0);
        else setExpiresIn(diff);
      };
      updateExpiry();
      const interval = setInterval(updateExpiry, 1000);
      return () => clearInterval(interval);
    } else {
      setExpiresIn(null);
    }
  }, [card.expirySeconds, card.createdAt, card.id]);

  useEffect(() => {
    if (canManage) setIsUnlocked(true);
  }, [canManage]);

  const handleInteraction = async () => {
    if (expiresIn === 0) return;
    if (card.type === CardType.CHAT) {
      await onUnlock();
      return;
    }
    if (isUnlocked) {
      if (card.type === CardType.AUDIO_CALL || card.type === CardType.VIDEO_CALL) {
        if (callStatus === 'none') setCallStatus('requesting');
        else if (callStatus === 'accepted') setShowSession(true);
      } else {
        setShowSession(true);
      }
      return;
    }

    // Handle potential promise from onUnlock
    const result = onUnlock();
    const success = result instanceof Promise ? await result : result;

    if (success) {
      setIsUnlocked(true);
      if (card.type === CardType.AUDIO_CALL || card.type === CardType.VIDEO_CALL) setCallStatus('requesting');
      else setShowSession(true);
    }
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `${window.location.origin}/#/chat/priv-${card.id}`;
    navigator.clipboard.writeText(link);
    if (onShowToast) {
      onShowToast("Link da sala privada copiado!", "success", {
        link,
        subMessage: `Link direto para o card exclusivo "${card.title}".`,
        shareText: `Acesse este card exclusivo "${card.title}": ${link}`
      });
    } else {
      alert("Link da sala privada copiado: " + link);
    }
  };

  const handleDeleteAttempt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (expiresIn !== null && expiresIn > 0) {
      if (window.confirm(`ATENÇÃO: Card ativo por ${formatExpiry(expiresIn)}. Excluir agora?`)) onDelete(card.id);
    } else {
      if (window.confirm("Excluir este card permanentemente?")) onDelete(card.id);
    }
  };

  const handleEditAttempt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(card);
  }

  const handleDownload = async () => {
    if (!card.mediaUrl) return;
    try {
      const response = await fetch(card.mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${card.title.replace(/\s+/g, '_')}_LinkCard.${card.type === CardType.VIDEO ? 'mp4' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Erro ao baixar:", e);
      window.open(card.mediaUrl, '_blank');
    }
  };

  const getIcon = () => {
    switch (card.type) {
      case CardType.VIDEO: return <Play size={20} />;
      case CardType.AUDIO: return <Volume2 size={20} />;
      case CardType.IMAGE: return <Eye size={20} />;
      case CardType.VIDEO_CALL: return <Camera size={20} />;
      case CardType.AUDIO_CALL: return <Phone size={20} />;
      case CardType.CHAT: return <MessageSquare size={20} />;
      default: return <Play size={20} />;
    }
  };

  const onResizeStart = (e: React.MouseEvent) => {
    // Kept for backward compatibility if needed
    e.preventDefault();
  };

  const blurPixels = (!isUnlocked && card.isBlur) ? (card.blurLevel || 30) : 0;
  const imageStyle = {
    filter: `blur(${blurPixels}px)`,
    transition: 'filter 0.5s ease-out, transform 0.5s ease'
  };

  const formatExpiry = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (expiresIn === 0 && !isHostMode && card.id !== 'preview') {
    return (
      <div className={`p-4 rounded-3xl border flex items-center justify-center my-3 opacity-60 select-none max-w-[340px] w-full ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-gray-100 border-gray-200'}`}>
        <span className="text-[10px] font-black uppercase text-slate-500">Conteúdo Expirado</span>
      </div>
    );
  }

  const renderThumbnail = () => {
    if (imgError || !card.thumbnail) {
      return (
        <div className={`w-full h-full flex flex-col items-center justify-center ${isDark ? 'bg-slate-800 text-slate-600' : 'bg-gray-200 text-slate-400'}`}>
          <ImageOff size={28} />
          <span className="text-[9px] mt-1.5 font-black uppercase tracking-wider">Sem Imagem</span>
        </div>
      );
    }
    return (
      <img
        src={card.thumbnail}
        alt={card.title}
        style={imageStyle}
        onError={() => setImgError(true)}
        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-[0.88] ${!isUnlocked ? 'scale-105' : 'scale-100'}`}
      />
    );
  };

  const CreatorControls = () => {
    if (!canManage || card.id === 'preview') return null;
    return (
      <div className="absolute top-11 right-2.5 z-40 flex flex-col gap-1.5 bg-black/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-2xl">
        <button
          onClick={(e) => { e.stopPropagation(); setShowControls(false); handleEditAttempt(e); }}
          className="p-1.5 bg-white/10 hover:bg-white text-white hover:text-black rounded-xl transition-all" title="Editar Card"
        >
          <Edit size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowControls(false); onInsertToRoom?.(card); }}
          className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all" title="Inserir na Sala"
        >
          <DoorOpen size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowControls(false); onSchedule?.(card); }}
          className="p-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-all" title="Programar Card"
        >
          <CalendarClock size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowControls(false); handleDeleteAttempt(e); }}
          className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all" title="Excluir Card"
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  const creatorName = card.creatorName || (isHostMode ? 'Host' : 'Criador');

  return (
    <>
      <div
        className={`group relative rounded-3xl overflow-hidden border transition-all duration-300 shadow-lg flex flex-col justify-between w-full max-w-[340px] sm:max-w-[360px] mx-auto sm:mx-0 my-3 select-none ${
          isDark 
            ? 'bg-slate-900/90 border-white/10 hover:border-indigo-500/60 shadow-2xl' 
            : 'bg-white border-gray-200 hover:border-indigo-400 hover:shadow-2xl shadow-gray-200/80'
        }`}
      >
        {/* TOP THUMBNAIL AREA */}
        <div className="aspect-[16/10] w-full overflow-hidden relative bg-black/60">
          {renderThumbnail()}

          {/* TOP BADGES & CONTROLS */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 z-10">
            {/* Media Type Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md text-white border border-white/10 text-[9px] font-black uppercase tracking-wider">
              {getIcon()}
              <span>{card.type}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Expiry Timer Badge */}
              {expiresIn !== null && expiresIn > 0 && (
                <div className="flex items-center gap-1 bg-red-600/80 text-white backdrop-blur-md px-2 py-0.5 rounded-xl text-[8px] font-black font-mono border border-red-400/40 animate-pulse">
                  <Timer size={10} />
                  <span>{formatExpiry(expiresIn)}</span>
                </div>
              )}

              {/* Status / Credit Cost Badge */}
              <div className={`px-2.5 py-1 rounded-xl backdrop-blur-md text-[9px] font-black uppercase tracking-wider border shadow-md ${
                isUnlocked
                  ? 'bg-emerald-500/90 text-white border-emerald-400/40'
                  : 'bg-amber-500/90 text-slate-950 border-amber-300/60'
              }`}>
                {isUnlocked ? 'LIBERADO' : `${card.creditCost} CR`}
              </div>

              {/* Creator Options Toggle (if canManage) */}
              {canManage && card.id !== 'preview' && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowControls(!showControls); }}
                  className="p-1 rounded-xl bg-black/75 hover:bg-black text-white border border-white/15 backdrop-blur-md transition-all active:scale-95"
                  title="Gerenciar Card"
                >
                  <MoreVertical size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Creator Controls Dropdown */}
          {showControls && <CreatorControls />}

          {/* CREATOR PROFILE CHIP ON CARD */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-slate-200">
              {card.creatorPhoto ? (
                <img
                  src={card.creatorPhoto}
                  alt={creatorName}
                  className="w-5 h-5 rounded-full object-cover border border-white/30"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-[9px] border border-white/30">
                  {creatorName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-[9px] font-black uppercase tracking-tight truncate max-w-[120px]">
                {creatorName}
              </span>
            </div>

            <button
              onClick={handleCopyLink}
              title="Copiar Link da Sala Exclusiva"
              className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 backdrop-blur-md transition-all shadow-lg active:scale-95 flex items-center justify-center"
            >
              <MessageSquare size={13} />
            </button>
          </div>

          {/* BLUR OVERLAY IF LOCKED */}
          {!isUnlocked && card.isBlur && (
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[6px] flex flex-col items-center justify-center p-4 text-center z-[5]">
              <Lock size={22} className="text-amber-400 mb-1 drop-shadow-md" />
              <span className="text-[8px] font-black uppercase tracking-widest text-white drop-shadow">
                Conteúdo Exclusivo
              </span>
            </div>
          )}
        </div>

        {/* BOTTOM INFO AREA */}
        <div className={`p-4 flex flex-col flex-1 justify-between border-t space-y-3 ${
          isDark ? 'bg-slate-900/90 border-white/5' : 'bg-white border-gray-100'
        }`}>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${
                isDark ? 'text-indigo-400' : 'text-indigo-600'
              }`}>
                {card.category || 'PREMIUM'}
              </span>
              {card.duration > 0 && (
                <span className={`text-[8px] font-bold uppercase tracking-widest ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {Math.floor(card.duration / 60)}:{(card.duration % 60).toString().padStart(2, '0')} MIN
                </span>
              )}
            </div>

            <h3 className={`text-sm font-black leading-snug uppercase tracking-tight line-clamp-1 mb-1 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`} title={card.title}>
              {card.title}
            </h3>

            <p className={`text-[10px] line-clamp-2 leading-relaxed font-medium ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {card.description || 'Sem descrição.'}
            </p>

            {/* TAGS */}
            {card.tags && card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {card.tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-0.5 rounded-lg border text-[8px] font-bold uppercase tracking-wider ${
                      isDark ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-gray-100 border-gray-200 text-slate-600'
                    }`}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ACTION BUTTONS (VER / DESBLOQUEAR & CHAT) */}
          <div className={`grid grid-cols-5 gap-2 pt-2 border-t ${
            isDark ? 'border-white/5' : 'border-gray-100'
          }`}>
            <button
              onClick={handleInteraction}
              className={`col-span-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 ${
                card.type === CardType.CHAT
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : isUnlocked
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : (isDark ? 'bg-white text-slate-950 hover:bg-indigo-600 hover:text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white')
              }`}
            >
              {card.type === CardType.CHAT ? (
                <>
                  <LogIn size={13} />
                  <span>ENTRAR NA SALA</span>
                </>
              ) : isUnlocked ? (
                <>
                  <Eye size={13} />
                  <span>VER MÍDIA</span>
                </>
              ) : (
                <>
                  <Lock size={13} />
                  <span>DESBLOQUEAR ({card.creditCost} CR)</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyLink}
              title="Copiar Link da Sala Exclusiva"
              className={`col-span-1 py-2.5 rounded-xl border transition-all flex items-center justify-center shadow-md active:scale-95 ${
                isDark 
                  ? 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border-indigo-500/30' 
                  : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border-indigo-200'
              }`}
            >
              <MessageSquare size={14} />
            </button>
          </div>
        </div>
      </div>
      {renderFullScreenModal()}
    </>
  );

  function renderFullScreenModal() {
    return showSession && (
      <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-300">
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-[100] bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-4">
            {/* ... (Same header logic) ... */}
            <button
              onClick={() => setShowSession(false)}
              className="p-3 bg-red-600/80 hover:bg-red-600 rounded-full text-white transition-all backdrop-blur-md shadow-lg shadow-red-600/20"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-10">
          {card.type === CardType.VIDEO && card.mediaUrl ? (
            <video src={card.mediaUrl} autoPlay controls className="max-w-full max-h-full rounded-lg shadow-2xl" />
          ) : card.type === CardType.IMAGE && card.mediaUrl ? (
            <img src={card.mediaUrl} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
          ) : card.type === CardType.AUDIO && card.mediaUrl ? (
            <div className="text-center p-8 space-y-8 max-w-md w-full">
              {/* Audio visualization similar to original */}
              <audio src={card.mediaUrl} autoPlay controls className="w-full" />
            </div>
          ) : (
            <div className="text-center p-8 space-y-6">
              {/* Default content */}
            </div>
          )}
        </div>
      </div>
    )
  }
};

export default MediaCardItem;
