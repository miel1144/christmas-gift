import { useEffect } from 'react';
import { initAuth, useAuthStore } from './store/authStore';
import { useRoute } from './hooks/useRoute';
import AuthScreen from './components/auth/AuthScreen';
import Lobby from './components/layout/Lobby';
import RoomView from './components/layout/RoomView';
import JoinRoom from './components/layout/JoinRoom';

// El diagnóstico de Supabase sigue disponible con testSupabase() en la consola.
export default function App() {
  const status = useAuthStore((s) => s.status);
  const route = useRoute();

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
  // Sin sesión se muestra el login sin cambiar la URL: tras entrar, la invitación
  // o la sala que se abrió siguen ahí.
  if (status === 'signedOut') return <AuthScreen />;
  if (route.name === 'room') return <RoomView key={route.id} roomId={route.id} />;
  if (route.name === 'join') return <JoinRoom code={route.code} />;
  return <Lobby />;
}
