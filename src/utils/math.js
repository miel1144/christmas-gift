export const TAU = Math.PI * 2;

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

/** PRNG con semilla (mulberry32): misma semilla, mismo árbol en cada carga. */
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash determinista 0..1 a partir de tres números (para ruido por celda). */
export function hash3(a, b, c) {
  const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** Diferencia angular en (-π, π]. */
export function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Elige un carácter de `str` según k ∈ [0,1). */
export const pickChar = (str, k) => str[Math.floor(k * str.length) % str.length];

// Campo de color arcoíris pastel: rosa → lila → azul → cian → menta → amarillo → oro,
// y de vuelta por el mismo camino (nunca pasa por el rojo).
const RAINBOW = [320, 284, 226, 192, 152, 54, 40, 54, 152, 192, 226, 284, 320];
export function rainbowHue(c) {
  c = (((c % 1) + 1) % 1) * (RAINBOW.length - 1);
  const i = Math.floor(c);
  return Math.round(RAINBOW[i] + (RAINBOW[i + 1] - RAINBOW[i]) * (c - i));
}

/** ¿El tono cae en la franja amarilla/dorada? */
export const isWarm = (h) => h > 26 && h < 80;
/** Los amarillos se desplazan hacia un ámbar más sobrio (el amarillo puro deslumbra). */
export const amber = (h) => (isWarm(h) ? Math.round(38 + (h - 26) * 0.22) : h);

// --- Curvas de animación ---
/** Sale rápido y frena (cúbica). */
export const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
/** Como ease pero se pasa un poco y vuelve (efecto "pop"). */
export const easeBack = (t) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = 1.5, u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};
/** Progreso 0..1 de t dentro del tramo [a, b]. */
export const span = (t, a, b) => clamp((t - a) / (b - a));
