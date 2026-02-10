import { useQuery, type QueryObserverResult } from '@tanstack/react-query';
import { format } from 'date-fns';
import { dataService } from '@/services/dataService';
import type { Observation, Granularity, DateRange, Station } from '@/types/weather';
import type { WeatherVariable, AggregationType } from '@/domain/types';
import { buildDataSourceLabel, FALLBACK_LABEL } from '@/config/sources';
import { logDataDebug } from '@/lib/dataDebug';
import { getObservations as getObservationsXema } from '@/services/providers/xemaTransparencia';

interface ObservationsResponse {
  data: Observation[];
  cached: boolean;
}

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
      const source = station.source;

      if (source === 'xema-transparencia') {
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
      }

      if (source === 'opendata-bcn') {
        const agg: AggregationType = granularity === 'daily' ? 'daily' : 'hourly';
        const variables: WeatherVariable[] = [
          'temperature', 'humidity', 'windSpeed', 'windSpeedMax', 'precipitation',
        ];
        const results = await Promise.all(
          variables.map((variable) =>
            dataService.getTimeseries(station.id, dateRange.from, dateRange.to, variable, agg),
          ),
        );
        const firstError = results.find((r) => r.error);
        if (firstError?.error) throw new Error(firstError.error.message);
        const firstData = results.find((r) => r.data);
        if (!firstData?.data) {
          return { data: [], dataSourceLabel: buildDataSourceLabel(source, stationName) };
        }

        const pointsByTs = new Map<string, Partial<Record<string, number | null>>>();
        const keyByVariable: Record<string, string> = {
          temperature: 'temperature',
          humidity: 'humidity',
          windSpeed: 'windSpeed',
          windSpeedMax: 'windSpeedMax',
          precipitation: 'precipitation',
        };
        for (let i = 0; i < results.length; i++) {
          const res = results[i];
          if (!res.data) continue;
          const key = keyByVariable[variables[i]];
          if (!key) continue;
          for (const p of res.data.points) {
            let row = pointsByTs.get(p.timestamp);
            if (!row) { row = {}; pointsByTs.set(p.timestamp, row); }
            row[key] = p.value;
          }
        }

        const dataSourceLabel = buildDataSourceLabel(source, stationName);
        const data: Observation[] = Array.from(pointsByTs.entries())
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([timestamp, row]) => ({
            timestamp,
            temperature: (row.temperature as number) ?? null,
            humidity: (row.humidity as number) ?? null,
            windSpeed: (row.windSpeed as number) ?? null,
            windSpeedMax: (row.windSpeedMax as number) ?? null,
            windDirection: null,
            precipitation: (row.precipitation as number) ?? null,
            dataSourceLabel,
          }));
        logDataDebug(
          { stationId: station.id, stationSource: source, from: fromStr, to: toStr, granularity, agg, provider: firstData?.provider },
          data,
        );
        return { data, dataSourceLabel };
      }

      // Fallback: Supabase/Open-Meteo
      const agg = granularity === 'daily' ? 'daily' : 'hourly';
      const params = new URLSearchParams({
        stationId: station.id, from: fromStr, to: toStr, granularity: agg,
      });
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/observations?${params}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error fetching observations: ${response.status}`);
      }
      const result: ObservationsResponse = await response.json();
      const list = result.data || [];
      const dsl = `${FALLBACK_LABEL} - Estación: ${stationName}`;
      const withLabel = list.map((obs) => ({ ...obs, dataSourceLabel: dsl }));
      logDataDebug(
        { stationId: station.id, stationSource: 'open-meteo', from: fromStr, to: toStr, granularity, agg },
        withLabel,
      );
      return { data: withLabel, dataSourceLabel: dsl };
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
