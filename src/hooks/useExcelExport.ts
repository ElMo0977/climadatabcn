import type { Observation, Granularity, Station, DateRange } from '@/types/weather';
import type { ObservationsRefetchFn } from '@/hooks/useObservations';
import { buildAndDownloadExcel } from '@/lib/exportExcel';
import { aggregate30minToDaily } from '@/lib/weatherUtils';
import { getSourceLabel } from '@/config/sources';
import { toast } from 'sonner';

function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.name === 'ChunkLoadError' ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('ChunkLoadError')
    );
  }

  if (typeof error === 'string') {
    return (
      error.includes('Failed to fetch dynamically imported module') ||
      error.includes('Loading chunk') ||
      error.includes('ChunkLoadError')
    );
  }

  return false;
}

interface UseExcelExportParams {
  station: Station | null;
  dateRange: DateRange;
  granularity: Granularity;
  observations: Observation[];
  dataSourceLabel: string | null;
  isLoading: boolean;
  isFetching: boolean;
  refetchObservations: ObservationsRefetchFn;
  refetchOtherObservations: ObservationsRefetchFn;
}

export function useExcelExport({
  station,
  dateRange,
  granularity,
  observations,
  dataSourceLabel,
  isLoading,
  isFetching,
  refetchObservations,
  refetchOtherObservations,
}: UseExcelExportParams) {
  const handleExportExcel = async () => {
    if (!station) {
      toast.error('Selecciona una estación antes de exportar.');
      return;
    }

    try {
      // Always use 30-min data as the source for both sheets.
      // The daily API has a ~2-day lag; aggregating from 30-min gives complete data.
      const obs30min: Observation[] =
        granularity === '30min'
          ? isLoading || isFetching
            ? await refetchObservations().then((result) => {
                if (result.error) throw result.error;
                return result.data?.data ?? [];
              })
            : observations
          : await refetchOtherObservations().then((result) => {
              if (result.error) throw result.error;
              return result.data?.data ?? [];
            });

      const obsDaily = aggregate30minToDaily(obs30min);

      if (obs30min.length === 0) {
        throw new Error('No hay datos suficientes para generar las hojas de detalle y diario.');
      }

      await buildAndDownloadExcel({
        obs30min,
        obsDaily,
        stationName: station.name || 'data',
        dataSourceLabel: dataSourceLabel ?? undefined,
        sourceDisplayName: getSourceLabel(station.source ?? 'xema-transparencia'),
        dateRange,
        activeGranularity: granularity,
        timezoneLabel: 'Europe/Madrid',
      });
    } catch (error) {
      console.error(error);
      if (isChunkLoadError(error)) {
        toast.error('No se pudo cargar el módulo de exportación (posible caché). Recarga con Ctrl/Cmd+Shift+R y vuelve a intentar.');
        return;
      }

      const message = error instanceof Error
        ? error.message
        : 'Error inesperado preparando la exportación.';
      toast.error(`No se pudo exportar el Excel: ${message}`);
    }
  };

  return { handleExportExcel };
}
