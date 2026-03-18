import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Station } from '@/types/weather';
import { StationSelector } from './StationSelector';

vi.mock('./StationMap', () => ({
  StationMap: () => <div>mapa</div>,
}));

const STATIONS: Station[] = [
  {
    id: 'X4',
    name: 'Barcelona - el Raval',
    latitude: 41.38,
    longitude: 2.17,
    elevation: 33,
    distance: 1.2,
    municipality: 'Barcelona',
    source: 'xema-transparencia',
  },
  {
    id: 'WU',
    name: 'Badalona - Museu',
    latitude: 41.45,
    longitude: 2.24,
    elevation: 42,
    distance: 8.3,
    municipality: 'Badalona',
    source: 'xema-transparencia',
  },
];

describe('StationSelector', () => {
  it('filters stations by name, municipality, and id', async () => {
    render(
      <StationSelector
        stations={STATIONS}
        selectedStation={null}
        onSelectStation={vi.fn()}
        isLoading={false}
        error={null}
      />,
    );

    expect(await screen.findByText('mapa')).toBeInTheDocument();

    const searchInput = screen.getByLabelText('Buscar estación');

    fireEvent.change(searchInput, { target: { value: 'Badalona' } });
    expect(screen.getByText('Badalona - Museu')).toBeInTheDocument();
    expect(screen.queryByText('Barcelona - el Raval')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'X4' } });
    expect(screen.getByText('Barcelona - el Raval')).toBeInTheDocument();
    expect(screen.queryByText('Badalona - Museu')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Raval' } });
    expect(screen.getByText('Barcelona - el Raval')).toBeInTheDocument();
  });
});
