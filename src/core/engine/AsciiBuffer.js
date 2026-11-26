import { hash3 } from '../../utils/math';

/**
 * Rejilla de caracteres con Z-buffer.
 *
 * Cada celda guarda carácter, color y profundidad (mayor z = más cerca; gana el
 * más cercano). Además acumula "fuentes de brillo": al final del fotograma
 * `resolveGlows` rellena las celdas VACÍAS de alrededor con caracteres tenues
 * (+ : .) que titilan, así el halo también es texto.
 */
export class AsciiBuffer {
  constructor(cols = 1, rows = 1, aspect = 0.6) {
    this.glows = [];
    this.resize(cols, rows, aspect);
  }

  resize(cols, rows, aspect = this.aspect) {
    this.cols = Math.max(1, cols | 0);
    this.rows = Math.max(1, rows | 0);
    this.aspect = aspect; // ancho/alto de una celda
    const n = this.cols * this.rows;
    this.chars = new Array(n);
    this.colors = new Array(n);
    this.depth = new Float32Array(n);
    this.clear();
  }

  clear() {
    this.chars.fill('');
    this.colors.fill('');
    this.depth.fill(-Infinity);
    this.glows.length = 0;
  }

  /** Pinta un carácter si está más cerca que lo que ya hay. */
  plot(col, row, z, char, color) {
    col = Math.floor(col);
    row = Math.floor(row);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return false;
    const i = row * this.cols + col;
    if (z < this.depth[i]) return false;
    this.depth[i] = z;
    this.chars[i] = char;
    this.colors[i] = color;
    return true;
  }

  /** z de la celda (−Infinity si está vacía). */
  depthAt(col, row) {
    col = Math.floor(col);
    row = Math.floor(row);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return Infinity;
    return this.depth[row * this.cols + col];
  }

  /**
   * Registra un halo. hue < 0 = blanco. `radius` en columnas (en filas se
   * corrige con el aspecto de la celda).
   */
  addGlow(col, row, hue, amount, radius) {
    this.glows.push(col, row, hue, amount, radius);
  }

  resolveGlows(t) {
    const { cols, rows, chars, colors, glows, aspect } = this;
    const tick = Math.floor(t * 9); // el titileo cambia ~9 veces por segundo
    for (let g = 0; g < glows.length; g += 5) {
      const gx = glows[g], gy = glows[g + 1], hue = glows[g + 2], amt = Math.min(1, glows[g + 3]), rad = glows[g + 4];
      if (amt < 0.1 || rad < 2) continue;
      const ry = rad * aspect;
      const x0 = Math.max(0, Math.floor(gx - rad)), x1 = Math.min(cols - 1, Math.ceil(gx + rad));
      const y0 = Math.max(0, Math.floor(gy - ry)), y1 = Math.min(rows - 1, Math.ceil(gy + ry));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * cols + x;
          if (chars[i]) continue;
          const d = Math.hypot((x + 0.5 - gx) / rad, (y + 0.5 - gy) / ry);
          if (d >= 1) continue;
          if (hash3(x, y, tick) > amt * Math.pow(1 - d, 1.6) * 0.75) continue;
          chars[i] = d < 0.35 ? '+' : d < 0.65 ? ':' : '.';
          const a = (0.5 + 0.5 * (1 - d)).toFixed(2);
          colors[i] = hue < 0 ? `rgba(255,255,255,${a})` : `hsla(${hue},100%,${Math.round(78 + 14 * (1 - d))}%,${a})`;
        }
      }
    }
  }
}
