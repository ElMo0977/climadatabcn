import ExcelJS from 'exceljs';
import type { Observation } from '@/types/weather';
import { downloadFileBuffer } from '@/lib/weatherUtils';

const WIND_LIMIT_ACOUSTIC = 5;
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' },
};
const SAFETY_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0E6' },
};

function roundWind(v: number | null): number | '' {
  if (v === null) return '';
  return Math.round(v * 10) / 10;
}

function styleHeaderCell(cell: ExcelJS.Cell): void {
  cell.font = { bold: true };
  cell.fill = HEADER_FILL;
}

function styleSafetyCell(cell: ExcelJS.Cell): void {
  cell.fill = SAFETY_FILL;
  cell.font = { bold: true };
}

function formatLocalDateTime(ts: string): string {
  // Timestamps already in Europe/Madrid local from provider
  // Format: dd/MM/yyyy HH:mm
  const match = ts.match(/(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?/);
  if (!match) return ts;
  const [, y, m, d, hh, mm] = match;
  if (hh && mm) return `${d}/${m}/${y} ${hh}:${mm}`;
  return `${d}/${m}/${y}`;
}

function formatLocalDate(ts: string): string {
  const match = ts.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return ts;
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

/**
 * Build and download Excel with two sheets:
 * - "30min": raw 30-min observations
 * - "Diario": daily observations
 */
export async function buildAndDownloadExcel(
  obs30min: Observation[],
  obsDaily: Observation[],
  stationName: string,
  dataSourceLabel?: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  // ── Sheet 1: 30min ──
  const sheet30 = workbook.addWorksheet('30min', { pageSetup: { fitToPage: true } });
  sheet30.columns = [
    { header: 'FechaHoraLocal', key: 'ts', width: 18 },
    { header: 'T (°C)', key: 'temp', width: 10 },
    { header: 'HR (%)', key: 'hr', width: 10 },
    { header: 'PPT (mm)', key: 'ppt', width: 10 },
    { header: 'VV10 (m/s)', key: 'vv', width: 12 },
    { header: 'DV10 (°)', key: 'dv', width: 10 },
    { header: 'VVx10 (m/s)', key: 'vvx', width: 12 },
  ];
  if (dataSourceLabel) {
    sheet30.spliceRows(1, 0, [dataSourceLabel], []);
    sheet30.getRow(1).font = { italic: true, size: 10 };
  }
  const hdr30Row = dataSourceLabel ? 3 : 1;
  sheet30.getRow(hdr30Row).eachCell(styleHeaderCell);

  for (const obs of obs30min) {
    const r = sheet30.addRow({
      ts: formatLocalDateTime(obs.timestamp),
      temp: obs.temperature ?? '',
      hr: obs.humidity ?? '',
      ppt: obs.precipitation ?? '',
      vv: roundWind(obs.windSpeed),
      dv: obs.windDirection ?? '',
      vvx: roundWind(obs.windSpeedMax),
    });
    // Highlight wind > 5 m/s
    [5, 7].forEach((col) => {
      const cell = sheet30.getCell(r.number, col);
      const val = col === 5 ? obs.windSpeed : obs.windSpeedMax;
      if (val !== null && val > WIND_LIMIT_ACOUSTIC) styleSafetyCell(cell);
    });
  }

  // ── Sheet 2: Diario ──
  const sheetDaily = workbook.addWorksheet('Diario', { pageSetup: { fitToPage: true } });
  sheetDaily.columns = [
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'TM (°C)', key: 'tm', width: 10 },
    { header: 'HRM (%)', key: 'hrm', width: 10 },
    { header: 'PPT (mm)', key: 'ppt', width: 10 },
    { header: 'VVM10 (m/s)', key: 'vvm', width: 12 },
    { header: 'VVX10 (m/s)', key: 'vvx', width: 12 },
    { header: 'HoraVVX10 (local)', key: 'vvxTime', width: 16 },
  ];
  if (dataSourceLabel) {
    sheetDaily.spliceRows(1, 0, [dataSourceLabel], []);
    sheetDaily.getRow(1).font = { italic: true, size: 10 };
  }
  const hdrDailyRow = dataSourceLabel ? 3 : 1;
  sheetDaily.getRow(hdrDailyRow).eachCell(styleHeaderCell);

  for (const obs of obsDaily) {
    const r = sheetDaily.addRow({
      date: formatLocalDate(obs.timestamp),
      tm: obs.temperature ?? '',
      hrm: obs.humidity ?? '',
      ppt: obs.precipitation ?? '',
      vvm: roundWind(obs.windSpeed),
      vvx: roundWind(obs.windSpeedMax),
      vvxTime: obs.windGustTime ?? '',
    });
    [5, 6].forEach((col) => {
      const cell = sheetDaily.getCell(r.number, col);
      const val = col === 5 ? obs.windSpeed : obs.windSpeedMax;
      if (val !== null && val > WIND_LIMIT_ACOUSTIC) styleSafetyCell(cell);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `informe-meteo-${stationName.replace(/\s+/g, '-').toLowerCase()}.xlsx`;
  downloadFileBuffer(
    buffer as ArrayBuffer,
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
