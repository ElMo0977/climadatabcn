import { describe, expect, it, vi } from 'vitest';

const { mockDownloadFileBuffer } = vi.hoisted(() => ({
  mockDownloadFileBuffer: vi.fn(),
}));

vi.mock('@/lib/weatherUtils', () => ({
  downloadFileBuffer: mockDownloadFileBuffer,
}));

vi.mock('exceljs', () => {
  class MockWorksheet {
    columns: unknown[] = [];

    spliceRows(): void {}

    getRow() {
      return {
        font: {},
        eachCell: () => {},
      };
    }

    addRow() {
      return { number: 1 };
    }

    getCell() {
      return {};
    }
  }

  class MockWorkbook {
    xlsx = {
      writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    addWorksheet() {
      return new MockWorksheet();
    }
  }

  return { Workbook: MockWorkbook };
});

import { buildAndDownloadExcel } from '@/lib/exportExcel';

describe('buildAndDownloadExcel', () => {
  it('does not throw with empty datasets', async () => {
    await expect(buildAndDownloadExcel([], [], 'Estacion Test')).resolves.toBeUndefined();
    expect(mockDownloadFileBuffer).toHaveBeenCalledTimes(1);
  });
});
