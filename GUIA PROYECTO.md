# GUIA PROYECTO

## 1. Que es este proyecto

**Meteo BCN** es una aplicacion web para consultar datos meteorologicos historicos de Barcelona y alrededores.  
Permite:

- Elegir una estacion meteorologica.
- Elegir rango de fechas.
- Ver indicadores principales (temperatura, humedad, viento, lluvia).
- Ver graficas de series temporales.
- Ver una tabla detallada de datos.
- Exportar datos a Excel.

La fuente activa en el estado actual del proyecto es **XEMA (Transparencia Catalunya / Socrata)**.

---

## 2. Estructura del repositorio (mapa rapido)

### Raiz

- `README.md`: resumen general (no siempre refleja al 100% el estado actual).
- `package.json`: dependencias y scripts.
- `.env.example`: variables de entorno de ejemplo.
- `vite.config.ts`: configuracion de build/dev y base de despliegue.
- `tailwind.config.ts`: configuracion visual.
- `index.html`: plantilla base HTML.

### Carpetas clave

- `src/`: aplicacion principal.
- `docs/`: notas tecnicas de implementacion.
- `scripts/`: herramientas de diagnostico.
- `supabase/`: funciones backend antiguas (no son la ruta principal actual).
- `.github/workflows/`: automatizacion de deploy a GitHub Pages.
- `public/`: assets estaticos.
- `dist/`: resultado compilado.

### Dentro de `src/`

- `pages/`: pantallas (la principal es `Index.tsx`).
- `components/`: piezas visuales del flujo principal (selector, graficas, tabla, exportacion).
- `components/ui/`: biblioteca grande de componentes reutilizables.
- `hooks/`: carga y manejo de estado de estaciones y observaciones.
- `services/`: capa de acceso a datos (Socrata/XEMA).
- `lib/`: utilidades (calculos, cobertura, export Excel, formato).
- `config/`: entorno y etiquetas de fuente.
- `types/` y `domain/`: tipos de datos.
- `test/`: setup de pruebas.

---

## 3. Tecnologias y versiones principales

- React 18.3.x
- TypeScript 5.8.x
- Vite 5.4.x
- Tailwind CSS 3.4.x
- React Query 5.x
- Recharts 2.x
- Leaflet 1.9.x
- ExcelJS 4.4.x
- Vitest 3.2.x + Testing Library
- ESLint 9.x

Notas:

- Hay cliente de Supabase en el repo, pero no es la ruta principal en runtime para los datos meteo actuales.
- CI usa Node 20 para build/deploy.

---

## 4. Flujo funcional actual (como viajan los datos)

1. La pagina principal carga estaciones cercanas a Barcelona.
2. El usuario selecciona estacion, rango y vista (`30min` o `daily`).
3. Se consultan observaciones a Socrata/XEMA.
4. La UI muestra:
   - KPIs
   - Graficas
   - Tabla
   - Avisos de cobertura si faltan datos
5. En exportacion Excel, se prepara:
   - Hoja detalle 30min
   - Hoja diaria

---

## 5. Estado actual del proyecto

### Partes solidas / terminadas

- Flujo principal funcional de consulta y visualizacion.
- Integracion de datos XEMA/Socrata activa.
- Exportacion Excel implementada.
- Avisos de datos faltantes (diario y subdiario).
- Suite de tests pasando (56 tests).
- Build y lint en verde.
- Metadatos y SEO base actualizados en `index.html` para Meteo BCN.
- `README.md` reescrito y alineado con el estado real del proyecto.
- Limpieza de restos de plantilla ya aplicada (`src/App.css` y `src/components/NavLink.tsx` eliminados).
- Texto de granularidad unificado en la UI a `Datos 30 min`.
- Logica de fechas corregida: hoy no seleccionable, presets desde ayer, dias completos en selector manual y rango de un solo dia valido.

### Partes incompletas o inconsistentes

- El warning de Vite por chunks > 500 kB es preexistente y no bloqueante.
  Pendiente de abordar como tarea de optimización de bundle independiente.

### Patrones mezclados / duplicidad

- Resuelto en sesiones de limpieza de febrero 2026:
  - Tipos unificados en `src/types/weather.ts` (eliminado `src/domain/types.ts`).
  - Capas de abstracción de multi-proveedor eliminadas (`dataService`, `mockData`, `domain/`).
  - Función `toLocalDayKey` consolidada en `src/lib/dailyCoverage.ts`.
- Pendiente menor: funciones de formateo de fecha repartidas entre `weatherUtils.ts`,
  `exportExcel.ts` y capa de UI. Evaluado y descartado unificar: cada una sirve
  un propósito distinto y la dispersión es intencionada.

---

## 6. Como arrancar el proyecto localmente

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env` desde `.env.example` (si aplica).

3. Levantar entorno local:

```bash
npm run dev
```

4. Ejecutar pruebas:

```bash
npm test
```

5. Validar lint y build:

```bash
npm run lint
npm run build
```

---

## 7. Recomendaciones para un nuevo desarrollador (primeros dias)

1. Leer primero `src/pages/Index.tsx` para entender el flujo principal.
2. Continuar con `src/hooks/useStations.ts` y `src/hooks/useObservations.ts`.
3. Revisar `src/services/providers/xemaTransparencia.ts` (facade) y:
   - `xemaStations.ts`
   - `xemaObservations.ts`
4. Mirar `src/lib/exportExcel.ts`, `dailyCoverage.ts` y `subdailyCoverage.ts`.
5. Validar que cualquier cambio mantenga:
   - tests verdes
   - build verde
   - comportamiento consistente entre UI, tabla y Excel.

---

## 8. Prioridades de limpieza tecnica sugeridas

1. Actualizar metadatos y textos base (`index.html`, README).
2. Decidir si se elimina o congela `supabase/functions` legado.
3. Reducir componentes UI no usados para simplificar mantenimiento.
4. Unificar criterio de granularidad y fechas en toda la app.
5. Consolidar tipos/utilidades duplicadas en una sola capa clara.

---

## 9. Resumen ejecutivo

El proyecto está **funcional, estable y limpio** en su flujo principal de consulta
meteo + exportación, con pruebas y build correctos.

Las tareas de limpieza técnica iniciadas en febrero 2026 están completadas:
fuente de datos única (XEMA/Socrata), capa de tipos unificada, abstracciones
de multi-proveedor eliminadas y utilidades duplicadas consolidadas.

El principal trabajo pendiente es optimización de bundle (chunks > 500 kB)
y documentación de nuevas funcionalidades si se incorporan.
