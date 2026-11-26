import { clamp, easeBack } from '../../../../utils/math';
import { litAmount } from './timing';

/**
 * Bolas rojas: bloque 3×2 con un brillo arriba a la derecha.
 * Paso 2: cada una cae desde arriba cuando el árbol alcanza su altura, rebota y
 * se hincha un instante al asentarse. Paso 3: se encienden con la ola de luz.
 *
 * `born[i]` guarda el momento en que apareció la bola i (null = aún no).
 */
const CHARS = ['@@@', '@O@'];
const LIGHT = [[40, 46, 44], [34, 32, 24]];

export function drawBaubles(buf, { L, angle, t, F, wave, baubles, born }) {
  const { cx, rMax, yBase, treeRows, aspect, tilt } = L;
  baubles.forEach((bb, i) => {
    if (F - bb.f < 0.1) return;
    if (born[i] === null) born[i] = t;
    const age = clamp((t - born[i]) / 0.4);
    const fall = (1 - easeBack(age)) * 3.2;
    const puff = age > 0.5 && age < 0.85;

    const phi = bb.a + angle, r = bb.r * rMax, z = r * Math.cos(phi);
    if (z < -2) return; // las de atrás quedan tapadas
    const x = Math.floor(cx + r * Math.sin(phi));
    const y = Math.floor(yBase - bb.f * treeRows + bb.yo * rMax * aspect + z * tilt - fall);
    if (z + 7 < buf.depthAt(x, y)) return;

    const on = clamp((litAmount(wave, bb.f, 0.5) - 0.2) / 0.06);
    const sh = 0.65 + 0.35 * (0.6 + 0.4 * Math.cos(phi + 0.9));
    const red = (l) => `hsl(354,${Math.round(74 + 18 * on)}%,${Math.round((l + 8 * on) * sh)}%)`;
    if (puff) {
      for (let c = -1; c <= 3; c++) buf.plot(x - 1 + c, y, z + 6.9, '@', red(42));
      for (let c = 0; c < 3; c++) {
        buf.plot(x - 1 + c, y - 1, z + 6.9, '@', red(46));
        buf.plot(x - 1 + c, y + 1, z + 6.9, '@', red(30));
      }
    }
    for (let r2 = 0; r2 < 2; r2++)
      for (let c = 0; c < 3; c++) buf.plot(x - 1 + c, y + r2, z + 7, CHARS[r2][c], red(LIGHT[r2][c]));
    buf.plot(x + 1, y, z + 7.1, '*', `hsl(354,${Math.round(45 - 20 * on)}%,${Math.round(78 + 14 * on)}%)`);
  });
}
