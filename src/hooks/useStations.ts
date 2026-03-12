import { useQuery } from '@tanstack/react-query';
import type { Station } from '@/types/weather';
import {
  fetchStationsFromSocrata,
  type StationMetadataSource,
} from '@/services/providers/xemaTransparencia';

const BARCELONA_LAT = 41.3851;
const BARCELONA_LON = 2.1734;
const DEFAULT_RADIUS_KM = 50;

function haversineDistanceKm(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function mapAndSortStations(
  stations: Array<{ id: string; name: string; latitude: number; longitude: number; elevation?: number | null; municipality?: string }>,
): Station[] {
  return stations
    .map((s) => ({
      id: s.id,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      elevation: s.elevation ?? null,
      municipality: s.municipality,
      distance: haversineDistanceKm(BARCELONA_LAT, BARCELONA_LON, s.latitude, s.longitude),
      source: 'xema-transparencia' as const,
    }))
    .filter((s) => s.distance <= DEFAULT_RADIUS_KM)
    .sort((a, b) => a.distance - b.distance);
}

interface StationsQueryData {
  stations: Station[];
  metadataSource: StationMetadataSource;
  warning: string | null;
}

export function useStations() {
  const query = useQuery<StationsQueryData, Error>({
    queryKey: ['stations', BARCELONA_LAT, BARCELONA_LON, DEFAULT_RADIUS_KM],
    queryFn: async (): Promise<StationsQueryData> => {
      const result = await fetchStationsFromSocrata();
      return {
        stations: mapAndSortStations(result.stations),
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
