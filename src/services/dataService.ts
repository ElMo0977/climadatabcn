/**
 * Unified Data Service
 * 
 * Provides a single interface for accessing weather data from multiple providers.
 * Handles provider selection, fallback logic, and error aggregation.
 */

import type {
  DataProvider,
  ProviderMode,
  Station,
  ObservationLatest,
  TimeseriesResponse,
  WeatherVariable,
  AggregationType,
  ProviderResult,
  ApiError,
} from '@/domain/types';
import { ProviderError } from '@/domain/types';
import { meteocatProvider, openDataBcnProvider } from './providers';
import { isProviderConfigured, getMissingConfigMessage } from '@/config/env';

// ============ Provider Registry ============

const providers = {
  meteocat: meteocatProvider,
  'opendata-bcn': openDataBcnProvider,
} as const;

// Priority order for "auto" mode
const PROVIDER_PRIORITY: DataProvider[] = ['meteocat', 'opendata-bcn'];

// ============ Types ============

interface DataServiceOptions {
  /** Whether to try fallback providers on error */
  fallback?: boolean;
  /** Timeout override in ms */
  timeout?: number;
}

interface MultiProviderResult<T> {
  results: ProviderResult<T>[];
  /** Combined data from all providers (if merging makes sense) */
  combined?: T;
}

// ============ Main Service ============

class DataService {
  /**
   * Get list of stations from one or more providers
   */
  async getStations(
    mode: ProviderMode = 'auto',
    options: DataServiceOptions = {}
  ): Promise<ProviderResult<Station[]>> {
    const { fallback = true } = options;

    if (mode === 'auto') {
      return this.executeWithFallback(
        PROVIDER_PRIORITY,
        async (provider) => {
          const adapter = providers[provider];
          const stations = await adapter.listStations();
          return stations;
        },
        fallback
      );
    }

    return this.executeSingle(mode, async (provider) => {
      const adapter = providers[provider];
      return adapter.listStations();
    });
  }

  /**
   * Get latest observations for a station
   */
  async getLatest(
    mode: ProviderMode,
    stationId: string,
    options: DataServiceOptions = {}
  ): Promise<ProviderResult<ObservationLatest>> {
    const { fallback = true } = options;

    if (mode === 'auto') {
      return this.executeWithFallback(
        PROVIDER_PRIORITY,
        async (provider) => {
          const adapter = providers[provider];
          return adapter.getLatest(stationId);
        },
        fallback
      );
    }

    return this.executeSingle(mode, async (provider) => {
      const adapter = providers[provider];
      return adapter.getLatest(stationId);
    });
  }

  /**
   * Get timeseries data for a station
   */
  async getTimeseries(
    mode: ProviderMode,
    stationId: string,
    from: Date,
    to: Date,
    variable: WeatherVariable,
    aggregation: AggregationType,
    options: DataServiceOptions = {}
  ): Promise<ProviderResult<TimeseriesResponse>> {
    const { fallback = true } = options;

    if (mode === 'auto') {
      return this.executeWithFallback(
        PROVIDER_PRIORITY,
        async (provider) => {
          const adapter = providers[provider];
          return adapter.getTimeseries(stationId, from, to, variable, aggregation);
        },
        fallback
      );
    }

    return this.executeSingle(mode, async (provider) => {
      const adapter = providers[provider];
      return adapter.getTimeseries(stationId, from, to, variable, aggregation);
    });
  }

  /**
   * Get stations from all configured providers
   */
  async getAllStations(): Promise<MultiProviderResult<Station[]>> {
    const results: ProviderResult<Station[]>[] = [];
    const allStations: Station[] = [];

    for (const providerName of PROVIDER_PRIORITY) {
      const result = await this.executeSingle(providerName, async (provider) => {
        const adapter = providers[provider];
        return adapter.listStations();
      });

      results.push(result);
      
      if (result.data) {
        allStations.push(...result.data);
      }
    }

    return {
      results,
      combined: allStations,
    };
  }

  /**
   * Check which providers are configured and available
   */
  getProviderStatus(): Record<DataProvider, { configured: boolean; message: string | null }> {
    const status: Record<DataProvider, { configured: boolean; message: string | null }> = {
      meteocat: {
        configured: isProviderConfigured('meteocat'),
        message: getMissingConfigMessage('meteocat'),
      },
      'opendata-bcn': {
        configured: isProviderConfigured('opendata-bcn'),
        message: getMissingConfigMessage('opendata-bcn'),
      },
    };

    return status;
  }

  /**
   * Get the first available (configured) provider
   */
  getFirstAvailableProvider(): DataProvider | null {
    for (const provider of PROVIDER_PRIORITY) {
      if (isProviderConfigured(provider)) {
        return provider;
      }
    }
    return null;
  }

  // ============ Private Methods ============

  private async executeSingle<T>(
    provider: DataProvider,
    operation: (provider: DataProvider) => Promise<T>
  ): Promise<ProviderResult<T>> {
    // Check configuration first
    if (!isProviderConfigured(provider)) {
      const message = getMissingConfigMessage(provider) || 'Proveedor no configurado';
      return {
        data: null,
        error: {
          code: 'MISSING_API_KEY',
          message,
          provider,
        },
        provider,
        cached: false,
      };
    }

    try {
      const data = await operation(provider);
      return {
        data,
        error: null,
        provider,
        cached: false, // TODO: Track cache status from provider
      };
    } catch (error) {
      const apiError = this.toApiError(error, provider);
      return {
        data: null,
        error: apiError,
        provider,
        cached: false,
      };
    }
  }

  private async executeWithFallback<T>(
    providerOrder: DataProvider[],
    operation: (provider: DataProvider) => Promise<T>,
    useFallback: boolean
  ): Promise<ProviderResult<T>> {
    const errors: ApiError[] = [];

    for (const provider of providerOrder) {
      // Check configuration
      if (!isProviderConfigured(provider)) {
        const message = getMissingConfigMessage(provider);
        errors.push({
          code: 'MISSING_API_KEY',
          message: message || 'Proveedor no configurado',
          provider,
        });
        
        if (!useFallback) break;
        continue;
      }

      try {
        const data = await operation(provider);
        return {
          data,
          error: null,
          provider,
          cached: false,
        };
      } catch (error) {
        const apiError = this.toApiError(error, provider);
        errors.push(apiError);

        // Don't fallback if user explicitly disabled it
        if (!useFallback) break;

        // Continue to next provider
        console.warn(`Provider ${provider} failed, trying next...`, apiError);
      }
    }

    // All providers failed
    const lastProvider = providerOrder[providerOrder.length - 1];
    const combinedMessage = errors
      .map(e => `${e.provider}: ${e.message}`)
      .join('; ');

    return {
      data: null,
      error: {
        code: errors[0]?.code || 'PROVIDER_ERROR',
        message: combinedMessage || 'Todos los proveedores fallaron',
        provider: lastProvider,
        details: { allErrors: errors },
      },
      provider: lastProvider,
      cached: false,
    };
  }

  private toApiError(error: unknown, provider: DataProvider): ApiError {
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

// Export singleton instance
export const dataService = new DataService();

// Export types for consumers
export type { DataServiceOptions, MultiProviderResult };
