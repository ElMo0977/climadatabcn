---
name: frame-c-repo-hygiene
description: >
  Skill reusable para diagnosticar y ejecutar limpieza segura de repositorios con criterio
  de riesgo, evidencia previa y foco en mantenimiento real. Trigger: cuando un agente
  necesita ordenar un repo, reducir ruido, clasificar deuda tecnica o separar higiene
  legitima de cambios funcionales disfrazados.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0.0"
---

## When to Use

- Cuando hay ruido acumulado y hace falta una limpieza consistente sin romper comportamiento.
- Cuando un agente debe distinguir entre higiene segura, mantenimiento estructural y refactor riesgoso.
- Cuando se necesita un criterio comun para priorizar hallazgos y decidir que ejecutar automatico.
- Cuando conviene dejar trazabilidad clara de que se limpio, que se postergo y por que.

## Critical Patterns

- Evidencia antes de accion: no limpiar por intuicion, moda o preferencia estetica.
- Ejecutar automatico solo cambios seguros y de bajo riesgo.
- Prohibido hacer limpieza cosmetica sin valor observable: renombres vacios, reordenes arbitrarios, churn de formato no relacionado.
- Separar siempre mantenimiento de comportamiento: si cambia reglas de negocio, API, UX o contratos, ya no es higiene.
- Preferir diffs chicos, reversibles y faciles de verificar.
- Si un hallazgo no tiene evidencia suficiente, clasificarlo y frenarlo; no improvisar.

## Taxonomy / Severity Rubric

| Categoria | Senal | Riesgo | Accion por defecto |
|-----------|-------|--------|--------------------|
| Higiene segura | archivos muertos verificados, imports sin uso, docs desactualizadas evidentes, tests/helpers redundantes sin impacto funcional | Bajo | Ejecutar automatico con evidencia minima |
| Mantenimiento estructural | mover piezas para alinear capas, consolidar duplicacion confirmada, endurecer limites entre modulos sin cambiar contratos | Medio | Proponer plan y ejecutar solo si el alcance esta delimitado |
| Refactor riesgoso | cambios amplios, acoplamientos poco entendidos, efectos laterales posibles, cobertura insuficiente | Alto | No ejecutar automatico; pedir decision o dividir |
| Cambio disfrazado de limpieza | cambia comportamiento, performance sensible, reglas de negocio, API, UX o datos | Variable pero real | Tratarlo como feature o bugfix, no como higiene |

## Standard Workflow

1. Delimitar alcance: rutas, modulos, objetivo y restricciones.
2. Recolectar evidencia: duplicacion real, warnings, archivos huerfanos, inconsistencias o deuda observable.
3. Clasificar cada hallazgo segun la taxonomia.
4. Ejecutar solo la higiene segura y de bajo riesgo.
5. Para lo demas, proponer acciones separadas con motivo, riesgo y prerequisitos.
6. Validar con checks proporcionales al cambio.
7. Entregar salida estructurada: ejecutado, no ejecutado, riesgos y siguientes pasos.

## Decision Rules (when not to clean)

- No limpiar si la supuesta mejora depende de asumir intencion sin evidencia en codigo, tests o docs.
- No limpiar si el diff mezcla higiene con cambio funcional.
- No limpiar si el valor es solo estetico y no reduce ruido, deuda o riesgo operacional.
- No limpiar si faltan limites claros del modulo afectado.
- No limpiar si no hay forma razonable de verificar el cambio.
- No limpiar si la accion rompe convenciones activas del repo aunque parezca mas prolija en abstracto.

## Output Contract / Template

```text
Objetivo:
- <que area se limpio y por que>

Evidencia:
- <hecho observable 1>
- <hecho observable 2>

Ejecutado ahora:
- [seguro][bajo riesgo] <accion realizada>

No ejecutado:
- [estructural][medio] <accion postergada> - Motivo: <por que>
- [riesgoso][alto] <accion descartada o separada> - Motivo: <por que>
- [cambio disfrazado] <accion separada> - Motivo: <por que no es higiene>

Validacion:
- <checks aplicados o validacion manual>

Siguientes pasos:
- <opcion 1>
- <opcion 2>
```

## Commands or Invocation Examples

```text
Usar skill: frame-c-repo-hygiene
Objetivo: detectar y ejecutar solo higiene segura en <ruta/modulo>
Restricciones: no cambiar comportamiento, evidencia antes de accion, nada cosmetico
Salida: usar Output Contract y marcar todo lo no ejecutado con nivel de riesgo
```

```text
Aplicar FRAME-C repo hygiene sobre <scope>
- Clasifica hallazgos en: higiene segura / mantenimiento estructural / refactor riesgoso / cambio disfrazado
- Ejecuta solo lo seguro y de bajo riesgo
- Lo demas, proponelo sin tocarlo
```

```text
Revisar este repo con frame-c-repo-hygiene
- Buscar deuda observable y ruido real
- Citar evidencia antes de cada accion
- Evitar limpieza cosmetica sin valor
```
