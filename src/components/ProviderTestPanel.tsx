/**
 * Provider Test Panel
 * 
 * A minimal UI component to test and validate provider integration.
 * Shows provider status, allows selection, and displays station/observation data.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Loader2, MapPin, Thermometer, RefreshCw } from 'lucide-react';
import { 
  useProviderStations, 
  useProviderLatest, 
  useProviderStatus 
} from '@/hooks/useDataService';
import type { ProviderMode, Station } from '@/domain/types';
import { env } from '@/config/env';

export function ProviderTestPanel() {
  const [selectedProvider, setSelectedProvider] = useState<ProviderMode>('auto');
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showLatest, setShowLatest] = useState(false);

  const providerStatus = useProviderStatus();

  const { 
    data: stationsResult, 
    isLoading: stationsLoading, 
    error: stationsError,
    refetch: refetchStations,
  } = useProviderStations(selectedProvider, { enabled: false });

  const {
    data: latestResult,
    isLoading: latestLoading,
    refetch: refetchLatest,
  } = useProviderLatest(
    selectedProvider, 
    selectedStation?.id ?? null,
    { enabled: showLatest && !!selectedStation }
  );

  const handleLoadStations = () => {
    refetchStations();
  };

  const handleSelectStation = (station: Station) => {
    setSelectedStation(station);
    setShowLatest(false);
  };

  const handleLoadLatest = () => {
    setShowLatest(true);
    refetchLatest();
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Panel de Prueba de Proveedores
        </CardTitle>
        <CardDescription>
          Valida la integración con los proveedores de datos meteorológicos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Environment Info */}
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="font-medium mb-2">Configuración actual:</p>
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <span>Modo de datos:</span>
            <Badge variant={env.dataMode === 'mock' ? 'secondary' : 'default'}>
              {env.dataMode}
            </Badge>
            <span>API Key Meteocat:</span>
            <Badge variant={env.meteocatApiKey ? 'default' : 'destructive'}>
              {env.meteocatApiKey ? 'Configurada' : 'No configurada'}
            </Badge>
            <span>Token BCN:</span>
            <Badge variant={env.bcnAppToken ? 'default' : 'secondary'}>
              {env.bcnAppToken ? 'Configurado' : 'Opcional'}
            </Badge>
          </div>
        </div>

        {/* Provider Status */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Estado de proveedores:</p>
          <div className="flex gap-3">
        {Object.entries(providerStatus).map(([provider, status]) => (
              <div 
                key={provider}
                className="flex items-center gap-2 rounded-md border px-3 py-2"
              >
                {status.configured ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm capitalize">{provider}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Provider Selection */}
        <div className="flex items-center gap-4">
          <Select 
            value={selectedProvider} 
            onValueChange={(v) => setSelectedProvider(v as ProviderMode)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Seleccionar proveedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (con fallback)</SelectItem>
              <SelectItem value="meteocat">Meteocat</SelectItem>
              <SelectItem value="opendata-bcn">Open Data BCN</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            onClick={handleLoadStations}
            disabled={stationsLoading}
          >
            {stationsLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Cargar estaciones
          </Button>
        </div>

        {/* Error Display */}
        {(stationsResult?.error || stationsError) && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">
                  Error al cargar datos
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stationsResult?.error?.message || 
                   (stationsError as Error)?.message || 
                   'Error desconocido'}
                </p>
                {stationsResult?.error?.code === 'MISSING_API_KEY' && (
                  <p className="text-sm mt-2">
                    💡 Configura la variable de entorno correspondiente o activa modo mock 
                    con <code className="bg-muted px-1 rounded">VITE_DATA_MODE=mock</code>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stations List */}
        {stationsResult?.data && stationsResult.data.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Estaciones ({stationsResult.data.length}) - Proveedor: {stationsResult.provider}
            </p>
            <ScrollArea className="h-[200px] rounded-md border">
              <div className="p-2 space-y-1">
                {stationsResult.data.map((station) => (
                  <button
                    key={`${station.provider}-${station.id}`}
                    onClick={() => handleSelectStation(station)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedStation?.id === station.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium">{station.name}</div>
                    <div className="text-xs opacity-70">
                      {station.id} • {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
                      {station.elevation && ` • ${station.elevation}m`}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Selected Station & Latest Data */}
        {selectedStation && (
          <div className="space-y-3">
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedStation.name}</p>
                <p className="text-sm text-muted-foreground">
                  ID: {selectedStation.id} • {selectedStation.provider}
                </p>
              </div>
              <Button 
                onClick={handleLoadLatest}
                disabled={latestLoading}
                size="sm"
              >
                {latestLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Thermometer className="h-4 w-4 mr-2" />
                )}
                Obtener Latest
              </Button>
            </div>

            {/* Latest Observation Error */}
            {latestResult?.error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">
                  {latestResult.error.message}
                </p>
              </div>
            )}

            {/* Latest Observation Data */}
            {latestResult?.data && (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Última lectura: {new Date(latestResult.data.timestamp).toLocaleString()}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {latestResult.data.values.temperature !== undefined && (
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {latestResult.data.values.temperature?.toFixed(1) ?? '—'}°C
                      </p>
                      <p className="text-xs text-muted-foreground">Temperatura</p>
                    </div>
                  )}
                  {latestResult.data.values.humidity !== undefined && (
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {latestResult.data.values.humidity?.toFixed(0) ?? '—'}%
                      </p>
                      <p className="text-xs text-muted-foreground">Humedad</p>
                    </div>
                  )}
                  {latestResult.data.values.windSpeed !== undefined && (
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {latestResult.data.values.windSpeed?.toFixed(1) ?? '—'} m/s
                      </p>
                      <p className="text-xs text-muted-foreground">Viento</p>
                    </div>
                  )}
                  {latestResult.data.values.precipitation !== undefined && (
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {latestResult.data.values.precipitation?.toFixed(1) ?? '—'} mm
                      </p>
                      <p className="text-xs text-muted-foreground">Precipitación</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
