/**
 * Data Service – XEMA (Transparència Catalunya) como fuente principal, Open Data BCN y Open-Meteo como respaldo.
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
import { listStations as listStationsXema } from './providers/xemaTransparencia';

// ============ Main Service ============

class DataService {
  /**
   * Get list of stations: XEMA (Transparència) first, then Open Data BCN, then Supabase in useStations.
   */
  async getStations(): Promise<ProviderResult<Station[]>> {
    try {
      const xemaList = listStationsXema();
      if (xemaList.length > 0) {
        const stations: Station[] = xemaList.map((s) => ({
          id: s.id,
          name: s.name,
          provider: 'xema-transparencia' as DataProvider,
          latitude: s.latitude,
          longitude: s.longitude,
          elevation: s.elevation,
        }));
        return {
          data: stations,
          error: null,
          provider: 'xema-transparencia',
          cached: false,
        };
      }
    } catch (_) {
      // fallback to Open Data BCN
    }
    try {
      const stations = await openDataBcnProvider.listStations();
      return {
        data: stations,
        error: null,
        provider: 'opendata-bcn',
        cached: false,
      };
    } catch (error) {
      return {
        data: null,
        error: this.toApiError(error),
        provider: 'opendata-bcn',
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
        provider: 'opendata-bcn',
        cached: false,
      };
    } catch (error) {
      return {
        data: null,
        error: this.toApiError(error, 'opendata-bcn'),
        provider: 'opendata-bcn',
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
        provider: 'opendata-bcn',
        cached: false,
      };
    } catch (error) {
      return {
        data: null,
        error: this.toApiError(error, 'opendata-bcn'),
        provider: 'opendata-bcn',
        cached: false,
      };
    }
  }

  private toApiError(error: unknown, provider: DataProvider = 'opendata-bcn'): import('@/domain/types').ApiError {
    if (error instanceof ProviderError) {
      return error.toApiError();
    }
    if (error instanceof Error) {
      return {
        code: 'UNKNOWN',
        message: error.message,
        provider,
      };
    }
    return {
      code: 'UNKNOWN',
      message: 'Error desconocido',
      provider,
    };
  }
}

export const dataService = new DataService();
