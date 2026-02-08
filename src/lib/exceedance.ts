/**
 * Ventanas de superación: intervalos [start, end] donde el viento (gust) supera un umbral.
 * Entrada: serie horaria con windSpeedMax (o equivalente); umbral en m/s.
 * Salida: intervalos contiguos consolidados (mismo formato timestamp que la entrada).
 */

export interface ExceedanceInterval {
  start: string;
  end: string;
}

/**
 * Dada una lista de observaciones con timestamp y valor de viento máximo (gust),
 * devuelve intervalos [start, end] donde valor > umbral, consolidando horas contiguas.
 * @param observations Array de { timestamp, windSpeedMax } (o { timestamp, value })
 * @param threshold Umbral en m/s (ej. 5 para normativa mediciones acústicas)
 * @param valueKey Clave del valor numérico: 'windSpeedMax' o 'value'
 */
export function exceedanceIntervals(
  observations: { timestamp: string; windSpeedMax?: number | null; value?: number | null }[],
  threshold: number,
  valueKey: 'windSpeedMax' | 'value' = 'windSpeedMax'
): ExceedanceInterval[] {
  const sorted = [...observations].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const intervals: ExceedanceInterval[] = [];
  let current: ExceedanceInterval | null = null;

  for (const obs of sorted) {
    const v = valueKey === 'windSpeedMax' ? obs.windSpeedMax : obs.value;
    const exceeds = v != null && !Number.isNaN(v) && v > threshold;

    if (exceeds) {
      if (!current) {
        current = { start: obs.timestamp, end: obs.timestamp };
      } else {
        current.end = obs.timestamp;
      }
    } else {
      if (current) {
        intervals.push(current);
        current = null;
      }
    }
  }
  if (current) intervals.push(current);
  return intervals;
}
