import { signOut } from '../../services/supabase/auth';
import { useAuthStore } from '../../store/authStore';

/** Barra superior: contenido propio a la izquierda; acciones, nombre y "salir" a la derecha. */
export default function TopBar({ left, children }) {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  return (
    <header className="topbar">
      <div className="topbar-side">{left}</div>
      <div className="topbar-side">
        {children}
        <span className="who">
          {profile?.display_name ?? session?.user.email}
          {profile?.role === 'superadmin' && <span className="badge">superadmin</span>}
        </span>
        <button className="link" onClick={() => signOut()}>salir</button>
      </div>
    </header>
  );
}
