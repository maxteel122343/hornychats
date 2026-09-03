import { supabase } from './supabase';
import { MediaCard, ShowcaseChatConfig, User } from '../types';

/**
 * Gera o link direto e limpo da sala de chat (sem WhatsApp)
 */
export function getChatRoomUrl(roomId: string): string {
  const baseUrl = window.location.href.split('#')[0].replace(/\/$/, '');
  return `${baseUrl}/#/chat/${roomId}`;
}

/**
 * Copia o link da sala diretamente para a área de transferência com fallback seguro
 */
export async function copyChatRoomLink(roomId: string): Promise<string> {
  const roomUrl = getChatRoomUrl(roomId);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(roomUrl);
    } else {
      throw new Error('Clipboard API not available');
    }
  } catch {
    // Fallback legado para ambientes restritos / iframes
    const textArea = document.createElement('textarea');
    textArea.value = roomUrl;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (e) {
      console.warn('Fallback copy error:', e);
    }
    document.body.removeChild(textArea);
  }
  return roomUrl;
}

const LOCAL_ROUTING_PREFIX = 'creator_chat_routing_';

/**
 * Obtém a configuração de destino do chat do criador
 */
export async function getCreatorChatRouting(creatorId: string): Promise<ShowcaseChatConfig> {
  if (!creatorId) {
    return { mode: 'default_room' };
  }

  // 1. Tentar ler do localStorage (rápido e offline)
  try {
    const cached = localStorage.getItem(`${LOCAL_ROUTING_PREFIX}${creatorId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed;
    }
  } catch (e) {
    console.warn('Error reading local creator chat routing:', e);
  }

  // 2. Tentar buscar da sala do criador no Supabase
  try {
    const { data } = await supabase
      .from('rooms')
      .select('id, name, quick_phrases')
      .eq('id', creatorId)
      .maybeSingle();

    if (data && (data as any).quick_phrases?.showcase_chat_routing) {
      const routing = (data as any).quick_phrases.showcase_chat_routing as ShowcaseChatConfig;
      localStorage.setItem(`${LOCAL_ROUTING_PREFIX}${creatorId}`, JSON.stringify(routing));
      return routing;
    }
  } catch (err) {
    console.warn('Error fetching creator chat routing from Supabase:', err);
  }

  // Padrão: Sala padrão específica (mesma sala para todos)
  const defaultConfig: ShowcaseChatConfig = {
    mode: 'default_room',
    defaultRoomId: creatorId,
    defaultRoomName: `Sala Principal`
  };
  return defaultConfig;
}

/**
 * Salva a configuração de destino do chat do criador (no localStorage e Supabase)
 */
export async function saveCreatorChatRouting(
  creatorId: string,
  config: ShowcaseChatConfig
): Promise<void> {
  if (!creatorId) return;

  // 1. Salvar no localStorage
  try {
    localStorage.setItem(`${LOCAL_ROUTING_PREFIX}${creatorId}`, JSON.stringify(config));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }

  // 2. Persistir no Supabase na sala do criador ou em quick_phrases da sala
  try {
    // Buscar quick_phrases existente para não sobrescrever frases
    const { data: existingRoom } = await supabase
      .from('rooms')
      .select('id, quick_phrases, name')
      .eq('id', creatorId)
      .maybeSingle();

    const mergedPhrases = {
      ...(existingRoom?.quick_phrases || {}),
      showcase_chat_routing: config
    };

    await supabase.from('rooms').upsert([
      {
        id: creatorId,
        creator_id: creatorId,
        name: existingRoom?.name || config.defaultRoomName || 'Sala Principal',
        quick_phrases: mergedPhrases,
        last_activity: new Date().toISOString()
      }
    ], { onConflict: 'id' });
  } catch (err) {
    console.warn('Could not persist creator routing to Supabase:', err);
  }
}

/**
 * Resolve o destino de chat quando alguém clica no ícone de chat de um card na vitrine
 */
export async function resolveShowcaseChatTarget(
  card: MediaCard,
  currentUser: { id: string; name: string }
): Promise<{ targetRoomId: string; targetRoomName: string; isNewRoom: boolean }> {
  const creatorId = card.creator_id || 'creator_unknown';

  // Se o próprio criador clicar no card dele, ele entra na sala dele
  if (currentUser.id && currentUser.id === creatorId) {
    const config = await getCreatorChatRouting(creatorId);
    const targetRoomId = config.defaultRoomId || creatorId;
    const targetRoomName = config.defaultRoomName || card.title || 'Minha Sala';
    return { targetRoomId, targetRoomName, isNewRoom: false };
  }

  // Buscar preferência do criador
  const config = await getCreatorChatRouting(creatorId);

  if (config.mode === 'new_room') {
    // Modo: Nova sala individual para cada visitante (Chat privado 1x1)
    const visitorId = currentUser.id || `guest_${Date.now()}`;
    const targetRoomId = `chat_${creatorId}_${visitorId}`;
    const targetRoomName = `Privado: ${card.creatorName || 'Criador'} & ${currentUser.name || 'Visitante'}`;
    
    // Garantir registro no Supabase
    await ensureRoomExists(targetRoomId, {
      name: targetRoomName,
      creator_id: creatorId,
      image_url: card.thumbnail || card.mediaUrl
    });

    return { targetRoomId, targetRoomName, isNewRoom: true };
  }

  // Modo padrão: Mesma sala padrão específica para todos os visitantes
  const targetRoomId = config.defaultRoomId || creatorId || 'main';
  const targetRoomName = config.defaultRoomName || (card.creatorName ? `Sala de ${card.creatorName}` : 'Sala Principal');

  // Garantir que a sala padrão esteja registrada
  await ensureRoomExists(targetRoomId, {
    name: targetRoomName,
    creator_id: creatorId,
    image_url: card.thumbnail || card.mediaUrl
  });

  return { targetRoomId, targetRoomName, isNewRoom: false };
}

/**
 * Garante que uma sala exista no banco Supabase e no localStorage para qualquer visitante poder carregar
 */
export async function ensureRoomExists(
  roomId: string,
  initialData: { name: string; creator_id?: string; image_url?: string }
): Promise<void> {
  if (!roomId) return;

  // Persistir detalhes localmente
  const localKey = `room_details_${roomId}`;
  const currentSaved = localStorage.getItem(localKey);
  const details = currentSaved ? JSON.parse(currentSaved) : {};
  const updatedDetails = {
    ...details,
    name: initialData.name || details.name || `Sala ${roomId.slice(0, 6)}`,
    creator_id: initialData.creator_id || details.creator_id,
    image_url: initialData.image_url || details.image_url
  };
  localStorage.setItem(localKey, JSON.stringify(updatedDetails));

  // Tentar upsert no Supabase
  try {
    await supabase.from('rooms').upsert([
      {
        id: roomId,
        creator_id: initialData.creator_id || null,
        name: updatedDetails.name,
        image_url: updatedDetails.image_url || null,
        is_active: true,
        last_activity: new Date().toISOString()
      }
    ], { onConflict: 'id' });
  } catch (err) {
    console.warn('Could not upsert room to Supabase:', err);
  }
}

/**
 * Adiciona a sala ao histórico de sessões do usuário para aparecer no menu lateral CONVERSAS
 */
export function addRoomToSessions(roomId: string, name: string, lastMessage = 'Sessão iniciada'): void {
  if (!roomId) return;
  try {
    const saved = localStorage.getItem('chat_sessions');
    let sessions = saved ? JSON.parse(saved) : [];
    const index = sessions.findIndex((s: any) => s.id === roomId);
    
    if (index >= 0) {
      sessions[index] = {
        ...sessions[index],
        name: name || sessions[index].name,
        lastMessage: lastMessage || sessions[index].lastMessage,
        time: 'Agora',
        isActive: true
      };
      // Mover para o topo
      const [item] = sessions.splice(index, 1);
      sessions.unshift(item);
    } else {
      sessions.unshift({
        id: roomId,
        name: name || `Sala: ${roomId.slice(0, 6)}`,
        lastMessage: lastMessage || 'Entrou na sala',
        time: 'Agora',
        isActive: true
      });
    }
    // Marcar as outras como não ativas
    sessions = sessions.map((s: any, idx: number) => ({
      ...s,
      isActive: idx === 0
    }));

    localStorage.setItem('chat_sessions', JSON.stringify(sessions));
  } catch (e) {
    console.warn('Could not add room to sessions:', e);
  }
}
