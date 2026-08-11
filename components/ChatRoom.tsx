
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Plus, Home, Wallet, Share2, MessageSquare, LayoutGrid, QrCode, X, User as UserIcon, LogIn, Camera, Settings, Sun, Moon, Menu, ChevronLeft, ChevronRight, ChevronDown, Copy, CheckCircle, Loader2, RefreshCw, DollarSign, ArrowUpRight, Mic, Video, Upload, StopCircle, Trash2, Aperture, Lock, Zap, History, CreditCard, Mail, ShoppingCart, LogOut, FolderOpen, Edit, Tv, Image as ImageIcon, Cloud, MoreVertical, Minimize2, Maximize2, Power, Sliders } from 'lucide-react';
import { User, Message, MediaCard, ChatSession, CardType, PaymentTransaction, CardDefaults } from '../types';
import { supabase } from '../lib/supabase';
import CardModal from './CardModal';
import MediaCardItem from './MediaCardItem';
import Gallery from './Gallery';
import { QuickSettingsModal } from './QuickSettingsModal';

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

interface ChatRoomProps {
  user: User;
  updateCredits: (amount: number) => void;
  updateFreeCredits: (amount: number, updateTimestamp?: boolean) => void;
  openAuth: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
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
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (onShowToast) onShowToast(message, type);
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

  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const quickVideoRef = useRef<HTMLVideoElement>(null);
  const autoRepeatIntervalRef = useRef<any>(null);

  // Ensure video preview is attached when stream is available
  useEffect(() => {
    if (quickStream && quickVideoRef.current && (quickRecordingType === 'video' || quickRecordingType === 'photo')) {
      if (quickVideoRef.current.srcObject !== quickStream) {
        quickVideoRef.current.srcObject = quickStream;
        quickVideoRef.current.play().catch(e => console.log("Video play error:", e));
      }
    }
  }, [quickStream, quickRecordingType]);

  const isHost = !!(
    roomId === user.id ||
    roomId?.startsWith('priv-') ||
    (roomDetails && roomDetails.creator_id === user.id)
  );
  const isWatchPartyHost = watchPartyHostId ? watchPartyHostId === user.id : !!(localVideoUrl || isHost);
  const isAdmin = isHost || (user.isLoggedIn && roomAdmins.has(user.id)) || roomId?.startsWith('guest_');
  const canControlVideo = true; // Everyone can insert and control video

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
    if (activeTab === 'cinema' || isWatchPartyOpen) {
      loadRecentVideos();
    }
  }, [activeTab, isWatchPartyOpen, isWatchPartyHost, watchPartySource, watchPartyVideoName, watchPartyCardId]);
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
    if (showEarningsModal && user.isLoggedIn) {
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
  }, [showEarningsModal, user.isLoggedIn]);

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
    if (showEarningsModal && user.isLoggedIn) {
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
    if (user.credits < privateRoomCard.creditCost) { setShowQrCode(true); return; }

    updateCredits(-privateRoomCard.creditCost);
    const earnings = Math.floor(privateRoomCard.creditCost * 0.8);
    // Use direct property access now that type definition is updated
    if (privateRoomCard.creator_id) {
      await supabase.rpc('process_card_purchase', {
        p_card_id: privateRoomCard.id,
        p_buyer_id: user.id,
        p_creator_id: privateRoomCard.creator_id,
        p_amount: privateRoomCard.creditCost,
        p_earnings: earnings
      });

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
      const { data } = await supabase.from('rooms').select('name, image_url, background_url, watch_party_data, admins, creator_id').eq('id', roomId).single();
      
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

      if (data) {
        setRoomDetails(data);
        setTempRoomName(data.name);
        setRoomAdmins(new Set(data.admins || []));
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new;
          if (updated.admins) setRoomAdmins(new Set(updated.admins));

          if (updated.watch_party_data) {
            setWatchPartySource(updated.watch_party_data.source);
            setWatchPartyCardId(updated.watch_party_data.card_id);
            setWatchPartyType(updated.watch_party_data.type);
            setWatchPartyHostId(updated.watch_party_data.host_id || null);
            setIsWatchPartyOpen(true);
            setActiveTab('cinema');
          } else {
            setIsWatchPartyOpen(false);
            setWatchPartySource(null);
            setWatchPartyCardId(null);
            setWatchPartyHostId(null);
            cleanupP2P();
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

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeTab]);

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
    if (!file || !roomId || !isHost || !user.id) return;
    if (!user.isLoggedIn) return showToast('Faça login para trocar o fundo.', 'info');

    const fileExt = file.name.split('.').pop();
    const fileName = `${roomId}_bg_${Date.now()}.${fileExt}`;
    const filePath = `room_assets/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
    if (uploadError) return showToast('Erro ao subir fundo.', 'error');

    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);

    // Use upsert here too to ensure room record exists
    const { error: dbError } = await supabase.from('rooms').upsert([{
      id: roomId,
      creator_id: user.id,
      name: roomDetails?.name || 'Chat',
      image_url: roomDetails?.image_url,
      background_url: publicUrl
    }], { onConflict: 'id' });

    if (dbError) return showToast('Erro ao persistir fundo.', 'error');

    setRoomDetails(prev => prev ? { ...prev, background_url: publicUrl } : { name: 'Chat', background_url: publicUrl });
    showToast('Plano de fundo atualizado!', 'success');
  };

  const handleRoomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId || !isHost || !user.id) return;
    if (!user.isLoggedIn) return showToast('Faça login para trocar a imagem.', 'info');

    const fileExt = file.name.split('.').pop();
    const fileName = `${roomId}_thumb_${Date.now()}.${fileExt}`;
    const filePath = `room_assets/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
    if (uploadError) return showToast('Erro ao subir imagem da sala.', 'error');

    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);

    // Use upsert here too to ensure room record exists
    const { error: dbError } = await supabase.from('rooms').upsert([{
      id: roomId,
      creator_id: user.id,
      name: roomDetails?.name || 'Chat',
      image_url: publicUrl,
      background_url: roomDetails?.background_url
    }], { onConflict: 'id' });

    if (dbError) return showToast('Erro ao persistir imagem.', 'error');

    setRoomDetails(prev => prev ? { ...prev, image_url: publicUrl } : { name: 'Chat', image_url: publicUrl });
    showToast('Imagem da sala atualizada!', 'success');
  };

  const handleSaveRoomDetails = async () => {
    if (!roomId || !isHost || !tempRoomName.trim() || !user.id) return;
    if (!user.isLoggedIn) return showToast('Faça login para salvar permanentemente.', 'info');

    const { error } = await supabase.from('rooms').upsert([{
      id: roomId,
      creator_id: user.id,
      name: tempRoomName,
      image_url: roomDetails?.image_url,
      background_url: roomDetails?.background_url
    }], { onConflict: 'id' });

    if (error) {
      console.error('Room save error:', error);
      return showToast('Erro ao salvar nome da sala.', 'error');
    }
    setRoomDetails(prev => prev ? { ...prev, name: tempRoomName } : { name: tempRoomName });
    setIsEditingRoom(false);
    showToast('Nome da sala atualizado!', 'success');

    // Update sidebar session name if exists
    setSessions(prev => prev.map(s => s.id === roomId ? { ...s, name: tempRoomName } : s));
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
    // Clear all watch-party state SYNCHRONOUSLY so React batches everything
    // in ONE render: watchPartySource=null + isWatchPartyOpen=true → modal appears
    setWatchPartySource(null);
    setWatchPartyCardId(null);
    setWatchPartyHostId(null);
    setWatchPartySelection(null);
    setWatchPartyInput('');
    setIsWatchPartyOpen(true);   // open the selection modal immediately
    cleanupP2P();

    // Fire-and-forget async cleanup (broadcast + DB) — does NOT block the modal
    const activeChannel = roomChannel || roomChannelRef.current;
    if (activeChannel) {
      activeChannel.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: { senderId: user.id, targetId: 'all', type: 'watch-party-update', data: null }
      });
    }
    if (roomId) {
      localStorage.removeItem(`watch_party_${roomId}`);
      supabase.from('rooms').update({ watch_party_data: null }).eq('id', roomId)
        .catch((e: any) => console.warn('Background room clear failed:', e));
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
      if (!roomId) {
        // If no room, we just save to gallery/my cards and maybe prompt insert?
        // Logic handled below
      }

      setIsCardModalOpen(false);

      if (roomId) {
        const { error } = await supabase.from('messages').insert([{
          room_id: roomId,
          sender_id: user.id,
          sender_name: user.name,
          card_data: card
        }]);
        if (error) alert('Erro ao criar card');
      }

      if (card.type === CardType.CHAT) addPrivateSession(card.id, card.title);
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
        if (activeTab === 'my_cards') {
          // Fetch again or append? fetching is safer for ID consistency if dealing with DB-gen IDs, 
          // but here ID is client-gen mostly.
          setMyCards(prev => [card, ...prev]);
        }
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
      if (user.credits < card.creditCost) { setShowQrCode(true); return false; }

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
            await supabase.rpc('process_card_purchase', { p_card_id: card.id, p_buyer_id: user.id, p_creator_id: cardData.creator_id, p_amount: card.creditCost, p_earnings: earnings });

            // Log transaction for frontend history
            await supabase.from('sales_transactions').insert([{
              seller_id: cardData.creator_id,
              buyer_id: user.id,
              buyer_name: user.name,
              card_id: card.id,
              card_title: card.title,
              amount: earnings,
              is_free: false
            }]);
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
    setIsMobileMenuOpen(false);
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

  const handleSendMessage = async () => {
    if (!inputText.trim() || !roomId) return;
    const { error } = await supabase.from('messages').insert([{ room_id: roomId, sender_id: user.id, sender_name: user.name, text: inputText }]);
    if (error) alert('Erro ao enviar');
    setInputText('');
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
        showToast('Falha no upload.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao fazer upload.', 'error');
    } finally {
      setIsUploading(false);
      if (quickUploadRef.current) quickUploadRef.current.value = '';
    }
  };

  const startQuickRecording = async (type: 'audio' | 'video' | 'photo') => {
    try {
      const constraints = {
        audio: type !== 'photo',
        video: type !== 'audio' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setQuickStream(stream);
      setQuickRecordingType(type);
      setIsQuickRecording(true);
      setRecordingTime(0);

      // useEffect will handle attaching stream to video element

      if (type !== 'photo') {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: quickRecordingType === 'video' ? 'video/webm' : 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setQuickMediaPreview(url);
          setIsReviewing(true);

          // Stop stream tracks to release camera/mic immediately after capture
          stream.getTracks().forEach(t => t.stop());
          clearInterval(recordingTimerRef.current);
        };
        recorder.start();
        recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao acessar dispositivos de mídia. Verifique as permissões.');
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
      const options = contentType ? { contentType } : undefined;
      const { error } = await supabase.storage.from('media').upload(path, blob, options);
      if (error) {
        console.error('Upload error:', error);
        return null;
      }
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
      return publicUrl;
    } catch (e) {
      console.error('Upload exception:', e);
      return null;
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
      setActivePayment({ id: data.payment_id_db, qr_code: data.qr_code, qr_code_base64: data.qr_code_base64, status: 'pending', amount: amountToUse, credits_amount: credits });
    } catch (err: any) { alert(`Falha PIX: ${err.message}`); } finally { setIsGeneratingPix(false); }
  };

  const handleCheckStatus = async () => { /* ... reuse existing ... */
    if (!activePayment) return;
    setIsCheckingStatus(true);
    try {
      const { data } = await supabase.from('payment_transactions').select('*').eq('id', activePayment.id).single();
      if (data && data.status === 'approved') handleApprovedPayment(data as PaymentTransaction);
      else alert("Pendente...");
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
            <button onClick={() => setShowEarningsModal(true)} className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-emerald-500 hover:bg-emerald-500/20 transition-all cursor-pointer">
              <DollarSign size={20} />
              <span className="text-[9px] font-black">{user.earnings}</span>
            </button>
          )}
        </div>
        {!isSidebarCollapsed && (
          <div className="text-center animate-in fade-in">
            <h2 className={`text-xs font-black ${colors.textHighlight} uppercase tracking-[0.2em]`}>{user.name}</h2>
            <div className="flex flex-col gap-1 mt-2"><p className={`text-[9px] ${colors.text} font-bold uppercase`}>{user.isLoggedIn ? 'Autenticado' : 'Visitante'}</p></div>
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

          return (
            <div key={session.id} onClick={() => { navigate(`/chat/${session.id}`); setIsMobileMenuOpen(false); }} className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 group ${isActive ? `${colors.primarySoft} ${colors.primaryBorder}` : `hover:bg-gray-100 dark:hover:bg-slate-800/60 ${colors.border}`} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <div className={`w-10 h-10 min-w-[2.5rem] rounded-xl flex items-center justify-center transition-colors overflow-hidden ${isActive ? `${colors.primary} text-white shadow-lg` : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                {displayImage ? (
                  <img src={displayImage} className="w-full h-full object-cover" />
                ) : (
                  session.id.startsWith('priv-') ? <Settings size={16} /> : <MessageSquare size={18} />
                )}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0 animate-in fade-in">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col min-w-0">
                      <h3 className={`text-sm font-semibold truncate ${isOtherUserRoom ? 'text-blue-400 dark:text-blue-400' : colors.textHighlight}`}>
                        {isActive && roomDetails?.name ? roomDetails.name : session.name}
                      </h3>
                      {isOtherUserRoom && (
                        <span className="text-[8px] text-blue-400 font-black uppercase tracking-wider mt-0.5">
                          Sala de outro usuário ({session.id.slice(0, 6)})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={(e) => handleCloseSession(e, session.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-500 transition-all"
                      >
                        <X size={12} />
                      </button>
                      <span className={`text-[10px] ${colors.text}`}>{session.time}</span>
                    </div>
                  </div>
                  <p className={`text-[11px] ${colors.text} truncate opacity-70`}>{session.lastMessage}</p>
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
      className={`flex overflow-hidden ${colors.text} ${colors.bg}`}
      style={{ height: 'var(--viewport-height, 100vh)' }}
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
        className={`flex-1 flex flex-col relative ${colors.bg}`}
        style={roomDetails?.background_url ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,${isDark ? 0.6 : 0.4}), rgba(0,0,0,${isDark ? 0.6 : 0.4})), url(${roomDetails.background_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        } : {}}
      >
        <input type="file" ref={bgUploadRef} onChange={handleBackgroundUpload} className="hidden" accept="image/*" />
        <input type="file" ref={roomImageUploadRef} onChange={handleRoomImageUpload} className="hidden" accept="image/*" />
        <header className={`h-[64px] border-b ${colors.border} flex items-center justify-between px-4 md:px-6 ${colors.headerBg} backdrop-blur-md`}>
          {/* Header Content */}
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"><Menu size={18} className={colors.textHighlight} /></button>
            <button onClick={() => navigate('/')} className={`p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg ${colors.text}`}><Home size={18} /></button>
            <button onClick={() => navigate('/')} className={`p-2 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-500 transition-all group`} title="Fechar Chat"><X size={20} /></button>
            <div className="flex items-center gap-2 ml-1">
              <div className={`w-10 h-10 rounded-xl overflow-hidden border ${colors.border} bg-slate-800 flex items-center justify-center`}>
                {roomDetails?.image_url ? (
                  <img src={roomDetails.image_url} className="w-full h-full object-cover" />
                ) : (
                  <MessageSquare size={18} className="text-slate-500" />
                )}
              </div>
              <div>
                <h2 className={`text-sm font-black ${colors.textHighlight} uppercase tracking-tighter`}>{roomDetails?.name || sessions.find(s => s.id === roomId)?.name || 'Conversa'}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className={`text-[9px] font-black ${colors.text} uppercase tracking-widest`}>{isHost ? 'MEU ESPAÇO' : 'ONLINE'}</span>
                </div>
              </div>
              {isHost && (
                <button
                  onClick={() => setIsEditingRoom(true)}
                  className={`p-2 rounded-lg hover:bg-white/10 transition-all ${colors.text} opacity-50 hover:opacity-100`}
                >
                  <Edit size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={toggleTheme} className={`p-2 rounded-xl border ${colors.border} ${colors.text} hover:opacity-70 transition-all`}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <div onClick={() => setShowQrCode(true)} className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs border border-emerald-500/20 font-black cursor-pointer hover:bg-emerald-500/20 transition-all`}><Wallet size={16} /><span>{user.credits} c</span></div>
            {/* Added Earnings Icon to Header for ease of access */}
            {user.isLoggedIn && (
              <button onClick={() => setShowEarningsModal(true)} className="flex sm:hidden items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 font-black">
                <DollarSign size={16} />
              </button>
            )}
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/#/chat/${roomId}`); alert('Link copiado!'); }} className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 ${colors.primarySoft} ${colors.primaryText} rounded-xl border ${colors.primaryBorder} hover:opacity-80 transition-all font-black text-xs uppercase tracking-tighter`}><Share2 size={16} /><span className="hidden sm:inline">Convidar</span></button>
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
            <nav className={`flex px-2 md:px-6 border-b ${colors.border} ${isDark ? 'bg-slate-900/10' : 'bg-gray-100'} overflow-x-auto scrollbar-hide no-scrollbar`}>
              <button onClick={() => setActiveTab('chat')} className={`px-4 md:px-8 py-4 text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'chat' ? `border-b-2 ${isDark ? 'border-blue-500 text-white' : 'border-red-600 text-red-600'}` : `${colors.text} hover:opacity-70`}`}><MessageSquare size={14} /> Feed</button>
              <button onClick={() => setActiveTab('showcase')} className={`px-4 md:px-8 py-4 text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'showcase' ? `border-b-2 ${isDark ? 'border-blue-500 text-white' : 'border-red-600 text-red-600'}` : `${colors.text} hover:opacity-70`}`}><LayoutGrid size={14} /> Vitrine</button>
              <button onClick={() => setActiveTab('my_cards')} className={`px-4 md:px-8 py-4 text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'my_cards' ? `border-b-2 ${isDark ? 'border-blue-500 text-white' : 'border-red-600 text-red-600'}` : `${colors.text} hover:opacity-70`}`}><FolderOpen size={14} /> Meus Cards</button>
              <button onClick={() => setActiveTab('cinema')} className={`px-4 md:px-8 py-4 text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'cinema' ? `border-b-2 ${isDark ? 'border-blue-500 text-white' : 'border-red-600 text-red-600'}` : `${colors.text} hover:opacity-70`}`}><Tv size={14} /> Cinema</button>
            </nav>

            <div className={`flex-1 overflow-y-auto flex flex-col scrollbar-hide relative ${activeTab === 'cinema' && watchPartySource ? 'p-0 overflow-hidden' : 'p-4 md:p-6'}`}>
              {activeTab === 'chat' ? (
                <div className="flex-1 space-y-8 max-w-5xl mx-auto w-full py-4 pb-24">
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
                    <div key={msg.id} className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-3 duration-500`}>
                      {msg.text && (<div className={`max-w-[85%] md:max-w-[80%] px-5 py-3.5 rounded-2xl text-sm shadow-sm font-medium break-all ${msg.senderId === user.id ? `${colors.primary} text-white rounded-tr-none` : `${isDark ? 'bg-slate-800/80 text-slate-200 border-slate-700/30' : 'bg-white text-slate-800 border-gray-200'} border rounded-tl-none`}`}>{msg.text}</div>)}
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
                        />
                      )}
                      <span className={`text-[9px] ${colors.text} mt-2 uppercase font-black tracking-widest px-1 opacity-60`}>{msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : activeTab === 'showcase' ? (
                <div className="max-w-6xl mx-auto w-full pb-24"><Gallery user={user} /></div>
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
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={`absolute bottom-0 left-0 right-0 p-4 md:p-6 border-t ${colors.border} ${isDark ? 'bg-[#070d18]/90' : 'bg-white/90'} backdrop-blur-md transition-all duration-300`}>
              <div className="max-w-4xl mx-auto">
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
                  <div className="flex flex-col gap-2 md:gap-3">
                    {/* Function Icons Bar (Visible on Mobile, Hidden on Desktop) */}
                    <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-1 scrollbar-hide no-scrollbar -mx-2 px-2">
                      <button disabled={isUploading} onClick={() => quickUploadRef.current?.click()} className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-slate-800 text-slate-400 rounded-xl border border-slate-700/50" title="Upload"><Upload size={16} /></button>
                      <button disabled={isUploading} onClick={() => startQuickRecording('photo')} className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-slate-800 text-slate-400 rounded-xl border border-slate-700/50" title="Foto"><Camera size={16} /></button>
                      <button disabled={isUploading} onClick={() => { setActiveTab('cinema'); setIsWatchPartyOpen(true); }} className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20" title="TV" style={{touchAction:'manipulation'}}><Tv size={16} /></button>
                      <button disabled={isUploading} onClick={() => setIsCardModalOpen(true)} className={`flex-shrink-0 w-9 h-9 flex items-center justify-center ${colors.primary} text-white rounded-xl shadow-lg`} title="Novo Card"><Plus size={18} /></button>
                      <button disabled={isUploading} onClick={() => setIsQuickSettingsOpen(true)} className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-slate-800 text-slate-400 rounded-xl border border-slate-700/50" title="Ajustes"><Settings size={14} /></button>
                      <button disabled={isUploading} onClick={() => startQuickRecording('audio')} className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-slate-800 text-slate-400 rounded-xl border border-slate-700/50" title="Áudio"><Mic size={16} /></button>
                      <button disabled={isUploading} onClick={() => startQuickRecording('video')} className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-slate-800 text-slate-400 rounded-xl border border-slate-700/50" title="Vídeo"><Video size={16} /></button>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                      {/* Desktop Only Actions - Left Side */}
                      <div className="hidden md:flex items-center gap-2">
                        <button disabled={isUploading} onClick={() => quickUploadRef.current?.click()} className={`w-12 h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-200 text-slate-500 hover:bg-gray-300'} rounded-2xl transition-all`} title="Upload Rápido"><Upload size={20} /></button>
                        <button disabled={isUploading} onClick={() => startQuickRecording('photo')} className={`w-12 h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-200 text-slate-500 hover:bg-gray-300'} rounded-2xl transition-all`} title="Foto Rápida"><Camera size={20} /></button>
                        <button disabled={isUploading} onClick={() => { setActiveTab('cinema'); setIsWatchPartyOpen(true); }} className={`w-12 h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-indigo-400' : 'bg-indigo-100 text-indigo-500 hover:bg-indigo-200'} rounded-2xl transition-all`} title="Assistir Juntos" style={{touchAction:'manipulation'}}><Tv size={20} /></button>
                        <button disabled={isUploading} onClick={() => setIsCardModalOpen(true)} className={`w-12 h-12 flex items-center justify-center ${colors.primary} text-white rounded-2xl shadow-xl hover:opacity-90 transform hover:-translate-y-0.5 transition-all`} title="Criar Card Avançado"><Plus size={24} /></button>
                      </div>

                      {/* Main Text Input Area */}
                      <div className={`flex-1 ${colors.inputBg} rounded-2xl border ${colors.border} flex items-center px-4 focus-within:ring-1 ${isDark ? 'focus-within:ring-blue-500/30' : 'focus-within:ring-red-500/30'} transition-all shadow-sm`}>
                        <input
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Fale algo..."
                          className={`w-full bg-transparent border-none text-[16px] py-3.5 md:py-4.5 ${colors.textHighlight} outline-none placeholder:opacity-40 font-medium`}
                        />
                      </div>

                      <div className="flex items-center gap-1.5 md:gap-2">
                        {/* Desktop Only Actions - Right Side */}
                        <div className="hidden md:flex gap-2">
                          <button disabled={isUploading} onClick={() => setIsQuickSettingsOpen(true)} className="w-12 h-12 flex items-center justify-center bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-2xl transition-all border border-slate-700" title="Configurar Padrões"><Settings size={18} /></button>
                          <button disabled={isUploading} onClick={() => startQuickRecording('audio')} className={`w-12 h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:text-red-400' : 'bg-gray-200 text-slate-500 hover:text-red-500'} rounded-2xl transition-all`} title="Áudio Rápido"><Mic size={20} /></button>
                          <button disabled={isUploading} onClick={() => startQuickRecording('video')} className={`w-12 h-12 flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:text-blue-400' : 'bg-gray-200 text-slate-500 hover:text-blue-500'} rounded-2xl transition-all`} title="Vídeo Rápido"><Video size={20} /></button>
                        </div>

                        {/* Send Button */}
                        <button
                          onClick={handleSendMessage}
                          disabled={!inputText.trim()}
                          className={`w-11 h-11 md:w-12 md:h-12 flex-shrink-0 flex items-center justify-center ${colors.primary} text-white rounded-2xl hover:opacity-90 shadow-lg transition-all disabled:opacity-25 active:scale-90`}
                        >
                          <Send size={18} />
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
                  ? "absolute inset-0 z-[490] bg-[#050a14] flex flex-col md:flex-row overflow-hidden"
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
                          navigator.clipboard.writeText(fullMessage)
                            .then(() => showToast('Link da sala copiado!', 'success'))
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
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
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
                      <button onClick={handleSendMessage} disabled={!inputText.trim()} className="text-blue-500 disabled:opacity-30"><Send size={18} /></button>
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

        {isCardModalOpen && <CardModal onClose={() => { setIsCardModalOpen(false); setEditingCard(null); }} onSubmit={onCardCreated} userId={user.id} initialData={editingCard} onShowToast={showToast} />}


        {isQuickSettingsOpen && (
          <QuickSettingsModal
            onClose={() => setIsQuickSettingsOpen(false)}
            initialDefaults={quickDefaults}
            onSave={(newDefaults: CardDefaults) => {
              setQuickDefaults(newDefaults);
              setIsQuickSettingsOpen(false);
              showToast('Configurações padrão salvas!', 'success');
            }}
          />
        )}

        {/* ROOM EDITOR MODAL */}
        {isEditingRoom && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] w-full max-w-md shadow-2xl relative">
              <button onClick={() => setIsEditingRoom(false)} className="absolute top-6 right-6 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-all"><X size={20} /></button>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8 text-center">Customizar Sala</h3>

              <div className="flex flex-col items-center gap-2">
                <div
                  onClick={() => roomImageUploadRef.current?.click()}
                  className="relative w-32 h-32 rounded-[3rem] border-2 border-slate-700 bg-slate-800 flex items-center justify-center cursor-pointer group overflow-hidden shadow-2xl"
                >
                  {roomDetails?.image_url ? (
                    <img src={roomDetails.image_url} className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={40} className="text-slate-600 group-hover:text-blue-500 transition-colors" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload size={24} className="text-white" />
                  </div>
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Avatar da Sala</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div
                  onClick={() => bgUploadRef.current?.click()}
                  className="relative w-full h-24 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800 flex items-center justify-center cursor-pointer group overflow-hidden"
                >
                  {roomDetails?.background_url ? (
                    <div className="relative w-full h-full">
                      <img src={roomDetails.background_url} className="w-full h-full object-cover opacity-50" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon size={24} className="text-white drop-shadow-lg" />
                      </div>
                    </div>
                  ) : (
                    <ImageIcon size={32} className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload size={20} className="text-white" />
                  </div>
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Plano de Fundo</span>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">Nome da Sala</label>
                  <input
                    value={tempRoomName}
                    onChange={(e) => setTempRoomName(e.target.value)}
                    placeholder="Ex: Minha Sala VIP"
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500 transition-all font-bold"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setIsEditingRoom(false)}
                    className="flex-1 py-4 bg-slate-800 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-slate-700 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveRoomDetails}
                    className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
        }

        {/* ROOM SELECTOR MODAL */}
        {
          isRoomSelectorOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl relative">
                <button onClick={() => setIsRoomSelectorOpen(false)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-all"><X size={16} /></button>
                <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4 text-center">Enviar para...</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
                  {sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => confirmInsertToRoom(s.id)}
                      className="w-full p-3 rounded-xl bg-slate-800 hover:bg-emerald-600/20 hover:border-emerald-500/30 border border-slate-700 transition-all flex items-center gap-3 text-left group"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.id.startsWith('priv-') ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {s.id.startsWith('priv-') ? <Settings size={14} /> : <MessageSquare size={14} />}
                      </div>
                      <span className="text-sm font-bold text-slate-300 group-hover:text-emerald-400 truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        }

        {/* Earnings Modal with Withdraw Tabs */}
        {
          showEarningsModal && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-hide">
                <button onClick={() => setShowEarningsModal(false)} className="absolute top-6 right-6 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-all"><X size={20} /></button>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-6">Central de Ganhos</h3>

                <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl mb-8 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-20"><DollarSign size={64} className="text-emerald-500" /></div>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-2 relative z-10">Disponível para Saque</span>
                  <span className="text-5xl font-black text-white relative z-10 tracking-tight">{user.earnings} <span className="text-sm font-bold text-slate-500">CR</span></span>
                </div>

                <div className="mb-6">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Método de Recebimento</label>
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    <button onClick={() => setWithdrawalMethod('pix')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${withdrawalMethod === 'pix' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}><QrCode size={14} /> PIX</button>
                    <button onClick={() => setWithdrawalMethod('picpay')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${withdrawalMethod === 'picpay' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}><Wallet size={14} /> PicPay</button>
                    <button onClick={() => setWithdrawalMethod('paypal')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${withdrawalMethod === 'paypal' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}><CreditCard size={14} /> PayPal</button>
                    <button onClick={() => setWithdrawalMethod('stripe')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${withdrawalMethod === 'stripe' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}><CreditCard size={14} /> Stripe</button>
                  </div>

                  <input
                    value={withdrawalKey}
                    onChange={(e) => setWithdrawalKey(e.target.value)}
                    onBlur={handleSavePaymentKey}
                    placeholder={withdrawalMethod === 'pix' ? "Chave PIX (CPF, Email, Aleatória)" : "Seu E-mail da conta"}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold mb-4"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      value={withdrawalCpf}
                      onChange={(e) => setWithdrawalCpf(e.target.value)}
                      placeholder="Seu CPF"
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                    />
                    <input
                      value={withdrawalFullName}
                      onChange={(e) => setWithdrawalFullName(e.target.value)}
                      placeholder="Nome Completo"
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                    />
                  </div>
                  <p className="text-[8px] text-slate-500 mt-2 font-bold uppercase">* Verificamos CPF e Nome para sua segurança.</p>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-3xl mb-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 mr-4">
                      <h4 className="text-xs font-black text-white uppercase tracking-tight">Créditos Gratuitos</h4>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Saldo: {user.free_credits || 0} CR</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase leading-tight italic">
                        Reinvindique créditos grátis dos usuários que usaram créditos grátis e use para comprar cards de outros criadores!
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => updateFreeCredits(10, true)}
                        disabled={!!claimTimer || !hasFreeSales}
                        className="px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase hover:enabled:bg-indigo-600 hover:enabled:text-white transition-all disabled:opacity-40 disabled:grayscale"
                      >
                        {claimTimer ? `Aguarde ${Math.floor(claimTimer / 60)}:${(claimTimer % 60).toString().padStart(2, '0')}` : 'Reivindicar +10'}
                      </button>
                      {!hasFreeSales && !claimTimer && (
                        <span className="text-[7px] text-red-500/70 font-black uppercase tracking-tighter">Nenhuma "venda grátis" pendente</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[8px] text-slate-600 font-bold uppercase leading-relaxed border-t border-slate-700/50 pt-3 mt-2">
                    * Este é um incentivo para você interagir com a plataforma quando alguém consome seu conteúdo gratuitamente.
                  </p>
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={user.earnings < 100 || withdrawalPending || !withdrawalKey}
                  className="w-full py-4 bg-white text-slate-900 font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-slate-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all mb-4"
                >
                  {withdrawalPending ? <Loader2 className="animate-spin" /> : <ArrowUpRight size={16} />}
                  {withdrawalPending ? 'Processando...' : 'Solicitar Saque (24h)'}
                </button>
                <p className="text-[9px] text-center text-slate-500 uppercase font-bold mb-8">Mínimo para saque: 100 créditos</p>

                <div className="border-t border-slate-800 pt-6">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><History size={12} /> Histórico de Saques</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide mb-6">
                    {withdrawalHistory.length === 0 ? (
                      <p className="text-center text-slate-600 text-xs italic">Nenhum saque registrado.</p>
                    ) : (
                      withdrawalHistory.map(w => (
                        <div key={w.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl">
                          <div className="flex flex-col">
                            <span className="text-white font-bold text-xs">{w.amount} CR</span>
                            <span className="text-[9px] text-slate-500 uppercase">{w.method}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${w.status === 'paid' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-yellow-500/20 text-yellow-500'}`}>{w.status}</span>
                            <span className="text-[8px] text-slate-600 block mt-1">{new Date(w.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* SALES HISTORY SECTION */}
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><ShoppingCart size={12} /> Histórico de Vendas (Quem comprou)</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
                    {salesHistory.length === 0 ? (
                      <p className="text-center text-slate-600 text-xs italic">Nenhuma venda realizada ainda.</p>
                    ) : (
                      salesHistory.map(sale => (
                        <div key={sale.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-xs">
                              {sale.buyer_name ? sale.buyer_name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div className="flex flex-col max-w-[120px]">
                              <span className="text-white font-bold text-xs truncate">{sale.buyer_name || 'Usuário'}</span>
                              <span className="text-[9px] text-slate-500 truncate">{sale.card_title}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-emerald-400 font-black text-xs">+{sale.amount} CR</span>
                            <span className="text-[8px] text-slate-600 block mt-1">{new Date(sale.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {
          showQrCode && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl relative text-center">
                <button onClick={() => setShowQrCode(false)} className="absolute top-6 right-6 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-all"><X size={20} /></button>

                {!activePayment ? (
                  <>
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                      <QrCode size={32} className="text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Recarregar Créditos</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Escolha um pacote e pague via PIX</p>

                    <div className="space-y-3">
                      {[5, 10, 20].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => handleGeneratePix(amount)}
                          disabled={isGeneratingPix}
                          className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center justify-between group"
                        >
                          <div className="flex flex-col items-start bg-transparent">
                            <span className="text-white font-black text-lg">R$ {amount},00</span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold group-hover:text-emerald-400">
                              {amount === 5 ? '50 créditos' : amount === 10 ? '120 créditos (+20%)' : '300 créditos (+50%)'}
                            </span>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center group-hover:bg-emerald-500 transition-all">
                            <Zap size={16} className="text-slate-400 group-hover:text-white" />
                          </div>
                        </button>
                      ))}
                    </div>
                    {isGeneratingPix && <div className="mt-4 text-emerald-500 font-bold text-xs uppercase animate-pulse">Gerando QR Code...</div>}
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-6">Pagamento PIX</h3>
                    <div className="bg-white p-4 rounded-2xl mb-6 mx-auto w-64 h-64 flex items-center justify-center">
                      {activePayment.qr_code_base64 ? (
                        <img src={`data:image/png;base64,${activePayment.qr_code_base64}`} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full bg-slate-200 animate-pulse rounded-xl" />
                      )}
                    </div>

                    <div className="space-y-3">
                      <button onClick={handleCopyPix} className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                        {copySuccess ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        {copySuccess ? 'Copia Cola Copiado!' : 'Copiar Código PIX'}
                      </button>
                      <button onClick={handleCheckStatus} disabled={isCheckingStatus} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all flex items-center justify-center gap-2">
                        {isCheckingStatus ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Verificar Pagamento
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        }
      </main >
    </div >
  );
};

export default ChatRoom;
