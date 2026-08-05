# Mobile Audit Log

Memoria persistente del agente `mobile-porter`. Cada fila es una ruta o un juego con
engine real auditado contra la calidad móvil de Arcade Vault (overflow horizontal, tap
targets, accesibilidad táctil, y el contrato de controles táctiles de SPEC 08 para
juegos). El agente lee este archivo para no re-auditar sin razón algo que ya cumple.

Estados: Cumple · Incompleto · Corregido

- [x] **rocas / tetris — HUD y controles táctiles compartidos** (`app/juegos/[id]/jugar/page.tsx`, `app/globals.css`) — viewport: 390×844 ✓ — tap targets: OK (D-pad 44px, acción 76px) — táctil: ✓ — estado: Corregido — (2026-08-05) implementado en SPEC 08 (`pressKey`/`releaseKey`, `TouchControls`, reflow de `.player-hud`); registrado aquí retroactivamente porque este archivo de memoria no existía cuando se cerró esa spec.
- [x] **ranaria (Frogger) — engine + FroggerCanvas** (`components/games/frogger/engine.ts`, `components/games/frogger/FroggerCanvas.tsx`) — viewport: 390×844 ✓ / 360×800 ✓ / 768 ✓ — tap targets: OK — táctil: ✓ — estado: Cumple — (2026-08-05) auditado, sin cambios de código necesarios. `pressKey`/`releaseKey` reutilizan `setKeyState` interno (mismo camino que `onKeyDown`); `releaseKey` es no-op intencional porque Frogger es de disparo único (sin `keyup` listener tampoco), documentado en el propio código. `TouchControls` usa `directions={{up,down,left,right}: ArrowUp/Down/Left/Right}` + `actionCode="ArrowUp"`/`actionLabel="SALTO"` (duplica el salto hacia adelante, sin botón de fuego propio). El listener de teclado en `window` no interfiere con touch (caminos de input separados: `PointerEvent` en botones vs `KeyboardEvent` en window). Overlay táctil no tapa tablero jugable (Frogger no tiene HUD propio tipo "siguiente pieza"). `tsc`/`lint`/`build` limpios.
- [x] **/juegos/ranaria y /juegos/ranaria/jugar (rutas genéricas)** (`app/juegos/[id]/page.tsx`, `app/juegos/[id]/jugar/page.tsx`) — viewport: 390×844 ✓ / 768 ✓ — tap targets: OK — táctil: N/A (hereda de la fila anterior) — estado: Cumple — (2026-08-05) ambas rutas son 100% genéricas (`.av-detail` colapsa a 1 columna ≤900px, `.player-hud` se apila ≤720px vía SPEC 08); el texto de catálogo de Ranaria (`lib/data.ts`) es corto y no genera overflow. Sin hallazgos nuevos, sin cambios.

## Hallazgo menor heredado (no bloqueante, no específico de Ranaria)

- `.touch-dpad-btn` / `.touch-action-btn` no tienen regla `:focus-visible` (solo `:active`). Ya existía desde SPEC 08 para `rocas`/`tetris` y aplica igual a Ranaria por ser el mismo componente compartido `TouchControls`. No se corrigió en esta pasada por no ser parte del alcance solicitado (auditoría específica de Ranaria); queda pendiente como mejora de accesibilidad táctil transversal a los 3 juegos si se decide abordarla en una pasada futura.
