import type { Cell, Fill } from 'exceljs';
import type { Observation, DateRange, Granularity } from '@/types/weather';
import { downloadFileBuffer } from '@/lib/weatherUtils';

const WIND_LIMIT_ACOUSTIC = 5;
const HEADER_FILL: Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' },
};
const SAFETY_FILL: Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0E6' },
};

function normalizeNumber(v: number | null | undefined): number | null {
  return Number.isFinite(v) ? (v as number) : null;
}

function normalizeText(v: string | null | undefined): string {
  return v ?? '';
}

function isValidDate(year: number, month: number, day: number): boolean {
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

function roundWind(v: number | null | undefined): number | null {
  const normalized = normalizeNumber(v);
  if (normalized === null) return null;
  return Math.round(normalized * 10) / 10;
}

function styleHeaderCell(cell: Cell): void {
  cell.font = { bold: true };
  cell.fill = HEADER_FILL;
}

function styleSafetyCell(cell: Cell): void {
  cell.fill = SAFETY_FILL;
  cell.font = { bold: true };
}

function formatLocalDateTime(ts: string): string | null {
  // Timestamps already in Europe/Madrid local from provider
  // Format: dd/MM/yyyy HH:mm
  const match = ts.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!isValidDate(year, month, day)) return null;
  if (hh && mm) return `${d}/${m}/${y} ${hh}:${mm}`;
  return `${d}/${m}/${y}`;
}

function formatLocalDate(ts: string): string | null {
  const match = ts.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!isValidDate(year, month, day)) return null;
  return `${d}/${m}/${y}`;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalGeneratedAt(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function slugifyFilenamePart(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || 'estacion';
}

export interface ExcelExportOptions {
  obs30min: Observation[];
  obsDaily: Observation[];
  stationName: string;
  dataSourceLabel?: string;
  sourceDisplayName?: string;
  dateRange: DateRange;
  activeGranularity: Granularity;
  timezoneLabel?: string;
}

/**
 * Build and download Excel with two sheets:
 * - "Contexto": export metadata
 * - "30min": raw 30-min observations
 * - "Diario": daily observations
 */
export async function buildAndDownloadExcel({
  obs30min,
  obsDaily,
  stationName,
  dataSourceLabel,
  sourceDisplayName,
  dateRange,
  activeGranularity,
  timezoneLabel = 'Europe/Madrid',
}: ExcelExportOptions): Promise<void> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const generatedAt = new Date();

  const contextSheet = workbook.addWorksheet('Contexto', { pageSetup: { fitToPage: true } });
  contextSheet.columns = [
    { header: 'Campo', key: 'field', width: 22 },
    { header: 'Valor', key: 'value', width: 42 },
  ];
  contextSheet.getRow(1).eachCell(styleHeaderCell);
  [
    { field: 'Estación', value: stationName },
    { field: 'Fuente', value: sourceDisplayName ?? dataSourceLabel ?? '' },
    { field: 'Rango desde', value: formatDateKey(dateRange.from) },
    { field: 'Rango hasta', value: formatDateKey(dateRange.to) },
    { field: 'Vista activa', value: activeGranularity === 'daily' ? 'Diario' : 'Datos 30 min' },
    { field: 'Generado', value: formatLocalGeneratedAt(generatedAt) },
    { field: 'Zona horaria', value: timezoneLabel },
    { field: 'Datos diarios', value: 'Calculados desde observaciones de 30 min' },
  ].forEach((row) => contextSheet.addRow(row));

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
    const windSpeed = normalizeNumber(obs.windSpeed);
    const windSpeedMax = normalizeNumber(obs.windSpeedMax);
    const r = sheet30.addRow({
      ts: formatLocalDateTime(obs.timestamp),
      temp: normalizeNumber(obs.temperature),
      hr: normalizeNumber(obs.humidity),
      ppt: normalizeNumber(obs.precipitation),
      vv: roundWind(windSpeed),
      dv: normalizeNumber(obs.windDirection),
      vvx: roundWind(windSpeedMax),
    });
    // Highlight wind > 5 m/s
    [5, 7].forEach((col) => {
      const cell = sheet30.getCell(r.number, col);
      const val = col === 5 ? windSpeed : windSpeedMax;
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
    const windSpeed = normalizeNumber(obs.windSpeed);
    const windSpeedMax = normalizeNumber(obs.windSpeedMax);
    const r = sheetDaily.addRow({
      date: formatLocalDate(obs.timestamp),
      tm: normalizeNumber(obs.temperature),
      hrm: normalizeNumber(obs.humidity),
      ppt: normalizeNumber(obs.precipitation),
      vvm: roundWind(windSpeed),
      vvx: roundWind(windSpeedMax),
      vvxTime: normalizeText(obs.windGustTime),
    });
    [5, 6].forEach((col) => {
      const cell = sheetDaily.getCell(r.number, col);
      const val = col === 5 ? windSpeed : windSpeedMax;
      if (val !== null && val > WIND_LIMIT_ACOUSTIC) styleSafetyCell(cell);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `meteo-${slugifyFilenamePart(stationName)}-${formatDateKey(dateRange.from)}_${formatDateKey(dateRange.to)}.xlsx`;
  downloadFileBuffer(
    buffer as ArrayBuffer,
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
