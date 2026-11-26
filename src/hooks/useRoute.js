import { useEffect, useState } from 'react';

/**
 * Enrutado mínimo con la History API (la app solo tiene tres pantallas):
 *   /                 lobby
 *   /room/<uuid>      sala
 *   /join/<código>    unirse con invitación
 *
 * En producción el hosting debe servir index.html para cualquier ruta.
 */
const listeners = new Set();

export function navigate(path, { replace = false } = {}) {
  if (path === window.location.pathname) return;
  if (replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  listeners.forEach((fn) => fn());
}

export function matchRoute(path) {
  let m;
  if ((m = path.match(/^\/room\/([0-9a-f-]{36})\/?$/i))) return { name: 'room', id: m[1] };
  if ((m = path.match(/^\/join\/([A-Za-z0-9]+)\/?$/))) return { name: 'join', code: m[1] };
  return { name: 'lobby' };
}

export function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return matchRoute(path);
}
