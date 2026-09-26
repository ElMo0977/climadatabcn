import { describe, expect, it } from 'vitest';
import type { Observation, ObservationVariableMetadata } from '@/types/weather';
import { assessDailyQuality } from './dailyQuality';

const metadata = (
  temporalBase: ObservationVariableMetadata['temporalBase'] = 'half-hourly',
  validationStatus: ObservationVariableMetadata['validationStatus'] = 'valid',
): ObservationVariableMetadata => ({ temporalBase, validationStatus });

function reading(
  timestamp: string,
  overrides: Partial<Observation> = {},
): Observation {
  return {
    timestamp,
    temperature: null,
    humidity: null,
    precipitation: null,
    windSpeed: null,
    windSpeedMax: null,
    windDirection: null,
    ...overrides,
  };
}

function slots(startUtc: string, count: number, intervalMinutes = 30): string[] {
  const start = Date.parse(startUtc);
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * intervalMinutes * 60_000).toISOString().slice(0, 19),
  );
}

function temperatureRows(timestamps: string[], base: ObservationVariableMetadata['temporalBase'] = 'half-hourly') {
  return timestamps.map((timestamp) => reading(timestamp, {
    temperature: 20,
    variableMetadata: { temperature: metadata(base) },
  }));
}

describe('assessDailyQuality', () => {
  it.each([
    ['ordinary', '2026-09-21', '2026-09-20T22:00:00Z', 48],
    ['spring clock change', '2026-03-29', '2026-03-28T23:00:00Z', 46],
    ['autumn clock change', '2026-10-25', '2026-10-24T22:00:00Z', 50],
  ])('counts %s Europe/Madrid day without discarding repeated local times', (_label, day, start, expected) => {
    const quality = assessDailyQuality(day, temperatureRows(slots(start, expected)));

    expect(quality.expectedSlots).toBe(expected);
    expect(quality.variables.temperature).toMatchObject({
      coveredSlots: expected,
      coverage: 1,
      status: 'complete',
      longestMissingGapMinutes: 0,
    });
  });

  it('interprets offset-less XEMA timestamps as UTC, including local-day crossings', () => {
    const quality = assessDailyQuality('2026-09-21', temperatureRows([
      '2026-09-20T21:30:00',
      '2026-09-20T22:00:00',
      '2026-09-21T21:30:00',
      '2026-09-21T22:00:00',
    ]));

    expect(quality.variables.temperature.coveredSlots).toBe(2);
    expect(quality.variables.temperature.status).toBe('incomplete');
  });

  it('lets HO readings cover two forward half-hours and deduplicates mixed HO/SH overlap', () => {
    const hourly = temperatureRows(slots('2026-09-20T22:00:00Z', 24, 60), 'hourly');
    const duplicate = temperatureRows(['2026-09-20T22:30:00Z']);
    const quality = assessDailyQuality('2026-09-21', [...hourly, ...duplicate]);

    expect(quality.variables.temperature).toMatchObject({
      coveredSlots: 48,
      coverage: 1,
      status: 'complete',
    });
    expect(quality.variables.temperature.validationCounts.valid).toBe(25);
  });

  it.each([
    ['spring', '2026-03-29', '2026-03-28T23:00:00Z', 23, 46],
    ['autumn', '2026-10-25', '2026-10-24T22:00:00Z', 25, 50],
  ])('accepts complete hourly coverage on %s DST day', (_label, day, start, hours, expected) => {
    const quality = assessDailyQuality(day, temperatureRows(slots(start, hours, 60), 'hourly'));
    expect(quality.variables.temperature).toMatchObject({ coveredSlots: expected, status: 'complete' });
  });

  it('counts a preceding-day HO interval crossing local midnight', () => {
    const quality = assessDailyQuality('2026-09-21', temperatureRows([
      '2026-09-20T21:30:00Z',
    ], 'hourly'));

    expect(quality.variables.temperature.coveredSlots).toBe(1);
  });

  it('does not claim coverage from unknown temporal bases or non-finite values', () => {
    const rows = temperatureRows(slots('2026-09-20T22:00:00Z', 48));
    rows[0].variableMetadata = { temperature: metadata('unknown', 'pending') };
    rows[1].variableMetadata = { temperature: metadata('unspecified') };
    rows[2].variableMetadata = { temperature: metadata('unreported') };
    rows[3].temperature = Number.NaN;
    rows[4].temperature = Number.POSITIVE_INFINITY;
    const quality = assessDailyQuality('2026-09-21', rows);

    expect(quality.variables.temperature).toMatchObject({
      coveredSlots: 43,
      unresolvedBaseReadings: 3,
      status: 'partial',
      validationStatus: 'mixed',
    });
    expect(quality.variables.temperature.validationCounts).toMatchObject({ valid: 45, pending: 1 });
  });

  it('calls a finite reading with unresolved base incomplete rather than missing', () => {
    const quality = assessDailyQuality('2026-09-21', [reading('2026-09-20T22:00:00', {
      precipitation: 2,
      variableMetadata: { precipitation: metadata('unknown', 'pending') },
    })]);

    expect(quality.variables.precipitation).toMatchObject({
      coveredSlots: 0,
      unresolvedBaseReadings: 1,
      status: 'incomplete',
      isObservedLowerBound: true,
      validationStatus: 'pending',
    });
  });

  it('uses strict >70% and exact 100% coverage boundaries', () => {
    const autumn = slots('2026-10-24T22:00:00Z', 50);
    const precipitationRows = (times: string[]) => times.map((timestamp) => reading(timestamp, {
      precipitation: 0,
      variableMetadata: { precipitation: metadata() },
    }));
    const at70 = assessDailyQuality('2026-10-25', precipitationRows(autumn.slice(0, 35)));
    const over70 = assessDailyQuality('2026-10-25', precipitationRows(autumn.slice(0, 35).concat(autumn[49])));
    const nearlyFull = assessDailyQuality('2026-10-25', precipitationRows(autumn.slice(0, 49)));
    const empty = assessDailyQuality('2026-10-25', []);

    expect(at70.variables.precipitation).toMatchObject({ coverage: 0.7, status: 'incomplete' });
    expect(over70.variables.precipitation.status).toBe('partial');
    expect(nearlyFull.variables.precipitation.status).toBe('partial');
    expect(empty.variables.precipitation.status).toBe('missing');
  });

  it('allows exactly six hours of continuous gaps but rejects longer gaps for averages', () => {
    const all = slots('2026-09-20T22:00:00Z', 48);
    const sixHours = temperatureRows(all.filter((_, index) => index < 12 || index >= 24));
    const overSixHours = temperatureRows(all.filter((_, index) => index < 12 || index >= 25));
    for (const row of [...sixHours, ...overSixHours]) {
      row.humidity = 50;
      row.windSpeed = 3;
      row.variableMetadata = {
        ...row.variableMetadata,
        humidity: metadata(),
        windSpeed: metadata(),
      };
    }

    const allowed = assessDailyQuality('2026-09-21', sixHours);
    const rejected = assessDailyQuality('2026-09-21', overSixHours);
    for (const variable of ['temperature', 'humidity', 'windSpeed'] as const) {
      expect(allowed.variables[variable]).toMatchObject({ status: 'partial', longestMissingGapMinutes: 360 });
      expect(rejected.variables[variable]).toMatchObject({ status: 'incomplete', longestMissingGapMinutes: 390 });
    }
  });

  it('marks sparse precipitation and gust as observed lower bounds; validation stays separate', () => {
    const quality = assessDailyQuality('2026-09-21', [reading('2026-09-20T22:00:00', {
      precipitation: 0,
      windSpeedMax: 8,
      variableMetadata: {
        precipitation: metadata('half-hourly', 'pending'),
        windSpeedMax: metadata('half-hourly', 'not-started'),
      },
    })]);

    expect(quality.variables.precipitation).toMatchObject({
      status: 'incomplete', isObservedLowerBound: true, validationStatus: 'pending',
    });
    expect(quality.variables.windSpeedMax).toMatchObject({
      status: 'incomplete', isObservedLowerBound: true, validationStatus: 'not-started',
    });
    expect(quality.variables.temperature).toMatchObject({ status: 'missing', isObservedLowerBound: false });
  });
});
