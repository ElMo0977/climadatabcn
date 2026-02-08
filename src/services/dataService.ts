/**
 * Data Service – Open Data BCN
 *
 * Única fuente de datos oficial: Open Data BCN.
 * Respaldo vía Supabase/Open-Meteo se gestiona en useObservations cuando no hay estaciones del provider.
 */

import type {
  DataProvider,
  Station,
  ObservationLatest,
  TimeseriesResponse,
  WeatherVariable,
  AggregationType,
  ProviderResult,
} from '@/domain/types';
import { ProviderError } from '@/domain/types';
import { openDataBcnProvider } from './providers';

const PROVIDER: DataProvider = 'opendata-bcn';

// ============ Main Service ============

class DataService {
  /**
   * Get list of stations from Open Data BCN
   */
  async getStations(): Promise<ProviderResult<Station[]>> {
    try {
      const stations = await openDataBcnProvider.listStations();
      return {
        data: stations,
        error: null,
        provider: PROVIDER,
        cached: false,
      };
    } catch (error) {
      return {
        data: null,
        error: this.toApiError(error),
        provider: PROVIDER,
        cached: false,
      };
    }
  }

  /**
   * Get latest observations for a station
   */
  async getLatest(stationId: string): Promise<ProviderResult<ObservationLatest>> {
    try {
      const data = await openDataBcnProvider.getLatest(stationId);
      return {
        data,
        error: null,
        provider: PROVIDER,
        cached: false,
      };
    } catch (error) {
      return {
        data: null,
        error: this.toApiError(error),
        provider: PROVIDER,
        cached: false,
      };
    }
  }

  /**
   * Get timeseries data for a station
   */
  async getTimeseries(
    stationId: string,
    from: Date,
    to: Date,
    variable: WeatherVariable,
    aggregation: AggregationType
  ): Promise<ProviderResult<TimeseriesResponse>> {
    try {
      const data = await openDataBcnProvider.getTimeseries(
        stationId,
        from,
        to,
        variable,
        aggregation
      );
      return {
        data,
        error: null,
        provider: PROVIDER,
        cached: false,
      };
    } catch (error) {
      return {
        data: null,
        error: this.toApiError(error),
        provider: PROVIDER,
        cached: false,
      };
    }
  }

  private toApiError(error: unknown): import('@/domain/types').ApiError {
    if (error instanceof ProviderError) {
      return error.toApiError();
    }
    if (error instanceof Error) {
      return {
        code: 'UNKNOWN',
        message: error.message,
        provider: PROVIDER,
      };
    }
    return {
      code: 'UNKNOWN',
      message: 'Error desconocido',
      provider: PROVIDER,
    };
  }
}

export const dataService = new DataService();
