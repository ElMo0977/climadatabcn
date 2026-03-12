import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '@/types/weather';
import { fetchSocrataAll } from '@/services/http/socrata';
import { getObservations } from './xemaObservations';

vi.mock('@/services/http/socrata', () => ({
  fetchSocrataAll: vi.fn(),
}));

const fetchSocrataAllMock = vi.mocked(fetchSocrataAll);

describe('xemaObservations', () => {
  beforeEach(() => {
    fetchSocrataAllMock.mockReset();
  });

  it('rejects invalid station ids before calling Socrata', async () => {
    await expect(
      getObservations({
        stationId: 'bad-id!!',
        from: new Date('2024-02-01T00:00:00Z'),
        to: new Date('2024-02-02T00:00:00Z'),
        granularity: '30min',
      }),
    ).rejects.toBeInstanceOf(ProviderError);

    await expect(
      getObservations({
        stationId: 'bad-id!!',
        from: new Date('2024-02-01T00:00:00Z'),
        to: new Date('2024-02-02T00:00:00Z'),
        granularity: '30min',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });

    expect(fetchSocrataAllMock).not.toHaveBeenCalled();
  });

  it('forwards abort signals to Socrata pagination', async () => {
    const controller = new AbortController();
    fetchSocrataAllMock.mockResolvedValueOnce([]);

    await getObservations({
      stationId: 'X4',
      from: new Date('2024-02-01T00:00:00Z'),
      to: new Date('2024-02-02T00:00:00Z'),
      granularity: '30min',
      signal: controller.signal,
    });

    expect(fetchSocrataAllMock).toHaveBeenCalledWith(
      'nzvn-apee',
      expect.objectContaining({
        $where: expect.stringContaining("codi_estacio = 'X4'"),
      }),
      { signal: controller.signal },
    );
  });
});
