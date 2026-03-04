import type { Observation, Granularity, Station } from '@/types/weather';
import { buildAndDownloadExcel } from '@/lib/exportExcel';
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
  granularity: Granularity;
  observations: Observation[];
  dataSourceLabel: string | null;
  isLoading: boolean;
  isFetching: boolean;
  refetchObservations: () => Promise<{ data?: { data: Observation[] }; error: Error | null }>;
  refetchOtherObservations: () => Promise<{ data?: { data: Observation[] }; error: Error | null }>;
}

export function useExcelExport({
  station,
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
      const currentDataPromise = isLoading || isFetching
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

      await buildAndDownloadExcel(
        obs30min,
        obsDaily,
        station.name || 'data',
        dataSourceLabel ?? undefined,
      );
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
