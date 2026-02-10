/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { getObservationsQueryKey } from './useObservations';

describe('getObservationsQueryKey', () => {
  const base = {
    stationId: 'bcn-gracia',
    stationSource: 'opendata-bcn' as const,
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
