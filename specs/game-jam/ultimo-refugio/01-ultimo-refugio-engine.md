# SPEC game-jam/ultimo-refugio 01 — Motor y canvas de ÚLTIMO REFUGIO

> **Estado:** Borrador
> **Depende de:** SPEC 05 (patrón engine↔canvas de Asteroids), SPEC 07 (patrón engine↔canvas
> de Tetris)
> **Fecha:** 2026-07-28
> **Objetivo:** Construir de forma aislada (sin tocar el resto del Vault) el motor y el canvas
> de ÚLTIMO REFUGIO, un dodger de supervivencia donde el jugador esquiva escombros y recolecta
> suministros para no quedarse sin sustento antes de que caiga la noche.

## Alcance

**Dentro:**

- Crear `components/games/ultimo-refugio/engine.ts`: módulo TypeScript sin dependencias de
  React, con todo el estado (posición del superviviente, lista de escombros activos, lista de
  suministros activos, `score`, `lives`, `sustenance`, `elapsedMs`, `level`, `state`) como
  variables de closure de `createEngine(canvas, callbacks)` — nunca globals de módulo.
- El loop usa `requestAnimationFrame` con `dt` en segundos (`Math.min(rafTime - lastTime, 50) / 1000`
  para evitar saltos grandes tras un tab en background).
- El superviviente (cuadrado de 28×28px) se mueve libre dentro del canvas (800×600) con
  `ArrowUp/ArrowDown/ArrowLeft/ArrowRight` o `W/A/S/D`, velocidad constante de 240px/s,
  acotado a `x ∈ [14, 786]`, `y ∈ [14, 586]` (mitad del sprite de margen contra los bordes).
- Escombros (cuadrados rojos de 28×28px) caen desde `y = -28` con velocidad vertical inicial
  de 120px/s, en `x` aleatorio dentro de `[14, 786]`, a un ritmo inicial de spawn de un
  escombro cada 900ms. Suministros (cuadrados verdes de 24×24px) caen igual, a un ritmo fijo
  de uno cada 2500ms, velocidad vertical constante de 100px/s (no escala con nivel).
- Colisión por solapamiento de rectángulos (AABB) entre el superviviente y cada escombro/
  suministro activo.
- Al colisionar con un escombro: si el superviviente **no** está en ventana de invulnerabilidad,
  `lives -= 1`, se dispara `onLivesChange(lives)`, se activa invulnerabilidad de 1500ms
  (el sprite del superviviente parpadea, ver detalle visual en el plan) y el escombro se
  elimina de la lista. Si está invulnerable, el escombro igual se elimina pero no resta vida.
- Al colisionar con un suministro: se elimina de la lista, `score += 25` (dispara
  `onScoreChange`), `sustenance = Math.min(100, sustenance + 20)` (sin callback propio, ver
  Modelo de datos).
- `sustenance` arranca en 100 y decrece continuamente a razón de 2 puntos por segundo
  (`sustenance -= 2 * dt`), sin bajar de 0. No tiene callback dedicado — se dibuja como una
  barra en el HUD del canvas (mismo patrón que el HUD dibujado en `game.js` de Asteroids).
- `score` también sube por tiempo sobrevivido: cada 1000ms acumulados de `elapsedMs`,
  `score += 10` (independiente de la recolección de suministros), disparando `onScoreChange`.
- `level = Math.floor(elapsedSeconds / 20) + 1`; al cambiar, dispara `onLevelChange(level)` y
  recalcula el intervalo de spawn de escombros (`900ms × 0.95^(level-1)`, con piso de 300ms) y
  su velocidad de caída (`120px/s × 1.08^(level-1)`).
- Condición de game over, exacta y excluyente entre sí solo en el orden de chequeo por frame
  (primero vidas, luego sustento): si `lives <= 0` **o** `sustenance <= 0`, `state = 'gameover'`,
  se detiene el spawn y el movimiento, y se dispara `onGameOver(score)` una sola vez (guardado
  con una bandera interna para no reinvocarlo en frames subsecuentes).
- `forceGameOver()`: fuerza `state = 'gameover'` y dispara `onGameOver(score)` inmediatamente,
  sin pasar por el chequeo de vidas/sustento (igual que en Asteroids/Tetris).
- `restart()`: reinicia superviviente al centro-inferior (`x=400, y=500`), vacía escombros y
  suministros, `score=0`, `lives=3`, `sustenance=100`, `elapsedMs=0`, `level=1`, `state='playing'`,
  reinicia los temporizadores de spawn y vuelve a invocar los callbacks con los valores
  iniciales (`onScoreChange(0)`, `onLivesChange(3)`, `onLevelChange(1)`).
- `setPaused(paused)`: congela el loop (no avanza `dt` efectivo ni spawns) sin resetear nada;
  se sigue dibujando el último frame.
- `destroy()`: cancela el `requestAnimationFrame` pendiente y remueve los listeners
  `keydown`/`keyup` que el engine haya registrado en `window`.
- Crear `components/games/ultimo-refugio/UltimoRefugioCanvas.tsx` (`"use client"`):
  `forwardRef` que monta un único `<canvas width={800} height={600}>`, escalado por CSS
  (`max-width:100%; height:auto`) dentro de su contenedor, expone
  `{ restart, setPaused, forceGameOver }` vía `useImperativeHandle`, y un solo `useEffect` con
  deps `[]` que crea el engine sobre el canvas, llama `start()`, y en cleanup llama `destroy()`.
- Registro de listeners de teclado con `preventDefault()` en `ArrowUp/ArrowDown/ArrowLeft/
ArrowRight` (y sus equivalentes `W/A/S/D` no necesitan `preventDefault`, no son teclas de
  scroll) para que el juego no desplace la página mientras se juega.
- HUD dibujado dentro del canvas: barra de sustento (rectángulo superior derecho, se vacía de
  verde a rojo conforme `sustenance` baja) y contador de segundos sobrevividos
  (`Math.floor(elapsedSeconds)`), ambos con estilo neón consistente con el resto del Vault.

**Fuera de alcance (para la spec `02` de esta misma carpeta):**

- Entrada en el catálogo `lib/data.ts`, clase CSS `.cover-ultimo-refugio`, alta en el registro
  `REAL_GAMES` de `app/juegos/[id]/jugar/page.tsx`.
- HUD externo de React (`hud-stat` Jugador/Puntuación/Vidas/Nivel), botones PAUSA/FIN/JUGAR DE
  NUEVO, guardado de score con `saveScore`.
- Verificación de leaderboard (`/juegos/ultimo-refugio` y `/salon-de-la-fama`).
- Controles táctiles/móviles.
- Redimensionamiento dinámico del canvas o de sus constantes internas según el contenedor —
  resolución interna fija (800×600), escalado solo por CSS.
- Tests automatizados.

## Modelo de datos

No hay tablas ni persistencia nueva. El "modelo de datos" de esta spec es el contrato
TypeScript entre `engine.ts` y `UltimoRefugioCanvas.tsx`, y las reglas numéricas concretas de
la mecánica.

### `components/games/ultimo-refugio/engine.ts`

```ts
export type EngineCallbacks = {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
};

export type UltimoRefugioEngine = {
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
): UltimoRefugioEngine;
```

Reglas concretas de la mecánica:

- Canvas: 800×600 (única resolución interna, sin redimensionar).
- Superviviente: 28×28px, velocidad 240px/s en las 8 direcciones (diagonal se normaliza para
  no moverse `√2` más rápido: `dx/mag * 240 * dt`, `dy/mag * 240 * dt`).
- Escombro: 28×28px, spawn inicial cada 900ms, caída inicial 120px/s; ambos escalan con
  `level` según las fórmulas de la sección Alcance.
- Suministro: 24×24px, spawn fijo cada 2500ms, caída fija 100px/s (no escala con nivel).
- `score`: +10 por cada segundo entero sobrevivido, +25 instantáneo por suministro recogido.
- `lives`: inicia en 3, -1 por colisión con escombro fuera de ventana de invulnerabilidad
  (1500ms tras el último golpe).
- `sustenance` (interno, sin callback): inicia en 100, -2/s continuo, +20 (tope 100) por
  suministro recogido; se dibuja como barra en el HUD del canvas.
- `level`: `Math.floor(elapsedSeconds / 20) + 1`.
- Game over: `lives <= 0` **o** `sustenance <= 0` (lo que ocurra primero); `onGameOver` se
  invoca una única vez por partida.

Convenciones (equivalentes a SPEC 05/07):

- Todo el estado vive como variables de closure dentro de `createEngine`, nunca globals de
  módulo.
- Los callbacks se disparan solo cuando el valor realmente cambia (diff-guard), nunca en cada
  frame.
- Sin auto-restart interno: ninguna tecla reinicia la partida desde dentro del engine; el
  único camino es `restart()` invocado desde React.

### `components/games/ultimo-refugio/UltimoRefugioCanvas.tsx`

```ts
export type UltimoRefugioCanvasHandle = {
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

Cumple exactamente `RealGameHandle`/`RealGameProps` de `.claude/skills/add-game/architecture.md`
§4, para poder entrar sin fricción al registro `REAL_GAMES` en la spec `02`.

## Plan de implementación

1. Crear `components/games/ultimo-refugio/engine.ts`: implementar `createEngine(canvas,
callbacks)` con las entidades (superviviente, escombros, suministros), el loop
   `requestAnimationFrame`/`dt`, el spawn temporizado, las colisiones AABB, las fórmulas de
   `score`/`lives`/`sustenance`/`level` descritas en el Modelo de datos, el dibujo (canvas 2D:
   fondo oscuro con textura simple de "yermo", superviviente, escombros, suministros, barra de
   sustento, contador de segundos) y `start`/`stop`/`setPaused`/`restart`/`forceGameOver`/
   `destroy`. Verificar con `npx tsc --noEmit` que compila sin errores antes de conectarlo a
   React.
2. Crear `components/games/ultimo-refugio/UltimoRefugioCanvas.tsx` (`"use client"`): monta
   `<canvas width={800} height={600}>` con CSS `max-width:100%; height:auto`. En `useEffect`
   (mount, deps `[]`): registra `keydown`/`keyup` en `window` con `preventDefault` en las 4
   flechas, llama `createEngine(canvas, callbacks)`, guarda la instancia, llama `start()`; en
   cleanup llama `destroy()` y remueve los listeners. Expone `restart`/`setPaused`/
   `forceGameOver` vía `useImperativeHandle`.
3. Verificación manual aislada (montar temporalmente `<UltimoRefugioCanvas>` en una ruta de
   prueba o directamente reutilizar el paso de integración de la spec `02`): el superviviente
   responde a las 4 flechas y a WASD sin salirse del canvas; los escombros caen y dañan al
   tocar al superviviente fuera de la ventana de invulnerabilidad (parpadeo visible 1.5s tras
   el golpe); los suministros caen, se recogen, suben `score` y rellenan la barra de sustento;
   la barra de sustento baja sola con el tiempo; pasados 20s el nivel sube y los escombros
   caen más rápido y con más frecuencia; perder las 3 vidas o vaciar el sustento dispara
   `onGameOver` con el score acumulado; `setPaused(true)` congela todo (superviviente,
   escombros, sustento) y `setPaused(false)` lo retoma exactamente donde quedó; `restart()`
   deja todo en los valores iniciales; `destroy()` detiene el loop y no deja listeners
   huérfanos (verificar en DevTools montando/desmontando varias veces).

## Criterios de aceptación

- [ ] `npx tsc --noEmit` no reporta errores en `components/games/ultimo-refugio/`.
- [ ] El superviviente se mueve con las 4 flechas y con WASD, sin salir de los límites del
      canvas (800×600), y las flechas no scrollean la página mientras el canvas tiene foco.
- [ ] Un escombro que toca al superviviente fuera de la ventana de invulnerabilidad resta
      exactamente 1 vida y dispara `onLivesChange` con el nuevo valor.
- [ ] Tras perder una vida, el superviviente es invulnerable durante 1.5s (visualmente
      distinguible, ej. parpadeo) y los escombros durante ese lapso no restan más vidas.
- [ ] Un suministro recogido suma exactamente 25 al `score` (dispara `onScoreChange`) y sube
      la barra de sustento interna en 20 puntos, sin superar el máximo de 100.
- [ ] El `score` también sube 10 puntos por cada segundo completo sobrevivido, de forma
      independiente a la recolección de suministros.
- [ ] La barra de sustento del HUD del canvas baja de forma continua y visible mientras no se
      recogen suministros.
- [ ] Cada 20 segundos de partida el `level` sube en 1 y se dispara `onLevelChange`; los
      escombros caen visiblemente más rápido y con mayor frecuencia tras la subida de nivel.
- [ ] Quedarse sin vidas (`lives = 0`) dispara `onGameOver(score)` exactamente una vez.
- [ ] Vaciar la barra de sustento (`sustenance = 0`) sin haber perdido las 3 vidas también
      dispara `onGameOver(score)` exactamente una vez.
- [ ] `forceGameOver()` termina la partida de inmediato con el score acumulado hasta ese
      momento, sin importar vidas o sustento restantes.
- [ ] `setPaused(true)` congela el movimiento del superviviente, la caída de escombros/
      suministros y el descenso de la barra de sustento; `setPaused(false)` retoma exactamente
      donde quedó.
- [ ] `restart()` reinicia superviviente, escombros, suministros, score, vidas, sustento y
      nivel a sus valores iniciales, y vuelve a invocar los tres callbacks numéricos con esos
      valores.
- [ ] Ninguna tecla dentro del canvas reinicia la partida por sí sola tras un game over — solo
      una llamada externa a `restart()` lo hace.
- [ ] `destroy()` cancela el `requestAnimationFrame` pendiente y remueve los listeners de
      teclado; verificado en DevTools montando y desmontando `UltimoRefugioCanvas` varias veces
      sin acumular listeners ni loops activos.

## Decisiones

- **Sí:** mecánica base dodger (esquivar + recolectar) con medidor de recurso continuo
  (sustento), en vez de snake/breakout/pacman/space-invaders/frogger/pong ya presentes en el
  catálogo visual, y distinta de asteroids/tetris ya implementados. Encaja de forma directa y
  evocadora con el tema "supervivencia": el jugador administra dos amenazas simultáneas
  (impacto directo vía vidas, agotamiento de recursos vía sustento) en vez de un solo fail
  state, algo que ningún juego existente del Vault modela hoy.
- **Sí:** un único canvas de 800×600, sin canvas secundario (a diferencia de Tetris). La
  mecánica no necesita preview ni tablero separado; un solo plano de juego es suficiente y
  más simple de portar.
- **Sí:** `sustenance` es estado interno sin callback dedicado, dibujado en el HUD del canvas.
  Mantener el contrato `EngineCallbacks` idéntico al de Asteroids/Tetris (sin agregar un
  quinto callback) preserva la compatibilidad total con `RealGameHandle`/`RealGameProps` del
  registro `REAL_GAMES`; el precedente de HUD dibujado en canvas para información extra
  (power-up de Asteroids) ya está establecido.
- **Sí:** invulnerabilidad temporal de 1.5s tras cada golpe. Sin ella, un solo escombro grande
  o un enjambre podría vaciar las 3 vidas en un solo frame por múltiples colisiones
  simultáneas, lo cual sería injusto e inconsistente con "perder una vida por golpe".
- **No:** disparo o ataque del jugador. El tema "supervivencia" se resuelve mejor con evasión y
  gestión de recursos que con combate directo; además evita solapar mecánica con el shooter ya
  implementado (`rocas`).
- **No:** una interfaz genérica de "motor de juego" reutilizable entre títulos. Se mantiene la
  decisión ya tomada en SPEC 05/07 — con dos juegos reales existentes y este como diseño
  todavía en borrador, la abstracción sigue siendo prematura.
- **No:** controles táctiles/móviles ni redimensionamiento dinámico del canvas. Mismo alcance
  que SPEC 05/07 — teclado únicamente, resolución interna fija escalada por CSS.

## Riesgos

| Riesgo                                                                                               | Mitigación                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El medidor de sustento baja tan rápido en niveles altos que el juego se vuelve imposible de sostener | La tasa de drenaje (-2/s) es constante y no escala con `level` — solo la velocidad/frecuencia de escombros escala, manteniendo el sustento como un reto estable y predecible. |
| Colisiones simultáneas de varios escombros en el mismo frame descuentan más de 1 vida de golpe       | La ventana de invulnerabilidad de 1.5s tras el primer golpe del frame cubre cualquier otro escombro superpuesto en frames subsecuentes cercanos.                              |
| `onGameOver` se dispara más de una vez si `lives` y `sustenance` llegan a 0 en frames cercanos       | Bandera interna `gameOverFired` en el closure, chequeada antes de invocar el callback, igual que el patrón de "un solo `onGameOver`" de Asteroids/Tetris.                     |
| El engine deja `requestAnimationFrame` corriendo o listeners de teclado tras desmontar el componente | Cleanup explícito en `useEffect` (`destroy()` + remover listeners), verificado manualmente en el paso 3 del plan entrando/saliendo varias veces con DevTools.                 |
