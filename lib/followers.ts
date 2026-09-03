import { supabase } from './supabase';

export interface FollowerUser {
  id: string;
  name: string;
  username?: string;
  profile_photo?: string;
  created_at?: string;
}

const LOCAL_FOLLOWERS_KEY = 'linkcard_local_followers_map';

function getLocalFollowMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LOCAL_FOLLOWERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalFollowMap(map: Record<string, string[]>) {
  try {
    localStorage.setItem(LOCAL_FOLLOWERS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Could not save local follow map:', e);
  }
}

/**
 * Retorna a lista de usuários que SEGUEM o userId (Seguidores)
 */
export async function getFollowers(userId: string): Promise<FollowerUser[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('followers')
      .select('follower_id, created_at')
      .eq('following_id', userId);

    if (!error && data && data.length > 0) {
      const followerIds = data.map(d => d.follower_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, profile_photo')
        .in('id', followerIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach(p => {
        profileMap[p.id] = p;
      });

      return data.map(d => ({
        id: d.follower_id,
        name: profileMap[d.follower_id]?.username || `Usuário ${d.follower_id.slice(0, 5)}`,
        username: profileMap[d.follower_id]?.username,
        profile_photo: profileMap[d.follower_id]?.profile_photo,
        created_at: d.created_at
      }));
    }
  } catch (e) {
    // Tabela pode não existir ainda no Supabase
  }

  // Fallback LocalStorage
  const map = getLocalFollowMap();
  const followersOfUser: string[] = [];
  Object.keys(map).forEach(followerId => {
    if (map[followerId]?.includes(userId)) {
      followersOfUser.push(followerId);
    }
  });

  return followersOfUser.map(fId => ({
    id: fId,
    name: `Usuário ${fId.slice(0, 5)}`
  }));
}

/**
 * Retorna a lista de criadores que o userId SEGUE (Seguindo)
 */
export async function getFollowing(userId: string): Promise<FollowerUser[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('followers')
      .select('following_id, created_at')
      .eq('follower_id', userId);

    if (!error && data && data.length > 0) {
      const followingIds = data.map(d => d.following_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, profile_photo')
        .in('id', followingIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach(p => {
        profileMap[p.id] = p;
      });

      return data.map(d => ({
        id: d.following_id,
        name: profileMap[d.following_id]?.username || `Criador ${d.following_id.slice(0, 5)}`,
        username: profileMap[d.following_id]?.username,
        profile_photo: profileMap[d.following_id]?.profile_photo,
        created_at: d.created_at
      }));
    }
  } catch (e) {
    // Tabela pode não existir ainda no Supabase
  }

  // Fallback LocalStorage
  const map = getLocalFollowMap();
  const following = map[userId] || [];
  return following.map(cId => ({
    id: cId,
    name: `Criador ${cId.slice(0, 5)}`
  }));
}

/**
 * Segue um criador
 */
export async function followUser(followerId: string, followingId: string): Promise<boolean> {
  if (!followerId || !followingId || followerId === followingId) return false;

  // Atualiza LocalStorage sempre para resposta instantânea
  const map = getLocalFollowMap();
  const list = new Set(map[followerId] || []);
  list.add(followingId);
  map[followerId] = Array.from(list);
  saveLocalFollowMap(map);

  // Tenta persistir no Supabase
  try {
    const { error } = await supabase.from('followers').upsert([
      { follower_id: followerId, following_id: followingId }
    ], { onConflict: 'follower_id,following_id' });

    if (error) {
      console.warn('Supabase follow warning (will use local fallback if table pending):', error.message);
    }
  } catch (err) {
    console.warn('Follow table error in Supabase:', err);
  }

  return true;
}

/**
 * Deixa de seguir um criador
 */
export async function unfollowUser(followerId: string, followingId: string): Promise<boolean> {
  if (!followerId || !followingId) return false;

  // Atualiza LocalStorage
  const map = getLocalFollowMap();
  if (map[followerId]) {
    map[followerId] = map[followerId].filter(id => id !== followingId);
    saveLocalFollowMap(map);
  }

  // Tenta remover no Supabase
  try {
    const { error } = await supabase
      .from('followers')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) {
      console.warn('Supabase unfollow warning:', error.message);
    }
  } catch (err) {
    console.warn('Unfollow table error in Supabase:', err);
  }

  return true;
}

/**
 * Verifica se followerId segue followingId
 */
export function isUserFollowing(followerId: string, followingId: string): boolean {
  if (!followerId || !followingId) return false;
  const map = getLocalFollowMap();
  return (map[followerId] || []).includes(followingId);
}
