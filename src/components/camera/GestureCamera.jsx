import { useEffect, useRef, useState } from 'react';
import { HAND_LINKS, cameraErrorMessage, listCameras, startHandTracker } from '../../core/input/handTracker';
import { POSE_LABELS, classifyPose, isHeart, measureHand } from '../../core/input/poses';
import { createGestureDetector } from '../../core/input/gestures';

const CAMERA_KEY = 'cg.camera';
const STEPS = [
  { gesture: 'puño → abrir', what: 'luz y disco' },
  { gesture: 'sube la mano abierta', what: 'árbol y estrella' },
  { gesture: 'pellizco (pulgar + índice)', what: 'luces y regalos' },
];

const readCamera = () => {
  try {
    return localStorage.getItem(CAMERA_KEY) || null;
  } catch {
    return null;
  }
};
const saveCamera = (id) => {
  try {
    if (id) localStorage.setItem(CAMERA_KEY, id);
    else localStorage.removeItem(CAMERA_KEY);
  } catch {
    /* no pasa nada */
  }
};

/**
 * Gestos con la cámara: primero explica y pide permiso; después muestra una vista
 * pequeña en espejo con la mano dibujada, el gesto reconocido y la guía de la intro.
 *
 * `sceneRef.current`: la escena del árbol (trigger, nudge, restart, started, introDone).
 * `onHeart()`: corazón con las dos manos (abrir mi siguiente regalo).
 * Al activarse, la intro vuelve a empezar y espera los gestos (modo manual).
 * Sin cámara o sin permiso, el teclado y el ratón siguen funcionando igual.
 */
export default function GestureCamera({ sceneRef, onHeart, onClose }) {
  const videoRef = useRef(null);
  const drawRef = useRef(null);
  const trackerRef = useRef(null);
  const detectorRef = useRef(createGestureDetector());
  const prevPoseRef = useRef(null);
  const restartedRef = useRef(false);
  const [phase, setPhase] = useState('ask'); // ask | starting | on | error
  const [error, setError] = useState(null);
  const [cams, setCams] = useState([]);
  const [deviceId, setDeviceId] = useState(readCamera);
  const [ui, setUi] = useState({ pose: null, started: 0, done: false });
  const [flash, setFlash] = useState(null); // último gesto reconocido
  const flashTimer = useRef(null);
  const uiRef = useRef(ui);
  // Se lee en cada fotograma: así puede cambiar sin rehacer la cámara.
  const handlers = useRef({});
  handlers.current = { onHeart };

  const stop = () => {
    trackerRef.current?.stop();
    trackerRef.current = null;
  };
  useEffect(() => () => {
    stop();
    clearTimeout(flashTimer.current);
  }, []);

  useEffect(() => {
    if (phase !== 'ask' && phase !== 'error') return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  const onResults = ({ hands, aspect, t }) => {
    const scene = sceneRef.current;
    const ctx = { introDone: Boolean(scene?.introDone) };
    let pose = null;
    let events;
    if (hands.length >= 2) {
      // Dos manos: solo cuenta el corazón.
      ctx.heart = isHeart(hands[0], hands[1], aspect, prevPoseRef.current === 'heart');
      pose = ctx.heart ? 'heart' : 'two';
      events = detectorRef.current.update(t, null, null, ctx);
    } else if (hands.length === 1) {
      const m = measureHand(hands[0], aspect);
      pose = classifyPose(m, prevPoseRef.current);
      events = detectorRef.current.update(t, m, pose, ctx);
    } else {
      events = detectorRef.current.update(t, null, null, ctx);
    }
    for (const ev of events) {
      if (ev.type === 'spin') scene?.nudge(ev.dx);
      else if (ev.type === 'step') scene?.trigger(ev.step);
      else if (ev.type === 'restart') scene?.restart();
      else if (ev.type === 'heart') handlers.current.onHeart?.();
      if (ev.label) {
        setFlash(ev.label);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 1300);
      }
    }
    prevPoseRef.current = pose;
    drawHands(drawRef.current, hands, pose);

    // Solo se repinta React cuando cambia algo visible.
    const next = { pose, started: scene?.started ?? 0, done: Boolean(scene?.introDone) };
    const cur = uiRef.current;
    if (next.pose !== cur.pose || next.started !== cur.started || next.done !== cur.done) {
      uiRef.current = next;
      setUi(next);
    }
  };

  const start = async (id = deviceId) => {
    stop();
    setPhase('starting');
    setError(null);
    detectorRef.current.reset();
    try {
      let tracker;
      try {
        tracker = await startHandTracker({ video: videoRef.current, deviceId: id, onResults });
      } catch (e) {
        // La cámara recordada ya no está (p. ej. Iriun cerrado): probar con la de siempre.
        if (!id || (e?.name !== 'OverconstrainedError' && e?.name !== 'NotFoundError')) throw e;
        id = null;
        tracker = await startHandTracker({ video: videoRef.current, deviceId: null, onResults });
      }
      trackerRef.current = tracker;
      setPhase('on');
      // La cámara que se abrió de verdad (si se pidió «la de siempre»).
      const real = videoRef.current?.srcObject?.getVideoTracks?.()[0]?.getSettings?.().deviceId ?? id;
      setDeviceId(real);
      listCameras().then(setCams).catch(() => {});
      if (!restartedRef.current) {
        restartedRef.current = true;
        sceneRef.current?.restart('manual');
      }
    } catch (e) {
      setError(cameraErrorMessage(e));
      setPhase('error');
    }
  };

  const chooseCamera = (id) => {
    saveCamera(id);
    setDeviceId(id);
    start(id);
  };

  const close = () => {
    stop();
    onClose();
  };

  const asking = phase === 'ask' || phase === 'error';
  const current = ui.started; // índice del paso que toca (3 = todos hechos)

  // El vídeo vive siempre en la misma caja (oculta mientras se pregunta): si React
  // lo cambiara por otro elemento, se perdería la imagen de la cámara.
  return (
    <>
      {asking && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cam-title" onClick={(e) => e.stopPropagation()}>
            <h2 className="panel-title" id="cam-title">[ gestos con la cámara ]</h2>
            <p className="msg">
              Haz la intro con la mano en vez de con las teclas. La imagen no sale de tu navegador:
              el reconocimiento de la mano se hace aquí mismo y no se graba ni se envía nada.
            </p>
            <ol className="cam-guide">
              {STEPS.map((s) => (
                <li key={s.what}><span className="cam-gesture">{s.gesture}</span> · {s.what}</li>
              ))}
            </ol>
            <p className="msg cam-extras">
              además: mueve el índice de lado a lado para girar el árbol · levanta el índice 1 s
              para repetir · haz un corazón con las dos manos para abrir tu siguiente regalo
            </p>
            <p className="msg pending">La intro volverá a empezar y esperará tus gestos.</p>
            {error && <p className="msg fail" role="alert">{error}</p>}
            <div className="confirm-actions">
              <button className="btn ghost" onClick={close}>cancelar</button>
              <button className="btn" onClick={() => start()} autoFocus>
                {phase === 'error' ? '> reintentar' : '> activar cámara'}
              </button>
            </div>
          </div>
        </div>
      )}
      <aside className="cam-box" aria-label="Gestos con la cámara" hidden={asking}>
        <div className="cam-view">
          <video ref={videoRef} className="cam-video" muted playsInline />
          <canvas ref={drawRef} className="cam-draw" width={240} height={180} />
          {phase === 'starting' && <p className="cam-status">cargando reconocimiento...</p>}
          {phase === 'on' && (
            <p className={`cam-status ${flash ? 'hit' : ''}`} aria-live="polite">
              {flash ?? (ui.pose ? POSE_LABELS[ui.pose] : 'no veo ninguna mano')}
            </p>
          )}
        </div>
        <ol className="cam-guide">
          {STEPS.map((s, i) => (
            <li key={s.what} className={i < current ? 'done' : i === current ? 'now' : ''}>
              {i < current ? '✓' : i === current ? '›' : '·'} <span className="cam-gesture">{s.gesture}</span>
            </li>
          ))}
        </ol>
        <p className="cam-extras">
          {ui.done ? 'índice arriba 1 s: repetir · ' : ''}índice de lado a lado: girar · corazón con las 2 manos: abrir tu regalo
        </p>
        <div className="cam-actions">
          {cams.length > 1 && (
            <select className="cam-select" value={deviceId ?? ''} onChange={(e) => chooseCamera(e.target.value)} aria-label="Cámara">
              {cams.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          )}
          <button className="link" onClick={close}>apagar</button>
        </div>
      </aside>
    </>
  );
}

/** Dibuja las manos (en espejo, como el vídeo) sobre el lienzo de la vista previa. */
function drawHands(canvas, hands, pose) {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  g.clearRect(0, 0, w, h);
  const color =
    pose === 'heart' ? 'hsl(354,80%,65%)'
      : pose === 'pinch' ? 'hsl(44,66%,75%)'
        : pose === 'fist' ? 'hsl(20,80%,62%)'
          : pose === 'open' || pose === 'point' ? 'hsl(150,60%,55%)'
            : 'rgba(248,250,255,0.8)';
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 2;
  for (const lm of hands) {
    g.beginPath();
    for (const [a, b] of HAND_LINKS) {
      g.moveTo(lm[a].x * w, lm[a].y * h);
      g.lineTo(lm[b].x * w, lm[b].y * h);
    }
    g.stroke();
    for (const p of lm) {
      g.beginPath();
      g.arc(p.x * w, p.y * h, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  }
}
