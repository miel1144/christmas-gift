import { TAU, clamp, seeded, angleDiff, rainbowHue, hash3 } from '../../utils/math';

/**
 * Geometría del abeto (se genera una vez, con semilla fija).
 *
 * Unidades: altura f ∈ [0,1] (base → punta), radio en múltiplos de rMax.
 *
 * - 6 pisos, cada uno distinto: alto, ancho, inclinación y "lóbulos" (ramas
 *   grandes de largo, tono, escarcha y caída propios). Al girar, los lóbulos
 *   desfilan de lado y el giro se nota.
 * - ~120 mil puntos: un 30 % rellena el corazón (oscuro, tapa los huecos) y el
 *   resto son ramitas en 4 anillos por piso que cuelgan más cuanto más afuera.
 * - Luces: tiras que cuelgan del borde inferior de cada piso, una fila arcoíris
 *   y otra dorada, con tramos cortados.
 * - Bolas rojas colgando bajo el borde de cada piso.
 */
const WIDTHS = [1.06, 0.8, 0.62, 0.46, 0.32, 0.2];
const HEIGHTS = [1.0, 0.92, 0.83, 0.75, 0.67, 0.6];

export const KIND = { FOLIAGE: 0, LIGHT: 1, NONE: 255 };

export function buildTree({ foliage = 120000, lights = 5000, seed = 11 } = {}) {
  const rand = seeded(seed);
  const gauss = () => (rand() + rand() + rand() + rand() - 2) * 0.87;

  // ── Pisos ──────────────────────────────────────────────────────────────
  const hs = HEIGHTS.map((h) => h * (0.9 + rand() * 0.2));
  const hsum = hs.reduce((a, b) => a + b, 0);
  const tiers = [];
  let base = 0;
  WIDTHS.forEach((w0, i) => {
    // Los pisos de arriba son pequeños: al girar se mueven pocas celdas, así
    // que necesitan menos lóbulos, más marcados y con más contraste.
    const small = clamp(1 - w0 / 0.7);
    const n = Math.round(4.5 + 8 * w0);
    const lobes = [];
    for (let k = 0; k < n; k++) {
      lobes.push({
        a: ((k + 0.25 + rand() * 0.5) / n) * TAU,
        len: 0.92 + rand() * (0.12 + 0.1 * small),
        w: ((0.85 + rand() * 0.3) * TAU) / n,
        tone: 0.7 - 0.28 * small + rand() * (0.5 + 0.7 * small),
        frost: rand() < 0.3 ? 0.15 : 0.6 + rand(),
        sag: (rand() - 0.5) * 0.09,
      });
    }
    const height = (hs[i] / hsum) * 0.97;
    tiers.push({
      base,
      height,
      width: w0 * (0.97 + rand() * 0.06),
      lobes,
      dip: 0.85 - 0.16 * small, // cuánto se hunde el borde entre dos lóbulos
      curv: 0.16 + 0.24 * small,
      leanA: rand() * TAU,
      leanK: 0.015 + rand() * 0.035,
      top: i === WIDTHS.length - 1,
    });
    base += height;
  });

  const rim = (t, a) => {
    let m = t.dip;
    for (const L of t.lobes) {
      const d = angleDiff(a, L.a) / L.w;
      const v = L.len * (1 - t.curv * d * d);
      if (v > m) m = v;
    }
    return t.width * m * (1 + t.leanK * Math.cos(a - t.leanA));
  };
  const lobeAt = (t, a) => {
    let best = t.lobes[0], bd = Infinity;
    for (const L of t.lobes) {
      const d = Math.abs(angleDiff(a, L.a)) / L.w;
      if (d < bd) { bd = d; best = L; }
    }
    return best;
  };
  // Dentro de un piso el radio se cierra hacia arriba (la punta se cierra casi del todo).
  const taper = (t, u) => 1 - (t.top ? 0.93 : 0.62) * Math.pow(u, 0.9);
  const droop = (t, i, a) => 0.55 + 0.14 * Math.sin(a * 3 + i * 1.7) + lobeAt(t, a).sag * 2;
  const tierOf = (f) => {
    let i = 0;
    while (i < tiers.length - 1 && f >= tiers[i + 1].base) i++;
    return i;
  };
  const weights = tiers.map((t) => t.width * t.width + 0.03);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const pickTier = () => {
    let r = rand() * wsum;
    for (let i = 0; i < tiers.length; i++) if ((r -= weights[i]) <= 0) return i;
    return tiers.length - 1;
  };

  // ── Puntos (arrays tipados: se recorren cada fotograma) ────────────────
  const n = foliage + lights;
  const P = {
    n,
    f: new Float32Array(n), // altura 0..1
    r: new Float32Array(n), // radio (× rMax)
    sa: new Float32Array(n), // sin/cos del ángulo, para rotar sin trigonometría
    ca: new Float32Array(n),
    yo: new Float32Array(n), // cuánto cuelga (× rMax, en vertical)
    alb: new Float32Array(n), // brillo propio (albedo)
    k: new Float32Array(n), // aleatorio estable
    hj: new Int8Array(n), // desviación de tono
    frost: new Float32Array(n),
    tint: new Float32Array(n), // puntas del borde teñidas del color de la tira
    hue: new Int16Array(n), // tono de la luz o del tinte
    kind: new Uint8Array(n),
  };
  const setAngle = (i, a) => { P.sa[i] = Math.sin(a); P.ca[i] = Math.cos(a); };

  for (let i = 0; i < foliage; i++) {
    P.k[i] = rand();
    P.kind[i] = KIND.FOLIAGE;

    if (rand() < 0.3) {
      // Corazón: oscuro, rellena los huecos entre ramas.
      const f = rand() * 0.97, t = tiers[tierOf(f)], a = rand() * TAU;
      P.f[i] = f;
      setAngle(i, a);
      P.r[i] = Math.pow(rand(), 0.4) * rim(t, a) * taper(t, (f - t.base) / t.height) * 0.72 + 0.01;
      P.yo[i] = 0.1 * t.width;
      P.alb[i] = 0.04 + rand() * 0.16;
      P.hj[i] = Math.round(gauss() * 10);
      continue;
    }

    // Ramitas: 4 anillos por piso, más cortos hacia arriba.
    const ti = pickTier(), t = tiers[ti], a = rand() * TAU;
    const u = (Math.floor(rand() * 4) + rand() * 0.45) / 4;
    const R = rim(t, a) * taper(t, u) * (0.93 + rand() * 0.12);
    const s = Math.pow(rand(), 0.5) * 1.04; // 0 = junto al tronco, 1 = punta
    const L = lobeAt(t, a);
    P.f[i] = t.base + u * t.height * 0.9 + (rand() - 0.5) * 0.008;
    setAngle(i, a + gauss() * 0.025);
    P.r[i] = s * R + 0.008;
    // Las puntas cuelgan; las de más afuera caen un poco más.
    P.yo[i] =
      droop(t, ti, a) * Math.pow(s, 1.8) * R * 0.42 -
      (s > 0.75 ? Math.pow((s - 0.75) / 0.25, 2) * R * 0.1 * (0.5 + P.k[i]) : 0) +
      gauss() * 0.012;
    // Rayas de ramitas claras y oscuras: se ven desfilar al girar.
    const twigs = Math.round(4 + 21 * t.width);
    const streak = 1 - (0.2 + 0.36 * clamp(1 - t.width / 0.7)) * (0.5 - 0.5 * Math.cos(a * twigs + ti * 2.1 + u * 5));
    P.alb[i] =
      (0.2 + 0.8 * Math.pow(Math.min(1, s), 1.5)) *
      (0.4 + 0.6 * Math.pow(1 - u, 1.3)) *
      (u > 0.73 ? 0.28 : 1) * // la parte alta de cada piso queda a la sombra del de encima
      streak *
      (0.6 + rand() * 0.5) *
      (s > 0.85 ? 1.3 : 1) *
      L.tone;
    P.hj[i] = Math.round(gauss() * 13) + (rand() < 0.14 ? -26 : 0);
    P.frost[i] = s > 0.78 && u < 0.55 ? ((Math.pow(rand(), 1.4) * (s - 0.78)) / 0.26) * 1.3 * L.frost : rand() < 0.04 ? 0.4 : 0;
    P.tint[i] = s > 0.975 && u < 0.13 ? Math.min(1, (s - 0.975) / 0.04) * (0.45 + 0.55 * rand()) : 0;
    P.hue[i] = rainbowHue((a / TAU) * 2 + ti * 0.3);
  }

  for (let i = foliage; i < n; i++) {
    P.k[i] = rand();
    const ti = pickTier(), t = tiers[ti], a = rand() * TAU;
    const row = rand() < 0.87 ? 0 : 1; // fila arcoíris (87 %) o dorada
    // Tramos cortados: la tira no da la vuelta completa.
    if (hash3(Math.floor((a / TAU) * (9 + ti * 2)), ti, row + 2) < 0.24) {
      P.kind[i] = KIND.NONE;
      continue;
    }
    const R = rim(t, a);
    P.kind[i] = KIND.LIGHT;
    P.f[i] = t.base + 0.004 + row * 0.012;
    setAngle(i, a);
    P.r[i] = R * (0.99 - row * 0.02 + (rand() - 0.5) * 0.015);
    P.yo[i] =
      droop(t, ti, a) * R * 0.42 * (row ? 0.9 : 1) -
      R * 0.045 +
      (rand() - 0.5) * 0.006 +
      R * 0.04 * Math.sin(a * (5 + ti) + ti * 2 + row);
    P.hue[i] = row ? 46 : rainbowHue((a / TAU) * 2 + ti * 0.3);
  }

  // ── Bolas rojas ───────────────────────────────────────────────────────
  const baubles = [];
  tiers.forEach((t, ti) => {
    const count = Math.round(2 + 3.4 * t.width);
    for (let k = 0; k < count; k++) {
      const a = ((k + rand() * 0.6) / count) * TAU + ti, R = rim(t, a);
      baubles.push({ f: t.base + 0.01, a, r: R * 0.97, yo: droop(t, ti, a) * R * 0.42 + 0.03 });
    }
  });

  // Radio exterior medio a la altura f, suavizado (para el anillo de crecimiento y las luces guía).
  const envAt = (f) => {
    f = clamp(f, 0, 0.999);
    const t = tiers[tierOf(f)];
    return t.width * taper(t, (f - t.base) / t.height);
  };
  const envelope = (f) => (envAt(f - 0.03) + envAt(f - 0.015) + envAt(f) + envAt(f + 0.015)) / 4;

  return { tiers, points: P, baubles, envelope };
}
