import { useState } from 'react';
import { signIn, signUp, authErrorMessage } from '../../services/supabase/auth';

const TREE = `        *
       /.\\
      /..'\\
     /'.'.'\\
    /.''.'..\\
   /.'.'.'.'.\\
       |_|`;

export default function AuthScreen() {
  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const isSignUp = mode === 'signUp';

  function switchMode() {
    setMode(isSignUp ? 'signIn' : 'signUp');
    setError(null);
    setNotice(null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (isSignUp) {
        const { needsConfirmation } = await signUp({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        });
        if (needsConfirmation) {
          setNotice(`Te enviamos un enlace a ${email.trim()}. Ábrelo para activar la cuenta.`);
          setMode('signIn');
          setPassword('');
        }
        // Si no hace falta confirmar, onAuthStateChange cambia de pantalla solo.
      } else {
        await signIn({ email: email.trim(), password });
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="stage">
      <pre className="tree" aria-hidden="true">{TREE}</pre>

      <form className="panel" onSubmit={onSubmit}>
        <h1 className="panel-title">{isSignUp ? '[ crear cuenta ]' : '[ entrar ]'}</h1>

        {isSignUp && (
          <label className="field">
            <span>nombre</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              autoComplete="nickname"
              placeholder="cómo te verán en la sala"
            />
          </label>
        )}

        <label className="field">
          <span>email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
        </label>

        {error && <p className="msg fail" role="alert">{error}</p>}
        {notice && <p className="msg ok" role="status">{notice}</p>}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? '...' : isSignUp ? '> registrarme' : '> entrar'}
        </button>

        <button className="link" type="button" onClick={switchMode}>
          {isSignUp ? '¿ya tienes cuenta? entra' : '¿no tienes cuenta? regístrate'}
        </button>
      </form>
    </main>
  );
}
