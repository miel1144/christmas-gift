import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { navigate } from '../../hooks/useRoute';
import { createRoom, joinByCode, listMyRooms, listPublicRooms, roomErrorMessage } from '../../services/supabase/rooms';
import TopBar from './TopBar';
import AsciiCanvas from '../canvas/AsciiCanvas';
import { createSnowScene } from '../../core/engine/scenes/snow';

const TREE = `    *
   /.\\
  /..'\\
 /'.'.'\\
   |_|`;

/** Lobby: mis salas, salas públicas, crear sala y unirse con código. */
export default function Lobby() {
  const userId = useAuthStore((s) => s.session.user.id);
  const [mine, setMine] = useState(null);
  const [publicRooms, setPublicRooms] = useState([]);
  const [error, setError] = useState(null);
  // Aviso de un solo uso (?aviso=fuera): me sacaron de una sala o la borraron.
  const [notice] = useState(() =>
    new URLSearchParams(window.location.search).get('aviso') === 'fuera' ? 'Ya no estás en esa sala: te sacaron o la borraron.' : null
  );
  useEffect(() => {
    if (notice) window.history.replaceState(null, '', '/');
  }, [notice]);

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([listMyRooms(userId), listPublicRooms()]);
      setMine(m);
      setPublicRooms(p);
    } catch (e) {
      setError(roomErrorMessage(e));
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const mineIds = new Set((mine ?? []).map((r) => r.id));
  const others = publicRooms.filter((r) => !mineIds.has(r.id));

  return (
    <main className="stage lobby">
      <AsciiCanvas sceneFactory={createSnowScene} interactive={false} />
      <TopBar left={<span className="brand">christmas gift</span>} />
      <pre className="tree" aria-hidden="true">{TREE}</pre>
      {notice && <p className="msg notice" role="status">{notice}</p>}
      {error && <p className="msg fail" role="alert">{error}</p>}

      <div className="lobby-grid">
        <section className="panel">
          <h2 className="panel-title">[ tus salas ]</h2>
          {mine === null ? (
            <p className="pending">cargando...</p>
          ) : mine.length === 0 ? (
            <p className="muted">Aún no estás en ninguna sala. Crea una o entra en una pública.</p>
          ) : (
            <RoomList rooms={mine} />
          )}
        </section>

        <section className="panel">
          <h2 className="panel-title">[ salas públicas ]</h2>
          {others.length === 0 ? <p className="muted">No hay otras salas públicas por ahora.</p> : <RoomList rooms={others} />}
        </section>

        <CreateRoomForm userId={userId} />
        <JoinByCodeForm />
      </div>
    </main>
  );
}

function RoomList({ rooms }) {
  return (
    <ul className="list">
      {rooms.map((r) => (
        <li key={r.id}>
          <button className="list-item" onClick={() => navigate(`/room/${r.id}`)}>
            <span>{r.name}</span>
            <span className="tags">
              {r.myRole === 'admin' && <span className="tag">admin</span>}
              <span className="tag">{r.is_public ? 'pública' : 'privada'}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function CreateRoomForm({ userId }) {
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await createRoom({ name: name.trim(), isPublic, ownerId: userId });
      navigate(`/room/${id}`);
    } catch (err) {
      setError(roomErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2 className="panel-title">[ crear sala ]</h2>
      <label className="field">
        <span>nombre</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="la sala de la familia" />
      </label>
      <label className="check">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        <span>pública (cualquiera puede entrar; si no, solo con invitación)</span>
      </label>
      {error && <p className="msg fail" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={busy || !name.trim()}>{busy ? '...' : '> crear'}</button>
    </form>
  );
}

function JoinByCodeForm() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await joinByCode(code);
      navigate(`/room/${id}`);
    } catch (err) {
      setError(roomErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2 className="panel-title">[ unirse con invitación ]</h2>
      <label className="field">
        <span>código o enlace</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="a1b2c3d4e5f6 o https://…/join/…" />
      </label>
      {error && <p className="msg fail" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={busy || !code.trim()}>{busy ? '...' : '> entrar'}</button>
    </form>
  );
}
