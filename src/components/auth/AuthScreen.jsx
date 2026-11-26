import { useEffect, useRef, useState } from 'react';
import { signIn, signUp, authErrorMessage, linkError, usernameAvailable } from '../../services/supabase/auth';
import { USERNAME_HINT, USERNAME_MAX, usernameProblem } from '../../utils/username';
import ForgotPasswordForm from './ForgotPasswordForm';
import PasswordInput from '../ui/PasswordInput';
import AsciiCanvas from '../canvas/AsciiCanvas';
import { createLoginScene } from '../../core/engine/scenes/login';

const TREE = `        *
       /.\\
      /..'\\
     /'.'.'\\
    /.''.'..\\
   /.'.'.'.'.\\
       |_|`;

export default function AuthScreen() {
  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp' | 'forgot'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Registro: comprobación en vivo del nombre ('idle' | 'checking' | 'free' | 'taken').
  const [nameState, setNameState] = useState('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => linkError());
  const [notice, setNotice] = useState(null);

  const isSignUp = mode === 'signUp';
  const formRef = useRef(null);
  const nameProblem = isSignUp && username ? usernameProblem(username) : null;

  useEffect(() => {
    if (!isSignUp || !username.trim() || usernameProblem(username)) {
      setNameState('idle');
      return undefined;
    }
    setNameState('checking');
    let alive = true;
    const timer = setTimeout(() => {
      usernameAvailable(username)
        .then((free) => alive && setNameState(free ? 'free' : 'taken'))
        .catch(() => alive && setNameState('idle'));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [isSignUp, username]);

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
          displayName: username.trim(),
        });
        if (needsConfirmation) {
          setNotice(`Te enviamos un enlace a ${email.trim()}. Ábrelo para activar la cuenta y luego entra con tu usuario «${username.trim()}».`);
          setMode('signIn');
          setPassword('');
        }
        // Si no hace falta confirmar, onAuthStateChange cambia de pantalla solo.
      } else {
        await signIn({ username, password });
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="stage auth">
      <AsciiCanvas sceneFactory={createLoginScene} interactive={false} anchorRef={formRef} />
      <pre className="tree auth-tree" aria-hidden="true">{TREE}</pre>

      {mode === 'forgot' ? (
        <ForgotPasswordForm
          formRef={formRef}
          intro="Escribe el email de tu cuenta y te mandamos un enlace para poner una contraseña nueva."
          onBack={() => {
            setMode('signIn');
            setError(null);
            setNotice(null);
          }}
        />
      ) : (
        <form className="panel" onSubmit={onSubmit} ref={formRef}>
          <h1 className="panel-title">{isSignUp ? '[ crear cuenta ]' : '[ entrar ]'}</h1>

          <label className="field">
            <span>{isSignUp ? 'nombre de usuario' : 'usuario'}</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              maxLength={isSignUp ? USERNAME_MAX : 64}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={isSignUp ? 'así te verán en las salas' : undefined}
              aria-describedby={isSignUp ? 'username-help' : undefined}
              aria-invalid={isSignUp && (nameProblem || nameState === 'taken') ? true : undefined}
            />
            {isSignUp && (
              <span id="username-help" className={`small ${nameProblem || nameState === 'taken' ? 'msg fail' : nameState === 'free' ? 'msg ok' : 'muted'}`} aria-live="polite">
                {nameProblem ?? (nameState === 'checking' ? 'comprobando…' : nameState === 'taken' ? 'Ese nombre ya está en uso.' : nameState === 'free' ? 'Disponible.' : USERNAME_HINT)}
              </span>
            )}
          </label>

          {isSignUp && (
            <label className="field">
              <span>email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <span className="muted small">Para confirmar la cuenta y recuperar la contraseña. Nadie más lo ve.</span>
            </label>
          )}

          <label className="field">
            <span>contraseña</span>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </label>

          {error && <p className="msg fail" role="alert">{error}</p>}
          {notice && <p className="msg ok" role="status">{notice}</p>}

          <button className="btn" type="submit" disabled={busy || (isSignUp && (Boolean(nameProblem) || nameState === 'taken'))}>
            {busy ? '...' : isSignUp ? '> registrarme' : '> entrar'}
          </button>

          <button className="link" type="button" onClick={switchMode}>
            {isSignUp ? '¿ya tienes cuenta? entra' : '¿no tienes cuenta? regístrate'}
          </button>
          {!isSignUp && (
            <button
              className="link"
              type="button"
              onClick={() => {
                setMode('forgot');
                setError(null);
                setNotice(null);
              }}
            >
              ¿olvidaste tu contraseña?
            </button>
          )}
        </form>
      )}
    </main>
  );
}
