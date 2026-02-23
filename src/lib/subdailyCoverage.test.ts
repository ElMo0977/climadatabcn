import { describe, expect, it } from 'vitest';
import { buildExpectedHalfHourKeys, computeSubdailyCoverage } from './subdailyCoverage';

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
  });
});
