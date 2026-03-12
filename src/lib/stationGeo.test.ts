import { describe, expect, it } from 'vitest';
import { mapStationsNearBarcelona } from './stationGeo';

describe('stationGeo', () => {
  it('filters stations by radius and sorts them by distance from Barcelona', () => {
    const stations = mapStationsNearBarcelona([
      {
        id: 'near-2',
        name: 'Badalona',
        latitude: 41.45215,
        longitude: 2.24757,
        elevation: 42,
      },
      {
        id: 'far-1',
        name: 'Girona',
        latitude: 41.9794,
        longitude: 2.8214,
        elevation: 70,
      },
      {
        id: 'near-1',
        name: 'Barcelona - el Raval',
        latitude: 41.3839,
        longitude: 2.16775,
        elevation: 33,
      },
    ]);

    expect(stations.map((station) => station.id)).toEqual(['near-1', 'near-2']);
    expect(stations[0].source).toBe('xema-transparencia');
    expect(stations[0].distance).toBeLessThanOrEqual(stations[1].distance);
  });
});
