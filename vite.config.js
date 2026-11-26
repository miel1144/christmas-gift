import { createReadStream, cpSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * MediaPipe Hands no es un módulo ES: es un script que crea `window.Hands` y que
 * después descarga sus .wasm, .data y .tflite desde la misma carpeta. Por eso no
 * pasa por el empaquetador: se publica tal cual en /mediapipe/hands/ y la app
 * lo carga solo cuando alguien activa la cámara.
 */
const HANDS_DIR = resolve('node_modules/@mediapipe/hands');
const HANDS_URL = '/mediapipe/hands/';

function mediapipeHands() {
  let outDir = 'dist';
  return {
    name: 'mediapipe-hands',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(HANDS_URL, (req, res, next) => {
        const name = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '');
        const file = join(HANDS_DIR, name);
        if (!name || name.includes('..') || !existsSync(file) || !statSync(file).isFile()) return next();
        if (name.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
        else if (name.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript');
        else res.setHeader('Content-Type', 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const dest = join(outDir, HANDS_URL);
      mkdirSync(dest, { recursive: true });
      cpSync(HANDS_DIR, dest, {
        recursive: true,
        filter: (src) => !/(README\.md|package\.json|index\.d\.ts)$/.test(src),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), mediapipeHands()],
});
