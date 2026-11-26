import { create } from 'zustand';
import { supabase } from '../services/supabase/client';
import { fetchProfile } from '../services/supabase/auth';

/**
 * Estado de sesión global.
 * status: 'loading' (aún no sabemos) | 'signedOut' | 'signedIn'
 */
export const useAuthStore = create((set, get) => ({
  status: 'loading',
  session: null,
  profile: null,
  profileError: null,

  async loadProfile(userId) {
    try {
      const profile = await fetchProfile(userId);
      // Evita pisar el perfil si la sesión cambió mientras cargaba.
      if (get().session?.user.id === userId) set({ profile, profileError: null });
    } catch (e) {
      set({ profileError: e.message });
    }
  },

  /** Tras guardar el perfil: lo deja en el store sin volver a pedirlo. */
  setProfile(profile) {
    if (get().session?.user.id === profile?.id) set({ profile, profileError: null });
  },

  setSession(session) {
    const prevId = get().session?.user.id;
    set({ session, status: session ? 'signedIn' : 'signedOut' });
    if (!session) {
      set({ profile: null, profileError: null });
    } else if (session.user.id !== prevId) {
      get().loadProfile(session.user.id);
    }
  },
}));

let started = false;

/** Engancha el store a Supabase Auth una sola vez (seguro con StrictMode). */
export function initAuth() {
  if (started) return;
  started = true;

  const { setSession } = useAuthStore.getState();
  supabase.auth.getSession().then(({ data }) => setSession(data.session));

  // No hacer llamadas async a Supabase dentro del callback (puede bloquearse);
  // setSession lanza la carga del perfil sin esperarla.
  supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });
}
