import { Search, MapPin, Mountain } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { Station } from '@/types/weather';
import { lazy, Suspense, useState } from 'react';
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
}

export function StationSelector({
  stations,
  selectedStation,
  onSelectStation,
  isLoading,
  error,
}: StationSelectorProps) {
  const [search, setSearch] = useState('');
  const canRenderMap = typeof window !== 'undefined';

  const filteredStations = stations.filter(station =>
    station.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="font-display text-lg font-semibold mb-3">Estaciones</h2>
        
        {/* Map */}
        {canRenderMap && !isLoading && !error && stations.length > 0 && (
          <div className="mb-3">
            <Suspense
              fallback={
                <div className="h-48 rounded-lg overflow-hidden border border-border">
                  <Skeleton className="h-full w-full" />
                </div>
              }
            >
              <LazyStationMap
                stations={stations}
                selectedStation={selectedStation}
                onSelectStation={onSelectStation}
              />
            </Suspense>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar estación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
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
