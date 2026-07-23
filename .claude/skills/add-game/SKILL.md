---
name: add-game
description: Diseña la spec para integrar un juego real (con leaderboard) al Arcade Vault, siguiendo el patrón de SPEC 05 (engine + canvas) y SPEC 06 (leaderboard real). Hace preguntas específicas del juego antes de proponer la spec. El juego puede venir o no de references/templates/started-games/.
disable-model-invocation: true
argument-hint: "nombre o fuente del juego (carpeta de referencia, archivo, o descripción)"
---

# /add-game — Diseñador de spec para juegos del Vault

Este skill ayuda a producir una spec para integrar un juego real (con motor, canvas y
leaderboard) al Arcade Vault. **No escribe código.** Tu trabajo es clarificar cómo es el
juego, detectar en qué diverge del patrón ya implementado (SPEC 05/06), y desarrollar la
spec sección por sección hasta que quede lista para guardarse en `specs/`. La implementación
real ocurre después, cuando el usuario corra `/spec-impl NN` sobre la spec resultante.

## Filosofía

Ya existe un patrón funcionando en el repo: SPEC 05 portó Asteroids (`references/templates/started-games/02-asteroids/`)
a un engine TypeScript + componente Canvas de React, y SPEC 06 conectó el leaderboard real
de Supabase. Este skill **no reinventa ese patrón** — lo instancia para un juego nuevo. Lee
`architecture.md` (en esta misma carpeta) para el mapa técnico exacto: contratos de tipos,
forma del catálogo, contrato del leaderboard, y la tabla de divergencias entre los templates
de referencia disponibles hoy (Asteroids, Tetris, Arkanoid).

## Comando

- Sigue las cuatro fases en orden. No las saltes.
- Responde siempre en el mismo idioma del prompt inicial.

### Fase 1 — Contexto

1. Lee `CLAUDE.md` del repo.
2. **Lee el skill `/spec` completo antes de seguir**: `../spec/SKILL.md` y `../spec/template.md`.
   Ese skill define el método spec-driven del repo (estructura de secciones, formato de
   frontmatter/estado, cómo se numeran y guardan los archivos en `specs/`, y las reglas duras
   sobre no generar la spec completa de un tirón). `/add-game` no define su propio formato de
   spec — reutiliza exactamente el de `/spec`, solo que sus preguntas de la Fase 2 y su Plan de
   implementación de la Fase 3 están especializados en integrar un juego. Si `../spec/template.md`
   cambia en el futuro, esta spec de juego debe seguir esa versión, no una copia congelada aquí.
3. Lista `specs/` para saber el siguiente número secuencial `NN`.
4. Lee `specs/05-asteroids-real.md` y `specs/06-detalle-juego-leaderboard-real.md` — son la
   referencia directa del patrón que esta spec debe seguir, ya escritas con la estructura de
   `../spec/template.md`.
5. Lee `architecture.md` (mismo directorio que este skill) para el contrato técnico exacto.
6. Identifica la **fuente del juego** a partir de `$ARGUMENTS`:
   - **(a) Carpeta de referencia** — algo en `references/templates/started-games/` (hoy:
     `02-asteroids` ya integrado, `03-tetris`, `04-arkanoid`). Lee su `game.js` (y `levels.js`/
     `assets/*` si existen) completo antes de seguir.
   - **(b) Fuente externa** — un archivo, repo o descripción de un juego que el usuario trae
     de fuera de `references/`. Pide el código fuente o una descripción suficientemente
     detallada del gameplay/estado/controles.
   - **(c) Desde cero** — el usuario quiere un juego nuevo sin plantilla previa. Trátalo como
     el caso más abierto: todas las preguntas de Fase 2 aplican sin poder inferir nada del código.

   Si `$ARGUMENTS` viene vacío, pregunta primero cuál es la fuente del juego.

### Fase 2 — Preguntas de aclaración específicas del juego

Pregunta en bloques de 3 a 5, esperando respuesta antes de continuar. No asumas nada que
diverja entre los templates de referencia (ver tabla de divergencias en `architecture.md`) —
eso es precisamente lo que hay que confirmar por juego.

**Catálogo (`lib/data.ts`):**

- `id` (slug — se usa como ruta `/juegos/<id>` y como `game_id` en Supabase), `title`, `cat`
  (`ARCADE` | `PUZZLE` | `SHOOTER` | `VERSUS`), `color` (`cyan`|`magenta`|`green`|`yellow`),
  `cover` (clase CSS, ej. `cover-<id>`, a definir en `globals.css`), `short`, `long`.
- `best` y `plays` son valores de display hardcodeados (no derivados de Supabase, decisión ya
  tomada en SPEC 06) — pide valores iniciales razonables.

**Contrato de estado (score/lives/level/game-over):**

- ¿El juego original tiene concepto de vidas? Si no (como Tetris, que trackea `lines` en vez
  de `lives`), decide qué reportar en `onLivesChange` (¿sintetizar un valor fijo?, ¿mostrar
  "—" en el HUD?, ¿derivar de otra métrica?).
- ¿Cómo señaliza el juego original el game-over? Puede ser un string de estado
  (`state`/`gameState` con valores como `'playing'|'dead'|'gameover'`) o un booleano
  (`gameOver`). Si además tiene un estado terminal distinto como `'win'` (Arkanoid), decide
  cómo se mapea a `onGameOver(finalScore)`.
- ¿Cómo deriva `level`? (conteo de asteroides restantes, líneas limpiadas, bloques rotos, etc.)

**HUD:**

- ¿El juego dibuja su propio HUD en el canvas (Asteroids/Arkanoid) o en el DOM (Tetris)? SPEC
  05 decidió mantener ambos HUD (el del canvas + el externo de React) por simplicidad — pregunta
  si se repite esa decisión o si se suprime el HUD interno del juego para esta integración.

**Canvas:**

- Resolución interna (Asteroids/Arkanoid usan 800×600 fijo; Tetris usa 300×600 + un canvas
  secundario de preview 120×120). ¿Uno o varios `<canvas>`? Confirma que se escala por CSS
  manteniendo resolución interna fija (patrón ya usado, evita reescribir posiciones/físicas).

**Assets externos:**

- ¿El juego trae spritesheets, imágenes o audio (como `04-arkanoid`, que usa una spritesheet
  PNG y dos `.mp3`)? Si sí, dónde viven en el proyecto (`public/games/<id>/...`) y cómo se cargan
  desde el engine.

**Controles y reinicio:**

- Teclas usadas y si necesitan `preventDefault` (para no scrollear la página).
- ¿El juego original tiene una función de reinicio reutilizable? Si no la tiene (Arkanoid no
  trae un `restart()` explícito), hay que añadirla como parte del engine.
- Confirma explícitamente: se elimina cualquier auto-restart interno del juego original (ej.
  Espacio reiniciando en pantalla de game over) — el único camino de reinicio es el botón del
  modal de React (decisión ya tomada en SPEC 05, para no desincronizar estado React/engine).

**Cierre de la fase:** no sigas a la Fase 3 hasta poder responder sin asumir nada:

1. ¿Qué archivos van a aparecer o cambiar?
2. ¿Cuál es el primer paso ejecutable y cuál el último?
3. ¿Cómo se verifica que el juego quedó integrado (jugable + leaderboard real)?

### Fase 3 — Desarrollar la spec sección por sección

Usa exactamente el orden, formato y reglas de sección que ya leíste en `../spec/template.md`
en la Fase 1 (no una reinterpretación libre) — mostrando cada sección y esperando confirmación
antes de la siguiente, igual que hace `/spec`:

1. **Header** — Estado (`Borrador`), Depende de (`SPEC 05`, `SPEC 06`), Fecha, Objetivo en una
   sola frase.
2. **Alcance** — Dentro / Fuera de alcance. Explícito sobre qué NO se toca (ej. si no se
   construye una interfaz genérica de "motor de juego" reutilizable, igual que decidió SPEC 05).
3. **Modelo de datos** — el contrato TypeScript `engine.ts` ↔ `<Nombre>Canvas.tsx` específico
   de este juego (con los tipos reales, basado en `architecture.md`), y la entrada `Game` de
   `lib/data.ts`. No se introduce ninguna tabla nueva en Supabase — se reutiliza `scores`.
4. **Plan de implementación** — instancia el patrón concreto (ver `architecture.md` para el
   detalle de cada paso):
   1. Agregar la entrada `Game` en `lib/data.ts` (+ clase `cover-<id>` en `app/globals.css`).
   2. Crear `components/games/<id>/engine.ts`: portar la lógica del juego original al contrato
      `createEngine(canvas, callbacks) → { start, stop, setPaused, restart, forceGameOver, destroy }`,
      con `EngineCallbacks` (`onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`),
      estado como variables de closure (no globals de módulo), callbacks disparados solo cuando
      el valor cambia, sin auto-restart interno.
   3. Crear `components/games/<id>/<Nombre>Canvas.tsx`: `forwardRef` que expone
      `{ restart, setPaused, forceGameOver }` vía `useImperativeHandle`, monta/destruye el
      engine en un `useEffect` con deps `[]`, canvas con resolución interna fija escalado por CSS.
   4. Refactorizar/extender el **registro de juegos reales** en
      `app/juegos/[id]/jugar/page.tsx`: la primera vez que se corre este skill sobre este repo,
      reemplaza el check hardcodeado `isAsteroids = id === "rocas"` por un registro
      `REAL_GAMES: Record<string, ComponentType<...>>` (ver `architecture.md`); en corridas
      posteriores, solo agrega la entrada del juego nuevo a ese registro.
   5. **Leaderboard: sin código nuevo.** `app/juegos/[id]/page.tsx` y
      `app/salon-de-la-fama/page.tsx` ya filtran por `game_id` y ya dedupen por usuario — el
      paso del plan es solo de **verificación manual**: jugar autenticado, confirmar que el
      score aparece en ambas vistas para el nuevo `id`.
   6. `npm run lint` y `npm run build` sin errores.
5. **Criterios de aceptación** — checklist booleano, verificable (sin "que funcione bien").
   Debe incluir explícitamente que el leaderboard muestra el juego nuevo sin cambios en el
   código de leaderboard.
6. **Decisiones** — Sí/No con justificación breve. Reusa las decisiones ya tomadas en SPEC 05
   cuando apliquen (canvas de resolución fija, ambos HUD, eliminar auto-restart) salvo que el
   usuario pida explícitamente lo contrario para este juego.
7. **Riesgos** — solo si aplica (ej. desincronización engine/React, listeners huérfanos al
   desmontar, bug sutil al portar a TypeScript — mismos riesgos que documentó SPEC 05).

### Fase 4 — Guardar la spec

1. Número secuencial `NN` según `specs/`.
2. Slug corto desde el objetivo (ej. `tetris-real`, `arkanoid-real`).
3. Confirma el nombre de archivo propuesto con el usuario antes de escribir.
4. Crea `specs/NN-slug.md` con Estado `Borrador`.
5. Si `specs/.spec-config.yml` no existe, créalo con el contenido default (ver `spec/SKILL.md`);
   si ya existe, no lo toques.
6. Confirma: ruta del archivo creado, recordatorio de que está en `Borrador`, y que el
   siguiente paso es `/spec-impl NN` una vez aprobada. **Detente ahí.**

## Reglas duras

- **Nunca escribas código de la app en este skill.** Solo el archivo `.md` de la spec.
- **Nunca reinventes el contrato del leaderboard.** Si una pregunta del usuario apunta a
  cambiar cómo se consulta/guarda `scores`, recuérdale que eso ya está resuelto (SPEC 04/06) y
  que tocarlo es una spec aparte.
- **Nunca asumas la forma del estado (score/lives/level/game-over) de un juego sin confirmarla.**
  Los templates de referencia ya difieren entre sí en esto — es la fuente de bugs más probable.
- **Nunca propongas implementar la spec después de guardarla.** Eso lo hace `/spec-impl`.
- **Nunca escribas la spec sin haber leído `../spec/SKILL.md` y `../spec/template.md` primero
  en esta corrida.** Ese es el formato canónico de spec del repo; `/add-game` no mantiene una
  copia propia de la estructura — la lee cada vez, para no desincronizarse si `/spec` cambia.

## Argumentos

- `/add-game 03-tetris` → sugiere explorar `references/templates/started-games/03-tetris/` como
  fuente.
- `/add-game 04-arkanoid` → ídem con `04-arkanoid`.
- `/add-game <descripción libre>` → trátalo como fuente tipo (b) o (c) según lo que el usuario
  aporte; pregunta por el código fuente si menciona un juego externo concreto.
- `/add-game` sin argumentos → pregunta primero cuál es la fuente del juego.
