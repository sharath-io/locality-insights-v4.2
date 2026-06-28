import { create } from "zustand";
import type { LocationReport } from "@/types";

export type SelectedPoiEntry = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distanceKm: number;
  types?: string[];
};


interface ReportState {
  inputUrl: string;
  coordinates: { lat: number; lng: number } | null;
  selectedCategories: string[];
  locationReport: LocationReport | null;
  isGenerating: boolean;
  mapProvider: "mapbox-v1" | "mapbox-v2" | "mapbox-v3" | "mapbox-coast" | "mapbox-skeleton";
  /** Multiple selected POIs per category type (key = category string, value = array) */
  selectedPois: Record<string, SelectedPoiEntry[]>;
  /** Full data of the POI card currently being hovered (for temp map preview) */
  hoveredPoi: SelectedPoiEntry | null;
  /** When true the analysis page auto-selects top 2 POIs per category, captures the map,
   *  and opens the brochure dialog — showing a hybrid loading overlay during the flow. */
  autoBrochureMode: boolean;

  setInputUrl: (v: string) => void;
  setCoordinates: (v: { lat: number; lng: number } | null) => void;
  setSelectedCategories: (v: string[]) => void;
  setLocationReport: (v: LocationReport | null) => void;
  setIsGenerating: (v: boolean) => void;
  setMapProvider: (v: "mapbox-v1" | "mapbox-v2" | "mapbox-v3" | "mapbox-coast" | "mapbox-skeleton") => void;
  /** Toggle a POI selection within its category (add if not present, remove if already selected) */
  togglePoi: (poi: SelectedPoiEntry) => void;
  /** Deselect all POIs for a given category */
  /** Deselect all POIs across all categories */
  clearAllPois: () => void;
  setHoveredPoi: (poi: SelectedPoiEntry | null) => void;
  setAutoBrochureMode: (v: boolean) => void;
  /** Wipe all analysis data (called when leaving the analysis page) */
  resetAnalysis: () => void;
}

export const useReportStore = create<ReportState>((set) => ({
  inputUrl: "",
  coordinates: null,
  selectedCategories: [],
  locationReport: null,
  isGenerating: false,
  mapProvider: "mapbox-v2",
  selectedPois: {},
  hoveredPoi: null,
  autoBrochureMode: false,

  setInputUrl: (inputUrl) => set({ inputUrl }),
  setCoordinates: (coordinates) => set({ coordinates }),
  setSelectedCategories: (selectedCategories) => set({ selectedCategories }),
  setLocationReport: (locationReport) => set({ locationReport }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setMapProvider: (mapProvider) => set({ mapProvider }),
  setAutoBrochureMode: (autoBrochureMode) => set({ autoBrochureMode }),

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

  clearAllPois: () => set({ selectedPois: {} }),

  setHoveredPoi: (hoveredPoi) => set({ hoveredPoi }),

  resetAnalysis: () =>
    set({
      locationReport: null,
      isGenerating: false,
      selectedPois: {},
      hoveredPoi: null,
      // NOTE: autoBrochureMode is intentionally NOT reset here.
      // resetAnalysis is called on analysis page unmount (including React StrictMode
      // double-invoke), which would wipe the flag before the auto-flow can read it.
      // autoBrochureMode is reset explicitly via setAutoBrochureMode(false) once the
      // flow completes or is cancelled.
    }),
}));
