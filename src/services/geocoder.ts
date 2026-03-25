import type { GeocodeResult } from '@/lib/geocoder';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Geocodes an address using Nominatim (OpenStreetMap).
 * Returns a discriminated result: ok with lat/lon, or not_found / network_error.
 * Usage policy: max 1 req/s, no bulk usage.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const params = new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
    countrycodes: 'es',
  });
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return { ok: false, reason: 'network_error' };
    const data = (await res.json()) as NominatimResult[];
    if (!data.length) return { ok: false, reason: 'not_found' };
    return { ok: true, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch (error) {
    console.error('[geocodeAddress] fetch failed:', error);
    return { ok: false, reason: 'network_error' };
  }
}
