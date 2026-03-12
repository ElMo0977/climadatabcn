# Arquitectura de Meteo BCN

## Vision general

Meteo BCN es una SPA construida con React, TypeScript y Vite. El frontend consulta datos meteorologicos de la red XEMA mediante Socrata, procesa observaciones en cliente y se despliega como sitio estatico en GitHub Pages.

La arquitectura sigue una separacion por capas: las paginas orquestan componentes, los componentes consumen hooks, los hooks coordinan acceso a datos y la logica del dominio vive en servicios y utilidades puras.

## Principios de diseno

- Una sola fuente de datos en runtime: `xema-transparencia`.
- UI sin `fetch` directo: el acceso remoto pasa por `src/services/`.
- Logica de negocio y transformaciones fuera de la capa visual.
- Exportacion pesada diferida: ExcelJS se carga solo al exportar.
- Despliegue estatico: el build de produccion usa `base: "/climadatabcn/"`.

## Diagrama de capas

```text
Pages (Index.tsx)
  ->
Components (StationSelector, DateRangePicker, WeatherKPIs, WeatherCharts, DataTable, DownloadButtons)
  ->
Hooks (useStations, useObservations, useExcelExport)
  ->
Services (xemaTransparencia, xemaStations, xemaObservations, socrata, fetchJson)
  ->
Lib / Config / Types (coverage, stats, export, labels, env, weather types)
  ->
API Socrata (Transparencia Catalunya / XEMA)
```

## Estructura del codigo

```text
src/
├── pages/                Pantallas y composicion principal
├── components/           UI de dominio y componentes reutilizables
│   └── ui/               Componentes base de shadcn/ui
├── hooks/                React Query, coordinacion de carga y exportacion
├── services/
│   ├── http/             Cliente HTTP y cliente Socrata
│   └── providers/        Fachada XEMA, estaciones, observaciones y codigos
├── lib/                  Calculo, coverage, exportacion y utilidades
├── config/               Entorno y etiquetas de fuentes
├── types/                Tipos del dominio meteorologico y errores
└── test/                 Setup de Vitest
```

## Flujo de datos

1. `Index.tsx` coordina estacion seleccionada, rango y granularidad (`30min` o `daily`).
2. `useStations()` intenta leer estaciones activas desde `yqwd-vj5e` y, si falla o no hay metadata util, cae al fallback estatico definido en `xemaStations.ts`, marcando modo degradado visible.
3. `useObservations()` traduce la granularidad de UI a contrato de provider (`daily -> day`, `30min -> 30min`), usa la cancelacion de React Query y llama a `getObservations()` desde `xemaTransparencia.ts`.
4. `xemaObservations.ts` consulta Socrata:
   - `7bvh-jvq2` para el agregado diario
   - `nzvn-apee` para detalle 30 min y para completar `windGustTime` diario
5. `src/lib/` calcula estadisticas (`weatherUtils.ts`), cobertura (`dailyCoverage.ts`, `subdailyCoverage.ts`) y exportacion (`exportExcel.ts`).
6. `useExcelExport()` recupera ambas granularidades bajo demanda y genera el `.xlsx`.

## Modulos clave

| Modulo | Responsabilidad |
|--------|-----------------|
| `src/services/providers/xemaTransparencia.ts` | Fachada del dominio XEMA y punto de entrada para estaciones y observaciones |
| `src/services/providers/xemaStations.ts` | Estaciones activas via Socrata, `metadataSource`, `warning` y fallback estatico |
| `src/services/providers/xemaObservations.ts` | Queries daily y 30 min, validacion de parametros y mapping a `Observation[]` |
| `src/services/http/socrata.ts` | Cliente SODA con paginacion por offset |
| `src/services/http/fetchJson.ts` | Fetch con timeout, retries y errores tipados |
| `src/lib/dataDebug.ts` | Auditoria opcional del dataset final en consola |
| `src/config/env.ts` | Parseo de flags de entorno y helper `isXemaDebugEnabled()` |

## Decisiones tecnicas

| Decision | Razon |
|----------|-------|
| TanStack React Query para carga | Cache, retry y estados declarativos |
| Socrata como fuente unica | Datos oficiales sin backend propio |
| Fallback estatico de estaciones | La UI sigue operativa si falla la metadata remota |
| `fetchJson()` comun para red | Timeout de 10s, cancelacion cooperativa y `ProviderError` tipado |
| `VITE_DEBUG_XEMA` y `VITE_DEBUG_DATA` separados | Se distingue el diagnostico del provider de la auditoria del dataset final |

## Verificacion

- Tests: Vitest + Testing Library, colocados junto a los modulos cuando aplica.
- Comandos operativos: `npm test`, `npm run lint`, `npm run build`.

## Documentos relacionados

- [docs/README.md](docs/README.md) para el mapa documental.
- [docs/xema-transparencia-implementation.md](docs/xema-transparencia-implementation.md) para contratos y detalle de la integracion con XEMA / Socrata.
