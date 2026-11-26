import { easeBack, pickChar, span } from '../../../../utils/math';
import { T } from './timing';

/**
 * Paso 3, al final: los regalos saltan uno a uno sobre el suelo (crecen con un
 * pequeño rebote) y giran con el árbol. Caras de cara a la luz claras, las de
 * espaldas muy oscuras; la cinta y el moño en su propio color.
 */
export function drawGifts(buf, { L, angle, s3, gifts }) {
  if (s3 < T.giftAt || !gifts.length) return;
  const { cx, rMax, floorRow, aspect, floorTilt } = L;
  const cr = Math.cos(angle), sr = Math.sin(angle);

  gifts.forEach((g, gi) => {
    const t0 = T.giftAt + gi * T.giftGap;
    const sc = easeBack(span(s3, t0, t0 + 0.42));
    if (sc <= 0) return;
    const [bh, bs] = g.body, [rh, rs] = g.ribbon;
    const gx = g.rg * Math.sin(g.a), gz = g.rg * Math.cos(g.a);

    for (let j = 0; j < g.n; j++) {
      const px = gx + g.ox[j] * sc, pz = gz + g.oz[j] * sc;
      const X = px * cr + pz * sr, Z = pz * cr - px * sr;
      const x = cx + X * rMax;
      const y = floorRow + Z * rMax * floorTilt - g.oy[j] * sc * rMax * aspect;
      const z = Z * rMax + (g.top[j] ? 0.4 : 0);
      const nX = g.nx[j] * cr + g.nz[j] * sr, nZ = g.nz[j] * cr - g.nx[j] * sr;
      const b = (g.top[j] ? 1 : 0.08 + Math.pow(Math.max(0, -0.69 * nX + 0.72 * nZ), 1.35)) * g.shade[j];
      const k = g.k[j];
      if (g.rib[j]) {
        buf.plot(x, y, z, g.top[j] ? pickChar('#=#@', k) : '|', `hsl(${rh},${rs}%,${Math.round(26 + 56 * b)}%)`);
      } else {
        const ch = b > 0.6 ? pickChar('####@', k) : b > 0.35 ? pickChar('%%%%&', k) : pickChar('8888&', k);
        buf.plot(x, y, z, ch, `hsl(${bh},${Math.round(bs - 14 * (1 - b))}%,${Math.round(7 + 52 * Math.pow(b, 0.9))}%)`);
      }
    }
    const pop = 1 - span(s3, t0, t0 + 0.5);
    if (pop > 0) {
      const X = gx * cr + gz * sr, Z = gz * cr - gx * sr;
      buf.addGlow(cx + X * rMax, floorRow + Z * rMax * floorTilt - 2, 46, pop * 1.1, 6);
    }
  });
}
