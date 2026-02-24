import { describe, expect, it } from 'vitest';
import type { Observation } from '@/types/weather';
import { buildExpectedHalfHourKeys, computeSubdailyCoverage } from './subdailyCoverage';

function toLocalTimestamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:00`;
}

function makeObservation(timestamp: string): Observation {
  return {
    timestamp,
    temperature: 10,
    humidity: null,
    windSpeed: null,
    windSpeedMax: null,
    windDirection: null,
    precipitation: null,
  };
}

describe('subdailyCoverage', () => {
  it('builds half-hour slots including both range boundaries', () => {
    const from = new Date(2026, 1, 17, 0, 0, 0);
    const to = new Date(2026, 1, 17, 1, 0, 0);
    const keys = buildExpectedHalfHourKeys({ from, to });
    expect(keys).toEqual([
      '2026-02-17 00:00',
      '2026-02-17 00:30',
      '2026-02-17 01:00',
    ]);
  });

  it('reports missing subdaily slots', () => {
    const range = {
      from: new Date(2026, 1, 17, 0, 0, 0),
      to: new Date(2026, 1, 17, 1, 0, 0),
    };
    const coverage = computeSubdailyCoverage(range, [
      {
        timestamp: '2026-02-17T00:00:00',
        temperature: 10,
        humidity: null,
        windSpeed: null,
        windSpeedMax: null,
        windDirection: null,
        precipitation: null,
      },
      {
        timestamp: '2026-02-17T01:00:00',
        temperature: 12,
        humidity: null,
        windSpeed: null,
        windSpeedMax: null,
        windDirection: null,
        precipitation: null,
      },
    ]);

    expect(coverage.expectedCount).toBe(3);
    expect(coverage.availableCount).toBe(2);
    expect(coverage.missingCount).toBe(1);
    expect(coverage.missingSlots).toEqual(['2026-02-17 00:30']);
    expect(coverage.missingIntervals).toEqual([
      { start: '2026-02-17 00:30', end: '2026-02-17 00:30', missingCount: 1 },
    ]);
    expect(coverage.largestGap).toEqual({
      start: '2026-02-17 00:30',
      end: '2026-02-17 00:30',
      missingCount: 1,
    });
  });

  it('counts full-day ranges as 48 slots per day', () => {
    const from = new Date(2026, 1, 17, 0, 0, 0, 0);
    const to = new Date(2026, 1, 19, 23, 59, 59, 999);
    const keys = buildExpectedHalfHourKeys({ from, to });

    expect(keys.length).toBe(48 * 3);
    expect(keys[0]).toBe('2026-02-17 00:00');
    expect(keys[keys.length - 1]).toBe('2026-02-19 23:30');
  });

  it('detects the largest missing interval when a day only has data from 12:30 onwards', () => {
    const range = {
      from: new Date(2026, 1, 23, 0, 0, 0, 0),
      to: new Date(2026, 1, 23, 23, 59, 59, 999),
    };
    const observations: Observation[] = [];
    let cursor = new Date(2026, 1, 23, 12, 30, 0, 0);
    const end = new Date(2026, 1, 23, 23, 30, 0, 0);
    while (cursor.getTime() <= end.getTime()) {
      observations.push(makeObservation(toLocalTimestamp(cursor)));
      cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
    }

    const coverage = computeSubdailyCoverage(range, observations);

    expect(coverage.expectedCount).toBe(48);
    expect(coverage.availableCount).toBe(23);
    expect(coverage.missingCount).toBe(25);
    expect(coverage.largestGap).toEqual({
      start: '2026-02-23 00:00',
      end: '2026-02-23 12:00',
      missingCount: 25,
    });
  });

  it('returns largestGap as null when there are no missing slots', () => {
    const range = {
      from: new Date(2026, 1, 17, 0, 0, 0),
      to: new Date(2026, 1, 17, 1, 0, 0),
    };
    const coverage = computeSubdailyCoverage(range, [
      makeObservation('2026-02-17T00:00:00'),
      makeObservation('2026-02-17T00:30:00'),
      makeObservation('2026-02-17T01:00:00'),
    ]);

    expect(coverage.missingCount).toBe(0);
    expect(coverage.missingIntervals).toEqual([]);
    expect(coverage.largestGap).toBeNull();
  });
});
