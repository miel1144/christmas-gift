import { clamp, span } from '../../../../utils/math';

/**
 * Tiempos de cada paso, en segundos desde que empieza ese paso.
 * Las duraciones totales de cada paso están en core/engine/intro.js (STEPS).
 */
export const T = {
  // Paso 1 · luz y disco
  drop: 0.34, // la luz cae hasta el suelo
  spread: 1.0, // el mandala se abre

  // Paso 2 · árbol y estrella
  trunk: [0, 0.45],
  grow: [0.4, 4.4],
  ringLead: 0.18, // el anillo va este tiempo por delante de las hojas
  star: [4.15, 5.05],

  // Paso 3 · luces y regalos
  wave: 3.0, // las dos luces guía bajan del todo
  giftAt: 3.0,
  giftGap: 0.26, // un regalo aterriza antes de que salga el siguiente
};

/** Altura alcanzada por el árbol (0 → ~1.12) en el segundo s del paso 2. */
export function growth(s) {
  const g = span(s, T.grow[0], T.grow[1]);
  const shaped = g < 0.5 ? 0.5 * Math.pow(2 * g, 1.5) : 1 - 0.5 * Math.pow(2 * (1 - g), 1.5);
  return shaped * 1.12;
}

/** Progreso 0..1 de las luces guía en el paso 3. */
export const waveProgress = (s3) => clamp(s3 / T.wave);

/**
 * Cuánto hace que la ola de luz pasó por la altura f (>0 = ya encendida).
 * k mete un poco de desorden para que no se enciendan en una línea perfecta.
 */
export const litAmount = (wave, f, k) => wave * 1.25 - (1 - f) + (k - 0.5) * 0.04;
