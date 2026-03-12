/**
 * Socrata SODA API client for Transparència Catalunya (and similar).
 * Base: https://analisi.transparenciacatalunya.cat/
 */

import { fetchJson } from '@/services/http/fetchJson';
import { env } from '@/config/env';

const BASE_URL = 'https://analisi.transparenciacatalunya.cat';

interface SocrataRequestOptions {
  signal?: AbortSignal;
}

export interface SocrataQueryParams {
  $select?: string;
  $where?: string;
  $group?: string;
  $order?: string;
  $limit?: number;
  $offset?: number;
}

const DEFAULT_LIMIT = 50000;

/**
 * Fetch from a Socrata resource (JSON). Supports $select, $where, $order, $limit, $offset.
 * Pagination: use $offset for chunks (e.g. 0, 50000, 100000) if needed.
 */
export async function fetchSocrata<T = unknown[]>(
  resourceId: string,
  params: SocrataQueryParams = {},
  options: SocrataRequestOptions = {},
): Promise<T> {
  const search = new URLSearchParams();
  if (params.$select) search.set('$select', params.$select);
  if (params.$where) search.set('$where', params.$where);
  if (params.$group) search.set('$group', params.$group);
  if (params.$order) search.set('$order', params.$order);
  const limit = params.$limit ?? DEFAULT_LIMIT;
  search.set('$limit', String(limit));
  if (params.$offset != null) search.set('$offset', String(params.$offset));

  const url = `${BASE_URL}/resource/${resourceId}.json?${search.toString()}`;
  const { data } = await fetchJson<T>(url, {
    provider: 'xema-transparencia',
    signal: options.signal,
    timeout: env.xemaHttpTimeoutMs,
  });
  return data;
}

/**
 * Fetch all pages (by offset) until fewer than $limit rows returned.
 */
export async function fetchSocrataAll<T = Record<string, unknown>>(
  resourceId: string,
  params: Omit<SocrataQueryParams, '$offset'> & { $limit?: number },
  options: SocrataRequestOptions = {},
): Promise<T[]> {
  const limit = params.$limit ?? 5000;
  const out: T[] = [];
  let offset = 0;
  let page: T[];
  do {
    throwIfAborted(options.signal);
    page = await fetchSocrata<T[]>(
      resourceId,
      { ...params, $limit: limit, $offset: offset },
      options,
    );
    out.push(...page);
    offset += limit;
  } while (page.length === limit);
  return out;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error('Aborted');
  error.name = 'AbortError';
  throw error;
}
