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

// Expected daily aggregate computed from TEST_30MIN
const EXPECTED_DAILY_FROM_30MIN: Observation = {
  timestamp: '2024-02-01',
  temperature: 12.4,
  humidity: 60,
  windSpeed: 2.3,
  windSpeedMax: 4.5,
  windGustTime: '10:30',
  windDirection: null,
  precipitation: 0,
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
        dateRange: {
          from: new Date('2024-02-01T00:00:00'),
          to: new Date('2024-02-01T23:59:59'),
        },
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

  it('refetches 30-min and computes daily when current data is busy (granularity=30min)', async () => {
    const refetchCurrent = vi.fn().mockResolvedValue({
      data: { data: [TEST_30MIN], dataSourceLabel: 'Fuente: XEMA - Estación: Test' },
      error: null,
    });
    const refetchOther = vi.fn();

    const { result } = renderHook(() =>
      useExcelExport({
        station: TEST_STATION,
        dateRange: {
          from: new Date('2024-02-01T00:00:00'),
          to: new Date('2024-02-03T23:59:59'),
        },
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
    expect(refetchOther).not.toHaveBeenCalled();
    expect(mockBuildAndDownloadExcel).toHaveBeenCalledWith(
      expect.objectContaining({
        obs30min: [TEST_30MIN],
        obsDaily: [EXPECTED_DAILY_FROM_30MIN],
        stationName: TEST_STATION.name,
        dataSourceLabel: 'Fuente: XEMA - Estación: Test',
        sourceDisplayName: 'XEMA (Transparència Catalunya)',
        activeGranularity: '30min',
        timezoneLabel: 'Europe/Madrid',
      }),
    );
  });

  it('fetches 30-min via refetchOther and computes daily when viewing daily granularity', async () => {
    const refetchCurrent = vi.fn();
    const refetchOther = vi.fn().mockResolvedValue({
      data: { data: [TEST_30MIN], dataSourceLabel: 'Fuente: XEMA - Estación: Test' },
      error: null,
    });

    const { result } = renderHook(() =>
      useExcelExport({
        station: TEST_STATION,
        dateRange: {
          from: new Date('2024-02-01T00:00:00'),
          to: new Date('2024-02-03T23:59:59'),
        },
        granularity: 'daily',
        observations: [],
        dataSourceLabel: 'Fuente: XEMA - Estación: Test',
        isLoading: false,
        isFetching: false,
        refetchObservations: refetchCurrent,
        refetchOtherObservations: refetchOther,
      }),
    );

    await act(async () => {
      await result.current.handleExportExcel();
    });

    expect(refetchOther).toHaveBeenCalledTimes(1);
    expect(refetchCurrent).not.toHaveBeenCalled();
    expect(mockBuildAndDownloadExcel).toHaveBeenCalledWith(
      expect.objectContaining({
        obs30min: [TEST_30MIN],
        obsDaily: [EXPECTED_DAILY_FROM_30MIN],
        activeGranularity: 'daily',
      }),
    );
  });
});
