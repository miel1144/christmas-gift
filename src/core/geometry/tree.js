/**
 * Geometría del árbol: puntos sobre la superficie de varios conos apilados,
 * una guirnalda en espiral de luces, la estrella y el disco de nieve de la base.
 * Todo se genera una vez; la escena solo lo rota y lo proyecta.
 */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export const TREE = {
  height: 2.0, // de y=-1 (base del follaje) a y=1 (punta)
  radius: 0.85,
  baseY: -1,
  trunkHeight: 0.22,
};

/** Radio del follaje a la altura relativa h (0 abajo, 1 punta), con "pisos". */
export function radiusAt(h) {
  const tiers = 4;
  const local = (h * tiers) % 1; // dentro de cada piso
  const taper = 1 - h; // estrechamiento general
  return TREE.radius * taper * (0.72 + 0.28 * (1 - local));
}

export function buildFoliage(count = 2600) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const h = Math.pow(i / count, 0.85);
    const a = i * GOLDEN;
    const r = radiusAt(h) * (0.92 + Math.random() * 0.08);
    pts.push({
      x: Math.cos(a) * r,
      y: TREE.baseY + h * TREE.height,
      z: Math.sin(a) * r,
      a, // ángulo, para la normal
      h,
    });
  }
  return pts;
}

export const LIGHT_COLORS = ['#ff5a6e', '#ffd36b', '#6bc8ff', '#fff4d6', '#ff9f4a', '#c48bff'];

/** Luces a lo largo de una espiral que sube por el árbol. */
export function buildLights(count = 70, turns = 5.5) {
  const lights = [];
  for (let i = 0; i < count; i++) {
    const h = 0.04 + (i / count) * 0.88;
    const a = h * turns * Math.PI * 2;
    const r = radiusAt(h) + 0.04;
    lights.push({
      x: Math.cos(a) * r,
      y: TREE.baseY + h * TREE.height,
      z: Math.sin(a) * r,
      color: LIGHT_COLORS[i % LIGHT_COLORS.length],
      phase: Math.random() * Math.PI * 2,
      speed: 1.5 + Math.random() * 2.5,
    });
  }
  return lights;
}

export function buildTrunk() {
  const pts = [];
  const r = 0.12;
  for (let i = 0; i < 160; i++) {
    const a = i * GOLDEN;
    const t = (i % 16) / 16;
    pts.push({ x: Math.cos(a) * r, y: TREE.baseY - t * TREE.trunkHeight, z: Math.sin(a) * r, a });
  }
  return pts;
}

/** Disco de nieve en el suelo (anillos concéntricos). */
export function buildDisk(radius = 1.2, rings = 6) {
  const pts = [];
  const y = TREE.baseY - TREE.trunkHeight;
  for (let k = 1; k <= rings; k++) {
    const r = (k / rings) * radius;
    const n = Math.round(12 + k * 14);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * 0.37;
      pts.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, ring: k / rings });
    }
  }
  return pts;
}
