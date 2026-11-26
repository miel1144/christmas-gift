import { navigate } from '../../hooks/useRoute';
import AsciiCanvas from '../canvas/AsciiCanvas';
import { createSnowScene } from '../../core/engine/scenes/snow';

const ART = String.raw`
 _  _     ___    _  _
| || |   / _ \  | || |
| || |_ | | | | | || |_
|__   _|| |_| | |__   _|
   |_|   \___/     |_|`;

/**
 * Página para cualquier dirección que no existe, y también para las que existen
 * pero no son para ti (p. ej. /admin sin ser superadmin): así no se revela nada.
 */
export default function NotFound() {
  return (
    <main className="stage">
      <AsciiCanvas sceneFactory={createSnowScene} interactive={false} />
      <pre className="tree not-found-art" aria-hidden="true">{ART}</pre>
      <section className="panel">
        <h1 className="panel-title">[ página no encontrada ]</h1>
        <p className="muted">Esta dirección no existe o no tienes acceso. Revisa el enlace o vuelve al inicio.</p>
        <button className="btn" onClick={() => navigate('/', { replace: true })}>&gt; ir al inicio</button>
      </section>
    </main>
  );
}
