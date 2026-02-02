import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory cache with TTL
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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

// Meteostat API adapter - can be swapped for other providers
interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  distance: number;
}

interface MeteostatStation {
  id: string;
  name: { en: string };
  latitude: number;
  longitude: number;
  elevation: number | null;
  distance: number;
}

async function fetchStationsFromMeteostat(lat: number, lon: number, radiusKm: number): Promise<Station[]> {
  const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
  
  if (!RAPIDAPI_KEY) {
    console.error("RAPIDAPI_KEY not configured");
    throw new Error("API key not configured. Please add RAPIDAPI_KEY to secrets.");
  }

  const url = `https://meteostat.p.rapidapi.com/stations/nearby?lat=${lat}&lon=${lon}&limit=15`;
  
  console.log("Fetching stations from Meteostat:", url);
  
  const response = await fetch(url, {
    headers: {
      "x-rapidapi-host": "meteostat.p.rapidapi.com",
      "x-rapidapi-key": RAPIDAPI_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Meteostat API error:", response.status, errorText);
    throw new Error(`Meteostat API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("Meteostat response:", JSON.stringify(data).slice(0, 500));

  // Filter by radius and transform to normalized format
  const stations: Station[] = (data.data || [])
    .filter((s: MeteostatStation) => s.distance <= radiusKm * 1000) // API returns meters
    .map((s: MeteostatStation) => ({
      id: s.id,
      name: s.name?.en || s.name || s.id,
      latitude: s.latitude,
      longitude: s.longitude,
      elevation: s.elevation,
      distance: Math.round(s.distance / 100) / 10, // Convert to km with 1 decimal
    }));

  return stations;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const lat = parseFloat(url.searchParams.get("lat") || "41.3851");
    const lon = parseFloat(url.searchParams.get("lon") || "2.1734");
    const radiusKm = parseFloat(url.searchParams.get("radiusKm") || "50");

    // Validate parameters
    if (isNaN(lat) || isNaN(lon) || isNaN(radiusKm)) {
      return new Response(
        JSON.stringify({ error: "Invalid parameters. lat, lon, and radiusKm must be numbers." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache
    const cacheKey = `stations:${lat.toFixed(2)}:${lon.toFixed(2)}:${radiusKm}`;
    const cached = getCached<Station[]>(cacheKey);
    if (cached) {
      console.log("Returning cached stations");
      return new Response(JSON.stringify({ data: cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch from API
    const stations = await fetchStationsFromMeteostat(lat, lon, radiusKm);
    setCache(cacheKey, stations);

    return new Response(JSON.stringify({ data: stations, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in stations function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
