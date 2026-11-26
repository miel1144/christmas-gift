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
 * - Si `canDragGift(id)` dice que sí, arrastrar ese regalo lo mueve por el suelo
 *   (el árbol se para mientras tanto) y al soltarlo llama a `onGiftMove(id, ángulo, radio)`.
 *
 * `gifts`: especificaciones de cajas (ver core/geometry/gifts.js).
 * `sceneFactory`: otra escena (p. ej. solo nieve). `interactive={false}`: fondo decorativo,
 * sin ratón ni teclado. `anchorRef`: elemento HTML cuya posición recibe la escena en
 * `grid.anchor` (para colocar cosas a su alrededor).
 */
const CLICK_SLOP = 5; // px que se puede mover el puntero y seguir contando como clic

export default function AsciiCanvas({
  className = '',
  gifts = [],
  onGiftClick,
  canDragGift,
  onGiftMove,
  sceneFactory = createTreeScene,
  interactive = true,
  anchorRef,
  label,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  // Los manejadores se leen en cada evento: así pueden cambiar sin rehacer la escena.
  const handlers = useRef({});
  handlers.current = { onGiftClick, canDragGift, onGiftMove };

  useEffect(() => {
    sceneRef.current?.setGifts?.(gifts);
  }, [gifts]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const renderer = new CanvasRenderer(canvas);
    const buffer = new AsciiBuffer();
    const scene = sceneFactory({ gifts });
    sceneRef.current = scene;

    const layout = () => {
      const box = wrap.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const grid = renderer.resize(box.width, box.height);
      const a = anchorRef?.current?.getBoundingClientRect();
      if (a) grid.anchor = { x: a.left - box.left, y: a.top - box.top, w: a.width, h: a.height };
      buffer.resize(grid.cols, grid.rows, grid.aspect);
      scene.layout(grid);
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(wrap);
    if (anchorRef?.current) ro.observe(anchorRef.current);

    const stop = startLoop((dt, t) => {
      buffer.clear();
      scene.render(buffer, dt, t);
      buffer.resolveGlows(t);
      renderer.draw(buffer);
    });

    if (!interactive) {
      return () => {
        stop();
        ro.disconnect();
        sceneRef.current = null;
      };
    }

    const cellOf = (e) => {
      const rect = canvas.getBoundingClientRect();
      return renderer.toCell(e.clientX - rect.left, e.clientY - rect.top);
    };
    const giftAt = (e) => {
      const { col, row } = cellOf(e);
      return scene.pick?.(col, row) ?? null;
    };
    const draggable = (id) => Boolean(id && handlers.current.canDragGift?.(id) && scene.beginDrag);

    // Un gesto empieza en 'spin' (girar el árbol) o 'gift' (sobre un regalo mío).
    // Hasta pasar CLICK_SLOP no se decide nada: si se suelta antes, es un clic.
    let gesture = null; // { mode: 'spin' | 'gift', id, lastX, startX, startY, startCell, moving }
    const down = (e) => {
      const id = giftAt(e);
      gesture = {
        mode: draggable(id) ? 'gift' : 'spin',
        id,
        lastX: e.clientX,
        startX: e.clientX,
        startY: e.clientY,
        startCell: cellOf(e),
        moving: false,
      };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (!gesture) {
        const id = giftAt(e);
        canvas.style.cursor = draggable(id) ? 'grab' : id && handlers.current.onGiftClick ? 'pointer' : '';
        return;
      }
      if (!gesture.moving && Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) >= CLICK_SLOP) {
        gesture.moving = true;
        if (gesture.mode === 'gift') {
          const { col, row } = gesture.startCell;
          if (!scene.beginDrag(gesture.id, col, row)) gesture.mode = 'spin';
          else canvas.style.cursor = 'grabbing';
        }
      }
      if (!gesture.moving) return;
      if (gesture.mode === 'gift') {
        const { col, row } = cellOf(e);
        scene.dragTo(col, row);
      } else {
        scene.nudge((e.clientX - gesture.lastX) * 0.02);
      }
      gesture.lastX = e.clientX;
    };
    const up = (e) => {
      const g = gesture;
      gesture = null;
      if (!g) return;
      if (g.moving && g.mode === 'gift') {
        canvas.style.cursor = 'grab';
        const r = scene.endDrag();
        if (r) handlers.current.onGiftMove?.(r.id, r.a, r.rg);
        return;
      }
      if (!g.moving && handlers.current.onGiftClick) {
        const id = giftAt(e);
        if (id) handlers.current.onGiftClick(id);
      }
    };
    const cancel = () => {
      if (gesture?.moving && gesture.mode === 'gift') scene.cancelDrag?.();
      gesture = null;
      canvas.style.cursor = '';
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);

    // Teclado: 1–3 pasos de la intro, R repetir. No interfiere si se escribe en un campo.
    const key = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key >= '1' && e.key <= '3') scene.trigger?.(Number(e.key) - 1);
      else if (e.key === 'r' || e.key === 'R') scene.restart?.();
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
    <div ref={wrapRef} className={`ascii-wrap ${interactive ? '' : 'backdrop'} ${className}`} aria-hidden={interactive ? undefined : true}>
      <canvas
        ref={canvasRef}
        className="ascii-canvas"
        role={interactive ? 'img' : undefined}
        aria-label={interactive ? label ?? 'Árbol de Navidad ASCII con los regalos de la sala' : undefined}
      />
    </div>
  );
}
