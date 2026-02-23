// Implementation of the XEMA Transparència provider for Climadatabcn.
//
// This module exposes the functions expected by the rest of the application to
// interact with the open data portal of the Catalan XEMA network via the
// Transparència Catalunya API.  The functions here are referenced by hooks
// such as `useStations` and `useObservations` and must therefore exist for
// TypeScript to compile successfully.  See docs/xema-transparencia-implementation.md
// for an overview of the intended architecture【393582075062202†L309-L316】.

import type {
  Station,
} from '@/domain/types';
import type { Observation } from '@/types/weather';
import { DAILY_CODES, SUBDAILY_CODES } from './xemaVariableMap';
import { fetchSocrata, fetchSocrataAll } from '@/services/http/socrata';

/**
 * Rows returned from the daily observations dataset on Socrata.
 *
 * The daily resource (`7bvh-jvq2`) returns one row per station, date and
 * variable.  For wind variables we expect two codes: the average wind
 * (VVM10) and the maximum wind (VVX10).  Other variables could be added
 * later.  See tests in xemaTransparencia.test.ts for expected behaviour【722853613526413†L10-L33】.
 */
export interface DailyRow {
  codi_estacio: string;
  data_lectura: string;
  codi_variable: string;
  valor?: string;
  valor_lectura?: string;
}

interface SubdailyRow {
  codi_estacio: string;
  data_lectura: string;
  codi_variable: string;
  valor_lectura: string;
  codi_estat?: string;
}

/**
 * Return a list of XEMA stations with minimal metadata.  This is a stub
 * implementation that returns a hard-coded list so that the application
 * compiles.  In a future iteration this should call fetchStationsFromSocrata()
 * and persist the results in a cache【393582075062202†L309-L316】.
 */
export function listStations(): Station[] {
  // This stub returns a static list of stations in and around Barcelona.  When
  // the Socrata metadata API becomes stable we should fetch and cache the
  // result instead.  Returning a synchronous array is important because
  // dataService.getStations() expects to synchronously map over the list【330959716576808†L15-L30】.
  return [
    {
      id: 'bcn-raval',
      name: 'Barcelona - El Raval',
      provider: 'xema-transparencia',
      latitude: 41.3797,
      longitude: 2.1682,
      elevation: 33,
    },
    {
      id: 'bcn-zoo',
      name: 'Barcelona - Zona Universitària',
      provider: 'xema-transparencia',
      latitude: 41.3870,
      longitude: 2.1130,
      elevation: 85,
    },
    {
      id: 'bcn-fabra',
      name: 'Observatori Fabra',
      provider: 'xema-transparencia',
      latitude: 41.4184,
      longitude: 2.1239,
      elevation: 411,
    },
    {
      id: 'bcn-port',
      name: 'Barcelona - Port Olímpic',
      provider: 'xema-transparencia',
      latitude: 41.3850,
      longitude: 2.2010,
      elevation: 5,
    },
    {
      id: 'bcn-eixample',
      name: 'Barcelona - Eixample',
      provider: 'xema-transparencia',
      latitude: 41.3930,
      longitude: 2.1620,
      elevation: 45,
    },
    {
      id: 'bcn-gracia',
      name: 'Barcelona - Gràcia',
      provider: 'xema-transparencia',
      latitude: 41.4036,
      longitude: 2.1532,
      elevation: 120,
    },
    {
      id: 'bcn-airport',
      name: 'Aeropuerto El Prat',
      provider: 'xema-transparencia',
      latitude: 41.2974,
      longitude: 2.0833,
      elevation: 4,
    },
    {
      id: 'badalona',
      name: 'Badalona',
      provider: 'xema-transparencia',
      latitude: 41.4500,
      longitude: 2.2474,
      elevation: 20,
    },
    {
      id: 'hospitalet',
      name: "L'Hospitalet de Llobregat",
      provider: 'xema-transparencia',
      latitude: 41.3596,
      longitude: 2.1000,
      elevation: 25,
    },
    {
      id: 'sant-cugat',
      name: 'Sant Cugat del Vallès',
      provider: 'xema-transparencia',
      latitude: 41.4722,
      longitude: 2.0864,
      elevation: 180,
    },
    {
      id: 'montjuic',
      name: 'Barcelona - Montjuïc',
      provider: 'xema-transparencia',
      latitude: 41.3639,
      longitude: 2.1586,
      elevation: 173,
    },
    {
      id: 'tibidabo',
      name: 'Barcelona - Tibidabo',
      provider: 'xema-transparencia',
      latitude: 41.4225,
      longitude: 2.1189,
      elevation: 512,
    },
  ];
}

/**
 * Fetch station metadata from Socrata. Transparència Catalunya exposes
 * XEMA stations metadata through resource `yqwd-vj5e`. This function returns
 * an array of objects containing the fields used by listStations().  Missing
 * numeric values are converted to numbers when present.
 */
export async function fetchStationsFromSocrata(): Promise<
  {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    elevation?: number;
    municipality?: string;
  }[]
> {
  const RESOURCE_ID = 'yqwd-vj5e';
  try {
    const rows = await fetchSocrata<any[]>(RESOURCE_ID, {
      $select: 'codi_estacio,nom_estacio,latitud,longitud,altitud,nom_municipi,codi_estat_ema,nom_xarxa',
      $where: "nom_xarxa = 'XEMA' AND codi_estat_ema = '2'",
      $limit: 2000,
      $order: 'nom_estacio ASC',
    });

    const stations = rows
      .filter((row) => row.codi_estacio && row.latitud && row.longitud)
      .map((row) => ({
        id: row.codi_estacio,
        name: row.nom_estacio,
        latitude: Number(row.latitud),
        longitude: Number(row.longitud),
        elevation: row.altitud ? Number(row.altitud) : undefined,
        municipality: row.nom_municipi,
      }));
    // If the call returns no stations (or we queried a wrong resource), fall
    // back to the static list to ensure the UI always has at least some data
    //【330959716576808†L15-L30】.
    if (stations.length === 0) {
      return listStations().map((s) => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        elevation: s.elevation ?? undefined,
        municipality: undefined,
      }));
    }
    return stations;
  } catch (error) {
    // On any error (network, API), log and fall back to the static list to avoid
    // an empty station list in the UI.
    console.warn('[xemaTransparencia] fetchStationsFromSocrata failed:', error);
    return listStations().map((s) => ({
      id: s.id,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      elevation: s.elevation ?? undefined,
      municipality: undefined,
    }));
  }
}

/**
 * Fetch time series observations for a station between two dates from
 * Transparència Socrata resources: subdaily (`nzvn-apee`) and daily (`7bvh-jvq2`).
 */
export async function getObservations(params: {
  stationId: string;
  from: Date;
  to: Date;
  granularity: '30min' | 'day';
}): Promise<Observation[]> {
  const fromDay = params.from.toISOString().slice(0, 10);
  const toDay = params.to.toISOString().slice(0, 10);

  if (params.granularity === 'day') {
    const rows = await fetchSocrataAll<DailyRow>('7bvh-jvq2', {
      $select: 'codi_estacio,data_lectura,codi_variable,valor',
      $where: `codi_estacio = '${params.stationId}' AND data_lectura >= '${fromDay}T00:00:00' AND data_lectura <= '${toDay}T23:59:59' AND codi_variable in ('${DAILY_CODES.TM}','${DAILY_CODES.HRM}','${DAILY_CODES.PPT}','${DAILY_CODES.VVM10}','${DAILY_CODES.VVX10}')`,
      $order: 'data_lectura ASC',
      $limit: 5000,
    });

    return mapDailyRowsToObservations(rows);
  }

  const rows = await fetchSocrataAll<SubdailyRow>('nzvn-apee', {
    $select: 'codi_estacio,data_lectura,codi_variable,valor_lectura,codi_estat',
    $where: `codi_estacio = '${params.stationId}' AND data_lectura >= '${fromDay}T00:00:00' AND data_lectura <= '${toDay}T23:59:59' AND codi_variable in ('${SUBDAILY_CODES.T}','${SUBDAILY_CODES.HR}','${SUBDAILY_CODES.PPT}','${SUBDAILY_CODES.VV10}','${SUBDAILY_CODES.DV10}','${SUBDAILY_CODES.VVx10}') AND codi_estat = 'V'`,
    $order: 'data_lectura ASC',
    $limit: 50000,
  });

  return mapSubdailyRowsToObservations(rows);
}

/**
 * Build inclusive bounds for a range of dates at daily resolution.  The
 * returned object contains ISO strings representing the start and end day
 * (YYYY-MM-DD) and is used to filter daily observations【722853613526413†L52-L89】.
 */
export function buildDailyRangeBounds(from: Date, to: Date) {
  const fromDay = from.toISOString().slice(0, 10);
  const toDay = to.toISOString().slice(0, 10);
  return { fromDay, toDay };
}

/**
 * Filter daily observations to those within the inclusive range defined by
 * buildDailyRangeBounds().  Observations outside the range are dropped【722853613526413†L52-L89】.
 */
export function filterDailyObservationsByRange<T extends { timestamp: string }>(
  observations: T[],
  bounds: { fromDay: string; toDay: string },
): T[] {
  return observations.filter(
    (o) => o.timestamp >= bounds.fromDay && o.timestamp <= bounds.toDay,
  );
}

/**
 * Group daily rows into observation objects keyed by date.  For each date,
 * we maintain separate fields for the mean wind speed (`windSpeed`) and the
 * maximum wind speed (`windSpeedMax`).  Only variables defined in DAILY_CODES
 * are considered.  See the tests for expected behaviour: missing values are
 * left as null and not backfilled【722853613526413†L10-L33】.
 */
export function mapDailyRowsToObservations(rows: DailyRow[]) {
  const byDate: Record<
    string,
    {
      temperature: number | null;
      humidity: number | null;
      precipitation: number | null;
      windSpeed: number | null;
      windSpeedMax: number | null;
      windGustTime: string | null;
    }
  > = {};
  rows.forEach((row) => {
    const date = row.data_lectura.slice(0, 10);
    if (!byDate[date]) {
      byDate[date] = {
        temperature: null,
        humidity: null,
        precipitation: null,
        windSpeed: null,
        windSpeedMax: null,
        windGustTime: null,
      };
    }

    const value = parseRowNumericValue(row);
    const parsedValue = Number.isFinite(value) ? value : null;

    if (row.codi_variable === DAILY_CODES.TM) {
      byDate[date].temperature = parsedValue;
    } else if (row.codi_variable === DAILY_CODES.HRM) {
      byDate[date].humidity = parsedValue;
    } else if (row.codi_variable === DAILY_CODES.PPT) {
      byDate[date].precipitation = parsedValue;
    } else if (row.codi_variable === DAILY_CODES.VVM10) {
      byDate[date].windSpeed = parsedValue;
    } else if (row.codi_variable === DAILY_CODES.VVX10) {
      byDate[date].windSpeedMax = parsedValue;
      byDate[date].windGustTime = null;
    }
  });
  return Object.entries(byDate).map(([timestamp, values]) => ({
    timestamp,
    temperature: values.temperature,
    humidity: values.humidity,
    ...values,
    windDirection: null,
  }));
}

function parseRowNumericValue(row: { valor?: string; valor_lectura?: string }): number {
  const raw = row.valor ?? row.valor_lectura ?? '';
  return Number.parseFloat(raw);
}

export function mapSubdailyRowsToObservations(rows: SubdailyRow[]): Observation[] {
  const byTimestamp: Record<string, Observation> = {};

  rows.forEach((row) => {
    const ts = row.data_lectura;
    if (!byTimestamp[ts]) {
      byTimestamp[ts] = {
        timestamp: ts,
        temperature: null,
        humidity: null,
        windSpeed: null,
        windSpeedMax: null,
        windDirection: null,
        precipitation: null,
      };
    }

    const value = Number.parseFloat(row.valor_lectura);
    const parsedValue = Number.isFinite(value) ? value : null;
    const base = byTimestamp[ts];

    if (row.codi_variable === SUBDAILY_CODES.T) {
      base.temperature = parsedValue;
    } else if (row.codi_variable === SUBDAILY_CODES.HR) {
      base.humidity = parsedValue;
    } else if (row.codi_variable === SUBDAILY_CODES.PPT) {
      base.precipitation = parsedValue;
    } else if (row.codi_variable === SUBDAILY_CODES.VV10) {
      base.windSpeed = parsedValue;
    } else if (row.codi_variable === SUBDAILY_CODES.DV10) {
      base.windDirection = parsedValue;
    } else if (row.codi_variable === SUBDAILY_CODES.VVx10) {
      base.windSpeedMax = parsedValue;
    }
  });

  return Object.values(byTimestamp).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
