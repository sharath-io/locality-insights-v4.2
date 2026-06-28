export type HighwayInfo = {
  ref: string;
  name: string;
  distanceKm: number;
  /** Exact lat/lng of the closest physical point on this highway to the site */
  closestPoint: { lat: number; lng: number };
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Returns both the distance and the closest projected point on the segment */
export function closestPointOnSegment(
  lat: number, lng: number,
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): { distanceKm: number; point: { lat: number; lng: number } } {
  const cosLat = Math.cos((lat * Math.PI) / 180);

  const dx = (lng2 - lng1) * cosLat;
  const dy = lat2 - lat1;
  const l2 = dx * dx + dy * dy;

  if (l2 === 0) {
    return {
      distanceKm: haversineKm(lat, lng, lat1, lng1),
      point: { lat: lat1, lng: lng1 },
    };
  }

  let t = (((lng - lng1) * cosLat) * dx + (lat - lat1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));

  const projLng = lng1 + t * (lng2 - lng1);
  const projLat = lat1 + t * (lat2 - lat1);

  return {
    distanceKm: haversineKm(lat, lng, projLat, projLng),
    point: { lat: projLat, lng: projLng },
  };
}

export async function fetchNearestHighways(lat: number, lng: number): Promise<HighwayInfo[]> {
  // Query Overpass for trunk/motorway roads with a ref tag within 25km
  const query = `
[out:json][timeout:15];
(
  way["highway"~"^(motorway|trunk)$"]["ref"](around:25000,${lat},${lng});
);
out geom;
`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!res.ok) return [];
    const json = await res.json() as { elements: Array<{ tags?: { ref?: string; name?: string }; geometry?: Array<{ lat: number; lon: number }> }> };

    const highwaysMap = new Map<string, HighwayInfo>();

    for (const el of json.elements) {
      if (!el.geometry || !el.tags?.ref) continue;

      let minDist = Infinity;
      let bestPoint: { lat: number; lng: number } = { lat: el.geometry[0].lat, lng: el.geometry[0].lon };

      if (el.geometry.length === 1) {
        minDist = haversineKm(lat, lng, el.geometry[0].lat, el.geometry[0].lon);
        bestPoint = { lat: el.geometry[0].lat, lng: el.geometry[0].lon };
      } else {
        for (let i = 0; i < el.geometry.length - 1; i++) {
          const p1 = el.geometry[i];
          const p2 = el.geometry[i + 1];
          const { distanceKm, point } = closestPointOnSegment(lat, lng, p1.lat, p1.lon, p2.lat, p2.lon);
          if (distanceKm < minDist) {
            minDist = distanceKm;
            bestPoint = point;
          }
        }
      }

      const ref = el.tags.ref;

      if (!highwaysMap.has(ref) || minDist < highwaysMap.get(ref)!.distanceKm) {
        highwaysMap.set(ref, {
          ref,
          name: el.tags.name ?? ref,
          distanceKm: +minDist.toFixed(1),
          closestPoint: bestPoint,
        });
      }
    }

    return Array.from(highwaysMap.values())
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
  } catch {
    return [];
  }
}
