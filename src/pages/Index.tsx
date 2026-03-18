import { lazy, Suspense } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Header } from '@/components/Header';
import { StationSelector } from '@/components/StationSelector';
import { DateRangePicker } from '@/components/DateRangePicker';
import { WeatherKPIs } from '@/components/WeatherKPIs';
import { DataTable } from '@/components/DataTable';
import { DownloadButtons } from '@/components/DownloadButtons';
import { CoverageAlerts } from '@/components/CoverageAlerts';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useWeatherDashboard } from '@/hooks/useWeatherDashboard';

const LazyWeatherCharts = lazy(async () => {
  const mod = await import('@/components/WeatherCharts');
  return { default: mod.WeatherCharts };
});

const Index = () => {
  const {
    selectedStation,
    setSelectedStation,
    dateRange,
    setDateRange,
    granularity,
    setGranularity,
    stations,
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
    isRefreshing,
  } = useWeatherDashboard();

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
              warning={stationsWarning}
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Metadata estaciones: {metadataSource ?? '—'} · Hora local de Barcelona (Europe/Madrid)
                    </p>
                    {lastUpdatedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Última actualización: {format(lastUpdatedAt, 'd MMM yyyy HH:mm', { locale: es })}
                      </p>
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

            <Suspense
              fallback={
                <div className="chart-container flex items-center justify-center h-64">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              }
            >
              <LazyWeatherCharts
                observations={observations}
                granularity={granularity}
                isLoading={observationsLoading}
                dataSourceLabel={dataSourceLabel ?? undefined}
              />
            </Suspense>

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
