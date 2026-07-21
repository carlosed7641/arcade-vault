# SPEC 02 — Home y Acerca de

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-07-21
> **Objetivo:** Portar `home.jsx` y `about.jsx` de `references/templates/home-about/` como una landing de marketing en `/` y una página `/acerca-de` con formulario de contacto simulado, moviendo la Biblioteca actual de `/` a `/biblioteca`.

## Alcance

**Dentro:**

- Nueva ruta `/` (Home): hero, sección "¿Por qué Arcade Vault?" (4 feature cards), preview de 6 juegos destacados (`GAMES.slice(0, 6)`), bloque de stats, "Actividad en vivo" (ticker + top jugadores) y sección de precios ($0/siempre) con FAQ, más CTA final — portado de `home.jsx`.
- Mover la Biblioteca actual (grid de juegos con búsqueda y filtro por categoría, hoy en `app/page.tsx`) a la nueva ruta `/biblioteca`.
- Nueva ruta `/acerca-de` (About): misión, 3 highlights y formulario de contacto (nombre, correo, mensaje) simulado — portado de `about.jsx`.
- Fusionar en `app/globals.css` las clases de `references/templates/home-about/styles.css` que hoy faltan: `.home-*`, `.about-*`, `.mini-card`, `.feature-card`, `.activity-card`, `.pricing-grid`, `.contact-form`, y demás selectores usados por `home.jsx`/`about.jsx`.
- Actualizar `components/Nav.tsx` (desktop y menú móvil) para reflejar 4 enlaces: Inicio (`/`), Biblioteca (`/biblioteca`), Salón de la Fama (`/salon-de-la-fama`), Acerca de (`/acerca-de`); actualizar `isActive` para que "Biblioteca" se resalte en `/biblioteca` y en `/juegos/*`.
- Actualizar todos los enlaces internos que hoy navegan a `/` esperando la Biblioteca (por ejemplo, "Volver al vault" en Detalle) para que apunten a `/biblioteca`.
- Los datos de Home (juegos destacados, "Top jugadores hoy", ticker de actividad, stat "N+ JUEGOS") se derivan de `GAMES`/`seededScores` de `lib/data.ts`; los textos sin dato real disponible ("MILES DE PARTIDAS", "hace 2 min", etc.) quedan como texto fijo de ejemplo, igual que en la referencia.
- Formulario de contacto en `/acerca-de`: validación de campos no vacíos en cliente y "terminal de éxito" simulado al enviar, sin llamada a backend real (no hay backend de contacto en este spec).

**Fuera de alcance (para specs futuros):**

- Backend real de contacto (envío de email, guardado en base de datos).
- Datos reales de "partidas jugadas" / actividad en vivo (requeriría backend con eventos reales).
- Cualquier cambio a la lógica de juego, autenticación real, o a las rutas ya implementadas en SPEC 01 más allá de mover la Biblioteca y ajustar el Nav.
- Internacionalización y accesibilidad avanzada (se heredan las mismas limitaciones de SPEC 01).
- Tests automatizados.

## Modelo de datos

Esta spec no introduce nuevas estructuras de datos persistentes. Reutiliza `lib/data.ts` (`GAMES`, `seededScores`) creado en SPEC 01.

Estructuras derivadas solo para render en Home (sin persistencia, calculadas en el propio `page.tsx`):

```ts
// Juegos destacados
const featured = GAMES.slice(0, 6);

// Top jugadores "hoy" (reutiliza el mismo generador que Salón de la Fama)
const topPlayers = seededScores(1, 5); // ScoreRow[]

// Ticker de actividad: combina un juego determinista de GAMES
// con una fila de seededScores; el texto de tiempo ("hace X min")
// es fijo, no calculado.
type ActivityRow = {
  game: (typeof GAMES)[number];
  row: ScoreRow; // de seededScores
  timeLabel: string; // ej. "hace 2 min", texto fijo de ejemplo
};
```

Convenciones:

- No se agregan campos nuevos a `Game` ni a `ScoreRow`; Home solo lee y combina lo que ya existe.
- Las semillas (`seed`) usadas en `seededScores` para Home son constantes fijas (no dependen de `id` de ruta), a diferencia de Detalle/Salón de la Fama que las derivan del `id`/`tab`.

## Plan de implementación

1. Mover `app/page.tsx` (Biblioteca) a `app/biblioteca/page.tsx` sin cambios de lógica. Verificar con `npm run dev` que `/biblioteca` muestra la grilla igual que antes.
2. Fusionar en `app/globals.css` los selectores faltantes de `references/templates/home-about/styles.css` (`.home-*`, `.about-*`, `.mini-card`, `.feature-card`, `.activity-card`, `.pricing-grid`, `.contact-form`, y clases auxiliares que usen). Verificar que no rompe estilos existentes recorriendo `/biblioteca`, `/juegos/[id]`, `/login`, `/salon-de-la-fama`.
3. Crear `app/page.tsx` (Home) portando `home.jsx`: hero con `FloatingSilhouettes`, sección de features con `FeatureIcon`, preview de 6 juegos (`MiniCard`) navegando a `/juegos/[id]`, bloque de stats, sección de actividad (ticker + top jugadores) usando `GAMES`/`seededScores`, sección de precios con FAQ y CTA final. Los botones "Explorar juegos" navegan a `/biblioteca`; "Crear cuenta" a `/login`.
4. Crear `app/acerca-de/page.tsx` portando `about.jsx`: hero de misión, 3 highlights (`HighlightIcon`) y formulario de contacto con estado local (`form`, `sent`, `shake`), validación de campos no vacíos y "terminal de éxito" simulado al enviar.
5. Actualizar `components/Nav.tsx`: agregar enlace "Inicio" (`/`), renombrar el enlace de la grilla a `/biblioteca`, agregar enlace "Acerca de" (`/acerca-de`), y ajustar `isActive` para que `/biblioteca` y `/juegos/*` resalten "Biblioteca" mientras `/` resalta "Inicio" solo en la raíz exacta. Replicar los mismos cambios en el panel del menú móvil.
6. Buscar y actualizar referencias internas que hoy navegan a `/` esperando la Biblioteca (ej. "Volver al vault" en `app/juegos/[id]/page.tsx`, y cualquier otra en Reproductor/Salón de la Fama/Login) para que apunten a `/biblioteca`.
7. Revisión final: `npm run lint` y `npm run build` sin errores; recorrido manual por las 7 rutas (`/`, `/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/login`, `/salon-de-la-fama`, `/acerca-de`) verificando paridad visual con la referencia y que la navegación entre pantallas y el Nav funcionan de extremo a extremo.

## Criterios de aceptación

- [ ] `npm run build` finaliza sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `/` muestra la landing de Home (hero, features, preview de juegos, stats, actividad, precios, CTA final), no la grilla de Biblioteca.
- [ ] `/biblioteca` muestra la grilla de juegos con búsqueda y filtro por categoría, igual que antes en `/`.
- [ ] En Home, el botón "▶ EXPLORAR JUEGOS" navega a `/biblioteca`.
- [ ] En Home, el botón "✦ CREAR CUENTA" y el CTA final navegan a `/login`.
- [ ] En Home, hacer click en una de las 6 tarjetas de juegos destacados navega a `/juegos/[id]` con el `id` correcto.
- [ ] En Home, la sección "Top jugadores · hoy" muestra 5 filas generadas por `seededScores` y el botón "Ver salón" navega a `/salon-de-la-fama`.
- [ ] `/acerca-de` muestra la sección de misión, los 3 highlights y el formulario de contacto.
- [ ] Enviar el formulario de contacto en `/acerca-de` con campos vacíos activa la animación "shake" y no muestra el mensaje de éxito.
- [ ] Enviar el formulario de contacto con los 3 campos completos muestra el "terminal de éxito" con el nombre ingresado.
- [ ] El botón "Enviar otro mensaje" en el terminal de éxito limpia el formulario y permite enviar de nuevo.
- [ ] El header (`Nav`) muestra 4 enlaces: Inicio, Biblioteca, Salón de la Fama, Acerca de, en ese orden, tanto en desktop como en el menú móvil.
- [ ] Estando en `/juegos/[id]` o `/juegos/[id]/jugar`, el enlace "Biblioteca" del Nav aparece resaltado como activo.
- [ ] El botón "Volver al vault" (o equivalente) en Detalle navega a `/biblioteca`, no a `/`.

## Decisiones

- **Sí:** `/` pasa a ser Home (landing de marketing) y la Biblioteca se mueve a `/biblioteca`. Es el patrón estándar (raíz = landing) y calza con los 4 enlaces de nav de la referencia (Inicio, Biblioteca, Salón, Acerca de).
- **No:** dejar la Biblioteca en `/` y meter Home en otra ruta (ej. `/inicio`). Rompería la convención de que la raíz del sitio es la landing.
- **Sí:** los datos de Home (destacados, top jugadores, ticker) se derivan de `GAMES`/`seededScores` de `lib/data.ts` en vez de copiar los arrays hardcodeados de la referencia tal cual. Mantiene consistencia con el catálogo real y con lo ya hecho en Salón de la Fama; evita una segunda fuente de verdad desincronizada.
- **Sí:** los textos sin dato real disponible ("MILES DE PARTIDAS", "hace 2 min", etc.) quedan como texto fijo de ejemplo. No hay backend de eventos/analítica en este spec para calcularlos de verdad.
- **Sí:** el formulario de contacto queda simulado (validación en cliente + terminal de éxito falso), sin backend real. Consistente con que el proyecto aún no tiene backend (mismo criterio que login/puntuaciones en SPEC 01).
- **No:** implementar envío real de contacto (email, base de datos). Fuera de alcance hasta que exista un spec de backend.
- **Sí:** mantener el patrón de SPEC 01 de escribir la lógica de cada página directamente en su `page.tsx` (sin componentes `Home.tsx`/`About.tsx` separados), igual que `app/salon-de-la-fama/page.tsx` y `app/juegos/[id]/page.tsx`. Consistencia con el resto del proyecto.
- **No:** crear componentes reutilizables `FeatureCard`/`ActivityTicker` en `components/` a menos que se reutilicen en más de una página; por ahora solo los usa Home.

## Riesgos

| Riesgo                                                                                          | Mitigación                                                                                                   |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Mover la Biblioteca de `/` a `/biblioteca` rompe enlaces o marcadores existentes que esperaban la grilla en la raíz | Aceptado: el proyecto está en MVP sin usuarios reales todavía; se documenta el cambio de ruta en este spec.  |
| Fusionar `styles.css` de la referencia en `globals.css` puede generar selectores duplicados o en conflicto con lo ya portado en SPEC 01 | Revisar diffs de clases antes de pegar; verificar visualmente las 7 rutas tras la fusión (paso 7 del plan).  |
| El Nav actual no tiene un cuarto slot para "Acerca de" probado en el layout de menú móvil/desktop | Verificar en viewport móvil y desktop que los 4 enlaces no rompen el layout (`av-nav`, `av-mobile-panel`).   |

## Lo que **no** está en este spec

- Backend real de contacto (envío de email, guardado en base de datos).
- Datos reales de "partidas jugadas" o actividad en vivo (requeriría backend con eventos reales).
- Cambios a la lógica de juego, autenticación real, o a rutas de SPEC 01 más allá de mover la Biblioteca y ajustar el Nav.
- Internacionalización y accesibilidad avanzada más allá de lo heredado de la referencia.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
