import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DailyQuality, VariableDailyQuality } from '@/lib/dailyQuality';
import type { Observation, WeatherStats } from '@/types/weather';
import { WeatherKPIs } from './WeatherKPIs';

const stats: WeatherStats = {
  avgTemperature: 12, avgHumidity: 70, avgWindSpeed: 2,
  maxWindSpeed: 9, totalPrecipitation: 4, dataPoints: 2,
};

const observations: Observation[] = [
  { timestamp: '2024-02-01', temperature: 12, humidity: 70, windSpeed: 2,
    windSpeedMax: 8, windDirection: null, precipitation: 1 },
  { timestamp: '2024-02-02', temperature: 13, humidity: 71, windSpeed: 3,
    windSpeedMax: 9, windDirection: null, precipitation: 3 },
];

function variable(status: VariableDailyQuality['status']): VariableDailyQuality {
  return { coveredSlots: status === 'missing' ? 0 : 40, coverage: 40 / 48, status,
    longestMissingGapMinutes: 0, unresolvedBaseReadings: 0,
    validationCounts: { valid: 1, pending: 0, 'not-started': 0, unknown: 0, unreported: 0 },
    validationStatus: 'valid', isObservedLowerBound: status === 'partial' };
}

function day(dayKey: string, overrides: Partial<Record<keyof DailyQuality['variables'], VariableDailyQuality['status']>>): DailyQuality {
  return { dayKey, expectedSlots: 48,
    variables: {
      temperature: variable(overrides.temperature ?? 'complete'),
      humidity: variable(overrides.humidity ?? 'complete'),
      windSpeed: variable(overrides.windSpeed ?? 'complete'),
      windSpeedMax: variable(overrides.windSpeedMax ?? 'complete'),
      precipitation: variable(overrides.precipitation ?? 'complete'),
    } };
}

describe('WeatherKPIs daily quality provenance', () => {
  it('shows separate usable/excluded cohorts for each variable and lower-bound caveats', () => {
    const quality = {
      '2024-02-01': day('2024-02-01', { temperature: 'partial', precipitation: 'partial', windSpeedMax: 'incomplete' }),
      '2024-02-02': day('2024-02-02', { temperature: 'incomplete', windSpeed: 'missing', windSpeedMax: 'partial' }),
    };
    const { container } = render(<WeatherKPIs stats={stats} isLoading={false} granularity="daily" dailyQualityByDay={quality} observations={observations} />);
    expect(screen.getByLabelText(/Cobertura temperatura: 1 parcial · 1 excluido por cobertura/)).toHaveTextContent('▲');
    expect(screen.queryByText(/Humedad:.*de 2 días/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Cobertura viento medio: 1 excluido por cobertura/)).toHaveTextContent('▲');
    expect(screen.getByLabelText(/Cobertura racha máxima: 1 parcial · 1 excluido por cobertura/)).toHaveTextContent('▲');
    expect(screen.getByLabelText(/Cobertura precipitación: 1 parcial/)).toHaveTextContent('▲');
    expect(screen.queryByText(/excluido por cobertura/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Precipitación: mínimo observado/)).toBeInTheDocument();
    expect(screen.getByText(/Racha máxima: mínimo observado/)).toBeInTheDocument();
    expect(screen.queryByText(/Datos: 2 filas con lecturas/)).not.toBeInTheDocument();
    expect(container.textContent).toContain('4 mm');
  });

  it('does not count a quality-usable day whose numeric value is absent', () => {
    render(<WeatherKPIs stats={{ ...stats, totalPrecipitation: null }} isLoading={false}
      granularity="daily" dailyQualityByDay={{ '2024-02-01': day('2024-02-01', {}) }}
      observations={[{ ...observations[0], precipitation: null }]} />);
    expect(screen.getByLabelText(/Cobertura precipitación: 1 sin valor/)).toHaveTextContent('▲');
    expect(screen.queryByText(/Precipitación: mínimo observado/)).not.toBeInTheDocument();
  });

  it('preserves the original 30-minute KPI display without daily quality prose', () => {
    render(<WeatherKPIs stats={stats} isLoading={false} granularity="30min"
      dailyQualityByDay={{ '2024-02-01': day('2024-02-01', { precipitation: 'partial' }) }} />);
    expect(screen.queryByText(/con valor utilizable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/mínimo observado/)).not.toBeInTheDocument();
    expect(screen.getByText('Datos')).toBeInTheDocument();
  });

  it('names the affected wind constituent for validation-only issues', () => {
    const quality = day('2024-02-01', {});
    quality.variables.windSpeed = {
      ...quality.variables.windSpeed,
      validationStatus: 'pending',
      validationCounts: { valid: 0, pending: 1, 'not-started': 0, unknown: 0, unreported: 0 },
    };
    render(<WeatherKPIs stats={stats} isLoading={false} granularity="daily"
      dailyQualityByDay={{ '2024-02-01': quality }} observations={[observations[0]]} />);
    expect(screen.getByLabelText(/Viento medio: validación XEMA pendiente/)).toHaveTextContent('◇');
    expect(screen.queryByText(/validación XEMA pendiente/)).not.toBeInTheDocument();
  });
});
