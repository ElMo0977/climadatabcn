/**
 * Instrumentación ligera para auditoría del pipeline de datos.
 * Activar con VITE_DEBUG_DATA=1.
 * Loguea params de petición y estadísticas del dataset (n puntos, step, duplicados, gaps, min/max).
 */

import type { Observation } from '@/types/weather';

const DEBUG = import.meta.env.VITE_DEBUG_DATA === '1';

function parseTs(ts: string): number | null {
  const t = new Date(ts).getTime();
  return Number.isNaN(t) ? null : t;
}

export interface DataDebugParams {
  stationId: string | null;
  stationSource: string | null;
  from: string;
  to: string;
  granularity: string;
  agg: string;
  provider?: string;
}

export interface DataDebugStats {
  nPoints: number;
  firstTimestamp: string | null;
  midTimestamp: string | null;
  lastTimestamp: string | null;
  stepDetectedMs: number | null;
  stepDetectedHours: number | null;
  duplicates: number;
  gapsIrregular: number;
  temperature: { min: number | null; max: number | null };
  humidity: { min: number | null; max: number | null };
  windSpeed: { min: number | null; max: number | null };
}

function computeStats(observations: Observation[]): DataDebugStats {
  if (observations.length === 0) {
    return {
      nPoints: 0,
      firstTimestamp: null,
      midTimestamp: null,
      lastTimestamp: null,
      stepDetectedMs: null,
      stepDetectedHours: null,
      duplicates: 0,
      gapsIrregular: 0,
      temperature: { min: null, max: null },
      humidity: { min: null, max: null },
      windSpeed: { min: null, max: null },
    };
  }

  const sorted = [...observations].sort(
    (a, b) => (parseTs(a.timestamp) ?? 0) - (parseTs(b.timestamp) ?? 0)
  );
  const timestamps = sorted.map((o) => parseTs(o.timestamp)).filter((t): t is number => t != null);
  const steps: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    steps.push(timestamps[i] - timestamps[i - 1]);
  }
  const stepMs = steps.length > 0 ? steps.reduce((a, b) => a + b, 0) / steps.length : 0;
  const uniqueTs = new Set(observations.map((o) => o.timestamp));
  const duplicates = observations.length - uniqueTs.size;
  const gapsIrregular = steps.filter((s) => Math.abs(s - stepMs) > stepMs * 0.5).length;

  const getValues = (key: keyof Observation) =>
    sorted
      .map((o) => o[key])
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  const minMax = (key: keyof Observation) => {
    const vals = getValues(key);
    if (vals.length === 0) return { min: null as number | null, max: null as number | null };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  };

  return {
    nPoints: observations.length,
    firstTimestamp: sorted[0]?.timestamp ?? null,
    midTimestamp: sorted[Math.floor(sorted.length / 2)]?.timestamp ?? null,
    lastTimestamp: sorted[sorted.length - 1]?.timestamp ?? null,
    stepDetectedMs: stepMs > 0 ? Math.round(stepMs) : null,
    stepDetectedHours: stepMs > 0 ? Math.round((stepMs / (3600 * 1000)) * 100) / 100 : null,
    duplicates,
    gapsIrregular,
    temperature: minMax('temperature'),
    humidity: minMax('humidity'),
    windSpeed: minMax('windSpeed'),
  };
}

/**
 * Loguea parámetros de la petición y estadísticas del dataset cuando VITE_DEBUG_DATA=1.
 * Llamar al final del queryFn de observaciones (tras tener el array final).
 */
export function logDataDebug(params: DataDebugParams, observations: Observation[]): void {
  if (!DEBUG) return;

  const stats = computeStats(observations);
  console.group('[ClimaDataBCN data debug]');
  console.log('Request params:', params);
  console.log('Dataset stats:', stats);
  console.groupEnd();

  if (typeof window !== 'undefined' && (window as unknown as { __DATA_DEBUG_SNAPSHOT?: unknown }).__DATA_DEBUG_SNAPSHOT === undefined) {
    (window as unknown as { __DATA_DEBUG_SNAPSHOT: { params: DataDebugParams; observations: Observation[]; stats: DataDebugStats } }).__DATA_DEBUG_SNAPSHOT = {
      params,
      observations,
      stats,
    };
  }
}

/**
 * Exporta el último snapshot (params + observations + stats) como JSON descargable.
 * Útil en consola: copy(JSON.stringify(window.__DATA_DEBUG_SNAPSHOT))
 * o llamar exportDataDebugSnapshot() si se expone en window.
 */
export function exportDataDebugSnapshot(): string {
  if (typeof window === 'undefined') return '{}';
  const snap = (window as unknown as { __DATA_DEBUG_SNAPSHOT?: { params: DataDebugParams; observations: Observation[]; stats: DataDebugStats } }).__DATA_DEBUG_SNAPSHOT;
  return JSON.stringify(snap ?? {}, null, 2);
}
