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
- **Fuentes de datos** (prioridad automática):
  1. **Meteocat (XEMA)** – datos oficiales de Catalunya (requiere API key)
  2. **Open Data BCN** – datos abiertos del Ayuntamiento de Barcelona
  3. **Open-Meteo** – respaldo por coordenadas (sin clave)

## Configuración

### Ejecutar localmente

```bash
npm install
npm run dev
```

### Variable de entorno para Meteocat (prioridad 1)

Para usar datos oficiales de Meteocat, añade en tu archivo **`.env.local`** (en la raíz del proyecto) la variable:

```bash
VITE_METEOCAT_API_KEY=tu_clave_aqui
```

- **Nombre exacto**: `VITE_METEOCAT_API_KEY`
- El prefijo `VITE_` es necesario para que Vite exponga la variable al frontend como `import.meta.env.VITE_METEOCAT_API_KEY`.
- No escribas la clave en el código; solo en `.env.local` (y añade `.env.local` a `.gitignore` si no está).
- Clave gratuita: [apidocs.meteocat.gencat.cat](https://apidocs.meteocat.gencat.cat/documentacio/acces-ciutada-i-administracio/)

Sin esta variable, la app usará Open Data BCN y, si falla, **Open-Meteo** (respaldo), mostrando el aviso *"Datos de respaldo (Open-Meteo)"* en la interfaz.

## Jerarquía de fuentes

La app intenta en este orden:

1. **Meteocat**: si `VITE_METEOCAT_API_KEY` está definida.
2. **Open Data BCN**: si Meteocat no está configurado o falla.
3. **Open-Meteo** (vía Supabase): solo si las anteriores fallan; se muestra el aviso de respaldo.

En gráficos y Excel se incluye la línea *"Fuente: [nombre] - Estación: [nombre]"*.

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
  source?: 'meteocat' | 'opendata-bcn' | 'open-meteo';
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

- `GET /api/stations?lat=..&lon=..&radiusKm=..` - Lista estaciones cercanas
- `GET /api/observations?stationId=..&from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=hourly|daily` - Datos meteorológicos

## Caché

Los datos se cachean en memoria durante 15 minutos por combinación de parámetros.
