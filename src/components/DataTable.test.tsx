import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Observation } from '@/types/weather';
import type { DailyQuality, VariableDailyQuality } from '@/lib/dailyQuality';
import { DataTable } from './DataTable';

function quality(status: VariableDailyQuality['status'], coveredSlots: number, validationStatus: VariableDailyQuality['validationStatus'] = 'valid'): VariableDailyQuality {
  return {
    status, coveredSlots, coverage: coveredSlots / 48,
    longestMissingGapMinutes: 0, unresolvedBaseReadings: 0,
    validationCounts: { valid: 1, pending: 0, 'not-started': 0, unknown: 0, unreported: 0 },
    validationStatus,
    isObservedLowerBound: status === 'partial',
  };
}

function dayQuality(dayKey: string, variableQuality: VariableDailyQuality): DailyQuality {
  return {
    dayKey, expectedSlots: 48,
    variables: {
      temperature: variableQuality, humidity: variableQuality,
      windSpeed: variableQuality, windSpeedMax: variableQuality,
      precipitation: variableQuality,
    },
  };
}

function buildObservation(index: number): Observation {
  return {
    timestamp: `2024-02-${String(index + 1).padStart(2, '0')}T10:00:00`,
    temperature: 10 + index,
    humidity: 60,
    windSpeed: 2,
    windSpeedMax: 4,
    windDirection: 180,
    precipitation: 0,
  };
}

describe('DataTable', () => {
  it('resets pagination when granularity changes', () => {
    const observations = Array.from({ length: 25 }, (_, index) => buildObservation(index));
    const { rerender } = render(
      <DataTable observations={observations} granularity="30min" isLoading={false} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();

    rerender(<DataTable observations={observations} granularity="daily" isLoading={false} />);
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
  });

  it('shows per-variable coverage and separate validation, including a selected day without a row', () => {
    const partial = quality('partial', 40, 'pending');
    const absent = quality('missing', 0, 'unreported');
    render(<DataTable
      observations={[{ ...buildObservation(0), timestamp: '2024-02-01', precipitation: 1.5, windSpeedMax: 7 }]}
      granularity="daily" isLoading={false}
      dailyQualityByDay={{ '2024-02-01': dayQuality('2024-02-01', partial), '2024-02-02': dayQuality('2024-02-02', absent) }}
    />);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getAllByText(/Parcial · 40\/48 franjas/)).toHaveLength(5);
    expect(within(rows[1]).getAllByText(/Validación XEMA: pendiente/)).toHaveLength(5);
    expect(within(rows[1]).getByText('≥ 1.5')).toBeInTheDocument();
    expect(within(rows[1]).getByText('≥ 7')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Sin valor diario')).toBeInTheDocument();
    expect(within(rows[2]).getAllByText(/Sin dato · 0\/48 franjas/)).toHaveLength(5);
    expect(within(rows[2]).queryByText(/≥/)).not.toBeInTheDocument();
  });

  it('preserves validation evidence on an incomplete day without an attributable daily value', () => {
    const unresolved = {
      ...quality('incomplete', 0, 'pending'),
      unresolvedBaseReadings: 1,
      validationCounts: { valid: 0, pending: 1, 'not-started': 0, unknown: 0, unreported: 0 },
    };
    render(<DataTable observations={[]} granularity="daily" isLoading={false}
      dailyQualityByDay={{ '2024-02-01': dayQuality('2024-02-01', unresolved) }} />);
    expect(screen.getByText('Sin valor diario')).toBeInTheDocument();
    expect(screen.getAllByText(/Incompleto · 0\/48 franjas · Excluido de KPI/)).toHaveLength(5);
    expect(screen.getAllByText(/Validación XEMA: pendiente/)).toHaveLength(5);
    expect(screen.queryByText('No hay datos disponibles')).not.toBeInTheDocument();
  });

  it('keeps incomplete numerics visible but explicitly excluded from KPIs, without marking null as a lower bound', () => {
    const incomplete = { ...quality('incomplete', 20), isObservedLowerBound: true };
    render(<DataTable observations={[{ ...buildObservation(0), timestamp: '2024-02-01', precipitation: 2, windSpeedMax: null }]}
      granularity="daily" isLoading={false}
      dailyQualityByDay={{ '2024-02-01': dayQuality('2024-02-01', incomplete) }} />);

    expect(screen.getAllByText(/Incompleto · 20\/48 franjas · Excluido de KPI/)).toHaveLength(5);
    expect(screen.getByText('≥ 2')).toBeInTheDocument();
    expect(screen.queryByText('≥ —')).not.toBeInTheDocument();
  });

  it('does not label non-finite precipitation or gust values as observed lower bounds', () => {
    render(<DataTable observations={[{ ...buildObservation(0), timestamp: '2024-02-01',
      precipitation: Number.NaN, windSpeedMax: Number.POSITIVE_INFINITY }]}
      granularity="daily" isLoading={false}
      dailyQualityByDay={{ '2024-02-01': dayQuality('2024-02-01', quality('partial', 40)) }} />);
    expect(screen.queryByText(/≥/)).not.toBeInTheDocument();
    expect(screen.queryByText('Mínimo observado')).not.toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    expect(screen.queryByText('Infinity')).not.toBeInTheDocument();
  });

  it('leaves the 30-minute view unchanged when quality is supplied', () => {
    render(<DataTable observations={[buildObservation(0)]} granularity="30min" isLoading={false}
      dailyQualityByDay={{ '2024-02-01': dayQuality('2024-02-01', quality('partial', 40)) }} />);
    expect(screen.queryByText(/Validación XEMA/)).not.toBeInTheDocument();
    expect(screen.queryByText(/franjas/)).not.toBeInTheDocument();
  });

  it('marks only the affected 30-minute readings with their XEMA validation state', () => {
    const observation = { ...buildObservation(0), variableMetadata: {
      temperature: { validationStatus: 'valid' as const, temporalBase: 'half-hourly' as const },
      humidity: { validationStatus: 'pending' as const, temporalBase: 'half-hourly' as const },
      precipitation: { validationStatus: 'unreported' as const, temporalBase: 'half-hourly' as const },
    } };
    render(<DataTable observations={[observation]} granularity="30min" isLoading={false} />);
    const row = screen.getAllByRole('row')[1];
    const cells = row.querySelectorAll('td');
    expect(within(cells[1]).queryByText('◇?')).not.toBeInTheDocument();
    expect(within(cells[2]).getByLabelText('Validación XEMA pendiente')).toBeInTheDocument();
    expect(within(cells[6]).getByLabelText('Validación XEMA no informada')).toBeInTheDocument();
    expect(within(cells[3]).getByLabelText('Validación XEMA no informada')).toBeInTheDocument();
  });

  it('does not repeat success on complete and validated daily cells', () => {
    render(<DataTable observations={[{ ...buildObservation(0), timestamp: '2024-02-01' }]}
      granularity="daily" isLoading={false}
      dailyQualityByDay={{ '2024-02-01': dayQuality('2024-02-01', quality('complete', 48)) }} />);
    expect(screen.queryByText(/Completo · 48\/48/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Validación XEMA: válida/)).not.toBeInTheDocument();
  });

  it('marks an absent 30-minute variable as missing, not as rejected by XEMA', () => {
    render(<DataTable observations={[{ ...buildObservation(0), humidity: null }]}
      granularity="30min" isLoading={false} />);
    const cells = screen.getAllByRole('row')[1].querySelectorAll('td');
    expect(within(cells[2]).getByLabelText('Cobertura sin dato')).toBeInTheDocument();
    expect(within(cells[2]).queryByLabelText(/Validación XEMA/)).not.toBeInTheDocument();
  });
});
