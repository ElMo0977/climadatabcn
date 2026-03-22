# Arquitectura de Meteo BCN

## Vision general

Meteo BCN es una SPA construida con React, TypeScript y Vite. El frontend consulta datos meteorologicos de la red XEMA mediante Socrata, procesa observaciones en cliente y se despliega como sitio estatico en GitHub Pages.

La arquitectura sigue una separacion por capas: las paginas orquestan componentes, los componentes consumen hooks, los hooks coordinan acceso a datos y la logica del dominio vive en servicios y utilidades puras.

## Principios de diseno

- Una sola fuente de datos en runtime: `xema-transparencia`.
- UI sin `fetch` directo: el acceso remoto pasa por `src/services/`.
- Fachada meteorologica estable: `src/services/providers/xemaTransparencia.ts` concentra el acceso de dominio.
- Logica de negocio y transformaciones fuera de la capa visual.
- Exportacion pesada diferida: ExcelJS se carga solo al exportar.
- Despliegue estatico: el build de produccion usa `base: "/climadatabcn/"`.

## Diagrama de capas

```text
Pages (Index.tsx)
  ->
Components (StationSelector, DateRangePicker, WeatherKPIs, WeatherCharts, DataTable, DownloadButtons)
  ->
Hooks (useWeatherDashboard, useStations, useObservations, useExcelExport)
  ->
Services (xemaTransparencia, xemaStations, xemaObservations, socrata, fetchJson)
  ->
Lib / Config / Types (date keys, station geo, coverage, stats, export, labels, env, weather types)
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

1. `Index.tsx` se mantiene como capa de composicion y delega estado de pantalla y datos derivados en `useWeatherDashboard()`.
2. `useWeatherDashboard()` usa los search params (`station`, `from`, `to`, `granularity`) como estado navegable del dashboard y expone setters compatibles con la UI.
3. `useStations()` intenta leer estaciones activas desde `yqwd-vj5e` y, si falla o no hay metadata util, cae al fallback estatico definido en `xemaStations.ts`, marcando modo degradado visible.
4. `useObservations()` traduce la granularidad de UI a contrato de provider (`daily -> day`, `30min -> 30min`), usa la cancelacion de React Query y llama a `getObservations()` desde `xemaTransparencia.ts`.
5. `src/lib/dateKeys.ts` y `src/lib/stationGeo.ts` concentran reglas puras de day keys y proximidad de estaciones para no mezclarlas en hooks o providers.
6. `xemaObservations.ts` consulta Socrata:
   - `7bvh-jvq2` para el agregado diario
   - `nzvn-apee` para detalle 30 min y para completar `windGustTime` diario
7. `src/lib/` calcula estadisticas (`weatherUtils.ts`), cobertura (`dailyCoverage.ts`, `subdailyCoverage.ts`) y exportacion (`exportExcel.ts`).
8. `WeatherCharts` se carga en diferido desde la ruta principal y `StationMap` actualiza marcadores sin reconstruirlos completos al cambiar la seleccion.
9. `useExcelExport()` recupera ambas granularidades bajo demanda y genera un `.xlsx` con hoja `Contexto` y detalle `30min` / `Diario`.

## Modulos clave

| Modulo | Responsabilidad |
|--------|-----------------|
| `src/services/providers/xemaTransparencia.ts` | Fachada del dominio XEMA y punto de entrada para estaciones y observaciones |
| `src/services/providers/xemaStations.ts` | Estaciones activas via Socrata, `metadataSource`, `warning` y fallback estatico |
| `src/services/providers/xemaObservations.ts` | Queries daily y 30 min, validacion de parametros y mapping a `Observation[]` |
| `src/services/http/socrata.ts` | Cliente SODA con paginacion por offset |
| `src/services/http/fetchJson.ts` | Fetch con timeout configurable, cancelacion cooperativa y errores tipados |
| `src/hooks/useWeatherDashboard.ts` | View-model de la pagina principal y punto de coordinacion del dashboard |
| `src/lib/dateKeys.ts` | Normalizacion y validacion de day keys compartidas |
| `src/lib/stationGeo.ts` | Distancias, filtro por radio y ordenacion de estaciones alrededor de Barcelona |
| `src/lib/dataDebug.ts` | Auditoria opcional del dataset final en consola |
| `src/config/env.ts` | Parseo de flags de entorno, timeout XEMA y helper `isXemaDebugEnabled()` |

## Decisiones tecnicas

| Decision | Razon |
|----------|-------|
| TanStack React Query para carga | Cache, retry y estados declarativos |
| Socrata como fuente unica | Datos oficiales sin backend propio |
| Fallback estatico de estaciones | La UI sigue operativa si falla la metadata remota |
| `fetchJson()` comun para red | Timeout configurable (40s por defecto para XEMA), cancelacion cooperativa y `ProviderError` tipado |
| `VITE_DEBUG_XEMA` y `VITE_DEBUG_DATA` separados | Se distingue el diagnostico del provider de la auditoria del dataset final |
| `useWeatherDashboard()` como view-model | `Index.tsx` se mantiene fino y la logica derivada queda en la capa de hooks |
| `WeatherCharts` en lazy load | Reduce coste inicial de la ruta principal aunque el chunk de Recharts siga existiendo |
| Search params como estado de dashboard | Permiten compartir selecciones y reconstruir la vista sin estado local duplicado |

## Verificacion

- Tests: Vitest + Testing Library, colocados junto a los modulos cuando aplica.
- Iteracion rapida: `npm test -- path/to/file.test.tsx` o `npm test -- -t "nombre del test"`.
- Comandos operativos: `npm test`, `npm run lint`, `npm run build`, `npm run check:bundle`.

## Documentos relacionados

- [docs/README.md](docs/README.md) para el mapa documental.
- [docs/xema-transparencia-implementation.md](docs/xema-transparencia-implementation.md) para contratos y detalle de la integracion con XEMA / Socrata.
