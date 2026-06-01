import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { RoadSegment } from "@/types";

interface LatLng {
  lat: number;
  lng: number;
}

function perpendicularDistance(p: LatLng, a: LatLng, b: LatLng): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) {
    const ex = p.lng - a.lng;
    const ey = p.lat - a.lat;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const num = Math.abs(dy * p.lng - dx * p.lat + b.lng * a.lat - b.lat * a.lng);
  const den = Math.sqrt(dx * dx + dy * dy);
  return num / den;
}

function simplifyPoints(points: LatLng[], tolerance = 0.0001): LatLng[] {
  if (points.length < 3) return points.slice();

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDist = 0;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(points[i], points[first], points[last]);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxDist > tolerance) {
      keep[idx] = true;
      stack.push([first, idx]);
      stack.push([idx, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

const bboxSchema = z.object({
  bbox: z.object({
    minLat: z.number().min(-90).max(90),
    maxLat: z.number().min(-90).max(90),
    minLng: z.number().min(-180).max(180),
    maxLng: z.number().min(-180).max(180),
  }),
});

type Tier = RoadSegment["tier"];
function classify(highway: string): Tier | null {
  if (/^(motorway|trunk|primary)/.test(highway)) return "highway";
  if (/^(secondary|tertiary)/.test(highway)) return "main";
  if (highway === "residential") return "local";
  return null;
}

export const fetchRoads = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bboxSchema.parse(input))
  .handler(async ({ data }): Promise<RoadSegment[]> => {
    const { minLat: s, maxLat: n, minLng: w, maxLng: e } = data.bbox;
    const query = `[out:json][timeout:25];
(
  way["highway"~"motorway|trunk|primary"](${s},${w},${n},${e});
  way["highway"~"secondary|tertiary"](${s},${w},${n},${e});
  way["highway"="residential"](${s},${w},${n},${e});
);
out geom;`;

    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        console.error("Overpass error", res.status, await res.text());
        return [];
      }
      const json = (await res.json()) as {
        elements?: Array<{
          type: string;
          tags?: { highway?: string; name?: string };
          geometry?: Array<{ lat: number; lon: number }>;
        }>;
      };

      const segs: RoadSegment[] = [];
      for (const el of json.elements ?? []) {
        if (el.type !== "way" || !el.geometry || !el.tags?.highway) continue;
        const tier = classify(el.tags.highway);
        if (!tier) continue;
        const points = el.geometry.map((g) => ({ lat: g.lat, lng: g.lon }));
        const simplified = simplifyPoints(points, 0.00015);
        if (simplified.length < 2) continue;
        segs.push({ tier, name: el.tags.name ?? "", points: simplified });
      }

      // Prioritize highways/main, cap at 50
      const order: Record<Tier, number> = { highway: 0, main: 1, local: 2 };
      segs.sort((a, b) => order[a.tier] - order[b.tier]);
      return segs.slice(0, 50);
    } catch (err) {
      console.error("fetchRoads failed:", err);
      return [];
    }
  });
