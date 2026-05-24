import {
  Hospital, GraduationCap, BookOpen, Train, Bus, Building2,
  ShoppingBag, Landmark, UtensilsCrossed, Camera, Trees, MapPin,
  Route as RouteIcon, Navigation,
} from 'lucide-react';

export const CATEGORY_META: Record<string, { Icon: typeof MapPin; color: string }> = {
  HOSPITALS: { Icon: Hospital, color: '#E53935' },
  SCHOOLS: { Icon: GraduationCap, color: '#7E57C2' },
  COLLEGES: { Icon: BookOpen, color: '#7E57C2' },
  'METRO/RAILWAY': { Icon: Train, color: '#3949AB' },
  'BUS STOPS': { Icon: Bus, color: '#3949AB' },
  'IT PARKS': { Icon: Building2, color: '#1E88E5' },
  'SHOPPING AREAS': { Icon: ShoppingBag, color: '#EC407A' },
  TEMPLES: { Icon: Landmark, color: '#F4B400' },
  RESTAURANTS: { Icon: UtensilsCrossed, color: '#EC407A' },
  'TOURIST ATTRACTIONS': { Icon: Camera, color: '#F4B400' },
  'LAKES/PARKS': { Icon: Trees, color: '#43A047' },
  LANDMARKS: { Icon: MapPin, color: '#3949AB' },
  HIGHWAYS: { Icon: RouteIcon, color: '#555' },
  'MAIN ROADS': { Icon: Navigation, color: '#666' },
};

export const ROAD_FOCUS_STYLES: google.maps.MapTypeStyle[] = [
  // Desaturate base map so overlays dominate
  { elementType: 'geometry', stylers: [{ saturation: -55 }, { lightness: 8 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  // Suppress noisy base POI labels and icons
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#e6ece0' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f3efe7' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfdce6' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#7a7568' }] },
  // Roads: emphasize majors
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#f2b441' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#8a5a17' }, { weight: 1.8 }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#3a2a10' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#0f1e35' }, { weight: 1.3 }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#0f1e35' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ color: '#c8c2b3' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#8a8576' }] },
];

export const ROAD_TIER_STYLE: Record<'highway' | 'main' | 'local', { color: string; weight: number; opacity: number; zIndex: number }> = {
  highway: { color: '#ff6a1f', weight: 6, opacity: 0.95, zIndex: 30 },
  main: { color: '#1e7fd6', weight: 4, opacity: 0.85, zIndex: 20 },
  local: { color: '#6a6557', weight: 1.5, opacity: 0.35, zIndex: 10 },
};

// Premium, editorial-grade base style for the brochure export canvas.
export const BROCHURE_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ saturation: -75 }, { lightness: 18 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f0e8' }, { weight: 3 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6a6557' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f0e8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e3e8d8' }, { visibility: 'on' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cdd9e3' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#e8c07a' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#8a5a17' }, { weight: 1.6 }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#b8b0a0' }, { weight: 1 }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#fbfaf6' }] },
  { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
];

// Concentric proximity rings around the SITE (rendered as google.maps.Circle).
export const DISTANCE_RINGS: Array<{ km: number; color: string; opacity: number; weight: number }> = [
  { km: 1, color: '#b8954a', opacity: 0.55, weight: 1.2 },
  { km: 3, color: '#b8954a', opacity: 0.35, weight: 1 },
  { km: 5, color: '#b8954a', opacity: 0.2, weight: 1 },
];

export type SelectedPoi = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distanceKm: number;
};
