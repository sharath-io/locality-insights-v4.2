/**
 * MapboxImageDialog.tsx
 * Static image capture dialog — fetches a Mapbox Static Images API URL,
 * renders HTML overlays for POIs and distance rings, and exports as PNG.
 * Extracted from analysis.tsx.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Sparkles, Camera, Download, X } from "lucide-react";
import { toPng } from "html-to-image";
import { useReportStore } from "@/stores/reportStore";
import type { SelectedPoiEntry } from "@/stores/reportStore";
import { resolvePoiMeta } from "@/lib/map-styles";
import {
  RING_DISTANCES_KM,
  RING_COLOR,
  buildStaticMapUrl,
  latLngToPixel,
} from "@/lib/mapbox-utils";

export interface MapboxImageDialogProps {
  open: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  token?: string;
  selectedPois: Record<string, SelectedPoiEntry[]>;
  labelsPosition?: "on-marker" | "top-right" | "none";
  showDistanceRings?: boolean;
  onGenerateBrochure?: (imageDataUrl: string) => void;
  /** When true the dialog will auto-trigger Generate Brochure once the map image has loaded */
  autoBrochureMode?: boolean;
}

export function MapboxImageDialog({
  open,
  onClose,
  lat,
  lng,
  token,
  selectedPois,
  labelsPosition = "on-marker",
  showDistanceRings,
  onGenerateBrochure,
  autoBrochureMode,
}: MapboxImageDialogProps) {
  const mapProvider = useReportStore((s) => s.mapProvider);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCapturingBrochure, setIsCapturingBrochure] = useState(false);
  // Guard so auto-trigger only fires once even if imgLoaded flickers
  const autoTriggeredRef = useRef(false);

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

  // Auto-trigger brochure generation when image loads in auto-brochure mode
  useEffect(() => {
    if (!autoBrochureMode) return;
    if (!imgLoaded) return;
    if (autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;
    // Small delay to ensure the map overlay renders (markers, rings) before capture
    const timer = setTimeout(() => {
      handleGenerateBrochure();
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBrochureMode, imgLoaded]);

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
      if (!autoBrochureMode) {
        onClose();
      }
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
          {!autoBrochureMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
              onClick={onClose}
            />
          )}

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={`fixed inset-0 flex items-center justify-center p-4 pointer-events-none ${autoBrochureMode ? "-z-[50]" : "z-[201]"}`}
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
                      const northLat = lat + km / 111.32;
                      const northPx = latLngToPixel(northLat, lng, lat, lng, zoom, dims.w, dims.h);
                      const r = Math.abs(cy - northPx.y);
                      const fillOpacity = 0.02 * (RING_DISTANCES_KM.length - i);
                      // Label at top of each ring
                      const labelX = cx;
                      const labelY = cy - r - 4;
                      const pillW = km >= 10 ? 40 : 34;
                      const svgStrokeWidth = i === 0 ? 2.5 : i === 1 ? 2 : 1.5;
                      return (
                        <g key={km}>
                          <circle
                            cx={cx} cy={cy} r={r}
                            fill={`rgba(26,86,219,${fillOpacity})`}
                            stroke={RING_COLOR}
                            strokeWidth={svgStrokeWidth}
                            strokeDasharray="6 4"
                            strokeOpacity={0.7}
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
                className="flex flex-col sm:flex-row sm:items-center justify-between px-5 sm:px-7 py-4 sm:py-5 gap-4 shrink-0"
                style={{ borderTop: "1px solid rgba(200,185,126,0.12)" }}
              >
                {/* Location info */}
                <div>
                  <p className="text-white/90 text-[13px] sm:text-[14px] font-semibold leading-tight">
                    Vicinity Report — Mapbox View
                  </p>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                    <span
                      className="text-[10px] sm:text-[11px] font-mono px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(200,185,126,0.1)", color: "#c8b97e" }}
                    >
                      {lat.toFixed(5)}° N, {lng.toFixed(5)}° E
                    </span>
                    {poiCount > 0 && (
                      <span className="text-[10px] sm:text-[11px] text-white/40">
                        {poiCount} location{poiCount !== 1 ? "s" : ""} plotted
                      </span>
                    )}
                  </div>
                </div>

                {/* Buttons row */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
