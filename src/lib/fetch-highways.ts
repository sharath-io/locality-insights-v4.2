export type HighwayInfo = { ref: string; name: string; distanceKm: number };

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

export function distanceToSegmentKm(lat: number, lng: number, lat1: number, lng1: number, lat2: number, lng2: number): number {
  const x = lng;
  const y = lat;
  const x1 = lng1;
  const y1 = lat1;
  const x2 = lng2;
  const y2 = lat2;
  
  // Scale longitude by cos(lat) to approximate local flat geometry
  const cosLat = Math.cos((y * Math.PI) / 180);
  
  const dx = (x2 - x1) * cosLat;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  
  if (l2 === 0) return haversineKm(y, x, y1, x1);
  
  // Projection factor t
  let t = (((x - x1) * cosLat) * dx + (y - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  
  return haversineKm(y, x, projY, projX);
}

export async function fetchNearestHighways(lat: number, lng: number): Promise<HighwayInfo[]> {
  // Query Overpass for trunk/motorway/primary roads with a ref tag within 25km
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
      if (el.geometry.length === 1) {
        minDist = haversineKm(lat, lng, el.geometry[0].lat, el.geometry[0].lon);
      } else {
        for (let i = 0; i < el.geometry.length - 1; i++) {
          const p1 = el.geometry[i];
          const p2 = el.geometry[i+1];
          const dist = distanceToSegmentKm(lat, lng, p1.lat, p1.lon, p2.lat, p2.lon);
          if (dist < minDist) minDist = dist;
        }
      }
      
      const ref = el.tags.ref;
      
      if (!highwaysMap.has(ref) || minDist < highwaysMap.get(ref)!.distanceKm) {
        highwaysMap.set(ref, {
          ref,
          name: el.tags.name ?? ref,
          distanceKm: +minDist.toFixed(1),
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
