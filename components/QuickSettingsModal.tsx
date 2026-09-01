import React, { useState } from 'react';
import { X, Save, Settings, Layers, Palette, Eye, Sliders, Timer, Zap, Tag, DollarSign, FolderOpen, ArrowLeft } from 'lucide-react';
import { CardDefaults } from '../types';

interface QuickSettingsModalProps {
  onClose: () => void;
  onSave: (defaults: CardDefaults) => void;
  initialDefaults: CardDefaults;
}

const CARD_COLORS = [
  '#0f172a', // Navy (Default)
  '#1e1b4b', // Indigo
  '#4c0519', // Rose
  '#022c22', // Emerald
  '#451a03', // Amber
  '#172554', // Blue
  '#000000', // Black
];

export const QuickSettingsModal: React.FC<QuickSettingsModalProps> = ({ onClose, onSave, initialDefaults }) => {
  const [data, setData] = useState<CardDefaults>(initialDefaults);
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');

  const handleChange = (field: keyof CardDefaults, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-0 sm:p-4 bg-black/90 sm:backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b1329] border-0 sm:border border-slate-800 p-4 sm:p-7 rounded-none sm:rounded-[2.5rem] w-full h-full sm:h-auto max-w-2xl shadow-2xl relative sm:max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 mb-2 shrink-0 border-b border-white/5 sm:border-transparent">
          <div className="flex items-center gap-2 sm:gap-3.5">
            <button 
              type="button"
              onClick={onClose}
              className="p-2 sm:hidden rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              title="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Settings size={22} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-black text-white uppercase tracking-tight">CONFIGURAÇÃO PADRÃO</h3>
              <p className="text-[9px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">DEFINA OS VALORES PADRÃO PARA O MODO RÁPIDO</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700 rounded-xl sm:rounded-full text-slate-400 hover:text-white transition-all active:scale-95 shrink-0"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-6 mb-5 border-b border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative ${
              activeTab === 'general' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            GERAL
            {activeTab === 'general' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advanced')}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative ${
              activeTab === 'advanced' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            AVANÇADO & CUSTOS
            {activeTab === 'advanced' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 scrollbar-thin">
          {activeTab === 'general' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    TÍTULO PADRÃO
                  </label>
                  <input
                    type="text"
                    value={data.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="ex: Quick Capture"
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold placeholder-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    CATEGORIA
                  </label>
                  <input
                    type="text"
                    value={data.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    placeholder="ex: Quick"
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold placeholder-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  DESCRIÇÃO PADRÃO
                </label>
                <textarea
                  value={data.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="ex: Captured via Quick Actions"
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold min-h-[90px] placeholder-slate-600 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    TAGS [SEPARADAS POR VÍRGULA]
                  </label>
                  <input
                    type="text"
                    value={data.tags}
                    onChange={(e) => handleChange('tags', e.target.value)}
                    placeholder="ex: quick, viral, exclusivo"
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold placeholder-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    GRUPO / PASTA
                  </label>
                  <input
                    type="text"
                    value={data.group || 'Geral'}
                    onChange={(e) => handleChange('group', e.target.value)}
                    placeholder="ex: Geral"
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold placeholder-slate-600"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">
                    CUSTO EM CRÉDITOS
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.creditCost}
                    onChange={(e) => handleChange('creditCost', Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    DURAÇÃO (SEGUNDOS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.duration}
                    onChange={(e) => handleChange('duration', Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    REPETIÇÃO (MINUTOS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.repeatInterval || 0}
                    onChange={(e) => handleChange('repeatInterval', Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0 para não repetir"
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    AUTO DELETE (SEGUNDOS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.expirySeconds || 0}
                    onChange={(e) => handleChange('expirySeconds', Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0 para nunca apagar"
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                  />
                </div>
              </div>

              {/* Blur Slider */}
              <div className="p-4 sm:p-5 bg-slate-900/70 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    NÍVEL DE BLUR PADRÃO
                  </label>
                  <span className="text-emerald-400 font-black text-xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    {data.blurLevel}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={data.blurLevel}
                  onChange={(e) => handleChange('blurLevel', parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[9px] text-slate-500">Define o nível de desfoque inicial na prévia para quem ainda não desbloqueou.</p>
              </div>

              {/* Card Color */}
              <div className="p-4 sm:p-5 bg-slate-900/70 rounded-2xl border border-slate-800 space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  COR DO CARD
                </label>
                <div className="flex flex-wrap gap-3">
                  {CARD_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleChange('cardColor', c)}
                      className={`w-9 h-9 rounded-xl border-2 transition-all active:scale-95 ${
                        data.cardColor === c ? 'border-emerald-400 scale-110 shadow-lg' : 'border-slate-700 hover:border-slate-500'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="pt-4 mt-2 border-t border-slate-800/80 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(data)}
            className="px-7 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl uppercase tracking-wider text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 active:scale-95"
          >
            <Save size={16} />
            Salvar Padrões
          </button>
        </div>

      </div>
    </div>
  );
};

