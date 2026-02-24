import type { Observation } from '@/types/weather';
import { DAILY_CODES, SUBDAILY_CODES } from './xemaVariableMap';
import { fetchSocrata, fetchSocrataAll } from '@/services/http/socrata';
import { parseBooleanEnv } from '@/config/env';

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

interface SubdailyGustRow {
  data_lectura: string;
  valor?: string;
  valor_lectura?: string;
}

interface SubdailyValueCoverageRow {
  data_lectura: string;
  codi_variable: string;
  codi_estat?: string;
  valor?: string;
  valor_lectura?: string;
}

const SUBDAILY_VARIABLE_CODES = [
  SUBDAILY_CODES.T,
  SUBDAILY_CODES.HR,
  SUBDAILY_CODES.PPT,
  SUBDAILY_CODES.VV10,
  SUBDAILY_CODES.DV10,
  SUBDAILY_CODES.VVx10,
];

const SUBDAILY_VARIABLE_LABELS: Record<string, string> = {
  [SUBDAILY_CODES.T]: 'temperature',
  [SUBDAILY_CODES.HR]: 'humidity',
  [SUBDAILY_CODES.PPT]: 'precipitation',
  [SUBDAILY_CODES.VV10]: 'windSpeed',
  [SUBDAILY_CODES.DV10]: 'windDirection',
  [SUBDAILY_CODES.VVx10]: 'windSpeedMax',
};

export async function getObservations(params: {
  stationId: string;
  from: Date;
  to: Date;
  granularity: '30min' | 'day';
}): Promise<Observation[]> {
  const fromDay = toLocalDayKey(params.from);
  const toDay = toLocalDayKey(params.to);

  if (params.granularity === 'day') {
    const [rows, gustRows] = await Promise.all([
      fetchSocrataAll<DailyRow>('7bvh-jvq2', {
        $select: 'codi_estacio,data_lectura,codi_variable,valor',
        $where: `codi_estacio = '${params.stationId}' AND data_lectura >= '${fromDay}T00:00:00' AND data_lectura <= '${toDay}T23:59:59' AND codi_variable in ('${DAILY_CODES.TM}','${DAILY_CODES.HRM}','${DAILY_CODES.PPT}','${DAILY_CODES.VVM10}','${DAILY_CODES.VVX10}')`,
        $order: 'data_lectura ASC',
        $limit: 5000,
      }),
      fetchSocrataAll<SubdailyGustRow>('nzvn-apee', {
        $select: 'data_lectura,valor,valor_lectura',
        $where: `codi_estacio = '${params.stationId}' AND data_lectura >= '${fromDay}T00:00:00' AND data_lectura <= '${toDay}T23:59:59' AND codi_variable = '${SUBDAILY_CODES.VVx10}'`,
        $order: 'data_lectura ASC',
        $limit: 50000,
      }),
    ]);

    return attachDailyGustTimes(mapDailyRowsToObservations(rows), gustRows);
  }

  const subdailyWhere =
    `codi_estacio = '${params.stationId}' AND data_lectura >= '${fromDay}T00:00:00' AND data_lectura <= '${toDay}T23:59:59' ` +
    `AND codi_variable in ('${SUBDAILY_VARIABLE_CODES.join("','")}')`;

  if (parseBooleanEnv(import.meta.env.VITE_DEBUG_XEMA)) {
    const rawRows = await fetchSocrata<SubdailyValueCoverageRow[]>('nzvn-apee', {
      $select: 'data_lectura,codi_variable,codi_estat,valor,valor_lectura',
      $where: subdailyWhere,
      $order: 'data_lectura ASC',
      $limit: 2000,
    });

    const rowsWhereValorLecturaMissingButValorPresentByVariable: Record<string, number> = {};
    const variableSetByTimestamp = new Map<string, Set<string>>();

    let rowsWhereValorLecturaMissingButValorPresent = 0;
    for (const row of rawRows) {
      if (!variableSetByTimestamp.has(row.data_lectura)) {
        variableSetByTimestamp.set(row.data_lectura, new Set());
      }
      if (row.codi_variable) {
        variableSetByTimestamp.get(row.data_lectura)?.add(row.codi_variable);
      }

      if (isValueMissing(row.valor_lectura) && !isValueMissing(row.valor)) {
        rowsWhereValorLecturaMissingButValorPresent += 1;
        rowsWhereValorLecturaMissingButValorPresentByVariable[row.codi_variable] =
          (rowsWhereValorLecturaMissingButValorPresentByVariable[row.codi_variable] ?? 0) + 1;
      }
    }

    const uniqueTimestamps = Array.from(variableSetByTimestamp.keys()).sort();
    const minTimestamp = uniqueTimestamps[0] ?? null;
    const maxTimestamp = uniqueTimestamps[uniqueTimestamps.length - 1] ?? null;

    const variableCountDistributionByTimestamp: Record<string, number> = {};
    const sparseTimestampSamples: Array<{ timestamp: string; variableCount: number; variables: string[] }> = [];
    const sortedTimestampCoverage = Array.from(variableSetByTimestamp.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [timestamp, variableSet] of sortedTimestampCoverage) {
      const variableCount = variableSet.size;
      variableCountDistributionByTimestamp[String(variableCount)] =
        (variableCountDistributionByTimestamp[String(variableCount)] ?? 0) + 1;

      if (
        variableCount < SUBDAILY_VARIABLE_CODES.length &&
        sparseTimestampSamples.length < 20
      ) {
        sparseTimestampSamples.push({
          timestamp,
          variableCount,
          variables: Array.from(variableSet).sort(),
        });
      }
    }

    const largeGapSamples: Array<{ from: string; to: string; gapMinutes: number }> = [];
    for (let i = 1; i < uniqueTimestamps.length; i += 1) {
      const previous = uniqueTimestamps[i - 1];
      const current = uniqueTimestamps[i];
      const prevMs = Date.parse(previous);
      const currMs = Date.parse(current);
      if (Number.isNaN(prevMs) || Number.isNaN(currMs)) continue;
      const gapMinutes = (currMs - prevMs) / (60 * 1000);
      if (gapMinutes > 30 && largeGapSamples.length < 20) {
        largeGapSamples.push({ from: previous, to: current, gapMinutes });
      }
    }

    const rowsWhereValorLecturaMissingButValorPresentByVariableWithLabel = Object.entries(
      rowsWhereValorLecturaMissingButValorPresentByVariable,
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce<Record<string, number>>((acc, [code, count]) => {
        const variableLabel = SUBDAILY_VARIABLE_LABELS[code] ?? 'unknown';
        acc[`${code}:${variableLabel}`] = count;
        return acc;
      }, {});

    console.log('[xema-debug] value-field-coverage', {
      stationId: params.stationId,
      fromDay,
      toDay,
      totalRows: rawRows.length,
      rowsWhereValorLecturaMissingButValorPresent: {
        total: rowsWhereValorLecturaMissingButValorPresent,
        byVariable: rowsWhereValorLecturaMissingButValorPresentByVariableWithLabel,
      },
      uniqueTimestampsCount: uniqueTimestamps.length,
      minTimestamp,
      maxTimestamp,
      variableCountDistributionByTimestamp,
      sparseTimestampSamples,
      largeGapSamples,
      debugQueryLimit: 2000,
    });
  }

  const rows = await fetchSocrataAll<SubdailyRow>('nzvn-apee', {
    $select: 'codi_estacio,data_lectura,codi_variable,valor,valor_lectura,codi_estat',
    $where: subdailyWhere,
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

function isValueMissing(value?: string): boolean {
  return value == null || value.trim() === '';
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

function extractLocalTimeFromTimestamp(ts: string): string | null {
  const m = ts.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

export function attachDailyGustTimes(
  daily: Observation[],
  gustRows: SubdailyGustRow[],
): Observation[] {
  const byDay: Record<string, { speed: number; time: string | null }> = {};
  for (const row of gustRows) {
    const speed = parseNumericOrNull(row);
    if (speed === null) continue;
    const day = row.data_lectura.slice(0, 10);
    const time = extractLocalTimeFromTimestamp(row.data_lectura);
    const current = byDay[day];
    if (!current || speed > current.speed) {
      byDay[day] = { speed, time };
    }
  }

  return daily.map((obs) => ({
    ...obs,
    windGustTime: byDay[obs.timestamp]?.time ?? obs.windGustTime ?? null,
  }));
}
