# AGENTS.md

## Proyecto

Meteo BCN es una SPA estatica construida con React 18, TypeScript y Vite. Consulta datos meteorologicos historicos de la red XEMA a traves de la API SODA de Socrata y se despliega en GitHub Pages.

## Stack y herramientas

- UI: React, TypeScript, Tailwind CSS, shadcn/ui, Radix UI, Recharts, Leaflet.
- Datos: TanStack React Query y servicios HTTP propios sobre Socrata.
- Tests: Vitest + Testing Library en entorno `jsdom`.
- Lint: ESLint 9 con `typescript-eslint`, `react-hooks` y `react-refresh`.
- Build: `npm run build` ejecuta type-check y build de Vite.
- Convencion de paquetes: usa `npm` como flujo principal aunque exista `bun.lockb`.

## Arquitectura que se debe respetar

La app sigue una arquitectura por capas:

1. `src/pages/`: composicion de pantallas y flujo principal.
2. `src/components/`: UI del dominio y componentes de interaccion.
3. `src/hooks/`: carga de datos, coordinacion con React Query y estado derivado de consultas.
4. `src/services/`: acceso a APIs externas y adaptacion de datos remotos.
5. `src/lib/`: logica de negocio y utilidades puras reutilizables.
6. `src/config/` y `src/types/`: configuracion compartida y tipos del dominio.

Reglas importantes:

- No hagas `fetch` directo desde componentes o paginas; usa `src/services/` y expon el consumo via hooks.
- Conserva `src/services/providers/xemaTransparencia.ts` como fachada principal del dominio meteorologico.
- Manten la logica de calculo, agregacion, cobertura y exportacion fuera de la UI, preferiblemente en `src/lib/`.
- Si anades UI reutilizable, prioriza `src/components/ui/` y los patrones existentes de shadcn/ui.
- Usa el alias `@` para imports desde `src`.

## Convenciones del dominio

- La granularidad (`30min` frente a `daily`) es un concepto central y debe reflejarse explicitamente en queries, transformacion de datos y UI.
- El flujo actual distingue tres datasets de Socrata:
  - Estaciones: `yqwd-vj5e`
  - Diario: `7bvh-jvq2`
  - Subdiario 30 min: `nzvn-apee`
- Manten la estrategia existente de paginacion automatica en Socrata.
- No rompas el fallback de estaciones cuando falle la consulta remota.
- Si incorporas dependencias pesadas del lado cliente, sigue el patron de carga diferida usado con ExcelJS.

## Convenciones de cambios

- Antes de tocar varias capas, lee `ARCHITECTURE.md` y la documentacion del area afectada.
- Intenta mantener los cambios encapsulados por capa; evita mezclar UI, acceso a datos y calculos en el mismo archivo.
- Si cambias contratos de datos o comportamiento del dominio, actualiza la documentacion relevante en `README.md`, `ARCHITECTURE.md` o `docs/xema-transparencia-implementation.md`.
- Si anades una nueva convencion raiz para agentes o skills, actualiza tambien `.atl/skill-registry.md`.

## Testing

- Coloca los tests junto al modulo afectado con sufijos `*.test.ts` o `*.test.tsx`.
- Cuando cambies `src/lib/`, `src/hooks/` o `src/services/`, anade o ajusta tests.
- Para cambios de UI con logica relevante, cubre comportamiento con Testing Library cuando tenga sentido.
- Ejecuta como minimo las comprobaciones relacionadas con tu cambio:
  - `npm run lint`
  - `npm test`
  - `npm run build`

## Despliegue y entorno

- Produccion se publica en GitHub Pages.
- Respeta `base: "/climadatabcn/"` en produccion.
- El workflow `.github/workflows/deply.yml` usa Node 20 y despliega el contenido de `dist`.

## Contexto persistido

- El contexto SDD del proyecto vive en Engram bajo `sdd-init/climadatabcn`.
- El registro local de skills y convenciones esta en `.atl/skill-registry.md`.
- Si se trabaja con SDD y no se pide otro modo explicitamente, la persistencia por defecto es Engram.
