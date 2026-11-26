import { TAU, ease, span, rainbowHue } from '../../../../utils/math';
import { T } from './timing';

/**
 * Estrella (final del paso 2): primero se enciende un punto en la punta, luego
 * los rayos crecen desde el centro. Después respira despacio y cada 3,6 s da un
 * destello suave. Núcleo, 8 rayos, 8 rayos finos que giran y un anillo de destellos.
 */
export function drawStar(buf, { L, t, s2 }) {
  const stIn = span(s2, T.star[0], T.star[1]);
  if (stIn <= 0) return;
  const { cx, yTop, aspect } = L;
  const sy = Math.floor(yTop) - 2;
  const dot = ease(span(stIn, 0, 0.3));
  const open = ease(span(stIn, 0.22, 1));
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.5);
  const glint = Math.exp(-Math.pow(((t % 3.6) - 0.5) / 0.22, 2)) * open;
  const len = (13 + pulse * 2.2 + glint * 3.2) * open;
  const gold = (l, a) => `hsla(44,66%,${Math.round(l)}%,${a.toFixed(2)})`;

  for (let k = 0; k < 8; k++) {
    const an = (k * TAU) / 8, dx = Math.cos(an), dy = Math.sin(an);
    const Lk = k % 2 ? len * 0.5 : len;
    const ch = k % 4 === 0 ? '-' : k % 4 === 2 ? '|' : k === 1 || k === 5 ? '\\' : '/';
    for (let d = 1; d <= Lk; d += 0.5) {
      const tip = d > Lk * 0.75;
      buf.plot(cx + dx * d, sy + 0.5 + dy * d * aspect, 70, tip ? (k % 4 === 0 ? '.' : ':') : ch,
        gold(80 - (10 * d) / Lk, (1 - (0.55 * d) / Lk) * (0.88 + 0.12 * Math.sin(d * 0.9 - t * 2.2))));
    }
  }
  for (let k = 0; k < 8; k++) {
    const an = (k * TAU) / 8 + TAU / 16 + t * 0.2, Lk = len * 0.32;
    for (let d = 1.5; d <= Lk; d += 0.6) buf.plot(cx + Math.cos(an) * d, sy + 0.5 + Math.sin(an) * d * aspect, 69, '.', gold(78, 0.7 - (0.5 * d) / Lk));
  }

  // El núcleo crece de un punto a su tamaño completo.
  const core = open > 0.6 ? ['  ###  ', '##@@@##', '  ###  '] : dot > 0.5 ? [' ### ', '#@@@#', ' ### '] : ['#@#'];
  core.forEach((row, i) => {
    [...row].forEach((ch, j) => {
      if (ch === ' ') return;
      const color = ch === '@' ? `hsla(46,60%,${Math.round(88 + 6 * pulse)}%,${dot.toFixed(2)})` : gold(70 + 6 * pulse + 6 * glint, dot);
      buf.plot(cx - row.length / 2 + j, sy - (core.length >> 1) + i, 71, ch, color);
    });
  });

  for (let k = 0; k < 16; k++) {
    const an = (k * TAU) / 16 - t * 0.5, R = (11 + Math.sin(t * 1.3 + k) * 0.8) * open;
    const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + k * 1.7);
    if (tw > 0.3) buf.plot(cx + Math.cos(an) * R, sy + 0.5 + Math.sin(an) * R * aspect, 68, tw > 0.85 ? '*' : '+', `hsla(${rainbowHue(k / 16)},70%,86%,${(tw * open).toFixed(2)})`);
  }
  buf.addGlow(cx, sy + 0.5, 46, (0.35 + 0.15 * pulse + 0.2 * glint) * dot, 4 + 6 * open + pulse);
}
