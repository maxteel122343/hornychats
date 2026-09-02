import React, { useState } from 'react';
import { X, Save, Settings, Layers, Palette, Eye, Sliders, Timer, Zap, Tag, DollarSign, FolderOpen, ArrowLeft } from 'lucide-react';
import { CardDefaults } from '../types';

interface QuickSettingsModalProps {
  onClose: () => void;
  onSave: (defaults: CardDefaults) => void;
  initialDefaults: CardDefaults;
  theme?: 'dark' | 'light';
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

export const QuickSettingsModal: React.FC<QuickSettingsModalProps> = ({ onClose, onSave, initialDefaults, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const [data, setData] = useState<CardDefaults>(initialDefaults);
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');

  const handleChange = (field: keyof CardDefaults, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`p-4 sm:p-7 rounded-none sm:rounded-[2.5rem] w-full h-full sm:h-auto max-w-2xl shadow-2xl relative sm:max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 border-0 sm:border ${
        isDark ? 'bg-[#0b1329] border-slate-800 text-white' : 'bg-white border-gray-200 text-slate-900'
      }`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between pb-3 sm:pb-4 mb-2 shrink-0 border-b ${
          isDark ? 'border-white/10 sm:border-transparent' : 'border-gray-200 sm:border-transparent'
        }`}>
          <div className="flex items-center gap-2 sm:gap-3.5">
            <button 
              type="button"
              onClick={onClose}
              className={`p-2 sm:hidden rounded-xl border ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-gray-100 border-gray-200 text-slate-700 hover:bg-gray-200'
              }`}
              title="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <Settings size={22} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className={`text-base sm:text-xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>CONFIGURAÇÃO PADRÃO</h3>
              <p className={`text-[9px] sm:text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>DEFINA OS VALORES PADRÃO PARA O MODO RÁPIDO</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl sm:rounded-full transition-all active:scale-95 shrink-0 border ${
              isDark 
                ? 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700' 
                : 'bg-gray-100 border-gray-200 text-slate-600 hover:text-slate-900 hover:bg-gray-200'
            }`}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className={`flex gap-6 mb-5 border-b shrink-0 ${isDark ? 'border-slate-800/80' : 'border-gray-200'}`}>
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative ${
              activeTab === 'general' 
                ? (isDark ? 'text-emerald-400' : 'text-emerald-600 font-extrabold') 
                : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
            }`}
          >
            GERAL
            {activeTab === 'general' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advanced')}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative ${
              activeTab === 'advanced' 
                ? (isDark ? 'text-emerald-400' : 'text-emerald-600 font-extrabold') 
                : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
            }`}
          >
            AVANÇADO & CUSTOS
            {activeTab === 'advanced' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 scrollbar-thin">
          {activeTab === 'general' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    TÍTULO PADRÃO
                  </label>
                  <input
                    type="text"
                    value={data.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="ex: Quick Capture"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500 placeholder-slate-600' 
                        : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white placeholder-slate-400'
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    CATEGORIA
                  </label>
                  <input
                    type="text"
                    value={data.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    placeholder="ex: Quick"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500 placeholder-slate-600' 
                        : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  DESCRIÇÃO PADRÃO
                </label>
                <textarea
                  value={data.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="ex: Captured via Quick Actions"
                  className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold min-h-[90px] resize-none transition-all ${
                    isDark 
                      ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500 placeholder-slate-600' 
                      : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white placeholder-slate-400'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    TAGS [SEPARADAS POR VÍRGULA]
                  </label>
                  <input
                    type="text"
                    value={data.tags}
                    onChange={(e) => handleChange('tags', e.target.value)}
                    placeholder="ex: quick, viral, exclusivo"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500 placeholder-slate-600' 
                        : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white placeholder-slate-400'
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    GRUPO / PASTA
                  </label>
                  <input
                    type="text"
                    value={data.group || 'Geral'}
                    onChange={(e) => handleChange('group', e.target.value)}
                    placeholder="ex: Geral"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500 placeholder-slate-600' 
                        : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">
                    CUSTO EM CRÉDITOS
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.creditCost}
                    onChange={(e) => handleChange('creditCost', Math.max(0, parseInt(e.target.value) || 0))}
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold ${
                      isDark ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500' : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    DURAÇÃO (SEGUNDOS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.duration}
                    onChange={(e) => handleChange('duration', Math.max(0, parseInt(e.target.value) || 0))}
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold ${
                      isDark ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500' : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    REPETIÇÃO (MINUTOS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.repeatInterval || 0}
                    onChange={(e) => handleChange('repeatInterval', Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0 para não repetir"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold ${
                      isDark ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500' : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    AUTO DELETE (SEGUNDOS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={data.expirySeconds || 0}
                    onChange={(e) => handleChange('expirySeconds', Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0 para nunca apagar"
                    className={`w-full border rounded-2xl p-3.5 text-sm outline-none font-bold ${
                      isDark ? 'bg-slate-900/90 border-slate-700/80 text-white focus:border-emerald-500' : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>
              </div>

              {/* Blur Slider */}
              <div className={`p-4 sm:p-5 rounded-2xl border space-y-2 ${
                isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex justify-between items-center">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    NÍVEL DE BLUR PADRÃO
                  </label>
                  <span className="text-emerald-500 font-black text-xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
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
                <p className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Define o nível de desfoque inicial na prévia para quem ainda não desbloqueou.</p>
              </div>

              {/* Card Color */}
              <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${
                isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-gray-50 border-gray-200'
              }`}>
                <label className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  COR DO CARD
                </label>
                <div className="flex flex-wrap gap-3">
                  {CARD_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleChange('cardColor', c)}
                      className={`w-9 h-9 rounded-xl border-2 transition-all active:scale-95 ${
                        data.cardColor === c ? 'border-emerald-500 scale-110 shadow-lg' : (isDark ? 'border-slate-700 hover:border-slate-500' : 'border-gray-300 hover:border-gray-400')
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
        <div className={`pt-4 mt-2 border-t flex items-center justify-end gap-3 shrink-0 ${
          isDark ? 'border-slate-800/80' : 'border-gray-200'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all active:scale-95 ${
              isDark 
                ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300' 
                : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-slate-700'
            }`}
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

