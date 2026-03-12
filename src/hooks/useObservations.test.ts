import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError, type Observation, type Station } from '@/types/weather';
import { getObservations } from '@/services/providers/xemaTransparencia';
import { logDataDebug } from '@/lib/dataDebug';
import { getObservationsQueryKey, useObservations } from './useObservations';

vi.mock('@/services/providers/xemaTransparencia', () => ({
  getObservations: vi.fn(),
}));

vi.mock('@/lib/dataDebug', () => ({
  logDataDebug: vi.fn(),
}));

const mockGetObservations = vi.mocked(getObservations);
const mockLogDataDebug = vi.mocked(logDataDebug);

const TEST_STATION: Station = {
  id: 'X4',
  name: 'Barcelona - el Raval',
  latitude: 41.3839,
  longitude: 2.16775,
  elevation: 33,
  distance: 0.5,
  source: 'xema-transparencia',
};

const TEST_DATE_RANGE = {
  from: new Date('2024-02-01T00:00:00Z'),
  to: new Date('2024-02-07T00:00:00Z'),
};

function createWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retryDelay: 0,
      },
    },
  });
}

describe('getObservationsQueryKey', () => {
  const base = {
    stationId: 'bcn-gracia',
    stationSource: 'xema-transparencia' as const,
    fromStr: '2024-02-01',
    toStr: '2024-02-07',
  };

  it('includes granularity in the key', () => {
    const keyDaily = getObservationsQueryKey({ ...base, granularity: 'daily' });
    const key30min = getObservationsQueryKey({ ...base, granularity: '30min' });
    expect(keyDaily[5]).toBe('daily');
    expect(key30min[5]).toBe('30min');
  });

  it('different granularity produces different queryKey (triggers refetch)', () => {
    const keyDaily = getObservationsQueryKey({ ...base, granularity: 'daily' });
    const key30min = getObservationsQueryKey({ ...base, granularity: '30min' });
    expect(keyDaily).not.toEqual(key30min);
  });

  it('same params produce same key', () => {
    const key1 = getObservationsQueryKey({ ...base, granularity: 'daily' });
    const key2 = getObservationsQueryKey({ ...base, granularity: 'daily' });
    expect(key1).toEqual(key2);
  });
});

describe('useObservations', () => {
  beforeEach(() => {
    mockGetObservations.mockReset();
    mockLogDataDebug.mockReset();
  });

  it('maps daily granularity to day and forwards an abort signal', async () => {
    const observations: Observation[] = [
      {
        timestamp: '2024-02-01',
        temperature: 12,
        humidity: 60,
        windSpeed: 2.1,
        windSpeedMax: 4.2,
        windDirection: null,
        precipitation: 0.3,
      },
    ];
    let capturedSignal: AbortSignal | undefined;
    mockGetObservations.mockImplementationOnce(async (params) => {
      capturedSignal = params.signal;
      return observations;
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useObservations({
          station: TEST_STATION,
          dateRange: TEST_DATE_RANGE,
          granularity: 'daily',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetObservations).toHaveBeenCalledWith(
      expect.objectContaining({
        stationId: 'X4',
        granularity: 'day',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(result.current.dataSourceLabel).toContain(TEST_STATION.name);
    expect(mockLogDataDebug).toHaveBeenCalledTimes(1);
  });

  it('preserves ProviderError details and does not retry invalid params', async () => {
    const error = new ProviderError({
      code: 'INVALID_PARAMS',
      message: 'invalid station',
      provider: 'xema-transparencia',
    });
    mockGetObservations.mockRejectedValue(error);

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useObservations({
          station: TEST_STATION,
          dateRange: TEST_DATE_RANGE,
          granularity: '30min',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.error).toBe(error));

    expect(result.current.error?.code).toBe('INVALID_PARAMS');
    expect(result.current.error?.provider).toBe('xema-transparencia');
    expect(mockGetObservations).toHaveBeenCalledTimes(1);
  });

  it('retries transient provider errors under React Query control', async () => {
    const error = new ProviderError({
      code: 'NETWORK_ERROR',
      message: 'offline',
      provider: 'xema-transparencia',
    });
    mockGetObservations.mockRejectedValue(error);

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useObservations({
          station: TEST_STATION,
          dateRange: TEST_DATE_RANGE,
          granularity: '30min',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.error).toBe(error));

    expect(mockGetObservations).toHaveBeenCalledTimes(3);
  });

  it('does not surface cancelled observation queries as visible errors', async () => {
    const queryClient = createQueryClient();
    const queryKey = getObservationsQueryKey({
      stationId: TEST_STATION.id,
      stationSource: TEST_STATION.source ?? null,
      fromStr: '2024-02-01',
      toStr: '2024-02-07',
      granularity: '30min',
    });

    mockGetObservations.mockImplementationOnce(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              const abortError = new Error('Aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            },
            { once: true },
          );
        }),
    );

    const { result } = renderHook(
      () =>
        useObservations({
          station: TEST_STATION,
          dateRange: TEST_DATE_RANGE,
          granularity: '30min',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(mockGetObservations).toHaveBeenCalledTimes(1));
    await queryClient.cancelQueries({ queryKey });
    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.error).toBeNull();
  });
});
