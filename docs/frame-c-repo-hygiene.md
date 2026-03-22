# FRAME-C Repo Hygiene

## Que problema resuelve

Evita la falsa limpieza. La skill da un criterio reusable para separar higiene real de churn cosmetico, mantenimiento estructural y cambios funcionales disfrazados. Sirve para que un agente no "ordene" un repo a ciegas y termine mezclando refactor, estilo y comportamiento.

## Cuando usarla

- Cuando queres bajar ruido o deuda sin abrir un refactor grande.
- Cuando un agente tiene que limpiar con trazabilidad y bajo riesgo.
- Cuando hace falta decidir que se ejecuta ahora y que se deja propuesto.

## Niveles de limpieza

| Nivel | Que incluye | Accion recomendada |
|-------|-------------|--------------------|
| Higiene segura | remocion validada de ruido, duplicacion trivial confirmada, docs evidentemente desactualizadas, piezas muertas verificadas | Ejecutar |
| Mantenimiento estructural | reorganizacion de capas, consolidacion de limites, mejoras internas sin cambio de contrato | Proponer o ejecutar con alcance acotado |
| Refactor riesgoso | cambios amplios, dependencias opacas, cobertura insuficiente, impacto incierto | No ejecutar automatico |
| Cambio disfrazado de limpieza | altera reglas, UX, API, datos o comportamiento observable | Tratar aparte |

## Prompt base reutilizable

```text
Usa la skill `frame-c-repo-hygiene` sobre <scope>.

Objetivo:
- limpiar solo lo que tenga evidencia y valor real

Reglas:
- evidencia antes de accion
- prohibida limpieza cosmetica sin valor
- ejecutar automatico solo higiene segura y de bajo riesgo
- separar mantenimiento estructural, refactor riesgoso y cambios disfrazados

Salida:
- objetivo
- evidencia
- ejecutado ahora
- no ejecutado con clasificacion y motivo
- validacion
- siguientes pasos
```

## Ejemplo de salida esperada

```text
Objetivo:
- Reducir ruido en src/services sin tocar contratos publicos.

Evidencia:
- Hay dos helpers duplicados con misma firma y mismo uso.
- Existe un archivo de prueba viejo que ya no se importa desde ningun modulo.

Ejecutado ahora:
- [seguro][bajo riesgo] elimine el helper duplicado y deje una sola fuente.
- [seguro][bajo riesgo] removi el archivo huerfano verificado.

No ejecutado:
- [estructural][medio] mover providers a otra carpeta - Motivo: implica reorganizar imports y validar limites.
- [riesgoso][alto] reescribir el servicio de cache - Motivo: cobertura insuficiente y efectos laterales posibles.
- [cambio disfrazado] simplificar estrategia de retry - Motivo: cambia comportamiento operativo.

Validacion:
- Revision de imports y referencias del modulo afectado.

Siguientes pasos:
- Definir si el mantenimiento estructural entra en otra tarea.
```
