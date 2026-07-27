# Juegos implementados

Juegos con motor real (`components/games/<juego>/engine.ts` + `<Juego>Canvas.tsx`), jugables
en `app/juegos/[id]/jugar/` y con leaderboard real en Supabase.

| ID catálogo | Título            | Categoría | Componente                                       | Spec    |
| ----------- | ----------------- | --------- | ------------------------------------------------ | ------- |
| `rocas`     | ROCAS (Asteroids) | SHOOTER   | `components/games/asteroids/AsteroidsCanvas.tsx` | SPEC 05 |
| `tetris`    | TETRIS            | PUZZLE    | `components/games/tetris/TetrisCanvas.tsx`       | SPEC 07 |

## Pendientes / solo catálogo (sin motor real)

Estos IDs existen en `lib/data.ts` (catálogo) pero **no** están en `REAL_GAMES`
(`app/juegos/[id]/jugar/page.tsx`), por lo que al jugarlos usan un score simulado (fake),
no un motor de juego real:

- `bloque-buster` (BLOQUE BUSTER — Arkanoid/Breakout) — template en
  `references/templates/started-games/04-arkanoid/` (pendiente de portar)
- `caida` (CAÍDA) — duplicado conceptual de `tetris`, sin motor propio
- `serpentina` (SERPENTINA — Snake)
- `gloton` (GLOTÓN — Pac-Man style)
- `invasores` (INVASORES — Space Invaders)
- `ranaria` (RANARIA — Frogger)
- `duelo-pixel` (DUELO PIXEL — Pong)

## Cómo se integra un juego nuevo

Ver skill `/add-game` y `.claude/skills/add-game/architecture.md`. Patrón general:

1. Motor framework-agnostic en `components/games/<juego>/engine.ts`.
2. Canvas React en `components/games/<juego>/<Juego>Canvas.tsx`, expone
   `onScoreChange` / `onLivesChange` / `onGameOver`.
3. Registrar el componente en `REAL_GAMES` dentro de `app/juegos/[id]/jugar/page.tsx`.
4. Leaderboard real ya está resuelto vía tabla `scores` de Supabase (SPEC 06), no requiere
   trabajo adicional por juego.
