export interface POIItem {
  id: string;
  name: string;
  category: string;
  distance: number; // meters
  duration?: number; // seconds
  rating?: number;
  address?: string;
  lat: number;
  lng: number;
}

export interface POICategory {
  id: string;
  name: string;
  icon: string;
  items: POIItem[];
}

export interface RoadSegment {
  id: string;
  name: string;
  type: 'highway' | 'main' | 'arterial';
  distance: number;
  geometry?: Array<{ lat: number; lng: number }>;
}

export interface LocationReport {
  coordinates: { lat: number; lng: number };
  address?: string;
  generatedAt: string;
  categories: POICategory[];
  roads: RoadSegment[];
}
