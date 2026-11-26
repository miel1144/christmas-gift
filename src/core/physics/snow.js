/**
 * Copos de nieve en una caja 3D alrededor del árbol. Caen, se mecen con el
 * viento y reaparecen arriba al tocar el suelo.
 */
const BOX = { x: 3.2, yTop: 2.4, yBottom: -1.25, zNear: -2.2, zFar: 3 };

function spawn(flake, anywhere) {
  flake.x = (Math.random() * 2 - 1) * BOX.x;
  flake.y = anywhere ? BOX.yBottom + Math.random() * (BOX.yTop - BOX.yBottom) : BOX.yTop;
  flake.z = BOX.zNear + Math.random() * (BOX.zFar - BOX.zNear);
  flake.vy = 0.12 + Math.random() * 0.22;
  flake.phase = Math.random() * Math.PI * 2;
  flake.sway = 0.05 + Math.random() * 0.1;
  return flake;
}

export function createSnow(count = 220) {
  const flakes = Array.from({ length: count }, () => spawn({}, true));

  return {
    flakes,
    update(dt, t, wind = 0) {
      for (const f of flakes) {
        f.y -= f.vy * dt;
        f.x += (Math.sin(t * 0.8 + f.phase) * f.sway + wind) * dt;
        if (f.y < BOX.yBottom) spawn(f, false);
        if (f.x > BOX.x) f.x = -BOX.x;
        else if (f.x < -BOX.x) f.x = BOX.x;
      }
    },
  };
}
