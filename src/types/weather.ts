export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  distance: number; // km from search center
}

export interface Observation {
  timestamp: string; // ISO 8601
  temperature: number | null; // Celsius
  humidity: number | null; // Percentage
  windSpeed: number | null; // m/s (mean for hourly, max for daily)
  windSpeedMin: number | null; // m/s (daily only)
  windSpeedMax: number | null; // m/s (daily only)
  precipitation: number | null; // mm (accumulated)
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
