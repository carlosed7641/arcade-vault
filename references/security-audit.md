# Security Audit Log

Memoria persistente del agente `security-auditor`. Cada fila es un hallazgo de seguridad
(Supabase, código de la app, o configuración/secretos) auditado contra el checklist de
`references/templates/security/security.-checklist.md` y las decisiones cerradas en
SPEC 10/11. El agente lee este archivo para no re-auditar ni re-reportar como pendiente algo
que ya está corregido o aceptado.

Estados: Cumple · Incompleto · Corregido · Aceptado (riesgo conocido)

- [x] **RLS habilitado en `profiles` y `scores`** (Supabase → tablas `public.profiles`,
      `public.scores`) — severidad: bloqueante — estado: Cumple — (2026-08-06) verificado en
      SPEC 04/11, sin acción pendiente.
- [x] **`rls_auto_enable()` invocable vía PostgREST por `anon`/`authenticated`** (Supabase →
      función `public.rls_auto_enable()`, `SECURITY DEFINER`) — severidad: medio — estado:
      Corregido — (2026-08-06) `EXECUTE` revocado de `public`/`anon`/`authenticated` vía
      migración `revoke_rls_auto_enable_execute` (SPEC 11); el event trigger de DDL sigue
      funcionando porque Postgres lo invoca como el owner, no como el rol que ejecuta el DDL.
- [x] **Headers de seguridad ausentes en Next.js** (config → `next.config.ts`) — severidad:
      medio — estado: Corregido — (2026-08-06) agregados `X-Content-Type-Options`,
      `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`
      aplicados a `source: '/(.*)'` (SPEC 11).
- [x] **Min password length sin configurar** (Supabase → Auth Settings, dashboard) —
      severidad: medio — estado: Corregido — (2026-08-06) longitud mínima = 8, paso manual de
      dashboard (SPEC 11).
- [x] **Rate limit de signups nativo sin ajustar** (Supabase → Auth Rate Limits, dashboard) —
      severidad: menor — estado: Corregido — (2026-08-06) ajustado a 2 signups/hora, decisión
      explícita del usuario, paso manual de dashboard (SPEC 11).
- [ ] **Leaked password protection deshabilitada** (Supabase → Auth Settings, dashboard,
      advisor `auth_leaked_password_protection`) — severidad: medio — estado: **Aceptado
      (riesgo conocido)** — (2026-08-06) requiere plan de pago Supabase (Pro+), no disponible
      actualmente; no reportar como pendiente hasta que se decida el upgrade de plan (SPEC 11).
- [ ] **Content-Security-Policy ausente** (config → `next.config.ts`) — severidad: medio —
      estado: **Aceptado (riesgo conocido)** — (2026-08-06) descartado explícitamente en
      SPEC 11: requeriría auditar todos los scripts/estilos inline del proyecto; no
      implementar sin pedido explícito del usuario en el turno actual.

- [x] **`scores` insertable con `game_id` arbitrario vía PostgREST directo** (Supabase →
      tabla `public.scores`, policy `users can insert their own scores`) — severidad:
      bloqueante — estado: Corregido — (2026-08-06) `alter policy` vía migración
      `restrict_scores_insert_to_known_games`: el `with_check` ahora exige
      `game_id in ('rocas','tetris','ranaria')` además de `auth.uid() = user_id`. Cierra el
      vector de un usuario autenticado insertando puntajes falsos para juegos que no existen
      (rompía el filtro por catálogo en el Salón de la Fama). No se agregó cota de magnitud
      al `score` (además del `check (score >= 0)` ya existente) porque requiere una decisión
      de producto por juego (score máximo plausible por motor) — queda **Incompleto**:
      recomendado abrir una spec futura de anti-cheat/validación server-authoritative del
      puntaje si se vuelve un problema real (hoy solo 3 juegos con motor real y RLS ya limita
      quién puede escribir).
- [x] **Loop potencialmente infinito al derivar username en OAuth** (app →
      `app/auth/callback/route.ts`, `ensureProfile`) — severidad: medio — estado: Corregido —
      (2026-08-06) el sufijo numérico (`_2`, `_3`, ...) se truncaba junto con
      `slice(0, 20)` cuando el username base ya medía 20 caracteres, produciendo el mismo
      candidato para siempre (DoS por loop infinito de queries a `profiles`). Se reserva
      espacio para el sufijo antes de truncar, se acota el bucle a `MAX_ATTEMPTS = 50` con un
      fallback determinístico (`player_<primeros 12 chars del user id>`), y se registra
      (no se ignora) el error de `insert` en `profiles`.
- [x] **`signup()` reenvía el mensaje crudo de error de Supabase Auth al cliente**
      (app → `app/login/actions.ts`) — severidad: menor — estado: Corregido — (2026-08-06)
      se agregó un filtro (`signupErrorMessage`) que solo deja pasar mensajes relacionados a
      política de contraseña (necesarios para la UX validada en SPEC 11: "Password should be
      at least 8 characters"); cualquier otro error (rate limits, detalles internos) cae a un
      mensaje genérico. No se toca el flujo de `signin()`, que ya usaba un mensaje genérico.
- [x] **Formulario de contacto sin límite de longitud/sanitización** (app →
      `app/acerca-de/actions.ts`, `sendContactMessage`) — severidad: menor — estado:
      Corregido — (2026-08-06) `name` y `msg` ahora se recortan (`trim`) y validan longitud
      (`name`: 2–80, `msg`: 1–2000) antes de interpolarse en el `text` enviado vía Resend;
      cierra el vector de spam/relay abierto sin rate limiting de código (el rate limiting de
      signups en dashboard, SPEC 11, no cubre esta ruta — sigue sin límite de tasa propio,
      aceptado como riesgo menor dado que Resend tiene sus propios límites de cuenta).

## Notas de contexto (no son hallazgos, son guía para el agente)

- Único uso de `lib/supabase/admin.ts` (`createAdminClient`, service role) en todo el repo:
  `app/login/actions.ts`. Cualquier import nuevo fuera de ahí es hallazgo bloqueante hasta
  justificarse.
- Únicos archivos con `"use server"`: `app/login/actions.ts`, `app/acerca-de/actions.ts`.
- `proxy.ts` solo refresca la sesión de Supabase (no protege rutas privadas) — no hay rutas
  privadas hoy, así que es informativo, no un bug.
- Variables `NEXT_PUBLIC_*` legítimas: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Ninguna otra variable de `.env.template` debe
  llevar ese prefijo ni aparecer en código cliente.
