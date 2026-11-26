import { TAU, seeded } from '../../utils/math';

/**
 * Cajas de regalo como nubes de puntos 3D: cuatro caras, tapa, cinta en cruz y
 * moño. Se colocan en círculo alrededor del tronco, sobre el suelo.
 *
 * Unidades: múltiplos de rMax. y hacia arriba desde el suelo.
 *
 * spec: { size: 's'|'m'|'l'|'flat'|'tall', body: [tono, saturación], ribbon: [tono, saturación] }
 */
const SIZES = {
  s: [0.18, 0.18, 0.15],
  m: [0.26, 0.23, 0.22],
  l: [0.34, 0.34, 0.31],
  flat: [0.42, 0.27, 0.14],
  tall: [0.19, 0.19, 0.42],
};

export function buildGifts(specs = [], seed = 5) {
  const rand = seeded(seed);
  const n = specs.length;

  return specs.map((spec, gi) => {
    const [w, d, h] = SIZES[spec.size] ?? SIZES.m;
    const a = ((gi + 0.5) / n) * TAU + (rand() - 0.5) * 0.4;
    const rg = 0.88 + (gi % 2) * 0.16 + rand() * 0.04; // alternan más cerca y más lejos
    const yaw = rand() * 1.6;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);

    const aTop = w * d, aX = d * h, aZ = w * h, total = aTop + 2 * aX + 2 * aZ;
    const N = Math.round(900 + 9000 * total);
    const BOW = 90;
    const rw = 0.15 * Math.min(w, d); // medio ancho de la cinta
    const g = {
      a, rg,
      body: spec.body ?? [356, 88],
      ribbon: spec.ribbon ?? [46, 100],
      n: N,
      ox: new Float32Array(N), oy: new Float32Array(N), oz: new Float32Array(N),
      nx: new Float32Array(N), nz: new Float32Array(N),
      top: new Uint8Array(N), rib: new Uint8Array(N), k: new Float32Array(N), shade: new Float32Array(N),
    };

    for (let j = 0; j < N; j++) {
      let lx, ly, lz, nx = 0, nz = 0, top = 0, rib = 0, shade = 1;
      if (j < BOW) {
        // Moño: dos lazos a los lados del centro de la tapa.
        const th = rand() * TAU, rr = Math.sqrt(rand()) * w * 0.26, side = rand() < 0.5 ? -1 : 1;
        lx = side * (w * 0.16 + rr * Math.cos(th) * 0.7);
        lz = rr * Math.sin(th) * 0.6;
        ly = h + 0.015 + Math.abs(rr * Math.cos(th)) * 0.5 + rand() * 0.02;
        top = 1;
        rib = 1;
      } else {
        const q = rand() * total;
        if (q < aTop) {
          lx = (rand() - 0.5) * w; lz = (rand() - 0.5) * d; ly = h; top = 1;
          rib = Math.abs(lx) < rw || Math.abs(lz) < rw ? 1 : 0;
        } else if (q < aTop + 2 * aX) {
          const sd = rand() < 0.5 ? -1 : 1;
          lx = (sd * w) / 2; lz = (rand() - 0.5) * d; ly = rand() * h; nx = sd;
          rib = Math.abs(lz) < rw ? 1 : 0;
        } else {
          const sd = rand() < 0.5 ? -1 : 1;
          lz = (sd * d) / 2; lx = (rand() - 0.5) * w; ly = rand() * h; nz = sd;
          rib = Math.abs(lx) < rw ? 1 : 0;
        }
        if (!top && ly > h * 0.74 && ly < h * 0.8) shade = 0.6; // ranura de la tapa
      }
      g.ox[j] = lx * cy + lz * sy;
      g.oz[j] = -lx * sy + lz * cy;
      g.oy[j] = ly;
      g.nx[j] = nx * cy + nz * sy;
      g.nz[j] = -nx * sy + nz * cy;
      g.top[j] = top;
      g.rib[j] = rib;
      g.k[j] = rand();
      g.shade[j] = shade;
    }
    return g;
  });
}
