import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, X, Link2, Share2, Copy, Check, MessageCircle, ExternalLink, Sparkles } from 'lucide-react';
import { AppTheme } from '../types';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
    subMessage?: string;
    link?: string;
    duration?: number;
    shareText?: string;
    showWhatsApp?: boolean;
}

interface ToastProps {
    message: string;
    type?: ToastType;
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
    subMessage?: string;
    link?: string;
    shareText?: string;
    showWhatsApp?: boolean;
    theme?: AppTheme;
}

export const Toast: React.FC<ToastProps> = ({ 
    message, 
    type = 'success', 
    isVisible, 
    onClose, 
    duration = 3500,
    subMessage,
    link,
    shareText,
    showWhatsApp = false,
    theme
}) => {
    const [copiedAgain, setCopiedAgain] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Auto-detect Gold theme if prop not provided
    const isGold = theme === 'gold' || 
        (typeof document !== 'undefined' && (document.body.classList.contains('theme-gold') || document.documentElement.classList.contains('theme-gold'))) ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('app_theme') === 'gold');

    const effectiveDuration = link ? Math.max(duration, 6500) : duration;

    useEffect(() => {
        if (isVisible && !isHovered) {
            const timer = setTimeout(() => {
                onClose();
            }, effectiveDuration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, effectiveDuration, onClose, isHovered]);

    if (!isVisible) return null;

    const bgColors = isGold ? {
        success: 'bg-[#14120E] border-[#A37B14]/60 shadow-2xl shadow-black/80 ring-1 ring-[#A37B14]/30',
        error: 'bg-[#14120E] border-red-500/60 shadow-2xl shadow-black/80 ring-1 ring-red-500/20',
        info: 'bg-[#14120E] border-[#A37B14]/60 shadow-2xl shadow-black/80 ring-1 ring-[#A37B14]/30',
        warning: 'bg-[#14120E] border-amber-500/60 shadow-2xl shadow-black/80 ring-1 ring-amber-500/20'
    } : {
        success: 'bg-slate-900 border-emerald-500/50 shadow-emerald-950/50',
        error: 'bg-slate-900 border-red-500/50 shadow-red-950/50',
        info: 'bg-slate-900 border-indigo-500/50 shadow-indigo-950/50',
        warning: 'bg-slate-900 border-amber-500/50 shadow-amber-950/50'
    };

    const headerIconColors = isGold ? {
        success: 'text-[#E5C378] bg-[#A37B14]/20 border-[#A37B14]/40',
        error: 'text-red-400 bg-red-500/20 border-red-500/30',
        info: 'text-[#E5C378] bg-[#A37B14]/20 border-[#A37B14]/40',
        warning: 'text-amber-400 bg-amber-500/20 border-amber-500/30'
    } : {
        success: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
        error: 'text-red-400 bg-red-500/20 border-red-500/30',
        info: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30',
        warning: 'text-amber-400 bg-amber-500/20 border-amber-500/30'
    };

    const icons = {
        success: isGold ? <Sparkles size={18} className="text-[#E5C378]" /> : <CheckCircle2 size={18} className="text-emerald-400" />,
        error: <AlertCircle size={18} className="text-red-400" />,
        info: isGold ? <Sparkles size={18} className="text-[#E5C378]" /> : <AlertCircle size={18} className="text-indigo-400" />,
        warning: <AlertCircle size={18} className="text-amber-400" />
    };

    const handleCopyAgain = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!link) return;
        navigator.clipboard.writeText(link);
        setCopiedAgain(true);
        setTimeout(() => setCopiedAgain(false), 2000);
    };

    const handleWhatsAppShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!link) return;
        const textToShare = shareText || `Venha conversar e interagir comigo nesta sala: ${link}`;
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textToShare)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleNativeShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!link) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'LinkCard Chat',
                    text: shareText || 'Venha conversar e interagir comigo nesta sala!',
                    url: link
                });
            } catch (err) {
                // User cancelled or not supported
            }
        } else {
            handleWhatsAppShare(e);
        }
    };

    return (
        <div 
            className="fixed top-4 sm:top-6 left-1/2 transform -translate-x-1/2 z-[250] w-[94vw] max-w-md animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={`${bgColors[type]} p-4 sm:p-5 rounded-3xl shadow-2xl border text-white backdrop-blur-xl relative overflow-hidden ring-1 ring-white/10`}>
                {/* TOP ROW: ICON + TITLE + CLOSE */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-xl border flex items-center justify-center ${headerIconColors[type]}`}>
                            {icons[type]}
                        </div>
                        <div>
                            <h4 className={`text-sm font-black tracking-tight ${isGold ? 'text-[#FFFCF8]' : 'text-white'}`}>{message}</h4>
                            {subMessage && (
                                <p className={`text-xs font-medium mt-0.5 ${isGold ? 'text-[#D5CEBF]' : 'text-slate-300'}`}>{subMessage}</p>
                            )}
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className={`p-1 rounded-full transition-all flex-shrink-0 ${isGold ? 'text-[#8C8273] hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        title="Fechar aviso"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* LINK BOX & SHARING CALL TO ACTION (WHEN LINK IS PROVIDED) */}
                {link && (
                    <div className={`mt-3.5 pt-3 border-t space-y-3 ${isGold ? 'border-[#A37B14]/20' : 'border-white/10'}`}>
                        {/* URL Box */}
                        <div className={`flex items-center gap-2 p-2.5 rounded-2xl border group ${isGold ? 'bg-[#0F0D0A] border-[#A37B14]/30' : 'bg-black/50 border-white/10'}`}>
                            <Link2 size={15} className={`flex-shrink-0 ml-1 ${isGold ? 'text-[#A37B14]' : 'text-indigo-400'}`} />
                            <span 
                                className={`font-mono text-[11px] sm:text-xs truncate flex-1 select-all ${isGold ? 'text-[#E5C378]' : 'text-indigo-200'}`} 
                                title={link}
                            >
                                {link}
                            </span>
                            <button
                                onClick={handleCopyAgain}
                                className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 flex-shrink-0 ${
                                    copiedAgain 
                                        ? (isGold ? 'bg-gradient-to-r from-[#A37B14] to-[#C5A880] text-black font-black' : 'bg-emerald-500 text-slate-950 font-black') 
                                        : (isGold ? 'bg-[#231F19] hover:bg-[#2F2921] text-[#E5C378] border border-[#A37B14]/30' : 'bg-white/10 hover:bg-white/20 text-white')
                                }`}
                                title="Copiar endereço novamente"
                            >
                                {copiedAgain ? <Check size={12} /> : <Copy size={12} />}
                                <span>{copiedAgain ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                        </div>

                        {/* Social incentive message */}
                        <p className={`text-[11px] font-medium leading-relaxed ${isGold ? 'text-[#D5CEBF]' : 'text-slate-300'}`}>
                            🚀 <strong className={isGold ? 'text-[#E5C378]' : 'text-white'}>Compartilhe com seus amigos:</strong> Envie o link nos seus grupos ou redes sociais para conversarem e interagirem juntos em tempo real!
                        </p>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                onClick={handleCopyAgain}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 ${
                                    isGold
                                        ? 'bg-gradient-to-r from-[#8C650D] via-[#A37B14] to-[#C5A880] hover:brightness-110 text-black shadow-[#A37B14]/25 border border-[#D4AF37]/50'
                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                }`}
                            >
                                {copiedAgain ? <Check size={14} className={isGold ? 'text-black' : 'text-emerald-300'} /> : <Copy size={14} />}
                                <span>{copiedAgain ? 'Link Copiado Novamente!' : 'Copiar Link da Sala'}</span>
                            </button>

                            {showWhatsApp && (
                                <button
                                    onClick={handleWhatsAppShare}
                                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shrink-0 active:scale-95 ${
                                        isGold ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500'
                                    }`}
                                    title="Compartilhar no WhatsApp"
                                >
                                    <MessageCircle size={14} />
                                    <span>WhatsApp</span>
                                </button>
                            )}

                            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                                <button
                                    onClick={handleNativeShare}
                                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shrink-0 active:scale-95 ${
                                        isGold
                                            ? 'bg-[#231F19] hover:bg-[#2F2921] text-[#E5C378] border border-[#A37B14]/30'
                                            : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10'
                                    }`}
                                    title="Outras opções de compartilhamento"
                                >
                                    <Share2 size={14} />
                                    <span className="hidden xs:inline">Mais</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

