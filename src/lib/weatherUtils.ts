import type { Observation, WeatherStats } from '@/types/weather';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function calculateStats(observations: Observation[]): WeatherStats {
  const validTemps = observations.filter(o => o.temperature !== null).map(o => o.temperature!);
  const validHumidity = observations.filter(o => o.humidity !== null).map(o => o.humidity!);
  const validWind = observations.filter(o => o.windSpeed !== null).map(o => o.windSpeed!);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    avgTemperature: avg(validTemps) ? Math.round(avg(validTemps)! * 10) / 10 : null,
    avgHumidity: avg(validHumidity) ? Math.round(avg(validHumidity)!) : null,
    avgWindSpeed: avg(validWind) ? Math.round(avg(validWind)! * 10) / 10 : null,
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
  const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Wind Speed (m/s)'];
  const rows = observations.map(o => [
    o.timestamp,
    o.temperature ?? '',
    o.humidity ?? '',
    o.windSpeed ?? '',
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
