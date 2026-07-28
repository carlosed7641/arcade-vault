# Skin Audit Log

Memoria persistente del agente `skin-designer`. Cada fila es un juego con engine real
auditado contra los 3 skins obligatorios (`clasico`, `neon`, `retro`, definidos en
`components/games/skins.ts`). El agente lee este archivo para no re-auditar sin razón un
juego que ya cumple.

Estados: Cumple · Incompleto · Migrado

- [x] **Asteroids** (`rocas`) — skins: clasico ✓ · neon ✓ · retro ✓ — contraste: OK (todo
      trazo/HUD ≥ 4.5:1 sobre negro) — estado: Migrado — (2026-07-28) los ~13 literales
      hex/rgba del engine (nave, asteroides, balas, power-up, partículas, HUD, overlay,
      fondo) se movieron a `skin.ink/inkRgb/inkDim/accent/flameRgb/bg`; `createEngine` acepta
      `initialSkin` y expone `setSkin`.
- [x] **Tetris** (`tetris`) — skins: clasico ✓ · neon ✓ · retro ✓ — contraste: OK — estado:
      Migrado — (2026-07-28) el array `COLORS` (constante de módulo) se movió a
      `skin.palette`, leído desde el closure de `createEngine`; `drawGrid` usa `skin.grid`;
      `setSkin` fuerza un redraw inmediato del board y del preview "Siguiente".
