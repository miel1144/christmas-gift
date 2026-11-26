/**
 * Rejilla de caracteres con Z-buffer y capa de brillo (glow) para el bloom.
 *
 * Cada celda guarda: carácter, color, profundidad inversa (1/z, mayor = más cerca)
 * y cuánta luz emite. El bloom reparte esa luz a las celdas vecinas vacías y las
 * rellena con caracteres tenues, así el "resplandor" también es ASCII.
 */
export const GLOW_RAMP = ['.', '·', ':', '*'];

export class AsciiBuffer {
  constructor(cols = 1, rows = 1) {
    this.resize(cols, rows);
  }

  resize(cols, rows) {
    this.cols = Math.max(1, cols | 0);
    this.rows = Math.max(1, rows | 0);
    const n = this.cols * this.rows;
    this.chars = new Array(n);
    this.colors = new Array(n);
    this.depth = new Float32Array(n);
    this.emit = new Float32Array(n);
    this.glow = new Float32Array(n);
    this.glowColor = new Array(n);
    this.clear();
  }

  clear() {
    this.chars.fill(' ');
    this.colors.fill(null);
    this.depth.fill(0);
    this.emit.fill(0);
    this.glow.fill(0);
    this.glowColor.fill(null);
  }

  /**
   * Pinta un carácter si está más cerca que lo que ya hay.
   * @param {number} invZ  1/profundidad; 0 = infinitamente lejos (fondo)
   * @param {number} emit  0..1, luz propia (luces, estrella)
   */
  plot(col, row, invZ, char, color, emit = 0) {
    col = Math.round(col);
    row = Math.round(row);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return false;
    const i = row * this.cols + col;
    if (invZ < this.depth[i]) return false;
    this.depth[i] = invZ;
    this.chars[i] = char;
    this.colors[i] = color;
    this.emit[i] = emit;
    return true;
  }

  /** Texto 2D sin profundidad (HUD, etiquetas): siempre encima. */
  text(col, row, str, color) {
    for (let k = 0; k < str.length; k++) this.plot(col + k, row, Infinity, str[k], color);
  }

  /**
   * Bloom con caracteres: cada celda emisora reparte luz en un radio.
   * Las celdas vacías con suficiente luz reciben un carácter de GLOW_RAMP.
   * Las celdas altas que las fuentes de texto tienen ~2:1 se compensan con `aspect`.
   */
  bloom(radius = 3, strength = 0.9, aspect = 0.5) {
    const { cols, rows, emit, glow, glowColor, colors, chars } = this;
    const ry = Math.max(1, Math.round(radius * aspect));

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const e = emit[row * cols + col];
        if (e <= 0) continue;
        const color = colors[row * cols + col];
        for (let dy = -ry; dy <= ry; dy++) {
          const r = row + dy;
          if (r < 0 || r >= rows) continue;
          for (let dx = -radius; dx <= radius; dx++) {
            const c = col + dx;
            if (c < 0 || c >= cols || (dx === 0 && dy === 0)) continue;
            const d = Math.hypot(dx, dy / aspect) / radius;
            if (d >= 1) continue;
            const g = e * strength * (1 - d) * (1 - d);
            const j = r * cols + c;
            if (g > glow[j]) {
              glow[j] = g;
              glowColor[j] = color;
            }
          }
        }
      }
    }

    for (let i = 0; i < chars.length; i++) {
      if (chars[i] !== ' ' || glow[i] < 0.12) continue;
      const k = Math.min(GLOW_RAMP.length - 1, Math.floor(glow[i] * GLOW_RAMP.length));
      chars[i] = GLOW_RAMP[k];
      colors[i] = glowColor[i];
    }
  }
}
