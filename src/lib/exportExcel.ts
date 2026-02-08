import ExcelJS from 'exceljs';
import type { Observation } from '@/types/weather';
import {
  buildDailySummary,
  formatDayLabel,
  downloadFileBuffer,
  type DailySummaryRow,
} from '@/lib/weatherUtils';

const WIND_LIMIT_ACOUSTIC = 5;
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE0E0E0' },
};
const SAFETY_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF0E6' },
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

export async function buildAndDownloadExcel(
  observations: Observation[],
  stationName: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const daily = buildDailySummary(observations);

  const sheetResumen = workbook.addWorksheet('Resumen Diario', { pageSetup: { fitToPage: true } });
  sheetResumen.columns = [
    { header: 'Fecha', key: 'date', width: 14 },
    { header: 'Temp Media (°C)', key: 'tempAvg', width: 14 },
    { header: 'Humedad Media (%)', key: 'humidityAvg', width: 16 },
    { header: 'Viento Mín (m/s)', key: 'windMin', width: 14 },
    { header: 'Viento Media (m/s)', key: 'windAvg', width: 16 },
    { header: 'Viento Máx (m/s)', key: 'windMax', width: 14 },
    { header: 'Precipitación Total (mm)', key: 'precipSum', width: 20 },
  ];
  const headerRowResumen = sheetResumen.getRow(1);
  headerRowResumen.eachCell((cell) => styleHeaderCell(cell));

  daily.forEach((row) => {
    const r = sheetResumen.addRow({
      date: formatDayLabel(row.date),
      tempAvg: row.tempAvg ?? '',
      humidityAvg: row.humidityAvg ?? '',
      windMin: roundWind(row.windMin),
      windAvg: roundWind(row.windAvg),
      windMax: roundWind(row.windMax),
      precipSum: row.precipSum,
    });
    const rowIdx = r.number;
    [4, 5, 6].forEach((col) => {
      const cell = sheetResumen.getCell(rowIdx, col);
      const val = row[['windMin', 'windAvg', 'windMax'][col - 4] as keyof DailySummaryRow];
      if (typeof val === 'number' && val > WIND_LIMIT_ACOUSTIC) styleSafetyCell(cell);
    });
  });

  const sheetDetalle = workbook.addWorksheet('Detalle Horario', { pageSetup: { fitToPage: true } });
  sheetDetalle.columns = [
    { header: 'Fecha/Hora', key: 'timestamp', width: 20 },
    { header: 'Temp (°C)', key: 'temperature', width: 12 },
    { header: 'Humedad (%)', key: 'humidity', width: 12 },
    { header: 'Viento (m/s)', key: 'windSpeed', width: 12 },
    { header: 'Precip (mm)', key: 'precipitation', width: 12 },
  ];
  const headerRowDetalle = sheetDetalle.getRow(1);
  headerRowDetalle.eachCell((cell) => styleHeaderCell(cell));

  observations.forEach((obs) => {
    const r = sheetDetalle.addRow({
      timestamp: obs.timestamp,
      temperature: obs.temperature ?? '',
      humidity: obs.humidity ?? '',
      windSpeed: obs.windSpeed !== null ? roundWind(obs.windSpeed) : '',
      precipitation: obs.precipitation ?? '',
    });
    const windVal = obs.windSpeed;
    if (windVal !== null && windVal > WIND_LIMIT_ACOUSTIC)
      styleSafetyCell(sheetDetalle.getCell(r.number, 4));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `informe-meteo-obra-${stationName.replace(/\s+/g, '-').toLowerCase()}.xlsx`;
  downloadFileBuffer(
    buffer as ArrayBuffer,
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
