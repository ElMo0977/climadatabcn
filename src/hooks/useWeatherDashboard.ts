import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import { useStations } from './useStations';
import { useObservations } from './useObservations';
import { useExcelExport } from './useExcelExport';
import { useReferencePoint } from './useReferencePoint';
import { calculateStats } from '@/lib/weatherUtils';
import { computeDailyCoverage } from '@/lib/dailyCoverage';
import { computeSubdailyCoverage } from '@/lib/subdailyCoverage';
import { haversineDistanceKm } from '@/lib/stationGeo';
import type { Station, DateRange, Granularity } from '@/types/weather';
import { isXemaDebugEnabled } from '@/config/env';
import { buildQuickRangeExcludingToday } from '@/lib/quickDateRanges';

const LARGE_SUBDAILY_GAP_MIN_SLOTS = 4;
const DEFAULT_QUICK_RANGE_DAYS = 7;

function parseDayParam(value: string | null, boundary: 'start' | 'end'): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  if (boundary === 'start') {
    date.setHours(0, 0, 0, 0);
  } else {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function parseGranularityParam(value: string | null): Granularity {
  return value === 'daily' ? 'daily' : '30min';
}

function formatDayParam(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function readDateRangeFromParams(searchParams: URLSearchParams): DateRange | null {
  const from = parseDayParam(searchParams.get('from'), 'start');
  const to = parseDayParam(searchParams.get('to'), 'end');

  if (!from || !to || from.getTime() > to.getTime()) {
    return null;
  }

  return { from, to };
}

function areDateRangesEqual(a: DateRange, b: DateRange): boolean {
  return a.from.getTime() === b.from.getTime() && a.to.getTime() === b.to.getTime();
}

export function useWeatherDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultDateRangeRef = useRef<DateRange>(buildQuickRangeExcludingToday(DEFAULT_QUICK_RANGE_DAYS));
  const stationIdFromUrl = searchParams.get('station');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const lastUpdatedSignatureRef = useRef<string | null>(null);

  const {
    data: stations = [],
    metadataSource,
    warning: stationsWarning,
    isLoading: stationsLoading,
    error: stationsError,
    refetch: refetchStations,
    isFetching: stationsFetching,
  } = useStations();

  const {
    referencePoint,
    isGeocoding: isGeocodingReference,
    geocodeError: referenceGeoError,
    geocode: searchReferenceAddress,
  } = useReferencePoint();

  // Recompute station distances from the custom reference point and re-sort
  const stationsWithDistance = useMemo((): Station[] => {
    if (!referencePoint || stations.length === 0) return stations;
    return [...stations]
      .map((s) => ({
        ...s,
        distance: haversineDistanceKm(referencePoint.lat, referencePoint.lon, s.latitude, s.longitude),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [stations, referencePoint]);

  const dateRange = useMemo(
    () => readDateRangeFromParams(searchParams) ?? defaultDateRangeRef.current,
    [searchParams],
  );

  const granularity = parseGranularityParam(searchParams.get('granularity'));

  const selectedStation = useMemo(
    () => stationsWithDistance.find((station) => station.id === stationIdFromUrl) ?? null,
    [stationIdFromUrl, stationsWithDistance],
  );

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

  useEffect(() => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('from', formatDayParam(dateRange.from));
    nextSearchParams.set('to', formatDayParam(dateRange.to));
    nextSearchParams.set('granularity', granularity);

    if (nextSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [dateRange.from, dateRange.to, granularity, searchParams, setSearchParams]);

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
    if (!selectedStation) {
      lastUpdatedSignatureRef.current = null;
      setLastUpdatedAt(null);
      return;
    }

    if (observationsLoading || observationsFetching || observationsError) return;

    const requestSignature = [
      selectedStation.id,
      granularity,
      formatDayParam(dateRange.from),
      formatDayParam(dateRange.to),
    ].join('|');

    if (lastUpdatedSignatureRef.current === requestSignature) return;

    lastUpdatedSignatureRef.current = requestSignature;
    setLastUpdatedAt(new Date());
  }, [
    dateRange.from,
    dateRange.to,
    granularity,
    observationsError,
    observationsFetching,
    observationsLoading,
    selectedStation,
  ]);

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

  const setSelectedStation = (station: Station | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (station?.id) {
      nextSearchParams.set('station', station.id);
    } else {
      nextSearchParams.delete('station');
    }
    nextSearchParams.set('from', formatDayParam(dateRange.from));
    nextSearchParams.set('to', formatDayParam(dateRange.to));
    nextSearchParams.set('granularity', granularity);
    setSearchParams(nextSearchParams);
  };

  const setDateRange = (nextDateRange: DateRange) => {
    if (areDateRangesEqual(dateRange, nextDateRange)) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('from', formatDayParam(nextDateRange.from));
    nextSearchParams.set('to', formatDayParam(nextDateRange.to));
    nextSearchParams.set('granularity', granularity);
    if (selectedStation?.id) {
      nextSearchParams.set('station', selectedStation.id);
    } else {
      nextSearchParams.delete('station');
    }
    setSearchParams(nextSearchParams);
  };

  const setGranularity = (nextGranularity: Granularity) => {
    if (granularity === nextGranularity) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('from', formatDayParam(dateRange.from));
    nextSearchParams.set('to', formatDayParam(dateRange.to));
    nextSearchParams.set('granularity', nextGranularity);
    if (selectedStation?.id) {
      nextSearchParams.set('station', selectedStation.id);
    } else {
      nextSearchParams.delete('station');
    }
    setSearchParams(nextSearchParams);
  };

  const { handleExportExcel } = useExcelExport({
    station: selectedStation,
    dateRange,
    granularity,
    observations,
    dataSourceLabel,
    isLoading: observationsLoading,
    isFetching: observationsFetching,
    refetchObservations,
    refetchOtherObservations,
    referencePointLabel: referencePoint?.label,
  });

  return {
    selectedStation,
    setSelectedStation,
    dateRange,
    setDateRange,
    granularity,
    setGranularity,
    stations: stationsWithDistance,
    referencePoint,
    isGeocodingReference,
    referenceGeoError,
    searchReferenceAddress,
    metadataSource,
    stationsWarning,
    stationsLoading,
    stationsError,
    observations,
    dataSourceLabel,
    lastUpdatedAt,
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
