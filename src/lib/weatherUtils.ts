import type { Observation, WeatherStats } from '@/types/weather';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface WindBucketAggregate {
  time: string;
  windAvg: number;
  windMax: number;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function formatDayKey(timestamp: string): string {
  try {
    const date = parseISO(timestamp);
    return format(date, 'yyyy-MM-dd');
  } catch {
    return timestamp;
  }
}

export function aggregateWindByBucket(
  points: Observation[],
  bucketFn: (obs: Observation) => string,
): WindBucketAggregate[] {
  const buckets = new Map<
    string,
    { label: string; windValues: number[]; windMaxValues: number[]; sortTs: number | null }
  >();

  for (const obs of points) {
    const label = bucketFn(obs);
    if (!label) continue;
    const sortTs = Number.isNaN(Date.parse(obs.timestamp)) ? null : Date.parse(obs.timestamp);
    const existing = buckets.get(label);
    const bucket = existing ?? { label, windValues: [], windMaxValues: [], sortTs };

    if (obs.windSpeed !== null && !Number.isNaN(obs.windSpeed)) bucket.windValues.push(obs.windSpeed);
    if (obs.windSpeedMax !== null && !Number.isNaN(obs.windSpeedMax)) bucket.windMaxValues.push(obs.windSpeedMax);

    if (sortTs !== null && (bucket.sortTs === null || sortTs < bucket.sortTs)) bucket.sortTs = sortTs;
    buckets.set(label, bucket);
  }

  const result: (WindBucketAggregate & { sortTs: number | null })[] = [];
  buckets.forEach((bucket) => {
    const avg = bucket.windValues.length > 0
      ? bucket.windValues.reduce((a, b) => a + b, 0) / bucket.windValues.length
      : null;
    const max = bucket.windMaxValues.length > 0
      ? Math.max(...bucket.windMaxValues)
      : (bucket.windValues.length > 0 ? Math.max(...bucket.windValues) : null);
    if (avg === null && max === null) return;
    result.push({
      time: bucket.label,
      windAvg: avg ?? 0,
      windMax: max ?? 0,
      sortTs: bucket.sortTs,
    });
  });

  return result
    .sort((a, b) => {
      if (a.sortTs === null && b.sortTs === null) return a.time.localeCompare(b.time);
      if (a.sortTs === null) return 1;
      if (b.sortTs === null) return -1;
      return a.sortTs - b.sortTs;
    })
    .map(({ sortTs: _sortTs, ...rest }) => rest);
}

export function calculateStats(observations: Observation[]): WeatherStats {
  const toFiniteNumbers = (values: Array<number | null | undefined>): number[] =>
    values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const max = (arr: number[]): number | null =>
    arr.length > 0 ? Math.max(...arr) : null;
  const sum = (arr: number[]): number | null =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) : null;

  const roundTo = (value: number | null, decimals: number): number | null => {
    if (value == null || !Number.isFinite(value)) return null;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  };

  const roundInt = (value: number | null): number | null => {
    if (value == null || !Number.isFinite(value)) return null;
    return Math.round(value);
  };

  const validTemps = toFiniteNumbers(observations.map((o) => o.temperature));
  const validHumidity = toFiniteNumbers(observations.map((o) => o.humidity));
  const validWind = toFiniteNumbers(observations.map((o) => o.windSpeed));
  const validWindMax = toFiniteNumbers(observations.map((o) => o.windSpeedMax));
  const validPrecip = toFiniteNumbers(observations.map((o) => o.precipitation));

  const maxWind = max(validWindMax) ?? max(validWind);

  return {
    avgTemperature: roundTo(avg(validTemps), 1),
    avgHumidity: roundInt(avg(validHumidity)),
    avgWindSpeed: roundTo(avg(validWind), 1),
    maxWindSpeed: roundTo(maxWind, 1),
    totalPrecipitation: roundTo(sum(validPrecip), 1),
    dataPoints: observations.length,
  };
}

export function formatTimestamp(timestamp: string, isDetail: boolean): string {
  try {
    const date = parseISO(timestamp);
    if (isDetail) {
      return format(date, "d MMM HH:mm", { locale: es });
    }
    return format(date, "d MMM yyyy", { locale: es });
  } catch {
    return timestamp;
  }
}

export function formatShortDate(timestamp: string): string {
  try {
    const date = parseISO(timestamp);
    return format(date, "d/M HH:mm");
  } catch {
    return timestamp;
  }
}

export function formatDayLabel(dayKey: string): string {
  try {
    const date = parseISO(dayKey);
    return format(date, 'd MMM yyyy', { locale: es });
  } catch {
    return dayKey;
  }
}

export function buildDailyWindReport(observations: Observation[]): WindBucketAggregate[] {
  return aggregateWindByBucket(observations, (obs) => formatDayKey(obs.timestamp));
}

export interface DailySummaryRow {
  date: string;
  tempAvg: number | null;
  humidityAvg: number | null;
  windAvg: number | null;
  windMax: number | null;
  precipSum: number;
}

export function buildDailySummary(observations: Observation[]): DailySummaryRow[] {
  const windReport = buildDailyWindReport(observations);
  const windByDate = new Map(windReport.map((w) => [w.time, w]));
  const byDay = new Map<string, { temps: number[]; hums: number[]; precips: number[] }>();

  for (const obs of observations) {
    const key = formatDayKey(obs.timestamp);
    if (!byDay.has(key)) byDay.set(key, { temps: [], hums: [], precips: [] });
    const b = byDay.get(key)!;
    if (obs.temperature !== null && !Number.isNaN(obs.temperature)) b.temps.push(obs.temperature);
    if (obs.humidity !== null && !Number.isNaN(obs.humidity)) b.hums.push(obs.humidity);
    if (obs.precipitation !== null && !Number.isNaN(obs.precipitation)) b.precips.push(obs.precipitation);
  }

  const sortedDays = Array.from(byDay.keys()).sort();
  return sortedDays.map((date) => {
    const day = byDay.get(date)!;
    const w = windByDate.get(date);
    const tempAvg = day.temps.length ? day.temps.reduce((a, b) => a + b, 0) / day.temps.length : null;
    const humidityAvg = day.hums.length ? day.hums.reduce((a, b) => a + b, 0) / day.hums.length : null;
    const precipSum = day.precips.length ? day.precips.reduce((a, b) => a + b, 0) : 0;
    return {
      date,
      tempAvg: tempAvg !== null ? Math.round(tempAvg * 10) / 10 : null,
      humidityAvg: humidityAvg !== null ? Math.round(humidityAvg) : null,
      windAvg: w?.windAvg ?? null,
      windMax: w?.windMax ?? null,
      precipSum: Math.round(precipSum * 10) / 10,
    };
  });
}

/**
 * Aggregates 30-min observations into one Observation per calendar day.
 * Designed for Excel export where the daily API may have a ~2-day lag.
 *
 * Field mapping from 30-min → daily:
 *   temperature  → mean of T values
 *   humidity     → mean of HR values (rounded to integer)
 *   precipitation → sum of PPT values
 *   windSpeed    → mean of VV10 values  (equivalent to VVM10)
 *   windSpeedMax → max of VVx10 values  (equivalent to VVX10)
 *   windGustTime → local HH:MM of the interval with the highest VVx10
 *   windDirection → null (not meaningful at daily resolution)
 */
export function aggregate30minToDaily(observations: Observation[]): Observation[] {
  const byDay = new Map<string, Observation[]>();

  for (const obs of observations) {
    const key = formatDayKey(obs.timestamp);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(obs);
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const sum = (arr: number[]): number | null =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) : null;
  const roundTo1 = (v: number | null): number | null =>
    v !== null ? Math.round(v * 10) / 10 : null;

  const sortedDays = Array.from(byDay.keys()).sort();
  return sortedDays.map((date) => {
    const dayObs = byDay.get(date)!;

    const validTemps    = dayObs.map((o) => o.temperature).filter(isFiniteNumber);
    const validHums     = dayObs.map((o) => o.humidity).filter(isFiniteNumber);
    const validPrecips  = dayObs.map((o) => o.precipitation).filter(isFiniteNumber);
    const validWind     = dayObs.map((o) => o.windSpeed).filter(isFiniteNumber);
    const validWindMax  = dayObs.map((o) => o.windSpeedMax).filter(isFiniteNumber);

    const windSpeedMax = validWindMax.length > 0 ? Math.max(...validWindMax) : null;

    // Extract local HH:MM from the observation with the highest windSpeedMax
    let windGustTime: string | null = null;
    if (windSpeedMax !== null) {
      const maxObs = dayObs.find(
        (o) => isFiniteNumber(o.windSpeedMax) && o.windSpeedMax === windSpeedMax,
      );
      if (maxObs) {
        const match = maxObs.timestamp.match(/T(\d{2}:\d{2})/);
        windGustTime = match ? match[1] : null;
      }
    }

    const humAvg = avg(validHums);
    return {
      timestamp: date,
      temperature: roundTo1(avg(validTemps)),
      humidity: humAvg !== null ? Math.round(humAvg) : null,
      precipitation: roundTo1(sum(validPrecips)),
      windSpeed: roundTo1(avg(validWind)),
      windSpeedMax: roundTo1(windSpeedMax),
      windGustTime,
      windDirection: null,
    };
  });
}

export function downloadFileBuffer(
  buffer: ArrayBuffer | Uint8Array | BlobPart,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([buffer as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
