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
- [ ] **CARPA FANTASMA** (`carpa-fantasma`) — tema: "circo de medianoche" — mecánica base:
      catcher (atrapa objetos que caen, con combo y acción de red temporal) — ARCADE —
      specs: `specs/game-jam/carpa-fantasma/` — estado: Borrador — (2026-08-06) score suma
      10/25/75 pts (Estrella/Aro/Reloj) × combo (x1.0→x2.0, +0.1 por atrapada buena, se
      reinicia a x1.0 al atrapar un Cuervo Fantasma o dejar caer un objeto bueno); vidas 3
      bajan solo por atrapar un Cuervo Fantasma o dejar caer sin atrapar un objeto bueno;
      nivel = floor(score/500)+1; game over si vidas=0. Motor con soporte de skins
      (`clasico`/`neon`/`retro`) y controles táctiles (`pressKey`/`releaseKey` + D-pad
      izquierda/derecha + botón "RED") desde el día uno, contrato vigente post SPEC 08.
