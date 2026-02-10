/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { aggregateWindByBucket, buildDailySummary } from './weatherUtils';
import type { Observation } from '@/types/weather';

const makeObs = (timestamp: string, windSpeed: number | null): Observation => ({
  timestamp,
  temperature: null,
  humidity: null,
  windSpeed,
  windSpeedMax: null,
  windDirection: null,
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

  it('sets avg=max when only one valid point per bucket', () => {
    const data = [makeObs('2024-01-01T00:00:00Z', 5)];
    const result = aggregateWindByBucket(data, obs => obs.timestamp);
    expect(result).toEqual([
      { time: '2024-01-01T00:00:00Z', windAvg: 5, windMax: 5 },
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
      { time: '2024-01-01', windAvg: 5, windMax: 6 },
      { time: '2024-01-02', windAvg: 8, windMax: 8 },
    ]);
  });

  it('computes daily avg as temporal weighted mean (sum of speeds / N)', () => {
    const data = [
      makeObs('2024-01-01T00:00:00Z', 2),
      makeObs('2024-01-01T06:00:00Z', 4),
      makeObs('2024-01-01T12:00:00Z', 6),
      makeObs('2024-01-01T18:00:00Z', 8),
    ];
    const result = aggregateWindByBucket(data, obs => obs.timestamp.split('T')[0]);
    expect(result).toHaveLength(1);
    expect(result[0].windMax).toBe(8);
    expect(result[0].windAvg).toBe(5);
  });
});

describe('buildDailySummary', () => {
  it('aggregates 24 hourly points for one day into one row', () => {
    const dayKey = '2024-01-15';
    const observations: Observation[] = Array.from({ length: 24 }, (_, i) => ({
      timestamp: `${dayKey}T${String(i).padStart(2, '0')}:00:00`,
      temperature: 10 + i * 0.5,
      humidity: 50 + i,
      windSpeed: 2 + (i % 5),
      windSpeedMax: null,
      windDirection: null,
      precipitation: i === 12 ? 1 : 0,
    }));
    const result = buildDailySummary(observations);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe(dayKey);
    expect(result[0].tempAvg).not.toBeNull();
    expect(result[0].humidityAvg).not.toBeNull();
    expect(result[0].precipSum).toBe(1);
  });
});
