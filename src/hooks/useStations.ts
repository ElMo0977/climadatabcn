import { useQuery } from '@tanstack/react-query';
import type { Station } from '@/types/weather';
import {
  fetchStationsFromSocrata,
  type StationMetadataSource,
} from '@/services/providers/xemaTransparencia';
import { mapStationsNearBarcelona } from '@/lib/stationGeo';

interface StationsQueryData {
  stations: Station[];
  metadataSource: StationMetadataSource;
  warning: string | null;
}

export function useStations() {
  const query = useQuery<StationsQueryData, Error>({
    queryKey: ['stations', 'barcelona-nearby'],
    queryFn: async (): Promise<StationsQueryData> => {
      const result = await fetchStationsFromSocrata();
      return {
        stations: mapStationsNearBarcelona(result.stations),
        metadataSource: result.metadataSource,
        warning: result.warning,
      };
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h
    retry: false,
  });

  return {
    data: query.data?.stations ?? [],
    metadataSource: query.data?.metadataSource ?? null,
    warning: query.data?.warning ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
