import { describe, expect, it } from 'vitest';
import type { Observation, XemaTemporalBase, XemaValidationStatus } from '@/types/weather';
import { assessDailyQuality } from './dailyQuality';
import { buildWebDailyObservations, calculateQualityAwareDailyStats } from './webDailyObservations';

function reading(
  timestamp: string,
  values: Partial<Observation>,
  base: XemaTemporalBase = 'half-hourly',
  validation: XemaValidationStatus = 'valid',
): Observation {
  const variableMetadata = Object.fromEntries(
    ['temperature', 'humidity', 'precipitation', 'windSpeed', 'windSpeedMax'].map((key) => [key, {
      temporalBase: base, validationStatus: validation,
    }]),
  ) as Observation['variableMetadata'];
  return {
    timestamp, temperature: null, humidity: null, precipitation: null,
    windSpeed: null, windSpeedMax: null, windDirection: null,
    ...values, variableMetadata,
  };
}

describe('buildWebDailyObservations', () => {
  it('uses Madrid days rather than UTC/browser days and assesses an empty selected day', () => {
    const result = buildWebDailyObservations(
      ['2024-03-31', '2024-04-01', '2024-04-02'],
      [reading('2024-03-31T22:00:00', { temperature: 12 })],
    );
    expect(result.data.map((day) => day.timestamp)).toEqual(['2024-04-01']);
    expect(result.data[0].temperature).toBe(12);
    expect(result.qualityByDay['2024-03-31'].expectedSlots).toBe(46);
    expect(result.qualityByDay['2024-04-02'].variables.temperature.status).toBe('missing');
  });

  it('allocates hourly means by covered slots, but excludes a midnight-straddling hourly total and gust', () => {
    const result = buildWebDailyObservations(
      ['2024-03-31', '2024-04-01'],
      [
        reading('2024-03-31T21:30:00', {
          temperature: 10, humidity: 60, windSpeed: 2,
          precipitation: 4, windSpeedMax: 8,
        }, 'hourly'),
        reading('2024-03-31T22:30:00', {
          temperature: 20, humidity: 80, windSpeed: 4,
          precipitation: 1, windSpeedMax: 5,
        }),
      ],
    );
    expect(result.data.map((day) => day.timestamp)).toEqual(['2024-03-31', '2024-04-01']);
    expect(result.data[0]).toMatchObject({
      temperature: 10, humidity: 60, windSpeed: 2,
      precipitation: null, windSpeedMax: null,
    });
    expect(result.data[1]).toMatchObject({
      temperature: 15, humidity: 70, windSpeed: 3,
      precipitation: 1, windSpeedMax: 5,
    });
    expect(result.qualityByDay['2024-03-31'].variables.precipitation.coveredSlots).toBe(0);
    expect(result.qualityByDay['2024-04-01'].variables.precipitation.coveredSlots).toBe(1);
  });

  it('keeps a full 50-slot autumn DST day and does not count padded outside days', () => {
    const result = buildWebDailyObservations(
      ['2024-10-27'],
      [
        reading('2024-10-26T22:00:00', { temperature: 10 }),
        reading('2024-10-27T00:00:00', { temperature: 20 }),
        reading('2024-10-27T23:00:00', { temperature: 99 }),
      ],
    );
    expect(result.qualityByDay['2024-10-27'].expectedSlots).toBe(50);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].temperature).toBe(15);
  });

  it('counts an hourly precipitation total once and omits wind-direction-only days', () => {
    const result = buildWebDailyObservations(
      ['2024-04-01', '2024-04-02'],
      [
        reading('2024-04-01T10:00:00', { precipitation: 3, windSpeedMax: 7 }, 'hourly'),
        reading('2024-04-02T10:00:00', { windDirection: 180 }),
      ],
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ timestamp: '2024-04-01', precipitation: 3, windSpeedMax: 7 });
    expect(result.qualityByDay['2024-04-02'].variables.precipitation.status).toBe('missing');
  });

  it('does not double-count an hourly precipitation total overlapping a half-hour reading', () => {
    const result = buildWebDailyObservations(['2024-04-01'], [
      reading('2024-04-01T10:00:00', { precipitation: 4 }, 'hourly'),
      reading('2024-04-01T10:30:00', { precipitation: 1 }),
    ]);
    expect(result.data[0].precipitation).toBe(1);
    expect(result.qualityByDay['2024-04-01'].variables.precipitation.coveredSlots).toBe(1);
  });

  it('excludes unplaceable-base outliers from numeric values even when known coverage is partial', () => {
    const known = Array.from({ length: 40 }, (_, slot) => reading(
      new Date(Date.parse('2024-04-01T00:00:00Z') + slot * 30 * 60_000).toISOString(),
      { temperature: 10 },
    ));
    const result = buildWebDailyObservations(['2024-04-01'], [
      ...known,
      reading('2024-04-01T20:00:00', { temperature: 1000 }, 'unknown'),
      reading('2024-04-01T20:30:00', { temperature: 1000 }, 'unspecified'),
      reading('2024-04-01T21:00:00', { temperature: 1000 }, 'unreported'),
    ]);
    const quality = result.qualityByDay['2024-04-01'].variables.temperature;
    expect(quality.status).toBe('partial');
    expect(quality.coveredSlots).toBe(40);
    expect(quality.unresolvedBaseReadings).toBe(3);
    expect(result.data[0].temperature).toBe(10);
    expect(calculateQualityAwareDailyStats(result.data, result.qualityByDay).avgTemperature).toBe(10);
  });

  it('does not let unplaceable precipitation create an overlap with a known hourly total', () => {
    const result = buildWebDailyObservations(['2024-04-01'], [
      reading('2024-04-01T10:00:00', { precipitation: 4 }, 'hourly'),
      reading('2024-04-01T10:30:00', { precipitation: 1000 }, 'unknown'),
    ]);
    expect(result.data[0].precipitation).toBe(4);
    expect(result.qualityByDay['2024-04-01'].variables.precipitation.coveredSlots).toBe(2);
    expect(result.qualityByDay['2024-04-01'].variables.precipitation.unresolvedBaseReadings).toBe(1);
  });

  it('preserves pending validation on both local days of excluded midnight-crossing HO totals and gusts', () => {
    const result = buildWebDailyObservations(['2024-03-31', '2024-04-01'], [
      reading('2024-03-31T21:30:00', { precipitation: 4, windSpeedMax: 8 }, 'hourly', 'pending'),
    ]);
    expect(result.data).toEqual([]);
    for (const day of ['2024-03-31', '2024-04-01']) {
      for (const variable of ['precipitation', 'windSpeedMax'] as const) {
        expect(result.qualityByDay[day].variables[variable]).toMatchObject({
          coveredSlots: 0,
          status: 'incomplete',
          validationStatus: 'pending',
          validationCounts: { pending: 1 },
        });
      }
    }
  });

  it('keeps validation provenance of an excluded overlapping HO precipitation total', () => {
    const result = buildWebDailyObservations(['2024-04-01'], [
      reading('2024-04-01T10:00:00', { precipitation: 4 }, 'hourly', 'pending'),
      reading('2024-04-01T10:30:00', { precipitation: 1 }),
    ]);
    expect(result.data[0].precipitation).toBe(1);
    expect(result.qualityByDay['2024-04-01'].variables.precipitation).toMatchObject({
      coveredSlots: 1,
      status: 'incomplete',
      validationStatus: 'mixed',
      validationCounts: { pending: 1, valid: 1 },
    });
  });

  it('filters dashboard statistics independently for each variable', () => {
    const data = [
      reading('2024-04-01', { temperature: 10, humidity: 60, precipitation: 2, windSpeed: 2, windSpeedMax: 8 }),
      reading('2024-04-02', { temperature: 20, humidity: 90, precipitation: 9, windSpeed: 8, windSpeedMax: 20 }),
    ];
    const qualityByDay = {
      '2024-04-01': assessDailyQuality('2024-04-01', [reading('2024-03-31T22:00:00', { temperature: 10 })]),
      '2024-04-02': assessDailyQuality('2024-04-02', []),
    };
    for (const variable of ['temperature', 'humidity', 'precipitation', 'windSpeed', 'windSpeedMax'] as const) {
      qualityByDay['2024-04-01'].variables[variable].status = variable === 'humidity' ? 'incomplete' : 'partial';
      qualityByDay['2024-04-02'].variables[variable].status = variable === 'humidity' ? 'complete' : 'missing';
    }
    expect(calculateQualityAwareDailyStats(data, qualityByDay)).toMatchObject({
      avgTemperature: 10, avgHumidity: 90, totalPrecipitation: 2,
      avgWindSpeed: 2, maxWindSpeed: 8, dataPoints: 2,
    });
  });
});
