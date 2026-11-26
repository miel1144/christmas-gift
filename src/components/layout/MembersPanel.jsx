import { useEffect, useState } from 'react';
import { navigate } from '../../hooks/useRoute';
import {
  deleteRoom,
  inviteLink,
  leaveRoom,
  regenerateInviteCode,
  roomErrorMessage,
  setMemberRole,
  updateRoom,
} from '../../services/supabase/rooms';
import { useConfirm } from '../ui/useConfirm';

/**
 * Miembros (con quién está conectado y su avatar), enlace para invitar y salir/borrar
 * la sala. Los admins además pueden echar a alguien, nombrar o quitar admins y, en
 * «ajustes», renombrar la sala o cambiar su visibilidad.
 *
 * `onRoomChange(room)`: la sala cambió (se aplica ya, sin esperar a recargar).
 * `onMembersChange()`: volver a pedir la lista de miembros.
 * `notify(what)`: avisa al resto de la sala (ver useRoom).
 */
export default function MembersPanel({ room, members, online, me, onRoomChange, onMembersChange, notify, onClose }) {
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

  const changeRole = async (m, role) => {
    if (role === 'admin') {
      const ok = await confirm({
        title: 'nombrar admin',
        message: `¿Hacer admin a ${m.name}?`,
        detail: 'Podrá renombrar la sala, cambiar su visibilidad, cambiar el enlace, echar a gente y nombrar o quitar admins. No podrá borrar la sala.',
        confirmLabel: 'hacer admin',
      });
      if (!ok) return;
    }
    run(async () => {
      await setMemberRole(room.id, m.id, role);
      onMembersChange?.();
      setNotice(role === 'admin' ? `${m.name} ahora es admin.` : `${m.name} ya no es admin.`);
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
        <button className="link" onClick={onClose} aria-label="Cerrar" title="Cerrar (Esc)">cerrar</button>
      </div>

      <ul className="list">
        {members.map((m) => {
          // Sobre quien creó la sala y sobre uno mismo no se actúa desde aquí.
          const canManage = isAdmin && m.id !== me.id && m.id !== room.owner_id;
          return (
            <li key={m.id} className="list-row member-row">
              <span className="member">
                {m.avatar ? <pre className="avatar" aria-hidden="true">{m.avatar}</pre> : <span className="avatar avatar-empty" aria-hidden="true" />}
                <span className="member-name">
                  <span className={`dot ${online.has(m.id) ? 'on' : ''}`} aria-label={online.has(m.id) ? 'en línea' : 'desconectado'} />
                  {m.name}
                  {m.id === me.id && <span className="muted"> (tú)</span>}
                </span>
              </span>
              <span className="tags member-actions">
                {m.id === room.owner_id ? <span className="tag">dueño</span> : m.role === 'admin' && <span className="tag">admin</span>}
                {canManage && (
                  <button
                    className="link"
                    disabled={busy}
                    onClick={() => changeRole(m, m.role === 'admin' ? 'member' : 'admin')}
                    aria-label={m.role === 'admin' ? `Quitar admin a ${m.name}` : `Hacer admin a ${m.name}`}
                  >
                    {m.role === 'admin' ? 'quitar admin' : 'hacer admin'}
                  </button>
                )}
                {canManage && (
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

      {isAdmin && (
        <RoomSettings room={room} busy={busy} run={run} confirm={confirm} setNotice={setNotice} onRoomChange={onRoomChange} notify={notify} />
      )}

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

const ROOM_NAME_MAX = 80;

/** Ajustes de la sala (solo admins): nombre y visibilidad. */
function RoomSettings({ room, busy, run, confirm, setNotice, onRoomChange, notify }) {
  const [name, setName] = useState(room.name);
  // Si otro admin la renombra, el campo se pone al día.
  useEffect(() => setName(room.name), [room.name]);
  const trimmed = name.trim();

  const apply = async (fields, message) => {
    const updated = await updateRoom(room.id, fields);
    onRoomChange(updated);
    notify?.('room');
    setNotice(message);
  };

  const rename = (e) => {
    e.preventDefault();
    if (!trimmed || trimmed === room.name) return;
    run(() => apply({ name: trimmed }, 'Nombre de la sala cambiado.'));
  };

  const toggleVisibility = async () => {
    const toPublic = !room.is_public;
    const ok = await confirm({
      title: toPublic ? 'hacer pública' : 'hacer privada',
      message: toPublic ? `¿Hacer pública "${room.name}"?` : `¿Hacer privada "${room.name}"?`,
      detail: toPublic
        ? 'Aparecerá en el lobby de todo el mundo y cualquiera podrá entrar sin invitación. Las cartas siguen siendo solo de quien las recibe.'
        : 'Dejará de aparecer en el lobby. Quien ya está dentro se queda; para entrar de nuevo hará falta el enlace de invitación.',
      confirmLabel: toPublic ? 'hacer pública' : 'hacer privada',
    });
    if (!ok) return;
    run(() => apply({ isPublic: toPublic }, toPublic ? 'La sala ahora es pública.' : 'La sala ahora es privada: comparte el enlace de invitación.'));
  };

  return (
    <section className="stack settings" aria-label="Ajustes de la sala">
      <h3 className="sub">ajustes de la sala</h3>
      <form className="row settings-rename" onSubmit={rename}>
        <label className="field grow">
          <span>nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={ROOM_NAME_MAX} required />
        </label>
        <button className="btn" type="submit" disabled={busy || !trimmed || trimmed === room.name}>guardar</button>
      </form>
      <div className="row">
        <span className="muted">Ahora es <strong>{room.is_public ? 'pública' : 'privada'}</strong>.</span>
        <button className="btn ghost" disabled={busy} onClick={toggleVisibility}>
          {room.is_public ? 'hacer privada' : 'hacer pública'}
        </button>
      </div>
    </section>
  );
}
