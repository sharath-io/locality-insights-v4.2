import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useEffect, useLayoutEffect, useRef, useState, useCallback, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, OverlayView, useJsApiLoader } from '@react-google-maps/api';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ArrowLeft, MapPin, Layers } from 'lucide-react';
import { useReportStore } from '@/stores/reportStore';
import type { SelectedPoiEntry } from '@/stores/reportStore';
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
  const selectedPois = useReportStore((s) => s.selectedPois);
  const selectPoi = useReportStore((s) => s.selectPoi);
  const clearPoi = useReportStore((s) => s.clearPoi);
  const hoveredPoi = useReportStore((s) => s.hoveredPoi);
  const setHoveredPoi = useReportStore((s) => s.setHoveredPoi);
  const resetAnalysis = useReportStore((s) => s.resetAnalysis);

  usePlacesSearch();

  useEffect(() => {
    if (!coordinates) navigate({ to: '/' });
  }, [coordinates, navigate]);

  // Clear all analysis state when the user leaves this page
  useEffect(() => {
    return () => {
      resetAnalysis();
    };
  }, [resetAnalysis]);

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

  const handleSelect = useCallback(
    (p: PoiRow) => {
      const current = selectedPois[p.type];
      if (current?.id === p.id) {
        // Clicking the already-selected POI deselects it
        clearPoi(p.type);
      } else {
        // Radio: replace previous selection in this category
        selectPoi({
          id: p.id,
          name: p.name,
          type: p.type,
          lat: p.lat,
          lng: p.lng,
          distanceKm: p.distanceKm,
        });
      }
    },
    [selectedPois, selectPoi, clearPoi]
  );

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

          {/* Selected POIs legend */}
          {Object.values(selectedPois).length > 0 && (
            <div className="absolute top-4 right-4 flex flex-col gap-1.5 max-w-[200px]">
              {Object.values(selectedPois).map((poi) => {
                const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: '#666' };
                const Icon = meta.Icon;
                return (
                  <div
                    key={poi.id}
                    className="flex items-center gap-2 bg-white/95 backdrop-blur px-2.5 py-1.5 rounded-lg shadow text-[11px]"
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
                    <span className="text-[var(--navy)] font-medium truncate">{poi.name.split(',')[0]} - {poi.distanceKm.toFixed(1)} km</span>
                  </div>
                );
              })}
            </div>
          )}

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
          <p className="text-[12px] text-[var(--muted)] mt-1">
            Select one location per category to pin it on the map
          </p>
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
              const selectedInCategory = selectedPois[type];

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
                    {selectedInCategory && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${meta.color}18`, color: meta.color }}
                      >
                        1 pinned
                      </span>
                    )}
                    <div className="h-px flex-1 bg-gradient-to-r from-[#e8e2d4] to-transparent ml-2" />
                  </div>

                  {/* Cards grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((p) => {
                      const isSelected = selectedInCategory?.id === p.id;
                      const isHovered = hoveredPoi?.id === p.id;

                      return (
                        <motion.button
                          key={p.id}
                          onClick={() => handleSelect(p)}
                          onMouseEnter={() => setHoveredPoi({
                            id: p.id,
                            name: p.name,
                            type: p.type,
                            lat: p.lat,
                            lng: p.lng,
                            distanceKm: p.distanceKm,
                          })}
                          onMouseLeave={() => setHoveredPoi(null)}
                          whileHover={{ scale: 1.015 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className={`
                            w-full text-left bg-white rounded-xl p-4 border transition-all duration-200
                            flex items-start gap-3 cursor-pointer group relative
                            ${isSelected
                              ? 'shadow-md'
                              : isHovered
                              ? 'shadow-md border-[#d4cec5]'
                              : 'shadow-sm border-[#e8e2d4] hover:shadow-md hover:border-[#d4cec5]'
                            }
                          `}
                          style={
                            isSelected
                              ? {
                                  borderColor: meta.color,
                                  boxShadow: `0 0 0 2px ${meta.color}25, 0 4px 12px ${meta.color}15`,
                                }
                              : {}
                          }
                        >
                          {/* Radio indicator */}
                          <div className="shrink-0 mt-0.5 flex items-center justify-center">
                            <div
                              className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200"
                              style={{
                                borderColor: isSelected ? meta.color : '#d4cec5',
                                background: isSelected ? meta.color : 'transparent',
                              }}
                            >
                              {isSelected && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                          </div>

                          {/* Category icon */}
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                            style={{
                              background: isSelected ? `${meta.color}20` : '#faf8f4',
                              border: `1px solid ${isSelected ? meta.color + '40' : '#f0ebe0'}`,
                            }}
                          >
                            <Icon className="w-4 h-4" style={{ color: meta.color }} />
                          </div>

                          {/* Content */}
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

                          {/* Selected badge */}
                          {isSelected && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide text-white"
                              style={{ background: meta.color }}
                            >
                              Pinned
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
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
  const setHoveredPoi = useReportStore((s) => s.setHoveredPoi);
  const keys = useMapKeys();

  // Fix 3: Clear hovered state whenever the provider changes so no phantom
  // hover marker bleeds from one map implementation to the other.
  useEffect(() => {
    setHoveredPoi(null);
  }, [mapProvider, setHoveredPoi]);

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
  const selectedPois = useReportStore((s) => s.selectedPois);
  const hoveredPoi = useReportStore((s) => s.hoveredPoi);
  const mapRef = useRef<any>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  const poisToShow = Object.values(selectedPois);
  // Show hovered POI as preview if it's not already checked/selected
  const hoveredIsAlreadySelected = hoveredPoi
    ? poisToShow.some((p) => p.id === hoveredPoi.id)
    : false;

  // Zoom to fit bounds while keeping center exactly at `lat, lng`
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    const activePois = [
      ...Object.values(selectedPois),
      ...(hoveredPoi && !hoveredIsAlreadySelected ? [hoveredPoi] : [])
    ];
    
    if (activePois.length === 0) {
      map.setCenter({ lat, lng });
      map.setZoom(15);
      return;
    }

    let maxDeltaLat = 0;
    let maxDeltaLng = 0;
    activePois.forEach((p) => {
      maxDeltaLat = Math.max(maxDeltaLat, Math.abs(p.lat - lat));
      maxDeltaLng = Math.max(maxDeltaLng, Math.abs(p.lng - lng));
    });
    
    if (maxDeltaLat > 0 || maxDeltaLng > 0) {
      const PADDING_FACTOR = 1.3;
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: lat + maxDeltaLat * PADDING_FACTOR, lng: lng + maxDeltaLng * PADDING_FACTOR });
      bounds.extend({ lat: lat - maxDeltaLat * PADDING_FACTOR, lng: lng - maxDeltaLng * PADDING_FACTOR });
      map.fitBounds(bounds);
    }
  }, [lat, lng, selectedPois, hoveredPoi, hoveredIsAlreadySelected]);

  if (!isLoaded) {
    return <div className="w-full h-full bg-[var(--cream)]" />;
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        onLoad={(map) => { mapRef.current = map; }}
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
        {/* Site pin (red) */}
        <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <div
            style={{
              transform: 'translate(-50%, -100%)',
              zIndex: 700,
              position: 'relative',
            }}
            className="pointer-events-none"
          >
            <svg width="35" height="46" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
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

        {/* Selected POI markers — circular icon badges */}
        {poisToShow.map((poi) => {
          const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: '#666' };
          const Icon = meta.Icon;
          const isThisHovered = hoveredPoi?.id === poi.id;
          const size = 30;

          return (
            <OverlayView
              key={poi.id}
              position={{ lat: poi.lat, lng: poi.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                style={{
                  transform: 'translate(-50%, -50%)',
                  zIndex: isThisHovered ? 900 : 600,
                  position: 'relative',
                  pointerEvents: 'none',
                }}
              >
                {/* Hover tooltip */}
                {isThisHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: `${size / 2 + 10}px`,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      whiteSpace: 'nowrap',
                      background: '#0f1e35',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '6px 10px',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                      zIndex: 1000,
                      pointerEvents: 'none',
                    }}
                  >
                    {poi.name}
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: '5px solid #0f1e35',
                    }} />
                  </div>
                )}

                {/* Circular icon badge */}
                <div
                  style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    background: meta.color,
                    border: '3px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isThisHovered
                      ? `0 6px 20px ${meta.color}70, 0 0 0 3px ${meta.color}30`
                      : `0 2px 10px rgba(0,0,0,0.28)`,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <Icon
                    size={14}
                    color="white"
                    strokeWidth={2.5}
                  />
                </div>
              </div>
            </OverlayView>
          );
        })}

        {/* Hovered POI preview marker (semi-transparent, temporary) */}
        {hoveredPoi && !hoveredIsAlreadySelected && (() => {
          const meta = CATEGORY_META[hoveredPoi.type] ?? { Icon: MapPin, color: '#666' };
          const Icon = meta.Icon;
          return (
            <OverlayView
              position={{ lat: hoveredPoi.lat, lng: hoveredPoi.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                style={{
                  transform: 'translate(-50%, -50%)',
                  zIndex: 850,
                  position: 'relative',
                  pointerEvents: 'none',
                }}
              >
                {/* Tooltip */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '33px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    background: '#0f1e35',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '6px 10px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                    zIndex: 1000,
                    pointerEvents: 'none',
                  }}
                >
                  {hoveredPoi.name}
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '5px solid #0f1e35',
                  }} />
                </div>

                {/* Semi-transparent pulse ring */}
                <div
                  className="animate-ping"
                  style={{
                    position: 'absolute',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: meta.color,
                    opacity: 0.2,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />

                {/* Preview circle badge (semi-transparent) */}
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: meta.color,
                    border: '2px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 4px 16px ${meta.color}50`,
                    opacity: 0.65,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <Icon size={14} color="white" strokeWidth={2.5} />
                </div>
              </div>
            </OverlayView>
          );
        })()}
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

// Premium cinematic style palette — luxury real-estate brochure aesthetic
const MAPBOX_STYLES = [
  { id: 'custom',               label: 'Custom',            url: 'mapbox://styles/sharath-io/cmppx0gjn001b01s7h87a1n21', dark: true,  accent: '#c8b97e' },
  { id: 'dark-v11',             label: 'Monochrome',        url: 'mapbox://styles/mapbox/dark-v11',             dark: true,  accent: '#c8b97e' },
  { id: 'light-v11',            label: 'Ivory',             url: 'mapbox://styles/mapbox/light-v11',            dark: false, accent: '#8a7a5c' },
  { id: 'satellite-v9',         label: 'Satellite',         url: 'mapbox://styles/mapbox/satellite-v9',         dark: true,  accent: '#6ec6e0' },
  { id: 'outdoors-v12',         label: 'Terrain',           url: 'mapbox://styles/mapbox/outdoors-v12',         dark: false, accent: '#7aa89b' },
] as const;

type MapboxStyleId = typeof MAPBOX_STYLES[number]['id'];

// Flat 2D camera settings
const CINEMATIC_PITCH = 0;
const CINEMATIC_BEARING = 0;
const CINEMATIC_ZOOM = 14;

// Layer IDs to hide: business POIs, transit labels, dense icons
const LAYERS_TO_HIDE = [
  'poi-label',
  'transit-label',
  'road-label',
  'airport-label',
  'settlement-minor-label',
  'natural-point-label',
];

// Layers to reduce opacity (subtle, not hidden)
const ROAD_LAYERS_TO_MUTE = [
  'road-minor',
  'road-minor-case',
  'road-service',
  'road-service-case',
  'road-path',
];

// Apply cinematic layer overrides after style loads
function applyCinematicLayerOverrides(map: mapboxgl.Map, isDark: boolean) {
  const allLayers = map.getStyle()?.layers ?? [];

  // Hide noisy POI / transit / dense label layers
  for (const layerId of LAYERS_TO_HIDE) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'none');
    }
  }

  // Keep locality/city/major road/water labels — selectively re-enable
  const keepVisible = ['country-label', 'state-label', 'settlement-major-label', 'settlement-subdivision-label', 'waterway-label', 'water-line-label', 'water-point-label'];
  for (const layerId of keepVisible) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'visible');
    }
  }

  // Mute minor road layers (reduce opacity)
  for (const layerId of ROAD_LAYERS_TO_MUTE) {
    if (map.getLayer(layerId)) {
      try { map.setPaintProperty(layerId, 'line-opacity', 0.25); } catch { /* not a line layer */ }
    }
  }

  // 2D mode — no 3D buildings

  // Tune water color for premium aesthetic
  for (const layer of allLayers) {
    if (layer.id.startsWith('water') && layer.type === 'fill') {
      try {
        map.setPaintProperty(layer.id, 'fill-color', isDark ? '#1a2b3c' : '#c9d8e8');
      } catch { /* skip */ }
    }
  }
}

// ── Helper: build a POI marker DOM element ────────────────────────────────
function createPoiMarkerEl(poi: SelectedPoiEntry, options: { opacity?: number } = {}) {
  const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: '#666' };
  let iconSvgStr = '';
  try {
    iconSvgStr = renderToStaticMarkup(
      createElement(meta.Icon, { size: 14, color: 'white', strokeWidth: 2.5 } as never)
    );
  } catch { /* fallback to empty */ }

  const el = document.createElement('div');
  const opacity = options.opacity ?? 1;
  el.style.cssText = `
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: ${meta.color};
    border: 2px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: ${opacity < 1 ? `0 4px 16px ${meta.color}50` : '0 2px 8px rgba(0,0,0,0.28)'};
    opacity: ${opacity};
    cursor: pointer;
    transition: all 0.2s ease;
  `;
  el.innerHTML = iconSvgStr;
  return { el, meta };
}

function MapboxMap({ lat, lng, token }: { lat: number; lng: number; token?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [activeStyle, setActiveStyle] = useState<MapboxStyleId>('custom');
  const [showLayers, setShowLayers] = useState(false);
  // Skip the changeStyle effect on first render — the map is already initialized
  // with activeStyle, so calling setStyle() again would fire a duplicate style.load
  // which creates an untracked orphan marker (the ghost-marker bug).
  const isFirstStyleRender = useRef(true);

  const selectedPois = useReportStore((s) => s.selectedPois);
  const hoveredPoi = useReportStore((s) => s.hoveredPoi);
  const hoveredMarkerRef = useRef<mapboxgl.Marker | null>(null);
  // Fix 4: useLayoutEffect keeps the ref synchronously up-to-date before any
  // async map event callbacks read it, preventing stale-closure bugs.
  const selectedPoisRef = useRef(selectedPois);
  useLayoutEffect(() => { selectedPoisRef.current = selectedPois; }, [selectedPois]);

  // ── Shared: add all selected POI markers to map (clears existing first) ──
  const syncSelectedMarkersToMap = useCallback((map: mapboxgl.Map, pois: typeof selectedPois) => {
    // Remove any existing POI markers from the DOM, then clear the ref.
    // (When called after a style change the DOM markers are already gone,
    //  but when called from incremental sync they need explicit removal.)
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    for (const [categoryType, poi] of Object.entries(pois)) {
      const { el } = createPoiMarkerEl(poi);

      const popup = new mapboxgl.Popup({
        offset: 24,
        closeButton: false,
        closeOnClick: false,
        className: 'poi-popup',
      }).setHTML(`<span>${poi.name}</span>`);

      el.addEventListener('mouseenter', () => marker.getPopup()?.isOpen() === false && marker.togglePopup());
      el.addEventListener('mouseleave', () => marker.getPopup()?.isOpen() && marker.togglePopup());

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([poi.lng, poi.lat])
        .setPopup(popup)
        .addTo(map);

      (marker as any).__poiId = poi.id;
      markersRef.current.set(categoryType, marker);
    }
  }, []);

  // Init map once — cinematic real-estate camera
  useEffect(() => {
    if (!token || !containerRef.current) return;
    mapboxgl.accessToken = token;
    const styleMeta = MAPBOX_STYLES.find(s => s.id === activeStyle) ?? MAPBOX_STYLES[0];
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleMeta.url,
      center: [lng, lat],
      zoom: CINEMATIC_ZOOM,
      pitch: CINEMATIC_PITCH,
      bearing: CINEMATIC_BEARING,
      antialias: true,
    });
    mapRef.current = map;

    // Custom elegant site pin (gold ring + dot)
    const addSitePin = () => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 38px;
        height: 38px;
        cursor: pointer;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.45));
      `;
      el.innerHTML = `
        <svg width="38" height="46" viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 2C10.16 2 3 9.16 3 18c0 12.5 15.2 25.8 15.4 26 .33.27.87.27 1.2 0C19.8 43.8 35 30.5 35 18 35 9.16 27.84 2 19 2Z"
            fill="#c8b97e" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="19" cy="18" r="5" fill="rgba(255,255,255,0.95)"/>
          <circle cx="19" cy="18" r="2.5" fill="#c8b97e"/>
        </svg>
      `;
      new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map);
    };

    // Fix 1: Read the store directly inside the load callback to guarantee we
    // have the latest snapshot — not through a ref that may be stale.
    const hydrateMarkers = () => {
      const latestPois = useReportStore.getState().selectedPois;
      const currentStyleMeta = MAPBOX_STYLES.find(s => s.id === activeStyle) ?? MAPBOX_STYLES[0];
      // Explicitly remove any existing DOM markers before clearing the ref.
      // (Mapbox removes GL layers on setStyle but DOM markers survive — we must
      // clean them up ourselves to prevent orphans.)
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      addSitePin();
      syncSelectedMarkersToMap(map, latestPois);
      // Apply cinematic layer overrides after every style.load
      try { applyCinematicLayerOverrides(map, currentStyleMeta.dark); } catch { /* ignore if layers not ready */ }
    };

    // 'style.load' fires exactly once on initial map load AND once after every
    // setStyle() call. Using it alone (instead of also listening to 'load')
    // prevents hydrateMarkers from running twice on mount, which was causing
    // duplicate markers on the map even though the store holds only one POI
    // per category.
    map.on('style.load', hydrateMarkers);

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, token]);

  // Change style without remounting — skip on initial render to avoid
  // firing setStyle() on a map that was already initialized with this style.
  // That double-setStyle caused two style.load events → duplicate markers.
  useEffect(() => {
    if (isFirstStyleRender.current) {
      isFirstStyleRender.current = false;
      return;
    }
    const style = MAPBOX_STYLES.find(s => s.id === activeStyle);
    if (style && mapRef.current) {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      mapRef.current.setStyle(style.url);
      // Restore cinematic camera after style switch
      mapRef.current.easeTo({ pitch: CINEMATIC_PITCH, bearing: CINEMATIC_BEARING, duration: 600 });
    }
  }, [activeStyle]);

  // Sync selected POI markers imperatively whenever selections change.
  // style.load handles re-hydration after style switches AND initial mount,
  // so skip this effect while the style is still loading to avoid adding
  // a marker that hydrateMarkers will later duplicate.
  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;
    const currentIds = new Set(Object.keys(selectedPois));
    const existingIds = new Set(markersRef.current.keys());

    // Remove markers no longer selected
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        markersRef.current.get(id)?.remove();
        markersRef.current.delete(id);
      }
    }

    // Add new markers / update changed ones
    for (const [categoryType, poi] of Object.entries(selectedPois)) {
      const existing = markersRef.current.get(categoryType);
      // If marker exists but for a different POI (user re-selected within category), remove old
      if (existing && (existing as any).__poiId !== poi.id) {
        existing.remove();
        markersRef.current.delete(categoryType);
      }

      if (!markersRef.current.has(categoryType)) {
        const { el } = createPoiMarkerEl(poi);

        const popup = new mapboxgl.Popup({
          offset: 24,
          closeButton: false,
          closeOnClick: false,
          className: 'poi-popup',
        }).setHTML(`<span>${poi.name}</span>`);

        el.addEventListener('mouseenter', () => marker.getPopup()?.isOpen() === false && marker.togglePopup());
        el.addEventListener('mouseleave', () => marker.getPopup()?.isOpen() && marker.togglePopup());

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([poi.lng, poi.lat])
          .setPopup(popup)
          .addTo(map);

        (marker as any).__poiId = poi.id;
        markersRef.current.set(categoryType, marker);
      }
    }
  }, [selectedPois]);

  // Sync hovered POI preview marker (temporary, semi-transparent)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove previous hovered marker
    if (hoveredMarkerRef.current) {
      hoveredMarkerRef.current.remove();
      hoveredMarkerRef.current = null;
    }

    if (!hoveredPoi) return;

    // Don't show preview if already selected/checked
    const isAlreadySelected = Object.values(selectedPois).some((p) => p.id === hoveredPoi.id);
    if (isAlreadySelected) return;

    const { el } = createPoiMarkerEl(hoveredPoi, { opacity: 0.65 });

    const popup = new mapboxgl.Popup({
      offset: 28,
      closeButton: false,
      closeOnClick: false,
      className: 'poi-popup',
    }).setHTML(`<span>${hoveredPoi.name}</span>`);

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([hoveredPoi.lng, hoveredPoi.lat])
      .setPopup(popup)
      .addTo(map);

    marker.togglePopup(); // show tooltip immediately
    hoveredMarkerRef.current = marker;

    return () => {
      marker.remove();
      hoveredMarkerRef.current = null;
    };
  }, [hoveredPoi, selectedPois]);

  // Zoom to fit bounds while keeping center exactly at `lng, lat`
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    const activePois = [
      ...Object.values(selectedPois),
      ...(hoveredPoi ? [hoveredPoi] : [])
    ];
    
    if (activePois.length === 0) {
      map.easeTo({ center: [lng, lat], zoom: CINEMATIC_ZOOM, pitch: CINEMATIC_PITCH, bearing: CINEMATIC_BEARING, duration: 900 });
      return;
    }
    
    let maxDeltaLat = 0;
    let maxDeltaLng = 0;
    activePois.forEach((p) => {
      maxDeltaLat = Math.max(maxDeltaLat, Math.abs(p.lat - lat));
      maxDeltaLng = Math.max(maxDeltaLng, Math.abs(p.lng - lng));
    });
    
    if (maxDeltaLat > 0 || maxDeltaLng > 0) {
      const PADDING_FACTOR = 1.3;
      const dLat = maxDeltaLat * PADDING_FACTOR;
      const dLng = maxDeltaLng * PADDING_FACTOR;
      
      const bounds = new mapboxgl.LngLatBounds(
        [lng - dLng, lat - dLat],
        [lng + dLng, lat + dLat]
      );
      
      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14,
        duration: 900,
        pitch: CINEMATIC_PITCH,
        bearing: CINEMATIC_BEARING,
      });
    }
  }, [lat, lng, selectedPois, hoveredPoi]);

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--cream)] text-[var(--muted)] text-sm">
        Mapbox token not configured.
      </div>
    );
  }

  const currentStyleMeta = MAPBOX_STYLES.find(s => s.id === activeStyle) ?? MAPBOX_STYLES[0];

  // Swatch background colors for the layer picker
  const swatchBg: Record<MapboxStyleId, string> = {
    'custom':      'linear-gradient(135deg, #1c2235 0%, #2e3a55 100%)',
    'dark-v11':    'linear-gradient(135deg, #1a1f2e 0%, #2d3450 100%)',
    'light-v11':   'linear-gradient(135deg, #f5ede0 0%, #e8dcc8 100%)',
    'satellite-v9':'linear-gradient(135deg, #1d3a2f 0%, #2a5240 100%)',
    'outdoors-v12':'linear-gradient(135deg, #d4e8c4 0%, #a8c890 100%)',
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Premium Layer Selector */}
      <div
        className="absolute bottom-5 left-4 z-50 flex items-end gap-2"
        onMouseEnter={() => setShowLayers(true)}
        onMouseLeave={() => setShowLayers(false)}
      >
        {/* Trigger button */}
        <button
          className="relative w-[56px] h-[56px] rounded-xl shadow-lg overflow-hidden transition-all duration-200 hover:scale-105 hover:shadow-xl"
          style={{
            background: swatchBg[activeStyle] ?? '#1a1f2e',
            border: `2px solid ${currentStyleMeta.accent}55`,
          }}
          onClick={() => setShowLayers(!showLayers)}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <Layers className="w-4 h-4 text-white drop-shadow" />
            <span className="text-[9px] font-semibold text-white/90 tracking-widest uppercase">Style</span>
          </div>
        </button>

        {/* Expanding panel */}
        <AnimatePresence>
          {showLayers && (
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="flex gap-2 mb-1 p-2.5 rounded-2xl shadow-2xl border"
              style={{ background: 'rgba(12,16,26,0.88)', backdropFilter: 'blur(16px)', borderColor: 'rgba(200,185,126,0.2)' }}
            >
              {MAPBOX_STYLES.map(style => {
                const isActive = activeStyle === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setActiveStyle(style.id as MapboxStyleId)}
                    className="flex flex-col items-center gap-1.5 group"
                    title={style.label}
                  >
                    <div
                      className="w-14 h-12 rounded-lg transition-all duration-250 overflow-hidden relative"
                      style={{
                        background: swatchBg[style.id as MapboxStyleId] ?? '#1a1f2e',
                        border: isActive ? `2px solid ${style.accent}` : '2px solid rgba(255,255,255,0.1)',
                        boxShadow: isActive ? `0 0 0 1px ${style.accent}55, 0 4px 16px rgba(0,0,0,0.5)` : 'none',
                        transform: isActive ? 'scale(0.95)' : 'scale(1)',
                      }}
                    >
                      {/* Mini map preview lines */}
                      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(255,255,255,0.15) 6px, rgba(255,255,255,0.15) 7px)' }} />
                    </div>
                    <span className="text-[9px] tracking-wider uppercase font-medium transition-colors"
                      style={{ color: isActive ? style.accent : 'rgba(255,255,255,0.5)' }}>
                      {style.label}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
