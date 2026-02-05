import { describe, it, expect } from 'vitest';
import { aggregateWindByBucket } from './weatherUtils';
import type { Observation } from '@/types/weather';

const makeObs = (timestamp: string, windSpeed: number | null): Observation => ({
  timestamp,
  temperature: null,
  humidity: null,
  windSpeed,
  windSpeedMin: null,
  windSpeedMax: null,
  precipitation: null,
});

describe('aggregateWindByBucket', () => {
  it('returns empty array when there is no data', () => {
    const result = aggregateWindByBucket([], obs => obs.timestamp);
    expect(result).toEqual([]);
  });

  it('drops buckets without valid wind data', () => {
    const data = [
      makeObs('2024-01-01T00:00:00Z', null),
      makeObs('2024-01-01T01:00:00Z', Number.NaN),
    ];
    const result = aggregateWindByBucket(data, obs => obs.timestamp);
    expect(result).toEqual([]);
  });

  it('sets min=avg=max when only one valid point per bucket', () => {
    const data = [makeObs('2024-01-01T00:00:00Z', 5)];
    const result = aggregateWindByBucket(data, obs => obs.timestamp);
    expect(result).toEqual([
      { time: '2024-01-01T00:00:00Z', windMin: 5, windAvg: 5, windMax: 5 },
    ]);
  });

  it('aggregates multiple points per bucket and sorts by time', () => {
    const data = [
      makeObs('2024-01-02T00:00:00Z', 8),
      makeObs('2024-01-01T00:00:00Z', 4),
      makeObs('2024-01-01T00:30:00Z', 6),
    ];

    const result = aggregateWindByBucket(data, obs => obs.timestamp.split('T')[0]);

    expect(result).toEqual([
      { time: '2024-01-01', windMin: 4, windAvg: 5, windMax: 6 },
      { time: '2024-01-02', windMin: 8, windAvg: 8, windMax: 8 },
    ]);
  });
});
