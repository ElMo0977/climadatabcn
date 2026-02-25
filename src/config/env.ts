/**
 * Environment configuration for data providers
 * Reads from Vite environment variables
 */

interface EnvConfig {
  dataMode: 'live' | 'mock';
  apiProxyBaseUrl: string | null;
  xemaDebug: boolean;
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

export const env: EnvConfig = {
  dataMode: (getEnvVar('VITE_DATA_MODE') as 'live' | 'mock') || 'live',
  apiProxyBaseUrl: getEnvVar('VITE_API_PROXY_URL'),
  xemaDebug: parseBooleanEnv(getEnvVar('VITE_DEBUG_XEMA') ?? undefined),
};

/**
 * XEMA debug logs are opt-in and only available in development.
 * Enable with: VITE_DEBUG_XEMA=true (or 1)
 */
export function isXemaDebugEnabled(): boolean {
  return import.meta.env.DEV && env.xemaDebug;
}

export default env;
