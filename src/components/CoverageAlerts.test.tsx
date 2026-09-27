import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoverageAlerts } from './CoverageAlerts';
import type { DailyQuality, VariableDailyQuality } from '@/lib/dailyQuality';

function quality(status: VariableDailyQuality['status']): VariableDailyQuality {
  return { coveredSlots: status === 'complete' ? 48 : 24, coverage: 0.5, status,
    longestMissingGapMinutes: 0, unresolvedBaseReadings: 0,
    validationCounts: { valid: 1, pending: 0, 'not-started': 0, unknown: 0, unreported: 0 },
    validationStatus: 'valid', isObservedLowerBound: status === 'partial' };
}

function day(dayKey: string, status: VariableDailyQuality['status']): DailyQuality {
  const variable = quality(status);
  return { dayKey, expectedSlots: 48,
    variables: { temperature: variable, humidity: variable, precipitation: variable,
      windSpeed: variable, windSpeedMax: variable } };
}

describe('CoverageAlerts', () => {
  it('renders daily and subdaily coverage messages', () => {
    render(
      <CoverageAlerts
        dailyCoverage={{
          expectedDays: ['2024-02-01', '2024-02-02', '2024-02-03'],
          expectedCount: 7,
          availableCount: 5,
          missingCount: 2,
          missingDays: ['2024-02-01', '2024-02-02'],
          availableDays: ['2024-02-03'],
        }}
        subdailyCoverage={{
          expectedSlots: ['2024-02-03 09:00'],
          availableSlots: ['2024-02-03 08:30'],
          missingSlots: ['2024-02-03 09:00'],
          missingIntervals: [
            {
              start: '2024-02-03 09:00',
              end: '2024-02-03 10:30',
              missingCount: 4,
            },
          ],
          expectedCount: 48,
          availableCount: 44,
          missingCount: 4,
          largestGap: {
            start: '2024-02-03 09:00',
            end: '2024-02-03 10:30',
            missingCount: 4,
          },
        }}
        showDaily
        showSubdaily
        showLargestGap
        missingDaysText="1 feb, 2 feb"
      />,
    );

    expect(screen.getByText('Datos disponibles para 5 de 7 días.')).toBeInTheDocument();
    expect(screen.getByText(/Faltan datos para 2 días: 1 feb, 2 feb/)).toBeInTheDocument();
    expect(screen.getByText('Datos 30 min disponibles para 44 de 48 franjas.')).toBeInTheDocument();
    expect(screen.getByText(/Faltan datos entre 09:00 y 10:30/)).toBeInTheDocument();
  });

  it('alerts on variable-level partial or incomplete days even when every day has an observation row', () => {
    render(<CoverageAlerts dailyCoverage={null} subdailyCoverage={null} showDaily={false}
      showSubdaily={false} showLargestGap={false} missingDaysText=""
      dailyQualityByDay={{ '2024-02-01': day('2024-02-01', 'partial'), '2024-02-02': day('2024-02-02', 'incomplete') }} />);
    expect(screen.getByText(/Calidad diaria por variable/)).toBeInTheDocument();
    expect(screen.getByText(/Parcial: 1 día/)).toBeInTheDocument();
    expect(screen.getByText(/Incompleto: 1 día/)).toBeInTheDocument();
    expect(screen.getByText(/tabla diaria/)).toBeInTheDocument();
  });

  it('does not show a quality warning for exclusively complete days', () => {
    render(<CoverageAlerts dailyCoverage={null} subdailyCoverage={null} showDaily={false}
      showSubdaily={false} showLargestGap={false} missingDaysText=""
      dailyQualityByDay={{ '2024-02-01': day('2024-02-01', 'complete') }} />);
    expect(screen.queryByText(/Calidad diaria por variable/)).not.toBeInTheDocument();
  });
});
