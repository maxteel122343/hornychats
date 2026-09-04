
export enum CardType {
  CHAT = 'CHAT',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
  AUDIO_CALL = 'AUDIO_CALL',
  VIDEO_CALL = 'VIDEO_CALL'
}

export type AppTheme = 'dark' | 'light' | 'gold';

export interface MediaCard {
  id: string;
  creator_id?: string;
  creatorName?: string;
  creatorPhoto?: string;
  type: CardType;
  title: string;
  description: string;
  thumbnail?: string;
  creditCost: number;
  mediaUrl?: string;
  mediaType: 'upload' | 'record' | 'none';
  category: string;
  group?: string;
  tags: string[];
  duration: number;
  expirySeconds: number;
  repeatInterval?: number;
  isBlur: boolean;
  blurLevel: number;
  saveToGallery: boolean;
  postToChat?: boolean;
  createdAt: number;
  defaultWidth?: number;
  layoutStyle?: 'classic' | 'minimal';
  cardColor?: string;
  likesCount?: number;
  isLiked?: boolean;
}

export interface CardDefaults {
  title: string;
  description: string;
  creditCost: number;
  duration: number;
  expirySeconds: number;
  group: string;
  tags: string;
  blurLevel: number;
  layoutStyle: 'classic' | 'minimal';
  defaultWidth: number;
  repeatInterval: number;
  category: string;
  cardColor: string;
  postToChat?: boolean;
}

export interface ChatSession {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  isActive: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text?: string;
  card?: MediaCard;
  timestamp: number;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  credits: number;
  earnings: number;
  isLoggedIn: boolean;
  isHost?: boolean;
  profilePhoto?: string;
  // Campos de Pagamento Persistentes
  pixKey?: string;
  picpayEmail?: string;
  paypalEmail?: string;
  stripeEmail?: string;
  free_credits?: number;
  last_free_claim_at?: string;
}

export interface PaymentTransaction {
  id: string;
  mp_payment_id?: string;
  status: 'pending' | 'approved' | 'rejected';
  qr_code: string;
  qr_code_base64: string;
  amount: number;
  credits_amount: number;
}

export interface CreditTransaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  type: 'purchase' | 'fee' | 'transfer';
  card_id?: string;
  created_at: string;
}

export interface PaidChatConfig {
  enabled: boolean; // Backwards compatible (true when timeLimitEnabled is true)
  timeLimitEnabled?: boolean; // Toggle 1: Ativar modelo de tempo limitado do chat
  paidRenewalEnabled?: boolean; // Toggle 2: Ativar cobrança rotativa em créditos (separado do tempo)
  intervalMinutes: number; // Tempo do ciclo (ex: 5 min)
  costCredits: number; // Custo para renovar (se cobrança rotativa estiver ativada)
  warningSeconds: number; // Janela do aviso regressivo (ex: 60s)
  autoDebitDefault?: boolean; // Débito automático padrão
  showTimerToParticipants?: boolean; // Exibir cronômetro no topo para os usuários
  autoCloseOnExpire?: boolean; // Toggle 3: Fechamento automático da sala ao expirar (sem opção de renovação)
  timerMode?: 'individual' | 'room_global'; // Toggle 4: Cronômetro individual por usuário vs global sincronizado com a sala
  roomTimerStartedAt?: number; // Timestamp do início do tempo global da sala
  roomCycleStartTime?: number;
}

export interface UserTimerState {
  userId: string;
  userName: string;
  userPhoto?: string;
  secondsRemaining: number;
  cycleMinutes: number;
  renewalCount: number; // Quantas vezes o relógio já reiniciou
  status: 'active' | 'warning' | 'expired' | 'renewed' | 'left';
  enteredAt: number;
  lastHeartbeat: number;
}

export interface QuickPhrasesConfig {
  creatorPhrases: string[];
  visitorPhrases: string[];
}

export type ShowcaseChatDestinationMode = 'default_room' | 'new_room';

export interface ShowcaseChatConfig {
  mode: ShowcaseChatDestinationMode;
  defaultRoomId?: string;
  defaultRoomName?: string;
}
