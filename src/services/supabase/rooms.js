import { supabase } from './client';

// Errores de las RPC y de Postgres traducidos para el usuario.
const MESSAGES = {
  'Invalid invite code': 'Ese código de invitación no existe (o lo cambiaron).',
  'Not allowed': 'No tienes permiso para hacer eso.',
  'The room owner cannot be removed': 'La persona dueña de la sala no puede salir; puede borrarla.',
  'Not authenticated': 'Tu sesión caducó. Vuelve a entrar.',
};

export function roomErrorMessage(error) {
  if (!error) return null;
  return MESSAGES[error.message] ?? error.message ?? 'Error desconocido.';
}

const ROOM_FIELDS = 'id, name, is_public, owner_id, created_at';

/** Salas de las que soy miembro, con mi rol. */
export async function listMyRooms(userId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(`role, workspaces(${ROOM_FIELDS})`)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return data.filter((r) => r.workspaces).map((r) => ({ ...r.workspaces, myRole: r.role }));
}

export async function listPublicRooms() {
  const { data, error } = await supabase
    .from('workspaces')
    .select(ROOM_FIELDS)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

/** El trigger on_workspace_created me añade como admin. */
export async function createRoom({ name, isPublic, ownerId }) {
  const { data, error } = await supabase
    .from('workspaces')
    .insert({ name, is_public: isPublic, owner_id: ownerId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** null si no existe o si es privada y no soy miembro (RLS la oculta). */
export async function getRoom(roomId) {
  const { data, error } = await supabase
    .from('workspaces')
    .select(`${ROOM_FIELDS}, invite_code`)
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMembers(roomId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id, role, joined_at, profiles(display_name, avatar_ascii)')
    .eq('workspace_id', roomId)
    .order('joined_at');
  if (error) throw error;
  return data.map((m) => ({
    id: m.user_id,
    role: m.role,
    name: m.profiles?.display_name || 'sin nombre',
    avatar: m.profiles?.avatar_ascii ?? null,
  }));
}

/** Unirse a una sala pública (las privadas van por código). */
export async function joinPublicRoom(roomId, userId) {
  const { error } = await supabase.from('workspace_members').insert({ workspace_id: roomId, user_id: userId, role: 'member' });
  if (error && error.code !== '23505') throw error; // 23505: ya era miembro
}

/** Acepta el código o el enlace completo /join/<código>. Devuelve el id de la sala. */
export async function joinByCode(codeOrLink) {
  const code = codeOrLink.trim().split('/').filter(Boolean).pop();
  const { data, error } = await supabase.rpc('join_workspace', { p_invite_code: code });
  if (error) throw error;
  return data;
}

export async function leaveRoom(roomId, userId) {
  const { error } = await supabase.from('workspace_members').delete().eq('workspace_id', roomId).eq('user_id', userId);
  if (error) throw error;
}

export async function deleteRoom(roomId) {
  const { error } = await supabase.from('workspaces').delete().eq('id', roomId);
  if (error) throw error;
}

export async function regenerateInviteCode(roomId) {
  const { data, error } = await supabase.rpc('regenerate_invite_code', { p_workspace_id: roomId });
  if (error) throw error;
  return data;
}

export const inviteLink = (code) => `${window.location.origin}/join/${code}`;
