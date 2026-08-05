# SPEC 08 — Controles táctiles móviles

**Estado:** Aprobado
**Depende de:** SPEC 05 (asteroids-real), SPEC 07 (tetris-real)
**Fecha:** 2026-08-05

**Objetivo:** Agregar controles táctiles (D-pad de 4 direcciones + un botón de acción) superpuestos al canvas y adaptar el layout del HUD del reproductor, para que Asteroids y Tetris sean completamente jugables en pantallas táctiles móviles sin teclado y sin necesidad de rotar el dispositivo.

## Alcance

**Sí entra:**

- Controles táctiles (D-pad de 4 direcciones + 1 botón de acción) para los 2 juegos reales existentes: `rocas` (Asteroids) y `tetris`.
- Nueva API `pressKey`/`releaseKey` en `components/games/asteroids/engine.ts` y `components/games/tetris/engine.ts`, que alimenta el mismo estado interno (`keys`/`justPressed`) que hoy llenan los listeners de teclado — sin duplicar lógica de input.
- Componente compartido nuevo (D-pad + botón de acción) reutilizado por `AsteroidsCanvas` y `TetrisCanvas`, parametrizado por qué `code` dispara cada dirección/acción de cada juego.
- Overlay táctil posicionado sobre las esquinas inferiores del `.crt-screen` (D-pad izquierda, acción derecha), semi-transparente, siempre visible en viewports angostos vía CSS (`@media`), sin detección de tipo de puntero.
- Soporte multi-touch real: cada botón traquea su propio puntero (`pointerdown`/`pointerup`/`pointercancel`/`pointerleave`), permitiendo sostener D-pad + acción simultáneamente con dedos distintos.
- Semántica de "mantener presionado" (igual que teclado): el estado queda activo entre `pointerdown` y el evento de soltar/cancelar.
- Reflow del HUD del reproductor (`app/juegos/[id]/jugar/page.tsx` + `app/globals.css`) en viewports angostos: stats apiladas en filas, botones PAUSA/FIN/SALIR como fila propia, siguiendo el patrón de la imagen de referencia.
- Ajuste del escalado del canvas de Asteroids (relación 4:3 apaisada) para que se vea a un tamaño jugable en portrait sin requerir rotar el dispositivo.
- Los botones táctiles usan el estilo de UI ya existente en la página (`btn`/`btn ghost`), **no** los skins del juego — los skins (`skins.ts`) solo afectan el render del canvas, no el chrome de la página.

**No entra:**

- Rediseño del selector de skin (queda igual, 3 botones, según lo confirmado).
- Controles táctiles para juegos no reales del catálogo (simulación falsa) — no son interactivos.
- Contrato/implementación para juegos futuros (ej. `arkanoid` pendiente) — el componente se diseña reutilizable pero solo se cablea para `rocas` y `tetris`.
- Bloqueo o mensaje de "gira tu dispositivo" — el objetivo explícito es que **no** sea necesario rotar.
- Cambios a persistencia, leaderboard o lógica de puntaje (SPEC 04/06).
- Vibración/haptics.
- Modo PWA o fullscreen.

## Modelo de datos

No se introduce persistencia ni tipos de dominio nuevos (no toca Supabase/`lib/data.ts`). Sí se agregan tipos/contratos de UI e input:

### `components/games/TouchControls.tsx` (nuevo, compartido)

```ts
type DirectionKey = "up" | "down" | "left" | "right";

type TouchControlsProps = {
  onPress: (code: string) => void;
  onRelease: (code: string) => void;
  /** Solo se renderizan los botones de dirección presentes en el mapa. */
  directions: Partial<Record<DirectionKey, string>>;
  actionCode: string;
  actionLabel: string;
};
```

- Cada botón (dirección o acción) traquea su propio `pointerId` para soportar multi-touch real; en `pointerdown` llama `onPress(code)`, en `pointerup`/`pointercancel`/`pointerleave` llama `onRelease(code)`.
- `directions` es parcial a propósito: Asteroids solo mapea `left`/`right`/`up` (no usa `down`); Tetris mapea las 4. El componente es genérico para las 4 direcciones, pero cada juego decide cuáles cablear según sus teclas reales.

### API nueva en los engines (`AsteroidsEngine` / `TetrisEngine`)

```ts
pressKey: (code: string) => void;
releaseKey: (code: string) => void;
```

- Reutilizan exactamente la misma lógica que hoy corre en `onKeyDown`/`onKeyUp` (se extrae a una función interna compartida `setKeyState(code, isDown)` que ambos el listener real de teclado y estos métodos nuevos invocan), evitando un segundo camino de estado de input.

### Mapeo de códigos por juego (para `AsteroidsCanvas`/`TetrisCanvas`)

- Asteroids: `directions={{ left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp" }}`, `actionCode="Space"`, `actionLabel="DISPARAR"`.
- Tetris: `directions={{ left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" }}`, `actionCode="Space"`, `actionLabel="CAER"`.

## Plan de implementación

1. Extraer la lógica de `onKeyDown`/`onKeyUp` a una función interna compartida `setKeyState(code, isDown)` en `components/games/asteroids/engine.ts` y `components/games/tetris/engine.ts`; exponer `pressKey`/`releaseKey` en el objeto devuelto por `createEngine` y en los tipos `AsteroidsEngine`/`TetrisEngine`. Verificación: `npx tsc --noEmit` sin errores; el juego sigue funcionando igual por teclado (sin cambios de comportamiento).
2. Crear `components/games/TouchControls.tsx`: D-pad (hasta 4 botones según `directions`) + botón de acción, con `pointerdown`/`pointerup`/`pointercancel`/`pointerleave` por botón (multi-touch, hold-to-repeat). Estilos nuevos en `app/globals.css` (`.touch-controls`, `.touch-dpad`, `.touch-dpad-btn`, `.touch-action-btn`), coherentes con el resto del chrome de la página (no con los skins del juego), superpuestos en las esquinas inferiores de `.crt-screen`, semi-transparentes, ocultos por defecto y visibles solo en `@media (max-width: 720px)`. Verificación: renderiza aislado y dispara `onPress`/`onRelease` correctamente en DevTools responsive.
3. Integrar `TouchControls` en `AsteroidsCanvas.tsx` y `TetrisCanvas.tsx`, pasando `onPress={engine.pressKey}` / `onRelease={engine.releaseKey}` y el mapeo de códigos de cada juego (definido en la sección de modelo de datos). Verificación manual en DevTools responsive (<720px): cada botón mueve/dispara/rota según corresponda, sin usar teclado.
4. Ajustar el escalado del canvas de Asteroids (800×600, hoy `width:100%; height:auto`) y `.crt-screen` para que en viewports angostos se vea a tamaño jugable en portrait, sin requerir rotar el dispositivo. Verificación: en un viewport de referencia móvil (ej. 390×844), Asteroids se ve jugable en portrait.
5. Reflow de `.player-hud` en `app/globals.css` bajo `@media (max-width: 720px)`: stats apiladas (fila JUGADOR/PUNTUACIÓN/VIDAS, fila NIVEL/SKIN), botones PAUSA/FIN/SALIR como fila propia a ancho completo — sin tocar la estructura de componentes de `app/juegos/[id]/jugar/page.tsx`, solo clases/CSS. Verificación visual manual en el mismo viewport: nada se corta ni se superpone.
6. Verificación end-to-end en viewport móvil (DevTools + dispositivo real táctil si es posible):
   - `/juegos/rocas/jugar`: partida completa (rotar, impulsar, disparar, terminar) solo con controles táctiles.
   - `/juegos/tetris/jugar`: partida completa (mover, rotar, soft drop, hard drop, terminar) solo con controles táctiles.
   - Sostener un botón mantiene la acción activa hasta soltar.
   - Multi-touch: sostener una dirección y tocar la acción al mismo tiempo funciona.
   - En viewport de escritorio (>720px) los controles táctiles no aparecen y el teclado sigue funcionando exactamente igual que antes (regresión SPEC 05/07).
7. Revisión final: `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [ ] `npm run build` finaliza sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `AsteroidsEngine` y `TetrisEngine` exponen `pressKey`/`releaseKey`, reutilizando la misma lógica interna que los listeners de teclado (`setKeyState`).
- [ ] En viewport ≤720px, `/juegos/rocas/jugar` muestra el D-pad (izquierda/derecha/arriba) y el botón "DISPARAR" superpuestos sobre el canvas.
- [ ] En viewport ≤720px, `/juegos/tetris/jugar` muestra el D-pad (4 direcciones) y el botón "CAER" superpuestos sobre el canvas.
- [ ] Sostener un botón direccional mantiene la acción activa (rotar/mover) hasta soltar, igual que mantener presionada una tecla.
- [ ] Se puede sostener una dirección y tocar la acción al mismo tiempo (multi-touch con dos dedos) sin que un toque cancele al otro.
- [ ] Es posible completar una partida entera de Asteroids (rotar, impulsar, disparar, morir/terminar) usando solo los controles táctiles.
- [ ] Es posible completar una partida entera de Tetris (mover, rotar, soft drop, hard drop, terminar) usando solo los controles táctiles.
- [ ] En viewport >720px los controles táctiles no se renderizan y el control por teclado sigue funcionando exactamente igual que antes de esta spec.
- [ ] En un viewport móvil de referencia (390×844), Asteroids se ve a un tamaño jugable en portrait sin necesitar rotar el dispositivo.
- [ ] En viewport ≤720px, el HUD del reproductor (`player-hud`) se apila en filas (stats, luego PAUSA/FIN/SALIR a ancho completo) sin recortes ni superposiciones.
- [ ] El selector de skin (`CLASICO`/`NEON`/`RETRO`) permanece sin cambios de comportamiento (solo puede wrappear por el CSS existente).
- [ ] Los juegos con simulación falsa (resto del catálogo) no muestran controles táctiles y su comportamiento no cambió.

## Decisiones

- **Sí:** solo cubrir los 2 juegos reales existentes (`rocas`, `tetris`), diseñando el componente `TouchControls` de forma genérica (mapa de direcciones parcial) pero sin cablear nada para juegos futuros pendientes de portar (ej. `arkanoid`). Evita trabajo especulativo sobre un contrato que aún no tiene un segundo caso real que lo valide.
- **Sí:** un solo botón de acción por juego (mapeado a `Space`), sin un tercer/cuarto botón decorativo. Cada engine solo tiene una tecla de acción fuera de las direccionales; agregar botones sin función sería UI sin comportamiento.
- **Sí:** el D-pad soporta hasta 4 direcciones pero cada juego solo cablea las que realmente usa (Asteroids omite "abajo"). Mantiene el componente genérico sin forzar botones que no disparan nada en el juego.
- **Sí:** reutilizar la lógica de `keys`/`justPressed` ya existente en los engines vía una función interna compartida `setKeyState`, en vez de mantener un segundo camino de estado de input táctil. Evita divergencia de comportamiento entre teclado y táctil.
- **Sí:** controles táctiles visibles por ancho de viewport (`@media max-width: 720px`), no por detección de tipo de puntero (`pointer: coarse`). Es más predecible, testeable en DevTools sin dispositivo físico, y cubre tablets/desktop redimensionado.
- **Sí:** los botones táctiles usan el estilo de UI general de la página, no los skins del juego (`skins.ts`). Los skins son un concepto del canvas/engine (SPEC de skin-designer); el chrome de controles es UI de React ajena a esa capa.
- **No:** bloquear ni sugerir rotar el dispositivo. El objetivo explícito de esta spec es que ambos juegos sean jugables en portrait sin fricción adicional.
- **No:** rediseñar el selector de skin en móvil. Queda igual a como está hoy (3 botones que wrappean).
- **No:** tocar persistencia, leaderboard, lógica de puntaje, o el contrato `RealGameHandle`/`RealGameProps` en `app/juegos/[id]/jugar/page.tsx` — solo se ajustan clases/CSS del HUD.

## Riesgos

| Riesgo                                                                                                                                                                          | Mitigación                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un botón táctil "pega" el estado (queda presionado) si el navegador no dispara `pointerup`/`pointercancel` en algunos casos (ej. al deslizar fuera del botón o cambiar de app). | Escuchar también `pointerleave` y `pointerout` para forzar `releaseKey`, además de `pointerup`/`pointercancel`; verificar explícitamente ese caso en el paso 6 del plan (deslizar el dedo fuera del botón mientras está presionado). |
| El D-pad y el botón de acción, al superponerse al canvas, tapan parte del área de juego o del contador de "próxima pieza" en Tetris.                                            | Verificación visual manual en el paso 3/6: confirmar que las zonas activas del D-pad/acción no cubren el tablero jugable ni el preview de Tetris.                                                                                    |
| El reflow de `.player-hud` rompe el layout en desktop (regresión visual en viewport ancho).                                                                                     | Verificación manual explícita en viewport de escritorio antes de cerrar la spec, comparando contra el estado actual.                                                                                                                 |
| El ajuste de escalado del canvas de Asteroids para portrait distorsiona la proporción 4:3 o hace overflow del `.crt-screen`.                                                    | Verificación manual en el viewport de referencia (390×844) revisando que no haya scroll horizontal ni distorsión del aspect ratio.                                                                                                   |
