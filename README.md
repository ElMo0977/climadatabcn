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
- **Fuente de datos**: [Meteostat](https://meteostat.net/) via RapidAPI

## Configuración

### 1. Clave API de Meteostat

La app utiliza la API de Meteostat a través de RapidAPI. Necesitas configurar el secret `RAPIDAPI_KEY`:

1. Regístrate en [RapidAPI](https://rapidapi.com/)
2. Suscríbete a la [API de Meteostat](https://rapidapi.com/meteostat/api/meteostat)
3. Copia tu API key
4. En Lovable Cloud, ve a Secrets y añade `RAPIDAPI_KEY` con tu key

### 2. Ejecutar localmente

```bash
npm install
npm run dev
```

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
