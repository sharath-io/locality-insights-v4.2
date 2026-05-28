import { create } from 'zustand';
import type { LocationReport } from '@/types';

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
  mapProvider: 'google' | 'mapbox';
  /** One selected POI per category type (key = category string) */
  selectedPois: Record<string, SelectedPoiEntry>;
  /** Full data of the POI card currently being hovered (for temp map preview) */
  hoveredPoi: SelectedPoiEntry | null;

  setInputUrl: (v: string) => void;
  setCoordinates: (v: { lat: number; lng: number } | null) => void;
  setSelectedCategories: (v: string[]) => void;
  setLocationReport: (v: LocationReport | null) => void;
  setIsGenerating: (v: boolean) => void;
  setMapProvider: (v: 'google' | 'mapbox') => void;
  /** Select a POI for its category (replaces any previous selection in that category) */
  selectPoi: (poi: SelectedPoiEntry) => void;
  /** Deselect the POI for a given category */
  clearPoi: (categoryType: string) => void;
  setHoveredPoi: (poi: SelectedPoiEntry | null) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  inputUrl: '',
  coordinates: null,
  selectedCategories: [],
  locationReport: null,
  isGenerating: false,
  mapProvider: 'google',
  selectedPois: {},
  hoveredPoi: null,

  setInputUrl: (inputUrl) => set({ inputUrl }),
  setCoordinates: (coordinates) => set({ coordinates }),
  setSelectedCategories: (selectedCategories) => set({ selectedCategories }),
  setLocationReport: (locationReport) => set({ locationReport }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setMapProvider: (mapProvider) => set({ mapProvider }),

  selectPoi: (poi) =>
    set((state) => ({
      selectedPois: { ...state.selectedPois, [poi.type]: poi },
    })),

  clearPoi: (categoryType) =>
    set((state) => {
      const next = { ...state.selectedPois };
      delete next[categoryType];
      return { selectedPois: next };
    }),

  setHoveredPoi: (hoveredPoi) => set({ hoveredPoi }),
}));
