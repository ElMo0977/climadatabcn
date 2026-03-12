import type { Station } from '@/types/weather';

const BARCELONA_LAT = 41.3851;
const BARCELONA_LON = 2.1734;
const DEFAULT_RADIUS_KM = 50;

type StationSeed = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  municipality?: string;
};

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(radiusKm * c * 10) / 10;
}

export function mapStationsNearBarcelona(stations: StationSeed[]): Station[] {
  return stations
    .map((station) => ({
      id: station.id,
      name: station.name,
      latitude: station.latitude,
      longitude: station.longitude,
      elevation: station.elevation ?? null,
      municipality: station.municipality,
      distance: haversineDistanceKm(
        BARCELONA_LAT,
        BARCELONA_LON,
        station.latitude,
        station.longitude,
      ),
      source: 'xema-transparencia' as const,
    }))
    .filter((station) => station.distance <= DEFAULT_RADIUS_KM)
    .sort((a, b) => a.distance - b.distance);
}
