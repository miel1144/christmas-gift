import { clamp, hash3 } from '../../../../utils/math';
import { T, waveProgress } from './timing';

/**
 * Paso 3: dos luces guía bajan en espiral desde la punta hasta el suelo,
 * encendiendo las tiras a su paso (eso lo decide litAmount en foliage.js).
 * Cada una tiene una cabeza de color con cuatro rayos cortos y una estela que
 * sigue la espiral (# → * → + → .) y al final se deshace y cae.
 */
const TURNS = 4;
const TAIL = 110;

export function drawLightWave(buf, { L, t, s3, envelope }) {
  const wv = waveProgress(s3);
  if (wv <= 0 || s3 > T.wave + 0.05) return;
  const { cx, rMax, yBase, treeRows, aspect, tilt, floorRow } = L;
  const tail = clamp(1 - (wv - 0.9) / 0.1); // la estela se recoge antes de tocar el suelo

  for (let hd = 0; hd < 2; hd++) {
    for (let j = 0; j < TAIL; j++) {
      const w2 = wv - j * 0.0032;
      if (w2 <= 0) continue;
      const age = j / TAIL, f = 1 - w2 * 1.25;
      if (f < -0.1) continue;
      const phi = 0.6 + w2 * TURNS * Math.PI * 2 + hd * Math.PI;
      const h1 = hash3(j, hd, 3), h2 = hash3(j, hd, 8);
      const loose = Math.max(0, (age - 0.42) / 0.58); // el primer 42 % va pegado a la espiral
      const env = envelope(Math.max(0, f));
      const r = (env * 1.1 + 0.05 + loose * (0.05 + 0.25 * h1)) * rMax, z = r * Math.cos(phi);
      const x = cx + r * Math.sin(phi) + (h2 - 0.5) * loose * 6;
      const y = yBase - Math.max(-0.05, f) * treeRows + z * tilt + env * rMax * aspect * 0.2 + loose * loose * (3 + 10 * h1) + (h1 - 0.5) * loose * 3;
      const hue = Math.round((t * 150 + hd * 180 - j * 3.4 + 720) % 360);

      if (j === 0) {
        // Cabeza: un racimo de '@' de color con el centro blanco y rayos que parpadean.
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -3; dx <= 3; dx++)
            if (Math.abs(dx) + Math.abs(dy) * 2 < 3.6)
              buf.plot(x + dx, y + dy, z + 3.5, '@', dx === 0 && dy === 0 ? '#ffffff' : `hsla(${hue},100%,${70 - 3 * Math.abs(dx)}%,${tail.toFixed(2)})`);
        const tw = 0.6 + 0.4 * Math.sin(t * 16 + hd * 2);
        for (let d = 1; d <= 5; d++) {
          const c = `hsla(${hue},100%,74%,${((1 - d / 6) * tail * tw).toFixed(2)})`;
          buf.plot(x + 3 + d, y, z + 3.4, '-', c);
          buf.plot(x - 3 - d, y, z + 3.4, '-', c);
          if (d <= 3) {
            buf.plot(x, y - 1 - d, z + 3.4, '|', c);
            buf.plot(x, y + 1 + d, z + 3.4, '|', c);
          }
        }
        buf.addGlow(x, y, hue, 1.3 * tail, 6.5);
        continue;
      }
      const a = (1 - 0.85 * age) * tail * (z < 0 ? 0.5 : 1);
      const ch = age < 0.14 ? '#' : age < 0.42 ? '*' : age < 0.75 ? '+' : '.';
      buf.plot(x, y, z + 2.5, ch, `hsla(${hue},100%,${Math.round(age < 0.42 ? 66 : 82 - age * 8)}%,${(a * 0.9).toFixed(2)})`);
      if (age < 0.2) buf.plot(x, y + (j % 2 ? 1 : -1), z + 2.4, '#', `hsla(${hue},100%,62%,${(a * 0.75).toFixed(2)})`);
    }
  }
  // Cuando llegan abajo, el suelo se ilumina un momento.
  if (wv > 0.92) buf.addGlow(cx, floorRow, 46, 0.9 * tail * clamp((wv - 0.92) / 0.08), L.panelCols * 0.28);
}
