import { clamp, hash3, pickChar, span } from '../../../../utils/math';
import { T } from './timing';

/**
 * Tronco: cilindro oscuro que sube fila a fila desde el suelo hasta debajo de
 * las ramas. Mientras crece, las dos filas de arriba van un tono más claras.
 */
export function drawTrunk(buf, { L, s2 }) {
  const grown = span(s2, T.trunk[0], T.trunk[1]);
  if (grown <= 0) return;
  const { cx, yBase, floorRow } = L;
  const top = yBase + 1 + (floorRow - yBase - 1) * 0.5;
  const n = Math.ceil(floorRow - top);
  const shown = Math.floor(grown * (n + 2));

  for (let r = 0; r < Math.min(shown, n); r++) {
    const y = Math.floor(floorRow) - 1 - r;
    const w = 3.3 + 1.7 * Math.pow(1 - r / n, 3); // se ensancha en la base
    const lead = grown < 1 ? clamp(1 - (shown - 1 - r) / 2.2) : 0;
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w - 1); x++) {
      const e = (x + 0.5 - cx) / w;
      const sh = Math.pow(Math.max(0, Math.cos((e + 0.22) * 1.28)), 1.25); // más claro un poco a la izquierda
      const ch = lead > 0.3 ? '#' : pickChar('#8#%@#8#', hash3(x, y, 3));
      const light = Math.round(2 + 13 * sh + lead * (8 + 8 * sh));
      buf.plot(x, y, -5, ch, `hsl(${Math.round(20 + 4 * lead)},${Math.round(46 - 6 * lead)}%,${light}%)`);
    }
  }
}
