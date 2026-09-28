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
4. `useObservations()` mantiene dos rutas sobre lecturas XEMA de 30 minutos: `30min` usa `getObservations()` sin cambios; `daily` usa `getWebDailyReadings()` con un rango UTC ampliado para cubrir los limites del dia en `Europe/Madrid`. Ambas propagan la cancelacion de React Query. La vista web no depende del dataset diario oficial.
5. `src/lib/dateKeys.ts` y `src/lib/stationGeo.ts` concentran reglas puras de day keys y proximidad de estaciones para no mezclarlas en hooks o providers.
6. `xemaObservations.ts` consulta Socrata:
   - `nzvn-apee` para detalle 30 min y para la agregacion diaria web. Esta ultima consulta comienza en la fecha UTC anterior al primer dia seleccionado y termina al final de la fecha UTC del ultimo dia; los dias adicionales no se muestran.
   - `7bvh-jvq2` conserva el contrato de consulta diaria directa; `nzvn-apee` completa su `windGustTime`.
7. `src/lib/` calcula estadisticas (`weatherUtils.ts`), cobertura (`dailyCoverage.ts`, `subdailyCoverage.ts`), calidad diaria por variable (`dailyQuality.ts`) y agregacion diaria web por franjas locales (`webDailyObservations.ts`). Solo valores diarios con calidad completa o parcial entran en las estadisticas meteorologicas de la vista diaria; validacion XEMA y cobertura son estados distintos.
8. `Index.tsx` pasa la calidad diaria a `DataTable`, `CoverageAlerts`, `WeatherKPIs` y `WeatherCharts`. La tabla y las gráficas conservan días sin fila de observación y distinguen cobertura de validación; las alertas señalan degradación por variable; los KPI muestran los días que aportan un valor finito utilizable. En las gráficas diarias, valores incompletos o ausentes producen huecos reales, mientras los parciales utilizables conservan sus marcas de calidad; las marcas quedan dentro del contenedor capturado para PNG/PDF. La ruta de 30 minutos mantiene su representación anterior. `WeatherCharts` se carga en diferido. `StationMap` actualiza marcadores sin reconstruirlos completos al cambiar la seleccion.
9. `useExcelExport()` sigue consultando la ruta `30min` existente y usando `aggregate30minToDaily()` para generar el `.xlsx` con hojas `Contexto`, `30min` y `Diario`; no utiliza la agregacion ni la calidad diaria web.

## Modulos clave

| Modulo | Responsabilidad |
|--------|-----------------|
| `src/services/providers/xemaTransparencia.ts` | Fachada del dominio XEMA y punto de entrada para estaciones y observaciones |
| `src/services/providers/xemaStations.ts` | Estaciones activas via Socrata, `metadataSource`, `warning` y fallback estatico |
| `src/services/providers/xemaObservations.ts` | Queries daily y 30 min, consulta diaria web ampliada en UTC, validacion de parametros y mapping a `Observation[]` |
| `src/lib/dailyQuality.ts` | Calidad y cobertura diaria por variable en franjas de `Europe/Madrid` |
| `src/lib/webDailyObservations.ts` | Valores diarios web, tratamiento conservador de lecturas HO ambiguas y estadisticas filtradas por calidad |
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
