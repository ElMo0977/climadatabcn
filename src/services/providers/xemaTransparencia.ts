// Facade kept intentionally thin to reduce merge conflict hotspots.
// Domain-specific logic lives in xemaStations.ts and xemaObservations.ts.

export {
  listStations,
  fetchStationsFromSocrata,
} from './xemaStations';

export {
  getObservations,
  buildDailyRangeBounds,
  filterDailyObservationsByRange,
  mapDailyRowsToObservations,
  mapSubdailyRowsToObservations,
  type DailyRow,
} from './xemaObservations';
