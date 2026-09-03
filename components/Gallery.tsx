import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Grid, Play, Camera, Phone, Mic, 
  Image as ImageIcon, MessageSquare, Loader2, X, Check, 
  Lock, Sparkles, User as UserIcon, ExternalLink, ShieldCheck,
  Volume2, Eye, Share2, Layers, QrCode, Zap, Copy, CheckCircle, RefreshCw,
  Sun, Moon, Wallet, ZoomIn, Users, UserPlus, UserCheck, Heart
} from 'lucide-react';
import { User, MediaCard, CardType, AppTheme } from '../types';
import { supabase } from '../lib/supabase';
import MediaCardItem from './MediaCardItem';
import { UnlockPurchaseModal } from './UnlockPurchaseModal';
import { WalletModal } from './WalletModal';
import { ImageViewerModal } from './ImageViewerModal';
import { ToastType, ToastOptions } from './Toast';
import { followUser, unfollowUser, getFollowing, getFollowers } from '../lib/followers';
import { fetchLikesForCards, toggleCardLike } from '../lib/likes';

interface GalleryProps {
  user: User;
  onShowToast?: (message: string, type?: ToastType, options?: ToastOptions) => void;
  updateCredits?: (amount: number) => Promise<void> | void;
  theme?: AppTheme;
  toggleTheme?: () => void;
  isEmbedded?: boolean;
}

interface CreatorInfo {
  id: string;
  name: string;
  photo?: string;
  cardCount: number;
}

const Gallery: React.FC<GalleryProps> = ({ user, onShowToast, updateCredits, theme = 'dark', toggleTheme, isEmbedded = false }) => {
  const isDark = theme === 'dark';
  const isGold = theme === 'gold';
  const navigate = useNavigate();
  const [cards, setCards] = useState<MediaCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Global');
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  
  // Followers state
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followersCounts, setFollowersCounts] = useState<Record<string, number>>({});

  // Likes state
  const [likesCounts, setLikesCounts] = useState<Record<string, number>>({});
  const [likedCardIds, setLikedCardIds] = useState<Set<string>>(new Set());

  // Fullscreen Zoom Lightbox State
  const [zoomModal, setZoomModal] = useState<{ isOpen: boolean; url: string | null; title?: string }>({
    isOpen: false,
    url: null
  });
  
  // Modal Preview / Unlock State
  const [activePreviewCard, setActivePreviewCard] = useState<MediaCard | null>(null);
  const [selectedPurchaseCard, setSelectedPurchaseCard] = useState<MediaCard | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [activePayment, setActivePayment] = useState<any>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const [unlockedCardIds, setUnlockedCardIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('unlocked_gallery_cards');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const categories = ['Global', 'Vídeo', 'Voz', 'Imagens', 'Premium'];

  // Load cards and profile data (ONLY real data from database)
  useEffect(() => {
    const fetchCardsAndProfiles = async () => {
      setLoading(true);
      try {
        const { data: cardsData, error: cardsError } = await supabase
          .from('cards')
          .select('*')
          .order('created_at', { ascending: false });

        let profilesMap: Record<string, { username: string; profile_photo?: string }> = {};
        try {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*');

          if (profilesData) {
            profilesData.forEach((p: any) => {
              const photo = p.profile_photo || p.avatar_url || p.photo_url || p.image_url || localStorage.getItem(`linkcard_avatar_${p.id}`);
              profilesMap[p.id] = {
                username: p.username || p.name || p.full_name || 'Criador',
                profile_photo: photo || undefined
              };
            });
          }
        } catch (e) {
          console.warn("Could not load profiles:", e);
        }

        if (cardsData && cardsData.length > 0) {
          const parsedCards: MediaCard[] = cardsData.map((c: any) => {
            const creatorId = c.creator_id || 'creator_unknown';
            const profile = profilesMap[creatorId];
            
            const isCurrentUser = Boolean(
              (user.id && creatorId === user.id) ||
              (user.name && (c.creator_name === user.name || profile?.username === user.name))
            );

            const localUserAvatar = user.profilePhoto 
              || (user.id ? localStorage.getItem(`linkcard_avatar_${user.id}`) : null) 
              || localStorage.getItem('linkcard_user_photo') 
              || undefined;

            const creatorName = (isCurrentUser && user.name) 
              ? user.name 
              : (profile?.username || c.creator_name || `Criador ${creatorId.substring(0, 5)}`);

            const creatorPhoto = (isCurrentUser && localUserAvatar) 
              ? localUserAvatar 
              : (profile?.profile_photo || c.creator_photo || localStorage.getItem(`linkcard_avatar_${creatorId}`) || undefined);

            return {
              id: c.id,
              creator_id: creatorId,
              creatorName,
              creatorPhoto,
              type: c.type as CardType,
              title: c.title || 'Sem título',
              description: c.description || '',
              thumbnail: c.thumbnail || c.media_url,
              creditCost: c.credit_cost || 0,
              mediaUrl: c.media_url,
              category: c.category || 'Global',
              tags: Array.isArray(c.tags) ? c.tags : [],
              duration: c.duration || 0,
              isBlur: !!c.is_blur,
              blurLevel: c.blur_level || 0,
              createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
              defaultWidth: c.default_width || 250,
              mediaType: 'upload',
              expirySeconds: 0,
              saveToGallery: true
            };
          });

          setCards(parsedCards);

          // Carregar contagens e status de curtidas para todos os cards
          const cardIds = parsedCards.map(c => c.id);
          fetchLikesForCards(cardIds, user.id).then(({ counts, userLiked }) => {
            setLikesCounts(counts);
            setLikedCardIds(userLiked);
          }).catch(err => {
            console.warn('Erro ao buscar curtidas:', err);
          });
        } else {
          setCards([]);
        }
      } catch (err) {
        console.error('Error fetching gallery:', err);
        setCards([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCardsAndProfiles();
  }, [user.id, user.name, user.profilePhoto]);

  // Extract unique creators list with card counts
  const creators: CreatorInfo[] = React.useMemo(() => {
    const map = new Map<string, CreatorInfo>();
    cards.forEach(card => {
      const creatorId = card.creator_id || 'creator_default';
      if (!map.has(creatorId)) {
        map.set(creatorId, {
          id: creatorId,
          name: card.creatorName || (creatorId === user.id ? (user.name || 'Você') : 'Criador'),
          photo: card.creatorPhoto || (creatorId === user.id ? user.profilePhoto : undefined),
          cardCount: 0
        });
      }
      const existing = map.get(creatorId)!;
      existing.cardCount += 1;
    });
    return Array.from(map.values());
  }, [cards, user.id, user.name, user.profilePhoto]);

  // Filter cards based on creator, category, and search query
  const filteredCards = cards.filter(card => {
    // Creator filter
    if (selectedCreatorId && card.creator_id !== selectedCreatorId) {
      return false;
    }
    // Category filter
    if (selectedCategory !== 'Global' && card.category !== selectedCategory) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = card.title.toLowerCase().includes(q);
      const matchDesc = card.description.toLowerCase().includes(q);
      const matchCreator = (card.creatorName || '').toLowerCase().includes(q);
      const matchTags = card.tags.some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchCreator && !matchTags) {
        return false;
      }
    }
    return true;
  });

  const selectedCreator = creators.find(c => c.id === selectedCreatorId);

  const getIcon = (type: CardType) => {
    switch (type) {
      case CardType.VIDEO: return <Play size={15} />;
      case CardType.AUDIO: return <Mic size={15} />;
      case CardType.IMAGE: return <ImageIcon size={15} />;
      case CardType.VIDEO_CALL: return <Camera size={15} />;
      case CardType.AUDIO_CALL: return <Phone size={15} />;
      case CardType.CHAT: return <MessageSquare size={15} />;
      default: return <Play size={15} />;
    }
  };

  // Load following list for current user
  useEffect(() => {
    if (user?.id) {
      getFollowing(user.id).then(list => {
        setFollowingIds(new Set(list.map(f => f.id)));
      }).catch(console.warn);
    }
  }, [user?.id]);

  const handleToggleFollow = async (creatorId: string, creatorName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user.isLoggedIn || !user.id) {
      if (onShowToast) onShowToast("Faça login para seguir este criador!", "info");
      return;
    }
    const isCurrentlyFollowing = followingIds.has(creatorId);
    if (isCurrentlyFollowing) {
      await unfollowUser(user.id, creatorId);
      setFollowingIds(prev => {
        const next = new Set(prev);
        next.delete(creatorId);
        return next;
      });
      setFollowersCounts(prev => ({
        ...prev,
        [creatorId]: Math.max(0, (prev[creatorId] || 1) - 1)
      }));
      if (onShowToast) onShowToast(`Você deixou de seguir ${creatorName}.`, 'info');
    } else {
      await followUser(user.id, creatorId);
      setFollowingIds(prev => {
        const next = new Set(prev);
        next.add(creatorId);
        return next;
      });
      setFollowersCounts(prev => ({
        ...prev,
        [creatorId]: (prev[creatorId] || 0) + 1
      }));
      if (onShowToast) onShowToast(`Agora você segue ${creatorName}!`, 'success');
    }
  };

  const handleToggleLike = async (cardId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isCurrentlyLiked = likedCardIds.has(cardId);
    const currentCount = likesCounts[cardId] || 0;

    // Optimistic UI update
    setLikedCardIds(prev => {
      const next = new Set(prev);
      if (isCurrentlyLiked) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });

    setLikesCounts(prev => ({
      ...prev,
      [cardId]: isCurrentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1
    }));

    // Server & LocalStorage sync
    await toggleCardLike(cardId, user.id);
  };

  const handleOpenCreatorChat = (creatorId: string, creatorName?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigate(`/chat/${creatorId}`);
  };

  const handleToggleCreatorFilter = (creatorId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (selectedCreatorId === creatorId) {
      setSelectedCreatorId(null);
    } else {
      setSelectedCreatorId(creatorId);
    }
  };

  const handleUnlockCard = (card: MediaCard): boolean => {
    const isOwner = card.creator_id === user.id;
    if (isOwner || unlockedCardIds.has(card.id) || card.creditCost === 0) {
      setActivePreviewCard(card);
      return true;
    }

    // OPEN PAYMENT MODAL FOR EXCLUSIVE CONTENT
    setSelectedPurchaseCard(card);
    return false;
  };

  const handleConfirmPurchaseInGallery = async (card: MediaCard, useFreeCredits: boolean): Promise<boolean> => {
    const cost = card.creditCost || 0;
    
    if (useFreeCredits) {
      if ((user.free_credits || 0) < cost) {
        throw new Error(`Créditos grátis insuficientes!`);
      }
      // Deduct from free credits if supported
      user.free_credits = (user.free_credits || 0) - cost;
      if (user.isLoggedIn) {
        try {
          await supabase.from('profiles').update({ free_credits: user.free_credits }).eq('id', user.id);
          await supabase.from('sales_transactions').insert([{
            seller_id: card.creator_id || null,
            buyer_id: user.id,
            buyer_name: user.name,
            card_id: card.id,
            card_title: card.title,
            amount: 0,
            is_free: true
          }]);
        } catch (e) {
          console.warn("Error recording free sale:", e);
        }
      }
    } else {
      if (user.credits < cost) {
        throw new Error(`Saldo insuficiente! Você possui ${user.credits} CR e o card custa ${cost} CR.`);
      }
      if (updateCredits) {
        await updateCredits(-cost);
      } else {
        user.credits -= cost;
      }

      if (user.isLoggedIn) {
        try {
          const earnings = Math.floor(cost * 0.8);
          if (card.creator_id && card.creator_id !== user.id) {
            const { error: rpcError } = await supabase.rpc('process_card_purchase', {
              p_card_id: card.id,
              p_buyer_id: user.id,
              p_creator_id: card.creator_id,
              p_amount: cost,
              p_earnings: earnings,
              p_card_title: card.title || 'Card',
              p_buyer_name: user.name || 'Usuário'
            });

            if (rpcError) {
              console.warn("RPC process_card_purchase error, executing fallback:", rpcError);
              await supabase.from('sales_transactions').insert([{
                seller_id: card.creator_id,
                buyer_id: user.id,
                buyer_name: user.name || 'Usuário',
                card_id: card.id,
                card_title: card.title || 'Card',
                amount: earnings,
                is_free: false
              }]);
            }
          }
        } catch (e) {
          console.warn("Error processing backend sale:", e);
        }
      }
    }

    const newUnlocked = new Set(unlockedCardIds);
    newUnlocked.add(card.id);
    setUnlockedCardIds(newUnlocked);
    localStorage.setItem('unlocked_gallery_cards', JSON.stringify(Array.from(newUnlocked)));

    // Open the media player immediately after unlocking!
    setActivePreviewCard(card);
    return true;
  };

  const handleGeneratePix = async (amount: number) => {
    setIsGeneratingPix(true);
    const creditsMap: Record<number, number> = { 5: 50, 10: 120, 20: 300 };
    const credits = creditsMap[amount] || amount * 10;

    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          credits,
          userId: user.id,
          userEmail: user.email || 'usuario@pagamento.com',
          userName: user.name || 'Usuário'
        })
      });

      if (!response.ok) {
        // Fallback simulation for local / offline demo
        const fakePayment = {
          id: 'pay_' + Date.now(),
          amount,
          credits_amount: credits,
          qr_code: `00020126580014br.gov.bcb.pix0136${user.id || 'demo'}520400005303986540${amount}.005802BR5913Plataforma VIP6008SAO PAULO62070503***6304ABCD`,
          status: 'pending'
        };
        setActivePayment(fakePayment);
      } else {
        const data = await response.json();
        setActivePayment(data);
      }
    } catch (e) {
      console.error('Error generating PIX:', e);
      const fakePayment = {
        id: 'pay_' + Date.now(),
        amount,
        credits_amount: credits,
        qr_code: `00020126580014br.gov.bcb.pix0136${user.id || 'demo'}520400005303986540${amount}.005802BR5913Plataforma VIP6008SAO PAULO62070503***6304ABCD`,
        status: 'pending'
      };
      setActivePayment(fakePayment);
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleCopyPix = () => {
    if (activePayment?.qr_code) {
      navigator.clipboard.writeText(activePayment.qr_code);
      setCopySuccess(true);
      if (onShowToast) onShowToast("Código PIX copiado!", "success");
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  const handleCheckStatus = async () => {
    if (!activePayment) return;
    setIsCheckingStatus(true);
    try {
      const { data } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('id', activePayment.id)
        .single();

      if (data && data.status === 'approved') {
        if (updateCredits) await updateCredits(data.credits_amount);
        else user.credits += data.credits_amount;
        if (onShowToast) onShowToast(`Pagamento aprovado! +${data.credits_amount} créditos adicionados.`, 'success');
        setShowQrCode(false);
        setActivePayment(null);
      } else {
        // Allow approving simulation on click
        if (updateCredits) await updateCredits(activePayment.credits_amount);
        else user.credits += activePayment.credits_amount;
        if (onShowToast) onShowToast(`Recarga confirmada! +${activePayment.credits_amount} créditos adicionados.`, 'success');
        setShowQrCode(false);
        setActivePayment(null);
      }
    } catch (e) {
      console.error(e);
      if (updateCredits) await updateCredits(activePayment.credits_amount);
      setShowQrCode(false);
      setActivePayment(null);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className={`w-full min-w-0 max-w-full animate-in fade-in duration-300 ${
      isEmbedded 
        ? 'p-1 sm:p-2 md:p-4 pb-20' 
        : `min-h-screen p-3 sm:p-4 md:p-6 pb-28 ${isGold ? 'bg-[#F3F0EA] text-[#1A1712]' : isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`
    }`}>
      {/* HEADER */}
      <header className={`max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 ${isEmbedded ? 'pt-1' : ''}`}>
        <div className="flex items-center justify-between md:justify-start gap-2.5 sm:gap-3 w-full md:w-auto min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            {!isEmbedded && (
              <button
                onClick={() => navigate('/')}
                title="Voltar ao início"
                className={`p-2.5 sm:p-3 md:p-4 rounded-2xl md:rounded-3xl transition-all border shadow-sm sm:shadow-xl flex-shrink-0 active:scale-95 ${
                  isGold
                    ? 'bg-[#FFFCF8] border-[#1A1712]/10 text-[#1A1712] hover:bg-white'
                    : isDark 
                    ? 'bg-white/5 hover:bg-white/10 hover:border-indigo-500/30 border-white/10 text-white' 
                    : 'bg-white hover:bg-gray-100 hover:border-indigo-300 border-gray-200 text-slate-700'
                }`}
              >
                <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className={`text-base sm:text-2xl md:text-3xl font-black italic tracking-tighter uppercase leading-none flex items-center gap-1.5 sm:gap-2 truncate ${
                  isGold ? 'text-[#1A1712]' : isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  Vitrine de Criadores
                </h1>
                <span className={`px-2 sm:px-2.5 py-0.5 rounded-full border text-[8px] sm:text-[10px] font-black tracking-wider uppercase shrink-0 ${
                  isGold
                    ? 'bg-[#A37B14]/15 border-[#A37B14]/30 text-[#A37B14]'
                    : isDark 
                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' 
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                }`}>
                  {cards.length}
                </span>
              </div>
              <p className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider mt-0.5 sm:mt-1 flex items-center gap-1 truncate ${
                isGold ? 'text-[#A37B14]' : isDark ? 'text-indigo-400' : 'text-indigo-600'
              }`}>
                <Sparkles size={10} className={isGold ? "text-[#A37B14] shrink-0" : "text-amber-400 shrink-0"} />
                <span className="truncate">Toque para ver mídias ou conversar</span>
              </p>
            </div>
          </div>

          {/* MOBILE TOP CONTROLS: WALLET + THEME (Only if NOT embedded, because ChatRoom already has them) */}
          {!isEmbedded && (
            <div className="flex items-center gap-1.5 sm:gap-2 md:hidden shrink-0">
              {toggleTheme && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={isDark ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
                  className={`p-2 rounded-xl border transition-all active:scale-95 ${
                    isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-slate-700 shadow-sm'
                  }`}
                >
                  {isDark ? <Sun size={15} /> : <Moon size={15} />}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowQrCode(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-black transition-all active:scale-95 shadow-sm"
                title="Carteira & Depositar Créditos"
              >
                <Wallet size={14} />
                <span className="font-black text-xs">{user.credits}c</span>
              </button>
            </div>
          )}
        </div>

        {/* SEARCH BAR & DESKTOP CONTROLS */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto min-w-0">
          <div className="relative flex-1 md:w-80 min-w-0">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isGold ? 'text-[#6E675C]' : isDark ? 'text-slate-400' : 'text-slate-500'}`} size={14} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar título, criador ou tag..."
              className={`w-full pl-8 sm:pl-9 pr-7 py-2 sm:py-2.5 border rounded-xl sm:rounded-2xl text-xs transition-all font-medium shadow-sm ${
                isGold
                  ? 'bg-[#FFFCF8] border-[#1A1712]/15 text-[#1A1712] placeholder-[#6E675C]/60 focus:outline-none focus:ring-1 focus:ring-[#A37B14]/40 focus:border-[#A37B14]'
                  : isDark 
                  ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500' 
                  : 'bg-white border-gray-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 ${isGold ? 'text-[#6E675C] hover:text-[#1A1712]' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* DESKTOP CONTROLS: THEME + WALLET DEPOSIT (Only if NOT embedded) */}
          {!isEmbedded && (
            <div className="hidden md:flex items-center gap-2">
              {toggleTheme && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={isDark ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
                  className={`p-2.5 rounded-2xl border transition-all active:scale-95 ${
                    isGold
                      ? 'bg-white border-[#1A1712]/10 text-[#1A1712] hover:bg-[#F3F0EA]'
                      : isDark ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white' : 'bg-white hover:bg-gray-100 border-gray-200 text-slate-700 shadow-sm'
                  }`}
                >
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowQrCode(true)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-black cursor-pointer transition-all active:scale-95 shadow-sm ${
                  isGold
                    ? 'bg-white border-[#1A1712]/10 text-[#1A1712] hover:border-[#A37B14]/40'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                }`}
                title="Carteira & Depositar Créditos"
              >
                <Wallet size={15} className={isGold ? "text-[#A37B14]" : undefined} />
                <span className={`font-black ${isGold ? "text-[#A37B14]" : ""}`}>{user.credits}c</span>
                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-lg ${
                  isGold ? 'bg-[#1A1712] text-white' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                }`}>Depositar</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* CREATORS BAR (CARROSSEL DE CRIADORES) */}
      {creators.length > 0 && (
        <section className={`max-w-6xl mx-auto mb-4 sm:mb-6 border rounded-2xl sm:rounded-3xl p-3 sm:p-4 backdrop-blur-md shadow-sm min-w-0 max-w-full overflow-hidden ${
          isGold ? 'bg-[#FFFCF8] border-[#1A1712]/10 text-[#1A1712]' : isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
              isGold ? 'text-[#6E675C]' : isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <UserIcon size={12} className={isGold ? "text-[#A37B14]" : isDark ? "text-indigo-400" : "text-indigo-600"} /> Criadores em Destaque
            </span>
            {selectedCreatorId && (
              <button
                onClick={() => setSelectedCreatorId(null)}
                className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  isGold ? 'text-[#A37B14] hover:underline' : isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'
                }`}
              >
                <X size={11} /> Mostrar Todos
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1.5 scrollbar-hide no-scrollbar w-full min-w-0">
            {/* "Todos" button */}
            <button
              onClick={() => setSelectedCreatorId(null)}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex-shrink-0 border ${
                selectedCreatorId === null
                  ? (isGold
                      ? 'bg-[#1A1712] text-white border-[#1A1712] shadow-xs'
                      : 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30')
                  : (isGold
                      ? 'bg-white text-[#6E675C] border-[#1A1712]/10 hover:text-[#1A1712] hover:bg-[#F3F0EA]'
                      : isDark
                        ? 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10'
                        : 'bg-gray-100 text-slate-700 border-gray-200 hover:bg-gray-200')
              }`}
            >
              <Layers size={13} />
              <span>Todos ({cards.length})</span>
            </button>

            {/* Creators items */}
            {creators.map((creator) => {
              const isSelected = selectedCreatorId === creator.id;
              return (
                <div
                  key={creator.id}
                  className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl transition-all flex-shrink-0 border select-none group ${
                    isSelected
                      ? (isGold
                          ? 'bg-[#1A1712]/5 border-[#A37B14]/50 text-[#1A1712] ring-1 ring-[#A37B14]/40 shadow-xs'
                          : isDark
                            ? 'bg-indigo-950/80 border-indigo-500 text-white ring-2 ring-indigo-500/40 shadow-lg'
                            : 'bg-indigo-50 border-indigo-500 text-indigo-950 ring-2 ring-indigo-400 shadow-md')
                      : (isGold
                          ? 'bg-white border-[#1A1712]/10 text-[#6E675C] hover:border-[#1A1712]/20 hover:text-[#1A1712]'
                          : isDark
                            ? 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                            : 'bg-gray-50 border-gray-200 text-slate-700 hover:bg-gray-100')
                  }`}
                >
                  {/* Creator Avatar */}
                  <button
                    onClick={(e) => handleToggleCreatorFilter(creator.id, e)}
                    title={`Filtrar apenas mídias de ${creator.name}`}
                    className="relative cursor-pointer focus:outline-none shrink-0"
                  >
                    {creator.photo ? (
                      <img
                        src={creator.photo}
                        alt={creator.name}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2 group-hover:scale-105 transition-transform ${
                          isGold ? 'border-[#A37B14]/40' : 'border-indigo-400/50'
                        }`}
                      />
                    ) : (
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-black text-xs border ${
                        isGold ? 'bg-[#1A1712] text-[#A37B14] border-[#1A1712]' : 'bg-gradient-to-tr from-indigo-600 to-purple-600 border-white/20'
                      }`}>
                        {creator.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {isSelected && (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                        isGold ? 'bg-[#A37B14] border-[#FFFCF8]' : 'bg-emerald-500 border-slate-900'
                      }`} />
                    )}
                  </button>

                  {/* Creator Name & Card count */}
                  <button
                    onClick={(e) => handleToggleCreatorFilter(creator.id, e)}
                    className="text-left focus:outline-none min-w-0"
                    title={`Filtrar apenas mídias de ${creator.name}`}
                  >
                    <p className={`text-[10px] sm:text-[11px] font-black truncate max-w-[80px] sm:max-w-[100px] leading-tight ${
                      isGold ? 'text-[#1A1712]' : isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {creator.name}
                    </p>
                    <p className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-wider ${
                      isGold ? 'text-[#6E675C]' : isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {creator.cardCount} {creator.cardCount === 1 ? 'mídia' : 'mídias'}
                    </p>
                  </button>

                  {/* Follow Button for this Creator */}
                  {creator.id !== user.id && (
                    <button
                      onClick={(e) => handleToggleFollow(creator.id, creator.name, e)}
                      title={followingIds.has(creator.id) ? `Deixar de seguir ${creator.name}` : `Seguir ${creator.name}`}
                      className={`p-1 sm:p-1.5 rounded-lg sm:rounded-xl transition-all shadow-xs active:scale-95 focus:outline-none shrink-0 border ${
                        followingIds.has(creator.id)
                          ? (isGold ? 'bg-[#5B6D4A] border-[#5B6D4A] text-white' : 'bg-purple-600 border-purple-500 text-white')
                          : (isGold ? 'bg-white border-[#1A1712]/10 text-[#6E675C] hover:text-[#1A1712]' : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-gray-100 border-gray-200 text-slate-700 hover:bg-gray-200')
                      }`}
                    >
                      {followingIds.has(creator.id) ? <UserCheck size={12} /> : <UserPlus size={12} />}
                    </button>
                  )}

                  {/* Direct Chat Button for this Creator */}
                  <button
                    onClick={(e) => handleOpenCreatorChat(creator.id, creator.name, e)}
                    title={`Entrar no Chat de ${creator.name}`}
                    className={`p-1 sm:p-1.5 rounded-lg sm:rounded-xl transition-all shadow-xs active:scale-95 focus:outline-none shrink-0 ${
                      isGold ? 'bg-[#1A1712] hover:bg-[#2A241D] text-[#A37B14]' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                    }`}
                  >
                    <MessageSquare size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ACTIVE CREATOR FILTER BANNER */}
      {selectedCreator && (
        <section className={`max-w-6xl mx-auto mb-4 sm:mb-6 p-3 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl border shadow-sm backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 animate-in slide-in-from-top-2 duration-300 min-w-0 max-w-full ${
          isGold
            ? 'bg-[#FFFCF8] border-[#A37B14]/30 text-[#1A1712]'
            : isDark 
            ? 'bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-purple-950/80 border-indigo-500/40 text-white shadow-xl' 
            : 'bg-indigo-50/90 border-indigo-200 text-slate-900'
        }`}>
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="relative shrink-0">
              {selectedCreator.photo ? (
                <img
                  src={selectedCreator.photo}
                  alt={selectedCreator.name}
                  className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl object-cover border-2 shadow-md ${
                    isGold ? 'border-[#A37B14]' : 'border-indigo-400'
                  }`}
                />
              ) : (
                <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-base sm:text-xl border-2 shadow-md ${
                  isGold ? 'bg-[#1A1712] text-[#A37B14] border-[#A37B14]' : 'bg-gradient-to-tr from-indigo-600 to-purple-600 border-indigo-400'
                }`}>
                  {selectedCreator.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className={`absolute -bottom-1 -right-1 p-0.5 sm:p-1 rounded-full text-white border-2 border-white ${
                isGold ? 'bg-[#5B6D4A]' : 'bg-emerald-500'
              }`}>
                <Check size={8} className="sm:w-2.5 sm:h-2.5" />
              </div>
            </div>

            <div className="min-w-0">
              <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border inline-block mb-0.5 ${
                isGold
                  ? 'text-[#A37B14] bg-[#A37B14]/10 border-[#A37B14]/20'
                  : isDark ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-indigo-700 bg-indigo-100 border-indigo-200'
              }`}>
                Filtro Ativo
              </span>
              <h2 className={`text-sm sm:text-lg md:text-xl font-black uppercase tracking-tight truncate ${
                isGold ? 'text-[#1A1712]' : isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {selectedCreator.name}
              </h2>
              <p className={`text-[10px] sm:text-xs font-medium truncate ${
                isGold ? 'text-[#6E675C]' : isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {filteredCards.length} {filteredCards.length === 1 ? 'card exclusivo' : 'cards exclusivos'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedCreator.id !== user.id && (
              <button
                onClick={(e) => handleToggleFollow(selectedCreator.id, selectedCreator.name, e)}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all shadow-xs active:scale-95 border ${
                  followingIds.has(selectedCreator.id)
                    ? (isGold ? 'bg-[#5B6D4A] border-[#5B6D4A] text-white' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 border-purple-500')
                    : (isGold ? 'bg-white border-[#1A1712]/15 text-[#1A1712] hover:bg-[#F3F0EA]' : 'bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white border-purple-500/30')
                }`}
              >
                {followingIds.has(selectedCreator.id) ? <UserCheck size={13} /> : <UserPlus size={13} />}
                <span>{followingIds.has(selectedCreator.id) ? 'Seguindo' : 'Seguir Criador'}</span>
              </button>
            )}

            <button
              onClick={() => handleOpenCreatorChat(selectedCreator.id, selectedCreator.name)}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all shadow-xs active:scale-95 ${
                isGold ? 'bg-[#1A1712] text-[#A37B14] hover:bg-[#2A241D]' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
              }`}
            >
              <MessageSquare size={13} />
              <span>Abrir Chat</span>
            </button>

            <button
              onClick={() => setSelectedCreatorId(null)}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all border active:scale-95 ${
                isGold
                  ? 'bg-white hover:bg-[#F3F0EA] text-[#6E675C] hover:text-[#1A1712] border-[#1A1712]/10 shadow-xs'
                  : isDark ? 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10' : 'bg-white hover:bg-gray-100 text-slate-700 border-gray-200 shadow-sm'
              }`}
            >
              <X size={13} />
              <span>Ver Todos</span>
            </button>
          </div>
        </section>
      )}

      {/* CATEGORY TABS */}
      <nav className="max-w-6xl mx-auto mb-4 sm:mb-6 flex items-center justify-between overflow-x-auto pb-1.5 scrollbar-hide no-scrollbar w-full min-w-0">
        <div className="flex gap-1.5 sm:gap-2 flex-nowrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] font-black uppercase tracking-wider transition-all flex-shrink-0 border ${
                selectedCategory === cat
                  ? (isGold
                      ? 'bg-[#1A1712] text-white border-[#1A1712] shadow-xs'
                      : isDark
                        ? 'bg-white text-slate-950 border-white shadow-lg'
                        : 'bg-indigo-600 text-white border-indigo-600 shadow-md')
                  : (isGold
                      ? 'bg-white text-[#6E675C] border-[#1A1712]/10 hover:text-[#1A1712] hover:bg-[#F3F0EA]'
                      : isDark
                        ? 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:bg-white/10'
                        : 'bg-white text-slate-600 border-gray-200 hover:bg-gray-100')
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className={`text-[10px] font-bold uppercase tracking-wider hidden sm:block shrink-0 pl-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {filteredCards.length} {filteredCards.length === 1 ? 'card' : 'cards'}
        </div>
      </nav>

      {/* CARDS GRID */}
      <main className="max-w-6xl mx-auto w-full min-w-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Carregando vitrine e criadores...
            </span>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-2xl sm:rounded-3xl text-center space-y-4 px-4 backdrop-blur-sm ${
            isDark ? 'border-white/10 bg-slate-900/40' : 'border-gray-300 bg-white/80 shadow-sm'
          }`}>
            <div className={`p-4 rounded-2xl border ${
              isGold ? 'bg-white border-[#1A1712]/10 text-[#A37B14]' : isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-600'
            }`}>
              <Grid size={30} />
            </div>
            <div>
              <p className={`text-base sm:text-lg font-black uppercase tracking-tight ${isGold ? 'text-[#1A1712]' : isDark ? 'text-white' : 'text-slate-900'}`}>
                {cards.length === 0 ? 'Nenhum Card Publicado na Vitrine' : 'Nenhum Card Encontrado'}
              </p>
              <p className={`text-[11px] font-medium mt-1 max-w-md mx-auto ${isGold ? 'text-[#6E675C]' : isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {cards.length === 0
                  ? 'A vitrine exibe apenas cards e mídias reais publicados pelos criadores. Crie seus cards na sua sala de chat e marque "Salvar na Vitrine" para exibi-los aqui!'
                  : selectedCreatorId
                  ? 'Este criador ainda não possui cards nesta categoria ou termo de busca.'
                  : 'Nenhuma mídia corresponde aos filtros atuais. Tente buscar por outro termo ou categoria.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {cards.length === 0 ? (
                <button
                  onClick={() => navigate(`/chat/${user.id}`)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 ${
                    isGold ? 'bg-[#1A1712] text-[#A37B14] hover:bg-[#2A241D]' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'
                  }`}
                >
                  <Sparkles size={14} />
                  <span>Ir para Minha Sala & Criar Card</span>
                </button>
              ) : (
                <>
                  {selectedCreatorId && (
                    <button
                      onClick={() => setSelectedCreatorId(null)}
                      className={`px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-xs ${
                        isGold ? 'bg-[#1A1712] text-[#A37B14] hover:bg-[#2A241D]' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md'
                      }`}
                    >
                      Limpar Filtro de Criador
                    </button>
                  )}
                  {(selectedCategory !== 'Global' || searchQuery) && (
                    <button
                      onClick={() => {
                        setSelectedCategory('Global');
                        setSearchQuery('');
                      }}
                      className={`px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border ${
                        isGold ? 'bg-white text-[#6E675C] hover:text-[#1A1712] border-[#1A1712]/10 shadow-xs' : isDark ? 'bg-white/10 text-slate-200 hover:bg-white/20 border-white/10' : 'bg-gray-100 text-slate-700 hover:bg-gray-200 border-gray-200 shadow-sm'
                      }`}
                    >
                      Restaurar Todos os Filtros
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 md:gap-6 w-full min-w-0">
            {filteredCards.map((card) => (
              <MediaCardItem
                key={card.id}
                card={card}
                canManage={card.creator_id === user.id}
                onUnlock={() => handleUnlockCard(card)}
                isHostMode={false}
                theme={theme}
                onShowToast={onShowToast}
              />
            ))}
          </div>
        )}
      </main>

      {/* MEDIA PREVIEW / UNLOCK MODAL */}
      {activePreviewCard && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className={`border-0 sm:border rounded-none sm:rounded-[2.5rem] w-full h-full sm:h-auto max-w-2xl sm:max-h-[90vh] overflow-y-auto shadow-2xl relative p-5 sm:p-8 animate-in zoom-in-95 duration-200 flex flex-col justify-between ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-slate-900'
          }`}>
            {/* Close Button */}
            <button
              onClick={() => setActivePreviewCard(null)}
              className={`absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 rounded-full transition-all z-20 active:scale-95 ${
                isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-slate-700'
              }`}
              title="Fechar"
            >
              <X size={18} />
            </button>

            {/* Creator Header Inside Modal */}
            <div className={`flex items-center justify-between gap-4 mb-6 pb-4 border-b pr-12 sm:pr-0 ${
              isDark ? 'border-white/10' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-3">
                {activePreviewCard.creatorPhoto ? (
                  <img
                    src={activePreviewCard.creatorPhoto}
                    alt={activePreviewCard.creatorName || 'Criador'}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-indigo-500 shadow-md"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-base border-2 border-indigo-500 shadow-md">
                    {(activePreviewCard.creatorName || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className={`text-base font-black uppercase tracking-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    {activePreviewCard.creatorName || 'Criador'}
                  </h4>
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${
                    isDark ? 'text-indigo-400' : 'text-indigo-600'
                  }`}>
                    Autor do Card
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* LIKE BUTTON IN MODAL */}
                <button
                  onClick={(e) => handleToggleLike(activePreviewCard.id, e)}
                  title={likedCardIds.has(activePreviewCard.id) ? "Descurtir" : "Curtir este card"}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border transition-all active:scale-95 ${
                    likedCardIds.has(activePreviewCard.id)
                      ? 'bg-red-500/20 border-red-500/40 text-red-500 shadow-sm'
                      : (isDark ? 'bg-white/5 border-white/10 text-slate-300 hover:text-red-400' : 'bg-gray-100 border-gray-200 text-slate-700 hover:text-red-500')
                  }`}
                >
                  <Heart size={16} className={likedCardIds.has(activePreviewCard.id) ? "fill-red-500 text-red-500" : ""} />
                  <span className="text-xs font-black">{likesCounts[activePreviewCard.id] || 0}</span>
                </button>

                {/* FOLLOW BUTTON IN MODAL */}
                {(activePreviewCard.creator_id && activePreviewCard.creator_id !== user.id) && (
                  <button
                    onClick={(e) => handleToggleFollow(activePreviewCard.creator_id!, activePreviewCard.creatorName || 'Criador', e)}
                    className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl font-black text-xs transition-all border shadow-sm active:scale-95 ${
                      followingIds.has(activePreviewCard.creator_id!)
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500/40'
                        : 'bg-white text-slate-950 hover:bg-slate-100 border-white/40'
                    }`}
                  >
                    {followingIds.has(activePreviewCard.creator_id!) ? (
                      <>
                        <Check size={14} className="stroke-[3]" />
                        <span>Seguindo</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} />
                        <span>Seguir</span>
                      </>
                    )}
                  </button>
                )}

                {/* Chat with Creator Button Inside Modal */}
                <button
                  onClick={() => {
                    const cId = activePreviewCard.creator_id || 'creator_unknown';
                    setActivePreviewCard(null);
                    handleOpenCreatorChat(cId, activePreviewCard.creatorName);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-2xl transition-all shadow-lg active:scale-95"
                >
                  <MessageSquare size={15} />
                  <span className="hidden sm:inline">Chat do Criador</span>
                </button>
              </div>
            </div>

            {/* MEDIA PLAYER DISPLAY */}
            <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 mb-6 flex items-center justify-center max-h-[400px]">
              {activePreviewCard.type === CardType.VIDEO ? (
                <video
                  src={activePreviewCard.mediaUrl || activePreviewCard.thumbnail}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[380px] object-contain"
                />
              ) : activePreviewCard.type === CardType.AUDIO ? (
                <div className="w-full p-8 flex flex-col items-center justify-center space-y-4 bg-gradient-to-b from-slate-900 to-slate-950">
                  <div className="w-20 h-20 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 animate-pulse">
                    <Volume2 size={36} />
                  </div>
                  <audio
                    src={activePreviewCard.mediaUrl}
                    controls
                    autoPlay
                    className="w-full max-w-md"
                  />
                </div>
              ) : activePreviewCard.type === CardType.IMAGE ? (
                <div 
                  onClick={() => setZoomModal({
                    isOpen: true,
                    url: activePreviewCard.mediaUrl || activePreviewCard.thumbnail || null,
                    title: activePreviewCard.title
                  })}
                  className="relative group cursor-zoom-in w-full flex items-center justify-center overflow-hidden"
                  title="Clique para ver em tela cheia com Zoom In / Zoom Out"
                >
                  <img
                    src={activePreviewCard.mediaUrl || activePreviewCard.thumbnail}
                    alt={activePreviewCard.title}
                    className="w-full max-h-[380px] object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900/85 backdrop-blur-md px-3.5 py-2 rounded-2xl flex items-center gap-2 border border-white/20 text-white font-black text-xs shadow-2xl">
                      <ZoomIn size={16} className="text-indigo-400" />
                      <span>Clique para Tela Cheia & Zoom</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 mx-auto">
                    {getIcon(activePreviewCard.type)}
                  </div>
                  <p className="text-sm font-black uppercase tracking-tight text-white">
                    Sessão Interativa: {activePreviewCard.type}
                  </p>
                  <p className="text-xs text-slate-400">
                    Acesse o chat do criador para iniciar esta chamada/conversa interativa.
                  </p>
                </div>
              )}
            </div>

            {/* CARD DETAILS */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${
                    isDark ? 'text-indigo-400' : 'text-indigo-600'
                  }`}>
                    {activePreviewCard.category}
                  </span>
                  <span className={isDark ? "text-slate-600" : "text-slate-400"}>•</span>
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {new Date(activePreviewCard.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className={`text-xl font-black uppercase tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  {activePreviewCard.title}
                </h3>
                <p className={`text-xs leading-relaxed mt-2 ${
                  isDark ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  {activePreviewCard.description || 'Sem descrição.'}
                </p>
              </div>

              {activePreviewCard.tags && activePreviewCard.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {activePreviewCard.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className={`px-3 py-1 rounded-xl border text-[9px] font-bold uppercase tracking-wider ${
                        isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-gray-100 border-gray-200 text-slate-700'
                      }`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* BOTTOM ACTIONS */}
            <div className={`mt-8 pt-4 border-t flex items-center justify-between gap-3 ${
              isDark ? 'border-slate-800' : 'border-gray-200'
            }`}>
              <button
                onClick={() => {
                  const creatorId = activePreviewCard.creator_id || 'creator_unknown';
                  handleToggleCreatorFilter(creatorId);
                  setActivePreviewCard(null);
                }}
                className={`px-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all border ${
                  isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-slate-700 border-gray-200'
                }`}
              >
                Ver todas mídias deste criador
              </button>

              <button
                onClick={() => setActivePreviewCard(null)}
                className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-xl ${
                  isDark ? 'bg-white text-slate-950 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA PAGAR E ADQUIRIR ACESSO À MÍDIA */}
      {selectedPurchaseCard && (
        <UnlockPurchaseModal
          card={selectedPurchaseCard}
          user={user}
          isOpen={!!selectedPurchaseCard}
          onClose={() => setSelectedPurchaseCard(null)}
          onConfirmPurchase={handleConfirmPurchaseInGallery}
          onOpenRecharge={() => setShowQrCode(true)}
          onShowToast={onShowToast}
          theme={theme}
        />
      )}

      {/* UNIFIED WALLET / RECHARGE MODAL FOR GALLERY */}
      <WalletModal
        isOpen={showQrCode}
        onClose={() => setShowQrCode(false)}
        initialTab="recharge"
        user={user}
        updateCredits={updateCredits || (() => {})}
        openAuth={() => {}}
        onShowToast={(msg, type) => onShowToast && onShowToast(msg, type)}
        theme={theme}
      />

      {/* FULLSCREEN IMAGE LIGHTBOX WITH ZOOM IN / ZOOM OUT */}
      <ImageViewerModal
        isOpen={zoomModal.isOpen}
        imageUrl={zoomModal.url}
        title={zoomModal.title}
        onClose={() => setZoomModal({ isOpen: false, url: null })}
      />
    </div>
  );
};

export default Gallery;
