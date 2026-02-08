/**
 * XEMA variable codes from Transparència Catalunya metadata (4fb2-n3yi).
 * Resolves acronim/nom to codi_variable for subdaily (DAT) and daily (AD) datasets.
 */

import { fetchSocrata } from '@/services/http/socrata';

const METADATA_RESOURCE = '4fb2-n3yi';

interface VariableRow {
  codi_variable: string;
  nom_variable: string;
  unitat: string;
  acronim: string;
  codi_tipus_var: string;
  decimals?: string;
}

let cached: VariableRow[] | null = null;

export async function getVariableMetadata(): Promise<VariableRow[]> {
  if (cached) return cached;
  cached = await fetchSocrata<VariableRow[]>(METADATA_RESOURCE, { $limit: 200 });
  return cached;
}

/** Subdaily (DAT) variable codes for nzvn-apee */
export const SUBDAILY_CODES = {
  T: '32',       // Temperatura °C
  HR: '33',      // Humitat relativa %
  PPT: '35',     // Precipitació mm
  VV10: '30',    // Velocitat vent 10 m (esc.) m/s
  DV10: '31',    // Direcció vent 10 m °
  VVx10: '50',   // Ratxa màxima vent 10 m m/s
  DVVx10: '51',  // Direcció ratxa màxima 10 m °
} as const;

/** Daily (AD) variable codes for 7bvh-jvq2 */
export const DAILY_CODES = {
  TM: '1000',        // Temperatura mitjana diària °C
  HRM: '1100',       // Humitat relativa mitjana diària %
  PPT: '1300',       // Precipitació acumulada diària mm
  VVM10vec: '1500',  // Velocitat mitjana diària vent 10 m (vec.) m/s
  VVM10: '1503',     // Velocitat mitjana diària vent 10 m (esc.) m/s - fallback
  VVX10: '1512',     // Ratxa màxima diària vent 10 m + hora m/s
} as const;

export type SubdailyCodeKey = keyof typeof SUBDAILY_CODES;
export type DailyCodeKey = keyof typeof DAILY_CODES;

/**
 * Resolve variable metadata by acronim (optional validation at runtime).
 */
export async function getCodesByAcronim(): Promise<Record<string, string>> {
  const rows = await getVariableMetadata();
  const byAcronim: Record<string, string> = {};
  for (const r of rows) {
    byAcronim[r.acronim] = r.codi_variable;
  }
  return byAcronim;
}
