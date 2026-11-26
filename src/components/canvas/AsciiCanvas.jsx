import { useEffect, useRef } from 'react';
import { AsciiBuffer } from '../../core/engine/AsciiBuffer';
import { CanvasRenderer } from '../../core/engine/renderer';
import { startLoop } from '../../core/engine/loop';
import { Camera } from '../../core/geometry/camera';
import { createTreeScene } from '../../core/engine/scenes/treeScene';

/**
 * Lienzo a pantalla completa que ejecuta la escena ASCII.
 * Arrastrar con ratón o dedo hace girar el árbol.
 */
export default function AsciiCanvas({ className = '' }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const buffer = new AsciiBuffer();
    const camera = new Camera();
    const scene = createTreeScene();
    let renderer = null;
    let aspect = 0.5;

    const layout = () => {
      const { width, height } = wrap.getBoundingClientRect();
      const fontSize = width < 600 ? 10 : 14;
      if (!renderer || renderer.fontSize !== fontSize) renderer = new CanvasRenderer(canvas, { fontSize });
      const grid = renderer.resize(width, height);
      aspect = grid.aspect;
      buffer.resize(grid.cols, grid.rows);
      camera.fit(grid.cols, grid.rows, aspect);
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(wrap);

    const stop = startLoop((dt, t) => {
      buffer.clear();
      scene.render(buffer, camera, dt, t);
      buffer.bloom(3, 0.9, aspect);
      renderer.draw(buffer);
    });

    // Arrastre para girar.
    let lastX = null;
    const down = (e) => {
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (lastX === null) return;
      scene.nudge((e.clientX - lastX) * 0.02);
      lastX = e.clientX;
    };
    const up = () => {
      lastX = null;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    return () => {
      stop();
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`ascii-wrap ${className}`}>
      <canvas ref={canvasRef} className="ascii-canvas" aria-label="Árbol de Navidad ASCII girando" role="img" />
    </div>
  );
}
