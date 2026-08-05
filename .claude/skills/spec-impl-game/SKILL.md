---
name: spec-impl-game
description: Implementa una spec aprobada de juego siguiendo /spec-impl y, al terminar, ejecuta secuencialmente los agentes skin-designer y mobile-porter.
disable-model-invocation: true
argument-hint: <NN-spec-name>
---

# /spec-impl-game — Implementador de specs de juegos + auditoría de skins y móvil

Este comando es una variante de `/spec-impl` pensada para specs que integran o modifican un
**juego con engine real** (SPEC 05/06/07/08 y las que produce `/add-game` o `game-jam`). Sigue
exactamente el mismo flujo que `/spec-impl` para implementar la spec, y al terminar el plan
encadena automáticamente dos agentes, **uno después del otro, nunca en paralelo**:

1. `skin-designer` — audita e implementa los 3 skins obligatorios del juego recién tocado.
2. `mobile-porter` — audita e implementa la calidad móvil / controles táctiles (SPEC 08) del
   mismo juego.

`mobile-porter` puede tocar el mismo `engine.ts`/`<Game>Canvas.tsx` que `skin-designer`
acaba de modificar, así que el orden y la secuencialidad son intencionales: **no lances
ambos agentes en la misma respuesta ni en paralelo bajo ninguna circunstancia.**

---

## Fase A — Delegar en /spec-impl

Invoca el skill `spec-impl` (herramienta Skill, `skill: "spec-impl"`) pasándole `$ARGUMENTS`
tal cual las recibiste. Sigue sus cuatro fases al pie de la letra: identificación de la spec
en `specs/`, validación de que el estado significa "Aprobado" en cualquier idioma, creación/
cambio de rama `spec-NN-slug` respetando `AutoCreateBranch` de `specs/.spec-config.yml`,
resumen de la spec (objetivo, alcance, plan, criterios de aceptación), y la implementación
paso a paso con pausa y confirmación del usuario después de cada paso.

No dupliques esa lógica aquí — es el mismo comportamiento, mismos mensajes de error, mismas
reglas. Dos reglas heredadas que vale la pena remarcar porque cambian lo que hace _este_
comando:

- **Si el estado no significa "Aprobado"** → detente con el mensaje de error estándar de
  `spec-impl` (mismo texto). No crees rama, no toques código, **no lances ningún agente**.
- **Si el usuario no confirma el último paso, o aborta a mitad de la implementación** → no
  avances a la Fase B. Los agentes solo corren si el plan quedó completo.

Continúa a la Fase B únicamente cuando `spec-impl` llegue al mensaje de "todos los pasos del
plan están implementados".

---

## Fase B — Agente `skin-designer` (primero, bloqueante)

Antes de lanzarlo, identifica del contexto de la spec y de los archivos tocados en la Fase A:
el id del juego, la ruta de su `components/games/<id>/engine.ts` y de su
`<Game>Canvas.tsx`.

Lanza el agente `skin-designer` con **`run_in_background: false`** (necesitas su resultado
completo antes de decidir si sigues). En el prompt inclúyele:

- Qué spec se acaba de implementar y qué juego/id es.
- Las rutas exactas del engine y del canvas recién creados/modificados.
- La instrucción de auditar e implementar los 3 skins obligatorios (`clasico` default,
  `neon`, `retro`, definidos en `components/games/skins.ts`), migrando cualquier literal
  hex/rgba suelto del engine a tokens del skin, y verificando contraste ≥ 4.5:1 contra el
  fondo negro del CRT.
- Que actualice su memoria en `references/skin-audit.md` como ya hace normalmente.

Cuando el agente termine, léele el resultado y muéstrale al usuario un resumen breve de qué
cambió (el reporte crudo del agente no lo ve el usuario). Solo entonces continúa a la Fase C.

---

## Fase C — Agente `mobile-porter` (segundo, después de que B terminó)

Lanza el agente `mobile-porter`, también con **`run_in_background: false`**. En el prompt
inclúyele:

- El mismo juego/id, más las rutas de sus páginas nuevas o modificadas
  (`app/juegos/<id>/` y `app/juegos/<id>/jugar/`).
- La instrucción de verificar el contrato SPEC 08 (`pressKey`/`releaseKey` en el engine +
  `TouchControls` en el canvas) para ese juego, overflow horizontal en viewports ≤720px, y
  tap targets ≥44px en las páginas nuevas.
- Que tenga en cuenta que `skin-designer` acaba de tocar el mismo engine/canvas (para que no
  reintroduzca literales de color al agregar controles táctiles).
- Que actualice su memoria en `references/mobile-audit.md` como ya hace normalmente.

Muestra al usuario un resumen breve del resultado.

**Recordatorio explícito:** las fases B y C jamás se lanzan en la misma respuesta ni con
tool calls paralelos. C solo empieza una vez que B devolvió su resultado.

---

## Fase D — Cierre

1. Verifica los criterios de aceptación de la spec uno por uno (marca los checkboxes en el
   archivo de la spec según corresponda).
2. Corre `npm run lint` y `npm run build`; si algo falla, repórtalo y **no** marques la spec
   como implementada — vuelve a la fase correspondiente para corregir.
3. Si todo pasa, actualiza la línea de estado de la spec a "Implementado" (o el equivalente
   en el idioma de la spec) y propón el commit final en la rama `spec-NN-slug`.

---

## Resumen del comportamiento esperado

```
/spec-impl-game 08-controles-tactiles-moviles   (estado: Aprobado)

  Fase A  →  /spec-impl completo: rama creada, plan implementado paso a paso con pausas
  Fase B  →  lanza skin-designer (bloqueante), muestra resumen
  Fase C  →  lanza mobile-porter (bloqueante, después de B), muestra resumen
  Fase D  →  verifica criterios de aceptación, lint + build, marca "Implementado",
             propone commit

/spec-impl-game 07-tetris-real   (estado: Implementado)

  Fase A  →  /spec-impl detiene con el mensaje de error estándar (estado no es "Aprobado")
             No se crea rama, no se toca código, NO se lanza ningún agente.
```
