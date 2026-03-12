# Revision de codigo

Revision realizada con el contexto SDD cargado desde Engram:

- `sdd-init/climadatabcn` (`#15`)
- `skill-registry` (`#14`)

Evidencia complementaria usada durante la revision:

- `npm test -- --run` pasa con `14` archivos de test y `54` tests.
- `npm run build -- --mode production` genera, entre otros, `dist/assets/index-dpXo51q7.js` (`270.61 kB`), `dist/assets/vendor-charts-CiYPWjnX.js` (`517.94 kB`), `dist/assets/StationMap-Cbkdb4KF.js` (`151.58 kB`) y `dist/assets/exceljs.min-DTd0DZEa.js` (`938.54 kB`, cargado de forma diferida).

No se ha aplicado ninguna correccion. Este documento solo recoge hallazgos y recomendaciones.

## Agente 1 - Arquitectura y violaciones de capas

Nota: no he encontrado imports directos que salten literalmente de `pages` o `components` a `services`. Los problemas actuales son mas de mezcla de responsabilidades y acoplamiento transversal que de ruptura explicita de imports.

### Hallazgo A1 - `Index.tsx` ha dejado de ser una pagina fina de composicion

- Severidad: `aviso`
- Referencias: `src/pages/Index.tsx:15`, `src/pages/Index.tsx:16`, `src/pages/Index.tsx:17`, `src/pages/Index.tsx:20`, `src/pages/Index.tsx:59`, `src/pages/Index.tsx:64`, `src/pages/Index.tsx:69`, `src/pages/Index.tsx:74`, `src/pages/Index.tsx:109`, `src/pages/Index.tsx:130`
- Hallazgo: la pagina no solo compone componentes y hooks; tambien calcula estadisticas, cobertura diaria/subdiaria, formatea mensajes de dias ausentes, ejecuta diagnostico de debug y orquesta los datos necesarios para exportacion. Eso convierte `Index.tsx` en un punto de politica de dominio y hace mas costoso cambiar reglas de negocio sin tocar la pantalla principal.
- Recomendacion: mover la logica derivada y las decisiones de presentacion de dominio a hooks o helpers dedicados para que la pagina vuelva a actuar como ensamblador de estado y layout.

### Hallazgo A2 - `useStations()` mezcla acceso a datos con politica geografica y fallback

- Severidad: `aviso`
- Referencias: `src/hooks/useStations.ts:5`, `src/hooks/useStations.ts:24`, `src/hooks/useStations.ts:35`, `src/hooks/useStations.ts:45`, `src/hooks/useStations.ts:57`
- Hallazgo: el hook no se limita a consultar estaciones; tambien decide el centro geografico de Barcelona, calcula distancias Haversine, aplica el radio de 50 km, ordena resultados y define la estrategia live-vs-fallback. Ese volumen de reglas hace que la capa de hooks absorba logica de dominio que deberia ser reutilizable y comprobable fuera de React.
- Recomendacion: extraer la politica de radio/distancia/fallback a modulos puros o al provider/fachada para que el hook quede como adaptador de React Query.

### Hallazgo A3 - El provider de observaciones depende de una utilidad de cobertura

- Severidad: `sugerencia`
- Referencias: `src/services/providers/xemaObservations.ts:2`, `src/services/providers/xemaObservations.ts:60`, `src/services/providers/xemaObservations.ts:129`
- Hallazgo: `xemaObservations.ts` importa `toLocalDayKey` desde `src/lib/dailyCoverage.ts`, que conceptualmente pertenece a la logica de cobertura. Esto introduce un acoplamiento inverso: el provider de datos depende de una utilidad nacida para analisis aguas arriba.
- Recomendacion: mover la normalizacion de fechas a una utilidad de bajo nivel compartida por providers y calculos de cobertura, en lugar de reutilizar una funcion definida dentro del modulo de cobertura diaria.

## Agente 2 - Tipos TypeScript y seguridad de tipos

### Hallazgo T1 - `useObservations()` pierde informacion de `ProviderError`

- Severidad: `aviso`
- Referencias: `src/hooks/useObservations.ts:20`, `src/hooks/useObservations.ts:24`, `src/hooks/useObservations.ts:25`, `src/hooks/useObservations.ts:108`, `src/types/weather.ts:68`
- Hallazgo: el hook expone `error: Error | null` y `refetch` tipado con `Error`, aunque la capa HTTP y los providers ya generan `ProviderError` con `code`, `provider` y `details`. Al normalizar todo a `Error`, la UI pierde informacion util para distinguir timeouts, errores de red, parametros invalidos o rate limiting.
- Recomendacion: propagar `ProviderError` en la firma publica del hook o, como minimo, exponer un tipo union que preserve esa metadata en el consumo.

### Hallazgo T2 - `env.dataMode` se estrecha con un cast sin validacion runtime

- Severidad: `sugerencia`
- Referencias: `src/config/env.ts:26`, `src/config/env.ts:27`
- Hallazgo: `VITE_DATA_MODE` se lee como string y luego se fuerza con `as 'live' | 'mock'`. Cualquier valor no vacio queda aceptado por TypeScript aunque no pertenezca al dominio real esperado.
- Recomendacion: validar el valor contra un conjunto cerrado antes de asignarlo al objeto `env` y usar el fallback solo cuando el valor no sea valido.

### Hallazgo T3 - `useExcelExport()` reescribe a mano el contrato de `refetch`

- Severidad: `sugerencia`
- Referencias: `src/hooks/useExcelExport.ts:26`, `src/hooks/useExcelExport.ts:33`, `src/hooks/useExcelExport.ts:34`, `src/hooks/useObservations.ts:15`
- Hallazgo: el hook define manualmente que `refetchObservations()` y `refetchOtherObservations()` devuelven un objeto con `data?: { data: Observation[] }` y `error: Error | null`. Esa firma duplica parcialmente el contrato de React Query y puede desalinearse si cambia `UseObservationsResult` o si se enriquece la respuesta.
- Recomendacion: derivar esos tipos desde el hook de observaciones o reutilizar `QueryObserverResult<ObservationsQueryData, ...>` para evitar drift entre contratos.

### Hallazgo T4 - La query key pierde forma al declararse como `unknown[]`

- Severidad: `sugerencia`
- Referencias: `src/hooks/useObservations.ts:29`, `src/hooks/useObservations.ts:35`
- Hallazgo: `getObservationsQueryKey()` devuelve `unknown[]` pese a construir siempre una tupla estable y estructurada. Eso reduce ayuda del compilador en invalidaciones, inspeccion y reutilizacion de la key.
- Recomendacion: devolver una tupla `as const` o un alias de tipo explicito para preservar la forma exacta de la key.

## Agente 3 - React Query y patrones de fetching

### Hallazgo RQ1 - `VITE_API_PROXY_URL` esta documentada pero no afecta al cliente Socrata

- Severidad: `aviso`
- Referencias: `.env.example:8`, `README.md:43`, `src/config/env.ts:28`, `src/services/http/socrata.ts:8`, `src/services/http/socrata.ts:38`
- Hallazgo: el proyecto documenta `VITE_API_PROXY_URL` y `env.ts` la parsea, pero `src/services/http/socrata.ts` sigue construyendo siempre las URLs contra `https://analisi.transparenciacatalunya.cat`. En la practica, configurar el proxy no cambia nada.
- Recomendacion: o bien conectar realmente `env.apiProxyBaseUrl` en el cliente Socrata, o bien retirar la variable de la documentacion para no prometer un comportamiento inexistente.

### Hallazgo RQ2 - La carga de estaciones oculta errores reales tras el fallback estatico

- Severidad: `aviso`
- Referencias: `src/services/providers/xemaStations.ts:47`, `src/services/providers/xemaStations.ts:65`, `src/services/providers/xemaStations.ts:75`, `src/hooks/useStations.ts:45`, `src/hooks/useStations.ts:60`
- Hallazgo: `fetchStationsFromSocrata()` captura errores y devuelve directamente la lista fallback; despues `useStations()` vuelve a envolver la llamada en otro `try/catch` y configura `retry: 2`. Como resultado, React Query rara vez ve un error de metadata real, la UI no puede distinguir live vs fallback, y el `retry` del hook apenas aporta valor.
- Recomendacion: decidir si el fallback debe ser explicito en la capa de UI o si el servicio debe devolver un estado enriquecido (`source`, `isFallback`, `warning`) en vez de ocultar por completo el fallo.

### Hallazgo RQ3 - Las queries no propagan la senal de cancelacion de React Query

- Severidad: `aviso`
- Referencias: `src/hooks/useObservations.ts:63`, `src/hooks/useObservations.ts:65`, `src/hooks/useObservations.ts:77`, `src/services/http/socrata.ts:25`, `src/services/http/socrata.ts:39`, `src/services/http/fetchJson.ts:7`, `src/services/http/fetchJson.ts:42`, `src/services/http/fetchJson.ts:80`, `src/services/http/fetchJson.ts:86`
- Hallazgo: `useQuery()` ofrece `signal` para cancelar peticiones obsoletas, pero el `queryFn` de observaciones no la usa y la capa HTTP crea su propio `AbortController`. Si el usuario cambia rapido de estacion o rango, el trabajo de red anterior sigue vivo hasta timeout o respuesta.
- Recomendacion: aceptar `signal` en el `queryFn` y reenviarla hasta `fetchJson()` para que la cancelacion de React Query sea efectiva.

### Hallazgo RQ4 - Hay dos capas de retries apiladas para la misma peticion

- Severidad: `sugerencia`
- Referencias: `src/hooks/useObservations.ts:100`, `src/hooks/useObservations.ts:101`, `src/services/http/fetchJson.ts:31`, `src/services/http/fetchJson.ts:32`, `src/services/http/fetchJson.ts:40`, `src/services/http/fetchJson.ts:61`
- Hallazgo: la query de observaciones usa `retry: 2` en React Query y, ademas, `fetchJson()` hace por defecto `retries = 2` con backoff exponencial. En fallos persistentes eso multiplica el trafico y el tiempo de espera antes de surfacing del error.
- Recomendacion: unificar la estrategia de reintento en una sola capa y reservar la otra para casos muy concretos.

## Agente 4 - Huecos en la cobertura de tests

Nota: no he priorizado wrappers genericos de `src/components/ui/*`; el foco esta en codigo de producto, integracion y modulos con logica propia.

### Hallazgo C1 - El pipeline de datos todavia tiene varios modulos clave sin test directo

- Severidad: `aviso`
- Referencias: `src/config/env.ts:1`, `src/hooks/useStations.ts:1`, `src/hooks/useExcelExport.ts:1`, `src/lib/dataDebug.ts:1`, `src/services/http/fetchJson.ts:1`, `src/services/http/socrata.ts:1`, `src/services/providers/xemaObservations.ts:1`, `src/services/providers/xemaVariableMap.ts:1`
- Hallazgo: el proyecto tiene una base de 54 tests, pero siguen sin cobertura directa modulos clave de parseo de entorno, HTTP, paginacion Socrata, exportacion orquestada, instrumentacion de debug y obtencion de observaciones/metadata variable. Son puntos donde hoy confluyen errores de red, serializacion y contratos de datos.
- Recomendacion: priorizar tests unitarios y de contrato sobre esta ruta de datos antes de seguir ampliando pruebas de presentacion.

### Hallazgo C2 - La cobertura actual de providers esta centrada en happy path

- Severidad: `aviso`
- Referencias: `src/services/providers/xemaTransparencia.test.ts:178`, `src/services/providers/xemaTransparencia.test.ts:288`, `src/services/providers/xemaTransparencia.test.ts:323`, `src/services/providers/xemaObservations.ts:10`, `src/services/providers/xemaObservations.ts:16`, `src/services/providers/xemaObservations.ts:93`, `src/services/providers/xemaStations.ts:65`, `src/services/providers/xemaStations.ts:75`
- Hallazgo: las pruebas del facade XEMA cubren mapeos y consultas nominales, pero dejan fuera validacion de parametros invalidos, diagnostico `VITE_DEBUG_XEMA`, ramas de error/red y el comportamiento de fallback cuando Socrata no devuelve metadata util.
- Recomendacion: anadir tests de error y de borde sobre `ProviderError`, validaciones regex y rutas fallback para que el comportamiento no quede implicito.

### Hallazgo C3 - `Index.test.tsx` valida orquestacion, pero no integra componentes reales

- Severidad: `sugerencia`
- Referencias: `src/pages/Index.test.tsx:15`, `src/pages/Index.test.tsx:19`, `src/pages/Index.test.tsx:33`, `src/pages/Index.test.tsx:37`, `src/pages/Index.test.tsx:43`, `src/pages/Index.test.tsx:49`, `src/pages/Index.test.tsx:56`, `src/pages/Index.test.tsx:63`
- Hallazgo: la pagina principal se prueba con `useStations`, `useObservations`, exportacion y casi todos los componentes hijos completamente mockeados. Eso da confianza sobre ciertas decisiones de orquestacion, pero no cubre integraciones reales entre selector, mapa, graficas, tabla, alertas y botones de descarga.
- Recomendacion: mantener estos tests de aislamiento, pero complementarlos con al menos una ruta integrada usando componentes reales y un `QueryClientProvider` de prueba.

### Hallazgo C4 - La prueba de Excel es demasiado superficial para el peso funcional del modulo

- Severidad: `aviso`
- Referencias: `src/lib/exportExcel.test.ts:48`, `src/lib/exportExcel.ts:76`, `src/lib/exportExcel.ts:96`, `src/lib/exportExcel.ts:134`, `src/lib/exportExcel.ts:160`
- Hallazgo: el test actual solo comprueba que `buildAndDownloadExcel()` no lanza con datasets vacios y que intenta descargar un buffer. No valida columnas, nombres de hojas, filas de cabecera, formato de fechas ni resaltado de seguridad de viento.
- Recomendacion: ampliar la cobertura sobre la estructura del workbook para proteger un flujo que combina presentacion, negocio y exportacion binaria.

### Hallazgo C5 - Varias interacciones visibles de UI siguen sin test directo

- Severidad: `sugerencia`
- Referencias: `src/components/CoverageAlerts.tsx:1`, `src/components/DataTable.tsx:1`, `src/components/DownloadButtons.tsx:1`, `src/components/Header.tsx:1`, `src/components/StationMap.tsx:1`, `src/components/StationSelector.tsx:1`, `src/components/WeatherCharts.tsx:1`
- Hallazgo: componentes con comportamiento visible para el usuario, incluyendo filtrado de estaciones, paginacion de tabla, alertas de cobertura, render de graficas y seleccion en mapa, no tienen pruebas propias en el arbol actual.
- Recomendacion: cubrir primero los componentes con estado local o interaccion compleja y dejar para despues los wrappers puramente visuales.

### Hallazgo C6 - Sigue existiendo un test placeholder sin valor funcional

- Severidad: `sugerencia`
- Referencias: `src/test/example.test.ts:1`
- Hallazgo: `example.test.ts` solo comprueba que `true === true`. Aporta ruido en el conteo total y no protege ningun comportamiento real del producto.
- Recomendacion: eliminarlo o sustituirlo por una smoke test autentica del arranque de la app.

## Agente 5 - Rendimiento

Nota: el mapa ya esta diferido via `lazy()` en `src/components/StationSelector.tsx`, y ExcelJS tambien se carga bajo demanda. Los principales riesgos actuales estan en la ruta principal y en el trabajo repetido de algunos componentes.

### Hallazgo P1 - Las graficas siguen entrando en la carga inicial de la ruta principal

- Severidad: `aviso`
- Referencias: `src/pages/Index.tsx:8`, `src/pages/Index.tsx:216`, `vite.config.ts:21`, `vite.config.ts:25`, `vite.config.ts:28`
- Hallazgo: `WeatherCharts` se importa de forma directa en la pagina principal. Aunque Vite separa `recharts` en `vendor-charts`, el build de produccion sigue cargando un chunk de `517.94 kB` para graficas junto a la ruta inicial, ademas de un `index` principal de `270.61 kB`.
- Recomendacion: diferir `WeatherCharts` o dividirlo por paneles cuando no sea imprescindible mostrar todas las visualizaciones en el primer render.

### Hallazgo P2 - `StationMap` reconstruye todos los marcadores al cambiar de estacion

- Severidad: `aviso`
- Referencias: `src/components/StationMap.tsx:64`, `src/components/StationMap.tsx:68`, `src/components/StationMap.tsx:72`, `src/components/StationMap.tsx:91`, `src/components/StationMap.tsx:100`
- Hallazgo: el efecto que crea marcadores depende de `selectedStation`, por lo que cada cambio de seleccion elimina y recrea todos los marcadores. Despues, un segundo efecto vuelve a recorrerlos para ajustar iconos. En listas pequenas no es dramatico, pero el patron escala mal y genera trabajo duplicado.
- Recomendacion: separar la construccion de marcadores del cambio visual de seleccion para que solo cambien iconos y enfoque cuando se selecciona otra estacion.

### Hallazgo P3 - `WeatherCharts` recalcula toda la data derivada en cada render

- Severidad: `sugerencia`
- Referencias: `src/components/WeatherCharts.tsx:18`, `src/components/WeatherCharts.tsx:19`, `src/components/WeatherCharts.tsx:26`, `src/components/WeatherCharts.tsx:29`
- Hallazgo: `chartData` y `windChartData` se regeneran completos en cada render, incluyendo formateo de etiquetas y agregacion de viento por bucket. Cuando cambian props no relacionadas o aumenta el numero de observaciones, esa recomputacion recae entera en la fase de render.
- Recomendacion: memorizar derivadas costosas o mover parte de esa preparacion al hook de datos para evitar trabajo repetido en la capa visual.

### Hallazgo P4 - La configuracion del build relaja demasiado la alarma de tamano de chunk

- Severidad: `sugerencia`
- Referencias: `vite.config.ts:21`, `vite.config.ts:22`
- Hallazgo: `chunkSizeWarningLimit: 1000` oculta el aviso por defecto de Vite justo cuando ya existen chunks grandes (`vendor-charts` y el chunk lazy de `exceljs`). Eso reduce visibilidad sobre regresiones futuras en el bundle.
- Recomendacion: bajar el umbral o monitorizarlo explicitamente en CI para no normalizar el crecimiento del bundle.

### Hallazgo P5 - `StationMap` depende de iconos remotos en tiempo de ejecucion

- Severidad: `sugerencia`
- Referencias: `src/components/StationMap.tsx:7`, `src/components/StationMap.tsx:8`, `src/components/StationMap.tsx:9`, `src/components/StationMap.tsx:10`, `src/components/StationMap.tsx:18`, `src/components/StationMap.tsx:19`, `src/components/StationMap.tsx:20`
- Hallazgo: los iconos por defecto de Leaflet se cargan desde `unpkg.com` en runtime. Eso anade dependencia externa adicional, puede penalizar el primer render del mapa y deja el componente expuesto a bloqueos de red o CSP.
- Recomendacion: empaquetar los assets del mapa dentro del proyecto o servirlos desde el mismo origen de la app.
