import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchStationsFromSocrata,
  STATIONS_FALLBACK_WARNING,
  type RawSocrataStation,
} from './xemaStations';

vi.mock('@/services/http/socrata', () => ({
  fetchSocrata: vi.fn(),
  fetchSocrataAll: vi.fn(),
}));

import { fetchSocrata } from '@/services/http/socrata';

const fetchSocrataMock = vi.mocked(fetchSocrata);

beforeEach(() => {
  fetchSocrataMock.mockReset();
});

describe('fetchStationsFromSocrata', () => {
  it('returns fallback metadata and warning when Socrata fails', async () => {
    fetchSocrataMock.mockRejectedValueOnce(new Error('offline'));

    const result = await fetchStationsFromSocrata();

    expect(result.metadataSource).toBe('fallback');
    expect(result.warning).toBe(STATIONS_FALLBACK_WARNING);
    expect(result.stations.length).toBeGreaterThan(0);
    expect(result.stations[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
    });
  });

  it('returns fallback metadata and warning when Socrata yields no usable stations', async () => {
    const rows: RawSocrataStation[] = [];
    fetchSocrataMock.mockResolvedValueOnce(rows);

    const result = await fetchStationsFromSocrata();

    expect(result.metadataSource).toBe('fallback');
    expect(result.warning).toBe(STATIONS_FALLBACK_WARNING);
    expect(result.stations.length).toBeGreaterThan(0);
  });
});
