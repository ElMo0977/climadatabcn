import { useState, useEffect, useCallback } from 'react';
import { geocodeAddress } from '@/services/geocoder';
import type { ReferencePoint } from '@/types/weather';

export const DEFAULT_REFERENCE_ADDRESS = 'Plaça Sanllehy, Barcelona';

export function useReferencePoint() {
  const [referencePoint, setReferencePoint] = useState<ReferencePoint | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const geocode = useCallback(async (address: string): Promise<boolean> => {
    const trimmed = address.trim();
    if (!trimmed) return false;
    setIsGeocoding(true);
    setGeocodeError(null);
    const result = await geocodeAddress(trimmed);
    setIsGeocoding(false);
    if (!result.ok) {
      setGeocodeError(result.reason === 'not_found' ? 'Dirección no encontrada' : 'Error de conexión');
      return false;
    }
    setReferencePoint({ lat: result.lat, lon: result.lon, label: trimmed });
    return true;
  }, []);

  // Geocode default address on mount
  useEffect(() => {
    void geocode(DEFAULT_REFERENCE_ADDRESS);
  }, [geocode]);

  return { referencePoint, isGeocoding, geocodeError, geocode };
}
