export interface POIItem {
  name: string;
  distanceKm: number;
  minutesDrive: number;
  lat: number;
  lng: number;
  rating?: number;
}

export interface POIGroup {
  type: string; // category label e.g. "HOSPITALS"
  items: POIItem[];
}

export interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface LocationReport {
  site: { lat: number; lng: number; label: string };
  pois: POIGroup[];
  bbox: BBox;
  reportId: string;
}

export interface RoadSegment {
  tier: 'highway' | 'main' | 'local';
  name: string;
  points: Array<{ lat: number; lng: number }>;
}
