import { useState } from 'react';
import { navigate } from '../../hooks/useRoute';
import { deleteRoom, inviteLink, leaveRoom, regenerateInviteCode, roomErrorMessage } from '../../services/supabase/rooms';

/** Miembros (con quién está conectado), enlace para invitar y salir/borrar la sala. */
export default function MembersPanel({ room, members, online, me, onRoomChange, onClose }) {
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const myRole = members.find((m) => m.id === me.id)?.role;
  const isOwner = room.owner_id === me.id;
  const isAdmin = myRole === 'admin';
  // Las públicas se comparten con su dirección; las privadas, con el enlace de invitación.
  const link = room.is_public ? `${window.location.origin}/room/${room.id}` : inviteLink(room.invite_code);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(roomErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('No se pudo copiar; selecciona el enlace a mano.');
    }
  };

  return (
    <aside className="drawer" aria-label="Miembros de la sala">
      <div className="drawer-head">
        <h2 className="panel-title">[ miembros ]</h2>
        <button className="link" onClick={onClose} aria-label="Cerrar">cerrar</button>
      </div>

      <ul className="list">
        {members.map((m) => (
          <li key={m.id} className="list-row">
            <span>
              <span className={`dot ${online.has(m.id) ? 'on' : ''}`} aria-label={online.has(m.id) ? 'en línea' : 'desconectado'} />
              {m.name}
              {m.id === me.id && <span className="muted"> (tú)</span>}
            </span>
            <span className="tags">
              {m.id === room.owner_id ? <span className="tag">dueño</span> : m.role === 'admin' && <span className="tag">admin</span>}
            </span>
          </li>
        ))}
      </ul>

      <h3 className="sub">invitar</h3>
      <p className="muted">{room.is_public ? 'Cualquiera con este enlace puede entrar.' : 'Solo entra quien tenga este enlace.'}</p>
      <input className="link-box" readOnly value={link} onFocus={(e) => e.target.select()} />
      <div className="row">
        <button className="btn" onClick={copy}>{copied ? 'copiado' : '> copiar enlace'}</button>
        {!room.is_public && isAdmin && (
          <button
            className="btn ghost"
            disabled={busy}
            title="El enlace anterior deja de funcionar"
            onClick={() => run(async () => onRoomChange({ ...room, invite_code: await regenerateInviteCode(room.id) }))}
          >
            cambiar enlace
          </button>
        )}
      </div>

      {error && <p className="msg fail" role="alert">{error}</p>}

      <div className="drawer-foot">
        {isOwner ? (
          <button
            className="btn danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`¿Borrar "${room.name}"? Se perderán todos sus regalos y cartas.`)) {
                run(async () => {
                  await deleteRoom(room.id);
                  navigate('/', { replace: true });
                });
              }
            }}
          >
            borrar sala
          </button>
        ) : (
          <button
            className="btn ghost"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`¿Salir de "${room.name}"?`)) {
                run(async () => {
                  await leaveRoom(room.id, me.id);
                  navigate('/', { replace: true });
                });
              }
            }}
          >
            salir de la sala
          </button>
        )}
      </div>
    </aside>
  );
}
