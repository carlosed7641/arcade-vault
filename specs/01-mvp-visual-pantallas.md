# SPEC 01 — MVP visual de Arcade Vault

> **Estado:** Aprobado
> **Depende de:** Ninguno
> **Fecha:** 2026-07-17
> **Objetivo:** Portar las 5 pantallas de `references/templates/` (Biblioteca, Detalle, Reproductor, Login y Salón de la Fama) a rutas reales de Next.js App Router, con la estética CRT/neón original y datos simulados, sin implementar lógica jugable real.

## Alcance

**Dentro:**

- 5 rutas de App Router: `/` (Biblioteca), `/juegos/[id]` (Detalle), `/juegos/[id]/jugar` (Reproductor), `/login` (Auth), `/salon-de-la-fama` (Salón de la Fama).
- `Nav` (header + menú móvil) y footer compartidos en `app/layout.tsx`.
- Estética visual completa portada desde `references/templates/styles.css` (fondo con ruido, efectos neón, tipografía pixel, tarjetas, CRT, podio, etc.).
- Fuentes Press Start 2P, Courier Prime y JetBrains Mono vía `next/font/google`, reemplazando Geist en `app/layout.tsx`.
- Datos simulados en `lib/data.ts`: catálogo de juegos (`GAMES`), categorías (`CATS`), jugadores (`PLAYERS`) y generador determinista de leaderboard (`seededScores`), tipados en TypeScript.
- Sesión de usuario simulada (sin backend): `AuthProvider` (contexto de cliente) en el layout raíz que expone `user`, `login`, `logout` y `saveScore`, persistiendo en `localStorage` (`av_user`, `av_scores`), igual que la referencia.
- Formulario de login/registro funcional en apariencia: alterna tabs, guarda un usuario simulado al enviar y navega a `/`; incluye opción "jugar como invitado".
- Reproductor con simulación de HUD (puntuación incremental, subida de nivel, pausa, vidas) y modal de fin de partida que guarda un puntaje simulado — sin lógica de juego jugable real (sin colisiones, sin input del jugador sobre una mecánica).
- Filtro por búsqueda y categoría en Biblioteca; tabs por juego en Salón de la Fama; leaderboard por juego en Detalle.
- Enlaces de navegación entre pantallas (tarjeta → detalle → jugar → fin de partida → vault, etc.) usando `next/link` / `useRouter`.

**Fuera de alcance (para specs futuras):**

- Cualquier lógica de juego real (colisiones, físicas, input de teclado/táctil para jugar).
- Backend, base de datos o autenticación real (OAuth con Google/GitHub son solo botones decorativos, no funcionales).
- Persistencia de puntuaciones más allá de `localStorage` del navegador.
- Internacionalización (todo el copy queda en español, tal como la referencia).
- Accesibilidad avanzada (ARIA completo, navegación por teclado) más allá de lo que ya trae la referencia.
- Tests automatizados (el proyecto no tiene test runner configurado).

## Modelo de datos

Toda la data vive en `lib/data.ts` (sin backend, solo mocks tipados):

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;   // clase CSS del fondo de portada (p.ej. "cover-bricks")
  color: "cyan" | "magenta" | "green" | "yellow";
  best: number;
  plays: string;    // p.ej. "12.4K"
};

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/AAAA"
};

export const GAMES: Game[];
export const CATS: ("TODOS" | GameCategory)[];
export const PLAYERS: string[];

// RNG determinista por semilla, igual que la referencia
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Estado de sesión y puntuaciones, gestionado por `AuthProvider` (componente cliente) y persistido en `localStorage`:

```ts
type User = { name: string } | null;

type SavedScore = {
  game: string;   // Game["id"]
  score: number;
  name: string;
  at: number;     // Date.now()
};

// localStorage keys: "av_user" (User), "av_scores" (SavedScore[])
```

Convenciones:

- Los `id` de `Game` son slugs en kebab-case (p.ej. `"bloque-buster"`), y se usan directamente como segmento dinámico `[id]` en las rutas `/juegos/[id]` y `/juegos/[id]/jugar`.
- `seededScores` es puro y determinista: mismo `seed` y `count` producen siempre las mismas filas (necesario para no tener mismatches de hidratación en Server Components).

## Plan de implementación

1. Crear `lib/data.ts` con los tipos `Game`, `ScoreRow`, las constantes `GAMES`, `CATS`, `PLAYERS` y la función `seededScores`, migrando los valores de `references/templates/data.jsx` a TypeScript.
2. Configurar fuentes: reemplazar Geist por Press Start 2P, Courier Prime y JetBrains Mono vía `next/font/google` en `app/layout.tsx`.
3. Portar `references/templates/styles.css` a `app/globals.css` (o un archivo importado desde ahí), adaptando selectores si hace falta y conservando las capas de fondo (`av-bg`, `av-noise`). Verificar con `npm run dev` sobre `app/page.tsx` actual que los estilos cargan sin errores.
4. Crear `components/AuthProvider.tsx` (client component) con contexto `user`, `login`, `logout`, `saveScore`, leyendo/escribiendo `localStorage` (`av_user`, `av_scores`). Envolverlo en `app/layout.tsx`.
5. Crear `components/Nav.tsx` (client component) portado de `nav.jsx`, usando `usePathname`/`next/link` para resaltar la ruta activa y el contexto de `AuthProvider` para mostrar sesión/login. Incluir menú móvil. Montarlo en `app/layout.tsx` junto con el footer.
6. Implementar `app/page.tsx` (Biblioteca): grid de tarjetas con tilt, buscador y chips de categoría, portado de `biblioteca.jsx`, usando `GAMES`/`CATS` de `lib/data.ts` y navegando a `/juegos/[id]` con `next/link`.
7. Implementar `app/juegos/[id]/page.tsx` (Detalle): portada, info, stats y leaderboard (`seededScores`), portado de `detalle.jsx`, con botón "Jugar ahora" hacia `/juegos/[id]/jugar` y "Volver al vault" hacia `/`.
8. Implementar `app/juegos/[id]/jugar/page.tsx` (Reproductor, client component): HUD simulado, pausa, modal de fin de partida con guardado de puntuación vía `AuthProvider.saveScore`, portado de `reproductor.jsx`.
9. Implementar `app/login/page.tsx` (Auth, client component): tabs iniciar sesión/crear cuenta, formulario, botón invitado y accesos sociales decorativos, portado de `auth.jsx`, usando `AuthProvider.login` y redirigiendo a `/`.
10. Implementar `app/salon-de-la-fama/page.tsx` (Salón de la Fama): tabs por juego, podio top 3, tabla de posiciones y fila "tu mejor marca" si hay sesión, portado de `salon.jsx`.
11. Revisión final: `npm run lint` y `npm run build` sin errores; recorrido manual por las 5 rutas verificando paridad visual con la referencia y que la navegación entre pantallas funciona de extremo a extremo.

## Criterios de aceptación

- [ ] `npm run build` finaliza sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `/` muestra la grilla de juegos con búsqueda por nombre y filtro por categoría funcionando.
- [ ] Hacer click en una tarjeta o en "JUGAR" navega a `/juegos/[id]` con el `id` correcto.
- [ ] `/juegos/[id]` muestra portada, info del juego y leaderboard de 10 filas generado por `seededScores`.
- [ ] El botón "▶ JUGAR AHORA" en Detalle navega a `/juegos/[id]/jugar`.
- [ ] En `/juegos/[id]/jugar`, la puntuación se incrementa automáticamente cada ~220ms mientras el juego no está en pausa ni terminado.
- [ ] El botón "PAUSA" detiene el incremento de puntuación y muestra el overlay "EN PAUSA"; "REANUDAR" lo reanuda.
- [ ] El botón "FIN" abre el modal de fin de partida mostrando la puntuación final.
- [ ] Guardar la puntuación en el modal la persiste en `localStorage` bajo `av_scores` y muestra el mensaje "PUNTUACIÓN GUARDADA".
- [ ] `/login` permite alternar entre tabs "INICIAR SESIÓN" y "CREAR CUENTA", mostrando el campo de correo solo en la segunda.
- [ ] Enviar el formulario de login guarda un usuario simulado en `localStorage` (`av_user`) y redirige a `/`.
- [ ] "JUGAR COMO INVITADO" navega a `/` sin sesión iniciada.
- [ ] Tras iniciar sesión, el header (`Nav`) muestra el nombre de usuario en vez del botón "Iniciar Sesión".
- [ ] `/salon-de-la-fama` muestra tabs por cada juego, un podio con los 3 primeros puestos y una tabla con el resto de posiciones.
- [ ] Si hay sesión iniciada, `/salon-de-la-fama` muestra la fila "TU MEJOR MARCA EN [JUEGO]" al final de la tabla.
- [ ] El menú móvil (hamburguesa) abre/cierra el panel lateral y permite navegar a las 5 rutas.
- [ ] Recargar la página en cualquier ruta conserva el estado de sesión (leído desde `localStorage`).

## Decisiones

- **Sí:** rutas reales de App Router (`/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/login`, `/salon-de-la-fama`) en vez de hash routing SPA. Es lo idiomático en Next.js y da URLs compartibles/navegables con el botón atrás del navegador.
- **No:** replicar el hash router de `app.jsx`. Sería nadar contra la corriente del framework sin beneficio real para un MVP visual.
- **Sí:** portar `styles.css` tal cual en vez de reescribir en Tailwind. Máxima fidelidad visual con el mínimo esfuerzo; Tailwind queda disponible para specs futuras si se necesita.
- **Sí:** cambiar Geist por Press Start 2P / Courier Prime / JetBrains Mono. El diseño retro-arcade depende de esas tipografías; usar `next/font/google` en vez de `<link>` para aprovechar la optimización de fuentes de Next.js.
- **Sí:** mantener login/logout y guardado de puntuaciones funcionando contra `localStorage` sin backend. Da sensación de app completa sin implementar autenticación real, consistente con "solo la parte visual".
- **Sí:** mantener la simulación de HUD en el Reproductor (puntuación automática, niveles, pausa). No es "un juego" en el sentido de mecánica jugable — es una animación de marcador, coherente con el pedido de no implementar juegos.
- **No:** lógica de juego real (colisiones, física, input de jugador). Explícitamente fuera de alcance según el pedido original.
- **Sí:** estado de sesión vía Context de React (`AuthProvider`) en el layout raíz en vez de que cada página lea `localStorage` por su cuenta. Evita desincronización entre `Nav` y las páginas sin necesitar backend.
- **No:** botones sociales (Google/GitHub) funcionales. Quedan como decorativos, igual que en la referencia.

## Riesgos

| Riesgo                                                              | Mitigación                                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Mismatch de hidratación: `AuthProvider` lee `localStorage` (solo existe en cliente) pero el layout se renderiza en servidor | Inicializar `user` en `null`/estado por defecto en el render inicial y sincronizar con `localStorage` en un `useEffect`, igual que hace la referencia con `try/catch` al leer. |
| `localStorage` deshabilitado (modo privado) o no disponible          | Envolver lecturas/escrituras en `try/catch` (como ya hace la referencia); si falla, la app sigue funcionando sin persistir sesión ni puntuaciones. |
| Las tarjetas con tilt (`GameCard`) usan `getBoundingClientRect` y eventos de mouse — no funcionan igual en táctil | No es crítico para el MVP visual: en táctil simplemente no se aplica el tilt, el click/tap para navegar sigue funcionando. |

## Lo que **no** está en este spec

- Lógica de juego real (colisiones, físicas, input de jugador sobre una mecánica jugable).
- Backend, base de datos o autenticación real (Google/GitHub son botones decorativos).
- Persistencia de puntuaciones más allá de `localStorage` del navegador.
- Internacionalización.
- Accesibilidad avanzada (ARIA completo, navegación por teclado) más allá de lo heredado de la referencia.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
