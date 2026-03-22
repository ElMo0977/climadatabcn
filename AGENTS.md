# AGENTS.md
## Proposito
Esta guia es exclusiva de `climadatabcn` y esta pensada para agentes que editan codigo en este repo.
No la reemplaces por instrucciones genericas. Hoy este proyecto no tiene `.cursor/rules/`, `.cursorrules` ni `.github/copilot-instructions.md`.

## Contexto rapido
- Stack: Vite + React + TypeScript
- Deploy: GitHub Pages
- Base de produccion: `"/climadatabcn/"`
- Package manager: `npm`
- Alias de imports: `@` -> `src`
- Tests: Vitest + Testing Library + jsdom
- Setup de tests: `src/test/setup.ts`

## Fuentes canonicas
Antes de cambiar algo, lee lo que corresponda:
- `README.md` — setup, scripts, entorno y uso local
- `ARCHITECTURE.md` — capas, flujo de datos y decisiones tecnicas
- `docs/README.md` — mapa documental
- `docs/xema-transparencia-implementation.md` — integracion XEMA / Socrata
- `ROADMAP.md` — trabajo pendiente
- `CHANGELOG.md` — cambios completados

## Arquitectura obligatoria
La estructura del frontend es `pages -> components -> hooks -> services -> lib/config/types`.

Aplicala literal:
- `pages/` arma pantallas y flujo de ruta
- `components/` renderiza UI reutilizable
- `hooks/` coordina estado y consumo de servicios
- `services/` resuelve acceso a datos y providers
- `lib/`, `config/` y `types/` guardan logica pura, constantes y tipos

Reglas no negociables:
- No hagas `fetch` directo en pages ni components
- No metas HTTP en hooks salvo que deleguen a `services/`
- Mantené el acceso al dominio detras de servicios
- `src/services/providers/xemaTransparencia.ts` es la fachada meteorologica
- Conservá compatibilidad con GitHub Pages y su `base`

## Comandos
Usa solo `npm`.

Build y desarrollo:
- `npm run dev` — servidor local
- `npm run build` — typecheck + build de produccion
- `npm run build:dev` — build en modo desarrollo
- `npm run preview` — preview del build generado
- `npm run check:bundle` — revisa tamano del bundle

Calidad:
- `npm run lint` — ESLint
- `npm test` — suite completa una vez
- `npm run test:watch` — Vitest en watch

## Test individual
Formas preferidas:
- `npm test -- path/to/file.test.tsx`
- `npm test -- -t "nombre del test"`

Ejemplos reales del repo:
- `npm test -- src/pages/Index.test.tsx`
- `npm test -- src/hooks/useObservations.test.ts`
- `npm test -- -t "loads stations successfully"`
- `npx vitest run src/components/DataTable.test.tsx`
- `npx vitest src/pages/Index.test.tsx --watch`

Mientras iteres, preferi archivo unico o `-t`. Antes de terminar, corre una verificacion mas amplia.

## Reglas de codigo
### Imports
- Usa `@` para imports desde `src`
- Usa `@/...` entre carpetas distintas y relativos dentro de la misma carpeta
- Ordena imports: externos primero, internos despues
- Usa `import type` para tipos
- Borra imports sin uso

### Formato
- Respeta el estilo del archivo tocado
- Conserva las comillas y el formato de alrededor
- Mantené diffs chicos y enfocados
- No metas churn de formato en lineas no relacionadas
- Priorizá legibilidad sobre abstracciones innecesarias

### TypeScript
- Trata el codigo de app como TypeScript estricto
- Reutiliza tipos existentes antes de crear nuevos
- Evita `any` salvo caso puntual y acotado
- Acota `unknown` y datos remotos en el borde de servicios/providers
- Hace firmas y retornos faciles de entender desde el uso

### Naming
- Usa nombres descriptivos y ligados al dominio meteorologico
- Components: PascalCase
- Hooks: `useX`
- Utils y servicios: camelCase
- Tipos e interfaces: PascalCase

## Datos y servicios
- `services/` es el limite de acceso externo y transformacion
- Aisla logica especifica del provider fuera de la UI
- Normaliza respuestas remotas antes de que lleguen a components
- Si agregas endpoints o campos meteorologicos, empezá por provider/service
- No filtres shapes crudos de API a la UI si un modelo de dominio queda mas claro

## Manejo de errores
- Falla de forma predecible en los limites de servicio
- Usa errores tipados como `ProviderError` cuando aplique
- No ocultes silenciosamente errores de red o parseo
- Devuelve estados seguros para UI en hooks y components
- No tires strings crudos y modela estados vacios o parciales explicitamente

## React y UI
- Mantene components enfocados en render e interaccion
- Mueve logica derivada reutilizable a hooks cuando reduzca duplicacion
- Preferi composicion sobre pages gigantes
- Reutiliza `src/components/ui/` cuando tenga sentido
- Verifica que lo nuevo siga funcionando bajo el `base` de GitHub Pages

## Testing
- Deja los tests junto al codigo como `*.test.ts` o `*.test.tsx`
- Usa Vitest + Testing Library con `src/test/setup.ts`
- Testea comportamiento visible y mapeo de dominio, no detalles internos
- Mockea services y providers antes que red real
- Agrega o ajusta tests al tocar hooks, services, mapeos o estados UI no triviales

## Documentacion
Actualiza docs en la misma tarea cuando cambie el comportamiento:
- `README.md` si cambian setup, scripts, env vars, flujo local o deploy
- `ARCHITECTURE.md` si cambian capas, flujo, limites de servicios o decisiones tecnicas
- `docs/xema-transparencia-implementation.md` si cambia XEMA/Socrata, contratos o mapeos
- `docs/README.md` si agregas, renombras o eliminas docs
- `ROADMAP.md` si cambian prioridades o estado del trabajo
- `CHANGELOG.md` si completas un cambio relevante

## Verificacion
Elige checks segun el tipo de cambio:
- Runtime: `npm run lint`, `npm test`, `npm run build`
- Tests: archivo o `-t` afectado, despues `npm test`
- Services o datos: tests puntuales del modulo, `npm run lint`, `npm test`
- Solo docs: valida referencias, nombres de comandos y consistencia del texto

## Disciplina de cambios
- Mantené los cambios alineados con la arquitectura
- No mezcles refactors con features salvo necesidad real
- No agregues dependencias sin motivo especifico del repo
- Preserva el comportamiento publico salvo que la tarea lo cambie
- Si rompes un patron, documenta por que y actualiza la doc relevante

## Recordatorio final
Optimiza siempre por:
- ubicacion correcta de la logica
- limites limpios entre capas
- compatibilidad con GitHub Pages
- abstracciones meteorologicas claras
- diffs chicos y verificados
- documentacion sincronizada con el codigo

Si dudas donde poner una regla o transformacion, deja la UI fina y empuja los datos hacia `src/services/` y la fachada `xemaTransparencia`.
