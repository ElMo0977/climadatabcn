import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Header } from '@/components/Header';
import { StationSelector } from '@/components/StationSelector';
import { DateRangePicker } from '@/components/DateRangePicker';
import { WeatherKPIs } from '@/components/WeatherKPIs';
import { WeatherCharts } from '@/components/WeatherCharts';
import { DataTable } from '@/components/DataTable';
import { DownloadButtons } from '@/components/DownloadButtons';
import { CoverageAlerts } from '@/components/CoverageAlerts';
import { useStations } from '@/hooks/useStations';
import { useObservations } from '@/hooks/useObservations';
import { useExcelExport } from '@/hooks/useExcelExport';
import { calculateStats } from '@/lib/weatherUtils';
import { computeDailyCoverage } from '@/lib/dailyCoverage';
import { computeSubdailyCoverage } from '@/lib/subdailyCoverage';
import type { Station, DateRange, Granularity } from '@/types/weather';
import { AlertCircle, Loader2 } from 'lucide-react';
import { isXemaDebugEnabled } from '@/config/env';
import { buildQuickRangeExcludingToday } from '@/lib/quickDateRanges';

const LARGE_SUBDAILY_GAP_MIN_SLOTS = 4;

const Index = () => {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(() => buildQuickRangeExcludingToday(7));
  const [granularity, setGranularity] = useState<Granularity>('30min');

  const { 
    data: stations = [], 
    isLoading: stationsLoading, 
    error: stationsError,
    refetch: refetchStations,
    isFetching: stationsFetching,
  } = useStations();

  // Current view data
  const {
    data: observations = [],
    dataSourceLabel,
    isLoading: observationsLoading,
    error: observationsError,
    refetch: refetchObservations,
    isFetching: observationsFetching,
  } = useObservations({ station: selectedStation, dateRange, granularity });

  // Secondary dataset for export only (lazy).
  const otherGranularity: Granularity = granularity === '30min' ? 'daily' : '30min';
  const {
    refetch: refetchOtherObservations,
  } = useObservations({
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
    refetchStations();
    if (selectedStation) refetchObservations();
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

  const isRefreshing = stationsFetching || observationsFetching;

  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={handleRefresh} isRefreshing={isRefreshing} />
      
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <aside className="glass-card rounded-xl overflow-hidden h-[calc(100vh-140px)] lg:sticky lg:top-24">
            <StationSelector
              stations={stations}
              selectedStation={selectedStation}
              onSelectStation={setSelectedStation}
              isLoading={stationsLoading}
              error={stationsError}
            />
          </aside>

          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                granularity={granularity}
                onGranularityChange={setGranularity}
              />
              <DownloadButtons
                onDownloadExcel={handleExportExcel}
                disabled={!selectedStation || observations.length === 0}
              />
            </div>

            {observationsError && (
              <div className="glass-card rounded-xl p-4 border-destructive/50 bg-destructive/5">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-sm">Error al cargar datos</p>
                    <p className="text-xs text-muted-foreground">{observationsError.message}</p>
                  </div>
                </div>
              </div>
            )}

            {selectedStation && (
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display font-semibold text-lg">{selectedStation.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedStation.distance} km desde Barcelona
                      {selectedStation.elevation != null && ` · ${selectedStation.elevation} m altitud`}
                    </p>
                    {dataSourceLabel && (
                      <p className="text-xs text-muted-foreground mt-1">{dataSourceLabel}</p>
                    )}
                  </div>
                  {(observationsLoading || observationsFetching) && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                </div>
              </div>
            )}

            <CoverageAlerts
              dailyCoverage={dailyCoverage}
              subdailyCoverage={subdailyCoverage}
              showDaily={showDailyCoverageAlert}
              showSubdaily={showSubdailyCoverageAlert}
              showLargestGap={showLargestSubdailyGap}
              missingDaysText={missingDaysText}
            />

            <WeatherKPIs stats={stats} isLoading={observationsLoading} />

            <WeatherCharts
              observations={observations}
              granularity={granularity}
              isLoading={observationsLoading}
              dataSourceLabel={dataSourceLabel ?? undefined}
              stationName={selectedStation?.name}
            />

            <DataTable
              observations={observations}
              granularity={granularity}
              isLoading={observationsLoading}
            />
          </section>
        </div>
      </main>
    </div>
  );
};

export default Index;
