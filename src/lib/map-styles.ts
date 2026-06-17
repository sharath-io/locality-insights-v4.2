import {
  Hospital,
  GraduationCap,
  Train,
  Building2,
  ShoppingBag,
  Landmark,
  UtensilsCrossed,
  Camera,
  MapPin,
  Route as RouteIcon,
  Navigation,
  Trees,
  BookOpen,
  Bus,
  Fuel,
  Briefcase,
  ShoppingCart,
  Dumbbell,
  Pill,
  Coffee,
  Banknote,
  Clapperboard,
} from "lucide-react";

export const CATEGORY_META: Record<string, { Icon: typeof MapPin; color: string }> = {
  // ── Existing Core Categories ──────────────────────────────────────────────
  HOSPITALS:          { Icon: Hospital,        color: "#E53935" },
  EDUCATION:          { Icon: GraduationCap,   color: "#7E57C2" },
  "PUBLIC TRANSIT":   { Icon: Train,           color: "#3949AB" },
  "SHOPPING AREAS":   { Icon: ShoppingBag,     color: "#EC407A" },
  TEMPLES:            { Icon: Landmark,        color: "#F4B400" },
  RESTAURANTS:        { Icon: UtensilsCrossed, color: "#FF7043" },
  ATTRACTIONS:        { Icon: Camera,          color: "#43A047" },
  "PETROL PUMPS":     { Icon: Fuel,            color: "#f59e0b" },
  "BUSINESS HUBS":    { Icon: Briefcase,       color: "#00897B" },
  // ── New Lifestyle & Convenience Categories ────────────────────────────────
  SUPERMARKETS:       { Icon: ShoppingCart,    color: "#0288D1" },
  "FITNESS CENTERS":  { Icon: Dumbbell,        color: "#E91E63" },
  PHARMACIES:         { Icon: Pill,            color: "#26A69A" },
  CAFES:              { Icon: Coffee,          color: "#795548" },
  "BANKS & ATMs":     { Icon: Banknote,        color: "#558B2F" },
  ENTERTAINMENT:      { Icon: Clapperboard,    color: "#8E24AA" },
};

export function resolvePoiMeta(type: string, types?: string[]): { Icon: typeof MapPin; color: string } {
  if (type === "ATTRACTIONS" && types) {
    if (types.includes("park")) return { Icon: Trees, color: "#43A047" };
    if (types.includes("museum")) return { Icon: Landmark, color: "#43A047" };
    return { Icon: Camera, color: "#43A047" }; // View Point / default
  }
  if (type === "EDUCATION" && types) {
    if (types.includes("school") || types.includes("secondary_school") || types.includes("primary_school")) return { Icon: BookOpen, color: "#7E57C2" };
    return { Icon: GraduationCap, color: "#7E57C2" }; // University / default
  }
  if (type === "PUBLIC TRANSIT" && types) {
    if (types.includes("bus_station")) return { Icon: Bus, color: "#3949AB" };
    return { Icon: Train, color: "#3949AB" }; // Subway / Train / default
  }
  return CATEGORY_META[type] ?? { Icon: MapPin, color: "#666" };
}



// Concentric proximity rings around the SITE (rendered as google.maps.Circle).
export const DISTANCE_RINGS: Array<{ km: number; color: string; opacity: number; weight: number }> =
  [
    { km: 1, color: "#b8954a", opacity: 0.55, weight: 1.2 },
    { km: 3, color: "#b8954a", opacity: 0.35, weight: 1 },
    { km: 5, color: "#b8954a", opacity: 0.2, weight: 1 },
  ];

export type SelectedPoi = {
  id: string;
  name: string;
  type: string;
  types?: string[];
  lat: number;
  lng: number;
  distanceKm: number;
};
