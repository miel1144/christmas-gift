/**
 * Nombre de usuario: es el nombre que se ve en las salas y con el que se entra.
 * Mismas reglas que la base de datos (check profiles_username_format): 3–24
 * caracteres entre letras sin acento, números, punto, guion bajo y guion. Único
 * sin distinguir mayúsculas.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const USERNAME_RE = /^[A-Za-z0-9._-]{3,24}$/;
export const USERNAME_HINT = '3–24 caracteres: letras sin acento, números, punto, guion o guion bajo.';

/** Mensaje de error si el nombre no cumple el formato, o null si vale. */
export function usernameProblem(name) {
  const n = name.trim();
  if (n.length < USERNAME_MIN) return `Mínimo ${USERNAME_MIN} caracteres.`;
  if (n.length > USERNAME_MAX) return `Máximo ${USERNAME_MAX} caracteres.`;
  if (!USERNAME_RE.test(n)) return 'Solo letras sin acento, números, punto, guion o guion bajo (sin espacios).';
  return null;
}
