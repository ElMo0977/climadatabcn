import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Observation, Station } from '@/types/weather';
import { buildAndDownloadExcel } from '@/lib/exportExcel';
import { toast } from 'sonner';
import { useExcelExport } from './useExcelExport';

vi.mock('@/lib/exportExcel', () => ({
  buildAndDownloadExcel: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockBuildAndDownloadExcel = vi.mocked(buildAndDownloadExcel);
const mockToastError = vi.mocked(toast.error);

const TEST_STATION: Station = {
  id: 'X4',
  name: 'Barcelona - el Raval',
  latitude: 41.3839,
  longitude: 2.16775,
  elevation: 33,
  distance: 0.5,
  source: 'xema-transparencia',
};

const TEST_30MIN: Observation = {
  timestamp: '2024-02-01T10:30:00',
  temperature: 12.4,
  humidity: 60,
  windSpeed: 2.3,
  windSpeedMax: 4.5,
  windDirection: 180,
  precipitation: 0,
};

const TEST_DAILY: Observation = {
  timestamp: '2024-02-01',
  temperature: 13,
  humidity: 58,
  windSpeed: 2.1,
  windSpeedMax: 6.2,
  windDirection: null,
  precipitation: 0.4,
  windGustTime: '16:00',
};

describe('useExcelExport', () => {
  beforeEach(() => {
    mockBuildAndDownloadExcel.mockReset();
    mockToastError.mockReset();
  });

  it('shows a toast when no station is selected', async () => {
    const { result } = renderHook(() =>
      useExcelExport({
        station: null,
        granularity: '30min',
        observations: [],
        dataSourceLabel: null,
        isLoading: false,
        isFetching: false,
        refetchObservations: vi.fn() as never,
        refetchOtherObservations: vi.fn() as never,
      }),
    );

    await act(async () => {
      await result.current.handleExportExcel();
    });

    expect(mockToastError).toHaveBeenCalledWith('Selecciona una estación antes de exportar.');
  });

  it('refetches both granularities and builds the workbook when current data is busy', async () => {
    const refetchCurrent = vi.fn().mockResolvedValue({
      data: { data: [TEST_30MIN], dataSourceLabel: 'Fuente: XEMA - Estación: Test' },
      error: null,
    });
    const refetchOther = vi.fn().mockResolvedValue({
      data: { data: [TEST_DAILY], dataSourceLabel: 'Fuente: XEMA - Estación: Test' },
      error: null,
    });

    const { result } = renderHook(() =>
      useExcelExport({
        station: TEST_STATION,
        granularity: '30min',
        observations: [],
        dataSourceLabel: 'Fuente: XEMA - Estación: Test',
        isLoading: true,
        isFetching: false,
        refetchObservations: refetchCurrent,
        refetchOtherObservations: refetchOther,
      }),
    );

    await act(async () => {
      await result.current.handleExportExcel();
    });

    expect(refetchCurrent).toHaveBeenCalledTimes(1);
    expect(refetchOther).toHaveBeenCalledTimes(1);
    expect(mockBuildAndDownloadExcel).toHaveBeenCalledWith(
      [TEST_30MIN],
      [TEST_DAILY],
      TEST_STATION.name,
      'Fuente: XEMA - Estación: Test',
    );
  });
});
