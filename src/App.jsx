import { useEffect } from 'react';
import { initAuth, useAuthStore } from './store/authStore';
import { navigate, useRoute } from './hooks/useRoute';
import AuthScreen from './components/auth/AuthScreen';
import Lobby from './components/layout/Lobby';
import RoomView from './components/layout/RoomView';
import JoinRoom from './components/layout/JoinRoom';
import ResetPassword from './components/auth/ResetPassword';
import NotFound from './components/layout/NotFound';
import AdminPanel from './components/admin/AdminPanel';
import { arrivedFromRecovery } from './services/supabase/auth';

// El diagnóstico de Supabase sigue disponible con testSupabase() en la consola.
export default function App() {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const profileError = useAuthStore((s) => s.profileError);
  const route = useRoute();

  useEffect(() => {
    initAuth();
    // Si Supabase mandó el enlace de recuperación a otra ruta (p. ej. porque /reset no
    // estaba en las Redirect URLs), igual se pide la contraseña nueva: si no, la
    // sesión de recuperación entraría directa al lobby.
    if (arrivedFromRecovery && window.location.pathname !== '/reset') navigate('/reset', { replace: true });
  }, []);

  // /reset gestiona por sí misma la carga y la sesión de recuperación.
  if (route.name === 'reset') return <ResetPassword />;
  if (route.name === 'notFound') return <NotFound />;
  // /admin: a quien no es superadmin (con o sin sesión) se le muestra "no encontrada",
  // sin pista de que la página existe. La protección real de los datos es RLS.
  if (route.name === 'admin') {
    if (status === 'signedOut' || profileError) return <NotFound />;
    if (status === 'loading' || !profile) {
      return (
        <main className="stage">
          <p className="pending">cargando...</p>
        </main>
      );
    }
    return profile.role === 'superadmin' ? <AdminPanel /> : <NotFound />;
  }

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
