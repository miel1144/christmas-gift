# Christmas Gift ASCII

Mini app social navideña hecha de caracteres. Entras a una **sala** (pública o privada), ves crecer un árbol de Navidad ASCII con gestos de las manos y dejas **regalos con cartas** a otros miembros. Una carta puede llevar contraseña.

> Estado: en desarrollo.

## De qué trata

- **Salas:** cada usuario crea salas públicas, a las que entra cualquiera, o privadas, a las que se entra por invitación.
- **Intro de la sala:** una secuencia ASCII en tres pasos: (1) cae una luz y se abre el disco del suelo, (2) crece el árbol y se enciende la estrella, (3) se encienden las luces y aparecen los regalos de la sala. Cada paso avanza con un gesto de la mano o con el teclado; sin cámara, se reproduce sola.
- **Regalos:** quedan en un anillo alrededor del árbol y giran con él. Solo el destinatario puede abrirlos.
- **Tiempo real:** los regalos nuevos y la gente presente en la sala se actualizan en vivo.
- **Control:** ratón, tacto y teclado como base; el seguimiento de manos con la webcam es una capa opcional.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 4, zustand |
| Render | Motor ASCII propio en `<canvas>` (rejilla de caracteres, Z-buffer, bloom con los propios caracteres) |
| Manos | MediaPipe Hands |
| Sonido | Web Audio API, sintetizado en vivo |
| Backend | Supabase: Auth, Postgres y Realtime |

## Arquitectura

```
navegador
 ├─ React (pantallas, formularios)
 ├─ motor ASCII en <canvas> (escena, animación)
 ├─ input: ratón / tacto / teclado / manos (MediaPipe)
 └─ estado global (zustand)
        │
        ▼
Supabase
 ├─ Auth     (cuentas y sesión)
 ├─ Postgres (perfiles, salas, miembros, regalos, cartas)
 └─ Realtime (regalos y miembros en vivo)
```

La lógica sensible (crear y abrir regalos, unirse a salas) vive en funciones del servidor, y el acceso a los datos lo controla la base de datos, no el cliente.

### Estructura

```
src/
  components/   UI: auth, canvas, layout
  core/         motor ASCII: engine, geometry, input, physics
  services/     acceso a Supabase
  store/        estado global (zustand)
  hooks/ utils/ assets/
supabase/
  migrations/   esquema SQL versionado
```
