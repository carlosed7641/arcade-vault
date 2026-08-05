# Game Jam Log

Memoria persistente del agente `game-jam`. Cada fila es un juego diseñado a partir de un
tema. El agente lee este archivo para no repetir mecánica base ni `game-id` entre corridas.
No se comparte con la memoria de `game-planner` (`references/game-suggestions.md`).

Estados: Borrador · Descartado · Implementado

- [ ] **ÚLTIMO REFUGIO** (`ultimo-refugio`) — tema: "supervivencia" — mecánica base: dodger
      (esquiva + recolección con medidor de recurso) — ARCADE — specs:
      `specs/game-jam/ultimo-refugio/` — estado: Borrador — (2026-07-28) score sube 10 pts/s
      sobrevivido + 25 pts por suministro recogido; vidas 3 bajan por golpe de escombro
      (invulnerabilidad 1.5s tras el golpe); nivel = floor(segundos/20)+1; game over si
      vidas=0 o el medidor de sustento (100→0, -2/s, +20 por suministro) llega a 0.
