# SPEC game-jam/ultimo-refugio 02 — Integración de ÚLTIMO REFUGIO al Vault

> **Estado:** Borrador
> **Depende de:** `specs/game-jam/ultimo-refugio/01-ultimo-refugio-engine.md` (motor y canvas),
> SPEC 05 (patrón de integración de Asteroids), SPEC 07 (patrón de integración de Tetris y
> registro `REAL_GAMES`)
> **Fecha:** 2026-07-28
> **Objetivo:** Dar de alta ÚLTIMO REFUGIO como juego jugable del Vault (catálogo, cover,
> registro `REAL_GAMES`, HUD externo, botones de partida y guardado de score) reutilizando tal
> cual el contrato de leaderboard ya game-agnóstico.

## Alcance

**Dentro:**

- Agregar nueva entrada en `lib/data.ts` (según el Modelo de datos de esta spec): `id:
"ultimo-refugio"`, `title: "ÚLTIMO REFUGIO"`, `cat: "ARCADE"`, `color: "magenta"`, `cover:
"cover-ultimo-refugio"`, `short`/`long` propios del tema de supervivencia, `best`/`plays`
  iniciales de display.
- Agregar la clase `.cover-ultimo-refugio` en `app/globals.css`, con una paleta magenta/oscura
  consistente con el resto de `.cover-*` (gradiente o patrón simple, sin assets externos).
- Registrar `ultimo-refugio: UltimoRefugioCanvas` en el mapa `REAL_GAMES` ya existente de
  `app/juegos/[id]/jugar/page.tsx` (creado en SPEC 07; esta spec solo agrega la entrada e
  importa `UltimoRefugioCanvas` desde `components/games/ultimo-refugio/UltimoRefugioCanvas.tsx`,
  sin tocar el resto del archivo).
- HUD externo de React (`hud-stat` Jugador/Puntuación/Vidas/Nivel) alimentado por
  `onScoreChange`/`onLivesChange`/`onLevelChange` del engine de la spec `01`, mismo patrón que
  `rocas`/`tetris`.
- Botón "PAUSA" llama `realGameRef.current?.setPaused(true/false)`; botón "FIN" llama
  `realGameRef.current?.forceGameOver()`; botón "JUGAR DE NUEVO" del modal de fin de partida
  llama `realGameRef.current?.restart()` además de resetear `over`/`saved` en el estado de
  React — mismo flujo genérico que ya existe para cualquier entrada de `REAL_GAMES`.
- Guardado de score: al llegar a `over === true` con `user` autenticado, se llama
  `saveScore({ game: "ultimo-refugio", score })` con el `score` real reportado por
  `onScoreChange`, sin cambios en `AuthProvider.tsx`.
- Verificación manual de que el leaderboard de `/juegos/ultimo-refugio` y `/salon-de-la-fama`
  muestra el score real tras jugar autenticado, sin ningún cambio de código en esas páginas.

**Fuera de alcance (para specs futuras):**

- Cualquier cambio a la lógica del motor o el canvas — ya cerrados en la spec `01`.
- Controles táctiles/móviles.
- Redimensionamiento dinámico del canvas o de sus constantes internas.
- Adaptar cualquier otro juego del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`,
  `invasores`, `ranaria`, `duelo-pixel`) a una implementación real.
- Modificar cualquier entrada existente de `lib/data.ts` o el layout de `app/juegos/[id]/
jugar/page.tsx` fuera de agregar la entrada al registro `REAL_GAMES`.
- Tocar el modelo de datos de Supabase (`profiles`, `scores`) ni el código de las páginas de
  leaderboard (`app/juegos/[id]/page.tsx`, `app/salon-de-la-fama/page.tsx`) — se reutilizan tal
  cual, ya son game-agnósticas.
- Una interfaz/abstracción genérica de "motor de juego" reutilizable entre títulos — decisión
  ya descartada en SPEC 05/07 y en la spec `01` de esta carpeta.
- Tests automatizados.

## Modelo de datos

No hay tablas ni persistencia nueva. Se reutiliza `scores` (SPEC 04/06) sin cambios. El
"modelo de datos" de esta spec es la nueva entrada de catálogo y la actualización del registro
`REAL_GAMES`.

### `lib/data.ts`

```ts
{
  id: "ultimo-refugio",
  title: "ÚLTIMO REFUGIO",
  short: "Sobrevive al colapso: esquiva, recolecta, resiste.",
  long: "El cielo llueve escombros sobre el último asentamiento. Esquiva la caída de ruinas mientras corres a recoger cajas de suministro antes de que se agote tu sustento. Cada minuto que resistes, el yermo se vuelve más hostil.",
  cat: "ARCADE",
  cover: "cover-ultimo-refugio",
  color: "magenta",
  best: 3200,
  plays: "2.1K",
}
```

### `app/juegos/[id]/jugar/page.tsx`

```ts
import UltimoRefugioCanvas from "@/components/games/ultimo-refugio/UltimoRefugioCanvas";

const REAL_GAMES: Record<
  string,
  ForwardRefExoticComponent<RealGameProps & RefAttributes<RealGameHandle>>
> = {
  rocas: AsteroidsCanvas,
  tetris: TetrisCanvas,
  "ultimo-refugio": UltimoRefugioCanvas,
};
```

`UltimoRefugioCanvas` ya cumple `RealGameHandle`/`RealGameProps` exactamente (definido en la
spec `01`), por lo que no requiere ninguna rama especial en el resto del archivo.

## Plan de implementación

1. Agregar la entrada `ultimo-refugio` en `lib/data.ts` (según el Modelo de datos) y la clase
   `.cover-ultimo-refugio` en `app/globals.css`. Verificación: `/juegos` (biblioteca) muestra la
   card de ÚLTIMO REFUGIO con su cover propio; `/juegos/ultimo-refugio` carga con el
   leaderboard vacío (sin partidas aún).
2. Importar `UltimoRefugioCanvas` en `app/juegos/[id]/jugar/page.tsx` y agregar la entrada
   `"ultimo-refugio": UltimoRefugioCanvas` al mapa `REAL_GAMES` existente. No se modifica
   ninguna otra parte del archivo: el resto del flujo (botones PAUSA/FIN/JUGAR DE NUEVO,
   `handleGameOver`, `saveScore`, HUD de React) ya funciona genéricamente contra
   `REAL_GAMES[id]`.
3. Verificación manual en navegador (`npm run dev`, ir a `/juegos/ultimo-refugio/jugar`): el
   canvas real de ÚLTIMO REFUGIO se muestra dentro de `.crt-screen`; el HUD de React
   (Jugador/Puntuación/Vidas/Nivel) se mantiene sincronizado con el engine en todo momento;
   PAUSA congela el juego y REANUDAR lo retoma; FIN termina la partida con el score acumulado
   y abre el modal; quedarse sin vidas o sin sustento abre el modal automáticamente con el
   score final; JUGAR DE NUEVO reinicia una partida limpia (score 0, vidas 3, nivel 1); salir
   de la partida o cambiar de ruta detiene el loop y remueve los listeners de teclado
   (verificar en DevTools tras varias entradas/salidas, sin `requestAnimationFrame` activo ni
   listeners acumulados).
4. Verificación de integración con SPEC 04/06 (leaderboard, sin código nuevo): jugar una
   partida autenticado, terminarla (por game over natural o por FIN), confirmar que el score
   real se guarda en la tabla `scores` con `game_id = "ultimo-refugio"` y aparece en
   `/juegos/ultimo-refugio` y en `/salon-de-la-fama` para ese juego. Jugar como invitado y
   confirmar que no se guarda ningún score (mismo comportamiento ya existente, sin cambios en
   esa lógica).
5. Verificación de regresión del resto del catálogo: `/juegos/rocas/jugar` y
   `/juegos/tetris/jugar` siguen funcionando exactamente igual que antes de esta spec; el resto
   de juegos con simulación falsa (`bloque-buster`, `caida`, `serpentina`, `gloton`,
   `invasores`, `ranaria`, `duelo-pixel`) tampoco cambian su comportamiento.
6. Revisión final: `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [ ] `npm run build` finaliza sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `/juegos` (biblioteca) muestra la card de ÚLTIMO REFUGIO con la clase `.cover-ultimo-refugio`
      aplicada y datos correctos (título, categoría ARCADE, color magenta).
- [ ] En `/juegos/ultimo-refugio/jugar`, el canvas real del motor de la spec `01` se muestra
      dentro de `.crt-screen`, no una simulación falsa.
- [ ] El HUD externo de React (Jugador/Puntuación/Vidas/Nivel) refleja en todo momento los
      valores reales reportados por el engine, sin desincronizarse.
- [ ] El botón "PAUSA" congela el juego y "REANUDAR" lo retoma exactamente donde quedó.
- [ ] El botón "FIN" termina la partida de inmediato con el score acumulado y abre el modal de
      fin de partida.
- [ ] Quedarse sin vidas o sin sustento abre automáticamente el modal de fin de partida con el
      score final.
- [ ] "JUGAR DE NUEVO" reinicia una partida limpia (score 0, vidas 3, nivel 1) sin recargar la
      página.
- [ ] Salir de la partida o navegar a otra ruta detiene el loop del engine y no deja listeners
      de teclado huérfanos (verificable en DevTools).
- [ ] Terminar una partida real de ÚLTIMO REFUGIO estando autenticado guarda el score real
      (no simulado) en la tabla `scores` con `game_id = "ultimo-refugio"`.
- [ ] El score guardado aparece en `/juegos/ultimo-refugio` (leaderboard del juego) y en
      `/salon-de-la-fama` (leaderboard global), sin ningún cambio de código en esas dos páginas.
- [ ] Terminar una partida de ÚLTIMO REFUGIO como invitado (sin sesión) no guarda ningún score.
- [ ] El resto del catálogo (`rocas`, `tetris`, y los juegos con simulación falsa) sigue
      funcionando exactamente igual que antes de esta spec, sin regresiones.

## Decisiones

- **Sí:** categoría `ARCADE`. La mecánica (esquivar + recolectar en tiempo real, sin piezas ni
  enfrentamiento directo entre dos jugadores) encaja mejor en ARCADE que en PUZZLE, SHOOTER o
  VERSUS.
- **Sí:** color `magenta`. De los cuatro colores del catálogo, `magenta` solo está en uso por
  `caida`; se prioriza diversidad visual en la biblioteca sobre agrupar por temática.
- **Sí:** reutilizar el registro `REAL_GAMES` ya creado en SPEC 07 en vez de reintroducir un
  check hardcodeado. Es el tercer juego real; el registro ya existe exactamente para este caso.
- **No:** ningún cambio al contrato de leaderboard (`app/juegos/[id]/page.tsx`,
  `app/salon-de-la-fama/page.tsx`) ni a `AuthProvider.saveScore`. Ya son game-agnósticos por
  `game_id`; un juego nuevo aparece en ambos automáticamente con solo tener entrada en `GAMES`
  y llamar `saveScore` al terminar.
- **No:** una interfaz genérica de "motor de juego" reutilizable entre títulos. Se mantiene la
  decisión ya tomada en SPEC 05/07 y reforzada en la spec `01` de esta carpeta.
- **Sí:** `best`/`plays` iniciales hardcodeados como valores de display razonables para un
  juego recién agregado (`best: 3200`, `plays: "2.1K"`), consistente con la decisión de SPEC 06
  de no derivarlos de Supabase.

## Riesgos

| Riesgo                                                                                                    | Mitigación                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agregar la entrada al registro `REAL_GAMES` rompe el flujo ya existente de `rocas`/`tetris`               | Verificación manual explícita en el paso 5 del plan: confirmar ambos juegos existentes antes de cerrar la spec, no solo el nuevo.                                                               |
| La nueva clase `.cover-ultimo-refugio` choca visualmente o de especificidad CSS con `.cover-*` existentes | Seguir el mismo patrón de las clases `.cover-*` ya presentes en `app/globals.css` (mismo nivel de especificidad, mismo bloque de reglas).                                                       |
| El `game_id` `"ultimo-refugio"` no coincide exactamente entre `lib/data.ts`, `REAL_GAMES` y `saveScore`   | Un único literal de string reutilizado en los tres puntos (`id` del catálogo = clave de `REAL_GAMES` = `game` pasado a `saveScore`), verificado en el paso 4 del plan contra la tabla `scores`. |
