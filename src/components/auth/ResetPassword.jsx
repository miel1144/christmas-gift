import { useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { navigate } from '../../hooks/useRoute';
import { authErrorMessage, linkError, updatePassword } from '../../services/supabase/auth';
import { createLoginScene } from '../../core/engine/scenes/login';
import AsciiCanvas from '../canvas/AsciiCanvas';
import PasswordInput from '../ui/PasswordInput';
import ForgotPasswordForm from './ForgotPasswordForm';

const MIN = 6;

/**
 * /reset: al volver del enlace del email, Supabase abre una sesión de recuperación
 * y aquí se pone la contraseña nueva. Si el enlace caducó (o se entra sin él), se
 * ofrece pedir otro.
 */
export default function ResetPassword() {
  const status = useAuthStore((s) => s.status);
  const formRef = useRef(null);
  const [badLink] = useState(() => linkError());
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (password !== repeat) return setError('Las dos contraseñas no coinciden.');
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  let content;
  if (status === 'loading') {
    content = <p className="pending" ref={formRef}>cargando...</p>;
  } else if (done) {
    content = (
      <section className="panel" ref={formRef}>
        <h1 className="panel-title">[ contraseña cambiada ]</h1>
        <p className="msg ok" role="status">Listo. A partir de ahora entra con tu contraseña nueva.</p>
        <button className="btn" onClick={() => navigate('/', { replace: true })}>&gt; ir a mis salas</button>
      </section>
    );
  } else if (status === 'signedIn') {
    content = (
      <form className="panel" onSubmit={onSubmit} ref={formRef}>
        <h1 className="panel-title">[ contraseña nueva ]</h1>
        <label className="field">
          <span>contraseña nueva</span>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={MIN} autoComplete="new-password" autoFocus />
        </label>
        <label className="field">
          <span>repítela</span>
          <PasswordInput value={repeat} onChange={(e) => setRepeat(e.target.value)} required minLength={MIN} autoComplete="new-password" />
        </label>
        <p className="muted small">Mínimo {MIN} caracteres.</p>
        {error && <p className="msg fail" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy || password.length < MIN || !repeat}>{busy ? '...' : '> guardar contraseña'}</button>
      </form>
    );
  } else {
    content = (
      <ForgotPasswordForm
        formRef={formRef}
        intro={badLink ?? 'Para poner una contraseña nueva, pide un enlace a tu email.'}
        onBack={() => navigate('/', { replace: true })}
      />
    );
  }

  return (
    <main className="stage auth">
      <AsciiCanvas sceneFactory={createLoginScene} interactive={false} anchorRef={formRef} />
      {content}
    </main>
  );
}
