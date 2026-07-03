const lat = 17.4182004;
const lng = 78.378889;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function closestPointOnSegment(lat, lng, lat1, lng1, lat2, lng2) {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dx = (lng2 - lng1) * cosLat;
  const dy = lat2 - lat1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return { distanceKm: haversineKm(lat, lng, lat1, lng1), point: { lat: lat1, lng: lng1 } };
  let t = (((lng - lng1) * cosLat) * dx + (lat - lat1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projLng = lng1 + t * (lng2 - lng1);
  const projLat = lat1 + t * (lat2 - lat1);
  return { distanceKm: haversineKm(lat, lng, projLat, projLng), point: { lat: projLat, lng: projLng } };
}

const query = `
[out:json][timeout:25];
(
  way["highway"~"^(motorway|trunk)$"]["ref"](around:15000,${lat},${lng});
  way["highway"~"^(motorway|trunk)$"]["name"](around:15000,${lat},${lng});
);
out body geom;
`;

fetch("https://overpass.kumi.systems/api/interpreter", {
  method: "POST",
  body: `data=${encodeURIComponent(query.trim())}`,
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "LocalityInsightsApp/1.0"
  }
}).then(r => r.json()).then(json => {
  const highwaysMap = new Map();
  for (const el of json.elements) {
    const refOrName = el.tags?.ref || el.tags?.name;
    if (!el.geometry || !refOrName) continue;
    let minDist = Infinity;
    let bestPoint = { lat: el.geometry[0].lat, lng: el.geometry[0].lon };
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
    const displayRef = el.tags?.ref || el.tags?.name || "Highway";
    const displayName = el.tags?.name || displayRef;
    if (!highwaysMap.has(refOrName) || minDist < highwaysMap.get(refOrName).distanceKm) {
      highwaysMap.set(refOrName, {
        ref: displayRef,
        name: displayName,
        distanceKm: +minDist.toFixed(1),
        closestPoint: bestPoint,
      });
    }
  }
  const result = Array.from(highwaysMap.values())
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5);
  console.log("Top 5 Highways for 1acre-office:");
  console.log(result);
}).catch(console.error);
