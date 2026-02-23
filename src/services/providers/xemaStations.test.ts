import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchStationsFromSocrata } from './xemaTransparencia';

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
  it('uses stations metadata resource and maps station fields', async () => {
    fetchSocrataMock.mockResolvedValueOnce([
      {
        codi_estacio: 'X4',
        nom_estacio: 'Barcelona - el Raval',
        latitud: '41.38',
        longitud: '2.17',
        altitud: '33',
        nom_municipi: 'Barcelona',
      },
    ] as any);

    const result = await fetchStationsFromSocrata();

    expect(fetchSocrataMock).toHaveBeenCalledWith(
      'yqwd-vj5e',
      expect.objectContaining({
        $where: "nom_xarxa = 'XEMA' AND codi_estat_ema = '2'",
      }),
    );
    expect(result).toEqual([
      {
        id: 'X4',
        name: 'Barcelona - el Raval',
        latitude: 41.38,
        longitude: 2.17,
        elevation: 33,
        municipality: 'Barcelona',
      },
    ]);
  });
});
