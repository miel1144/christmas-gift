import { supabase } from './client';

/**
 * Canal en vivo de una sala:
 * - postgres_changes de `gifts` y `workspace_members` (RLS: solo llegan los de mis salas).
 * - presence: quién tiene la sala abierta ahora mismo.
 *
 * Los DELETE no se pueden filtrar por columna (y con RLS solo traen la clave
 * primaria), así que se escuchan sin filtro: quien los recibe simplemente vuelve
 * a pedir la lista. Es poco tráfico y evita estados a medias.
 *
 * @returns función para cerrar el canal
 */
export function subscribeRoom(roomId, me, { onGifts, onMembers, onPresence }) {
  const channel = supabase.channel(`room:${roomId}`, { config: { presence: { key: me.id } } });

  channel
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gifts', filter: `workspace_id=eq.${roomId}` }, onGifts)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'gifts' }, onGifts)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${roomId}` }, onMembers)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'workspace_members' }, onMembers)
    .on('presence', { event: 'sync' }, () => onPresence(new Set(Object.keys(channel.presenceState()))))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ name: me.name, since: new Date().toISOString() });
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
