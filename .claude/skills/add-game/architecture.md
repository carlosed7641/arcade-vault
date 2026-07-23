# Arquitectura de referencia — integrar un juego real al Vault

Mapa técnico exacto del patrón ya implementado (SPEC 05 + SPEC 06), para que `/add-game`
produzca specs precisas. Todo lo citado aquí existe hoy en el repo.

## 1. Contrato engine ↔ canvas (`components/games/asteroids/`)

```ts
// engine.ts
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

Reglas del engine:

- Todo el estado (entidades, score, lives, level, máquina de estados) vive como variables de
  **closure** dentro de `createEngine` — nunca como globals de módulo, para que remounts o
  navegación entrando/saliendo no compartan estado entre instancias.
- Los callbacks se disparan **solo cuando el valor cambia** (reporters con diff-guard), no en
  cada frame — evita renders de React innecesarios.
- `forceGameOver()` fuerza el estado terminal y llama `onGameOver(score)` sin pasar por la
  lógica normal de "perder vidas".
- `destroy()` cancela el `requestAnimationFrame` pendiente y remueve los listeners de teclado
  que el engine haya registrado (en `window`, con `preventDefault` en las teclas del juego).
- Se **elimina** cualquier auto-restart interno (ej. Espacio en pantalla de game over) — el
  único camino de reinicio es `restart()` invocado desde React.

```ts
// AsteroidsCanvas.tsx
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

- `forwardRef<Handle, Props>` — expone `{ restart, setPaused, forceGameOver }` vía
  `useImperativeHandle`, delegando a `engineRef.current?.*`.
- Un solo `useEffect` con deps `[]` (eslint-disabled a propósito): crea el engine sobre el
  `<canvas>`, llama `start()`; cleanup llama `destroy()`. Los props no recrean el engine.
- El `<canvas>` tiene **resolución interna fija** (ej. `width={800} height={600}`) y se escala
  visualmente por CSS (`width:"100%", height:"auto"`) — nunca se tocan las constantes internas
  de posición/física del juego original.

## 2. Catálogo de juegos (`lib/data.ts`)

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export type Game = {
  id: string; // slug: ruta /juegos/<id> y game_id en Supabase
  title: string;
  short: string; // blurb para la card de biblioteca
  long: string; // párrafo para la página de detalle
  cat: GameCategory;
  cover: string; // clase CSS, ej. "cover-<id>"
  color: "cyan" | "magenta" | "green" | "yellow";
  best: number; // valor de display, hardcodeado (no viene de Supabase)
  plays: string; // valor de display, ej. "15.6K"
};
```

`best`/`plays` son decisión explícita de SPEC 06: quedan hardcodeados salvo que una spec futura
pida derivarlos de Supabase.

## 3. Contrato del leaderboard (ya game-agnóstico — no tocar)

`app/juegos/[id]/page.tsx` (Server Component) y `app/salon-de-la-fama/page.tsx` (Client
Component) ya consultan por `game_id` de forma genérica:

```ts
const { data } = await supabase
  .from("scores")
  .select("score, created_at, profiles(username)")
  .eq("game_id", id) // id del juego nuevo — sin cambios de código
  .order("score", { ascending: false })
  .limit(100);
// post-procesado: 1 fila por usuario (mejor score, ya viene ordenado desc), top 10 (detalle) / top 12 (salón)
```

Guardado de score, en `components/AuthProvider.tsx`:

```ts
saveScore: (entry: { game: string; score: number }) => Promise<void>;
// insert { user_id: user.id, game_id: entry.game, score: entry.score } en la tabla `scores`
// no-op si no hay usuario autenticado
```

**Un juego nuevo aparece en ambos leaderboards automáticamente** en cuanto (a) tiene una
entrada en `GAMES` y (b) su play page llama `saveScore({ game: id, score })` al terminar la
partida. No se necesita ninguna tabla, columna, ni query nueva.

## 4. Play page — patrón de registro (`app/juegos/[id]/jugar/page.tsx`)

Estado actual (post-SPEC 05): un solo juego real, seleccionado por un check hardcodeado:

```ts
const isAsteroids = id === "rocas";
// ...
{isAsteroids ? (
  <AsteroidsCanvas ref={asteroidsRef} onScoreChange={setScore} onLivesChange={setLives}
    onLevelChange={setLevel} onGameOver={handleGameOver} />
) : (
  <div className="game-arena">{/* simulación falsa con sprites CSS */}</div>
)}
```

Para el segundo juego real en adelante, reemplazar ese check por un **registro**:

```ts
type RealGameHandle = { restart(): void; setPaused(p: boolean): void; forceGameOver(): void };
type RealGameProps = {
  onScoreChange: (s: number) => void;
  onLivesChange: (l: number) => void;
  onLevelChange: (lv: number) => void;
  onGameOver: (finalScore: number) => void;
};

const REAL_GAMES: Record<string, ForwardRefExoticComponent<
  RealGameProps & RefAttributes<RealGameHandle>
>> = {
  rocas: AsteroidsCanvas,
  // <id-nuevo>: NuevoCanvas,
};

const RealCanvas = REAL_GAMES[id];
// ...
{RealCanvas ? (
  <RealCanvas ref={realGameRef} onScoreChange={setScore} onLivesChange={setLives}
    onLevelChange={setLevel} onGameOver={handleGameOver} />
) : (
  <div className="game-arena">{/* simulación falsa, sin cambios */}</div>
)}
```

Todo componente Canvas de un juego real debe implementar exactamente `RealGameHandle` +
`RealGameProps` (el mismo contrato de §1) para poder entrar al registro sin tocar el resto de
la play page (botones PAUSA/FIN/JUGAR DE NUEVO ya llaman genéricamente a
`restart`/`setPaused`/`forceGameOver` sobre el ref activo).

## 5. Tabla de divergencias entre templates de referencia

`references/templates/started-games/`: `02-asteroids` (ya integrado, SPEC 05), `03-tetris`,
`04-arkanoid`. Todos son HTML+JS vanilla sin build, con loop `requestAnimationFrame` y `dt`,
pero divergen en puntos que **hay que confirmar por juego** en la Fase 2 del skill:

| Aspecto           | 02-asteroids                                  | 03-tetris                               | 04-arkanoid                                      |
| ----------------- | --------------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| Canvas            | 800×600, 1 canvas                             | 300×600 + preview 120×120, 2 canvas     | 800×600, 1 canvas                                |
| HUD               | dibujado en canvas                            | **DOM** (`#score`/`#lines`/`#level`)    | dibujado en canvas                               |
| Lives             | sí (`lives`, empieza en 3)                    | **no existe** (usa `lines`)             | sí (`lives`, empieza en 3)                       |
| Level             | `level` (por oleada de asteroides)            | `level` derivado de `floor(lines/10)+1` | `currentLevel` (por tablero)                     |
| Señal game-over   | string `state: 'playing'\|'dead'\|'gameover'` | boolean `gameOver`                      | string `gameState: 'playing'\|'gameover'\|'win'` |
| Loop en game-over | sigue corriendo                               | **se detiene** (`cancelAnimationFrame`) | sigue corriendo                                  |
| Restart           | Espacio (a eliminar) → `initGame()`           | botón DOM → `init()`                    | **no existe** — hay que añadirlo                 |
| Assets externos   | ninguno                                       | ninguno                                 | spritesheet PNG + 2 `.mp3` + `levels.js`         |
| Input             | `keys`+`justPressed`/`pressed()`              | `keydown` directo                       | teclado + mouse + clicks de pausa                |

Implicación directa para la spec de cualquier juego nuevo: normalizar siempre a
`{ score, lives, level, onGameOver(finalScore) }`. Si el juego no tiene vidas (tetris), decidir
qué valor sintetizar. Si el game-over es boolean, mapearlo a la invocación de `onGameOver`. Si
hay un estado terminal extra tipo `'win'` (arkanoid), decidir si también dispara `onGameOver`
o si necesita su propio manejo en el modal de fin de partida. Si no hay restart (arkanoid),
añadirlo al portar el engine. Si hay assets externos, definir su ubicación en `public/` y su
carga desde `engine.ts` (no bloquear el primer frame si no es necesario).
