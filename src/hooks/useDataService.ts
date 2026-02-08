/**
 * React hook for the unified data service
 */

import { useQuery } from '@tanstack/react-query';
import { dataService } from '@/services/dataService';
import type { 
  ProviderMode, 
  WeatherVariable, 
  AggregationType,
  Station,
  ObservationLatest,
  TimeseriesResponse,
  ProviderResult,
} from '@/domain/types';

// ============ Hook Options ============

interface UseDataServiceOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}

// ============ Stations Hook ============

export function useProviderStations(
  mode: ProviderMode = 'auto',
  options: UseDataServiceOptions = {}
) {
  const { enabled = true, staleTime = 15 * 60 * 1000 } = options;

  return useQuery({
    queryKey: ['provider-stations', mode],
    queryFn: async (): Promise<ProviderResult<Station[]>> => {
      return dataService.getStations(mode);
    },
    enabled,
    staleTime,
    retry: 1,
  });
}

// ============ Latest Observation Hook ============

export function useProviderLatest(
  mode: ProviderMode,
  stationId: string | null,
  options: UseDataServiceOptions = {}
) {
  const { enabled = true, staleTime = 5 * 60 * 1000 } = options;

  return useQuery({
    queryKey: ['provider-latest', mode, stationId],
    queryFn: async (): Promise<ProviderResult<ObservationLatest>> => {
      if (!stationId) {
        throw new Error('Station ID is required');
      }
      return dataService.getLatest(mode, stationId);
    },
    enabled: enabled && !!stationId,
    staleTime,
    retry: 1,
  });
}

// ============ Timeseries Hook ============

interface UseTimeseriesParams {
  mode: ProviderMode;
  stationId: string | null;
  from: Date;
  to: Date;
  variable: WeatherVariable;
  aggregation: AggregationType;
}

export function useProviderTimeseries(
  params: UseTimeseriesParams,
  options: UseDataServiceOptions = {}
) {
  const { mode, stationId, from, to, variable, aggregation } = params;
  const { enabled = true, staleTime = 15 * 60 * 1000 } = options;

  return useQuery({
    queryKey: ['provider-timeseries', mode, stationId, from.toISOString(), to.toISOString(), variable, aggregation],
    queryFn: async (): Promise<ProviderResult<TimeseriesResponse>> => {
      if (!stationId) {
        throw new Error('Station ID is required');
      }
      return dataService.getTimeseries(mode, stationId, from, to, variable, aggregation);
    },
    enabled: enabled && !!stationId,
    staleTime,
    retry: 1,
  });
}

// ============ Provider Status Hook ============

export function useProviderStatus() {
  return dataService.getProviderStatus();
}
