
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Plus, Home, Wallet, Share2, MessageSquare, LayoutGrid, QrCode, X, User as UserIcon, LogIn, Camera, Settings, Sun, Moon, Menu, ChevronLeft, ChevronRight, ChevronDown, Copy, CheckCircle, Loader2, RefreshCw, DollarSign, ArrowUpRight, Mic, Video, Upload, StopCircle, Trash2, Aperture, Lock, Zap, History, CreditCard, Mail, ShoppingCart, LogOut, FolderOpen, Edit, Tv, Image as ImageIcon, Cloud, MoreVertical, Minimize2, Maximize2, Power, Sliders, ArrowLeft, Users, Clock, Sparkles } from 'lucide-react';
import { User, Message, MediaCard, ChatSession, CardType, PaymentTransaction, CardDefaults, PaidChatConfig, QuickPhrasesConfig } from '../types';
import { supabase } from '../lib/supabase';
import CardModal from './CardModal';
import MediaCardItem from './MediaCardItem';
import Gallery from './Gallery';
import { QuickSettingsModal, DEFAULT_CREATOR_PHRASES, DEFAULT_VISITOR_PHRASES } from './QuickSettingsModal';
import { ChatRenewalModal } from './ChatRenewalModal';
import { WalletModal } from './WalletModal';
import { ToastType, ToastOptions } from './Toast';
import { getFollowers, getFollowing } from '../lib/followers';

// IndexedDB configuration for storing recent local video files
const DB_NAME = 'LocalWatchPartyDB';
const STORE_NAME = 'videos';

const initLocalDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteVideoFromLocalDB = async (id: number): Promise<void> => {
  const db = await initLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getRecentVideosFromLocalDB = async (roomId: string): Promise<Array<{ id: number, name: string, size: number, type: string, file: File, room_id?: string, timestamp: number }>> => {
  const db = await initLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const result = request.result || [];
      const filtered = result.filter((v: any) => v.room_id === roomId);
      filtered.sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
};

const generateVideoThumbnail = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    const url = URL.createObjectURL(file);
    video.src = url;
    
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 2 || 0.5);
    };
    
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl);
        } else {
          resolve(null);
        }
      } catch (e) {
        console.error("Failed to draw video thumbnail:", e);
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
};

const saveVideoToLocalDB = async (file: File, roomId: string): Promise<void> => {
  const db = await initLocalDB();
  const thumbnail = await generateVideoThumbnail(file).catch(() => null);

  return new Promise(async (resolve, reject) => {
    try {
      const videos = await getRecentVideosFromLocalDB(roomId);
      // Keep max 5 videos
      if (videos.length >= 5) {
        // Delete the oldest video (last item in descending array)
        const oldest = videos[videos.length - 1];
        await deleteVideoFromLocalDB(oldest.id);
      }

      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add({
        name: file.name,
        size: file.size,
        type: file.type,
        file: file,
        thumbnail: thumbnail,
        room_id: roomId,
        timestamp: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
};

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

interface ChatRoomProps {
  user: User;
  updateCredits: (amount: number) => void;
  updateFreeCredits: (amount: number, updateTimestamp?: boolean) => void;
  openAuth: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onShowToast?: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  estimated_payout_at: string;
}

interface Sale {
  id: string;
  buyer_name: string;
  card_title: string;
  amount: number;
  created_at: string;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ user, updateCredits, updateFreeCredits, openAuth, theme, toggleTheme, onShowToast }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [inputText, setInputText] = useState('');

  // Card Creation/Editing
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<MediaCard | null>(null);

  // Room Selection for Insert
  const [isRoomSelectorOpen, setIsRoomSelectorOpen] = useState(false);
  const [cardToInsert, setCardToInsert] = useState<MediaCard | null>(null);

  const [activeTab, setActiveTab] = useState<'chat' | 'showcase' | 'my_cards' | 'cinema'>('chat');
  const [isCinemaSidebarCollapsed, setIsCinemaSidebarCollapsed] = useState(false);
  const [floatingMessages, setFloatingMessages] = useState<Array<{ id: string | number, text: string, senderName: string }>>([]);
  const [roomChannel, setRoomChannel] = useState<any>(null);
  const [watchPartyFile, setWatchPartyFile] = useState<File | null>(null);
  const [uploadingWatchParty, setUploadingWatchParty] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletInitialTab, setWalletInitialTab] = useState<'recharge' | 'earnings' | 'followers'>('recharge');
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const openWallet = (tab: 'recharge' | 'earnings' | 'followers' = 'recharge') => {
    setWalletInitialTab(tab);
    setIsWalletModalOpen(true);
  };
  const [withdrawalPending, setWithdrawalPending] = useState(false);

  // Withdrawal & Sales State
  const [withdrawalMethod, setWithdrawalMethod] = useState<'pix' | 'picpay' | 'paypal' | 'stripe'>('pix');
  const [withdrawalKey, setWithdrawalKey] = useState('');
  const [withdrawalHistory, setWithdrawalHistory] = useState<Withdrawal[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [withdrawalCpf, setWithdrawalCpf] = useState('');
  const [withdrawalFullName, setWithdrawalFullName] = useState('');
  const [hasFreeSales, setHasFreeSales] = useState(false);
  const [claimTimer, setClaimTimer] = useState<number | null>(null);
  const claimIntervalRef = useRef<any>(null);

  // Quick Settings & Toast State
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
  const [quickDefaults, setQuickDefaults] = useState<CardDefaults>({
    title: 'Quick Capture',
    description: 'Captured via Quick Actions',
    creditCost: 0,
    duration: 0,
    expirySeconds: 0,
    group: 'General',
    tags: 'quick',
    blurLevel: 0,
    layoutStyle: 'classic',
    defaultWidth: 250,
    repeatInterval: 0,
    category: 'Quick',
    cardColor: '#0f172a'
  });
  const showToast = (message: string, type: ToastType = 'success', options?: ToastOptions) => {
    if (onShowToast) onShowToast(message, type, options);
  };

  // Paid Chat & Quick Phrases State
  const [quickSettingsTab, setQuickSettingsTab] = useState<'general' | 'advanced' | 'paid_chat' | 'phrases'>('paid_chat');
  const [paidChatConfig, setPaidChatConfig] = useState<PaidChatConfig>(() => {
    if (typeof window !== 'undefined' && roomId) {
      const saved = localStorage.getItem(`paid_chat_config_${roomId}`);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return {
      enabled: false,
      intervalMinutes: 5,
      costCredits: 10,
      warningSeconds: 60,
      autoDebitDefault: false
    };
  });

  const [quickPhrasesConfig, setQuickPhrasesConfig] = useState<QuickPhrasesConfig>(() => {
    if (typeof window !== 'undefined' && roomId) {
      const saved = localStorage.getItem(`quick_phrases_${roomId}`);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return {
      creatorPhrases: [...DEFAULT_CREATOR_PHRASES],
      visitorPhrases: [...DEFAULT_VISITOR_PHRASES]
    };
  });

  // State to track which session is being configured (null means active roomId)
  const [targetSessionConfig, setTargetSessionConfig] = useState<{
    sessionId: string;
    sessionName: string;
    paidChat: PaidChatConfig;
    phrases: QuickPhrasesConfig;
    defaults: CardDefaults;
  } | null>(null);

  const handleOpenSessionSettings = (sessionId: string, sessionName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Check custom paid chat config
    let pChat: PaidChatConfig = {
      enabled: false,
      intervalMinutes: 5,
      costCredits: 10,
      warningSeconds: 60,
      autoDebitDefault: false
    };
    if (sessionId === roomId) {
      pChat = { ...paidChatConfig };
    } else {
      const savedPaid = localStorage.getItem(`paid_chat_config_${sessionId}`);
      if (savedPaid) {
        try { pChat = JSON.parse(savedPaid); } catch (err) {}
      }
    }

    // Check custom phrases config
    let qPhrases: QuickPhrasesConfig = {
      creatorPhrases: [...DEFAULT_CREATOR_PHRASES],
      visitorPhrases: [...DEFAULT_VISITOR_PHRASES]
    };
    if (sessionId === roomId) {
      qPhrases = { ...quickPhrasesConfig };
    } else {
      const savedPhrases = localStorage.getItem(`quick_phrases_${sessionId}`);
      if (savedPhrases) {
        try { qPhrases = JSON.parse(savedPhrases); } catch (err) {}
      }
    }

    // Card defaults
    let cDefaults: CardDefaults = { ...quickDefaults };
    const savedDefaults = localStorage.getItem(`card_defaults_${sessionId}`);
    if (savedDefaults) {
      try { cDefaults = JSON.parse(savedDefaults); } catch (err) {}
    }

    setTargetSessionConfig({
      sessionId,
      sessionName,
      paidChat: pChat,
      phrases: qPhrases,
      defaults: cDefaults
    });
    setQuickSettingsTab('paid_chat');
    setIsQuickSettingsOpen(true);
  };

  // Chat Renewal States (Cronômetro regressivo em vermelho e Débito Automático)
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [renewalSecondsRemaining, setRenewalSecondsRemaining] = useState(60);
  const [isChatPausedDueToRenewal, setIsChatPausedDueToRenewal] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(() => {
    if (typeof window !== 'undefined' && roomId) {
      const saved = localStorage.getItem(`session_start_${roomId}_${user.id}`);
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return Date.now();
  });

  const [autoDebit, setAutoDebit] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && roomId) {
      const saved = localStorage.getItem(`auto_debit_${roomId}_${user.id}`);
      if (saved !== null) return saved === 'true';
    }
    return paidChatConfig?.autoDebitDefault ?? false;
  });

  const handleToggleAutoDebit = (enabled: boolean) => {
    setAutoDebit(enabled);
    if (roomId) {
      localStorage.setItem(`auto_debit_${roomId}_${user.id}`, enabled.toString());
    }
    showToast(
      enabled ? 'Débito automático ativado!' : 'Débito automático desligado.',
      enabled ? 'success' : 'info'
    );
  };

  const handleRenewChat = async () => {
    if (user.credits < paidChatConfig.costCredits) {
      openWallet('recharge');
      showToast('Saldo insuficiente. Recarregue seus créditos para renovar.', 'warning');
      return;
    }

    const cost = paidChatConfig.costCredits;
    updateCredits(user.credits - cost);
    const now = Date.now();
    setSessionStartTime(now);
    if (roomId) {
      localStorage.setItem(`session_start_${roomId}_${user.id}`, now.toString());
    }
    setIsRenewalModalOpen(false);
    setIsChatPausedDueToRenewal(false);
    showToast(`Chat renovado com sucesso! (-${cost} créditos)`, 'success');

    // Transfer or log transaction in Supabase
    if (user.isLoggedIn && roomDetails?.creator_id && roomDetails.creator_id !== user.id) {
      try {
        await supabase.from('credit_transactions').insert([{
          sender_id: user.id,
          receiver_id: roomDetails.creator_id,
          amount: cost,
          type: 'chat_renewal',
          card_id: null
        }]);
      } catch (e) {
        console.warn('Could not log credit transaction:', e);
      }
    }
  };

  const handleSaveQuickSettings = async (
    newDefaults: CardDefaults, 
    newPaidChat?: PaidChatConfig, 
    newPhrases?: QuickPhrasesConfig
  ) => {
    const targetId = targetSessionConfig?.sessionId || roomId;
    const targetName = targetSessionConfig?.sessionName || (roomDetails?.name || 'Sala');

    if (newDefaults && targetId) {
      localStorage.setItem(`card_defaults_${targetId}`, JSON.stringify(newDefaults));
      if (targetId === roomId) {
        setQuickDefaults(newDefaults);
      }
    }

    if (newPaidChat && targetId) {
      localStorage.setItem(`paid_chat_config_${targetId}`, JSON.stringify(newPaidChat));
      if (targetId === roomId) {
        setPaidChatConfig(newPaidChat);
        // Broadcast to room peers via roomChannel
        const activeChannel = roomChannel || roomChannelRef.current;
        if (activeChannel) {
          activeChannel.send({
            type: 'broadcast',
            event: 'paid-chat-update',
            payload: { config: newPaidChat }
          });
        }
      }
    }

    if (newPhrases && targetId) {
      localStorage.setItem(`quick_phrases_${targetId}`, JSON.stringify(newPhrases));
      if (targetId === roomId) {
        setQuickPhrasesConfig(newPhrases);
        // Broadcast to room peers via roomChannel
        const activeChannel = roomChannel || roomChannelRef.current;
        if (activeChannel) {
          activeChannel.send({
            type: 'broadcast',
            event: 'quick-phrases-update',
            payload: { phrases: newPhrases }
          });
        }
      }
    }

    setIsQuickSettingsOpen(false);
    setTargetSessionConfig(null);
    showToast(`Configurações de "${targetName}" salvas com sucesso!`, 'success');

    // Persist to Supabase if logged in
    if (targetId && user.isLoggedIn) {
      try {
        await supabase.from('rooms').update({
          paid_chat_config: newPaidChat,
          quick_phrases: newPhrases
        }).eq('id', targetId);
      } catch (err) {
        console.warn('Could not update room metadata in Supabase:', err);
      }
    }
  };

  // Private Room Logic
  const [isPrivateLocked, setIsPrivateLocked] = useState(false);
  const [privateRoomCard, setPrivateRoomCard] = useState<MediaCard | null>(null);

  // Quick Action States
  const [isQuickRecording, setIsQuickRecording] = useState(false);
  const [quickRecordingType, setQuickRecordingType] = useState<'audio' | 'video' | 'photo' | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [quickStream, setQuickStream] = useState<MediaStream | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [quickMediaPreview, setQuickMediaPreview] = useState<string | null>(null);

  // Payment States
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [activePayment, setActivePayment] = useState<PaymentTransaction | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // My Cards State
  const [myCards, setMyCards] = useState<MediaCard[]>([]);
  const [purchasedCardIds, setPurchasedCardIds] = useState<Set<string>>(new Set());

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profileRefresh, setProfileRefresh] = useState(0);

  // Room Customization State
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [tempRoomName, setTempRoomName] = useState('');
  const [roomDetails, setRoomDetails] = useState<{
    name: string,
    image_url?: string,
    background_url?: string,
    watch_party_data?: { source: string, card_id?: string, type: string },
    admins?: string[],
    creator_id?: string
  } | null>(null);
  const [roomAdmins, setRoomAdmins] = useState<Set<string>>(new Set());

  // Watch Party State
  const [isRoomDetailsLoading, setIsRoomDetailsLoading] = useState(true);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [p2pLoadingProgress, setP2pLoadingProgress] = useState(0);
  const [isWatchPartyOpen, setIsWatchPartyOpen] = useState(false);
  const [isCinemaMenuOpen, setIsCinemaMenuOpen] = useState(false);
  const [watchPartySource, setWatchPartySource] = useState<string | null>(null);
  const [watchPartyType, setWatchPartyType] = useState<'video' | 'url' | null>(null);
  const [watchPartyCardId, setWatchPartyCardId] = useState<string | null>(null);
  const [watchPartyVideoName, setWatchPartyVideoName] = useState<string | null>(null);
  const [watchPartyInput, setWatchPartyInput] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [watchPartySelection, setWatchPartySelection] = useState<{ source: string, type: 'video' | 'url', cardId?: string, name?: string } | null>(null);

  // WebRTC P2P States
  const [watchPartyHostId, setWatchPartyHostId] = useState<string | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Local video history state
  const [recentVideos, setRecentVideos] = useState<Array<{ id: number, name: string, size: number, type: string, file: File, timestamp: number }>>([]);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'history'>('chat');
  const [allowedVideoControllers, setAllowedVideoControllers] = useState<Set<string>>(new Set());

  // Clear Chat Modal State
  const [isClearChatModalOpen, setIsClearChatModalOpen] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);



  // Visual viewport height adjustment for mobile keyboard overlay issues
  useEffect(() => {
    const handleResize = () => {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--viewport-height', `${vh}px`);
    };
    
    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Floating messages hook for collapsed sidebar mode in Cinema tab
  useEffect(() => {
    if (messages.length > 0) {
      const latestMsg = messages[messages.length - 1];
      // Show floating message when sidebar is collapsed OR chat is minimized via chevron icon
      if (latestMsg.text && activeTab === 'cinema' && (isCinemaSidebarCollapsed || isChatMinimized)) {
        const newFloating = {
          id: latestMsg.id,
          text: latestMsg.text,
          senderName: latestMsg.senderName
        };
        setFloatingMessages(prev => [...prev.slice(-2), newFloating]); // keep last 3 floating bubbles max
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
          setFloatingMessages(prev => prev.filter(m => m.id !== newFloating.id));
        }, 10000);
      }
    }
  }, [messages, isCinemaSidebarCollapsed, isChatMinimized, activeTab]);


  const peerConnections = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const pendingCandidates = useRef<{ [userId: string]: RTCIceCandidateInit[] }>({});
  const pendingViewers = useRef<Set<string>>(new Set());
  const hostVideoRef = useRef<HTMLVideoElement | null>(null);
  const viewerVideoRef = useRef<HTMLVideoElement | null>(null);
  const roomChannelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Retry interval for viewer join-request
  const joinRequestIntervalRef = useRef<any>(null);
  // Guard: prevents self-triggered stop events from closing the new-video selection modal
  const selectingNewVideoRef = useRef(false);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);



  // Helper to bypass some X-Frame-Options by using embed links
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
    if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
    if (url.includes('vimeo.com/')) return url.replace('vimeo.com/', 'player.vimeo.com/video/');
    return url;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickUploadRef = useRef<HTMLInputElement>(null);
  const bgUploadRef = useRef<HTMLInputElement>(null);
  const roomImageUploadRef = useRef<HTMLInputElement>(null);
  const watchVideoUploadRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const cinemaChatContainerRef = useRef<HTMLDivElement>(null);

  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const quickVideoRef = useRef<HTMLVideoElement>(null);
  const autoRepeatIntervalRef = useRef<any>(null);

  // Ensure video preview is attached when stream is available
  useEffect(() => {
    if (quickStream && (quickRecordingType === 'video' || quickRecordingType === 'photo') && !isReviewing) {
      const attachVideo = () => {
        if (quickVideoRef.current) {
          quickVideoRef.current.muted = true;
          quickVideoRef.current.playsInline = true;
          if (quickVideoRef.current.srcObject !== quickStream) {
            quickVideoRef.current.srcObject = quickStream;
          }
          quickVideoRef.current.play().catch(e => console.log("Video play error:", e));
        }
      };
      attachVideo();
      const timer = setTimeout(attachVideo, 80);
      return () => clearTimeout(timer);
    }
  }, [quickStream, quickRecordingType, isReviewing, isQuickRecording]);

  const isHost = !!(
    roomId === user.id ||
    roomId?.startsWith('priv-') ||
    roomId?.startsWith('guest_') ||
    (roomDetails && roomDetails.creator_id === user.id)
  );
  const isWatchPartyHost = watchPartyHostId ? watchPartyHostId === user.id : !!(localVideoUrl || isHost);
  const isAdmin = isHost || (user.isLoggedIn && roomAdmins.has(user.id)) || roomId?.startsWith('guest_');
  const canControlVideo = true; // Everyone can insert and control video

  // Paid Chat Rotation Timer Effect (Cobrança Rotativa a cada X minutos)
  useEffect(() => {
    // If not enabled or if the user is the room creator/host, host does not pay
    if (!paidChatConfig.enabled || isHost || !roomId) {
      setIsRenewalModalOpen(false);
      setIsChatPausedDueToRenewal(false);
      return;
    }

    const interval = setInterval(() => {
      const cycleDurationSeconds = Math.max(30, (paidChatConfig.intervalMinutes || 5) * 60);
      const warningDuration = Math.min(paidChatConfig.warningSeconds || 60, cycleDurationSeconds);
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - sessionStartTime) / 1000));
      const secondsLeftInCycle = cycleDurationSeconds - (elapsedSeconds % cycleDurationSeconds);

      setRenewalSecondsRemaining(secondsLeftInCycle);

      // Warning window reached (e.g. within 60s / 300s before expiring)
      if (secondsLeftInCycle <= warningDuration && secondsLeftInCycle > 1) {
        if (autoDebit) {
          // If auto debit is enabled and user has enough credits, automatically renew without interruption
          if (user.credits >= paidChatConfig.costCredits) {
            updateCredits(user.credits - paidChatConfig.costCredits);
            const now = Date.now();
            setSessionStartTime(now);
            localStorage.setItem(`session_start_${roomId}_${user.id}`, now.toString());
            setIsRenewalModalOpen(false);
            setIsChatPausedDueToRenewal(false);
            showToast(`Chat renovado automaticamente (-${paidChatConfig.costCredits} créditos)`, 'success');
            return;
          } else {
            // Auto-debit failed due to insufficient credits: alert user with red countdown
            setIsRenewalModalOpen(true);
          }
        } else {
          // Manual renewal: show modal with red countdown timer
          setIsRenewalModalOpen(true);
        }
      }

      // Time ran out (Cycle ended and not renewed)
      if (secondsLeftInCycle <= 1 || elapsedSeconds >= cycleDurationSeconds) {
        if (autoDebit && user.credits >= paidChatConfig.costCredits) {
          updateCredits(user.credits - paidChatConfig.costCredits);
          const now = Date.now();
          setSessionStartTime(now);
          localStorage.setItem(`session_start_${roomId}_${user.id}`, now.toString());
          setIsRenewalModalOpen(false);
          setIsChatPausedDueToRenewal(false);
          showToast(`Chat renovado automaticamente (-${paidChatConfig.costCredits} créditos)`, 'success');
        } else {
          setIsChatPausedDueToRenewal(true);
          setIsRenewalModalOpen(true);
          setRenewalSecondsRemaining(0);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [paidChatConfig, isHost, roomId, sessionStartTime, autoDebit, user.credits]);

  const toggleVideoController = (userId: string) => {
    if (!isHost) return;
    const newControllers = new Set(allowedVideoControllers);
    if (newControllers.has(userId)) {
      newControllers.delete(userId);
      showToast("Permissão de controle removida.", "info");
    } else {
      newControllers.add(userId);
      showToast("Controle do player permitido para este usuário!", "success");
    }
    setAllowedVideoControllers(newControllers);
    
    // Broadcast update to all
    const activeChannel = roomChannel || roomChannelRef.current;
    if (activeChannel) {
      activeChannel.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: { senderId: user.id, targetId: 'all', type: 'allowed-controllers-update', data: Array.from(newControllers) }
      });
    }
  };

  const loadRecentVideos = async () => {
    if (!roomId) return;
    try {
      const list = await getRecentVideosFromLocalDB(roomId);
      setRecentVideos(list);

      // AUTO RESTORE P2P STREAM AFTER RELOAD FOR HOST!
      if ((activeTab === 'cinema' || isWatchPartyOpen) && isWatchPartyHost && watchPartySource === 'p2p-stream' && list.length > 0 && !localVideoUrl) {
        const match = list.find(v => 
          (watchPartyVideoName && v.name === watchPartyVideoName) ||
          (!watchPartyVideoName && !watchPartyCardId && v.name)
        ) || list[0];
        
        const url = URL.createObjectURL(match.file);
        setLocalVideoUrl(url);
        setWatchPartyFile(match.file);
      }
    } catch (e) {
      console.error("Failed to load local videos:", e);
    }
  };

  useEffect(() => {
    if (activeTab === 'cinema' || isWatchPartyOpen || sidebarTab === 'history') {
      loadRecentVideos();
    }
  }, [activeTab, isWatchPartyOpen, sidebarTab, isWatchPartyHost, watchPartySource, watchPartyVideoName, watchPartyCardId]);
  const isDark = theme === 'dark';

  // WebRTC Effects
  // FIX 1+3: When host gets a stream, connect all pending viewers AND broadcast 'stream-ready' to all
  useEffect(() => {
    if (localStream && isWatchPartyHost) {
      const connectViewer = async (viewerId: string) => {
        if (peerConnections.current[viewerId]) return;
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });
        peerConnections.current[viewerId] = pc;
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        pc.onicecandidate = (event) => {
          if (event.candidate && roomChannelRef.current) {
            roomChannelRef.current.send({
              type: 'broadcast',
              event: 'webrtc-signal',
              payload: { senderId: user.id, targetId: viewerId, type: 'candidate', data: event.candidate }
            });
          }
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (roomChannelRef.current) {
          roomChannelRef.current.send({
            type: 'broadcast',
            event: 'webrtc-signal',
            payload: { senderId: user.id, targetId: viewerId, type: 'offer', data: offer }
          });
        }
      };

      // Connect pending viewers queued before stream was ready
      if (pendingViewers.current.size > 0) {
        pendingViewers.current.forEach(connectViewer);
        pendingViewers.current.clear();
      }

      // FIX 3: Broadcast 'stream-ready' to ALL viewers so they know to send join-request
      if (roomChannelRef.current) {
        roomChannelRef.current.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { senderId: user.id, targetId: 'all', type: 'stream-ready' }
        });
      }
    }
  }, [localStream, isWatchPartyHost, user.id]);

  // FIX 2: Viewer retries join-request every 3 seconds until remoteStream received (max 10 attempts)
  useEffect(() => {
    if (joinRequestIntervalRef.current) {
      clearInterval(joinRequestIntervalRef.current);
      joinRequestIntervalRef.current = null;
    }

    if (watchPartySource === 'p2p-stream' && watchPartyHostId && !isWatchPartyHost && !remoteStream && (activeTab === 'cinema' || isWatchPartyOpen) && roomChannel) {
      const sendJoinRequest = () => {
        roomChannel.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { senderId: user.id, targetId: watchPartyHostId, type: 'join-request' }
        });
      };
      // Send immediately
      sendJoinRequest();
      // Retry every 3 seconds (stops once remoteStream is received via effect cleanup)
      joinRequestIntervalRef.current = setInterval(sendJoinRequest, 3000);
    }

    return () => {
      if (joinRequestIntervalRef.current) {
        clearInterval(joinRequestIntervalRef.current);
        joinRequestIntervalRef.current = null;
      }
    };
  }, [watchPartySource, watchPartyHostId, isWatchPartyHost, remoteStream, activeTab, isWatchPartyOpen, roomChannel, user.id]);

  useEffect(() => {
    if (viewerVideoRef.current && viewerVideoRef.current.srcObject !== remoteStream) {
      viewerVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);


  const handleToggleAdmin = async (targetUserId: string) => {
    if (!isHost || !roomId) return;
    const newAdminSet = new Set(roomAdmins);
    if (newAdminSet.has(targetUserId)) newAdminSet.delete(targetUserId);
    else newAdminSet.add(targetUserId);

    const adminsArray = Array.from(newAdminSet);
    const { error } = await supabase.from('rooms').update({ admins: adminsArray }).eq('id', roomId);
    if (error) showToast('Erro ao atualizar admin.', 'error');
    else {
      setRoomAdmins(newAdminSet);
      showToast('Permissões atualizadas!', 'success');
    }
  };

  const colors = {
    bg: isDark ? 'bg-[#050a14]' : 'bg-gray-50',
    sidebarBg: isDark ? 'bg-[#0a111f]' : 'bg-white',
    headerBg: isDark ? 'bg-[#0a111f]/80' : 'bg-white/80',
    border: isDark ? 'border-slate-800/50' : 'border-gray-200',
    text: isDark ? 'text-slate-300' : 'text-slate-600',
    textHighlight: isDark ? 'text-white' : 'text-slate-900',
    primary: isDark ? 'bg-blue-600' : 'bg-red-600',
    primaryText: isDark ? 'text-blue-500' : 'text-red-600',
    primarySoft: isDark ? 'bg-blue-600/10' : 'bg-red-600/10',
    primaryBorder: isDark ? 'border-blue-500/20' : 'border-red-500/20',
    inputBg: isDark ? 'bg-slate-800/40' : 'bg-gray-100',
  };

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('chat_sessions');
    const baseRoom = {
      id: roomId || 'main',
      name: `Sala: ${roomId?.slice(0, 6) || 'Principal'}`,
      lastMessage: 'Bem-vindo!',
      time: 'Agora',
      isActive: true
    };
    if (saved) {
      const parsed = JSON.parse(saved);
      if (roomId && !parsed.find((s: ChatSession) => s.id === roomId)) {
        parsed.unshift(baseRoom);
      }
      return parsed;
    }
    return [baseRoom];
  });

  useEffect(() => {
    localStorage.setItem('chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Load Withdrawal Settings & History when modal opens
  useEffect(() => {
    if ((showEarningsModal || isWalletModalOpen) && user.isLoggedIn) {
      const fetchSettings = async () => {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
          // Update local User object to keep sync
          user.earnings = data.earnings || 0;
          user.pixKey = data.pix_key;
          user.picpayEmail = data.picpay_email;
          user.paypalEmail = data.paypal_email;
          user.stripeEmail = data.stripe_email;

          // Set initial input value based on current method
          setKeyForMethod(withdrawalMethod, data);
        }

        const { data: history } = await supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (history) setWithdrawalHistory(history as any);

        const { data: sales } = await supabase.from('sales_transactions').select('*').eq('seller_id', user.id).eq('is_free', false).order('created_at', { ascending: false });
        if (sales) setSalesHistory(sales as any);

        // Also fetch what the user has purchased to allow internal access
        const { data: purchases } = await supabase.from('sales_transactions').select('card_id').eq('buyer_id', user.id);
        if (purchases) setPurchasedCardIds(new Set(purchases.map(p => p.card_id)));

        // Check if has any free sales
        const { count } = await supabase.from('sales_transactions').select('*', { count: 'exact', head: true }).eq('seller_id', user.id).eq('is_free', true);
        setHasFreeSales((count || 0) > 0);
      };
      fetchSettings();
    }
  }, [showEarningsModal, isWalletModalOpen, user.isLoggedIn]);

  // Load followers/following count for user
  useEffect(() => {
    if (user.isLoggedIn && user.id) {
      getFollowers(user.id).then(f => setFollowersCount(f.length)).catch(console.warn);
      getFollowing(user.id).then(f => setFollowingCount(f.length)).catch(console.warn);
    }
  }, [user.isLoggedIn, user.id, isWalletModalOpen]);

  // Handle Free Credits Claim Timer
  useEffect(() => {
    if (user.last_free_claim_at) {
      const updateTimer = () => {
        const lastClaim = new Date(user.last_free_claim_at!).getTime();
        const now = Date.now();
        const diffMs = (30 * 60 * 1000) - (now - lastClaim);

        if (diffMs > 0) {
          setClaimTimer(Math.ceil(diffMs / 1000));
        } else {
          setClaimTimer(null);
          if (claimIntervalRef.current) clearInterval(claimIntervalRef.current);
        }
      };

      updateTimer();
      claimIntervalRef.current = setInterval(updateTimer, 1000);
      return () => clearInterval(claimIntervalRef.current);
    } else {
      setClaimTimer(null);
    }
  }, [user.last_free_claim_at]);

  // Periodic fetch of purchases to handle background updates
  useEffect(() => {
    if (user.isLoggedIn) {
      const fetchPurchases = async () => {
        const { data } = await supabase.from('sales_transactions').select('card_id').eq('buyer_id', user.id);
        if (data) setPurchasedCardIds(new Set(data.map(p => p.card_id)));
      };
      fetchPurchases();
    }
  }, [user.id, user.isLoggedIn]);

  // Update input key when method changes
  useEffect(() => {
    if ((showEarningsModal || isWalletModalOpen) && user.isLoggedIn) {
      // We need to fetch again or use the cached user object values
      const data = {
        pix_key: user.pixKey,
        picpay_email: user.picpayEmail,
        paypal_email: user.paypalEmail,
        stripe_email: user.stripeEmail
      };
      setKeyForMethod(withdrawalMethod, data);
    }
  }, [withdrawalMethod]);

  const setKeyForMethod = (method: string, data: any) => {
    if (method === 'pix') setWithdrawalKey(data.pix_key || '');
    else if (method === 'picpay') setWithdrawalKey(data.picpay_email || '');
    else if (method === 'paypal') setWithdrawalKey(data.paypal_email || '');
    else if (method === 'stripe') setWithdrawalKey(data.stripe_email || '');
  };

  // AUTO-REPEAT LOGIC (Runs only if user is Host and Online)
  useEffect(() => {
    if (!isHost || !roomId) return;

    const checkRepeats = async () => {
      // 1. Fetch user's cards with repeat > 0 that still exist
      const { data: recurringCards } = await supabase
        .from('cards')
        .select('*')
        .eq('creator_id', user.id)
        .gt('repeat_interval', 0);

      if (!recurringCards || recurringCards.length === 0) return;

      for (const card of recurringCards) {
        // CRITICAL FIX: Verify card still exists before reposting
        const { data: cardExists } = await supabase
          .from('cards')
          .select('id')
          .eq('id', card.id)
          .single();

        if (!cardExists) {
          console.log(`Skipping deleted card: ${card.id}`);
          continue; // Skip if card was deleted
        }

        const intervalMs = card.repeat_interval * 60 * 1000;

        // Find last message with this card
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('created_at')
          .eq('room_id', roomId)
          .contains('card_data', { id: card.id })
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        let shouldPost = false;
        if (!lastMsg) {
          const cardCreated = new Date(card.created_at).getTime();
          if (Date.now() - cardCreated > intervalMs) shouldPost = true;
        } else {
          const lastPostTime = new Date(lastMsg.created_at).getTime();
          if (Date.now() - lastPostTime > intervalMs) shouldPost = true;
        }

        if (shouldPost) {
          const mediaCard: MediaCard = {
            id: card.id,
            type: card.type as CardType,
            title: card.title,
            description: card.description,
            thumbnail: card.thumbnail,
            creditCost: card.credit_cost,
            mediaUrl: card.media_url,
            category: card.category,
            tags: card.tags,
            duration: card.duration,
            expirySeconds: 0,
            repeatInterval: card.repeat_interval,
            isBlur: card.is_blur,
            blurLevel: card.blur_level,
            saveToGallery: true,
            createdAt: Date.now(),
            defaultWidth: card.default_width,
            mediaType: 'none',
            layoutStyle: card.layout_style,
            cardColor: card.card_color,
            creator_id: card.creator_id
          };

          await supabase.from('messages').insert([{
            room_id: roomId,
            sender_id: user.id,
            sender_name: user.name,
            card_data: mediaCard
          }]);
          console.log(`Auto-posted card: ${card.title}`);
        }
      }
    };

    // Run check every minute
    autoRepeatIntervalRef.current = setInterval(checkRepeats, 60000);
    // Run once immediately on load
    checkRepeats();

    return () => clearInterval(autoRepeatIntervalRef.current);
  }, [isHost, roomId, user.id]);


  // Fetch My Cards when tab is active
  useEffect(() => {
    if (activeTab === 'my_cards' && user.isLoggedIn) {
      const fetchMyCards = async () => {
        const { data } = await supabase.from('cards').select('*').eq('creator_id', user.id).order('created_at', { ascending: false });
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
            tags: c.tags,
            duration: c.duration,
            isBlur: c.is_blur,
            blurLevel: c.blur_level,
            createdAt: new Date(c.created_at).getTime(),
            defaultWidth: c.default_width,
            mediaType: 'none',
            expirySeconds: 0,
            repeatInterval: c.repeat_interval,
            saveToGallery: true,
            creator_id: c.creator_id,
            cardColor: c.card_color
          })));
        }
      };
      fetchMyCards();
    }
  }, [activeTab, user.isLoggedIn, user.id]);


  // PRIVATE ROOM GATEKEEPER CHECK
  useEffect(() => {
    const checkPrivateAccess = async () => {
      setIsPrivateLocked(false);
      setPrivateRoomCard(null);

      if (roomId?.startsWith('priv-')) {
        const cardId = roomId.split('priv-')[1];
        const { data: cardData, error } = await supabase.from('cards').select('*').eq('id', cardId).single();

        if (error || !cardData) return;

        const mediaCard = { ...cardData, type: cardData.type as CardType } as MediaCard;
        setPrivateRoomCard(mediaCard);

        if (user.isLoggedIn && (user.id === cardData.creator_id)) return;

        setIsPrivateLocked(true);
      }
    };
    checkPrivateAccess();
  }, [roomId, user.id, user.isLoggedIn]);

  const handleUnlockPrivateRoom = async () => {
    if (!user.isLoggedIn) { openAuth(); return; }
    if (!privateRoomCard) return;
    if (user.credits < privateRoomCard.creditCost) { openWallet('recharge'); return; }

    updateCredits(-privateRoomCard.creditCost);
    const earnings = Math.floor(privateRoomCard.creditCost * 0.8);
    // Use direct property access now that type definition is updated
    if (privateRoomCard.creator_id) {
      const { error: rpcError } = await supabase.rpc('process_card_purchase', {
        p_card_id: privateRoomCard.id,
        p_buyer_id: user.id,
        p_creator_id: privateRoomCard.creator_id,
        p_amount: privateRoomCard.creditCost,
        p_earnings: earnings,
        p_card_title: privateRoomCard.title || 'Sala Privada',
        p_buyer_name: user.name || 'Usuário'
      });

      if (rpcError) {
        console.warn("RPC process_card_purchase error in private room, executing fallback:", rpcError);
        // Log sales transaction manually for history display
        await supabase.from('sales_transactions').insert([{
          seller_id: privateRoomCard.creator_id,
          buyer_id: user.id,
          buyer_name: user.name,
          card_id: privateRoomCard.id,
          card_title: privateRoomCard.title,
          amount: earnings
        }]);
      }
    }
    setIsPrivateLocked(false);
    alert(`Sala desbloqueada! -${privateRoomCard.creditCost} créditos.`);
  };

  useEffect(() => {
    if (!roomId) return;
    if (isPrivateLocked) return;

    // Reset watch party states for the new room
    setWatchPartySource(null);
    setWatchPartyType(null);
    setWatchPartyCardId(null);
    setWatchPartyVideoName(null);
    setWatchPartyHostId(null);
    setLocalVideoUrl(null);
    setLocalStream(null);
    setRemoteStream(null);
    setAllowedVideoControllers(new Set());
    setIsWatchPartyOpen(false);
    cleanupP2P();

    const fetchRoomDetails = async () => {
      if (!roomId) return;
      setIsRoomDetailsLoading(true);
      const { data } = await supabase.from('rooms').select('name, image_url, background_url, watch_party_data, admins, creator_id, paid_chat_config, quick_phrases').eq('id', roomId).single();
      
      let watchPartyData = data?.watch_party_data || null;

      // LocalStorage Fallback for guest rooms
      if (!watchPartyData) {
        const saved = localStorage.getItem(`watch_party_${roomId}`);
        if (saved) {
          try {
            watchPartyData = JSON.parse(saved);
          } catch (e) {}
        }
      }

      // Sync Paid Chat and Quick Phrases from Room if present
      if (data?.paid_chat_config) {
        setPaidChatConfig(data.paid_chat_config);
        localStorage.setItem(`paid_chat_config_${roomId}`, JSON.stringify(data.paid_chat_config));
      } else {
        const localPaid = localStorage.getItem(`paid_chat_config_${roomId}`);
        if (localPaid) {
          try { setPaidChatConfig(JSON.parse(localPaid)); } catch (e) {}
        } else {
          setPaidChatConfig({
            enabled: false,
            intervalMinutes: 5,
            costCredits: 10,
            warningSeconds: 60,
            autoDebitDefault: false
          });
        }
      }

      if (data?.quick_phrases) {
        setQuickPhrasesConfig(data.quick_phrases);
        localStorage.setItem(`quick_phrases_${roomId}`, JSON.stringify(data.quick_phrases));
      } else {
        const localPhrases = localStorage.getItem(`quick_phrases_${roomId}`);
        if (localPhrases) {
          try { setQuickPhrasesConfig(JSON.parse(localPhrases)); } catch (e) {}
        } else {
          setQuickPhrasesConfig({
            creatorPhrases: [...DEFAULT_CREATOR_PHRASES],
            visitorPhrases: [...DEFAULT_VISITOR_PHRASES]
          });
        }
      }

      // LocalStorage Fallback for room customization
      const savedDetails = localStorage.getItem(`room_details_${roomId}`);
      let parsedCustomDetails: any = null;
      if (savedDetails) {
        try {
          parsedCustomDetails = JSON.parse(savedDetails);
        } catch (e) {}
      }

      if (data) {
        const merged = {
          ...data,
          name: data.name || parsedCustomDetails?.name || 'Conversa',
          image_url: data.image_url || parsedCustomDetails?.image_url,
          background_url: data.background_url || parsedCustomDetails?.background_url
        };
        setRoomDetails(merged);
        setTempRoomName(merged.name);
        setRoomAdmins(new Set(data.admins || []));
      } else {
        // Check if roomId corresponds to a Creator profile (e.g. clicked chat button on creator card)
        try {
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .eq('id', roomId)
            .single();

          if (creatorProfile) {
            const creatorRoom = {
              name: `Chat com ${creatorProfile.name || 'Criador'}`,
              image_url: creatorProfile.avatar_url,
              creator_id: creatorProfile.id,
              admins: [creatorProfile.id]
            };
            setRoomDetails(creatorRoom);
            setTempRoomName(creatorRoom.name);
            setRoomAdmins(new Set([creatorProfile.id]));

            setSessions(prev => {
              const idx = prev.findIndex(s => s.id === roomId);
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = { ...next[idx], name: creatorRoom.name };
                return next;
              }
              return [{
                id: roomId,
                name: creatorRoom.name,
                lastMessage: 'Conversa com criador',
                time: 'Agora',
                isActive: true
              }, ...prev];
            });
          } else if (parsedCustomDetails) {
            setRoomDetails(parsedCustomDetails);
            setTempRoomName(parsedCustomDetails.name || 'Conversa');
          }
        } catch (e) {
          if (parsedCustomDetails) {
            setRoomDetails(parsedCustomDetails);
            setTempRoomName(parsedCustomDetails.name || 'Conversa');
          }
        }
      }

      if (watchPartyData) {
        setWatchPartySource(watchPartyData.source);
        setWatchPartyCardId(watchPartyData.card_id);
        setWatchPartyType(watchPartyData.type as any);
        setWatchPartyHostId(watchPartyData.host_id || null);
        setWatchPartyVideoName(watchPartyData.video_name || null);
        setIsWatchPartyOpen(false);
      }
      setIsRoomDetailsLoading(false);
    };

    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('*').eq('room_id', roomId).order('created_at', { ascending: true });
      if (data) {
        // Get all card IDs from messages
        const cardIds = data
          .filter(m => m.card_data?.id)
          .map(m => m.card_data.id);

        // Check which cards still exist in the database
        let existingCardIds = new Set<string>();
        if (cardIds.length > 0) {
          const { data: existingCards } = await supabase
            .from('cards')
            .select('id')
            .in('id', cardIds);

          if (existingCards) {
            existingCardIds = new Set(existingCards.map(c => c.id));
          }
        }

        // Filter out messages with deleted cards
        const validMessages = data.filter(m => {
          // If message has no card, it's valid
          if (!m.card_data?.id) return true;
          // If card exists in database, it's valid
          return existingCardIds.has(m.card_data.id);
        });

        setMessages(validMessages.map(m => ({
          id: m.id,
          senderId: m.sender_id,
          senderName: m.sender_name,
          text: m.text,
          card: m.card_data,
          timestamp: new Date(m.created_at).getTime()
        })));
      }
    };
    fetchRoomDetails();
    fetchMessages();

    const channel = supabase.channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.new;
          setMessages(prev => [...prev, { id: m.id, senderId: m.sender_id, senderName: m.sender_name, text: m.text, card: m.card_data, timestamp: new Date(m.created_at).getTime() }]);
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => { setMessages(prev => prev.filter(m => m.id !== payload.old.id)); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.new;
          setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, card: m.card_data, text: m.text } : msg));
        })
      .on('broadcast', { event: 'chat-cleared' }, () => {
        setMessages([]);
        showToast('A conversa e as mídias da sala foram limpas.', 'info');
      })
      .on('broadcast', { event: 'paid-chat-update' }, (payload) => {
        if (payload?.payload?.config) {
          setPaidChatConfig(payload.payload.config);
          if (roomId) {
            localStorage.setItem(`paid_chat_config_${roomId}`, JSON.stringify(payload.payload.config));
          }
        }
      })
      .on('broadcast', { event: 'quick-phrases-update' }, (payload) => {
        if (payload?.payload?.phrases) {
          setQuickPhrasesConfig(payload.payload.phrases);
          if (roomId) {
            localStorage.setItem(`quick_phrases_${roomId}`, JSON.stringify(payload.payload.phrases));
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new;
          if (updated.admins) setRoomAdmins(new Set(updated.admins));
          if (updated.paid_chat_config) {
            setPaidChatConfig(updated.paid_chat_config);
          }
          if (updated.quick_phrases) {
            setQuickPhrasesConfig(updated.quick_phrases);
          }

          if (updated.watch_party_data) {
            setWatchPartySource(updated.watch_party_data.source);
            setWatchPartyCardId(updated.watch_party_data.card_id);
            setWatchPartyType(updated.watch_party_data.type);
            setWatchPartyHostId(updated.watch_party_data.host_id || null);
            setIsWatchPartyOpen(true);
            setActiveTab('cinema');
          } else {
            // Guard: don't close the modal if we're the one who triggered this stop
            // (i.e. user clicked "Novo Vídeo" and is choosing a new source)
            if (selectingNewVideoRef.current) {
              selectingNewVideoRef.current = false;
              setWatchPartySource(null);
              setWatchPartyCardId(null);
              setWatchPartyHostId(null);
              cleanupP2P();
              // Keep isWatchPartyOpen=true so the selection modal stays open
            } else {
              setIsWatchPartyOpen(false);
              setWatchPartySource(null);
              setWatchPartyCardId(null);
              setWatchPartyHostId(null);
              cleanupP2P();
            }
          }
        })
      .on('broadcast', { event: 'webrtc-signal' }, async (payload) => {
        const { senderId, targetId, type, data } = payload.payload;
        // Allow 'all' broadcasts (stream-ready) through for viewers; skip directed signals not for us
        if (targetId !== user.id && targetId !== 'all') return;

        // FIX 3: Host broadcasts 'stream-ready' → viewer responds immediately with join-request
        if (type === 'stream-ready') {
          if (!isWatchPartyHost && watchPartyHostId === senderId) {
            channel.send({
              type: 'broadcast',
              event: 'webrtc-signal',
              payload: { senderId: user.id, targetId: senderId, type: 'join-request' }
            });
          }
          return;
        }

        // FIX: Watch Party Decentralized Synchronization
        if (type === 'watch-party-update') {
          const updatedData = data;
          if (updatedData) {
            setWatchPartySource(updatedData.source);
            setWatchPartyCardId(updatedData.card_id);
            setWatchPartyType(updatedData.type);
            setWatchPartyHostId(updatedData.host_id || null);
            setWatchPartyVideoName(updatedData.video_name || null);
            if (updatedData.allowed_controllers) {
              setAllowedVideoControllers(new Set(updatedData.allowed_controllers));
            }
            setIsWatchPartyOpen(false);
            setActiveTab('cinema');
          } else {
            // Guard: if we are the sender and we're choosing a new video, skip the close
            if (senderId === user.id && selectingNewVideoRef.current) {
              return; // already handled synchronously in handleNewVideoSelection
            }
            setIsWatchPartyOpen(false);
            setWatchPartySource(null);
            setWatchPartyCardId(null);
            setWatchPartyHostId(null);
            setWatchPartyVideoName(null);
            setAllowedVideoControllers(new Set());
            cleanupP2P();
          }
          return;
        }

        if (type === 'allowed-controllers-update') {
          if (data && Array.isArray(data)) {
            setAllowedVideoControllers(new Set(data));
          }
          return;
        }

        if (type === 'get-watch-party-status') {
          if (isWatchPartyHost && watchPartySource) {
            channel.send({
              type: 'broadcast',
              event: 'webrtc-signal',
              payload: {
                senderId: user.id,
                targetId: senderId,
                type: 'watch-party-update',
                data: {
                  source: watchPartySource,
                  type: watchPartyType,
                  card_id: watchPartyCardId,
                  host_id: watchPartyHostId,
                  video_name: watchPartyVideoName,
                  allowed_controllers: Array.from(allowedVideoControllers)
                }
              }
            });
          }
          return;
        }

        if (type === 'watch-party-sync') {
          if (!isWatchPartyHost && data) {
            const video = viewerVideoRef.current;
            if (video) {
              const { action, time } = data;
              if (action === 'play') {
                if (Math.abs(video.currentTime - time) > 1.2) {
                  video.currentTime = time;
                }
                video.play().catch(e => console.log("Play sync blocked:", e));
              } else if (action === 'pause') {
                if (Math.abs(video.currentTime - time) > 1.2) {
                  video.currentTime = time;
                }
                video.pause();
              } else if (action === 'seek') {
                video.currentTime = time;
              } else if (action === 'heartbeat') {
                if (Math.abs(video.currentTime - time) > 2.5) {
                  video.currentTime = time;
                }
              }
            }
          }
          return;
        }

        if (type === 'join-request') {
          if (!isWatchPartyHost) return;
          const stream = localStreamRef.current;
          if (!stream) {
            pendingViewers.current.add(senderId);
            return;
          }
          
          if (peerConnections.current[senderId]) {
            try { peerConnections.current[senderId].close(); } catch (e) {}
            delete peerConnections.current[senderId];
          }

          const pc = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          });
          peerConnections.current[senderId] = pc;

          stream.getTracks().forEach(track => pc.addTrack(track, stream));

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              channel.send({
                type: 'broadcast',
                event: 'webrtc-signal',
                payload: {
                  senderId: user.id,
                  targetId: senderId,
                  type: 'candidate',
                  data: event.candidate
                }
              });
            }
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          channel.send({
            type: 'broadcast',
            event: 'webrtc-signal',
            payload: {
              senderId: user.id,
              targetId: senderId,
              type: 'offer',
              data: offer
            }
          });
        } 
        else if (type === 'offer') {
          if (peerConnections.current[senderId]) {
            try { peerConnections.current[senderId].close(); } catch (e) {}
          }
          const pc = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          });
          peerConnections.current[senderId] = pc;

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              channel.send({
                type: 'broadcast',
                event: 'webrtc-signal',
                payload: {
                  senderId: user.id,
                  targetId: senderId,
                  type: 'candidate',
                  data: event.candidate
                }
              });
            }
          };

          pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
              setRemoteStream(event.streams[0]);
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(data));
          
          // Process pending candidates queued before remoteDescription was set
          const pending = pendingCandidates.current[senderId];
          if (pending && pending.length > 0) {
            for (const cand of pending) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.log("Pending candidate err:", e));
            }
            pendingCandidates.current[senderId] = [];
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channel.send({
            type: 'broadcast',
            event: 'webrtc-signal',
            payload: {
              senderId: user.id,
              targetId: senderId,
              type: 'answer',
              data: answer
            }
          });
        } 
        else if (type === 'answer') {
          const pc = peerConnections.current[senderId];
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            
            // Process pending candidates queued before remoteDescription was set
            const pending = pendingCandidates.current[senderId];
            if (pending && pending.length > 0) {
              for (const cand of pending) {
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.log("Pending candidate err:", e));
              }
              pendingCandidates.current[senderId] = [];
            }
          }
        } 
        else if (type === 'candidate') {
          const pc = peerConnections.current[senderId];
          if (pc && data) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.error(e));
            } else {
              if (!pendingCandidates.current[senderId]) {
                pendingCandidates.current[senderId] = [];
              }
              pendingCandidates.current[senderId].push(data);
            }
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'webrtc-signal',
            payload: { senderId: user.id, targetId: 'all', type: 'get-watch-party-status' }
          });
        }
      });

    roomChannelRef.current = channel;
    setRoomChannel(channel);

    return () => {
      roomChannelRef.current = null;
      setRoomChannel(null);
      supabase.removeChannel(channel);
    };
  }, [roomId, isPrivateLocked, user.id, isWatchPartyHost]);

  // Incoming Messages & Creator Inbox Listener:
  // When a user writes to a creator's room (room_id = user.id), notify the creator and populate sessions
  useEffect(() => {
    if (!user?.id || !user.isLoggedIn) return;

    const fetchIncomingConversations = async () => {
      try {
        const { data: incomingMsgs } = await supabase
          .from('messages')
          .select('id, room_id, sender_id, sender_name, text, created_at')
          .eq('room_id', user.id)
          .neq('sender_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (incomingMsgs && incomingMsgs.length > 0) {
          const senderMap = new Map<string, any>();
          for (const msg of incomingMsgs) {
            if (!senderMap.has(msg.sender_id)) {
              senderMap.set(msg.sender_id, msg);
            }
          }

          setSessions(prev => {
            const next = [...prev];
            senderMap.forEach((msg) => {
              const sessionTitle = `Chat de: ${msg.sender_name || 'Usuário'}`;
              const exists = next.find(s => s.id === user.id);
              if (exists) {
                exists.name = sessionTitle;
                exists.lastMessage = msg.text || 'Nova mensagem recebida';
                exists.time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              } else {
                next.unshift({
                  id: user.id,
                  name: sessionTitle,
                  lastMessage: msg.text || 'Nova mensagem recebida',
                  time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  isActive: roomId === user.id
                });
              }
            });
            return next;
          });
        }
      } catch (err) {
        console.warn("Could not fetch incoming messages:", err);
      }
    };

    fetchIncomingConversations();

    // Subscribe to incoming messages directed to current user's room
    const inboxChannel = supabase.channel(`creator-inbox:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${user.id}`
      }, (payload) => {
        const msg = payload.new;
        if (msg.sender_id !== user.id) {
          if (onShowToast) {
            onShowToast(`Mensagem de ${msg.sender_name || 'Usuário'}: "${(msg.text || '').slice(0, 35)}"`, 'info');
          }
          setSessions(prev => {
            const next = [...prev];
            const sessionTitle = `Chat de: ${msg.sender_name || 'Usuário'}`;
            const exists = next.find(s => s.id === user.id);
            if (exists) {
              exists.name = sessionTitle;
              exists.lastMessage = msg.text || 'Nova mensagem';
              exists.time = 'Agora';
            } else {
              next.unshift({
                id: user.id,
                name: sessionTitle,
                lastMessage: msg.text || 'Nova mensagem',
                time: 'Agora',
                isActive: roomId === user.id
              });
            }
            return next;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(inboxChannel);
    };
  }, [user?.id, user?.isLoggedIn, roomId, onShowToast]);

  useEffect(() => {
    // Only scroll the specific internal chat container, NEVER window.scrollIntoView which moves/minimizes header
    if (activeTab === 'chat' && chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTo({
        top: chatScrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    } else if (activeTab === 'cinema' && cinemaChatContainerRef.current) {
      cinemaChatContainerRef.current.scrollTo({
        top: cinemaChatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
    // Guarantee window itself stays at top (0, 0)
    if (typeof window !== 'undefined' && window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  }, [messages, activeTab]);

  useEffect(() => {
    if (!activePayment) return;
    const channel = supabase.channel(`payment:${activePayment.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payment_transactions', filter: `id=eq.${activePayment.id}` },
        (payload) => {
          const updated = payload.new as PaymentTransaction;
          if (updated.status === 'approved') handleApprovedPayment(updated);
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activePayment]);

  useEffect(() => {
    return () => {
      if (quickStream) quickStream.getTracks().forEach(track => track.stop());
      clearInterval(recordingTimerRef.current);
    };
  }, [quickStream]);

  // --- HANDLERS ---

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user.isLoggedIn) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}.${fileExt}`; // Fixed filename for profile to avoid accumulation
    const filePath = `profiles/${fileName}`;

    // Use upsert to overwrite existing file
    const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      return alert('Erro ao subir foto. Verifique permissões ou tamanho do arquivo.');
    }

    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
    const publicUrlWithTimestamp = `${publicUrl}?t=${Date.now()}`; // Bust cache

    // Update Supabase
    await supabase.from('profiles').update({ profile_photo: publicUrlWithTimestamp }).eq('id', user.id);

    // Update local state and force re-render
    user.profilePhoto = publicUrlWithTimestamp;
    setProfileRefresh(prev => prev + 1);
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${roomId}_bg_${Date.now()}.${fileExt}`;
    const filePath = `room_assets/${fileName}`;

    let publicUrl = URL.createObjectURL(file);

    if (user.isLoggedIn && user.id) {
      try {
        const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file, { upsert: true });
        if (!uploadError) {
          const { data: { publicUrl: remoteUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
          publicUrl = remoteUrl || await blobToDataUrl(file);
        } else {
          publicUrl = await blobToDataUrl(file);
        }
        await supabase.from('rooms').upsert([{
          id: roomId,
          creator_id: user.id,
          name: roomDetails?.name || tempRoomName || 'Chat',
          image_url: roomDetails?.image_url,
          background_url: publicUrl
        }], { onConflict: 'id' });
      } catch (err) {
        console.warn('Error uploading background, using local fallback:', err);
        publicUrl = await blobToDataUrl(file);
      }
    }

    // Persist locally
    const updatedDetails = {
      ...(roomDetails || {}),
      name: roomDetails?.name || tempRoomName || 'Conversa',
      background_url: publicUrl
    };
    localStorage.setItem(`room_details_${roomId}`, JSON.stringify(updatedDetails));

    setRoomDetails(prev => prev ? { ...prev, background_url: publicUrl } : { name: 'Chat', background_url: publicUrl });
    showToast('Plano de fundo atualizado!', 'success');
  };

  const handleRoomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${roomId}_thumb_${Date.now()}.${fileExt}`;
    const filePath = `room_assets/${fileName}`;

    let publicUrl = URL.createObjectURL(file);

    if (user.isLoggedIn && user.id) {
      try {
        const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file, { upsert: true });
        if (!uploadError) {
          const { data: { publicUrl: remoteUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
          publicUrl = remoteUrl || await blobToDataUrl(file);
        } else {
          publicUrl = await blobToDataUrl(file);
        }
        await supabase.from('rooms').upsert([{
          id: roomId,
          creator_id: user.id,
          name: roomDetails?.name || tempRoomName || 'Chat',
          image_url: publicUrl,
          background_url: roomDetails?.background_url
        }], { onConflict: 'id' });
      } catch (err) {
        console.warn('Error uploading room image, using local fallback:', err);
        publicUrl = await blobToDataUrl(file);
      }
    }

    // Persist locally
    const updatedDetails = {
      ...(roomDetails || {}),
      name: roomDetails?.name || tempRoomName || 'Conversa',
      image_url: publicUrl
    };
    localStorage.setItem(`room_details_${roomId}`, JSON.stringify(updatedDetails));

    setRoomDetails(prev => prev ? { ...prev, image_url: publicUrl } : { name: 'Chat', image_url: publicUrl });
    showToast('Imagem da sala atualizada!', 'success');
  };

  const handleSaveRoomDetails = async () => {
    if (!roomId || !tempRoomName.trim()) return;

    const trimmedName = tempRoomName.trim();

    if (user.isLoggedIn && user.id) {
      try {
        const { error } = await supabase.from('rooms').upsert([{
          id: roomId,
          creator_id: user.id,
          name: trimmedName,
          image_url: roomDetails?.image_url,
          background_url: roomDetails?.background_url
        }], { onConflict: 'id' });

        if (error) {
          console.error('Room save error:', error);
        }
      } catch (err) {
        console.error('Room save exception:', err);
      }
    }

    // Persist locally
    const updatedDetails = {
      ...(roomDetails || {}),
      name: trimmedName,
      image_url: roomDetails?.image_url,
      background_url: roomDetails?.background_url
    };
    localStorage.setItem(`room_details_${roomId}`, JSON.stringify(updatedDetails));

    setRoomDetails(prev => prev ? { ...prev, name: trimmedName } : { name: trimmedName });
    setIsEditingRoom(false);
    showToast('Nome da sala atualizado!', 'success');

    // Update sidebar session name if exists
    setSessions(prev => prev.map(s => s.id === roomId ? { ...s, name: trimmedName } : s));
  };

  const handleCloseSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const remaining = sessions.filter(s => s.id !== sessionId);
    setSessions(remaining);
    if (roomId === sessionId) {
      if (remaining.length > 0) {
        navigate(`/chat/${remaining[0].id}`);
      } else {
        navigate('/');
      }
    }
  };

  const cleanupP2P = () => {
    Object.values(peerConnections.current).forEach(pc => {
      try { pc.close(); } catch (e) { console.error(e); }
    });
    peerConnections.current = {};
    pendingViewers.current.clear();
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) { console.error(e); }
      });
      setLocalStream(null);
    }
    setRemoteStream(null);
    setLocalVideoUrl(null);
  };

  // FIX 1: Capture stream as soon as video data is ready — no need to wait for Play
  const captureHostStream = () => {
    if (hostVideoRef.current && !localStreamRef.current) {
      const video = hostVideoRef.current;
      const stream = (video as any).captureStream
        ? (video as any).captureStream()
        : (video as any).mozCaptureStream
          ? (video as any).mozCaptureStream()
          : null;
      if (stream) {
        setLocalStream(stream);
      }
    }
  };

  const handleHostControlPlay = () => {
    captureHostStream();
    const video = hostVideoRef.current;
    if (!video) return;
    const activeChannel = roomChannel || roomChannelRef.current;
    if (activeChannel) {
      activeChannel.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: {
          senderId: user.id,
          targetId: 'all',
          type: 'watch-party-sync',
          data: { action: 'play', time: video.currentTime }
        }
      });
    }
  };

  const handleHostControlPause = () => {
    const video = hostVideoRef.current;
    if (!video) return;
    const activeChannel = roomChannel || roomChannelRef.current;
    if (activeChannel) {
      activeChannel.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: {
          senderId: user.id,
          targetId: 'all',
          type: 'watch-party-sync',
          data: { action: 'pause', time: video.currentTime }
        }
      });
    }
  };

  const handleHostControlSeek = () => {
    const video = hostVideoRef.current;
    if (!video) return;
    const activeChannel = roomChannel || roomChannelRef.current;
    if (activeChannel) {
      activeChannel.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: {
          senderId: user.id,
          targetId: 'all',
          type: 'watch-party-sync',
          data: { action: 'seek', time: video.currentTime }
        }
      });
    }
  };

  useEffect(() => {
    if (!isWatchPartyHost) return;
    const interval = setInterval(() => {
      const video = hostVideoRef.current;
      if (video && !video.paused) {
        const activeChannel = roomChannel || roomChannelRef.current;
        if (activeChannel) {
          activeChannel.send({
            type: 'broadcast',
            event: 'webrtc-signal',
            payload: {
              senderId: user.id,
              targetId: 'all',
              type: 'watch-party-sync',
              data: { action: 'heartbeat', time: video.currentTime }
            }
          });
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isWatchPartyHost, roomChannel, watchPartySource]);

  const handleHostPlay = () => handleHostControlPlay();

  const handleWatchPartyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Load local file using URL.createObjectURL
    const localUrl = URL.createObjectURL(file);
    setLocalVideoUrl(localUrl);

    // Save selection as type: 'video' and source: localUrl
    setWatchPartySelection({ source: localUrl, type: 'video' });
    setWatchPartyFile(file);

    // Persist file locally in IndexedDB
    try {
      if (roomId) {
        await saveVideoToLocalDB(file, roomId);
      }
      loadRecentVideos();
    } catch (err) {
      console.error("Failed to save video to local database:", err);
    }
  };

  const playRecentVideo = async (video: { file: File }) => {
    const url = URL.createObjectURL(video.file);
    setLocalVideoUrl(url);
    setWatchPartySource('p2p-stream');
    setWatchPartyType('video');
    setWatchPartyHostId(user.id);
    setIsWatchPartyOpen(true);
    setWatchPartyFile(video.file);
    broadcastWatchParty(url, 'video', undefined, video.file);
  };

  const deleteRecentVideo = async (id: number) => {
    try {
      await deleteVideoFromLocalDB(id);
      loadRecentVideos();
    } catch (e) {
      console.error("Failed to delete local video:", e);
    }
  };

  const startWatchPartyWithUrl = () => {
    if (!watchPartyInput.trim()) return;
    setWatchPartySelection({ source: watchPartyInput, type: 'url' });
    setWatchPartyInput('');
  };

  const broadcastWatchParty = async (source?: string, type?: 'video' | 'url', cardId?: string, fileToUpload?: File, skipUpload: boolean = false) => {
    if (!roomId) return;

    const finalSource = source || watchPartySelection?.source;
    const finalType = type || watchPartySelection?.type || 'url';
    const finalCardId = cardId || watchPartySelection?.cardId;

    if (!finalSource) return;

    let finalBroadCastSource = finalSource;
    let finalBroadCastType = finalType;
    
    const file = fileToUpload || watchPartyFile;
    const isLocalFile = finalSource.startsWith('blob:');

    // DATABASE UPLOAD FALLBACK: If it's a local video file, attempt to upload to Supabase Storage
    if (isLocalFile && file && !skipUpload) {
      setUploadingWatchParty(true);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${roomId}/watchparty/${fileName}`;
        
        showToast('Fazendo upload do vídeo para o servidor (Fallback)...', 'info');
        const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
        finalBroadCastSource = publicUrl;
        finalBroadCastType = 'video'; // Treat direct file stream as a direct HTTP url
        setLocalVideoUrl(publicUrl);
        
        // Clear file state since we're now streaming from URL
        setWatchPartyFile(null);
      } catch (e: any) {
        console.error("Failed to upload watch party video fallback:", e);
        showToast('Upload falhou. Transmitindo localmente via P2P...', 'info');
        // If upload fails, finalBroadCastSource remains the blob URL and it defaults to P2P below
      } finally {
        setUploadingWatchParty(false);
      }
    }

    // Check again if source is local or cloud
    const finalIsLocalFile = finalBroadCastSource.startsWith('blob:');
    const watchPartyData = finalIsLocalFile 
      ? { source: 'p2p-stream', type: 'video', card_id: finalCardId || null, host_id: user.id, video_name: file?.name || watchPartySelection?.name || null }
      : { source: finalBroadCastType === 'url' ? getEmbedUrl(finalBroadCastSource) : finalBroadCastSource, type: finalBroadCastType, card_id: finalCardId || null, video_name: null };

    const activeChannel = roomChannel || roomChannelRef.current;
    if (activeChannel) {
      activeChannel.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: { senderId: user.id, targetId: 'all', type: 'watch-party-update', data: watchPartyData }
      });
    }

    try {
      await supabase.from('rooms').update({
        watch_party_data: watchPartyData
      }).eq('id', roomId);
    } catch (e) {
      console.warn("Skipping room database update for guest/unauthorized user:", e);
    }

    if (roomId) {
      localStorage.setItem(`watch_party_${roomId}`, JSON.stringify(watchPartyData));
    }

    setWatchPartySource(watchPartyData.source);
    setWatchPartyType(watchPartyData.type as "video" | "url");
    setWatchPartyCardId(watchPartyData.card_id);
    setWatchPartyHostId(watchPartyData.host_id || null);
    setWatchPartyVideoName(watchPartyData.video_name || null);
    
    setWatchPartySelection(null);
    setIsWatchPartyOpen(false);
    setActiveTab('cinema');
    showToast('Vídeo enviado com sucesso!', 'success');
  };

  const stopWatchParty = async () => {
    if (roomId) {
      const activeChannel = roomChannel || roomChannelRef.current;
      if (activeChannel) {
        activeChannel.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { senderId: user.id, targetId: 'all', type: 'watch-party-update', data: null }
        });
      }

      try {
        await supabase.from('rooms').update({
          watch_party_data: null
        }).eq('id', roomId);
      } catch (e) {
        console.warn("Skipping room database update for guest/unauthorized user:", e);
      }

      if (roomId) {
        localStorage.removeItem(`watch_party_${roomId}`);
      }

      setWatchPartySource(null);
      setWatchPartyCardId(null);
      setWatchPartyHostId(null);
      cleanupP2P();
    } else {
      // For non-host viewers, close the local overlay & disconnect.
      // Do not nullify source, so we can re-open Cinema.
      cleanupP2P();
    }

    setIsWatchPartyOpen(false);
  };

  const handleNewVideoSelection = () => {
    // Set guard BEFORE any async events fire, so self-triggered stop events
    // (broadcast echo + postgres_changes) don't close the selection modal.
    selectingNewVideoRef.current = true;

    // Clear all watch-party state SYNCHRONOUSLY so React batches everything
    // in ONE render: watchPartySource=null + isWatchPartyOpen=true → modal appears
    setWatchPartySource(null);
    setWatchPartyCardId(null);
    setWatchPartyHostId(null);
    setWatchPartySelection(null);
    setWatchPartyInput('');
    setIsWatchPartyOpen(true);   // open the selection modal immediately
    cleanupP2P();

    // Notify others via broadcast (they don't have selectingNewVideoRef=true so they DO close)
    const activeChannel = roomChannel || roomChannelRef.current;
    if (activeChannel) {
      activeChannel.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: { senderId: user.id, targetId: 'all', type: 'watch-party-update', data: null }
      });
    }
    // DB update notifies other users via postgres_changes (guard prevents it closing our modal)
    if (roomId) {
      localStorage.removeItem(`watch_party_${roomId}`);
      supabase.from('rooms').update({ watch_party_data: null }).eq('id', roomId).then(({ error }) => {
        if (error) console.warn('Background room clear failed:', error);
      });
    }
  };

  const onCardCreated = async (card: MediaCard) => {
    // OPTIMISTIC UPDATE: IMMEDIATELY UPDATE LOCAL STATE
    if (editingCard) {
      // 1. Update Messages
      if (roomId) {
        setMessages(prev => prev.map(msg =>
          msg.card?.id === editingCard.id ? { ...msg, card: { ...msg.card, ...card } } : msg
        ));
      }

      // 2. Update My Cards (regardless of tab, to be safe)
      setMyCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, ...card } : c));

      // 3. Clear modal state immediately
      setIsCardModalOpen(false);
      setEditingCard(null);

      // 4. Perform async updates
      const { error } = await supabase.from('messages')
        .update({ card_data: card })
        .contains('card_data', { id: editingCard.id });

      if (error) showToast('Erro ao sincronizar atualização.', 'error'); // Only annoy user if it fails

      await supabase.from('cards').update({
        title: card.title,
        description: card.description,
        credit_cost: card.creditCost,
        group: card.group,
        tags: card.tags,
        thumbnail: card.thumbnail,
        media_url: card.mediaUrl,
        repeat_interval: card.repeatInterval,
        category: card.category,
        is_blur: card.isBlur,
        blur_level: card.blurLevel,
        default_width: card.defaultWidth,
        card_color: card.cardColor,
        layout_style: card.layoutStyle
      }).eq('id', editingCard.id);

    } else {
      // CREATE new message
      setIsCardModalOpen(false);

      const shouldPostToChat = card.postToChat !== false;

      if (roomId && shouldPostToChat) {
        const { error } = await supabase.from('messages').insert([{
          room_id: roomId,
          sender_id: user.id,
          sender_name: user.name,
          card_data: card
        }]);
        if (error) {
          console.error('Error creating card message:', error);
          showToast('Erro ao criar card no chat.', 'error');
        } else {
          showToast('Card publicado no chat e na vitrine!', 'success');
        }
      } else {
        showToast('Card publicado exclusivamente na vitrine!', 'success');
      }

      if (card.type === CardType.CHAT && shouldPostToChat) addPrivateSession(card.id, card.title);
      if (card.saveToGallery && user.isLoggedIn) {
        await supabase.from('cards').upsert([{
          id: card.id,
          creator_id: user.id,
          type: card.type,
          title: card.title,
          description: card.description,
          thumbnail: card.thumbnail,
          credit_cost: card.creditCost,
          media_url: card.mediaUrl,
          category: card.category,
          tags: card.tags,
          duration: card.duration,
          is_blur: card.isBlur,
          blur_level: card.blurLevel,
          default_width: card.defaultWidth,
          group: card.group,
          repeat_interval: card.repeatInterval,
          card_color: card.cardColor,
          layout_style: card.layoutStyle
        }]);
        // Update My Cards optimistically for new create too
        setMyCards(prev => [card, ...prev.filter(c => c.id !== card.id)]);
      }
    }
  };

  const handleEditCard = (card: MediaCard) => {
    setEditingCard(card);
    setIsCardModalOpen(true);
  };

  const handleDeleteCard = async (cardId: string) => {
    // First, fetch all messages that contain this card (in ALL rooms, not just current)
    const { data: messagesToDelete } = await supabase
      .from('messages')
      .select('id')
      .contains('card_data', { id: cardId });

    // Delete each message by ID
    if (messagesToDelete && messagesToDelete.length > 0) {
      const messageIds = messagesToDelete.map(m => m.id);
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .in('id', messageIds);

      if (msgError) {
        console.error('Error deleting messages:', msgError);
        showToast('Erro ao excluir card do chat.', 'error');
        return;
      }
    }

    // Delete from cards table - THIS IS CRITICAL
    const { error: cardError } = await supabase
      .from('cards')
      .delete()
      .eq('id', cardId);

    if (cardError) {
      console.error('Error deleting from cards:', cardError);
      showToast('Erro ao excluir card da galeria.', 'error');
    } else {
      showToast('Card excluído permanentemente!', 'success');
    }

    // Update local state immediately
    setMessages(prev => prev.filter(msg => msg.card?.id !== cardId));
    if (activeTab === 'my_cards') {
      setMyCards(prev => prev.filter(c => c.id !== cardId));
    }
  };

  const handleClearChat = async () => {
    if (!roomId) return;
    setIsClearingChat(true);
    try {
      // 1. Delete all messages for this room from Supabase
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', roomId);

      if (error) {
        console.warn('Error deleting messages from Supabase:', error.message);
      }

      // 2. Broadcast clear event to other connected peers in the room
      if (roomChannelRef.current) {
        roomChannelRef.current.send({
          type: 'broadcast',
          event: 'chat-cleared',
          payload: { roomId, timestamp: Date.now() }
        });
      }

      // 3. Clear local messages state
      setMessages([]);
      setIsClearChatModalOpen(false);
      showToast('Conversa e mídias do chat limpas com sucesso!', 'success');
    } catch (err: any) {
      console.error('Error in handleClearChat:', err);
      setMessages([]);
      setIsClearChatModalOpen(false);
      showToast('Chat limpo localmente.', 'info');
    } finally {
      setIsClearingChat(false);
    }
  };

  const handleSavePaymentKey = async () => {
    // Save the current key to the DB profile
    if (!user.isLoggedIn) return;
    const updateData: any = {};
    if (withdrawalMethod === 'pix') updateData.pix_key = withdrawalKey;
    if (withdrawalMethod === 'picpay') updateData.picpay_email = withdrawalKey;
    if (withdrawalMethod === 'paypal') updateData.paypal_email = withdrawalKey;
    if (withdrawalMethod === 'stripe') updateData.stripe_email = withdrawalKey;

    await supabase.from('profiles').update(updateData).eq('id', user.id);

    // Update local state
    if (withdrawalMethod === 'pix') user.pixKey = withdrawalKey;
    else if (withdrawalMethod === 'picpay') user.picpayEmail = withdrawalKey;
    else if (withdrawalMethod === 'paypal') user.paypalEmail = withdrawalKey;
    else if (withdrawalMethod === 'stripe') user.stripeEmail = withdrawalKey;
  }

  const handleWithdraw = async () => {
    if (!withdrawalKey) { showToast("Por favor, preencha os dados de pagamento.", 'error'); return; }
    if (!withdrawalCpf || !withdrawalFullName) { showToast("Por favor, preencha seu CPF e Nome Completo para verificação.", 'error'); return; }

    setWithdrawalPending(true);
    await handleSavePaymentKey(); // Ensure saved

    // Save withdrawal request to history
    const { error } = await supabase.from('withdrawals').insert([{
      user_id: user.id,
      amount: user.earnings,
      method: withdrawalMethod,
      target_key: withdrawalKey,
      cpf: withdrawalCpf,
      full_name: withdrawalFullName,
      status: 'pending',
      estimated_payout_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
    }]);

    if (error) {
      alert("Erro ao solicitar saque.");
    } else {
      alert("Solicitação de saque enviada! O processamento leva 24 horas.");
      setShowEarningsModal(false);
    }
    setWithdrawalPending(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // ... (Keep existing helpers like addPrivateSession, handleInteractWithCard, etc.) ...
  const addPrivateSession = (cardId: string, title: string) => {
    const sessionId = `priv-${cardId}`;
    if (!sessions.find(s => s.id === sessionId)) {
      setSessions(prev => [{ id: sessionId, name: `Privado: ${title}`, lastMessage: 'Sessão iniciada', time: 'Agora', isActive: false }, ...prev]);
    }
  };

  const handleInteractWithCard = async (card: MediaCard): Promise<boolean> => {
    if (card.type === CardType.CHAT) {
      addPrivateSession(card.id, card.title);
      navigate(`/chat/priv-${card.id}`);
      return true;
    }
    const isMyCard = user.id === card.id || (card as any).creator_id === user.id;
    const isPurchased = purchasedCardIds.has(card.id);

    if (!isMyCard && !isPurchased) {
      if (user.credits < card.creditCost) { openWallet('recharge'); return false; }

      const useFreeCredits = (user.free_credits || 0) >= card.creditCost;

      if (useFreeCredits) {
        // Use free credits - no earnings for creator, not recorded as sale in creator's list
        updateFreeCredits(-card.creditCost);

        if (user.isLoggedIn) {
          const { data: cardData } = await supabase.from('cards').select('creator_id').eq('id', card.id).single();
          // Log transaction as FREE
          await supabase.from('sales_transactions').insert([{
            seller_id: cardData?.creator_id || null,
            buyer_id: user.id,
            buyer_name: user.name,
            card_id: card.id,
            card_title: card.title,
            amount: 0, // No earnings
            is_free: true
          }]);
        }

        setPurchasedCardIds(prev => new Set(prev).add(card.id));
        showToast('Desbloqueado com Créditos Gratuitos!', 'success');
      } else {
        // Regular paid purchase
        updateCredits(-card.creditCost);
        const earnings = Math.floor(card.creditCost * 0.8);
        if (user.isLoggedIn) {
          const { data: cardData } = await supabase.from('cards').select('creator_id').eq('id', card.id).single();
          if (cardData && cardData.creator_id) {
            const { error: rpcError } = await supabase.rpc('process_card_purchase', { 
              p_card_id: card.id, 
              p_buyer_id: user.id, 
              p_creator_id: cardData.creator_id, 
              p_amount: card.creditCost, 
              p_earnings: earnings,
              p_card_title: card.title || 'Card',
              p_buyer_name: user.name || 'Usuário'
            });

            if (rpcError) {
              console.warn("RPC process_card_purchase error, executing fallback:", rpcError);
              // Fallback log transaction for frontend history
              await supabase.from('sales_transactions').insert([{
                seller_id: cardData.creator_id,
                buyer_id: user.id,
                buyer_name: user.name || 'Usuário',
                card_id: card.id,
                card_title: card.title || 'Card',
                amount: earnings,
                is_free: false
              }]);
            }
          }
          setPurchasedCardIds(prev => new Set(prev).add(card.id));
        }
      }
    }
    return true;
  };

  const handleApprovedPayment = (transaction: PaymentTransaction) => {
    if (activePayment?.status === 'approved') return;
    setActivePayment(transaction);
    updateCredits(transaction.credits_amount);
    setTimeout(() => { setShowQrCode(false); setActivePayment(null); setPaymentAmount(null); alert(`Pagamento confirmado! +${transaction.credits_amount} créditos.`); }, 2500);
  };

  const handleCreateNewSession = async () => {
    const newId = 'room-' + Math.random().toString(36).substr(2, 6);
    const newSession = { id: newId, name: `Nova Sala: ${newId.split('-')[1]}`, lastMessage: 'Chat iniciado', time: 'Agora', isActive: false };
    setSessions(prev => [newSession, ...prev]);
    navigate(`/chat/${newId}`);
    showToast('Nova sala criada!', 'success');
    // Persist the room immediately so creator_id is stored and isHost works on first load
    try {
      await supabase.from('rooms').upsert([{
        id: newId,
        creator_id: user.id,
        name: `Nova Sala: ${newId.split('-')[1]}`,
        admins: [user.id]
      }], { onConflict: 'id' });
    } catch (e) {
      console.warn('Could not persist new room to DB:', e);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || !roomId) return;

    if (isChatPausedDueToRenewal && !isHost) {
      setIsRenewalModalOpen(true);
      showToast('O tempo do chat expirou. Renove para continuar enviando mensagens.', 'warning');
      return;
    }

    if (textToSend === undefined) {
      setInputText('');
    }

    try {
      const { error } = await supabase.from('messages').insert([{ 
        room_id: roomId, 
        sender_id: user.id, 
        sender_name: user.name, 
        text: text 
      }]);
      if (error) {
        console.warn('Supabase insert message error (fallback to local):', error);
        // Fallback optimistic message
        const optimisticMsg: Message = {
          id: 'msg_' + Math.random().toString(36).substring(2, 10),
          senderId: user.id,
          senderName: user.name,
          text: text,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, optimisticMsg]);
      }
    } catch (e) {
      console.warn('Network error sending message, adding locally:', e);
      const optimisticMsg: Message = {
        id: 'msg_' + Math.random().toString(36).substring(2, 10),
        senderId: user.id,
        senderName: user.name,
        text: text,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, optimisticMsg]);
    }
  };

  const handleSendQuickPhrase = (phrase: string) => {
    handleSendMessage(phrase);
  };

  // Quick Action functions
  const createQuickCard = (mediaUrl: string, type: CardType, thumbnail?: string) => {
    // Generate static thumbnail for specific types if not provided
    let finalThumbnail = thumbnail || mediaUrl;
    if (!thumbnail) {
      if (type === CardType.AUDIO) finalThumbnail = "https://images.unsplash.com/photo-1478737270239-2f02b77ac6d5?auto=format&fit=crop&w=500&q=80"; // Minimalist Audio Wave
      if (type === CardType.CHAT) finalThumbnail = "https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&w=500&q=80"; // Minimalist Chat
    }

    const newCard: MediaCard = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title: quickDefaults.title, // Use Default
      description: quickDefaults.description, // Use Default
      creditCost: quickDefaults.creditCost, // Use Default
      category: quickDefaults.category, // Use Default
      group: quickDefaults.group, // Use Default
      tags: quickDefaults.tags.split(',').map(t => t.trim()), // Use Default
      duration: quickDefaults.duration, // Use Default
      expirySeconds: quickDefaults.expirySeconds, // Use Default
      repeatInterval: quickDefaults.repeatInterval, // Use Default
      isBlur: quickDefaults.blurLevel > 0, // Use Default
      blurLevel: quickDefaults.blurLevel, // Use Default
      saveToGallery: false,
      createdAt: Date.now(),
      mediaType: 'upload',
      mediaUrl: mediaUrl,
      thumbnail: finalThumbnail,
      defaultWidth: quickDefaults.defaultWidth, // Use Default
      layoutStyle: quickDefaults.layoutStyle, // Use Default
      cardColor: quickDefaults.cardColor // Use Default
    };
    onCardCreated(newCard);
    showToast('Card criado com configurações padrão!', 'success');
  };

  const handleInsertToRoom = (card: MediaCard) => {
    // Open Selector instead of direct insert
    setCardToInsert(card);
    setIsRoomSelectorOpen(true);
  };

  const confirmInsertToRoom = async (targetRoomId: string) => {
    if (!cardToInsert) return;
    const { error } = await supabase.from('messages').insert([{
      room_id: targetRoomId,
      sender_id: user.id,
      sender_name: user.name,
      card_id: cardToInsert.id,
      card_data: cardToInsert, // Ensure data is carried over
      text: null
    }]);
    if (error) showToast('Erro ao inserir card no chat', 'error');
    else {
      showToast(`Card enviado para ${sessions.find(s => s.id === targetRoomId)?.name || 'a sala'}`, 'success');
      setIsRoomSelectorOpen(false);
      setCardToInsert(null);
      // If we are currently in that room, it will auto-update via subscription
      if (roomId === targetRoomId) {
        // Optimistic add? - Subscription is usually fast enough for new messsages
      }
    }
    setIsMobileMenuOpen(false);
  };

  const handleSchedule = (card: MediaCard) => {
    const time = prompt("Em quantos minutos deseja programar este card para aparecer?", "10");
    if (time) {
      const minutes = parseInt(time);
      if (!isNaN(minutes)) {
        setTimeout(() => {
          handleInsertToRoom(card);
          showToast(`Card "${card.title}" foi postado automaticamente!`, 'success');
        }, minutes * 60000);
        showToast(`Card programado para daqui a ${minutes} minutos.`, 'info');
      }
    }
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user.isLoggedIn) {
      openAuth();
      return;
    }

    setIsUploading(true);
    try {
      let type = CardType.IMAGE;
      if (file.type.startsWith('video/')) type = CardType.VIDEO;
      if (file.type.startsWith('audio/')) type = CardType.AUDIO;

      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${user.id}_upload_${Date.now()}.${fileExt}`;
      const filePath = `quick_actions/${fileName}`;

      const publicUrl = await uploadMediaToSupabase(file, filePath, file.type);

      if (publicUrl) {
        createQuickCard(publicUrl, type, type === CardType.IMAGE ? publicUrl : undefined);
        showToast('Upload concluído com sucesso!', 'success');
      } else {
        const fallbackUrl = await blobToDataUrl(file);
        createQuickCard(fallbackUrl, type, type === CardType.IMAGE ? fallbackUrl : undefined);
        showToast('Upload concluído!', 'success');
      }
    } catch (err) {
      console.error(err);
      try {
        let type = CardType.IMAGE;
        if (file.type.startsWith('video/')) type = CardType.VIDEO;
        if (file.type.startsWith('audio/')) type = CardType.AUDIO;
        const fallbackUrl = await blobToDataUrl(file);
        createQuickCard(fallbackUrl, type, type === CardType.IMAGE ? fallbackUrl : undefined);
        showToast('Upload concluído!', 'success');
      } catch {
        showToast('Erro ao fazer upload.', 'error');
      }
    } finally {
      setIsUploading(false);
      if (quickUploadRef.current) quickUploadRef.current.value = '';
    }
  };

  const startQuickRecording = async (type: 'audio' | 'video' | 'photo') => {
    try {
      cleanupQuickRecording();
      let stream: MediaStream;
      if (type === 'audio') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: type === 'video',
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
        } catch (firstErr) {
          console.warn("Retrying getUserMedia with basic constraints:", firstErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: type === 'video',
              video: true
            });
          } catch (secondErr) {
            console.warn("Retrying video-only getUserMedia:", secondErr);
            stream = await navigator.mediaDevices.getUserMedia({
              video: true
            });
          }
        }
      }

      setQuickStream(stream);
      setQuickRecordingType(type);
      setIsQuickRecording(true);
      setRecordingTime(0);
      setIsReviewing(false);
      setQuickMediaPreview(null);

      // Attach stream to video preview directly
      setTimeout(() => {
        if (quickVideoRef.current && (type === 'video' || type === 'photo')) {
          quickVideoRef.current.muted = true;
          quickVideoRef.current.playsInline = true;
          quickVideoRef.current.srcObject = stream;
          quickVideoRef.current.play().catch(e => console.log("Direct preview error:", e));
        }
      }, 50);

      if (type !== 'photo') {
        let options: MediaRecorderOptions = {};
        if (type === 'video') {
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

        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => {
          if (chunksRef.current.length === 0) {
            console.error('No data recorded');
            showToast('Nenhum dado gravado. Tente novamente.', 'error');
            cleanupQuickRecording();
            return;
          }
          const actualMime = recorder.mimeType || (type === 'video' ? 'video/webm' : 'audio/webm');
          const blob = new Blob(chunksRef.current, { type: actualMime });
          const url = URL.createObjectURL(blob);
          setQuickMediaPreview(url);
          setIsReviewing(true);

          // Stop stream tracks to release camera/mic immediately after capture
          stream.getTracks().forEach(t => t.stop());
          clearInterval(recordingTimerRef.current);
        };

        // Timeslice 500ms ensures chunks are captured continuously
        recorder.start(500);
        recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      }
    } catch (err: any) {
      console.error("Camera/Mic access error:", err);
      if (type === 'photo' && quickUploadRef.current) {
        showToast('Câmera indisponível ou permissão negada. Abrindo seleção de imagem...', 'info');
        quickUploadRef.current.click();
        return;
      }
      showToast('Erro ao acessar mídia. Verifique as permissões do seu navegador.', 'error');
    }
  };

  const handleQuickPhotoCapture = () => {
    if (!quickVideoRef.current || !quickStream) {
      showToast('Aguarde a câmera inicializar...', 'info');
      return;
    }

    // Check if video is ready
    if (quickVideoRef.current.videoWidth === 0 || quickVideoRef.current.videoHeight === 0) {
      showToast('Câmera ainda não está pronta. Aguarde...', 'info');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = quickVideoRef.current.videoWidth;
    canvas.height = quickVideoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Draw the video frame (flip horizontally for mirror effect)
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(quickVideoRef.current, 0, 0);

      // Convert to blob for proper upload
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setQuickMediaPreview(url);
          setIsReviewing(true);

          // Stop camera stream
          if (quickStream) {
            quickStream.getTracks().forEach(t => t.stop());
            setQuickStream(null);
          }
        }
      }, 'image/png');
    }
  };

  const stopQuickRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else { cleanupQuickRecording(); }
  };

  const cancelQuickRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Remove onstop handler to prevent creation
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanupQuickRecording();
  };

  const uploadMediaToSupabase = async (blob: Blob, path: string, contentType?: string): Promise<string | null> => {
    try {
      const options: any = { upsert: true };
      if (contentType) options.contentType = contentType;
      const { error } = await supabase.storage.from('media').upload(path, blob, options);
      if (error) {
        console.warn('Supabase storage upload error, using local fallback:', error.message);
        return await blobToDataUrl(blob);
      }
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
      return publicUrl || await blobToDataUrl(blob);
    } catch (e) {
      console.warn('Upload exception, using local fallback:', e);
      return await blobToDataUrl(blob);
    }
  };

  const confirmQuickRecording = async () => {
    if (!quickMediaPreview || !quickRecordingType || !user.isLoggedIn) {
      if (!user.isLoggedIn) openAuth();
      return;
    }

    setIsUploading(true);
    let type = CardType.IMAGE;
    if (quickRecordingType === 'video') type = CardType.VIDEO;
    if (quickRecordingType === 'audio') type = CardType.AUDIO;

    try {
      // Fetch blob from blob: URL or data: URL
      const response = await fetch(quickMediaPreview);
      const blob = await response.blob();

      const ext = quickRecordingType === 'video' ? 'webm' : quickRecordingType === 'audio' ? 'webm' : 'png';
      const mimeType = quickRecordingType === 'video' ? 'video/webm' : quickRecordingType === 'audio' ? 'audio/webm' : 'image/png';
      const fileName = `${user.id}_quick_${Date.now()}.${ext}`;
      const filePath = `quick_actions/${fileName}`;

      const publicUrl = await uploadMediaToSupabase(blob, filePath, mimeType);

      if (publicUrl) {
        createQuickCard(publicUrl, type, quickRecordingType === 'photo' ? publicUrl : undefined);
        showToast('Conteúdo enviado com sucesso!', 'success');
      } else {
        showToast('Erro ao enviar mídia. Tente novamente.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao processar mídia.', 'error');
    } finally {
      setIsUploading(false);
      cleanupQuickRecording();
    }
  };

  const cleanupQuickRecording = () => {
    if (quickStream) quickStream.getTracks().forEach(t => t.stop());
    clearInterval(recordingTimerRef.current);
    setIsQuickRecording(false);
    setQuickStream(null);
    setQuickRecordingType(null);
    setRecordingTime(0);
    setIsReviewing(false);
    setQuickMediaPreview(null);
  };

  const handleGeneratePix = async (amountOverride?: number) => {
    const amountToUse = amountOverride || paymentAmount;
    if (!amountToUse || !user.isLoggedIn) { if (!user.isLoggedIn) openAuth(); return; }

    if (amountOverride) setPaymentAmount(amountOverride);

    setIsGeneratingPix(true);
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser || !authUser.email) throw new Error("Erro auth.");
      const creditsMap: Record<number, number> = { 5: 50, 10: 120, 20: 300 };
      const credits = creditsMap[amountToUse] || amountToUse * 10;
      const { data, error } = await supabase.functions.invoke('mercadopago-create-payment', { body: JSON.stringify({ amount: amountToUse, description: `${credits} Créditos`, user_id: user.id, credits: credits, email: authUser.email }), headers: { 'Content-Type': 'application/json' } });
      if (error || !data) throw new Error(error?.message || "Erro backend.");
      setActivePayment({ id: data.payment_id_db || data.id, mp_payment_id: data.mp_payment_id || data.id, qr_code: data.qr_code, qr_code_base64: data.qr_code_base64, status: 'pending', amount: amountToUse, credits_amount: credits });
    } catch (err: any) { alert(`Falha PIX: ${err.message}`); } finally { setIsGeneratingPix(false); }
  };

  const handleCheckStatus = async () => {
    if (!activePayment) return;
    setIsCheckingStatus(true);
    try {
      let { data } = await supabase.from('payment_transactions').select('*').eq('id', activePayment.id).single();
      const mpId = data?.mp_payment_id || activePayment.mp_payment_id;
      if (data && data.status !== 'approved' && mpId) {
        try {
          await supabase.functions.invoke('mercadopago-webhook', { body: { type: 'payment', data: { id: mpId } } });
          const refetch = await supabase.from('payment_transactions').select('*').eq('id', activePayment.id).single();
          if (refetch.data) data = refetch.data;
        } catch (e) {
          console.warn('Webhook sync check error:', e);
        }
      }
      if (data && data.status === 'approved') handleApprovedPayment(data as PaymentTransaction);
      else alert("Pagamento ainda em processamento pelo Mercado Pago...");
    } finally { setIsCheckingStatus(false); }
  };

  const handleCopyPix = () => {
    if (activePayment?.qr_code) { navigator.clipboard.writeText(activePayment.qr_code); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const SidebarContent = () => (
    <div className={`flex flex-col h-full ${colors.sidebarBg} transition-colors duration-300`}>
      <div className={`p-6 flex flex-col items-center border-b ${colors.border} gap-4`}>
        <div className="flex items-center justify-center gap-4 w-full">
          <div onClick={() => user.isLoggedIn ? fileInputRef.current?.click() : openAuth()} className={`relative w-16 h-16 rounded-[2rem] border-2 ${colors.border} flex items-center justify-center cursor-pointer overflow-hidden group shadow-lg ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
            {user.profilePhoto ? <img src={user.profilePhoto} className="w-full h-full object-cover" key={profileRefresh} /> : <UserIcon size={32} className="text-slate-500" />}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={20} className="text-white" /></div>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
          </div>
          {/* Earnings Icon in Sidebar */}
          {user.isLoggedIn && (
            <button 
              type="button"
              onClick={() => openWallet('earnings')} 
              className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
              title="Central de Ganhos"
            >
              <DollarSign size={20} />
              <span className="text-[9px] font-black">{user.earnings}</span>
            </button>
          )}
          {/* Highlighted Settings/Config Icon in Sidebar Header */}
          <button 
            type="button"
            onClick={() => { 
              setQuickSettingsTab('paid_chat');
              setIsQuickSettingsOpen(true); 
            }} 
            className={`w-12 h-12 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer relative shadow-sm ${
              paidChatConfig.enabled 
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30 ring-2 ring-blue-500/20' 
                : (isDark ? 'bg-slate-800 text-slate-400 border-slate-700/50 hover:bg-slate-700 hover:text-white' : 'bg-gray-100 text-slate-600 border-gray-200 hover:bg-gray-200')
            }`}
            title="Ajustes da Sala: Tempo de Chat, Frases e Cards"
          >
            <Settings size={20} />
            {paidChatConfig.enabled && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-slate-900 animate-pulse" />
            )}
          </button>
        </div>
        {!isSidebarCollapsed && (
          <div className="w-full text-center animate-in fade-in space-y-3">
            <div>
              <h2 className={`text-xs font-black ${colors.textHighlight} uppercase tracking-[0.2em]`}>{user.name}</h2>
              <div className="flex flex-col items-center gap-1.5 mt-1">
                <p className={`text-[9px] ${colors.text} font-bold uppercase`}>{user.isLoggedIn ? 'Autenticado' : 'Visitante'}</p>
                {user.isLoggedIn && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openWallet('followers');
                    }}
                    className="inline-flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 transition-all text-[9px] font-black uppercase tracking-wider mx-auto active:scale-95 shadow-xs cursor-pointer"
                    title="Ver quem te segue e seus seguidores"
                  >
                    <Users size={11} />
                    <span>{followersCount} Seguidores</span>
                    <span className="opacity-40">•</span>
                    <span>{followingCount} Seguindo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Wallet & Deposit Banner in Sidebar */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                openWallet('recharge');
              }}
              className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95 shadow-sm"
              title="Carteira & Depositar Créditos"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-500">
                  <Wallet size={16} />
                </div>
                <div className="text-left">
                  <span className="text-[8px] font-black uppercase tracking-wider block text-slate-500 dark:text-slate-400">Saldo</span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{user.credits} Créditos</span>
                </div>
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 px-2.5 py-1 rounded-xl shadow-sm">
                Depositar
              </span>
            </button>
          </div>
        )}
      </div>
      <div className="p-4 flex items-center justify-between">
        {!isSidebarCollapsed && <h1 className={`text-[10px] font-black ${colors.text} tracking-[0.3em] uppercase`}>Conversas</h1>}
        <button onClick={handleCreateNewSession} className={`p-1.5 ${colors.primarySoft} ${colors.primaryText} rounded-lg hover:opacity-80 transition-all border ${colors.primaryBorder} ${isSidebarCollapsed ? 'mx-auto' : ''}`}><Plus size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
        {sessions.map(session => {
          const isActive = roomId === session.id;
          const currentRoomDetails = isActive ? roomDetails : null; // We only have details for current room easily
          const displayImage = currentRoomDetails?.image_url || null;
          const isOtherUserRoom = session.id !== user.id && !session.id.startsWith('priv-') && !session.id.startsWith('room-');

          // Check if this specific session has paid chat enabled
          let sessionPaidConfig: PaidChatConfig | null = null;
          if (session.id === roomId) {
            sessionPaidConfig = paidChatConfig;
          } else {
            try {
              const saved = localStorage.getItem(`paid_chat_config_${session.id}`);
              if (saved) sessionPaidConfig = JSON.parse(saved);
            } catch (e) {}
          }
          const isSessionPaidActive = Boolean(sessionPaidConfig?.enabled);

          return (
            <div 
              key={session.id} 
              onClick={() => { navigate(`/chat/${session.id}`); setIsMobileMenuOpen(false); }} 
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 group ${
                isActive 
                  ? (isDark 
                      ? 'bg-blue-950/70 border-blue-500/80 text-white shadow-md ring-1 ring-blue-500/40' 
                      : 'bg-red-50 border-red-400 text-slate-900 shadow-sm ring-1 ring-red-400/30')
                  : (isDark 
                      ? 'bg-slate-900/60 border-slate-800/80 text-slate-200 hover:bg-slate-800 hover:border-slate-700' 
                      : 'bg-white border-gray-200 text-slate-800 hover:bg-gray-100 hover:border-gray-300')
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            >
              <div className={`w-10 h-10 min-w-[2.5rem] rounded-xl flex items-center justify-center transition-colors overflow-hidden ${
                isActive 
                  ? `${colors.primary} text-white shadow-lg` 
                  : (isDark ? 'bg-slate-800 text-slate-400 group-hover:text-white' : 'bg-slate-100 text-slate-500 group-hover:text-slate-900')
              }`}>
                {displayImage ? (
                  <img src={displayImage} className="w-full h-full object-cover" />
                ) : (
                  session.id.startsWith('priv-') ? <Settings size={16} /> : <MessageSquare size={18} />
                )}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0 animate-in fade-in">
                  <div className="flex justify-between items-start gap-1.5">
                    <div className="flex flex-col min-w-0 flex-1">
                      <h3 className={`text-sm font-bold truncate ${
                        isOtherUserRoom 
                          ? 'text-blue-400' 
                          : (isActive ? (isDark ? 'text-blue-200 font-black' : 'text-red-700 font-black') : (isDark ? 'text-slate-100' : 'text-slate-900'))
                      }`}>
                        {isActive && roomDetails?.name ? roomDetails.name : session.name}
                      </h3>
                      {isOtherUserRoom && (
                        <span className="text-[8px] text-blue-400 font-black uppercase tracking-wider mt-0.5">
                          Sala de outro usuário ({session.id.slice(0, 6)})
                        </span>
                      )}
                    </div>

                    {/* Action buttons: Per-chat customized Tempo & Frases + Close */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleOpenSessionSettings(
                          session.id, 
                          isActive && roomDetails?.name ? roomDetails.name : session.name, 
                          e
                        )}
                        title={`Ajustes de Tempo & Frases de "${session.name}"`}
                        className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all duration-150 active:scale-95 shadow-xs cursor-pointer ${
                          isSessionPaidActive
                            ? 'bg-blue-600/25 text-blue-400 border-blue-500/50 hover:bg-blue-600/35 ring-1 ring-blue-500/30'
                            : (isDark 
                                ? 'bg-slate-800/90 text-slate-300 hover:text-white border-slate-700/80 hover:bg-slate-700' 
                                : 'bg-blue-50 text-blue-700 hover:text-blue-900 border-blue-200 hover:bg-blue-100')
                        }`}
                      >
                        <Settings size={11} className={isSessionPaidActive ? "text-blue-400 animate-spin-slow" : "text-slate-400 dark:text-slate-300"} />
                        <span className="truncate max-w-[65px] sm:max-w-[78px]">Tempo & Frases</span>
                        {isSessionPaidActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" title="Cobrança ativa" />
                        )}
                      </button>

                      <button
                        onClick={(e) => handleCloseSession(e, session.id)}
                        title="Fechar sala"
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-500 rounded-full text-white shadow-md transition-all z-10"
                      >
                        <X size={12} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'} truncate font-medium`}>{session.lastMessage}</p>
                    <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'} flex-shrink-0 ml-2 font-medium`}>{session.time}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className={`p-4 border-t ${colors.border}`}>
        {user.isLoggedIn ? (
          !isSidebarCollapsed && (
            <button onClick={handleSignOut} className={`w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl bg-red-600/10 text-red-500 border border-red-500/20 text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all`}>
              <LogOut size={14} /> Sair
            </button>
          )
        ) : (
          !isSidebarCollapsed && (
            <button onClick={openAuth} className={`w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl ${colors.primarySoft} ${colors.primaryText} border ${colors.primaryBorder} text-[10px] font-black uppercase hover:opacity-80 transition-all`}>
              <LogIn size={14} /> Entrar
            </button>
          )
        )}
        <div className="flex items-center justify-between">{!isSidebarCollapsed && <span className={`text-[9px] ${colors.text} font-bold tracking-[0.2em] uppercase`}>v2.4</span>}<button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`hidden md:flex p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 ${colors.text} ${isSidebarCollapsed ? 'mx-auto' : ''}`}>{isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button></div>
      </div>
    </div>
  );

  return (
    <div 
      className={`flex overflow-hidden ${colors.text} ${colors.bg} w-full max-w-full h-full`}
      style={{ height: 'var(--viewport-height, 100vh)', maxHeight: '100dvh' }}
    >
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 md:hidden animate-in fade-in" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="w-[280px] h-full shadow-2xl animate-in slide-in-from-left duration-300" onClick={e => e.stopPropagation()}>
            <SidebarContent />
          </div>
        </div>
      )}
      <aside className={`hidden md:flex flex-col border-r ${colors.border} transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-[300px]'}`}><SidebarContent /></aside>

      <main
        className={`flex-1 flex flex-col relative ${colors.bg} w-full max-w-full min-w-0 overflow-hidden h-full`}
        style={roomDetails?.background_url ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,${isDark ? 0.6 : 0.4}), rgba(0,0,0,${isDark ? 0.6 : 0.4})), url(${roomDetails.background_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        } : {}}
      >
        <input type="file" ref={bgUploadRef} onChange={handleBackgroundUpload} className="hidden" accept="image/*" />
        <input type="file" ref={roomImageUploadRef} onChange={handleRoomImageUpload} className="hidden" accept="image/*" />
        <header className={`h-[58px] sm:h-[64px] border-b ${colors.border} flex items-center justify-between px-2 sm:px-4 md:px-6 ${colors.headerBg} backdrop-blur-md gap-1 sm:gap-2 shrink-0 w-full max-w-full z-20 overflow-hidden`}>
          {/* Header Left: Back + Menu + Room Title (Clickable) */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 overflow-hidden">
            <button 
              onClick={() => navigate('/')} 
              className={`p-1.5 sm:p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-all flex items-center justify-center shrink-0 active:scale-95 border border-slate-700/50 shadow-sm`}
              title="Voltar para Início"
            >
              <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>

            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="md:hidden p-1.5 sm:p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-white transition-all shrink-0 active:scale-95"
              title="Abrir Menu"
            >
              <Menu size={16} className={`${colors.textHighlight} sm:w-[18px] sm:h-[18px]`} />
            </button>

            {/* Room Info Clickable Area (Changes Room Photo and Name) */}
            <div 
              onClick={() => {
                setTempRoomName(roomDetails?.name || sessions.find(s => s.id === roomId)?.name || 'Conversa');
                setIsEditingRoom(true);
              }}
              className="flex items-center gap-1.5 sm:gap-3 py-1 px-1 sm:px-2 rounded-xl hover:bg-white/5 active:bg-white/10 cursor-pointer transition-all min-w-0 flex-1 group/header select-none overflow-hidden"
              title="Clique para alterar foto e nome da sala"
            >
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden border ${colors.border} bg-slate-800 flex items-center justify-center shrink-0 relative group shadow-sm group-hover/header:border-blue-500/50 transition-colors`}>
                {roomDetails?.image_url ? (
                  <img src={roomDetails.image_url} alt="Sala" className="w-full h-full object-cover" />
                ) : (
                  <MessageSquare size={16} className="text-slate-400 group-hover/header:text-blue-400 transition-colors sm:w-[18px] sm:h-[18px]" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/header:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera size={12} className="text-white" />
                </div>
              </div>

              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-1 min-w-0">
                  <h2 className={`text-[11px] sm:text-sm font-black ${colors.textHighlight} uppercase tracking-tighter truncate max-w-[90px] xs:max-w-[120px] sm:max-w-[220px] group-hover/header:text-blue-400 transition-colors`}>
                    {roomDetails?.name || sessions.find(s => s.id === roomId)?.name || 'Conversa'}
                  </h2>
                  <Edit size={11} className="text-slate-500 group-hover/header:text-blue-400 shrink-0 opacity-70" />
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                  <span className={`text-[7.5px] sm:text-[9px] font-black ${colors.text} uppercase tracking-widest truncate`}>
                    {isAdmin ? 'MEU ESPAÇO • EDITAR' : 'ONLINE • EDITAR'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Header Right: Theme + Wallet/Credits + Video Call + Lixeira (Limpar) + Earnings + Share + Close */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button 
              type="button"
              onClick={toggleTheme} 
              className={`p-1.5 sm:p-2.5 rounded-xl border ${colors.border} ${colors.text} hover:opacity-70 transition-all active:scale-95`}
              title="Alternar Tema"
            >
              {isDark ? <Sun size={15} className="sm:w-[17px] sm:h-[17px]" /> : <Moon size={15} className="sm:w-[17px] sm:h-[17px]" />}
            </button>

            {/* Wallet / Credits Recharge Button - Always visible on mobile and desktop */}
            <button 
              type="button" 
              onClick={() => openWallet('recharge')} 
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] sm:text-xs border border-emerald-500/30 font-black cursor-pointer transition-all active:scale-95 shrink-0 shadow-sm"
              title="Carteira & Depositar Créditos"
            >
              <Wallet size={13} className="shrink-0 text-emerald-500 sm:w-[15px] sm:h-[15px]" />
              <span className="text-[11px] sm:text-xs font-black">{user.credits}c</span>
            </button>

            {/* Earnings Dollar Button */}
            {user.isLoggedIn && (
              <button 
                type="button" 
                onClick={() => openWallet('earnings')} 
                className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 sm:py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 font-black active:scale-95 shrink-0"
                title="Central de Ganhos & Saques"
              >
                <DollarSign size={13} className="sm:w-[15px] sm:h-[15px]" />
                <span className="hidden xs:inline text-[10px] sm:text-[11px] font-black">{user.earnings}</span>
              </button>
            )}

            {/* Video Call / Cinema Button (Desktop/Tablet, available in mobile bar) */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('cinema');
                handleNewVideoSelection();
              }}
              className="hidden sm:flex p-2 sm:p-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-all active:scale-95 items-center gap-1.5"
              title="Chamada de Vídeo / Transmissão Cinema"
              style={{ touchAction: 'manipulation' }}
            >
              <Video size={17} />
              <span className="hidden xl:inline text-[11px] font-black uppercase tracking-tighter">Vídeo</span>
            </button>

            {/* Lixeira (Limpar Conversa e Mídias) Button - Desktop/Tablet, available in mobile bar */}
            <button
              type="button"
              onClick={() => setIsClearChatModalOpen(true)}
              className="hidden sm:flex p-2 sm:p-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all active:scale-95 items-center gap-1.5"
              title="Limpar conversa e mídias do chat"
            >
              <Trash2 size={17} />
              <span className="hidden xl:inline text-[11px] font-black uppercase tracking-tighter">Limpar</span>
            </button>

            <button 
              onClick={() => { 
                const roomUrl = `${window.location.origin}/#/chat/${roomId}`;
                navigator.clipboard.writeText(roomUrl); 
                showToast('Link da sala copiado com sucesso!', 'success', {
                  link: roomUrl,
                  subMessage: `Compartilhe o link da sala "${roomDetails?.name || 'LinkCard Chat'}".`,
                  shareText: `Venha conversar e interagir comigo na sala "${roomDetails?.name || 'LinkCard Chat'}"! Acesse pelo link: ${roomUrl}`
                }); 
              }} 
              className={`hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-2 ${colors.primarySoft} ${colors.primaryText} rounded-xl border ${colors.primaryBorder} hover:opacity-80 transition-all font-black text-xs uppercase tracking-tighter active:scale-95`}
              title="Convidar Amigos para a Sala"
            >
              <Share2 size={15} />
              <span className="hidden md:inline">Convidar</span>
            </button>

            <button 
              onClick={() => navigate('/')} 
              className="p-1.5 sm:p-2.5 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-500 transition-all active:scale-95 shrink-0" 
              title="Fechar / Sair do Chat"
            >
              <X size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </div>
        </header>

        {isPrivateLocked ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="p-8 rounded-[3rem] bg-slate-900 border border-slate-800 shadow-2xl animate-in zoom-in">
              <Lock size={64} className="text-slate-500 mx-auto mb-6" />
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Sala Privada</h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-8">Esta sala é exclusiva e requer acesso.</p>

              {!user.isLoggedIn ? (
                <button onClick={openAuth} className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-blue-500 transition-all shadow-xl">
                  Fazer Login para Entrar
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center items-baseline gap-2">
                    <span className="text-4xl font-black text-white">{privateRoomCard?.creditCost || 0}</span>
                    <span className="text-sm font-bold text-slate-500">créditos</span>
                  </div>
                  <button onClick={handleUnlockPrivateRoom} className="w-full px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-xl flex items-center justify-center gap-2">
                    <Zap size={16} /> Pagar e Entrar
                  </button>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Seu saldo: {user.credits} créditos</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <nav className={`flex px-2 md:px-6 border-b ${colors.border} ${isDark ? 'bg-slate-900/10' : 'bg-gray-100'} overflow-x-auto scrollbar-hide no-scrollbar w-full max-w-full shrink-0 z-10`}>
              <button onClick={() => setActiveTab('chat')} className={`px-3 sm:px-4 md:px-8 py-3 sm:py-4 text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'chat' ? `border-b-2 ${isDark ? 'border-blue-500 text-white' : 'border-red-600 text-red-600'}` : `${colors.text} hover:opacity-70`}`}><MessageSquare size={14} /> Feed</button>
              <button onClick={() => setActiveTab('showcase')} className={`px-3 sm:px-4 md:px-8 py-3 sm:py-4 text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'showcase' ? `border-b-2 ${isDark ? 'border-blue-500 text-white' : 'border-red-600 text-red-600'}` : `${colors.text} hover:opacity-70`}`}><LayoutGrid size={14} /> Vitrine</button>
              <button onClick={() => setActiveTab('my_cards')} className={`px-3 sm:px-4 md:px-8 py-3 sm:py-4 text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'my_cards' ? `border-b-2 ${isDark ? 'border-blue-500 text-white' : 'border-red-600 text-red-600'}` : `${colors.text} hover:opacity-70`}`}><FolderOpen size={14} /> Meus Cards</button>
              <button onClick={() => setActiveTab('cinema')} className={`px-3 sm:px-4 md:px-8 py-3 sm:py-4 text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'cinema' ? `border-b-2 ${isDark ? 'border-blue-500 text-white' : 'border-red-600 text-red-600'}` : `${colors.text} hover:opacity-70`}`}><Tv size={14} /> Cinema</button>
            </nav>

            <div 
              ref={chatScrollContainerRef}
              className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col scrollbar-hide relative w-full max-w-full ${activeTab === 'cinema' && watchPartySource ? 'p-0 overflow-hidden' : 'p-3 sm:p-4 md:p-6'}`}
            >
              {activeTab === 'chat' ? (
                <div className="flex-1 space-y-6 sm:space-y-8 max-w-5xl mx-auto w-full max-w-full py-2 sm:py-4 pb-24 overflow-x-hidden">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 select-none group">
                      <div
                        onClick={() => isHost ? bgUploadRef.current?.click() : null}
                        className={`p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] ${isDark ? 'bg-slate-800/40 border-white/5' : 'bg-gray-200 border-black/5'} mb-4 md:mb-6 cursor-pointer hover:scale-105 transition-all flex flex-col items-center gap-4 relative overflow-hidden`}
                      >
                        <div className="relative">
                          <MessageSquare size={40} className={`md:w-14 md:h-14 ${colors.text}`} />
                          {isHost && (
                            <div className="absolute -bottom-1 -right-1 bg-blue-600 p-1.5 md:p-2 rounded-full text-white shadow-lg animate-bounce">
                              <Plus size={14} />
                            </div>
                          )}
                        </div>
                        {isHost && (
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-400">Personalizar Fundo</span>
                            <span className="text-[7px] md:text-[8px] font-bold uppercase opacity-50 mt-1 text-center max-w-[120px] md:max-w-[150px]">Toque para escolher imagem</span>
                          </div>
                        )}
                      </div>
                      <span className={`text-[8px] md:text-[10px] ${colors.text} border ${colors.border} px-6 md:px-8 py-2 md:py-3 rounded-full uppercase tracking-[0.2em] md:tracking-[0.4em] font-black bg-black/5`}>Silêncio no chat...</span>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-3 duration-500 w-full max-w-full`}>
                      {msg.text && (
                        <div className={`max-w-[85%] sm:max-w-[80%] px-3.5 sm:px-5 py-2.5 sm:py-3.5 rounded-2xl text-xs sm:text-sm shadow-sm font-medium break-all [word-break:break-word] [overflow-wrap:anywhere] ${msg.senderId === user.id ? `${colors.primary} text-white rounded-tr-none` : `${isDark ? 'bg-slate-800/80 text-slate-200 border-slate-700/30' : 'bg-white text-slate-800 border-gray-200'} border rounded-tl-none`}`}>
                          {msg.text}
                        </div>
                      )}
                      {msg.card && (
                        <MediaCardItem
                          card={msg.card}
                          canManage={msg.senderId === user.id}
                          onUnlock={() => handleInteractWithCard(msg.card!)}
                          isHostMode={isHost}
                          onDelete={() => handleDeleteCard(msg.card!.id)}
                          onEdit={() => handleEditCard(msg.card!)}
                          onInsertToRoom={handleInsertToRoom}
                          onSchedule={handleSchedule}
                          onShowToast={showToast}
                          theme={theme}
                        />
                      )}
                      <span className={`text-[9px] ${colors.text} mt-2 uppercase font-black tracking-widest px-1 opacity-60`}>{msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : activeTab === 'showcase' ? (
                <div className="max-w-6xl mx-auto w-full pb-24">
                  <Gallery user={user} onShowToast={showToast} updateCredits={updateCredits} theme={theme} toggleTheme={toggleTheme} />
                </div>
              ) : activeTab === 'cinema' ? (
                isRoomDetailsLoading ? (
                  /* LOADING STATE - prevents flicker between offline/online states */
                  <div className="flex-1 flex items-center justify-center min-h-[450px] md:min-h-[550px]">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 size={32} className="text-indigo-500 animate-spin" />
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest animate-pulse">Carregando...</p>
                    </div>
                  </div>
                ) : watchPartySource ? (
                  /* ACTIVE CINEMA VIEW PLACEHOLDER (The actual player container is rendered globally at the bottom to prevent WebRTC unmount/disconnects) */
                  <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden rounded-3xl border border-transparent bg-transparent min-h-[450px] md:min-h-[550px] relative pointer-events-none" />
                ) : (
                  /* OFFLINE CINEMA VIEW */
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950/40 rounded-3xl border border-slate-800/50 text-center min-h-[450px] md:min-h-[550px] animate-in fade-in">
                    {(isAdmin || isHost) ? (
                      <div
                        onClick={() => setIsWatchPartyOpen(true)}
                        className="p-8 md:p-12 rounded-[2.5rem] bg-indigo-600/5 hover:bg-indigo-600/10 active:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 transition-all cursor-pointer flex flex-col items-center max-w-sm group shadow-xl select-none"
                        style={{touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent'}}
                      >
                        <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 transition-transform">
                          <Tv size={32} />
                        </div>
                        <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-3">Cinema Offline</h4>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
                          Clique aqui para fazer upload de um vídeo ou colar um link e iniciar a transmissão para todos os usuários da sala.
                        </p>
                      </div>
                    ) : (
                      <div className="p-8 md:p-12 rounded-[2.5rem] bg-slate-900/50 border border-slate-800 flex flex-col items-center max-w-sm shadow-xl">
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-6 text-slate-600 animate-pulse">
                          <Tv size={32} />
                        </div>
                        <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-3">Cinema Fechado</h4>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed">
                          Aguardando o Host ou um Administrador iniciar a transmissão de um vídeo para começar a assistir juntos.
                        </p>
                      </div>
                    )}
                  </div>
                )

              ) : (
                // MY CARDS TAB
                <div className="max-w-6xl mx-auto w-full pb-24">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className={`text-lg font-black uppercase tracking-tighter ${colors.textHighlight}`}>Meus Cards Criados</h3>
                    <button onClick={() => setIsCardModalOpen(true)} className={`px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-500`}>
                      <Plus size={16} /> Novo
                    </button>
                  </div>
                  {myCards.length === 0 ? (
                    <div className="text-center py-20 opacity-50 flex flex-col items-center">
                      <FolderOpen size={48} className="mb-4" />
                      <span className="text-xs font-black uppercase tracking-widest">Nenhum card encontrado</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {myCards.map(card => (
                        <div key={card.id} className="relative group">
                          <div className="absolute top-4 right-4 z-20 flex gap-2">
                            <button onClick={() => handleEditCard(card)} className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg text-white transition-all"><Edit size={16} /></button>
                            <button onClick={() => handleDeleteCard(card.id)} className="p-2 bg-red-600/80 hover:bg-red-600 backdrop-blur-md rounded-lg text-white transition-all"><Trash2 size={16} /></button>
                          </div>
                          <MediaCardItem
                            card={card}
                            canManage={true}
                            onUnlock={() => Promise.resolve(true)}
                            isHostMode={isHost}
                            onInsertToRoom={handleInsertToRoom}
                            onSchedule={handleSchedule}
                            onEdit={() => handleEditCard(card)}
                            onDelete={() => handleDeleteCard(card.id)}
                            onShowToast={showToast}
                            theme={theme}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={`absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 md:p-6 border-t ${colors.border} ${isDark ? 'bg-[#070d18]/90' : 'bg-white/90'} backdrop-blur-md transition-all duration-300 z-30 w-full max-w-full overflow-hidden`}>
              <div className="max-w-4xl mx-auto w-full max-w-full min-w-0">
                {/* ... (Existing Quick Input) ... */}
                <input type="file" ref={quickUploadRef} onChange={handleQuickUpload} className="hidden" accept="image/*,video/*,audio/*" />
                {isQuickRecording || isReviewing ? (
                  <div className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-5">

                    {/* VIDEO/PHOTO PREVIEW & REVIEW */}
                    {(quickRecordingType === 'video' || quickRecordingType === 'photo') && (
                      <div className="relative w-full h-64 md:h-80 bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
                        {isReviewing && quickMediaPreview ? (
                          quickRecordingType === 'video' ? (
                            <video src={quickMediaPreview} controls className="w-full h-full object-contain" />
                          ) : (
                            <img src={quickMediaPreview} alt="Review" className="w-full h-full object-contain" />
                          )
                        ) : (
                          <video
                            ref={quickVideoRef}
                            autoPlay
                            muted
                            playsInline
                            onLoadedMetadata={(e) => {
                              e.currentTarget.muted = true;
                              e.currentTarget.play().catch(err => console.log("Live quick preview play:", err));
                            }}
                            className="w-full h-full object-cover transform scale-x-[-1]"
                          />
                        )}
                        {!isReviewing && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {quickRecordingType === 'video' && <div className="w-16 h-16 border-2 border-white/20 rounded-full border-dashed animate-spin-slow" />}
                          </div>
                        )}
                        {!isReviewing && (
                          <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full flex items-center gap-2 backdrop-blur-md">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-white font-mono font-black text-xs uppercase tracking-wider">
                              {quickRecordingType === 'photo' ? 'CÂMERA ATIVA' : `GRAVANDO • ${formatTime(recordingTime)}`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AUDIO REVIEW */}
                    {quickRecordingType === 'audio' && isReviewing && quickMediaPreview && (
                      <div className="w-full bg-slate-900 p-6 rounded-2xl flex items-center justify-center border border-slate-800">
                        <audio src={quickMediaPreview} controls className="w-full" />
                      </div>
                    )}

                    {/* CONTROLS BAR */}
                    <div className="w-full h-16 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between px-4 shadow-xl">
                      {quickRecordingType === 'audio' && !isReviewing && (
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                            <Mic className="text-red-500 animate-pulse" size={20} />
                          </div>
                          <div className="h-8 flex gap-1 items-center">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="w-1 bg-slate-700 rounded-full animate-pulse" style={{ height: Math.random() * 20 + 10 + 'px', animationDelay: i * 0.1 + 's' }} />
                            ))}
                          </div>
                          <span className="text-white font-mono font-bold">{formatTime(recordingTime)}</span>
                        </div>
                      )}

                      {(quickRecordingType === 'video' || quickRecordingType === 'photo') && !isReviewing && <div />}

                      {isReviewing && <div className="text-white font-bold uppercase text-xs">Revisar {quickRecordingType === 'photo' ? 'Foto' : quickRecordingType === 'video' ? 'Vídeo' : 'Áudio'}</div>}

                      <div className="flex gap-2 ml-auto">
                        <button onClick={cleanupQuickRecording} className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:bg-red-900/30 hover:text-red-500 transition-all border border-slate-700" title="Cancelar"><Trash2 size={20} /></button>

                        {!isReviewing ? (
                          quickRecordingType === 'photo' ? (
                            <button onClick={handleQuickPhotoCapture} className="px-6 py-3 rounded-xl bg-white text-black hover:bg-slate-200 transition-all shadow-lg font-black uppercase text-xs tracking-widest flex items-center gap-2"><Aperture size={18} /> Capturar</button>
                          ) : (
                            <button onClick={stopQuickRecording} className="px-6 py-3 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-all shadow-lg shadow-red-500/20 font-black uppercase text-xs tracking-widest flex items-center gap-2"><StopCircle size={18} /> Parar</button>
                          )
                        ) : (
                          <button onClick={confirmQuickRecording} disabled={isUploading} className={`px-6 py-3 rounded-xl ${colors.primary} text-white hover:opacity-90 transition-all shadow-lg font-black uppercase text-xs tracking-widest flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}>
                            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            {isUploading ? 'Enviando...' : 'Enviar Card'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ... (Same simplified input bar logic as previous) ... */
                  <div className="flex flex-col gap-1.5 sm:gap-2 md:gap-3 w-full max-w-full">
                    {/* Quick Phrases Balloon Strip (Balões de Frases) - Horizontal Scrollable Row */}
                    {(() => {
                      const activePhrases = isHost 
                        ? (quickPhrasesConfig?.creatorPhrases?.length ? quickPhrasesConfig.creatorPhrases : DEFAULT_CREATOR_PHRASES)
                        : (quickPhrasesConfig?.visitorPhrases?.length ? quickPhrasesConfig.visitorPhrases : DEFAULT_VISITOR_PHRASES);

                      return (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide no-scrollbar w-full max-w-full">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickSettingsTab('phrases');
                              setIsQuickSettingsOpen(true);
                            }}
                            className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all select-none ${
                              isDark 
                                ? 'bg-blue-950/40 text-blue-400 border-blue-500/30 hover:bg-blue-900/50' 
                                : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                            }`}
                            title="Gerenciar e personalizar frases balão"
                          >
                            <Sparkles size={11} className="text-amber-400 shrink-0" />
                            <span>{isHost ? 'Frases' : 'Sugestões'}</span>
                          </button>

                          {activePhrases.map((phrase, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSendQuickPhrase(phrase)}
                              disabled={isChatPausedDueToRenewal && !isHost}
                              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full border text-xs sm:text-xs font-semibold whitespace-nowrap transition-all duration-150 active:scale-95 cursor-pointer shadow-xs select-none ${
                                isDark
                                  ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-white hover:border-blue-500/50 active:bg-blue-600 active:text-white'
                                  : 'bg-white hover:bg-gray-100 border-gray-200 text-slate-800 hover:text-slate-950 hover:border-blue-400 active:bg-blue-600 active:text-white'
                              } ${isChatPausedDueToRenewal && !isHost ? 'opacity-40 cursor-not-allowed' : ''}`}
                              title={`Clique para enviar: "${phrase}"`}
                            >
                              {phrase}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              setQuickSettingsTab('phrases');
                              setIsQuickSettingsOpen(true);
                            }}
                            className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full border transition-all ${
                              isDark
                                ? 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500'
                                : 'bg-gray-100 text-slate-500 border-gray-200 hover:text-slate-900 hover:border-gray-300'
                            }`}
                            title="Adicionar mais frases balão"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      );
                    })()}

                    {/* Chat Paused Warning Banner */}
                    {isChatPausedDueToRenewal && !isHost && (
                      <div 
                        onClick={() => setIsRenewalModalOpen(true)}
                        className="w-full p-2.5 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition-all animate-pulse"
                      >
                        <div className="flex items-center gap-2">
                          <Clock size={15} className="text-red-400 shrink-0" />
                          <span>Tempo esgotado! Clique para renovar o chat (-{paidChatConfig.costCredits} créditos).</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm shrink-0">
                          Renovar Agora
                        </span>
                      </div>
                    )}

                    {/* Function Icons Bar (Visible on Mobile, Hidden on Desktop) */}
                    <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide no-scrollbar w-full max-w-full">
                      <button 
                        type="button" 
                        onClick={() => openWallet('recharge')} 
                        className="flex-shrink-0 h-8 px-2 flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/30 text-[11px] font-black active:scale-95 shadow-sm" 
                        title="Carteira & Depositar Créditos"
                      >
                        <Wallet size={13} className="text-emerald-500 shrink-0" />
                        <span>{user.credits}c</span>
                      </button>
                      <button disabled={isUploading} onClick={() => quickUploadRef.current?.click()} className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-xl border border-slate-700/50" title="Upload"><Upload size={14} /></button>
                      <button disabled={isUploading} onClick={() => startQuickRecording('photo')} className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-xl border border-slate-700/50" title="Foto"><Camera size={14} /></button>
                      <button disabled={isUploading} onClick={() => { setActiveTab('cinema'); handleNewVideoSelection(); }} className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20" title="Subir Vídeo / Link" style={{touchAction:'manipulation'}}><Tv size={14} /></button>
                      <button disabled={isUploading} onClick={() => setIsCardModalOpen(true)} className={`flex-shrink-0 w-8 h-8 flex items-center justify-center ${colors.primary} text-white rounded-xl shadow-lg`} title="Novo Card"><Plus size={16} /></button>
                      <button disabled={isUploading} onClick={() => { setQuickSettingsTab('paid_chat'); setIsQuickSettingsOpen(true); }} className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${paidChatConfig.enabled ? 'bg-blue-600/25 text-blue-400 border-blue-500/50 shadow-sm' : 'bg-slate-800 text-slate-400 border-slate-700/50'}`} title="Ajustes (Tempo & Frases)"><Settings size={13} /></button>
                      <button disabled={isUploading} onClick={() => startQuickRecording('audio')} className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-xl border border-slate-700/50" title="Áudio"><Mic size={14} /></button>
                      <button disabled={isUploading} onClick={() => startQuickRecording('video')} className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-xl border border-slate-700/50" title="Vídeo"><Video size={14} /></button>
                      <button disabled={isUploading} onClick={() => setIsClearChatModalOpen(true)} className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-red-950/30 text-red-400 hover:bg-red-900/40 rounded-xl border border-red-500/20" title="Limpar Conversa e Mídias"><Trash2 size={14} /></button>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 w-full max-w-full">
                      {/* Desktop Only Actions - Left Side */}
                      <div className="hidden md:flex items-center gap-2 shrink-0">
                        <button disabled={isUploading} onClick={() => quickUploadRef.current?.click()} className={`w-12 h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-200 text-slate-500 hover:bg-gray-300'} rounded-2xl transition-all`} title="Upload Rápido"><Upload size={20} /></button>
                        <button disabled={isUploading} onClick={() => startQuickRecording('photo')} className={`w-12 h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-200 text-slate-500 hover:bg-gray-300'} rounded-2xl transition-all`} title="Foto Rápida"><Camera size={20} /></button>
                        <button disabled={isUploading} onClick={() => { setActiveTab('cinema'); handleNewVideoSelection(); }} className={`w-12 h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-indigo-400' : 'bg-indigo-100 text-indigo-500 hover:bg-indigo-200'} rounded-2xl transition-all`} title="Subir Vídeo / Link" style={{touchAction:'manipulation'}}><Tv size={20} /></button>
                        <button disabled={isUploading} onClick={() => setIsCardModalOpen(true)} className={`w-12 h-12 flex items-center justify-center ${colors.primary} text-white rounded-2xl shadow-xl hover:opacity-90 transform hover:-translate-y-0.5 transition-all`} title="Criar Card Avançado"><Plus size={24} /></button>
                      </div>

                      {/* Main Text Input Area */}
                      <div className={`flex-1 min-w-0 ${colors.inputBg} rounded-2xl border ${colors.border} flex items-center px-3 sm:px-4 focus-within:ring-1 ${isDark ? 'focus-within:ring-blue-500/30' : 'focus-within:ring-red-500/30'} transition-all shadow-sm`}>
                        <input
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder={isChatPausedDueToRenewal && !isHost ? "Chat pausado (renovação necessária)..." : "Fale algo..."}
                          disabled={isChatPausedDueToRenewal && !isHost}
                          className={`w-full min-w-0 bg-transparent border-none text-[15px] sm:text-[16px] py-2.5 sm:py-3.5 md:py-4.5 ${colors.textHighlight} outline-none placeholder:opacity-40 font-medium ${isChatPausedDueToRenewal && !isHost ? 'cursor-not-allowed opacity-50' : ''}`}
                        />
                      </div>

                      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
                        {/* Desktop Only Actions - Right Side */}
                        <div className="hidden md:flex gap-2">
                          <button disabled={isUploading} onClick={() => { setQuickSettingsTab('paid_chat'); setIsQuickSettingsOpen(true); }} className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all border ${paidChatConfig.enabled ? 'bg-blue-600/25 text-blue-400 border-blue-500/50 shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-emerald-400 border-slate-700'}`} title="Configurações (Tempo, Frases & Padrões)"><Settings size={18} /></button>
                          <button disabled={isUploading} onClick={() => startQuickRecording('audio')} className={`w-12 h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:text-red-400' : 'bg-gray-200 text-slate-500 hover:text-red-500'} rounded-2xl transition-all`} title="Áudio Rápido"><Mic size={20} /></button>
                          <button disabled={isUploading} onClick={() => startQuickRecording('video')} className={`w-12 h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:text-blue-400' : 'bg-gray-200 text-slate-500 hover:text-blue-500'} rounded-2xl transition-all`} title="Vídeo Rápido"><Video size={20} /></button>
                          <button disabled={isUploading} onClick={() => setIsClearChatModalOpen(true)} className={`w-12 h-12 flex items-center justify-center ${isDark ? 'bg-red-950/30 text-red-400 hover:bg-red-900/40' : 'bg-red-50 text-red-500 hover:bg-red-100'} rounded-2xl transition-all border border-red-500/20`} title="Limpar Conversa e Mídias"><Trash2 size={18} /></button>
                        </div>

                        {/* Send Button */}
                        <button
                          onClick={() => handleSendMessage()}
                          disabled={!inputText.trim()}
                          className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 flex-shrink-0 flex items-center justify-center ${colors.primary} text-white rounded-2xl hover:opacity-90 shadow-lg transition-all disabled:opacity-25 active:scale-90`}
                        >
                          <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <input type="file" ref={watchVideoUploadRef} onChange={handleWatchPartyUpload} className="hidden" accept="video/*" />

        {/* UNIFIED CINEMA/WATCH PARTY PLAYER (Stays mounted during toggle/tab switch) */}
        {watchPartySource && (
          <div
            className={
              isWatchPartyOpen
                ? "fixed inset-0 z-[500] bg-black flex flex-col md:flex-row overflow-hidden animate-in fade-in"
                : activeTab === 'cinema'
                  ? "absolute top-[116px] md:top-[120px] bottom-0 left-0 right-0 z-[40] bg-[#050a14] flex flex-col md:flex-row overflow-hidden"
                  : "hidden"
            }
          >
            <div className="flex-1 relative bg-black flex items-center justify-center min-h-[250px] md:min-h-0">
              {/* Floating or Inline Controls */}
              {/* THREE-DOTS DROPDOWN MENU FOR BOTH INLINE AND FULLSCREEN */}
              <div className="absolute top-6 left-6 z-[510] flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setIsCinemaMenuOpen(!isCinemaMenuOpen)}
                    className="p-3 bg-black/50 text-white rounded-full hover:bg-black/80 transition-all backdrop-blur-md border border-white/10 flex items-center justify-center shadow-lg"
                  >
                    <MoreVertical size={20} />
                  </button>
                  
                  {isCinemaMenuOpen && (
                    <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 text-white shadow-2xl p-2 flex flex-col gap-1 z-[520] animate-in fade-in slide-in-from-top-2 duration-200">
                      {canControlVideo && (
                        <button
                          onClick={() => {
                            setIsCinemaMenuOpen(false);
                            handleNewVideoSelection();
                          }}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800/80 transition-all text-left text-xs font-bold uppercase tracking-wider"
                        >
                          <Plus size={16} className="text-indigo-400" />
                          Novo Vídeo
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          setIsCinemaMenuOpen(false);
                          // Use roomId from useParams (always current) to avoid stale closures
                          const currentRoomId = roomId;
                          const roomUrl = `${window.location.origin}/#/chat/${currentRoomId}`;
                          const fullMessage = `Assista comigo nesta sala! ${roomUrl}`;
                          navigator.clipboard.writeText(roomUrl)
                            .then(() => showToast('Link da sala copiado com sucesso!', 'success', {
                              link: roomUrl,
                              subMessage: 'Convide amigos para assistir vídeos e ouvir músicas em sincronia.',
                              shareText: `Assista comigo nesta sala: ${roomUrl}`
                            }))
                            .catch(() => prompt('Copie o link da sala:', fullMessage));
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800/80 transition-all text-left text-xs font-bold uppercase tracking-wider"
                      >
                        <Copy size={16} className="text-sky-400" />
                        Copiar Link da Sala
                      </button>

                      <button
                        onClick={() => {
                          setIsCinemaMenuOpen(false);
                          setSidebarTab('history');
                          setIsCinemaSidebarCollapsed(false);
                          setIsChatMinimized(false); // ensure sidebar is fully expanded on mobile
                          loadRecentVideos();         // force refresh video list
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800/80 transition-all text-left text-xs font-bold uppercase tracking-wider"
                      >
                        <FolderOpen size={16} className="text-emerald-400" />
                        Ver Histórico
                      </button>

                      <button
                        onClick={() => {
                          setIsCinemaMenuOpen(false);
                          setIsWatchPartyOpen(!isWatchPartyOpen);
                          setActiveTab('cinema');
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800/80 transition-all text-left text-xs font-bold uppercase tracking-wider"
                      >
                        {isWatchPartyOpen ? (
                          <>
                            <Minimize2 size={16} className="text-sky-400" />
                            Sair do Modo Cheio
                          </>
                        ) : (
                          <>
                            <Maximize2 size={16} className="text-sky-400" />
                            Tela Cheia
                          </>
                        )}
                      </button>

                      {isWatchPartyHost && (
                        <button
                          onClick={() => {
                            setIsCinemaMenuOpen(false);
                            stopWatchParty();
                          }}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-950/40 hover:text-red-400 transition-all text-left text-xs font-bold uppercase tracking-wider text-red-500 border-t border-slate-800/50 mt-1"
                        >
                          <Power size={16} />
                          Encerrar
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* QUICK TV BUTTON — always visible, opens upload/link modal directly */}
                {canControlVideo && (
                  <button
                    onClick={() => { setIsCinemaMenuOpen(false); handleNewVideoSelection(); }}
                    title="Subir Vídeo / Link"
                    className="p-3 bg-indigo-600/80 text-white rounded-full hover:bg-indigo-500 active:scale-95 transition-all backdrop-blur-md border border-indigo-400/30 flex items-center justify-center shadow-lg"
                  >
                    <Tv size={18} />
                  </button>
                )}
              </div>

              {/* Chat Sidebar Toggle Button */}
              <button
                onClick={() => setIsCinemaSidebarCollapsed(!isCinemaSidebarCollapsed)}
                className="absolute top-6 right-6 z-[510] px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl transition-all shadow-md font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5 backdrop-blur-sm"
              >
                {isCinemaSidebarCollapsed ? (
                  <>
                    <MessageSquare size={12} /> Mostrar Chat
                  </>
                ) : (
                  <>
                    <ChevronRight size={12} /> Ocultar Chat
                  </>
                )}
              </button>

              {/* Floating messages overlay when chat is collapsed or minimized */}
              {(isCinemaSidebarCollapsed || isChatMinimized) && floatingMessages.length > 0 && (
                <div className="absolute bottom-6 left-6 z-[520] max-w-[280px] md:max-w-sm flex flex-col gap-2 pointer-events-none animate-in fade-in">
                  {floatingMessages.map((msg) => (
                    <div key={msg.id} className="bg-slate-900/80 backdrop-blur-md border border-slate-700/30 px-4 py-2.5 rounded-2xl shadow-xl flex flex-col gap-0.5 animate-in slide-in-from-bottom-3 duration-300">
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">{msg.senderName}</span>
                      <span className="text-xs font-semibold text-slate-100 break-all">{msg.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* LOCK OVERLAY IF NOT OWNER AND NOT PURCHASED */}
              {watchPartyCardId && !myCards.some(c => c.id === watchPartyCardId) && !purchasedCardIds.has(watchPartyCardId) ? (
                <div className="absolute inset-0 z-[520] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                  <div className="p-8 rounded-[3rem] bg-slate-800 border border-slate-700 shadow-2xl mb-6">
                    <Lock size={48} className="text-indigo-400 mx-auto mb-4" />
                    <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Conteúdo Exclusivo</h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Este vídeo faz parte de um Card e requer liberação.</p>
                  </div>
                  <button
                    onClick={() => {
                      const card = messages.find(m => m.card?.id === watchPartyCardId)?.card;
                      if (card) handleInteractWithCard(card);
                      else showToast("Desbloqueie o card original para assistir.", "info");
                    }}
                    className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-xl flex items-center gap-2"
                  >
                    <Zap size={16} /> Liberar Acesso
                  </button>
                </div>
              ) : (
                watchPartyType === 'video' ? (
                  watchPartySource === 'p2p-stream' ? (
                    isWatchPartyHost ? (
                      <video
                        ref={hostVideoRef}
                        src={localVideoUrl || undefined}
                        controls
                        autoPlay
                        playsInline
                        className="max-w-full max-h-full object-contain"
                        onCanPlay={() => {
                          captureHostStream();
                          hostVideoRef.current?.play().catch(e => console.log("Host play block error:", e));
                        }}
                        onPlay={handleHostPlay}
                      />
                    ) : (
                      <div className="relative w-full h-full flex items-center justify-center bg-black">
                        {!remoteStream && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950/80 backdrop-blur-sm z-[10] space-y-4">
                            <Loader2 size={36} className="text-indigo-500 animate-spin" />
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">Conectando à transmissão P2P...</p>
                            <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(p2pLoadingProgress, 5)}%` }}
                              />
                            </div>
                            {p2pLoadingProgress > 0 && (
                              <p className="text-[10px] font-black text-indigo-400 tracking-widest">{p2pLoadingProgress}%</p>
                            )}
                          </div>
                        )}
                        <video
                          ref={viewerVideoRef}
                          autoPlay
                          playsInline
                          controls={canControlVideo}
                          className="max-w-full max-h-full object-contain"
                          onLoadedMetadata={(e) => {
                            e.currentTarget.play().catch(err => console.log("Viewer play block error:", err));
                          }}
                          onProgress={(e) => {
                            const video = e.currentTarget;
                            if (video.buffered.length > 0 && video.duration > 0) {
                              const pct = Math.round((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
                              setP2pLoadingProgress(pct);
                            }
                          }}
                          onPlay={canControlVideo ? handleHostControlPlay : undefined}
                          onPause={canControlVideo ? handleHostControlPause : undefined}
                          onSeeked={canControlVideo ? handleHostControlSeek : undefined}
                        />
                      </div>
                    )
                  ) : (
                    isWatchPartyHost ? (
                      <video
                        ref={hostVideoRef}
                        src={watchPartySource}
                        controls
                        autoPlay
                        className="max-w-full max-h-full object-contain"
                        onPlay={handleHostControlPlay}
                        onPause={handleHostControlPause}
                        onSeeked={handleHostControlSeek}
                      />
                    ) : (
                      <video
                        ref={viewerVideoRef}
                        src={watchPartySource}
                        autoPlay
                        controls={canControlVideo}
                        className="max-w-full max-h-full object-contain"
                        onLoadedMetadata={(e) => {
                          e.currentTarget.play().catch(err => console.log("Viewer URL play error:", err));
                        }}
                        onPlay={canControlVideo ? handleHostControlPlay : undefined}
                        onPause={canControlVideo ? handleHostControlPause : undefined}
                        onSeeked={canControlVideo ? handleHostControlSeek : undefined}
                      />
                    )
                  )
                ) : (
                  <iframe src={getEmbedUrl(watchPartySource!)} className="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                )
              )}
            </div>

            {/* FLOATING CHAT SIDEBAR FOR WATCH PARTY */}
            <div className={`${isCinemaSidebarCollapsed ? 'w-0 h-0 border-l-0 overflow-hidden' : isChatMinimized ? 'w-full md:w-96 md:h-full border-l border-slate-800' : 'w-full md:w-96 h-1/2 md:h-full border-l border-slate-800'} bg-slate-900 flex flex-col shadow-2xl relative flex-shrink-0 transition-all duration-300`}>
              {/* When minimized: show ONLY the chevron row, hide tab labels and input */}
              {isChatMinimized ? (
                <div className="flex items-center justify-center border-b border-slate-800 bg-slate-800/20 py-2">
                  <button
                    onClick={() => setIsChatMinimized(false)}
                    title="Expandir chat"
                    className="px-6 py-2 text-slate-400 hover:text-slate-200 transition-all flex items-center gap-2"
                  >
                    <ChevronDown size={16} className="rotate-180" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Expandir Chat</span>
                  </button>
                </div>
              ) : isAdmin ? (
                <div className="flex border-b border-slate-800 bg-slate-800/20 items-center">
                  <button
                    onClick={() => setSidebarTab('chat')}
                    className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${sidebarTab === 'chat' ? 'text-white border-b-2 border-indigo-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Chat
                  </button>
                  {/* Minimize chat toggle */}
                  <button
                    onClick={() => setIsChatMinimized(!isChatMinimized)}
                    title={isChatMinimized ? 'Expandir chat' : 'Minimizar chat'}
                    className="px-2 py-4 text-slate-500 hover:text-slate-300 transition-all flex items-center justify-center"
                  >
                    <ChevronDown size={14} className={`transition-transform duration-300 ${isChatMinimized ? 'rotate-180' : ''}`} />
                  </button>
                  <button
                    onClick={() => setSidebarTab('history')}
                    className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${sidebarTab === 'history' ? 'text-white border-b-2 border-indigo-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Histórico
                  </button>
                </div>
              ) : (
                <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs font-black uppercase text-white tracking-widest">Assistindo Juntos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{messages.length} Mensagens</span>
                    <button
                      onClick={() => setIsChatMinimized(!isChatMinimized)}
                      title={isChatMinimized ? 'Expandir chat' : 'Minimizar chat'}
                      className="text-slate-500 hover:text-slate-300 transition-all"
                    >
                      <ChevronDown size={14} className={`transition-transform duration-300 ${isChatMinimized ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
              )}

              {(!isAdmin || sidebarTab === 'chat') ? (
                <>
                  {!isChatMinimized && (
                  <div ref={cinemaChatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                    {messages.slice(-15).map((msg, i) => (
                      <div key={msg.id} className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 fade-in fill-mode-both`} style={{ animationDelay: `${i * 0.05}s` }}>
                        <span
                          onClick={() => isHost && msg.senderId !== user.id && handleToggleAdmin(msg.senderId)}
                          className={`text-[10px] font-black uppercase mb-1 flex items-center gap-1 ${isHost && msg.senderId !== user.id ? 'cursor-pointer hover:text-indigo-400' : ''} ${msg.senderId === user.id ? 'text-blue-400' : 'text-slate-500'}`}
                        >
                          {msg.senderName}
                          {roomAdmins.has(msg.senderId) && <span className="text-[7px] bg-indigo-600 text-white px-1 rounded-sm">ADM</span>}
                          {msg.senderId === roomId && <span className="text-[7px] bg-amber-500 text-white px-1 rounded-sm">HOST</span>}
                          {isHost && msg.senderId !== user.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleVideoController(msg.senderId);
                              }}
                              className={`ml-1.5 p-0.5 rounded hover:bg-slate-700/50 transition-all ${allowedVideoControllers.has(msg.senderId) ? 'text-emerald-400' : 'text-slate-600'}`}
                              title={allowedVideoControllers.has(msg.senderId) ? "Remover controle do player" : "Permitir controle do player"}
                            >
                              <Sliders size={10} />
                            </button>
                          )}
                          {!isHost && allowedVideoControllers.has(msg.senderId) && (
                            <span className="text-[8px] text-emerald-400 font-bold uppercase ml-1 flex items-center gap-0.5">
                              <Sliders size={8} /> CTRL
                            </span>
                          )}
                        </span>
                        <div className={`px-4 py-2 rounded-2xl text-xs font-medium max-w-[90%] break-all ${msg.senderId === user.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  )}

                  <div className="p-4 bg-slate-800/30 border-t border-slate-800">
                    <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-4 py-1 border border-slate-700 focus-within:border-blue-500/50 transition-all">
                      <input
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Comentar..."
                        className="flex-1 bg-transparent border-none text-[16px] py-3 text-white outline-none"
                      />
                      <button onClick={() => handleSendMessage()} disabled={!inputText.trim()} className="text-blue-500 disabled:opacity-30"><Send size={18} /></button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide animate-in fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Vídeos Recentes (Salvos Local)</span>
                    <button 
                      onClick={() => {
                        if (confirm("Limpar todo o histórico local?")) {
                          recentVideos.forEach(v => deleteVideoFromLocalDB(v.id));
                          setRecentVideos([]);
                        }
                      }}
                      className="text-[9px] font-bold text-red-500 hover:text-red-400 uppercase"
                    >
                      Limpar Tudo
                    </button>
                  </div>
                  {recentVideos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      Nenhum vídeo recente encontrado.
                    </div>
                  ) : (
                    recentVideos.map((video: any) => (
                      <div key={video.id} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700/30 rounded-2xl group transition-all hover:bg-slate-800/80 hover:border-indigo-500/30 backdrop-blur-md relative overflow-hidden">
                        <div className="w-16 aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-700/50 flex-shrink-0 relative">
                          {video.thumbnail ? (
                            <img src={video.thumbnail} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-900">
                              <Video size={16} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 px-3 flex flex-col justify-center">
                          <p className="text-xs font-black text-white truncate uppercase tracking-tighter" title={video.name}>{video.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{(video.size / (1024 * 1024)).toFixed(1)} MB</p>
                        </div>
                        <div className="flex items-center gap-1.5 z-10">
                          <button
                            onClick={() => playRecentVideo(video)}
                            className="p-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl transition-all border border-emerald-500/10 shadow-lg active:scale-95"
                            title="Transmitir Vídeo"
                          >
                            <Tv size={14} />
                          </button>
                          <button
                            onClick={() => deleteRecentVideo(video.id)}
                            className="p-2 bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all border border-red-500/10 shadow-lg opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-95"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* WATCH PARTY SOURCE SELECTION MODAL */}
        {isWatchPartyOpen && !watchPartySource && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
            {canControlVideo ? (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
                <button onClick={() => setIsWatchPartyOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-all"><X size={20} /></button>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8 text-center flex items-center justify-center gap-3">
                  <Tv className="text-indigo-500" /> Assistir Juntos
                </h3>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <button
                      onClick={() => watchVideoUploadRef.current?.click()}
                      disabled={uploadProgress !== null}
                      className="w-full py-6 rounded-2xl bg-indigo-600/10 border-2 border-dashed border-indigo-500/30 flex flex-col items-center gap-2 text-indigo-400 hover:bg-indigo-600/20 transition-all group disabled:opacity-50"
                    >
                      {uploadProgress !== null ? (
                        <div className="flex flex-col items-center gap-3 w-full px-8">
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest">{uploadProgress}% Carregando...</span>
                        </div>
                      ) : (
                        <>
                          <Upload size={32} className="group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-black uppercase tracking-widest">Subir Vídeo Local</span>
                        </>
                      )}
                    </button>
                    {watchPartySelection?.type === 'video' && !uploadProgress && (
                      <div className="flex flex-col gap-2 w-full">
                        <button 
                          onClick={() => broadcastWatchParty(undefined, undefined, undefined, undefined, true)} 
                          disabled={uploadingWatchParty}
                          className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-lg animate-in zoom-in-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Zap size={16} /> Transmitir P2P (Instantâneo)
                        </button>

                        <button 
                          onClick={() => broadcastWatchParty()} 
                          disabled={uploadingWatchParty}
                          className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-lg animate-in zoom-in-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {uploadingWatchParty ? (
                            <>
                              <Loader2 size={16} className="animate-spin" /> Enviando à Nuvem...
                            </>
                          ) : (
                            <>
                              <Cloud size={16} /> Salvar na Nuvem (Garantido)
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="relative py-2 flex items-center">
                    <div className="flex-1 border-t border-slate-800"></div>
                    <span className="px-4 text-[10px] font-black text-slate-600 uppercase">OU</span>
                    <div className="flex-1 border-t border-slate-800"></div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">Inserir Link (YouTube, Vimeo, etc.)</label>
                    <div className="flex gap-2">
                      <input
                        value={watchPartyInput}
                        onChange={(e) => setWatchPartyInput(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-xs outline-none focus:border-indigo-500 transition-all font-medium"
                      />
                      <button
                        onClick={startWatchPartyWithUrl}
                        className="p-4 bg-slate-800 text-white rounded-2xl hover:bg-slate-700 transition-all border border-slate-700"
                      >
                        Selecionar
                      </button>
                    </div>
                    {watchPartySelection?.type === 'url' && (
                      <button onClick={() => broadcastWatchParty()} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-lg animate-in zoom-in-95 flex items-center justify-center gap-2">
                        <ArrowUpRight size={16} /> Entrar com Link
                      </button>
                    )}
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight px-1 italic">
                      * Nota: Alguns sites bloqueiam o acesso via navegador compartilhado por segurança (X-Frame). Use links diretos de vídeo sempre que possível.
                    </p>
                  </div>

                  {myCards.some(c => c.type === CardType.VIDEO) && (
                    <div className="space-y-4 pt-6 border-t border-slate-800">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Minha Galeria de Vídeos</label>
                      <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                        {myCards.filter(c => c.type === CardType.VIDEO).map(card => (
                          <div key={card.id} className={`relative aspect-video rounded-xl overflow-hidden group border transition-all ${watchPartySelection?.cardId === card.id ? 'border-indigo-500 ring-2 ring-indigo-500/50' : 'border-slate-800 hover:border-slate-600'}`}>
                            <button
                              onClick={() => setWatchPartySelection({ source: card.mediaUrl!, type: 'video', cardId: card.id })}
                              className="w-full h-full text-left"
                            >
                              <img src={card.thumbnail || card.mediaUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                                {watchPartySelection?.cardId === card.id ? <CheckCircle size={24} /> : <Video size={20} className="drop-shadow-lg" />}
                              </div>
                            </button>
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm("Deseja realmente excluir este card de vídeo da sua vitrine?")) {
                                  const { error } = await supabase.from('cards').delete().eq('id', card.id);
                                  if (error) showToast("Erro ao excluir: " + error.message, "error");
                                  else {
                                    showToast("Card excluído com sucesso!", "success");
                                    setMyCards(prev => prev.filter(c => c.id !== card.id));
                                    if (watchPartySelection?.cardId === card.id) {
                                      setWatchPartySelection(null);
                                    }
                                  }
                                }
                              }}
                              className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-[10] shadow-md"
                              title="Remover da Vitrine"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {watchPartySelection?.cardId && (
                        <button onClick={() => broadcastWatchParty()} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-lg flex items-center justify-center gap-2">
                          <Tv size={16} /> Transmitir Card Selecionado
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] w-full max-w-md shadow-2xl relative flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-200">
                <button onClick={() => setIsWatchPartyOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-all"><X size={20} /></button>
                <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 text-indigo-400">
                  <Tv size={36} className="animate-pulse" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Cinema Offline</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Aguardando o anfitrião iniciar um vídeo...</p>
              </div>
            )}
          </div>
        )}

        {isCardModalOpen && (
          <CardModal
            theme={theme}
            onClose={() => { setIsCardModalOpen(false); setEditingCard(null); }}
            onSubmit={onCardCreated}
            userId={user.id}
            initialData={editingCard}
            onShowToast={showToast}
            onNavigateTab={(tab) => {
              setIsCardModalOpen(false);
              setEditingCard(null);
              setActiveTab(tab);
            }}
          />
        )}


        {isQuickSettingsOpen && (
          <QuickSettingsModal
            theme={theme}
            onClose={() => {
              setIsQuickSettingsOpen(false);
              setTargetSessionConfig(null);
            }}
            initialDefaults={targetSessionConfig?.defaults || quickDefaults}
            paidChatConfig={targetSessionConfig?.paidChat || paidChatConfig}
            quickPhrasesConfig={targetSessionConfig?.phrases || quickPhrasesConfig}
            initialTab={quickSettingsTab}
            isRoomCreator={targetSessionConfig?.sessionId ? (targetSessionConfig.sessionId === roomId ? isHost : true) : isHost}
            roomTitle={targetSessionConfig?.sessionName || (roomDetails?.name || 'Esta Sala')}
            onSave={handleSaveQuickSettings}
          />
        )}

        {/* Modal de Renovação de Chat (Cobrança Rotativa com Cronômetro em Vermelho e Débito Automático) */}
        {isRenewalModalOpen && !isHost && paidChatConfig.enabled && (
          <ChatRenewalModal
            isOpen={isRenewalModalOpen}
            onClose={() => {
              if (!isChatPausedDueToRenewal) {
                setIsRenewalModalOpen(false);
              } else {
                showToast('Chat pausado. Renove para continuar conversando.', 'info');
              }
            }}
            onRenew={handleRenewChat}
            onOpenWallet={() => openWallet('recharge')}
            secondsRemaining={renewalSecondsRemaining}
            totalWarningSeconds={paidChatConfig.warningSeconds || 60}
            costCredits={paidChatConfig.costCredits}
            intervalMinutes={paidChatConfig.intervalMinutes}
            userCredits={user.credits}
            autoDebit={autoDebit}
            onToggleAutoDebit={handleToggleAutoDebit}
            roomName={roomDetails?.name || 'Conversa'}
            creatorName={roomDetails?.creator_id ? 'Criador' : undefined}
            theme={theme}
            isExpired={isChatPausedDueToRenewal}
          />
        )}

        {/* MODAL DE CONFIRMAÇÃO DE LIMPEZA DO CHAT */}
        {isClearChatModalOpen && (
          <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className={`max-w-md w-full p-6 sm:p-7 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-slate-900'} shadow-2xl space-y-5 animate-in zoom-in-95`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-red-500">
                    Limpar Conversa e Mídias
                  </h3>
                  <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Sala: {roomDetails?.name || 'Conversa'}
                  </p>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed font-medium ${
                isDark ? 'bg-red-500/5 border-red-500/10 text-slate-300' : 'bg-red-50 border-red-100 text-slate-700'
              }`}>
                Tem certeza que deseja apagar <strong className={isDark ? 'text-white' : 'text-slate-900'}>todas as mensagens de texto, cards, fotos, áudios e vídeos</strong> desta conversa?
                <span className="block mt-2 text-[11px] text-red-500 font-bold">
                  ⚠️ Esta ação é irreversível e limpará o chat para todos os participantes da sala.
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isClearingChat}
                  onClick={() => setIsClearChatModalOpen(false)}
                  className={`flex-1 py-3 px-4 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95 ${
                    isDark ? 'border-slate-700/60 bg-slate-800/60 hover:bg-slate-800 text-slate-300' : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-slate-700'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isClearingChat}
                  onClick={handleClearChat}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  {isClearingChat ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Limpando...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Sim, Limpar Tudo
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ROOM EDITOR MODAL */}
        {isEditingRoom && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className={`p-5 sm:p-8 rounded-none sm:rounded-[2.5rem] w-full h-full sm:h-auto max-w-md shadow-2xl relative flex flex-col max-h-full sm:max-h-[90vh] overflow-y-auto scrollbar-hide border-0 sm:border ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-slate-900'
            }`}>
              
              {/* Modal Header */}
              <div className={`flex items-center justify-between mb-6 pb-3 border-b ${
                isDark ? 'border-slate-800' : 'border-gray-200'
              }`}>
                <button 
                  onClick={() => setIsEditingRoom(false)} 
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold active:scale-95 transition-all ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white' : 'bg-gray-100 border-gray-200 text-slate-700 hover:bg-gray-200'
                  }`}
                >
                  <ArrowLeft size={16} />
                  <span>Voltar</span>
                </button>
                <h3 className={`text-base sm:text-lg font-black uppercase tracking-tighter text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>Customizar Sala</h3>
                <button 
                  onClick={() => setIsEditingRoom(false)} 
                  className={`p-2 rounded-full transition-all active:scale-95 border ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700' : 'bg-gray-100 border-gray-200 text-slate-600 hover:text-slate-900 hover:bg-gray-200'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-6 flex-1">
                {/* Room Avatar */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    onClick={() => roomImageUploadRef.current?.click()}
                    className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl sm:rounded-[2.5rem] border-2 flex items-center justify-center cursor-pointer group overflow-hidden shadow-2xl transition-all ${
                      isDark ? 'border-slate-700 hover:border-blue-500 bg-slate-800' : 'border-gray-300 hover:border-blue-500 bg-gray-50'
                    }`}
                  >
                    {roomDetails?.image_url ? (
                      <img src={roomDetails.image_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={36} className={`${isDark ? 'text-slate-500' : 'text-slate-400'} group-hover:text-blue-500 transition-colors`} />
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      <Upload size={22} className="text-white" />
                      <span className="text-[9px] font-black text-white uppercase">Trocar Foto</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Foto / Avatar da Sala</span>
                    <span className="text-[8px] text-slate-500 font-bold block">Clique no avatar para fazer upload de nova foto</span>
                  </div>
                </div>

                {/* Room Background */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    onClick={() => bgUploadRef.current?.click()}
                    className={`relative w-full h-24 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer group overflow-hidden transition-all ${
                      isDark ? 'border-slate-700 hover:border-emerald-500 bg-slate-800' : 'border-gray-300 hover:border-emerald-500 bg-gray-50'
                    }`}
                  >
                    {roomDetails?.background_url ? (
                      <div className="relative w-full h-full">
                        <img src={roomDetails.background_url} alt="Fundo" className="w-full h-full object-cover opacity-60" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImageIcon size={22} className="text-white drop-shadow-lg" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-500 group-hover:text-emerald-500 transition-colors">
                        <ImageIcon size={24} />
                        <span className="text-xs font-bold">Enviar Imagem de Fundo</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Upload size={18} className="text-white" />
                      <span className="text-[10px] font-black text-white uppercase">Alterar Fundo</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Plano de Fundo (Banner)</span>
                </div>

                {/* Room Name Input */}
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 px-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Nome da Sala</label>
                  <input
                    value={tempRoomName}
                    onChange={(e) => setTempRoomName(e.target.value)}
                    placeholder="Ex: Minha Sala VIP"
                    className={`w-full border focus:border-blue-500 rounded-2xl p-4 text-sm outline-none transition-all font-bold ${
                      isDark ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-slate-900 focus:bg-white placeholder-slate-400'
                    }`}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsEditingRoom(false)}
                    className={`flex-1 py-3.5 sm:py-4 font-black rounded-2xl uppercase tracking-widest text-xs transition-all active:scale-95 border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white' : 'bg-gray-100 border-gray-200 text-slate-600 hover:bg-gray-200 hover:text-slate-900'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveRoomDetails}
                    className="flex-1 py-3.5 sm:py-4 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ROOM SELECTOR MODAL */}
        {
          isRoomSelectorOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className={`p-6 rounded-3xl w-full max-w-sm shadow-2xl relative border ${
                isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-slate-900'
              }`}>
                <button 
                  onClick={() => setIsRoomSelectorOpen(false)} 
                  className={`absolute top-4 right-4 p-2 rounded-full transition-all border ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-gray-100 border-gray-200 text-slate-700 hover:bg-gray-200'
                  }`}
                >
                  <X size={16} />
                </button>
                <h3 className={`text-lg font-black uppercase tracking-tighter mb-4 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>Enviar para...</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
                  {sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => confirmInsertToRoom(s.id)}
                      className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 text-left group ${
                        isDark 
                          ? 'bg-slate-800 hover:bg-emerald-600/20 hover:border-emerald-500/30 border-slate-700' 
                          : 'bg-gray-50 hover:bg-emerald-50 hover:border-emerald-300 border-gray-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.id.startsWith('priv-') ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {s.id.startsWith('priv-') ? <Settings size={14} /> : <MessageSquare size={14} />}
                      </div>
                      <span className={`text-sm font-bold truncate group-hover:text-emerald-500 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        }

        {/* Unified Wallet & Earnings Modal */}
        <WalletModal
          isOpen={isWalletModalOpen}
          onClose={() => {
            setIsWalletModalOpen(false);
            if (user.isLoggedIn && user.id) {
              getFollowers(user.id).then(f => setFollowersCount(f.length)).catch(console.warn);
              getFollowing(user.id).then(f => setFollowingCount(f.length)).catch(console.warn);
            }
          }}
          initialTab={walletInitialTab}
          user={user}
          updateCredits={updateCredits}
          updateFreeCredits={updateFreeCredits}
          openAuth={openAuth}
          onShowToast={showToast}
          withdrawalHistory={withdrawalHistory}
          salesHistory={salesHistory}
          hasFreeSales={hasFreeSales}
          claimTimer={claimTimer}
          theme={theme}
          onRefreshHistory={() => {
            if (user.isLoggedIn) {
              supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
                if (data) setWithdrawalHistory(data);
              });
            }
          }}
        />
      </main >
    </div >
  );
};

export default ChatRoom;
