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

// Normalized observation data format
interface Observation {
  timestamp: string; // ISO 8601
  temperature: number | null; // Celsius
  humidity: number | null; // Percentage
  windSpeed: number | null; // km/h
}

interface MeteostatHourlyData {
  time: string;
  temp: number | null;
  rhum: number | null;
  wspd: number | null;
}

interface MeteostatDailyData {
  date: string;
  tavg: number | null;
  tmin: number | null;
  tmax: number | null;
  rhum: number | null;
  wspd: number | null;
}

async function fetchObservationsFromMeteostat(
  stationId: string,
  from: string,
  to: string,
  granularity: "hourly" | "daily"
): Promise<Observation[]> {
  const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
  
  if (!RAPIDAPI_KEY) {
    console.error("RAPIDAPI_KEY not configured");
    throw new Error("API key not configured. Please add RAPIDAPI_KEY to secrets.");
  }

  const endpoint = granularity === "hourly" ? "hourly" : "daily";
  const url = `https://meteostat.p.rapidapi.com/stations/${endpoint}?station=${stationId}&start=${from}&end=${to}&tz=Europe/Madrid`;
  
  console.log("Fetching observations from Meteostat:", url);
  
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
  console.log("Meteostat response data count:", data.data?.length || 0);

  // Transform to normalized format
  if (granularity === "hourly") {
    return (data.data || []).map((d: MeteostatHourlyData) => ({
      timestamp: d.time,
      temperature: d.temp,
      humidity: d.rhum,
      windSpeed: d.wspd,
    }));
  } else {
    return (data.data || []).map((d: MeteostatDailyData) => ({
      timestamp: d.date,
      temperature: d.tavg,
      humidity: d.rhum,
      windSpeed: d.wspd,
    }));
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const stationId = url.searchParams.get("stationId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const granularity = (url.searchParams.get("granularity") || "daily") as "hourly" | "daily";

    // Validate required parameters
    if (!stationId || !from || !to) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: stationId, from, to" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate from <= to
    if (from > to) {
      return new Response(
        JSON.stringify({ error: "from date must be before or equal to to date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate granularity
    if (granularity !== "hourly" && granularity !== "daily") {
      return new Response(
        JSON.stringify({ error: "granularity must be 'hourly' or 'daily'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate max 31 days for hourly data
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (granularity === "hourly" && daysDiff > 31) {
      return new Response(
        JSON.stringify({ error: "Maximum 31 days allowed for hourly granularity" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache
    const cacheKey = `obs:${stationId}:${from}:${to}:${granularity}`;
    const cached = getCached<Observation[]>(cacheKey);
    if (cached) {
      console.log("Returning cached observations");
      return new Response(JSON.stringify({ data: cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch from API
    const observations = await fetchObservationsFromMeteostat(stationId, from, to, granularity);
    setCache(cacheKey, observations);

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
