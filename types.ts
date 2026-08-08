
export enum CardType {
  CHAT = 'CHAT',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
  AUDIO_CALL = 'AUDIO_CALL',
  VIDEO_CALL = 'VIDEO_CALL'
}

export interface MediaCard {
  id: string;
  creator_id?: string;
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
  createdAt: number;
  defaultWidth?: number;
  layoutStyle?: 'classic' | 'minimal';
  cardColor?: string;
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
  text?: string;
  card?: MediaCard;
  timestamp: number;
}

export interface User {
  id: string;
  name: string;
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
