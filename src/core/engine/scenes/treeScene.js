import { rotateY } from '../../geometry/camera';
import { buildFoliage, buildLights, buildTrunk, buildDisk, TREE } from '../../geometry/tree';
import { createSnow } from '../../physics/snow';

// Rampas de carácter y color por intensidad (0 = sombra, último = luz).
const FOLIAGE_CHARS = ['.', ',', ':', ';', '+', '*', '#', '%'];
const FOLIAGE_COLORS = FOLIAGE_CHARS.map((_, i) => `hsl(150, 60%, ${14 + i * 6}%)`);
const TRUNK_COLORS = ['hsl(25, 45%, 22%)', 'hsl(25, 45%, 32%)', 'hsl(25, 45%, 42%)'];
const SNOW_COLORS = ['rgba(248,250,255,0.35)', 'rgba(248,250,255,0.6)', 'rgba(248,250,255,0.95)'];
const STAR_COLOR = 'hsl(44, 90%, 72%)';
const STAR_CORE = '#fff8e0';

const ramp = (arr, v) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(v * arr.length)))];

/**
 * Árbol que gira, con luces parpadeantes, estrella, disco de nieve y copos.
 * El giro tiene inercia: `nudge(dx)` lo empuja (arrastre con ratón o dedo).
 */
export function createTreeScene() {
  const foliage = buildFoliage();
  const lights = buildLights();
  const trunk = buildTrunk();
  const disk = buildDisk();
  const snow = createSnow();

  let angle = 0;
  let spin = 0; // velocidad extra por arrastre, decae sola
  const baseSpin = 0.35; // rad/s

  function drawStar(buf, cam, t) {
    const p = cam.project(0, TREE.baseY + TREE.height + 0.08, 0);
    if (!p) return;
    const z = p.invZ * 1.05;
    const pulse = 0.75 + 0.25 * Math.sin(t * 3);
    buf.plot(p.col, p.row, z, '*', STAR_CORE, 1);
    // Rayos que alternan entre + y x.
    const diag = Math.sin(t * 1.5) > 0;
    const arms = diag
      ? [[-1, -1, '\\'], [1, 1, '\\'], [1, -1, '/'], [-1, 1, '/']]
      : [[-1, 0, '-'], [1, 0, '-'], [0, -1, '|'], [0, 1, '|'], [-2, 0, '-'], [2, 0, '-']];
    for (const [dx, dy, ch] of arms) buf.plot(p.col + dx, p.row + dy, z, ch, STAR_COLOR, pulse * 0.7);
  }

  return {
    nudge(dx) {
      spin += dx;
    },

    render(buf, cam, dt, t) {
      spin *= Math.exp(-dt * 2.5);
      angle += (baseSpin + spin) * dt;
      snow.update(dt, t);

      // Disco de nieve.
      for (const d of disk) {
        const [x, z] = rotateY(d.x, d.z, angle * 0.3);
        const p = cam.project(x, d.y, z);
        if (!p) continue;
        const near = 1 - (z + 1.2) / 2.4; // 1 delante, 0 detrás
        buf.plot(p.col, p.row, p.invZ, d.ring > 0.85 ? '.' : near > 0.5 ? '_' : '.', ramp(SNOW_COLORS, 0.2 + near * 0.6));
      }

      // Tronco.
      for (const q of trunk) {
        const [x, z] = rotateY(q.x, q.z, angle);
        const p = cam.project(x, q.y, z);
        if (!p) continue;
        const facing = -Math.sin(q.a + angle);
        buf.plot(p.col, p.row, p.invZ, '|', ramp(TRUNK_COLORS, 0.5 + facing * 0.5));
      }

      // Follaje.
      for (const f of foliage) {
        const [x, z] = rotateY(f.x, f.z, angle);
        const p = cam.project(x, f.y, z);
        if (!p) continue;
        const facing = -Math.sin(f.a + angle); // 1 = mira a la cámara
        if (facing < -0.35) continue; // la cara de atrás solo ensuciaría los huecos
        const side = Math.cos(f.a + angle + 0.9); // luz lateral suave
        const light = Math.max(0, Math.min(0.999, 0.28 + 0.5 * facing + 0.15 * side + 0.12 * f.h));
        buf.plot(p.col, p.row, p.invZ, ramp(FOLIAGE_CHARS, light), ramp(FOLIAGE_COLORS, light));
      }

      // Luces (encima del follaje: un poco de margen en la profundidad).
      for (const l of lights) {
        const [x, z] = rotateY(l.x, l.z, angle);
        const p = cam.project(x, l.y, z);
        if (!p) continue;
        const front = z < 0.15;
        const tw = 0.55 + 0.45 * Math.sin(t * l.speed + l.phase);
        const emit = front ? tw : tw * 0.25;
        buf.plot(p.col, p.row, p.invZ * 1.02, tw > 0.7 ? 'o' : '°', l.color, emit);
      }

      drawStar(buf, cam, t);

      // Nieve.
      for (const f of snow.flakes) {
        const p = cam.project(f.x, f.y, f.z);
        if (!p) continue;
        const near = 1 - (f.z + 2.2) / 5.2;
        buf.plot(p.col, p.row, p.invZ, near > 0.75 ? '*' : near > 0.4 ? '+' : '.', ramp(SNOW_COLORS, near));
      }
    },
  };
}
