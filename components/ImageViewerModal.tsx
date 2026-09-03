import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X, Maximize2, Move } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  imageUrl,
  title,
  onClose
}) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, imageUrl]);

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleReset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, zoom]);

  if (!isOpen || !imageUrl) return null;

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.3, 4));
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const next = Math.max(prev - 0.3, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev + 0.2, 4));
    } else {
      setZoom(prev => {
        const next = Math.max(prev - 0.2, 0.5);
        if (next <= 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double click toggles between 1x and 2x
  const handleDoubleClick = () => {
    if (zoom > 1) {
      handleReset();
    } else {
      setZoom(2);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-6 select-none animate-in fade-in duration-200"
      onWheel={handleWheel}
      onMouseUp={handleMouseUp}
    >
      {/* TOP HEADER */}
      <div className="w-full flex items-center justify-between text-white z-20 pointer-events-auto">
        <div className="flex items-center gap-3 max-w-[70%]">
          <div className="p-2 rounded-xl bg-white/10 text-indigo-400">
            <Maximize2 size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black truncate uppercase tracking-tight text-white drop-shadow">
              {title || 'Visualização da Imagem'}
            </h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Clique duplo ou use scroll do mouse para dar zoom
            </p>
          </div>
        </div>

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="p-2.5 sm:p-3 rounded-2xl bg-white/10 hover:bg-red-500/80 text-white transition-all active:scale-95 border border-white/10"
          title="Fechar (Esc)"
        >
          <X size={20} />
        </button>
      </div>

      {/* CENTER IMAGE VIEWPORT */}
      <div 
        ref={containerRef}
        className="relative w-full h-[75vh] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={imageUrl}
          alt={title || 'Imagem ampliada'}
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all select-none"
        />

        {zoom > 1 && (
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg pointer-events-none">
            <Move size={12} className="text-indigo-400" />
            <span>Arraste para mover</span>
          </div>
        )}
      </div>

      {/* FLOATING ZOOM CONTROLS TOOLBAR */}
      <div className="z-20 flex items-center gap-2 sm:gap-3 bg-slate-900/90 border border-white/15 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 transition-all active:scale-95"
          title="Diminuir Zoom (-)"
        >
          <ZoomOut size={18} />
        </button>

        <span className="text-xs font-black text-white w-14 text-center font-mono">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={handleZoomIn}
          disabled={zoom >= 4}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 transition-all active:scale-95"
          title="Aumentar Zoom (+)"
        >
          <ZoomIn size={18} />
        </button>

        <div className="w-[1px] h-5 bg-white/20 mx-1" />

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
          title="Redefinir Zoom (100%)"
        >
          <RotateCcw size={14} />
          <span>100%</span>
        </button>
      </div>
    </div>
  );
};

export default ImageViewerModal;
