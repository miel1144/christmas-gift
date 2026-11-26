import { buildGifts } from '../../geometry/gifts';
import { createSnow, drawSnow } from '../../physics/snow';
import { clamp, easeBack, pickChar, span } from '../../../utils/math';

/**
 * Fondo del login: nieve y regalos alrededor del formulario.
 *
 * - Pantalla ancha: a la izquierda 2 cajas en fila; a la derecha 3 apiladas en
 *   triángulo (dos abajo, una encima). Se apoyan a la altura del final del formulario.
 * - Pantalla estrecha: 3 cajas en fila encima del formulario.
 *
 * La posición del formulario llega en `grid.anchor` (píxeles), así los regalos
 * siguen al formulario aunque cambie de tamaño.
 */
const LEFT = [
  { size: 'l', body: [356, 88], ribbon: [46, 100] },
  { size: 'm', body: [152, 78], ribbon: [46, 100] },
];
const RIGHT = [
  { size: 'm', body: [222, 84], ribbon: [46, 100] },
  { size: 'm', body: [326, 84], ribbon: [50, 100] },
  { size: 's', body: [42, 96], ribbon: [356, 88] },
];
const NARROW = [
  { size: 'm', body: [356, 88], ribbon: [46, 100] },
  { size: 'l', body: [42, 96], ribbon: [356, 88] },
  { size: 'm', body: [222, 84], ribbon: [46, 100] },
];
// Medidas (ancho, alto) en las mismas unidades que core/geometry/gifts.js.
const DIM = { s: [0.18, 0.15], m: [0.26, 0.22], l: [0.34, 0.31] };
const GAP = 0.04;
const SIDE_MIN_PX = 200; // espacio libre que hace falta a cada lado del formulario

export function createLoginScene() {
  let flakes = createSnow();
  let placed = []; // { g, x, y, scale } en celdas
  let U = 40, aspect = 0.6;

  const make = (specs, density) => buildGifts(specs, 9, { density });

  return {
    layout(grid) {
      flakes = createSnow(Math.round((230 * grid.cols) / grid.panelCols));
      aspect = grid.aspect;
      placed = [];
      const a = grid.anchor;
      if (!a) return;
      const toCol = (px) => (px - grid.originX) / grid.cellW;
      const toRow = (py) => py / grid.cellH;
      const free = (grid.width - a.w) / 2;
      const wide = free >= SIDE_MIN_PX;

      // Tamaño de las cajas: una 'm' mide ~80 px de ancho (≈60 px en móvil).
      const boxPx = wide ? Math.min(84, free * 0.3) : 60;
      U = boxPx / grid.cellW / DIM.m[0];
      const density = Math.max(1, (U / 40) ** 2);

      if (wide) {
        const base = toRow(a.y + a.h - 8);
        // Izquierda: fila de 2, pegada al formulario.
        const left = make(LEFT, density);
        const rowW = LEFT.reduce((s, x) => s + DIM[x.size][0], 0) + GAP * (LEFT.length - 1);
        let x = toCol(a.x - 36) - rowW * U;
        left.forEach((g, i) => {
          const w = DIM[LEFT[i].size][0];
          placed.push({ g, x: x + (w / 2) * U, y: base, delay: i });
          x += (w + GAP) * U;
        });
        // Derecha: triángulo (dos abajo, una encima, centrada).
        const right = make(RIGHT, density);
        const [w0] = DIM.m;
        const cx = toCol(a.x + a.w + 36) + (w0 + GAP / 2) * U;
        placed.push({ g: right[0], x: cx - (w0 / 2 + GAP / 2) * U, y: base, delay: 2 });
        placed.push({ g: right[1], x: cx + (w0 / 2 + GAP / 2) * U, y: base, delay: 3 });
        placed.push({ g: right[2], x: cx, y: base - DIM.m[1] * U * aspect, delay: 4 });
      } else {
        const base = toRow(a.y - 14);
        const row = make(NARROW, density);
        const rowW = NARROW.reduce((s, x) => s + DIM[x.size][0], 0) + GAP * (NARROW.length - 1);
        let x = toCol(a.x + a.w / 2) - (rowW / 2) * U;
        row.forEach((g, i) => {
          const w = DIM[NARROW[i].size][0];
          placed.push({ g, x: x + (w / 2) * U, y: base, delay: i });
          x += (w + GAP) * U;
        });
      }
    },

    render(buf, dt, t) {
      drawSnow(buf, flakes, t);
      const tilt = 0.28 * aspect;
      for (const p of placed) {
        const t0 = 0.3 + p.delay * 0.18;
        const sc = easeBack(span(t, t0, t0 + 0.45));
        if (sc <= 0) continue;
        const yaw = 0.12 * Math.sin(t * 0.35 + p.delay * 1.3); // se mecen muy poco (el montón debe leerse estable)
        drawBox(buf, p.g, p.x, p.y, U * sc, aspect, tilt, yaw);
        const glow = 1 - span(t, t0, t0 + 0.6);
        if (glow > 0) buf.addGlow(p.x, p.y - p.g.h * U * aspect, 46, glow, 6);
      }
    },
  };
}

/** Caja en pantalla: base centrada en (x, y) celdas; luz desde la izquierda y delante. */
function drawBox(buf, g, x0, y0, U, aspect, tilt, yaw) {
  const cr = Math.cos(yaw), sr = Math.sin(yaw);
  const [bh, bs] = g.body, [rh, rs] = g.ribbon;
  for (let j = 0; j < g.n; j++) {
    const X = g.ox[j] * cr + g.oz[j] * sr, Z = g.oz[j] * cr - g.ox[j] * sr;
    const x = x0 + X * U;
    const y = y0 - g.oy[j] * U * aspect + Z * U * tilt;
    const top = g.top[j];
    const z = 100 + Z * U + (top ? 0.4 : 0) - y0 * 0.01; // las de arriba del montón, detrás de las de abajo
    const nX = g.nx[j] * cr + g.nz[j] * sr, nZ = g.nz[j] * cr - g.nx[j] * sr;
    const b = clamp((top ? 1 : 0.08 + Math.pow(Math.max(0, -0.69 * nX + 0.72 * nZ), 1.35)) * g.shade[j]);
    const k = g.k[j];
    if (g.rib[j]) buf.plot(x, y, z, top ? pickChar('#=#@', k) : '|', `hsl(${rh},${rs}%,${Math.round(26 + 56 * b)}%)`);
    else
      buf.plot(x, y, z, b > 0.6 ? pickChar('####@', k) : b > 0.35 ? pickChar('%%%%&', k) : pickChar('8888&', k),
        `hsl(${bh},${Math.round(bs - 14 * (1 - b))}%,${Math.round(7 + 52 * Math.pow(b, 0.9))}%)`);
  }
}
