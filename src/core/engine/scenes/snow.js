import { createSnow, drawSnow } from '../../physics/snow';

/** Escena de fondo: solo nieve cayendo (lobby y pantallas de paso). */
export function createSnowScene() {
  let flakes = createSnow();
  return {
    layout(grid) {
      flakes = createSnow(Math.round((230 * grid.cols) / grid.panelCols));
    },
    render(buf, dt, t) {
      drawSnow(buf, flakes, t);
    },
  };
}
