import { describe, it, expect } from 'vitest';
import { createMockTimeseries } from './mockData';

describe('createMockTimeseries', () => {
  it('daily aggregation returns one point per day in range', () => {
    const from = new Date('2025-01-01T00:00:00.000Z');
    const to = new Date('2025-01-07T00:00:00.000Z');
    const result = createMockTimeseries(
      'X2',
      'opendata-bcn',
      from,
      to,
      'temperature',
      'daily'
    );
    expect(result.aggregation).toBe('daily');
    expect(result.points.length).toBe(7);
    const dates = result.points.map((p) => p.timestamp.split('T')[0]);
    expect(dates).toEqual([
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
      '2025-01-04',
      '2025-01-05',
      '2025-01-06',
      '2025-01-07',
    ]);
  });

  it('hourly aggregation returns multiple points per day', () => {
    const from = new Date('2025-01-01T00:00:00.000Z');
    const to = new Date('2025-01-01T23:00:00.000Z');
    const result = createMockTimeseries(
      'X2',
      'opendata-bcn',
      from,
      to,
      'temperature',
      'hourly'
    );
    expect(result.aggregation).toBe('hourly');
    expect(result.points.length).toBe(24);
  });
});
