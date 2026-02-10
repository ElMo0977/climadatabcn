import type { Observation, WeatherStats } from '@/types/weather';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface WindBucketAggregate {
  time: string;
  windAvg: number;
  windMax: number;
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
    .map(({ sortTs, ...rest }) => rest);
}

export function calculateStats(observations: Observation[]): WeatherStats {
  const validTemps = observations.filter(o => o.temperature !== null).map(o => o.temperature!);
  const validHumidity = observations.filter(o => o.humidity !== null).map(o => o.humidity!);
  const validWind = observations.filter(o => o.windSpeed !== null).map(o => o.windSpeed!);
  const validWindMax = observations.filter(o => o.windSpeedMax !== null).map(o => o.windSpeedMax!);
  const validPrecip = observations.filter(o => o.precipitation !== null).map(o => o.precipitation!);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const max = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : null;
  const sum = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) : null;

  return {
    avgTemperature: avg(validTemps) ? Math.round(avg(validTemps)! * 10) / 10 : null,
    avgHumidity: avg(validHumidity) ? Math.round(avg(validHumidity)!) : null,
    avgWindSpeed: avg(validWind) ? Math.round(avg(validWind)! * 10) / 10 : null,
    maxWindSpeed: max(validWindMax) ?? max(validWind) ? Math.round((max(validWindMax) ?? max(validWind))! * 10) / 10 : null,
    totalPrecipitation: sum(validPrecip) ? Math.round(sum(validPrecip)! * 10) / 10 : null,
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

export function convertToCSV(observations: Observation[]): string {
  const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Wind Speed (m/s)', 'Wind Gust (m/s)', 'Wind Dir (°)', 'Precipitation (mm)'];
  const rows = observations.map(o => [
    o.timestamp,
    o.temperature ?? '',
    o.humidity ?? '',
    o.windSpeed ?? '',
    o.windSpeedMax ?? '',
    o.windDirection ?? '',
    o.precipitation ?? '',
  ]);
  return [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
