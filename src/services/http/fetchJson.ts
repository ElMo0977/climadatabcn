/**
 * HTTP client with timeout and typed errors.
 */

import { ProviderError, type ApiErrorCode, type DataSource } from '@/types/weather';

interface FetchOptions extends RequestInit {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Provider for error context */
  provider?: DataSource;
}

interface FetchResult<T> {
  data: T;
  cached: boolean;
}

/**
 * Fetch JSON with timeout and typed error handling.
 */
export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  const {
    timeout = 10000,
    provider,
    ...fetchOptions
  } = options;

  return fetchWithTimeout<T>(url, { ...fetchOptions, timeout }, provider);
}

async function fetchWithTimeout<T>(
  url: string,
  options: FetchOptions & { timeout: number },
  provider?: DataSource
): Promise<FetchResult<T>> {
  const { timeout, signal: externalSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  let didTimeout = false;
  const forwardAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', forwardAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw createErrorFromResponse(response, provider);
    }

    const data = await response.json();
    
    // Check for cache headers
    const cached = response.headers.get('x-cache') === 'HIT' ||
                   response.headers.get('cf-cache-status') === 'HIT';

    return { data, cached };
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }

    if (isAbortError(error)) {
      if (externalSignal?.aborted && !didTimeout) {
        throw error;
      }

      throw new ProviderError({
        code: 'TIMEOUT',
        message: `La petición ha excedido el tiempo límite (${timeout}ms)`,
        provider,
      });
    }

    if (error instanceof Error) {
      // Network error
      throw new ProviderError({
        code: 'NETWORK_ERROR',
        message: `Error de red: ${error.message}`,
        provider,
        details: { originalError: error.message },
      });
    }

    throw new ProviderError({
      code: 'UNKNOWN',
      message: 'Error desconocido',
      provider,
    });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', forwardAbort);
  }
}

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'AbortError';
}

function createErrorFromResponse(response: Response, provider?: DataSource): ProviderError {
  const status = response.status;

  let code: ApiErrorCode;
  let message: string;

  switch (status) {
    case 401:
      code = 'INVALID_API_KEY';
      message = 'API key inválida o expirada';
      break;
    case 403:
      code = 'INVALID_API_KEY';
      message = 'Acceso denegado - verifica tu API key';
      break;
    case 404:
      code = 'NOT_FOUND';
      message = 'Recurso no encontrado';
      break;
    case 429:
      code = 'RATE_LIMITED';
      message = 'Límite de peticiones excedido. Intenta más tarde.';
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      code = 'PROVIDER_ERROR';
      message = `Error del servidor (${status})`;
      break;
    default:
      code = 'PROVIDER_ERROR';
      message = `Error HTTP ${status}`;
  }

  return new ProviderError({
    code,
    message,
    provider,
    details: { status, statusText: response.statusText },
  });
}

/**
 * Build URL with query parameters
 */
export function buildUrl(base: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}
