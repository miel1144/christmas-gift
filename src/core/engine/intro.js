/**
 * Controlador de la intro en 3 pasos.
 *
 *   1. luz y disco        2. árbol y estrella        3. luces y regalos
 *
 * - Modo 'auto' (por defecto): cada paso arranca cuando termina el anterior.
 * - Modo 'manual': un paso arranca solo cuando se pide con trigger(i) (teclas
 *   1–3 o gestos con la cámara). Pedir un paso salta los anteriores que
 *   falten, pero cada uno espera a que acabe el previo: nunca se pisan.
 *
 * `local(i)` devuelve los segundos desde que empezó el paso i (negativo si aún no).
 */
export const STEPS = [
  { label: 'luz y disco', duration: 2.3 },
  { label: 'árbol y estrella', duration: 5.4 },
  { label: 'luces y regalos', duration: 5.0 },
];

const PAUSE = 0.5; // respiro entre pasos en modo auto
const LEAD_IN = 0.4; // espera antes del primer paso

export function createIntro({ mode = 'auto' } = {}) {
  let starts = STEPS.map(() => null);
  let now = 0;
  let origin = null;
  const endOf = (i) => starts[i] + STEPS[i].duration;

  return {
    get mode() {
      return mode;
    },

    update(t) {
      now = t;
      if (origin === null) origin = t;
      if (mode !== 'auto') return;
      if (starts[0] === null) starts[0] = origin + LEAD_IN;
      for (let i = 1; i < STEPS.length; i++) {
        if (starts[i] === null && starts[i - 1] !== null) starts[i] = endOf(i - 1) + PAUSE;
      }
    },

    trigger(i) {
      mode = 'manual';
      for (let j = 0; j <= i && j < STEPS.length; j++) {
        if (starts[j] === null) starts[j] = j === 0 ? now : Math.max(now, endOf(j - 1));
      }
    },

    /**
     * Vuelve a empezar. Sin `nextMode` sigue en el modo actual (auto: se reproduce
     * sola otra vez); con 'manual' se queda esperando a que se pida el paso 1.
     */
    restart(nextMode) {
      if (nextMode) mode = nextMode;
      starts = STEPS.map(() => null);
      origin = now;
    },

    /** Cuántos pasos han empezado ya (0..3). */
    get started() {
      return starts.filter((s) => s !== null && s <= now).length;
    },

    /** La intro terminó: el último paso empezó y ya pasó su duración. */
    get done() {
      const i = STEPS.length - 1;
      return starts[i] !== null && now - starts[i] >= STEPS[i].duration;
    },

    local(i) {
      return starts[i] === null ? -1 : now - starts[i];
    },
  };
}
