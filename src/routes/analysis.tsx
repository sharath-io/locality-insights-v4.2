import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { useServerFn } from '@tanstack/react-start';
import { fetchRoads } from '@/lib/fetch-roads.functions';
import type { RoadSegment } from '@/types';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  ArrowLeft, Sparkles, Hospital, GraduationCap, BookOpen, Train, Bus,
  Building2, ShoppingBag, Landmark, UtensilsCrossed, Camera, Trees,
  MapPin, Route as RouteIcon, Navigation,
} from 'lucide-react';
import { useReportStore } from '@/stores/reportStore';
import { usePlacesSearch } from '@/hooks/usePlacesSearch';
import { useMapKeys } from '@/hooks/useMapKeys';
import BrochureModal from '@/components/brochure/BrochureModal';

export const Route = createFileRoute('/analysis')({
  head: () => ({
    meta: [
      { title: 'Vicinity Analysis — LocateIQ' },
      { name: 'description', content: 'Intelligent vicinity insights for any location.' },
    ],
  }),
  component: AnalysisPage,
});

const CATEGORY_META: Record<string, { Icon: typeof MapPin; color: string }> = {
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

function AnalysisPage() {
  const navigate = useNavigate();
  const coordinates = useReportStore((s) => s.coordinates);
  const locationReport = useReportStore((s) => s.locationReport);
  const isGenerating = useReportStore((s) => s.isGenerating);
  const mapProvider = useReportStore((s) => s.mapProvider);
  const setMapProvider = useReportStore((s) => s.setMapProvider);
  const setBrochureOpen = useReportStore((s) => s.setBrochureOpen);

  usePlacesSearch();

  // Redirect home if no coordinates
  useEffect(() => {
    if (!coordinates) navigate({ to: '/' });
  }, [coordinates, navigate]);

  const serial = locationReport?.reportId.replace(/-/g, '').slice(0, 4).toUpperCase() ?? '----';

  const topPois = useMemo(() => {
    if (!locationReport) return [];
    const flat = locationReport.pois.flatMap((g) =>
      g.items.map((it) => ({ ...it, type: g.type }))
    );
    return flat.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 15);
  }, [locationReport]);

  if (!coordinates) return null;

  return (
    <main className="min-h-screen bg-[var(--cream)] font-body pb-32">
      {/* TOP BAR */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-[#e8e2d4]">
        <button
          onClick={() => navigate({ to: '/' })}
          className="flex items-center gap-2 text-[var(--navy)] hover:opacity-70 transition text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </button>
        <div className="text-right">
          <div className="text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">
            Report Serial
          </div>
          <div className="font-mono text-sm text-[var(--navy)] mt-0.5">#VIC-2026-{serial}</div>
        </div>
      </header>

      {/* MAP */}
      <section className="px-6 md:px-10 pt-6">
        <div
          className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-[#e8e2d4]"
          style={{ height: '45vh' }}
        >
          <MapView />

          {/* Coordinates overlay */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-md shadow font-mono text-[11px] text-[var(--navy)]">
            {coordinates.lat.toFixed(5)}° N, {coordinates.lng.toFixed(5)}° E
          </div>

          {/* Provider toggle */}
          <div className="absolute bottom-4 right-4 flex gap-1 bg-white/95 backdrop-blur rounded-full p-1 shadow">
            {(['google', 'mapbox'] as const).map((p) => {
              const active = mapProvider === p;
              return (
                <button
                  key={p}
                  onClick={() => setMapProvider(p)}
                  className={`text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full transition ${
                    active
                      ? 'bg-[var(--navy)] text-white'
                      : 'text-[var(--navy)] hover:bg-[var(--cream)]'
                  }`}
                >
                  {p === 'google' ? 'Google Maps' : 'Mapbox'}
                </button>
              );
            })}
          </div>

          {/* Loading overlay */}
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-4 border-[var(--gold)] border-t-transparent animate-spin" />
                </div>
                <div className="text-[var(--navy)] font-medium">Analyzing vicinity...</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* PROXIMITY MATRIX */}
      <section className="px-6 md:px-10 pt-12">
        <div className="text-[10px] tracking-[0.25em] text-[var(--gold)] uppercase font-medium">
          Proximity Matrix
        </div>
        <h2 className="font-heading text-[22px] text-[var(--navy)] mt-1">Nearby Intelligence</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
          {topPois.map((p, i) => {
            const meta = CATEGORY_META[p.type] ?? { Icon: MapPin, color: '#666' };
            const Icon = meta.Icon;
            return (
              <motion.div
                key={`${p.name}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 bg-white border border-[#e8e2d4] rounded-lg px-4 py-3 hover:shadow-md transition"
              >
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${meta.color}14`, color: meta.color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--navy)] truncate">
                    {p.name}
                  </div>
                  <div className="text-[9px] tracking-[0.18em] text-[var(--muted)] uppercase mt-0.5">
                    {p.type}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[15px] font-bold text-[var(--gold)]">
                    {p.distanceKm.toFixed(1)} km
                  </div>
                  <div className="text-[9px] tracking-[0.18em] text-[var(--muted)] uppercase">
                    Proximity
                  </div>
                </div>
              </motion.div>
            );
          })}
          {!isGenerating && topPois.length === 0 && (
            <div className="col-span-full text-center text-[var(--muted)] text-sm py-10">
              No nearby places found.
            </div>
          )}
        </div>
      </section>

      {/* FLOATING BUTTON */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          onClick={() => setBrochureOpen(true)}
          className="relative bg-[var(--gold)] text-[var(--navy)] font-medium rounded-full px-8 py-3 shadow-lg flex items-center gap-2 hover:scale-[1.02] transition"
        >
          <span className="absolute inset-0 rounded-full bg-[var(--gold)] animate-ping opacity-30" />
          <Sparkles className="w-4 h-4 relative" />
          <span className="relative">Create Brochure</span>
        </button>
      </div>
      <BrochureModal />
    </main>
  );
}

function MapView() {
  const coordinates = useReportStore((s) => s.coordinates)!;
  const mapProvider = useReportStore((s) => s.mapProvider);
  const keys = useMapKeys();

  if (mapProvider === 'mapbox') {
    return <MapboxMap lat={coordinates.lat} lng={coordinates.lng} token={keys?.mapboxToken} />;
  }
  return <GoogleMapView lat={coordinates.lat} lng={coordinates.lng} apiKey={keys?.googleMapsKey} />;
}

function GoogleMapView({ lat, lng, apiKey }: { lat: number; lng: number; apiKey?: string }) {
  if (!apiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--cream)] text-[var(--muted)] text-sm">
        Loading map…
      </div>
    );
  }
  return <GoogleMapInner lat={lat} lng={lng} apiKey={apiKey} />;
}

function GoogleMapInner({ lat, lng, apiKey }: { lat: number; lng: number; apiKey: string }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  if (!isLoaded) {
    return <div className="w-full h-full bg-[var(--cream)]" />;
  }

  const markerIcon = {
    path: 'M 0,0 m -10,0 a 10,10 0 1,0 20,0 a 10,10 0 1,0 -20,0',
    fillColor: '#d64545',
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 3,
    scale: 1,
    anchor: new google.maps.Point(0, 0),
  };

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={{ lat, lng }}
      zoom={15}
      mapTypeId="roadmap"
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
      }}
    >
      <Marker position={{ lat, lng }} icon={markerIcon as google.maps.Symbol} />
    </GoogleMap>
  );
}

function MapboxMap({ lat, lng, token }: { lat: number; lng: number; token?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!token || !containerRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [lng, lat],
      zoom: 14,
    });
    mapRef.current = map;

    const el = document.createElement('div');
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.borderRadius = '50%';
    el.style.background = '#d64545';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, token]);

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--cream)] text-[var(--muted)] text-sm">
        Mapbox token not configured.
      </div>
    );
  }
  return <div ref={containerRef} className="w-full h-full" />;
}
