# Auditoría del pipeline de datos — ClimaDataBCN

**Fecha:** 2025-02-08  
**Objetivo:** Verificar que los datos mostrados en gráficas y exportados a Excel son correctos y que el selector de granularidad (día/hora) se respeta.

**Nota:** La app usa únicamente **Open Data BCN** como fuente oficial; el respaldo es Open-Meteo vía Supabase. Meteocat fue eliminado del código.

---

## 1. Resumen ejecutivo

| Aspecto | Estado | Nivel de confianza |
|--------|--------|--------------------|
| **Flujo UI → datos** | La granularidad se propaga correctamente desde el estado hasta el dataService y providers. | Alto (código) |
| **Selector día/hora** | La granularidad se envía correctamente al dataService (Open Data BCN) y a Supabase (Open-Meteo). | Alto |
| **Datos en gráficas** | Mismos `observations` que devuelve el hook; sin redondeos adicionales en gráfico. Temperatura/humedad/precip en °C, %, mm; viento en m/s. | Alto |
| **Exportación Excel** | Usa **los mismos** `observations` que el gráfico (no rehace consulta). Resumen diario se calcula con `buildDailySummary` (agrupa por día). Hoja "Detalle Horario" puede mostrar 1 fila/día si la granularidad era diaria. | Alto |
| **Calidad de datos** | No hay validación de rangos (outliers), monotonía temporal ni dedupe explícito en el flujo principal. Unidades documentadas en código; timezone varía por proveedor. | Medio |

**Qué funciona:**  
- Propagación de `granularity` en queryKey y en parámetros a dataService y Supabase.  
- Mock y Open-Meteo (Supabase) respetan agregación daily/hourly.  
- Excel exporta exactamente el dataset en memoria; fórmulas de resumen diario coherentes con el gráfico de viento.

**Qué no (o es incierto):**  
- Posible confusión visual: el eje X de los gráficos siempre usa `formatShortDate` → "d/M HH:mm", por lo que puntos diarios se ven como "15/1 00:00" y pueden parecer "horarios".  
- Sin instrumentación en producción no se puede confirmar con una petición real (estación Gràcia, día/hora) qué se envía y qué se recibe.

---

## 2. Arquitectura actual de datos

### 2.1 Componentes y responsabilidades

| Componente | Ubicación | Responsabilidad |
|------------|-----------|-----------------|
| **UI estado** | `src/pages/Index.tsx` | `granularity` (daily/hourly), `dateRange`, `selectedStation`. Pasa granularidad a `DateRangePicker`, `useObservations`, `WeatherCharts`, `DataTable`, `DownloadButtons`. |
| **useObservations** | `src/hooks/useObservations.ts` | Convierte `granularity` → `agg` ('daily' \| 'hourly'). Si estación es opendata-bcn: llama a `dataService.getTimeseries` por cada variable con ese `agg`. Si estación es open-meteo: fetch a Supabase Edge Function con `granularity: agg`. Merge de series por timestamp → `Observation[]`. |
| **dataService** | `src/services/dataService.ts` | Servicio único: Open Data BCN. Llama a `openDataBcnProvider.getTimeseries(stationId, from, to, variable, aggregation)`. Sin selector de proveedores. |
| **Providers** | `src/services/providers/openDataBcn.ts`, `mockData.ts` | OpenDataBcn: en mock devuelve `createMockTimeseries(..., aggregation)`; en live pendiente de API real. Mock: `incrementMs = aggregation === 'hourly' ? 3600000 : 86400000`. |
| **Supabase Edge** | `supabase/functions/observations/index.ts` | Recibe `stationId`, `from`, `to`, `granularity` ('hourly' \| 'daily'). Llama a Open-Meteo Archive API con `hourly=` o `daily=` y `timezone=Europe/Madrid`. Devuelve `{ data: Observation[], cached }`. |
| **Transform / util** | `src/lib/weatherUtils.ts` | `formatDayKey`, `aggregateWindByBucket`, `buildDailySummary`, `buildDailyWindReport`, `formatShortDate`, `formatTimestamp`. Ordenación en `useObservations` por timestamp al construir `data`. |
| **Chart** | `src/components/WeatherCharts.tsx` | Recibe `observations` y `granularity`. Temp/humedad/precip: `chartData = observations.map(obs => ({ ...obs, label: formatShortDate(obs.timestamp) }))`. Viento: `aggregateWindByBucket(observations, granularity === 'daily' ? formatDayKey : formatShortDate)`. |
| **Export** | `src/lib/exportExcel.ts`, `DownloadButtons.tsx` | `buildAndDownloadExcel(observations, stationName, dataSourceLabel)`. Resumen diario vía `buildDailySummary(observations)`; detalle = `observations.forEach`. No rehace ninguna petición. |

### 2.2 Inventario de archivos clave

- **Gráficas:** `src/components/WeatherCharts.tsx` (Chart), datos desde `src/pages/Index.tsx` vía `useObservations`.
- **Fetch de observaciones:** `src/hooks/useObservations.ts` (único punto que obtiene las series para la página principal).
- **Servicio unificado:** `src/services/dataService.ts`.
- **Providers:** `src/services/providers/openDataBcn.ts`, `mockData.ts`.
- **Exportación Excel/CSV:** `src/lib/exportExcel.ts`; CSV desde `weatherUtils.ts` (`convertToCSV`, `convertToDailyReportCSV`).
- **Granularidad:** elegida en `DateRangePicker` → estado en `Index.tsx` → pasada a `useObservations` y a componentes hijos. Traducción a `agg` en `useObservations.ts` línea 55: `agg = granularity === 'daily' ? 'daily' : 'hourly'`.

---

## 3. Flujo de datos end-to-end

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  UI (Index.tsx)                                                                  │
│  granularity, dateRange, selectedStation                                        │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  useObservations (hooks/useObservations.ts)                                      │
│  agg = granularity === 'daily' ? 'daily' : 'hourly'                              │
│  queryKey: ['observations', station?.id, station?.source, fromStr, toStr,         │
│             granularity]  ← refetch al cambiar granularidad                      │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
              ▼ (source opendata-bcn)                        ▼ (source open-meteo)
┌──────────────────────────────┐           ┌──────────────────────────────────────┐
│  dataService.getTimeseries   │           │  fetch(Supabase/functions/v1/          │
│  (stationId, from, to,       │           │    observations?stationId=&from=&to=  │
│   variable, agg)             │           │    &granularity=hourly|daily)          │
│  Por cada variable en        │           │  → Open-Meteo archive (hourly/daily)   │
│  VARIABLES_HOURLY o          │           │  timezone=Europe/Madrid                │
│  VARIABLES_DAILY             │           └──────────────────┬───────────────────┘
└──────────────┬───────────────┘                              │
               │                                              │
               ▼                                              │
┌──────────────────────────────┐                             │
│  openDataBcn                 │                             │
│  getTimeseries(..., agg)      │                             │
│  → TimeseriesResponse[]      │                             │
└──────────────┬───────────────┘                             │
               │                                              │
               │  Merge por timestamp (pointsByTs)            │
               │  Sort by timestamp                            │
               │  → Observation[]                             │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  observations (mismo array en memoria)                                           │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐    ┌──────────────────────┐    ┌─────────────────────────────┐
│ WeatherCharts │    │ DataTable            │    │ DownloadButtons → exportExcel│
│ chartData =   │    │ hourly: obs[]        │    │ buildDailySummary(obs)       │
│ observations  │    │ daily: buildDaily    │    │ + sheet Detalle = obs[]     │
│ + windBucket  │    │   WindReport(obs)     │    │ timezone: no indicado en celda│
└───────────────┘    └──────────────────────┘    └─────────────────────────────┘
```

**Diagrama Mermaid (flujo simplificado):**

```mermaid
flowchart LR
  subgraph UI
    A[Index: granularity, station, dateRange]
  end
  subgraph Hook
    B[useObservations: agg = daily|hourly]
  end
  subgraph Data
    C[dataService / Supabase]
    D[Providers: OpenDataBcn, Mock]
    E[Open-Meteo API]
  end
  subgraph Transform
    F[Merge by timestamp, sort]
  end
  subgraph Consume
    G[WeatherCharts]
    H[DataTable]
    I[Excel export]
  end
  A --> B
  B --> C
  C --> D
  C --> E
  D --> F
  E --> F
  F --> G
  F --> H
  F --> I
```

---

## 4. Parametrización exacta de consultas

### 4.1 Proveedores (dataService)

- **Open Data BCN** (dataService):  
  - Llamada: `openDataBcnProvider.getTimeseries(stationId, from, to, variable, aggregation)`.  
  - `from` / `to`: objetos `Date`.  
  - `aggregation`: `'daily'` | `'hourly'` (según `granularity` en useObservations).

### 4.2 Variables pedidas

- **Hourly:** `temperature`, `humidity`, `windSpeed`, `precipitation` (VARIABLES_HOURLY en useObservations).  
- **Daily:** `temperature`, `humidity`, `windSpeed`, `windSpeedMin`, `windSpeedMax`, `precipitation` (VARIABLES_DAILY).

Para cada variable se hace una llamada; luego se hace merge por `timestamp` en un único `Observation[]`.

### 4.3 Supabase Edge (Open-Meteo)

- **URL:** `GET ${VITE_SUPABASE_URL}/functions/v1/observations?stationId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=hourly|daily`  
- **Cuerpo:** ninguno.  
- **Respuesta:** `{ data: Observation[], cached: boolean }`.  
- Open-Meteo Archive:  
  - Hourly: `hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&wind_speed_unit=ms&timezone=Europe/Madrid`  
  - Daily: `daily=temperature_2m_mean,relative_humidity_2m_mean,wind_speed_10m_max,wind_speed_10m_min,precipitation_sum&...&timezone=Europe/Madrid`

### 4.4 Caché (React Query)

- **useObservations:**  
  `queryKey: ['observations', station?.id ?? null, station?.source ?? null, fromStr, toStr, granularity]`  
  → Cambiar granularidad invalida la clave y provoca refetch. Correcto.

- **useProviderTimeseries** (no usado por Index):  
  `queryKey: ['provider-timeseries', mode, stationId, from.toISOString(), to.toISOString(), variable, aggregation]`  
  → Incluye `aggregation`.

---

## 5. Transformaciones aplicadas

| Paso | Descripción | Archivo / función |
|------|-------------|--------------------|
| **Mapping variables** | Cada provider devuelve `TimeseriesResponse` con `points: { timestamp, value }`. useObservations mapea variable → clave Observation: temperature, humidity, windSpeed, windSpeedMin, windSpeedMax, precipitation. | `useObservations.ts` ~101–128 |
| **Merge por timestamp** | `pointsByTs = Map<timestamp, Partial<Observation>>`. Por cada variable y cada punto, se hace `pointsByTs.get(p.timestamp)` y se asigna el valor a la clave correspondiente. Si un timestamp solo aparece en una variable, el resto quedan null. | `useObservations.ts` ~101–128 |
| **Ordenación** | `Array.from(pointsByTs.entries()).sort((a,b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())`. | `useObservations.ts` ~132–135 |
| **Unidades** | Documentadas en dominio: °C, %, m/s, mm. Open-Meteo usa `wind_speed_unit=ms`. No hay conversión en cliente. | `domain/types.ts` |
| **Redondeos** | KPIs: `calculateStats` redondea temp (1 decimal), humedad (entero), viento (1 decimal), precipitación (1 decimal). Excel: `roundWind` 1 decimal; temp/hum/precip sin redondeo explícito en celdas de detalle. | `weatherUtils.ts`, `exportExcel.ts` |
| **Dedupe** | No hay dedupe explícito. Si el mismo timestamp aparece dos veces en una serie, el Map sobrescribe; si dos variables devuelven el mismo timestamp con distinto formato (p. ej. "2024-01-15" vs "2024-01-15T00:00:00Z"), se crearían dos filas. | — |
| **Resampling/agregación** | Agregación la hace el backend (Open Data BCN mock o API, Open-Meteo daily/hourly). En cliente, para vista "daily" del gráfico de viento y de la tabla se usa `aggregateWindByBucket(observations, formatDayKey)` o `buildDailyWindReport`; no se re-muestrea la serie de temperatura/humedad en cliente. | `WeatherCharts.tsx`, `DataTable.tsx`, `weatherUtils.ts` |

---

## 6. Auditoría de calidad de datos

### 6.1 Validaciones actuales en código

- **Monotonía temporal:** Solo ordenación por timestamp al construir `data` en useObservations. No se comprueba que los timestamps sean estrictamente crecientes después del merge.  
- **Regularidad del step:** No se calcula ni se valida (p. ej. 1h vs 1d).  
- **Duplicados:** El merge por `timestamp` (string) puede dejar duplicados si el mismo instante viene con formatos distintos (p. ej. "2024-01-15" vs "2024-01-15T00:00:00.000Z").  
- **Huecos:** No se rellenan; se muestran como null en gráfico (`connectNulls` en Recharts).  
- **Outliers:** No hay filtros por rango (temperatura, humedad 0–100, presión, etc.).  
- **Timezone:** Open-Meteo usa `timezone=Europe/Madrid`. Open Data BCN (mock/API) puede variar; documentar en provider.  
- **Formato de fecha:** Parsing con `parseISO` (date-fns) y `new Date(...)`; formato de la API no normalizado a ISO en todos los providers.

### 6.2 Ejemplos de timestamps (esperados)

**Mock daily** (`mockData.ts`, increment 86400000, `current.toISOString()`):

- Primer punto: `2024-02-01T00:00:00.000Z` (o la fecha `from` en UTC).  
- Punto medio: `2024-02-04T00:00:00.000Z`.  
- Último: `2024-02-07T00:00:00.000Z`.

**Mock hourly** (increment 3600000):

- Primer: `2024-02-01T00:00:00.000Z`.  
- Medio: `2024-02-04T12:00:00.000Z`.  
- Último: `2024-02-07T23:00:00.000Z`.

**Open-Meteo daily** (Supabase): `daily.time` suele ser `["2024-02-01", "2024-02-02", ...]` (solo fecha).  
**Open-Meteo hourly:** `hourly.time` en formato ISO con hora, p. ej. `"2024-02-01T00:00"` (timezone aplicada en la respuesta según `timezone=Europe/Madrid`).

**Open Data BCN (mock) daily:** mismo formato que hourly en timestamps (ISO); step 24h.

### 6.3 Rangos esperables (para validación futura)

- Temperatura (°C): [-10, 45]; para Barcelona en invierno, p. ej. [-5, 25]. Valores como 32°C en febrero serían sospechosos.  
- Humedad (%): [0, 100].  
- Presión (hPa): [850, 1100] (si se usara).  
- Viento (m/s): ≥ 0; umbral razonable máx. p. ej. 50 m/s.  
- Precipitación (mm): ≥ 0.

### 6.4 Hipótesis y cómo verificar

- **Hipótesis:** "Siempre muestra por hora" podría deberse a percepción: el eje X con `formatShortDate` muestra "d/M HH:mm", y puntos diarios aparecen como "15/1 00:00", dando sensación de muchas horas.  
- **Verificar:** Con `VITE_DEBUG_DATA=1` (ver sección 10), revisar en consola: `request params` (agg, from, to) y `dataset stats` (número de puntos, step detectado). Para 7 días: daily ≈ 7 puntos, hourly ≈ 168. Comprobar en Network la petición a Supabase/Open Data BCN y la respuesta (array length y formato de `time`/`timestamp`).

---

## 7. Auditoría de exportación Excel

- **Mismos datos que el gráfico:** Sí. `buildAndDownloadExcel(observations, ...)` recibe el mismo array que usa WeatherCharts y DataTable. No se rehace ninguna consulta.  
- **Granularidad:** La hoja "Detalle Horario" vierte todas las `observations`. Si la granularidad era diaria, habrá 1 fila por día; el nombre de la hoja puede inducir a error ("Horario" con datos diarios).  
- **Resumen diario:** Calculado con `buildDailySummary(observations)`, que agrupa por `formatDayKey(obs.timestamp)` y calcula temp media, humedad media, viento min/avg/max (misma lógica que el gráfico de viento), precipitación total. Coherente con la visualización.  
- **Timestamps en Excel:** Columna "Fecha/Hora" en Detalle = `obs.timestamp` (string ISO o formato API). No se indica en la celda si es UTC o Europe/Madrid.  
- **Metadata:** Se puede incluir `dataSourceLabel` en la primera fila (fuente/estación). No hay columna explícita de variable, unidad, agg ni rango de fechas en el libro.  
- **Redondeos:** Viento redondeado a 1 decimal (`roundWind`); temp/hum/precip en resumen según `buildDailySummary` (temp 1 decimal, humedad entero, precip 1 decimal).  
- **Separador decimal:** No forzado en exportExcel (depende de locale de Excel).  
- **Formato de fecha:** En resumen se usa `formatDayLabel(row.date)` (ej. "1 feb 2024"); en detalle, el string crudo `obs.timestamp`.

**Conclusión:** Excel y gráfico usan el mismo dataset. Para un rango de 3–5 días con granularidad diaria, el número de filas en Detalle debe coincidir con el número de puntos del gráfico (temp/humedad/precip), y el Resumen diario debe coincidir con la tabla "Datos detallados" en vista diaria (viento min/avg/max por día).

---

## 8. Lista priorizada de riesgos/bugs

| Id | Severidad | Componente | Descripción | Archivo:Línea (aprox.) | Efecto |
|----|-----------|------------|-------------|------------------------|--------|
| F2 | Media | Merge por timestamp | Si un provider devuelve "2024-01-15" y otro "2024-01-15T00:00:00Z", el Map genera dos filas para el mismo instante. | `useObservations.ts`:101–128 | Duplicados o nulls en filas; conteo de puntos y promedios desviados. |
| F3 | Media | Excel / UI | La hoja "Detalle Horario" puede contener 1 fila por día cuando la granularidad es diaria; el nombre es engañoso. | `exportExcel.ts`:79 | Confusión del usuario sobre qué representa la pestaña. |
| F4 | Baja | Gráficos | El eje X usa siempre `formatShortDate` (d/M HH:mm). Para datos diarios los puntos se etiquetan "15/1 00:00", pudiendo parecer horarios. | `WeatherCharts.tsx`:33–34, 109 | Percepción de "siempre por hora" aunque el número de puntos sea el correcto. |
| F5 | Baja | Calidad | No hay validación de rangos (outliers) ni monotonía/step; timezone no unificado entre providers. | Varios | Riesgo de mostrar valores incorrectos o desfases de hora sin aviso. |

---

## 9. Recomendaciones y plan de cambios

### Quick wins (impacto alto, riesgo bajo)

1. **Normalizar timestamp en merge:** Antes de `pointsByTs.set`, normalizar a ISO o a "YYYY-MM-DD" para daily (p. ej. con `format(fromParse(ts), "yyyy-MM-dd")` para daily y ISO para hourly) para evitar duplicados por formato.  
2. **Nombre de hoja Excel:** Si la granularidad es daily, usar por ejemplo "Detalle Diario" o "Detalle (por día)" en lugar de "Detalle Horario", o añadir una fila de metadata que indique "Granularidad: por día".

### Cambios estructurales (más impacto, más riesgo)

4. **Validación de datos:** Tras el merge, opcionalmente: comprobar monotonía, step aproximado, duplicados y rangos por variable; log en modo debug o marcar filas sospechosas.  
5. **Timezone explícito:** Definir convención (p. ej. siempre Europe/Madrid para presentación) y documentar qué devuelve cada provider; en Excel incluir "Zona horaria: Europe/Madrid" (o la que corresponda) en metadata.  
6. **Instrumentación:** Mantener y usar `VITE_DEBUG_DATA=1` en desarrollo para trazar params y stats del dataset en cada carga.

---

## 10. Instrumentación ligera (VITE_DEBUG_DATA)

Cuando `import.meta.env.VITE_DEBUG_DATA === '1'`:

- En el hook que construye `observations` (o en dataService) se puede loguear:
  - Parámetros de la petición: stationId, variable(s), from, to, agg, provider usado.
  - Stats del dataset final: número de puntos, min/max por variable, step detectado (diferencias entre timestamps consecutivos), número de duplicados (mismo timestamp normalizado), número de huecos (según step esperado).
- Opcional: escribir en una carpeta `debug/` un snapshot JSON de la respuesta raw del primer provider y del array `Observation[]` final (por ejemplo para un rango de 3–5 días).

**Implementado:** Módulo `src/lib/dataDebug.ts` exporta `logDataDebug(params, observations)`, llamado desde `useObservations` al final del queryFn cuando `VITE_DEBUG_DATA=1`.

**Pasos para reproducir (estación Gràcia, 7 días):**
1. En `.env`: `VITE_DEBUG_DATA=1`. Reiniciar `npm run dev`.
2. Seleccionar estación "Gràcia", rango 7 días, granularidad **Día**. Abrir consola: debe aparecer `[ClimaDataBCN data debug]` con Request params (agg: "daily") y Dataset stats con `nPoints` ≈ 7, `stepDetectedHours` ≈ 24.
3. Cambiar a granularidad **Hora**. Nuevo log con `agg: "hourly"`, `nPoints` ≈ 168, `stepDetectedHours` ≈ 1.
4. Si con "Día" ves 168 puntos y step 1h, la petición o el backend están devolviendo hourly (bug). Comprobar en Network la URL y el cuerpo de la respuesta.

**Script de diagnóstico (fuera del navegador):**  
`node scripts/dataDiagnostics.js path/to/observations.json` (o pipe JSON por stdin). Imprime: nPoints, first/mid/last timestamp, step detectado, duplicados, huecos irregulares, min/max por variable.

---

## 11. Pruebas mínimas recomendadas

- **Unit test normalización/transform:** Función que reciba un array de observaciones con timestamps en formatos mezclados ("YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss.sssZ") y devuelva ordenado y con timestamps normalizados (por ejemplo a ISO); test de dedupe por timestamp normalizado.  
- **Unit test agregación diaria:** Ya existe `buildDailyWindReport` / `aggregateWindByBucket` en `weatherUtils.test.ts`. Añadir un test que, dado un array de 24 observaciones horarias de un mismo día, devuelva 1 bucket con min/avg/max coherentes.  
- **Test de queryKey:** Test de integración o unit que verifique que el queryKey de useObservations incluye `granularity` y que al cambiar solo granularity se considera una nueva query (por ejemplo con un cliente React Query mock).

---

## 12. Ejemplos de timestamps y coherencia

- **Mock daily (7 días):**  
  Primero: `2024-02-01T00:00:00.000Z`, Medio: `2024-02-04T00:00:00.000Z`, Último: `2024-02-07T00:00:00.000Z`.  
  Coherente: un punto por día, step 24h.

- **Mock hourly (mismo rango):**  
  Primero: `2024-02-01T00:00:00.000Z`, Medio: `2024-02-04T12:00:00.000Z`, Último: `2024-02-07T23:00:00.000Z`.  
  Coherente: 7*24 = 168 puntos, step 1h.

- **Open-Meteo daily:** Formato típico "2024-02-01", "2024-02-02", ... (solo fecha). Coherente si el backend devuelve un punto por día; en cliente no se cambia a medianoche local explícitamente, pero el gráfico los mostrará como un punto por día.

- **Sospechoso:** Si con granularidad "Día" se obtienen 168 puntos con timestamps horarios, la petición o el backend están devolviendo hourly; hay que revisar params y respuesta (Network + debug logs).

---

*Fin del informe. Hallazgos detallados en `docs/data-audit-findings.json`. Script de diagnóstico en `scripts/dataDiagnostics.ts`.*
