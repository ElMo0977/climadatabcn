/**
 * XEMA (Transparència Catalunya) as main data source.
 * - Subdaily nzvn-apee: semi-hourly → aggregate to hourly (vectorial wind, sum precip).
 * - Daily 7bvh-jvq2: use directly (TM, HRM, PPT, VVM10vec, VVX10).
 */

import type { Observation } from '@/types/weather';
import { fetchSocrata } from '@/services/http/socrata';
import { SUBDAILY_CODES, DAILY_CODES } from './xemaVariableMap';
import { vectorialMeanWind } from '@/lib/windVector';

const RESOURCE_SUBDAILY = 'nzvn-apee';
const RESOURCE_DAILY = '7bvh-jvq2';

const MADRID_TZ = 'Europe/Madrid';

export type XemaGranularity = 'hour' | 'day';

export interface GetObservationsParams {
  stationId: string;
  from: Date;
  to: Date;
  granularity: XemaGranularity;
}

interface SubdailyRow {
  codi_estacio: string;
  codi_variable: string;
  data_lectura: string;
  valor_lectura: string;
  codi_estat?: string;
}

interface DailyRow {
  codi_estacio: string;
  nom_estacio?: string;
  data_lectura: string;
  codi_variable: string;
  valor: string;
  unitat?: string;
  estat?: string;
}

/** Barcelona area XEMA stations (codi_estacio). Lat/lon approximate. */
export const XEMA_STATIONS_BCN: { id: string; name: string; latitude: number; longitude: number; elevation: number | null }[] = [
  { id: 'D5', name: 'Barcelona - el Raval', latitude: 41.3797, longitude: 2.1682, elevation: 33 },
  { id: 'X2', name: 'Observatori Fabra', latitude: 41.4184, longitude: 2.1239, elevation: 411 },
  { id: 'X4', name: 'Barcelona - Zona Universitària', latitude: 41.3870, longitude: 2.1130, elevation: 81 },
  { id: 'X8', name: 'Barcelona - Barceloneta', latitude: 41.3850, longitude: 2.2010, elevation: 2 },
  { id: 'XL', name: 'El Prat de Llobregat', latitude: 41.2974, longitude: 2.0833, elevation: 6 },
];

/** Date/hour in Europe/Madrid from a Date (interpreted as UTC if from API). */
function toMadridBucketKey(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MADRID_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const y = get('year');
  const m = get('month');
  const day = get('day');
  const h = get('hour');
  return `${y}-${m}-${day}T${h}:00:00`;
}

function toMadridDateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MADRID_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseApiDate(s: string): Date {
  return new Date(s.endsWith('Z') ? s : s + 'Z');
}

export function listStations(): { id: string; name: string; latitude: number; longitude: number; elevation: number | null }[] {
  return [...XEMA_STATIONS_BCN];
}

/**
 * Fetch subdaily (nzvn-apee) and aggregate to hourly buckets (Europe/Madrid).
 * Variables: T(32), HR(33), PPT(35), VV10(30), DV10(31), VVx10(50), DVVx10(51).
 */
async function fetchHourlyObservations(
  stationId: string,
  from: Date,
  to: Date
): Promise<Observation[]> {
  const fromStr = from.toISOString().slice(0, 19);
  const toStr = to.toISOString().slice(0, 19);
  const vars = [SUBDAILY_CODES.T, SUBDAILY_CODES.HR, SUBDAILY_CODES.PPT, SUBDAILY_CODES.VV10, SUBDAILY_CODES.DV10, SUBDAILY_CODES.VVx10, SUBDAILY_CODES.DVVx10];
  const where = `codi_estacio = '${stationId}' and data_lectura >= '${fromStr}' and data_lectura <= '${toStr}' and codi_variable in (${vars.join(',')}) and (codi_estat = 'V' or codi_estat is null)`;
  const rows = await fetchSocrata<SubdailyRow[]>(RESOURCE_SUBDAILY, {
    $select: 'codi_estacio,codi_variable,data_lectura,valor_lectura',
    $where: where,
    $order: 'data_lectura asc',
    $limit: 50000,
  });

  // Group by exact data_lectura first so we can pair VV10 with DV10
  const byTimestamp = new Map<
    string,
    { T?: number; HR?: number; PPT?: number; VV10?: number; DV10?: number; VVx10?: number }
  >();
  for (const r of rows) {
    const val = parseFloat(r.valor_lectura);
    if (Number.isNaN(val)) continue;
    const ts = r.data_lectura;
    let row = byTimestamp.get(ts);
    if (!row) {
      row = {};
      byTimestamp.set(ts, row);
    }
    switch (r.codi_variable) {
      case SUBDAILY_CODES.T:
        row.T = val;
        break;
      case SUBDAILY_CODES.HR:
        row.HR = val;
        break;
      case SUBDAILY_CODES.PPT:
        row.PPT = val;
        break;
      case SUBDAILY_CODES.VV10:
        row.VV10 = val;
        break;
      case SUBDAILY_CODES.DV10:
        row.DV10 = val;
        break;
      case SUBDAILY_CODES.VVx10:
        row.VVx10 = val;
        break;
      default:
        break;
    }
  }

  const byBucket = new Map<
    string,
    {
      temps: number[];
      hums: number[];
      precips: number[];
      windSpeedDir: { speed: number; dir: number }[];
      gusts: number[];
    }
  >();

  for (const [ts, row] of byTimestamp) {
    const dt = parseApiDate(ts);
    const key = toMadridBucketKey(dt);
    let b = byBucket.get(key);
    if (!b) {
      b = { temps: [], hums: [], precips: [], windSpeedDir: [], gusts: [] };
      byBucket.set(key, b);
    }
    if (row.T != null) b.temps.push(row.T);
    if (row.HR != null) b.hums.push(row.HR);
    if (row.PPT != null) b.precips.push(row.PPT);
    if (row.VV10 != null) b.windSpeedDir.push({ speed: row.VV10, dir: row.DV10 ?? 0 });
    if (row.VVx10 != null) b.gusts.push(row.VVx10);
  }

  if (import.meta.env.VITE_DEBUG_DATA === '1') {
    const samplesPerBucket = Array.from(byBucket.entries()).map(([k, b]) => ({
      bucket: k,
      n: byTimestamp.size ? Math.round(byTimestamp.size / Math.max(1, byBucket.size)) : 0,
      temps: b.temps.length,
      windPairs: b.windSpeedDir.length,
      gusts: b.gusts.length,
    }));
    console.group('[XEMA hourly] subdaily samples per bucket');
    console.log('nBuckets', byBucket.size, 'nTimestamps', byTimestamp.size, 'samplesPerBucket sample', samplesPerBucket.slice(0, 3));
    console.groupEnd();
  }

  const observations: Observation[] = [];
  const sortedKeys = Array.from(byBucket.keys()).sort();
  for (const key of sortedKeys) {
    const b = byBucket.get(key)!;
    const temp = b.temps.length ? b.temps.reduce((a, x) => a + x, 0) / b.temps.length : null;
    const humidity = b.hums.length ? b.hums.reduce((a, x) => a + x, 0) / b.hums.length : null;
    const precipitation = b.precips.length ? b.precips.reduce((a, x) => a + x, 0) : null;
    const windVector = vectorialMeanWind(b.windSpeedDir);
    const windSpeed = windVector?.speed ?? null;
    const windMax = b.gusts.length ? Math.max(...b.gusts) : null;
    observations.push({
      timestamp: key,
      temperature: temp != null ? Math.round(temp * 10) / 10 : null,
      humidity: humidity != null ? Math.round(humidity) : null,
      windSpeed,
      windSpeedMin: null,
      windSpeedMax: windMax != null ? Math.round(windMax * 10) / 10 : null,
      precipitation: precipitation != null ? Math.round(precipitation * 10) / 10 : null,
    });
  }
  return observations;
}

/**
 * Fetch daily (7bvh-jvq2): TM(1000), HRM(1100), PPT(1300), VVM10vec(1500), VVX10(1512).
 */
async function fetchDailyObservations(
  stationId: string,
  from: Date,
  to: Date
): Promise<Observation[]> {
  const fromStr = from.toISOString().slice(0, 10) + 'T00:00:00';
  const toStr = to.toISOString().slice(0, 10) + 'T23:59:59';
  const vars = [DAILY_CODES.TM, DAILY_CODES.HRM, DAILY_CODES.PPT, DAILY_CODES.VVM10vec, DAILY_CODES.VVM10, DAILY_CODES.VVX10];
  const where = `codi_estacio = '${stationId}' and data_lectura >= '${fromStr}' and data_lectura <= '${toStr}' and codi_variable in (${vars.join(',')})`;
  const rows = await fetchSocrata<DailyRow[]>(RESOURCE_DAILY, {
    $select: 'codi_estacio,data_lectura,codi_variable,valor',
    $where: where,
    $order: 'data_lectura asc',
    $limit: 5000,
  });

  const byDay = new Map<string, Partial<Observation>>();
  for (const r of rows) {
    const day = r.data_lectura.slice(0, 10);
    let row = byDay.get(day);
    if (!row) {
      row = { timestamp: day, temperature: null, humidity: null, windSpeed: null, windSpeedMin: null, windSpeedMax: null, precipitation: null };
      byDay.set(day, row);
    }
    const val = parseFloat(r.valor);
    if (Number.isNaN(val)) continue;
    switch (r.codi_variable) {
      case DAILY_CODES.TM:
        row.temperature = Math.round(val * 10) / 10;
        break;
      case DAILY_CODES.HRM:
        row.humidity = Math.round(val);
        break;
      case DAILY_CODES.PPT:
        row.precipitation = Math.round(val * 10) / 10;
        break;
      case DAILY_CODES.VVM10vec:
      case DAILY_CODES.VVM10:
        if (row.windSpeed == null) row.windSpeed = Math.round(val * 10) / 10;
        break;
      case DAILY_CODES.VVX10:
        row.windSpeedMax = Math.round(val * 10) / 10;
        break;
      default:
        break;
    }
  }

  return Array.from(byDay.keys())
    .sort()
    .map((day) => {
      const row = byDay.get(day)!;
      return {
        timestamp: day,
        temperature: row.temperature ?? null,
        humidity: row.humidity ?? null,
        windSpeed: row.windSpeed ?? null,
        windSpeedMin: row.windSpeedMin ?? null,
        windSpeedMax: row.windSpeedMax ?? null,
        precipitation: row.precipitation ?? null,
      } as Observation;
    });
}

export async function getObservations(params: GetObservationsParams): Promise<Observation[]> {
  const { stationId, from, to, granularity } = params;
  if (granularity === 'hour') {
    return fetchHourlyObservations(stationId, from, to);
  }
  return fetchDailyObservations(stationId, from, to);
}
