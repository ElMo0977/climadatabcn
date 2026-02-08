import { useQuery } from '@tanstack/react-query';
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
}

/** Variables que se piden al dataService para construir Observation[] */
const VARIABLES_HOURLY: WeatherVariable[] = [
  'temperature',
  'humidity',
  'windSpeed',
  'precipitation',
];
const VARIABLES_DAILY: WeatherVariable[] = [
  'temperature',
  'humidity',
  'windSpeed',
  'windSpeedMin',
  'windSpeedMax',
  'precipitation',
];

export interface UseObservationsResult {
  data: Observation[];
  dataSourceLabel: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

/** QueryKey para observaciones; cambiar granularity debe provocar refetch. Exportado para tests. */
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

/**
 * Open Data BCN vía dataService. Si la estación es de respaldo (open-meteo), datos vía Supabase.
 */
export function useObservations({
  station,
  dateRange,
  granularity,
}: UseObservationsParams): UseObservationsResult {
  const fromStr = format(dateRange.from, 'yyyy-MM-dd');
  const toStr = format(dateRange.to, 'yyyy-MM-dd');
  const agg: AggregationType = granularity === 'daily' ? 'daily' : 'hourly';
  const variables =
    agg === 'daily' ? VARIABLES_DAILY : VARIABLES_HOURLY;

  const queryKey = getObservationsQueryKey({
    stationId: station?.id ?? null,
    stationSource: station?.source ?? null,
    fromStr,
    toStr,
    granularity,
  });

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<{ data: Observation[]; dataSourceLabel: string }> => {
      if (!station) {
        return { data: [], dataSourceLabel: '' };
      }

      const stationName = station.name;
      const source = station.source;

      if (source === 'xema-transparencia') {
        const from = dateRange.from;
        const to = dateRange.to;
        const xemaGranularity = granularity === 'daily' ? 'day' : 'hour';
        const data = await getObservationsXema({
          stationId: station.id,
          from,
          to,
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
          withLabel
        );
        return { data: withLabel, dataSourceLabel };
      }

      if (source === 'opendata-bcn') {
        const from = dateRange.from;
        const to = dateRange.to;

        const results = await Promise.all(
          variables.map((variable) =>
            dataService.getTimeseries(station.id, from, to, variable, agg)
          )
        );

        const firstError = results.find((r) => r.error);
        if (firstError?.error) {
          throw new Error(firstError.error.message);
        }

        const firstData = results.find((r) => r.data);
        if (!firstData?.data) {
          return { data: [], dataSourceLabel: buildDataSourceLabel(source, stationName) };
        }

        const pointsByTs = new Map<
          string,
          Partial<Record<keyof Observation, number | null>>
        >();
        const keyByVariable: Partial<Record<WeatherVariable, keyof Observation>> = {
          temperature: 'temperature',
          humidity: 'humidity',
          windSpeed: 'windSpeed',
          windSpeedMin: 'windSpeedMin',
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
            if (!row) {
              row = {};
              pointsByTs.set(p.timestamp, row);
            }
            (row as Record<string, number | null>)[key] = p.value;
          }
        }

        const dataSourceLabel = buildDataSourceLabel(source, stationName);
        const data: Observation[] = Array.from(pointsByTs.entries())
          .sort(
            (a, b) =>
              new Date(a[0]).getTime() - new Date(b[0]).getTime()
          )
          .map(([timestamp, row]) => ({
            timestamp,
            temperature: row.temperature ?? null,
            humidity: row.humidity ?? null,
            windSpeed: row.windSpeed ?? null,
            windSpeedMin: row.windSpeedMin ?? null,
            windSpeedMax: row.windSpeedMax ?? null,
            precipitation: row.precipitation ?? null,
            dataSourceLabel,
          }));

        logDataDebug(
          {
            stationId: station.id,
            stationSource: source,
            from: fromStr,
            to: toStr,
            granularity,
            agg,
            provider: firstData?.provider,
          },
          data
        );
        return { data, dataSourceLabel };
      }

      const params = new URLSearchParams({
        stationId: station.id,
        from: fromStr,
        to: toStr,
        granularity: agg,
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/observations?${params}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Error fetching observations: ${response.status}`
        );
      }

      const result: ObservationsResponse = await response.json();
      const list = result.data || [];
      const dataSourceLabel = `${FALLBACK_LABEL} - Estación: ${stationName}`;
      const withLabel = list.map((obs) => ({
        ...obs,
        dataSourceLabel,
      }));

      logDataDebug(
        {
          stationId: station.id,
          stationSource: 'open-meteo',
          from: fromStr,
          to: toStr,
          granularity,
          agg,
        },
        withLabel
      );
      return { data: withLabel, dataSourceLabel };
    },
    enabled: !!station,
    staleTime: 15 * 60 * 1000,
    retry: 2,
  });

  const data = query.data?.data ?? [];
  const dataSourceLabel = query.data?.dataSourceLabel ?? null;

  return {
    data,
    dataSourceLabel,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
