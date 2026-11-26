/**
 * Efectos de sonido sintetizados con Web Audio (sin archivos).
 *
 *   drop    cae la luz           disc    se abre el disco
 *   grow    crece el árbol       star    campanita de la estrella
 *   lights  bajan las luces      gift    salta un regalo
 *   letter  se abre una carta
 *
 * El navegador solo deja sonar audio después de una interacción: el contexto se
 * crea (o se reanuda) en el primer clic, toque o tecla. Hasta entonces play() no hace nada.
 *
 * Silencio: recordado por persona en localStorage. subscribe/isMuted sirven para
 * useSyncExternalStore.
 */

const KEY = 'cg.muted';
const VOLUME = 0.5;

let ctx = null;
let master = null;
let noise = null;
let muted = readMuted();
const listeners = new Set();

function readMuted() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const isMuted = () => muted;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setMuted(on) {
  muted = Boolean(on);
  try {
    localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    /* sin almacenamiento: dura lo que dure la pestaña */
  }
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.05);
  listeners.forEach((fn) => fn());
}

function ensureContext() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  master.connect(comp).connect(ctx.destination);
  // Un segundo de ruido blanco, reutilizable para soplidos y papel.
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const ch = noise.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
}

/** Arranca el audio en la primera interacción (se llama una vez al iniciar la app). */
export function installAudioUnlock() {
  const unlock = () => ensureContext();
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
}

// --- Piezas -------------------------------------------------------------

/** Envolvente: sube en `a` s hasta `peak` y cae exponencial en `d` s. */
function env(g, t0, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function tone({ type = 'sine', f, f1, at = 0, a = 0.005, d = 0.4, peak = 0.3, glide, detune = 0, out = master }) {
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(f, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + (glide ?? a + d));
  env(g, t0, a, d, peak);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + a + d + 0.05);
}

function hiss({ at = 0, a = 0.01, d = 0.3, peak = 0.2, type = 'bandpass', f = 2000, f1, q = 1 }) {
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.Q.value = q;
  filt.frequency.setValueAtTime(f, t0);
  if (f1) filt.frequency.exponentialRampToValueAtTime(f1, t0 + a + d);
  const g = ctx.createGain();
  env(g, t0, a, d, peak);
  src.connect(filt).connect(g).connect(master);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + a + d + 0.05);
}

/** Campana: parciales inarmónicos que se apagan a ritmos distintos. */
function bell(f, at = 0, peak = 0.22, d = 2.4) {
  [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]].forEach(([k, w], i) => {
    tone({ f: f * k, at, a: 0.004, d: d / (1 + i * 0.8), peak: peak * w });
  });
}

const PENTA = [0, 2, 4, 7, 9]; // escala pentatónica: suene en el orden que suene, no desafina
const note = (base, step) => base * Math.pow(2, (PENTA[step % 5] + 12 * Math.floor(step / 5)) / 12);

// --- Sonidos -------------------------------------------------------------

const SOUNDS = {
  drop() {
    tone({ f: 2200, f1: 320, d: 0.34, a: 0.01, peak: 0.12, type: 'triangle' });
    hiss({ f: 6000, f1: 900, a: 0.02, d: 0.32, peak: 0.12, q: 0.7 });
  },
  disc() {
    tone({ f: 110, f1: 42, a: 0.005, d: 0.55, peak: 0.5 }); // golpe
    hiss({ type: 'lowpass', f: 900, f1: 200, a: 0.005, d: 0.4, peak: 0.25 });
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      tone({ f, at: 0.05 + i * 0.07, a: 0.25, d: 2.2, peak: 0.06, detune: (i - 2) * 4 });
    });
  },
  grow() {
    // Pasa rozando hacia arriba mientras crece (≈ 4 s).
    tone({ f: 98, f1: 392, at: 0.4, a: 1.5, d: 2.8, glide: 4, peak: 0.08, type: 'triangle' });
    tone({ f: 147, f1: 587, at: 0.4, a: 1.5, d: 2.8, glide: 4, peak: 0.05, type: 'sine', detune: 6 });
    hiss({ f: 300, f1: 3500, at: 0.4, a: 2.2, d: 1.8, peak: 0.05, q: 2 });
  },
  star() {
    bell(1318.5, 0, 0.2);
    bell(1975.5, 0.14, 0.14);
    tone({ f: 2637, at: 0.3, a: 0.4, d: 1.6, peak: 0.03 });
  },
  lights() {
    for (let i = 0; i < 12; i++) {
      const step = 14 - Math.floor(i * 0.9 + Math.random() * 2);
      tone({ f: note(523.25, Math.max(0, step)), at: i * 0.22 + Math.random() * 0.06, a: 0.003, d: 0.5, peak: 0.07, type: 'triangle' });
    }
  },
  gift() {
    const k = 0.85 + Math.random() * 0.35;
    tone({ f: 260 * k, f1: 620 * k, a: 0.004, d: 0.16, glide: 0.09, peak: 0.18, type: 'sine' });
    tone({ f: note(784, Math.floor(Math.random() * 5)), at: 0.06, a: 0.003, d: 0.35, peak: 0.06, type: 'triangle' });
    hiss({ f: 3000, a: 0.002, d: 0.04, peak: 0.08, q: 3 });
  },
  letter() {
    hiss({ f: 1800, a: 0.02, d: 0.18, peak: 0.12, q: 0.8 });
    hiss({ f: 2600, at: 0.12, a: 0.02, d: 0.2, peak: 0.08, q: 0.8 });
    bell(1046.5, 0.18, 0.1, 1.6);
    bell(1568, 0.32, 0.08, 1.6);
  },
};

let lastPlay = {};

export function play(name) {
  if (muted || !ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
  // El mismo sonido dos veces casi a la vez suena a error (p. ej. varios regalos en vivo).
  const now = ctx.currentTime;
  if (now - (lastPlay[name] ?? -1) < 0.06) return;
  lastPlay[name] = now;
  try {
    SOUNDS[name]();
  } catch {
    /* el sonido nunca debe romper nada */
  }
}
