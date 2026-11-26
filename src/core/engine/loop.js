/**
 * Bucle de animación con requestAnimationFrame.
 * `update(dt, t)` recibe segundos; dt se limita para que una pestaña en
 * segundo plano no provoque un salto enorme al volver.
 */
export function startLoop(update) {
  let raf = 0;
  let last = performance.now();
  let t = 0;

  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    t += dt;
    update(dt, t);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => cancelAnimationFrame(raf);
}
