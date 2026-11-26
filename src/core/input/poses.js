/**
 * Poses de una mano a partir de los 21 puntos de MediaPipe Hands.
 *
 *   0 muñeca · 1–4 pulgar · 5–8 índice · 9–12 corazón · 13–16 anular · 17–20 meñique
 *   (en cada dedo: base, nudillo medio, nudillo de la punta, punta)
 *
 * Todo se mide relativo al tamaño de la palma (muñeca → base del corazón), así
 * da igual lo cerca o lejos que esté la mano de la cámara.
 *
 * `aspect` = ancho / alto del vídeo: MediaPipe da x e y normalizadas cada una a
 * su lado de la imagen, y sin corregirlo una mano girada parecería más estrecha.
 */

export const POSE_LABELS = {
  fist: 'puño',
  open: 'mano abierta',
  pinch: 'pellizco',
  point: 'índice',
  other: 'mano',
  two: 'dos manos',
  heart: 'corazón',
};

const FINGERS = [
  { tip: 8, pip: 6, mcp: 5 }, // índice
  { tip: 12, pip: 10, mcp: 9 }, // corazón
  { tip: 16, pip: 14, mcp: 13 }, // anular
  { tip: 20, pip: 18, mcp: 17 }, // meñique
];

// Umbrales (en palmas). Pellizco con histéresis: entra más cerca de lo que sale.
const CURLED = 0.85; // punta a menos de esto del centro de la palma
const EXTENDED = 1.25; // punta-muñeca más larga que nudillo-muñeca por este factor
const PINCH_IN = 0.3;
const PINCH_OUT = 0.45;

/**
 * Mide la mano: posiciones útiles y estado de cada dedo.
 * Devuelve { palm, wrist, tip, center, gap, curled[4], extended[4], thumbOut, indexUp }.
 */
export function measureHand(lm, aspect = 4 / 3) {
  const P = (i) => ({ x: lm[i].x * aspect, y: lm[i].y });
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const wrist = P(0);
  const palm = Math.max(1e-4, d(wrist, P(9)));
  const center = [0, 5, 9, 13, 17].map(P).reduce((c, p) => ({ x: c.x + p.x / 5, y: c.y + p.y / 5 }), { x: 0, y: 0 });

  const curled = FINGERS.map((f) => d(P(f.tip), center) / palm < CURLED);
  const extended = FINGERS.map((f, i) => !curled[i] && d(P(f.tip), wrist) > d(P(f.pip), wrist) * EXTENDED);

  // Pulgar fuera: su punta lejos de la base del índice y más lejos del meñique que su nudillo.
  const thumbOut = d(P(4), P(5)) / palm > 0.45 && d(P(4), P(17)) > d(P(3), P(17)) * 1.05;

  return {
    palm,
    // Posiciones en coordenadas de imagen (0..1 en x e y) para el detector de movimientos.
    wrist: { x: lm[0].x, y: lm[0].y },
    tip: { x: lm[8].x, y: lm[8].y }, // punta del índice
    center: { x: center.x / aspect, y: center.y },
    gap: d(P(4), P(8)) / palm, // pulgar–índice
    curled,
    extended,
    thumbOut,
    // Índice apuntando hacia arriba: la punta bien por encima de su base.
    indexUp: lm[8].y < lm[5].y - 0.5 * palm,
  };
}

/**
 * Pose de la mano: 'fist' | 'open' | 'pinch' | 'point' | 'other'.
 * `prev` (la pose anterior) solo sirve para la histéresis del pellizco.
 */
export function classifyPose(m, prev = null) {
  const curledCount = m.curled.filter(Boolean).length;
  const extendedCount = m.extended.filter(Boolean).length;
  const restOpen = m.curled.slice(1).filter((c) => !c).length; // corazón, anular, meñique sin cerrar

  // Pellizco: pulgar e índice juntos y el resto de dedos sin cerrar en puño.
  const pinchLimit = prev === 'pinch' ? PINCH_OUT : PINCH_IN;
  if (m.gap < pinchLimit && restOpen >= 2) return 'pinch';
  if (curledCount === 4) return 'fist';
  if (extendedCount === 4 && m.thumbOut) return 'open';
  if (m.extended[0] && m.curled[1] && m.curled[2] && m.curled[3]) return 'point';
  return 'other';
}

/**
 * Corazón con las dos manos: las puntas de los índices juntas arriba, las de los
 * pulgares juntas abajo y el hueco abierto entre ellas (no es un pellizco).
 * `wasHeart`: si ya lo era el fotograma anterior, los umbrales se aflojan (histéresis)
 * para que no parpadee.
 */
export function isHeart(a, b, aspect = 4 / 3, wasHeart = false) {
  const P = (lm, i) => ({ x: lm[i].x * aspect, y: lm[i].y });
  const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const palm = (d(P(a, 0), P(a, 9)) + d(P(b, 0), P(b, 9))) / 2;
  if (palm < 1e-4) return false;
  const ia = P(a, 8), ib = P(b, 8), ta = P(a, 4), tb = P(b, 4);
  const k = wasHeart ? 1.4 : 1;
  const indexTogether = d(ia, ib) < 0.7 * k * palm;
  const thumbsTogether = d(ta, tb) < 0.7 * k * palm;
  const indexAbove = (ia.y + ib.y) / 2 < (ta.y + tb.y) / 2 - (0.4 / k) * palm;
  const open = d(ia, ta) > (0.5 / k) * palm && d(ib, tb) > (0.5 / k) * palm;
  const sideBySide = Math.abs(P(a, 0).x - P(b, 0).x) > 0.5 * palm;
  return indexTogether && thumbsTogether && indexAbove && open && sideBySide;
}
