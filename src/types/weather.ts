/** Origen de los datos: XEMA (principal), Open Data BCN o respaldo (Open-Meteo) */
export type DataSource = 'xema-transparencia' | 'opendata-bcn' | 'open-meteo';

export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  distance: number; // km from search center
  municipality?: string;
  /** Fuente de datos; si no está, se considera open-meteo (respaldo) */
  source?: DataSource;
}

export interface Observation {
  timestamp: string; // ISO 8601
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windSpeedMax: number | null; // racha máxima (gust)
  windDirection: number | null; // grados (solo detalle 30min)
  precipitation: number | null;
  /** Hora local de la racha máxima diaria (solo diario) */
  windGustTime?: string | null;
  /** Etiqueta para mostrar: "Fuente: X - Estación: Y" */
  dataSourceLabel?: string;
}

export type Granularity = '30min' | 'daily';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface WeatherStats {
  avgTemperature: number | null;
  avgHumidity: number | null;
  avgWindSpeed: number | null;
  maxWindSpeed: number | null;
  totalPrecipitation: number | null;
  dataPoints: number;
}
