import { supabase } from './client';

const MESSAGES = {
  'Wrong password': 'Contraseña incorrecta.',
  'Gift not found': 'Ese regalo no existe o no es para ti.',
  'You are not a member of this room': 'Ya no eres miembro de esta sala.',
  'Receiver is not a member of this room': 'Esa persona ya no está en la sala.',
  'Not authenticated': 'Tu sesión caducó. Vuelve a entrar.',
};

export function giftErrorMessage(error) {
  if (!error) return null;
  if (error.code === '23514') return 'La carta es demasiado larga (máximo 5000 caracteres).';
  return MESSAGES[error.message] ?? error.message ?? 'Error desconocido.';
}

/** Metadatos visibles de los regalos de la sala (la carta nunca viene aquí). */
export async function listGifts(roomId) {
  const { data, error } = await supabase
    .from('gifts')
    .select('id, sender_id, receiver_id, is_locked, color, position_x, position_y, opened_at, created_at')
    .eq('workspace_id', roomId)
    .order('created_at');
  if (error) throw error;
  return data;
}

/** Crea regalo y carta a la vez; la contraseña se hashea en el servidor. */
export async function createGift({ roomId, receiverId, message, password, color, x, y }) {
  const { data, error } = await supabase.rpc('create_gift', {
    p_workspace_id: roomId,
    p_receiver_id: receiverId,
    p_message: message,
    p_password: password || null,
    p_color: color,
    p_position_x: x,
    p_position_y: y,
  });
  if (error) throw error;
  return data;
}

/**
 * Devuelve la carta. Al destinatario le marca el regalo como abierto; si tiene
 * contraseña la comprueba el servidor. Al remitente se la enseña sin contraseña.
 */
export async function openGift(giftId, password) {
  const { data, error } = await supabase.rpc('open_gift', { p_gift_id: giftId, p_password: password || null });
  if (error) throw error;
  return data;
}

/** Mueve un regalo propio: x = ángulo alrededor del tronco, y = radio. */
export async function moveGift(giftId, { x, y }) {
  const { data, error } = await supabase
    .from('gifts')
    .update({ position_x: x, position_y: y })
    .eq('id', giftId)
    .select('id');
  if (error) throw error;
  if (!data.length) throw new Error('Solo puedes mover tus regalos.');
}

export async function deleteGift(giftId) {
  const { error } = await supabase.from('gifts').delete().eq('id', giftId);
  if (error) throw error;
}
