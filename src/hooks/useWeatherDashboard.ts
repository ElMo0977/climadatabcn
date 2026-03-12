import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useStations } from '@/hooks/useStations';
import { useObservations } from '@/hooks/useObservations';
import { useExcelExport } from '@/hooks/useExcelExport';
import { calculateStats } from '@/lib/weatherUtils';
import { computeDailyCoverage } from '@/lib/dailyCoverage';
import { computeSubdailyCoverage } from '@/lib/subdailyCoverage';
import type { Station, DateRange, Granularity } from '@/types/weather';
import { isXemaDebugEnabled } from '@/config/env';
import { buildQuickRangeExcludingToday } from '@/lib/quickDateRanges';

const LARGE_SUBDAILY_GAP_MIN_SLOTS = 4;

export function useWeatherDashboard() {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(() => buildQuickRangeExcludingToday(7));
  const [granularity, setGranularity] = useState<Granularity>('30min');

  const {
    data: stations = [],
    warning: stationsWarning,
    isLoading: stationsLoading,
    error: stationsError,
    refetch: refetchStations,
    isFetching: stationsFetching,
  } = useStations();

  const {
    data: observations = [],
    dataSourceLabel,
    isLoading: observationsLoading,
    error: observationsError,
    refetch: refetchObservations,
    isFetching: observationsFetching,
  } = useObservations({ station: selectedStation, dateRange, granularity });

  const otherGranularity: Granularity = granularity === '30min' ? 'daily' : '30min';
  const { refetch: refetchOtherObservations } = useObservations({
    station: selectedStation,
    dateRange,
    granularity: otherGranularity,
    enabled: false,
  });

  const stats = useMemo(() => {
    if (observations.length === 0) return null;
    return calculateStats(observations);
  }, [observations]);

  const dailyCoverage = useMemo(() => {
    if (granularity !== 'daily') return null;
    return computeDailyCoverage(dateRange, observations);
  }, [dateRange, granularity, observations]);

  const subdailyCoverage = useMemo(() => {
    if (granularity !== '30min') return null;
    return computeSubdailyCoverage(dateRange, observations);
  }, [dateRange, granularity, observations]);

  const missingDaysText = useMemo(() => {
    if (!dailyCoverage || dailyCoverage.missingCount === 0) return '';
    return dailyCoverage.missingDays
      .map((day) => {
        try {
          return format(parseISO(day), 'd MMM', { locale: es });
        } catch {
          return day;
        }
      })
      .join(', ');
  }, [dailyCoverage]);

  const showDailyCoverageAlert =
    !!selectedStation &&
    granularity === 'daily' &&
    !!dailyCoverage &&
    dailyCoverage.missingCount > 0 &&
    !observationsLoading &&
    !observationsFetching &&
    !observationsError;

  const showSubdailyCoverageAlert =
    !!selectedStation &&
    granularity === '30min' &&
    !!subdailyCoverage &&
    subdailyCoverage.missingCount > 0 &&
    !observationsLoading &&
    !observationsFetching &&
    !observationsError;

  const showLargestSubdailyGap =
    !!subdailyCoverage?.largestGap &&
    subdailyCoverage.largestGap.missingCount >= LARGE_SUBDAILY_GAP_MIN_SLOTS;

  useEffect(() => {
    if (!isXemaDebugEnabled() || granularity !== 'daily' || !selectedStation) return;
    console.debug('[Index daily] observations diagnostics', {
      granularity,
      stationId: selectedStation.id,
      observationsLength: observations.length,
      firstTimestamp: observations[0]?.timestamp ?? null,
      lastTimestamp: observations[observations.length - 1]?.timestamp ?? null,
      firstDay: dailyCoverage?.availableDays[0] ?? null,
      lastDay: dailyCoverage?.availableDays[dailyCoverage.availableDays.length - 1] ?? null,
      expectedDays: dailyCoverage?.expectedCount ?? 0,
      availableDays: dailyCoverage?.availableCount ?? 0,
      missingDays: dailyCoverage?.missingDays ?? [],
    });
  }, [dailyCoverage, granularity, observations, selectedStation]);

  const handleRefresh = () => {
    void refetchStations();
    if (selectedStation) {
      void refetchObservations();
    }
  };

  const { handleExportExcel } = useExcelExport({
    station: selectedStation,
    granularity,
    observations,
    dataSourceLabel,
    isLoading: observationsLoading,
    isFetching: observationsFetching,
    refetchObservations,
    refetchOtherObservations,
  });

  return {
    selectedStation,
    setSelectedStation,
    dateRange,
    setDateRange,
    granularity,
    setGranularity,
    stations,
    stationsWarning,
    stationsLoading,
    stationsError,
    observations,
    dataSourceLabel,
    observationsLoading,
    observationsError,
    observationsFetching,
    stats,
    dailyCoverage,
    subdailyCoverage,
    missingDaysText,
    showDailyCoverageAlert,
    showSubdailyCoverageAlert,
    showLargestSubdailyGap,
    handleRefresh,
    handleExportExcel,
    isRefreshing: stationsFetching || observationsFetching,
  };
}
