# Documentacion

Este directorio contiene el mapa canonico de la documentacion tecnica del proyecto. La idea es sencilla: cada documento principal responde a una sola pregunta y enlaza al resto cuando hace falta, en lugar de duplicar contenido.

## Mapa principal

| Documento | Para que sirve | Cuando actualizarlo |
|-----------|----------------|---------------------|
| `README.md` | Entrada al proyecto, comandos y variables de entorno soportadas | Cuando cambian setup, comandos o configuracion operativa |
| `ARCHITECTURE.md` | Arquitectura por capas, flujo de datos y decisiones tecnicas | Cuando cambia la estructura del codigo o el flujo entre capas |
| `docs/xema-transparencia-implementation.md` | Integracion vigente con XEMA / Socrata, contratos y debug | Cuando cambian datasets, providers, labels o flags de diagnostico |
| `ROADMAP.md` | Trabajo pendiente | Cuando se anaden, repriorizan o cierran tareas futuras |
| `CHANGELOG.md` | Historial de cambios relevantes | Cuando un cambio ya se completo |
| `AGENTS.md` | Flujo y referencias para agentes | Cuando cambian las convenciones para agentes o la lista de fuentes canonicas |

## Artefactos historicos

| Archivo | Estado | Notas |
|---------|--------|-------|
| `docs/code-review.md` | Historico | Revision puntual del repo; algunos hallazgos ya estan resueltos y deben leerse con fecha |
| `docs/data-audit-findings.json` | Historico | Resultado de una auditoria puntual del pipeline; no es una especificacion activa ni una fuente canonica |

## Reglas de mantenimiento

- Evita duplicar contenido entre documentos. Si una explicacion ya vive en un doc canonico, enlazala.
- `README.md` debe seguir siendo corto y operativo.
- `ARCHITECTURE.md` debe hablar de arquitectura actual, no de historial ni de tareas pendientes.
- `ROADMAP.md` solo contiene trabajo abierto; los completados pertenecen a `CHANGELOG.md`.
- Si `AGENTS.md` empieza a referenciar nuevos documentos canonicos, refresca tambien `.atl/skill-registry.md`.

## Ruta recomendada de lectura

1. `README.md` para arrancar el proyecto.
2. `ARCHITECTURE.md` para entender la arquitectura.
3. `docs/xema-transparencia-implementation.md` para contratos de datos y debug.
4. `ROADMAP.md` o `CHANGELOG.md` segun necesites futuro o historial.
