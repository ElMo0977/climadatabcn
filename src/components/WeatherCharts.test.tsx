import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WeatherCharts } from './WeatherCharts';
import type { Observation } from '@/types/weather';
import type { DailyQuality, DailyQualityVariable, VariableDailyQuality } from '@/lib/dailyQuality';

const { exportChartAsPng, exportChartAsPdf } = vi.hoisted(() => ({
  exportChartAsPng: vi.fn().mockResolvedValue(undefined),
  exportChartAsPdf: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/exportChart', () => ({ exportChartAsPng, exportChartAsPdf }));

vi.mock('recharts', () => {
  const makeContainer = (name: string) => {
    const Component = ({ children }: { children?: ReactNode }) => (
      <div data-testid={name}>{children}</div>
    );
    Component.displayName = name;
    return Component;
  };

  const Line = ({ dataKey, name, strokeWidth, connectNulls, dot }: { dataKey?: string; name?: string; strokeWidth?: number; connectNulls?: boolean; dot?: boolean }) => (
    <div
      data-testid={`line-${name ?? dataKey ?? 'unknown'}`}
      data-stroke-width={strokeWidth}
      data-connect-nulls={String(connectNulls)}
      data-dot={String(dot)}
    />
  );

  const ReferenceLine = ({ y, strokeWidth, label }: { y?: number; strokeWidth?: number; label?: ReactNode }) => (
    <div
      data-testid={`reference-line-${y ?? 'unknown'}`}
      data-stroke-width={strokeWidth}
    >
      {label ?? null}
    </div>
  );

  const Tooltip = ({ formatter }: { formatter?: (value: number | null, name: string,
    item: { payload?: { dayKey?: string } }) => [string, string] }) => (
    <div data-testid="tooltip" data-empty-value={formatter?.(undefined as unknown as number,
      'Viento media', { payload: {} })[0]} />
  );
  const XAxis = makeContainer('x-axis');
  const YAxis = makeContainer('y-axis');
  const CartesianGrid = makeContainer('cartesian-grid');
  const Brush = makeContainer('brush');
  const ResponsiveContainer = makeContainer('responsive-container');
  const makeChart = (name: string) => ({ children, data }: { children?: ReactNode; data?: unknown }) => (
    <div data-testid={name} data-chart-data={JSON.stringify(data)}>{children}</div>
  );
  const LineChart = makeChart('line-chart');
  const BarChart = makeChart('bar-chart');
  const Bar = makeContainer('bar');

  return {
    Line,
    ReferenceLine,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid,
    Brush,
    ResponsiveContainer,
    LineChart,
    BarChart,
    Bar,
  };
});

const observations: Observation[] = [
  {
    timestamp: '2024-01-05T10:00:00',
    temperature: 13.5,
    humidity: 72,
    windSpeed: 3.1,
    windSpeedMax: 9.7,
    windDirection: 290,
    precipitation: 0.2,
  },
  {
    timestamp: '2024-01-05T10:30:00',
    temperature: 13.2,
    humidity: 70,
    windSpeed: 2.8,
    windSpeedMax: 8.4,
    windDirection: 280,
    precipitation: 0,
  },
];

function quality(status: VariableDailyQuality['status'], coveredSlots: number,
  validationStatus: VariableDailyQuality['validationStatus'] = 'valid',
  isObservedLowerBound = false): VariableDailyQuality {
  return {
    status, coveredSlots, coverage: coveredSlots / 48, longestMissingGapMinutes: 0,
    unresolvedBaseReadings: 0, validationStatus,
    validationCounts: { valid: validationStatus === 'valid' ? 1 : 0, pending: 0,
      'not-started': 0, unknown: 0, unreported: validationStatus === 'unreported' ? 1 : 0 },
    isObservedLowerBound,
  };
}

function day(dayKey: string, overrides: Partial<Record<DailyQualityVariable, VariableDailyQuality>> = {}): DailyQuality {
  const complete = quality('complete', 48);
  return { dayKey, expectedSlots: 48, variables: {
    temperature: complete, humidity: complete, windSpeed: complete,
    windSpeedMax: complete, precipitation: complete, ...overrides,
  } };
}

function dailyObservation(dayKey: string, values: Partial<Observation> = {}): Observation {
  return { timestamp: dayKey, temperature: 20, humidity: 60, windSpeed: 1.5,
    windSpeedMax: 6, windDirection: null, precipitation: 0, ...values };
}

function chartRows(testId: string, index = 0): Record<string, unknown>[] {
  return JSON.parse(screen.getAllByTestId(testId)[index].getAttribute('data-chart-data')!);
}

describe('WeatherCharts', () => {
  it('renders the wind legend below the chart with the threshold item', () => {
    render(
      <WeatherCharts
        observations={observations}
        granularity="30min"
        isLoading={false}
      />,
    );

    const legend = screen.getByLabelText('Leyenda de viento');
    expect(within(legend).getByText('Racha máx.')).toBeInTheDocument();
    expect(within(legend).getByText('Viento media')).toBeInTheDocument();
    expect(within(legend).getByText('Límite 5 m/s')).toBeInTheDocument();
    expect(screen.queryByText('Límite mediciones acústicas (5 m/s)')).not.toBeInTheDocument();
  });

  it('uses thinner strokes for line charts and wind threshold', () => {
    render(
      <WeatherCharts
        observations={observations}
        granularity="30min"
        isLoading={false}
      />,
    );

    expect(screen.getByTestId('line-temperature')).toHaveAttribute('data-stroke-width', '1.5');
    expect(screen.getByTestId('line-humidity')).toHaveAttribute('data-stroke-width', '1.5');
    expect(screen.getByTestId('line-Viento media')).toHaveAttribute('data-stroke-width', '1.5');
    expect(screen.getByTestId('line-Racha máx.')).toHaveAttribute('data-stroke-width', '2');
    expect(screen.getByTestId('reference-line-5')).toHaveAttribute('data-stroke-width', '1.5');
  });

  it('keeps daily sidecar-only days and masks incomplete and non-finite variables without line bridges', () => {
    render(<WeatherCharts granularity="daily" isLoading={false}
      observations={[dailyObservation('2024-01-01'), dailyObservation('2024-01-03', { temperature: Infinity })]}
      dailyQualityByDay={{
        '2024-01-01': day('2024-01-01'),
        '2024-01-02': day('2024-01-02', { temperature: quality('missing', 0) }),
        '2024-01-03': day('2024-01-03', { humidity: quality('incomplete', 30) }),
      }} />);
    expect(chartRows('line-chart')).toMatchObject([
      { temperature: 20 }, { temperature: null }, { temperature: null },
    ]);
    expect(chartRows('line-chart', 1)[2]).toMatchObject({ humidity: null });
    expect(screen.getByTestId('line-temperature')).toHaveAttribute('data-connect-nulls', 'false');
    expect(screen.getByTestId('line-humidity')).toHaveAttribute('data-connect-nulls', 'false');
  });

  it('keeps wind mean and gust separate, preserving partial zero as a lower bound', () => {
    render(<WeatherCharts granularity="daily" isLoading={false}
      observations={[dailyObservation('2024-01-01', { windSpeed: null, windSpeedMax: 0, precipitation: 0 })]}
      dailyQualityByDay={{ '2024-01-01': day('2024-01-01', {
        windSpeed: quality('incomplete', 20), windSpeedMax: quality('partial', 40, 'valid', true),
        precipitation: quality('partial', 40, 'valid', true),
      }) }} />);
    expect(chartRows('line-chart', 2)[0]).toMatchObject({ windAvg: null, windMax: 0 });
    expect(chartRows('bar-chart')[0]).toMatchObject({ precipitation: 0 });
    expect(screen.getByTestId('line-Racha máx.')).toHaveAttribute('data-connect-nulls', 'false');
    expect(screen.getByTestId('line-Viento media')).toHaveAttribute('data-connect-nulls', 'false');
    expect(screen.getByLabelText(/Racha máxima.*40\/48.*Mínimo observado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Precipitación.*40\/48.*Mínimo observado/i)).toBeInTheDocument();
  });

  it('renders a selected day even when there is no daily observation row', () => {
    render(<WeatherCharts granularity="daily" isLoading={false} observations={[]}
      dailyQualityByDay={{ '2024-01-02': day('2024-01-02', {
        temperature: quality('missing', 0),
      }) }} />);
    expect(chartRows('line-chart')).toMatchObject([{ dayKey: '2024-01-02', temperature: null }]);
    expect(screen.queryByText('Selecciona una estación para ver los datos')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Temperatura.*0\/48.*ausente/i)).toHaveTextContent('▲');
  });

  it('shows isolated daily values as visible points while preserving the 30-minute line style', () => {
    const qualityByDay = {
      '2024-01-01': day('2024-01-01'),
      '2024-01-02': day('2024-01-02', { temperature: quality('missing', 0) }),
      '2024-01-03': day('2024-01-03'),
    };
    const { rerender } = render(<WeatherCharts granularity="daily" isLoading={false}
      observations={[dailyObservation('2024-01-01'), dailyObservation('2024-01-03')]}
      dailyQualityByDay={qualityByDay} />);
    expect(chartRows('line-chart')).toMatchObject([
      { temperature: 20 }, { temperature: null }, { temperature: 20 },
    ]);
    expect(screen.getByTestId('line-temperature')).toHaveAttribute('data-dot', 'true');
    expect(screen.getByTestId('line-Racha máx.')).toHaveAttribute('data-dot', 'true');
    rerender(<WeatherCharts granularity="30min" isLoading={false} observations={observations} />);
    expect(screen.getByTestId('line-temperature')).toHaveAttribute('data-dot', 'false');
    expect(screen.getByTestId('line-Racha máx.')).toHaveAttribute('data-dot', 'false');
  });

  it('shows localized standalone quality marks inside the export capture target', async () => {
    render(<WeatherCharts granularity="daily" isLoading={false}
      observations={[dailyObservation('2024-01-01')]}
      dailyQualityByDay={{ '2024-01-01': day('2024-01-01', {
        temperature: quality('partial', 40, 'unreported'),
      }) }} />);
    const partial = screen.getByLabelText(/Temperatura.*40\/48.*parcial/i);
    const unconfirmed = screen.getByLabelText(/Temperatura.*Validación XEMA no informada/i);
    expect(partial).toHaveTextContent('▲');
    expect(unconfirmed).toHaveTextContent('◇');
    expect(partial.closest('.chart-container')).toContainElement(screen.getByText('Temperatura'));
    fireEvent.click(within(partial.closest('.chart-container') as HTMLElement).getByTitle('Descargar gráfico'));
    fireEvent.click(screen.getByText('PNG'));
    await waitFor(() => expect(exportChartAsPng).toHaveBeenCalledWith(
      partial.closest('.chart-container'), 'grafico-temperatura'));
    fireEvent.click(within(partial.closest('.chart-container') as HTMLElement).getByTitle('Descargar gráfico'));
    fireEvent.click(screen.getByText('PDF'));
    await waitFor(() => expect(exportChartAsPdf).toHaveBeenCalledWith(
      partial.closest('.chart-container'), 'grafico-temperatura'));
  });

  it('preserves 30-minute chart rows and existing null-connection behavior', () => {
    render(<WeatherCharts observations={observations} granularity="30min" isLoading={false} />);
    expect(chartRows('line-chart')).toHaveLength(2);
    expect(screen.getByTestId('line-temperature')).toHaveAttribute('data-connect-nulls', 'true');
    expect(chartRows('line-chart', 2)[0]).toHaveProperty('windAvg');
    expect(screen.getAllByTestId('tooltip')[2]).toHaveAttribute('data-empty-value', 'Sin datos');
  });
});
