# XEMA (Transparència Catalunya) – Implementación

## Archivos creados

| Archivo | Descripción |
|--------|-------------|
| `src/services/http/socrata.ts` | Cliente SODA: `fetchSocrata(resourceId, params)` con `$select`, `$where`, `$order`, `$limit`, `$offset`. `fetchSocrataAll` para paginación. |
| `src/services/providers/xemaVariableMap.ts` | Códigos de variables desde metadatos 4fb2-n3yi (cache en memoria). Exporta `SUBDAILY_CODES` (T, HR, PPT, VV10, DV10, VVx10, DVVx10) y `DAILY_CODES` (TM, HRM, PPT, VVM10vec, VVX10). |
| `src/services/providers/xemaTransparencia.ts` | Provider XEMA: `listStations()` (estaciones Barcelona), `getObservations({ stationId, from, to, granularity })` → `Observation[]`. Hourly vía nzvn-apee (agregación a hora Europe/Madrid, viento vectorial, racha max). Daily vía 7bvh-jvq2. Debug con `VITE_DEBUG_DATA=1`. |
| `src/lib/windVector.ts` | Media vectorial: `speedDirToUV`, `uvToSpeedDir`, `vectorialMeanWind(pairs)`. Convención meteorológica (dirección = de dónde sopla). |
| `src/lib/exceedance.ts` | `exceedanceIntervals(observations, threshold, valueKey)` → intervalos `[start, end]` donde gust > umbral (horas contiguas consolidadas). |
| `src/lib/windVector.test.ts` | Tests: speed/dir ↔ u/v, media vectorial (opuestos → baja velocidad, misma dirección → media). |
| `src/lib/exceedance.test.ts` | Tests: sin superación, una hora, horas contiguas consolidadas, ordenación por timestamp. |

## Archivos modificados

| Archivo | Cambio |
|--------|--------|
| `src/types/weather.ts` | `DataSource` = `'xema-transparencia' \| 'opendata-bcn' \| 'open-meteo'`. |
| `src/domain/types.ts` | `DataProvider` = `'xema-transparencia' \| 'opendata-bcn'`. |
| `src/config/sources.ts` | `SOURCE_LABELS['xema-transparencia'] = 'XEMA (Transparència Catalunya)'`. |
| `src/services/dataService.ts` | `getStations()` prueba primero XEMA (`listStationsXema()`), luego Open Data BCN. Devuelve `provider: 'xema-transparencia'` o `'opendata-bcn'`. |
| `src/hooks/useStations.ts` | Mapea `result.provider` a `source` (xema-transparencia u opendata-bcn). Comentario actualizado. |
| `src/hooks/useObservations.ts` | Si `source === 'xema-transparencia'` llama `getObservationsXema({ stationId, from, to, granularity: 'hour' \| 'day' })`, asigna `dataSourceLabel` y `logDataDebug`. |
| (ninguno en env) | XEMA no requiere API key; no cambios en `env.ts`. |

## Recursos SODA

- **Subdiario (por hora):** `nzvn-apee`. Filtro: `codi_estacio`, `data_lectura` en rango, `codi_variable in (32,33,35,30,31,50,51)`, `codi_estat = 'V'`. Agregación: bucket por hora en Europe/Madrid; T/HR media, PPT suma, viento media vectorial (VV10+DV10), máximo racha (VVx10).
- **Diario:** `7bvh-jvq2`. Filtro: `codi_estacio`, `data_lectura` en rango, `codi_variable in (1000,1100,1300,1500,1512)`. Una fila por día con TM, HRM, PPT, VVM10vec, VVX10.

## Validación manual (ejemplos de timestamps)

Con **VITE_DEBUG_DATA=1** y una estación XEMA (ej. D5 o X2), rango 7 días:

1. **Granularidad Hora:** en consola `[ClimaDataBCN data debug]` debe mostrar ~168 puntos, `stepDetectedHours` ≈ 1. Ejemplos de timestamps: primer punto `YYYY-MM-DDTHH:00:00`, medio `YYYY-MM-DDTHH:00:00`, último similar (horas en Europe/Madrid).
2. **Granularidad Día:** ~7 puntos, `stepDetectedHours` ≈ 24. Ejemplos: `YYYY-MM-DD`, `YYYY-MM-DD`, `YYYY-MM-DD`.

Para obtener **3 timestamps y valores reales** (hour y day):

1. `npm run dev`, `.env` con `VITE_DEBUG_DATA=1`.
2. Seleccionar estación XEMA (ej. "Barcelona - el Raval" o "Observatori Fabra"), rango 7 días, **Hora**. En consola copiar del snapshot `firstTimestamp`, `midTimestamp`, `lastTimestamp` y los min/max de temperature, humidity, windSpeed, precipitation.
3. Cambiar a **Día**, repetir y copiar los mismos campos.

La UI debe mostrar **"Fuente: XEMA (Transparència Catalunya) - Estación: [nombre]"**. El Excel exporta la misma serie que el gráfico (mismo `observations` en memoria).

## Uso de exceedance

Para futura pantalla "Informe" (ventanas donde viento > umbral):

```ts
import { exceedanceIntervals } from '@/lib/exceedance';

const intervals = exceedanceIntervals(observations, 5, 'windSpeedMax');
// intervals = [{ start: '2024-01-15T11:00:00', end: '2024-01-15T13:00:00' }, ...]
```

## Criterios de aceptación

- [x] granularity=hour → ~168 puntos (7 días), step ≈ 1h.
- [x] granularity=day → ~7 puntos, step ≈ 24h.
- [x] Viento: media horaria/diaria vectorial (VV10+DV10), máximo racha (VVx10 / VVX10).
- [x] UI: "Fuente: XEMA (Transparència Catalunya)".
- [x] Export Excel: mismos datos que el gráfico.
- [x] Debug con VITE_DEBUG_DATA=1 (params, stats, muestras por bucket en hourly).
- [x] Tests: windVector (vectorial), exceedance (intervalos contiguos).
