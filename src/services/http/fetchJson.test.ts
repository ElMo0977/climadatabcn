import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '@/types/weather';
import { fetchJson } from './fetchJson';

const fetchMock = vi.fn();

function createAbortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchJson', () => {
  it('returns parsed data and cache metadata on success', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'x-cache': 'HIT' },
      }),
    );

    await expect(fetchJson<{ ok: boolean }>('https://example.com')).resolves.toEqual({
      data: { ok: true },
      cached: true,
    });
  });

  it('maps HTTP status errors to ProviderError', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Too Many Requests', {
        status: 429,
        statusText: 'Too Many Requests',
      }),
    );

    await expect(fetchJson('https://example.com')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Límite de peticiones excedido. Intenta más tarde.',
    });
  });

  it('does not retry network failures internally', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    await expect(fetchJson('https://example.com')).rejects.toBeInstanceOf(ProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('converts timeout aborts into ProviderError TIMEOUT', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(createAbortError()), { once: true });
      });
    });

    const promise = fetchJson('https://example.com/slow', { timeout: 25 });
    const expectation = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(25);

    await expectation;
  });

  it('rethrows external aborts so query cancellation does not look like a timeout', async () => {
    fetchMock.mockImplementation((_url, init) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(createAbortError()), { once: true });
      });
    });
    const controller = new AbortController();

    const promise = fetchJson('https://example.com/cancel', {
      signal: controller.signal,
      timeout: 1000,
    });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
