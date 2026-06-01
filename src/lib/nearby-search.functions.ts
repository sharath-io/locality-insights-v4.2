import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LocationReport, POIGroup, POIItem, BBox } from "@/types";

const CATEGORY_TO_TYPE: Record<string, string> = {
  HOSPITALS: "hospital",
  SCHOOLS: "school",
  COLLEGES: "university",
  "METRO/RAILWAY": "subway_station",
  "BUS STOPS": "bus_station",
  "IT PARKS": "accounting",
  "SHOPPING AREAS": "shopping_mall",
  TEMPLES: "hindu_temple",
  RESTAURANTS: "restaurant",
  "TOURIST ATTRACTIONS": "tourist_attraction",
  "LAKES/PARKS": "park",
  LANDMARKS: "museum",
  HIGHWAYS: "gas_station",
  "MAIN ROADS": "transit_station",
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const inputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  categories: z.array(z.string().min(1).max(64)).min(1).max(20),
  radiusMeters: z.number().min(100).max(50000),
});

export const nearbySearch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<LocationReport> => {
    const apiKey = process.env.GOOGLE_PLACES_KEY;
    const { lat, lng, categories, radiusMeters } = data;
    console.log("SERVER: nearbySearch handler called.");
    console.log("SERVER: Coordinates:", lat, lng);
    console.log("SERVER: Categories:", categories);
    console.log("SERVER: API Key defined:", !!apiKey);
    if (!apiKey) throw new Error("GOOGLE_PLACES_KEY not configured");

    const groups: POIGroup[] = await Promise.all(
      categories.map(async (cat) => {
        const mappedType = CATEGORY_TO_TYPE[cat];
        if (!mappedType) return { type: cat, items: [] as POIItem[] };

        try {
          const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": "places.displayName,places.location,places.rating,places.types",
            },
            body: JSON.stringify({
              locationRestriction: {
                circle: {
                  center: { latitude: lat, longitude: lng },
                  radius: radiusMeters,
                },
              },
              includedTypes: [mappedType],
              maxResultCount: 5,
            }),
          });

          if (!res.ok) {
            console.error(`Places API error for ${cat}:`, res.status, await res.text());
            return { type: cat, items: [] };
          }

          const json = (await res.json()) as {
            places?: Array<{
              displayName?: { text?: string };
              location?: { latitude: number; longitude: number };
              rating?: number;
            }>;
          };

          const items: POIItem[] = (json.places ?? [])
            .filter((p) => p.location)
            .map((p) => {
              const pLat = p.location!.latitude;
              const pLng = p.location!.longitude;
              const distanceKm = +haversineKm(lat, lng, pLat, pLng).toFixed(2);
              return {
                name: p.displayName?.text ?? "Unknown",
                lat: pLat,
                lng: pLng,
                rating: p.rating,
                distanceKm,
                minutesDrive: Math.max(1, Math.round(distanceKm / 0.5)),
              };
            });

          if (items.length === 0) {
            console.log(
              `SERVER: 0 items for ${cat}. Response:`,
              JSON.stringify(json).slice(0, 500),
            );
          }

          return { type: cat, items };
        } catch (err) {
          console.error(`SERVER: Failed category ${cat}:`, err);
          return { type: cat, items: [] };
        }
      }),
    );

    // Build bbox encompassing site + all POIs with 20% padding
    let minLat = lat;
    let maxLat = lat;
    let minLng = lng;
    let maxLng = lng;
    for (const g of groups) {
      for (const it of g.items) {
        if (it.lat < minLat) minLat = it.lat;
        if (it.lat > maxLat) maxLat = it.lat;
        if (it.lng < minLng) minLng = it.lng;
        if (it.lng > maxLng) maxLng = it.lng;
      }
    }
    const latPad = Math.max((maxLat - minLat) * 0.2, 0.005);
    const lngPad = Math.max((maxLng - minLng) * 0.2, 0.005);
    const bbox: BBox = {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLng: minLng - lngPad,
      maxLng: maxLng + lngPad,
    };

    const totalPlaces = groups.reduce((n, g) => n + g.items.length, 0);
    console.log("SERVER: Total places found: ", totalPlaces);

    return {
      site: { lat, lng, label: "Site Location" },
      pois: groups,
      bbox,
      reportId: crypto.randomUUID(),
    };
  });

export const getMapKeys = createServerFn({ method: "GET" }).handler(async () => {
  return {
    googleMapsKey: process.env.GOOGLE_MAPS_BROWSER_KEY ?? "",
    mapboxToken: process.env.MAPBOX_TOKEN ?? "",
  };
});
