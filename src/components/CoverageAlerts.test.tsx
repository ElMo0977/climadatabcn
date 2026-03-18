import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoverageAlerts } from './CoverageAlerts';

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
});
