import { supabase } from './supabase';

const LOCAL_CARD_LIKES_KEY = 'linkcard_local_card_likes_counts';
const LOCAL_USER_LIKED_KEY = 'linkcard_local_user_liked_cards';

function getLocalLikesCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LOCAL_CARD_LIKES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalLikesCounts(counts: Record<string, number>) {
  try {
    localStorage.setItem(LOCAL_CARD_LIKES_KEY, JSON.stringify(counts));
  } catch (e) {
    console.warn('Could not save local likes counts:', e);
  }
}

function getLocalUserLiked(userId?: string): Set<string> {
  try {
    const key = `${LOCAL_USER_LIKED_KEY}_${userId || 'guest'}`;
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocalUserLiked(userId: string | undefined, likedSet: Set<string>) {
  try {
    const key = `${LOCAL_USER_LIKED_KEY}_${userId || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(Array.from(likedSet)));
  } catch (e) {
    console.warn('Could not save local user liked set:', e);
  }
}

export interface LikesData {
  counts: Record<string, number>;
  userLiked: Set<string>;
}

/**
 * Carrega contagem de curtidas e status de curtida do usuário para os cards
 */
export async function fetchLikesForCards(cardIds: string[], userId?: string): Promise<LikesData> {
  const localCounts = getLocalLikesCounts();
  const localUserLiked = getLocalUserLiked(userId);

  const counts: Record<string, number> = { ...localCounts };
  const userLiked = new Set<string>(localUserLiked);

  if (!cardIds || cardIds.length === 0) {
    return { counts, userLiked };
  }

  try {
    // Tenta carregar do Supabase se a tabela card_likes existir
    const { data: likesData, error } = await supabase
      .from('card_likes')
      .select('card_id, user_id')
      .in('card_id', cardIds);

    if (!error && likesData) {
      // Resetar contagens para os cards consultados com base no banco
      const dbCounts: Record<string, number> = {};
      cardIds.forEach(id => { dbCounts[id] = 0; });

      likesData.forEach((like: any) => {
        const cId = like.card_id;
        dbCounts[cId] = (dbCounts[cId] || 0) + 1;
        if (userId && like.user_id === userId) {
          userLiked.add(cId);
        }
      });

      // Mescla com contagens locais garantindo o maior valor
      Object.entries(dbCounts).forEach(([cId, count]) => {
        counts[cId] = Math.max(count, localCounts[cId] || 0);
      });

      // Atualiza cache local
      saveLocalLikesCounts(counts);
      saveLocalUserLiked(userId, userLiked);
    }
  } catch (e) {
    console.warn('Tabela card_likes indisponível, usando cache local:', e);
  }

  return { counts, userLiked };
}

/**
 * Alterna a curtida de um card (curtir / descurtir)
 */
export async function toggleCardLike(
  cardId: string, 
  userId?: string
): Promise<{ isLiked: boolean; newCount: number }> {
  const localCounts = getLocalLikesCounts();
  const localUserLiked = getLocalUserLiked(userId);

  const currentlyLiked = localUserLiked.has(cardId);
  const nextLiked = !currentlyLiked;

  // Atualiza conjunto local
  if (nextLiked) {
    localUserLiked.add(cardId);
  } else {
    localUserLiked.delete(cardId);
  }
  saveLocalUserLiked(userId, localUserLiked);

  // Atualiza contagem local
  const currentCount = localCounts[cardId] || 0;
  const newCount = nextLiked ? currentCount + 1 : Math.max(0, currentCount - 1);
  localCounts[cardId] = newCount;
  saveLocalLikesCounts(localCounts);

  // Tenta persistir no Supabase
  if (userId) {
    try {
      if (nextLiked) {
        await supabase
          .from('card_likes')
          .insert([{ card_id: cardId, user_id: userId }]);
      } else {
        await supabase
          .from('card_likes')
          .delete()
          .match({ card_id: cardId, user_id: userId });
      }

      // Opcionalmente atualiza cards.likes_count se a coluna existir
      try {
        await supabase
          .from('cards')
          .update({ likes_count: newCount })
          .eq('id', cardId);
      } catch {}
    } catch (e) {
      console.warn('Erro ao salvar curtida no Supabase (funcionará localmente):', e);
    }
  }

  return { isLiked: nextLiked, newCount };
}
