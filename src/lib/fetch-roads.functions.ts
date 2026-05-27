import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { simplifyPoints } from '@/lib/brochure/engine';
import type { RoadSegment } from '@/types';

const bboxSchema = z.object({
  bbox: z.object({
    minLat: z.number().min(-90).max(90),
    maxLat: z.number().min(-90).max(90),
    minLng: z.number().min(-180).max(180),
    maxLng: z.number().min(-180).max(180),
  }),
});

type Tier = RoadSegment['tier'];
function classify(highway: string): Tier | null {
  if (/^(motorway|trunk|primary)/.test(highway)) return 'highway';
  if (/^(secondary|tertiary)/.test(highway)) return 'main';
  if (highway === 'residential') return 'local';
  return null;
}

export const fetchRoads = createServerFn({ method: 'POST' })
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
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        console.error('Overpass error', res.status, await res.text());
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
        if (el.type !== 'way' || !el.geometry || !el.tags?.highway) continue;
        const tier = classify(el.tags.highway);
        if (!tier) continue;
        const points = el.geometry.map((g) => ({ lat: g.lat, lng: g.lon }));
        const simplified = simplifyPoints(points, 0.00015);
        if (simplified.length < 2) continue;
        segs.push({ tier, name: el.tags.name ?? '', points: simplified });
      }

      // Prioritize highways/main, cap at 50
      const order: Record<Tier, number> = { highway: 0, main: 1, local: 2 };
      segs.sort((a, b) => order[a.tier] - order[b.tier]);
      return segs.slice(0, 50);
    } catch (err) {
      console.error('fetchRoads failed:', err);
      return [];
    }
  });
