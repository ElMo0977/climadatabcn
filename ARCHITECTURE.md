# Arquitectura de Meteo BCN

## Vision general

Meteo BCN es una SPA (Single Page Application) construida con React + TypeScript y empaquetada con Vite. Consume datos meteorologicos de la API SODA de Socrata (Transparencia Catalunya / XEMA) y se despliega como sitio estatico en GitHub Pages.

La aplicacion sigue una arquitectura por capas: las paginas orquestan componentes, que consumen hooks de datos, que a su vez delegan en servicios HTTP. La logica de calculo y exportacion vive en una capa de utilidades independiente.

---

## Diagrama de capas

```
┌─────────────────────────────────────────────────────┐
│                    Pages (Index.tsx)                 │
├─────────────────────────────────────────────────────┤
│   Components                                        │
│   StationSelector · WeatherCharts · DataTable       │
│   WeatherKPIs · DateRangePicker · DownloadButtons   │
├─────────────────────────────────────────────────────┤
│   Hooks                          Lib / Utils        │
│   useStations ──────┐           weatherUtils        │
│   useObservations ──┤           exportExcel         │
│                     │           dailyCoverage       │
│                     ▼           subdailyCoverage    │
│              Services            exceedance         │
│   xemaTransparencia (facade)     windVector         │
│   xemaStations · xemaObservations                   │
│   socrata (HTTP) · fetchJson                        │
├─────────────────────────────────────────────────────┤
│        API Socrata (analisi.transparenciacatalunya) │
└─────────────────────────────────────────────────────┘
```

---

## Estructura de directorios

```
src/
├── pages/               Pantallas de la app
│   ├── Index.tsx         Pagina principal (flujo completo)
│   └── NotFound.tsx      Pagina 404
│
├── components/          Componentes del flujo principal
│   ├── Header.tsx        Cabecera con branding y boton de recarga
│   ├── StationSelector.tsx  Panel lateral: mapa + lista de estaciones
│   ├── StationMap.tsx    Mapa interactivo Leaflet con marcadores
│   ├── DateRangePicker.tsx  Selector de fechas + presets + granularidad
│   ├── WeatherKPIs.tsx   5 tarjetas con indicadores clave
│   ├── WeatherCharts.tsx Graficas Recharts (temp, humedad, viento, lluvia)
│   ├── DataTable.tsx     Tabla paginada de observaciones
│   ├── DownloadButtons.tsx  Boton de exportacion Excel
│   └── ui/              Componentes genericos shadcn/ui
│
├── hooks/               Logica de carga de datos
│   ├── useStations.ts    Estaciones cercanas (React Query + fallback estatico)
│   └── useObservations.ts  Observaciones por rango y granularidad
│
├── services/            Capa de acceso a datos
│   ├── http/
│   │   ├── socrata.ts     Cliente SODA: fetchSocrata + fetchSocrataAll (paginacion)
│   │   └── fetchJson.ts   Cliente HTTP generico: timeout, reintentos, backoff
│   └── providers/
│       ├── xemaTransparencia.ts  Facade: exporta listStations + fetchObservations
│       ├── xemaStations.ts       Consulta estaciones activas de la red XEMA
│       ├── xemaObservations.ts   Observaciones daily (7bvh-jvq2) y 30min (nzvn-apee)
│       └── xemaVariableMap.ts    Mapeo de codigos XEMA a campos internos
│
├── lib/                 Utilidades y logica de negocio
│   ├── weatherUtils.ts    Agregacion, estadisticas, formateo, CSV, download
│   ├── exportExcel.ts     Generacion Excel con ExcelJS (2 hojas, lazy-loaded)
│   ├── dailyCoverage.ts   Deteccion de gaps en datos diarios
│   ├── subdailyCoverage.ts  Deteccion de gaps en datos 30min
│   ├── exceedance.ts      Calculo de exceedance (distribucion sobre umbral)
│   ├── windVector.ts      Matematica de vectores de viento
│   ├── windKpi.ts         Logica de visualizacion de KPI de viento
│   ├── quickDateRanges.ts Presets de rango rapido (7d, 14d, 30d)
│   ├── dataDebug.ts       Diagnostico de datos (solo en desarrollo)
│   └── utils.ts           Utilidades genericas (className merge)
│
├── config/              Configuracion
│   ├── env.ts             Variables de entorno Vite
│   └── sources.ts         Etiquetas de fuente de datos
│
├── types/               Tipos TypeScript
│   └── weather.ts         Station, Observation, DateRange, WeatherStats,
│                          Granularity, DataSource, ProviderError, ApiError
│
└── test/                Setup de tests (Vitest)
```

---

## Flujo de datos

1. **Inicio**: `Index.tsx` monta los componentes principales. `useStations` consulta estaciones XEMA cercanas a Barcelona via Socrata. Si falla, usa una lista estatica de 8 estaciones de respaldo.

2. **Seleccion**: El usuario elige estacion (mapa o lista), rango de fechas y granularidad (30min o diario) mediante `StationSelector` y `DateRangePicker`.

3. **Consulta**: `useObservations` (React Query) llama a `fetchObservations` del facade `xemaTransparencia.ts`:
   - **Diario**: consulta el dataset `7bvh-jvq2` (agregados diarios) y complementa con hora de racha maxima desde `nzvn-apee`.
   - **30min**: consulta `nzvn-apee` (observaciones cada 30 minutos) con todas las variables.
   - `socrata.ts` maneja la paginacion automatica (chunks de 10.000 filas).

4. **Procesamiento**: Las observaciones pasan por `weatherUtils.ts` para calcular estadisticas, y por `dailyCoverage.ts` / `subdailyCoverage.ts` para detectar huecos.

5. **Renderizado**: Los componentes reciben los datos procesados:
   - `WeatherKPIs` muestra indicadores agregados.
   - `WeatherCharts` grafica series temporales con Recharts.
   - `DataTable` muestra la tabla paginada.
   - Alertas de cobertura informan de datos faltantes.

6. **Exportacion**: `DownloadButtons` dispara `buildAndDownloadExcel` que carga ExcelJS de forma lazy y genera un `.xlsx` con dos hojas (30min y diario).

---

## Decisiones tecnicas clave

| Decision | Razon |
|----------|-------|
| **React Query** para datos | Cache automatica, refetch condicional, estados de carga/error declarativos |
| **Socrata como fuente unica** | API publica, sin necesidad de backend propio, datos oficiales XEMA |
| **ExcelJS lazy-loaded** | El paquete es grande (~200KB); se carga solo cuando el usuario exporta |
| **Paginacion automatica** | `fetchSocrataAll` itera hasta agotar resultados, transparente para el consumidor |
| **Fallback de estaciones** | Lista estatica de 8 estaciones si la consulta a Socrata falla |
| **Debug opt-in** | `VITE_DEBUG_XEMA` activa logs solo en desarrollo, sin impacto en produccion |
| **Granularidad como concepto central** | `30min` vs `daily` afecta queries, datasets consultados, agregacion y UI |

---

## Tests

- Framework: **Vitest** + **Testing Library**
- ~55 tests cubriendo utilidades, hooks y logica de servicios
- Los archivos de test se ubican junto a su modulo (ej: `useObservations.test.ts`)
- Ejecucion: `npm test` (single run) o `npm run test:watch`

---

## Documentacion tecnica adicional

- [Implementacion XEMA / Transparencia](docs/xema-transparencia-implementation.md): detalles de los datasets Socrata, mapeo de variables y estrategia de consulta.
