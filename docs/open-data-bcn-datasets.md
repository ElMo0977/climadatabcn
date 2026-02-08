# Datos que ofrece Open Data BCN (relevantes para la app)

Resumen de qué datos publica el Ayuntamiento de Barcelona en [Open Data BCN](https://opendata-ajuntament.barcelona.cat/) y cuáles encajan con lo que necesita la app (estaciones, series temporales por hora/día: temperatura, humedad, viento, precipitación).

---

## 1. Datasets de clima / meteorología

| Dataset / tema | Qué ofrece | Granularidad | ¿Encaja con la app? |
|----------------|------------|--------------|----------------------|
| **Temperaturas medias mensuales** (desde 1780) | Temperatura media del aire en °C por mes. Fuente: Servei Meteorològic de Catalunya. | **Mensual** (un valor por mes) | No: la app necesita por **hora** o **día** y, si es posible, por **estación**. |
| **Precipitaciones acumuladas mensuales** (desde 1786) | Precipitación acumulada en mm por mes. Dataset: `precipitacio-hist-bcn`. CSV. Actualización anual. | **Mensual** (un valor por mes) | No: misma razón; la app usa series horarias/diarias y por estación. |
| **Previsión meteorológica Barcelonès** | Previsión del tiempo (XML). Actualización cada 30 min. Fuente: SMC/Meteocat. | Diaria / previsión | No: la app usa **datos observados** (históricos), no solo previsión. |
| **Metadatos de la red XEMA** | Listado/info de estaciones de la Xarxa d’Estacions Meteorològiques Automàtiques. | Estáticas (metadatos) | Parcial: sirve para **listar estaciones**; las **series** (temp, humedad, viento, precip) de la XEMA están en Meteocat/Transparencia Catalunya, no en Open Data BCN como API de series. |

**Conclusión clima:** Open Data BCN tiene sobre todo **clima histórico agregado mensual** (temperatura y precipitación) y **metadatos/previsiones**. No expone series **horarias o diarias por estación** como las que usa la app hoy (temp, humedad, viento, precip por hora/día por estación).

---

## 2. Calidad del aire (potencialmente útiles)

| Dataset / tema | Qué ofrece | Comentario para la app |
|----------------|------------|-------------------------|
| **Qualitat aire detall BCN** (`qualitat-aire-detall-bcn`) | Red de ~10 estaciones; mediciones de contaminantes (NO₂, PM10, CO, etc.) y posiblemente alguna variable meteorológica asociada según recurso. | Útil si quieres **añadir** calidad del aire. Para **solo** tiempo (temp, humedad, viento, precip) no sustituye a una API meteorológica por estación. |
| **Otros recursos de Medi Ambient** | Otros datasets de medio ambiente (ruido, etc.). | Revisar en el catálogo por si algún recurso incluye temp/humedad en estaciones de calidad del aire. |

---

## 3. Dónde están los datos “por estación” y por hora/día

- **Series horarias/diarias por estación** (temperatura, humedad, viento, precipitación) en Catalunya:
  - **API Meteocat (XEMA)** – la que ya no usas por falta de API key.
  - **Transparencia Catalunya** – dataset de “Datos meteorológicos diarios de la XEMA” (ej. identificador `7bvh-jvq2`), en CSV/JSON/XML; no es la misma API que Open Data BCN.
- **Open Data BCN** no publica, al menos de forma clara, una API de **series temporales horarias/diarias por estación** de temperatura, humedad, viento y precipitación como la que consume la app.

---

## 4. Resumen: qué incluir en la app según origen

| Si los datos vienen de… | Variables que tiene sentido incluir en la app |
|-------------------------|-----------------------------------------------|
| **Open Data BCN – clima** (temperatura/precip mensual) | Solo si añades una vista de **resumen mensual/histórico** (ej. gráfico de promedios mensuales o tendencia). No sirve para la vista actual “por estación + por hora/día”. |
| **Open Data BCN – calidad del aire** | NO₂, PM10, índice de calidad del aire, etc., como **capas o sección extra** (por estación si el recurso lo permite). No reemplazan temp/humedad/viento/precip por hora/día. |
| **Open Data BCN – metadatos XEMA** | Listado de **estaciones** (nombre, ubicación, id) para mostrar en el selector; las series seguirían teniendo que venir de otro sitio (p. ej. Open-Meteo por coordenadas o futura API). |

---

## 5. Recomendación práctica

- **Mantener como está (Open Data BCN + Open-Meteo):**  
  - Open Data BCN: actualmente en la app solo tienes **mock**; no hay un recurso claro en Open Data BCN que dé series horarias/diarias por estación para temp, humedad, viento y precip.  
  - Open-Meteo (Supabase) sí ofrece esas variables por hora/día por coordenadas, que es lo que la app necesita.

- **Si quieres “incluir” Open Data BCN de forma real:**  
  1. **Solo listado de estaciones:** usar el recurso de **metadatos de estaciones** (XEMA u otro del catálogo) para rellenar el selector de estaciones; las series seguirían viniendo de Open-Meteo por coordenadas de cada estación.  
  2. **Añadir clima histórico mensual:** usar los datasets de **temperatura mensual** y **precipitación mensual** para una sección o gráfico de “Histórico mensual Barcelona” (opcional).  
  3. **Añadir calidad del aire:** usar `qualitat-aire-detall-bcn` (o el recurso que corresponda) para mostrar NO₂, PM10, etc., por estación si el API lo permite.

- **Para datos horarios/diarios por estación “oficiales”** sin Meteocat: habría que valorar **Transparencia Catalunya** (descarga/API del dataset 7bvh-jvq2) o otra API que exponga la XEMA; eso sería un desarrollo aparte.

---

## 6. Enlaces útiles

- Catálogo Open Data BCN (temas): https://opendata-ajuntament.barcelona.cat/data/es  
- Filtro “Meteorologia”: https://opendata-ajuntament.barcelona.cat/data/en/dataset?dades_alt_valor=Meteorologia&num_resources=1  
- API CKAN (base): `https://opendata-ajuntament.barcelona.cat/data/api/3/action/` (ej. `package_list`, `package_show`, `datastore_search`)  
- Precipitación histórica (dataset): `precipitacio-hist-bcn`  
- Documentación API catálogo: https://opendata-ajuntament.barcelona.cat/es/api-cataleg  

Si más adelante localizas un recurso concreto en Open Data BCN que dé series por estación y por hora/día (por ejemplo dentro de calidad del aire), se puede actualizar este doc y el adapter `openDataBcn.ts` para consumirlo.
