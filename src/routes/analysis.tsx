import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, OverlayView, useJsApiLoader } from '@react-google-maps/api';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ArrowLeft, MapPin, Layers } from 'lucide-react';
import { useReportStore } from '@/stores/reportStore';
import { usePlacesSearch } from '@/hooks/usePlacesSearch';
import { useMapKeys } from '@/hooks/useMapKeys';
import { CATEGORY_META, ROAD_FOCUS_STYLES } from '@/lib/map-styles';

export const Route = createFileRoute('/analysis')({
  head: () => ({
    meta: [
      { title: 'Vicinity Analysis — LocateIQ' },
      { name: 'description', content: 'Intelligent vicinity insights for any location.' },
    ],
  }),
  component: AnalysisPage,
});

type PoiRow = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distanceKm: number;
  minutesDrive: number;
  rating?: number;
};

function AnalysisPage() {
  const navigate = useNavigate();
  const coordinates = useReportStore((s) => s.coordinates);
  const locationReport = useReportStore((s) => s.locationReport);
  const isGenerating = useReportStore((s) => s.isGenerating);
  const mapProvider = useReportStore((s) => s.mapProvider);
  const setMapProvider = useReportStore((s) => s.setMapProvider);

  usePlacesSearch();

  useEffect(() => {
    if (!coordinates) navigate({ to: '/' });
  }, [coordinates, navigate]);

  const serial = locationReport?.reportId.replace(/-/g, '').slice(0, 4).toUpperCase() ?? '----';

  const allPois: PoiRow[] = useMemo(() => {
    if (!locationReport) return [];
    const flat: PoiRow[] = locationReport.pois.flatMap((g) =>
      g.items.map((it) => ({
        ...it,
        type: g.type,
        id: `${g.type}|${it.name}|${it.lat.toFixed(5)}|${it.lng.toFixed(5)}`,
      }))
    );
    return flat.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [locationReport]);

  const groupedPois = useMemo(() => {
    const groups = new Map<string, PoiRow[]>();
    for (const p of allPois) {
      if (!groups.has(p.type)) groups.set(p.type, []);
      groups.get(p.type)!.push(p);
    }
    return Array.from(groups.entries()).map(([type, items]) => ({ type, items }));
  }, [allPois]);

  if (!coordinates) return null;

  return (
    <main className="min-h-screen bg-[var(--cream)] font-body pb-32">
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

      {/* ── MAP SECTION ── */}
      <section className="px-6 md:px-10 pt-6">
        <div
          className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-[#e8e2d4]"
          style={{ height: '48vh' }}
        >
          <MapView />

          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-md shadow font-mono text-[11px] text-[var(--navy)]">
            {coordinates.lat.toFixed(5)}° N, {coordinates.lng.toFixed(5)}° E
          </div>

          {/* Map provider switcher */}
          <div className="absolute bottom-4 right-4 flex gap-1 bg-white/95 backdrop-blur rounded-full p-1 shadow">
            {(['google', 'mapbox'] as const).map((p) => {
              const active = mapProvider === p;
              return (
                <button
                  key={p}
                  onClick={() => setMapProvider(p)}
                  className={`text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full transition ${active ? 'bg-[var(--navy)] text-white' : 'text-[var(--navy)] hover:bg-[var(--cream)]'
                    }`}
                >
                  {p === 'google' ? 'Google Maps' : 'Mapbox'}
                </button>
              );
            })}
          </div>

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

      {/* ── PLACES LIST (directly below map) ── */}
      <section className="px-6 md:px-10 pt-10 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="text-[10px] tracking-[0.25em] text-[var(--gold)] uppercase font-medium">
            Vicinity Intelligence
          </div>
          <h2 className="font-heading text-[24px] text-[var(--navy)] mt-1">
            Important Nearby Places
          </h2>
        </div>

        {/* Loading skeleton */}
        {isGenerating && (
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#e8e2d4]" />
                  <div className="h-5 w-48 bg-[#e8e2d4] rounded" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-20 bg-white rounded-xl border border-[#e8e2d4]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isGenerating && allPois.length === 0 && (
          <div className="text-center text-[var(--muted)] text-sm py-12 bg-white rounded-xl border border-[#e8e2d4]">
            No nearby places found for the selected categories.
          </div>
        )}

        {/* Categorised places grid */}
        {!isGenerating && groupedPois.length > 0 && (
          <div className="space-y-10">
            {groupedPois.map(({ type, items }) => {
              const meta = CATEGORY_META[type] ?? { Icon: MapPin, color: '#666' };
              const Icon = meta.Icon;

              return (
                <motion.div
                  key={type}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Section header */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                      style={{ background: `${meta.color}18`, color: meta.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-[14px] font-bold tracking-[0.12em] text-[var(--navy)] uppercase">
                      {type}
                    </h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-[#e8e2d4] to-transparent ml-4" />
                  </div>

                  {/* Cards grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((p) => (
                      <div
                        key={p.id}
                        className="bg-white rounded-xl p-4 border border-[#e8e2d4] shadow-sm hover:shadow-md transition-shadow flex items-start gap-3"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#faf8f4] border border-[#f0ebe0]"
                        >
                          <Icon className="w-4 h-4" style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13px] font-semibold text-[var(--navy)] leading-tight mb-1 truncate">
                            {p.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px]">
                            <span
                              className="font-bold px-2 py-0.5 rounded-full"
                              style={{ background: `${meta.color}15`, color: meta.color }}
                            >
                              {p.distanceKm.toFixed(1)} km
                            </span>
                            {p.rating && p.rating > 0 && (
                              <span className="text-[var(--muted)]">★ {p.rating.toFixed(1)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
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
  const [mapTypeId, setMapTypeId] = useState<string>('roadmap');
  const [showLayers, setShowLayers] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  if (!isLoaded) {
    return <div className="w-full h-full bg-[var(--cream)]" />;
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{ lat, lng }}
        zoom={15}
        mapTypeId={mapTypeId}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          styles: mapTypeId === 'roadmap' || mapTypeId === 'terrain' ? ROAD_FOCUS_STYLES : undefined
        }}
      >
        {/* Clean minimal red location pin */}
        <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div
            style={{
              transform: 'translate(-50%, -100%)',
              zIndex: 700,
              position: 'relative',
            }}
            className="pointer-events-none"
          >
            <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M17 1.5C8.44 1.5 1.5 8.44 1.5 17c0 11.5 14.2 24.6 14.8 25.2.4.4 1 .4 1.4 0C18.3 41.6 32.5 28.5 32.5 17 32.5 8.44 25.56 1.5 17 1.5Z"
                fill="#E53935"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="17" cy="17" r="5.5" fill="#ffffff" />
            </svg>
          </div>
        </OverlayView>
      </GoogleMap>

      {/* Layer Selector */}
      <div
        className="absolute bottom-6 left-4 z-50 flex items-end gap-2"
        onMouseEnter={() => setShowLayers(true)}
        onMouseLeave={() => setShowLayers(false)}
      >
        {/* Main trigger button */}
        <button
          className="relative w-[60px] h-[60px] rounded-xl shadow-lg border-[2px] border-white overflow-hidden transition-transform hover:scale-105"
          style={{
            background: mapTypeId === 'satellite' || mapTypeId === 'hybrid' ? '#2d3748' : '#e8e2d4',
          }}
          onClick={() => setShowLayers(!showLayers)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
            <Layers className="w-5 h-5 text-white drop-shadow-md mb-0.5" />
            <span className="text-[10px] font-bold text-white drop-shadow-md tracking-wide">Layers</span>
          </div>
        </button>

        {/* Expanding panel */}
        <AnimatePresence>
          {showLayers && (
            <motion.div
              initial={{ opacity: 0, x: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 p-2 flex gap-1 mb-1"
            >
              {(['roadmap', 'satellite', 'hybrid', 'terrain'] as const).map(type => {
                const isActive = mapTypeId === type;
                return (
                  <button
                    key={type}
                    onClick={() => setMapTypeId(type)}
                    className="flex flex-col items-center gap-1.5 w-16 group p-1"
                  >
                    <div className={`w-14 h-14 rounded-xl border-2 transition-all duration-300 ${isActive ? 'border-blue-500 scale-95 shadow-inner' : 'border-transparent group-hover:border-gray-300 group-hover:shadow'
                      } overflow-hidden relative flex items-center justify-center`}
                      style={{ background: type === 'satellite' || type === 'hybrid' ? '#2d3748' : '#e8e2d4' }}
                    >
                      {/* Simple placeholder icon for map types */}
                      <Layers className={`w-5 h-5 opacity-50 ${type === 'satellite' || type === 'hybrid' ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    <span className={`text-[11px] capitalize transition-colors ${isActive ? 'font-bold text-blue-600' : 'font-medium text-gray-500 group-hover:text-gray-800'
                      }`}>
                      {type}
                    </span>
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MapboxMap({ lat, lng, token }: { lat: number; lng: number; token?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token || !containerRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [lng, lat],
      zoom: 14,
    });

    const el = document.createElement('div');
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.borderRadius = '50%';
    el.style.background = '#d64545';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);

    return () => map.remove();
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
