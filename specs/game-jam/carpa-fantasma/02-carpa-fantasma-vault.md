# SPEC 02 — Integración de CARPA FANTASMA al Vault

> **Estado:** Borrador
> **Depende de:** SPEC 01 (`specs/game-jam/carpa-fantasma/01-carpa-fantasma-engine.md`, misma carpeta), SPEC 05 (asteroids-real), SPEC 06 (leaderboard real), SPEC 07 (tetris-real), SPEC 08 (controles táctiles móviles).
> **Fecha:** 2026-08-06
> **Objetivo:** Dar de alta `carpa-fantasma` en el catálogo (`lib/data.ts`), su cover CSS y su registro en `REAL_GAMES` de la play page, para que el juego real diseñado en la spec 01 sea jugable desde `/juegos/carpa-fantasma` con HUD, pausa, selector de skin, controles táctiles, modal de fin de partida y leaderboard real, sin escribir código nuevo de leaderboard.

## Alcance

**Dentro:**

- Agregar nueva entrada en `lib/data.ts` (array `GAMES`): `id: "carpa-fantasma"`, `title: "CARPA FANTASMA"`, `cat: "ARCADE"`, `color: "magenta"`, `cover: "cover-carpa-fantasma"`, `short`/`long` según el Modelo de datos, `best: 8600`, `plays: "1.8K"` (valores de display iniciales bajos, coherentes con ser el juego más nuevo del catálogo).
- Agregar la clase `.cover-carpa-fantasma` (y su `::after`/`::before` si aplica) en `app/globals.css`, con estética propia de circo espectral nocturno (silueta de carpa, estrella/reloj dorado sobre fondo `--magenta`), sin reutilizar ninguna clase `.cover-*` existente.
- Registrar `carpa-fantasma: CarpaFantasmaCanvas` en el `REAL_GAMES` de `app/juegos/[id]/jugar/page.tsx` (import de `CarpaFantasmaCanvas` desde `@/components/games/carpa-fantasma/CarpaFantasmaCanvas`), junto a las entradas ya existentes `rocas`, `tetris`, `ranaria` — una sola línea nueva en el registro, sin tocar el resto de la página (HUD, botones PAUSA/FIN/JUGAR DE NUEVO, selector de skin y `TouchControls` ya son 100% genéricos contra cualquier componente del registro, incluido el prop opcional `skin`).
- Confirmar que `lives` se inicializa en `3` para `carpa-fantasma` en la play page (ya es el valor por defecto de `realGameLives`, coherente con que este juego sí reporta vidas reales vía `onLivesChange`, a diferencia de Tetris).
- Verificación manual de que el guardado de puntaje (`saveScore({ game: "carpa-fantasma", score })`, ya implementado en `AuthProvider` desde SPEC 04) se dispara igual que para los demás juegos reales: al llegar a `over === true` con `user` autenticado, usando el `score` real reportado por `onScoreChange`.
- **Leaderboard: sin código nuevo.** El contrato de `app/juegos/[id]/page.tsx` y `app/salon-de-la-fama/page.tsx` ya es game-agnóstico (`architecture.md` §3): consultan la tabla `scores` filtrando por `game_id` sin ninguna rama específica por juego. El paso correspondiente del plan es puramente de **verificación manual**: jugar autenticado, confirmar que el score aparece en `/juegos/carpa-fantasma` y en `/salon-de-la-fama` para ese `game_id`.

**Fuera de alcance (para specs futuras):**

- Cualquier cambio al `engine.ts`/`CarpaFantasmaCanvas.tsx` diseñados en la spec 01 — se integran tal cual.
- Adaptar cualquier otro juego del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `duelo-pixel`) a una implementación real.
- Cambios al modelo de datos de Supabase (`profiles`, `scores`) o a la lógica de `saveScore`/leaderboard — se reutilizan tal cual (SPEC 04/06).
- Rediseño del selector de skin, del `TouchControls` compartido, o del reflow móvil del HUD del reproductor — ya resueltos de forma genérica por SPEC 08 y heredados automáticamente al registrar el juego.
- Una interfaz/abstracción genérica de "motor de juego" reutilizable entre títulos (decisión ya tomada en SPEC 05, reafirmada en SPEC 01 de esta carpeta).
- Tests automatizados.

## Modelo de datos

No hay tablas ni persistencia nueva — se reutiliza `scores` (SPEC 04/06) sin cambios. El "modelo de datos" de esta spec es la nueva entrada de catálogo y el registro de la play page.

### `lib/data.ts`

```ts
{
  id: "carpa-fantasma",
  title: "CARPA FANTASMA",
  short: "Atrapa los prodigios espectrales de un circo que solo abre a medianoche.",
  long: "Cuando el reloj marca las doce, una carpa imposible se levanta en las afueras del pueblo. Trapecistas fantasmales y animales que desafían la gravedad dejan caer estrellas, aros de fuego y relojes dorados desde lo alto de la lona — atrápalos con tu red antes de que toquen la arena. Los cuervos espectrales solo buscan arruinar la función: no los dejes caer en tu red.",
  cat: "ARCADE",
  cover: "cover-carpa-fantasma",
  color: "magenta",
  best: 8600,
  plays: "1.8K",
}
```

### `app/juegos/[id]/jugar/page.tsx`

```ts
import { CarpaFantasmaCanvas } from "@/components/games/carpa-fantasma/CarpaFantasmaCanvas";

const REAL_GAMES: Record<
  string,
  ComponentType<RealGameProps & RefAttributes<RealGameHandle>>
> = {
  rocas: AsteroidsCanvas,
  tetris: TetrisCanvas,
  ranaria: FroggerCanvas,
  "carpa-fantasma": CarpaFantasmaCanvas,
};
```

`CarpaFantasmaCanvas` (diseñado en la spec 01) cumple exactamente `RealGameHandle`/`RealGameProps` — incluido el prop opcional `skin` —, por lo que entra al registro sin ningún otro cambio en el resto del archivo.

### `app/globals.css`

Nueva clase `.cover-carpa-fantasma` (y pseudo-elementos si aplica), siguiendo el mismo patrón que `.cover-rocas`/`.cover-rana`/`.cover-glot` (gradiente de fondo + `::after`/`::before` decorativos con `filter: drop-shadow`), usando `var(--magenta)` como acento principal y un tono dorado/`var(--yellow)` para el detalle del "Reloj de Medianoche" o la carpa iluminada. No reutiliza ninguna clase `.cover-*` existente.

## Plan de implementación

1. Agregar la entrada `carpa-fantasma` en `lib/data.ts` (según el modelo de datos de esta spec) y la clase `.cover-carpa-fantasma` en `app/globals.css`. Verificación: `/biblioteca` muestra la card de CARPA FANTASMA con su cover propio y categoría ARCADE; `/juegos/carpa-fantasma` carga con el leaderboard vacío (sin partidas aún) sin romper el resto del catálogo.
2. Registrar `carpa-fantasma: CarpaFantasmaCanvas` en `REAL_GAMES` dentro de `app/juegos/[id]/jugar/page.tsx`, importando el componente diseñado en la spec 01. Verificación: `/juegos/carpa-fantasma/jugar` renderiza el canvas real (carrito + objetos cayendo) dentro de `.crt-screen`, en vez de la simulación falsa con sprites CSS.
3. Verificación manual completa del flujo de reproductor para `carpa-fantasma`: el HUD externo de React (Jugador/Puntuación/Vidas/Nivel) queda sincronizado con los callbacks del engine; el selector de skin (`CLASICO`/`NEON`/`RETRO`) cambia los colores del canvas sin reiniciar la partida; en viewport ≤720px de DevTools, `TouchControls` muestra el D-pad izquierda/derecha y el botón "RED", y una partida completa (mover, atrapar objetos, activar la Red, perder las 3 vidas) es jugable solo con controles táctiles; el botón "PAUSA"/"REANUDAR" congela y retoma el juego; el botón "FIN" termina la partida de inmediato con el score acumulado y abre el modal; perder las 3 vidas abre el modal automáticamente; "JUGAR DE NUEVO" reinicia una partida limpia (score 0, vidas 3, nivel 1) sin recargar la página.
4. Verificación de integración con SPEC 04/06: jugar una partida de `carpa-fantasma` autenticado, terminarla (por game over o por "FIN"), confirmar que el score real se guarda en la tabla `scores` con `game_id: "carpa-fantasma"` y aparece en `/juegos/carpa-fantasma` y en `/salon-de-la-fama`. Jugar como invitado y confirmar que no se guarda ningún score (mismo comportamiento ya existente para `rocas`/`tetris`/`ranaria`, sin cambios en esa lógica).
5. Verificación de no regresión: `/juegos/rocas/jugar`, `/juegos/tetris/jugar` y `/juegos/ranaria/jugar` siguen funcionando exactamente igual; el resto del catálogo con simulación falsa (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `duelo-pixel`) no cambia de comportamiento.
6. Revisión final: `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [ ] `npm run build` finaliza sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `/biblioteca` muestra la card de CARPA FANTASMA con la clase `.cover-carpa-fantasma` aplicada y categoría ARCADE.
- [ ] En `/juegos/carpa-fantasma/jugar`, el canvas real diseñado en la spec 01 se muestra dentro de `.crt-screen` en vez de la simulación falsa con sprites CSS.
- [ ] El HUD externo de React (Jugador/Puntuación/Vidas/Nivel) se mantiene sincronizado en todo momento con los callbacks reales del engine.
- [ ] El selector de skin (`CLASICO`/`NEON`/`RETRO`) cambia los colores del canvas de `carpa-fantasma` sin reiniciar la partida en curso.
- [ ] En viewport ≤720px, `/juegos/carpa-fantasma/jugar` muestra el D-pad izquierda/derecha y el botón "RED" superpuestos, y es posible completar una partida entera solo con controles táctiles.
- [ ] El botón "PAUSA" congela el juego y "REANUDAR" lo retoma exactamente donde quedó.
- [ ] El botón "FIN" termina la partida de inmediato con el score acumulado hasta ese momento y abre el modal de fin de partida.
- [ ] Perder las 3 vidas abre automáticamente el modal de fin de partida con el score final.
- [ ] "JUGAR DE NUEVO" reinicia una partida limpia (score 0, vidas 3, nivel 1) sin recargar la página.
- [ ] Terminar una partida real de `carpa-fantasma` estando autenticado guarda el score real (no simulado) en la tabla `scores` y aparece tanto en `/juegos/carpa-fantasma` como en `/salon-de-la-fama`.
- [ ] Terminar una partida de `carpa-fantasma` como invitado no guarda ningún score.
- [ ] `/juegos/rocas/jugar`, `/juegos/tetris/jugar` y `/juegos/ranaria/jugar` siguen funcionando exactamente igual que antes de esta spec.
- [ ] El resto del catálogo con simulación falsa (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `duelo-pixel`) sigue mostrando su comportamiento actual sin cambios.

## Decisiones

- **Sí:** categoría `ARCADE` para `carpa-fantasma`. Es un juego de reflejos/puntería de una sola pantalla sin apilado de piezas (`PUZZLE`), sin disparo de proyectiles como mecánica central (`SHOOTER`) ni enfrentamiento entre dos jugadores (`VERSUS`) — encaja con la definición de `ARCADE` ya aplicada a `serpentina`/`gloton`/`ranaria`, juegos de reflejos de una sola pantalla y un solo jugador.
- **Sí:** color `magenta`. Es el color menos usado hoy en el catálogo (solo `caida`) y calza con la estética de circo nocturno (carpa púrpura/magenta con acentos dorados), reforzando la identidad visual de la card sin repetir el `yellow` de `rocas`/`gloton` ni el `green` de `serpentina`/`invasores`/`ranaria`.
- **Sí:** `best`/`plays` iniciales bajos (`8600` / `"1.8K"`) frente al resto del catálogo. Es coherente con ser el juego recién agregado; siguen siendo, por decisión ya tomada en SPEC 06, valores de display hardcodeados y no derivados de Supabase.
- **Sí:** una sola línea nueva en `REAL_GAMES` (patrón ya establecido desde SPEC 07/08 para el segundo, tercer y ahora cuarto juego real) en vez de reintroducir cualquier check hardcodeado tipo `isAsteroids`.
- **No:** tocar el contrato de leaderboard (`app/juegos/[id]/page.tsx`, `app/salon-de-la-fama/page.tsx`) ni `AuthProvider.saveScore`. Ya es game-agnóstico desde SPEC 06; un juego nuevo aparece en ambos leaderboards automáticamente con solo tener entrada en `GAMES` y llamar `saveScore` (heredado, sin cambios de código).
- **No:** ningún cambio al selector de skin, a `TouchControls`, o al reflow móvil del HUD del reproductor — todos ya son genéricos desde SPEC 08 y funcionan para cualquier entrada de `REAL_GAMES` sin trabajo adicional por juego.
- **No:** una interfaz/abstracción genérica de "motor de juego" reutilizable entre títulos — se reafirma la decisión de SPEC 05/07, ahora con 4 juegos reales concretos y sin necesidad demostrada de esa abstracción.

## Riesgos

| Riesgo                                                                                                                                                                                         | Mitigación                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agregar `carpa-fantasma` a `REAL_GAMES` rompe por error el registro de un juego existente (ej. borrar una coma o una entrada previa).                                                          | Verificación manual explícita en el paso 5 del plan de que `rocas`, `tetris` y `ranaria` siguen funcionando exactamente igual antes de cerrar la spec.                                      |
| La nueva clase `.cover-carpa-fantasma` colisiona en especificidad CSS con alguna clase `.cover-*` existente y altera visualmente otra card.                                                    | Namespacing exacto por `id` (`.cover-<game-id>`, mismo patrón que el resto), sin reutilizar selectores; verificación visual de `/biblioteca` completa (no solo la card nueva) en el paso 1. |
| El prop opcional `skin` o los métodos `pressKey`/`releaseKey` quedan mal tipados en `CarpaFantasmaCanvas` y rompen la inferencia de tipos del registro `REAL_GAMES`, fallando `npm run build`. | El paso 2 depende de que la spec 01 ya haya verificado `npx tsc --noEmit` de forma aislada; el paso 6 de esta spec corre `npm run build` sobre el proyecto completo antes de cerrarla.      |
]