import { describe, expect, it } from 'vitest';
import type { Observation } from '@/types/weather';
import { buildExpectedDayKeys, computeDailyCoverage } from './dailyCoverage';

const makeDailyObs = (day: string): Observation => ({
  timestamp: day,
  temperature: null,
  humidity: null,
  windSpeed: null,
  windSpeedMax: null,
  windDirection: null,
  precipitation: null,
});

describe('daily coverage', () => {
  it('builds expected inclusive day keys for a 7-day range', () => {
    const from = new Date(2026, 1, 3, 0, 0, 0);
    const to = new Date(2026, 1, 9, 23, 59, 59);

    const expected = buildExpectedDayKeys({ from, to });

    expect(expected).toEqual([
      '2026-02-03',
      '2026-02-04',
      '2026-02-05',
      '2026-02-06',
      '2026-02-07',
      '2026-02-08',
      '2026-02-09',
    ]);
  });

  it('reports missing days when range has gaps', () => {
    const from = new Date(2026, 1, 3, 0, 0, 0);
    const to = new Date(2026, 1, 9, 23, 59, 59);
    const observations: Observation[] = [
      makeDailyObs('2026-02-03'),
      makeDailyObs('2026-02-04'),
      makeDailyObs('2026-02-05'),
      makeDailyObs('2026-02-06'),
      makeDailyObs('2026-02-07'),
    ];

    const coverage = computeDailyCoverage({ from, to }, observations);

    expect(coverage.expectedCount).toBe(7);
    expect(coverage.availableCount).toBe(5);
    expect(coverage.missingCount).toBe(2);
    expect(coverage.missingDays).toEqual(['2026-02-08', '2026-02-09']);
  });
});
