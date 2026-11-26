import { supabase, initialAuthHash } from './client';

// Traduce los errores más comunes de Supabase Auth a mensajes para el usuario.
const MESSAGES = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu email antes de entrar (revisa tu bandeja).',
  user_already_exists: 'Ya existe una cuenta con ese email.',
  weak_password: 'La contraseña es demasiado débil (mínimo 6 caracteres).',
  over_email_send_rate_limit: 'Demasiados intentos. Espera un momento y vuelve a probar.',
  same_password: 'La contraseña nueva tiene que ser distinta de la anterior.',
  session_not_found: 'El enlace ya no es válido. Pide uno nuevo.',
  otp_expired: 'El enlace caducó o ya se usó. Pide uno nuevo.',
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

/**
 * Envía el email de recuperación. El enlace vuelve a /reset (esa ruta tiene que
 * estar en Supabase → Authentication → URL Configuration → Redirect URLs).
 */
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset`,
  });
  if (error) throw error;
}

/** Cambia la contraseña de la sesión actual (la de recuperación, al volver del email). */
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** ¿Se llegó desde un enlace de recuperación? (aunque Supabase lo mandara a otra ruta) */
export const arrivedFromRecovery = initialAuthHash.get('type') === 'recovery';

/** Error que trae la URL si el enlace del email caducó o ya se usó (o null). */
export function linkError() {
  const code = initialAuthHash.get('error_code');
  if (!code && !initialAuthHash.get('error')) return null;
  return MESSAGES[code] ?? 'El enlace no es válido. Pide uno nuevo.';
}
