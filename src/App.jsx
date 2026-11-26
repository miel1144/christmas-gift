import { useEffect } from 'react';
import { signOut } from './services/supabase/auth';
import { initAuth, useAuthStore } from './store/authStore';
import AuthScreen from './components/auth/AuthScreen';
import AsciiCanvas from './components/canvas/AsciiCanvas';

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

// Regalos de ejemplo mientras no existan las salas: luego vendrán de la tabla `gifts`.
const DEMO_GIFTS = [
  { size: 'l', body: [356, 88], ribbon: [46, 100] },
  { size: 's', body: [42, 96], ribbon: [356, 88] },
  { size: 'flat', body: [152, 78], ribbon: [46, 100] },
  { size: 'tall', body: [222, 84], ribbon: [46, 100] },
  { size: 'm', body: [326, 84], ribbon: [50, 100] },
];

// Escena provisional tras iniciar sesión: el árbol ASCII a pantalla completa.
// El diagnóstico de Supabase sigue disponible con testSupabase() en la consola.
function Home() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const profileError = useAuthStore((s) => s.profileError);

  return (
    <main className="scene">
      <AsciiCanvas gifts={DEMO_GIFTS} />
      <header className="topbar">
        <span>
          hola, {profile?.display_name ?? session.user.email}
          {profile?.role === 'superadmin' && <span className="badge">superadmin</span>}
        </span>
        {profileError && <span className="msg fail">perfil: {profileError}</span>}
        <button className="link" onClick={() => signOut()}>salir</button>
      </header>
      <p className="hint">1 · 2 · 3 pasos · R repetir · arrastra para girar</p>
    </main>
  );
}
