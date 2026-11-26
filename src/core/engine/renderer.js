/**
 * Dibuja un AsciiBuffer en un <canvas> 2D.
 * Mide la celda con la fuente real para que la rejilla encaje en píxeles.
 */
export class CanvasRenderer {
  constructor(canvas, { fontSize = 14, fontFamily = "Menlo, Consolas, 'DejaVu Sans Mono', monospace" } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fontSize = fontSize;
    this.font = `bold ${fontSize}px ${fontFamily}`;
    this.dpr = 1;
    this.measure();
  }

  measure() {
    this.ctx.font = this.font;
    this.cellW = Math.ceil(this.ctx.measureText('M').width);
    this.cellH = Math.ceil(this.fontSize * 1.2);
  }

  /** Ajusta el canvas al tamaño CSS dado y devuelve cuántas columnas/filas caben. */
  resize(width, height) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.measure();
    return {
      cols: Math.floor(width / this.cellW),
      rows: Math.floor(height / this.cellH),
      // Ancho/alto de una celda: para corregir la proyección (las celdas no son cuadradas).
      aspect: this.cellW / this.cellH,
    };
  }

  draw(buffer) {
    const { ctx, cellW, cellH, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    ctx.font = this.font;
    ctx.textBaseline = 'top';

    // Centra la rejilla dentro del canvas.
    const ox = Math.floor((this.canvas.width / dpr - buffer.cols * cellW) / 2);
    const oy = Math.floor((this.canvas.height / dpr - buffer.rows * cellH) / 2);

    let current = null;
    const { chars, colors, cols } = buffer;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === ' ') continue;
      const color = colors[i] || '#fff';
      if (color !== current) {
        ctx.fillStyle = color;
        current = color;
      }
      ctx.fillText(ch, ox + (i % cols) * cellW, oy + ((i / cols) | 0) * cellH);
    }
  }
}
