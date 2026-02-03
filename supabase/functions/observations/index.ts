import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache en memoria con TTL
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

// Coordenadas de las estaciones
const STATION_COORDS: Record<string, { lat: number; lon: number }> = {
  "bcn-raval": { lat: 41.3797, lon: 2.1682 },
  "bcn-zoo": { lat: 41.3870, lon: 2.1130 },
  "bcn-fabra": { lat: 41.4184, lon: 2.1239 },
  "bcn-port": { lat: 41.3850, lon: 2.2010 },
  "bcn-eixample": { lat: 41.3930, lon: 2.1620 },
  "bcn-gracia": { lat: 41.4036, lon: 2.1532 },
  "bcn-airport": { lat: 41.2974, lon: 2.0833 },
  "badalona": { lat: 41.4500, lon: 2.2474 },
  "hospitalet": { lat: 41.3596, lon: 2.1000 },
  "sant-cugat": { lat: 41.4722, lon: 2.0864 },
  "montjuic": { lat: 41.3639, lon: 2.1586 },
  "tibidabo": { lat: 41.4225, lon: 2.1189 },
};

interface Observation {
  timestamp: string;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windSpeedMin: number | null;
  windSpeedMax: number | null;
  precipitation: number | null;
}

interface OpenMeteoHourlyResponse {
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    relative_humidity_2m: (number | null)[];
    wind_speed_10m: (number | null)[];
    precipitation: (number | null)[];
  };
}

interface OpenMeteoDailyResponse {
  daily: {
    time: string[];
    temperature_2m_mean: (number | null)[];
    relative_humidity_2m_mean: (number | null)[];
    wind_speed_10m_max: (number | null)[];
    wind_speed_10m_min: (number | null)[];
    precipitation_sum: (number | null)[];
  };
}

async function fetchFromOpenMeteo(
  lat: number,
  lon: number,
  from: string,
  to: string,
  granularity: "hourly" | "daily"
): Promise<Observation[]> {
  let url: string;
  
  if (granularity === "hourly") {
    url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${from}&end_date=${to}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&wind_speed_unit=ms&timezone=Europe/Madrid`;
  } else {
    url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${from}&end_date=${to}&daily=temperature_2m_mean,relative_humidity_2m_mean,wind_speed_10m_max,wind_speed_10m_min,precipitation_sum&wind_speed_unit=ms&timezone=Europe/Madrid`;
  }

  console.log("Fetching from Open-Meteo:", url);

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Open-Meteo API error:", response.status, errorText);
    throw new Error(`Open-Meteo API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("Open-Meteo response received, processing data...");

  if (granularity === "hourly") {
    const hourlyData = data as OpenMeteoHourlyResponse;
    if (!hourlyData.hourly?.time) {
      return [];
    }
    return hourlyData.hourly.time.map((time, i) => ({
      timestamp: time,
      temperature: hourlyData.hourly.temperature_2m[i],
      humidity: hourlyData.hourly.relative_humidity_2m[i],
      windSpeed: hourlyData.hourly.wind_speed_10m[i],
      windSpeedMin: null, // Not available for hourly
      windSpeedMax: null, // Not available for hourly
      precipitation: hourlyData.hourly.precipitation[i],
    }));
  } else {
    const dailyData = data as OpenMeteoDailyResponse;
    if (!dailyData.daily?.time) {
      return [];
    }
    return dailyData.daily.time.map((time, i) => ({
      timestamp: time,
      temperature: dailyData.daily.temperature_2m_mean[i],
      humidity: dailyData.daily.relative_humidity_2m_mean[i],
      windSpeed: dailyData.daily.wind_speed_10m_max[i], // Keep max as main value
      windSpeedMin: dailyData.daily.wind_speed_10m_min[i],
      windSpeedMax: dailyData.daily.wind_speed_10m_max[i],
      precipitation: dailyData.daily.precipitation_sum[i],
    }));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const stationId = url.searchParams.get("stationId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const granularity = (url.searchParams.get("granularity") || "daily") as "hourly" | "daily";

    if (!stationId || !from || !to) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: stationId, from, to" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (from > to) {
      return new Response(
        JSON.stringify({ error: "from date must be before or equal to to date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (granularity !== "hourly" && granularity !== "daily") {
      return new Response(
        JSON.stringify({ error: "granularity must be 'hourly' or 'daily'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar máximo 31 días para datos horarios
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (granularity === "hourly" && daysDiff > 31) {
      return new Response(
        JSON.stringify({ error: "Maximum 31 days allowed for hourly granularity" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtener coordenadas de la estación
    const coords = STATION_COORDS[stationId];
    if (!coords) {
      return new Response(
        JSON.stringify({ error: `Unknown station: ${stationId}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar cache
    const cacheKey = `obs:${stationId}:${from}:${to}:${granularity}`;
    const cached = getCached<Observation[]>(cacheKey);
    if (cached) {
      console.log("Returning cached observations");
      return new Response(JSON.stringify({ data: cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Obtener datos de Open-Meteo
    const observations = await fetchFromOpenMeteo(coords.lat, coords.lon, from, to, granularity);
    setCache(cacheKey, observations);

    console.log(`Returning ${observations.length} observations`);

    return new Response(JSON.stringify({ data: observations, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in observations function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
