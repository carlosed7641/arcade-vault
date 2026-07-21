# SPEC 03 — Envío real de correo en el formulario de contacto (About)

> **Estado:** Implementado
> **Depende de:** SPEC 02
> **Fecha:** 2026-07-21
> **Objetivo:** Reemplazar la simulación del formulario de contacto en `/acerca-de` por un envío real de correo usando Resend a través de una Server Action, manteniendo la UI existente (shake, terminal de éxito) y agregando un estado de error visible.

## Alcance

**Dentro:**

- Instalar el SDK `resend` como dependencia del proyecto.
- Crear una Server Action (`"use server"`) en `app/acerca-de/actions.ts` que reciba `{ name, email, msg }`, valide formato de email con una regex simple en el servidor, y envíe el correo usando el SDK de Resend con remitente de pruebas `onboarding@resend.dev`.
- El correo se envía a la dirección fija definida en la variable de entorno `CONTACT_TO_EMAIL`, usando `RESEND_API_KEY` para autenticar con Resend. Ambas variables son server-only (sin prefijo `NEXT_PUBLIC_`).
- Formato del correo: asunto fijo `"Nuevo mensaje de contacto — Arcade Vault"`, cuerpo en texto plano con Nombre, Correo y Mensaje.
- Actualizar `app/acerca-de/page.tsx` para que `onSubmit` invoque la Server Action (vía `useTransition`) en lugar de solo hacer `setSent(form.name.trim())` localmente:
  - Mientras la Server Action está pendiente, el botón de envío se deshabilita y muestra `"ENVIANDO…"`.
  - Si la Server Action responde éxito, se muestra el mismo "terminal de éxito" ya existente.
  - Si la Server Action responde error (email inválido, fallo de Resend, `RESEND_API_KEY`/`CONTACT_TO_EMAIL` faltante), se muestra un nuevo estado de error dentro del formulario (línea de error visible, estilo consistente con la estética CRT/terminal existente) y el formulario permanece editable con los datos ingresados intactos.
  - La validación de campos vacíos en cliente (shake) se mantiene igual que hoy, antes de invocar la Server Action.
- Documentar en el spec (sección de decisiones/plan) las variables de entorno requeridas (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`) y agregar un `.env.local.example` (o similar) con placeholders, sin valores reales.

**Fuera de alcance (para specs futuros):**

- Verificar un dominio propio en Resend / usar un remitente distinto a `onboarding@resend.dev` (asumido en modo pruebas).
- Rate limiting o protección anti-spam del formulario (captcha, throttling por IP).
- Persistencia de los mensajes de contacto en base de datos (hoy solo se envían por correo, no se guardan).
- Notificaciones al usuario que envía el mensaje (correo de confirmación automático a su propia dirección).
- Tests automatizados.

## Modelo de datos

Esta spec no introduce estructuras de datos persistentes (no hay base de datos). Define un contrato simple entre el cliente y la Server Action:

```ts
// app/acerca-de/actions.ts
type ContactPayload = {
  name: string;
  email: string;
  msg: string;
};

type ContactResult =
  | { ok: true }
  | { ok: false; error: string }; // mensaje corto para mostrar en el "terminal" del form
```

Variables de entorno (server-only, no expuestas al cliente):

```bash
# .env.local (no versionado)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
CONTACT_TO_EMAIL=team@example.com
```

Convenciones:

- `ContactPayload` es exactamente lo que hoy vive en el estado `form` de `AboutPage` (`{ name, email, msg }`); no se agregan campos nuevos.
- La Server Action valida `email` con una regex simple (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) antes de llamar a Resend; si no matchea, retorna `{ ok: false, error: "..." }` sin llegar a invocar el SDK.
- `RESEND_API_KEY` y `CONTACT_TO_EMAIL` se leen con `process.env` dentro de la Server Action (nunca en un componente cliente). Si falta alguna, la acción retorna `{ ok: false, error: "..." }` en vez de lanzar una excepción no controlada.

## Plan de implementación

1. Agregar la dependencia `resend` a `package.json` (`npm install resend`) y verificar que el proyecto sigue instalando/compilando sin errores.
2. Crear `.env.local.example` en la raíz con `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=` como placeholders (sin valores reales); confirmar que `.env.local` está en `.gitignore` (Next.js lo ignora por defecto).
3. Crear `app/acerca-de/actions.ts` con la Server Action `sendContactMessage(payload: ContactPayload): Promise<ContactResult>`:
   - Valida formato de `email` con regex; si falla, retorna `{ ok: false, error: "Correo inválido." }`.
   - Lee `RESEND_API_KEY` y `CONTACT_TO_EMAIL` de `process.env`; si falta alguna, retorna `{ ok: false, error: "Configuración de correo incompleta." }`.
   - Instancia `new Resend(RESEND_API_KEY)` y llama a `resend.emails.send({ from: "onboarding@resend.dev", to: CONTACT_TO_EMAIL, subject: "Nuevo mensaje de contacto — Arcade Vault", text: ... })` con Nombre/Correo/Mensaje en el cuerpo.
   - Envuelve la llamada en `try/catch`; en error retorna `{ ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." }`.
   - En éxito retorna `{ ok: true }`.
4. Actualizar `app/acerca-de/page.tsx`:
   - Importar `useTransition` y la Server Action.
   - Agregar estado `error: string | null`.
   - En `onSubmit`, tras pasar la validación de campos vacíos (shake), llamar a `startTransition(async () => { const res = await sendContactMessage(form); ... })`.
   - Si `res.ok`, limpiar `error` y hacer `setSent(form.name.trim())` como hoy.
   - Si `!res.ok`, hacer `setError(res.error)` y no tocar `sent` (el form sigue mostrando los campos con lo ya escrito).
   - Botón de envío: `disabled={isPending}`, texto `isPending ? "▶ ENVIANDO…" : "▶ ENVIAR MENSAJE"`.
   - Renderizar el mensaje de `error` (si existe) dentro del formulario, con una clase CSS nueva simple (ej. `.form-error`) reutilizando la paleta de color existente (rojo/magenta de acentos ya usados en la referencia).
5. Agregar en `app/globals.css` el selector `.form-error` (o el que se defina) con estilo consistente (tipografía pixel/mono, color de alerta), sin tocar clases existentes de `.contact-form`.
6. Revisión final: `npm run lint` y `npm run build` sin errores; prueba manual en `/acerca-de` con una `RESEND_API_KEY` real de pruebas y `CONTACT_TO_EMAIL` configurados en `.env.local`, verificando: envío exitoso llega a la bandeja destino, envío con `RESEND_API_KEY` inválida muestra el error en el form sin romper la página, y que el estado "ENVIANDO…" se ve brevemente durante la llamada.

## Criterios de aceptación

- [x] `npm run build` finaliza sin errores.
- [x] `npm run lint` no reporta errores.
- [x] La dependencia `resend` está en `package.json` (`dependencies`).
- [x] Existe `.env.template` (ajustado desde `.env.local.example`, ver Decisiones) con `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=` como placeholders, sin valores reales.
- [x] `app/acerca-de/actions.ts` exporta una Server Action que valida el email, lee `RESEND_API_KEY`/`CONTACT_TO_EMAIL` y llama al SDK de Resend.
- [x] Enviar el formulario con los 3 campos vacíos sigue mostrando la animación "shake" existente y no invoca la Server Action.
- [x] Enviar el formulario con datos válidos y credenciales de Resend correctas en `.env.local` hace que llegue un correo real a `CONTACT_TO_EMAIL` con asunto `"Nuevo mensaje de contacto — Arcade Vault"` y el nombre/correo/mensaje en el cuerpo.
- [x] Mientras la Server Action está en curso, el botón de envío se deshabilita y muestra `"▶ ENVIANDO…"`.
- [x] Tras un envío exitoso, se muestra el mismo "terminal de éxito" ya existente con el nombre ingresado.
- [x] Si `RESEND_API_KEY` es inválida o falta, o si el email no tiene formato válido, el formulario muestra un mensaje de error visible, permanece editable y conserva los datos ya ingresados (no se pierde lo escrito).
- [x] El botón "Enviar otro mensaje" en el terminal de éxito sigue limpiando el formulario y permitiendo un nuevo envío, igual que hoy.

## Decisiones

- **Sí:** usar una Server Action (`"use server"`) en vez de un Route Handler (`app/api/contacto/route.ts`). Encaja mejor con App Router y evita crear un endpoint HTTP público adicional solo para este formulario.
- **No:** crear un Route Handler REST. Añadiría una capa extra (fetch manual, manejo de JSON) sin beneficio dado que el form y la acción viven en el mismo árbol de la app.
- **Sí:** usar el remitente de pruebas `onboarding@resend.dev` de Resend. El proyecto no tiene dominio propio verificado en Resend todavía; verificar dominio queda fuera de alcance.
- **Sí:** destino fijo vía `CONTACT_TO_EMAIL` en variable de entorno, en vez de un buzón dinámico o selector. No existe backend/admin en el proyecto para gestionar destinatarios distintos.
- **Sí:** validar formato de email también en el servidor (regex simple), no solo confiar en la validación de cliente ya existente. Buena práctica básica: el cliente puede ser bypaseado.
- **Sí:** en caso de error (Resend caído, key inválida, email inválido), mostrar el error en el formulario y mantenerlo editable, en vez de caer a un "éxito" simulado. Evita que el usuario crea que su mensaje llegó cuando no fue así.
- **Sí:** estado de carga con `useTransition` y botón deshabilitado (`"ENVIANDO…"`) mientras se llama a Resend. Evita doble envío y da feedback inmediato, consistente con la estética "terminal" del proyecto.
- **No:** rate limiting, captcha o protección anti-spam en este spec. El proyecto sigue en MVP sin usuarios reales masivos todavía; se puede agregar en un spec futuro si se detecta abuso.
- **No:** guardar los mensajes de contacto en base de datos. El proyecto no tiene backend de persistencia más allá de `localStorage` (SPEC 01); guardarlos requeriría un spec de backend aparte.
- **Sí (desviación en implementación):** usar `.env.template` en vez de `.env.local.example` para los placeholders. `.gitignore` ignora `.env*` con la única excepción de `.env.template`; `.env.local.example` habría quedado ignorado por git y nunca se hubiera commiteado.

## Riesgos

| Riesgo                                                                                          | Mitigación                                                                                                   |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY` o `CONTACT_TO_EMAIL` faltan en producción y el formulario falla silenciosamente | La Server Action detecta variables faltantes explícitamente y retorna un error visible en el form, en vez de lanzar una excepción no controlada. |
| El remitente de pruebas `onboarding@resend.dev` puede tener límites de envío o ser marcado como spam por el proveedor destino | Aceptado para este spec (modo pruebas); verificar dominio propio queda como trabajo futuro si se necesita mayor entregabilidad. |
| Sin rate limiting, el formulario podría ser usado para enviar spam o abusar de la cuota de Resend | Aceptado por ahora dado el volumen esperado en MVP; se documenta como fuera de alcance, a revisitar si se detecta abuso. |
| `.env.local` con la API key real se commitea por error al repo                                   | Se agrega solo `.env.local.example` con placeholders; se verifica que `.env.local` esté cubierto por `.gitignore` antes de cerrar el spec. |
