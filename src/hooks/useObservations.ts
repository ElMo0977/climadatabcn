import { useQuery, type QueryObserverResult } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { Observation, Granularity, DateRange, Station } from '@/types/weather';
import { buildDataSourceLabel } from '@/config/sources';
import { logDataDebug } from '@/lib/dataDebug';
import { getObservations as getObservationsXema } from '@/services/providers/xemaTransparencia';

interface UseObservationsParams {
  station: Station | null;
  dateRange: DateRange;
  granularity: Granularity;
  enabled?: boolean;
}

export interface ObservationsQueryData {
  data: Observation[];
  dataSourceLabel: string;
}

export interface UseObservationsResult {
  data: Observation[];
  dataSourceLabel: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<QueryObserverResult<ObservationsQueryData, Error>>;
  isFetching: boolean;
}

export function getObservationsQueryKey(params: {
  stationId: string | null;
  stationSource: string | null;
  fromStr: string;
  toStr: string;
  granularity: Granularity;
}): unknown[] {
  return [
    'observations',
    params.stationId ?? null,
    params.stationSource ?? null,
    params.fromStr,
    params.toStr,
    params.granularity,
  ];
}

export function useObservations({
  station,
  dateRange,
  granularity,
  enabled = true,
}: UseObservationsParams): UseObservationsResult {
  const fromStr = format(dateRange.from, 'yyyy-MM-dd');
  const toStr = format(dateRange.to, 'yyyy-MM-dd');

  const queryKey = getObservationsQueryKey({
    stationId: station?.id ?? null,
    stationSource: station?.source ?? null,
    fromStr,
    toStr,
    granularity,
  });

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ObservationsQueryData> => {
      if (!station) {
        return { data: [], dataSourceLabel: '' };
      }

      const stationName = station.name;
      const source = station.source ?? 'xema-transparencia';
      if (source !== 'xema-transparencia') {
        throw new Error('Fuente no soportada: solo XEMA está habilitada.');
      }

      const xemaGranularity = granularity === 'daily' ? 'day' : '30min';
      const data = await getObservationsXema({
        stationId: station.id,
        from: dateRange.from,
        to: dateRange.to,
        granularity: xemaGranularity,
      });
      const dataSourceLabel = buildDataSourceLabel(source, stationName);
      const withLabel = data.map((obs) => ({ ...obs, dataSourceLabel }));
      logDataDebug(
        {
          stationId: station.id,
          stationSource: source,
          from: fromStr,
          to: toStr,
          granularity,
          agg: xemaGranularity === 'day' ? 'daily' : 'hourly',
          provider: 'xema-transparencia',
        },
        withLabel,
      );
      return { data: withLabel, dataSourceLabel };
    },
    enabled: enabled && !!station,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    data: query.data?.data ?? [],
    dataSourceLabel: query.data?.dataSourceLabel ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
