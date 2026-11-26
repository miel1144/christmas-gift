import { TAU, clamp, hash3, rainbowHue } from '../../../../utils/math';
import { T, growth } from './timing';

/**
 * Paso 2: anillo de luz arcoíris que sube por delante de las hojas mientras el
 * árbol crece. Nace como un punto que da una vuelta dejando el anillo dibujado,
 * suelta ondas y chispas, y al llegar a la punta se cierra en un punto (de ahí
 * sale la estrella).
 */
export function drawGrowthRing(buf, { L, t, s2, F, envelope }) {
  const appear = T.grow[0] - 0.6;
  const shut = clamp((F - 0.96) / 0.045);
  if (s2 < appear || shut >= 1) return;

  const { cx, rMax, yBase, treeRows, aspect, tilt } = L;
  const Fc = Math.min(growth(s2 + T.ringLead), 1);
  const fade = clamp((s2 - appear) / 0.22) * (1 - shut);
  const ringR = (f) => rMax * envelope(f) * 1.14 + 2.2;
  const ringY = (f) => yBase - f * treeRows + 0.1 * ringR(f) * aspect;
  const sweepIn = clamp((s2 - appear) / 0.55);
  const Rr = ringR(Fc) * Math.max(0.05, 1 - shut), yF = ringY(Fc);

  // Cuatro anillos de '#': el interior casi blanco, hacia fuera más color y menos opacidad.
  for (let ring = 0; ring < 4; ring++) {
    const R = Rr * (1 + ring * 0.045) + ring * 0.85, steps = Math.ceil(TAU * R * 1.5) + 14;
    for (let q = 0; q < steps; q++) {
      const th = (q / steps) * TAU, phi = th - t * 2.4 * (ring % 2 ? -0.6 : 1);
      const z = R * Math.cos(phi);
      const travelled = ((((phi - Math.PI) % TAU) + TAU) % TAU) / TAU; // desde la espalda del árbol
      if (travelled > sweepIn) continue;
      const x = cx + R * Math.sin(phi), y = yF + z * tilt * 1.45;
      const head = sweepIn < 1 && sweepIn - travelled < 0.022 && ring < 2;
      if (head) {
        buf.plot(x, y, z + 1.7, '@', '#ffffff');
        buf.plot(x, y - 1, z + 1.7, '@', '#ffffff');
        continue;
      }
      const pulse = 0.55 + 0.45 * Math.sin(th * 7 + t * 10);
      const hue = Math.round((th * 114.6 + t * 140) % 360);
      const a = fade * [1, 1, 0.75, 0.45][ring] * (0.7 + 0.3 * pulse);
      buf.plot(x, y, z + 1.6, '#', `hsla(${hue},100%,${[96, 88, 78, 70][ring]}%,${a.toFixed(2)})`);
      if (ring === 0) {
        for (let up = 1; up <= 3; up++) {
          buf.plot(x, y - up, z + 1.6, '#', `hsla(${hue},100%,${92 - up * 6}%,${(a * [0, 0.75, 0.48, 0.24][up]).toFixed(2)})`);
        }
      }
    }
  }
  buf.addGlow(cx, yF, -1, 0.22 * fade, Rr * 0.9 + 4);

  // Motas que suben desde el anillo: el árbol parece salir de la luz.
  for (let j = 0; j < 16; j++) {
    const u = (t * 0.9 + j * 0.31) % 1;
    buf.plot(cx + Math.sin(j * 2.4 + t * 2) * (1 + 2.5 * u), yF - 1 - u * 26, 30, u < 0.4 ? '*' : u < 0.75 ? '+' : '.',
      `hsla(${rainbowHue(j / 16)},100%,90%,${((1 - u) * fade).toFixed(2)})`);
  }

  // Ondas que se abren desde el anillo.
  for (let m = 0; m < 3; m++) {
    const age = (t * 1.5 + m / 3) % 1;
    const fe = Math.min(1, growth(s2 + T.ringLead - age / 1.5));
    if (fe <= 0) continue;
    const R = ringR(fe) * (1 + age * 0.75) + age * 4, steps = Math.ceil(TAU * R * 0.7);
    for (let q = 0; q < steps; q++) {
      const phi = (q / steps) * TAU + m, z = R * Math.cos(phi);
      buf.plot(cx + R * Math.sin(phi), ringY(fe) + z * tilt, z + 1.2, age < 0.35 ? ':' : '.', `rgba(255,255,255,${((1 - age) * 0.85 * fade).toFixed(2)})`);
    }
  }

  // Chispas que saltan del anillo hacia fuera y caen.
  for (let j = 0; j < 54; j++) {
    const cyc = t / 0.9 + j * 0.618, u = cyc % 1;
    const fe = growth(s2 + T.ringLead - u * 0.9);
    if (fe <= 0 || fe > 1.03) continue;
    const f2 = Math.min(1, fe), phi = hash3(j, Math.floor(cyc), 1) * TAU + t * 0.8;
    const R = ringR(f2) * (1 + 0.55 * u), z = R * Math.cos(phi);
    buf.plot(cx + R * Math.sin(phi), ringY(f2) + z * tilt - 6 * u + 9 * u * u, z + 1.4, u < 0.3 ? '*' : u < 0.6 ? '+' : '.',
      `hsla(${rainbowHue(j / 54)},100%,86%,${((1 - u) * fade).toFixed(2)})`);
  }
}
