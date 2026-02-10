import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
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
import { computeDailyCoverage } from '@/lib/dailyCoverage';
import type { Station, DateRange, Granularity } from '@/types/weather';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isXemaDebugEnabled } from '@/config/env';

const Index = () => {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });
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

  const handleExportExcel = async () => {
    if (!selectedStation) {
      toast.error('Selecciona una estación antes de exportar.');
      return;
    }

    try {
      const currentDataPromise = observationsLoading || observationsFetching
        ? refetchObservations().then((result) => {
            if (result.error) throw result.error;
            return result.data?.data ?? [];
          })
        : Promise.resolve(observations);

      const otherDataPromise = refetchOtherObservations().then((result) => {
        if (result.error) throw result.error;
        return result.data?.data ?? [];
      });

      const [currentData, otherData] = await Promise.all([currentDataPromise, otherDataPromise]);
      const obs30min = granularity === '30min' ? currentData : otherData;
      const obsDaily = granularity === 'daily' ? currentData : otherData;

      if (obs30min.length === 0 || obsDaily.length === 0) {
        throw new Error('No hay datos suficientes para generar las hojas de detalle y diario.');
      }

      const { buildAndDownloadExcel } = await import('@/lib/exportExcel');

      await buildAndDownloadExcel(
        obs30min,
        obsDaily,
        selectedStation.name || 'data',
        dataSourceLabel ?? undefined,
      );
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Error inesperado preparando la exportación.';
      toast.error(`No se pudo exportar el Excel: ${message}`);
    }
  };

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

            {granularity === 'daily' && dailyCoverage && dailyCoverage.missingCount > 0 && !observationsLoading && (
              <div className="glass-card rounded-xl p-3 border-amber-400/50 bg-amber-100/40">
                <p className="text-sm font-medium">
                  Datos disponibles para {dailyCoverage.availableCount} de {dailyCoverage.expectedCount} días.
                </p>
                <p className="text-xs text-muted-foreground">
                  Faltan datos para {dailyCoverage.missingCount} día{dailyCoverage.missingCount === 1 ? '' : 's'}: {missingDaysText}
                </p>
              </div>
            )}

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
