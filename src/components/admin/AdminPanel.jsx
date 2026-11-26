import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { navigate } from '../../hooks/useRoute';
import { listAllRooms, listAllUsers, setUserRole } from '../../services/supabase/admin';
import { deleteRoom, roomErrorMessage } from '../../services/supabase/rooms';
import { useConfirm } from '../ui/useConfirm';
import AsciiCanvas from '../canvas/AsciiCanvas';
import { createSnowScene } from '../../core/engine/scenes/snow';
import TopBar from '../layout/TopBar';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * /admin (solo superadmin; App muestra "no encontrada" a cualquier otra persona).
 * Salas: ver todas y borrarlas. Usuarios: ver todos y dar o quitar superadmin.
 * Las cartas nunca se ven aquí: la base no las deja leer ni al superadmin.
 */
export default function AdminPanel() {
  const meId = useAuthStore((s) => s.session.user.id);
  const [tab, setTab] = useState('rooms');
  const [rooms, setRooms] = useState(null);
  const [users, setUsers] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, dialog] = useConfirm();

  const load = useCallback(async () => {
    try {
      const [r, u] = await Promise.all([listAllRooms(), listAllUsers()]);
      setRooms(r);
      setUsers(u);
    } catch (e) {
      setError(roomErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const shownRooms = useMemo(
    () => (rooms ?? []).filter((r) => !q || r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q)),
    [rooms, q]
  );
  const shownUsers = useMemo(
    () => (users ?? []).filter((u) => !q || u.display_name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)),
    [users, q]
  );

  const run = async (fn, okText) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(okText);
      await load();
    } catch (e) {
      setError(roomErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const removeRoom = async (r) => {
    const ok = await confirm({
      title: 'borrar sala',
      message: `¿Borrar "${r.name}" de ${r.owner}?`,
      detail: `Se borrarán sus ${r.members} miembros y ${r.gifts} regalos con sus cartas. No se puede deshacer.`,
      confirmLabel: 'borrar sala',
      danger: true,
    });
    if (ok) run(() => deleteRoom(r.id), `Sala "${r.name}" borrada.`);
  };

  const toggleRole = async (u) => {
    const makeAdmin = u.role !== 'superadmin';
    const ok = await confirm({
      title: makeAdmin ? 'dar superadmin' : 'quitar superadmin',
      message: makeAdmin ? `¿Hacer superadmin a ${u.display_name}?` : `¿Quitar el rol de superadmin a ${u.display_name}?`,
      detail: makeAdmin
        ? 'Podrá ver todas las salas y usuarios, borrar salas y cambiar roles. Las cartas siguen siendo privadas.'
        : 'Dejará de ver este panel y volverá a ser un usuario normal.',
      confirmLabel: makeAdmin ? 'dar superadmin' : 'quitar',
      danger: makeAdmin,
    });
    if (ok) run(() => setUserRole(u.id, makeAdmin ? 'superadmin' : 'user'), `${u.display_name} ahora es ${makeAdmin ? 'superadmin' : 'usuario normal'}.`);
  };

  return (
    <main className="stage lobby admin">
      <AsciiCanvas sceneFactory={createSnowScene} interactive={false} />
      <TopBar
        left={
          <>
            <button className="link" onClick={() => navigate('/')}>← salas</button>
            <span className="room-name">admin</span>
          </>
        }
      />

      <section className="panel admin-panel">
        <div className="drawer-head">
          <h1 className="panel-title">[ panel de superadmin ]</h1>
          <button className="link" onClick={load} disabled={busy}>actualizar</button>
        </div>

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'rooms'} className={`tab ${tab === 'rooms' ? 'active' : ''}`} onClick={() => setTab('rooms')}>
            salas ({rooms?.length ?? '…'})
          </button>
          <button role="tab" aria-selected={tab === 'users'} className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            usuarios ({users?.length ?? '…'})
          </button>
        </div>

        <label className="field">
          <span className="sr-only">buscar</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === 'rooms' ? 'buscar sala o dueño…' : 'buscar usuario o email…'} />
        </label>

        {notice && <p className="msg ok" role="status">{notice}</p>}
        {error && <p className="msg fail" role="alert">{error}</p>}

        {tab === 'rooms' &&
          (rooms === null ? (
            <p className="pending">cargando...</p>
          ) : shownRooms.length === 0 ? (
            <p className="muted">{q ? 'Ninguna sala coincide.' : 'Todavía no hay salas.'}</p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>sala</th><th>dueño</th><th>miembros</th><th>regalos</th><th>creada</th><th><span className="sr-only">acciones</span></th></tr>
                </thead>
                <tbody>
                  {shownRooms.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name} <span className="tag">{r.isPublic ? 'pública' : 'privada'}</span></td>
                      <td>{r.owner}</td>
                      <td className="num">{r.members}</td>
                      <td className="num">{r.gifts}</td>
                      <td className="nowrap">{fmtDate(r.createdAt)}</td>
                      <td><button className="link danger-link" disabled={busy} onClick={() => removeRoom(r)}>borrar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === 'users' &&
          (users === null ? (
            <p className="pending">cargando...</p>
          ) : shownUsers.length === 0 ? (
            <p className="muted">Ningún usuario coincide.</p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>usuario</th><th>email</th><th>rol</th><th>alta</th><th><span className="sr-only">acciones</span></th></tr>
                </thead>
                <tbody>
                  {shownUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.display_name}{u.id === meId && <span className="muted"> (tú)</span>}</td>
                      <td className="muted">{u.email}</td>
                      <td>{u.role === 'superadmin' ? <span className="tag new">superadmin</span> : <span className="tag">usuario</span>}</td>
                      <td className="nowrap">{fmtDate(u.created_at)}</td>
                      <td>
                        {u.id !== meId && (
                          <button className="link" disabled={busy} onClick={() => toggleRole(u)}>
                            {u.role === 'superadmin' ? 'quitar superadmin' : 'hacer superadmin'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        <p className="muted small">
          Las cartas no se muestran aquí: ni el superadmin puede leerlas. Borrar cuentas de usuario se hace desde el panel de Supabase.
        </p>
      </section>
      {dialog}
    </main>
  );
}
