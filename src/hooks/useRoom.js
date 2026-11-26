import { useCallback, useEffect, useRef, useState } from 'react';
import { getRoom, joinPublicRoom, listMembers, roomErrorMessage } from '../services/supabase/rooms';
import { listGifts } from '../services/supabase/gifts';
import { subscribeRoom } from '../services/supabase/realtime';

/**
 * Carga una sala y la mantiene al día en tiempo real.
 *
 * status: 'loading' | 'ready' | 'missing' (no existe o es privada y no soy miembro) | 'error'
 * Si la sala es pública y aún no soy miembro, me une automáticamente.
 *
 * `notify(what)` avisa al resto de la sala de un cambio que no llega solo por
 * Realtime ('room': nombre o visibilidad; 'profile': mi nombre o avatar).
 */
export function useRoom(roomId, me) {
  const [state, setState] = useState({ status: 'loading', room: null, members: [], gifts: [], online: new Set(), error: null });
  const timers = useRef({});
  const live = useRef(null);
  const meId = me?.id;
  const meName = me?.name;
  // El nombre se lee al conectar; si cambia después, solo se actualiza la presencia
  // (no hay que volver a cargar la sala entera).
  const nameRef = useRef(meName);
  nameRef.current = meName;

  const patch = (p) => setState((s) => ({ ...s, ...p }));

  const refetchGifts = useCallback(async () => {
    try {
      patch({ gifts: await listGifts(roomId) });
    } catch (e) {
      patch({ error: roomErrorMessage(e) });
    }
  }, [roomId]);

  const refetchMembers = useCallback(async () => {
    try {
      patch({ members: await listMembers(roomId) });
    } catch (e) {
      patch({ error: roomErrorMessage(e) });
    }
  }, [roomId]);

  const refetchRoom = useCallback(async () => {
    try {
      const room = await getRoom(roomId);
      if (room) patch({ room });
    } catch (e) {
      patch({ error: roomErrorMessage(e) });
    }
  }, [roomId]);

  // Agrupa ráfagas de eventos en una sola petición.
  const debounced = useCallback((key, fn) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, 150);
  }, []);

  useEffect(() => {
    if (!meId) return undefined;
    let cancelled = false;
    setState({ status: 'loading', room: null, members: [], gifts: [], online: new Set(), error: null });

    (async () => {
      try {
        const room = await getRoom(roomId);
        if (cancelled) return;
        if (!room) return patch({ status: 'missing' });

        let members = await listMembers(roomId);
        if (!members.some((m) => m.id === meId)) {
          if (!room.is_public) return patch({ status: 'missing' });
          await joinPublicRoom(roomId, meId);
          members = await listMembers(roomId);
        }
        const gifts = await listGifts(roomId);
        if (cancelled) return;
        patch({ status: 'ready', room, members, gifts });

        live.current = subscribeRoom(roomId, { id: meId, name: nameRef.current }, {
          onGifts: () => debounced('gifts', refetchGifts),
          onMembers: () => debounced('members', refetchMembers),
          onPresence: (online) => patch({ online }),
          onChanged: (what) => {
            if (what === 'room') debounced('room', refetchRoom);
            else if (what === 'profile') debounced('members', refetchMembers);
          },
        });
      } catch (e) {
        if (!cancelled) patch({ status: 'error', error: roomErrorMessage(e) });
      }
    })();

    return () => {
      cancelled = true;
      live.current?.close();
      live.current = null;
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, [roomId, meId, refetchGifts, refetchMembers, refetchRoom, debounced]);

  useEffect(() => {
    if (meName) live.current?.track(meName);
  }, [meName]);

  const setRoom = useCallback((room) => patch({ room }), []);
  const notify = useCallback((what) => live.current?.notify(what), []);
  /** Cambio optimista de la posición de un regalo (antes de que confirme la base). */
  const placeGiftLocally = useCallback(
    (id, x, y) => setState((s) => ({ ...s, gifts: s.gifts.map((g) => (g.id === id ? { ...g, position_x: x, position_y: y } : g)) })),
    []
  );
  return { ...state, refetchGifts, refetchMembers, refetchRoom, setRoom, notify, placeGiftLocally };
}
