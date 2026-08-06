# Performance Audit Log

Memoria persistente del agente `game-performance-booster`. Cada fila es un juego con
engine real auditado contra los antipatrones de render/loop documentados en
`specs/09-frogger-performance.md` (shadowBlur por entidad, asignaciones y strings por
frame, dt sin clamp, estado de canvas sin resetear). El agente lee este archivo para no
re-optimizar sin razón un juego que ya cumple.

Estados: Cumple · Incompleto · Optimizado

- [x] **Frogger** (`ranaria` → `components/games/frogger/engine.ts`) — loop: rAF + dt
      clampeado (100ms) ✓ — shadowBlur/frame: solo rana/metas — allocs/frame: ninguna
      nueva relevante — estado: Optimizado — (2026-08-06, según SPEC 09) glow reducido a
      elementos pocos-por-frame, resto con relleno sólido + borde `rgba(inkRgb, .35)`.

- [x] **Tetris** (`tetris` → `components/games/tetris/engine.ts`) — loop: rAF + dt
      clampeado (100ms) ✓ — shadowBlur/frame: solo pieza activa + ghost + preview
      "siguiente" (≤12 bloques) — allocs/frame: ninguna (loops mutan/leen in-place) —
      estado: Optimizado — (2026-08-06) `drawBlock` ganó parámetro `glow` (default
      `true`); el tablero bloqueado (hasta 200 celdas, crece con la partida) y el ghost
      ahora dibujan con `glow=false` (relleno sólido + borde `rgba(skin.inkRgb, 0.35)`
      en vez de `shadowBlur` por celda); se clampeó `dt` a 100ms en el loop igual que
      Frogger para evitar saltos al volver de un tab en background. No se tocó
      física/colisiones/puntaje ni la firma de `EngineCallbacks`. `TetrisCanvas.tsx` no
      requirió cambios (patrón `useRef`-only intacto).

- [x] **Asteroids** (`rocas` → `components/games/asteroids/engine.ts`) — loop: rAF + dt
      clampeado (50ms) ✓ — shadowBlur/frame: solo nave + power-up (máx. 1 activo) + HUD/vidas
      — allocs/frame: filter/concat existentes en `update()` (bullets/asteroids/particles/
      powerUps), tamaño acotado, se dejaron sin tocar (severidad menor) — estado: Optimizado
      — (2026-08-06) se quitó `shadowBlur`/`shadowColor` por entidad en `Bullet.draw`,
      `Asteroid.draw` (puede haber muchas por nivel alto tras splits) y `Particle.draw`
      (explosiones generan hasta ~25 partículas simultáneas); en `Particle.draw` además se
      reemplazó el string `rgba(${skin.inkRgb}, alpha)` reconstruido por partícula/frame por
      `ctx.globalAlpha` (mismo fade, sin allocación de string por partícula). Glow se
      conservó únicamente en nave, power-up y HUD (pocos elementos por frame), siguiendo el
      mismo patrón aplicado a Frogger en SPEC 09. No se tocó física/colisiones/puntaje ni la
      firma de `EngineCallbacks`; `AsteroidsCanvas.tsx` no requirió cambios.
