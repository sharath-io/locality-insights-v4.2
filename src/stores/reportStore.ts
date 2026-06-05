import { create } from "zustand";
import type { LocationReport } from "@/types";

export type SelectedPoiEntry = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distanceKm: number;
};


interface ReportState {
  inputUrl: string;
  coordinates: { lat: number; lng: number } | null;
  selectedCategories: string[];
  locationReport: LocationReport | null;
  isGenerating: boolean;
  mapProvider: "google" | "mapbox";
  /** Multiple selected POIs per category type (key = category string, value = array) */
  selectedPois: Record<string, SelectedPoiEntry[]>;
  /** Full data of the POI card currently being hovered (for temp map preview) */
  hoveredPoi: SelectedPoiEntry | null;

  setInputUrl: (v: string) => void;
  setCoordinates: (v: { lat: number; lng: number } | null) => void;
  setSelectedCategories: (v: string[]) => void;
  setLocationReport: (v: LocationReport | null) => void;
  setIsGenerating: (v: boolean) => void;
  setMapProvider: (v: "google" | "mapbox") => void;
  /** Toggle a POI selection within its category (add if not present, remove if already selected) */
  togglePoi: (poi: SelectedPoiEntry) => void;
  /** Deselect all POIs for a given category */
  clearCategory: (categoryType: string) => void;
  setHoveredPoi: (poi: SelectedPoiEntry | null) => void;
  /** Wipe all analysis data (called when leaving the analysis page) */
  resetAnalysis: () => void;
  activeMapStyleId: string;
  setActiveMapStyleId: (id: string) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  inputUrl: "",
  coordinates: null,
  selectedCategories: [],
  locationReport: null,
  isGenerating: false,
  mapProvider: "google",
  selectedPois: {},
  hoveredPoi: null,
  activeMapStyleId: "custom",

  setInputUrl: (inputUrl) => set({ inputUrl }),
  setCoordinates: (coordinates) => set({ coordinates }),
  setSelectedCategories: (selectedCategories) => set({ selectedCategories }),
  setLocationReport: (locationReport) => set({ locationReport }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setMapProvider: (mapProvider) => set({ mapProvider }),
  setActiveMapStyleId: (activeMapStyleId) => set({ activeMapStyleId }),

  togglePoi: (poi) =>
    set((state) => {
      const current = state.selectedPois[poi.type] ?? [];
      const exists = current.some((p) => p.id === poi.id);
      const updated = exists ? current.filter((p) => p.id !== poi.id) : [...current, poi];
      // If all removed, drop the key
      if (updated.length === 0) {
        const next = { ...state.selectedPois };
        delete next[poi.type];
        return { selectedPois: next };
      }
      return { selectedPois: { ...state.selectedPois, [poi.type]: updated } };
    }),

  clearCategory: (categoryType) =>
    set((state) => {
      const next = { ...state.selectedPois };
      delete next[categoryType];
      return { selectedPois: next };
    }),

  setHoveredPoi: (hoveredPoi) => set({ hoveredPoi }),

  resetAnalysis: () =>
    set({
      locationReport: null,
      isGenerating: false,
      selectedPois: {},
      hoveredPoi: null,
    }),
}));
