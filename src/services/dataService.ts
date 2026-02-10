/**
 * Data Service – XEMA (Transparència Catalunya) as the only runtime source.
 */

import type {
  DataProvider,
  Station,
  ProviderResult,
} from '@/domain/types';
import { ProviderError } from '@/domain/types';
import { listStations as listStationsXema } from './providers/xemaTransparencia';

// ============ Main Service ============

class DataService {
  /**
   * Get list of stations from XEMA.
   */
  async getStations(): Promise<ProviderResult<Station[]>> {
    try {
      const xemaList = listStationsXema();
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
    } catch (error) {
      return {
        data: null,
        error: this.toApiError(error, 'xema-transparencia'),
        provider: 'xema-transparencia',
        cached: false,
      };
    }
  }

  private toApiError(
    error: unknown,
    provider: DataProvider = 'xema-transparencia',
  ): import('@/domain/types').ApiError {
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
