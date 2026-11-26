import { useEffect, useState } from 'react';
import { checkSupabase, TABLES } from './services/supabase/test-connection';
import { signOut } from './services/supabase/auth';
import { initAuth, useAuthStore } from './store/authStore';
import AuthScreen from './components/auth/AuthScreen';

export default function App() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    initAuth();
  }, []);

  if (status === 'loading') {
    return (
      <main className="stage">
        <p className="pending">cargando...</p>
      </main>
    );
  }
  if (status === 'signedOut') return <AuthScreen />;
  return <Home />;
}

// Pantalla provisional tras iniciar sesión: perfil + diagnóstico de Supabase.
// La sustituye la escena ASCII (src/core/engine) cuando exista.
function Home() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const profileError = useAuthStore((s) => s.profileError);
  const [check, setCheck] = useState(null);

  useEffect(() => {
    checkSupabase().then(setCheck);
  }, []);

  const line = (ok, text) => (
    <li className={ok === null ? 'pending' : ok ? 'ok' : 'fail'}>
      [{ok === null ? '..' : ok ? 'OK' : '!!'}] {text}
    </li>
  );

  return (
    <main className="stage">
      <pre className="tree" aria-hidden="true">
{`        *
       ###
      #####
     #######
    #########
       |||`}
      </pre>

      <section className="panel">
        <h1 className="panel-title">
          hola, {profile?.display_name ?? session.user.email}
        </h1>
        {profile?.role === 'superadmin' && <p className="msg ok">rol: superadmin</p>}
        {profileError && <p className="msg fail">perfil: {profileError}</p>}
        <button className="btn" onClick={() => signOut()}>&gt; salir</button>
      </section>

      <ul className="status">
        {line(true, 'React + Vite')}
        {line(true, 'Sesión iniciada')}
        {line(profile ? true : profileError ? false : null, 'Perfil cargado')}
        {TABLES.map((t) =>
          line(check && (check.connected ? !check.missing.includes(t) : false), `tabla ${t}`)
        )}
      </ul>
      {check?.errors.length > 0 && <pre className="errors">{check.errors.join('\n')}</pre>}
    </main>
  );
}
