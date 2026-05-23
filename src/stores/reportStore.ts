import { create } from 'zustand';
import type { LocationReport } from '@/types';
import type { SelectedPoi } from '@/lib/map-styles';

interface ReportState {
  inputUrl: string;
  coordinates: { lat: number; lng: number } | null;
  selectedCategories: string[];
  locationReport: LocationReport | null;
  isGenerating: boolean;
  mapProvider: 'google' | 'mapbox';
  brochureOpen: boolean;
  selectedPois: SelectedPoi[];
  setInputUrl: (v: string) => void;
  setCoordinates: (v: { lat: number; lng: number } | null) => void;
  setSelectedCategories: (v: string[]) => void;
  setLocationReport: (v: LocationReport | null) => void;
  setIsGenerating: (v: boolean) => void;
  setMapProvider: (v: 'google' | 'mapbox') => void;
  setBrochureOpen: (v: boolean) => void;
  setSelectedPois: (v: SelectedPoi[]) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  inputUrl: '',
  coordinates: null,
  selectedCategories: [],
  locationReport: null,
  isGenerating: false,
  mapProvider: 'google',
  brochureOpen: false,
  selectedPois: [],
  setInputUrl: (inputUrl) => set({ inputUrl }),
  setCoordinates: (coordinates) => set({ coordinates }),
  setSelectedCategories: (selectedCategories) => set({ selectedCategories }),
  setLocationReport: (locationReport) => set({ locationReport }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setMapProvider: (mapProvider) => set({ mapProvider }),
  setBrochureOpen: (brochureOpen) => set({ brochureOpen }),
  setSelectedPois: (selectedPois) => set({ selectedPois }),
}));
