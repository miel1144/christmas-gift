import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useAuthStore } from '../../store/authStore';
import { navigate } from '../../hooks/useRoute';
import { useRoom } from '../../hooks/useRoom';
import { giftToSpec } from '../../utils/giftSpec';
import { giftErrorMessage, moveGift } from '../../services/supabase/gifts';
import AsciiCanvas from '../canvas/AsciiCanvas';
import TopBar from './TopBar';
import MembersPanel from './MembersPanel';
import GiftPanel from '../gifts/GiftPanel';
import LetterModal from '../gifts/LetterModal';
import GestureCamera from '../camera/GestureCamera';
import { isMuted, play, setMuted, subscribe } from '../../core/audio/sfx';

/** Una sala: el árbol con sus regalos, miembros en vivo y el panel de regalos. */
export default function RoomView({ roomId }) {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const me = useMemo(
    () => ({ id: session.user.id, name: profile?.display_name ?? session.user.email }),
    [session.user.id, session.user.email, profile?.display_name]
  );
  const { status, room, members, gifts, online, error, refetchGifts, refetchMembers, setRoom, notify, placeGiftLocally } = useRoom(roomId, me);
  const [panel, setPanel] = useState(null); // 'gifts' | 'members' | null
  const [letter, setLetter] = useState(null); // regalo abierto en el modal
  const [toast, setToast] = useState(null);
  const [camera, setCamera] = useState(false);
  const toastTimer = useRef(null);
  const sceneRef = useRef(null);
  const muted = useSyncExternalStore(subscribe, isMuted);

  const specs = useMemo(() => gifts.map((g) => giftToSpec(g, me.id)), [gifts, me.id]);
  const nameOf = useCallback((id) => (id === me.id ? 'ti' : members.find((m) => m.id === id)?.name ?? 'alguien'), [members, me.id]);
  const pending = gifts.filter((g) => g.receiver_id === me.id && !g.opened_at).length;

  // Si me sacan de la sala o la borran, vuelvo al lobby con un aviso.
  useEffect(() => {
    if (status === 'ready' && !members.some((m) => m.id === me.id)) navigate('/?aviso=fuera', { replace: true });
  }, [status, members, me.id]);

  // Cuando cambio mi nombre o avatar, el resto de la sala vuelve a pedir la lista de
  // miembros (los perfiles no viajan por Realtime). La primera carga no cuenta.
  const profileKey = profile ? `${profile.display_name}\n${profile.avatar_ascii ?? ''}` : null;
  const lastProfileKey = useRef(profileKey);
  useEffect(() => {
    if (status !== 'ready' || profileKey === null) return;
    if (lastProfileKey.current !== null && lastProfileKey.current !== profileKey) {
      refetchMembers();
      notify('profile');
    }
    lastProfileKey.current = profileKey;
  }, [status, profileKey, refetchMembers, notify]);

  const showToast = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Esc cierra el panel abierto (miembros o regalos). Si hay un diálogo encima, lo
  // cierra él primero; si se está escribiendo, el primer Esc solo sale del campo
  // (así no se pierde una carta a medias).
  useEffect(() => {
    if (!panel) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('.modal-backdrop')) return;
      const el = document.activeElement;
      if (el instanceof HTMLElement && el.matches('input, textarea, select')) {
        el.blur();
        return;
      }
      setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);

  const onGiftClick = (id) => {
    const g = gifts.find((x) => x.id === id);
    if (!g) return;
    if (g.receiver_id === me.id || g.sender_id === me.id) setLetter(g);
    else showToast(`Regalo de ${nameOf(g.sender_id)} para ${nameOf(g.receiver_id)}`);
  };

  // Corazón con las dos manos: abre mi regalo sin abrir más antiguo; si ya los abrí
  // todos, el último que recibí; si no he recibido ninguno, el último que envié.
  // Con una carta ya abierta no hace nada.
  const onHeart = () => {
    if (letter) return;
    const byDate = (a, b) => String(a.created_at).localeCompare(String(b.created_at));
    const received = gifts.filter((g) => g.receiver_id === me.id).sort(byDate);
    const sent = gifts.filter((g) => g.sender_id === me.id).sort(byDate);
    const next = received.find((g) => !g.opened_at) ?? received[received.length - 1] ?? sent[sent.length - 1];
    if (next) setLetter(next);
    else showToast('Todavía no tienes regalos en esta sala.');
  };

  // Solo quien envió un regalo puede moverlo (la política de la base también deja a
  // los admins, pero en la sala cada cual coloca los suyos).
  const canDragGift = useCallback((id) => gifts.some((g) => g.id === id && g.sender_id === me.id), [gifts, me.id]);
  const onGiftMove = useCallback(
    async (id, x, y) => {
      placeGiftLocally(id, x, y);
      try {
        await moveGift(id, { x, y });
      } catch (e) {
        showToast(giftErrorMessage(e));
        refetchGifts();
      }
    },
    // showToast solo usa setters y una ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeGiftLocally, refetchGifts]
  );

  const onGiftLocked = useCallback(
    (id) => {
      const g = gifts.find((x) => x.id === id);
      if (!g) return;
      showToast(
        g.receiver_id === me.id
          ? `Este regalo te lo dejó ${nameOf(g.sender_id)}: solo quien lo envía puede moverlo.`
          : `Este regalo es de ${nameOf(g.sender_id)}: solo quien lo envía puede moverlo.`
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gifts, me.id, nameOf]
  );

  if (status === 'loading') {
    return (
      <main className="stage">
        <p className="pending">entrando en la sala...</p>
      </main>
    );
  }
  if (status !== 'ready') {
    return (
      <main className="stage">
        <section className="panel">
          <p className="msg fail" role="alert">
            {status === 'missing' ? 'Esta sala no existe o es privada. Pide un enlace de invitación.' : error}
          </p>
          <button className="btn" onClick={() => navigate('/')}>&gt; ir a mis salas</button>
        </section>
      </main>
    );
  }

  const toggle = (name) => setPanel((p) => (p === name ? null : name));

  return (
    <main className="scene">
      <AsciiCanvas
        gifts={specs}
        onGiftClick={onGiftClick}
        canDragGift={canDragGift}
        onGiftMove={onGiftMove}
        onGiftLocked={onGiftLocked}
        onSceneEvent={play}
        controlRef={sceneRef}
      />
      <TopBar
        left={
          <>
            <button className="link" onClick={() => navigate('/')}>← salas</button>
            <span className="room-name">{room.name}</span>
            <span className="tag">{room.is_public ? 'pública' : 'privada'}</span>
          </>
        }
      >
        <button
          className="link"
          onClick={() => setMuted(!muted)}
          aria-pressed={!muted}
          title={muted ? 'Activar el sonido' : 'Silenciar'}
        >
          {muted ? 'sonido: no' : 'sonido: sí'}
        </button>
        <button className="link" onClick={() => toggle('members')}>
          {online.size} en línea · {members.length} {members.length === 1 ? 'miembro' : 'miembros'}
        </button>
      </TopBar>

      <div className="dock">
        <button className="btn ghost" onClick={() => setCamera((c) => !c)} aria-pressed={camera}>
          {camera ? 'cámara · on' : 'gestos'}
        </button>
        <button className="btn" onClick={() => toggle('gifts')}>
          regalos{pending > 0 ? ` · ${pending} para ti` : ''}
        </button>
      </div>

      {panel === 'members' && (
        <MembersPanel
          room={room}
          members={members}
          online={online}
          me={me}
          onRoomChange={setRoom}
          onMembersChange={refetchMembers}
          notify={notify}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'gifts' && (
        <GiftPanel
          room={room}
          gifts={gifts}
          members={members}
          me={me}
          nameOf={nameOf}
          onRead={setLetter}
          onChanged={refetchGifts}
          onClose={() => setPanel(null)}
        />
      )}
      {camera && <GestureCamera sceneRef={sceneRef} onHeart={onHeart} onClose={() => setCamera(false)} />}
      {letter && <LetterModal gift={letter} me={me} nameOf={nameOf} onOpened={refetchGifts} onClose={() => setLetter(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
      {error && <div className="toast fail" role="alert">{error}</div>}
      <p className="hint">clic en un regalo para abrirlo · arrastra los tuyos para moverlos · 1 · 2 · 3 pasos · R repetir · arrastra el fondo para girar · «gestos» para usar la cámara</p>
    </main>
  );
}
