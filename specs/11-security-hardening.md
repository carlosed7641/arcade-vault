# SPEC 11 — Endurecimiento de seguridad (checklist básico)

**Estado:** Implementado
**Depende de:** SPEC 04 (Supabase Auth), SPEC 10 (login social OAuth)
**Fecha:** 2026-08-06
**Objetivo:** Cerrar los hallazgos de seguridad del checklist básico (`references/templates/security/security.-checklist.md`) más el `SECURITY DEFINER` expuesto detectado en los advisors de Supabase — configuración de Auth, revocación de permisos en Postgres, y headers de seguridad en Next.js.

## Alcance

**Dentro:**

- **Headers de seguridad en Next.js** (código real): agregar `headers()` a `next.config.ts` con `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (HSTS) y `Permissions-Policy` (deshabilitando APIs de navegador no usadas por la app: cámara, micrófono, geolocalización), aplicados a todas las rutas (`source: '/(.*)'`).
- **Revocar `EXECUTE` de `public.rls_auto_enable()`** para los roles `public`/`anon`/`authenticated` vía migración SQL (`mcp__supabase__apply_migration`). Es una función `SECURITY DEFINER` que solo debe invocarse como event trigger de DDL (el sistema la ejecuta como el owner independientemente de los grants a roles) — revocar `EXECUTE` no rompe su función real y cierra el WARN de los advisors sin tocar su lógica.
- **Min password length = 8 caracteres**: configurar en el dashboard de Supabase (Authentication → Policies/Settings → Password), documentado como paso manual (mismo patrón que "Confirm email" en SPEC 04 y las OAuth apps en SPEC 10).
- **Max signup rate**: ajustar el rate limit nativo de signups por hora en el dashboard de Supabase (Authentication → Rate Limits), paso manual.
- Verificación final con `mcp__supabase__get_advisors` (tipo `security`) confirmando que los WARNs abordados ya no aparecen.

**Fuera de alcance:**

- **Leaked password protection.** Requiere un plan de pago de Supabase (Pro o superior) — no disponible en el plan actual del proyecto. Queda diferido a cuando se decida hacer el upgrade de plan; el WARN `auth_leaked_password_protection` sigue apareciendo en los advisors como riesgo conocido y aceptado por ahora.
- RLS en `scores`/`profiles` — ya está habilitado, no requiere acción (verificado en Phase 1).
- CAPTCHA/hCaptcha/Turnstile en el formulario de signup — descartado explícitamente; solo se ajusta el rate limit nativo.
- Cualquier otro hallazgo de los advisors de Supabase no mencionado arriba (ej. otros lints de performance) — fuera de esta spec.
- Cambios al flujo de login/signup de SPEC 04 o al flujo OAuth de SPEC 10 más allá de la configuración de Auth ya descrita — no se toca `actions.ts` ni `app/auth/callback/route.ts`.
- Content-Security-Policy (CSP) — no estaba en el checklist ni se pidió; agregarlo requeriría auditar todos los scripts/estilos inline del proyecto, trabajo mayor no solicitado aquí.
- Tests automatizados.

## Modelo de datos

No se introducen tablas ni tipos de dominio nuevos. El único cambio de esquema es a nivel de permisos (no de estructura): revocar `EXECUTE` sobre la función existente `public.rls_auto_enable()` para los roles `public`, `anon` y `authenticated`, vía una migración SQL:

```sql
-- migración: revoke_rls_auto_enable_execute
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
```

El resto de los ítems (min password length, leaked password protection, max signup rate) son configuración del dashboard de Supabase Auth, no cambios de esquema. Los headers de seguridad son configuración de Next.js (`next.config.ts`), no datos.

## Plan de implementación

1. **Migración: revocar `EXECUTE` de `rls_auto_enable()`.** Aplicar vía `mcp__supabase__apply_migration` el SQL de la sección de modelo de datos (revoke a `public`, `anon`, `authenticated`).
   Verificación: `mcp__supabase__get_advisors` (tipo `security`) ya no lista `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable` para `rls_auto_enable`.

2. **Agregar headers de seguridad en `next.config.ts`.** Añadir un array `securityHeaders` con `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security` (`max-age=63072000; includeSubDomains; preload`) y `Permissions-Policy` (`camera=(), microphone=(), geolocation=()`), aplicado a `source: '/(.*)'` en `headers: async () => [...]`.
   Verificación: `npx tsc --noEmit` sin errores; `npm run build` y confirmar en el response HTTP local (`curl -I http://localhost:3000` con `npm start`) que los 5 headers están presentes.

3. **Paso manual: Min password length.** En el dashboard de Supabase (Authentication → Settings → Password), configurar longitud mínima = 8.
   Verificación: revisión manual del dashboard confirma el valor guardado.

4. ~~Paso manual: Leaked password protection.~~ **Diferido** — requiere plan de pago de Supabase (Pro+), no disponible actualmente. Ver sección "Fuera de alcance".

5. **Paso manual: Max signup rate.** En Authentication → Rate Limits, ajustar/confirmar el límite de signups por hora.
   Verificación: revisión manual del dashboard confirma el valor guardado. **Valor real configurado: 2 signups/hora** (elegido por el usuario, más restrictivo que el rango conservador estimado en la spec original).

6. **Prueba manual: password corta rechazada.** Intentar crear una cuenta con contraseña de menos de 8 caracteres desde `/login` (flujo signup de SPEC 04) y confirmar que Supabase Auth rechaza el signup con un error legible en el formulario existente.

7. **Revisión final.** `mcp__supabase__get_advisors` (tipo `security`) para confirmar que los 2 WARNs de SECURITY DEFINER ya no aparecen (`auth_leaked_password_protection` sigue apareciendo, diferido — ver "Fuera de alcance"); `npm run lint` y `npm run build` sin errores; confirmar que los flujos de SPEC 04 (signup/login/logout/invitado) y SPEC 10 (OAuth Google/GitHub) siguen funcionando sin regresiones.

## Criterios de aceptación

- [x] `mcp__supabase__apply_migration` aplicó exitosamente la revocación de `EXECUTE` sobre `public.rls_auto_enable()` para `public`/`anon`/`authenticated`.
- [x] `mcp__supabase__get_advisors` (tipo `security`) ya no reporta `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable` para `rls_auto_enable`.
- [x] Una request HTTP a cualquier ruta del sitio (verificado con `curl -I`) responde con los 5 headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, `Permissions-Policy`.
- [x] `npx tsc --noEmit`, `npm run lint` y `npm run build` finalizan sin errores.
- [x] El dashboard de Supabase Auth tiene: longitud mínima de password = 8, y el rate limit de signups ajustado (2/hora) — verificado por revisión manual del dashboard.
- [ ] ~~`mcp__supabase__get_advisors` ya no reporta `auth_leaked_password_protection`~~ — diferido, requiere plan de pago (ver "Fuera de alcance"). El WARN sigue presente y es esperado; no bloquea el cierre de esta spec.
- [x] Un intento de signup con password de menos de 8 caracteres es rechazado por Supabase Auth con un mensaje de error visible en `/login`, sin romper el formulario existente. Verificado en vivo: "Password should be at least 8 characters."
- [x] El flujo usuario+contraseña de SPEC 04 (signup, login, logout, invitado) y el flujo OAuth de SPEC 10 (Google, GitHub) siguen funcionando sin cambios de comportamiento tras aplicar los headers y la revocación de permisos. Verificado en vivo: logout, invitado (redirige a `/biblioteca`), botones Google/GitHub visibles.
- [x] RLS en `scores` y `profiles` sigue habilitado (no debería cambiar, pero se reconfirma como parte de la revisión final).

## Decisiones

- **Sí:** revocar `EXECUTE` de `public.rls_auto_enable()` en vez de cambiarla a `SECURITY INVOKER` o moverla de schema. Razón: es una función de event trigger que Postgres invoca como el owner sin importar los grants de rol a rol; revocar `EXECUTE` cierra el vector de llamada directa vía PostgREST (`/rest/v1/rpc/...`) sin alterar su comportamiento real como trigger de DDL.
- **Sí:** incluir el hallazgo de `rls_auto_enable` aunque no estaba en el checklist original del usuario. Razón (confirmada por el usuario): es un WARN de seguridad real y activo detectado en los advisors vigentes; el fix es una migración aislada de bajo riesgo, coherente con el objetivo general de la spec.
- **Sí:** ampliar el set de headers más allá del ejemplo del checklist (agregar HSTS y Permissions-Policy). Razón (confirmada por el usuario): son headers estándar de cualquier checklist de seguridad de Next.js, no requieren dependencias ni configuración adicional, y cierran gaps que el ejemplo del checklist no cubría (forzar HTTPS, restringir APIs de navegador).
- **Sí:** tratar min password length, leaked password protection y max signup rate como pasos manuales de configuración en el dashboard de Supabase, no como código. Razón: son toggles/valores de Supabase Auth sin contraparte en el repo — mismo patrón ya usado en SPEC 04 ("Confirm email") y SPEC 10 (OAuth apps).
- **No:** agregar CAPTCHA al signup. Razón (confirmada por el usuario): el checklist solo pide limitar la tasa de signups, cubierto por el rate limit nativo; CAPTCHA expande el alcance con dependencias de UI no solicitadas.
- **No:** implementar Content-Security-Policy. Razón: no está en el checklist del usuario; requeriría auditar todos los scripts/estilos inline del proyecto, trabajo mayor fuera del pedido actual.
- **No:** tocar RLS de `scores`/`profiles`. Razón: ya está habilitado, verificado antes de escribir la spec.
- **No:** habilitar leaked password protection en esta spec. Razón (confirmada por el usuario durante la implementación): la función requiere un plan de pago de Supabase (Pro o superior), no disponible actualmente en el proyecto. Se documenta como riesgo conocido y aceptado; se retoma cuando se decida hacer el upgrade de plan.

## Riesgos

| Riesgo                                                                                                                                                                                                                                                   | Mitigación                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security` con `preload` es difícil de revertir rápido si algo queda mal configurado con HTTPS (los navegadores lo cachean agresivamente).                                                                                              | Se usa `max-age` estándar sin enviar el dominio a la lista de preload de navegadores (eso requiere un paso de submission manual aparte, no automático); si algo falla, expira en el `max-age` configurado.                                                                                                                                                                        |
| `Permissions-Policy` deshabilita APIs (cámara/micrófono/geolocalización) que ningún juego usa hoy, pero si una spec futura agrega un juego que sí las necesite, quedaría bloqueado silenciosamente.                                                      | Riesgo aceptado como bajo: ninguna feature actual ni planeada usa esas APIs; si aparece, se ajusta el header puntualmente en esa spec futura.                                                                                                                                                                                                                                     |
| Revocar `EXECUTE` sobre `rls_auto_enable()` podría romper la creación automática de RLS en tablas nuevas si algún flujo depende de invocarla manualmente (no solo vía event trigger).                                                                    | Se verifica en el paso 1 que el event trigger sigue funcionando (los triggers de DDL invocan la función como el owner, no como el rol que ejecuta el DDL, por lo que el revoke no afecta ese camino); si una migración futura crea una tabla y no queda con RLS habilitado automáticamente, se detecta con `mcp__supabase__get_advisors` (tipo `security`, lint de RLS faltante). |
| Leaked password protection quedó diferido por depender de un plan de pago de Supabase; el WARN `auth_leaked_password_protection` permanece activo indefinidamente.                                                                                       | Riesgo aceptado por el usuario; se retoma cuando se decida el upgrade de plan (ver sección "Fuera de alcance").                                                                                                                                                                                                                                                                   |
| El rate limit de signups se configuró en 2/hora (decisión explícita del usuario, más restrictivo de lo estimado originalmente) — podría bloquear usuarios legítimos en un pico de tráfico real (ej. si el sitio se comparte ampliamente en poco tiempo). | Riesgo aceptado por el usuario; se puede re-ajustar desde el dashboard sin necesidad de otra spec si se detecta que bloquea tráfico real.                                                                                                                                                                                                                                         |
