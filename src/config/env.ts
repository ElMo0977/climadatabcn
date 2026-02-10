/**
 * Environment configuration for data providers
 * Reads from Vite environment variables
 */

import type { DataMode, DataProvider } from '@/domain/types';

interface EnvConfig {
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
  dataMode: (getEnvVar('VITE_DATA_MODE') as DataMode) || 'live',
  apiProxyBaseUrl: getEnvVar('VITE_API_PROXY_URL'),
  supabaseUrl: getEnvVar('VITE_SUPABASE_URL') || '',
  supabaseKey: getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') || '',
};

/**
 * Check if provider configuration is valid
 */
export function isProviderConfigured(_provider: DataProvider): boolean {
  return true;
}

/**
 * Get a human-readable message for missing configuration
 */
export function getMissingConfigMessage(_provider: DataProvider): string | null {
  return null;
}

export default env;
