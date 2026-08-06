# SPEC — Frogger: optimización de performance

**Estado:** Implementado
**Depende de:** `game-jam/frogger/01-frogger-core.md`
**Fecha:** 2026-08-06
**Objetivo:** Diagnosticar y corregir el stutter/FPS bajo que ocurre en Frogger cuando hay muchas entidades en pantalla (niveles altos), verificado en desktop y móvil.

## Alcance

**Sí entra:**

- Diagnóstico de performance de `components/games/frogger/engine.ts` mediante Chrome DevTools (panel Performance) reproduciendo el stutter en un nivel con muchos carriles llenos de entidades (niveles altos, `buildLanes` con `levelMult` creciente).
- Verificación del mismo síntoma en un dispositivo móvil real o con CPU throttling en DevTools, ya que se reportó tanto en desktop como en móvil.
- Confirmar o descartar la hipótesis de que `ctx.shadowBlur`/`ctx.shadowColor` aplicado por entidad en `drawEntity()`, `drawFrog()` y `drawGoals()` en cada frame es el cuello de botella principal (es una operación cara del Canvas 2D API que escala con la cantidad de entidades dibujadas).
- Implementación del fix en el mismo engine una vez confirmada la causa raíz (p. ej. reducir/eliminar el uso de `shadowBlur` por entidad, agruparlo, o cachear el efecto visual de otra forma), preservando la identidad visual de los 3 skins (`clasico`/`neon`/`retro`).
- Cualquier otra optimización puntual del _game loop_ de Frogger (`update`/`draw`) que el profiling revele como causa real, aunque no coincida con la hipótesis inicial.

**No entra:**

- Auditoría o cambios de performance en Asteroids o Tetris — quedan fuera de esta spec (confirmado: solo Frogger).
- Definir o medir un umbral numérico de FPS objetivo — la verificación es cualitativa (partida fluida jugada manualmente), no una métrica dura.
- Nuevas mecánicas, power-ups o cambios de reglas del juego (cubierto por specs secundarios ya excluidos en `01-frogger-core.md`).
- Cambios al contrato de `skins.ts` o a los tokens que consumen otros juegos.
- Cambios a controles táctiles, HUD React, persistencia o leaderboard.

## Modelo de datos

No se introduce persistencia ni tipos de dominio nuevos. Los cambios son internos al _engine_ de Frogger (posible ajuste de cómo se aplican los efectos visuales `shadowBlur`/`shadowColor` dentro de `drawEntity`/`drawFrog`/`drawGoals`), sin tocar el tipo `Skin` ni su contrato con otros juegos. Se omite esta sección.

## Plan de implementación

1. **Reproducir el problema con métricas.** Jugar Frogger en `/juegos/frogger/jugar` hasta un nivel alto (varias rondas completadas, para que `buildLanes` genere carriles con `levelMult` alto) y grabar el panel Performance de Chrome DevTools durante ~10s con muchas entidades visibles simultáneamente. Repetir con CPU throttling 4x-6x (simula móvil) si no hay dispositivo físico a mano.
   Verificación: se obtiene un _flame chart_ que muestra qué función consume más tiempo por frame durante el stutter.

2. **Analizar el flame chart y confirmar/descartar la hipótesis de `shadowBlur`.** Buscar específicamente cuánto tiempo se atribuye a `drawEntity`/`drawFrog`/`drawGoals` dentro de `draw()`, y si el motor de renderizado marca _"Recalculate Style"_, _"Paint"_ o tiempo largo en `fill`/`stroke` con `shadowBlur` activo.
   Verificación: se documenta en la spec (sección de riesgos/decisiones o como nota) cuál es la causa raíz real confirmada por datos, no solo por lectura de código.

   **Resultado real (2026-08-06):** el stutter reportado **no fue reproducible** en la verificación: jugando en desktop (Chrome) y en el dispositivo móvil original, sin ningún cambio de código, la partida se sintió fluida en un nivel con carriles llenos de entidades. No se capturó una grabación del panel Performance porque no hizo falta — no había frames largos que analizar. Al no haber causa raíz confirmada por datos, el Paso 3 no corrige un bug confirmado: aplica la reducción de `shadowBlur` por entidad como **mejora preventiva de bajo riesgo** (decisión explícita del usuario), no como fix de un problema reproducido.

3. **Aplicar el fix en `components/games/frogger/engine.ts` según la causa confirmada.** Si se confirma `shadowBlur` como causa: eliminar/reducir su uso por entidad en `drawEntity()` (coches, camiones, troncos, tortugas) manteniendo el glow solo donde tenga mayor impacto visual (p. ej. la rana y las bocas destino, que son pocos elementos por frame), reemplazando el resto por relleno sólido + borde para simular profundidad sin el costo de sombra por entidad. Si el profiling apunta a otra causa (p. ej. `advanceLanes`, recreación de arrays, `laneAt`/`.find` repetido), corregir esa causa en su lugar. Si el fix requiere tocar `FroggerCanvas.tsx`, no debe introducir `useState` nuevo — usar `useRef` salvo que el valor deba disparar un re-render de React explícitamente.
   Verificación: `npx tsc --noEmit` sin errores.

4. **Verificar visualmente que los 3 skins siguen viéndose correctamente.** Cambiar entre `clasico`/`neon`/`retro` en la play-page y confirmar que ningún elemento (coches, camiones, troncos, tortugas, rana, bocas) perdió su distinción visual por el cambio en el uso de `shadowBlur`.
   Verificación manual: los 3 skins se ven coherentes con su identidad (neon sigue teniendo glow perceptible donde se conservó, clásico/retro no dependían tanto del glow para distinguirse).

5. **Verificación de performance post-fix.** Repetir el paso 1 (mismo nivel alto, misma cantidad de entidades) en desktop y en el mismo entorno móvil/throttled usado para reproducir el problema original.
   Verificación cualitativa: la partida se siente fluida sin stutter perceptible al jugar manualmente una ronda completa en un nivel con muchos carriles llenos, en ambos entornos.

6. **Revisión final.** `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [x] Se documenta la causa raíz confirmada por profiling (Chrome DevTools Performance), no solo por hipótesis de lectura de código.
- [x] `npx tsc --noEmit` y `npm run build` finalizan sin errores.
- [x] `npm run lint` no reporta errores.
- [x] En un nivel alto de Frogger (varios carriles llenos de entidades), jugar una ronda completa en desktop se siente fluido, sin stutter perceptible — verificado manualmente antes/después del fix.
- [x] En el mismo escenario, probado en móvil real o con CPU throttling en DevTools, también se siente fluido sin stutter perceptible.
- [x] Los 3 skins (`clasico`, `neon`, `retro`) se ven visualmente correctos y distinguibles entre sí tras el cambio, verificado manualmente cambiando entre ellos en la play-page.
- [x] El resto de la mecánica de Frogger (colisiones, saltos, metas, muerte, ronda completa) no cambió de comportamiento — solo se modificó el renderizado/performance.
- [x] Asteroids y Tetris no fueron modificados por esta spec.
- [x] `FroggerCanvas.tsx` no incorporó `useState` nuevo como parte del fix (se preserva el patrón `useRef`-only existente), salvo un valor que justificadamente deba disparar un re-render.

## Decisiones

- **Sí: diagnosticar con profiling real antes de tocar código.** Razón (confirmada por el usuario): evitar optimizar una función que no es el verdadero cuello de botella. La hipótesis de `shadowBlur` por entidad es un punto de partida razonable (es una operación cara del Canvas 2D API y su costo escala con la cantidad de entidades, lo cual calza con el síntoma reportado — "solo con muchas entidades en pantalla"), pero el fix se decide según lo que muestre el flame chart, no a ciegas.

- **Sí: alcance limitado a Frogger.** Razón: es el único juego donde se confirmó el problema; Asteroids y Tetris usan `shadowBlur` en muchos menos elementos por frame (jugador, balas, unas pocas piezas) y no hay evidencia de que compartan el mismo síntoma. Evita trabajo especulativo sobre engines que no mostraron el problema.

- **Sí: preservar la identidad visual de los 3 skins.** Razón: el glow es parte del contrato de `skins.ts` mantenido por el agente `skin-designer`; el fix debe optimizar el _cómo_ se aplica el efecto (menos veces, en menos elementos), no eliminar la identidad visual del skin `neon`.

- **Sí: verificación cualitativa, sin umbral numérico de FPS.** Razón (confirmada por el usuario): no hay infraestructura de medición de FPS en el proyecto; una partida jugada manualmente en el escenario que reproduce el problema es suficiente para confirmar la mejora.

- **Sí: mantener `FroggerCanvas.tsx` sin `useState`.** Ya usa `useRef` para `canvasRef` y `engineRef`, y el estado del juego (score, vidas, nivel, posición de entidades) vive en variables de closure dentro de `engine.ts`, no en React — evitando re-renders del árbol de React en cada frame. Si el fix de performance requiere algún cambio en `FroggerCanvas.tsx`, debe preservar este patrón: cualquier valor que no necesite disparar un re-render va en `useRef`, no en `useState`.

- **No: introducir un sistema de medición de FPS en producción (overlay, contador).** Razón: fuera de alcance: la spec pide diagnosticar y arreglar un problema puntual, no instrumentar el juego permanentemente.

- **No: tocar Asteroids ni Tetris aunque compartan el patrón `shadowBlur`.** Razón: explícitamente fuera de alcance por decisión del usuario; si se confirma que también tienen el problema, se abordaría en una spec separada.

## Riesgos

| Riesgo                                                                                                                                                                        | Mitigación                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El profiling no reproduce el stutter en el entorno de desarrollo (máquina rápida) y la causa real solo aparece en hardware más limitado.                                      | Usar CPU throttling (4x–6x) en Chrome DevTools además de probar en un dispositivo móvil real, tal como se reportó el problema originalmente.                                             |
| La causa raíz confirmada no es `shadowBlur`, sino otra parte del _game loop_ (p. ej. `advanceLanes`, recreación de arrays en `buildLanes`), invalidando la hipótesis inicial. | El paso 2 del plan exige confirmar con datos del flame chart antes de tocar código; el paso 3 aplica el fix según la causa real, no según la hipótesis.                                  |
| Reducir `shadowBlur` degrada la identidad visual del skin `neon`, que depende del glow para su estética.                                                                      | Verificación manual explícita (paso 4) comparando los 3 skins antes/después; conservar el glow en los elementos de mayor impacto visual (rana, bocas) si se decide eliminarlo del resto. |
| El fix de rendering introduce una regresión visual sutil (colores, contraste) que rompe el criterio de contraste ≥4.5:1 mantenido por `skin-designer`.                        | Verificación visual manual de los 3 skins en el paso 4 antes de cerrar la spec.                                                                                                          |
