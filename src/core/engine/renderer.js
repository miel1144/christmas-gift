const FONT = "Menlo, Consolas, 'DejaVu Sans Mono', monospace";

/** Columnas que ocupa la franja central de 9:16. La escena se diseña para este ancho. */
export const PANEL_COLS = 124;

/**
 * Dibuja un AsciiBuffer en un <canvas>.
 *
 * Rejilla: la franja central de 9:16 siempre tiene PANEL_COLS columnas, así que la
 * fuente escala con la pantalla y la escena se ve igual en cualquier tamaño. Si la
 * pantalla es más ancha, la rejilla se extiende a los lados con celdas del mismo tamaño.
 *
 * Brillo: los caracteres se pintan en un lienzo aparte y luego se superponen dos
 * copias desenfocadas en modo `screen`. Todo resplandor sale de un carácter.
 */
export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.off = document.createElement('canvas');
    this.octx = this.off.getContext('2d');
    this.bloom = supportsFilter(this.ctx);
  }

  resize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = width;
    this.H = height;
    this.PW = Math.min(width, Math.round((height * 9) / 16)); // ancho de la franja 9:16
    this.CW = this.PW / PANEL_COLS;
    this.CH = this.CW * 1.62;
    const X0 = (width - this.PW) / 2;
    const side = Math.ceil(X0 / this.CW - 1e-6);
    this.GX0 = X0 - side * this.CW;

    for (const c of [this.canvas, this.off]) {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
    }
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.octx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = this.ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#323a47');
    bg.addColorStop(0.55, '#394250');
    bg.addColorStop(0.86, '#4b5463');
    bg.addColorStop(1, '#666e7d');
    this.bg = bg;

    return {
      cols: PANEL_COLS + 2 * side,
      rows: Math.max(1, Math.floor(height / this.CH)),
      aspect: this.CW / this.CH,
      panelCols: PANEL_COLS,
    };
  }

  draw(buffer) {
    const { ctx, octx, W, H, CW, CH, GX0 } = this;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, W, H);

    octx.clearRect(0, 0, W, H);
    octx.font = `bold ${Math.round(CH * 0.95)}px ${FONT}`;
    octx.textBaseline = 'middle';
    octx.textAlign = 'center';
    const { chars, colors, cols } = buffer;
    let current = '';
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (!ch) continue;
      if (colors[i] !== current) {
        current = colors[i];
        octx.fillStyle = current;
      }
      octx.fillText(ch, GX0 + (i % cols) * CW + CW / 2, ((i / cols) | 0) * CH + CH / 2);
    }
    ctx.drawImage(this.off, 0, 0, W, H);

    if (this.bloom) {
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = `blur(${Math.max(2, Math.round(this.PW * 0.006))}px)`;
      ctx.globalAlpha = 0.4;
      ctx.drawImage(this.off, 0, 0, W, H);
      ctx.filter = `blur(${Math.round(this.PW * 0.02)}px)`;
      ctx.globalAlpha = 0.12;
      ctx.drawImage(this.off, 0, 0, W, H);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

/** Safari antiguo no soporta ctx.filter: sin él, el brillo se desactiva en vez de verse mal. */
function supportsFilter(ctx) {
  if (!('filter' in ctx)) return false;
  ctx.filter = 'blur(1px)';
  const ok = ctx.filter === 'blur(1px)';
  ctx.filter = 'none';
  return ok;
}
