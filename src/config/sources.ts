/**
 * Etiquetas de fuentes de datos para mostrar en UI, Excel y gráficos
 */

import type { DataSource } from '@/types/weather';

export const SOURCE_LABELS: Record<DataSource, string> = {
  'xema-transparencia': 'XEMA (Transparència Catalunya)',
};

/**
 * Construye la etiqueta "Fuente: X - Estación: Y"
 */
export function buildDataSourceLabel(
  source: DataSource,
  stationName: string
): string {
  return `Fuente: ${SOURCE_LABELS[source]} - Estación: ${stationName}`;
}
