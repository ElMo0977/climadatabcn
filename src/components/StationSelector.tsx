import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react';
import { Search, MapPin, Mountain, AlertTriangle, Loader2 } from 'lucide-react';
import { DEFAULT_REFERENCE_ADDRESS } from '@/hooks/useReferencePoint';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { Station, ReferencePoint } from '@/types/weather';
import { cn } from '@/lib/utils';

const LazyStationMap = lazy(async () => {
  const mod = await import('./StationMap');
  return { default: mod.StationMap };
});

interface StationSelectorProps {
  stations: Station[];
  selectedStation: Station | null;
  onSelectStation: (station: Station) => void;
  isLoading: boolean;
  error: Error | null;
  warning?: string | null;
  referencePoint?: ReferencePoint | null;
  onReferenceAddressSearch?: (address: string) => void;
  isGeocodingReference?: boolean;
  referenceGeoError?: string | null;
}

export function StationSelector({
  stations,
  selectedStation,
  onSelectStation,
  isLoading,
  error,
  warning,
  referencePoint,
  onReferenceAddressSearch,
  isGeocodingReference = false,
  referenceGeoError,
}: StationSelectorProps) {
  const [search, setSearch] = useState('');
  const [refAddress, setRefAddress] = useState(
    referencePoint?.label ?? DEFAULT_REFERENCE_ADDRESS,
  );

  const handleRefSearch = (e: FormEvent) => {
    e.preventDefault();
    onReferenceAddressSearch?.(refAddress);
  };
  const canRenderMap = typeof window !== 'undefined';

  const normalizedSearch = search.trim().toLowerCase();

  const filteredStations = useMemo(() => {
    if (!normalizedSearch) return stations;

    return stations.filter((station) => {
      const haystack = [
        station.name,
        station.municipality ?? '',
        station.id,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch, stations]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="font-display text-lg font-semibold mb-3">Estaciones</h2>
        
        {/* Reference point input */}
        <div className="mb-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
            <MapPin className="h-3 w-3 text-red-500" />
            <span>Punto de referencia</span>
          </div>
          <form onSubmit={handleRefSearch} className="flex gap-1.5">
            <Input
              value={refAddress}
              onChange={(e) => setRefAddress(e.target.value)}
              placeholder="Introduce una dirección..."
              className="text-xs h-8 flex-1"
              aria-label="Dirección de referencia"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8 px-2.5"
              disabled={isGeocodingReference || !refAddress.trim()}
              aria-label="Buscar dirección"
            >
              {isGeocodingReference
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Search className="h-3 w-3" />}
            </Button>
          </form>
          {referenceGeoError && (
            <p className="text-xs text-destructive mt-1">{referenceGeoError}</p>
          )}
        </div>

        {/* Map */}
        {canRenderMap && !isLoading && !error && stations.length > 0 && (
          <div className="mb-3">
            <Suspense
              fallback={
                <div className="h-56 rounded-lg overflow-hidden border border-border md:h-60">
                  <Skeleton className="h-full w-full" />
                </div>
              }
            >
              <LazyStationMap
                stations={stations}
                selectedStation={selectedStation}
                onSelectStation={onSelectStation}
                referencePoint={referencePoint}
              />
            </Suspense>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar estación..."
            aria-label="Buscar estación"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {warning && !error && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
              <p className="text-xs text-amber-900">{warning}</p>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}

          {error && (
            <div className="p-4 text-center">
              <p className="text-destructive text-sm">{error.message}</p>
              <p className="text-muted-foreground text-xs mt-1">
                Comprueba la conexión e inténtalo de nuevo
              </p>
            </div>
          )}

          {!isLoading && !error && filteredStations.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No se encontraron estaciones
            </div>
          )}

          {!isLoading && !error && filteredStations.map(station => (
            <button
              key={station.id}
              onClick={() => onSelectStation(station)}
              className={cn(
                "station-item w-full text-left mb-1",
                selectedStation?.id === station.id && "active"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{station.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {station.distance} km
                    </span>
                    {station.elevation !== null && (
                      <span className="flex items-center gap-1">
                        <Mountain className="h-3 w-3" />
                        {station.elevation} m
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          {stations.length} estaciones cerca de Barcelona
        </p>
      </div>
    </div>
  );
}
