import { supabase } from './client';

/**
 * Canal en vivo de una sala:
 * - postgres_changes de `gifts` y `workspace_members` (RLS: solo llegan los de mis salas).
 * - presence: quién tiene la sala abierta ahora mismo.
 * - broadcast `changed`: aviso de que algo que no viaja por postgres_changes ha
 *   cambiado (`what`: 'room' = nombre o visibilidad, 'profile' = nombre o avatar
 *   de alguien). Solo es un aviso: quien lo recibe vuelve a pedir los datos a la
 *   base, así que un aviso falso no puede colar nada.
 *
 * Los DELETE no se pueden filtrar por columna (y con RLS solo traen la clave
 * primaria), así que se escuchan sin filtro: quien los recibe simplemente vuelve
 * a pedir la lista. Es poco tráfico y evita estados a medias.
 *
 * @returns { close(), track(name), notify(what) }
 */
export function subscribeRoom(roomId, me, { onGifts, onMembers, onPresence, onChanged }) {
  const channel = supabase.channel(`room:${roomId}`, { config: { presence: { key: me.id } } });
  let name = me.name;
  let joined = false;
  const since = new Date().toISOString();

  channel
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gifts', filter: `workspace_id=eq.${roomId}` }, onGifts)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'gifts' }, onGifts)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${roomId}` }, onMembers)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'workspace_members' }, onMembers)
    .on('presence', { event: 'sync' }, () => onPresence(new Set(Object.keys(channel.presenceState()))))
    .on('broadcast', { event: 'changed' }, ({ payload }) => onChanged?.(payload?.what))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        joined = true;
        channel.track({ name, since });
      }
    });

  return {
    close() {
      supabase.removeChannel(channel);
    },
    track(newName) {
      name = newName;
      if (joined) channel.track({ name, since });
    },
    notify(what) {
      if (joined) channel.send({ type: 'broadcast', event: 'changed', payload: { what } });
    },
  };
}
