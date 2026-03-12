import { useQuery, type QueryObserverResult } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ProviderError,
  type Observation,
  type Granularity,
  type DateRange,
  type Station,
} from '@/types/weather';
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
  error: ProviderError | null;
  refetch: ObservationsRefetchFn;
  isFetching: boolean;
}

export type ObservationsQueryKey = readonly [
  'observations',
  string | null,
  string | null,
  string,
  string,
  Granularity,
];

export type ObservationsRefetchResult = QueryObserverResult<ObservationsQueryData, ProviderError>;
export type ObservationsRefetchFn = () => Promise<ObservationsRefetchResult>;

export function getObservationsQueryKey(params: {
  stationId: string | null;
  stationSource: string | null;
  fromStr: string;
  toStr: string;
  granularity: Granularity;
}): ObservationsQueryKey {
  return [
    'observations',
    params.stationId ?? null,
    params.stationSource ?? null,
    params.fromStr,
    params.toStr,
    params.granularity,
  ] as const;
}

const RETRYABLE_CODES = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'PROVIDER_ERROR',
  'RATE_LIMITED',
]);

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

  const query = useQuery<ObservationsQueryData, ProviderError>({
    queryKey,
    queryFn: async ({ signal }): Promise<ObservationsQueryData> => {
      if (!station) {
        return { data: [], dataSourceLabel: '' };
      }

      const stationName = station.name;
      const source = station.source ?? 'xema-transparencia';
      if (source !== 'xema-transparencia') {
        throw new ProviderError({
          code: 'INVALID_PARAMS',
          message: 'Fuente no soportada: solo XEMA está habilitada.',
        });
      }

      const xemaGranularity = granularity === 'daily' ? 'day' : '30min';
      const data = await getObservationsXema({
        stationId: station.id,
        from: dateRange.from,
        to: dateRange.to,
        granularity: xemaGranularity,
        signal,
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
    retry: (failureCount, error) =>
      failureCount < 2 && !!error && RETRYABLE_CODES.has(error.code),
  });

  return {
    data: query.data?.data ?? [],
    dataSourceLabel: query.data?.dataSourceLabel ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
