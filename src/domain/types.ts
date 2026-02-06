/**
 * Domain types for weather data providers
 * Common contract that all providers must implement
 */

// ============ Provider Configuration ============

export type DataProvider = 'meteocat' | 'opendata-bcn';
export type ProviderMode = DataProvider | 'auto';
export type DataMode = 'live' | 'mock';

// ============ Station Types ============

export interface Station {
  id: string;
  name: string;
  provider: DataProvider;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  /** Additional metadata specific to provider */
  meta?: Record<string, unknown>;
}

// ============ Observation Types ============

export interface ObservationValues {
  temperature?: number | null; // °C
  humidity?: number | null; // %
  windSpeed?: number | null; // m/s
  windSpeedMin?: number | null; // m/s
  windSpeedMax?: number | null; // m/s
  windDirection?: number | null; // degrees
  precipitation?: number | null; // mm
  pressure?: number | null; // hPa
}

export interface ObservationLatest {
  stationId: string;
  provider: DataProvider;
  timestamp: string; // ISO 8601
  values: ObservationValues;
}

// ============ Timeseries Types ============

export type WeatherVariable = 
  | 'temperature'
  | 'humidity'
  | 'windSpeed'
  | 'windSpeedMin'
  | 'windSpeedMax'
  | 'windDirection'
  | 'precipitation'
  | 'pressure';

export type AggregationType = 'hourly' | 'daily';

export interface TimeseriesPoint {
  timestamp: string; // ISO 8601
  value: number | null;
}

export interface TimeseriesResponse {
  stationId: string;
  provider: DataProvider;
  variable: WeatherVariable;
  unit?: string;
  aggregation: AggregationType;
  points: TimeseriesPoint[];
}

// ============ Error Types ============

export type ApiErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_PARAMS'
  | 'UNKNOWN';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  provider?: DataProvider;
  details?: Record<string, unknown>;
}

export class ProviderError extends Error {
  public readonly code: ApiErrorCode;
  public readonly provider?: DataProvider;
  public readonly details?: Record<string, unknown>;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ProviderError';
    this.code = error.code;
    this.provider = error.provider;
    this.details = error.details;
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      provider: this.provider,
      details: this.details,
    };
  }
}

// ============ Provider Interface ============

export interface DataProviderAdapter {
  readonly name: DataProvider;
  
  /** Check if provider is configured (has API key if required) */
  isConfigured(): boolean;
  
  /** List all available stations */
  listStations(): Promise<Station[]>;
  
  /** Get latest observation for a station */
  getLatest(stationId: string): Promise<ObservationLatest>;
  
  /** Get timeseries data for a station */
  getTimeseries(
    stationId: string,
    from: Date,
    to: Date,
    variable: WeatherVariable,
    aggregation: AggregationType
  ): Promise<TimeseriesResponse>;
}

// ============ Result Types ============

export interface ProviderResult<T> {
  data: T | null;
  error: ApiError | null;
  provider: DataProvider;
  cached: boolean;
}
