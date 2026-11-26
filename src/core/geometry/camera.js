/**
 * Cámara en perspectiva sencilla, situada en z = -distance y mirando hacia +Z:
 * los puntos con z mayor están más lejos.
 *
 * Mundo: Y hacia arriba, unidades arbitrarias (el árbol mide ~2).
 * Proyecta a coordenadas de la rejilla (col, row) y devuelve 1/profundidad
 * para el Z-buffer.
 */
export class Camera {
  constructor({ distance = 4.5, pitch = 0.22 } = {}) {
    this.distance = distance;
    // Inclinación hacia abajo (rad): el suelo se ve como una elipse.
    this.pitch = pitch;
    this.cosP = Math.cos(pitch);
    this.sinP = Math.sin(pitch);
    this.cols = 1;
    this.rows = 1;
    this.aspect = 0.5;
    this.scale = 1;
    this.centerY = 0;
  }

  /** Ajusta la escala para que `worldHeight` unidades ocupen `fill` del alto de la pantalla. */
  fit(cols, rows, aspect, { worldHeight = 3.3, fill = 0.85, centerY = -0.2 } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.aspect = aspect;
    this.centerY = centerY;
    // Una unidad vertical en el mundo = scale * aspect filas a distancia `distance`.
    const byHeight = (rows * fill * this.distance) / (worldHeight * aspect);
    // En pantallas estrechas manda el ancho.
    const byWidth = (cols * 0.9 * this.distance) / worldHeight;
    this.scale = Math.min(byHeight, byWidth);
  }

  /** @returns {{col:number,row:number,invZ:number}|null} null si queda detrás de la cámara */
  project(x, y, z) {
    const yc = y - this.centerY;
    const yr = yc * this.cosP + z * this.sinP;
    const depth = z * this.cosP - yc * this.sinP + this.distance;
    if (depth <= 0.05) return null;
    const k = this.scale / depth;
    return {
      col: this.cols / 2 + x * k,
      row: this.rows / 2 - yr * k * this.aspect,
      invZ: 1 / depth,
    };
  }
}

/** Rota (x, z) alrededor del eje Y. */
export function rotateY(x, z, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c - z * s, x * s + z * c];
}
