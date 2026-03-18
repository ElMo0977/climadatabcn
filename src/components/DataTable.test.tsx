import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Observation } from '@/types/weather';
import { DataTable } from './DataTable';

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
});
