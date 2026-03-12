# Meteo BCN

Aplicacion web para consultar y exportar datos meteorologicos historicos de Barcelona y su area metropolitana.

Consume datos abiertos de la red XEMA del Servei Meteorologic de Catalunya a traves de la API SODA de Socrata y se despliega como sitio estatico en GitHub Pages.

## Funcionalidades

- Seleccion de estaciones meteorologicas cercanas a Barcelona con mapa interactivo y lista.
- Seleccion de rango de fechas con presets rapidos de 7, 14 y 30 dias.
- Dos vistas temporales: detalle cada 30 minutos y resumen diario.
- KPIs de temperatura, humedad, viento y precipitacion.
- Graficas de series temporales y tabla paginada de observaciones.
- Exportacion a Excel con dos hojas: `30min` y `Diario`.
- Alertas de cobertura cuando faltan datos en el rango seleccionado.

## Inicio rapido

```bash
npm install
npm run dev
```

La app de desarrollo arranca en `http://localhost:8080`.

## Comandos principales

| Comando | Uso |
|---------|-----|
| `npm run dev` | Servidor de desarrollo con Vite |
| `npm test` | Suite de tests con Vitest |
| `npm run test:watch` | Tests en modo watch |
| `npm run lint` | Verificacion de ESLint |
| `npm run build` | Type-check y build de produccion |
| `npm run preview` | Servir localmente el build generado |

## Variables de entorno soportadas

Copia `.env.example` a `.env`. La configuracion habitual del proyecto solo necesita estas variables opcionales:

| Variable | Uso |
|----------|-----|
| `VITE_DEBUG_XEMA` | Diagnostico del provider XEMA y del fetch subdaily (`true` o `1`, solo en desarrollo) |
| `VITE_DEBUG_DATA` | Auditoria del dataset final en consola (`1`) |

Nota: `src/config/env.ts` tambien expone `VITE_DATA_MODE`, pero el runtime actual no cambia de provider ni de flujo en funcion de esa variable. Se considera configuracion interna y no forma parte del setup normal del proyecto.

## Documentacion

El mapa documental completo vive en [docs/README.md](docs/README.md).

| Documento | Para que sirve |
|-----------|----------------|
| [docs/README.md](docs/README.md) | Indice canonico y ownership de la documentacion |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arquitectura por capas, flujo de datos y decisiones tecnicas |
| [docs/xema-transparencia-implementation.md](docs/xema-transparencia-implementation.md) | Integracion actual con XEMA / Socrata, contratos y flags de debug |
| [ROADMAP.md](ROADMAP.md) | Trabajo pendiente |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios relevantes |
| [AGENTS.md](AGENTS.md) | Flujo de trabajo y referencias para agentes |

## Fuente de datos

Los datos meteorologicos provienen de la red XEMA del Servei Meteorologic de Catalunya, publicados como datos abiertos en Transparencia Catalunya a traves de la API SODA de Socrata.

- Portal: [analisi.transparenciacatalunya.cat](https://analisi.transparenciacatalunya.cat)
- Estaciones: `yqwd-vj5e`
- Dataset diario: `7bvh-jvq2`
- Dataset 30 min: `nzvn-apee`
