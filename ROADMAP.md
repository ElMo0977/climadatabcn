# Roadmap del proyecto

Trabajo pendiente del proyecto, ordenado por prioridad.

## Prioridad alta

### Rehabilitar `@typescript-eslint/no-unused-vars`

La regla esta desactivada en `eslint.config.js`, lo que permite que se acumulen imports y parametros muertos.

Criterio de cierre: volver a activarla con una limpieza previa del codigo que hoy depende de esa tolerancia.

## Prioridad media

### Renombrar `.github/workflows/deply.yml` a `deploy.yml`

El workflow funciona, pero el nombre actual contiene un typo que dificulta navegacion y mantenimiento.

Criterio de cierre: renombrar el archivo sin cambiar el comportamiento del pipeline.

### Decidir el destino del directorio `supabase/`

El changelog documenta la eliminacion de la integracion legacy, pero el directorio `supabase/` sigue presente en el repo.

Criterio de cierre: eliminarlo si ya no se usa o documentar por que debe conservarse.

## Prioridad baja

### Consolidar `downloadFile` y `downloadFileBuffer`

`src/lib/weatherUtils.ts` mantiene dos utilidades de descarga muy parecidas.

Criterio de cierre: evaluar si pueden unificarse sin complicar la exportacion de Excel ni el resto de helpers.
