import React, { useState, useEffect } from 'react';
import { X, Save, Settings, Info } from 'lucide-react';
import { CardDefaults } from '../types';

interface QuickSettingsModalProps {
    onClose: () => void;
    onSave: (defaults: CardDefaults) => void;
    initialDefaults: CardDefaults;
}

export const QuickSettingsModal: React.FC<QuickSettingsModalProps> = ({ onClose, onSave, initialDefaults }) => {
    const [data, setData] = useState<CardDefaults>(initialDefaults);
    const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');

    const handleChange = (field: keyof CardDefaults, value: any) => {
        setData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 border-0 sm:border border-slate-800 p-5 sm:p-8 rounded-none sm:rounded-[2.5rem] w-full h-full sm:h-auto max-w-2xl shadow-2xl relative max-h-full sm:max-h-[90vh] overflow-y-auto scrollbar-hide">
                <button onClick={onClose} className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-all">
                    <X size={20} />
                </button>

                <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 bg-emerald-500/20 rounded-full text-emerald-500">
                        <Settings size={32} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Configuração Padrão</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Defina os valores padrão para o Modo Rápido</p>
                    </div>
                </div>

                <div className="flex gap-4 mb-8 border-b border-slate-800 pb-1">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`pb-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'general' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-white'}`}
                    >
                        Geral
                    </button>
                    <button
                        onClick={() => setActiveTab('advanced')}
                        className={`pb-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'advanced' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-white'}`}
                    >
                        Avançado & Custos
                    </button>
                </div>

                <div className="space-y-6">
                    {activeTab === 'general' ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Título Padrão</label>
                                    <input
                                        type="text"
                                        value={data.title}
                                        onChange={(e) => handleChange('title', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoria</label>
                                    <input
                                        type="text"
                                        value={data.category}
                                        onChange={(e) => handleChange('category', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição Padrão</label>
                                <textarea
                                    value={data.description}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold min-h-[100px]"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tags (separadas por vírgula)</label>
                                <input
                                    type="text"
                                    value={data.tags}
                                    onChange={(e) => handleChange('tags', e.target.value)}
                                    placeholder="ex: viral, urgente, promo"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Custo em Créditos</label>
                                    <input
                                        type="number"
                                        value={data.creditCost}
                                        onChange={(e) => handleChange('creditCost', parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Duração (Segundos)</label>
                                    <input
                                        type="number"
                                        value={data.duration}
                                        onChange={(e) => handleChange('duration', parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Repetição (Minutos)</label>
                                    <input
                                        type="number"
                                        value={data.repeatInterval}
                                        onChange={(e) => handleChange('repeatInterval', parseInt(e.target.value) || 0)}
                                        placeholder="0 para não repetir"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Auto Delete (Segundos)</label>
                                    <input
                                        type="number"
                                        value={data.expirySeconds}
                                        onChange={(e) => handleChange('expirySeconds', parseInt(e.target.value) || 0)}
                                        placeholder="0 para nunca apagar"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                                    />
                                </div>
                            </div>

                            <div className="p-6 bg-slate-800/50 rounded-3xl border border-slate-800">
                                <div className="flex justify-between mb-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nível de Blur Padrão</label>
                                    <span className="text-white font-black text-xs">{data.blurLevel}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="20"
                                    value={data.blurLevel}
                                    onChange={(e) => handleChange('blurLevel', parseInt(e.target.value))}
                                    className="w-full accent-emerald-500"
                                />
                                <p className="text-[9px] text-slate-500 mt-2">Define o desfoque inicial para quem não comprou.</p>
                            </div>
                        </>
                    )}

                    <div className="pt-6 border-t border-slate-800 flex justify-end">
                        <button
                            onClick={() => onSave(data)}
                            className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-xl flex items-center gap-2"
                        >
                            <Save size={18} />
                            Salvar Padrões
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
