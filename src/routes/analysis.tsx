import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Camera, List, CircleDot, Minus, Navigation } from "lucide-react";
import type { BrochurePOI } from "@/components/BrochureDialog";
import { useReportStore } from "@/stores/reportStore";
import { usePlacesSearch } from "@/hooks/usePlacesSearch";
import { useMapKeys } from "@/hooks/useMapKeys";
import { resolvePoiMeta } from "@/lib/map-styles";
import { BrochureDialog } from "@/components/BrochureDialog";
import { MapboxMap } from "@/components/MapboxMap";
import { MapboxImageDialog } from "@/components/MapboxImageDialog";
import { MapboxHighwayImageDialog } from "@/components/MapboxHighwayImageDialog";
import { AutoBrochureLoader } from "@/components/AutoBrochureLoader";
import { PoiCategorySection } from "@/components/PoiCategorySection";
import type { PoiRow } from "@/components/PoiCard";
import { fetchNearestHighways, type HighwayInfo } from "@/lib/fetch-highways";
import { HighwayMiniMap } from "@/components/HighwayMiniMap";

export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "Vicinity Analysis — LocateIQ" },
      { name: "description", content: "Intelligent vicinity insights for any location." },
    ],
  }),
  component: AnalysisPage,
});

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
  const clearAllPois = useReportStore((s) => s.clearAllPois);
  const autoBrochureMode = useReportStore((s) => s.autoBrochureMode);
  const setAutoBrochureMode = useReportStore((s) => s.setAutoBrochureMode);
  const [isBrochureOpen, setIsBrochureOpen] = useState(false);
  const [capturedMapImageUrl, setCapturedMapImageUrl] = useState<string>("");
  const [capturedHighwayMapImageUrl, setCapturedHighwayMapImageUrl] = useState<string>("");
  const [isMapboxImageOpen, setIsMapboxImageOpen] = useState(false);
  const [isMapboxImageTopRightOpen, setIsMapboxImageTopRightOpen] = useState(false);
  const [isMapboxImageNoLabelsOpen, setIsMapboxImageNoLabelsOpen] = useState(false);
  const [isHighwayImageOpen, setIsHighwayImageOpen] = useState(false);
  const [showDistanceRings, setShowDistanceRings] = useState(false);
  const [highwayInfo, setHighwayInfo] = useState<HighwayInfo[]>([]);
  const [highwayLoading, setHighwayLoading] = useState(false);
  const [waitingForHighways, setWaitingForHighways] = useState(false);
  const keys = useMapKeys();

  const autoBrochureStep = useReportStore((s) => s.autoBrochureStep);
  const setAutoBrochureStep = useReportStore((s) => s.setAutoBrochureStep);
  
  // Guard: prevent the auto-select effect from running more than once per session
  const autoPoisSelectedRef = useRef(false);

  usePlacesSearch();

  useEffect(() => {
    if (!coordinates) navigate({ to: "/" });
  }, [coordinates, navigate]);

  useEffect(() => {
    if (!coordinates) return;
    setHighwayLoading(true);
    fetchNearestHighways(coordinates.lat, coordinates.lng).then((info) => {
      setHighwayInfo(info);
      setHighwayLoading(false);
    });
  }, [coordinates]);

  // Clear all analysis state when the user leaves this page
  useEffect(() => {
    return () => {
      resetAnalysis();
    };
  }, [resetAnalysis]);

  // ── Auto-brochure: Step 1 → auto-select top 2 POIs per category ────────────
  useEffect(() => {
    if (!autoBrochureMode) return;
    if (!locationReport || isGenerating) return;
    if (autoPoisSelectedRef.current) return; // only run once
    autoPoisSelectedRef.current = true;
    setAutoBrochureStep(1); // "Selecting key POIs..."

    // groupedPois is already sorted by quality score inside the memo below,
    // but we can replicate the same logic here without depending on that memo.
    locationReport.pois.forEach((group) => {
      // Re-create the id formula used by allPois memo
      const toRow = (it: typeof group.items[0]) => ({
        id: `${group.type}|${it.name}|${it.lat.toFixed(5)}|${it.lng.toFixed(5)}`,
        name: it.name,
        type: group.type,
        lat: it.lat,
        lng: it.lng,
        distanceKm: it.distanceKm,
        types: it.types,
      });

      // Sort by score desc, then dist asc
      const sortedByScore = [...group.items].sort((a, b) => {
        const distA = Math.max(0.1, a.distanceKm);
        const distB = Math.max(0.1, b.distanceKm);
        const scoreA = ((a.rating || 0) * (a.userRatingCount || 0)) / distA;
        const scoreB = ((b.rating || 0) * (b.userRatingCount || 0)) / distB;
        const diff = scoreB - scoreA;
        if (diff !== 0) return diff;
        return a.distanceKm - b.distanceKm;
      });

      // Only consider the top 5 POIs that actually get rendered in the UI list
      const top5 = sortedByScore.slice(0, 5);

      if (top5.length > 0) {
        // 1. First choice: The absolute best POI based on the custom score formula
        const bestPoi = top5[0];
        togglePoi(toRow(bestPoi));

        if (top5.length > 1) {
          // 2. Second choice: The nearest POI from the remaining items IN THE TOP 5
          const remaining = top5.slice(1);
          const nearestPoi = remaining.sort((a, b) => a.distanceKm - b.distanceKm)[0];
          togglePoi(toRow(nearestPoi));
        }
      }
    });

    // Step 2 → prepare map view (short delay so markers settle on map)
    setTimeout(() => {
      setAutoBrochureStep(2); // "Preparing map layout..."
    }, 600);

    // Step 3 → open the capture dialog (give map time to render rings)
    setTimeout(() => {
      setAutoBrochureStep(3); // "Capturing map snapshot..."
      setIsMapboxImageNoLabelsOpen(true);
    }, 1400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBrochureMode, locationReport, isGenerating]);


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
    setIsMapboxImageNoLabelsOpen(false);
    setIsMapboxImageOpen(false);
    setIsMapboxImageTopRightOpen(false);

    // After the main map is captured, trigger the highway map capture
    if (autoBrochureMode) {
      setAutoBrochureStep(4); // "Mapping highways..."
      if (highwayLoading) {
        setWaitingForHighways(true);
        return;
      }
    }
    setIsHighwayImageOpen(true);
  };

  useEffect(() => {
    if (waitingForHighways && !highwayLoading) {
      setWaitingForHighways(false);
      setIsHighwayImageOpen(true);
    }
  }, [waitingForHighways, highwayLoading]);

  const handleGenerateHighwayMap = (highwayDataUrl: string) => {
    setCapturedHighwayMapImageUrl(highwayDataUrl);
    setIsHighwayImageOpen(false);

    if (autoBrochureMode) {
      setAutoBrochureStep(5); // "Preparing brochure..."
      setTimeout(() => {
        setIsBrochureOpen(true);
        // Dismiss the auto loader smoothly
        setTimeout(() => setAutoBrochureMode(false), 300);
      }, 1500);
    } else {
      setIsBrochureOpen(true);
    }
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
    return Array.from(groups.entries()).map(([type, items]) => {
      const sorted = [...items].sort((a, b) => {
        const distA = Math.max(0.1, a.distanceKm);
        const distB = Math.max(0.1, b.distanceKm);

        const scoreA = ((a.rating || 0) * (a.userRatingCount || 0)) / distA;
        const scoreB = ((b.rating || 0) * (b.userRatingCount || 0)) / distB;

        const diff = scoreB - scoreA;
        if (diff !== 0) return diff;

        return a.distanceKm - b.distanceKm;
      });

      return { type, items: sorted.slice(0, 5) };
    });
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

  const handleHover = useCallback(
    (p: PoiRow) => {
      setHoveredPoi({
        id: p.id,
        name: p.name,
        type: p.type,
        lat: p.lat,
        lng: p.lng,
        distanceKm: p.distanceKm,
        types: p.types,
      });
    },
    [setHoveredPoi],
  );

  const handleHoverEnd = useCallback(() => {
    setHoveredPoi(null);
  }, [setHoveredPoi]);

  if (!coordinates) return null;

  return (
    <main className="min-h-screen bg-[var(--cream)] font-body pb-32">
      <header className="flex items-center justify-between px-6 md:px-10 py-3 border-b border-[#e8e2d4]">
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
          style={{ height: "calc(100vh - 380px)", minHeight: "350px" }}
        >
          <MapView showDistanceRings={showDistanceRings} />

          {/* GTA-style circular highway mini-map — bottom-left overlay */}
          <HighwayMiniMap
            lat={coordinates.lat}
            lng={coordinates.lng}
            token={keys?.mapboxToken}
            provider={mapProvider}
            highwayInfo={highwayInfo}
            highwayLoading={highwayLoading}
          />

          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-md shadow font-mono text-[11px] text-[var(--navy)]">
            {coordinates.lat.toFixed(5)}° N, {coordinates.lng.toFixed(5)}° E
          </div>

          {/* Selected POIs List (Top Right) */}
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex flex-col gap-1.5 sm:gap-2 max-h-[100px] sm:max-h-[calc(100%-40px)] overflow-y-auto pointer-events-none [&::-webkit-scrollbar]:hidden z-50">
            {Object.values(selectedPois).flat().sort((a, b) => a.distanceKm - b.distanceKm).map((poi) => {
              const meta = resolvePoiMeta(poi.type, poi.types);
              const Icon = meta.Icon;
              return (
                <div
                  key={poi.id}
                  className="flex items-center gap-1.5 sm:gap-2 bg-white/95 backdrop-blur px-2 sm:px-3 py-1.5 sm:py-2 rounded-md shadow pointer-events-auto border border-[#e8e2d4]"
                >
                  <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" style={{ color: meta.color }} />
                  <span className="text-[10px] sm:text-[12px] font-medium text-[var(--navy)] max-w-[80px] sm:max-w-[140px] truncate" title={poi.name}>
                    {poi.name}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold shrink-0" style={{ color: meta.color }}>
                    {poi.distanceKm.toFixed(1)}km
                  </span>
                </div>
              );
            })}
          </div>

          {/* Map provider switcher */}
          <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 flex gap-1 bg-white/95 backdrop-blur rounded-3xl p-1 shadow flex-wrap max-w-[180px] sm:max-w-xl justify-end">
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
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-md z-50">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-5 bg-white/90 border border-white/60 shadow-xl rounded-2xl p-8 backdrop-blur-xl"
              >
                <div className="relative flex items-center justify-center w-16 h-16">
                  <div className="absolute inset-0 rounded-full bg-[var(--gold)]/20 animate-ping" />
                  <div className="absolute inset-0 rounded-full border-4 border-[var(--gold)]/30" />
                  <div className="absolute inset-0 rounded-full border-4 border-[var(--gold)] border-t-transparent animate-spin" />
                  <MapPin className="w-5 h-5 text-[var(--gold)]" />
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="text-[11px] font-bold tracking-[0.2em] text-[var(--gold)] uppercase">Scanning Area</div>
                  <div className="text-[var(--navy)] font-semibold text-sm animate-pulse">Gathering vicinity data...</div>
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Bottom controls below map */}
        <div className="mt-3 flex items-center justify-between flex-wrap gap-4">
          <div className="flex flex-wrap items-center gap-3" />

          {/* Style selection + Brochure CTA on right */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Show Distance Rings — always visible */}
            <button
              id="show-distance-rings-btn"
              onClick={() => setShowDistanceRings((v) => !v)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-[11px] sm:text-[13px] font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border hover:shadow-md shadow-sm"
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
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-[11px] sm:text-[13px] font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border hover:shadow-md shadow-sm"
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
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-[11px] sm:text-[13px] font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border hover:shadow-md shadow-sm"
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
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-[11px] sm:text-[13px] font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border hover:shadow-md shadow-sm"
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
        highwayMapImageUrl={capturedHighwayMapImageUrl}
        sourceCoordinates={coordinates ?? undefined}
        highwayInfo={highwayInfo}
        highwayLoading={highwayLoading}
        nearbyPOIs={brochurePOIs}
        propertyDetails={{
          subtitle: locationReport?.site?.label !== "Site Location" ? locationReport?.site?.label : undefined,
        }}
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
          showDistanceRings={true}
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
          showDistanceRings={true}
          onGenerateBrochure={handleGenerateBrochure}
        />
      )}

      {/* Mapbox Static Image Dialog (No Labels) */}
      {isMapboxImageNoLabelsOpen && (
        <MapboxImageDialog
          open={isMapboxImageNoLabelsOpen}
          onClose={() => {
            setIsMapboxImageNoLabelsOpen(false);
            // If user manually closes during auto-flow, cancel the flow
            if (autoBrochureMode) setAutoBrochureMode(false);
          }}
          lat={coordinates.lat}
          lng={coordinates.lng}
          token={keys?.mapboxToken}
          selectedPois={selectedPois}
          labelsPosition="none"
          showDistanceRings={true}
          onGenerateBrochure={handleGenerateBrochure}
          autoBrochureMode={autoBrochureMode}
        />
      )}

      {/* Highway Map Image Capture */}
      {isHighwayImageOpen && (
        <MapboxHighwayImageDialog
          open={isHighwayImageOpen}
          lat={coordinates.lat}
          lng={coordinates.lng}
          token={keys?.mapboxToken}
          provider={mapProvider}
          highwayInfo={highwayInfo}
          onGenerateHighwayMap={handleGenerateHighwayMap}
        />
      )}

      {/* Auto-brochure animated loading overlay */}
      {autoBrochureMode && (
        <AutoBrochureLoader step={autoBrochureStep} isGenerating={isGenerating} />
      )}

      {/* ── PLACES LIST (directly below map) ── */}
      <section className="px-6 md:px-10 pt-10 max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-[10px] tracking-[0.25em] text-[var(--gold)] uppercase font-medium">
              Vicinity Intelligence
            </div>
            <h2 className="font-heading text-[24px] text-[var(--navy)] mt-1">
              Important Nearby Places
            </h2>
            <p className="text-[12px] text-black font-medium mt-1">
              Check any locations to pin them on the map — select multiple per category
            </p>
          </div>

          <div className="flex justify-end pb-1">
            {Object.keys(selectedPois).length > 0 && (
              <button
                onClick={clearAllPois}
                className="bg-white text-[var(--navy)] px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-full font-semibold text-[11px] sm:text-[13px] shadow-sm flex items-center gap-1.5 hover:bg-[#faf8f4] border border-[#e8e2d4] transition"
              >
                Clear all pins
              </button>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {isGenerating && (
          <div className="space-y-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#e8e2d4]/60" />
                  <div className="h-4 w-32 bg-[#e8e2d4]/60 rounded" />
                  <div className="h-px flex-1 bg-gradient-to-r from-[#e8e2d4]/60 to-transparent ml-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-[#e8e2d4]/60 shadow-sm">
                      <div className="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-[#e8e2d4]/40" />
                      <div className="w-9 h-9 rounded-full bg-[#e8e2d4]/40 shrink-0" />
                      <div className="flex-1 space-y-2 mt-1.5">
                        <div className="h-3.5 bg-[#e8e2d4]/60 rounded w-3/4" />
                        <div className="h-3 bg-[#e8e2d4]/40 rounded w-1/2" />
                      </div>
                    </div>
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
            {groupedPois.map(({ type, items }) => (
              <PoiCategorySection
                key={type}
                type={type}
                items={items}
                selectedInCategory={selectedPois[type] ?? []}
                hoveredPoiId={hoveredPoi?.id}
                onSelect={handleSelect}
                onHover={handleHover}
                onHoverEnd={handleHoverEnd}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// ── MapView ───────────────────────────────────────────────────────────────────
// Thin wrapper that reads the map provider + keys from stores and feeds them
// into MapboxMap. Kept in this file because it's trivially small and tightly
// coupled to the AnalysisPage's showDistanceRings state.

function MapView({
  showDistanceRings,
}: {
  showDistanceRings?: boolean;
}) {
  const coordinates = useReportStore((s) => s.coordinates)!;
  const mapProvider = useReportStore((s) => s.mapProvider);
  const setHoveredPoi = useReportStore((s) => s.setHoveredPoi);
  const keys = useMapKeys();

  // Fix 3: Clear hovered state whenever the provider changes so no phantom
  // hover marker bleeds from one map implementation to the other.
  useEffect(() => {
    setHoveredPoi(null);
  }, [mapProvider, setHoveredPoi]);

  return (
    <MapboxMap
      lat={coordinates.lat}
      lng={coordinates.lng}
      token={keys?.mapboxToken}
      showDistanceRings={showDistanceRings}
      provider={mapProvider}
    />
  );
}
