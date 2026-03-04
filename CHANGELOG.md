# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

---

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
