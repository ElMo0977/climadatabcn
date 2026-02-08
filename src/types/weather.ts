/** Origen de los datos: Open Data BCN (oficial) o respaldo (Open-Meteo) */
export type DataSource = 'opendata-bcn' | 'open-meteo';

export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  distance: number; // km from search center
  /** Fuente de datos; si no está, se considera open-meteo (respaldo) */
  source?: DataSource;
}

export interface Observation {
  timestamp: string; // ISO 8601
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windSpeedMin: number | null;
  windSpeedMax: number | null;
  precipitation: number | null;
  /** Etiqueta para mostrar: "Fuente: X - Estación: Y" */
  dataSourceLabel?: string;
}

export type Granularity = 'hourly' | 'daily';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface WeatherStats {
  avgTemperature: number | null;
  avgHumidity: number | null;
  avgWindSpeed: number | null;
  minWindSpeed: number | null;
  maxWindSpeed: number | null;
  totalPrecipitation: number | null;
  dataPoints: number;
}
