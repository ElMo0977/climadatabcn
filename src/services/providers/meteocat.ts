/**
 * Meteocat Provider Adapter
 * 
 * Servei Meteorològic de Catalunya - Official weather data for Catalonia
 * API Documentation: https://apidocs.meteocat.gencat.cat/
 * 
 * IMPORTANT: Requires API key for live data. Request at:
 * https://apidocs.meteocat.gencat.cat/documentacio/acces-ciutada-i-administracio/
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
import { env, isProviderConfigured } from '@/config/env';
import { fetchJson, buildUrl } from '@/services/http/fetchJson';
import { 
  mockStationsMeteocat, 
  createMockLatestObservation, 
  createMockTimeseries,
  simulateDelay 
} from './mockData';

// ============ API Configuration ============

const METEOCAT_BASE_URL = 'https://api.meteo.cat/xema/v1';
const PROVIDER_NAME = 'meteocat' as const;

// Variable codes used by Meteocat API
const VARIABLE_CODES = {
  // Hourly measurements (mesurades)
  hourly: {
    temperature: 32,
    humidity: 33,
    windSpeed: 30,
    precipitation: 35,
  },
  // Daily statistics
  daily: {
    temperature: 1000, // Mean temperature
    humidity: 1100, // Mean humidity
    windSpeed: 1300, // Mean wind speed
    windSpeedMax: 1301, // Max wind speed
    precipitation: 1400, // Accumulated precipitation
  },
} as const;

// Province code for Barcelona
const BARCELONA_PROVINCE_CODE = '8';

// ============ Response Types (Meteocat API) ============

interface MeteocatStation {
  codi: string;
  nom: string;
  coordenades: {
    latitud: number;
    longitud: number;
  };
  altitud: number;
  comarca: {
    nom: string;
  };
  municipi: {
    nom: string;
  };
  provincia: {
    codi: number;
  };
  estat: {
    codi: number; // 2 = operational
  };
}

interface MeteocatMeasurement {
  data: string;
  valor: number;
  estat: string; // "V" = valid
  baseHoraria: string;
}

interface MeteocatDailyStat {
  data: string;
  valor: number;
  estat: string;
}

// ============ Provider Implementation ============

class MeteocatProvider implements DataProviderAdapter {
  readonly name = PROVIDER_NAME;

  isConfigured(): boolean {
    return isProviderConfigured(PROVIDER_NAME);
  }

  private getHeaders(): Record<string, string> {
    if (!env.meteocatApiKey) {
      throw new ProviderError({
        code: 'MISSING_API_KEY',
        message: 'Falta configurar la API key de Meteocat. Solicita tu clave gratuita en apidocs.meteocat.gencat.cat',
        provider: PROVIDER_NAME,
      });
    }

    return {
      'X-Api-Key': env.meteocatApiKey,
      'Content-Type': 'application/json',
    };
  }

  async listStations(): Promise<Station[]> {
    // Mock mode
    if (env.dataMode === 'mock') {
      await simulateDelay();
      return mockStationsMeteocat;
    }

    if (!this.isConfigured()) {
      throw new ProviderError({
        code: 'MISSING_API_KEY',
        message: 'Falta configurar la API key de Meteocat',
        provider: PROVIDER_NAME,
      });
    }

    const url = `${METEOCAT_BASE_URL}/estacions/metadades?estat=ope`;
    
    const { data } = await fetchJson<MeteocatStation[]>(url, {
      headers: this.getHeaders(),
      provider: PROVIDER_NAME,
    });

    // Filter to Barcelona province only
    const barcelonaStations = data.filter(
      (station) => String(station.provincia.codi) === BARCELONA_PROVINCE_CODE
    );

    return barcelonaStations.map((station) => this.mapStation(station));
  }

  async getLatest(stationId: string): Promise<ObservationLatest> {
    // Mock mode
    if (env.dataMode === 'mock') {
      await simulateDelay();
      return createMockLatestObservation(stationId, PROVIDER_NAME);
    }

    if (!this.isConfigured()) {
      throw new ProviderError({
        code: 'MISSING_API_KEY',
        message: 'Falta configurar la API key de Meteocat',
        provider: PROVIDER_NAME,
      });
    }

    // Get today's hourly data
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const url = `${METEOCAT_BASE_URL}/estacions/mesurades/${stationId}/${year}/${month}/${day}`;

    try {
      const { data } = await fetchJson<Record<string, MeteocatMeasurement[]>>(url, {
        headers: this.getHeaders(),
        provider: PROVIDER_NAME,
      });

      return this.mapLatestObservation(stationId, data);
    } catch (error) {
      // If today's data is not available, return with nulls
      if (error instanceof ProviderError && error.code === 'NOT_FOUND') {
        return {
          stationId,
          provider: PROVIDER_NAME,
          timestamp: now.toISOString(),
          values: {},
        };
      }
      throw error;
    }
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

    if (!this.isConfigured()) {
      throw new ProviderError({
        code: 'MISSING_API_KEY',
        message: 'Falta configurar la API key de Meteocat',
        provider: PROVIDER_NAME,
      });
    }

    if (aggregation === 'daily') {
      return this.getDailyTimeseries(stationId, from, to, variable);
    } else {
      return this.getHourlyTimeseries(stationId, from, to, variable);
    }
  }

  // ============ Private Methods ============

  private mapStation(station: MeteocatStation): Station {
    return {
      id: station.codi,
      name: station.nom,
      provider: PROVIDER_NAME,
      latitude: station.coordenades.latitud,
      longitude: station.coordenades.longitud,
      elevation: station.altitud,
      meta: {
        comarca: station.comarca.nom,
        municipi: station.municipi.nom,
      },
    };
  }

  private mapLatestObservation(
    stationId: string, 
    data: Record<string, MeteocatMeasurement[]>
  ): ObservationLatest {
    // Find the latest valid measurement for each variable
    const getLatestValue = (variableCode: number): number | null => {
      const measurements = data[String(variableCode)] || [];
      const validMeasurements = measurements.filter(m => m.estat === 'V');
      if (validMeasurements.length === 0) return null;
      
      // Sort by date descending and get the latest
      validMeasurements.sort((a, b) => 
        new Date(b.data).getTime() - new Date(a.data).getTime()
      );
      return validMeasurements[0].valor;
    };

    const hourlyVars = VARIABLE_CODES.hourly;
    
    // Find the latest timestamp
    const allMeasurements = Object.values(data).flat();
    const latestTimestamp = allMeasurements.length > 0
      ? allMeasurements.reduce((latest, m) => 
          new Date(m.data) > new Date(latest) ? m.data : latest,
          allMeasurements[0].data
        )
      : new Date().toISOString();

    return {
      stationId,
      provider: PROVIDER_NAME,
      timestamp: latestTimestamp,
      values: {
        temperature: getLatestValue(hourlyVars.temperature),
        humidity: getLatestValue(hourlyVars.humidity),
        windSpeed: getLatestValue(hourlyVars.windSpeed),
        precipitation: getLatestValue(hourlyVars.precipitation),
      },
    };
  }

  private async getDailyTimeseries(
    stationId: string,
    from: Date,
    to: Date,
    variable: WeatherVariable
  ): Promise<TimeseriesResponse> {
    const variableCode = this.getDailyVariableCode(variable);
    
    // Meteocat daily stats are fetched by month
    // We need to fetch each month in the range
    const points: { timestamp: string; value: number | null }[] = [];
    const current = new Date(from);
    
    while (current <= to) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      
      const url = buildUrl(
        `${METEOCAT_BASE_URL}/variables/estadistics/diaris/${variableCode}`,
        { codiEstacio: stationId, any: year, mes: month }
      );

      try {
        const { data } = await fetchJson<MeteocatDailyStat[]>(url, {
          headers: this.getHeaders(),
          provider: PROVIDER_NAME,
        });

        // Filter and map measurements within date range
        for (const stat of data) {
          const statDate = new Date(stat.data);
          if (statDate >= from && statDate <= to && stat.estat === 'V') {
            points.push({
              timestamp: stat.data,
              value: stat.valor,
            });
          }
        }
      } catch (error) {
        console.warn(`Error fetching daily data for ${year}-${month}:`, error);
        // Continue with next month
      }

      // Move to next month
      current.setMonth(current.getMonth() + 1);
    }

    // Sort by timestamp
    points.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      stationId,
      provider: PROVIDER_NAME,
      variable,
      unit: this.getUnit(variable),
      aggregation: 'daily',
      points,
    };
  }

  private async getHourlyTimeseries(
    stationId: string,
    from: Date,
    to: Date,
    variable: WeatherVariable
  ): Promise<TimeseriesResponse> {
    const variableCode = this.getHourlyVariableCode(variable);
    
    // Meteocat hourly data is fetched by day
    const points: { timestamp: string; value: number | null }[] = [];
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);
    
    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);

    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      
      const url = `${METEOCAT_BASE_URL}/estacions/mesurades/${stationId}/${year}/${month}/${day}`;

      try {
        const { data } = await fetchJson<Record<string, MeteocatMeasurement[]>>(url, {
          headers: this.getHeaders(),
          provider: PROVIDER_NAME,
        });

        const measurements = data[String(variableCode)] || [];
        for (const m of measurements) {
          if (m.estat === 'V') {
            points.push({
              timestamp: m.data,
              value: m.valor,
            });
          }
        }
      } catch (error) {
        console.warn(`Error fetching hourly data for ${year}-${month}-${day}:`, error);
        // Continue with next day
      }

      // Move to next day
      current.setDate(current.getDate() + 1);
    }

    // Sort by timestamp
    points.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      stationId,
      provider: PROVIDER_NAME,
      variable,
      unit: this.getUnit(variable),
      aggregation: 'hourly',
      points,
    };
  }

  private getDailyVariableCode(variable: WeatherVariable): number {
    const codes = VARIABLE_CODES.daily;
    switch (variable) {
      case 'temperature': return codes.temperature;
      case 'humidity': return codes.humidity;
      case 'windSpeed': return codes.windSpeed;
      case 'windSpeedMax': return codes.windSpeedMax;
      case 'precipitation': return codes.precipitation;
      default:
        throw new ProviderError({
          code: 'INVALID_PARAMS',
          message: `Variable '${variable}' no soportada para datos diarios`,
          provider: PROVIDER_NAME,
        });
    }
  }

  private getHourlyVariableCode(variable: WeatherVariable): number {
    const codes = VARIABLE_CODES.hourly;
    switch (variable) {
      case 'temperature': return codes.temperature;
      case 'humidity': return codes.humidity;
      case 'windSpeed': return codes.windSpeed;
      case 'precipitation': return codes.precipitation;
      default:
        throw new ProviderError({
          code: 'INVALID_PARAMS',
          message: `Variable '${variable}' no soportada para datos horarios`,
          provider: PROVIDER_NAME,
        });
    }
  }

  private getUnit(variable: WeatherVariable): string {
    const units: Record<WeatherVariable, string> = {
      temperature: '°C',
      humidity: '%',
      windSpeed: 'm/s',
      windSpeedMin: 'm/s',
      windSpeedMax: 'm/s',
      windDirection: '°',
      precipitation: 'mm',
      pressure: 'hPa',
    };
    return units[variable];
  }
}

// Export singleton instance
export const meteocatProvider = new MeteocatProvider();
