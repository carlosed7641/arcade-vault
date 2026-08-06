# SPEC 10 — Login social real con Google y GitHub

**Estado:** Implementado
**Depende de:** SPEC 04
**Fecha:** 2026-08-06
**Objetivo:** Conectar los botones decorativos "GOOGLE" y "GITHUB" de `/login` a OAuth real vía Supabase Auth, creando (o vinculando, si el email ya existe) un perfil en `profiles` con un username derivado automáticamente.

## Alcance

**Dentro:**

- Crear las OAuth apps de Google (Google Cloud Console) y GitHub (GitHub Developer Settings) y configurar sus Client ID/Secret en el dashboard de Supabase (Authentication → Providers → Google / GitHub) — documentado como paso manual, igual que "Confirm email" en SPEC 04.
- Conectar los botones "◆ GOOGLE" y "▣ GITHUB" de `app/login/page.tsx` (hoy sin `onClick`) a `supabase.auth.signInWithOAuth({ provider })` desde el cliente de navegador, con `redirectTo` apuntando a la nueva ruta de callback.
- Crear `app/auth/callback/route.ts` (Route Handler, patrón oficial de `@supabase/ssr` para Next.js App Router): intercambia el `code` de la URL por una sesión (`exchangeCodeForSession`), y redirige a `/biblioteca`.
- Derivar y crear automáticamente la fila en `profiles` la primera vez que un usuario entra vía OAuth (no pasa por la Server Action `signup` de SPEC 04, que solo corre en el flujo usuario+contraseña): username = slug del `full_name`/`user_name` que entrega el proveedor (o de la parte local del email si no viene nombre), recortado a 20 caracteres, con sufijo numérico incremental (`_2`, `_3`, ...) si ya existe en `profiles`.
- Vinculación automática por email: si el email de la cuenta de Google/GitHub coincide con un usuario ya registrado (con o sin contraseña), el login entra a esa misma cuenta/perfil existente en vez de crear una fila duplicada en `profiles`. Se apoya en el comportamiento nativo de Supabase Auth de identidades vinculadas por email verificado entre proveedores (mismo `auth.users.id`); solo se agrega la lógica de creación de perfil para cuando ese `id` todavía no tiene fila en `profiles`.
- Manejo de error visible: si `signInWithOAuth` falla o el callback recibe un error del proveedor (`?error=` en la URL de retorno), se redirige a `/login` mostrando un mensaje de error legible, sin romper el formulario usuario+contraseña existente.
- Actualizar `.env.template`/documentación si el flujo requiere alguna variable nueva (a confirmar en el plan; en principio no debería, ya que las credenciales OAuth viven en el dashboard de Supabase, no en el proyecto Next.js).

**Fuera de alcance:**

- Cualquier otro proveedor OAuth (Facebook, Discord, etc.) — solo Google y GitHub, que son los botones que ya existen en el UI.
- Pantalla adicional para elegir username manualmente tras el primer login OAuth (se decidió derivarlo automáticamente).
- Cambios al flujo usuario+contraseña existente de SPEC 04 (`signin`/`signup`), más allá de lo necesario para que ambos flujos convivan sin duplicar perfiles.
- Recuperación de contraseña, edición de perfil/username, desvinculación de cuentas OAuth.
- Tests automatizados.
- Rate limiting o anti-abuso adicional al ya aceptado como riesgo conocido en SPEC 04.

## Modelo de datos

No se crean tablas nuevas. `profiles` (SPEC 04) se reutiliza tal cual — mismo esquema (`id`, `username`, `created_at`), sin agregar columnas (no se guarda de qué proveedor vino el usuario; no hace falta para ninguna funcionalidad actual).

### Derivación de username en el primer login OAuth

Ocurre en `app/auth/callback/route.ts`, después de `exchangeCodeForSession`, solo si `profiles` no tiene fila para `session.user.id`:

```ts
// Fuente del nombre candidato, en orden de preferencia:
// session.user.user_metadata.full_name (Google) o .user_name (GitHub) → si no hay, parte local del email.
function slugifyUsername(raw: string): string {
  // minúsculas, sin acentos, espacios → "_", solo [a-z0-9_], recortado a 20 chars
}

// Si el slug < 3 chars, se rellena con "player".
// Si ya existe en `profiles`, se prueba slug + "_2", "_3", ... hasta encontrar uno libre.
```

Esta lógica corre con el cliente de servidor (mismo patrón que `signup` en SPEC 04), no con la service role — la política RLS `"users can insert their own profile"` (`auth.uid() = id`) ya lo permite porque la sesión OAuth recién creada tiene `auth.uid()` igual al `id` que se inserta.

### Vinculación por email

No requiere código propio de vinculación: es el comportamiento nativo de Supabase Auth (identidades múltiples bajo el mismo `auth.users.id` cuando el email coincide y está verificado por el proveedor). El único código nuevo es defensivo: el callback siempre hace `select` antes de `insert` en `profiles` por `id`, así que si el `id` ya tiene perfil (porque el email ya existía, vía password o vía otro proveedor OAuth) no se duplica la fila ni se sobreescribe el username elegido originalmente.

### Contrato de la ruta de callback

```ts
// app/auth/callback/route.ts
// GET /auth/callback?code=...          → éxito: redirect a /biblioteca
// GET /auth/callback?error=...&error_description=...  → falla: redirect a /login?error=<mensaje legible>
```

`app/login/page.tsx` lee `?error=` de la URL (vía `useSearchParams`) al montar y lo muestra en el mismo bloque `.form-error` que ya usa para errores de `signin`/`signup`.

## Plan de implementación

1. **Paso manual: crear las OAuth apps.** En Google Cloud Console, crear credenciales OAuth 2.0 (tipo "Web application") con el redirect URI que exige Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`); en GitHub Developer Settings, crear una OAuth App con el mismo callback URL. Cargar ambos Client ID/Secret en el dashboard de Supabase (Authentication → Providers → Google / GitHub) y habilitar ambos providers.
   Verificación: `mcp__supabase__get_advisors` o revisión manual del dashboard confirma que Google y GitHub aparecen como "Enabled" en Providers.

2. **Crear `app/auth/callback/route.ts`.** Route Handler que usa `lib/supabase/server.ts` para `exchangeCodeForSession(code)` si viene `code` en la query; si viene `error`/`error_description`, redirige a `/login?error=...`. En éxito, verifica si existe fila en `profiles` para el `id` de la sesión; si no existe, deriva el username (slug + sufijo si colisiona) y la inserta.
   Verificación: `npx tsc --noEmit` sin errores.

3. **Conectar los botones de `app/login/page.tsx`.** Agregar `onClick` a "◆ GOOGLE" y "▣ GITHUB" que llaman `supabase.auth.signInWithOAuth({ provider: "google" | "github", options: { redirectTo: `${location.origin}/auth/callback` } })` con el cliente de navegador (`lib/supabase/client.ts`). Leer `?error=` de la URL con `useSearchParams` al montar y mostrarlo en el `.form-error` existente.
   Verificación: `npx tsc --noEmit` sin errores; `npm run lint` sin errores.

4. **Prueba manual: login nuevo con Google.** Desde `/login`, click en "◆ GOOGLE" con una cuenta de Google cuyo email no existe en `profiles`. Verificar que vuelve a `/biblioteca` autenticado, y que se creó una fila en `profiles` con un username derivado razonable.
   Verificación: `mcp__supabase__execute_sql` o revisión del dashboard confirma la fila nueva en `profiles`.

5. **Prueba manual: login nuevo con GitHub.** Mismo procedimiento que el paso 4 con GitHub y una cuenta de GitHub con email distinto a la usada en el paso 4.
   Verificación: fila nueva en `profiles` con username derivado del `user_name` de GitHub.

6. **Prueba manual: vinculación por email existente.** Crear una cuenta por username+contraseña (flujo SPEC 04) usando un email X. Cerrar sesión. Iniciar sesión con Google o GitHub usando una cuenta cuyo email sea exactamente X. Verificar que entra a la misma cuenta (mismo username, mismos scores previos) y que `profiles` sigue teniendo una sola fila para ese usuario.
   Verificación: conteo de filas en `profiles` para ese `id` es 1, antes y después.

7. **Prueba manual: colisión de username derivado.** Provocar que dos cuentas OAuth distintas deriven el mismo slug base (nombres iguales o emails con la misma parte local) y verificar que la segunda cuenta recibe el sufijo numérico (`_2`) en vez de fallar el insert.

8. **Revisión final.** `npm run lint` y `npm run build` sin errores; confirmar que el flujo usuario+contraseña de SPEC 04 (signup, login, logout, invitado) sigue funcionando sin regresiones.

## Criterios de aceptación

- [x] `npx tsc --noEmit`, `npm run lint` y `npm run build` finalizan sin errores.
- [x] Los providers Google y GitHub están habilitados en el dashboard de Supabase con sus Client ID/Secret configurados. Verificado indirectamente: ambos logins reales completaron el intercambio de código sin error de provider deshabilitado.
- [x] Click en "◆ GOOGLE" en `/login` inicia el flujo OAuth de Google y, tras autorizar, vuelve autenticado a `/biblioteca`. Probado en vivo con una cuenta real de Google.
- [x] Click en "▣ GITHUB" en `/login` inicia el flujo OAuth de GitHub y, tras autorizar, vuelve autenticado a `/biblioteca`. Probado en vivo con una cuenta real de GitHub.
- [x] Un login OAuth con un email nuevo (sin cuenta previa) crea una fila en `profiles` con un username derivado no vacío, entre 3 y 20 caracteres. Verificado: login con GitHub (email `cecastro@caracoltv.com.co`, sin cuenta previa) creó `profiles.username = "carlos_castro_reales"` (20 caracteres).
- [x] Un login OAuth cuyo email ya está asociado a una cuenta existente (creada por username+contraseña o por otro proveedor) entra a esa misma cuenta sin crear una segunda fila en `profiles`. Verificado: login con Google usando el email de la cuenta existente `testpx2` vinculó la identidad `google` a ese mismo `user_id` (`auth.identities` quedó con `email` + `google` para un solo usuario); `profiles` no ganó una fila nueva.
- [x] Dos logins OAuth que derivarían el mismo username base terminan con usernames distintos (sufijo numérico), sin que el segundo falle por unicidad. Verificado por revisión de código: `ensureProfile` en `app/auth/callback/route.ts` hace `select` por `username` antes de cada `insert` dentro de un bucle `while`, incrementando el sufijo hasta encontrar uno libre; no se disparó en esta sesión porque no se dispuso de una segunda cuenta OAuth con nombre colisionante.
- [x] Un error del proveedor OAuth (ej. el usuario cancela el consentimiento) redirige a `/login` mostrando un mensaje de error visible, sin romper el formulario usuario+contraseña. Verificado navegando directamente a `/auth/callback?error=access_denied&error_description=...`: redirigió a `/login` mostrando "El usuario canceló la autorización" con el formulario intacto.
- [x] El flujo usuario+contraseña de SPEC 04 (signup, login, logout, "JUGAR COMO INVITADO") sigue funcionando sin cambios de comportamiento. `app/login/actions.ts` no se modificó en esta spec; el único cambio en `app/login/page.tsx` fue agregar los `onClick` de OAuth y la lectura de `?error=`, sin tocar el `submit` de usuario+contraseña.
- [x] Un usuario que entra vía OAuth puede jugar una partida y su puntaje se guarda en `scores` igual que un usuario de username+contraseña (mismo `saveScore` de `AuthProvider`, sin cambios). `AuthProvider.saveScore` no se modificó y usa `user.id` de la sesión activa sin distinguir el método de login; la sesión de Google quedó vinculada al mismo `user.id` que ya tenía partidas guardadas por contraseña.

## Decisiones

- **Sí:** derivar el username automáticamente en el primer login OAuth, sin pantalla intermedia. Razón (confirmada por el usuario): entrada más rápida, consistente con que "JUGAR COMO INVITADO" tampoco pide pasos extra; el username derivado no es crítico para la identidad del jugador (puede diferir del que usaría en el flujo manual).
- **Sí:** vincular automáticamente por email en vez de rechazar con error. Razón (confirmada por el usuario): evita que un jugador termine con dos cuentas (y dos historiales de `scores`) separadas solo por haber entrado una vez con Google y otra con contraseña. Se apoya en el comportamiento nativo de identidades vinculadas de Supabase Auth, no en lógica propia de matching.
- **Sí:** documentar la creación de las OAuth apps (Google Cloud Console, GitHub Developer Settings) y su carga en el dashboard de Supabase como paso manual explícito (paso 1 del plan), igual que se hizo con "Confirm email" en SPEC 04 — no es automatizable vía las herramientas MCP disponibles.
- **Sí:** redirigir siempre a `/biblioteca` tras un login OAuth exitoso, igual que el login tradicional. Razón (confirmada por el usuario): consistencia con el flujo existente; no se implementa tracking del origen de navegación.
- **Sí:** el callback vive en `app/auth/callback/route.ts` (Route Handler), no en una Server Action. Es el patrón oficial de `@supabase/ssr` para el flujo `signInWithOAuth` + PKCE en Next.js App Router — a diferencia del login por contraseña, el `code` llega por redirect del proveedor, no por un submit de formulario.
- **No:** agregar columna a `profiles` para registrar el proveedor de origen (Google/GitHub/password). No hay ninguna funcionalidad hoy que la necesite; se puede agregar en una spec futura si aparece un caso de uso (ej. mostrar "conectado con Google" en un perfil).
- **No:** permitir elegir/editar el username derivado tras el primer login OAuth en esta spec. Es gestión de perfil, ya fuera de alcance en SPEC 04 y no pedida ahora.
- **No:** proveedores OAuth adicionales a Google/GitHub. Son los únicos botones que ya existen en el UI; agregar otros requeriría cambios de diseño no solicitados.

## Riesgos

| Riesgo                                                                                                                                                                 | Mitigación                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El redirect URI configurado en Google/GitHub no coincide exactamente con el que espera Supabase, dejando el login OAuth roto con un error genérico del proveedor.      | Paso 1 del plan usa explícitamente el callback URL que expone el dashboard de Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`), no uno inventado; se verifica con un login de prueba antes de cerrar la spec (pasos 4-5).                                                       |
| Dos usuarios con nombres muy comunes (ej. "Juan Pérez") derivan el mismo slug base repetidamente, generando usernames poco distintivos (`juan_perez_14`).              | Aceptado como riesgo cosmético menor: no bloquea el login ni colisiona (paso 7 verifica que el sufijo numérico funciona); el username se puede cambiar en una spec futura de edición de perfil.                                                                                                |
| Un usuario cuyo email de Google/GitHub no viene verificado por el proveedor termina vinculado a una cuenta que no le pertenece (suplantación vía email no verificado). | Se documenta como riesgo conocido, mitigado por el comportamiento por defecto de Supabase Auth de solo vincular identidades con email verificado; no se agrega verificación adicional propia en esta spec.                                                                                     |
| El insert de `profiles` en el callback falla por una condición de carrera (dos requests simultáneos del mismo `id` nuevo, ej. doble callback).                         | La política RLS y el `select`-antes-de-`insert` reducen la ventana; si ocurre, el segundo insert falla por `username` o `id` duplicado y el callback debe manejarlo sin romper el login (reintenta lectura de `profiles` en vez de propagar el error al usuario) — a implementar en el paso 2. |
