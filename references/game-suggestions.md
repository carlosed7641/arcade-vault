# Game Suggestions — To Do

Memoria persistente del agente `game-planner`. Cada fila es un juego evaluado como próximo
candidato a integrar en Arcade Vault. El agente lee este archivo para no repetir sugerencias.

Estados: Propuesto · Descartado · En diseño (/add-game) · Integrado

- [ ] **Arkanoid** — ARCADE — fuente: `references/templates/started-games/04-arkanoid` —
      encaje: Alto — estado: Propuesto — (2026-07-27) Template ya disponible con assets; score
      numérico competitivo; contrato: score/lives/level/game-over.
- [ ] **Space Invaders** — SHOOTER — encaje: Alto — estado: Propuesto — (2026-07-27) Catálogo
      ya tiene slot placeholder `invasores`; grid enemigo + barreras destructibles; contrato:
      score/lives/wave/game-over; esfuerzo bajo-medio.
- [ ] **Pac-Man** — ARCADE — encaje: Alto — estado: Propuesto — (2026-07-27) Catálogo ya tiene
      slot placeholder `gloton`; laberinto + IA de fantasmas (persecución/huida por píldora);
      contrato: score/lives/game-over; esfuerzo medio (pathfinding de 4 enemigos).
- [ ] **Centipede** — SHOOTER — encaje: Medio-alto — estado: Propuesto — (2026-07-27) Sin slot
      previo en catálogo; ciempiés que serpentea por campo de hongos destructibles, distinto
      ritmo a invasores/rocas; contrato: score/lives/game-over; esfuerzo medio.
- [ ] **Missile Command** — SHOOTER — encaje: Medio — estado: Propuesto — (2026-07-27) Sin slot
      previo; defensa con mira (mouse/tap) de ciudades bajo misiles, mecánica de apuntado
      distinta a resto del catálogo; contrato: score/lives(ciudades)/game-over; esfuerzo medio.
- [ ] **Galaga** — SHOOTER — encaje: Medio — estado: Propuesto — (2026-07-27) Formaciones que
      se separan y bombardean en picado (vs. marcha estática de invasores), añade variedad
      dentro del mismo subgénero; contrato: score/lives/wave/game-over; esfuerzo medio.

- [ ] **2048** — PUZZLE — fuente: sin template, engine trivial (grid 4x4 + merge) —
      encaje: Alto — estado: Propuesto — (2026-07-27) Esfuerzo bajo; score numérico natural
      acumulado por merges; game-over = sin movimientos válidos; sin "lives".
- [ ] **Buscaminas (Minesweeper)** — PUZZLE — fuente: sin template, engine grid+flood-fill —
      encaje: Alto — estado: Propuesto — (2026-07-27) Esfuerzo medio (flood-fill reveal);
      score = tiempo invertido/celdas reveladas, game-over = click en mina; sin lives, muy
      distinto a Tetris/Caída (variedad de mecánica).
- [ ] **Match-3 (estilo Bejeweled)** — PUZZLE — fuente: sin template, engine grid+swap+cascade —
      encaje: Alto — estado: Propuesto — (2026-07-27) Esfuerzo medio-alto (detección de
      combos en cascada); score acumulado por combo, game-over por límite de movimientos/tiempo;
      buen contraste visual (grid de gemas) vs. los juegos de caída ya existentes.
- [ ] **Sokoban** — PUZZLE — fuente: sin template, engine grid+colisión simple —
      encaje: Medio — estado: Propuesto — (2026-07-27) Esfuerzo bajo-medio; sin score
      tradicional en el original pero se puede mapear a movimientos/tiempo como "score" (menor
      es mejor) o niveles completados; sin lives; aporta variedad de "juego de niveles" al
      catálogo que hoy es todo score-infinito.
- [ ] **Lights Out** — PUZZLE — fuente: sin template, engine grid+toggle-vecinos —
      encaje: Medio — estado: Propuesto — (2026-07-27) Esfuerzo muy bajo (matriz de toggles);
      score = clicks/tiempo invertido (menor mejor) o niveles resueltos, game-over = tablero
      resuelto; el más rápido de implementar de los 5, buen "quick win" para engordar catálogo
      PUZZLE.

## Ya integrados (referencia, no re-sugerir)

- Asteroids (`rocas`, SPEC 05) · Tetris (`tetris`, SPEC 07)
