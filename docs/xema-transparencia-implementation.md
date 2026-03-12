# XEMA / Transparencia Catalunya - Integracion actual

## Objetivo

Este documento describe la integracion vigente entre Meteo BCN y los datasets publicos de XEMA publicados en Socrata. Su foco es el estado real del codigo actual: modulos activos, contratos, datasets, flags de debug y puntos de verificacion.

## Modulos principales

| Archivo | Rol actual |
|--------|------------|
| `src/services/http/fetchJson.ts` | Cliente HTTP comun con timeout de 10 s, `retries = 2`, backoff exponencial y errores tipados |
| `src/services/http/socrata.ts` | Cliente SODA (`fetchSocrata`, `fetchSocrataAll`) sobre `https://analisi.transparenciacatalunya.cat` |
| `src/services/providers/xemaTransparencia.ts` | Fachada fina que reexporta estaciones y observaciones |
| `src/services/providers/xemaStations.ts` | Estaciones XEMA activas via `yqwd-vj5e` con fallback estatico |
| `src/services/providers/xemaObservations.ts` | Observaciones `30min` y `day`, validacion de parametros y mapping a `Observation[]` |
| `src/services/providers/xemaVariableMap.ts` | Codigos de variables usados por daily y subdaily, mas helper opcional de metadata |
| `src/hooks/useObservations.ts` | Traduce granularidad de UI a contrato del provider y ejecuta `logDataDebug()` |
| `src/lib/dataDebug.ts` | Auditoria opcional del dataset final (`VITE_DEBUG_DATA=1`) |
| `src/config/env.ts` | Parseo de `VITE_API_PROXY_URL`, `VITE_DEBUG_XEMA` y `VITE_DATA_MODE` |

## Contratos vigentes

### Fuente de datos

```ts
export type DataSource = 'xema-transparencia';
```

La etiqueta visible para UI y exportacion se construye desde `src/config/sources.ts`.

### Granularidad

- La UI trabaja con `Granularity = '30min' | 'daily'`.
- `useObservations()` traduce esa granularidad al contrato del provider:
  - `30min -> '30min'`
  - `daily -> 'day'`

Contrato del provider:

```ts
getObservations({
  stationId: string,
  from: Date,
  to: Date,
  granularity: '30min' | 'day',
}): Promise<Observation[]>
```

### Validacion de parametros

`xemaObservations.ts` valida:

- `stationId` con `/^[A-Za-z0-9]{1,10}$/`
- day keys con `/^\\d{4}-\\d{2}-\\d{2}$/`

Los errores invalidos se lanzan como `ProviderError` con `code: 'INVALID_PARAMS'`.

## Datasets y estrategia de consulta

### Estaciones: `yqwd-vj5e`

`fetchStationsFromSocrata()` consulta estaciones activas de la red XEMA con:

- `nom_xarxa = 'XEMA'`
- `codi_estat_ema = '2'`

Si la consulta falla o no devuelve resultados, el hook cae al fallback estatico de `listStations()`.

### Observaciones 30 min: `nzvn-apee`

`getObservations({ granularity: '30min' })` consulta `nzvn-apee` con estas variables:

- `T` (`32`)
- `HR` (`33`)
- `PPT` (`35`)
- `VV10` (`30`)
- `DV10` (`31`)
- `VVx10` (`50`)

Comportamiento actual:

- Se consulta `data_lectura` en el rango completo `fromDay 00:00:00 -> toDay 23:59:59`.
- El mapping agrupa por timestamp exacto devuelto por Socrata.
- La salida conserva detalle cada 30 minutos; no hay agregacion horaria intermedia en el codigo actual.

### Observaciones diarias: `7bvh-jvq2`

`getObservations({ granularity: 'day' })` consulta `7bvh-jvq2` con:

- `TM` (`1000`)
- `HRM` (`1100`)
- `PPT` (`1300`)
- `VVM10` (`1503`)
- `VVX10` (`1512`)

Ademas, hace una segunda consulta a `nzvn-apee` para `VVx10` y completa `windGustTime` en cada observacion diaria.

## Flujo de datos actual

1. `useStations()` carga metadata de estaciones y anade `source: 'xema-transparencia'`.
2. `useObservations()` construye la query key y valida que la fuente seleccionada sea XEMA.
3. `getObservations()` devuelve `Observation[]`.
4. `useObservations()` anade `dataSourceLabel` y dispara `logDataDebug()` cuando `VITE_DEBUG_DATA=1`.
5. `Index.tsx` usa ese array para KPIs, graficas, tabla, coverage y exportacion.
6. `useExcelExport()` recupera ambas granularidades y delega en `buildAndDownloadExcel()`.

## Debug y diagnostico

Los dos flags actuales tienen responsabilidades distintas y pueden activarse por separado:

| Variable | Que activa | Donde se usa |
|----------|------------|--------------|
| `VITE_DEBUG_XEMA` | Logs del provider XEMA y resumen de fetch subdaily | `src/config/env.ts`, `src/services/providers/xemaObservations.ts`, `Index.tsx` |
| `VITE_DEBUG_DATA` | Auditoria del dataset final (`stats`, timestamps, snapshot en `window.__DATA_DEBUG_SNAPSHOT`) | `src/lib/dataDebug.ts`, `src/hooks/useObservations.ts` |

Notas:

- `VITE_DEBUG_XEMA` solo se considera en desarrollo mediante `isXemaDebugEnabled()`.
- `VITE_DEBUG_DATA` se activa unicamente con el valor literal `1`.
- `VITE_DATA_MODE` existe en `env.ts`, pero el runtime actual no cambia de comportamiento por esa variable.

## Verificacion manual

1. Copia `.env.example` a `.env`.
2. Activa uno o ambos flags segun lo que quieras inspeccionar:
   - `VITE_DEBUG_XEMA=true`
   - `VITE_DEBUG_DATA=1`
3. Ejecuta `npm run dev`.
4. Selecciona una estacion XEMA y prueba ambas vistas:
   - `Datos 30 min`
   - `Diario`
5. Comprueba:
   - la etiqueta de fuente y estacion en la UI
   - la carga de graficas y tabla
   - los logs de debug esperados en consola
   - la exportacion Excel con las hojas `30min` y `Diario`

## Tests relacionados

| Archivo | Cobertura |
|--------|-----------|
| `src/services/providers/xemaStations.test.ts` | Estaciones y fallback |
| `src/services/providers/xemaTransparencia.test.ts` | Fachada y mapping principal |
| `src/hooks/useObservations.test.ts` | Coordinacion del hook y contrato de consulta |
| `src/lib/windVector.test.ts` | Utilidades de viento |
| `src/lib/exceedance.test.ts` | Intervalos de exceedance |

## Documentos relacionados

- [README.md](../README.md) para arranque y variables soportadas.
- [ARCHITECTURE.md](../ARCHITECTURE.md) para arquitectura general.
- [docs/README.md](README.md) para el mapa documental.
