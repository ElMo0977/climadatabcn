import { describe, it, expect } from 'vitest';
import { aggregateWindByBucket, aggregate30minToDaily, buildDailySummary, calculateStats } from './weatherUtils';
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

describe('aggregate30minToDaily', () => {
  it('returns empty array for empty input', () => {
    expect(aggregate30minToDaily([])).toEqual([]);
  });

  it('groups multiple 30-min observations into one daily entry', () => {
    const observations: Observation[] = [
      { timestamp: '2024-03-11T08:00:00', temperature: 10, humidity: 60, windSpeed: 2, windSpeedMax: 3, windDirection: 90, precipitation: 0 },
      { timestamp: '2024-03-11T08:30:00', temperature: 12, humidity: 62, windSpeed: 3, windSpeedMax: 5, windDirection: 100, precipitation: 0.2 },
      { timestamp: '2024-03-11T09:00:00', temperature: 14, humidity: 58, windSpeed: 1, windSpeedMax: 2, windDirection: 110, precipitation: 0.1 },
    ];
    const result = aggregate30minToDaily(observations);
    expect(result).toHaveLength(1);
    const day = result[0];
    expect(day.timestamp).toBe('2024-03-11');
    expect(day.temperature).toBe(12); // avg(10,12,14)
    expect(day.humidity).toBe(60);    // round(avg(60,62,58))
    expect(day.precipitation).toBe(0.3); // sum(0, 0.2, 0.1)
    expect(day.windSpeed).toBe(2);    // avg(2,3,1)
    expect(day.windSpeedMax).toBe(5); // max(3,5,2)
    expect(day.windGustTime).toBe('08:30'); // timestamp of max gust
    expect(day.windDirection).toBeNull();
  });

  it('produces one entry per day and sorts by date', () => {
    const observations: Observation[] = [
      { timestamp: '2024-03-12T10:00:00', temperature: 15, humidity: 50, windSpeed: 2, windSpeedMax: 3, windDirection: null, precipitation: 0 },
      { timestamp: '2024-03-11T10:00:00', temperature: 10, humidity: 55, windSpeed: 1, windSpeedMax: 2, windDirection: null, precipitation: 1 },
    ];
    const result = aggregate30minToDaily(observations);
    expect(result).toHaveLength(2);
    expect(result[0].timestamp).toBe('2024-03-11');
    expect(result[1].timestamp).toBe('2024-03-12');
  });

  it('returns null for fields with no valid values', () => {
    const observations: Observation[] = [
      { timestamp: '2024-03-11T08:00:00', temperature: null, humidity: null, windSpeed: null, windSpeedMax: null, windDirection: null, precipitation: null },
    ];
    const result = aggregate30minToDaily(observations);
    expect(result[0].temperature).toBeNull();
    expect(result[0].humidity).toBeNull();
    expect(result[0].precipitation).toBeNull();
    expect(result[0].windSpeed).toBeNull();
    expect(result[0].windSpeedMax).toBeNull();
    expect(result[0].windGustTime).toBeNull();
  });

  it('sets windGustTime to null when windSpeedMax has no valid values', () => {
    const observations: Observation[] = [
      { timestamp: '2024-03-11T08:00:00', temperature: 10, humidity: 50, windSpeed: 2, windSpeedMax: null, windDirection: null, precipitation: 0 },
    ];
    const result = aggregate30minToDaily(observations);
    expect(result[0].windGustTime).toBeNull();
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

describe('calculateStats', () => {
  const makeObservation = (overrides: Partial<Observation>): Observation => ({
    timestamp: '2024-01-01T00:00:00Z',
    temperature: null,
    humidity: null,
    windSpeed: null,
    windSpeedMax: null,
    windDirection: null,
    precipitation: null,
    ...overrides,
  });

  it('keeps total precipitation equal to 0 (not null)', () => {
    const stats = calculateStats([makeObservation({ precipitation: 0 })]);
    expect(stats.totalPrecipitation).toBe(0);
  });

  it('keeps average wind speed equal to 0 (not null)', () => {
    const stats = calculateStats([makeObservation({ windSpeed: 0 })]);
    expect(stats.avgWindSpeed).toBe(0);
  });

  it('keeps average temperature equal to 0 (not null)', () => {
    const stats = calculateStats([
      makeObservation({ temperature: -1 }),
      makeObservation({ temperature: 1 }),
    ]);
    expect(stats.avgTemperature).toBe(0);
  });

  it('maps NaN and undefined values to null', () => {
    const withNaN = makeObservation({
      temperature: Number.NaN,
      humidity: Number.NaN,
      windSpeed: Number.NaN,
      windSpeedMax: Number.NaN,
      precipitation: Number.NaN,
    });
    const withUndefined = makeObservation({
      temperature: undefined as unknown as number | null,
      humidity: undefined as unknown as number | null,
      windSpeed: undefined as unknown as number | null,
      windSpeedMax: undefined as unknown as number | null,
      precipitation: undefined as unknown as number | null,
    });

    const stats = calculateStats([withNaN, withUndefined]);
    expect(stats.avgTemperature).toBeNull();
    expect(stats.avgHumidity).toBeNull();
    expect(stats.avgWindSpeed).toBeNull();
    expect(stats.maxWindSpeed).toBeNull();
    expect(stats.totalPrecipitation).toBeNull();
  });
});
