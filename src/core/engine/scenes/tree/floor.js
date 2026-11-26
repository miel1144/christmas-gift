import { TAU, clamp, ease, hash3, rainbowHue } from '../../../../utils/math';
import { T } from './timing';

/**
 * Paso 1 · luz y disco.
 * Cae una luz con estela; al tocar el suelo el mandala dorado se abre desde el
 * centro (el frente de apertura brilla), salen tres anillos de impacto, ondas
 * finas y un puñado de chispas. Después el mandala gira con el árbol, con una
 * franja de luz que lo barre y una onda que sale del tronco.
 */
export function drawFloor(buf, { L, angle, t, s1 }) {
  if (s1 < 0) return;
  const { cx, floorRow, rows } = L;

  if (s1 < T.drop) {
    const d = s1 / T.drop, y = floorRow - (1 - d * d) * rows * 0.6;
    for (let q = 0; q < 22; q++) {
      for (let w = -1; w <= 1; w++) {
        if (w && q > 9) continue;
        const ch = q < 2 ? '@' : w ? ':' : q < 8 ? '#' : '|';
        buf.plot(cx + w, y - q, 40, ch, `hsla(50,60%,${97 - q * 1.6}%,${((1 - q / 22) * (w ? 0.6 : 1)).toFixed(2)})`);
      }
    }
    buf.addGlow(cx, y, -1, 1.2, 8);
    return;
  }

  const sp = s1 - T.drop;
  if (sp < 0.6) buf.addGlow(cx, floorRow - 2, -1, 1.8 * (1 - sp / 0.6), 10 + sp * 40); // destello del impacto
  drawMandala(buf, L, angle, t, sp);
  drawImpact(buf, L, sp);
}

function drawMandala(buf, L, angle, t, sp) {
  const { cx, floorRow, panelCols, floorTilt, cols, rows } = L;
  const Rs = panelCols * 0.8, Rb = Rs * floorTilt;
  const rf = ease(sp / T.spread); // radio abierto (0..1)
  const hot = 1 - ease(sp / 0.9); // el disco nace muy brillante y se enfría
  const wave = (t * 0.38) % 1.25;
  const reach = sp < 2.5 ? 1.45 : 1; // al principio hay ondas por fuera del disco
  const x0 = Math.max(0, Math.floor(cx - Rs * reach)), x1 = Math.min(cols - 1, Math.ceil(cx + Rs * reach));
  const y0 = Math.max(0, Math.floor(floorRow - Rb * reach)), y1 = Math.min(rows - 1, Math.ceil(floorRow + Rb * reach));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ex = (x + 0.5 - cx) / Rs, ey = (y + 0.5 - floorRow) / Rb;
      const rho = Math.hypot(ex, ey);

      if (rho > 1 || rho > rf) {
        // Ondas finas que salen mientras se abre.
        for (let m = 0; m < 3; m++) {
          const rr = (sp - m * 0.2) * 1.5;
          if (rr > 0 && rr < 1.45 && Math.abs(rho - rr) < 0.035 && rho > Math.min(1, rf)) {
            buf.plot(x, y, -480, rr < 0.8 ? ':' : '.', `hsla(50,40%,94%,${((1 - rr / 1.45) * 0.9).toFixed(2)})`);
          }
        }
        continue;
      }

      const lam = Math.atan2(ex, ey) - angle; // gira con el árbol
      const front = rf < 1 ? clamp(1 - (rf - rho) / 0.24) : 0;
      // De fuera hacia dentro: doble borde · pétalos en arco · anillo · copo de 8 brazos · anillo interior.
      const border = rho > 0.955 || (rho > 0.9 && rho < 0.925);
      const c8 = Math.abs(Math.cos(lam * 8));
      const petal = rho > 0.68 && rho < 0.9 && rho < 0.7 + 0.2 * Math.pow(c8, 0.7) && rho > 0.88 - 0.2 * Math.pow(c8, 3);
      const ring = (rho > 0.62 && rho < 0.668) || (rho > 0.3 && rho < 0.345);
      const s4 = Math.abs(Math.sin(lam * 4));
      const spoke = rho >= 0.345 && rho <= 0.62 && (s4 < 0.05 / rho || (rho > 0.47 && rho < 0.56 && s4 < 0.2 - Math.abs(rho - 0.515) * 3));
      const mark = border || petal || ring || spoke;
      const h = hash3(x, y, 5);
      if (h > (mark ? 0.94 : 0.72) + hot * 0.3) continue; // el fondo queda relleno al 70 %

      const sweep = Math.pow(Math.max(0, Math.cos(Math.atan2(ey, ex) - t * 1.15)), 14);
      const pulse = Math.exp(-Math.pow((rho - wave) * 9, 2));
      const lift = Math.max(front, 0.5 * sweep, 0.5 * pulse);
      const ch = front > 0.4 || (hot > 0.5 && h < hot) ? '#' : border || spoke ? '#' : ring ? '=' : petal ? '+' : '-';
      const light = Math.round(Math.min(97, (mark ? 56 : 28) + 14 * lift + 40 * hot + 14 * front));
      const alpha = mark ? 1 : 0.7 + 0.3 * hot;
      buf.plot(x, y, -500, ch, `hsla(46,${mark ? 34 : 16}%,${light}%,${alpha.toFixed(2)})`);
    }
  }

  // Motas doradas que suben desde el borde.
  if (sp > 0.6) {
    for (let j = 0; j < 30; j++) {
      const u = (t * 0.45 + j * 0.377) % 1, a = j * 2.399 + t * 0.15;
      const x = cx + Rs * 0.97 * Math.cos(a), y = floorRow + Rb * 0.97 * Math.sin(a) - u * (5 + (j % 4) * 2);
      buf.plot(x, y, Math.sin(a) > 0 ? 45 : -450, u < 0.35 ? '*' : u < 0.7 ? '+' : '.', `hsla(50,45%,94%,${((1 - u) * 0.95).toFixed(2)})`);
    }
  }
}

/** Anillos gruesos de impacto y chispas: todo pegado al suelo y apagado en ~1 s. */
function drawImpact(buf, L, sp) {
  const { cx, floorRow, panelCols, floorTilt, aspect } = L;
  const Rs = panelCols * 0.8, Rb = Rs * floorTilt;
  for (let m = 0; m < 3; m++) {
    const rr = (sp - m * 0.15) * 1.9;
    if (rr <= 0.03 || rr > 1.8) continue;
    const a = Math.pow(1 - rr / 1.8, 0.7), steps = Math.ceil(TAU * Rs * rr * 1.2) + 20;
    for (let q = 0; q < steps; q++) {
      const an = (q / steps) * TAU, x = cx + Rs * rr * Math.cos(an), y = floorRow + Rb * rr * Math.sin(an);
      for (let w = 0; w < 3 - m; w++) {
        buf.plot(x, y - w * 0.9, Math.sin(an) > 0 ? 43 : -460, '#', `hsla(${48 - m * 4},${50 + m * 20}%,${96 - m * 8}%,${(a * (1 - w * 0.25)).toFixed(2)})`);
      }
    }
  }
  if (sp < 1.1) {
    for (let j = 0; j < 80; j++) {
      const an = 0.25 + hash3(j, 1, 7) * (Math.PI - 0.5), v = 26 + hash3(j, 2, 7) * 46, life = 0.55 + hash3(j, 3, 7) * 0.55;
      const u = sp / life;
      if (u > 1) continue;
      const x = cx + Math.cos(an) * v * sp * 1.25;
      const y = floorRow - (Math.sin(an) * v * sp - 34 * sp * sp) * aspect * 1.5;
      const hue = j % 3 ? 48 : rainbowHue(j / 80);
      buf.plot(x, y, 44, u < 0.35 ? '*' : u < 0.7 ? '+' : '.', `hsla(${hue},${j % 3 ? 60 : 85}%,${Math.round(94 - u * 10)}%,${(1 - u * u).toFixed(2)})`);
    }
  }
}
