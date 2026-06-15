import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as turf from "@turf/turf";
import {
  useMemo,
  useEffect,
  useRef,
  useState,
  useCallback,
  createElement,
} from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { motion, AnimatePresence } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ArrowLeft, MapPin, Sparkles, Camera, Download, X, List, CircleDot } from "lucide-react";
import type { BrochurePOI } from "@/components/BrochureDialog";
import { toPng } from "html-to-image";
import { useReportStore } from "@/stores/reportStore";
import type { SelectedPoiEntry } from "@/stores/reportStore";
import { usePlacesSearch } from "@/hooks/usePlacesSearch";
import { useMapKeys } from "@/hooks/useMapKeys";
import { CATEGORY_META, resolvePoiMeta } from "@/lib/map-styles";
import { BrochureDialog } from "@/components/BrochureDialog";

export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "Vicinity Analysis — LocateIQ" },
      { name: "description", content: "Intelligent vicinity insights for any location." },
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
  types?: string[];
};

function AnalysisPage() {
  const navigate = useNavigate();
  const coordinates = useReportStore((s) => s.coordinates);
  const locationReport = useReportStore((s) => s.locationReport);
  const isGenerating = useReportStore((s) => s.isGenerating);
  const mapProvider = useReportStore((s) => s.mapProvider);
  const setMapProvider = useReportStore((s) => s.setMapProvider);
  const selectedPois = useReportStore((s) => s.selectedPois);
  const togglePoi = useReportStore((s) => s.togglePoi);
  const hoveredPoi = useReportStore((s) => s.hoveredPoi);
  const setHoveredPoi = useReportStore((s) => s.setHoveredPoi);
  const resetAnalysis = useReportStore((s) => s.resetAnalysis);
  const [isBrochureOpen, setIsBrochureOpen] = useState(false);
  const [capturedMapImageUrl, setCapturedMapImageUrl] = useState<string>("");
  const [isMapboxImageOpen, setIsMapboxImageOpen] = useState(false);
  const [isMapboxImageTopRightOpen, setIsMapboxImageTopRightOpen] = useState(false);
  const [isMapboxImageNoLabelsOpen, setIsMapboxImageNoLabelsOpen] = useState(false);
  const [showDistanceRings, setShowDistanceRings] = useState(false);
  const keys = useMapKeys();

  usePlacesSearch();

  useEffect(() => {
    if (!coordinates) navigate({ to: "/" });
  }, [coordinates, navigate]);

  // Clear all analysis state when the user leaves this page
  useEffect(() => {
    return () => {
      resetAnalysis();
    };
  }, [resetAnalysis]);

  const serial = locationReport?.reportId.replace(/-/g, "").slice(0, 4).toUpperCase() ?? "----";
  const reportId = locationReport?.reportId ?? `VIC-2026-${serial}`;

  const brochurePOIs: BrochurePOI[] = useMemo(() => {
    return Object.values(selectedPois).flat().map((p) => ({
      name: p.name,
      type: p.type,
      distanceKm: p.distanceKm,
    }));
  }, [selectedPois]);

  const handleGenerateBrochure = (imageDataUrl: string) => {
    setCapturedMapImageUrl(imageDataUrl);
    setIsBrochureOpen(true);
  };

  const allPois: PoiRow[] = useMemo(() => {
    if (!locationReport) return [];
    const flat: PoiRow[] = locationReport.pois.flatMap((g) =>
      g.items.map((it) => ({
        ...it,
        type: g.type,
        id: `${g.type}|${it.name}|${it.lat.toFixed(5)}|${it.lng.toFixed(5)}`,
      })),
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
      togglePoi({
        id: p.id,
        name: p.name,
        type: p.type,
        lat: p.lat,
        lng: p.lng,
        distanceKm: p.distanceKm,
        types: p.types,
      });
    },
    [togglePoi],
  );

  if (!coordinates) return null;

  return (
    <main className="min-h-screen bg-[var(--cream)] font-body pb-32">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-[#e8e2d4]">
        <button
          onClick={() => navigate({ to: "/" })}
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
          style={{ height: "48vh" }}
        >
          <MapView showDistanceRings={showDistanceRings} />

          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-md shadow font-mono text-[11px] text-[var(--navy)]">
            {coordinates.lat.toFixed(5)}° N, {coordinates.lng.toFixed(5)}° E
          </div>

          {/* Selected POIs List (Top Right) */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 max-h-[calc(48vh-80px)] overflow-y-auto pointer-events-none [&::-webkit-scrollbar]:hidden z-50">
            {Object.values(selectedPois).flat().sort((a, b) => a.distanceKm - b.distanceKm).map((poi) => {
              const meta = resolvePoiMeta(poi.type, poi.types);
              const Icon = meta.Icon;
              return (
                <div 
                  key={poi.id} 
                  className="flex items-center gap-2 bg-white/95 backdrop-blur px-3 py-2 rounded-md shadow pointer-events-auto border border-[#e8e2d4]"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
                  <span className="text-[12px] font-medium text-[var(--navy)] max-w-[140px] truncate" title={poi.name}>
                    {poi.name}
                  </span>
                  <span className="text-[11px] font-bold shrink-0" style={{ color: meta.color }}>
                    {poi.distanceKm.toFixed(1)}km
                  </span>
                </div>
              );
            })}
          </div>

          {/* Map provider switcher */}
          <div className="absolute bottom-4 right-4 flex gap-1 bg-white/95 backdrop-blur rounded-3xl p-1 shadow flex-wrap max-w-xl justify-end">
            {(["mapbox-v1", "mapbox-v2", "mapbox-v3", "mapbox-coast", "mapbox-skeleton"] as const).map((p) => {
              const active = mapProvider === p;
              return (
                <button
                  key={p}
                  onClick={() => setMapProvider(p)}
                  className={`text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full transition ${
                    active
                      ? "bg-[var(--navy)] text-white"
                      : "text-[var(--navy)] hover:bg-[var(--cream)]"
                  }`}
                >
                  {p === "mapbox-v1" ? "Mapbox v1" : 
                   p === "mapbox-v2" ? "Mapbox v2" : 
                   p === "mapbox-v3" ? "Mapbox v3" : 
                   p === "mapbox-coast" ? "Coastal" : 
                   "Skeleton"}
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

        {/* Style selection + Brochure CTA below map */}
        <div className="mt-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-2">
            {/* Show Distance Rings — always visible */}
            <button
              id="show-distance-rings-btn"
              onClick={() => setShowDistanceRings((v) => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border hover:shadow-md shadow-sm"
              style={{
                background: showDistanceRings
                  ? "linear-gradient(135deg, #1a56db15 0%, #1a56db08 100%)"
                  : "linear-gradient(135deg, #fdfbf7 0%, #ffffff 100%)",
                borderColor: showDistanceRings ? "#1a56db44" : "#e8e2d4",
                color: showDistanceRings ? "#1a56db" : "var(--navy)",
                letterSpacing: "-0.01em",
              }}
              title={showDistanceRings ? "Hide distance rings" : "Show distance rings (1/2/3/5 km)"}
            >
              <CircleDot className="w-4 h-4" style={{ color: showDistanceRings ? "#1a56db" : "var(--gold)" }} />
              {showDistanceRings ? "Hide Circles" : "Show Circles"}
            </button>
            {/* Capture Mapbox Image — only visible in Mapbox mode */}
            {mapProvider.startsWith("mapbox") && (
              <>
                <button
                  id="capture-mapbox-image-btn"
                  onClick={() => setIsMapboxImageOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border hover:shadow-md shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, #fdfbf7 0%, #ffffff 100%)",
                    borderColor: "#e8e2d4",
                    color: "var(--navy)",
                    letterSpacing: "-0.01em",
                  }}
                  title="Capture current Mapbox view as a static image"
                >
                  <Camera className="w-4 h-4 text-[var(--gold)]" />
                  Capture Map Image
                </button>
                <button
                  id="capture-labels-separately-btn"
                  onClick={() => setIsMapboxImageTopRightOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border hover:shadow-md shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, #fdfbf7 0%, #ffffff 100%)",
                    borderColor: "#e8e2d4",
                    color: "var(--navy)",
                    letterSpacing: "-0.01em",
                  }}
                  title="Capture image with labels positioned on the top right"
                >
                  <List className="w-4 h-4 text-[var(--gold)]" />
                  Capture Labels Separately
                </button>
                <button
                  id="capture-no-labels-btn"
                  onClick={() => setIsMapboxImageNoLabelsOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border hover:shadow-md shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, #fdfbf7 0%, #ffffff 100%)",
                    borderColor: "#e8e2d4",
                    color: "var(--navy)",
                    letterSpacing: "-0.01em",
                  }}
                  title="Capture image with icons only — no text labels"
                >
                  <MapPin className="w-4 h-4 text-[var(--gold)]" />
                  Capture Without Text Labels
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Brochure Dialog */}
      <BrochureDialog
        isOpen={isBrochureOpen}
        onClose={() => setIsBrochureOpen(false)}
        reportId={reportId}
        mapImageUrl={capturedMapImageUrl}
        sourceCoordinates={coordinates ?? undefined}
        nearbyPOIs={brochurePOIs}
      />

      {/* Mapbox Static Image Dialog */}
      {isMapboxImageOpen && (
        <MapboxImageDialog
          open={isMapboxImageOpen}
          onClose={() => setIsMapboxImageOpen(false)}
          lat={coordinates.lat}
          lng={coordinates.lng}
          token={keys?.mapboxToken}
          selectedPois={selectedPois}
          labelsPosition="on-marker"
          showDistanceRings={showDistanceRings}
          onGenerateBrochure={handleGenerateBrochure}
        />
      )}

      {/* Mapbox Static Image Dialog (Top-Right Labels) */}
      {isMapboxImageTopRightOpen && (
        <MapboxImageDialog
          open={isMapboxImageTopRightOpen}
          onClose={() => setIsMapboxImageTopRightOpen(false)}
          lat={coordinates.lat}
          lng={coordinates.lng}
          token={keys?.mapboxToken}
          selectedPois={selectedPois}
          labelsPosition="top-right"
          showDistanceRings={showDistanceRings}
          onGenerateBrochure={handleGenerateBrochure}
        />
      )}

      {/* Mapbox Static Image Dialog (No Labels) */}
      {isMapboxImageNoLabelsOpen && (
        <MapboxImageDialog
          open={isMapboxImageNoLabelsOpen}
          onClose={() => setIsMapboxImageNoLabelsOpen(false)}
          lat={coordinates.lat}
          lng={coordinates.lng}
          token={keys?.mapboxToken}
          selectedPois={selectedPois}
          labelsPosition="none"
          showDistanceRings={showDistanceRings}
          onGenerateBrochure={handleGenerateBrochure}
        />
      )}

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
            Check any locations to pin them on the map — select multiple per category
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
              const meta = resolvePoiMeta(type);
              const Icon = meta.Icon;
              const selectedInCategory = selectedPois[type] ?? [];
              const pinnedCount = selectedInCategory.length;

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
                    {pinnedCount > 0 && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${meta.color}18`, color: meta.color }}
                      >
                        {pinnedCount} pinned
                      </span>
                    )}
                    <div className="h-px flex-1 bg-gradient-to-r from-[#e8e2d4] to-transparent ml-2" />
                  </div>

                  {/* Cards grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((p) => {
                      const isSelected = selectedInCategory.some((s) => s.id === p.id);
                      const isHovered = hoveredPoi?.id === p.id;
                      const poiMeta = resolvePoiMeta(type, p.types);
                      const PoiIcon = poiMeta.Icon;

                      return (
                        <motion.button
                          key={p.id}
                          onClick={() => handleSelect(p)}
                          whileHover={{ scale: 1.015 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className={`
                            w-full text-left bg-white rounded-xl p-4 border transition-all duration-200
                            flex items-start gap-3 cursor-pointer group relative
                            ${
                              isSelected
                                ? "shadow-md"
                                : isHovered
                                  ? "shadow-md border-[#d4cec5]"
                                  : "shadow-sm border-[#e8e2d4] hover:shadow-md hover:border-[#d4cec5]"
                            }
                          `}
                          style={
                            isSelected
                              ? {
                                  borderColor: poiMeta.color,
                                  boxShadow: `0 0 0 2px ${poiMeta.color}25, 0 4px 12px ${poiMeta.color}15`,
                                }
                              : {}
                          }
                        >
                          {/* Checkbox indicator */}
                          <div className="shrink-0 mt-0.5 flex items-center justify-center">
                            <div
                              className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200"
                              style={{
                                borderColor: isSelected ? poiMeta.color : "#d4cec5",
                                background: isSelected ? poiMeta.color : "transparent",
                              }}
                            >
                              {isSelected && (
                                <svg
                                  width="11"
                                  height="8"
                                  viewBox="0 0 11 8"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M1 3.5L4 6.5L10 1"
                                    stroke="white"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Category icon */}
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                            style={{
                              background: isSelected ? `${poiMeta.color}20` : "#faf8f4",
                              border: `1px solid ${isSelected ? poiMeta.color + "40" : "#f0ebe0"}`,
                            }}
                          >
                            <PoiIcon className="w-4 h-4" style={{ color: poiMeta.color }} />
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

function MapView({ showDistanceRings }: { showDistanceRings?: boolean }) {
  const coordinates = useReportStore((s) => s.coordinates)!;
  const mapProvider = useReportStore((s) => s.mapProvider);
  const setHoveredPoi = useReportStore((s) => s.setHoveredPoi);
  const keys = useMapKeys();

  // Fix 3: Clear hovered state whenever the provider changes so no phantom
  // hover marker bleeds from one map implementation to the other.
  useEffect(() => {
    setHoveredPoi(null);
  }, [mapProvider, setHoveredPoi]);

  return <MapboxMap lat={coordinates.lat} lng={coordinates.lng} token={keys?.mapboxToken} showDistanceRings={showDistanceRings} provider={mapProvider} />;
}

// Direct mapping from mapProvider → Mapbox style URLs
// Each provider value is its own style — no indirection needed.
const MAPBOX_PROVIDER_STYLES: Record<string, { url: string; staticId: string }> = {
  "mapbox-v1":         { url: "mapbox://styles/sharath-io/cmq02f0dc000o01qw8c2edjor", staticId: "sharath-io/cmq02f0dc000o01qw8c2edjor" },
  "mapbox-v2":         { url: "mapbox://styles/sharath-io/cmq9itt8r002801s911meehvf", staticId: "sharath-io/cmq9itt8r002801s911meehvf" },
  "mapbox-v3":         { url: "mapbox://styles/sharath-io/cmqcb7oh1008j01qxheqi92cb", staticId: "sharath-io/cmqcb7oh1008j01qxheqi92cb" },
  "mapbox-coast":      { url: "mapbox://styles/sharath-io/cmqax8azk003b01qz8dt520di", staticId: "sharath-io/cmqax8azk003b01qz8dt520di" },
  "mapbox-skeleton":   { url: "mapbox://styles/sharath-io/cmqb95m8a000i01shbkcuhzcb", staticId: "sharath-io/cmqb95m8a000i01shbkcuhzcb" },
};

// Flat 2D camera settings
const CINEMATIC_PITCH = 0;
const CINEMATIC_BEARING = 0;
const CINEMATIC_ZOOM = 14;

// Layer IDs to hide: business POIs, transit labels, dense icons
const LAYERS_TO_HIDE = [
  "poi-label",
  "transit-label",
  "road-label",
  "airport-label",
  "settlement-minor-label",
  "natural-point-label",
];

// Layers to reduce opacity (subtle, not hidden)
const ROAD_LAYERS_TO_MUTE = [
  "road-minor",
  "road-minor-case",
  "road-service",
  "road-service-case",
  "road-path",
];

// Apply cinematic layer overrides after style loads
function applyCinematicLayerOverrides(map: mapboxgl.Map, isDark: boolean) {
  const allLayers = map.getStyle()?.layers ?? [];

  // Hide noisy POI / transit / dense label layers
  for (const layerId of LAYERS_TO_HIDE) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", "none");
    }
  }

  // Keep locality/city/major road/water labels — selectively re-enable
  const keepVisible = [
    "country-label",
    "state-label",
    "settlement-major-label",
    "settlement-subdivision-label",
    "waterway-label",
    "water-line-label",
    "water-point-label",
  ];
  for (const layerId of keepVisible) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", "visible");
    }
  }

  // Mute minor road layers (reduce opacity)
  for (const layerId of ROAD_LAYERS_TO_MUTE) {
    if (map.getLayer(layerId)) {
      try {
        map.setPaintProperty(layerId, "line-opacity", 0.25);
      } catch {
        /* not a line layer */
      }
    }
  }

  // 2D mode — no 3D buildings

}

// ── Helper: build a POI marker DOM element ────────────────────────────────
function createPoiMarkerEl(poi: SelectedPoiEntry, options: { opacity?: number } = {}) {
  const meta = resolvePoiMeta(poi.type, poi.types);
  let iconSvgStr = "";
  try {
    iconSvgStr = renderToStaticMarkup(
      createElement(meta.Icon, { size: 14, color: "white", strokeWidth: 2.5 } as never),
    );
  } catch {
    /* fallback to empty */
  }

  const el = document.createElement("div");
  const opacity = options.opacity ?? 1;
  el.style.cssText = `
    width: 30px;
    height: 30px;
    opacity: ${opacity};
    cursor: pointer;
    transition: all 0.2s ease;
  `;

  el.innerHTML = `
    <div style="
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background-color: ${meta.color};
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: ${opacity < 1 ? `0 4px 16px ${meta.color}50` : "0 2px 8px rgba(0,0,0,0.28)"};
    ">
      ${iconSvgStr}
    </div>
  `;
  return { el, meta };
}

interface CustomMarker extends mapboxgl.Marker {
  __poiId?: string;
}

// Ring distances in km for the concentric circles overlay
const RING_DISTANCES_KM = [1, 3, 5];
const RING_COLOR = "#1a56db";

function MapboxMap({ lat, lng, token, showDistanceRings, provider }: { lat: number; lng: number; token?: string; showDistanceRings?: boolean; provider: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, CustomMarker>>(new Map());
  const mapProvider = useReportStore((s) => s.mapProvider);
  // Ref to track the latest showDistanceRings value inside closures (avoids stale capture)
  const showDistanceRingsRef = useRef(showDistanceRings);
  useEffect(() => { showDistanceRingsRef.current = showDistanceRings; }, [showDistanceRings]);

  const selectedPoisRaw = useReportStore((s) => s.selectedPois);
  // Flatten multi-select arrays to a single list for map markers
  const selectedPoisById = useMemo(() => {
    const flat: Record<string, import("@/stores/reportStore").SelectedPoiEntry> = {};
    for (const arr of Object.values(selectedPoisRaw)) {
      for (const poi of arr) {
        flat[poi.id] = poi;
      }
    }
    return flat;
  }, [selectedPoisRaw]);
  const hoveredPoi = useReportStore((s) => s.hoveredPoi);
  const hoveredMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // ── Shared: add all selected POI markers to map (clears existing first) ──
  const syncSelectedMarkersToMap = useCallback((map: mapboxgl.Map, pois: typeof selectedPoisById) => {
    // Remove any existing POI markers from the DOM, then clear the ref.
    // (When called after a style change the DOM markers are already gone,
    //  but when called from incremental sync they need explicit removal.)
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    for (const [poiId, poi] of Object.entries(pois)) {
      const { el } = createPoiMarkerEl(poi);

      const popup = new mapboxgl.Popup({
        offset: 24,
        closeButton: false,
        closeOnClick: false,
        className: "poi-popup",
      }).setHTML(`<span>${poi.name}</span>`);

      el.addEventListener(
        "mouseenter",
        () => marker.getPopup()?.isOpen() === false && marker.togglePopup(),
      );
      el.addEventListener("mouseleave", () => marker.getPopup()?.isOpen() && marker.togglePopup());

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([poi.lng, poi.lat])
        .setPopup(popup)
        .addTo(map);

      (marker as CustomMarker).__poiId = poiId;
      markersRef.current.set(poiId, marker as CustomMarker);
    }
  }, []);

  // Init map once — cinematic real-estate camera
  useEffect(() => {
    if (!token || !containerRef.current) return;
    mapboxgl.accessToken = token;
    const styleUrl = MAPBOX_PROVIDER_STYLES[mapProvider]?.url ?? MAPBOX_PROVIDER_STYLES["mapbox-v1"].url;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [lng, lat],
      zoom: CINEMATIC_ZOOM,
      pitch: CINEMATIC_PITCH,
      bearing: CINEMATIC_BEARING,
      antialias: true,
    });
    mapRef.current = map;

    // Custom elegant site pin (gold ring + dot)
    const addSitePin = () => {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 38px;
        height: 46px;
        cursor: pointer;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.45));
      `;
      el.innerHTML = `
        <svg width="38" height="46" viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 2C10.16 2 3 9.16 3 18c0 12.5 15.2 25.8 15.4 26 .33.27.87.27 1.2 0C19.8 43.8 35 30.5 35 18 35 9.16 27.84 2 19 2Z"
            fill="#e53935" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="19" cy="18" r="5" fill="rgba(255,255,255,0.95)"/>
          <circle cx="19" cy="18" r="2.5" fill="#e53935"/>
        </svg>
      `;
      new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([lng, lat]).addTo(map);
    };

    // Fix 1: Read the store directly inside the load callback to guarantee we
    // have the latest snapshot — not through a ref that may be stale.
    const hydrateMarkers = () => {
      const latestPois = useReportStore.getState().selectedPois;
      const flatPois: Record<string, import("@/stores/reportStore").SelectedPoiEntry> = {};
      for (const arr of Object.values(latestPois)) {
        for (const poi of arr) {
          flatPois[poi.id] = poi;
        }
      }

      // Explicitly remove any existing DOM markers before clearing the ref.
      // (Mapbox removes GL layers on setStyle but DOM markers survive — we must
      // clean them up ourselves to prevent orphans.)
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      addSitePin();
      syncSelectedMarkersToMap(map, flatPois);
      // Apply cinematic layer overrides after every style.load
      try {
        applyCinematicLayerOverrides(map, true);
      } catch {
        /* ignore if layers not ready */
      }
      // Re-add distance rings if they were visible before the style switch
      if (showDistanceRingsRef.current) {
        const center: [number, number] = [lng, lat];
        RING_DISTANCES_KM.forEach((km, i) => {
          const srcId = `ring-src-${km}`;
          const fillId = `ring-fill-${km}`;
          const strokeId = `ring-stroke-${km}`;
          const labelId = `ring-label-${km}`;
          const labelSrcId = `ring-label-src-${km}`;
          if (map.getLayer(labelId)) map.removeLayer(labelId);
          if (map.getLayer(strokeId)) map.removeLayer(strokeId);
          if (map.getLayer(fillId)) map.removeLayer(fillId);
          if (map.getSource(labelSrcId)) map.removeSource(labelSrcId);
          if (map.getSource(srcId)) map.removeSource(srcId);
          const circle = turf.circle(center, km, { units: "kilometers", steps: 64 });
          map.addSource(srcId, { type: "geojson", data: circle });
          map.addLayer({ id: fillId, type: "fill", source: srcId, paint: { "fill-color": RING_COLOR, "fill-opacity": 0.02 * (RING_DISTANCES_KM.length - i) } });
          map.addLayer({ id: strokeId, type: "line", source: srcId, paint: { "line-color": RING_COLOR, "line-width": 1, "line-dasharray": [4, 3], "line-opacity": 0.6 } });
          const labelPoint = turf.destination(center, km, 0, { units: "kilometers" });
          map.addSource(labelSrcId, { type: "geojson", data: labelPoint });
          map.addLayer({ id: labelId, type: "symbol", source: labelSrcId, layout: { "text-field": `${km} km`, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-size": 11, "text-anchor": "bottom", "text-offset": [0, -0.5] }, paint: { "text-color": RING_COLOR, "text-halo-color": "rgba(255,255,255,0.9)", "text-halo-width": 1.5 } });
        });
      }
    };

    // 'style.load' fires exactly once on initial map load AND once after every
    // setStyle() call. Using it alone (instead of also listening to 'load')
    // prevents hydrateMarkers from running twice on mount, which was causing
    // duplicate markers on the map even though the store holds only one POI
    // per category.
    map.on("style.load", hydrateMarkers);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, token]);

  // Update map style when provider changes without re-initializing the map
  useEffect(() => {
    if (!mapRef.current) return;
    const styleUrl = MAPBOX_PROVIDER_STYLES[provider]?.url ?? MAPBOX_PROVIDER_STYLES["mapbox-v1"].url;
    mapRef.current.setStyle(styleUrl);
  }, [provider]);

  // Sync selected POI markers imperatively whenever selections change.
  // style.load handles re-hydration after style switches AND initial mount,
  // so skip this effect while the style is still loading to avoid adding
  // a marker that hydrateMarkers will later duplicate.
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const currentIds = new Set(Object.keys(selectedPoisById));
    const existingIds = new Set(markersRef.current.keys());

    // Remove markers no longer selected
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        markersRef.current.get(id)?.remove();
        markersRef.current.delete(id);
      }
    }

    // Add new markers / update changed ones
    for (const [poiId, poi] of Object.entries(selectedPoisById)) {
      if (!markersRef.current.has(poiId)) {
        const { el } = createPoiMarkerEl(poi);

        const popup = new mapboxgl.Popup({
          offset: 24,
          closeButton: false,
          closeOnClick: false,
          className: "poi-popup",
        }).setHTML(`<span>${poi.name}</span>`);

        el.addEventListener(
          "mouseenter",
          () => marker.getPopup()?.isOpen() === false && marker.togglePopup(),
        );
        el.addEventListener(
          "mouseleave",
          () => marker.getPopup()?.isOpen() && marker.togglePopup(),
        );

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([poi.lng, poi.lat])
          .setPopup(popup)
          .addTo(map);

        (marker as CustomMarker).__poiId = poiId;
        markersRef.current.set(poiId, marker as CustomMarker);
      }
    }
  }, [selectedPoisById]);

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
    const isAlreadySelected = !!selectedPoisById[hoveredPoi.id];
    if (isAlreadySelected) return;

    const { el } = createPoiMarkerEl(hoveredPoi, { opacity: 0.65 });

    const popup = new mapboxgl.Popup({
      offset: 28,
      closeButton: false,
      closeOnClick: false,
      className: "poi-popup",
    }).setHTML(`<span>${hoveredPoi.name}</span>`);

    const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat([hoveredPoi.lng, hoveredPoi.lat])
      .setPopup(popup)
      .addTo(map);

    marker.togglePopup(); // show tooltip immediately
    hoveredMarkerRef.current = marker;

    return () => {
      marker.remove();
      hoveredMarkerRef.current = null;
    };
  }, [hoveredPoi, selectedPoisById]);

  // Zoom to fit bounds while keeping center exactly at `lng, lat`
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const activePois = [...Object.values(selectedPoisById), ...(hoveredPoi ? [hoveredPoi] : [])];

    if (activePois.length === 0) {
      map.easeTo({
        center: [lng, lat],
        zoom: CINEMATIC_ZOOM,
        pitch: CINEMATIC_PITCH,
        bearing: CINEMATIC_BEARING,
        duration: 900,
      });
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

      const bounds = new mapboxgl.LngLatBounds([lng - dLng, lat - dLat], [lng + dLng, lat + dLat]);

      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14,
        duration: 900,
        pitch: CINEMATIC_PITCH,
        bearing: CINEMATIC_BEARING,
      });
    }
  }, [lat, lng, selectedPoisById, hoveredPoi]);

  // ── Distance ring layers (Turf.js GeoJSON circles) ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) return;

    const center: [number, number] = [lng, lat];

    if (showDistanceRings) {
      RING_DISTANCES_KM.forEach((km, i) => {
        const srcId = `ring-src-${km}`;
        const fillId = `ring-fill-${km}`;
        const strokeId = `ring-stroke-${km}`;
        const labelId = `ring-label-${km}`;

        // Remove any existing layers/sources first
        if (map.getLayer(labelId)) map.removeLayer(labelId);
        if (map.getLayer(strokeId)) map.removeLayer(strokeId);
        if (map.getLayer(fillId)) map.removeLayer(fillId);
        if (map.getSource(srcId)) map.removeSource(srcId);

        const circle = turf.circle(center, km, { units: "kilometers", steps: 64 });
        map.addSource(srcId, { type: "geojson", data: circle });

        // Subtle fill band — inner rings slightly darker
        map.addLayer({
          id: fillId,
          type: "fill",
          source: srcId,
          paint: {
            "fill-color": RING_COLOR,
            "fill-opacity": 0.02 * (RING_DISTANCES_KM.length - i),
          },
        });

        // Dashed stroke
        map.addLayer({
          id: strokeId,
          type: "line",
          source: srcId,
          paint: {
            "line-color": RING_COLOR,
            "line-width": 1,
            "line-dasharray": [4, 3],
            "line-opacity": 0.6,
          },
        });

        // Distance label — a symbol layer placed at top of the circle
        const labelPoint = turf.destination(center, km, 0, { units: "kilometers" });
        const labelSrcId = `ring-label-src-${km}`;
        if (map.getLayer(labelId)) map.removeLayer(labelId);
        if (map.getSource(labelSrcId)) map.removeSource(labelSrcId);
        map.addSource(labelSrcId, { type: "geojson", data: labelPoint });
        map.addLayer({
          id: labelId,
          type: "symbol",
          source: labelSrcId,
          layout: {
            "text-field": `${km} km`,
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-size": 11,
            "text-anchor": "bottom",
            "text-offset": [0, -0.5],
          },
          paint: {
            "text-color": RING_COLOR,
            "text-halo-color": "rgba(255,255,255,0.9)",
            "text-halo-width": 1.5,
          },
        });
      });
    } else {
      // Remove rings + labels if toggled off
      RING_DISTANCES_KM.forEach((km) => {
        const srcId = `ring-src-${km}`;
        const fillId = `ring-fill-${km}`;
        const strokeId = `ring-stroke-${km}`;
        const labelId = `ring-label-${km}`;
        const labelSrcId = `ring-label-src-${km}`;
        if (map.getLayer(labelId)) map.removeLayer(labelId);
        if (map.getLayer(strokeId)) map.removeLayer(strokeId);
        if (map.getLayer(fillId)) map.removeLayer(fillId);
        if (map.getSource(labelSrcId)) map.removeSource(labelSrcId);
        if (map.getSource(srcId)) map.removeSource(srcId);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDistanceRings, lat, lng]);

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--cream)] text-[var(--muted)] text-sm">
        Mapbox token not configured.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

// ── Mapbox Static Images API helper ──────────────────────────────────────────



function fitZoom(center: { lat: number; lng: number }, points: { lat: number; lng: number }[], widthPx: number, heightPx: number) {
  if (points.length === 0) return 14;
  let minLat = center.lat; let maxLat = center.lat;
  let minLng = center.lng; let maxLng = center.lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;
  if (latDiff === 0 && lngDiff === 0) return 14;
  const latZoom = Math.log2((heightPx * 360) / (latDiff * 512));
  const lngZoom = Math.log2((widthPx * 360) / (lngDiff * 512));
  const zoom = Math.min(latZoom, lngZoom);
  return Math.max(10, Math.min(15, +zoom.toFixed(2))) - 0.6;
}

function latLngToPixel(lat: number, lng: number, centerLat: number, centerLng: number, zoom: number, widthPx: number, heightPx: number) {
  const TILE = 512;
  const scale = TILE * Math.pow(2, zoom) / 360;
  const mercLat = (lat: number) => {
    const rad = (lat * Math.PI) / 180;
    return (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + rad / 2));
  };
  const cx = (centerLng + 180) * scale;
  const cy = (180 - mercLat(centerLat)) * scale;
  const px = (lng + 180) * scale;
  const py = (180 - mercLat(lat)) * scale;
  return {
    x: widthPx / 2 + (px - cx),
    y: heightPx / 2 + (py - cy),
  };
}

function buildStaticMapUrl(opts: {
  token: string;
  lng: number;
  lat: number;
  mapProvider: string;
  selectedPois: Record<string, SelectedPoiEntry[]>;
  width?: number;
  height?: number;
  showDistanceRings?: boolean;
}): { url: string, zoom: number } {
  const { token, lng, lat, mapProvider, selectedPois, width = 1200, height = 700, showDistanceRings } = opts;

  const staticStyle = MAPBOX_PROVIDER_STYLES[mapProvider]?.staticId ?? MAPBOX_PROVIDER_STYLES["mapbox-v1"].staticId;
  const overlays: string[] = [];
  overlays.push(`pin-l+e53935(${lng.toFixed(6)},${lat.toFixed(6)})`);

  const poiList = Object.values(selectedPois).flat().map((p) => ({ lat: p.lat, lng: p.lng }));
  if (showDistanceRings) {
    const maxRingKm = Math.max(...RING_DISTANCES_KM);
    const dLat = maxRingKm / 111.32;
    const dLng = maxRingKm / (111.32 * Math.cos(lat * Math.PI / 180));
    poiList.push({ lat: lat + dLat, lng: lng });
    poiList.push({ lat: lat - dLat, lng: lng });
    poiList.push({ lat: lat, lng: lng + dLng });
    poiList.push({ lat: lat, lng: lng - dLng });
  }
  const zoom = fitZoom({ lat, lng }, poiList, width, height);

  const overlayStr = overlays.join(",");

  const url = `https://api.mapbox.com/styles/v1/${staticStyle}/static/` +
    `${overlayStr}/` +
    `${lng},${lat},${zoom},0/` +
    `${width}x${height}@2x` +
    `?access_token=${token}`;
    
  return { url, zoom };
}


// ── Mapbox Static Image Dialog ────────────────────────────────────────────────

interface MapboxImageDialogProps {
  open: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  token?: string;
  selectedPois: Record<string, SelectedPoiEntry[]>;
  labelsPosition?: "on-marker" | "top-right" | "none";
  showDistanceRings?: boolean;
  onGenerateBrochure?: (imageDataUrl: string) => void;
}

function MapboxImageDialog({ open, onClose, lat, lng, token, selectedPois, labelsPosition = "on-marker", showDistanceRings, onGenerateBrochure }: MapboxImageDialogProps) {
  const mapProvider = useReportStore((s) => s.mapProvider);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCapturingBrochure, setIsCapturingBrochure] = useState(false);

  const staticData = token
    ? buildStaticMapUrl({
        token,
        lng,
        lat,
        mapProvider,
        selectedPois,
        showDistanceRings,
      })
    : null;

  const staticUrl = staticData?.url;
  const zoom = staticData?.zoom ?? 14;

  const poiCount = Object.values(selectedPois).flat().length;
  const flatPois = Object.values(selectedPois).flat();
  const captureRef = useRef<HTMLDivElement>(null);

  const [dims, setDims] = useState({ w: 1200, h: 700 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    obs.observe(mapContainerRef.current);
    return () => obs.disconnect();
  }, []);

  const handleDownload = async () => {
    if (!mapContainerRef.current) return;
    setIsDownloading(true);
    try {
      const el = mapContainerRef.current;
      const dataUrl = await toPng(el, { cacheBust: true, pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `vicinity-snapshot-${lat.toFixed(4)}-${lng.toFixed(4)}.png`;
      a.click();
    } catch {
      if (staticUrl) window.open(staticUrl, "_blank");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleGenerateBrochure = async () => {
    if (!captureRef.current || !onGenerateBrochure) return;
    setIsCapturingBrochure(true);
    try {
      // Capture only the map portion (inside captureRef, excluding header+footer)
      const mapEl = mapContainerRef.current ?? captureRef.current;
      const dataUrl = await toPng(mapEl, { cacheBust: true, pixelRatio: 2 });
      onGenerateBrochure(dataUrl);
      onClose();
    } catch (e) {
      console.error("Brochure capture failed:", e);
    } finally {
      setIsCapturingBrochure(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              ref={captureRef}
              className="pointer-events-auto w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              style={{
                background: "linear-gradient(160deg, #0c1018 0%, #141927 60%, #0f1520 100%)",
                border: "1px solid rgba(200,185,126,0.18)",
                maxHeight: "90vh",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-7 py-5 shrink-0"
                style={{ borderBottom: "1px solid rgba(200,185,126,0.12)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(200,185,126,0.12)", border: "1px solid rgba(200,185,126,0.25)" }}
                  >
                    <MapPin className="w-4 h-4" style={{ color: "#c8b97e" }} />
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.22em] uppercase font-medium" style={{ color: "#c8b97e99" }}>
                      Vicinity Snapshot
                    </div>
                    <h2 className="text-[17px] font-semibold text-white leading-tight mt-0.5">
                      Location Intelligence Map
                    </h2>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Map Image */}
              <div ref={mapContainerRef} className="relative flex-1 overflow-hidden min-h-0" style={{ minHeight: "340px" }}>
                {/* Shimmer while loading */}
                {!imgLoaded && !imgError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(110deg, #0c1018 30%, #1a2336 50%, #0c1018 70%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.6s infinite linear",
                      }}
                    />
                    <style>{`@keyframes shimmer { from { background-position: 200% center } to { background-position: -200% center } }`}</style>
                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: "#c8b97e55", borderTopColor: "#c8b97e" }}
                      />
                      <span className="text-[12px] text-white/40 tracking-wide">Rendering map…</span>
                    </div>
                  </div>
                )}

                {imgError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/40">
                    <Camera className="w-10 h-10" />
                    <p className="text-[13px]">Unable to load map image.</p>
                    {staticUrl && (
                      <a
                        href={staticUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] underline"
                        style={{ color: "#c8b97e" }}
                      >
                        Open in browser ↗
                      </a>
                    )}
                  </div>
                )}

                {staticUrl && (
                  <img
                    src={staticUrl}
                    alt="Mapbox static map snapshot"
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover"
                    style={{ display: imgLoaded ? "block" : "none" }}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                  />
                )}

                {/* HTML Overlays for POIs (Custom Icons + Text Cards) */}
                {imgLoaded && flatPois.map((poi, i) => {
                  const pos = latLngToPixel(poi.lat, poi.lng, lat, lng, zoom, dims.w, dims.h);
                  const meta = resolvePoiMeta(poi.type, poi.types);
                  const Icon = meta.Icon;
                  return (
                    <div key={i} style={{ position: "absolute", left: pos.x, top: pos.y, zIndex: 20 }}>
                      {/* The Map Marker Icon */}
                      <div style={{ 
                        position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)",
                        width: 26, height: 26, borderRadius: "50%", backgroundColor: meta.color, border: "2px solid white", 
                        display: "flex", alignItems: "center", justifyContent: "center", 
                        boxShadow: `0 0 0 3px ${meta.color}40, 0 3px 6px rgba(0,0,0,0.15)`
                      }}>
                        <Icon size={12} color="white" strokeWidth={2.5} />
                      </div>

                      {/* The Label Card (only if on-marker) */}
                      {labelsPosition === "on-marker" && (
                        <div style={{
                          position: "absolute", top: 16, left: -6,
                          background: "white", borderRadius: 5, padding: "3px 6px", 
                          boxShadow: "0 2px 8px rgba(0,0,0,0.15)", borderLeft: `3px solid ${meta.color}`,
                          display: "flex", flexDirection: "column", whiteSpace: "nowrap"
                        }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>{poi.name}</span>
                          <span style={{ fontSize: 8, fontWeight: 700, color: meta.color, lineHeight: 1.2 }}>{poi.distanceKm.toFixed(1)} km</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Top-Right Label List */}
                {imgLoaded && labelsPosition === "top-right" && (
                  <div className="absolute top-4 right-4 flex flex-col gap-2 z-30" style={{ pointerEvents: "none" }}>
                    {flatPois.map((poi, i) => {
                      const meta = resolvePoiMeta(poi.type, poi.types);
                      const Icon = meta.Icon;
                      return (
                        <div key={i} style={{ 
                          display: "flex", alignItems: "center", gap: 8, 
                          background: "white", padding: "6px 12px", borderRadius: 8, 
                          boxShadow: "0 2px 12px rgba(0,0,0,0.15)", whiteSpace: "nowrap" 
                        }}>
                          <div style={{ width: 18, height: 18, borderRadius: "50%", background: meta.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon size={10} color="white" strokeWidth={2.5} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a" }}>{poi.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: meta.color }}>{poi.distanceKm.toFixed(1)} km</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!token && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
                    Mapbox token not available.
                  </div>
                )}

                {/* Distance ring SVG overlay */}
                {imgLoaded && showDistanceRings && (
                  <svg
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
                    viewBox={`0 0 ${dims.w} ${dims.h}`}
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {RING_DISTANCES_KM.map((km, i) => {
                      const cx = dims.w / 2;
                      const cy = dims.h / 2;
                      const northLat = lat + (km / 111.32);
                      const northPx = latLngToPixel(northLat, lng, lat, lng, zoom, dims.w, dims.h);
                      const r = Math.abs(cy - northPx.y);
                      const fillOpacity = 0.02 * (RING_DISTANCES_KM.length - i);
                      // Label at top of each ring
                      const labelX = cx;
                      const labelY = cy - r - 4;
                      const pillW = km >= 10 ? 40 : 34;
                      return (
                        <g key={km}>
                          <circle
                            cx={cx} cy={cy} r={r}
                            fill={`rgba(26,86,219,${fillOpacity})`}
                            stroke={RING_COLOR}
                            strokeWidth={1}
                            strokeDasharray="5 3"
                            strokeOpacity={0.6}
                          />
                          <rect
                            x={labelX - pillW / 2} y={labelY - 11}
                            width={pillW} height={16} rx={8}
                            fill={RING_COLOR} opacity={0.88}
                          />
                          <text
                            x={labelX} y={labelY + 0.5}
                            textAnchor="middle"
                            fontSize={9} fontWeight="700" fill="white"
                            fontFamily="Inter,system-ui,sans-serif"
                          >
                            {km} km
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}

              </div>

              {/* Footer — info + download */}
              <div
                className="flex items-center justify-between px-7 py-5 shrink-0"
                style={{ borderTop: "1px solid rgba(200,185,126,0.12)" }}
              >
                {/* Location info */}
                <div>
                  <p className="text-white/90 text-[14px] font-semibold leading-tight">
                    Vicinity Report — Mapbox View
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span
                      className="text-[11px] font-mono px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(200,185,126,0.1)", color: "#c8b97e" }}
                    >
                      {lat.toFixed(5)}° N, {lng.toFixed(5)}° E
                    </span>
                    {poiCount > 0 && (
                      <span className="text-[11px] text-white/40">
                        {poiCount} location{poiCount !== 1 ? "s" : ""} plotted
                      </span>
                    )}
                  </div>
                </div>

                {/* Buttons row */}
                <div className="flex items-center gap-3">
                  {/* Generate Brochure button */}
                  {onGenerateBrochure && (
                    <button
                      id="generate-brochure-from-capture-btn"
                      onClick={handleGenerateBrochure}
                      disabled={!imgLoaded || isCapturingBrochure || isDownloading}
                      className="flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: isCapturingBrochure
                          ? "rgba(15,30,53,0.5)"
                          : "linear-gradient(135deg, #0f1e35 0%, #1d3558 100%)",
                        color: "white",
                        boxShadow: isCapturingBrochure ? "none" : "0 4px 16px rgba(15,30,53,0.4)",
                        border: "1px solid rgba(200,185,126,0.25)",
                      }}
                    >
                      {isCapturingBrochure ? (
                        <>
                          <div
                            className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: "#c8b97e55", borderTopColor: "#c8b97e" }}
                          />
                          Generating…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" style={{ color: "#c8b97e" }} />
                          Generate Brochure
                        </>
                      )}
                    </button>
                  )}

                  {/* Download button */}
                  <button
                    id="download-mapbox-image-btn"
                    onClick={handleDownload}
                    disabled={!staticUrl || isDownloading}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: isDownloading
                        ? "rgba(200,185,126,0.15)"
                        : "linear-gradient(135deg, #c8b97e 0%, #a8975e 100%)",
                      color: isDownloading ? "#c8b97e" : "#0c1018",
                      boxShadow: isDownloading ? "none" : "0 4px 20px rgba(200,185,126,0.35)",
                    }}
                  >
                    {isDownloading ? (
                      <>
                        <div
                          className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                          style={{ borderColor: "#c8b97e55", borderTopColor: "#c8b97e" }}
                        />
                        Downloading…
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download PNG
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
