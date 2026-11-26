/**
 * Avatares ASCII (columna profiles.avatar_ascii): hasta 3 líneas de 7 caracteres,
 * solo ASCII imprimible. Se guardan sin espacios al final de cada línea.
 */
export const AVATAR_ROWS = 3;
export const AVATAR_COLS = 7;

export const AVATAR_PRESETS = [
  { name: 'muñeco de nieve', art: ' _===_\n (o.o)\n ( : )' },
  { name: 'árbol', art: '   *\n  /o\\\n /_o_\\' },
  { name: 'regalo', art: ' _\\/_\n|_||_|\n|_||_|' },
  { name: 'gato', art: ' /\\_/\\\n( o.o )\n > ^ <' },
  { name: 'reno', art: ' Y   Y\n (o.o)\n  (")' },
  { name: 'oso', art: ' ()_()\n (o.o)\n(")(")' },
  { name: 'estrella', art: '  \\|/\n --*--\n  /|\\' },
  { name: 'pingüino', art: '  (o>\n //\\\\\n V_/_' },
];

/** Texto libre → avatar válido (o null si queda vacío). */
export function normalizeAvatar(text) {
  const lines = String(text ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .slice(0, AVATAR_ROWS)
    .map((l) => l.replace(/\t/g, ' ').replace(/[^\x20-\x7e]/g, '').slice(0, AVATAR_COLS).replace(/\s+$/, ''));
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines.some((l) => l.trim()) ? lines.join('\n') : null;
}
