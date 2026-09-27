import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoverageAlerts } from './CoverageAlerts';
import type { DailyQuality, VariableDailyQuality } from '@/lib/dailyQuality';
import type { Observation } from '@/types/weather';

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
    expect(screen.getByText(/Hay datos parciales, incompletos o ausentes/)).toBeInTheDocument();
    expect(screen.getByText(/Parcial: 1 día/)).toBeInTheDocument();
    expect(screen.getByText(/Incompleto: 1 día/)).toBeInTheDocument();
    expect(screen.getByText(/tabla diaria/)).toBeInTheDocument();
  });

  it('does not show a quality warning for exclusively complete days', () => {
    render(<CoverageAlerts dailyCoverage={null} subdailyCoverage={null} showDaily={false}
      showSubdaily={false} showLargestGap={false} missingDaysText=""
      dailyQualityByDay={{ '2024-02-01': day('2024-02-01', 'complete') }} />);
    expect(screen.queryByText(/Hay datos parciales, incompletos o ausentes/)).not.toBeInTheDocument();
  });

  it('does not call full coverage validated when XEMA status is unreported', () => {
    const unreported = { ...quality('complete'), coveredSlots: 48, validationStatus: 'unreported' as const,
      validationCounts: { valid: 0, pending: 0, 'not-started': 0, unknown: 0, unreported: 1 } };
    const record = { ...day('2024-02-01', 'complete'), variables: {
      temperature: unreported, humidity: unreported, precipitation: unreported,
      windSpeed: unreported, windSpeedMax: unreported,
    } };
    render(<CoverageAlerts dailyCoverage={{
      expectedDays: ['2024-02-01'], expectedCount: 1, availableCount: 1,
      missingCount: 0, missingDays: [], availableDays: ['2024-02-01'],
    }} subdailyCoverage={null} showDaily={false}
      showSubdaily={false} showLargestGap={false} missingDaysText="" granularity="daily"
      dailyQualityByDay={{ '2024-02-01': record }} />);
    expect(screen.getByText(/Cobertura completa; validación XEMA no confirmada/)).toBeInTheDocument();
    expect(screen.queryByText(/Todo correcto/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Leyenda de calidad de datos')).toBeInTheDocument();
  });

  it('reports all correct only when observed 30-minute readings are complete and validated', () => {
    const observation: Observation = {
      timestamp: '2024-02-01T00:00:00', temperature: 10, humidity: 60, windSpeed: 2,
      windDirection: 180, windSpeedMax: 4, precipitation: 0,
      variableMetadata: Object.fromEntries(['temperature', 'humidity', 'windSpeed', 'windDirection', 'windSpeedMax', 'precipitation']
        .map((key) => [key, { validationStatus: 'valid', temporalBase: 'half-hourly' }])),
    };
    render(<CoverageAlerts dailyCoverage={null} subdailyCoverage={{
      expectedSlots: ['2024-02-01 00:00'], availableSlots: ['2024-02-01 00:00'],
      missingSlots: [], missingIntervals: [], expectedCount: 1, availableCount: 1,
      missingCount: 0, largestGap: null,
    }} showDaily={false}
      showSubdaily={false} showLargestGap={false} missingDaysText="" granularity="30min"
      observations={[observation]} />);
    expect(screen.getByText('Todo correcto en las lecturas visibles: validación XEMA confirmada; cobertura completa en los días seleccionados.')).toBeInTheDocument();
  });

  it('separates technical loading failure from missing or unconfirmed data', () => {
    render(<CoverageAlerts dailyCoverage={null} subdailyCoverage={null} showDaily={false}
      showSubdaily={false} showLargestGap={false} missingDaysText="" granularity="30min"
      error={new Error('fallo de red')} />);
    expect(screen.getByText(/⊗ Error al cargar datos/)).toBeInTheDocument();
    expect(screen.getByText('fallo de red')).toBeInTheDocument();
    expect(screen.queryByText(/Todo correcto/)).not.toBeInTheDocument();
  });

  it('does not certify a complete daily sidecar without any V evidence', () => {
    const noEvidence = { ...quality('complete'), coveredSlots: 48,
      validationCounts: { valid: 0, pending: 0, 'not-started': 0, unknown: 0, unreported: 0 } };
    render(<CoverageAlerts dailyCoverage={{
      expectedDays: ['2024-02-01'], expectedCount: 1, availableCount: 1,
      missingCount: 0, missingDays: [], availableDays: ['2024-02-01'],
    }} subdailyCoverage={null} showDaily={false} showSubdaily={false}
      showLargestGap={false} missingDaysText="" granularity="daily"
      dailyQualityByDay={{ '2024-02-01': {
        dayKey: '2024-02-01', expectedSlots: 48,
        variables: { temperature: noEvidence, humidity: noEvidence, windSpeed: noEvidence,
          windSpeedMax: noEvidence, precipitation: noEvidence },
      } }} />);
    expect(screen.queryByText(/Todo correcto/)).not.toBeInTheDocument();
    expect(screen.getByText(/No hay datos suficientes para confirmar la calidad/)).toBeInTheDocument();
  });
});
