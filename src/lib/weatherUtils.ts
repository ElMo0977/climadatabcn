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
 * Clave de día para agrupar por fecha (yyyy-MM-dd). Usar cuando el bucket sea "un día"
 * y los puntos sean registros horarios.
 */
export function formatDayKey(timestamp: string): string {
  try {
    const date = parseISO(timestamp);
    return format(date, 'yyyy-MM-dd');
  } catch {
    return timestamp;
  }
}

/**
 * Agrupa velocidades de viento por bucket temporal y calcula min/media/máx.
 * - Media = media ponderada temporal: suma de todas las velocidades en el bucket / número de registros.
 *   No se usan los consolidados min/max del día; se iteran los registros horarios del bucket.
 * - Min/máx: mínimo y máximo de los valores en el bucket (windSpeed o windMin/windMax si existen).
 * - Ignora valores null/NaN. Excluye buckets sin datos válidos.
 */
export function aggregateWindByBucket(
  points: Observation[],
  bucketFn: (obs: Observation) => string,
): WindBucketAggregate[] {
  const buckets = new Map<
    string,
    { 
      label: string; 
      windValues: number[]; 
      windMinValues: number[]; 
      windMaxValues: number[]; 
      sortTs: number | null;
    }
  >();

  for (const obs of points) {
    const label = bucketFn(obs);
    if (!label) continue;

    const sortTs = Number.isNaN(Date.parse(obs.timestamp))
      ? null
      : Date.parse(obs.timestamp);

    const existing = buckets.get(label);
    const bucket = existing ?? {
      label,
      windValues: [] as number[],
      windMinValues: [] as number[],
      windMaxValues: [] as number[],
      sortTs,
    };

    const pushIfValid = (value: number | null, arr: number[]) => {
      if (value === null || Number.isNaN(value)) return;
      arr.push(value);
    };

    pushIfValid(obs.windSpeed, bucket.windValues);
    pushIfValid(obs.windSpeedMin, bucket.windMinValues);
    pushIfValid(obs.windSpeedMax, bucket.windMaxValues);

    if (sortTs !== null && (bucket.sortTs === null || sortTs < bucket.sortTs)) {
      bucket.sortTs = sortTs;
    }

    buckets.set(label, bucket);
  }

  const result: (WindBucketAggregate & { sortTs: number | null })[] = [];

  buckets.forEach(bucket => {
    const minSource =
      bucket.windMinValues.length > 0 ? bucket.windMinValues : bucket.windValues;
    const maxSource =
      bucket.windMaxValues.length > 0 ? bucket.windMaxValues : bucket.windValues;

    if (minSource.length === 0 && maxSource.length === 0) return;

    const min = minSource.length ? Math.min(...minSource) : null;
    const max = maxSource.length ? Math.max(...maxSource) : null;

    // Media ponderada temporal: suma de velocidades horarias / nº de registros.
    // No usar (min+max)/2 ni consolidados diarios.
    const avg =
      bucket.windValues.length > 0
        ? bucket.windValues.reduce((a, b) => a + b, 0) / bucket.windValues.length
        : null;

    if (min === null || max === null || avg === null) return;

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

/**
 * Formatea una clave de día (yyyy-MM-dd) para mostrar en tabla/UI.
 */
export function formatDayLabel(dayKey: string): string {
  try {
    const date = parseISO(dayKey);
    return format(date, 'd MMM yyyy', { locale: es });
  } catch {
    return dayKey;
  }
}

/**
 * Resumen diario de viento con la misma lógica que el gráfico: media = suma(velocidades horarias) / N.
 * Debe recibir observaciones horarias; agrupa por día con formatDayKey.
 */
export function buildDailyWindReport(observations: Observation[]): WindBucketAggregate[] {
  return aggregateWindByBucket(observations, (obs) => formatDayKey(obs.timestamp));
}

/**
 * CSV de informe diario (viento mín/media/máx) con la misma precisión que el gráfico.
 * Espera observaciones horarias; la media es la media ponderada temporal.
 */
export function convertToDailyReportCSV(observations: Observation[]): string {
  const daily = buildDailyWindReport(observations);
  const headers = ['Fecha', 'Viento mín (m/s)', 'Viento media (m/s)', 'Viento máx (m/s)'];
  const round = (v: number) => Math.round(v * 10) / 10;
  const rows = daily.map((d) => [
    d.time,
    round(d.windMin),
    round(d.windAvg),
    round(d.windMax),
  ]);
  return [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
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
