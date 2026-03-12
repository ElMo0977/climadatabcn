# AGENTS.md

## Proposito

Este archivo orienta a agentes y automatizaciones dentro del repositorio. No es la fuente canonica de setup ni de arquitectura: su trabajo es apuntar a los documentos correctos y recordar las reglas operativas del proyecto.

## Fuentes canonicas

- `README.md` — arranque del proyecto, comandos y variables de entorno soportadas.
- `docs/README.md` — indice documental y ownership de cada documento.
- `ARCHITECTURE.md` — arquitectura por capas y flujo de datos.
- `docs/xema-transparencia-implementation.md` — integracion actual con XEMA / Socrata.
- `ROADMAP.md` — trabajo pendiente.
- `CHANGELOG.md` — historial de cambios.

## Convenciones del repo

- Respeta la arquitectura por capas: `pages -> components -> hooks -> services -> lib/config/types`.
- No hagas `fetch` directo desde la UI. El acceso a datos pasa por `src/services/` y se expone mediante hooks.
- Mantén `src/services/providers/xemaTransparencia.ts` como fachada del dominio meteorologico.
- Usa el alias `@` para imports desde `src`.
- El flujo principal de trabajo usa `npm`, aunque exista `bun.lockb`.
- Conserva la compatibilidad con GitHub Pages y el `base: "/climadatabcn/"` de produccion.

## Mantenimiento documental

- Si cambian arranque, comandos o variables de entorno, actualiza `README.md` y `.env.example`.
- Si cambian estructura, flujo de datos o contratos tecnicos, actualiza `ARCHITECTURE.md` o `docs/xema-transparencia-implementation.md`.
- Si cambia el trabajo pendiente, actualiza `ROADMAP.md`.
- Si un cambio ya se completo, registralo en `CHANGELOG.md`.
- Si este archivo empieza a referenciar nuevas fuentes canonicas, refresca tambien `.atl/skill-registry.md`.

## Verificacion recomendada

- Cambios runtime: `npm run lint`, `npm test`, `npm run build`.
- Cambios solo documentales: validar enlaces y referencias, y volver a correr los comandos documentados si el cambio afecta la guia operativa.

## Revisión de código
Para revisiones completas, usar siempre agent-teams-lite con agentes
especializados por capa. Guardar hallazgos en docs/code-review.md.
Nunca aplicar correcciones sin aprobación explícita del usuario.