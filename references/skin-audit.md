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
- [x] **Frogger** (`ranaria`) — skins: clasico ✓ · neon ✓ · retro ✓ — contraste: OK (ink,
      accent y las 8 entradas de `palette` en los 3 skins ≥ 4.5:1 contra `#000`, incluidas
      `palette[1]/[3]/[4]` usadas por la barra de tiempo verde/amarillo/rojo) — estado:
      Cumple — (2026-08-05) auditoría sin migración: el engine ya nació siguiendo el
      contrato de `skins.ts` (closure `skin`, `initialSkin`/`setSkin` sin recrear el motor,
      cero literales hex/rgba fuera de `skin.*`); zonas de río/césped/bocas usan alpha
      compositing sobre `palette[5]`/`palette[3]`/`accent` y siguen distinguibles en los 3
      skins. `tsc --noEmit` y `npm run lint` limpios.
