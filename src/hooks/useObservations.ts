import { useQuery } from '@tanstack/react-query';
import type { Observation, Granularity, DateRange } from '@/types/weather';
import { format } from 'date-fns';

interface ObservationsResponse {
  data: Observation[];
  cached: boolean;
}

interface UseObservationsParams {
  stationId: string | null;
  dateRange: DateRange;
  granularity: Granularity;
}

export function useObservations({ stationId, dateRange, granularity }: UseObservationsParams) {
  const fromStr = format(dateRange.from, 'yyyy-MM-dd');
  const toStr = format(dateRange.to, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['observations', stationId, fromStr, toStr, granularity],
    queryFn: async (): Promise<Observation[]> => {
      if (!stationId) return [];

      const params = new URLSearchParams({
        stationId,
        from: fromStr,
        to: toStr,
        granularity,
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/observations?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching observations: ${response.status}`);
      }

      const result: ObservationsResponse = await response.json();
      return result.data || [];
    },
    enabled: !!stationId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
  });
}
