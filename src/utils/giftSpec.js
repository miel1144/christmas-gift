import { TAU, angleDiff } from './math';

/** Colores que se ofrecen al enviar un regalo. */
export const GIFT_COLORS = [
  { hex: '#e8323f', name: 'rojo' },
  { hex: '#f2b632', name: 'dorado' },
  { hex: '#2f9e6a', name: 'verde' },
  { hex: '#3d7be0', name: 'azul' },
  { hex: '#d94f9b', name: 'rosa' },
  { hex: '#8a5cd6', name: 'morado' },
];

const SIZES = ['m', 'l', 's', 'flat', 'tall'];
// Anillos alrededor del tronco (en radios del árbol): se llena primero el más vacío.
const RINGS = [0.92, 1.16, 1.4];

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** '#rrggbb' → [tono, saturación] para la paleta HSL de la escena. */
export function hexToHueSat(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return [356, 88];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return [0, 0];
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  return [Math.round((h * 60 + 360) % 360), Math.round(Math.min(100, s * 100))];
}

/** Fila de la tabla `gifts` → especificación de caja para la escena. */
export function giftToSpec(gift, meId) {
  const h = hashString(gift.id);
  const [hue, sat] = hexToHueSat(gift.color);
  const goldish = hue > 30 && hue < 70;
  return {
    id: gift.id,
    size: SIZES[h % SIZES.length],
    body: [hue, Math.max(60, sat)],
    ribbon: goldish ? [356, 88] : [46, 100],
    a: gift.position_x,
    rg: gift.position_y >= 0.5 ? gift.position_y : RINGS[0],
    opened: Boolean(gift.opened_at),
    mine: gift.receiver_id === meId && !gift.opened_at,
  };
}

/**
 * Elige dónde poner un regalo nuevo: en el anillo con menos regalos, en el
 * centro del hueco más grande. Devuelve { x: ángulo, y: radio } (columnas
 * position_x / position_y).
 */
export function placeGift(existing) {
  const byRing = RINGS.map((r) => existing.filter((g) => Math.abs(g.position_y - r) < 0.1).map((g) => g.position_x));
  let ring = 0;
  for (let i = 1; i < RINGS.length; i++) if (byRing[i].length < byRing[ring].length) ring = i;
  const angles = byRing[ring].map((a) => ((a % TAU) + TAU) % TAU).sort((a, b) => a - b);
  let x;
  if (!angles.length) {
    x = Math.random() * TAU;
  } else {
    let best = 0, bestGap = -1;
    angles.forEach((a, i) => {
      const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + TAU;
      const gap = next - a;
      if (gap > bestGap) { bestGap = gap; best = a; }
    });
    x = (best + bestGap / 2 + (Math.random() - 0.5) * bestGap * 0.2) % TAU;
  }
  // Evita que caiga justo delante del tronco, donde tapa la base del árbol.
  if (Math.abs(angleDiff(x, 0)) < 0.25) x += 0.5;
  return { x, y: RINGS[ring] };
}
