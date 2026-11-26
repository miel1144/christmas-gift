import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { navigate } from '../../hooks/useRoute';
import { useRoom } from '../../hooks/useRoom';
import { giftToSpec } from '../../utils/giftSpec';
import AsciiCanvas from '../canvas/AsciiCanvas';
import TopBar from './TopBar';
import MembersPanel from './MembersPanel';
import GiftPanel from '../gifts/GiftPanel';
import LetterModal from '../gifts/LetterModal';

/** Una sala: el árbol con sus regalos, miembros en vivo y el panel de regalos. */
export default function RoomView({ roomId }) {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const me = useMemo(
    () => ({ id: session.user.id, name: profile?.display_name ?? session.user.email }),
    [session.user.id, session.user.email, profile?.display_name]
  );
  const { status, room, members, gifts, online, error, refetchGifts, setRoom } = useRoom(roomId, me);
  const [panel, setPanel] = useState(null); // 'gifts' | 'members' | null
  const [letter, setLetter] = useState(null); // regalo abierto en el modal
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const specs = useMemo(() => gifts.map((g) => giftToSpec(g, me.id)), [gifts, me.id]);
  const nameOf = useCallback((id) => (id === me.id ? 'ti' : members.find((m) => m.id === id)?.name ?? 'alguien'), [members, me.id]);
  const pending = gifts.filter((g) => g.receiver_id === me.id && !g.opened_at).length;

  // Si me sacan de la sala o la borran, vuelvo al lobby con un aviso.
  useEffect(() => {
    if (status === 'ready' && !members.some((m) => m.id === me.id)) navigate('/?aviso=fuera', { replace: true });
  }, [status, members, me.id]);

  const showToast = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const onGiftClick = (id) => {
    const g = gifts.find((x) => x.id === id);
    if (!g) return;
    if (g.receiver_id === me.id || g.sender_id === me.id) setLetter(g);
    else showToast(`Regalo de ${nameOf(g.sender_id)} para ${nameOf(g.receiver_id)}`);
  };

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
      <AsciiCanvas gifts={specs} onGiftClick={onGiftClick} />
      <TopBar
        left={
          <>
            <button className="link" onClick={() => navigate('/')}>← salas</button>
            <span className="room-name">{room.name}</span>
            <span className="tag">{room.is_public ? 'pública' : 'privada'}</span>
          </>
        }
      >
        <button className="link" onClick={() => toggle('members')}>
          {online.size} en línea · {members.length} {members.length === 1 ? 'miembro' : 'miembros'}
        </button>
      </TopBar>

      <div className="dock">
        <button className="btn" onClick={() => toggle('gifts')}>
          regalos{pending > 0 ? ` · ${pending} para ti` : ''}
        </button>
      </div>

      {panel === 'members' && (
        <MembersPanel room={room} members={members} online={online} me={me} onRoomChange={setRoom} onClose={() => setPanel(null)} />
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
      {letter && <LetterModal gift={letter} me={me} nameOf={nameOf} onOpened={refetchGifts} onClose={() => setLetter(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
      {error && <div className="toast fail" role="alert">{error}</div>}
      <p className="hint">clic en un regalo para abrirlo · 1 · 2 · 3 pasos · R repetir · arrastra para girar</p>
    </main>
  );
}
