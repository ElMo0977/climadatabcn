export interface GeoPoint {
  lat: number;
  lon: number;
}

export type GeocodeResult =
  | { ok: true; lat: number; lon: number }
  | { ok: false; reason: 'not_found' | 'network_error' };
