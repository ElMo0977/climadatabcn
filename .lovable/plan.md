
# Plan: Migrar a Meteocat API (Fuente Oficial de Cataluna)

## Resumen

Migrar la fuente de datos meteorologicos de Open-Meteo a la API oficial del Servei Meteorologic de Catalunya (Meteocat), que proporciona datos reales de estaciones en Barcelona y toda Catalunya.

## Configuracion Previa Requerida

Antes de implementar, necesitas obtener una API Key de Meteocat:
1. Ir a https://apidocs.meteocat.gencat.cat/documentacio/acces-ciutada-i-administracio/
2. Rellenar el formulario de solicitud (gratuito para ciudadanos)
3. Recibiras la API Key por email (normalmente en 24-48h)

---

## Cambios a Implementar

### 1. Configurar Secret para API Key

Anadir el secret `METEOCAT_API_KEY` en el proyecto para almacenar la clave de forma segura.

### 2. Actualizar Edge Function de Estaciones

**Archivo:** `supabase/functions/stations/index.ts`

Cambios:
- Llamar a `https://api.meteo.cat/xema/v1/estacions/metadades?estat=ope` para obtener estaciones operativas
- Filtrar estaciones por provincia de Barcelona (codi provincia = 8)
- Transformar respuesta al formato actual de la aplicacion
- Header requerido: `X-Api-Key: {METEOCAT_API_KEY}`

Estructura de respuesta Meteocat:
```text
+------------------+     +-----------------+
| Meteocat API     | --> | Transformacion  | --> Station[]
| /estacions/...   |     | codigo a id     |
+------------------+     +-----------------+
```

### 3. Actualizar Edge Function de Observaciones

**Archivo:** `supabase/functions/observations/index.ts`

Cambios principales:

Para **datos diarios**:
- Endpoint: `https://api.meteo.cat/xema/v1/variables/estadistics/diaris/{codi_variable}?codiEstacio={codi}&any={year}&mes={month}`
- Variables a consultar:
  - 1000: Temperatura mitjana diaria (°C)
  - 1100: Humitat relativa mitjana (%)
  - 1300: Velocitat mitjana del vent (m/s)
  - 1301: Velocitat maxima del vent (m/s)
  - 1400: Precipitacio acumulada (mm)

Para **datos horarios** (mesurades):
- Endpoint: `https://api.meteo.cat/xema/v1/estacions/mesurades/{codiEstacio}/{any}/{mes}/{dia}`
- Variables en la respuesta:
  - 32: Temperatura (°C)
  - 33: Humitat relativa (%)
  - 30: Velocitat del vent (m/s)
  - 35: Precipitacio (mm)

Logica de multiples llamadas:
- Los datos diarios se obtienen por mes, necesitando agregar multiples meses si el rango lo requiere
- Los datos horarios se obtienen por dia, necesitando iterar por cada dia del rango

### 4. Mapeo de Codigos de Estaciones

Crear mapeo entre codigos Meteocat reales y los IDs internos actuales, o migrar completamente a usar los codigos de Meteocat (ej: "D5" para Barcelona - el Raval).

Estaciones reales en Barcelona area metropolitana:
- D5: Barcelona - el Raval
- X4: Barcelona - Zona Universitaria
- X2: Observatori Fabra
- X8: Barcelona - Barceloneta (cerca del puerto)
- XL: El Prat de Llobregat (aeropuerto)
- UE: Badalona

### 5. Actualizacion de Tipos

**Archivo:** `src/types/weather.ts`

Mantener la interfaz actual pero documentar que ahora los datos provienen de fuente oficial.

---

## Consideraciones Tecnicas

### Limitaciones de la API Meteocat

1. **Rate limiting**: La API tiene limites de peticiones. El cache actual de 15 min ayudara
2. **Retraso datos diarios**: Los estadisticos diarios tienen un retraso de ~3 dias respecto al dia actual
3. **Multiples llamadas**: Para rangos largos se necesitaran varias peticiones (por mes para diarios, por dia para horarios)

### Manejo de Errores

- Si una estacion no tiene sensor para una variable, el valor sera null
- Validar estado de lectura ("V" = valido, "N" = no valido)

### Fallback

Opcionalmente mantener Open-Meteo como fallback si Meteocat no responde.

---

## Orden de Implementacion

1. Obtener API Key de Meteocat (accion del usuario)
2. Configurar secret METEOCAT_API_KEY
3. Actualizar funcion de estaciones
4. Probar listado de estaciones
5. Actualizar funcion de observaciones (diarias primero)
6. Probar datos diarios
7. Implementar datos horarios
8. Pruebas completas end-to-end
