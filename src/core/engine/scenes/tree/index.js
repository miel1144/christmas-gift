import { buildTree } from '../../../geometry/tree';
import { buildGifts } from '../../../geometry/gifts';
import { stageLayout } from '../../../geometry/layout';
import { createSnow, drawSnow } from '../../../physics/snow';
import { createIntro } from '../../intro';
import { T, growth, waveProgress } from './timing';
import { drawFloor } from './floor';
import { drawTrunk } from './trunk';
import { drawFoliage, createCellBuffers } from './foliage';
import { drawBaubles } from './baubles';
import { drawGrowthRing } from './growthRing';
import { drawStar } from './star';
import { drawLightWave } from './lightWave';
import { drawGifts, pickGift } from './gifts';
import { createDust, drawDust } from './dust';
import { TAU } from '../../../../utils/math';

// Hasta dónde se puede arrastrar un regalo (radio alrededor del tronco, en rMax):
// más cerca se mete en el tronco; más lejos se sale del suelo en pantallas estrechas.
const DRAG_RG = [0.75, 1.5];

/**
 * Escena del árbol con intro en 3 pasos:
 *   1. luz y disco · 2. árbol y estrella · 3. luces y regalos
 *
 * API: layout(grid) · render(buf, dt, t) · trigger(paso) · restart() ·
 *      setGifts(specs) · pick(col, row) → id de regalo · nudge(dx) ·
 *      beginDrag(id, col, row) · dragTo(col, row) · endDrag() → { id, a, rg } · cancelDrag() ·
 *      hold(on)
 *
 * hold(true): el puntero está sobre un regalo; el árbol frena hasta pararse para
 * que sea fácil agarrarlo. Mientras se arrastra un regalo el árbol no gira nada,
 * para que el suelo no se mueva bajo el puntero.
 *
 * Profundidades (mayor = delante): nieve −900 · suelo −500 · tronco −5 ·
 * árbol ±rMax · bolas +7 · estrella 70.
 */
export function createTreeScene({ gifts: giftSpecs = [] } = {}) {
  const tree = buildTree();
  const intro = createIntro();
  const dust = createDust();
  let gifts = buildGifts(giftSpecs);
  let born = tree.baubles.map(() => null);
  const boxes = []; // rectángulos de los regalos en pantalla (para hacer clic)
  let lastT = 0;

  let L = null;
  let cell = null;
  let flakes = createSnow();
  let angle = 0;
  let spin = 0; // giro extra por arrastre, decae solo
  let drag = null; // { id, g, a, rg, a0, rg0, dx, dy }: regalo que se está moviendo
  let held = false; // puntero sobre un regalo
  let pace = 1; // 1 = giro normal, 0 = parado (se acerca suave a su objetivo)

  // Centro de la base de un regalo en la rejilla (inverso de toFloor).
  const floorCell = (a, rg) => {
    const cr = Math.cos(angle), sr = Math.sin(angle);
    const gx = rg * Math.sin(a), gz = rg * Math.cos(a);
    const X = gx * cr + gz * sr, Z = gz * cr - gx * sr;
    return { x: L.cx + X * L.rMax, y: L.floorRow + Z * L.rMax * L.floorTilt };
  };

  // Celda de la rejilla → punto del suelo (ángulo y radio alrededor del tronco),
  // deshaciendo la proyección de drawGifts y el giro actual del árbol.
  const toFloor = (col, row) => {
    const X = (col - L.cx) / L.rMax, Z = (row - L.floorRow) / (L.rMax * L.floorTilt);
    const cr = Math.cos(angle), sr = Math.sin(angle);
    const px = X * cr - Z * sr, pz = X * sr + Z * cr;
    const rg = Math.min(DRAG_RG[1], Math.max(DRAG_RG[0], Math.hypot(px, pz)));
    return { a: (Math.atan2(px, pz) + TAU) % TAU, rg };
  };

  const applyDrag = () => {
    if (!drag) return;
    drag.g.a = drag.a;
    drag.g.rg = drag.rg;
    drag.g.dragging = true;
  };

  return {
    layout(grid) {
      L = stageLayout(grid);
      cell = createCellBuffers(grid.cols * grid.rows);
      // Misma densidad de nieve aunque la pantalla sea más ancha que la franja 9:16.
      flakes = createSnow(Math.round((230 * grid.cols) / grid.panelCols));
    },

    setGifts(specs) {
      // Los que ya estaban conservan su momento de entrada; los nuevos, si la intro
      // ya repartió los regalos, saltan ahora mismo.
      const prev = new Map(gifts.map((g) => [g.id, g.bornAt]));
      const introDone = intro.local(2) >= T.giftAt;
      gifts = buildGifts(specs).map((g) => {
        if (g.id && prev.has(g.id)) g.bornAt = prev.get(g.id);
        else if (introDone) g.bornAt = lastT;
        return g;
      });
      // Si llega una lista nueva a mitad de un arrastre, el regalo sigue en la mano.
      if (drag) {
        const g = gifts.find((x) => x.id === drag.id);
        if (g) {
          drag.g = g;
          applyDrag();
        } else {
          drag = null; // lo borraron mientras se movía
        }
      }
    },

    beginDrag(id, col, row) {
      const g = L && gifts.find((x) => x.id === id);
      if (!g) return false;
      const p = floorCell(g.a, g.rg);
      // Se guarda dónde se agarró la caja para que no salte al centro del puntero.
      drag = { id, g, a: g.a, rg: g.rg, a0: g.a, rg0: g.rg, dx: p.x - col, dy: p.y - row };
      spin = 0;
      applyDrag();
      return true;
    },

    dragTo(col, row) {
      if (!drag) return null;
      Object.assign(drag, toFloor(col + drag.dx, row + drag.dy));
      applyDrag();
      return { a: drag.a, rg: drag.rg };
    },

    endDrag() {
      if (!drag) return null;
      const { id, g, a, rg } = drag;
      g.dragging = false;
      drag = null;
      return { id, a, rg };
    },

    hold(on) {
      held = Boolean(on);
    },

    cancelDrag() {
      if (!drag) return;
      Object.assign(drag, { a: drag.a0, rg: drag.rg0 });
      applyDrag();
      drag.g.dragging = false;
      drag = null;
    },

    pick(col, row) {
      return pickGift(boxes, col, row);
    },

    trigger(step) {
      intro.trigger(step);
    },

    restart() {
      intro.restart();
      born = tree.baubles.map(() => null);
      gifts.forEach((g) => { g.bornAt = undefined; });
    },

    get mode() {
      return intro.mode;
    },

    nudge(dx) {
      spin += dx;
    },

    render(buf, dt, t) {
      if (!L) return;
      lastT = t;
      intro.update(t);
      spin *= Math.exp(-dt * 2.5);
      pace += ((held || drag ? 0 : 1) - pace) * Math.min(1, dt * 8);
      if (!drag) angle += (0.5 * pace + spin) * dt;

      const s1 = intro.local(0), s2 = intro.local(1), s3 = intro.local(2);
      const F = growth(s2);
      const S = {
        L, angle, t, s1, s2, s3, F,
        settle: Math.max(0, s2 - (T.grow[0] + 0.78 * (T.grow[1] - T.grow[0]))) * 0.5,
        wave: waveProgress(s3),
        points: tree.points, envelope: tree.envelope,
        baubles: tree.baubles, born, gifts, boxes, dust, cell,
      };

      drawSnow(buf, flakes, t);
      drawFloor(buf, S);
      drawTrunk(buf, S);
      drawFoliage(buf, S);
      drawBaubles(buf, S);
      drawGifts(buf, S);
      drawGrowthRing(buf, S);
      drawDust(buf, S);
      drawLightWave(buf, S);
      drawStar(buf, S);
    },
  };
}
