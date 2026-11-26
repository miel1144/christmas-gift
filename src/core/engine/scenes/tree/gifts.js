import { easeBack, pickChar, span } from '../../../../utils/math';
import { T } from './timing';

/**
 * Regalos sobre el suelo, girando con el árbol.
 *
 * - Entrada: en la intro saltan uno a uno al final del paso 3; los que llegan
 *   después (en vivo) aparecen con el mismo salto en cuanto existen (`bornAt`).
 * - Abiertos: sin moño y con la tapa apagada.
 * - Para mí y sin abrir: un halo dorado que late encima.
 * - Mientras se arrastra (`dragging`): un halo fijo más fuerte.
 * - Guarda el rectángulo que ocupa cada caja en `boxes` para poder hacer clic.
 *
 * Caras de cara a la luz claras, las de espaldas muy oscuras; cinta y moño en su color.
 */
export function drawGifts(buf, { L, angle, t, s3, gifts, boxes }) {
  boxes.length = 0;
  if (!gifts.length) return;
  const { cx, rMax, floorRow, aspect, floorTilt } = L;
  const cr = Math.cos(angle), sr = Math.sin(angle);

  gifts.forEach((g, gi) => {
    const t0 = g.bornAt ?? null;
    let sc, pop;
    if (t0 !== null) {
      sc = easeBack(span(t, t0, t0 + 0.42));
      pop = 1 - span(t, t0, t0 + 0.5);
    } else {
      if (s3 < T.giftAt) return;
      const slot = T.giftAt + gi * T.giftGap;
      sc = easeBack(span(s3, slot, slot + 0.42));
      pop = 1 - span(s3, slot, slot + 0.5);
    }
    if (sc <= 0) return;

    const [bh, bs] = g.body, [rh, rs] = g.ribbon;
    const gx = g.rg * Math.sin(g.a), gz = g.rg * Math.cos(g.a);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, zMax = -Infinity;

    for (let j = 0; j < g.n; j++) {
      const isTop = g.top[j];
      if (g.opened && isTop && g.rib[j] && g.oy[j] > g.h + 0.01) continue; // sin moño
      const px = gx + g.ox[j] * sc, pz = gz + g.oz[j] * sc;
      const X = px * cr + pz * sr, Z = pz * cr - px * sr;
      const x = cx + X * rMax;
      const y = floorRow + Z * rMax * floorTilt - g.oy[j] * sc * rMax * aspect;
      const z = Z * rMax + (isTop ? 0.4 : 0);
      const nX = g.nx[j] * cr + g.nz[j] * sr, nZ = g.nz[j] * cr - g.nx[j] * sr;
      let b = (isTop ? 1 : 0.08 + Math.pow(Math.max(0, -0.69 * nX + 0.72 * nZ), 1.35)) * g.shade[j];
      if (g.opened && isTop) b *= 0.35; // tapa apagada: ya se abrió
      const k = g.k[j];
      const drawn = g.rib[j]
        ? buf.plot(x, y, z, isTop ? pickChar('#=#@', k) : '|', `hsl(${rh},${rs}%,${Math.round(26 + 56 * b)}%)`)
        : buf.plot(x, y, z, b > 0.6 ? pickChar('####@', k) : b > 0.35 ? pickChar('%%%%&', k) : pickChar('8888&', k),
            `hsl(${bh},${Math.round(bs - 14 * (1 - b))}%,${Math.round(7 + 52 * Math.pow(b, 0.9))}%)`);
      if (drawn) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (z > zMax) zMax = z;
      }
    }

    const X = gx * cr + gz * sr, Z = gz * cr - gx * sr;
    const topX = cx + X * rMax, topY = floorRow + Z * rMax * floorTilt - g.h * rMax * aspect - 1.5;
    if (pop > 0) buf.addGlow(topX, topY, 46, pop * 1.1, 6);
    if (g.dragging) buf.addGlow(topX, topY, 46, 0.9, 7);
    else if (g.mine) buf.addGlow(topX, topY, 46, 0.35 + 0.25 * Math.sin(t * 3 + gi), 5);
    if (g.id && x1 >= x0) boxes.push({ id: g.id, x0: x0 - 0.5, x1: x1 + 0.5, y0: y0 - 0.5, y1: y1 + 0.5, z: zMax });
  });
}

/** Regalo bajo la celda (col, row): el más cercano si se solapan. */
export function pickGift(boxes, col, row) {
  let best = null;
  for (const b of boxes) {
    if (col >= b.x0 && col <= b.x1 && row >= b.y0 && row <= b.y1 && (!best || b.z > best.z)) best = b;
  }
  return best?.id ?? null;
}
