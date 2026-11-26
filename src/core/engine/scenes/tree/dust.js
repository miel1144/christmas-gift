import { TAU, seeded, rainbowHue } from '../../../../utils/math';

/** Polvo de luz que sube en espiral alrededor del árbol (solo hasta la altura ya crecida). */
export function createDust(count = 170, seed = 17) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    f: rand(), a: rand() * TAU, r: 0.75 + rand() * 0.6, v: 0.01 + rand() * 0.02,
    w: 0.1 + rand() * 0.25, ph: rand() * TAU, hue: rainbowHue(rand()),
  }));
}

export function drawDust(buf, { L, t, F, dust }) {
  if (F <= 0.3) return;
  const { cx, rMax, yBase, treeRows, tilt } = L;
  for (const d of dust) {
    const f = (d.f + t * d.v) % 1;
    if (f > F) continue;
    const phi = d.a + t * d.w;
    const r = rMax * (1 - f * 0.85) * d.r * 0.9, z = r * Math.cos(phi);
    const tw = 0.5 + 0.5 * Math.sin(t * 2.5 + d.ph);
    if (tw < 0.35) continue;
    buf.plot(cx + r * Math.sin(phi), yBase - f * treeRows + z * tilt, z, tw > 0.85 ? '*' : tw > 0.6 ? '+' : '.',
      `hsla(${d.hue},80%,92%,${(tw * (z < 0 ? 0.4 : 0.95)).toFixed(2)})`);
  }
}
