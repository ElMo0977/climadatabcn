/**
 * Environment configuration for data providers
 * Reads from Vite environment variables
 */

import type { DataMode, DataProvider } from '@/domain/types';

interface EnvConfig {
  /** Meteocat API key - required for live data */
  meteocatApiKey: string | null;
  /** Open Data BCN app token - may be optional for some endpoints */
  bcnAppToken: string | null;
  /** Data mode: 'live' for real API calls, 'mock' for development data */
  dataMode: DataMode;
  /** Base URL for API proxy (to avoid CORS / hide keys) */
  apiProxyBaseUrl: string | null;
  /** Supabase URL for edge functions */
  supabaseUrl: string;
  /** Supabase publishable key */
  supabaseKey: string;
}

function getEnvVar(key: string): string | null {
  const value = import.meta.env[key];
  if (!value || value === '' || value === 'undefined') {
    return null;
  }
  return value;
}

export const env: EnvConfig = {
  meteocatApiKey: getEnvVar('VITE_METEOCAT_API_KEY'),
  bcnAppToken: getEnvVar('VITE_BCN_APP_TOKEN'),
  dataMode: (getEnvVar('VITE_DATA_MODE') as DataMode) || 'live',
  apiProxyBaseUrl: getEnvVar('VITE_API_PROXY_URL'),
  supabaseUrl: getEnvVar('VITE_SUPABASE_URL') || '',
  supabaseKey: getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') || '',
};

/**
 * Check if a provider has the required configuration
 */
export function isProviderConfigured(provider: DataProvider): boolean {
  switch (provider) {
    case 'meteocat':
      // Meteocat requires API key for live mode
      return env.dataMode === 'mock' || !!env.meteocatApiKey;
    case 'opendata-bcn':
      // Open Data BCN may work without token for some endpoints
      return true; // Token is optional for most queries
    default:
      return false;
  }
}

/**
 * Get a human-readable message for missing configuration
 */
export function getMissingConfigMessage(provider: DataProvider): string | null {
  if (isProviderConfigured(provider)) {
    return null;
  }
  
  switch (provider) {
    case 'meteocat':
      return 'Falta configurar la API key de Meteocat. Solicita tu clave gratuita en apidocs.meteocat.gencat.cat';
    case 'opendata-bcn':
      return 'Falta configurar el token de Open Data BCN.';
    default:
      return `Proveedor desconocido: ${provider}`;
  }
}

export default env;
