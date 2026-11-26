import { useState } from 'react';
import { signOut } from '../../services/supabase/auth';
import { useAuthStore } from '../../store/authStore';
import ProfileModal from '../profile/ProfileModal';
import { navigate } from '../../hooks/useRoute';

/**
 * Barra superior: contenido propio a la izquierda; acciones, nombre y "salir" a la derecha.
 * Clic en el nombre abre el perfil.
 */
export default function TopBar({ left, children }) {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-side">{left}</div>
      <div className="topbar-side">
        {children}
        <span className="who">
          <button className="link who-name" onClick={() => setProfileOpen(true)} title="Editar tu perfil">
            {profile?.display_name ?? session?.user.email}
          </button>
          {profile?.role === 'superadmin' && (
            <button className="badge badge-link" onClick={() => navigate('/admin')} title="Abrir el panel de superadmin">admin</button>
          )}
        </span>
        <button className="link" onClick={() => signOut()}>salir</button>
      </div>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </header>
  );
}
