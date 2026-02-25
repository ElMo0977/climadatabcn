# Diagnóstico de Codex — 24-02-2026

Revisé todo el código propio del repositorio (sin contar `node_modules`, que son librerías instaladas).

---

## 1. Qué hace cada carpeta y archivo principal

### Carpetas en la raíz

- `.github/`: automatiza publicación en GitHub Pages.
- `.lovable/`: notas internas / plan antiguo de migración.
- `Documentos/`: documentos sueltos de apoyo (no código de la app).
- `docs/`: documentación técnica del proyecto.
- `public/`: archivos estáticos (favicon, robots, etc.).
- `scripts/`: script de diagnóstico de datos.
- `src/`: código principal de la aplicación web.
- `supabase/`: funciones backend antiguas (no son la vía actual).
- `dist/`: salida compilada para publicar.

### Archivos principales en raíz

- `README.md`: descripción general.
- `package.json`: dependencias y comandos.
- `.env.example`: variables de entorno de ejemplo.
- `index.html`: página base.
- `vite.config.ts`: configuración de arranque/compilación.
- `tailwind.config.ts`: diseño visual.
- `eslint.config.js`: reglas de calidad.
- `.github/workflows/deply.yml`: flujo de publicación automática.

### Dentro de `src/`

- `pages/`: pantallas; `Index.tsx` es la principal.
- `components/`: piezas de interfaz (selector, gráfica, tabla, exportación).
- `components/ui/`: biblioteca de componentes genéricos de interfaz.
- `hooks/`: lógica de carga de datos y estado.
- `services/`: conexión con fuentes de datos (XEMA/Socrata).
- `lib/`: cálculos, formateo, exportación Excel, cobertura de datos.
- `config/`: variables y etiquetas.
- `types/` y `domain/`: tipos de datos.
- `integrations/supabase/`: cliente/tipos de Supabase, ahora casi sin uso real.
- `test/`: configuración y pruebas de ejemplo.

---

## 2. Tecnologías y versiones que se usan

- React `18.3.1`
- TypeScript `5.8.3`
- Vite `5.4.x` (instalado `5.4.21`)
- Tailwind CSS `3.4.17`
- TanStack React Query `5.83.0`
- Recharts `2.15.4`
- Leaflet `1.9.4`
- ExcelJS `4.4.0`
- Supabase JS `2.93.3` (presente, pero no es la vía principal en runtime)
- Vitest `3.2.4` + Testing Library
- ESLint `9.32.0`
- CI usa Node 20 para build/deploy
- `supabase/functions` usa Deno `std@0.168.0`

---

## 3. Qué partes se ven claramente terminadas

- Flujo principal de la app: elegir estación, rango de fechas, ver indicadores, gráficas y tabla.
- Carga de datos desde XEMA/Socrata en estaciones y observaciones.
- Alertas de cobertura cuando faltan días o tramos de 30 minutos.
- Exportación a Excel con dos hojas y resaltado de viento fuerte.
- 55 tests pasando.
- Compilación y lint en verde.

---

## 4. Qué partes parecían incompletas o inconsistentes (estado inicial)

- `index.html` con título y metadatos de plantilla ("Lovable App") y comentarios TODO.
- `README.md` no reflejaba el estado real (hablaba de CSV y rutas antiguas).
- `supabase/functions/` usaba Open-Meteo y códigos antiguos.
- `src/App.css` era resto de plantilla sin uso.
- `src/components/NavLink.tsx` sin uso.
- Aprox. 33 de 51 componentes de `src/components/ui/` sin uso.
- Mezcla de etiquetas de granularidad ("30min" vs "Por horas") en la interfaz.
- Comportamiento desigual en fechas: rango inicial incluía hoy, presets no.
- Aviso de tamaño grande al compilar (paquetes JS pesados).

---

## 5. Patrones mezclados / código duplicado (estado inicial)

- Dos capas de tipos conviviendo: `src/types/weather.ts` y `src/domain/types.ts`.
- Arquitectura vieja y nueva mezcladas (servicios genéricos + llamada directa a XEMA).
- Utilidades de fecha y validación repetidas en varios archivos.
- Dos herramientas de diagnóstico similares: `src/lib/dataDebug.ts` y `scripts/dataDiagnostics.js`.
- Definiciones de estaciones en más de un sitio con códigos distintos.
- Mezcla de idiomas en textos de interfaz (español / catalán / inglés).

---

## 6. Cambios aplicados

### 24-02-2026

- `index.html` actualizado con metadatos reales de Meteo BCN (sin "Lovable App" ni TODOs).
- `README.md` reescrito para reflejar el estado real: fuente XEMA/Socrata y exportación Excel.
- Eliminados archivos sin uso: `src/App.css` y `src/components/NavLink.tsx`.
- `GUIA_PROYECTO.md` actualizado en el apartado "5. Estado actual".
- Texto de granularidad unificado en toda la interfaz a "Datos 30 min".
- Comportamiento de fechas corregido: hoy nunca seleccionable, presets desde ayer incluido, selector manual en días completos, intervalo de un solo día válido.

### 25-02-2026

- Eliminado todo el legado Open-Meteo / Supabase:
  - `supabase/functions/observations/` y `supabase/functions/stations/` borrados.
  - `src/integrations/supabase/` (client.ts y types.ts) borrado.
  - `src/config/env.ts` limpiado de claves supabaseUrl y supabaseKey.
  - `.env.example` limpiado de las tres variables VITE_SUPABASE_*.
  - Dependencia `@supabase/supabase-js` desinstalada (9 paquetes eliminados).
- Verificación post-limpieza: 56 tests pasando, build en verde.

### 25-02-2026 (sesión 2)

- Unificados los dos archivos de tipos en uno solo (`src/types/weather.ts`):
  - Migrados a `weather.ts`: `ProviderError`, `ApiError`, `ApiErrorCode`.
  - `DataProvider` unificado con `DataSource` (ya existente en `weather.ts`).
  - `DataMode` inlineado en `EnvConfig` (eliminada dependencia externa).
  - `src/domain/types.ts` eliminado.
- Eliminada la capa de abstracción de multi-proveedor (ya sin uso tras quitar Open-Meteo):
  - `src/services/dataService.ts` eliminado.
  - `src/services/providers/mockData.ts` y su test eliminados.
  - `src/services/providers/index.ts` eliminado.
  - Directorio `src/domain/` eliminado.
- `useStations.ts`: fallback simplificado para llamar directamente a `listStations()`.
- `env.ts`: eliminadas funciones sin uso `isProviderConfigured` y `getMissingConfigMessage`.
- Verificación post-limpieza: 54 tests pasando (−2 por test de mockData eliminado), build en verde.
