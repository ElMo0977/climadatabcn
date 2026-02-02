# Meteo BCN

Aplicación web para visualizar y descargar datos meteorológicos históricos de Barcelona.

## Características

- **Selector de estaciones**: Lista de estaciones meteorológicas cercanas a Barcelona con búsqueda
- **Rango de fechas**: Selector con presets (7, 14, 30 días) y granularidad horaria/diaria
- **KPIs**: Temperatura media, humedad media, velocidad del viento media
- **Gráficos interactivos**: Series temporales con zoom para temperatura, humedad y viento
- **Tabla paginada**: Datos detallados con timestamps locales (Europe/Madrid)
- **Descarga**: Exportación a CSV y JSON

## Tecnologías

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts
- **Backend**: Supabase Edge Functions (Deno)
- **Fuente de datos**: [Open-Meteo](https://open-meteo.com/) - API gratuita sin autenticación

## Configuración

### Ejecutar localmente

```bash
npm install
npm run dev
```

No se requiere API key - Open-Meteo es completamente gratuita y abierta.

## Cambiar fuente de datos

Para usar otra API meteorológica, modifica los adaptadores en:

- `supabase/functions/stations/index.ts` - Función `fetchStationsFromMeteostat`
- `supabase/functions/observations/index.ts` - Función `fetchObservationsFromMeteostat`

El formato normalizado esperado:

```typescript
// Estación
interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  distance: number; // km
}

// Observación
interface Observation {
  timestamp: string; // ISO 8601
  temperature: number | null; // °C
  humidity: number | null; // %
  windSpeed: number | null; // km/h
}
```

## API Interna

- `GET /api/stations?lat=..&lon=..&radiusKm=..` - Lista estaciones cercanas
- `GET /api/observations?stationId=..&from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=hourly|daily` - Datos meteorológicos

## Caché

Los datos se cachean en memoria durante 15 minutos por combinación de parámetros.
