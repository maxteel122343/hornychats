import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Grid, Play, Camera, Phone, Mic, 
  Image as ImageIcon, MessageSquare, Loader2, X, Check, 
  Lock, Sparkles, User as UserIcon, ExternalLink, ShieldCheck,
  Volume2, Eye, Share2, Layers, QrCode, Zap, Copy, CheckCircle, RefreshCw
} from 'lucide-react';
import { User, MediaCard, CardType } from '../types';
import { supabase } from '../lib/supabase';
import { UnlockPurchaseModal } from './UnlockPurchaseModal';

interface GalleryProps {
  user: User;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  updateCredits?: (amount: number) => Promise<void> | void;
}

interface CreatorInfo {
  id: string;
  name: string;
  photo?: string;
  cardCount: number;
}

const DEMO_CARDS: MediaCard[] = [
  {
    id: 'demo_card_1',
    creator_id: 'creator_sofia_vip',
    creatorName: 'Sofia Mendes',
    creatorPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    type: CardType.VIDEO,
    title: 'Aula de Produção Audiovisual & Iluminação',
    description: 'Técnicas profissionais de iluminação e configuração de câmera para criadores de conteúdo.',
    thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop&q=80',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    creditCost: 10,
    category: 'Vídeo',
    tags: ['Cinema', 'Masterclass', 'Dicas'],
    duration: 180,
    expirySeconds: 0,
    isBlur: false,
    blurLevel: 0,
    saveToGallery: true,
    createdAt: Date.now() - 3600000,
    mediaType: 'upload'
  },
  {
    id: 'demo_card_2',
    creator_id: 'creator_sofia_vip',
    creatorName: 'Sofia Mendes',
    creatorPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    type: CardType.IMAGE,
    title: 'Presets Exclusivos Lightroom Dark Vintage',
    description: 'Pack de filtros exclusivos em alta definição para fotos de perfil e feed.',
    thumbnail: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1600&auto=format&fit=crop&q=80',
    creditCost: 5,
    category: 'Imagens',
    tags: ['Fotografia', 'Presets', 'Design'],
    duration: 0,
    expirySeconds: 0,
    isBlur: false,
    blurLevel: 0,
    saveToGallery: true,
    createdAt: Date.now() - 7200000,
    mediaType: 'upload'
  },
  {
    id: 'demo_card_3',
    creator_id: 'creator_lucas_sound',
    creatorName: 'Lucas Beats',
    creatorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    type: CardType.AUDIO,
    title: 'Podcast VIP: Bastidores do Mercado Musical',
    description: 'Áudio exclusivo com insights sobre produção musical independente e monetização.',
    thumbnail: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&auto=format&fit=crop&q=80',
    mediaUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    creditCost: 8,
    category: 'Voz',
    tags: ['Podcast', 'Música', 'Áudio'],
    duration: 120,
    expirySeconds: 0,
    isBlur: false,
    blurLevel: 0,
    saveToGallery: true,
    createdAt: Date.now() - 10800000,
    mediaType: 'upload'
  },
  {
    id: 'demo_card_4',
    creator_id: 'creator_elena_fitness',
    creatorName: 'Elena Ramos',
    creatorPhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
    type: CardType.VIDEO,
    title: 'Treino Hiit 15 Minutos Queima Intensa',
    description: 'Rotina completa sem equipamentos para fazer em casa e acelerar o metabolismo.',
    thumbnail: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop&q=80',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    creditCost: 12,
    category: 'Vídeo',
    tags: ['Fitness', 'Saúde', 'Treino'],
    duration: 300,
    expirySeconds: 0,
    isBlur: false,
    blurLevel: 0,
    saveToGallery: true,
    createdAt: Date.now() - 14400000,
    mediaType: 'upload'
  },
  {
    id: 'demo_card_5',
    creator_id: 'creator_lucas_sound',
    creatorName: 'Lucas Beats',
    creatorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    type: CardType.CHAT,
    title: 'Consultoria de Produção 1 on 1',
    description: 'Sessão direta de chat para análise de track e feedback profissional.',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
    creditCost: 15,
    category: 'Premium',
    tags: ['Consultoria', 'Chat VIP', 'Música'],
    duration: 0,
    expirySeconds: 0,
    isBlur: false,
    blurLevel: 0,
    saveToGallery: true,
    createdAt: Date.now() - 18000000,
    mediaType: 'upload'
  }
];

const Gallery: React.FC<GalleryProps> = ({ user, onShowToast, updateCredits }) => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<MediaCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Global');
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  
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

  // Load cards and profile data
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
            .select('id, username, profile_photo');

          if (profilesData) {
            profilesData.forEach((p: any) => {
              profilesMap[p.id] = {
                username: p.username || 'Criador',
                profile_photo: p.profile_photo || undefined
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
            
            const creatorName = profile?.username 
              || (creatorId === user.id ? (user.name || 'Você') : `Criador ${creatorId.substring(0, 5)}`);
            const creatorPhoto = profile?.profile_photo 
              || (creatorId === user.id ? user.profilePhoto : undefined);

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

          // Combine with demo cards so the vitrine is always rich and colorful
          const demoCardsToInclude = DEMO_CARDS.filter(
            demo => !parsedCards.some(pc => pc.id === demo.id)
          );
          setCards([...parsedCards, ...demoCardsToInclude]);
        } else {
          // If no cards in DB yet, use demo cards
          setCards(DEMO_CARDS);
        }
      } catch (err) {
        console.error('Error fetching gallery:', err);
        setCards(DEMO_CARDS);
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

  const handleOpenCreatorChat = (creatorId: string, creatorName?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const name = creatorName || 'Criador';
    if (onShowToast) {
      onShowToast(`Entrando no chat de ${name}...`, 'info');
    }
    navigate(`/chat/${creatorId}`);
  };

  const handleToggleCreatorFilter = (creatorId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (selectedCreatorId === creatorId) {
      setSelectedCreatorId(null);
      if (onShowToast) onShowToast('Mostrando cards de todos os criadores.', 'info');
    } else {
      setSelectedCreatorId(creatorId);
      const creator = creators.find(c => c.id === creatorId);
      if (onShowToast) {
        onShowToast(`Filtrando apenas mídias de ${creator?.name || 'este criador'}.`, 'info');
      }
    }
  };

  const handleUnlockCard = (card: MediaCard) => {
    const isOwner = card.creator_id === user.id;
    if (isOwner || unlockedCardIds.has(card.id) || card.creditCost === 0) {
      setActivePreviewCard(card);
      return;
    }

    // OPEN PAYMENT MODAL FOR EXCLUSIVE CONTENT
    setSelectedPurchaseCard(card);
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
            await supabase.rpc('process_card_purchase', {
              p_card_id: card.id,
              p_buyer_id: user.id,
              p_creator_id: card.creator_id,
              p_amount: cost,
              p_earnings: earnings
            });

            await supabase.from('sales_transactions').insert([{
              seller_id: card.creator_id,
              buyer_id: user.id,
              buyer_name: user.name,
              card_id: card.id,
              card_title: card.title,
              amount: earnings,
              is_free: false
            }]);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 animate-in fade-in duration-500 pb-28">
      {/* HEADER */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-5 mb-6 md:mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            title="Voltar ao início"
            className="p-3 md:p-4 bg-white/5 rounded-2xl md:rounded-3xl hover:bg-white/10 hover:border-indigo-500/30 transition-all border border-white/10 text-white shadow-xl flex-shrink-0 active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase leading-none text-white flex items-center gap-2">
                Vitrine de Criadores
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-black tracking-wider uppercase">
                {cards.length} Mídias
              </span>
            </div>
            <p className="text-[9px] md:text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1.5">
              <Sparkles size={12} className="text-amber-400" />
              Toque na foto para ver mídias do criador ou no ícone de chat para conversar
            </p>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar título, criador ou tag..."
              className="w-full pl-11 pr-9 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* CREATORS BAR (CARROSSEL DE CRIADORES) */}
      <section className="max-w-6xl mx-auto mb-6 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-md">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <UserIcon size={12} className="text-indigo-400" /> Criadores em Destaque
          </span>
          {selectedCreatorId && (
            <button
              onClick={() => setSelectedCreatorId(null)}
              className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider flex items-center gap-1"
            >
              <X size={12} /> Mostrar Todos
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide no-scrollbar -mx-2 px-2">
          {/* "Todos" button */}
          <button
            onClick={() => setSelectedCreatorId(null)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex-shrink-0 border ${
              selectedCreatorId === null
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10'
            }`}
          >
            <Layers size={14} />
            <span>Todos ({cards.length})</span>
          </button>

          {/* Creators items */}
          {creators.map((creator) => {
            const isSelected = selectedCreatorId === creator.id;
            return (
              <div
                key={creator.id}
                className={`flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-2xl transition-all flex-shrink-0 border select-none group ${
                  isSelected
                    ? 'bg-indigo-950/80 border-indigo-500 text-white ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-900/30'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                {/* Creator Avatar (Click filters vitrine) */}
                <button
                  onClick={(e) => handleToggleCreatorFilter(creator.id, e)}
                  title={`Filtrar apenas mídias de ${creator.name}`}
                  className="relative cursor-pointer focus:outline-none"
                >
                  {creator.photo ? (
                    <img
                      src={creator.photo}
                      alt={creator.name}
                      className="w-8 h-8 rounded-full object-cover border-2 border-indigo-400/50 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xs border border-white/20">
                      {creator.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
                  )}
                </button>

                {/* Creator Name & Card count */}
                <button
                  onClick={(e) => handleToggleCreatorFilter(creator.id, e)}
                  className="text-left focus:outline-none"
                  title={`Filtrar apenas mídias de ${creator.name}`}
                >
                  <p className="text-[11px] font-black truncate max-w-[100px] leading-tight">
                    {creator.name}
                  </p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                    {creator.cardCount} {creator.cardCount === 1 ? 'mídia' : 'mídias'}
                  </p>
                </button>

                {/* Direct Chat Button for this Creator */}
                <button
                  onClick={(e) => handleOpenCreatorChat(creator.id, creator.name, e)}
                  title={`Entrar no Chat de ${creator.name}`}
                  className="p-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white transition-all shadow-md hover:scale-110 active:scale-95 focus:outline-none"
                >
                  <MessageSquare size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ACTIVE CREATOR FILTER BANNER */}
      {selectedCreator && (
        <section className="max-w-6xl mx-auto mb-6 p-4 md:p-5 rounded-3xl bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-purple-950/80 border border-indigo-500/40 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-4">
            <div className="relative">
              {selectedCreator.photo ? (
                <img
                  src={selectedCreator.photo}
                  alt={selectedCreator.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-400 shadow-xl"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl border-2 border-indigo-400 shadow-xl">
                  {selectedCreator.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1 rounded-full text-white border-2 border-slate-900">
                <Check size={10} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  Filtro de Criador Ativo
                </span>
              </div>
              <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">
                Mídias de {selectedCreator.name}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Exibindo apenas os {filteredCards.length} cards exclusivos deste criador
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleOpenCreatorChat(selectedCreator.id, selectedCreator.name)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-indigo-600/30 active:scale-95"
            >
              <MessageSquare size={16} />
              <span>Abrir Chat da Sala</span>
            </button>

            <button
              onClick={() => setSelectedCreatorId(null)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs uppercase tracking-wider transition-all border border-white/10 active:scale-95"
            >
              <X size={15} />
              <span>Ver Todos</span>
            </button>
          </div>
        </section>
      )}

      {/* CATEGORY TABS */}
      <nav className="max-w-6xl mx-auto mb-8 flex items-center justify-between overflow-x-auto pb-2 scrollbar-hide no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-2 flex-nowrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] transition-all flex-shrink-0 border ${
                selectedCategory === cat
                  ? 'bg-white text-slate-950 border-white shadow-xl font-black'
                  : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
          {filteredCards.length} {filteredCards.length === 1 ? 'card encontrado' : 'cards encontrados'}
        </div>
      </nav>

      {/* CARDS GRID */}
      <main className="max-w-6xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center space-y-4">
            <Loader2 className="animate-spin text-indigo-500" size={36} />
            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
              Carregando vitrine e criadores...
            </span>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center opacity-70 py-24 border-2 border-dashed border-white/10 rounded-[3rem] text-center space-y-5 px-6 bg-slate-900/20">
            <div className="p-6 bg-white/5 rounded-3xl text-slate-400">
              <Grid size={36} />
            </div>
            <div>
              <p className="text-xl font-black uppercase tracking-tight text-white">Nenhum card encontrado</p>
              <p className="text-xs font-medium text-slate-400 mt-1 max-w-sm">
                {selectedCreatorId
                  ? 'Este criador ainda não possui cards nesta categoria.'
                  : 'Tente alterar a categoria ou o termo da busca.'}
              </p>
            </div>
            {selectedCreatorId && (
              <button
                onClick={() => setSelectedCreatorId(null)}
                className="px-6 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider hover:bg-indigo-500 transition-all shadow-lg"
              >
                Limpar Filtro de Criador
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {filteredCards.map((card) => {
              const isUnlocked = card.creator_id === user.id || unlockedCardIds.has(card.id) || card.creditCost === 0;
              const creatorId = card.creator_id || 'creator_unknown';
              const creatorName = card.creatorName || 'Criador';
              const isFilteredThisCreator = selectedCreatorId === creatorId;

              return (
                <div
                  key={card.id}
                  className="group relative rounded-[2rem] overflow-hidden border border-white/10 hover:border-indigo-500/60 transition-all duration-300 shadow-2xl bg-slate-900/70 backdrop-blur-md flex flex-col justify-between"
                >
                  {/* TOP THUMBNAIL AREA */}
                  <div className="aspect-[4/5] overflow-hidden relative bg-black/40">
                    <img
                      src={card.thumbnail || card.mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'}
                      alt={card.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-[0.75]"
                    />

                    {/* TOP BADGES & CONTROLS */}
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 z-10">
                      {/* Media Type Badge */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md text-white border border-white/10 text-[10px] font-black uppercase tracking-wider">
                        {getIcon(card.type)}
                        <span>{card.type}</span>
                      </div>

                      {/* Credit Cost Badge */}
                      <div className={`px-3 py-1.5 rounded-xl backdrop-blur-md text-[10px] font-black uppercase tracking-wider border shadow-md ${
                        isUnlocked
                          ? 'bg-emerald-500/80 text-white border-emerald-400/40'
                          : 'bg-amber-500/90 text-slate-950 border-amber-300/60'
                      }`}>
                        {isUnlocked ? 'LIBERADO' : `${card.creditCost} CR`}
                      </div>
                    </div>

                    {/* CREATOR PROFILE CHIP ON CARD */}
                    <div className="absolute top-16 left-4 right-4 z-10 flex items-center justify-between gap-2">
                      {/* Clicking avatar or name filters the vitrine to this creator */}
                      <button
                        onClick={(e) => handleToggleCreatorFilter(creatorId, e)}
                        title={`Ver apenas mídias de ${creatorName}`}
                        className={`flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-2xl backdrop-blur-md border transition-all text-left group/creator ${
                          isFilteredThisCreator
                            ? 'bg-indigo-600/90 border-indigo-400 text-white shadow-lg'
                            : 'bg-black/75 hover:bg-black/90 border-white/15 text-slate-200 hover:border-indigo-400/50'
                        }`}
                      >
                        {card.creatorPhoto ? (
                          <img
                            src={card.creatorPhoto}
                            alt={creatorName}
                            className="w-6 h-6 rounded-full object-cover border border-white/30 group-hover/creator:scale-110 transition-transform"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-[10px] border border-white/30">
                            {creatorName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[10px] font-black uppercase tracking-tight truncate max-w-[90px]">
                          {creatorName}
                        </span>
                      </button>

                      {/* DIRECT CHAT BUTTON ON CARD */}
                      <button
                        onClick={(e) => handleOpenCreatorChat(creatorId, creatorName, e)}
                        title={`Entrar no Chat de ${creatorName}`}
                        className="p-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 backdrop-blur-md transition-all shadow-lg hover:scale-110 active:scale-95 flex items-center justify-center"
                      >
                        <MessageSquare size={14} />
                      </button>
                    </div>

                    {/* BLUR OVERLAY IF LOCKED */}
                    {!isUnlocked && card.isBlur && (
                      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[6px] flex flex-col items-center justify-center p-4 text-center z-[5]">
                        <Lock size={28} className="text-amber-400 mb-2 drop-shadow-md" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white drop-shadow">
                          Conteúdo Exclusivo
                        </span>
                      </div>
                    )}
                  </div>

                  {/* BOTTOM INFO AREA */}
                  <div className="p-5 flex flex-col flex-1 justify-between bg-slate-900/90 border-t border-white/5 space-y-4">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                          {card.category}
                        </span>
                        {card.duration > 0 && (
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            {Math.floor(card.duration / 60)}:{(card.duration % 60).toString().padStart(2, '0')} min
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-black text-white leading-snug uppercase tracking-tight line-clamp-1 mb-1.5" title={card.title}>
                        {card.title}
                      </h3>

                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed font-medium">
                        {card.description || 'Sem descrição.'}
                      </p>

                      {/* TAGS */}
                      {card.tags && card.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {card.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[8px] font-bold text-slate-400 uppercase tracking-wider"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ACTION BUTTONS (DESBLOQUEAR / VER & CHAT) */}
                    <div className="grid grid-cols-5 gap-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => handleUnlockCard(card)}
                        className={`col-span-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 ${
                          isUnlocked
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-white text-slate-950 hover:bg-indigo-600 hover:text-white'
                        }`}
                      >
                        {isUnlocked ? (
                          <>
                            <Eye size={14} />
                            <span>VER MÍDIA</span>
                          </>
                        ) : (
                          <>
                            <Lock size={14} />
                            <span>DESBLOQUEAR ({card.creditCost} CR)</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={(e) => handleOpenCreatorChat(creatorId, creatorName, e)}
                        title={`Entrar no Chat de ${creatorName}`}
                        className="col-span-1 py-3 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 transition-all flex items-center justify-center shadow-lg active:scale-95"
                      >
                        <MessageSquare size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MEDIA PREVIEW / UNLOCK MODAL */}
      {activePreviewCard && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative p-6 md:p-8 animate-in zoom-in-95 duration-200 flex flex-col justify-between">
            {/* Close Button */}
            <button
              onClick={() => setActivePreviewCard(null)}
              className="absolute top-6 right-6 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-20"
            >
              <X size={18} />
            </button>

            {/* Creator Header Inside Modal */}
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                {activePreviewCard.creatorPhoto ? (
                  <img
                    src={activePreviewCard.creatorPhoto}
                    alt={activePreviewCard.creatorName || 'Criador'}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-indigo-500"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-base border-2 border-indigo-500">
                    {(activePreviewCard.creatorName || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="text-base font-black text-white uppercase tracking-tight">
                    {activePreviewCard.creatorName || 'Criador'}
                  </h4>
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
                    Autor do Card
                  </span>
                </div>
              </div>

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
                <span>Chat do Criador</span>
              </button>
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
                <img
                  src={activePreviewCard.mediaUrl || activePreviewCard.thumbnail}
                  alt={activePreviewCard.title}
                  className="w-full max-h-[380px] object-contain"
                />
              ) : (
                <div className="p-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 mx-auto">
                    {getIcon(activePreviewCard.type)}
                  </div>
                  <p className="text-sm font-black text-white uppercase tracking-tight">
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
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                    {activePreviewCard.category}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {new Date(activePreviewCard.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  {activePreviewCard.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mt-2">
                  {activePreviewCard.description || 'Sem descrição.'}
                </p>
              </div>

              {activePreviewCard.tags && activePreviewCard.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {activePreviewCard.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold text-slate-300 uppercase tracking-wider"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* BOTTOM ACTIONS */}
            <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  const creatorId = activePreviewCard.creator_id || 'creator_unknown';
                  handleToggleCreatorFilter(creatorId);
                  setActivePreviewCard(null);
                }}
                className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all border border-white/10"
              >
                Ver todas mídias deste criador
              </button>

              <button
                onClick={() => setActivePreviewCard(null)}
                className="px-6 py-3 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all shadow-xl"
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
        />
      )}

      {/* PIX RECHARGE MODAL FOR GALLERY */}
      {showQrCode && (
        <div className="fixed inset-0 z-[850] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl relative text-center">
            <button 
              onClick={() => setShowQrCode(false)} 
              className="absolute top-6 right-6 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-all"
            >
              <X size={20} />
            </button>

            {!activePayment ? (
              <>
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                  <QrCode size={32} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Recarregar Créditos</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Escolha um pacote e pague via PIX</p>

                <div className="space-y-3">
                  {[5, 10, 20].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleGeneratePix(amount)}
                      disabled={isGeneratingPix}
                      className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center justify-between group"
                    >
                      <div className="flex flex-col items-start bg-transparent">
                        <span className="text-white font-black text-lg">R$ {amount},00</span>
                        <span className="text-[10px] text-slate-500 uppercase font-bold group-hover:text-emerald-400">
                          {amount === 5 ? '50 créditos' : amount === 10 ? '120 créditos (+20%)' : '300 créditos (+50%)'}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center group-hover:bg-emerald-500 transition-all">
                        <Zap size={16} className="text-slate-400 group-hover:text-white" />
                      </div>
                    </button>
                  ))}
                </div>
                {isGeneratingPix && <div className="mt-4 text-emerald-500 font-bold text-xs uppercase animate-pulse">Gerando QR Code...</div>}
              </>
            ) : (
              <>
                <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-6">Pagamento PIX</h3>
                <div className="bg-white p-4 rounded-2xl mb-6 mx-auto w-64 h-64 flex items-center justify-center">
                  {activePayment.qr_code_base64 ? (
                    <img src={`data:image/png;base64,${activePayment.qr_code_base64}`} className="w-full h-full object-contain" alt="QR Code PIX" />
                  ) : (
                    <div className="w-full h-full bg-slate-200 animate-pulse rounded-xl flex items-center justify-center text-slate-500 text-xs font-bold">
                      QR Code PIX
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={handleCopyPix} 
                    className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                  >
                    {copySuccess ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    {copySuccess ? 'Copia Cola Copiado!' : 'Copiar Código PIX'}
                  </button>
                  <button 
                    onClick={handleCheckStatus} 
                    disabled={isCheckingStatus} 
                    className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"
                  >
                    {isCheckingStatus ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Verificar Pagamento
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
