# SPEC 07 — Juego real de Tetris

> **Estado:** Aprobado
> **Depende de:** SPEC 05 (juego real de Asteroids), SPEC 06 (leaderboard real)
> **Fecha:** 2026-07-23
> **Objetivo:** Reemplazar la simulación falsa de `/juegos/tetris/jugar` por el juego real de `references/templates/started-games/03-tetris/`, portado a un componente TypeScript de React (tablero + preview de siguiente pieza) integrado al HUD, pausa, modal de fin de partida y guardado de puntajes ya existentes, agregando `tetris` como nueva entrada del catálogo.

## Alcance

**Dentro:**

- Agregar nueva entrada en `lib/data.ts`: `id: "tetris"`, `title: "TETRIS"`, `cat: "PUZZLE"`, `color: "cyan"`, `cover: "cover-tetris"`, reusando el `short`/`long` de la entrada `caida` ("Encaja las piezas antes de que el techo te aplaste...", "Piezas geométricas descienden desde la oscuridad..."), con `best`/`plays` nuevos e independientes (ej. `best: 150000`, `plays: "12.4K"`). La entrada `caida` existente no se toca.
- Agregar la clase `.cover-tetris` en `app/globals.css` (estilo propio, no reutiliza `.cover-tetro`).
- Portar `references/templates/started-games/03-tetris/game.js` a `components/games/tetris/engine.ts`: estado (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`) como variables de closure de `createEngine`, no globals de módulo.
- El engine dibuja en **dos** `<canvas>`: el tablero (300×600) y el preview de la siguiente pieza (120×120) — ambos recibidos por `createEngine(boardCanvas, nextCanvas, callbacks)` (única divergencia respecto al contrato de un solo canvas de Asteroids, documentada explícitamente en el modelo de datos).
- Sin vidas: el engine reporta `onLivesChange(0)` una sola vez al iniciar (valor fijo que nunca vuelve a cambiar); no se reintroduce ningún concepto de vidas.
- `level` se reporta vía `onLevelChange` usando la fórmula ya existente (`Math.floor(lines / 10) + 1`), disparado solo cuando cambia (al limpiar líneas).
- `onScoreChange` se dispara en cada punto donde `score` cambia hoy (línea limpiada, soft drop, hard drop).
- `gameOver` (booleano) mapea directo a `onGameOver(finalScore)` cuando pasa a `true` (no hay estado terminal adicional tipo `'win'`).
- Se elimina el atajo de teclado `P` (`togglePause` interno) y su overlay propio de pausa en DOM — el único camino de pausa es `setPaused()` invocado desde el botón "PAUSA" de React.
- Se agrega `preventDefault()` en `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown` (además de `Space`, que ya lo tenía) para que el juego no scrollee la página.
- `restart()` reutiliza la lógica ya existente de `init()` (reinicia tablero, score, lines, level, spawnea primera pieza).
- Se descarta el toggle de tema claro/oscuro del `game.js` original (líneas 307–330, con su propio `localStorage['tetris-theme']`) — es UI de la página HTML standalone, no lógica del juego; Arcade Vault ya tiene su propio sistema de tema.
- Crear `components/games/tetris/TetrisCanvas.tsx` (`"use client"`): monta ambos `<canvas>` en su propio JSX (tablero centrado, preview en un panel lateral junto al HUD de React, replicando el layout sidebar del original), cada uno con resolución interna fija escalada por CSS de forma independiente (`max-width:100%; height:auto`). `forwardRef` expone `{ restart, setPaused, forceGameOver }` vía `useImperativeHandle`. Un solo `useEffect` (deps `[]`) monta/destruye el engine.
- Reemplazar el check hardcodeado `isAsteroids = id === "rocas"` en `app/juegos/[id]/jugar/page.tsx` por el registro `REAL_GAMES = { rocas: AsteroidsCanvas, tetris: TetrisCanvas }` (patrón documentado en `architecture.md` §4).
- Verificación manual de que el score real de `tetris` aparece en `/juegos/tetris` y `/salon-de-la-fama` (sin cambios de código en el leaderboard).

**Fuera de alcance (para specs futuras):**

- Controles táctiles/móviles.
- Redimensionar dinámicamente los canvas o sus constantes internas según el contenedor.
- Adaptar cualquier otro juego del catálogo (`bloque-buster`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`, `caida`) a implementación real.
- Modificar la entrada `caida` existente en `lib/data.ts`.
- Una interfaz/abstracción genérica de "motor de juego" reutilizable entre títulos (decisión ya tomada en SPEC 05, se mantiene).
- Tocar el modelo de datos de Supabase (`profiles`, `scores`).
- Tests automatizados.

## Modelo de datos

No hay tablas ni persistencia nueva. Se reutiliza `scores` (SPEC 04) sin cambios. El "modelo de datos" de esta spec es el contrato TypeScript entre `engine.ts` y `TetrisCanvas.tsx`, y la nueva entrada de catálogo.

### `lib/data.ts`

```ts
{
  id: "tetris",
  title: "TETRIS",
  short: "Encaja las piezas antes de que el techo te aplaste.",
  long: "Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.",
  cat: "PUZZLE",
  cover: "cover-tetris",
  color: "cyan",
  best: 150000,
  plays: "12.4K",
}
```

### `components/games/tetris/engine.ts`

```ts
export type EngineCallbacks = {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void; // se invoca una sola vez con 0, nunca vuelve a cambiar
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
};

export type TetrisEngine = {
  start: () => void;
  stop: () => void;
  setPaused: (paused: boolean) => void;
  restart: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

export function createEngine(
  boardCanvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  callbacks: EngineCallbacks,
): TetrisEngine;
```

Convenciones (equivalentes a las de SPEC 05, adaptadas):

- Único punto de divergencia respecto al contrato de Asteroids: `createEngine` recibe **dos** canvas (tablero + preview de siguiente pieza) en vez de uno.
- Todo el estado (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`) vive como variables de closure — no globals de módulo.
- Los callbacks se disparan solo cuando el valor realmente cambia.
- `forceGameOver()` fuerza `gameOver = true` y dispara `onGameOver(score)` sin pasar por el flujo normal de `endGame()` más que lo estrictamente necesario para cortar el loop.
- `destroy()` cancela el `requestAnimationFrame` pendiente y remueve los listeners de teclado (`keydown`) registrados por el engine.
- No hay atajo `P` de pausa ni overlay de pausa propio del engine — ambos se eliminan; el overlay de pausa/game over lo maneja React (mismo patrón que Asteroids).

### `components/games/tetris/TetrisCanvas.tsx`

```ts
export type TetrisCanvasHandle = {
  restart: () => void;
  setPaused: (paused: boolean) => void;
  forceGameOver: () => void;
};

type Props = {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
};
```

Cumple exactamente `RealGameHandle`/`RealGameProps` de `architecture.md` §4 para poder entrar al registro `REAL_GAMES` sin tocar el resto de la play page.

## Plan de implementación

1. Agregar la entrada `tetris` en `lib/data.ts` (según el modelo de datos) y la clase `.cover-tetris` en `app/globals.css`. Verificación: `/juegos` muestra la card de TETRIS con su cover; `/juegos/tetris` carga con el leaderboard vacío (sin partidas aún).
2. Crear `components/games/tetris/engine.ts`: portar `game.js` completo (`createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`, `drawBlock`, `drawGrid`, `draw`, `drawNext`, `loop`, `init`) dentro de `createEngine(boardCanvas, nextCanvas, callbacks)`, con todo el estado como variables del closure. Eliminar el atajo `KeyP` y su overlay de pausa interno. Agregar `preventDefault()` en las 4 flechas. Invocar `onScoreChange`/`onLevelChange` en los puntos donde cambian, `onLivesChange(0)` una vez al iniciar, `onGameOver(finalScore)` cuando `gameOver` pasa a `true`. Añadir `setPaused`, `restart` (reutilizando `init()`), `forceGameOver`, `destroy`. Verificar con `npx tsc --noEmit` que compila sin errores antes de conectarlo a React.
3. Crear `components/games/tetris/TetrisCanvas.tsx` (`"use client"`): monta `<canvas width={300} height={600}>` (tablero) y `<canvas width={120} height={120}>` (preview) en un layout de tablero centrado + panel lateral, cada uno escalado por CSS de forma independiente. En `useEffect` (mount): registra `keydown`/`keyup` en `window` con `preventDefault` en las teclas del juego, llama `createEngine(boardCanvas, nextCanvas, callbacks)`, `start()`; cleanup llama `destroy()` y remueve listeners. Expone `restart`/`setPaused`/`forceGameOver` vía `useImperativeHandle`.
4. Refactorizar `app/juegos/[id]/jugar/page.tsx`: reemplazar `isAsteroids = id === "rocas"` por el registro `REAL_GAMES = { rocas: AsteroidsCanvas, tetris: TetrisCanvas }` (tipos `RealGameHandle`/`RealGameProps` de `architecture.md` §4). `lives` se inicializa en 0 y no cambia. El resto del flujo (botones PAUSA/FIN/JUGAR DE NUEVO, `handleGameOver`, `saveScore`) queda igual, ahora resuelto genéricamente contra `REAL_GAMES[id]` en vez del check hardcodeado. Cualquier `id` fuera del registro sigue mostrando la simulación falsa sin cambios.
5. Verificación manual en navegador (`npm run dev`, ir a `/juegos/tetris/jugar`): piezas caen y responden a controles (mover, rotar con `↑`/`X`, soft drop `↓`, hard drop `Espacio`), pieza fantasma se dibuja, preview de siguiente pieza se actualiza al spawnear, líneas completas se limpian y suman puntaje según nivel, velocidad aumenta cada 10 líneas, HUD de React (Jugador/Puntuación/Vidas="0"/Nivel) se mantiene sincronizado con el estado real. PAUSA congela el loop y REANUDAR lo retoma. FIN termina la partida con el score actual y abre el modal. Perder (pieza no puede spawnear) abre el modal automáticamente. JUGAR DE NUEVO reinicia limpio (score/nivel vuelven a 0/1). SALIR o cambiar de ruta no deja `requestAnimationFrame` ni listeners huérfanos (verificar en DevTools tras varias entradas/salidas).
6. Verificación de integración con SPEC 04/06: jugar una partida autenticado, terminarla, confirmar que el score real se guarda en `scores` y aparece en `/juegos/tetris` y `/salon-de-la-fama` para `tetris`. Jugar como invitado y confirmar que no se guarda nada.
7. Revisión final: `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [ ] `npm run build` finaliza sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `/juegos` muestra la card de TETRIS con la clase `.cover-tetris` aplicada.
- [ ] En `/juegos/tetris/jugar`, el canvas real de Tetris (tablero + preview de siguiente pieza) se muestra dentro de `.crt-screen` en vez de la simulación falsa.
- [ ] Los controles (`←` `→` mover, `↑`/`X` rotar, `↓` soft drop, `Espacio` hard drop) responden dentro del canvas y no scrollean la página.
- [ ] Las piezas rotan con wall-kick (`[0,±1,±2]`), la pieza fantasma se dibuja en la posición de caída proyectada.
- [ ] El preview de la siguiente pieza se actualiza correctamente cada vez que spawnea una nueva pieza.
- [ ] Limpiar líneas suma el puntaje correcto (`LINE_SCORES[cleared] × level`) y la velocidad de caída aumenta cada 10 líneas acumuladas.
- [ ] El HUD externo de React (Jugador/Puntuación/Vidas/Nivel) siempre muestra "Vidas: 0" y el resto de valores sincronizados con el engine.
- [ ] El botón "PAUSA" congela el juego y "REANUDAR" lo retoma exactamente donde quedó; la tecla `P` ya no pausa nada.
- [ ] El botón "FIN" termina la partida inmediatamente con el score acumulado y abre el modal de fin de partida.
- [ ] Cuando una pieza nueva no puede spawnear (tablero lleno), se abre automáticamente el modal de fin de partida con el score final.
- [ ] "JUGAR DE NUEVO" reinicia una partida limpia: score en 0, nivel en 1, tablero vacío.
- [ ] Salir de la partida o navegar a otra ruta detiene el loop y remueve los listeners de teclado (verificable en DevTools sin `requestAnimationFrame` activo ni listeners acumulados).
- [ ] Terminar una partida real de `tetris` estando autenticado guarda el score real en la tabla `scores` y aparece en `/juegos/tetris` y `/salon-de-la-fama`.
- [ ] Terminar una partida de `tetris` como invitado no guarda ningún score.
- [ ] `/juegos/rocas/jugar` (Asteroids) y el resto del catálogo con simulación falsa siguen funcionando exactamente igual que antes de esta spec.
- [ ] La entrada `caida` en `lib/data.ts` y su comportamiento en `/juegos/caida` no cambiaron.

## Decisiones

- **Sí:** nuevo id `tetris` en vez de reutilizar la entrada existente `caida`. Evita pisar una entrada ya en uso (rutas, posible `game_id` con scores si alguien jugó su simulación falsa) y mantiene ambos juegos como catálogo independiente.
- **No:** modificar o eliminar la entrada `caida`. Queda intacta con su simulación falsa.
- **Sí:** sintetizar `onLivesChange(0)` una sola vez al iniciar, en vez de omitir el callback. Mantiene el contrato `RealGameHandle`/HUD de React sin necesitar una rama especial para juegos sin vidas; el HUD simplemente muestra "0" de forma constante.
- **Sí:** `createEngine` recibe dos `<canvas>` (tablero + preview) en vez de uno. Es la única divergencia respecto al contrato de Asteroids, necesaria porque el juego original ya usa dos canvas; se documenta explícitamente en vez de forzar un solo canvas artificial.
- **Sí:** eliminar el atajo de teclado `P` y el overlay de pausa propio del engine. Único camino de pausa: el botón de React vía `setPaused()`, igual que se decidió con el auto-restart de Asteroids en SPEC 05 — evita desincronización entre el overlay del juego y el modal de React.
- **Sí:** agregar `preventDefault()` en las 4 flechas (el original solo lo hacía en `Space`). Consistente con el comportamiento ya esperado en Asteroids; evita que el juego scrollee la página.
- **No:** portar el toggle de tema claro/oscuro del `game.js` original. Es UI de la página HTML standalone; Arcade Vault ya tiene su propio sistema de tema, no relacionado con la lógica del juego.
- **Sí:** refactorizar el check hardcodeado `isAsteroids` a un registro `REAL_GAMES`. Es el segundo juego real; postergar este refactor ya no tiene sentido (documentado como paso pendiente en `architecture.md` §4).
- **No:** construir una interfaz genérica de "motor de juego" reutilizable entre títulos. Se mantiene la decisión de SPEC 05 — con dos juegos reales concretos, la abstracción se evalúa cuando haya un tercero que la necesite (además, Tetris ya introduce su propia divergencia de dos canvas, lo que sugeriría que la abstracción tendría que ser más compleja de lo previsto).
- **No:** tocar el modelo de datos de Supabase (`profiles`/`scores`) ni el código de leaderboard. Se reutiliza tal cual.
- **No:** controles táctiles/móviles ni redimensionamiento dinámico del canvas. Mismo alcance que SPEC 05.

## Riesgos

| Riesgo                                                                                                                                | Mitigación                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El segundo canvas (preview) queda desincronizado del primero al portar a TypeScript (ej. no se limpia/redibuja al spawnear)           | Verificación manual explícita en el paso 5 del plan: comprobar que el preview cambia en cada spawn, comparando contra el comportamiento de la demo original.       |
| Bug sutil en `rotateCW`/wall-kick al portar a TypeScript (rotación incorrecta cerca de los bordes)                                    | Verificación manual probando rotación en las 4 columnas de los bordes del tablero antes de cerrar la spec.                                                         |
| El engine deja `requestAnimationFrame` corriendo o listeners de teclado registrados tras desmontar `TetrisCanvas` (navegar a "SALIR") | Cleanup explícito en `useEffect` (`destroy()` + remover listeners), verificado en DevTools entrando/saliendo varias veces (mismo patrón de SPEC 05).               |
| El refactor de `isAsteroids` a `REAL_GAMES` rompe el flujo existente de Asteroids                                                     | Verificación manual de `/juegos/rocas/jugar` completa (no solo Tetris) antes de cerrar la spec, para confirmar que el refactor no regresionó el primer juego real. |
