import { useState } from 'react';
import { navigate } from '../../hooks/useRoute';
import { deleteRoom, inviteLink, leaveRoom, regenerateInviteCode, roomErrorMessage } from '../../services/supabase/rooms';
import { useConfirm } from '../ui/useConfirm';

/**
 * Miembros (con quién está conectado), enlace para invitar, echar a alguien
 * (admins) y salir/borrar la sala.
 */
export default function MembersPanel({ room, members, online, me, onRoomChange, onClose }) {
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, dialog] = useConfirm();
  const isOwner = room.owner_id === me.id;
  const isAdmin = members.find((m) => m.id === me.id)?.role === 'admin';
  // Las públicas se comparten con su dirección; las privadas, con el enlace de invitación.
  const link = room.is_public ? `${window.location.origin}/room/${room.id}` : inviteLink(room.invite_code);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    setNotice(null);
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

  const kick = async (m) => {
    const ok = await confirm({
      title: 'echar de la sala',
      message: `¿Echar a ${m.name} de "${room.name}"?`,
      detail: room.is_public
        ? 'La sala es pública: podrá volver a entrar si quiere. Sus regalos se quedan.'
        : 'Después cambia el enlace de invitación si no quieres que vuelva a entrar. Sus regalos se quedan.',
      confirmLabel: 'echar',
      danger: true,
    });
    if (!ok) return;
    run(async () => {
      await leaveRoom(room.id, m.id);
      setNotice(`${m.name} ya no está en la sala.`);
    });
  };

  const regenerate = async () => {
    const ok = await confirm({
      title: 'cambiar enlace',
      message: '¿Crear un enlace de invitación nuevo?',
      detail: 'El enlace anterior dejará de funcionar. Quienes ya están dentro no se ven afectados.',
      confirmLabel: 'cambiar',
    });
    if (!ok) return;
    run(async () => {
      onRoomChange({ ...room, invite_code: await regenerateInviteCode(room.id) });
      setNotice('Enlace nuevo listo. El anterior ya no sirve.');
    });
  };

  const removeRoom = async () => {
    const ok = await confirm({
      title: 'borrar sala',
      message: `¿Borrar "${room.name}" para siempre?`,
      detail: 'Se borrarán todos sus regalos y cartas, también para el resto de miembros. No se puede deshacer.',
      confirmLabel: 'borrar sala',
      danger: true,
    });
    if (!ok) return;
    run(async () => {
      await deleteRoom(room.id);
      navigate('/', { replace: true });
    });
  };

  const leave = async () => {
    const ok = await confirm({
      title: 'salir de la sala',
      message: `¿Salir de "${room.name}"?`,
      detail: room.is_public ? 'Podrás volver a entrar cuando quieras.' : 'Para volver necesitarás otra invitación.',
      confirmLabel: 'salir',
    });
    if (!ok) return;
    run(async () => {
      await leaveRoom(room.id, me.id);
      navigate('/', { replace: true });
    });
  };

  return (
    <aside className="drawer" aria-label="Miembros de la sala">
      <div className="drawer-head">
        <h2 className="panel-title">[ miembros ]</h2>
        <button className="link" onClick={onClose} aria-label="Cerrar">cerrar</button>
      </div>

      <ul className="list">
        {members.map((m) => {
          const canKick = isAdmin && m.id !== me.id && m.id !== room.owner_id;
          return (
            <li key={m.id} className="list-row">
              <span>
                <span className={`dot ${online.has(m.id) ? 'on' : ''}`} aria-label={online.has(m.id) ? 'en línea' : 'desconectado'} />
                {m.name}
                {m.id === me.id && <span className="muted"> (tú)</span>}
              </span>
              <span className="tags">
                {m.id === room.owner_id ? <span className="tag">dueño</span> : m.role === 'admin' && <span className="tag">admin</span>}
                {canKick && (
                  <button className="link" disabled={busy} onClick={() => kick(m)} aria-label={`Echar a ${m.name}`}>echar</button>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <h3 className="sub">invitar</h3>
      <p className="muted">{room.is_public ? 'Cualquiera con este enlace puede entrar.' : 'Solo entra quien tenga este enlace.'}</p>
      <input className="link-box" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Enlace de invitación" />
      <div className="row">
        <button className="btn" onClick={copy}>{copied ? 'copiado' : '> copiar enlace'}</button>
        {!room.is_public && isAdmin && (
          <button className="btn ghost" disabled={busy} onClick={regenerate}>cambiar enlace</button>
        )}
      </div>

      {notice && <p className="msg ok" role="status">{notice}</p>}
      {error && <p className="msg fail" role="alert">{error}</p>}

      <div className="drawer-foot">
        {isOwner ? (
          <button className="btn danger" disabled={busy} onClick={removeRoom}>borrar sala</button>
        ) : (
          <button className="btn ghost" disabled={busy} onClick={leave}>salir de la sala</button>
        )}
      </div>
      {dialog}
    </aside>
  );
}
