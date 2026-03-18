# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

---

## 2026-03-18 — Estado navegable, exportacion contextual y control de bundle

### Added

- El dashboard persiste `station`, `from`, `to` y `granularity` en la URL para poder reconstruir la vista desde search params.
- La exportacion Excel incorpora una hoja inicial `Contexto` con estacion, fuente, rango, vista activa, fecha de generacion y zona horaria.
- Nuevos tests para selector de estaciones, tabla, botones de descarga, alertas de cobertura y `useWeatherDashboard()` con hidratacion desde URL.
- Nuevo comando `npm run check:bundle` y paso de CI para vigilar el tamano de `index` y `vendor-charts`.

### Changed

- La busqueda de estaciones ahora filtra por nombre, municipio e ID.
- La tarjeta de estacion seleccionada muestra siempre `metadataSource`, nota fija de timezone y `lastUpdatedAt` local tras cada carga correcta.
- La tabla reinicia la paginacion cuando cambian rango, granularidad o dataset visible.
- `StationMap` deja de recrear todos los marcadores al cambiar solo la seleccion y actualiza iconos/popup de forma incremental.
- La exportacion Excel pasa a nombrar los archivos como `meteo-{stationSlug}-{from}_{to}.xlsx`.
- `index.css` elimina el `@import` remoto de Google Fonts y usa stacks locales documentados.

### Removed

- `VITE_DATA_MODE` deja de formar parte del contrato soportado en configuracion, tests y documentacion.

## 2026-03-18 — Ajustes del gráfico de viento

### Changed

- `WeatherCharts` afina el grosor de las líneas de temperatura, humedad y viento para aligerar la visualización sin cambiar el comportamiento de `activeDot`.
- La línea umbral de `5 m/s` del gráfico de viento mantiene la referencia dentro del chart, pero su texto deja de mostrarse arriba y pasa a una leyenda inferior unificada junto a `Racha máx.` y `Viento media`.

### Added

- Nueva cobertura de tests para documentar explícitamente los códigos de viento consultados en `30min` (`VV10`, `DV10`, `VVx10`) y `daily` (`VVM10`, `VVX10`, con `VVx10` subdaily solo para `windGustTime`).
- Nuevo test del componente `WeatherCharts` para validar la leyenda inferior del gráfico de viento y los grosores actualizados de las líneas.

## 2026-03-12 — Estabilizacion del pipeline de datos

### Changed

- Eliminado `VITE_API_PROXY_URL` del contrato soportado, de `README.md`, de `.env.example` y del parseo runtime en `src/config/env.ts`.
- `fetchStationsFromSocrata()` pasa a devolver metadata estructurada (`stations`, `metadataSource`, `warning`) y la UI muestra un aviso visible cuando la lista de estaciones entra en modo degradado.
- `fetchJson()` deja de hacer retries internos; la politica de reintentos queda bajo control de React Query.
- `useObservations()` propaga `ProviderError`, acepta cancelacion via `signal` y limita los retries a errores transitorios.
- `fetchSocrata()` / `fetchSocrataAll()` y `xemaObservations.ts` propagan la cancelacion hasta `fetch()`.
- `Index.tsx` se aligera delegando estado y datos derivados a `useWeatherDashboard.ts`.
- La normalizacion de day keys se mueve a `src/lib/dateKeys.ts` y la politica de distancia/radio de estaciones a `src/lib/stationGeo.ts`.
- `WeatherCharts` pasa a cargarse en diferido desde la ruta principal.
- `StationMap` deja de depender de iconos remotos y evita reconstruir marcadores al cambiar solo la seleccion.
- `vite.config.ts` baja `chunkSizeWarningLimit` para volver a alertar sobre crecimiento del bundle.

### Added

- Nueva cobertura para `env.ts`, `fetchJson.ts`, `socrata.ts`, `useStations()`, `useObservations()` y `useExcelExport()`.
- Validaciones adicionales del flujo de exportacion Excel y del warning visible de estaciones en modo degradado.
- Test directo de la politica geografica de estaciones extraida a `src/lib/stationGeo.ts`.

### Fixed

- Ajustado el contrato tipado de `src/lib/stationGeo.ts` al shape real consumido por `useStations()` y saneado el cleanup de `StationMap` para cerrar la fase 2 sin avisos de build/lint.
- `StationMap` vuelve a mantener visible la informacion de la estacion seleccionada reabriendo la popup tras el `flyTo`, con autopan y mas altura util para el mapa.

### Changed

- El cliente Socrata pasa a usar `VITE_XEMA_HTTP_TIMEOUT_MS` con un default de `40000` ms para tolerar mejor la latencia variable de la fuente.

## 2026-03-12 — Reorganizacion documental

### Added

- Nuevo indice canonico en `docs/README.md` con mapa de documentacion, ownership y clasificacion de artefactos historicos.

### Changed

- `README.md` simplificado como punto de entrada operativo del proyecto.
- `ARCHITECTURE.md` ajustado para reflejar los modulos y contratos actuales sin contar detalles fragiles.
- `docs/xema-transparencia-implementation.md` reescrito contra la integracion XEMA / Socrata vigente.
- `AGENTS.md` reducido a flujo de trabajo para agentes y referencias a fuentes canonicas.
- `ROADMAP.md` saneado para dejar solo trabajo pendiente.
- `.env.example` alineado con el flujo actual de proxy y flags de debug.

## 2026-03-04 — Seguridad y strict mode

### Security

- Validacion de `stationId` y day keys antes de interpolarlos en queries `$where` de Socrata (`xemaObservations.ts`). Previene inyecciones si en el futuro se acepta input del usuario.

### Changed

- TypeScript strict mode activado en `tsconfig.app.json` (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`).
- Eliminados imports sin usar en `DataTable.tsx` y `fetchJson.ts`.
- Tipados explicitos en callbacks de Recharts (`chart.tsx`, `WeatherCharts.tsx`).
- Eliminados parametros sin usar en `calendar.tsx`.
- Cliente Socrata (`socrata.ts`) migrado de `fetch()` directo a `fetchJson()` con timeout (10s), reintentos (2) y backoff exponencial.
- Duplicacion eliminada en `useStations.ts`: extraida funcion helper `mapAndSortStations()`.
- Eliminados 36 componentes shadcn/ui sin usar de `src/components/ui/`. CSS del bundle reducido de 65 KB a 33 KB (-49%).
- Validaciones de `stationId` y day keys migradas de `Error` generico a `ProviderError` con code `INVALID_PARAMS`.
- Narrowing seguro de errores en `useObservations.ts` (elimina cast `as Error`).
- Logica de exportacion Excel extraida de `Index.tsx` a hook `useExcelExport.ts`.
- Alertas de cobertura extraidas de `Index.tsx` a componente `CoverageAlerts.tsx`.

---

## 2026-02-25 — Limpieza y consolidacion

### Removed

- Legacy Supabase / Open-Meteo: funciones serverless (`supabase/functions/`), cliente (`src/integrations/supabase/`), dependencia `@supabase/supabase-js`.
- Capa de abstraccion multi-proveedor: `dataService.ts`, `mockData.ts`, `providers/index.ts`, directorio `domain/`.

### Changed

- Tipos unificados en un solo archivo `src/types/weather.ts` (eliminado `src/domain/types.ts`). `DataProvider` fusionado con `DataSource`.
- Funcion `toLocalDayKey` consolidada en `src/lib/dailyCoverage.ts` (eliminadas copias en `quickDateRanges.ts` y `xemaObservations.ts`).
- Bundle optimizado con `manualChunks` en `vite.config.ts`: chunk `index` reducido de 840KB a 268KB (-68%). Nuevos chunks separados: `vendor-react`, `vendor-query`, `vendor-charts`, `vendor-date`.
- `useStations.ts` simplificado para llamar directamente a `listStations()`.
- `env.ts` limpiado de funciones sin uso (`isProviderConfigured`, `getMissingConfigMessage`).
- `.env.example` limpiado de variables `VITE_SUPABASE_*`.

---

## 2026-02-24 — Limpieza inicial

### Changed

- `index.html` actualizado con metadatos reales de Meteo BCN (eliminados placeholder "Lovable App" y comentarios TODO).
- `README.md` reescrito para reflejar el estado real del proyecto.
- Texto de granularidad unificado en toda la interfaz a "Datos 30 min".
- `GUIA_PROYECTO.md` actualizado en apartado "Estado actual".

### Removed

- `src/App.css` (resto de plantilla sin uso).
- `src/components/NavLink.tsx` (componente sin uso).

### Fixed

- Logica de fechas corregida: hoy nunca seleccionable, presets calculados desde ayer incluido, selector manual en dias completos, rango de un solo dia valido.

---

## 2026-02 — Funcionalidades core (PRs #6-#12)

### Added

- Deteccion y visualizacion del mayor intervalo faltante en datos subdaily (PR #12).
- Hora de racha maxima (`windGustTime`) rellenada en Excel desde datos subdaily (PR #11).
- Alerta de cobertura horaria cuando faltan tramos de 30 minutos (PR #10).

### Fixed

- Export Excel en GitHub Pages: resuelto error de chunk loading con import dinamico (PR #9).
- Lectura de valor subdaily: fallback a campo `valor` cuando `valor_lectura` no existe (PR #8).
- Filtro `codi_estat` relajado para no descartar datos subdaily validos (PR #7).
- Rango de fechas normalizado a dias completos para cobertura subdaily correcta (PR #7).
- Campo `valor` invalido eliminado de selects de `nzvn-apee` (PR #8).

### Changed

- Flag de debug XEMA unificado bajo `VITE_DEBUG_XEMA` (PR #12).
- Regla `no-unused-vars` de ESLint aplicada a providers y tests XEMA.

---

## 2026-01 / 2026-02 — Estabilizacion XEMA (PRs #2-#5)

### Added

- Fetching de observaciones XEMA para granularidad daily y subdaily (30min).
- Modulos separados: `xemaStations.ts` (consulta de estaciones) y `xemaObservations.ts` (consulta de observaciones).

### Fixed

- Columna diaria XEMA corregida y metadatos reales de estaciones usados.
- Bug de ultimo dia faltante resuelto usando day keys locales en queries.
- Parsing robusto de valores en observaciones daily y subdaily.
- Conflictos de merge recurrentes resueltos estabilizando el schema diario.

### Changed

- IDs de estaciones en lista de fallback alineados con codigos XEMA reales (X4, X8, D5, WU, Y7, YQ, XL, XV).
- Provider XEMA dividido en modulos independientes (estaciones / observaciones).
- Superficie de conflicto en PRs reducida separando archivos de test.

---

## Inicio del proyecto

### Added

- Aplicacion web React + TypeScript + Vite para consulta de datos meteorologicos.
- Integracion con API SODA de Socrata (Transparencia Catalunya / XEMA).
- Selector de estaciones con mapa Leaflet interactivo.
- Selector de rango de fechas con presets rapidos (7d, 14d, 30d).
- Dos modos de visualizacion: datos cada 30 minutos y resumen diario.
- KPIs: temperatura media, humedad media, viento medio/maximo, precipitacion total.
- Graficas de series temporales con Recharts.
- Tabla paginada de observaciones con resaltado de viento fuerte (>5 m/s).
- Exportacion a Excel con dos hojas (30min y diario) y formato condicional.
- Alertas de cobertura cuando faltan datos en el rango seleccionado.
- Suite de tests con Vitest y Testing Library.
- Deploy automatico a GitHub Pages via GitHub Actions.
