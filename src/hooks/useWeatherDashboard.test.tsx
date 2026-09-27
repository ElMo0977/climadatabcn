import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { format } from 'date-fns';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Observation, Station } from '@/types/weather';
import { assessDailyQuality } from '@/lib/dailyQuality';
import { useStations } from '@/hooks/useStations';
import { useObservations } from '@/hooks/useObservations';
import { useExcelExport } from '@/hooks/useExcelExport';
import { useWeatherDashboard } from './useWeatherDashboard';

vi.mock('@/hooks/useStations', () => ({
  useStations: vi.fn(),
}));

vi.mock('@/hooks/useObservations', () => ({
  useObservations: vi.fn(),
}));

vi.mock('@/hooks/useExcelExport', () => ({
  useExcelExport: vi.fn(),
}));

const mockUseStations = vi.mocked(useStations);
const mockUseObservations = vi.mocked(useObservations);
const mockUseExcelExport = vi.mocked(useExcelExport);

const STATIONS: Station[] = [
  {
    id: 'X4',
    name: 'Barcelona - el Raval',
    latitude: 41.38,
    longitude: 2.17,
    elevation: 33,
    distance: 1,
    municipality: 'Barcelona',
    source: 'xema-transparencia',
  },
  {
    id: 'WU',
    name: 'Badalona - Museu',
    latitude: 41.45,
    longitude: 2.24,
    elevation: 42,
    distance: 8,
    municipality: 'Badalona',
    source: 'xema-transparencia',
  },
];

const TEST_OBSERVATION: Observation = {
  timestamp: '2024-02-01T10:30:00',
  temperature: 12,
  humidity: 60,
  windSpeed: 2.3,
  windSpeedMax: 4.5,
  windDirection: 180,
  precipitation: 0,
};

function renderInRouter(ui: ReactNode) {
  return render(
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      {ui}
    </BrowserRouter>,
  );
}

function DashboardHarness() {
  const dashboard = useWeatherDashboard();

  return (
    <div>
      <div>selected:{dashboard.selectedStation?.id ?? 'none'}</div>
      <div>granularity:{dashboard.granularity}</div>
      <div>from:{format(dashboard.dateRange.from, 'yyyy-MM-dd')}</div>
      <div>to:{format(dashboard.dateRange.to, 'yyyy-MM-dd')}</div>
      <div>metadata:{dashboard.metadataSource ?? 'none'}</div>
      <div>updated:{dashboard.lastUpdatedAt ? 'yes' : 'no'}</div>
      <div>avg-temp:{dashboard.stats?.avgTemperature ?? 'none'}</div>
      <div>avg-humidity:{dashboard.stats?.avgHumidity ?? 'none'}</div>
      <div>quality-days:{Object.keys(dashboard.dailyQualityByDay ?? {}).length}</div>
      <button onClick={() => dashboard.setSelectedStation(STATIONS[1])}>select-wu</button>
      <button onClick={() => dashboard.setGranularity('daily')}>set-daily</button>
      <button onClick={() => dashboard.setGranularity('30min')}>set-30min</button>
      <button
        onClick={() =>
          dashboard.setDateRange({
            from: new Date('2024-02-05T00:00:00'),
            to: new Date('2024-02-07T23:59:59'),
          })
        }
      >
        set-range
      </button>
    </div>
  );
}

describe('useWeatherDashboard', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');

    mockUseStations.mockReturnValue({
      data: STATIONS,
      metadataSource: 'live',
      warning: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as ReturnType<typeof useStations>);

    mockUseObservations.mockImplementation((params: unknown) => {
      const query = params as { station: Station | null; enabled?: boolean };
      const hasStation = !!query.station && query.enabled !== false;
      return {
        data: hasStation ? [TEST_OBSERVATION] : [],
        dataSourceLabel: hasStation ? 'Fuente: XEMA - Estación: Test' : null,
        isLoading: false,
        error: null,
        refetch: vi.fn().mockResolvedValue({
          data: { data: hasStation ? [TEST_OBSERVATION] : [], dataSourceLabel: 'Fuente: XEMA - Estación: Test' },
          error: null,
        }),
        isFetching: false,
      } as ReturnType<typeof useObservations>;
    });

    mockUseExcelExport.mockReturnValue({
      handleExportExcel: vi.fn(),
    });
  });

  it('hydrates dashboard state from URL params and records lastUpdated', async () => {
    window.history.pushState({}, '', '/?station=X4&from=2024-02-01&to=2024-02-03&granularity=daily');

    renderInRouter(<DashboardHarness />);

    await waitFor(() => {
      expect(screen.getByText('selected:X4')).toBeInTheDocument();
      expect(screen.getByText('granularity:daily')).toBeInTheDocument();
      expect(screen.getByText('from:2024-02-01')).toBeInTheDocument();
      expect(screen.getByText('to:2024-02-03')).toBeInTheDocument();
      expect(screen.getByText('metadata:live')).toBeInTheDocument();
      expect(screen.getByText('updated:yes')).toBeInTheDocument();
    });
  });

  it('writes state changes to the URL and rehydrates from browser navigation events', async () => {
    renderInRouter(<DashboardHarness />);

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('granularity')).toBe('30min');
    });

    fireEvent.click(screen.getByRole('button', { name: 'select-wu' }));

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('station')).toBe('WU');
    });

    const searchAfterStation = window.location.search;

    fireEvent.click(screen.getByRole('button', { name: 'set-daily' }));

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('granularity')).toBe('daily');
    });

    act(() => {
      window.history.pushState({}, '', searchAfterStation);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => {
      expect(window.location.search).toBe(searchAfterStation);
      expect(screen.getByText('selected:WU')).toBeInTheDocument();
      expect(screen.getByText('granularity:30min')).toBeInTheDocument();
    });
  });

  it('uses daily quality for variable-specific dashboard stats without changing 30min stats', async () => {
    const first = { ...TEST_OBSERVATION, timestamp: '2024-02-01', temperature: 10, humidity: 60 };
    const second = { ...TEST_OBSERVATION, timestamp: '2024-02-02', temperature: 20, humidity: 90 };
    const firstQuality = assessDailyQuality('2024-02-01', []);
    const secondQuality = assessDailyQuality('2024-02-02', []);
    firstQuality.variables.temperature.status = 'complete';
    secondQuality.variables.temperature.status = 'incomplete';
    firstQuality.variables.humidity.status = 'incomplete';
    secondQuality.variables.humidity.status = 'partial';
    mockUseObservations.mockImplementation((params: unknown) => {
      const { enabled, granularity } = params as { enabled?: boolean; granularity: string };
      return {
        data: enabled === false ? [] : [first, second],
        dailyQualityByDay: granularity === 'daily' ? {
          '2024-02-01': firstQuality, '2024-02-02': secondQuality,
        } : null,
        dataSourceLabel: 'XEMA', isLoading: false, error: null,
        refetch: vi.fn(), isFetching: false,
      } as ReturnType<typeof useObservations>;
    });
    window.history.pushState({}, '', '/?station=X4&from=2024-02-01&to=2024-02-02&granularity=daily');
    renderInRouter(<DashboardHarness />);
    await waitFor(() => {
      expect(screen.getByText('avg-temp:10')).toBeInTheDocument();
      expect(screen.getByText('avg-humidity:90')).toBeInTheDocument();
      expect(screen.getByText('quality-days:2')).toBeInTheDocument();
    });
  });
});
