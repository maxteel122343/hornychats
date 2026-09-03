
import React, { useState, useRef, useEffect } from 'react';
import { X, ArrowLeft, Upload, Mic, Video, Image as ImageIcon, MessageSquare, DollarSign, Clock, Tag, Camera, StopCircle, RefreshCw, LayoutGrid, Eye, EyeOff, Maximize, Sliders, Phone, LayoutTemplate, Timer, Zap, Settings, Save, Trash2, Edit, PlayCircle, FolderOpen, CalendarClock, Palette, Layers, Repeat, Play, Pause, Tv } from 'lucide-react';
import { CardType, MediaCard, CardDefaults, AppTheme } from '../types';
import { supabase } from '../lib/supabase';
import MediaCardItem from './MediaCardItem';
import { QuickSettingsModal } from './QuickSettingsModal';

interface CardModalProps {
  onClose: () => void;
  onSubmit: (card: MediaCard) => void;
  userId?: string;
  initialData?: MediaCard | null;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onNavigateTab?: (tab: 'chat' | 'showcase' | 'my_cards' | 'cinema') => void;
  theme?: AppTheme;
}

const DEFAULT_SETTINGS_KEY = 'linkcard_defaults';

const CARD_COLORS = [
  '#0f172a', // Navy (Default)
  '#1e1b4b', // Indigo
  '#4c0519', // Rose
  '#022c22', // Emerald
  '#451a03', // Amber
  '#172554', // Blue
  '#000000', // Black
];

const CardModal: React.FC<CardModalProps> = ({ onClose, onSubmit, userId, initialData, onShowToast, onNavigateTab, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'create' | 'simple' | 'library'>('create');
  const [showSettings, setShowSettings] = useState(false);

  // Form State
  const [type, setType] = useState<CardType>(CardType.IMAGE);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creditCost, setCreditCost] = useState(10);
  const [category, setCategory] = useState('Premium');
  const [group, setGroup] = useState('Geral');
  const [tags, setTags] = useState('');
  const [duration, setDuration] = useState(60);
  const [expiry, setExpiry] = useState(0);
  const [repeatInterval, setRepeatInterval] = useState(0);

  // Media Action State: 'upload' | 'audio_rec' | 'video_rec' | 'photo_cap'
  const [mediaAction, setMediaAction] = useState<string | null>(null);

  const [isBlur, setIsBlur] = useState(true);
  const [blurLevel, setBlurLevel] = useState(30);
  const [defaultWidth, setDefaultWidth] = useState(250);
  const [layoutStyle, setLayoutStyle] = useState<'classic' | 'minimal'>('classic');
  const [cardColor, setCardColor] = useState(CARD_COLORS[0]);
  const [postToChat, setPostToChat] = useState(true);

  // Media State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [defaultThumbnail, setDefaultThumbnail] = useState<string | null>(null);

  // Library State
  const [myCards, setMyCards] = useState<MediaCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | Blob | null>(null);

  const thumbInputRef = useRef<HTMLInputElement>(null);
  const defaultThumbInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const [defaults, setDefaults] = useState<CardDefaults>({
    title: 'Conteúdo Exclusivo',
    description: 'Toque para desbloquear.',
    creditCost: 10,
    duration: 60,
    expirySeconds: 0,
    group: 'Geral',
    tags: 'premium, vip',
    blurLevel: 30,
    layoutStyle: 'classic',
    defaultWidth: 250,
    repeatInterval: 0,
    category: 'Premium',
    cardColor: CARD_COLORS[0],
    postToChat: true
  });

  useEffect(() => {
    const saved = localStorage.getItem(DEFAULT_SETTINGS_KEY);
    const savedThumb = localStorage.getItem(DEFAULT_SETTINGS_KEY + '_thumb');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDefaults(parsed);
        if (parsed.postToChat !== undefined && !initialData) {
          setPostToChat(parsed.postToChat);
        }
      } catch (e) {
        console.warn('Error parsing defaults:', e);
      }
    }
    if (savedThumb) {
      setDefaultThumbnail(savedThumb);
    }
  }, []);

  useEffect(() => {
    if (initialData) {
      handleEditCard(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      clearInterval(recordingTimerRef.current);
    };
  }, [stream]);

  useEffect(() => {
    if (activeTab === 'library' && userId) {
      fetchMyCards();
    }
  }, [activeTab, userId]);

  const fetchMyCards = async () => {
    setLoadingCards(true);
    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setMyCards(data.map(c => ({
        id: c.id,
        type: c.type as CardType,
        title: c.title,
        description: c.description,
        thumbnail: c.thumbnail,
        creditCost: c.credit_cost,
        mediaUrl: c.media_url,
        category: c.category,
        tags: c.tags || [],
        duration: c.duration,
        isBlur: c.is_blur,
        blurLevel: c.blur_level,
        createdAt: new Date(c.created_at).getTime(),
        defaultWidth: c.default_width,
        mediaType: 'none',
        expirySeconds: 0,
        saveToGallery: true,
        group: c.group,
        repeatInterval: c.repeat_interval || 0,
        cardColor: c.card_color || CARD_COLORS[0]
      })));
    }
    setLoadingCards(false);
  };

  const handleSaveDefaults = () => {
    localStorage.setItem(DEFAULT_SETTINGS_KEY, JSON.stringify(defaults));
    if (defaultThumbnail) {
      localStorage.setItem(DEFAULT_SETTINGS_KEY + '_thumb', defaultThumbnail);
    }
    setShowSettings(false);
    if (onShowToast) onShowToast('Padrões salvos!', 'success');
  };

  const handleStartCapture = async (mode: 'video' | 'audio' | 'photo') => {
    try {
      setCapturedMedia(null); // Clear previous
      
      let newStream: MediaStream;
      if (mode === 'audio') {
        newStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } else {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            audio: mode === 'video',
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
        } catch (err1) {
          console.warn("Retrying getUserMedia with basic constraints:", err1);
          try {
            newStream = await navigator.mediaDevices.getUserMedia({
              audio: mode === 'video',
              video: true
            });
          } catch (err2) {
            console.warn("Retrying video-only getUserMedia:", err2);
            newStream = await navigator.mediaDevices.getUserMedia({
              video: true
            });
          }
        }
      }

      setStream(newStream);

      // Directly attach stream to video element
      setTimeout(() => {
        if (videoRef.current && (mode === 'video' || mode === 'photo')) {
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.srcObject = newStream;
          videoRef.current.play().catch(e => console.log("Video preview error:", e));
        }
      }, 50);

      if (mode !== 'photo') {
        let options: MediaRecorderOptions = {};
        if (mode === 'video') {
          if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            options = { mimeType: 'video/webm;codecs=vp8,opus' };
          } else if (MediaRecorder.isTypeSupported('video/webm')) {
            options = { mimeType: 'video/webm' };
          } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            options = { mimeType: 'video/mp4' };
          }
        } else {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options = { mimeType: 'audio/webm;codecs=opus' };
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            options = { mimeType: 'audio/webm' };
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options = { mimeType: 'audio/mp4' };
          }
        }

        const recorder = new MediaRecorder(newStream, options);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          if (chunksRef.current.length === 0) {
            console.error('No data recorded');
            if (onShowToast) onShowToast('Nenhum dado gravado. Tente novamente.', 'error');
            setCapturedMedia(null);
            clearInterval(recordingTimerRef.current);
            if (newStream) newStream.getTracks().forEach(track => track.stop());
            setStream(null);
            return;
          }

          const actualMime = recorder.mimeType || (mode === 'video' ? 'video/webm' : 'audio/webm');
          const blob = new Blob(chunksRef.current, { type: actualMime });
          const url = URL.createObjectURL(blob);
          setCapturedMedia(url);
          setFileToUpload(blob);

          // Generate thumbnail for video
          if (mode === 'video' && videoRef.current && videoRef.current.videoWidth > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              setCustomThumbnail(canvas.toDataURL('image/jpeg', 0.8));
            }
          }

          clearInterval(recordingTimerRef.current);
          if (newStream) newStream.getTracks().forEach(track => track.stop());
          setStream(null);
        };

        // Timeslice 500ms for continuous chunk emission
        recorder.start(500);
        setIsRecording(true);
        setRecordingTime(0);
        recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      }
    } catch (err) {
      console.error(err);
      if (onShowToast) onShowToast("Acesso negado à câmera ou microfone.", "error");
    }
  };

  const handleStopCapture = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else if (stream) {
      // Just stopping stream (e.g. cancelled photo)
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleTakePhoto = () => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);

        // Convert canvas to blob for upload
        canvas.toBlob((blob) => {
          if (blob) {
            const dataUrl = canvas.toDataURL('image/png');
            setCapturedMedia(dataUrl);
            setCustomThumbnail(dataUrl);
            setFileToUpload(blob); // Store blob for upload
            setType(CardType.IMAGE);
            handleStopCapture();
          }
        }, 'image/png');
      }
    } else {
      if (onShowToast) onShowToast('Aguarde a câmera inicializar...', 'info');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) setType(CardType.IMAGE);
      else if (file.type.startsWith('video/')) setType(CardType.VIDEO);
      else if (file.type.startsWith('audio/')) setType(CardType.AUDIO);

      setFileToUpload(file); // Store for upload

      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedMedia(reader.result as string);
        if (activeTab === 'simple') {
          // Simplify submission will handle upload now too
          handleSubmitSimple(reader.result as string, file.type, file);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomThumbnail(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDefaultThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setDefaultThumbnail(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const blobToDataUrl = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadFileToSupabase = async (file: File | Blob, path: string, contentType: string): Promise<string | null> => {
    try {
      const { error } = await supabase.storage.from('media').upload(path, file, { contentType, upsert: true });
      if (error) {
        console.warn('Supabase storage upload failed, using local DataURL fallback:', error.message);
        return await blobToDataUrl(file);
      }
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
      return publicUrl || await blobToDataUrl(file);
    } catch (e) {
      console.warn('Storage upload exception, using local DataURL fallback:', e);
      return await blobToDataUrl(file);
    }
  };

  const handleSubmitSimple = async (media: string, mimeType?: string, file?: File) => {
    let finalType = type;
    if (mimeType) {
      if (mimeType.startsWith('image/')) finalType = CardType.IMAGE;
      else if (mimeType.startsWith('video/')) finalType = CardType.VIDEO;
      else if (mimeType.startsWith('audio/')) finalType = CardType.AUDIO;
    }

    setIsUploading(true);
    let finalMediaUrl = media;

    if (file && userId) {
      const ext = file.name.split('.').pop() || 'bin';
      const fileName = `${userId}_simple_${Date.now()}.${ext}`;
      const path = `uploads/${fileName}`;
      const uploadedUrl = await uploadFileToSupabase(file, path, file.type);
      if (uploadedUrl) finalMediaUrl = uploadedUrl;
      else if (onShowToast) onShowToast('Erro no upload, usando local (pode não funcionar para outros)', 'error');
    }

    const newCard: MediaCard = {
      id: Math.random().toString(36).substr(2, 9),
      type: finalType,
      title: defaults.title,
      description: defaults.description,
      creditCost: defaults.creditCost,
      category: defaults.category,
      tags: defaults.tags.split(',').map(t => t.trim()),
      duration: defaults.duration,
      expirySeconds: defaults.expirySeconds * 60,
      group: defaults.group,
      repeatInterval: defaults.repeatInterval,
      isBlur: true,
      blurLevel: defaults.blurLevel,
      saveToGallery: true,
      postToChat: postToChat,
      mediaType: 'upload',
      thumbnail: defaultThumbnail || customThumbnail || finalMediaUrl, // Use uploaded URL if generic thumb fails
      mediaUrl: finalMediaUrl,
      createdAt: Date.now(),
      defaultWidth: defaults.defaultWidth,
      layoutStyle: defaults.layoutStyle,
      cardColor: defaults.cardColor
    };

    // Save simple card to gallery too
    if (userId) {
      await supabase.from('cards').upsert([{
        id: newCard.id,
        creator_id: userId,
        type: newCard.type,
        title: newCard.title,
        description: newCard.description,
        thumbnail: newCard.thumbnail,
        credit_cost: newCard.creditCost,
        media_url: newCard.mediaUrl,
        category: newCard.category,
        tags: newCard.tags,
        duration: newCard.duration,
        is_blur: newCard.isBlur,
        blur_level: newCard.blurLevel,
        default_width: newCard.defaultWidth,
        group: newCard.group,
        repeat_interval: newCard.repeatInterval,
        card_color: newCard.cardColor,
        layout_style: newCard.layoutStyle
      }]);
    }

    onSubmit(newCard);
    setIsUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedMedia && type !== CardType.CHAT) {
      if (onShowToast) onShowToast("Por favor, selecione ou grave uma mídia.", 'error');
      return;
    }

    setIsUploading(true);
    let finalMediaUrl = capturedMedia || undefined;

    // Handle Upload if we have a file/blob
    if (fileToUpload && userId) {
      const ext = type === CardType.VIDEO ? 'webm' : type === CardType.AUDIO ? 'webm' : 'png';
      const mime = type === CardType.VIDEO ? 'video/webm' : type === CardType.AUDIO ? 'audio/webm' : 'image/png';
      // If it's a file, try to get real extension/mime
      let realMime = mime;
      let realExt = ext;
      if (fileToUpload instanceof File) {
        realMime = fileToUpload.type;
        realExt = fileToUpload.name.split('.').pop() || ext;
      }

      const fileName = `${userId}_advanced_${Date.now()}.${realExt}`;
      const path = `uploads/${fileName}`;
      const uploadedUrl = await uploadFileToSupabase(fileToUpload, path, realMime);

      if (uploadedUrl) {
        finalMediaUrl = uploadedUrl;
      } else if (!finalMediaUrl && fileToUpload) {
        finalMediaUrl = await blobToDataUrl(fileToUpload);
      }
    }

    // Fallback thumbnail logic
    let effectiveThumbnail = customThumbnail || defaultThumbnail;
    if (!effectiveThumbnail) {
      if (type === CardType.IMAGE) effectiveThumbnail = finalMediaUrl || null; // Use public URL
      else if (type === CardType.VIDEO && finalMediaUrl) {
        effectiveThumbnail = finalMediaUrl; // Attempt to use video URL as thumb
      } else {
        effectiveThumbnail = `https://picsum.photos/seed/${Math.random()}/800/600`;
      }
    }

    const newCard: MediaCard = {
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      type,
      title: title || `Novo Card ${type}`,
      description,
      creditCost,
      category,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      duration,
      expirySeconds: expiry * 60,
      group,
      repeatInterval,
      isBlur,
      blurLevel,
      saveToGallery: true,
      postToChat: postToChat,
      mediaType: mediaAction ? 'record' : 'upload',
      thumbnail: effectiveThumbnail || undefined,
      mediaUrl: finalMediaUrl,
      createdAt: Date.now(),
      defaultWidth: defaultWidth,
      layoutStyle: layoutStyle,
      cardColor: cardColor
    };

    // CRITICAL FIX: Always save/update to cards table
    if (userId) {
      const { error } = await supabase.from('cards').upsert([{
        id: newCard.id,
        creator_id: userId,
        type: newCard.type,
        title: newCard.title,
        description: newCard.description,
        thumbnail: newCard.thumbnail,
        credit_cost: newCard.creditCost,
        media_url: newCard.mediaUrl,
        category: newCard.category,
        tags: newCard.tags,
        duration: newCard.duration,
        is_blur: newCard.isBlur,
        blur_level: newCard.blurLevel,
        default_width: newCard.defaultWidth,
        group: newCard.group,
        repeat_interval: newCard.repeatInterval,
        card_color: newCard.cardColor,
        layout_style: newCard.layoutStyle
      }], { onConflict: 'id' });

      if (error) {
        console.error('Error saving/updating to gallery:', error);
        if (onShowToast) onShowToast('Card criado/editado mas houve erro ao salvar na galeria', 'error');
      }
    }

    onSubmit(newCard);
    setIsUploading(false);
  };

  const handleEditCard = (card: MediaCard) => {
    setType(card.type);
    setTitle(card.title);
    setDescription(card.description);
    setCreditCost(card.creditCost);
    setCategory(card.category);
    setGroup(card.group || 'Geral');
    setTags(card.tags.join(', '));
    setDuration(card.duration);
    setExpiry(card.expirySeconds / 60);
    setRepeatInterval(card.repeatInterval || 0);
    setIsBlur(card.isBlur);
    setBlurLevel(card.blurLevel);
    setDefaultWidth(card.defaultWidth || 250);
    setLayoutStyle(card.layoutStyle || 'classic');
    setCardColor(card.cardColor || CARD_COLORS[0]);
    setCapturedMedia(card.mediaUrl || null);
    setCustomThumbnail(card.thumbnail || null);
    setMediaAction('upload');
    if (card.postToChat !== undefined) {
      setPostToChat(card.postToChat);
    }

    setActiveTab('create');
  };

  const handleDeleteCard = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este card?')) {
      await supabase.from('cards').delete().eq('id', id);
      fetchMyCards();
    }
  };

  const resetMedia = () => {
    setCapturedMedia(null);
    setMediaAction(null);
    setCustomThumbnail(null);
    handleStopCapture();
  };

  // Build Preview Object
  const previewCard: MediaCard = {
    id: 'preview',
    type,
    title: title || 'Título do Card',
    description: description || 'Descrição do card...',
    creditCost,
    category,
    tags: tags.split(','),
    duration,
    expirySeconds: expiry * 60,
    repeatInterval,
    group,
    isBlur,
    blurLevel,
    saveToGallery: true,
    mediaType: 'none',
    createdAt: Date.now(),
    defaultWidth,
    layoutStyle,
    cardColor,
    thumbnail: customThumbnail || defaultThumbnail || capturedMedia || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
    mediaUrl: capturedMedia || ''
  };

  const cardTypes = [
    { id: CardType.IMAGE, icon: <ImageIcon size={22} />, label: 'IMAGEM' },
    { id: CardType.AUDIO, icon: <Mic size={22} />, label: 'ÁUDIO' },
    { id: CardType.VIDEO, icon: <Video size={22} />, label: 'VÍDEO' },
    { id: CardType.CHAT, icon: <MessageSquare size={22} />, label: 'CHAT' },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-300">
      <div className={`border-0 sm:border rounded-none sm:rounded-[2rem] w-full h-full sm:h-[92vh] ${activeTab === 'create' ? 'sm:max-w-6xl' : 'sm:max-w-4xl'} shadow-2xl flex flex-col relative overflow-hidden ${
        isDark ? 'bg-[#0f172a] border-slate-800 text-white' : 'bg-white border-gray-200 text-slate-900'
      }`}>

        {/* Top Navigation Bar */}
        <div className={`p-3 sm:p-4 border-b flex items-center justify-between gap-2 shrink-0 z-20 ${
          isDark ? 'border-white/10 bg-slate-900/95' : 'border-gray-200 bg-white'
        }`}>
          <button 
            type="button"
            onClick={onClose} 
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-xs font-bold shrink-0 active:scale-95 ${
              isDark 
                ? 'bg-slate-800 border-slate-700/80 text-slate-200 hover:bg-slate-700 hover:text-white' 
                : 'bg-gray-100 border-gray-200 text-slate-700 hover:bg-gray-200'
            }`}
            title="Voltar"
          >
            <ArrowLeft size={16} />
            <span className="font-bold text-xs uppercase">Voltar</span>
          </button>

          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide no-scrollbar flex-1 justify-center px-1 min-w-0">
            <button 
              type="button"
              onClick={() => setActiveTab('create')} 
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 active:scale-95 border ${
                activeTab === 'create' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/30' 
                  : (isDark ? 'text-slate-400 bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:text-white' : 'text-slate-600 bg-gray-100 border-gray-200 hover:bg-gray-200')
              }`}
            >
              <LayoutGrid size={13} /> <span>Avançado</span>
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('simple')} 
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 active:scale-95 border ${
                activeTab === 'simple' 
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/30' 
                  : (isDark ? 'text-slate-400 bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:text-white' : 'text-slate-600 bg-gray-100 border-gray-200 hover:bg-gray-200')
              }`}
            >
              <Zap size={13} /> <span>Simplifica</span>
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('library')} 
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 active:scale-95 border ${
                activeTab === 'library' 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/30' 
                  : (isDark ? 'text-slate-400 bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:text-white' : 'text-slate-600 bg-gray-100 border-gray-200 hover:bg-gray-200')
              }`}
            >
              <FolderOpen size={13} /> <span>Meus Cards</span>
            </button>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center border rounded-xl transition-all shrink-0 active:scale-95 ${
              isDark 
                ? 'bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border-slate-700/80 text-slate-300' 
                : 'bg-gray-100 hover:bg-red-50 hover:text-red-500 border-gray-200 text-slate-600'
            }`}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 sm:p-8 overscroll-contain">

          {/* --- TAB: SIMPLIFICA --- */}
          {activeTab === 'simple' && (
            <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in zoom-in-95">
              <div className="text-center space-y-2">
                <h3 className={`text-2xl font-black uppercase tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>Modo Rápido</h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Selecione seu arquivo e o card será criado com seus padrões.</p>
              </div>
              <div className="w-full max-w-sm">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()} 
                  className={`w-full aspect-square rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all group cursor-pointer ${
                    isDark 
                      ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10' 
                      : 'border-emerald-400 bg-emerald-50/70 hover:bg-emerald-50'
                  }`}
                >
                  <div className="p-6 rounded-full bg-emerald-500 text-white shadow-xl group-hover:scale-110 transition-transform">
                    <Upload size={48} />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-black uppercase tracking-widest text-emerald-600 block">Upload Universal</span>
                    <span className={`text-[10px] font-bold mt-2 block ${isDark ? 'text-slate-500 opacity-70' : 'text-slate-400'}`}>MP3 • JPG • MP4</span>
                  </div>
                </button>
              </div>

              {/* Toggle de Destino no Modo Rápido */}
              <div className={`w-full max-w-sm p-3.5 rounded-2xl border transition-all ${
                postToChat 
                  ? (isDark ? 'bg-blue-600/10 border-blue-500/40' : 'bg-blue-50 border-blue-200')
                  : (isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-gray-50 border-gray-200')
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      postToChat
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-200 text-slate-500')
                    }`}>
                      {postToChat ? <MessageSquare size={16} /> : <LayoutGrid size={16} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          Publicar no Chat
                        </span>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                          postToChat 
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                            : (isDark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-100 text-amber-700 border border-amber-200')
                        }`}>
                          {postToChat ? 'Chat + Vitrine' : 'Apenas Vitrine'}
                        </span>
                      </div>
                      <p className={`text-[9px] mt-0.5 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {postToChat ? 'Aparecerá no chat e na vitrine' : 'Aparecerá apenas na vitrine (não no chat)'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={postToChat}
                    onClick={() => setPostToChat(!postToChat)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      postToChat ? 'bg-blue-600' : (isDark ? 'bg-slate-700' : 'bg-gray-300')
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        postToChat ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setShowSettings(true)} 
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-black uppercase transition-all border ${
                  isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 border-slate-700' : 'bg-gray-100 text-slate-700 hover:bg-gray-200 border-gray-200 shadow-sm'
                }`}
              >
                <Settings size={14} /> Configurar Padrões
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,video/*,audio/*" />
            </div>
          )}

          {/* --- TAB: MEUS CARDS --- */}
          {activeTab === 'library' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Gerenciar Conteúdo</h3>
                <button 
                  type="button"
                  onClick={fetchMyCards} 
                  className={`p-2 rounded-full transition-colors ${
                    isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-slate-600'
                  }`}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              {loadingCards ? (
                <div className="text-center py-20 text-slate-500 text-xs font-bold uppercase animate-pulse">Carregando...</div>
              ) : myCards.length === 0 ? (
                <div className={`text-center py-20 text-xs font-bold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum card criado ainda.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myCards.map(card => (
                    <div key={card.id} className={`p-4 rounded-2xl flex gap-4 items-center group border transition-all ${
                      isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-gray-200 shadow-sm'
                    }`}>
                      <div className="w-16 h-16 rounded-xl bg-black overflow-hidden relative shrink-0">
                        <img src={card.thumbnail} className="w-full h-full object-cover opacity-60" />
                        <div className="absolute inset-0 flex items-center justify-center text-white">{card.type === CardType.VIDEO ? <PlayCircle size={20} /> : <ImageIcon size={20} />}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{card.title}</h4>
                        <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{card.group || 'Geral'} • {card.creditCost}cr</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => handleEditCard(card)} className="p-2 bg-blue-600/20 text-blue-500 rounded-lg hover:bg-blue-600 hover:text-white"><Edit size={16} /></button>
                        <button type="button" onClick={() => handleDeleteCard(card.id)} className="p-2 bg-red-600/20 text-red-500 rounded-lg hover:bg-red-600 hover:text-white"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* --- TAB: AVANÇADO (COM PREVIEW) --- */}
          {activeTab === 'create' && (
            <div className="flex flex-col lg:flex-row gap-8 h-full">
              {/* Form Section */}
              <div className="flex-1 overflow-y-auto scrollbar-hide pr-2">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Tipo de Conteúdo</label>
                    <div className="grid grid-cols-4 gap-2">
                      {cardTypes.map(ct => (
                        <button
                          key={ct.id}
                          type="button"
                          onClick={() => { setType(ct.id); resetMedia(); }}
                          className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${
                            type === ct.id 
                              ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20' 
                              : (isDark ? 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-500 hover:text-white' : 'bg-gray-50 border-gray-200 text-slate-600 hover:border-gray-300 hover:bg-gray-100')
                          }`}
                        >
                          {ct.icon}
                          <span className="text-[8px] font-black uppercase tracking-widest">{ct.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Captura & Mídia</label>
                    <div className="grid grid-cols-4 gap-2">
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()} 
                        className={`h-16 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all ${
                          isDark 
                            ? 'border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5 bg-slate-800/20' 
                            : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50/50 bg-gray-50'
                        }`}
                      >
                        <Upload size={16} className={isDark ? 'text-slate-400' : 'text-slate-600'} />
                        <span className={`text-[8px] font-black uppercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Upload</span>
                      </button>

                      {/* Botão Gravar Áudio */}
                      <button 
                        type="button" 
                        onClick={() => { setMediaAction('audio_rec'); setType(CardType.AUDIO); handleStartCapture('audio'); }} 
                        className={`h-16 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-1 ${
                          mediaAction === 'audio_rec' 
                            ? 'border-red-500 bg-red-500/10' 
                            : (isDark ? 'border-slate-700 hover:border-red-500/50 hover:bg-red-500/5 bg-slate-800/20' : 'border-gray-300 hover:border-red-500 hover:bg-red-50/50 bg-gray-50')
                        }`}
                      >
                        <Mic size={16} className={mediaAction === 'audio_rec' ? "text-red-500" : (isDark ? "text-slate-400" : "text-slate-600")} />
                        <span className={`text-[8px] font-black uppercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Áudio</span>
                      </button>

                      {/* Botão Gravar Vídeo */}
                      <button 
                        type="button" 
                        onClick={() => { setMediaAction('video_rec'); setType(CardType.VIDEO); handleStartCapture('video'); }} 
                        className={`h-16 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-1 ${
                          mediaAction === 'video_rec' 
                            ? 'border-blue-500 bg-blue-500/10' 
                            : (isDark ? 'border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5 bg-slate-800/20' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50/50 bg-gray-50')
                        }`}
                      >
                        <Video size={16} className={mediaAction === 'video_rec' ? "text-blue-500" : (isDark ? "text-slate-400" : "text-slate-600")} />
                        <span className={`text-[8px] font-black uppercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Vídeo</span>
                      </button>

                      {/* Botão Tirar Foto */}
                      <button 
                        type="button" 
                        onClick={() => { setMediaAction('photo_cap'); setType(CardType.IMAGE); handleStartCapture('photo'); }} 
                        className={`h-16 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-1 ${
                          mediaAction === 'photo_cap' 
                            ? 'border-purple-500 bg-purple-500/10' 
                            : (isDark ? 'border-slate-700 hover:border-purple-500/50 hover:bg-purple-500/5 bg-slate-800/20' : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50/50 bg-gray-50')
                        }`}
                      >
                        <Camera size={16} className={mediaAction === 'photo_cap' ? "text-purple-500" : (isDark ? "text-slate-400" : "text-slate-600")} />
                        <span className={`text-[8px] font-black uppercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Foto</span>
                      </button>

                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    </div>

                    {mediaAction && (
                      <div className={`relative bg-black rounded-2xl overflow-hidden border flex items-center justify-center mt-4 transition-all ${
                        isDark ? 'border-slate-700' : 'border-gray-300'
                      } ${isRecording || !capturedMedia ? 'aspect-video h-48' : 'aspect-auto h-auto min-h-[12rem] bg-slate-900'}`}>

                        {/* LIVE STREAM VIEW */}
                        {stream && (
                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        )}

                        {/* RECORDING INDICATOR */}
                        {stream && isRecording && (
                          <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-full flex items-center gap-2 backdrop-blur-md">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-white font-mono font-black text-xs">{formatTime(recordingTime)}</span>
                          </div>
                        )}

                        {/* REVIEW VIEW (AFTER CAPTURE) */}
                        {capturedMedia && !stream && (
                          <div className="w-full p-2 flex flex-col gap-2">
                            {type === CardType.VIDEO ? (
                              <video src={capturedMedia} controls className="w-full rounded-xl max-h-60 bg-black" />
                            ) : type === CardType.AUDIO ? (
                              <div className="w-full p-4 bg-slate-800 rounded-xl flex items-center justify-center">
                                <audio src={capturedMedia} controls className="w-full" />
                              </div>
                            ) : (
                              <img src={capturedMedia} className="w-full rounded-xl object-contain max-h-60" />
                            )}
                            <div className="text-center text-[10px] text-slate-400 uppercase font-black">Preview da Captura</div>
                          </div>
                        )}

                        {/* CONTROLS */}
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                          {stream && mediaAction === 'photo_cap' && (
                            <button type="button" onClick={handleTakePhoto} className="w-14 h-14 rounded-full border-4 border-white flex items-center justify-center bg-white/20 hover:bg-white/40 transition-all">
                              <div className="w-10 h-10 bg-white rounded-full" />
                            </button>
                          )}

                          {stream && (mediaAction === 'video_rec' || mediaAction === 'audio_rec') && !isRecording && (
                            <button type="button" onClick={() => { }} className="px-6 py-2 bg-red-600 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-red-500 shadow-lg">
                              Iniciar
                            </button>
                          )}

                          {isRecording && (
                            <button type="button" onClick={handleStopCapture} className="w-14 h-14 rounded-full border-4 border-red-500/50 flex items-center justify-center bg-red-600 hover:bg-red-700 transition-all shadow-xl">
                              <div className="w-6 h-6 bg-white rounded-sm" />
                            </button>
                          )}
                        </div>

                        <button type="button" onClick={resetMedia} className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-red-600 transition-colors z-20">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <label className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Visual & Organização</label>

                    <div className="flex items-center gap-4">
                      <button 
                        type="button" 
                        onClick={() => thumbInputRef.current?.click()} 
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all group flex-1 ${
                          isDark 
                            ? 'border-slate-700 hover:bg-slate-800 bg-slate-800/20' 
                            : 'border-gray-200 hover:bg-gray-50 bg-white shadow-sm'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg overflow-hidden relative border flex items-center justify-center ${
                          isDark ? 'bg-slate-800 border-slate-600 group-hover:border-slate-500' : 'bg-gray-100 border-gray-200'
                        }`}>
                          {customThumbnail ? (
                            <img src={customThumbnail} className="w-full h-full object-cover" />
                          ) : (
                            <div className={isDark ? "text-slate-400" : "text-slate-500"}><ImageIcon size={16} /></div>
                          )}
                        </div>
                        <div className="text-left">
                          <span className={`text-[9px] font-black uppercase block ${isDark ? 'text-slate-300 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>Thumbnail</span>
                          <span className={`text-[8px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Personalizada</span>
                        </div>
                      </button>
                      <input type="file" ref={thumbInputRef} onChange={handleThumbUpload} className="hidden" accept="image/*" />
                    </div>

                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => setLayoutStyle('classic')} 
                        className={`flex-1 p-2.5 rounded-xl text-[9px] font-black uppercase border transition-all ${
                          layoutStyle === 'classic' 
                            ? (isDark ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold') 
                            : (isDark ? 'bg-slate-800/40 border-slate-700 text-slate-400' : 'bg-gray-100 border-gray-200 text-slate-600')
                        }`}
                      >
                        Clássico
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setLayoutStyle('minimal')} 
                        className={`flex-1 p-2.5 rounded-xl text-[9px] font-black uppercase border transition-all ${
                          layoutStyle === 'minimal' 
                            ? (isDark ? 'bg-pink-600/20 border-pink-500 text-pink-400' : 'bg-pink-50 border-pink-500 text-pink-700 font-bold') 
                            : (isDark ? 'bg-slate-800/40 border-slate-700 text-slate-400' : 'bg-gray-100 border-gray-200 text-slate-600')
                        }`}
                      >
                        Minimal
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {CARD_COLORS.map(color => (
                        <button key={color} type="button" onClick={() => setCardColor(color)} className={`w-6 h-6 rounded-full border-2 transition-transform ${cardColor === color ? 'border-blue-500 scale-110 shadow' : 'border-transparent opacity-60'}`} style={{ backgroundColor: color }} />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        placeholder="Grupo (Ex: VIP)" 
                        value={group} 
                        onChange={e => setGroup(e.target.value)} 
                        className={`w-full border rounded-xl p-2 text-xs outline-none transition-colors ${
                          isDark 
                            ? 'bg-slate-800/40 border-slate-700/50 text-white placeholder-slate-500 focus:border-blue-500' 
                            : 'bg-gray-50 border-gray-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white'
                        }`} 
                      />
                      <input 
                        placeholder="Tags (sep. vírgula)" 
                        value={tags} 
                        onChange={e => setTags(e.target.value)} 
                        className={`w-full border rounded-xl p-2 text-xs outline-none transition-colors ${
                          isDark 
                            ? 'bg-slate-800/40 border-slate-700/50 text-white placeholder-slate-500 focus:border-blue-500' 
                            : 'bg-gray-50 border-gray-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white'
                        }`} 
                      />
                    </div>

                    <div className="space-y-1">
                      <div className={`flex justify-between text-[9px] font-black uppercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}><span>Blur</span><span>{blurLevel}%</span></div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={blurLevel} 
                        onChange={e => setBlurLevel(parseInt(e.target.value))} 
                        className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                          isDark ? 'bg-slate-700 accent-blue-500' : 'bg-gray-200 accent-blue-600'
                        }`} 
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <input 
                      placeholder="Título" 
                      value={title} 
                      onChange={e => setTitle(e.target.value)} 
                      className={`w-full border rounded-xl p-3 text-xs font-bold outline-none transition-colors ${
                        isDark 
                          ? 'bg-slate-800/40 border-slate-700/50 text-white placeholder-slate-500 focus:border-blue-500' 
                          : 'bg-gray-50 border-gray-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white'
                      }`} 
                      required 
                    />
                    <textarea 
                      placeholder="Descrição" 
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                      className={`w-full border rounded-xl p-3 text-xs h-16 outline-none transition-colors ${
                        isDark 
                          ? 'bg-slate-800/40 border-slate-700/50 text-white placeholder-slate-500 focus:border-blue-500' 
                          : 'bg-gray-50 border-gray-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white'
                      }`} 
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div className={`border rounded-xl p-2 ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-gray-50 border-gray-200'}`}>
                        <label className={`text-[8px] font-black uppercase block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Preço (Créditos)</label>
                        <input type="number" value={creditCost} onChange={e => setCreditCost(parseInt(e.target.value))} className="w-full bg-transparent text-sm font-black text-emerald-500 outline-none" />
                      </div>
                      <div className={`border rounded-xl p-2 ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-gray-50 border-gray-200'}`}>
                        <label className={`text-[8px] font-black uppercase block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tempo (s)</label>
                        <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} className={`w-full bg-transparent text-sm font-black outline-none ${isDark ? 'text-white' : 'text-slate-900'}`} />
                      </div>
                      <div className={`border rounded-xl p-2 ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-gray-50 border-gray-200'}`}>
                        <label className={`text-[8px] font-black uppercase block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Auto-Del (min)</label>
                        <input type="number" value={expiry} onChange={e => setExpiry(parseInt(e.target.value))} className="w-full bg-transparent text-sm font-black text-red-500 outline-none" placeholder="0 = off" />
                      </div>
                      <div className={`border rounded-xl p-2 ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-gray-50 border-gray-200'}`}>
                        <label className={`text-[8px] font-black uppercase block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Repetir (min)</label>
                        <input type="number" value={repeatInterval} onChange={e => setRepeatInterval(parseInt(e.target.value))} className="w-full bg-transparent text-sm font-black text-orange-500 outline-none" placeholder="0 = off" />
                      </div>
                    </div>
                  </div>

                  {/* Toggle de Destino da Publicação (Chat + Vitrine ou Apenas Vitrine) */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    postToChat 
                      ? (isDark ? 'bg-blue-600/10 border-blue-500/40' : 'bg-blue-50 border-blue-200')
                      : (isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-gray-50 border-gray-200')
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          postToChat
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-200 text-slate-500')
                        }`}>
                          {postToChat ? <MessageSquare size={18} /> : <LayoutGrid size={18} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              Publicar no Chat
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                              postToChat 
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                : (isDark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-100 text-amber-700 border border-amber-200')
                            }`}>
                              {postToChat ? 'Chat + Vitrine' : 'Apenas Vitrine'}
                            </span>
                          </div>
                          <p className={`text-[10px] mt-0.5 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {postToChat 
                              ? 'Ativado: O card aparecerá no chat e na vitrine.' 
                              : 'Desativado: O card aparecerá apenas na vitrine (não aparece no chat).'}
                          </p>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={postToChat}
                        onClick={() => setPostToChat(!postToChat)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          postToChat ? 'bg-blue-600' : (isDark ? 'bg-slate-700' : 'bg-gray-300')
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            postToChat ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={isUploading} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] hover:bg-blue-500 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
                    {isUploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {isUploading 
                      ? 'Enviando...' 
                      : (postToChat 
                          ? (initialData ? 'Republicar no Chat e Vitrine' : 'Publicar no Chat e Vitrine') 
                          : (initialData ? 'Salvar Apenas na Vitrine' : 'Publicar Apenas na Vitrine'))}
                  </button>
                </form>
              </div>

              {/* Preview Section */}
              <div className={`hidden lg:flex flex-col flex-1 items-center justify-center rounded-[2rem] border p-8 relative overflow-hidden ${
                isDark ? 'bg-black/40 border-white/5' : 'bg-gray-50 border-gray-200 shadow-inner'
              }`}>
                <div className={`absolute top-4 left-4 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Live Preview</div>
                <div className="pointer-events-none transform scale-110">
                  <MediaCardItem
                    card={previewCard}
                    canManage={false}
                    onUnlock={() => false}
                    isHostMode={false}
                    theme={theme}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- PERSISTENT BOTTOM NAVIGATION BAR --- */}
        <div className={`border-t px-3 py-2 sm:py-2.5 flex items-center justify-around shrink-0 z-20 ${
          isDark ? 'border-slate-800 bg-[#090f1f]/95 text-slate-400' : 'border-gray-200 bg-white/95 text-slate-600'
        }`}>
          <button
            type="button"
            onClick={() => {
              if (onNavigateTab) {
                onNavigateTab('chat');
              } else {
                onClose();
              }
            }}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 sm:px-5 rounded-xl transition-all active:scale-95 ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100'
            }`}
            title="Ir para o Feed de Mensagens"
          >
            <MessageSquare size={18} />
            <span className="text-[10px] font-black uppercase tracking-wider">Feed</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onNavigateTab) {
                onNavigateTab('showcase');
              } else {
                onClose();
              }
            }}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 sm:px-5 rounded-xl transition-all active:scale-95 ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100'
            }`}
            title="Ir para a Vitrine"
          >
            <LayoutGrid size={18} />
            <span className="text-[10px] font-black uppercase tracking-wider">Vitrine</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('library');
            }}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 sm:px-5 rounded-xl transition-all active:scale-95 ${
              activeTab === 'library'
                ? (isDark ? 'text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 font-bold' : 'text-indigo-600 bg-indigo-50 border border-indigo-200 font-bold')
                : (isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100')
            }`}
            title="Ver Meus Cards"
          >
            <FolderOpen size={18} />
            <span className="text-[10px] font-black uppercase tracking-wider">Meus Cards</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onNavigateTab) {
                onNavigateTab('cinema');
              } else {
                onClose();
              }
            }}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 sm:px-5 rounded-xl transition-all active:scale-95 ${
              isDark ? 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800/60' : 'text-slate-600 hover:text-indigo-600 hover:bg-gray-100'
            }`}
            title="Ir para o Cinema"
          >
            <Tv size={18} />
            <span className="text-[10px] font-black uppercase tracking-wider">Cinema</span>
          </button>
        </div>

        {/* --- SETTINGS MODAL OVERLAY --- */}
        {showSettings && (
          <QuickSettingsModal
            onClose={() => setShowSettings(false)}
            theme={theme}
            onSave={(newDefaults) => {
              setDefaults(newDefaults);
              localStorage.setItem(DEFAULT_SETTINGS_KEY, JSON.stringify(newDefaults));
              setShowSettings(false);
              if (onShowToast) onShowToast('Configurações padrão salvas com sucesso!', 'success');
            }}
            initialDefaults={defaults}
          />
        )}

      </div>
    </div>
  );
};

export default CardModal;
