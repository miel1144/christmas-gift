import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { authErrorMessage, updateProfile } from '../../services/supabase/auth';
import { AVATAR_COLS, AVATAR_PRESETS, AVATAR_ROWS, normalizeAvatar } from '../../utils/avatar';
import { USERNAME_HINT, USERNAME_MAX, usernameProblem } from '../../utils/username';


/** Perfil: nombre de usuario (visible en las salas y para entrar) y avatar ASCII. */
export default function ProfileModal({ onClose }) {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar_ascii ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!profile) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" role="dialog" aria-modal="true" aria-label="Perfil" onClick={(e) => e.stopPropagation()}>
          <p className="pending">cargando perfil...</p>
        </div>
      </div>
    );
  }

  const trimmed = name.trim();
  const art = normalizeAvatar(avatar);
  const nameProblem = usernameProblem(name);
  const nameOk = !nameProblem;
  const dirty = trimmed !== (profile.display_name ?? '') || art !== (profile.avatar_ascii ?? null);

  async function onSubmit(e) {
    e.preventDefault();
    if (!nameOk) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      setProfile(await updateProfile(profile.id, { displayName: trimmed, avatarAscii: art }));
      setName(trimmed);
      setAvatar(art ?? '');
      setSaved(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <div className="drawer-head">
          <h2 id="profile-title" className="panel-title">[ tu perfil ]</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Cerrar" title="Cerrar (Esc)">cerrar</button>
        </div>

        <label className="field">
          <span>nombre de usuario <span className="muted">({trimmed.length}/{USERNAME_MAX})</span></span>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            maxLength={USERNAME_MAX}
            required
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={nameOk ? undefined : true}
          />
          <span className={`small ${nameOk ? 'muted' : 'msg fail'}`}>
            {nameProblem ?? `Es también tu usuario para entrar: si lo cambias, entra con el nuevo. ${USERNAME_HINT}`}
          </span>
        </label>

        <fieldset className="field">
          <legend>avatar</legend>
          <div className="avatar-picks">
            <button type="button" className={`avatar-pick ${art === null ? 'active' : ''}`} onClick={() => { setAvatar(''); setSaved(false); }} aria-pressed={art === null}>
              <span className="avatar-none">sin</span>
              <span className="sr-only">sin avatar</span>
            </button>
            {AVATAR_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className={`avatar-pick ${art === p.art ? 'active' : ''}`}
                onClick={() => { setAvatar(p.art); setSaved(false); }}
                aria-pressed={art === p.art}
                title={p.name}
              >
                <pre className="avatar" aria-hidden="true">{p.art}</pre>
                <span className="sr-only">{p.name}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>o dibuja el tuyo <span className="muted">({AVATAR_ROWS} líneas × {AVATAR_COLS} caracteres)</span></span>
          <textarea
            className="avatar-editor"
            value={avatar}
            onChange={(e) => { setAvatar(e.target.value); setSaved(false); }}
            rows={AVATAR_ROWS}
            cols={AVATAR_COLS + 1}
            spellCheck={false}
            wrap="off"
            placeholder={' (^_^)'}
          />
          <span className="muted small">Lo que pase de {AVATAR_COLS} columnas o {AVATAR_ROWS} líneas se recorta. Solo caracteres ASCII.</span>
        </label>

        <div className="avatar-preview">
          {art ? <pre className="avatar" aria-label="Vista previa del avatar">{art}</pre> : <span className="muted">sin avatar</span>}
          <span className="avatar-preview-name">{trimmed || '…'}</span>
        </div>

        {error && <p className="msg fail" role="alert">{error}</p>}
        {saved && !dirty && <p className="msg ok" role="status">Perfil guardado.</p>}
        <div className="row confirm-actions">
          <button type="button" className="btn ghost" onClick={onClose}>cerrar</button>
          <button className="btn" type="submit" disabled={busy || !nameOk || !dirty}>{busy ? '...' : '> guardar'}</button>
        </div>
      </form>
    </div>
  );
}
