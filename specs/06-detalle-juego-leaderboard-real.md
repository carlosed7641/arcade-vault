# SPEC 06 — Leaderboard real en la página de detalle del juego

> **Estado:** Implementado
> **Depende de:** SPEC 04 (Supabase auth y scores)
> **Fecha:** 2026-07-22
> **Objetivo:** Reemplazar el panel "MEJORES PUNTUACIONES" de `app/juegos/[id]/page.tsx` (actualmente `seededScores`, data ficticia generada por seed) por una consulta real a la tabla `scores` de Supabase, mostrando el top 10 con una fila por usuario (mejor score por usuario) para el juego correspondiente.

## Alcance

**Dentro:**

- Actualizar `app/juegos/[id]/page.tsx` (Server Component `async`, ya existente): reemplazar `seededScores(id.length * 17 + 3, 10)` (lib/data.ts) por una consulta real al top 10 de la tabla `scores` de Supabase, filtrada por `game_id = id`, con una fila por usuario (su mejor score), igual criterio que `app/salon-de-la-fama/page.tsx`.
- Usar el cliente de servidor (`lib/supabase/server.ts`, ya existente de SPEC 04) para hacer la consulta directamente en el Server Component, sin pasar por un client component.
- Si no hay ninguna partida guardada para ese `game_id`, mostrar el mismo patrón de estado vacío que el Salón de la Fama ("Sé el primero en dejar tu marca") en vez de la lista.
- Mantener el diseño visual exacto del panel `leaderboard` (filas `top1`/`top2`/`top3`, formato de fecha `es-ES`, mismo layout).

**Fuera de alcance:**

- `game.plays` y `game.best` (stat-strip "Partidas" y "Mejor global") siguen hardcodeados en `lib/data.ts`, sin cambios.
- `seededScores` y su tipo `ScoreRow` en `lib/data.ts` no se eliminan en esta spec si aún los usa otro lugar del código (se verifica en el plan; si queda sin uso, se elimina en el paso de limpieza).
- No se toca `app/salon-de-la-fama/page.tsx` (ya usa data real).
- No se agrega loading state (a diferencia del Salón de la Fama que es client component con `useEffect`, esta página es Server Component `async`: el loading lo maneja Next.js de forma nativa vía Suspense/streaming si aplica, sin lógica adicional).
- Tests automatizados.

## Modelo de datos

No se introduce ninguna estructura nueva. Se reutiliza la tabla `scores` (con embedding a `profiles`) ya definida en SPEC 04. La consulta es equivalente a la que usa `app/salon-de-la-fama/page.tsx`, pero ejecutada en servidor:

```ts
const supabase = await createClient(); // lib/supabase/server.ts
const { data } = await supabase
  .from("scores")
  .select("score, created_at, profiles(username)")
  .eq("game_id", id)
  .order("score", { ascending: false })
  .limit(100);
// post-procesado: 1 fila por usuario (mejor score), top 10
```

El resultado se mapea al mismo shape que hoy consume el JSX del panel (`rank`, `name`, `score`, `date`), reemplazando `ScoreRow` de `lib/data.ts` por este mapeo local (sin depender de `seededScores`).

## Plan de implementación

1. En `app/juegos/[id]/page.tsx`, importar `createClient` de `lib/supabase/server.ts` (patrón ya usado en `app/layout.tsx` de SPEC 04) y eliminar el import de `seededScores`.
2. Reemplazar la línea `const scores = seededScores(...)` por una consulta `async` a `scores` (`.select("score, created_at, profiles(username)")`, `.eq("game_id", id)`, `.order("score", { ascending: false })`, `.limit(100)`), seguida de un post-procesado en el propio Server Component que se queda con la primera aparición por `username` (mejor score, ya viene ordenado desc) y corta en 10 filas, mapeando a `{ rank, name: username, score, date }`.
3. Ajustar el JSX del panel `leaderboard`: si el array resultante está vacío, mostrar el mismo mensaje de estado vacío que usa `app/salon-de-la-fama/page.tsx` ("SÉ EL PRIMERO EN DEJAR TU MARCA EN {game.title}"); si no, renderizar las filas igual que hoy (sin cambios de estructura/clases CSS).
4. Verificar si `seededScores` y el tipo `ScoreRow` de `lib/data.ts` siguen usándose en algún otro archivo (`grep`); si quedaron sin ningún uso, eliminarlos de `lib/data.ts`.
5. Verificación manual (`npm run dev`): entrar a `/juegos/rocas` (el único juego con partidas reales posibles vía SPEC 05) tras jugar y guardar al menos un score, confirmar que el panel muestra ese score real; entrar a `/juegos/<otro-id-sin-scores>` y confirmar que muestra el estado vacío en vez de data ficticia.
6. Revisión final: `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [x] `npm run build` finaliza sin errores.
- [x] `npm run lint` no reporta errores.
- [x] `/juegos/[id]` ya no llama a `seededScores`; el panel "MEJORES PUNTUACIONES" consulta la tabla `scores` de Supabase en el servidor.
- [x] Para un juego con partidas reales guardadas (ej. `rocas`), el panel muestra el top 10 real, con una sola fila por usuario (su mejor score), ordenado descendente.
- [x] Para un juego sin ninguna partida guardada, el panel muestra un estado vacío explícito ("Sé el primero en dejar tu marca...") en vez de una lista ficticia.
- [x] El diseño visual del panel (filas `top1`/`top2`/`top3`, formato de fecha, layout) es idéntico al actual.
- [x] `game.plays` y `game.best` (stat-strip) no cambian de comportamiento — siguen siendo los valores hardcodeados de `lib/data.ts`.
- [x] Si `seededScores`/`ScoreRow` quedaron sin uso en el resto del código, fueron eliminados de `lib/data.ts`; si siguen usándose en otro lugar, se dejaron intactos.

## Decisiones

- **Sí:** consulta directa en el Server Component (sin pasar por un client component ni por una API route nueva). Es un Server Component `async` ya existente y `lib/supabase/server.ts` ya soporta este patrón (usado en `app/layout.tsx`, SPEC 04); evita el parpadeo de loading que sí tiene el Salón de la Fama (client component).
- **Sí:** una fila por usuario (mejor score), igual criterio que el Salón de la Fama. Mantiene consistencia entre ambas vistas de leaderboard del sitio.
- **No:** cambiar `game.plays`/`game.best` a datos reales en esta spec. Decisión explícita del usuario — solo se pidió la tabla; esas stats quedan como trabajo futuro si se necesita.
- **No:** agregar loading state. Al ser Server Component, no hay estado de carga en cliente que gestionar (a diferencia del Salón de la Fama).
- **Sí:** mismo mensaje y patrón visual de estado vacío que `app/salon-de-la-fama/page.tsx`, para consistencia entre ambas pantallas.
