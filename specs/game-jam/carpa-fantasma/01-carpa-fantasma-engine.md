# SPEC 01 — Motor real de CARPA FANTASMA (engine + canvas)

> **Estado:** Borrador
> **Depende de:** SPEC 05 (asteroids-real), SPEC 07 (tetris-real), SPEC 08 (controles táctiles móviles) — como patrón técnico de referencia, no como dependencia de código a modificar.
> **Fecha:** 2026-08-06
> **Objetivo:** Diseñar `components/games/carpa-fantasma/engine.ts` y `components/games/carpa-fantasma/CarpaFantasmaCanvas.tsx`, un juego real de tipo "atrapa objetos" ambientado en un circo espectral que solo abre a medianoche, jugable de forma aislada por teclado y por controles táctiles, cumpliendo desde el día uno el contrato de motor/canvas/skins/táctil ya vigente en `rocas`, `tetris` y `ranaria`.

## Alcance

**Dentro:**

- Tema: **CARPA FANTASMA**. El jugador controla al **Domador de Sombras**, un carrito-farol que se desliza por el borde inferior de la pista central de una carpa de circo espectral. Desde lo alto, trapecistas fantasmales y animales imposibles dejan caer objetos del espectáculo que hay que atrapar con la red del carrito antes de que toquen la arena, mientras esquivan (sin atrapar) a los cuervos fantasma que sabotean la función.
- Crear `components/games/carpa-fantasma/engine.ts`: módulo TypeScript sin dependencias de React. Todo el estado (posición del carrito, lista de objetos cayendo, `score`, `lives`, `level`, combo, temporizador de la red, `paused`, `gameOver`) vive como variables de **closure** de `createEngine`, nunca como globals de módulo.
- El engine consume `Skin` desde `components/games/skins.ts` igual que los 3 juegos reales existentes: recibe un `initialSkin?` opcional (default `SKINS[DEFAULT_SKIN]`), guarda el skin activo en una variable de closure mutable que el `draw()` lee cada frame, y expone `setSkin(next)` que solo reasigna esa variable y fuerza un redraw inmediato — nunca recrea el engine ni reinicia la partida. Cero literales hex/rgba sueltos dentro de `engine.ts`: todo color de trazo/relleno/HUD sale de `skin.ink` / `skin.inkRgb` / `skin.inkDim` / `skin.accent` / `skin.grid` / `skin.flameRgb` / `skin.glow` / `skin.font` / `skin.palette`. El juego nace ya cumpliendo los 3 skins obligatorios (`clasico`, `neon`, `retro`) — no se integra sin ellos.
- El engine expone `pressKey(code: string)` / `releaseKey(code: string)` que reutilizan internamente la misma función `setKeyState(code, isDown)` que alimentan los listeners reales de teclado (`keydown`/`keyup`), igual que el contrato de SPEC 08 — un único camino de estado de input para teclado y para el `TouchControls` compartido.
- Crear `components/games/carpa-fantasma/CarpaFantasmaCanvas.tsx` (`"use client"`): `forwardRef` que expone `{ restart, setPaused, forceGameOver }` vía `useImperativeHandle`; un solo `useEffect` con deps `[]` que crea el engine sobre un único `<canvas>` interno de resolución fija 480×640, lo escala visualmente por CSS (`width:"100%", height:"auto"`), llama `start()` y en el cleanup llama `destroy()`; un segundo `useEffect` con dep `[skin]` que llama `engineRef.current?.setSkin(...)` sin recrear el engine; renderiza `<TouchControls>` (componente compartido `components/games/TouchControls.tsx`) superpuesto, con `directions={{ left: "ArrowLeft", right: "ArrowRight" }}` (sin arriba/abajo — el carrito solo se mueve en horizontal), `actionCode="Space"`, `actionLabel="RED"`.
- Reglas concretas de la mecánica (detalladas en Modelo de datos): dimensiones del canvas y del carrito, velocidades de caída, probabilidades de tipo de objeto, tabla de puntajes con multiplicador de combo, mecánica de la "Red Fantasmal" (acción de Espacio), fórmula de `level`, condición exacta de game over.
- `restart()` reinicia una partida limpia: `score=0`, `lives=3`, `level=1`, combo `1.0x`, lista de objetos cayendo vacía, carrito recentrado, temporizador/cooldown de la red reiniciados, `paused=false`, `gameOver=false` — reutilizando una función interna `initGame()` (mismo patrón que `rocas`/`tetris`/`ranaria`).
- `forceGameOver()` fuerza el estado terminal (`gameOver=true`, corta el loop con `cancelAnimationFrame`) y dispara `onGameOver(score)` sin pasar por la lógica normal de "perder una vida".
- `destroy()` cancela el `requestAnimationFrame` pendiente y remueve los listeners de teclado (`keydown`/`keyup`) que el engine haya registrado en `window`.
- Sin auto-restart interno: no hay ningún atajo de teclado que reinicie la partida en pantalla de game over. El único camino de reinicio es `restart()` invocado desde el ref imperativo de React.
- `preventDefault()` en `ArrowLeft`, `ArrowRight` y `Space` (las 3 únicas teclas del juego) para que no scrolleen la página mientras se juega.
- El loop **se detiene** (`cancelAnimationFrame`) al llegar a `gameOver = true` — mismo comportamiento que Tetris y Frogger (no el de Asteroids, que sigue dibujando el overlay de game over); justificado en Decisiones.
- Verificación aislada: compila con `npx tsc --noEmit` y se puede montar/probar visualmente en una ruta o registro temporal y descartable (ver Plan de implementación), sin tocar todavía `lib/data.ts` ni `app/juegos/[id]/jugar/page.tsx`.

**Fuera de alcance (para la spec 02 de esta misma carpeta):**

- Entrada en el catálogo `lib/data.ts` (`id`, `title`, `cat`, `color`, `cover`, `short`, `long`, `best`, `plays`).
- Clase CSS `.cover-carpa-fantasma` en `app/globals.css`.
- Alta de `carpa-fantasma` en el registro `REAL_GAMES` de `app/juegos/[id]/jugar/page.tsx`.
- Guardado de puntaje vía `saveScore({ game: "carpa-fantasma", score })` y verificación del leaderboard (`/juegos/carpa-fantasma`, `/salon-de-la-fama`).
- Cualquier cambio a otro juego del catálogo o a la página de reproducción genérica.
- Tests automatizados.

## Modelo de datos

No hay tablas ni persistencia nueva en esta spec. El "modelo de datos" es el contrato TypeScript entre `engine.ts` y `CarpaFantasmaCanvas.tsx`, más las reglas numéricas exactas de la mecánica.

### `components/games/carpa-fantasma/engine.ts`

```ts
export type EngineCallbacks = {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
};

export type CarpaFantasmaEngine = {
  start: () => void;
  stop: () => void;
  setPaused: (paused: boolean) => void;
  restart: () => void;
  forceGameOver: () => void;
  destroy: () => void;
  setSkin: (skin: Skin) => void;
  pressKey: (code: string) => void;
  releaseKey: (code: string) => void;
};

export function createEngine(
  canvas: HTMLCanvasElement,
  callbacks: EngineCallbacks,
  initialSkin?: Skin, // default: SKINS[DEFAULT_SKIN]
): CarpaFantasmaEngine;
```

### `components/games/carpa-fantasma/CarpaFantasmaCanvas.tsx`

```ts
export type CarpaFantasmaCanvasHandle = {
  restart: () => void;
  setPaused: (paused: boolean) => void;
  forceGameOver: () => void;
};

type CarpaFantasmaCanvasProps = {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  skin?: Skin;
};
```

Cumple exactamente `RealGameHandle`/`RealGameProps` de `architecture.md` §4 (extendido con el prop opcional `skin`, ya presente en `AsteroidsCanvasProps`/`FroggerCanvasProps`) para poder entrar al registro `REAL_GAMES` sin tocar el resto de la play page.

### Reglas de la mecánica

**Canvas y carrito:**

- Resolución interna fija: `480 × 640` (portrait), escalada por CSS a `width:100%; height:auto`.
- El Domador de Sombras es un rectángulo de ancho `baseWidth = 72px`, alto `18px`, centrado verticalmente en `y = 640 - 56`. Se mueve en horizontal a velocidad fija `380 px/s` mientras `ArrowLeft`/`ArrowRight` estén mantenidas (vía teclado o `pressKey`/`releaseKey`), acotado a `x ∈ [0, 480 - baseWidth]`.
- **Red Fantasmal** (acción de `Space`): si no está activa y el cooldown ya venció, activa un ensanche temporal del carrito a `netWidth = 132px` durante `500ms`; al desactivarse, arranca un cooldown de `2000ms` antes de poder volver a activarse (ciclo mínimo entre usos: `2500ms`). Cada llamada a `pressKey("Space")` intenta activar la red; si está en cooldown, la llamada no tiene efecto (no se acumula ni se encola).

**Objetos que caen:**

- Se generan uno a la vez desde el borde superior (`y = -16`) en una columna `x` aleatoria dentro de `[40, 440]`, con un temporizador de spawn `spawnIntervalMs(level) = max(350, 900 - (level-1) * 60)`.
- Caen con velocidad vertical `fallSpeed(level) = 130 * (1 + (level-1) * 0.12)` px/s, y además oscilan en horizontal (los "trucos imposibles de física" del tema): `x(t) = spawnX + sin(t * swayFreq + swayPhase) * swayAmplitude`, con `swayFreq` aleatorio en `[1.2, 2.4]` rad/s y `swayAmplitude` aleatorio en `[18, 42]px`, fijados por objeto al spawnear; el resultado se recorta a `[radio, 480 - radio]`.
- Tabla de tipos, probabilidad de spawn, radio de colisión y valor base de puntaje:

  | Tipo                | Probabilidad | Radio | Categoría | Valor base | Efecto al atrapar                     | Efecto al no atrapar (llega al suelo)           |
  | ------------------- | ------------ | ----- | --------- | ---------- | ------------------------------------- | ------------------------------------------------ |
  | Estrella Espectral  | 55%          | 14px  | buena     | 10 pts     | suma puntos, combo +0.1               | `lives -= 1`, combo se reinicia a 1.0           |
  | Aro de Fuego        | 20%          | 16px  | buena     | 25 pts     | suma puntos, combo +0.1               | `lives -= 1`, combo se reinicia a 1.0           |
  | Reloj de Medianoche | 10%          | 15px  | buena     | 75 pts     | suma puntos, combo +0.1               | `lives -= 1`, combo se reinicia a 1.0           |
  | Cuervo Fantasma     | 15%          | 15px  | mala      | 0 pts      | `lives -= 1`, combo se reinicia a 1.0 | sin efecto (dejarlo caer es la jugada correcta) |

- **Colisión (atrapar):** un objeto se atrapa cuando su centro `y` entra en la banda vertical del carrito (`[carritoY, carritoY + 18]`) y su `x` cae dentro del rango horizontal activo del carrito (`baseWidth` o `netWidth` si la Red está activa). Al atraparse, el objeto se remueve de inmediato de la lista.
- **Combo:** multiplicador que arranca en `1.0x`, sube `+0.1` (tope `2.0x`) por cada atrapada exitosa de un objeto **bueno**, y se reinicia a `1.0x` al atrapar un Cuervo Fantasma o al dejar caer un objeto bueno sin atrapar. Puntaje sumado en cada atrapada buena: `Math.round(valorBase * combo)`.
- **`level`:** `level = Math.floor(score / 500) + 1`. `onLevelChange` se dispara solo cuando este valor cambia (recalculado tras cada cambio de `score`).
- **Game over:** condición exacta e inequívoca — `lives` llega a `0` (ya sea por atrapar un Cuervo Fantasma o por dejar caer sin atrapar un objeto bueno). En ese frame: se corta el spawn/movimiento, `gameOver = true`, se cancela el `requestAnimationFrame` pendiente y se invoca `onGameOver(score)` una sola vez.

**HUD dibujado en canvas** (además del HUD externo de React, que se mantiene igual, ya genérico): puntaje arriba a la izquierda, `NIVEL n` centrado arriba, vidas como íconos a la derecha, multiplicador de combo actual (`x1.0`–`x2.0`) junto al puntaje, usando `skin.ink`/`skin.accent`/`skin.font`/`skin.glow`.

Convenciones (equivalentes a las de SPEC 05/07/08, adaptadas):

- Todo el estado (carrito, objetos cayendo, `score`, `lives`, `level`, combo, `netActive`/`netUntil`/`cooldownUntil`, `paused`, `gameOver`) vive como variables de closure de `createEngine` — no globals de módulo.
- Los callbacks (`onScoreChange`, `onLivesChange`, `onLevelChange`) se disparan solo cuando el valor realmente cambia (reporters con diff-guard), no en cada frame.
- `forceGameOver()` fuerza `gameOver = true` y llama `onGameOver(score)` sin decrementar `lives`.
- `destroy()` y `stop()` cancelan el `requestAnimationFrame` pendiente y remueven los listeners de teclado.
- `pressKey`/`releaseKey` reutilizan exactamente `setKeyState(code, isDown)`, la misma función que usan los listeners reales de `keydown`/`keyup` — sin segundo camino de estado de input (contrato de SPEC 08).

## Plan de implementación

1. Crear `components/games/carpa-fantasma/engine.ts`: definir tipos (`EngineCallbacks`, `CarpaFantasmaEngine`, `FallingItem` interno con `x`, `y`, `type`, `spawnX`, `swayFreq`, `swayPhase`, `swayAmplitude`, `radius`), estado del carrito, lista de objetos, `score`/`lives`/`level`/`combo`/`netActive`/`netUntil`/`cooldownUntil`/`paused`/`gameOver` como variables de closure. Implementar `initGame()`, `spawnItem()`, `update(dt)` (mover carrito, avanzar objetos, resolver colisiones/misses, actualizar temporizador de spawn y de la Red Fantasmal), `draw()` (fondo de carpa, carril, carrito, objetos con su forma distintiva — estrella, aro con halo de `skin.flameRgb`, reloj con manecillas, cuervo silueteado —, HUD), `loop(ts)` con `requestAnimationFrame`. Consumir `Skin` desde `../skins` (import `SKINS`, `DEFAULT_SKIN`, tipo `Skin`) exactamente como `frogger/engine.ts`; ningún color hex/rgba suelto fuera de `skin.*`. Implementar `setKeyState(code, isDown)`, listeners `keydown`/`keyup` con `preventDefault` en `ArrowLeft`/`ArrowRight`/`Space`, y exponer `pressKey`/`releaseKey` que la reutilizan. Exponer `start/stop/setPaused/restart/forceGameOver/destroy/setSkin`. Verificar con `npx tsc --noEmit` que compila sin errores antes de conectar React.
2. Crear `components/games/carpa-fantasma/CarpaFantasmaCanvas.tsx` (`"use client"`): `forwardRef<CarpaFantasmaCanvasHandle, CarpaFantasmaCanvasProps>`, canvas `width={480} height={640}` escalado por CSS, un `useEffect` (deps `[]`) que crea el engine, llama `start()`, y en cleanup llama `destroy()`; un segundo `useEffect` (dep `[skin]`) que llama `setSkin(skin ?? SKINS[DEFAULT_SKIN])` sin recrear el engine. `useImperativeHandle` expone `{ restart, setPaused, forceGameOver }`. Renderiza `<TouchControls onPress={(c) => engineRef.current?.pressKey(c)} onRelease={(c) => engineRef.current?.releaseKey(c)} directions={{ left: "ArrowLeft", right: "ArrowRight" }} actionCode="Space" actionLabel="RED" />` (import desde `../TouchControls`).
3. Verificación manual aislada: montar temporalmente `CarpaFantasmaCanvas` en una ruta o registro descartable (ej. agregar por unos minutos `carpa-fantasma: CarpaFantasmaCanvas` al `REAL_GAMES` de `app/juegos/[id]/jugar/page.tsx` solo para probar en `npm run dev`, revirtiendo ese cambio de una línea antes de cerrar esta spec — el alta definitiva en el catálogo y en `REAL_GAMES` es tarea formal de la spec 02). Verificar: el carrito se mueve con `←`/`→` sin scrollear la página; los objetos caen con oscilación visible; atrapar una Estrella/Aro/Reloj suma puntos con el multiplicador de combo correcto; atrapar un Cuervo Fantasma resta una vida y reinicia el combo; dejar caer un objeto bueno sin atrapar resta una vida y reinicia el combo; dejar caer un Cuervo sin atrapar no tiene efecto; `Espacio` activa la Red Fantasmal (carrito se ensancha 500ms) y respeta el cooldown de 2s; el nivel sube cada 500 puntos y la caída se acelera; perder las 3 vidas detiene el loop y llama `onGameOver` con el score final; `setPaused(true)` congela el juego y `setPaused(false)` lo retoma exactamente donde quedó; `restart()` reinicia todo a estado inicial; los 3 skins (`clasico`/`neon`/`retro`) se ven correctamente sin recrear el engine ni reiniciar la partida al cambiarlos; los controles táctiles (D-pad izquierda/derecha + botón "RED") funcionan igual que el teclado en un viewport ≤720px de DevTools.
4. Verificación de limpieza: entrar y salir de la ruta de prueba varias veces, confirmar en DevTools que no queda ningún `requestAnimationFrame` activo ni listeners de teclado acumulados tras desmontar.
5. `npx tsc --noEmit` limpio sobre todo el proyecto (no solo los dos archivos nuevos) antes de cerrar esta spec.

## Criterios de aceptación

- [ ] `components/games/carpa-fantasma/engine.ts` y `components/games/carpa-fantasma/CarpaFantasmaCanvas.tsx` existen y `npx tsc --noEmit` no reporta errores.
- [ ] El carrito (Domador de Sombras) se mueve en horizontal con `←`/`→` (teclado y controles táctiles), acotado a los bordes del canvas, y esas teclas no scrollean la página.
- [ ] Los objetos caen desde arriba con oscilación horizontal visible y a velocidad creciente según el nivel.
- [ ] Atrapar una Estrella Espectral, un Aro de Fuego o un Reloj de Medianoche suma exactamente `Math.round(valorBase * combo)` puntos y sube el combo en `+0.1` (tope `x2.0`).
- [ ] Atrapar un Cuervo Fantasma resta 1 vida, no suma puntos y reinicia el combo a `x1.0`.
- [ ] Dejar que un objeto bueno (Estrella/Aro/Reloj) llegue al suelo sin atraparlo resta 1 vida y reinicia el combo a `x1.0`.
- [ ] Dejar que un Cuervo Fantasma llegue al suelo sin atraparlo no tiene ningún efecto sobre puntaje, vidas o combo.
- [ ] `Espacio` activa la Red Fantasmal (ensanche visible de 500ms) y no vuelve a activarse hasta que pasen 2000ms adicionales tras desactivarse.
- [ ] El nivel reportado por `onLevelChange` es exactamente `Math.floor(score / 500) + 1` y solo se dispara cuando cambia.
- [ ] Perder la tercera vida detiene el loop del juego (sin más spawns ni movimiento) e invoca `onGameOver(score)` exactamente una vez con el puntaje final.
- [ ] `setPaused(true)` congela el carrito, los objetos y los temporizadores; `setPaused(false)` retoma exactamente donde quedó.
- [ ] `restart()` deja `score=0`, `lives=3`, `level=1`, combo `x1.0`, sin objetos cayendo y el carrito recentrado.
- [ ] No existe ningún atajo de teclado que reinicie la partida por sí solo en estado de game over — solo `restart()` invocado externamente.
- [ ] Cambiar de skin (`clasico`/`neon`/`retro`) vía `setSkin()` actualiza los colores del canvas en el frame siguiente sin recrear el engine ni reiniciar la partida en curso.
- [ ] Los controles táctiles (`TouchControls` con D-pad izquierda/derecha y botón "RED") reproducen exactamente el mismo comportamiento que el teclado.
- [ ] `destroy()` cancela el `requestAnimationFrame` pendiente y remueve los listeners de teclado; verificado en DevTools tras montar/desmontar el componente varias veces sin listeners ni loops huérfanos.

## Decisiones

- **Sí:** mecánica de "atrapar objetos que caen" (catcher), distinta de `dodger` (`ultimo-refugio`, ya registrado en `references/game-jam-log.md`), de la física de fragmentación/wrap toroidal de Asteroids (`rocas`) y del apilado de piezas de Tetris (`tetris`). Encaja de forma directa con el tema (trapecistas dejando caer objetos del espectáculo, red del domador) y tiene un contrato de estado simple e inequívoco.
- **Sí:** un único botón de acción (Espacio, "Red Fantasmal") con cooldown, en vez de sin acción alguna. Da profundidad táctica sin ambigüedad de estado (no introduce un nuevo callback ni afecta score/lives/level directamente) y satisface el contrato de `TouchControls`, que espera siempre `actionCode`/`actionLabel`.
- **Sí:** el loop **se detiene** en game over (patrón de Tetris/Frogger), no sigue corriendo como Asteroids. Con un juego basado en temporizadores de spawn, seguir actualizando tras la derrota no aporta valor visual y simplifica el cierre del loop.
- **Sí:** los Cuervos Fantasma solo penalizan si se atrapan, nunca por dejarlos caer. Mantiene la regla de "qué resta vidas" completamente inequívoca (solo dos casos posibles: atrapar un objeto malo, o dejar caer un objeto bueno) y refuerza la lectura temática ("hay que dejarlos ir").
- **Sí:** combo con tope `x2.0` en vez de un multiplicador sin límite. Evita puntajes desbordados en partidas largas y mantiene la tabla de puntaje verificable de forma determinista.
- **Sí:** el engine nace con soporte de `Skin` (`initialSkin`/`setSkin`) y con `pressKey`/`releaseKey` para `TouchControls`, replicando el contrato **real y vigente** de `rocas`/`tetris`/`ranaria` (post SPEC 08 y post migración de skins) en vez del bloque de código más antiguo y ya desactualizado que aparece en `architecture.md` §1 (que no menciona skins en su firma de tipos ni el contrato táctil). Se prioriza que la spec sea implementable hoy contra el estado real del repo.
- **No:** una interfaz/abstracción genérica de "motor de juego" reutilizable entre títulos — decisión ya tomada en SPEC 05 y reafirmada en SPEC 07; con 4 juegos reales concretos (`rocas`, `tetris`, `ranaria`, y este) la abstracción se sigue evaluando solo si surge una necesidad concreta, no de forma especulativa.
- **No:** redimensionar dinámicamente el canvas o sus constantes internas según el contenedor — resolución interna fija `480×640` escalada por CSS, mismo patrón que los 3 juegos reales existentes.
- **No:** tocar el catálogo, el registro `REAL_GAMES`, ni el leaderboard en esta spec — se posterga íntegramente a la spec 02 de esta misma carpeta.

## Riesgos

| Riesgo                                                                                                                                                           | Mitigación                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La oscilación horizontal (`sway`) hace que un objeto entre y salga del canvas de forma injugable o quede matemáticamente imposible de atrapar en ciertos frames. | El recorte explícito `x ∈ [radio, 480 - radio]` evita que el objeto salga del área visible; el rango de `swayAmplitude` (18–42px) se elige deliberadamente pequeño frente al ancho del carrito (72–132px) para que siempre exista una ventana de captura, verificado en el paso 3 del plan. |
| La Red Fantasmal se puede "trabar" activa si el cálculo de `netUntil`/`cooldownUntil` no se revierte correctamente al pausar o reiniciar.                        | `restart()` reinicia explícitamente `netActive=false` y ambos temporizadores; `setPaused(true)` congela el avance de tiempo del juego (los `Date.now()`/`ts` del loop no avanzan mientras está pausado), evitando que el cooldown corra en segundo plano durante la pausa.                  |
| Confusión entre "atrapar" un objeto malo vs. "dejarlo caer": una implementación descuidada podría penalizar ambos casos por error.                               | La tabla de la sección Modelo de datos deja explícito, fila por fila, el efecto exacto de cada tipo en cada uno de los dos desenlaces; el criterio de aceptación correspondiente lo verifica de forma aislada para el Cuervo Fantasma.                                                      |
| El engine deja un `requestAnimationFrame` corriendo o listeners de teclado registrados tras desmontar el componente de prueba temporal del paso 3.               | Cleanup explícito en el `useEffect` de `CarpaFantasmaCanvas` (`destroy()` + remoción de listeners), verificado manualmente en el paso 4 del plan entrando/saliendo varias veces con DevTools abiertas — mismo patrón que SPEC 05/07/08.
