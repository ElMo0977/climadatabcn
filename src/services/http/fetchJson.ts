/**
 * HTTP client with timeout, retries, and typed errors
 */

import { ProviderError, type ApiError, type ApiErrorCode, type DataProvider } from '@/domain/types';

interface FetchOptions extends RequestInit {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Number of retries on failure (default: 2) */
  retries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryDelay?: number;
  /** Provider for error context */
  provider?: DataProvider;
}

interface FetchResult<T> {
  data: T;
  cached: boolean;
}

/**
 * Fetch JSON with timeout, retries, and error handling
 */
export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  const {
    timeout = 10000,
    retries = 2,
    retryDelay = 1000,
    provider,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fetchWithTimeout<T>(url, { ...fetchOptions, timeout }, provider);
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof ProviderError) {
        const nonRetryableCodes: ApiErrorCode[] = [
          'MISSING_API_KEY',
          'INVALID_API_KEY',
          'INVALID_PARAMS',
          'NOT_FOUND',
        ];
        if (nonRetryableCodes.includes(error.code)) {
          throw error;
        }
      }

      // Wait before retrying (exponential backoff)
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt);
        console.warn(`Retry ${attempt + 1}/${retries} for ${url} in ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  throw lastError;
}

async function fetchWithTimeout<T>(
  url: string,
  options: FetchOptions & { timeout: number },
  provider?: DataProvider
): Promise<FetchResult<T>> {
  const { timeout, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

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
    clearTimeout(timeoutId);

    if (error instanceof ProviderError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ProviderError({
          code: 'TIMEOUT',
          message: `La petición ha excedido el tiempo límite (${timeout}ms)`,
          provider,
        });
      }

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
  }
}

function createErrorFromResponse(response: Response, provider?: DataProvider): ProviderError {
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
