import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchStationsFromSocrata,
  STATIONS_FALLBACK_WARNING,
} from '@/services/providers/xemaTransparencia';
import { useStations } from './useStations';

vi.mock('@/services/providers/xemaTransparencia', () => ({
  fetchStationsFromSocrata: vi.fn(),
  STATIONS_FALLBACK_WARNING:
    'Lista de estaciones en modo degradado; las observaciones siguen disponibles.',
}));

const mockFetchStationsFromSocrata = vi.mocked(fetchStationsFromSocrata);

function createWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
      },
    },
  });
}

describe('useStations', () => {
  beforeEach(() => {
    mockFetchStationsFromSocrata.mockReset();
  });

  it('returns mapped live stations without warning', async () => {
    mockFetchStationsFromSocrata.mockResolvedValueOnce({
      stations: [
        {
          id: 'X4',
          name: 'Barcelona - el Raval',
          latitude: 41.3839,
          longitude: 2.16775,
          elevation: 33,
          municipality: 'Barcelona',
        },
      ],
      metadataSource: 'live',
      warning: null,
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(() => useStations(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.metadataSource).toBe('live');
    expect(result.current.warning).toBeNull();
    expect(result.current.data[0]).toMatchObject({
      id: 'X4',
      source: 'xema-transparencia',
      municipality: 'Barcelona',
    });
  });

  it('returns fallback metadata and warning when provider is degraded', async () => {
    mockFetchStationsFromSocrata.mockResolvedValueOnce({
      stations: [
        {
          id: 'X4',
          name: 'Barcelona - el Raval',
          latitude: 41.3839,
          longitude: 2.16775,
          elevation: 33,
        },
      ],
      metadataSource: 'fallback',
      warning: STATIONS_FALLBACK_WARNING,
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(() => useStations(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.metadataSource).toBe('fallback');
    expect(result.current.warning).toBe(STATIONS_FALLBACK_WARNING);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });
});
