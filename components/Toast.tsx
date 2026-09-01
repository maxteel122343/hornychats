import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, X, Link2, Share2, Copy, Check, MessageCircle, ExternalLink } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
    subMessage?: string;
    link?: string;
    duration?: number;
    shareText?: string;
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
}

export const Toast: React.FC<ToastProps> = ({ 
    message, 
    type = 'success', 
    isVisible, 
    onClose, 
    duration = 3500,
    subMessage,
    link,
    shareText
}) => {
    const [copiedAgain, setCopiedAgain] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

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

    const bgColors = {
        success: 'bg-slate-900 border-emerald-500/50 shadow-emerald-950/50',
        error: 'bg-slate-900 border-red-500/50 shadow-red-950/50',
        info: 'bg-slate-900 border-indigo-500/50 shadow-indigo-950/50'
    };

    const headerIconColors = {
        success: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
        error: 'text-red-400 bg-red-500/20 border-red-500/30',
        info: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30'
    };

    const icons = {
        success: <CheckCircle2 size={18} className="text-emerald-400" />,
        error: <AlertCircle size={18} className="text-red-400" />,
        info: <AlertCircle size={18} className="text-indigo-400" />
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
                            <h4 className="text-sm font-black tracking-tight text-white">{message}</h4>
                            {subMessage && (
                                <p className="text-xs text-slate-300 font-medium mt-0.5">{subMessage}</p>
                            )}
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all flex-shrink-0"
                        title="Fechar aviso"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* LINK BOX & SHARING CALL TO ACTION (WHEN LINK IS PROVIDED) */}
                {link && (
                    <div className="mt-3.5 pt-3 border-t border-white/10 space-y-3">
                        {/* URL Box */}
                        <div className="flex items-center gap-2 p-2.5 bg-black/50 rounded-2xl border border-white/10 group">
                            <Link2 size={15} className="text-indigo-400 flex-shrink-0 ml-1" />
                            <span 
                                className="font-mono text-[11px] sm:text-xs text-indigo-200 truncate flex-1 select-all" 
                                title={link}
                            >
                                {link}
                            </span>
                            <button
                                onClick={handleCopyAgain}
                                className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 flex-shrink-0 ${
                                    copiedAgain 
                                        ? 'bg-emerald-500 text-slate-950 font-black' 
                                        : 'bg-white/10 hover:bg-white/20 text-white'
                                }`}
                                title="Copiar endereço novamente"
                            >
                                {copiedAgain ? <Check size={12} /> : <Copy size={12} />}
                                <span>{copiedAgain ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                        </div>

                        {/* Social incentive message */}
                        <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                            🚀 <strong className="text-white">Compartilhe com seus amigos:</strong> Envie o link nos seus grupos ou redes sociais para conversarem e interagirem juntos em tempo real!
                        </p>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                onClick={handleWhatsAppShare}
                                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
                            >
                                <MessageCircle size={14} />
                                <span>Enviar no WhatsApp</span>
                            </button>
                            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
                                <button
                                    onClick={handleNativeShare}
                                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
                                    title="Outras opções de compartilhamento"
                                >
                                    <Share2 size={14} />
                                    <span className="hidden xs:inline">Mais</span>
                                </button>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

