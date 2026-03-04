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

### ~~Timeout y reintentos en el cliente Socrata~~ ✔ Completado (2026-03-04)

Resuelto: `socrata.ts` ahora usa `fetchJson()` en lugar de `fetch()` directo, ganando timeout (10s), reintentos (2) con backoff exponencial, y errores tipados con `ProviderError`.

### ~~Eliminar duplicacion en useStations~~ ✔ Completado (2026-03-04)

Resuelto: se extrajo la funcion helper `mapAndSortStations()` en `useStations.ts`, eliminando la duplicacion del bloque `.map().filter().sort()` entre el path de Socrata y el fallback estatico.

---

## Prioridad baja

### ~~Limpiar componentes UI sin usar~~ ✔ Completado (2026-03-04)

Resuelto: eliminados 36 componentes shadcn/ui sin usar de `src/components/ui/`. El CSS del bundle se redujo de 65 KB a 33 KB (-49%).

### ~~Unificar manejo de errores~~ ✔ Completado (2026-03-04)

Resuelto: `socrata.ts` migrado a `fetchJson()` (usa `ProviderError`). Validaciones en `xemaObservations.ts` ahora lanzan `ProviderError` con code `INVALID_PARAMS`. Narrowing seguro de errores en `useObservations.ts`.

### ~~Refactorizar Index.tsx~~ ✔ Completado (2026-03-04)

Resuelto: logica de exportacion Excel extraida a hook `useExcelExport.ts`. Alertas de cobertura extraidas a componente `CoverageAlerts.tsx`. `Index.tsx` reducido de 338 a ~230 lineas.

---

## Housekeeping

| Tarea | Detalle |
|-------|---------|
| Corregir typo en CI | `.github/workflows/deply.yml` deberia ser `deploy.yml` |
| Eliminar directorio `supabase/` | Contiene funciones legacy que ya no se usan |
| Habilitar `no-unused-vars` en ESLint | La regla esta deshabilitada en `eslint.config.js`, lo que permite acumular imports muertos |
| Unificar `downloadFile` / `downloadFileBuffer` | `weatherUtils.ts` tiene dos funciones casi identicas que podrian ser una sola |
