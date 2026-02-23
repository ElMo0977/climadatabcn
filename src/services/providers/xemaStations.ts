import type { Station } from '@/domain/types';
import { fetchSocrata } from '@/services/http/socrata';

/**
 * Static fallback list used when live metadata is unavailable.
 */
export function listStations(): Station[] {
  return [
    { id: 'bcn-raval', name: 'Barcelona - El Raval', provider: 'xema-transparencia', latitude: 41.3797, longitude: 2.1682, elevation: 33 },
    { id: 'bcn-zoo', name: 'Barcelona - Zona Universitària', provider: 'xema-transparencia', latitude: 41.3870, longitude: 2.1130, elevation: 85 },
    { id: 'bcn-fabra', name: 'Observatori Fabra', provider: 'xema-transparencia', latitude: 41.4184, longitude: 2.1239, elevation: 411 },
    { id: 'bcn-port', name: 'Barcelona - Port Olímpic', provider: 'xema-transparencia', latitude: 41.3850, longitude: 2.2010, elevation: 5 },
    { id: 'bcn-eixample', name: 'Barcelona - Eixample', provider: 'xema-transparencia', latitude: 41.3930, longitude: 2.1620, elevation: 45 },
    { id: 'bcn-gracia', name: 'Barcelona - Gràcia', provider: 'xema-transparencia', latitude: 41.4036, longitude: 2.1532, elevation: 120 },
    { id: 'bcn-airport', name: 'Aeropuerto El Prat', provider: 'xema-transparencia', latitude: 41.2974, longitude: 2.0833, elevation: 4 },
    { id: 'badalona', name: 'Badalona', provider: 'xema-transparencia', latitude: 41.4500, longitude: 2.2474, elevation: 20 },
    { id: 'hospitalet', name: "L'Hospitalet de Llobregat", provider: 'xema-transparencia', latitude: 41.3596, longitude: 2.1000, elevation: 25 },
    { id: 'sant-cugat', name: 'Sant Cugat del Vallès', provider: 'xema-transparencia', latitude: 41.4722, longitude: 2.0864, elevation: 180 },
    { id: 'montjuic', name: 'Barcelona - Montjuïc', provider: 'xema-transparencia', latitude: 41.3639, longitude: 2.1586, elevation: 173 },
    { id: 'tibidabo', name: 'Barcelona - Tibidabo', provider: 'xema-transparencia', latitude: 41.4225, longitude: 2.1189, elevation: 512 },
  ];
}

export async function fetchStationsFromSocrata(): Promise<
  {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    elevation?: number;
    municipality?: string;
  }[]
> {
  const RESOURCE_ID = 'yqwd-vj5e';
  try {
    const rows = await fetchSocrata<any[]>(RESOURCE_ID, {
      $select: 'codi_estacio,nom_estacio,latitud,longitud,altitud,nom_municipi,codi_estat_ema,nom_xarxa',
      $where: "nom_xarxa = 'XEMA' AND codi_estat_ema = '2'",
      $limit: 2000,
      $order: 'nom_estacio ASC',
    });

    const stations = rows
      .filter((row) => row.codi_estacio && row.latitud && row.longitud)
      .map((row) => ({
        id: row.codi_estacio,
        name: row.nom_estacio,
        latitude: Number(row.latitud),
        longitude: Number(row.longitud),
        elevation: row.altitud ? Number(row.altitud) : undefined,
        municipality: row.nom_municipi,
      }));

    if (stations.length === 0) {
      return listStations().map((s) => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        elevation: s.elevation ?? undefined,
      }));
    }
    return stations;
  } catch (error) {
    console.warn('[xemaStations] fetchStationsFromSocrata failed:', error);
    return listStations().map((s) => ({
      id: s.id,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      elevation: s.elevation ?? undefined,
    }));
  }
}
