import {
  Hospital, GraduationCap, BookOpen, Train, Bus, Building2,
  ShoppingBag, Landmark, UtensilsCrossed, Camera, Trees, MapPin,
  Route as RouteIcon, Navigation,
} from 'lucide-react';

export const CATEGORY_META: Record<string, { Icon: typeof MapPin; color: string }> = {
  HOSPITALS: { Icon: Hospital, color: '#d64545' },
  SCHOOLS: { Icon: GraduationCap, color: '#3b82a4' },
  COLLEGES: { Icon: BookOpen, color: '#6b4ea3' },
  'METRO/RAILWAY': { Icon: Train, color: '#0f1e35' },
  'BUS STOPS': { Icon: Bus, color: '#2f7d4f' },
  'IT PARKS': { Icon: Building2, color: '#4a5a7a' },
  'SHOPPING AREAS': { Icon: ShoppingBag, color: '#c25e8a' },
  TEMPLES: { Icon: Landmark, color: '#b8954a' },
  RESTAURANTS: { Icon: UtensilsCrossed, color: '#c47a3d' },
  'TOURIST ATTRACTIONS': { Icon: Camera, color: '#7a5a3a' },
  'LAKES/PARKS': { Icon: Trees, color: '#4a8a4f' },
  LANDMARKS: { Icon: MapPin, color: '#0f1e35' },
  HIGHWAYS: { Icon: RouteIcon, color: '#555' },
  'MAIN ROADS': { Icon: Navigation, color: '#666' },
};

export const ROAD_FOCUS_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#f2b441' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#8a5a17' }, { weight: 1.5 }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#3a2a10' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#0f1e35' }, { weight: 1.2 }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#0f1e35' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ color: '#b8b2a3' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#6a6557' }] },
];

export const ROAD_TIER_STYLE: Record<'highway' | 'main' | 'local', { color: string; weight: number; opacity: number; zIndex: number }> = {
  highway: { color: '#ff6a1f', weight: 6, opacity: 0.95, zIndex: 30 },
  main: { color: '#1e7fd6', weight: 4, opacity: 0.85, zIndex: 20 },
  local: { color: '#6a6557', weight: 1.5, opacity: 0.35, zIndex: 10 },
};

export type SelectedPoi = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distanceKm: number;
};
