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
import {
  getObservations as getObservationsXema,
  getWebDailyReadings,
} from '@/services/providers/xemaTransparencia';
import { buildExpectedDayKeys } from '@/lib/dailyCoverage';
import { buildWebDailyObservations } from '@/lib/webDailyObservations';
import type { DailyQuality } from '@/lib/dailyQuality';

interface UseObservationsParams {
  station: Station | null;
  dateRange: DateRange;
  granularity: Granularity;
  enabled?: boolean;
}

export interface ObservationsQueryData {
  data: Observation[];
  dataSourceLabel: string;
  dailyQualityByDay?: Record<string, DailyQuality>;
}

export interface UseObservationsResult {
  data: Observation[];
  dataSourceLabel: string | null;
  dailyQualityByDay: Record<string, DailyQuality> | null;
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

      // Daily web aggregation uses padded UTC readings; the 30min/Excel source
      // deliberately retains its existing request and legacy aggregation.
      let data: Observation[];
      let dailyQualityByDay: Record<string, DailyQuality> | undefined;
      if (granularity === 'daily') {
        const raw = await getWebDailyReadings({
          stationId: station.id, fromDay: fromStr, toDay: toStr, signal,
        });
        const daily = buildWebDailyObservations(buildExpectedDayKeys(dateRange), raw);
        data = daily.data;
        dailyQualityByDay = daily.qualityByDay;
      } else {
        data = await getObservationsXema({
          stationId: station.id,
          from: dateRange.from,
          to: dateRange.to,
          granularity: '30min',
          signal,
        });
      }
      const dataSourceLabel = buildDataSourceLabel(source, stationName);
      const withLabel = data.map((obs) => ({ ...obs, dataSourceLabel }));
      logDataDebug(
        {
          stationId: station.id,
          stationSource: source,
          from: fromStr,
          to: toStr,
          granularity,
          agg: granularity === 'daily' ? 'daily-from-30min' : 'subdaily',
          provider: 'xema-transparencia',
        },
        withLabel,
      );
      return { data: withLabel, dataSourceLabel, dailyQualityByDay };
    },
    enabled: enabled && !!station,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) =>
      failureCount < 2 && !!error && RETRYABLE_CODES.has(error.code),
  });

  return {
    data: query.data?.data ?? [],
    dataSourceLabel: query.data?.dataSourceLabel ?? null,
    dailyQualityByDay: granularity === 'daily' ? query.data?.dailyQualityByDay ?? null : null,
    isLoading: query.isLoading,
    error: query.error ?? null,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
