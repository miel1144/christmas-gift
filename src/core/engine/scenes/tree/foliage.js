import { KIND } from '../../../geometry/tree';
import { clamp, ease, hash3, pickChar, isWarm, amber } from '../../../../utils/math';
import { litAmount } from './timing';

/**
 * Árbol y luces: un carácter por punto; en cada celda gana el más cercano.
 *
 * Paso 2: solo se dibujan los puntos por debajo de la altura alcanzada (F); las
 * ramas recién nacidas salen del tronco hacia fuera, empiezan en verde oscuro con
 * `#` y en ~1 s toman su color final (escarcha incluida).
 * Paso 3: las luces están apagadas hasta que la ola de luz pasa por su altura.
 */

// Luz desde la izquierda, un poco por delante.
const LX = -0.82, LZ = 0.15;

// Un carácter dominante por banda de brillo: el árbol se lee como volumen, no como ruido.
const BANDS = [
  [0.2, '8888&'],
  [0.34, '&&&8%'],
  [0.52, '%%%&#'],
  [0.74, '###%@'],
  [Infinity, '@@@#8'],
];
const bandChars = (b) => {
  for (const [lim, s] of BANDS) if (b < lim) return s;
  return BANDS[BANDS.length - 1][1];
};

/** Verde de oscuro a claro; la escarcha lo lleva a blanco cálido solo donde le da la luz. */
function foliageColor(b, hj, frost) {
  const f2 = clamp((frost - 0.28) * 1.25) * clamp((b - 0.42) / 0.36);
  const L = 4 + 66 * Math.pow(b, 1.08);
  const S = 72 - 22 * b;
  const H = 150 + hj - 6 * b;
  return `hsl(${Math.round(H * (1 - f2) + 46 * f2)},${Math.round(S * (1 - 0.8 * f2) + 4 * f2)}%,${Math.round(L + (97 - L) * f2)}%)`;
}

/** Buffers por celda que necesita drawFoliage (se crean al cambiar el tamaño). */
export function createCellBuffers(n) {
  return {
    z: new Float32Array(n), b: new Float32Array(n), k: new Float32Array(n), fr: new Float32Array(n),
    tint: new Float32Array(n), lit: new Float32Array(n), hue: new Int16Array(n), hj: new Int8Array(n),
    kind: new Uint8Array(n), fresh: new Uint8Array(n),
  };
}

export function drawFoliage(buf, { L, angle, t, F, settle, wave, points: P, cell: C }) {
  if (F <= 0) return;
  const { cols, rows, cx, rMax, yBase, treeRows, aspect, tilt } = L;
  const cr = Math.cos(angle), sr = Math.sin(angle);
  const growing = F < 1.1;
  C.z.fill(-1e9);

  for (let i = 0; i < P.n; i++) {
    const kind = P.kind[i];
    if (kind === KIND.NONE) continue;
    const f = P.f[i], lag = F - f;
    if (lag < 0) continue;
    const gr = lag >= 0.12 ? 1 : 0.25 + 0.75 * ease(lag / 0.12); // las ramas se estiran al nacer
    const sn = P.sa[i] * cr + P.ca[i] * sr; // sin(a + angle)
    const cs = P.ca[i] * cr - P.sa[i] * sr; // cos(a + angle)
    const r = P.r[i] * rMax * gr, z = r * cs;
    const x = Math.floor(cx + r * sn);
    const y = Math.floor(yBase - f * treeRows + P.yo[i] * rMax * aspect * gr + z * tilt);
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const k = y * cols + x;

    if (kind === KIND.LIGHT) {
      if (lag < 0.08 || z + 2 < C.z[k]) continue; // las luces van un poco por delante de su rama
      C.z[k] = z + 2;
      C.kind[k] = KIND.LIGHT;
      C.hue[k] = P.hue[i];
      C.k[k] = P.k[i];
      C.lit[k] = litAmount(wave, f, P.k[i]);
      continue;
    }
    if (z < C.z[k]) continue;
    const dot = (sn * 0.85 * LX + 0.05 + cs * 0.85 * LZ) / 0.8;
    const diff = Math.pow(Math.max(0, (dot + 0.55) / 1.55), 2); // la luz rodea un poco el terminador
    const b = Math.min(1, P.alb[i] * (0.04 + 0.2 * clamp((dot + 1) / 2) + 1.5 * diff));
    // Recién nacidas: verde más oscuro, sin escarcha; luego pasan a su color final.
    const fresh = 1 - clamp((lag + settle - 0.06) / 0.26);
    const flash = lag < 0.04 && growing ? (1 - lag / 0.04) * 0.3 : 0;
    const bg = b - fresh * Math.max(0, b - 0.44) * 0.85;
    C.z[k] = z;
    C.kind[k] = KIND.FOLIAGE;
    C.k[k] = P.k[i];
    C.hj[k] = P.hj[i];
    C.fr[k] = P.frost[i] * (1 - fresh);
    C.b[k] = bg + (1 - bg) * flash;
    C.fresh[k] = lag < 0.075 && growing ? 1 : 0;
    C.tint[k] = P.tint[i] > 0 && litAmount(wave, f, P.k[i]) > 0 ? P.tint[i] : 0;
    C.hue[k] = P.hue[i];
  }

  const sparkTick = Math.floor(t * 5);
  for (let k = 0; k < C.z.length; k++) {
    if (C.z[k] < -1e8) continue;
    const x = k % cols, y = (k / cols) | 0, kk = C.k[k];

    if (C.kind[k] === KIND.LIGHT) {
      const h = C.hue[k], warm = isWarm(h), lit = C.lit[k];
      const tw = 0.55 + 0.45 * Math.sin(t * 3.1 + kk * 97);
      if (lit <= 0) {
        // Apagada: se ve la bombilla, sin brillo.
        buf.plot(x, y, C.z[k], pickChar('o*o@', kk * 7), `hsl(${amber(h)},45%,${Math.round(30 + 6 * tw)}%)`);
        continue;
      }
      const hit = lit < 0.16 ? 1 - lit / 0.16 : 0; // destello al encenderse
      if (warm && (kk * 13) % 1 < 0.14) {
        buf.plot(x, y, C.z[k], '*', `hsl(50,100%,${Math.round(66 + 10 * tw)}%)`); // destellos dorados sueltos
        continue;
      }
      const light = Math.round(Math.min(92, 55 + 9 * tw + hit * 30 - (warm ? 6 : 0)));
      buf.plot(x, y, C.z[k], hit > 0.4 ? '@' : pickChar('@o*0', kk * 7), `hsl(${amber(h)},${warm ? 66 : 100}%,${light}%)`);
      continue;
    }

    const b = C.b[k];
    if (!C.fresh[k] && hash3(x, y, sparkTick) < 0.004) {
      buf.plot(x, y, C.z[k], '*', '#ffffff'); // chispa blanca ocasional
      continue;
    }
    let color;
    if (C.tint[k] > 0.42) {
      const h = C.hue[k], warm = isWarm(h);
      color = `hsl(${amber(h)},${warm ? 66 : Math.round(74 + 22 * C.tint[k])}%,${Math.round(47 + 17 * b - (warm ? 6 : 0))}%)`;
    } else {
      color = foliageColor(b, C.hj[k], C.fr[k]);
    }
    buf.plot(x, y, C.z[k], C.fresh[k] ? '#' : pickChar(bandChars(b), kk), color);
  }
}
