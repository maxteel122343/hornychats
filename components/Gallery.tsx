
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Filter, Grid, List as ListIcon, Play, Camera, Phone, Mic, Image as ImageIcon, MessageSquare, Loader2 } from 'lucide-react';
import { User, MediaCard, CardType } from '../types';
import { supabase } from '../lib/supabase';

interface GalleryProps {
  user: User;
}

const Gallery: React.FC<GalleryProps> = ({ user }) => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<MediaCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setCards(data.map(c => ({
          id: c.id,
          type: c.type as CardType,
          title: c.title,
          description: c.description,
          thumbnail: c.thumbnail,
          creditCost: c.credit_cost,
          mediaUrl: c.media_url,
          category: c.category,
          tags: c.tags,
          duration: c.duration,
          isBlur: c.is_blur,
          blurLevel: c.blur_level,
          createdAt: new Date(c.created_at).getTime(),
          defaultWidth: c.default_width,
          mediaType: 'none',
          expirySeconds: 0,
          saveToGallery: true
        })));
      }
      setLoading(false);
    };

    fetchCards();
  }, []);

  const getIcon = (type: CardType) => {
    switch (type) {
      case CardType.VIDEO: return <Play size={16} />;
      case CardType.AUDIO: return <Mic size={16} />;
      case CardType.IMAGE: return <ImageIcon size={16} />;
      case CardType.VIDEO_CALL: return <Camera size={16} />;
      case CardType.AUDIO_CALL: return <Phone size={16} />;
      case CardType.CHAT: return <MessageSquare size={16} />;
      default: return <Play size={16} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6 animate-in fade-in duration-500 pb-24">
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 mb-8 md:mb-16">
        <div className="flex items-center gap-4 md:gap-8">
          <button
            onClick={() => navigate('/')}
            className="p-3 md:p-5 bg-white/5 rounded-2xl md:rounded-3xl hover:bg-white/10 transition-all border border-white/5 text-white shadow-xl flex-shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase leading-none text-white">Marketplace / Vitrine</h1>
            <p className="text-[8px] md:text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] md:tracking-[0.4em] mt-2 md:mt-3">Cards e conteúdo exclusivo</p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-96">
            <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              placeholder="Pesquisar..."
              className="w-full pl-11 md:pl-14 pr-6 py-3.5 md:py-5 bg-white/5 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] text-xs md:text-sm focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-bold tracking-tight"
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 md:mb-10 overflow-x-auto pb-2 scrollbar-hide no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 md:gap-3 flex-nowrap">
            {['Global', 'Voz', 'Vídeo', 'Imagens', 'Premium'].map(cat => (
              <button
                key={cat}
                className={`px-5 md:px-7 py-2 md:py-3 rounded-lg md:rounded-2xl text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] transition-all flex-shrink-0 ${cat === 'Global' ? 'bg-indigo-600 text-white shadow-lg md:shadow-2xl shadow-indigo-600/30' : 'bg-white/5 text-slate-500 hover:text-white'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 md:py-40">
            <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">Sincronizando...</span>
          </div>
        ) : cards.length === 0 ? (
          <div className="mt-10 md:mt-20 flex flex-col items-center justify-center opacity-40 py-20 md:py-32 border-2 border-dashed border-white/5 rounded-[2.5rem] md:rounded-[4rem] text-center space-y-6 px-6">
            <div className="p-6 md:p-8 bg-white/5 rounded-[2.5rem] md:rounded-[3rem]">
              <Grid size={32} className="text-slate-600" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">Nada por aqui ainda</p>
              <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-500">Crie cards persistentes para aparecerem aqui.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-10">
            {cards.map((card) => (
              <div key={card.id} className="group relative rounded-[2.5rem] md:rounded-[3rem] overflow-hidden glass border-white/5 hover:border-indigo-500/50 transition-all shadow-2xl bg-slate-900/40">
                <div className="aspect-[4/5] overflow-hidden relative">
                  <img
                    src={card.thumbnail}
                    alt={card.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s] brightness-[0.6]"
                  />
                  <div className="absolute top-4 md:top-6 left-4 md:left-6 p-2 md:p-3 rounded-xl md:rounded-2xl bg-black/60 backdrop-blur-md text-white border border-white/10">
                    {getIcon(card.type)}
                  </div>
                  <div className="absolute top-4 md:top-6 right-4 md:right-6 px-3 md:px-4 py-1.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-tighter">
                    {card.creditCost}c
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-10 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
                  <div className="flex items-center gap-2 mb-2 md:mb-3">
                    <span className="text-[8px] md:text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] md:tracking-[0.3em]">{card.category}</span>
                  </div>
                  <h3 className="text-lg md:text-xl font-black text-white mb-2 md:mb-3 leading-tight uppercase tracking-tighter truncate">{card.title}</h3>
                  <p className="text-[9px] md:text-[10px] text-slate-500 line-clamp-2 leading-relaxed font-bold mb-6 md:mb-8 uppercase tracking-tight">
                    {card.description}
                  </p>
                  <button className="w-full py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] bg-white text-slate-950 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] hover:bg-indigo-600 hover:text-white transition-all transform group-hover:-translate-y-1 shadow-xl active:scale-95">
                    DESBLOQUEAR
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Gallery;
