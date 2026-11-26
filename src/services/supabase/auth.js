import { supabase, initialAuthHash } from './client';

// Traduce los errores más comunes de Supabase Auth a mensajes para el usuario.
const MESSAGES = {
  invalid_credentials: 'Usuario o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu email antes de entrar (revisa tu bandeja).',
  user_already_exists: 'Ya existe una cuenta con ese email.',
  weak_password: 'La contraseña es demasiado débil (mínimo 6 caracteres).',
  over_email_send_rate_limit: 'Demasiados intentos. Espera un momento y vuelve a probar.',
  same_password: 'La contraseña nueva tiene que ser distinta de la anterior.',
  session_not_found: 'El enlace ya no es válido. Pide uno nuevo.',
  otp_expired: 'El enlace caducó o ya se usó. Pide uno nuevo.',
  username_taken: 'Ese nombre de usuario ya está en uso. Elige otro.',
  too_many_attempts: 'Demasiados intentos fallidos con ese usuario. Espera 15 minutos o recupera tu contraseña.',
};

export function authErrorMessage(error) {
  if (!error) return null;
  // Nombre repetido: al guardar el perfil (23505) o al registrarse (el trigger falla
  // y Supabase Auth solo dice "Database error saving new user").
  if (error.code === '23505' || /saving new user/i.test(error.message ?? '')) return MESSAGES.username_taken;
  if (error.message === 'too_many_attempts') return MESSAGES.too_many_attempts;
  return MESSAGES[error.code] ?? error.message ?? 'Error desconocido.';
}

/** ¿Está libre este nombre de usuario? (también valida el formato) */
export async function usernameAvailable(username) {
  const { data, error } = await supabase.rpc('username_available', { p_username: username.trim() });
  if (error) throw error;
  return data === true;
}

/** Registro. Si el proyecto pide confirmar el email, `session` llega a null. */
export async function signUp({ email, password, displayName }) {
  if (!(await usernameAvailable(displayName))) {
    throw Object.assign(new Error(MESSAGES.username_taken), { code: 'username_taken' });
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Lo lee el trigger handle_new_user para rellenar profiles.display_name.
      data: { display_name: displayName },
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return { session: data.session, needsConfirmation: !data.session };
}

/**
 * Entrar con nombre de usuario. Supabase Auth solo entiende email, así que primero
 * login_email (en la base) comprueba usuario + contraseña y, solo si son correctos,
 * devuelve el email; con él se abre la sesión normal. Ver la migración
 * 20261126000000_unique_usernames_login.sql (incluye límite de intentos).
 */
export async function signIn({ username, password }) {
  const { data: email, error: lookupError } = await supabase.rpc('login_email', {
    p_username: username.trim(),
    p_password: password,
  });
  if (lookupError) throw lookupError;
  if (!email) throw Object.assign(new Error(MESSAGES.invalid_credentials), { code: 'invalid_credentials' });
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

/** Guarda nombre y avatar. Devuelve el perfil actualizado. */
export async function updateProfile(userId, { displayName, avatarAscii }) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, avatar_ascii: avatarAscii })
    .eq('id', userId)
    .select('id, email, display_name, role, avatar_ascii')
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
