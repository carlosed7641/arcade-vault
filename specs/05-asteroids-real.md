# SPEC 05 — Juego real de Asteroids (ROCAS)

> **Estado:** Implementado
> **Depende de:** SPEC 01 (MVP visual/pantallas), SPEC 04 (Supabase auth y scores)
> **Fecha:** 2026-07-22
> **Objetivo:** Reemplazar la simulación falsa de `/juegos/rocas/jugar` (score aleatorio + sprites CSS decorativos) por el juego real de Asteroids de `references/templates/started-games/02-asteroids/`, portado a un componente TypeScript de React que se integra con el HUD, el sistema de pausa, el modal de fin de partida y el guardado de puntajes ya existentes.

## Alcance

**Dentro:**

- Portar la lógica de `references/templates/started-games/02-asteroids/game.js` (clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, loop `update`/`draw`, wrapping toroidal, power-up de disparo triple) a un módulo TypeScript sin dependencias de React: `components/games/asteroids/engine.ts`.
- El engine expone una API imperativa mínima para ser controlado desde React: `create(canvas, callbacks)` que retorna `{ start, stop, setPaused, restart, forceGameOver, destroy }`, y callbacks `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver(finalScore)`.
- Crear `components/games/asteroids/AsteroidsCanvas.tsx` (`"use client"`): monta el canvas 800×600 vía `useRef` + `useEffect`, instancia el engine, registra/limpia los listeners de teclado (`keydown`/`keyup` con `preventDefault` en las teclas del juego para que no scrollee la página), y expone a su padre los callbacks anteriores más un `ref` imperativo (`useImperativeHandle`) con `restart()`, `setPaused()` y `forceGameOver()`.
- El canvas mantiene resolución interna fija 800×600 (coordenadas del juego sin tocar) y se escala visualmente por CSS para caber en `.crt-screen` manteniendo aspect ratio.
- El HUD dibujado dentro del canvas (score/nivel/vidas/power-up activo, ya existente en `game.js`) se conserva tal cual. El HUD externo en React (`hud-stat`: Jugador/Puntuación/Vidas/Nivel) también se conserva, ahora alimentado por los callbacks reales del engine en vez de valores simulados — ambos HUD coexisten (decisión explícita, ver Decisiones).
- Actualizar `app/juegos/[id]/jugar/page.tsx`: cuando `id === "rocas"`, renderiza `<AsteroidsCanvas>` en vez del `game-arena` decorativo con sprites CSS (`.enemy`, `.player-ship`, `.grid-floor`); para cualquier otro `id`, se mantiene la simulación falsa actual sin cambios.
- El botón "PAUSA" para `rocas` llama a `setPaused(true/false)` del engine (congela `update()`, el overlay "EN PAUSA" ya existente se sigue mostrando encima).
- El botón "FIN" para `rocas` llama a `forceGameOver()` del engine, que corta el loop, dispara `onGameOver(score)` con el score actual (sin pasar por la lógica de "perder vidas") y comparte el mismo flujo de modal/guardado que un game over natural (0 vidas).
- Se deshabilita el auto-restart interno del engine al presionar Espacio en game over (el `pressed('Space')` dentro de `update()` en estado `'gameover'` se elimina); el único camino de reinicio es el botón "JUGAR DE NUEVO" del modal, que llama a `restart()` vía el ref imperativo.
- El nivel mostrado en el HUD React usa el `level` real reportado por `onLevelChange`, reemplazando la fórmula simulada `Math.floor(score / 2500) + 1` (esa fórmula se mantiene solo para los demás juegos con simulación falsa).
- El guardado de puntaje (`saveScore({ game: id, score })`, ya implementado en SPEC 04) se dispara igual que hoy: al llegar a `over === true` con `user` autenticado, usando el `score` real reportado por `onScoreChange`.
- Limpieza de listeners y `cancelAnimationFrame` al desmontar `AsteroidsCanvas` (cambio de ruta, salir con "SALIR"), para no dejar loops corriendo en segundo plano ni listeners de teclado huérfanos.

**Fuera de alcance (para specs futuras):**

- Controles táctiles/móviles — el juego sigue siendo solo teclado (flechas + espacio), igual que la plantilla original.
- Redimensionar dinámicamente el canvas o sus constantes internas (`W`/`H`) según el contenedor — se usa escalado por CSS con tamaño interno fijo.
- Adaptar cualquier otro juego del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) a una implementación real — quedan con la simulación falsa.
- Una interfaz/abstracción genérica de "motor de juego" reutilizable entre títulos — se decidió no construirla todavía (ver Decisiones).
- Tocar el modelo de datos de Supabase (`profiles`, `scores`) definido en SPEC 04 — se reutiliza tal cual.
- Tests automatizados.

## Modelo de datos

No hay tablas ni persistencia nueva. El "modelo de datos" de esta spec es el contrato TypeScript entre `engine.ts` y `AsteroidsCanvas.tsx`.

### `components/games/asteroids/engine.ts`

```ts
export type EngineCallbacks = {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
};

export type AsteroidsEngine = {
  start: () => void;
  stop: () => void;
  setPaused: (paused: boolean) => void;
  restart: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

export function createEngine(
  canvas: HTMLCanvasElement,
  callbacks: EngineCallbacks,
): AsteroidsEngine;
```

Convenciones:

- `createEngine` instancia el estado del juego (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`) como variables privadas del closure — no globals de módulo, para que dos instancias (ej. remount) no compartan estado.
- Los callbacks se invocan solo en los frames donde el valor realmente cambia (no en cada `update()`), para evitar renders de React innecesarios.
- `forceGameOver()` fuerza `state = 'gameover'` y dispara `onGameOver(score)` sin pasar por `killShip()` (no decrementa vidas ni dispara explosión).
- `destroy()` cancela el `requestAnimationFrame` pendiente y remueve los listeners de teclado que el engine haya registrado internamente (si los registra él mismo en vez de `AsteroidsCanvas`, ver Decisiones).

### `components/games/asteroids/AsteroidsCanvas.tsx`

```ts
export type AsteroidsCanvasHandle = {
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

`AsteroidsCanvas` se usa vía `useRef<AsteroidsCanvasHandle>` desde `app/juegos/[id]/jugar/page.tsx`, igual que hoy se usan `useState` locales para `score`/`over`/`saved`.

## Plan de implementación

1. Crear `components/games/asteroids/engine.ts`: portar `game.js` completo (constantes, `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, `spawnAsteroids`, `initGame`, `nextLevel`, `explode`, `killShip`, `update`, `drawHUD`, `drawOverlay`, `draw`, `loop`) dentro de `createEngine(canvas, callbacks)`, con todo el estado (`ship`, `bullets`, etc.) como variables del closure en vez de globals de módulo. Tipar con TypeScript (clases con propiedades tipadas, sin `any`). Eliminar el auto-restart con `Space` en estado `'gameover'`. Añadir `forceGameOver()`. Invocar los callbacks (`onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`) en los puntos donde el valor cambia (suma de score, `killShip`, `nextLevel`, transición a `'gameover'`). Verificar con un archivo de prueba suelto (`npx tsc --noEmit`) que compila sin errores antes de conectarlo a React.
2. Crear `components/games/asteroids/AsteroidsCanvas.tsx` (`"use client"`): monta `<canvas width={800} height={600}>` con CSS que lo escala a `max-width: 100%; height: auto;` dentro de su contenedor. En `useEffect` (mount): registra listeners `keydown`/`keyup` en `window` (con `preventDefault` para `ArrowLeft/ArrowRight/ArrowUp/Space` para que no scrolleen la página), llama `createEngine(canvas, callbacks)`, guarda la instancia, llama `start()`. En cleanup: `destroy()` y remueve los listeners. Expone `restart`/`setPaused`/`forceGameOver` vía `useImperativeHandle`. Verificar con una ruta de prueba temporal (o Storybook-less: montar directo en `/juegos/rocas/jugar` en el siguiente paso) que el canvas dibuja y responde a teclado.
3. Actualizar `app/juegos/[id]/jugar/page.tsx`: cuando `game.id === "rocas"`, renderizar `<AsteroidsCanvas ref={engineRef} onScoreChange={setScore} onLivesChange={setLives} onLevelChange={setLevel} onGameOver={handleGameOver} />` dentro de `.crt-screen`, en vez del bloque `.game-arena` decorativo. `lives` y `level` pasan de constantes/fórmula a `useState` alimentados por los callbacks. `handleGameOver(finalScore)` fija `score` final y `over = true` (mismo rol que hoy cumple `endGame`). El botón "PAUSA" llama `engineRef.current?.setPaused(...)`. El botón "FIN" llama `engineRef.current?.forceGameOver()`. El botón "JUGAR DE NUEVO" del modal llama `engineRef.current?.restart()` además de resetear `over`/`saved` en React. Para cualquier otro `id`, el bloque `.game-arena` con sprites CSS y el `setInterval` de score simulado se mantienen exactamente como están hoy (sin tocar ese código).
4. Verificación manual en navegador (`npm run dev`, ir a `/juegos/rocas/jugar`): controles responden (rotar, propulsar, disparar), asteroides se parten, power-up de disparo triple aparece y funciona, HUD del canvas y HUD React muestran los mismos valores en todo momento, PAUSA congela el juego y REANUDAR lo retoma, FIN abre el modal con el score actual, perder las 3 vidas abre el modal automáticamente, JUGAR DE NUEVO reinicia limpio (score/vidas/nivel vuelven a 0/3/1 en ambos HUD), SALIR y cambiar de ruta no deja el loop corriendo (verificar en consola/DevTools que no hay `requestAnimationFrame` huérfano ni listeners acumulados tras varias entradas/salidas).
5. Verificación de integración con SPEC 04: jugar una partida autenticado, terminarla (por game over o por FIN), confirmar que el score real se guarda en `scores` y aparece en `/salon-de-la-fama` para `rocas`. Jugar como invitado y confirmar que no se guarda nada (mismo comportamiento ya existente, sin cambios en esa lógica).
6. Revisión final: `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [x] `npm run build` finaliza sin errores.
- [x] `npm run lint` no reporta errores.
- [x] En `/juegos/rocas/jugar`, el canvas real de Asteroids se muestra dentro de `.crt-screen` en vez de los sprites CSS decorativos (`.enemy`, `.player-ship`, `.grid-floor`).
- [x] Los controles de teclado (`←` `→` rotar, `↑` propulsar, `Espacio` disparar) responden dentro del canvas, y no scrollean ni afectan el resto de la página mientras se juega.
- [x] Los asteroides grandes se parten en medianos y estos en pequeños al ser destruidos por una bala; los pequeños no se parten más.
- [x] El power-up de disparo triple aparece durante la partida y, al recogerlo, la nave dispara 3 balas en abanico durante su duración.
- [x] El HUD dibujado en el canvas (score/nivel/vidas/power-up) y el HUD externo en React (Jugador/Puntuación/Vidas/Nivel) muestran siempre los mismos valores entre sí.
- [x] El botón "PAUSA" congela el juego (nave, asteroides, balas dejan de moverse) y "REANUDAR" lo retoma exactamente donde quedó.
- [x] El botón "FIN" termina la partida inmediatamente con el score acumulado hasta ese momento, sin importar las vidas restantes, y abre el modal de fin de partida.
- [x] Perder las 3 vidas (colisión nave-asteroide) abre automáticamente el modal de fin de partida con el score final.
- [x] "JUGAR DE NUEVO" reinicia una partida limpia: score en 0, vidas en 3, nivel en 1, en ambos HUD.
- [x] Presionar Espacio estando en el modal de fin de partida (canvas detrás en `'gameover'`) NO reinicia el juego por sí solo — solo el botón del modal reinicia.
- [x] Salir de la partida (botón "SALIR" o navegar a otra ruta) detiene el loop del juego y remueve los listeners de teclado (verificable en DevTools: sin `requestAnimationFrame` activo ni listeners acumulados tras entrar/salir varias veces).
- [x] Terminar una partida real de `rocas` estando autenticado guarda el score real (no simulado) en la tabla `scores` y aparece en `/salon-de-la-fama` para ese juego.
- [x] Terminar una partida de `rocas` como invitado no guarda ningún score (comportamiento ya existente, sin cambios).
- [x] Cualquier otro juego del catálogo (`bloque-buster`, `caida`, etc.) en `/juegos/[id]/jugar` sigue mostrando la simulación falsa exactamente igual que antes de esta spec.

## Decisiones

- **Sí:** portar la lógica a TypeScript dentro de un módulo propio (`engine.ts`) en vez de cargar `game.js` tal cual como script. Da tipado, evita globals compartidos entre instancias (importante si el usuario navega entrando/saliendo de la partida) y se integra idiomáticamente con el ciclo de vida de React (`useEffect`/cleanup).
- **Sí:** mostrar ambos HUD (el dibujado en canvas y el externo en React), aunque sea redundante. Decisión explícita del usuario: se prioriza no tocar el HUD original del juego (que ya funciona y se ve bien) sobre eliminar la duplicación visual.
- **Sí:** solo el juego `rocas` (Asteroids) se reemplaza en esta spec. Es la única plantilla con implementación real disponible hoy (`references/templates/started-games/02-asteroids/`); adaptar Tetris/Arkanoid u otros es trabajo futuro con sus propias specs.
- **No:** construir una interfaz genérica de "motor de juego" reutilizable entre títulos. Con un solo juego real implementado, esa abstracción sería especulativa; se revisita cuando exista un segundo juego real que la necesite.
- **Sí:** canvas con resolución interna fija (800×600) escalado por CSS, en vez de redimensionar dinámicamente las constantes del juego. Evita tocar toda la lógica de posiciones/radios/spawn del motor original; el costo es que en pantallas muy angostas el juego se ve más pequeño (aceptable, sin controles táctiles de todas formas).
- **Sí:** el botón "FIN" fuerza game over inmediato con el score actual, reutilizando el mismo flujo de modal/guardado que un game over natural. Mantiene consistencia con el comportamiento ya existente en la simulación falsa (donde "FIN" también termina la partida manualmente en cualquier momento).
- **Sí:** se elimina el auto-restart interno del engine (Espacio en game over). El único camino de reinicio es el botón del modal de React, para que el estado de React (`over`, `saved`, `score`) y el estado del engine nunca queden desincronizados.
- **No:** controles táctiles/móviles en esta spec. El juego original es solo teclado; agregarlos es una ampliación de alcance no pedida, queda como spec futura si se necesita jugar desde dispositivos táctiles.
- **No:** tocar el modelo de datos de Supabase (`profiles`/`scores`) de SPEC 04. Se reutiliza `saveScore` tal cual, solo cambia el origen del `score` (real en vez de simulado).

## Riesgos

| Riesgo                                                                                                                                                   | Mitigación                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El engine deja un `requestAnimationFrame` corriendo o listeners de teclado registrados tras desmontar el componente (ej. navegar a "SALIR")              | Cleanup explícito en `useEffect` de `AsteroidsCanvas` (`destroy()` + remover listeners); verificado manualmente en el paso 4 del plan entrando/saliendo varias veces con DevTools.                                                 |
| Las teclas del juego (flechas, espacio) interfieren con el scroll de la página o con otros atajos del sitio mientras se juega                            | `preventDefault()` en los listeners de teclado del juego, registrados solo mientras `AsteroidsCanvas` está montado.                                                                                                                |
| Desincronización entre el estado interno del engine y el HUD/modal de React (ej. el modal se cierra pero el engine sigue en `'gameover'`, o al revés)    | Único punto de verdad para transiciones: los callbacks (`onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`) son la única vía por la que el engine informa a React; React nunca lee el estado del engine directamente. |
| Portar `game.js` a TypeScript introduce un bug sutil (ej. en el closure de estado, colisiones, o el cálculo de wrap toroidal) no presente en el original | Verificación manual exhaustiva en el paso 4 del plan (splits, power-up, colisiones, pausa, HUD) comparando comportamiento contra la demo original antes de cerrar la spec.                                                         |
