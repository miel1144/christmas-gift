import { useEffect, useRef } from 'react';
import { AsciiBuffer } from '../../core/engine/AsciiBuffer';
import { CanvasRenderer } from '../../core/engine/renderer';
import { startLoop } from '../../core/engine/loop';
import { createTreeScene } from '../../core/engine/scenes/tree';

/**
 * Lienzo a pantalla completa que ejecuta la escena ASCII.
 *
 * - La intro se reproduce sola. Teclas 1 · 2 · 3 lanzan cada paso a mano
 *   (pasa a modo manual) y R la repite.
 * - Arrastrar con ratón o dedo hace girar el árbol; un clic sobre un regalo
 *   llama a `onGiftClick(id)`.
 *
 * `gifts`: especificaciones de cajas (ver core/geometry/gifts.js).
 */
const CLICK_SLOP = 5; // px que se puede mover el puntero y seguir contando como clic

export default function AsciiCanvas({ className = '', gifts = [], onGiftClick }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const onGiftClickRef = useRef(onGiftClick);
  onGiftClickRef.current = onGiftClick;

  useEffect(() => {
    sceneRef.current?.setGifts(gifts);
  }, [gifts]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const renderer = new CanvasRenderer(canvas);
    const buffer = new AsciiBuffer();
    const scene = createTreeScene({ gifts });
    sceneRef.current = scene;

    const layout = () => {
      const { width, height } = wrap.getBoundingClientRect();
      if (!width || !height) return;
      const grid = renderer.resize(width, height);
      buffer.resize(grid.cols, grid.rows, grid.aspect);
      scene.layout(grid);
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(wrap);

    const stop = startLoop((dt, t) => {
      buffer.clear();
      scene.render(buffer, dt, t);
      buffer.resolveGlows(t);
      renderer.draw(buffer);
    });

    const giftAt = (e) => {
      const rect = canvas.getBoundingClientRect();
      const { col, row } = renderer.toCell(e.clientX - rect.left, e.clientY - rect.top);
      return scene.pick(col, row);
    };

    // Arrastre para girar; si casi no se movió, es un clic.
    let lastX = null;
    let startX = 0, startY = 0;
    const down = (e) => {
      lastX = startX = e.clientX;
      startY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (lastX === null) {
        canvas.style.cursor = onGiftClickRef.current && giftAt(e) ? 'pointer' : '';
        return;
      }
      scene.nudge((e.clientX - lastX) * 0.02);
      lastX = e.clientX;
    };
    const up = (e) => {
      const wasClick = lastX !== null && Math.hypot(e.clientX - startX, e.clientY - startY) < CLICK_SLOP;
      lastX = null;
      if (wasClick && onGiftClickRef.current) {
        const id = giftAt(e);
        if (id) onGiftClickRef.current(id);
      }
    };
    const cancel = () => {
      lastX = null;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);

    // Teclado: 1–3 pasos de la intro, R repetir. No interfiere si se escribe en un campo.
    const key = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key >= '1' && e.key <= '3') scene.trigger(Number(e.key) - 1);
      else if (e.key === 'r' || e.key === 'R') scene.restart();
    };
    window.addEventListener('keydown', key);

    return () => {
      window.removeEventListener('keydown', key);
      stop();
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      sceneRef.current = null;
    };
    // La escena se crea una vez; los cambios de `gifts` llegan por setGifts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className={`ascii-wrap ${className}`}>
      <canvas ref={canvasRef} className="ascii-canvas" aria-label="Árbol de Navidad ASCII con los regalos de la sala" role="img" />
    </div>
  );
}
