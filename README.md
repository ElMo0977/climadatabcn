# Meteo BCN

Aplicacion web para consultar datos meteorologicos historicos de Barcelona y su area metropolitana.

## Que hace

- Seleccion de estaciones meteorologicas cercanas a Barcelona.
- Seleccion de rango de fechas.
- Vista en dos modos: `30min` y `diario`.
- KPIs de temperatura, humedad, viento y precipitacion.
- Graficas y tabla de datos.
- Exportacion a Excel (hoja de detalle y hoja diaria).
- Avisos cuando faltan datos en el rango seleccionado.

## Fuente de datos

La fuente activa del proyecto es:

- **XEMA (Transparencia Catalunya / Socrata)**

## Tecnologias principales

- React + TypeScript
- Vite
- Tailwind CSS
- React Query
- Recharts
- Leaflet
- ExcelJS
- Vitest + Testing Library

## Ejecutar en local

```bash
npm install
npm run dev
```

La app abre en entorno Vite (puerto configurado en `vite.config.ts`).

## Variables de entorno

Copiar `.env.example` a `.env`.

Variables utiles:

- `VITE_DEBUG_DATA=1` para ver diagnostico de datos en consola.
- `VITE_DEBUG_XEMA=true` para logs de depuracion del proveedor XEMA.
- `VITE_API_PROXY_URL` es opcional (si se configura proxy).

## Comandos utiles

```bash
npm run dev
npm test
npm run lint
npm run build
```

## Estado actual (resumen)

- Flujo principal funcional y estable.
- Integracion XEMA/Socrata activa.
- Exportacion Excel funcionando.
- Tests y build en verde.
- Existen carpetas/archivos heredados (por ejemplo `supabase/functions`) que no son la ruta principal actual.
