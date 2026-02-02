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
  windSpeed: number | null; // km/h
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
  dataPoints: number;
}
