/**
 * Etiquetas de fuentes de datos para mostrar en UI, Excel y gráficos
 */

import type { DataSource } from '@/types/weather';

export const SOURCE_LABELS: Record<DataSource, string> = {
  'xema-transparencia': 'XEMA (Transparència Catalunya)',
  'opendata-bcn': 'Open Data BCN',
  'open-meteo': 'Datos de respaldo (Open-Meteo)',
};

/**
 * Nombre corto para respaldo (aviso en UI)
 */
export const FALLBACK_LABEL = 'Datos de respaldo (Open-Meteo)';

/**
 * Construye la etiqueta "Fuente: X - Estación: Y"
 */
export function buildDataSourceLabel(
  source: DataSource,
  stationName: string
): string {
  return `Fuente: ${SOURCE_LABELS[source]} - Estación: ${stationName}`;
}
