import { useState, useMemo } from 'react';
import { subDays } from 'date-fns';
import { Header } from '@/components/Header';
import { StationSelector } from '@/components/StationSelector';
import { DateRangePicker } from '@/components/DateRangePicker';
import { WeatherKPIs } from '@/components/WeatherKPIs';
import { WeatherCharts } from '@/components/WeatherCharts';
import { DataTable } from '@/components/DataTable';
import { DownloadButtons } from '@/components/DownloadButtons';
import { useStations } from '@/hooks/useStations';
import { useObservations } from '@/hooks/useObservations';
import { calculateStats } from '@/lib/weatherUtils';
import type { Station, DateRange, Granularity } from '@/types/weather';
import { AlertCircle, Loader2 } from 'lucide-react';

const Index = () => {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });
  const [granularity, setGranularity] = useState<Granularity>('daily');

  const { 
    data: stations = [], 
    isLoading: stationsLoading, 
    error: stationsError,
    refetch: refetchStations,
    isFetching: stationsFetching,
  } = useStations();

  // Vista diaria: pedir datos horarios para calcular media ponderada temporal (suma(velocidades)/N).
  const granularityForFetch = granularity === 'daily' ? 'hourly' : granularity;
  const {
    data: observations = [],
    isLoading: observationsLoading,
    error: observationsError,
    refetch: refetchObservations,
    isFetching: observationsFetching,
  } = useObservations({
    stationId: selectedStation?.id || null,
    dateRange,
    granularity: granularityForFetch,
  });

  const stats = useMemo(() => {
    if (observations.length === 0) return null;
    return calculateStats(observations);
  }, [observations]);

  const handleRefresh = () => {
    refetchStations();
    if (selectedStation) {
      refetchObservations();
    }
  };

  const isRefreshing = stationsFetching || observationsFetching;
  const hasError = stationsError || observationsError;

  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={handleRefresh} isRefreshing={isRefreshing} />
      
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          {/* Left Panel - Station Selector */}
          <aside className="glass-card rounded-xl overflow-hidden h-[calc(100vh-140px)] lg:sticky lg:top-24">
            <StationSelector
              stations={stations}
              selectedStation={selectedStation}
              onSelectStation={setSelectedStation}
              isLoading={stationsLoading}
              error={stationsError}
            />
          </aside>

          {/* Right Panel - Data Visualization */}
          <section className="space-y-6">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                granularity={granularity}
                onGranularityChange={setGranularity}
              />
              <DownloadButtons
                observations={observations}
                stationName={selectedStation?.name || 'data'}
                disabled={observations.length === 0}
                granularity={granularity}
              />
            </div>

            {/* Error State */}
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

            {/* Selected Station Info */}
            {selectedStation && (
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display font-semibold text-lg">{selectedStation.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedStation.distance} km desde Barcelona • 
                      {selectedStation.elevation !== null && ` ${selectedStation.elevation}m altitud`}
                    </p>
                  </div>
                  {(observationsLoading || observationsFetching) && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                </div>
              </div>
            )}

            {/* KPIs */}
            <WeatherKPIs stats={stats} isLoading={observationsLoading} />

            {/* Charts */}
            <WeatherCharts
              observations={observations}
              granularity={granularity}
              isLoading={observationsLoading}
            />

            {/* Data Table */}
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
