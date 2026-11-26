import { supabase } from './client';

// Traduce los errores más comunes de Supabase Auth a mensajes para el usuario.
const MESSAGES = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu email antes de entrar (revisa tu bandeja).',
  user_already_exists: 'Ya existe una cuenta con ese email.',
  weak_password: 'La contraseña es demasiado débil (mínimo 6 caracteres).',
  over_email_send_rate_limit: 'Demasiados intentos. Espera un momento y vuelve a probar.',
};

export function authErrorMessage(error) {
  if (!error) return null;
  return MESSAGES[error.code] ?? error.message ?? 'Error desconocido.';
}

/** Registro. Si el proyecto pide confirmar el email, `session` llega a null. */
export async function signUp({ email, password, displayName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Lo lee el trigger handle_new_user para rellenar profiles.display_name.
      data: displayName ? { display_name: displayName } : {},
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return { session: data.session, needsConfirmation: !data.session };
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Perfil público del usuario (lo crea el trigger al registrarse). */
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, avatar_ascii')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}
