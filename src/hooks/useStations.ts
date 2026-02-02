import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Station } from '@/types/weather';

interface StationsResponse {
  data: Station[];
  cached: boolean;
}

// Barcelona center coordinates
const BARCELONA_LAT = 41.3851;
const BARCELONA_LON = 2.1734;
const DEFAULT_RADIUS_KM = 50;

export function useStations() {
  return useQuery({
    queryKey: ['stations', BARCELONA_LAT, BARCELONA_LON, DEFAULT_RADIUS_KM],
    queryFn: async (): Promise<Station[]> => {
      const { data, error } = await supabase.functions.invoke<StationsResponse>('stations', {
        body: null,
        headers: {},
      });

      // Try with query params in URL
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stations?lat=${BARCELONA_LAT}&lon=${BARCELONA_LON}&radiusKm=${DEFAULT_RADIUS_KM}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching stations: ${response.status}`);
      }

      const result: StationsResponse = await response.json();
      return result.data || [];
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
  });
}
