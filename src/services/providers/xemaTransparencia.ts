/**
 * XEMA (Transparència Catalunya) – Socrata provider.
 * - Subdaily nzvn-apee: raw 30-min rows (codi_base=SH).
 * - Daily 7bvh-jvq2: daily statistics.
 * - Stations yqwd-vj5e: dynamic station list.
 */

import type { Observation } from '@/types/weather';
import { fetchSocrata } from '@/services/http/socrata';
import { SUBDAILY_CODES, DAILY_CODES } from './xemaVariableMap';

const RESOURCE_SUBDAILY = 'nzvn-apee';
const RESOURCE_DAILY = '7bvh-jvq2';
const RESOURCE_STATIONS = 'yqwd-vj5e';

const MADRID_TZ = 'Europe/Madrid';

export type XemaGranularity = '30min' | 'day';

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

export interface DailyRow {
  codi_estacio: string;
  nom_estacio?: string;
  data_lectura: string;
  codi_variable: string;
  valor_lectura?: string;
  valor?: string;
  unitat?: string;
  estat?: string;
  representativitat?: string;
  hora_extrem?: string;
  data_extrem?: string;
  [key: string]: string | undefined;
}

interface SocrataStationRow {
  codi_estacio: string;
  nom_estacio: string;
  latitud: string;
  longitud: string;
  altitud?: string;
  nom_municipi?: string;
  nom_comarca?: string;
  nom_provincia?: string;
  codi_estat?: string;
  [key: string]: string | undefined;
}

// ── Station cache ──
let stationsCache: { id: string; name: string; latitude: number; longitude: number; elevation: number | null; municipality?: string }[] | null = null;
let stationsCacheTime = 0;
const STATIONS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

/** Hardcoded fallback for Barcelona area */
const XEMA_STATIONS_BCN_FALLBACK = [
  { id: 'D5', name: 'Barcelona - el Raval', latitude: 41.3797, longitude: 2.1682, elevation: 33 },
  { id: 'X2', name: 'Observatori Fabra', latitude: 41.4184, longitude: 2.1239, elevation: 411 },
  { id: 'X4', name: 'Barcelona - Zona Universitària', latitude: 41.3870, longitude: 2.1130, elevation: 81 },
  { id: 'X8', name: 'Barcelona - Barceloneta', latitude: 41.3850, longitude: 2.2010, elevation: 2 },
  { id: 'XL', name: 'El Prat de Llobregat', latitude: 41.2974, longitude: 2.0833, elevation: 6 },
];

/**
 * Fetch stations from Socrata yqwd-vj5e (cached 24h).
 * Falls back to hardcoded list on error.
 */
export async function fetchStationsFromSocrata(): Promise<typeof XEMA_STATIONS_BCN_FALLBACK & { municipality?: string }[]> {
  if (stationsCache && Date.now() - stationsCacheTime < STATIONS_CACHE_TTL) {
    return stationsCache;
  }
  try {
    const rows = await fetchSocrata<SocrataStationRow[]>(RESOURCE_STATIONS, {
      $select: 'codi_estacio,nom_estacio,latitud,longitud,altitud,nom_municipi,codi_estat',
      $where: "codi_estat = 'OPE'", // only operational
      $limit: 500,
    });
    if (rows.length === 0) throw new Error('No stations returned');
    const parsed = rows
      .filter((r) => r.latitud && r.longitud)
      .map((r) => ({
        id: r.codi_estacio,
        name: r.nom_estacio,
        latitude: parseFloat(r.latitud),
        longitude: parseFloat(r.longitud),
        elevation: r.altitud ? parseFloat(r.altitud) : null,
        municipality: r.nom_municipi ?? undefined,
      }))
      .filter((s) => !Number.isNaN(s.latitude) && !Number.isNaN(s.longitude));
    stationsCache = parsed;
    stationsCacheTime = Date.now();
    return parsed;
  } catch (e) {
    console.warn('[XEMA] Failed to fetch stations from Socrata, using fallback:', e);
    return XEMA_STATIONS_BCN_FALLBACK.map((s) => ({ ...s, municipality: undefined }));
  }
}

/** Sync list (returns cache or fallback). For backwards compat. */
export function listStations() {
  if (stationsCache && Date.now() - stationsCacheTime < STATIONS_CACHE_TTL) {
    return stationsCache;
  }
  return XEMA_STATIONS_BCN_FALLBACK.map((s) => ({ ...s, municipality: undefined }));
}

// ── Timezone helpers ──

function toMadridLocalISO(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MADRID_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00`;
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

/**
 * Convert a UTC hour string (e.g. "14:30Z" or "1430") to Europe/Madrid local time.
 */
function utcHourToMadrid(utcHour: string, refDate: Date): string {
  try {
    // Try to parse various formats
    const cleaned = utcHour.replace(/[^0-9:]/g, '');
    let h: number, m: number;
    if (cleaned.includes(':')) {
      const [hh, mm] = cleaned.split(':');
      h = parseInt(hh, 10);
      m = parseInt(mm, 10);
    } else if (cleaned.length >= 4) {
      h = parseInt(cleaned.slice(0, 2), 10);
      m = parseInt(cleaned.slice(2, 4), 10);
    } else {
      return utcHour;
    }
    if (Number.isNaN(h) || Number.isNaN(m)) return utcHour;
    const d = new Date(refDate);
    d.setUTCHours(h, m, 0, 0);
    const formatter = new Intl.DateTimeFormat('es-ES', {
      timeZone: MADRID_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(d);
  } catch {
    return utcHour;
  }
}

// ── 30-min raw data ──

/**
 * Fetch 30-min data (nzvn-apee, codi_base=SH). Returns raw rows pivoted to wide format.
 * Variables: T(32), HR(33), PPT(35), VV10(30), DV10(31), VVx10(50).
 */
async function fetch30minObservations(
  stationId: string,
  from: Date,
  to: Date,
): Promise<Observation[]> {
  const fromStr = from.toISOString().slice(0, 19);
  const toStr = to.toISOString().slice(0, 19);
  const vars = [
    SUBDAILY_CODES.T, SUBDAILY_CODES.HR, SUBDAILY_CODES.PPT,
    SUBDAILY_CODES.VV10, SUBDAILY_CODES.DV10, SUBDAILY_CODES.VVx10,
  ];
  const varsIn = vars.map((v) => `'${v}'`).join(',');
  const where = `codi_estacio = '${stationId}' and codi_base = 'SH' and data_lectura >= '${fromStr}' and data_lectura <= '${toStr}' and codi_variable in (${varsIn}) and (codi_estat = 'V' or codi_estat is null)`;

  const rows = await fetchSocrata<SubdailyRow[]>(RESOURCE_SUBDAILY, {
    $select: 'codi_estacio,codi_variable,data_lectura,valor_lectura',
    $where: where,
    $order: 'data_lectura asc',
    $limit: 50000,
  });

  // Pivot: group by data_lectura → one wide row per timestamp
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
      case SUBDAILY_CODES.T: row.T = val; break;
      case SUBDAILY_CODES.HR: row.HR = val; break;
      case SUBDAILY_CODES.PPT: row.PPT = val; break;
      case SUBDAILY_CODES.VV10: row.VV10 = val; break;
      case SUBDAILY_CODES.DV10: row.DV10 = val; break;
      case SUBDAILY_CODES.VVx10: row.VVx10 = val; break;
    }
  }

  const observations: Observation[] = [];
  const sortedKeys = Array.from(byTimestamp.keys()).sort();
  for (const ts of sortedKeys) {
    const r = byTimestamp.get(ts)!;
    const dt = parseApiDate(ts);
    const localTs = toMadridLocalISO(dt);
    observations.push({
      timestamp: localTs,
      temperature: r.T != null ? Math.round(r.T * 10) / 10 : null,
      humidity: r.HR != null ? Math.round(r.HR) : null,
      windSpeed: r.VV10 != null ? Math.round(r.VV10 * 10) / 10 : null,
      windSpeedMax: r.VVx10 != null ? Math.round(r.VVx10 * 10) / 10 : null,
      windDirection: r.DV10 != null ? Math.round(r.DV10) : null,
      precipitation: r.PPT != null ? Math.round(r.PPT * 10) / 10 : null,
    });
  }
  return observations;
}

// ── Daily data ──

/**
 * Fetch daily stats (7bvh-jvq2).
 * Variables: TM(1000), HRM(1100), PPT(1300), VVM10esc(1503), VVX10(1512).
 * Uses scalar wind mean (1503). Extracts gust time from hora_extrem/data_extrem fields.
 */
async function fetchDailyObservations(
  stationId: string,
  from: Date,
  to: Date,
): Promise<Observation[]> {
  const fromStr = from.toISOString().slice(0, 10) + 'T00:00:00';
  const toStr = to.toISOString().slice(0, 10) + 'T23:59:59';
  const vars = [DAILY_CODES.TM, DAILY_CODES.HRM, DAILY_CODES.PPT, DAILY_CODES.VVM10, DAILY_CODES.VVX10];
  const varsIn = vars.map((v) => `'${v}'`).join(',');
  const where = `codi_estacio = '${stationId}' and data_lectura >= '${fromStr}' and data_lectura <= '${toStr}' and codi_variable in (${varsIn})`;

  const rows = await fetchSocrata<DailyRow[]>(RESOURCE_DAILY, {
    $where: where,
    $order: 'data_lectura asc',
    $limit: 50000,
  });

  return mapDailyRowsToObservations(rows);
}

/**
 * Maps 7bvh-jvq2 daily rows to app observations.
 * Contract:
 * - windSpeed: daily mean wind (VVM10 / 1503) only.
 * - windSpeedMax: daily maximum gust (VVX10 / 1512) only.
 */
export function mapDailyRowsToObservations(rows: DailyRow[]): Observation[] {
  // Inspect first row to detect field names
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test' && rows.length > 0) {
    console.log('[XEMA daily] sample row fields:', Object.keys(rows[0]), rows[0]);
  }

  const byDay = new Map<string, {
    temperature: number | null;
    humidity: number | null;
    windSpeed: number | null;
    windSpeedMax: number | null;
    windGustTime: string | null;
    precipitation: number | null;
  }>();

  for (const r of rows) {
    const day = r.data_lectura.slice(0, 10);
    if (!byDay.has(day)) {
      byDay.set(day, {
        temperature: null, humidity: null, windSpeed: null,
        windSpeedMax: null, windGustTime: null, precipitation: null,
      });
    }
    const row = byDay.get(day)!;
    // Auto-detect value field
    const rawVal = r.valor_lectura ?? r.valor ?? r['valor_lectura'] ?? null;
    if (rawVal == null) continue;
    const val = parseFloat(rawVal);
    if (Number.isNaN(val)) continue;

    const refDate = parseApiDate(r.data_lectura);

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
      case DAILY_CODES.VVM10:
        // Keep windSpeed strictly as daily mean (never as max gust).
        row.windSpeed = Math.round(val * 10) / 10;
        break;
      case DAILY_CODES.VVX10:
        row.windSpeedMax = Math.round(val * 10) / 10;
        // Extract gust time (UTC) and convert to Madrid local
        {
          const gustTimeUtc = r.hora_extrem ?? r.data_extrem ?? r['hora_tu'] ?? null;
          if (gustTimeUtc) {
            row.windGustTime = utcHourToMadrid(gustTimeUtc, refDate);
          }
        }
        break;
    }
  }

  return Array.from(byDay.keys())
    .sort()
    .map((day) => {
      const row = byDay.get(day)!;
      return {
        timestamp: day,
        temperature: row.temperature,
        humidity: row.humidity,
        windSpeed: row.windSpeed,
        windSpeedMax: row.windSpeedMax,
        windDirection: null,
        precipitation: row.precipitation,
        windGustTime: row.windGustTime,
      } as Observation;
    });
}

export async function getObservations(params: GetObservationsParams): Promise<Observation[]> {
  const { stationId, from, to, granularity } = params;
  if (granularity === '30min') {
    return fetch30minObservations(stationId, from, to);
  }
  return fetchDailyObservations(stationId, from, to);
}
