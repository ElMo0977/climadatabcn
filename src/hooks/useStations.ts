import { useQuery } from '@tanstack/react-query';
import { dataService } from '@/services/dataService';
import type { Station } from '@/types/weather';
import type { DataSource } from '@/types/weather';
import { fetchStationsFromSocrata } from '@/services/providers/xemaTransparencia';

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

export function useStations() {
  return useQuery({
    queryKey: ['stations', BARCELONA_LAT, BARCELONA_LON, DEFAULT_RADIUS_KM],
    queryFn: async (): Promise<Station[]> => {
      // Try dynamic Socrata fetch first
      try {
        const socrataStations = await fetchStationsFromSocrata();
        if (socrataStations.length > 0) {
          return socrataStations
            .map((s) => ({
              id: s.id,
              name: s.name,
              latitude: s.latitude,
              longitude: s.longitude,
              elevation: s.elevation ?? null,
              municipality: (s as { municipality?: string }).municipality,
              distance: haversineDistanceKm(BARCELONA_LAT, BARCELONA_LON, s.latitude, s.longitude),
              source: 'xema-transparencia' as DataSource,
            }))
            .filter((s) => s.distance <= DEFAULT_RADIUS_KM)
            .sort((a, b) => a.distance - b.distance);
        }
      } catch (e) {
        console.warn('[useStations] Socrata fetch failed:', e);
      }

      // Fallback: dataService
      const result = await dataService.getStations();
      if (result.data && result.data.length > 0) {
        const source: DataSource =
          result.provider === 'xema-transparencia' ? 'xema-transparencia' : 'opendata-bcn';
        return result.data
          .map((s) => ({
            id: s.id,
            name: s.name,
            latitude: s.latitude,
            longitude: s.longitude,
            elevation: s.elevation ?? null,
            distance: haversineDistanceKm(BARCELONA_LAT, BARCELONA_LON, s.latitude, s.longitude),
            source,
          }))
          .filter((s) => s.distance <= DEFAULT_RADIUS_KM)
          .sort((a, b) => a.distance - b.distance);
      }

      // Last fallback: Supabase
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stations?lat=${BARCELONA_LAT}&lon=${BARCELONA_LON}&radiusKm=${DEFAULT_RADIUS_KM}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching stations: ${response.status}`);
      }
      const supabaseResult = await response.json();
      const list = supabaseResult.data || [];
      return list.map((s: Station) => ({ ...s, source: 'open-meteo' as DataSource }));
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h
    retry: 2,
  });
}
