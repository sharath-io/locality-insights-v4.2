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
  // 1 degree of latitude is ~111.32 km
  // Calculate bounding box for a 25km square radius to optimize Overpass DB performance
  const latDelta = 25 / 111.32;
  const lngDelta = 25 / (111.32 * Math.cos((lat * Math.PI) / 180));

  const minLat = (lat - latDelta).toFixed(5);
  const maxLat = (lat + latDelta).toFixed(5);
  const minLng = (lng - lngDelta).toFixed(5);
  const maxLng = (lng + lngDelta).toFixed(5);

  // Use [bbox:south,west,north,east] instead of (around:...)
  // This uses spatial indexes and is significantly faster, allowing a 10s timeout
  const query = `
[out:json][timeout:10][bbox:${minLat},${minLng},${maxLat},${maxLng}];
way["highway"~"^(motorway|trunk)$"]["ref"];
out body geom;
`;
  const endpoints = [
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];

  let json: any = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: `data=${encodeURIComponent(query.trim())}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        // Overpass often returns 200 OK but embeds runtime errors in the 'remark' field.
        if (data.remark) {
          console.warn(`Overpass API embedded error on ${endpoint}:`, data.remark);
          // Server returned an error (e.g. timeout), so we DO NOT break. We try the next endpoint!
        } else if (data.elements) {
          json = data;
          break; // Successfully fetched without errors, exit loop
        }
      } else {
        console.warn(`Overpass API failed on ${endpoint}:`, res.status, res.statusText);
      }
    } catch (e) {
      console.warn(`Overpass API fetch error on ${endpoint}:`, e);
    }
  }

  if (!json || !json.elements) {
    console.error("All Overpass API endpoints failed.");
    return [];
  }

    const highwaysMap = new Map<string, HighwayInfo>();

    for (const el of json.elements) {
      const refOrName = el.tags?.ref;
      if (!el.geometry || !refOrName) continue;

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

      const displayRef = el.tags?.ref || "Highway";
      const displayName = el.tags?.name || displayRef;

      if (!highwaysMap.has(refOrName) || minDist < highwaysMap.get(refOrName)!.distanceKm) {
        highwaysMap.set(refOrName, {
          ref: displayRef,
          name: displayName,
          distanceKm: +minDist.toFixed(1),
          closestPoint: bestPoint,
        });
      }
    }

    return Array.from(highwaysMap.values())
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
}

