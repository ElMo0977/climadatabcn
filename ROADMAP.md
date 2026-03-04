# Roadmap

Mejoras identificadas en el code review de marzo 2026, ordenadas por prioridad.

---

## Prioridad alta

### Sanitizar queries Socrata

Las consultas `$where` en `src/services/providers/xemaObservations.ts` interpolan parametros directamente en el string:

```ts
$where: `codi_estacio = '${params.stationId}' AND ...`
```

Hoy los valores vienen de datos controlados (lista estatica o respuesta de Socrata), pero es un patron peligroso ante futuros cambios. Se debe validar `stationId` con regex (ej: `/^[A-Z0-9]+$/`) y sanitizar fechas antes de interpolarlas.

### Habilitar TypeScript strict

`tsconfig.app.json` tiene `strict: false`, `noImplicitAny: false` y `noUnusedLocals: false`. Esto anula buena parte del valor de TypeScript. Activar `strict: true` de forma progresiva (archivo por archivo si es necesario) seria el cambio con mayor retorno a largo plazo.

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
