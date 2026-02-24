import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DAILY_CODES } from './xemaVariableMap';
import type { RawSocrataStation } from './xemaStations';
import {
  buildDailyRangeBounds,
  fetchStationsFromSocrata,
  filterDailyObservationsByRange,
  getObservations,
  listStations,
  mapDailyRowsToObservations,
  mapSubdailyRowsToObservations,
  type DailyRow,
} from './xemaTransparencia';

vi.mock('@/services/http/socrata', () => ({
  fetchSocrata: vi.fn(),
  fetchSocrataAll: vi.fn(),
}));

import * as socrataClient from '@/services/http/socrata';

const fetchSocrataMock = vi.mocked(socrataClient.fetchSocrata);
const fetchSocrataAllMock = vi.mocked(socrataClient.fetchSocrataAll);

interface RawSubdailyValueRow {
  codi_estacio: string;
  data_lectura: string;
  codi_variable: string;
  valor_lectura?: string;
  codi_estat?: string;
}

interface RawSubdailyGustRow {
  data_lectura: string;
  valor_lectura?: string;
}

beforeEach(() => {
  fetchSocrataMock.mockReset();
  fetchSocrataAllMock.mockReset();
});

describe('mapDailyRowsToObservations', () => {
  it('maps daily avg and daily max wind to different fields', () => {
    const rows: DailyRow[] = [
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-05T00:00:00',
        codi_variable: DAILY_CODES.VVM10,
        valor: '3.4',
      },
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-05T00:00:00',
        codi_variable: DAILY_CODES.VVX10,
        valor: '11.2',
      },
    ];

    const result = mapDailyRowsToObservations(rows);

    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe('2024-01-05');
    expect(result[0].temperature).toBeNull();
    expect(result[0].humidity).toBeNull();
    expect(result[0].precipitation).toBeNull();
    expect(result[0].windSpeed).toBe(3.4);
    expect(result[0].windSpeedMax).toBe(11.2);
    expect(result[0].windGustTime).toBeNull();
  });

  it('does not backfill windSpeed with max when daily avg is missing', () => {
    const rows: DailyRow[] = [
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-06T00:00:00',
        codi_variable: DAILY_CODES.VVX10,
        valor: '8.6',
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
        valor: '1.0',
      },
      {
        codi_estacio: 'X4',
        data_lectura: '2026-02-03T00:00:00',
        codi_variable: DAILY_CODES.VVM10,
        valor: '2.0',
      },
      {
        codi_estacio: 'X4',
        data_lectura: '2026-02-09T00:00:00',
        codi_variable: DAILY_CODES.VVM10,
        valor: '3.0',
      },
      {
        codi_estacio: 'X4',
        data_lectura: '2026-02-10T00:00:00',
        codi_variable: DAILY_CODES.VVM10,
        valor: '4.0',
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

describe('mapSubdailyRowsToObservations', () => {
  it('maps all configured subdaily variables by timestamp', () => {
    const result = mapSubdailyRowsToObservations([
      { codi_estacio: 'X4', data_lectura: '2024-01-05T10:00:00', codi_variable: '32', valor_lectura: '13.5' },
      { codi_estacio: 'X4', data_lectura: '2024-01-05T10:00:00', codi_variable: '33', valor_lectura: '72' },
      { codi_estacio: 'X4', data_lectura: '2024-01-05T10:00:00', codi_variable: '35', valor_lectura: '0.2' },
      { codi_estacio: 'X4', data_lectura: '2024-01-05T10:00:00', codi_variable: '30', valor_lectura: '3.1' },
      { codi_estacio: 'X4', data_lectura: '2024-01-05T10:00:00', codi_variable: '31', valor_lectura: '290' },
      { codi_estacio: 'X4', data_lectura: '2024-01-05T10:00:00', codi_variable: '50', valor_lectura: '9.7' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      timestamp: '2024-01-05T10:00:00',
      temperature: 13.5,
      humidity: 72,
      precipitation: 0.2,
      windSpeed: 3.1,
      windDirection: 290,
      windSpeedMax: 9.7,
    });
  });

  it('returns null when valor_lectura is missing or empty', () => {
    const result = mapSubdailyRowsToObservations([
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-05T11:00:00',
        codi_variable: '32',
        valor_lectura: '',
      },
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-05T11:00:00',
        codi_variable: '33',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].temperature).toBeNull();
    expect(result[0].humidity).toBeNull();
  });
});

describe('getObservations', () => {
  it('queries daily resource and maps rows to observations', async () => {
    const dailyRows: DailyRow[] = [
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-05T00:00:00',
        codi_variable: DAILY_CODES.TM,
        valor: '11.2',
      },
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-05T00:00:00',
        codi_variable: DAILY_CODES.VVM10,
        valor: '2.3',
      },
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-05T00:00:00',
        codi_variable: DAILY_CODES.VVX10,
        valor: '10.7',
      },
    ];
    const gustRows: RawSubdailyGustRow[] = [
      { data_lectura: '2024-01-05T04:30:00', valor_lectura: '9.2' },
      { data_lectura: '2024-01-05T16:00:00', valor_lectura: '10.7' },
    ];

    fetchSocrataAllMock
      .mockResolvedValueOnce(dailyRows)
      .mockResolvedValueOnce(gustRows);

    const result = await getObservations({
      stationId: 'X4',
      from: new Date('2024-01-01T00:00:00Z'),
      to: new Date('2024-01-07T00:00:00Z'),
      granularity: 'day',
    });

    expect(fetchSocrataAllMock).toHaveBeenCalledWith(
      '7bvh-jvq2',
      expect.objectContaining({
        $where: expect.stringContaining("codi_estacio = 'X4'"),
        $select: 'codi_estacio,data_lectura,codi_variable,valor',
      }),
    );
    expect(fetchSocrataAllMock).toHaveBeenNthCalledWith(
      2,
      'nzvn-apee',
      expect.objectContaining({
        $select: 'data_lectura,valor_lectura',
        $where: expect.stringContaining(`codi_variable = '50'`),
      }),
    );

    expect(result[0]).toMatchObject({
      timestamp: '2024-01-05',
      temperature: 11.2,
      windSpeed: 2.3,
      windSpeedMax: 10.7,
      windGustTime: '16:00',
    });
  });

  it('queries subdaily resource for 30min granularity', async () => {
    const subdailyRows: RawSubdailyValueRow[] = [
      {
        codi_estacio: 'X4',
        data_lectura: '2024-01-05T10:00:00',
        codi_variable: '32',
        valor_lectura: '12.1',
        codi_estat: 'V',
      },
    ];
    fetchSocrataAllMock.mockResolvedValueOnce(subdailyRows);

    const result = await getObservations({
      stationId: 'X4',
      from: new Date('2024-01-01T00:00:00Z'),
      to: new Date('2024-01-07T00:00:00Z'),
      granularity: '30min',
    });

    expect(fetchSocrataAllMock).toHaveBeenCalledTimes(1);
    expect(fetchSocrataAllMock).toHaveBeenCalledWith(
      'nzvn-apee',
      expect.objectContaining({
        $select: expect.stringContaining('codi_estat'),
        $where: expect.stringContaining("codi_estacio = 'X4'"),
      }),
    );
    const [, query] = fetchSocrataAllMock.mock.calls[0] as [
      string,
      { $select?: string; $where?: string },
    ];
    expect(query.$select).toBe('codi_estacio,data_lectura,codi_variable,valor_lectura,codi_estat');
    expect(query.$select).toContain('codi_estat');
    expect(query.$select).not.toContain(',valor,');
    expect(query.$select).not.toContain('valor,valor_lectura');
    expect(query.$where).toContain("data_lectura >= '2024-01-01T00:00:00'");
    expect(query.$where).toContain("data_lectura <= '2024-01-07T23:59:59'");
    expect(query.$where).toContain("codi_variable in ('32','33','35','30','31','50')");
    expect(query.$where).not.toContain("codi_estat in ('V','T')");

    expect(result[0]).toMatchObject({
      timestamp: '2024-01-05T10:00:00',
      temperature: 12.1,
    });
  });
});

describe('fetchStationsFromSocrata', () => {
  it('uses stations metadata resource and maps station fields', async () => {
    const rows: RawSocrataStation[] = [
      {
        codi_estacio: 'X4',
        nom_estacio: 'Barcelona - el Raval',
        latitud: '41.38',
        longitud: '2.17',
        altitud: '33',
        nom_municipi: 'Barcelona',
      },
    ];
    fetchSocrataMock.mockResolvedValueOnce(rows);

    const result = await fetchStationsFromSocrata();

    expect(fetchSocrataMock).toHaveBeenCalledWith(
      'yqwd-vj5e',
      expect.objectContaining({
        $where: "nom_xarxa = 'XEMA' AND codi_estat_ema = '2'",
      }),
    );
    expect(result).toEqual([
      {
        id: 'X4',
        name: 'Barcelona - el Raval',
        latitude: 41.38,
        longitude: 2.17,
        elevation: 33,
        municipality: 'Barcelona',
      },
    ]);
  });
});

describe('listStations fallback ids', () => {
  it('uses real XEMA station codes so observations can still be fetched in fallback mode', () => {
    const ids = listStations().map((s) => s.id);
    expect(ids).toContain('X4');
    expect(ids).toContain('X8');
    expect(ids).toContain('D5');
    expect(ids).not.toContain('bcn-raval');
  });
});
