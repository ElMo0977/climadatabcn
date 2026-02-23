import type { Station } from '@/domain/types';
import { fetchSocrata } from '@/services/http/socrata';

export interface RawSocrataStation {
  codi_estacio: string;
  nom_estacio: string;
  latitud: string;
  longitud: string;
  altitud?: string;
  nom_municipi?: string;
  codi_estat_ema?: string;
  nom_xarxa?: string;
}

/**
 * Static fallback list used when live metadata is unavailable.
 *
 * IMPORTANT: ids must match real `codi_estacio` values from `yqwd-vj5e`
 * so observations queries keep working even in fallback mode.
 */
export function listStations(): Station[] {
  return [
    { id: 'X4', name: 'Barcelona - el Raval', provider: 'xema-transparencia', latitude: 41.3839, longitude: 2.16775, elevation: 33 },
    { id: 'X8', name: 'Barcelona - Zona Universitària', provider: 'xema-transparencia', latitude: 41.37919, longitude: 2.1054, elevation: 79 },
    { id: 'D5', name: 'Barcelona - Observatori Fabra', provider: 'xema-transparencia', latitude: 41.41864, longitude: 2.12379, elevation: 411 },
    { id: 'WU', name: 'Badalona - Museu', provider: 'xema-transparencia', latitude: 41.45215, longitude: 2.24757, elevation: 42 },
    { id: 'Y7', name: 'Port de Barcelona - Bocana Sud', provider: 'xema-transparencia', latitude: 41.31725, longitude: 2.16537, elevation: 3 },
    { id: 'YQ', name: 'Port de Barcelona - ZAL Prat', provider: 'xema-transparencia', latitude: 41.31928, longitude: 2.1372, elevation: 6 },
    { id: 'XL', name: 'el Prat de Llobregat', provider: 'xema-transparencia', latitude: 41.34045, longitude: 2.08022, elevation: 8 },
    { id: 'XV', name: 'Sant Cugat del Vallès - CAR', provider: 'xema-transparencia', latitude: 41.48311, longitude: 2.07956, elevation: 158 },
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
    const rows = await fetchSocrata<RawSocrataStation[]>(RESOURCE_ID, {
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
