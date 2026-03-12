import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJson } from '@/services/http/fetchJson';
import { fetchSocrata, fetchSocrataAll } from './socrata';

vi.mock('@/services/http/fetchJson', () => ({
  fetchJson: vi.fn(),
}));

const fetchJsonMock = vi.mocked(fetchJson);

describe('socrata client', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('builds Socrata URLs and forwards the abort signal', async () => {
    const controller = new AbortController();
    fetchJsonMock.mockResolvedValueOnce({
      data: [{ id: '1' }],
      cached: false,
    });

    await fetchSocrata(
      'abcd-1234',
      {
        $select: 'id',
        $where: "foo = 'bar'",
        $limit: 10,
      },
      { signal: controller.signal },
    );

    const [url, options] = fetchJsonMock.mock.calls[0];
    const parsed = new URL(url as string);

    expect(parsed.origin).toBe('https://analisi.transparenciacatalunya.cat');
    expect(parsed.pathname).toBe('/resource/abcd-1234.json');
    expect(parsed.searchParams.get('$select')).toBe('id');
    expect(parsed.searchParams.get('$where')).toBe("foo = 'bar'");
    expect(parsed.searchParams.get('$limit')).toBe('10');
    expect(options).toEqual({
      provider: 'xema-transparencia',
      signal: controller.signal,
    });
  });

  it('paginates until the last page is shorter than the requested limit', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({ data: [{ id: '1' }, { id: '2' }], cached: false })
      .mockResolvedValueOnce({ data: [{ id: '3' }], cached: false });

    const result = await fetchSocrataAll<{ id: string }>('abcd-1234', { $limit: 2 });

    expect(result).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    expect(new URL(fetchJsonMock.mock.calls[0][0] as string).searchParams.get('$offset')).toBe('0');
    expect(new URL(fetchJsonMock.mock.calls[1][0] as string).searchParams.get('$offset')).toBe('2');
  });
});
