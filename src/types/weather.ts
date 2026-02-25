/** Origen de los datos: XEMA (única fuente en runtime) */
export type DataSource = 'xema-transparencia';

export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  distance: number; // km from search center
  municipality?: string;
  /** Fuente de datos */
  source?: DataSource;
}

export interface Observation {
  timestamp: string; // ISO 8601
  temperature: number | null;
  humidity: number | null;
  /** Wind speed mean/regular value (daily: VVM10 avg, 30min: VV10). Never stores gust max. */
  windSpeed: number | null;
  /** Wind gust maximum (daily: VVX10, 30min: VVx10). */
  windSpeedMax: number | null;
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
  provider?: DataSource;
  details?: Record<string, unknown>;
}

export class ProviderError extends Error {
  public readonly code: ApiErrorCode;
  public readonly provider?: DataSource;
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
