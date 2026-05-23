import type { LocationReport, POIItem } from '@/types';

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface LatLng {
  lat: number;
  lng: number;
}

interface XY {
  x: number;
  y: number;
}

function latToMercator(lat: number): number {
  const clamped = Math.max(Math.min(lat, 85.05112878), -85.05112878);
  return Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
}

export function projectToSVG(
  lat: number,
  lng: number,
  bbox: BoundingBox,
  canvasW: number,
  canvasH: number,
): XY {
  const lngSpan = bbox.maxLng - bbox.minLng || 1e-9;
  const x = ((lng - bbox.minLng) / lngSpan) * canvasW;

  const mMin = latToMercator(bbox.minLat);
  const mMax = latToMercator(bbox.maxLat);
  const m = latToMercator(lat);
  const mSpan = mMax - mMin || 1e-9;
  // SVG y increases downward, so invert
  const y = (1 - (m - mMin) / mSpan) * canvasH;

  return { x, y };
}

export function expandBBox(bbox: BoundingBox, fraction = 0.25): BoundingBox {
  const latSpan = bbox.maxLat - bbox.minLat;
  const lngSpan = bbox.maxLng - bbox.minLng;
  const latPad = (latSpan || 0.01) * fraction;
  const lngPad = (lngSpan || 0.01) * fraction;
  return {
    minLat: bbox.minLat - latPad,
    maxLat: bbox.maxLat + latPad,
    minLng: bbox.minLng - lngPad,
    maxLng: bbox.maxLng + lngPad,
  };
}

export function computeBBoxFromReport(report: LocationReport): BoundingBox {
  const points: LatLng[] = [{ lat: report.site.lat, lng: report.site.lng }];
  for (const g of report.pois) {
    for (const it of g.items) points.push({ lat: it.lat, lng: it.lng });
  }
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return expandBBox({ minLat, maxLat, minLng, maxLng });
}

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = encoded.length;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  return points;
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

export function simplifyPoints(points: LatLng[], tolerance = 0.0001): LatLng[] {
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

export function pointsToSVGPath(
  points: LatLng[],
  bbox: BoundingBox,
  canvasW: number,
  canvasH: number,
): string {
  if (points.length === 0) return '';
  const parts: string[] = [];
  points.forEach((p, i) => {
    const { x, y } = projectToSVG(p.lat, p.lng, bbox, canvasW, canvasH);
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  });
  return parts.join(' ');
}

export interface LabelPlacement {
  poi: POIItem;
  pinX: number;
  pinY: number;
  labelX: number;
  labelY: number;
  quadrant: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function computeLabelPositions(
  pois: POIItem[],
  sitePos: XY,
  canvasW: number,
  canvasH: number,
  bbox?: BoundingBox,
): LabelPlacement[] {
  const margin = 24;
  const lineHeight = 30;

  // Need bbox to project POIs; if not provided, derive from POI lat/lng extents
  const bb: BoundingBox =
    bbox ??
    (() => {
      let minLat = pois[0]?.lat ?? 0;
      let maxLat = minLat;
      let minLng = pois[0]?.lng ?? 0;
      let maxLng = minLng;
      for (const p of pois) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      }
      return expandBBox({ minLat, maxLat, minLng, maxLng });
    })();

  const projected = pois.map((poi) => {
    const { x, y } = projectToSVG(poi.lat, poi.lng, bb, canvasW, canvasH);
    const isLeft = x < sitePos.x;
    const isTop = y < sitePos.y;
    const quadrant: LabelPlacement['quadrant'] = isTop
      ? isLeft
        ? 'top-left'
        : 'top-right'
      : isLeft
        ? 'bottom-left'
        : 'bottom-right';
    return { poi, pinX: x, pinY: y, quadrant };
  });

  const buckets: Record<LabelPlacement['quadrant'], typeof projected> = {
    'top-left': [],
    'top-right': [],
    'bottom-left': [],
    'bottom-right': [],
  };
  for (const p of projected) buckets[p.quadrant].push(p);

  const placements: LabelPlacement[] = [];
  (Object.keys(buckets) as Array<LabelPlacement['quadrant']>).forEach((q) => {
    const items = buckets[q].sort((a, b) => a.poi.distanceKm - b.poi.distanceKm);
    const isTop = q.startsWith('top');
    const isLeft = q.endsWith('left');
    const labelX = isLeft ? margin : canvasW - margin;
    items.forEach((it, i) => {
      const labelY = isTop ? margin + i * lineHeight : canvasH - margin - i * lineHeight;
      placements.push({
        poi: it.poi,
        pinX: it.pinX,
        pinY: it.pinY,
        labelX,
        labelY,
        quadrant: q,
      });
    });
  });

  return placements;
}
