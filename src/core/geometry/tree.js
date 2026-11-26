/**
 * Geometría del árbol, generada una vez (con semilla fija: siempre el mismo árbol).
 *
 * - Follaje: miles de puntos que RELLENAN el volumen de un abeto con pisos de
 *   ramas irregulares. El Z-buffer deja ver solo la capa delantera, así que la
 *   silueta queda maciza y los puntos interiores dan sombra entre las ramas.
 * - Guirnaldas: bandas de cuentas de colores que cuelgan en festón.
 * - Tronco corto (casi oculto bajo las ramas bajas) y suelo con manchas.
 */
export const TREE = {
  height: 2.0, // follaje de y=-1 a y=1
  radius: 1.2,
  baseY: -1,
  tiers: 7,
  trunkHeight: 0.8,
};

/** PRNG con semilla (mulberry32). */
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Radio exterior del follaje a la altura h (0 base, 1 punta) y ángulo a.
 * Cada piso es ancho abajo (puntas de rama que caen) y se estrecha arriba;
 * el ruido angular hace que algunas ramas sobresalgan más que otras.
 */
export function outerRadius(h, a) {
  const { tiers, radius } = TREE;
  const t = Math.min(tiers - 1, Math.floor(h * tiers));
  const u = h * tiers - t; // 0 abajo del piso, 1 arriba
  const taper = Math.pow(1 - h, 0.92);
  const tier = 0.62 + 0.38 * Math.pow(1 - u, 1.6);
  const branches =
    1 +
    0.1 * Math.sin(a * 5 + t * 1.7) +
    0.07 * Math.sin(a * 11 + t * 3.1) +
    0.05 * Math.sin(a * 23 + t * 0.6);
  return radius * taper * tier * branches;
}

export function buildFoliage(count = 16000, rand = seeded(7)) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    // Más puntos abajo, donde el árbol es más ancho.
    const h = Math.min(0.995, 1 - Math.sqrt(rand()));
    const a = rand() * Math.PI * 2;
    // Profundidad dentro de la rama: 1 = punta exterior, 0.55 = cerca del eje.
    const depth = 0.55 + 0.45 * Math.sqrt(rand());
    const r = outerRadius(h, a) * depth;
    pts.push({
      x: Math.cos(a) * r,
      y: TREE.baseY + h * TREE.height - (1 - depth) * 0.06, // las ramas caen un poco
      z: Math.sin(a) * r,
      a,
      h,
      depth,
      jitter: rand(), // textura: variación estable de carácter y tono
      hue: rand(),
    });
  }
  return pts;
}

// Listones: rosa, amarillo, azul y morado.
export const GARLAND_COLORS = ['#ff6fb5', '#ffd95a', '#5aa8ff', '#b76bff'];

/** Listones: cada uno da una vuelta y pico colgando en festón; dos filas de grosor. */
export function buildGarlands(rand = seeded(11)) {
  const beads = [];
  const bands = [0.12, 0.3, 0.48, 0.66, 0.82];
  bands.forEach((h0, k) => {
    const color = GARLAND_COLORS[k % GARLAND_COLORS.length];
    const a0 = rand() * Math.PI * 2;
    const n = Math.round(220 * (1 - h0) + 40);
    for (let i = 0; i < n; i++) {
      const s = i / n;
      const a = a0 + s * Math.PI * 2.2;
      const sag = 0.035 * Math.abs(Math.sin(a * 3.5)); // festones
      const h = h0 + s * 0.05 - sag;
      for (const dh of [0, -0.012]) {
        const r = outerRadius(Math.max(0, h + dh), a) * 1.02;
        beads.push({
          x: Math.cos(a) * r,
          y: TREE.baseY + (h + dh) * TREE.height,
          z: Math.sin(a) * r,
          color,
          phase: rand() * Math.PI * 2,
          speed: 0.8 + rand() * 1.6,
        });
      }
    }
  });
  return beads;
}

// Bolas: todas rojas (dos tonos para que no se vean planas).
export const ORNAMENT_COLORS = ['#ff3b4a', '#d62536'];

/** Bolas sueltas en las puntas de las ramas. */
export function buildOrnaments(count = 55, rand = seeded(23)) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const h = 0.05 + rand() * 0.85;
    const a = rand() * Math.PI * 2;
    const r = outerRadius(h, a) * 1.0;
    out.push({
      x: Math.cos(a) * r,
      y: TREE.baseY + h * TREE.height - 0.02,
      z: Math.sin(a) * r,
      color: ORNAMENT_COLORS[i % ORNAMENT_COLORS.length],
      phase: rand() * Math.PI * 2,
    });
  }
  return out;
}

export function buildTrunk(rand = seeded(5)) {
  const pts = [];
  for (let i = 0; i < 2600; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.19 * (0.85 + 0.15 * rand());
    pts.push({ x: Math.cos(a) * r, y: TREE.baseY - rand() * TREE.trunkHeight, z: Math.sin(a) * r, a });
  }
  return pts;
}

/**
 * Tapete café-ámbar bajo el árbol: disco relleno (anillos densos, sin huecos)
 * con un ribete en el borde y otro interior para que se lea como tela.
 */
export const MAT = { radius: 1.35 };

export function buildMat(rand = seeded(31)) {
  const pts = [];
  const y = TREE.baseY - TREE.trunkHeight;
  const step = 0.028;
  for (let r = step / 2; r <= MAT.radius; r += step) {
    const n = Math.max(6, Math.round((Math.PI * 2 * r) / 0.024));
    const off = rand() * Math.PI * 2;
    const u = r / MAT.radius;
    // Zonas: centro liso, ribete interior, cuerpo, borde.
    const zone = u > 0.93 ? 'edge' : u > 0.7 && u < 0.76 ? 'trim' : 'body';
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      pts.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, u, zone, jitter: rand() });
    }
  }
  return pts;
}
