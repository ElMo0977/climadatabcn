import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Observation, Station } from '@/types/weather';
import Index from './Index';
import { useStations } from '@/hooks/useStations';
import { useObservations } from '@/hooks/useObservations';
import { buildAndDownloadExcel } from '@/lib/exportExcel';
import { toast } from 'sonner';

const uiConsistency = vi.hoisted(() => ({
  kpiDataPoints: null as number | null,
  chartLength: null as number | null,
}));

vi.mock('@/hooks/useStations', () => ({
  useStations: vi.fn(),
}));

vi.mock('@/hooks/useObservations', () => ({
  useObservations: vi.fn(),
}));

vi.mock('@/lib/exportExcel', () => ({
  buildAndDownloadExcel: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/components/Header', () => ({
  Header: () => <div>header</div>,
}));

vi.mock('@/components/StationSelector', () => ({
  StationSelector: ({ stations, onSelectStation }: { stations: Station[]; onSelectStation: (station: Station) => void }) => (
    <button onClick={() => onSelectStation(stations[0])}>select-station</button>
  ),
}));

vi.mock('@/components/DateRangePicker', () => ({
  DateRangePicker: ({ onGranularityChange }: { onGranularityChange: (granularity: '30min' | 'daily') => void }) => (
    <button onClick={() => onGranularityChange('daily')}>set-daily</button>
  ),
}));

vi.mock('@/components/WeatherKPIs', () => ({
  WeatherKPIs: ({ stats }: { stats: { dataPoints?: number } | null }) => {
    uiConsistency.kpiDataPoints = typeof stats?.dataPoints === 'number' ? stats.dataPoints : null;
    return <div>kpis</div>;
  },
}));

vi.mock('@/components/WeatherCharts', () => ({
  WeatherCharts: ({ observations }: { observations: Observation[] }) => {
    uiConsistency.chartLength = observations.length;
    return <div>charts</div>;
  },
}));

vi.mock('@/components/DataTable', () => ({
  DataTable: () => <div>table</div>,
}));

const mockUseStations = vi.mocked(useStations);
const mockUseObservations = vi.mocked(useObservations);
const mockBuildAndDownloadExcel = vi.mocked(buildAndDownloadExcel);
const mockToastError = vi.mocked(toast.error);

const TEST_STATION: Station = {
  id: 'X2',
  name: 'Observatori Fabra',
  latitude: 41.4184,
  longitude: 2.1239,
  elevation: 411,
  distance: 6.6,
  source: 'xema-transparencia',
};

const TEST_OBSERVATION: Observation = {
  timestamp: '2025-01-01T00:00:00',
  temperature: 10,
  humidity: 80,
  windSpeed: 1.5,
  windSpeedMax: 2.5,
  windDirection: 90,
  precipitation: 0,
};

describe('Index export and query behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uiConsistency.kpiDataPoints = null;
    uiConsistency.chartLength = null;
    mockUseStations.mockReturnValue({
      data: [TEST_STATION],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as ReturnType<typeof useStations>);
  });

  it('does not activate 30min query in normal daily view', async () => {
    mockUseObservations.mockImplementation((params: unknown) => {
      const p = params as { station: Station | null; granularity: '30min' | 'daily'; enabled?: boolean };
      const hasStation = !!p.station;
      return {
        data: hasStation && p.granularity === 'daily' ? [TEST_OBSERVATION] : [],
        dataSourceLabel: hasStation ? 'Fuente: XEMA - Estación: Fabra' : null,
        isLoading: false,
        error: null,
        refetch: vi.fn().mockResolvedValue({
          data: { data: [TEST_OBSERVATION], dataSourceLabel: 'Fuente: XEMA - Estación: Fabra' },
          error: null,
        }),
        isFetching: false,
      } as ReturnType<typeof useObservations>;
    });

    render(<Index />);
    fireEvent.click(screen.getByRole('button', { name: 'set-daily' }));
    fireEvent.click(screen.getByRole('button', { name: 'select-station' }));

    await waitFor(() => {
      const calls = mockUseObservations.mock.calls.map(([params]) => params as {
        station: Station | null;
        granularity: '30min' | 'daily';
        enabled?: boolean;
      });

      const dailyMainQuery = calls.some((p) => !!p.station && p.granularity === 'daily' && p.enabled !== false);
      const active30minQuery = calls.some((p) => !!p.station && p.granularity === '30min' && p.enabled !== false);

      expect(dailyMainQuery).toBe(true);
      expect(active30minQuery).toBe(false);
    });
  });

  it('shows visible error and avoids Excel generation when secondary dataset fails', async () => {
    const refetchPrimary = vi.fn().mockResolvedValue({
      data: { data: [TEST_OBSERVATION], dataSourceLabel: 'Fuente: XEMA - Estación: Fabra' },
      error: null,
    });
    const refetchSecondary = vi.fn().mockResolvedValue({
      data: undefined,
      error: new Error('fallo en dataset secundario'),
    });

    mockUseObservations.mockImplementation((params: unknown) => {
      const p = params as { station: Station | null; enabled?: boolean };
      const hasStation = !!p.station;
      if (p.enabled === false) {
        return {
          data: [],
          dataSourceLabel: null,
          isLoading: false,
          error: null,
          refetch: refetchSecondary,
          isFetching: false,
        } as ReturnType<typeof useObservations>;
      }
      return {
        data: hasStation ? [TEST_OBSERVATION] : [],
        dataSourceLabel: hasStation ? 'Fuente: XEMA - Estación: Fabra' : null,
        isLoading: false,
        error: null,
        refetch: refetchPrimary,
        isFetching: false,
      } as ReturnType<typeof useObservations>;
    });

    render(<Index />);
    fireEvent.click(screen.getByRole('button', { name: 'select-station' }));

    const exportButton = screen.getByRole('button', { name: /Excel/i });
    await waitFor(() => expect(exportButton).not.toBeDisabled());
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(refetchSecondary).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledTimes(1);
      expect(mockBuildAndDownloadExcel).not.toHaveBeenCalled();
    });
  });

  it('keeps KPI "Datos" aligned with chart observations length in daily view', async () => {
    const dailyObservations: Observation[] = [
      { ...TEST_OBSERVATION, timestamp: '2025-01-01T00:00:00' },
      { ...TEST_OBSERVATION, timestamp: '2025-01-02T00:00:00' },
      { ...TEST_OBSERVATION, timestamp: '2025-01-03T00:00:00' },
      { ...TEST_OBSERVATION, timestamp: '2025-01-04T00:00:00' },
      { ...TEST_OBSERVATION, timestamp: '2025-01-05T00:00:00' },
      { ...TEST_OBSERVATION, timestamp: '2025-01-06T00:00:00' },
      { ...TEST_OBSERVATION, timestamp: '2025-01-07T00:00:00' },
    ];

    mockUseObservations.mockImplementation((params: unknown) => {
      const p = params as { station: Station | null; granularity: '30min' | 'daily'; enabled?: boolean };
      const hasStation = !!p.station;
      const data = hasStation && p.granularity === 'daily' ? dailyObservations : [];
      return {
        data,
        dataSourceLabel: hasStation ? 'Fuente: XEMA - Estación: Fabra' : null,
        isLoading: false,
        error: null,
        refetch: vi.fn().mockResolvedValue({
          data: { data, dataSourceLabel: 'Fuente: XEMA - Estación: Fabra' },
          error: null,
        }),
        isFetching: false,
      } as ReturnType<typeof useObservations>;
    });

    render(<Index />);
    fireEvent.click(screen.getByRole('button', { name: 'set-daily' }));
    fireEvent.click(screen.getByRole('button', { name: 'select-station' }));

    await waitFor(() => {
      expect(uiConsistency.chartLength).toBe(dailyObservations.length);
      expect(uiConsistency.kpiDataPoints).toBe(dailyObservations.length);
      expect(uiConsistency.kpiDataPoints).toBe(uiConsistency.chartLength);
    });
  });
});
