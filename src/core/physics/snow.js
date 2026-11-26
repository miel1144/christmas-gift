import { seeded } from '../../utils/math';

/**
 * Nieve de fondo: copos `+` que caen sin parar y desaparecen por abajo.
 * Coordenadas normalizadas (0..1); la profundidad `d` decide el brillo.
 * La posición sale del tiempo directamente: no hay estado que integrar.
 */
export function createSnow(count = 230, seed = 3) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    x: rand(),
    y: rand(),
    v: 0.015 + rand() * 0.035, // pantallas por segundo
    d: rand(),
  }));
}

/** Dibuja los copos detrás de todo (z muy negativa). */
export function drawSnow(buf, flakes, t) {
  const { cols, rows } = buf;
  for (const s of flakes) {
    const x = (s.x + Math.sin(t * 0.4 + s.d * 9) * 0.004) * cols;
    const y = ((s.y + t * s.v) % 1) * rows;
    buf.plot(x, y, -900, '+', `rgba(248,250,255,${(0.22 + s.d * s.d * 0.78).toFixed(2)})`);
  }
}
