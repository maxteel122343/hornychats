
import React, { useState, useEffect, useRef } from 'react';
import { Lock, Play, Volume2, Camera, Phone, MessageSquare, Eye, Clock, Tag, MoreVertical, X, Check, Maximize2, DownloadCloud, Timer, ImageOff, Trash2, Edit, AlertTriangle, LogIn, Link as LinkIcon, DoorOpen, CalendarClock, ZoomIn, Heart, UserPlus, Crown } from 'lucide-react';
import { MediaCard, CardType, AppTheme } from '../types';
import { ToastType, ToastOptions } from './Toast';
import ImageViewerModal from './ImageViewerModal';
import { fetchLikesForCards, toggleCardLike } from '../lib/likes';
import { followUser, unfollowUser, getFollowing } from '../lib/followers';

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
  theme?: AppTheme;
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
  theme = 'gold'
}) => {
  const isDark = theme === 'dark';
  const isGold = theme === 'gold';
  const [isUnlocked, setIsUnlocked] = useState(canManage);
  const [showSession, setShowSession] = useState(false);
  const [timeLeft, setTimeLeft] = useState(card.duration);
  const [callStatus, setCallStatus] = useState<'none' | 'requesting' | 'accepted' | 'declined'>('none');
  const [imgError, setImgError] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  
  // Likes and Follow state
  const [likesCount, setLikesCount] = useState(card.likesCount || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

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

  // Carregar contagem e status de curtida + seguidor
  useEffect(() => {
    if (card.id && card.id !== 'preview') {
      const currentUserId = localStorage.getItem('linkcard_user_id') || undefined;
      fetchLikesForCards([card.id], currentUserId).then(({ counts, userLiked }) => {
        setLikesCount(counts[card.id] || 0);
        setIsLiked(userLiked.has(card.id));
      }).catch(console.warn);

      if (card.creator_id && currentUserId && card.creator_id !== currentUserId) {
        getFollowing(currentUserId).then(list => {
          setIsFollowing(list.some(f => f.id === card.creator_id));
        }).catch(console.warn);
      }
    }
  }, [card.id, card.creator_id]);

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentUserId = localStorage.getItem('linkcard_user_id') || undefined;
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikesCount(prev => nextLiked ? prev + 1 : Math.max(0, prev - 1));
    await toggleCardLike(card.id, currentUserId);
  };

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentUserId = localStorage.getItem('linkcard_user_id') || undefined;
    if (!currentUserId || !card.creator_id) {
      if (onShowToast) onShowToast("Faça login para seguir o criador!", "info");
      return;
    }
    if (isFollowing) {
      await unfollowUser(currentUserId, card.creator_id);
      setIsFollowing(false);
      if (onShowToast) onShowToast(`Você deixou de seguir este criador.`, 'info');
    } else {
      await followUser(currentUserId, card.creator_id);
      setIsFollowing(true);
      if (onShowToast) onShowToast(`Agora você está seguindo este criador!`, 'success');
    }
  };

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
      <div className={`p-4 rounded-3xl border flex items-center justify-center my-3 opacity-60 select-none max-w-[calc(100vw-3rem)] sm:max-w-[340px] w-full ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-gray-100 border-gray-200'}`}>
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
  const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem('linkcard_user_id') || undefined) : undefined;
  const isSelf = !!(card.creator_id && currentUserId && card.creator_id === currentUserId);
  const resolvedCreatorPhoto = card.creatorPhoto || (card.creator_id ? localStorage.getItem('linkcard_avatar_' + card.creator_id) : null) || localStorage.getItem('linkcard_user_photo');

  return (
    <>
      <div
        className={`group relative rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col justify-between w-full max-w-[calc(100vw-3rem)] sm:max-w-[360px] mx-auto sm:mx-0 my-3 select-none ${
          isGold
            ? 'bg-[#FFFCF8] border-[#1A1712]/10 text-[#1A1712] shadow-xs hover:border-[#1A1712]/20'
            : isDark 
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
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg backdrop-blur-md text-[9px] font-black uppercase tracking-wider border ${
              isGold 
                ? 'bg-[#1A1712]/80 text-white border-white/15' 
                : 'bg-black/75 text-white border-white/10'
            }`}>
              {getIcon()}
              <span>{card.type}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Expiry Timer Badge */}
              {expiresIn !== null && expiresIn > 0 && (
                <div className="flex items-center gap-1 bg-red-600/80 text-white backdrop-blur-md px-2 py-0.5 rounded-lg text-[8px] font-black font-mono border border-red-400/40 animate-pulse">
                  <Timer size={10} />
                  <span>{formatExpiry(expiresIn)}</span>
                </div>
              )}

              {/* Status / Credit Cost Badge */}
              <div className={`px-2 py-0.5 rounded-lg backdrop-blur-md text-[9px] font-black uppercase tracking-wider border shadow-xs ${
                isUnlocked
                  ? (isGold 
                      ? 'bg-[#5B6D4A]/20 text-[#5B6D4A] border-[#5B6D4A]/30' 
                      : 'bg-emerald-500/90 text-white border-emerald-400/40')
                  : (isGold 
                      ? 'bg-[#A37B14]/15 text-[#A37B14] border-[#A37B14]/30' 
                      : 'bg-amber-500/90 text-slate-950 border-amber-300/60')
              }`}>
                {isUnlocked ? 'LIBERADO' : `${card.creditCost} CR`}
              </div>

              {/* Creator Options Toggle (if canManage) */}
              {canManage && card.id !== 'preview' && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowControls(!showControls); }}
                  className={`p-1 rounded-lg backdrop-blur-md transition-all active:scale-95 border ${
                    isGold 
                      ? 'bg-[#1A1712]/80 text-[#A37B14] border-white/15 hover:bg-[#1A1712]' 
                      : 'bg-black/75 hover:bg-black text-white border-white/15'
                  }`}
                  title="Gerenciar Card"
                >
                  <MoreVertical size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Creator Controls Dropdown */}
          {showControls && <CreatorControls />}

          {/* CREATOR/HOST PROFILE CHIP ON CARD */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between gap-2">
            <div className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg backdrop-blur-md border text-slate-200 min-w-0 max-w-[65%] ${
              isGold ? 'bg-[#1A1712]/80 border-white/15' : 'bg-black/80 border-white/20'
            }`}>
              {resolvedCreatorPhoto && !avatarImgError ? (
                <img
                  src={resolvedCreatorPhoto}
                  alt={creatorName}
                  onError={() => setAvatarImgError(true)}
                  className="w-4 h-4 rounded-full object-cover border border-white/30 shrink-0"
                />
              ) : isHostMode ? (
                <Crown size={11} className="text-[#A37B14] shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full bg-[#A37B14] flex items-center justify-center text-white font-black text-[8px] border border-white/30 shrink-0 shadow-xs">
                  {creatorName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-[9px] font-black uppercase tracking-tight truncate">
                {isHostMode ? 'HOST' : creatorName}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* BOTÃO SEGUIR CRIADOR */}
              {card.creator_id && !isSelf && (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  title={isFollowing ? `Deixar de seguir ${creatorName}` : `Seguir ${creatorName}`}
                  className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1 backdrop-blur-md border shadow-xs active:scale-95 ${
                    isFollowing
                      ? 'bg-emerald-600/90 text-white border-emerald-400/40 hover:bg-emerald-700'
                      : isGold
                      ? 'bg-[#FFFCF8]/90 text-[#1A1712] border-[#1A1712]/20 hover:bg-white'
                      : 'bg-white/95 text-slate-950 border-white/50 hover:bg-white font-bold'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <Check size={9} className="stroke-[3]" />
                      <span>Seguindo</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={9} />
                      <span>Seguir</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleCopyLink}
                title="Copiar Link da Sala Exclusiva"
                className={`p-1.5 rounded-lg backdrop-blur-md transition-all active:scale-95 flex items-center justify-center border ${
                  isGold 
                    ? 'bg-[#1A1712]/80 hover:bg-[#1A1712] text-[#A37B14] border-white/15' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/30 shadow-lg'
                }`}
              >
                <MessageSquare size={12} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* BLUR OVERLAY IF LOCKED */}
          {!isUnlocked && card.isBlur && (
            <div className={`absolute inset-0 backdrop-blur-[8px] flex flex-col items-center justify-center p-4 text-center z-[5] ${
              isGold ? 'bg-[#1A1712]/40' : 'bg-slate-950/40'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 shadow-sm ${
                isGold ? 'bg-[#FFFCF8] text-[#A37B14] border border-[#1A1712]/10' : 'bg-black/60 text-amber-400'
              }`}>
                <Lock size={18} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest drop-shadow ${
                isGold ? 'text-[#A37B14]' : 'text-white'
              }`}>
                Conteúdo Exclusivo
              </span>
            </div>
          )}
        </div>

        {/* BOTTOM INFO AREA */}
        <div className={`p-3.5 sm:p-4 flex flex-col flex-1 justify-between border-t space-y-2.5 ${
          isGold 
            ? 'bg-[#FFFCF8] border-[#1A1712]/10 text-[#1A1712]' 
            : isDark 
            ? 'bg-slate-900/90 border-white/5' 
            : 'bg-white border-gray-100'
        }`}>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${
                isGold ? 'text-[#A37B14]' : isDark ? 'text-indigo-400' : 'text-indigo-600'
              }`}>
                {card.category || 'PREMIUM'}
                {card.duration > 0 && (
                  <span className={`ml-1.5 font-semibold ${
                    isGold ? 'text-[#6E675C]' : isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    • {Math.floor(card.duration / 60)}:{(card.duration % 60).toString().padStart(2, '0')} MIN
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {/* BOTÃO CURTIR TOPO */}
                <button
                  type="button"
                  onClick={handleLikeToggle}
                  title={isLiked ? "Descurtir" : "Curtir este card"}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border transition-all active:scale-90 ${
                    isLiked
                      ? 'bg-red-500/15 border-red-500/40 text-red-500'
                      : isGold
                      ? 'bg-transparent border-[#1A1712]/10 text-[#6E675C] hover:text-red-500'
                      : (isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-red-400' : 'bg-gray-100 border-gray-200 text-slate-500 hover:text-red-500')
                  }`}
                >
                  <Heart size={11} strokeWidth={1.5} className={isLiked ? "fill-red-500 text-red-500" : ""} />
                  <span className="text-[9px] font-bold">{likesCount}</span>
                </button>
              </div>
            </div>

            <h3 className={`text-sm sm:text-base font-black leading-snug uppercase tracking-tight line-clamp-1 mb-1 ${
              isGold ? 'text-[#1A1712]' : isDark ? 'text-white' : 'text-slate-900'
            }`} title={card.title}>
              {card.title}
            </h3>

            {card.description && card.description.trim() !== '' && card.description.trim() !== 'Sem descrição.' && (
              <p className={`text-[11px] line-clamp-2 leading-relaxed font-normal ${
                isGold ? 'text-[#6E675C]' : isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {card.description}
              </p>
            )}

            {/* TAGS */}
            {card.tags && card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {card.tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-0.5 rounded-lg border text-[8px] font-bold uppercase tracking-wider ${
                      isGold 
                        ? 'bg-[#1A1712]/5 border-[#1A1712]/10 text-[#6E675C]' 
                        : isDark 
                        ? 'bg-white/5 border-white/5 text-slate-400' 
                        : 'bg-gray-100 border-gray-200 text-slate-600'
                    }`}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ACTION BUTTONS (VER / DESBLOQUEAR & CURTIR & CHAT) */}
          <div className={`flex items-center gap-2 pt-2 border-t w-full ${
            isGold ? 'border-[#1A1712]/10' : isDark ? 'border-white/5' : 'border-gray-100'
          }`}>
            <button
              onClick={handleInteraction}
              className={`flex-1 min-w-0 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 truncate ${
                isGold
                  ? 'bg-[#1A1712] hover:bg-[#2A241D] text-[#A37B14] shadow-xs'
                  : card.type === CardType.CHAT
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                  : isUnlocked
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                  : (isDark ? 'bg-white text-slate-950 hover:bg-indigo-600 hover:text-white shadow-md' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md')
              }`}
            >
              {card.type === CardType.CHAT ? (
                <>
                  <LogIn size={13} className="shrink-0" />
                  <span className="truncate">ENTRAR NA SALA</span>
                </>
              ) : isUnlocked ? (
                <>
                  <Eye size={13} className="shrink-0" />
                  <span className="truncate">VER MÍDIA</span>
                </>
              ) : (
                <>
                  <Lock size={13} className="shrink-0" />
                  <span className="truncate">DESBLOQUEAR ({card.creditCost} CR)</span>
                </>
              )}
            </button>

            {/* BOTÃO CURTIR RODAPÉ */}
            <button
              type="button"
              onClick={handleLikeToggle}
              title={isLiked ? "Descurtir" : "Curtir este card"}
              className={`shrink-0 h-10 px-2.5 rounded-xl border transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                isGold
                  ? (isLiked 
                      ? 'bg-red-500/10 border-red-500/30 text-red-500' 
                      : 'bg-transparent hover:bg-[#1A1712]/5 text-[#6E675C] border-[#1A1712]/10')
                  : (isLiked
                      ? 'bg-red-500/15 border-red-500/40 text-red-500 shadow-sm'
                      : (isDark 
                          ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 border-white/10 hover:text-red-400 shadow-sm' 
                          : 'bg-gray-100 hover:bg-gray-200 text-slate-500 border-gray-200 hover:text-red-500 shadow-sm'))
              }`}
            >
              <Heart size={16} strokeWidth={1.5} className={isLiked ? "fill-red-500 text-red-500" : ""} />
              <span className="text-[10px] font-bold">{likesCount}</span>
            </button>

            <button
              onClick={handleCopyLink}
              title="Copiar Link da Sala Exclusiva"
              className={`shrink-0 w-10 h-10 rounded-xl border transition-all flex items-center justify-center active:scale-95 ${
                isGold
                  ? 'bg-transparent hover:bg-[#1A1712]/5 text-[#6E675C] border-[#1A1712]/10'
                  : isDark 
                  ? 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border-indigo-500/30 shadow-md' 
                  : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border-indigo-200 shadow-md'
              }`}
            >
              <MessageSquare size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
      {renderFullScreenModal()}
      <ImageViewerModal
        isOpen={isZoomOpen}
        imageUrl={card.mediaUrl || card.thumbnail || null}
        title={card.title}
        onClose={() => setIsZoomOpen(false)}
      />
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
          ) : card.type === CardType.IMAGE && (card.mediaUrl || card.thumbnail) ? (
            <div 
              onClick={() => setIsZoomOpen(true)}
              className="relative group cursor-zoom-in flex items-center justify-center max-w-full max-h-full"
              title="Clique para Tela Cheia com Zoom In / Zoom Out"
            >
              <img src={card.mediaUrl || card.thumbnail} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg group-hover:scale-[1.01] transition-transform" />
              <div className="absolute bottom-4 bg-black/80 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-2 text-white text-xs font-black border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl">
                <ZoomIn size={14} className="text-indigo-400" />
                <span>Clique para Zoom In / Zoom Out</span>
              </div>
            </div>
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
