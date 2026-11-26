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

/**
 * Escena del árbol con intro en 3 pasos:
 *   1. luz y disco · 2. árbol y estrella · 3. luces y regalos
 *
 * API: layout(grid) · render(buf, dt, t) · trigger(paso) · restart() ·
 *      setGifts(specs) · pick(col, row) → id de regalo · nudge(dx)
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
      angle += (0.5 + spin) * dt;

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
