import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Estaciones meteorológicas predefinidas en/cerca de Barcelona
// Basadas en ubicaciones reales de AEMET y Servei Meteorològic de Catalunya
const BARCELONA_STATIONS = [
  {
    id: "bcn-raval",
    name: "Barcelona - El Raval",
    latitude: 41.3797,
    longitude: 2.1682,
    elevation: 33,
  },
  {
    id: "bcn-zoo",
    name: "Barcelona - Zona Universitària",
    latitude: 41.3870,
    longitude: 2.1130,
    elevation: 85,
  },
  {
    id: "bcn-fabra",
    name: "Observatori Fabra",
    latitude: 41.4184,
    longitude: 2.1239,
    elevation: 411,
  },
  {
    id: "bcn-port",
    name: "Barcelona - Port Olímpic",
    latitude: 41.3850,
    longitude: 2.2010,
    elevation: 5,
  },
  {
    id: "bcn-eixample",
    name: "Barcelona - Eixample",
    latitude: 41.3930,
    longitude: 2.1620,
    elevation: 45,
  },
  {
    id: "bcn-gracia",
    name: "Barcelona - Gràcia",
    latitude: 41.4036,
    longitude: 2.1532,
    elevation: 120,
  },
  {
    id: "bcn-airport",
    name: "Aeropuerto El Prat",
    latitude: 41.2974,
    longitude: 2.0833,
    elevation: 4,
  },
  {
    id: "badalona",
    name: "Badalona",
    latitude: 41.4500,
    longitude: 2.2474,
    elevation: 20,
  },
  {
    id: "hospitalet",
    name: "L'Hospitalet de Llobregat",
    latitude: 41.3596,
    longitude: 2.1000,
    elevation: 25,
  },
  {
    id: "sant-cugat",
    name: "Sant Cugat del Vallès",
    latitude: 41.4722,
    longitude: 2.0864,
    elevation: 180,
  },
  {
    id: "montjuic",
    name: "Barcelona - Montjuïc",
    latitude: 41.3639,
    longitude: 2.1586,
    elevation: 173,
  },
  {
    id: "tibidabo",
    name: "Barcelona - Tibidabo",
    latitude: 41.4225,
    longitude: 2.1189,
    elevation: 512,
  },
];

// Calcular distancia usando fórmula de Haversine
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const lat = parseFloat(url.searchParams.get("lat") || "41.3851");
    const lon = parseFloat(url.searchParams.get("lon") || "2.1734");
    const radiusKm = parseFloat(url.searchParams.get("radiusKm") || "50");

    if (isNaN(lat) || isNaN(lon) || isNaN(radiusKm)) {
      return new Response(
        JSON.stringify({ error: "Invalid parameters. lat, lon, and radiusKm must be numbers." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calcular distancia y filtrar por radio
    const stations = BARCELONA_STATIONS
      .map(station => ({
        ...station,
        distance: calculateDistance(lat, lon, station.latitude, station.longitude),
      }))
      .filter(station => station.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    console.log(`Returning ${stations.length} stations within ${radiusKm}km of (${lat}, ${lon})`);

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
