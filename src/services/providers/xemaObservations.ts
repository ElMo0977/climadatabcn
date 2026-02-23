import type { Observation } from '@/types/weather';
import { DAILY_CODES, SUBDAILY_CODES } from './xemaVariableMap';
import { fetchSocrataAll } from '@/services/http/socrata';

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
  valor?: string;
  valor_lectura?: string;
  codi_estat?: string;
}

export async function getObservations(params: {
  stationId: string;
  from: Date;
  to: Date;
  granularity: '30min' | 'day';
}): Promise<Observation[]> {
  const fromDay = toLocalDayKey(params.from);
  const toDay = toLocalDayKey(params.to);

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
    $where: `codi_estacio = '${params.stationId}' AND data_lectura >= '${fromDay}T00:00:00' AND data_lectura <= '${toDay}T23:59:59' AND codi_variable in ('${SUBDAILY_CODES.T}','${SUBDAILY_CODES.HR}','${SUBDAILY_CODES.PPT}','${SUBDAILY_CODES.VV10}','${SUBDAILY_CODES.DV10}','${SUBDAILY_CODES.VVx10}') AND codi_estat in ('V','T')`,
    $order: 'data_lectura ASC',
    $limit: 50000,
  });

  return mapSubdailyRowsToObservations(rows);
}

export function buildDailyRangeBounds(from: Date, to: Date) {
  const fromDay = toLocalDayKey(from);
  const toDay = toLocalDayKey(to);
  return { fromDay, toDay };
}

export function filterDailyObservationsByRange<T extends { timestamp: string }>(
  observations: T[],
  bounds: { fromDay: string; toDay: string },
): T[] {
  return observations.filter(
    (o) => o.timestamp >= bounds.fromDay && o.timestamp <= bounds.toDay,
  );
}

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

    const parsedValue = parseNumericOrNull(row);

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

function parseNumericOrNull(row: { valor?: string; valor_lectura?: string }): number | null {
  const value = parseRowNumericValue(row);
  return Number.isFinite(value) ? value : null;
}

function toLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

    const parsedValue = parseNumericOrNull(row);
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
