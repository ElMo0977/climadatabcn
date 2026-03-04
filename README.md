# Meteo BCN

Aplicacion web para consultar y exportar datos meteorologicos historicos de Barcelona y su area metropolitana.

Consume datos abiertos de la red XEMA del Servei Meteorologic de Catalunya a traves de la API SODA de Socrata (Transparencia Catalunya).

## Funcionalidades

- Seleccion de estaciones meteorologicas cercanas a Barcelona (mapa interactivo + lista).
- Seleccion de rango de fechas con presets rapidos (7, 14, 30 dias).
- Dos modos de visualizacion: datos cada 30 minutos y resumen diario.
- KPIs: temperatura media, humedad media, viento medio/maximo, precipitacion total.
- Graficas de series temporales (temperatura, humedad, viento, precipitacion).
- Tabla paginada con resaltado de viento fuerte (>5 m/s).
- Exportacion a Excel con dos hojas (detalle 30min y resumen diario).
- Alertas cuando faltan datos en el rango seleccionado.

## Quick start

```bash
npm install
npm run dev
```

La app abre en el puerto configurado en `vite.config.ts`.

### Comandos principales

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Ejecutar tests (single run) |
| `npm run test:watch` | Tests en modo watch |
| `npm run lint` | Verificar reglas ESLint |
| `npm run build` | Build de produccion (type-check + Vite) |

## Variables de entorno

Copiar `.env.example` a `.env`. Todas son opcionales:

| Variable | Descripcion |
|----------|-------------|
| `VITE_DEBUG_XEMA` | `true` para activar logs de depuracion del proveedor XEMA (solo en desarrollo) |
| `VITE_DEBUG_DATA` | `1` para ver diagnostico de datos en consola |
| `VITE_API_PROXY_URL` | URL base de proxy para las peticiones a Socrata (opcional) |

## Tecnologias

| Tecnologia | Uso |
|------------|-----|
| React 18 + TypeScript | Framework UI y tipado |
| Vite | Bundler y servidor de desarrollo |
| Tailwind CSS | Estilos utilitarios |
| React Query (TanStack) | Cache y gestion de estado de servidor |
| Recharts | Graficas de series temporales |
| Leaflet | Mapa interactivo de estaciones |
| ExcelJS | Generacion de archivos Excel (lazy-loaded) |
| Vitest + Testing Library | Tests unitarios y de componentes |

## Documentacion

| Documento | Contenido |
|-----------|-----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arquitectura tecnica, diagrama de capas, estructura de directorios, flujo de datos |
| [CHANGELOG.md](CHANGELOG.md) | Historico de cambios del proyecto |
| [ROADMAP.md](ROADMAP.md) | Mejoras futuras planificadas |
| [docs/xema-transparencia-implementation.md](docs/xema-transparencia-implementation.md) | Detalles de la integracion con XEMA/Socrata |

## Fuente de datos

Los datos meteorologicos provienen de la **red XEMA** (Xarxa d'Estacions Meteorologiques Automatiques) del **Servei Meteorologic de Catalunya**, publicados como datos abiertos en el portal de **Transparencia Catalunya** a traves de la API SODA de Socrata.

- Portal: [analisi.transparenciacatalunya.cat](https://analisi.transparenciacatalunya.cat)
- Dataset diario: `7bvh-jvq2`
- Dataset 30min: `nzvn-apee`
- Estaciones: `yqwd-vj5e`
