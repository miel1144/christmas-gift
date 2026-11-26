import { useCallback, useEffect, useRef, useState } from 'react';
import { getRoom, joinPublicRoom, listMembers, roomErrorMessage } from '../services/supabase/rooms';
import { listGifts } from '../services/supabase/gifts';
import { subscribeRoom } from '../services/supabase/realtime';

/**
 * Carga una sala y la mantiene al día en tiempo real.
 *
 * status: 'loading' | 'ready' | 'missing' (no existe o es privada y no soy miembro) | 'error'
 * Si la sala es pública y aún no soy miembro, me une automáticamente.
 */
export function useRoom(roomId, me) {
  const [state, setState] = useState({ status: 'loading', room: null, members: [], gifts: [], online: new Set(), error: null });
  const timers = useRef({});
  const meId = me?.id;
  const meName = me?.name;

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

  // Agrupa ráfagas de eventos en una sola petición.
  const debounced = useCallback((key, fn) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, 150);
  }, []);

  useEffect(() => {
    if (!meId) return undefined;
    let cancelled = false;
    let unsubscribe = null;
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

        unsubscribe = subscribeRoom(roomId, { id: meId, name: meName }, {
          onGifts: () => debounced('gifts', refetchGifts),
          onMembers: () => debounced('members', refetchMembers),
          onPresence: (online) => patch({ online }),
        });
      } catch (e) {
        if (!cancelled) patch({ status: 'error', error: roomErrorMessage(e) });
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, [roomId, meId, meName, refetchGifts, refetchMembers, debounced]);

  const setRoom = (room) => patch({ room });
  return { ...state, refetchGifts, refetchMembers, setRoom };
}
