import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WeatherCharts } from './WeatherCharts';
import type { Observation } from '@/types/weather';

vi.mock('recharts', () => {
  const makeContainer = (name: string) => {
    const Component = ({ children }: { children?: ReactNode }) => (
      <div data-testid={name}>{children}</div>
    );
    Component.displayName = name;
    return Component;
  };

  const Line = ({ dataKey, name, strokeWidth }: { dataKey?: string; name?: string; strokeWidth?: number }) => (
    <div
      data-testid={`line-${name ?? dataKey ?? 'unknown'}`}
      data-stroke-width={strokeWidth}
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

  const Tooltip = makeContainer('tooltip');
  const XAxis = makeContainer('x-axis');
  const YAxis = makeContainer('y-axis');
  const CartesianGrid = makeContainer('cartesian-grid');
  const Brush = makeContainer('brush');
  const ResponsiveContainer = makeContainer('responsive-container');
  const LineChart = makeContainer('line-chart');
  const BarChart = makeContainer('bar-chart');
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
});
