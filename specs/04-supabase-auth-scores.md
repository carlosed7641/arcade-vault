# SPEC 04 — Autenticación y puntajes reales con Supabase

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-07-22
> **Objetivo:** Reemplazar el login/registro simulado (`AuthProvider` basado en `localStorage`) por autenticación real con Supabase Auth (email/contraseña, resuelta por username) y persistir los puntajes de partidas en una tabla `scores` de Supabase, mostrando datos reales en el Salón de la Fama en vez de `seededScores`.

## Alcance

**Dentro:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr` como dependencias.
- Crear `lib/supabase/client.ts` (cliente de navegador, `createBrowserClient`) y `lib/supabase/server.ts` (cliente de servidor, `createServerClient` con cookies de `next/headers`), usando `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Crear `proxy.ts` en la raíz del proyecto (convención de Next.js 16.2.10, reemplaza a `middleware.ts`) que refresca la sesión de Supabase en cada request usando el cliente de servidor, siguiendo el patrón oficial de `@supabase/ssr`.
- Crear en Supabase (vía migración SQL con `mcp__supabase__apply_migration`):
  - Tabla `profiles` (perfil público mínimo: `id`, `username`, `created_at`), enlazada 1:1 a `auth.users`.
  - Tabla `scores` (puntajes de partidas: `id`, `user_id`, `game_id`, `score`, `created_at`).
  - Políticas de RLS en ambas tablas (detalladas en Modelo de datos).
- Reemplazar `components/AuthProvider.tsx`: el `user` deja de ser `{ name } | null` sacado de `localStorage` y pasa a reflejar la sesión real de Supabase (`{ id, username } | null`), con `login`/`signup`/`logout` respaldados por Supabase Auth y sincronizados vía `supabase.auth.onAuthStateChange`.
- Hacer `app/layout.tsx` un server component `async` que lee la sesión con el cliente de servidor y pasa un `initialUser` a `AuthProvider`, evitando el parpadeo de "no autenticado" que hoy existe (comentario explícito en el código actual sobre esta limitación).
- Crear una Server Action de login (`app/login/actions.ts`) que resuelve `username → email` (usando la service role key, solo en servidor) y luego llama a `signInWithPassword` desde el servidor.
- Actualizar `app/login/page.tsx`: la pestaña "CREAR CUENTA" llama a la Server Action de signup (crea usuario en Supabase Auth + fila en `profiles` con el `username` elegido); la pestaña "INICIAR SESIÓN" sigue pidiendo solo usuario+contraseña, resolviendo el email internamente. Se agrega manejo de error visible (usuario/email duplicado, credenciales inválidas) sin romper la estética actual del formulario.
- El botón "JUGAR COMO INVITADO" se mantiene igual: no crea sesión de Supabase, `user` queda `null`, sin fila en `profiles`.
- Actualizar `app/juegos/[id]/jugar/page.tsx`: `saveScore` inserta en la tabla `scores` de Supabase cuando hay usuario autenticado; si es invitado, el puntaje no se guarda (se mantiene el comportamiento visual actual de fin de partida, pero sin persistencia).
- Actualizar `app/salon-de-la-fama/page.tsx`: reemplaza `seededScores` por una consulta real a `scores` (mejor puntaje por usuario, por juego, ordenado desc). Si no hay puntajes reales para un juego, se muestra un estado vacío explícito.
- Documentar en `.env.template` las nuevas variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server-only).
- Documentar como paso manual (no automatizable vía MCP): desactivar "Confirm email" en el dashboard de Supabase (Authentication → Providers → Email) para que el signup quede auto-confirmado.

**Fuera de alcance (para specs futuras):**

- Login social (Google/GitHub) — los botones actuales quedan decorativos.
- Supabase Realtime (mencionado como trabajo futuro, no en esta spec).
- Supabase Edge Functions (mencionado como trabajo futuro, no en esta spec).
- Migrar el catálogo de juegos (`GAMES`) a una tabla de Supabase.
- Recuperación de contraseña ("olvidé mi contraseña"), cambio de username/perfil, o cualquier gestión de cuenta más allá de signup/login/logout.
- Rate limiting o anti-abuso en la inserción de puntajes (un usuario autenticado podría insertar puntajes arbitrarios llamando al cliente directamente; no hay validación server-side del gameplay en esta spec).
- Poblar `scores` con datos de ejemplo/seed reales — el Salón de la Fama mostrará vacío hasta que existan partidas reales.
- Tests automatizados.

## Modelo de datos

### Tabla `profiles`

Perfil público mínimo, 1:1 con `auth.users`. Solo guarda lo que el resto de la app necesita mostrar (username); el email vive únicamente en `auth.users` (gestionado por Supabase Auth).

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 20),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
```

### Tabla `scores`

Un registro por partida terminada. `game_id` es el `id` (slug) tal cual vive hoy en `GAMES` de `lib/data.ts` — sin FK, porque el catálogo no vive en la base de datos (ver Decisiones).

```sql
create table public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id text not null,
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx on public.scores (game_id, score desc);

alter table public.scores enable row level security;

create policy "scores are publicly readable"
  on public.scores for select
  using (true);

create policy "users can insert their own scores"
  on public.scores for insert
  with check (auth.uid() = user_id);
```

`scores.user_id` referencia `profiles.id` (no `auth.users.id` directamente) para que PostgREST pueda hacer _embedding_ (`scores.select('score, created_at, profiles(username)')`) al armar el leaderboard sin exponer más que el username.

### Variables de entorno nuevas

```bash
# .env.template — placeholders, sin valores reales
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

`SUPABASE_SECRET_KEY` es server-only (nunca se usa en un client component); se usa solo dentro de la Server Action de login para resolver `username → email` vía `supabase.auth.admin.getUserById`.

### Contrato cliente ↔ servidor (Server Actions)

```ts
// app/login/actions.ts
type LoginPayload = { username: string; password: string };
type SignupPayload = { username: string; email: string; password: string };
type AuthResult = { ok: true } | { ok: false; error: string };
```

Convenciones:

- `AuthProvider`'s `user` pasa de `{ name } | null` a `{ id: string; username: string } | null`, poblado desde la sesión real de Supabase (`onAuthStateChange` + `initialUser` inyectado desde `app/layout.tsx`).
- `signUp` y `signIn` corren como Server Actions (`"use server"`) que escriben la sesión directamente vía cookies usando el cliente de servidor de `@supabase/ssr`; el cliente solo llama la acción y refresca su estado con `router.refresh()` / `onAuthStateChange`.
- El login resuelve `username → email` así: (1) buscar `id` en `profiles` por `username` con el cliente de servidor (lectura pública, sin service role); (2) obtener el `email` de ese `id` con `supabase.auth.admin.getUserById(id)` usando el cliente con `SUPABASE_SECRET_KEY`; (3) `signInWithPassword({ email, password })` con el cliente de servidor normal (no admin) para que la sesión quede en las cookies.

## Plan de implementación

1. Instalar `@supabase/supabase-js` y `@supabase/ssr` (`npm install`). Agregar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` a `.env.template` (placeholders) y a `.env.local` (valores reales del proyecto Supabase ya conectado). Verificar `npm run build` sigue pasando (sin uso aún de las nuevas env vars).
2. Aplicar la migración SQL de `profiles` y `scores` (con sus políticas RLS, sección Modelo de datos) usando `mcp__supabase__apply_migration`. Verificar con `mcp__supabase__list_tables` que ambas tablas existen.
3. Paso manual (fuera de las herramientas MCP disponibles): en el dashboard de Supabase, Authentication → Providers → Email, desactivar "Confirm email" para que el signup quede auto-confirmado. Documentar este paso en el README o en un comentario de esta spec para quien reproduzca el entorno.
4. Crear `lib/supabase/client.ts` (cliente de navegador con `createBrowserClient`), `lib/supabase/server.ts` (cliente de servidor con `createServerClient` + cookies de `next/headers`, para Server Actions y Server Components) y `lib/supabase/admin.ts` (cliente con `SUPABASE_SECRET_KEY`, marcado `import "server-only"`, usado solo para resolver `username → email` en el login).
5. Crear `proxy.ts` en la raíz siguiendo el patrón oficial de `@supabase/ssr` para Next.js: refresca la sesión en cada request y reescribe las cookies actualizadas en la respuesta. Verificar que `npm run dev` sigue sirviendo todas las rutas sin errores (el proxy no redirige nada todavía, solo refresca sesión).
6. Crear `app/login/actions.ts` con dos Server Actions:
   - `signup(payload: SignupPayload): Promise<AuthResult>` — valida username (3-20 chars) y formato de email, llama `supabase.auth.signUp({ email, password })` con el cliente de servidor, inserta la fila en `profiles` con el `id` devuelto y el `username`; si el username ya existe, retorna error legible.
   - `signin(payload: LoginPayload): Promise<AuthResult>` — resuelve `username → id` en `profiles`, luego `email` vía `lib/supabase/admin.ts` (`auth.admin.getUserById`), luego `signInWithPassword({ email, password })` con el cliente de servidor; si el username no existe o la contraseña es incorrecta, retorna un error genérico ("Usuario o contraseña incorrectos") sin filtrar cuál de los dos falló.
7. Reescribir `components/AuthProvider.tsx`: `user` pasa a `{ id, username } | null`; recibe un `initialUser` opcional por props (para hidratar sin parpadeo); se suscribe a `supabase.auth.onAuthStateChange` con el cliente de navegador para mantener `user` sincronizado; `logout` llama `supabase.auth.signOut()` (cliente de navegador); se elimina toda la lógica de `localStorage` para `user` (el modo invitado sigue existiendo como estado local en memoria, sin persistencia, ver Decisiones).
8. Convertir `app/layout.tsx` en `async function` que usa `lib/supabase/server.ts` para leer la sesión y, si existe, el `username` desde `profiles`; pasa ese `initialUser` a `<AuthProvider>`. Verificar recarga de página con sesión activa ya no muestra el Nav en estado "no autenticado" antes de hidratar.
9. Actualizar `app/login/page.tsx`: `submit` (tab "in") invoca `signin` vía `useTransition`; el submit de "up" invoca `signup`; ambos casos muestran error visible (reutilizando el patrón de estado de error ya usado en `app/acerca-de/page.tsx`, SPEC 03) y mantienen el formulario editable con lo ya escrito si falla. En éxito, `router.push("/biblioteca")` como hoy. "JUGAR COMO INVITADO" no cambia.
10. Actualizar `app/juegos/[id]/jugar/page.tsx`: `saveScore` (desde `AuthProvider`) inserta en `scores` con el cliente de navegador cuando `user` no es `null`; si `user` es `null` (invitado), no hace ninguna llamada a Supabase (comportamiento actual sin persistencia se mantiene).
11. Actualizar `app/salon-de-la-fama/page.tsx`: reemplaza `seededScores` por una consulta a `scores` con `.select("score, created_at, profiles(username)")`, filtrando por `game_id = tab`, ordenando por `score desc`, limitando a 12, y quedándose con el mejor puntaje por usuario (vía `distinct on (user_id)` en una función/vista SQL, o post-procesado en el cliente si el volumen es bajo). Si no hay filas, se muestra un estado vacío ("Sé el primero en dejar tu marca") en vez de la maqueta actual con podio.
12. Revisión final: `npm run lint` y `npm run build` sin errores; `mcp__supabase__get_advisors` para revisar que no haya alertas de seguridad (ej. RLS faltante) en las tablas nuevas; prueba manual end-to-end: crear cuenta, cerrar sesión, iniciar sesión con el username creado, jugar una partida y verificar que el puntaje aparece en el Salón de la Fama; probar también con "JUGAR COMO INVITADO" y confirmar que no se guarda nada.

## Criterios de aceptación

- [x] `npm run build` finaliza sin errores.
- [x] `npm run lint` no reporta errores.
- [x] Las tablas `profiles` y `scores` existen en el proyecto de Supabase, con RLS activado y las políticas descritas en Modelo de datos (`mcp__supabase__get_advisors` no reporta alertas de seguridad sobre RLS en estas tablas).
- [x] `.env.template` incluye `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` como placeholders, sin valores reales.
- [x] Crear una cuenta nueva en `/login` (pestaña CREAR CUENTA) con username, correo y contraseña crea el usuario en Supabase Auth, crea su fila en `profiles`, inicia sesión automáticamente (sin requerir confirmación de correo) y navega a `/biblioteca`.
- [x] Intentar crear una cuenta con un username ya existente muestra un error visible en el formulario y no crea una segunda fila en `profiles`.
- [x] Cerrar sesión (botón del Nav) y volver a iniciar sesión en `/login` (pestaña INICIAR SESIÓN) usando solo username + contraseña autentica correctamente sin pedir correo.
- [x] Iniciar sesión con un username inexistente o una contraseña incorrecta muestra el mismo mensaje de error genérico ("Usuario o contraseña incorrectos") en ambos casos.
- [x] "JUGAR COMO INVITADO" sigue funcionando: navega a `/biblioteca` con `user = null`, sin crear sesión de Supabase ni fila en `profiles`.
- [x] Recargar la página estando autenticado no muestra un parpadeo del Nav en estado "no autenticado" antes de reflejar la sesión real.
- [x] Terminar una partida en `/juegos/[id]/jugar` estando autenticado inserta una fila en `scores` con el `user_id`, `game_id` y `score` correctos.
- [x] Terminar una partida como invitado NO inserta ninguna fila en `scores`.
- [x] `/salon-de-la-fama`, al seleccionar un juego con puntajes reales guardados, muestra esos puntajes (username y score reales) en vez de `seededScores`.
- [x] `/salon-de-la-fama`, al seleccionar un juego sin puntajes reales todavía, muestra un estado vacío explícito en vez de datos falsos.
- [x] Un usuario autenticado no puede insertar un puntaje con `user_id` distinto al suyo (verificar que la política RLS de `scores` rechaza el intento, por ejemplo probando con la API REST de Supabase con un JWT de otro usuario).

## Decisiones

- **Sí:** cubrir autenticación + persistencia de puntajes en una sola spec. Es lo mínimo para que el Salón de la Fama tenga sentido con usuarios reales (puntajes reales requieren saber quién los hizo).
- **No:** Realtime ni Edge Functions en esta spec. Quedan como trabajo futuro explícito (mencionado por el usuario), sin caso de uso concreto todavía.
- **Sí:** el catálogo de juegos (`GAMES`) se queda hardcodeado en `lib/data.ts`. No hay panel de administración ni necesidad de editar juegos dinámicamente todavía; migrar a una tabla `games` es una spec futura si se necesita.
- **Sí:** solo email + contraseña como método de autenticación. Los botones de Google/GitHub en el login ya existen en el UI pero son decorativos hoy; agregarlos como proveedores OAuth reales es una spec futura (requiere configurar apps OAuth externas).
- **Sí:** se mantiene "JUGAR COMO INVITADO" sin persistencia. Es el mismo comportamiento de hoy; no bloquea el juego detrás de una cuenta.
- **Sí:** el Salón de la Fama reemplaza `seededScores` por datos reales, mostrando un estado vacío cuando no hay puntajes. Evita que conviva data falsa con data real y que un jugador crea que compite contra puntajes que no existen.
- **Sí:** arquitectura SSR completa con `@supabase/ssr` (`proxy.ts` + cliente de servidor + cliente de navegador), en vez de solo cliente de navegador. Es el patrón oficial recomendado por Supabase para Next.js App Router y evita el parpadeo de sesión no autenticada en la carga inicial.
- **Sí (desviación por versión de Next.js):** el archivo se llama `proxy.ts`, no `middleware.ts`. Next.js 16.2.10 renombró Middleware a Proxy (mismo propósito y API); `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` lo confirma explícitamente.
- **Sí:** signup auto-confirmado (sin verificación de correo). Consistente con que el flujo simulado actual ("CREAR Y JUGAR") inicia sesión de inmediato; evita depender de configurar envío de emails de Supabase Auth en el MVP. Requiere un paso manual en el dashboard (no automatizable vía las herramientas MCP disponibles hoy).
- **Sí:** el login sigue pidiendo solo username + contraseña (sin agregar un campo de correo al formulario existente). Se resuelve `username → email` en servidor con la secret key. Mantiene el UI actual sin cambios visibles, a costa de una consulta extra en el login.
- **Sí (desviación detectada durante la implementación):** se usan las claves modernas de Supabase (`Publishable`/`Secret`) en vez de las legacy (`anon`/`service_role`). `.env.local` ya traía `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de una configuración previa, y el dashboard marca `anon`/`service_role` como "Legacy". Variables finales: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (en vez de `NEXT_PUBLIC_SUPABASE_ANON_KEY`) y `SUPABASE_SECRET_KEY` (en vez de `SUPABASE_SERVICE_ROLE_KEY`). Funcionalmente son intercambiables: ambas se pasan igual a `createBrowserClient`/`createServerClient`, y la secret key sigue soportando `auth.admin.*` y bypass de RLS igual que `service_role`.
- **No:** exponer el email de un usuario a través de una política RLS pública en `profiles`. El email vive únicamente en `auth.users`, accesible solo vía `auth.admin.getUserById` con la service role key, siempre en servidor.
- **Sí:** `scores.user_id` referencia `profiles.id` (no `auth.users.id` directamente), para poder usar el _embedding_ de PostgREST (`profiles(username)`) al construir el leaderboard sin exponer más campos que el username.
- **No:** validación server-side del gameplay al insertar un puntaje (un usuario autenticado técnicamente podría insertar un score arbitrario llamando al cliente de Supabase directamente). Aceptado para este MVP; anti-abuso/rate limiting queda fuera de alcance, igual que se decidió para el formulario de contacto en SPEC 03.
- **No:** recuperación de contraseña, edición de perfil/username, ni gestión de cuenta más allá de signup/login/logout. Son specs futuras si se necesitan.

## Riesgos

| Riesgo                                                                                                                                                                         | Mitigación                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_SECRET_KEY` se filtra al cliente por error (ej. importada en un componente `"use client"`)                                                                           | `lib/supabase/admin.ts` se marca con `import "server-only"` para que el build falle si se importa desde código de cliente.                                                                                         |
| Un usuario autenticado inserta puntajes arbitrarios llamando directamente a la API de Supabase (no hay validación de gameplay)                                                 | Aceptado para este MVP (mismo criterio que SPEC 03 con el formulario de contacto); se documenta como riesgo conocido, a revisitar si se detecta abuso real en el Salón de la Fama.                                 |
| Olvidar desactivar "Confirm email" en el dashboard de Supabase deja el signup roto (usuario creado pero sin poder iniciar sesión hasta confirmar)                              | Se documenta como paso manual explícito en el plan (paso 3) y como criterio de aceptación verificable manualmente antes de cerrar la spec.                                                                         |
| La migración de `AuthProvider` (de `localStorage` a sesión real de Supabase) rompe páginas que hoy asumen `user.name` en vez de `user.username`                                | Se listan explícitamente en el plan (paso 7) los archivos que consumen `useAuth()` (`Nav.tsx`, `login/page.tsx`, `salon-de-la-fama/page.tsx`, `juegos/[id]/jugar/page.tsx`) para revisarlos todos antes de cerrar. |
| El proyecto de Supabase conectado hoy está vacío (0 tablas); aplicar la migración en el proyecto equivocado o sin revisar `list_tables` antes podría chocar con trabajo futuro | Se usa `mcp__supabase__list_tables` antes y después de la migración (pasos 2 y 12) para confirmar el estado esperado.                                                                                              |
