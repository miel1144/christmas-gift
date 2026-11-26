import {
  buildFoliage,
  buildGarlands,
  buildOrnaments,
  buildTrunk,
  buildMat,
  TREE,
} from '../../geometry/tree';
import { createSnow } from '../../physics/snow';

// --- Paletas -----------------------------------------------------------------
// Glifos pesados: el árbol debe verse macizo. La luz la da sobre todo el color.
const FOLIAGE_CHARS = ['+', '*', '#', '#', '%', '&', '8', 'B', '@', '@'];
const GREEN_HUES = [136, 148, 160];
const GREEN_LEVELS = 14;
const FOLIAGE_COLORS = GREEN_HUES.map((hue, k) =>
  Array.from({ length: GREEN_LEVELS }, (_, i) => {
    const t = i / (GREEN_LEVELS - 1);
    return `hsl(${hue}, ${38 + k * 6}%, ${12 + t * 46}%)`;
  })
);
const FROST = '#dfe8f2';
const TRUNK_COLORS = ['hsl(22, 38%, 26%)', 'hsl(24, 42%, 34%)', 'hsl(26, 46%, 43%)', 'hsl(28, 50%, 52%)'];
// Tapete: café en sombra → ámbar iluminado; ribetes más dorados.
const MAT_COLORS = Array.from({ length: 10 }, (_, i) => `hsl(${22 + i * 1.4}, ${45 + i * 3}%, ${12 + i * 3.2}%)`);
const MAT_TRIM = Array.from({ length: 6 }, (_, i) => `hsl(36, ${62 + i * 3}%, ${30 + i * 5}%)`);
const SNOW_COLORS = ['rgba(248,250,255,0.35)', 'rgba(248,250,255,0.65)', 'rgba(248,250,255,0.95)'];
const STAR_CORE = '#fff6d8';
const STAR_GOLD = 'hsl(44, 85%, 70%)';
const STAR_RAY = 'hsl(44, 60%, 78%)';

// Luz desde arriba a la izquierda y delante (la cámara mira hacia +Z).
const L = (() => {
  const v = [-0.62, 0.5, -0.6];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();

const clamp01 = (v) => (v < 0 ? 0 : v > 0.999 ? 0.999 : v);
const pick = (arr, v) => arr[Math.floor(clamp01(v) * arr.length)];

/**
 * Árbol macizo que gira: follaje sombreado, guirnaldas y bolas que brillan,
 * estrella con rayos, suelo dorado y nieve. `nudge(dx)` lo empuja (arrastre).
 */
export function createTreeScene() {
  const foliage = buildFoliage();
  for (const f of foliage) {
    f.ca = Math.cos(f.a);
    f.sa = Math.sin(f.a);
  }
  const garlands = buildGarlands();
  const ornaments = buildOrnaments();
  const trunk = buildTrunk();
  const mat = buildMat();
  const snow = createSnow();

  let angle = 0;
  let spin = 0; // velocidad extra por arrastre, decae sola
  const baseSpin = 0.3; // rad/s

  function drawStar(buf, cam, t, aspect) {
    const p = cam.project(0, TREE.baseY + TREE.height + 0.07, 0);
    if (!p) return;
    const z = p.invZ * 1.1;
    const c = Math.round(p.col);
    const r = Math.round(p.row);

    // Núcleo.
    const core = [
      [-1, -1, '#'], [0, -1, '@'], [1, -1, '#'],
      [-2, 0, '#'], [-1, 0, '@'], [0, 0, '@'], [1, 0, '@'], [2, 0, '#'],
      [-1, 1, '#'], [0, 1, '@'], [1, 1, '#'],
    ];
    for (const [dx, dy, ch] of core) buf.plot(c + dx, r + dy, z, ch, dx === 0 && dy === 0 ? STAR_CORE : STAR_GOLD, 0.9);

    // Rayos: 8 direcciones, los diagonales más cortos; su largo late.
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
    const dirs = [
      [1, 0, '-', 9], [-1, 0, '-', 9], [0, 1, '|', 5], [0, -1, '|', 6],
      [1, 1, '\\', 4], [-1, -1, '\\', 4], [1, -1, '/', 4], [-1, 1, '/', 4],
    ];
    const sx = 1 / (2 * aspect); // las celdas son altas: estira en horizontal
    for (const [dx, dy, ch, len] of dirs) {
      const n = Math.round(len * pulse);
      for (let k = 2; k <= n + 1; k++) {
        const col = c + dx * k * (dy === 0 ? 1 : sx);
        const row = r + dy * k * (dx === 0 ? 1 : 0.5);
        buf.plot(col, row, z, k <= 3 ? ch : '.', STAR_RAY, k <= 3 ? 0.35 : 0);
      }
    }
  }

  return {
    nudge(dx) {
      spin += dx;
    },

    render(buf, cam, dt, t) {
      spin *= Math.exp(-dt * 2.5);
      angle += (baseSpin + spin) * dt;
      snow.update(dt, t);
      const cs = Math.cos(angle);
      const sn = Math.sin(angle);
      const rot = (x, z) => [x * cs - z * sn, x * sn + z * cs];

      // Tapete: la luz depende de la posición en pantalla (izquierda y delante más claro).
      for (const m of mat) {
        const [x, z] = rot(m.x, m.z);
        const p = cam.project(x, m.y, z);
        if (!p) continue;
        const lit = clamp01(0.55 - x * 0.22 - z * 0.18 + (m.jitter - 0.5) * 0.12);
        if (m.zone === 'body') {
          const ch = m.jitter > 0.8 ? '+' : m.jitter > 0.65 ? '=' : '#';
          // Sombra del árbol: el centro del tapete más oscuro, así el tronco resalta.
          buf.plot(p.col, p.row, p.invZ, ch, pick(MAT_COLORS, lit * (0.35 + 0.75 * Math.min(1, m.u * 1.4))));
        } else {
          buf.plot(p.col, p.row, p.invZ, m.zone === 'edge' ? '#' : '=', pick(MAT_TRIM, lit));
        }
      }

      // Tronco (casi todo queda tapado por las ramas bajas).
      for (const q of trunk) {
        const [x, z] = rot(q.x, q.z);
        const p = cam.project(x, q.y, z);
        if (!p) continue;
        // Lado izquierdo iluminado, como el follaje.
        const lit = clamp01(0.5 - 0.5 * Math.cos(q.a + angle + 0.4));
        buf.plot(p.col, p.row, p.invZ, lit > 0.6 ? 'H' : lit > 0.3 ? '#' : '|', pick(TRUNK_COLORS, lit));
      }

      // Follaje.
      for (const f of foliage) {
        const [x, z] = rot(f.x, f.z);
        const p = cam.project(x, f.y, z);
        if (!p) continue;
        // Normal de la rama girada: hacia fuera y un poco hacia arriba.
        const nx = f.ca * cs - f.sa * sn;
        const nz = f.ca * sn + f.sa * cs;
        const lambert = Math.max(0, (nx * L[0] + 0.45 * L[1] + nz * L[2]) / 1.1);
        const occlusion = 0.3 + 0.7 * f.depth * f.depth; // el interior queda en sombra
        const light = (0.25 + 0.75 * lambert) * occlusion;

        if (f.jitter > 0.975 && lambert > 0.5 && f.depth > 0.85) {
          buf.plot(p.col, p.row, p.invZ, '*', FROST);
          continue;
        }
        const ch = pick(FOLIAGE_CHARS, light + (f.jitter - 0.5) * 0.35);
        const palette = FOLIAGE_COLORS[Math.floor(f.hue * GREEN_HUES.length)];
        buf.plot(p.col, p.row, p.invZ, ch, pick(palette, light + (f.hue - 0.5) * 0.08));
      }

      // Listones (un poco por delante de las ramas en las que se apoyan).
      for (const b of garlands) {
        const [x, z] = rot(b.x, b.z);
        const p = cam.project(x, b.y, z);
        if (!p) continue;
        const tw = 0.6 + 0.4 * Math.sin(t * b.speed + b.phase);
        buf.plot(p.col, p.row, p.invZ * 1.03, tw > 0.75 ? '@' : 'o', b.color, 0.35 * tw);
      }

      // Bolas.
      for (const o of ornaments) {
        const [x, z] = rot(o.x, o.z);
        const p = cam.project(x, o.y, z);
        if (!p) continue;
        const tw = 0.7 + 0.3 * Math.sin(t * 2 + o.phase);
        buf.plot(p.col, p.row, p.invZ * 1.04, 'O', o.color, 0.5 * tw);
      }

      drawStar(buf, cam, t, cam.aspect);

      // Nieve.
      for (const f of snow.flakes) {
        const p = cam.project(f.x, f.y, f.z);
        if (!p) continue;
        const near = 1 - (f.z + 2.2) / 5.2;
        buf.plot(p.col, p.row, p.invZ, near > 0.8 ? '*' : near > 0.45 ? '+' : '.', pick(SNOW_COLORS, near));
      }
    },
  };
}
