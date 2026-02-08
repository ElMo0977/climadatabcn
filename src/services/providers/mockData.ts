/**
 * Mock data for development mode
 */

import type { 
  Station, 
  ObservationLatest, 
  TimeseriesResponse, 
  WeatherVariable,
  AggregationType,
  DataProvider 
} from '@/domain/types';

// ============ Mock Stations ============

export const mockStationsMeteocat: Station[] = [
  {
    id: 'D5',
    name: 'Barcelona - el Raval',
    provider: 'meteocat',
    latitude: 41.3797,
    longitude: 2.1682,
    elevation: 33,
    meta: { comarca: 'Barcelonès', municipi: 'Barcelona' },
  },
  {
    id: 'X2',
    name: 'Observatori Fabra',
    provider: 'meteocat',
    latitude: 41.4184,
    longitude: 2.1239,
    elevation: 411,
    meta: { comarca: 'Barcelonès', municipi: 'Barcelona' },
  },
  {
    id: 'X4',
    name: 'Barcelona - Zona Universitària',
    provider: 'meteocat',
    latitude: 41.3870,
    longitude: 2.1130,
    elevation: 81,
    meta: { comarca: 'Barcelonès', municipi: 'Barcelona' },
  },
  {
    id: 'X8',
    name: 'Barcelona - Barceloneta',
    provider: 'meteocat',
    latitude: 41.3850,
    longitude: 2.2010,
    elevation: 2,
    meta: { comarca: 'Barcelonès', municipi: 'Barcelona' },
  },
  {
    id: 'XL',
    name: 'El Prat de Llobregat',
    provider: 'meteocat',
    latitude: 41.2974,
    longitude: 2.0833,
    elevation: 6,
    meta: { comarca: 'Baix Llobregat', municipi: 'El Prat de Llobregat' },
  },
];

export const mockStationsOpenDataBcn: Station[] = [
  {
    id: 'bcn-raval',
    name: 'El Raval',
    provider: 'opendata-bcn',
    latitude: 41.3797,
    longitude: 2.1682,
    elevation: 33,
    meta: { district: 'Ciutat Vella' },
  },
  {
    id: 'bcn-gracia',
    name: 'Gràcia',
    provider: 'opendata-bcn',
    latitude: 41.4036,
    longitude: 2.1532,
    elevation: 120,
    meta: { district: 'Gràcia' },
  },
  {
    id: 'bcn-eixample',
    name: 'Eixample',
    provider: 'opendata-bcn',
    latitude: 41.3930,
    longitude: 2.1620,
    elevation: 25,
    meta: { district: 'Eixample' },
  },
];

// ============ Mock Observations ============

function randomValue(base: number, variance: number): number {
  return +(base + (Math.random() - 0.5) * variance * 2).toFixed(1);
}

export function createMockLatestObservation(
  stationId: string, 
  provider: DataProvider
): ObservationLatest {
  return {
    stationId,
    provider,
    timestamp: new Date().toISOString(),
    values: {
      temperature: randomValue(18, 5),
      humidity: randomValue(65, 15),
      windSpeed: randomValue(3, 2),
      windSpeedMin: randomValue(1, 0.5),
      windSpeedMax: randomValue(5, 2),
      windDirection: Math.floor(Math.random() * 360),
      precipitation: Math.random() > 0.7 ? randomValue(2, 1) : 0,
      pressure: randomValue(1013, 10),
    },
  };
}

// ============ Mock Timeseries ============

export function createMockTimeseries(
  stationId: string,
  provider: DataProvider,
  from: Date,
  to: Date,
  variable: WeatherVariable,
  aggregation: AggregationType
): TimeseriesResponse {
  const points = [];
  const current = new Date(from);
  const end = new Date(to);
  
  // Base values for different variables
  const baseValues: Record<WeatherVariable, { base: number; variance: number; unit: string }> = {
    temperature: { base: 18, variance: 8, unit: '°C' },
    humidity: { base: 65, variance: 20, unit: '%' },
    windSpeed: { base: 3, variance: 3, unit: 'm/s' },
    windSpeedMin: { base: 1, variance: 1, unit: 'm/s' },
    windSpeedMax: { base: 6, variance: 4, unit: 'm/s' },
    windDirection: { base: 180, variance: 180, unit: '°' },
    precipitation: { base: 0.5, variance: 2, unit: 'mm' },
    pressure: { base: 1013, variance: 15, unit: 'hPa' },
  };

  const config = baseValues[variable];
  const incrementMs = aggregation === 'hourly' ? 3600000 : 86400000;

  while (current <= end) {
    // Add some realistic variation based on time of day for hourly data
    let timeModifier = 0;
    if (aggregation === 'hourly' && variable === 'temperature') {
      const hour = current.getHours();
      // Warmer during midday
      timeModifier = Math.sin((hour - 6) * Math.PI / 12) * 5;
    }

    points.push({
      timestamp: current.toISOString(),
      value: variable === 'precipitation' && Math.random() > 0.3 
        ? 0 
        : randomValue(config.base + timeModifier, config.variance),
    });
    
    current.setTime(current.getTime() + incrementMs);
  }

  return {
    stationId,
    provider,
    variable,
    unit: config.unit,
    aggregation,
    points,
  };
}

// ============ Helper to simulate API delay ============

export function simulateDelay(minMs: number = 200, maxMs: number = 800): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise(resolve => setTimeout(resolve, delay));
}
