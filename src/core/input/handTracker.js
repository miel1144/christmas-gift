/**
 * Cámara + MediaPipe Hands, todo en el navegador: la imagen nunca sale de aquí.
 *
 * MediaPipe se carga la primera vez que alguien activa la cámara (es un script
 * clásico que crea `window.Hands` y descarga ~10 MB de .wasm y modelo desde
 * /mediapipe/hands/, que publica el plugin de vite.config.js).
 *
 * startHandTracker({ video, deviceId, onResults }) → { stop() }
 *   onResults({ hands: [puntos de cada mano], aspect, t })  ~30 veces por segundo
 */

const BASE = '/mediapipe/hands/';
let scriptPromise = null;
// Una sola instancia de Hands para toda la página: crearla y cerrarla varias veces
// da problemas con su wasm, y así reactivar la cámara es inmediato.
let handsPromise = null;
let current = null; // quién recibe los resultados ahora

function getHands(Hands) {
  if (!handsPromise) {
    const hands = new Hands({ locateFile: (f) => `${BASE}${f}` });
    hands.setOptions({
      maxNumHands: 2, // dos para el corazón
      modelComplexity: 0, // el modelo ligero va de sobra para gestos y pesa la mitad
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
      selfieMode: true, // puntos en espejo, como se ve uno mismo
    });
    hands.onResults((r) => current?.(r));
    handsPromise = hands
      .initialize()
      .then(() => hands)
      .catch(() => {
        handsPromise = null;
        throw new Error('mediapipe');
      });
  }
  return handsPromise;
}

function loadHandsScript() {
  if (window.Hands) return Promise.resolve(window.Hands);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = `${BASE}hands.js`;
      el.async = true;
      el.crossOrigin = 'anonymous';
      el.onload = () => (window.Hands ? resolve(window.Hands) : reject(new Error('mediapipe')));
      el.onerror = () => reject(new Error('mediapipe'));
      document.head.appendChild(el);
    }).catch((e) => {
      scriptPromise = null; // que se pueda reintentar
      throw e;
    });
  }
  return scriptPromise;
}

/** Mensaje legible para un fallo al abrir la cámara o cargar el modelo. */
export function cameraErrorMessage(e) {
  const name = e?.name ?? '';
  if (e?.message === 'insecure') return 'La cámara solo funciona en una página segura (https o localhost).';
  if (e?.message === 'mediapipe') return 'No se pudo cargar el reconocimiento de manos. Revisa la conexión e inténtalo otra vez.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'El navegador no dio permiso para usar la cámara. Puedes activarlo en el candado de la barra de direcciones.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se encontró ninguna cámara.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'La cámara está ocupada por otra aplicación.';
  return 'No se pudo abrir la cámara.';
}

/** Cámaras disponibles (con nombre solo después de dar permiso). */
export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || `cámara ${i + 1}` }));
}

export async function startHandTracker({ video, deviceId, onResults }) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('insecure');

  // Pedir la cámara y cargar MediaPipe a la vez.
  const [stream, Hands] = await Promise.all([
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    }),
    loadHandsScript().catch((e) => e),
  ]);
  if (Hands instanceof Error) {
    stream.getTracks().forEach((tr) => tr.stop());
    throw Hands;
  }

  let stopped = false;
  let raf = 0;
  let busy = false;

  try {
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => {});
    const hands = await getHands(Hands);
    current = (r) => {
      if (stopped) return;
      onResults({
        hands: r.multiHandLandmarks ?? [],
        aspect: (video.videoWidth || 4) / (video.videoHeight || 3),
        t: performance.now() / 1000,
      });
    };

    const tick = async () => {
      if (stopped) return;
      if (!busy && video.readyState >= 2 && !document.hidden) {
        busy = true;
        try {
          await hands.send({ image: video });
        } catch {
          /* un fotograma perdido no importa */
        }
        busy = false;
      }
      if (!stopped) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  } catch (e) {
    stream.getTracks().forEach((tr) => tr.stop());
    video.srcObject = null;
    throw e;
  }

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((tr) => tr.stop());
      video.srcObject = null;
    },
  };
}

/** Conexiones entre puntos para dibujar el esqueleto de la mano. */
export const HAND_LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
