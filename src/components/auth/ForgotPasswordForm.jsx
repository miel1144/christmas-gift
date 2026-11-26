import { useState } from 'react';
import { authErrorMessage, requestPasswordReset } from '../../services/supabase/auth';

/**
 * Pide el email de recuperación. El mensaje de éxito es siempre el mismo, exista o
 * no la cuenta, para no revelar qué emails están registrados.
 */
export default function ForgotPasswordForm({ formRef, intro, onBack }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={onSubmit} ref={formRef}>
      <h1 className="panel-title">[ recuperar contraseña ]</h1>
      {intro && <p className="muted">{intro}</p>}

      {sent ? (
        <p className="msg notice" role="status">
          Si existe una cuenta con {email.trim()}, te llegará un email con un enlace para poner una contraseña nueva.
          Revisa también la carpeta de spam.
        </p>
      ) : (
        <>
          <label className="field">
            <span>email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
          </label>
          {error && <p className="msg fail" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={busy || !email.trim()}>{busy ? '...' : '> enviar enlace'}</button>
        </>
      )}

      {onBack && (
        <button className="link" type="button" onClick={onBack}>volver a entrar</button>
      )}
    </form>
  );
}
