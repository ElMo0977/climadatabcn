import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDownloadFileBuffer, workbookRegistry } = vi.hoisted(() => ({
  mockDownloadFileBuffer: vi.fn(),
  workbookRegistry: {
    workbooks: [] as Array<{
      sheets: Array<{
        name: string;
        columns: unknown[];
        rows: Array<{ number?: number; values: unknown }>;
      }>;
    }>,
  },
}));

vi.mock('@/lib/weatherUtils', () => ({
  downloadFileBuffer: mockDownloadFileBuffer,
}));

vi.mock('exceljs', () => {
  class MockWorksheet {
    name: string;
    columns: unknown[] = [];
    rows: Array<{ number?: number; values: unknown }> = [];

    constructor(name: string) {
      this.name = name;
    }

    spliceRows(start: number, _remove: number, ...rows: unknown[][]): void {
      this.rows.splice(start - 1, 0, ...rows.map((values) => ({ values })));
    }

    getRow() {
      return {
        font: {},
        eachCell: () => {},
      };
    }

    addRow(values: unknown) {
      const row = { number: this.rows.length + 1, values };
      this.rows.push(row);
      return row;
    }

    getCell() {
      return {};
    }
  }

  class MockWorkbook {
    sheets: MockWorksheet[] = [];
    xlsx = {
      writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    constructor() {
      workbookRegistry.workbooks.push(this);
    }

    addWorksheet(name: string) {
      const sheet = new MockWorksheet(name);
      this.sheets.push(sheet);
      return sheet;
    }
  }

  return { Workbook: MockWorkbook };
});

import { buildAndDownloadExcel } from '@/lib/exportExcel';

describe('buildAndDownloadExcel', () => {
  beforeEach(() => {
    mockDownloadFileBuffer.mockReset();
    workbookRegistry.workbooks.length = 0;
  });

  it('does not throw with empty datasets', async () => {
    await expect(buildAndDownloadExcel({
      obs30min: [],
      obsDaily: [],
      stationName: 'Estacion Test',
      dateRange: {
        from: new Date('2024-02-01T00:00:00'),
        to: new Date('2024-02-02T23:59:59'),
      },
      activeGranularity: '30min',
    })).resolves.toBeUndefined();
    expect(mockDownloadFileBuffer).toHaveBeenCalledTimes(1);
  });

  it('creates context, preserves source labels, and formats export rows', async () => {
    await buildAndDownloadExcel({
      obs30min: [
        {
          timestamp: '2024-02-01T10:30:00',
          temperature: 12.4,
          humidity: 60,
          windSpeed: 2.3,
          windSpeedMax: 4.5,
          windDirection: 180,
          precipitation: 0,
        },
      ],
      obsDaily: [
        {
          timestamp: '2024-02-01',
          temperature: 13,
          humidity: 58,
          windSpeed: 2.1,
          windSpeedMax: 6.2,
          windDirection: null,
          precipitation: 0.4,
          windGustTime: '16:00',
        },
      ],
      stationName: 'Estacion Test',
      dataSourceLabel: 'Fuente: XEMA - Estación: Test',
      sourceDisplayName: 'XEMA (Transparència Catalunya)',
      dateRange: {
        from: new Date('2024-02-01T00:00:00'),
        to: new Date('2024-02-03T23:59:59'),
      },
      activeGranularity: 'daily',
      timezoneLabel: 'Europe/Madrid',
    });

    const workbook = workbookRegistry.workbooks[0];
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(['Contexto', '30min', 'Diario']);
    expect(workbook.sheets[0].rows[0].values).toMatchObject({
      field: 'Estación',
      value: 'Estacion Test',
    });
    expect(workbook.sheets[0].rows[1].values).toMatchObject({
      field: 'Fuente',
      value: 'XEMA (Transparència Catalunya)',
    });
    expect(workbook.sheets[0].rows[4].values).toMatchObject({
      field: 'Vista activa',
      value: 'Diario',
    });
    expect(workbook.sheets[0].rows[7].values).toMatchObject({
      field: 'Punto de referencia',
      value: 'Barcelona',
    });
    expect(workbook.sheets[0].rows[8].values).toMatchObject({
      field: 'Datos diarios',
      value: 'Calculados desde observaciones de 30 min',
    });
    expect(workbook.sheets[1].rows[0].values).toEqual(['Fuente: XEMA - Estación: Test']);
    expect(workbook.sheets[1].rows[2].values).toMatchObject({
      ts: '01/02/2024 10:30',
      temp: 12.4,
      hr: 60,
      ppt: 0,
      vv: 2.3,
      dv: 180,
      vvx: 4.5,
    });
    expect(workbook.sheets[2].rows[2].values).toMatchObject({
      date: '01/02/2024',
      tm: 13,
      hrm: 58,
      ppt: 0.4,
      vvm: 2.1,
      vvx: 6.2,
      vvxTime: '16:00',
    });
    expect(mockDownloadFileBuffer).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      'meteo-estacion-test-2024-02-01_2024-02-03.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('preserves existing columns and null cells for sparse daily and 30-min data', async () => {
    await buildAndDownloadExcel({
      obs30min: [{
        timestamp: '2024-02-01T18:30:00',
        temperature: null,
        humidity: 70,
        windSpeed: null,
        windSpeedMax: 6.2,
        windDirection: null,
        precipitation: null,
      }],
      obsDaily: [{
        timestamp: '2024-02-01',
        temperature: null,
        humidity: 70,
        windSpeed: null,
        windSpeedMax: 6.2,
        windDirection: null,
        precipitation: null,
        windGustTime: '18:30',
      }],
      stationName: 'Estacion Test',
      dateRange: {
        from: new Date('2024-02-01T00:00:00'),
        to: new Date('2024-02-01T23:59:59'),
      },
      activeGranularity: 'daily',
    });

    const [, halfHourly, daily] = workbookRegistry.workbooks[0].sheets;
    expect(halfHourly.columns).toEqual([
      expect.objectContaining({ header: 'FechaHoraLocal', key: 'ts' }),
      expect.objectContaining({ header: 'T (°C)', key: 'temp' }),
      expect.objectContaining({ header: 'HR (%)', key: 'hr' }),
      expect.objectContaining({ header: 'PPT (mm)', key: 'ppt' }),
      expect.objectContaining({ header: 'VV10 (m/s)', key: 'vv' }),
      expect.objectContaining({ header: 'DV10 (°)', key: 'dv' }),
      expect.objectContaining({ header: 'VVx10 (m/s)', key: 'vvx' }),
    ]);
    expect(daily.columns).toEqual([
      expect.objectContaining({ header: 'Fecha', key: 'date' }),
      expect.objectContaining({ header: 'TM (°C)', key: 'tm' }),
      expect.objectContaining({ header: 'HRM (%)', key: 'hrm' }),
      expect.objectContaining({ header: 'PPT (mm)', key: 'ppt' }),
      expect.objectContaining({ header: 'VVM10 (m/s)', key: 'vvm' }),
      expect.objectContaining({ header: 'VVX10 (m/s)', key: 'vvx' }),
      expect.objectContaining({ header: 'HoraVVX10 (local)', key: 'vvxTime' }),
    ]);
    expect(halfHourly.rows[0].values).toEqual({
      ts: '01/02/2024 18:30', temp: null, hr: 70, ppt: null,
      vv: null, dv: null, vvx: 6.2,
    });
    expect(daily.rows[0].values).toEqual({
      date: '01/02/2024', tm: null, hrm: 70, ppt: null,
      vvm: null, vvx: 6.2, vvxTime: '18:30',
    });
  });
});
