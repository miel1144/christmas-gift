import { buildTree, KIND } from '../../geometry/tree';
import { stageLayout } from '../../geometry/layout';
import { createSnow, drawSnow } from '../../physics/snow';
import { TAU, clamp, hash3, pickChar, rainbowHue, isWarm, amber, seeded } from '../../../utils/math';

/**
 * Escena del árbol completo (sin intro): mandala dorado que gira en el suelo,
 * tronco oscuro, abeto escarchado con tiras de luces y bolas rojas, polvo de luz
 * que sube en espiral, estrella con rayos y nieve de fondo.
 *
 * Profundidades (mayor = delante): nieve −900 · mandala −500 · tronco −5 ·
 * árbol ±rMax · bolas +7 · estrella 70.
 */

// Luz desde la izquierda, un poco por delante: la escarcha blanca queda a la
// izquierda, el centro verde y la derecha en sombra.
const LX = -0.82, LZ = 0.15;

// Un carácter dominante por banda de brillo: las celdas vecinas casi siempre
// comparten glifo y el árbol se lee como volumen, no como ruido.
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

export function createTreeScene() {
  const { points: P, baubles } = buildTree();
  const rand = seeded(17);
  const dust = Array.from({ length: 170 }, () => ({
    f: rand(), a: rand() * TAU, r: 0.75 + rand() * 0.6, v: 0.01 + rand() * 0.02,
    w: 0.1 + rand() * 0.25, ph: rand() * TAU, hue: rainbowHue(rand()),
  }));

  let L = null; // disposición actual (cambia al redimensionar)
  let cell = null; // buffers por celda para resolver el árbol
  let flakes = createSnow();
  let angle = 0;
  let spin = 0; // giro extra por arrastre, decae solo

  // ── Suelo: mandala dorado que gira con el árbol ─────────────────────────
  function drawMandala(buf, t) {
    const { cx, floorRow, panelCols, aspect, cols, rows } = L;
    const Rs = panelCols * 0.8, Rb = Rs * aspect * 0.28;
    const wave = (t * 0.38) % 1.25; // onda de luz que sale del tronco
    const x0 = Math.max(0, Math.floor(cx - Rs)), x1 = Math.min(cols - 1, Math.ceil(cx + Rs));
    const y0 = Math.max(0, Math.floor(floorRow - Rb)), y1 = Math.min(rows - 1, Math.ceil(floorRow + Rb));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ex = (x + 0.5 - cx) / Rs, ey = (y + 0.5 - floorRow) / Rb;
        const rho = Math.hypot(ex, ey);
        if (rho > 1) continue;
        const lam = Math.atan2(ex, ey) - angle; // ángulo sobre el disco, gira con el árbol
        // De fuera hacia dentro: doble borde · pétalos en arco · anillo · copo de 8 brazos · anillo interior.
        const border = rho > 0.955 || (rho > 0.9 && rho < 0.925);
        const petal = rho > 0.68 && rho < 0.9 && rho < 0.7 + 0.2 * Math.pow(Math.abs(Math.cos(lam * 8)), 0.7) && rho > 0.88 - 0.2 * Math.pow(Math.abs(Math.cos(lam * 8)), 3);
        const ring = (rho > 0.62 && rho < 0.668) || (rho > 0.3 && rho < 0.345);
        const s4 = Math.abs(Math.sin(lam * 4));
        const spoke = rho >= 0.345 && rho <= 0.62 && (s4 < 0.05 / rho || (rho > 0.47 && rho < 0.56 && s4 < 0.2 - Math.abs(rho - 0.515) * 3));
        const mark = border || petal || ring || spoke;
        if (hash3(x, y, 5) > (mark ? 0.94 : 0.72)) continue; // el fondo queda relleno al 70 %
        const sweep = Math.pow(Math.max(0, Math.cos(Math.atan2(ey, ex) - t * 1.15)), 14);
        const pulse = Math.exp(-Math.pow((rho - wave) * 9, 2));
        const lift = 0.5 * Math.max(sweep, pulse);
        const ch = border || spoke ? '#' : ring ? '=' : petal ? '+' : '-';
        const light = Math.round((mark ? 56 : 28) + 14 * lift);
        buf.plot(x, y, -500, ch, `hsla(46,${mark ? 34 : 16}%,${light}%,${mark ? 1 : 0.7})`);
      }
    }
  }

  // ── Tronco: cilindro oscuro bajo las ramas ──────────────────────────────
  function drawTrunk(buf) {
    const { cx, yBase, floorRow } = L;
    const top = yBase + 1 + (floorRow - yBase - 1) * 0.5;
    const n = Math.ceil(floorRow - top);
    for (let r = 0; r < n; r++) {
      const y = Math.floor(floorRow) - 1 - r;
      const w = 3.3 + 1.7 * Math.pow(1 - r / n, 3); // se ensancha en la base
      for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w - 1); x++) {
        const e = (x + 0.5 - cx) / w;
        const sh = Math.pow(Math.max(0, Math.cos((e + 0.22) * 1.28)), 1.25); // más claro un poco a la izquierda
        buf.plot(x, y, -5, pickChar('#8#%@#8#', hash3(x, y, 3)), `hsl(20,46%,${Math.round(2 + 13 * sh)}%)`);
      }
    }
  }

  // ── Árbol: un carácter por punto; en cada celda gana el más cercano ─────
  function drawTree(buf, t) {
    const { cols, rows, cx, rMax, yBase, treeRows, aspect, tilt } = L;
    const cr = Math.cos(angle), sr = Math.sin(angle);
    const C = cell;
    C.z.fill(-1e9);

    for (let i = 0; i < P.n; i++) {
      const kind = P.kind[i];
      if (kind === KIND.NONE) continue;
      const sn = P.sa[i] * cr + P.ca[i] * sr; // sin(a + angle)
      const cs = P.ca[i] * cr - P.sa[i] * sr; // cos(a + angle)
      const r = P.r[i] * rMax, z = r * cs;
      const x = Math.floor(cx + r * sn);
      const y = Math.floor(yBase - P.f[i] * treeRows + P.yo[i] * rMax * aspect + z * tilt);
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const k = y * cols + x;

      if (kind === KIND.LIGHT) {
        if (z + 2 < C.z[k]) continue; // las luces van un poco por delante de su rama
        C.z[k] = z + 2;
        C.kind[k] = KIND.LIGHT;
        C.hue[k] = P.hue[i];
        C.k[k] = P.k[i];
        continue;
      }
      if (z < C.z[k]) continue;
      const dot = (sn * 0.85 * LX + 0.05 + cs * 0.85 * LZ) / 0.8;
      const diff = Math.pow(Math.max(0, (dot + 0.55) / 1.55), 2); // la luz rodea un poco el terminador
      C.z[k] = z;
      C.kind[k] = KIND.FOLIAGE;
      C.k[k] = P.k[i];
      C.hj[k] = P.hj[i];
      C.fr[k] = P.frost[i];
      C.tint[k] = P.tint[i];
      C.hue[k] = P.hue[i];
      C.b[k] = Math.min(1, P.alb[i] * (0.04 + 0.2 * clamp((dot + 1) / 2) + 1.5 * diff));
    }

    const sparkTick = Math.floor(t * 5);
    for (let k = 0; k < C.z.length; k++) {
      if (C.z[k] < -1e8) continue;
      const x = k % cols, y = (k / cols) | 0, kk = C.k[k];
      if (C.kind[k] === KIND.LIGHT) {
        const h = C.hue[k], warm = isWarm(h);
        const tw = 0.55 + 0.45 * Math.sin(t * 3.1 + kk * 97);
        if (warm && (kk * 13) % 1 < 0.14) {
          buf.plot(x, y, C.z[k], '*', `hsl(50,100%,${Math.round(66 + 10 * tw)}%)`); // destellos dorados sueltos
          continue;
        }
        buf.plot(x, y, C.z[k], pickChar('@o*0', kk * 7), `hsl(${amber(h)},${warm ? 66 : 100}%,${Math.round(Math.min(92, 55 + 9 * tw - (warm ? 6 : 0)))}%)`);
        continue;
      }
      const b = C.b[k];
      if (hash3(x, y, sparkTick) < 0.004) {
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
      buf.plot(x, y, C.z[k], pickChar(bandChars(b), kk), color);
    }
  }

  // ── Bolas rojas: bloque 3×2 con brillo arriba a la derecha ──────────────
  function drawBaubles(buf) {
    const { cx, rMax, yBase, treeRows, aspect, tilt } = L;
    const BC = ['@@@', '@O@'];
    const BL = [[40, 46, 44], [34, 32, 24]];
    for (const bb of baubles) {
      const phi = bb.a + angle, r = bb.r * rMax, z = r * Math.cos(phi);
      if (z < -2) continue; // las de atrás quedan tapadas
      const x = Math.floor(cx + r * Math.sin(phi));
      const y = Math.floor(yBase - bb.f * treeRows + bb.yo * rMax * aspect + z * tilt);
      if (z + 7 < buf.depthAt(x, y)) continue;
      const sh = 0.65 + 0.35 * (0.6 + 0.4 * Math.cos(phi + 0.9));
      for (let r2 = 0; r2 < 2; r2++)
        for (let c2 = 0; c2 < 3; c2++)
          buf.plot(x - 1 + c2, y + r2, z + 7, BC[r2][c2], `hsl(354,92%,${Math.round((BL[r2][c2] + 8) * sh)}%)`);
      buf.plot(x + 1, y, z + 7.1, '*', 'hsl(354,25%,92%)');
    }
  }

  // ── Polvo de luz que sube en espiral alrededor del árbol ────────────────
  function drawDust(buf, t) {
    const { cx, rMax, yBase, treeRows, tilt } = L;
    for (const d of dust) {
      const f = (d.f + t * d.v) % 1, phi = d.a + t * d.w;
      const r = rMax * (1 - f * 0.85) * d.r * 0.9, z = r * Math.cos(phi);
      const tw = 0.5 + 0.5 * Math.sin(t * 2.5 + d.ph);
      if (tw < 0.35) continue;
      buf.plot(cx + r * Math.sin(phi), yBase - f * treeRows + z * tilt, z, tw > 0.85 ? '*' : tw > 0.6 ? '+' : '.',
        `hsla(${d.hue},80%,92%,${(tw * (z < 0 ? 0.4 : 0.95)).toFixed(2)})`);
    }
  }

  // ── Estrella: núcleo, 8 rayos que respiran, rayos finos que giran y un anillo de destellos ──
  function drawStar(buf, t) {
    const { cx, yTop, aspect } = L;
    const sy = Math.floor(yTop) - 2;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.5);
    const glint = Math.exp(-Math.pow(((t % 3.6) - 0.5) / 0.22, 2)); // un destello cada 3,6 s
    const len = 13 + pulse * 2.2 + glint * 3.2;
    const gold = (l, a) => `hsla(44,66%,${Math.round(l)}%,${a.toFixed(2)})`;
    for (let k = 0; k < 8; k++) {
      const an = (k * TAU) / 8, dx = Math.cos(an), dy = Math.sin(an);
      const Lk = k % 2 ? len * 0.5 : len;
      const ch = k % 4 === 0 ? '-' : k % 4 === 2 ? '|' : k === 1 || k === 5 ? '\\' : '/';
      for (let d = 1; d <= Lk; d += 0.5) {
        const tip = d > Lk * 0.75;
        buf.plot(cx + dx * d, sy + 0.5 + dy * d * aspect, 70, tip ? (k % 4 === 0 ? '.' : ':') : ch,
          gold(80 - (10 * d) / Lk, (1 - (0.55 * d) / Lk) * (0.88 + 0.12 * Math.sin(d * 0.9 - t * 2.2))));
      }
    }
    for (let k = 0; k < 8; k++) {
      const an = (k * TAU) / 8 + TAU / 16 + t * 0.2, Lk = len * 0.32;
      for (let d = 1.5; d <= Lk; d += 0.6) buf.plot(cx + Math.cos(an) * d, sy + 0.5 + Math.sin(an) * d * aspect, 69, '.', gold(78, 0.7 - (0.5 * d) / Lk));
    }
    const core = ['  ###  ', '##@@@##', '  ###  '];
    core.forEach((row, i) => {
      [...row].forEach((ch, j) => {
        if (ch === ' ') return;
        buf.plot(cx - row.length / 2 + j, sy - 1 + i, 71, ch, ch === '@' ? `hsl(46,60%,${Math.round(88 + 6 * pulse)}%)` : gold(70 + 6 * pulse + 6 * glint, 1));
      });
    });
    for (let k = 0; k < 16; k++) {
      const an = (k * TAU) / 16 - t * 0.5, R = 11 + Math.sin(t * 1.3 + k) * 0.8;
      const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + k * 1.7);
      if (tw > 0.3) buf.plot(cx + Math.cos(an) * R, sy + 0.5 + Math.sin(an) * R * aspect, 68, tw > 0.85 ? '*' : '+', `hsla(${rainbowHue(k / 16)},70%,86%,${tw.toFixed(2)})`);
    }
    buf.addGlow(cx, sy + 0.5, 46, 0.35 + 0.15 * pulse + 0.2 * glint, 10 + pulse);
  }

  return {
    layout(grid) {
      L = stageLayout(grid);
      const n = grid.cols * grid.rows;
      cell = {
        z: new Float32Array(n), b: new Float32Array(n), k: new Float32Array(n), fr: new Float32Array(n),
        tint: new Float32Array(n), hue: new Int16Array(n), hj: new Int8Array(n), kind: new Uint8Array(n),
      };
      // Misma densidad de nieve aunque la pantalla sea más ancha que la franja 9:16.
      flakes = createSnow(Math.round((230 * grid.cols) / grid.panelCols));
    },

    nudge(dx) {
      spin += dx;
    },

    render(buf, dt, t) {
      if (!L) return;
      spin *= Math.exp(-dt * 2.5);
      angle += (0.5 + spin) * dt;
      drawSnow(buf, flakes, t);
      drawMandala(buf, t);
      drawTrunk(buf);
      drawTree(buf, t);
      drawBaubles(buf);
      drawDust(buf, t);
      drawStar(buf, t);
    },
  };
}
