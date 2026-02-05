import type { Observation, WeatherStats } from '@/types/weather';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface WindBucketAggregate {
  time: string;
  windMin: number;
  windAvg: number;
  windMax: number;
}

/**
 * Agrupa velocidades de viento por bucket temporal y calcula min/media/máx.
 * - Ignora valores null/NaN.
 * - Si solo hay un dato en el bucket, min=avg=max.
 * - Excluye buckets sin datos válidos.
 * - Mantiene la clave temporal tal cual la define bucketFn (mismo formato que el eje X).
 */
export function aggregateWindByBucket(
  points: Observation[],
  bucketFn: (obs: Observation) => string,
): WindBucketAggregate[] {
  const buckets = new Map<
    string,
    { label: string; values: number[]; sortTs: number | null }
  >();

  for (const obs of points) {
    const value = obs.windSpeed;
    if (value === null || Number.isNaN(value)) continue;

    const label = bucketFn(obs);
    if (!label) continue;

    const sortTs = Number.isNaN(Date.parse(obs.timestamp))
      ? null
      : Date.parse(obs.timestamp);

    const existing = buckets.get(label);
    if (existing) {
      existing.values.push(value);
      if (sortTs !== null && (existing.sortTs === null || sortTs < existing.sortTs)) {
        existing.sortTs = sortTs;
      }
    } else {
      buckets.set(label, { label, values: [value], sortTs });
    }
  }

  const result: (WindBucketAggregate & { sortTs: number | null })[] = [];

  buckets.forEach(bucket => {
    if (bucket.values.length === 0) return;
    const min = Math.min(...bucket.values);
    const max = Math.max(...bucket.values);
    const avg = bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length;
    result.push({
      time: bucket.label,
      windMin: min,
      windAvg: avg,
      windMax: max,
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
  const validWindMin = observations.filter(o => o.windSpeedMin !== null).map(o => o.windSpeedMin!);
  const validWindMax = observations.filter(o => o.windSpeedMax !== null).map(o => o.windSpeedMax!);
  const validPrecip = observations.filter(o => o.precipitation !== null).map(o => o.precipitation!);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const min = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : null;
  const max = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : null;
  const sum = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) : null;

  // For wind min/max, use dedicated fields if available, otherwise calculate from windSpeed
  const windMinValue = validWindMin.length > 0 ? min(validWindMin) : min(validWind);
  const windMaxValue = validWindMax.length > 0 ? max(validWindMax) : max(validWind);

  return {
    avgTemperature: avg(validTemps) ? Math.round(avg(validTemps)! * 10) / 10 : null,
    avgHumidity: avg(validHumidity) ? Math.round(avg(validHumidity)!) : null,
    avgWindSpeed: avg(validWind) ? Math.round(avg(validWind)! * 10) / 10 : null,
    minWindSpeed: windMinValue ? Math.round(windMinValue * 10) / 10 : null,
    maxWindSpeed: windMaxValue ? Math.round(windMaxValue * 10) / 10 : null,
    totalPrecipitation: sum(validPrecip) ? Math.round(sum(validPrecip)! * 10) / 10 : null,
    dataPoints: observations.length,
  };
}

export function formatTimestamp(timestamp: string, isHourly: boolean): string {
  try {
    const date = parseISO(timestamp);
    if (isHourly) {
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

export function convertToCSV(observations: Observation[]): string {
  const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Wind Speed (m/s)', 'Wind Min (m/s)', 'Wind Max (m/s)', 'Precipitation (mm)'];
  const rows = observations.map(o => [
    o.timestamp,
    o.temperature ?? '',
    o.humidity ?? '',
    o.windSpeed ?? '',
    o.windSpeedMin ?? '',
    o.windSpeedMax ?? '',
    o.precipitation ?? '',
  ]);
  
  // Use semicolon as delimiter for Excel compatibility (European locales)
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
