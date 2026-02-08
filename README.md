# Meteo BCN

Aplicación web para visualizar y descargar datos meteorológicos históricos de Barcelona.

## Características

- **Selector de estaciones**: Lista de estaciones meteorológicas cercanas a Barcelona con búsqueda
- **Rango de fechas**: Selector con presets (7, 14, 30 días) y granularidad horaria/diaria
- **KPIs**: Temperatura media, humedad media, velocidad del viento media
- **Gráficos interactivos**: Series temporales con zoom para temperatura, humedad y viento
- **Tabla paginada**: Datos detallados con timestamps locales (Europe/Madrid)
- **Descarga**: Exportación a CSV y Excel

## Tecnologías

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts
- **Backend**: Supabase Edge Functions (Deno)
- **Fuente de datos**:
  - **Open Data BCN** – datos abiertos del Ayuntamiento de Barcelona (fuente principal)
  - **Open-Meteo** – respaldo por coordenadas cuando Open Data BCN no está disponible

## Configuración

### Ejecutar localmente

```bash
npm install
npm run dev
```

### Variables de entorno

Copia `.env.example` a `.env` y rellena:

- `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` para Supabase (respaldo Open-Meteo).
- `VITE_BCN_APP_TOKEN` (opcional) para Open Data BCN si necesitas mayor tasa de peticiones.
- `VITE_DATA_MODE=mock` para desarrollo con datos de prueba sin API.

Cuando Open Data BCN no está disponible, la app usa **Open-Meteo** (vía Supabase) y muestra el aviso *"Datos de respaldo (Open-Meteo)"* en la interfaz.

## Fuente mostrada en la app

En gráficos y Excel se muestra *"Fuente: Open Data BCN - Estación: [nombre]"* (o *"Datos de respaldo (Open-Meteo) - Estación: [nombre]"* en modo respaldo).

## Formato de datos (referencia)

```typescript
// Estación (types/weather)
interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  distance: number; // km
  source?: 'opendata-bcn' | 'open-meteo';
}

// Observación
interface Observation {
  timestamp: string; // ISO 8601
  temperature: number | null; // °C
  humidity: number | null; // %
  windSpeed: number | null; // m/s
  dataSourceLabel?: string; // "Fuente: X - Estación: Y"
}
```

## API Interna

- `GET /api/stations?lat=..&lon=..&radiusKm=..` – Lista estaciones cercanas
- `GET /api/observations?stationId=..&from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=hourly|daily` – Datos meteorológicos

## Caché

Los datos se cachean en memoria durante 15 minutos por combinación de parámetros.
