import { describe, expect, it } from 'vitest';
import { DAILY_CODES } from './xemaVariableMap';
import {
  buildDailyRangeBounds,
  filterDailyObservationsByRange,
  mapDailyRowsToObservations,
  type DailyRow,
} from './xemaTransparencia';

describe('mapDailyRowsToObservations', () => {
  it('maps daily avg and daily max wind to different fields', () => {
    const rows: DailyRow[] = [
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-05T00:00:00',
        codi_variable: DAILY_CODES.VVM10,
        valor_lectura: '3.4',
      },
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-05T00:00:00',
        codi_variable: DAILY_CODES.VVX10,
        valor_lectura: '11.2',
        hora_extrem: '1430',
      },
    ];

    const result = mapDailyRowsToObservations(rows);

    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe('2024-01-05');
    expect(result[0].windSpeed).toBe(3.4);
    expect(result[0].windSpeedMax).toBe(11.2);
  });

  it('does not backfill windSpeed with max when daily avg is missing', () => {
    const rows: DailyRow[] = [
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-06T00:00:00',
        codi_variable: DAILY_CODES.VVX10,
        valor_lectura: '8.6',
      },
    ];

    const result = mapDailyRowsToObservations(rows);

    expect(result).toHaveLength(1);
    expect(result[0].windSpeed).toBeNull();
    expect(result[0].windSpeedMax).toBe(8.6);
  });

  it('includes both range boundaries when daily rows exist for start and end', () => {
    const bounds = buildDailyRangeBounds(
      new Date(2026, 1, 3, 0, 0, 0),
      new Date(2026, 1, 9, 23, 59, 59),
    );

    const rows: DailyRow[] = [
      {
        codi_estacio: 'X4',
        data_lectura: '2026-02-02T00:00:00',
        codi_variable: DAILY_CODES.VVM10,
        valor_lectura: '1.0',
      },
      {
        codi_estacio: 'X4',
        data_lectura: '2026-02-03T00:00:00',
        codi_variable: DAILY_CODES.VVM10,
        valor_lectura: '2.0',
      },
      {
        codi_estacio: 'X4',
        data_lectura: '2026-02-09T00:00:00',
        codi_variable: DAILY_CODES.VVM10,
        valor_lectura: '3.0',
      },
      {
        codi_estacio: 'X4',
        data_lectura: '2026-02-10T00:00:00',
        codi_variable: DAILY_CODES.VVM10,
        valor_lectura: '4.0',
      },
    ];

    const mapped = mapDailyRowsToObservations(rows);
    const inRange = filterDailyObservationsByRange(mapped, bounds);

    expect(bounds.fromDay).toBe('2026-02-03');
    expect(bounds.toDay).toBe('2026-02-09');
    expect(inRange.map((o) => o.timestamp)).toEqual([
      '2026-02-03',
      '2026-02-09',
    ]);
  });
});
