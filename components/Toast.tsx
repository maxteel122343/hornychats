import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type?: ToastType;
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', isVisible, onClose, duration = 3000 }) => {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, duration, onClose]);

    if (!isVisible) return null;

    const bgColors = {
        success: 'bg-emerald-600',
        error: 'bg-red-600',
        info: 'bg-blue-600'
    };

    const icons = {
        success: <CheckCircle2 size={20} className="text-white" />,
        error: <AlertCircle size={20} className="text-white" />,
        info: <AlertCircle size={20} className="text-white" />
    };

    return (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-5 duration-300">
            <div className={`${bgColors[type]} px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[300px] border border-white/10`}>
                {icons[type]}
                <span className="text-white font-bold text-sm flex-1">{message}</span>
                <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-all">
                    <X size={16} className="text-white" />
                </button>
            </div>
        </div>
    );
};
