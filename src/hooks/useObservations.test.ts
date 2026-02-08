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
    const keyHourly = getObservationsQueryKey({ ...base, granularity: 'hourly' });
    expect(keyDaily[5]).toBe('daily');
    expect(keyHourly[5]).toBe('hourly');
  });

  it('different granularity produces different queryKey (triggers refetch)', () => {
    const keyDaily = getObservationsQueryKey({ ...base, granularity: 'daily' });
    const keyHourly = getObservationsQueryKey({ ...base, granularity: 'hourly' });
    expect(keyDaily).not.toEqual(keyHourly);
  });

  it('same params produce same key', () => {
    const key1 = getObservationsQueryKey({ ...base, granularity: 'daily' });
    const key2 = getObservationsQueryKey({ ...base, granularity: 'daily' });
    expect(key1).toEqual(key2);
  });
});
