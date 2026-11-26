/**
 * Gestos a partir de la pose y la posición de la mano fotograma a fotograma.
 *
 *   puño → abrir             paso 1 (luz y disco)
 *   subir la mano abierta    paso 2 (árbol y estrella)
 *   pellizco                 paso 3 (luces y regalos)
 *   índice de lado a lado    girar el árbol (continuo)
 *   índice arriba 1 s        repetir la intro (solo con la intro terminada)
 *   corazón con las 2 manos  abrir mi siguiente regalo
 *
 * update(t, m, pose, { introDone, heart }) devuelve una lista de eventos:
 *   { type: 'step', step } · { type: 'spin', dx } · { type: 'restart' } · { type: 'heart' }
 * y cada evento discreto lleva `label` para mostrarlo en pantalla.
 * Con dos manos en imagen se pasa m = null y `heart` dice si forman un corazón.
 *
 * Coordenadas de imagen ya en espejo (0..1; y crece hacia abajo).
 */

const COOLDOWN = 0.8; // s tras un gesto antes de aceptar otro
const HISTORY = 1.5; // s de historia

const FIST_MIN = 0.2, FIST_MAX = 1.5; // puño corto antes de abrir
const OPEN_WITHIN = 0.5; // abrir como mucho esto después de soltar el puño
const HOLD_POINT = 1; // índice arriba para repetir
const HOLD_STILL = 0.1; // cuánto puede moverse la mano mientras se mantiene (imagen)
const POSE_GAP = 0.15; // un fotograma suelto de otra pose no rompe una pose mantenida

const RAISE = 0.25, RAISE_TIME = 1; // subir ≥ 25 % del alto en ≤ 1 s
const PINCH_HOLD = 0.4;
const HEART_HOLD = 0.4;
const HEART_GAP = 0.4; // con dos manos el seguimiento parpadea más: se toleran huecos más largos
const SWIPE_SPEED = 0.35; // imágenes por segundo para empezar a girar
const SPIN_GAIN = 14; // cuánto empuja el giro (como arrastrar con el ratón)

export const GESTURE_LABELS = {
  0: 'puño → abrir',
  1: 'subir la mano',
  2: 'pellizco',
  restart: 'repetir',
  heart: 'corazón',
};

export function createGestureDetector() {
  let hist = []; // { t, x, y, tx, pose }
  let lastFire = -Infinity;
  let fist = null; // { start, last }
  let fistReleased = null; // { dur, at }: el último puño, para «abrir» justo después
  let point = null; // { start, last, x, y, used }: índice arriba mantenido
  let pinch = null; // { start, last, used }
  let heart = null; // { start, last, used }
  let prevT = null;

  const ready = (t) => t - lastFire >= COOLDOWN;
  const fire = (t, ev) => {
    lastFire = t;
    hist = []; // empezar de cero: el movimiento que llevó al gesto no cuenta para otro
    return ev;
  };
  // Pose mantenida con tolerancia a fotogramas sueltos.
  const hold = (cur, on, t, gap = POSE_GAP) => {
    if (!on) return cur && t - cur.last > gap ? null : cur;
    if (!cur || t - cur.last > gap) cur = { start: t, last: t, used: false };
    cur.last = t;
    return cur;
  };

  return {
    reset() {
      hist = [];
      fist = null;
      fistReleased = null;
      point = null;
      pinch = null;
      heart = null;
      prevT = null;
    },

    update(t, m, pose, { introDone = false, heart: isHeart = false } = {}) {
      const events = [];
      const dt = prevT === null ? 0 : Math.min(0.2, t - prevT);
      prevT = t;

      // --- Corazón con las dos manos, mantenido 0,4 s.
      heart = hold(heart, isHeart, t, HEART_GAP);
      if (heart && isHeart && !heart.used && t - heart.start >= HEART_HOLD && ready(t)) {
        heart.used = true;
        events.push(fire(t, { type: 'heart', label: GESTURE_LABELS.heart }));
      }

      if (!m) {
        // Sin mano (o con dos): se pierde lo que estuviera a medias con una.
        hist = [];
        fist = null;
        point = null;
        pinch = null;
        return events;
      }

      const { x, y } = m.wrist;
      const tx = m.tip.x;
      hist.push({ t, x, y, tx, pose });
      hist = hist.filter((h) => t - h.t <= HISTORY);
      // Historia continua de la pose actual, de la más reciente a la más antigua.
      const run = [];
      for (let i = hist.length - 1; i >= 0 && hist[i].pose === pose; i--) run.push(hist[i]);

      // --- Índice: de lado a lado gira el árbol; arriba y quieto 1 s repite la intro.
      if (pose === 'point') {
        const ref = run.find((h) => t - h.t >= 0.15) ?? run[run.length - 1];
        let moving = false;
        if (ref && t > ref.t && dt > 0) {
          const vx = (tx - ref.tx) / (t - ref.t);
          const vy = (y - ref.y) / (t - ref.t);
          moving = Math.abs(vx) > SWIPE_SPEED && Math.abs(vx) > 2 * Math.abs(vy);
          if (moving && t - lastFire > 0.3) events.push({ type: 'spin', dx: vx * dt * SPIN_GAIN });
        }
        if (!point || t - point.last > POSE_GAP) point = { start: t, last: t, x: tx, y, used: false };
        point.last = t;
        // Girando, sin apuntar arriba o si se movió: vuelve a contar desde ahora.
        if (moving || !m.indexUp || Math.hypot(tx - point.x, y - point.y) >= HOLD_STILL) {
          Object.assign(point, { start: t, x: tx, y });
        }
        if (!point.used && introDone && t - point.start >= HOLD_POINT && ready(t)) {
          point.used = true;
          events.push(fire(t, { type: 'restart', label: GESTURE_LABELS.restart }));
        }
      } else if (point && t - point.last > POSE_GAP) {
        point = null;
      }

      // --- Puño, para «puño → abrir»: se apunta cuánto duró al soltarlo.
      if (pose === 'fist') {
        if (!fist || t - fist.last > POSE_GAP) fist = { start: t, last: t };
        fist.last = t;
      } else if (fist && (pose === 'open' || t - fist.last > POSE_GAP)) {
        fistReleased = { dur: fist.last - fist.start, at: fist.last };
        fist = null;
      }

      // --- Puño → abrir.
      if (pose === 'open' && fistReleased) {
        const { dur, at } = fistReleased;
        if (t - at <= OPEN_WITHIN && dur >= FIST_MIN && dur <= FIST_MAX && ready(t)) {
          events.push(fire(t, { type: 'step', step: 0, label: GESTURE_LABELS[0] }));
        }
        fistReleased = null;
      }
      if (fistReleased && t - fistReleased.at > OPEN_WITHIN) fistReleased = null;

      // --- Subir la mano abierta (sobre todo en vertical).
      if (pose === 'open') {
        const raised = run.find((h) => t - h.t <= RAISE_TIME && h.y - y >= RAISE && h.y - y > 2 * Math.abs(x - h.x));
        if (raised && ready(t)) events.push(fire(t, { type: 'step', step: 1, label: GESTURE_LABELS[1] }));
      }

      // --- Pellizco quieto ≥ 0,4 s.
      pinch = hold(pinch, pose === 'pinch', t);
      if (pinch && pose === 'pinch' && !pinch.used && t - pinch.start >= PINCH_HOLD && ready(t)) {
        pinch.used = true;
        events.push(fire(t, { type: 'step', step: 2, label: GESTURE_LABELS[2] }));
      }

      return events;
    },
  };
}
