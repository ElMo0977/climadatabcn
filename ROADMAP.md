# Roadmap

Mejoras identificadas en el code review de marzo 2026, ordenadas por prioridad.

---

## Prioridad alta

### ~~Sanitizar queries Socrata~~ ✔ Completado (2026-03-04)

Resuelto: se añadieron validaciones con regex para `stationId` (`/^[A-Za-z0-9]{1,10}$/`) y day keys (`/^\d{4}-\d{2}-\d{2}$/`) en `getObservations()` antes de interpolar en queries `$where`.

### ~~Habilitar TypeScript strict~~ ✔ Completado (2026-03-04)

Resuelto: se activo `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true` y `noFallthroughCasesInSwitch: true` en `tsconfig.app.json`. Se corrigieron 9 errores en 5 archivos (imports sin usar, parametros sin tipo, variables sin usar).

---

## Prioridad media

### Timeout y reintentos en el cliente Socrata

Existe `src/services/http/fetchJson.ts` con timeout, reintentos y backoff exponencial. Sin embargo, `socrata.ts` (el unico cliente activo) usa `fetch()` directamente sin timeout ni reintentos. Si la API de Socrata tarda o falla, no hay proteccion. Se deberia integrar `fetchJson` en `socrata.ts` o al menos anadir timeout.

### Eliminar duplicacion en useStations

`src/hooks/useStations.ts` tiene el bloque de mapeo de estaciones (`.map(s => {...}).filter(...).sort(...)`) duplicado para el path de Socrata y el fallback estatico. Extraer a una funcion helper `mapAndFilterStations()`.

---

## Prioridad baja

### Limpiar componentes UI sin usar

De ~40 componentes en `src/components/ui/`, solo se usan ~10 activamente. Los demas son shadcn/ui instalados por defecto que no se importan en ningun sitio. Eliminarlos reduce ruido en el repositorio.

### Unificar manejo de errores

`socrata.ts` lanza errores genericos (`new Error()`), `fetchJson.ts` usa `ProviderError` tipado, y los hooks castean errores sin tipo. Unificar con `ProviderError` en toda la capa de servicios mejoraria los mensajes al usuario.

### Refactorizar Index.tsx

`src/pages/Index.tsx` (338 lineas) mezcla estado de la app, logica de exportacion Excel, formateo de gaps y deteccion de errores de chunk. Se podria extraer:
- Logica de exportacion a un custom hook `useExcelExport`.
- Alertas de cobertura a un componente propio.

---

## Housekeeping

| Tarea | Detalle |
|-------|---------|
| Corregir typo en CI | `.github/workflows/deply.yml` deberia ser `deploy.yml` |
| Eliminar directorio `supabase/` | Contiene funciones legacy que ya no se usan |
| Habilitar `no-unused-vars` en ESLint | La regla esta deshabilitada en `eslint.config.js`, lo que permite acumular imports muertos |
| Unificar `downloadFile` / `downloadFileBuffer` | `weatherUtils.ts` tiene dos funciones casi identicas que podrian ser una sola |
