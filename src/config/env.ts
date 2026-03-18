/**
 * Environment configuration for data providers
 * Reads from Vite environment variables
 */

interface EnvConfig {
  xemaDebug: boolean;
  xemaHttpTimeoutMs: number;
}

function getEnvVar(key: string): string | null {
  const value = import.meta.env[key];
  if (!value || value === '' || value === 'undefined') {
    return null;
  }
  return value;
}

export function parseBooleanEnv(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export function parseIntegerEnv(
  value: string | null,
  fallback: number,
  options: { min?: number } = {},
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.min != null && parsed < options.min) return fallback;
  return parsed;
}

export const env: EnvConfig = {
  xemaDebug: parseBooleanEnv(getEnvVar('VITE_DEBUG_XEMA') ?? undefined),
  xemaHttpTimeoutMs: parseIntegerEnv(getEnvVar('VITE_XEMA_HTTP_TIMEOUT_MS'), 40000, {
    min: 1000,
  }),
};

/**
 * XEMA debug logs are opt-in and only available in development.
 * Enable with: VITE_DEBUG_XEMA=true (or 1)
 */
export function isXemaDebugEnabled(): boolean {
  return import.meta.env.DEV && env.xemaDebug;
}

export default env;
