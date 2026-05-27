import { create } from 'zustand';
import type { LocationReport } from '@/types';

interface ReportState {
  inputUrl: string;
  coordinates: { lat: number; lng: number } | null;
  selectedCategories: string[];
  locationReport: LocationReport | null;
  isGenerating: boolean;
  mapProvider: 'google' | 'mapbox';
  setInputUrl: (v: string) => void;
  setCoordinates: (v: { lat: number; lng: number } | null) => void;
  setSelectedCategories: (v: string[]) => void;
  setLocationReport: (v: LocationReport | null) => void;
  setIsGenerating: (v: boolean) => void;
  setMapProvider: (v: 'google' | 'mapbox') => void;
}

export const useReportStore = create<ReportState>((set) => ({
  inputUrl: '',
  coordinates: null,
  selectedCategories: [],
  locationReport: null,
  isGenerating: false,
  mapProvider: 'google',
  setInputUrl: (inputUrl) => set({ inputUrl }),
  setCoordinates: (coordinates) => set({ coordinates }),
  setSelectedCategories: (selectedCategories) => set({ selectedCategories }),
  setLocationReport: (locationReport) => set({ locationReport }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setMapProvider: (mapProvider) => set({ mapProvider }),
}));
