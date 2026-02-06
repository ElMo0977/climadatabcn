/**
 * Open Data BCN Provider Adapter
 * 
 * Portal de datos abiertos del Ayuntamiento de Barcelona
 * API Documentation: https://opendata-ajuntament.barcelona.cat/
 * 
 * NOTE: Most endpoints work without authentication for public data.
 * Some endpoints may require an app token for higher rate limits.
 * 
 * PENDING: Identify specific weather/environmental datasets available.
 * Current implementation uses air quality / environmental sensors as proxy.
 */

import type {
  DataProviderAdapter,
  Station,
  ObservationLatest,
  TimeseriesResponse,
  WeatherVariable,
  AggregationType,
} from '@/domain/types';
import { ProviderError } from '@/domain/types';
import { env } from '@/config/env';
import { fetchJson } from '@/services/http/fetchJson';
import { 
  mockStationsOpenDataBcn, 
  createMockLatestObservation, 
  createMockTimeseries,
  simulateDelay 
} from './mockData';

// ============ API Configuration ============

const OPENDATA_BASE_URL = 'https://opendata-ajuntament.barcelona.cat/data/api/action';
const PROVIDER_NAME = 'opendata-bcn' as const;

// Known dataset IDs for environmental/weather data
// PENDING: Verify these datasets are correct and available
const DATASETS = {
  // Air quality monitoring stations (may include some weather data)
  airQuality: 'qualitat-aire-detall-bcn',
  // Weather stations if available
  weather: 'estacions-meteorologiques',
} as const;

// ============ Response Types (CKAN API) ============

interface CKANResponse<T> {
  success: boolean;
  result: T;
  error?: {
    message: string;
    __type: string;
  };
}

interface CKANRecord {
  _id: number;
  [key: string]: unknown;
}

interface CKANDatastoreResult {
  records: CKANRecord[];
  fields: { id: string; type: string }[];
  total: number;
}

// ============ Provider Implementation ============

class OpenDataBcnProvider implements DataProviderAdapter {
  readonly name = PROVIDER_NAME;

  isConfigured(): boolean {
    // Open Data BCN works without token for most public endpoints
    return true;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add token if available (for higher rate limits)
    if (env.bcnAppToken) {
      headers['Authorization'] = env.bcnAppToken;
    }

    return headers;
  }

  async listStations(): Promise<Station[]> {
    // Mock mode
    if (env.dataMode === 'mock') {
      await simulateDelay();
      return mockStationsOpenDataBcn;
    }

    // PENDING: Implement real API call
    // The Open Data BCN portal uses CKAN API
    // We need to identify the correct dataset for weather stations
    
    console.warn(
      'OpenDataBcn.listStations: Real implementation pending. ' +
      'Need to identify correct weather dataset in CKAN portal.'
    );

    // For now, throw a meaningful error or return mock data
    // depending on what makes sense for the use case
    
    try {
      // Try to fetch from a potential weather dataset
      const url = `${OPENDATA_BASE_URL}/datastore_search?resource_id=${DATASETS.weather}&limit=100`;
      
      const { data } = await fetchJson<CKANResponse<CKANDatastoreResult>>(url, {
        headers: this.getHeaders(),
        provider: PROVIDER_NAME,
      });

      if (!data.success || !data.result?.records) {
        // Dataset not found or empty, fall back to mock
        console.warn('OpenDataBcn: Weather dataset not found, using mock data');
        return mockStationsOpenDataBcn;
      }

      return data.result.records.map((record, index) => this.mapRecordToStation(record, index));
    } catch (error) {
      // If API fails, return mock data with warning
      console.warn('OpenDataBcn: API call failed, using mock data', error);
      return mockStationsOpenDataBcn;
    }
  }

  async getLatest(stationId: string): Promise<ObservationLatest> {
    // Mock mode
    if (env.dataMode === 'mock') {
      await simulateDelay();
      return createMockLatestObservation(stationId, PROVIDER_NAME);
    }

    // PENDING: Implement real API call
    // Need to identify correct endpoint for latest readings
    
    console.warn(
      'OpenDataBcn.getLatest: Real implementation pending. ' +
      'Returning mock data.'
    );

    return createMockLatestObservation(stationId, PROVIDER_NAME);
  }

  async getTimeseries(
    stationId: string,
    from: Date,
    to: Date,
    variable: WeatherVariable,
    aggregation: AggregationType
  ): Promise<TimeseriesResponse> {
    // Mock mode
    if (env.dataMode === 'mock') {
      await simulateDelay();
      return createMockTimeseries(stationId, PROVIDER_NAME, from, to, variable, aggregation);
    }

    // PENDING: Implement real API call
    // CKAN datastore_search supports filtering by date
    // Need to identify correct dataset and field mappings
    
    console.warn(
      'OpenDataBcn.getTimeseries: Real implementation pending. ' +
      'Returning mock data.'
    );

    return createMockTimeseries(stationId, PROVIDER_NAME, from, to, variable, aggregation);
  }

  // ============ Private Methods ============

  private mapRecordToStation(record: CKANRecord, index: number): Station {
    // PENDING: Adjust field names based on actual dataset structure
    // These are placeholder mappings
    return {
      id: String(record._id || `bcn-${index}`),
      name: String(record['nom'] || record['name'] || `Estación ${index + 1}`),
      provider: PROVIDER_NAME,
      latitude: Number(record['latitud'] || record['lat'] || 41.38),
      longitude: Number(record['longitud'] || record['lon'] || 2.17),
      elevation: record['altitud'] ? Number(record['altitud']) : null,
      meta: {
        district: record['districte'] || record['district'],
        rawRecord: record,
      },
    };
  }
}

// Export singleton instance
export const openDataBcnProvider = new OpenDataBcnProvider();

/**
 * IMPLEMENTATION NOTES:
 * 
 * Open Data BCN uses CKAN as its data platform.
 * Key endpoints:
 * - package_list: List all datasets
 * - package_show: Get dataset metadata
 * - datastore_search: Query data from a resource
 * 
 * To complete implementation:
 * 1. Visit https://opendata-ajuntament.barcelona.cat/data/es/dataset
 * 2. Search for "meteorologia", "temps", "qualitat aire"
 * 3. Identify relevant datasets and their resource IDs
 * 4. Update DATASETS constant with correct IDs
 * 5. Map record fields to Station/Observation types
 * 
 * CORS NOTE:
 * The CKAN API may have CORS restrictions.
 * If so, requests should go through a backend proxy:
 * - Supabase Edge Function
 * - Or set VITE_API_PROXY_URL in env
 */
