/**
 * HighwayMiniMap.tsx
 * GTA Vice City–style circular mini-map overlay for highway connections.
 * Renders as an independent Mapbox GL instance in the bottom-left of the map.
 * Shows only the site pin + driving paths to nearby highways (no POIs).
 * Scroll-to-zoom is isolated to this map only.
 * Click expands to a full dialog with Straight Line / Path toggle buttons.
 * Mode changes in the dialog sync back to the main map layout.
 */

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { X, Maximize2, Minus, Navigation } from "lucide-react";
import type { HighwayInfo } from "@/lib/fetch-highways";
import { MAPBOX_PROVIDER_STYLES } from "@/lib/mapbox-utils";

const SIZE = 120;
const MINI_ZOOM = 10;

type VizMode = "none" | "straight" | "path";

// ── Shared drawing helpers ─────────────────────────────────────────────────────

function addSitePin(map: mapboxgl.Map, lng: number, lat: number) {
  const el = document.createElement("div");
  el.style.cssText = `width:20px;height:24px;cursor:default;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.55));`;
  el.innerHTML = `
    <svg width="20" height="24" viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 2C10.16 2 3 9.16 3 18c0 12.5 15.2 25.8 15.4 26 .33.27.87.27 1.2 0C19.8 43.8 35 30.5 35 18 35 9.16 27.84 2 19 2Z"
        fill="#e53935" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="19" cy="18" r="5" fill="rgba(255,255,255,0.95)"/>
      <circle cx="19" cy="18" r="2.5" fill="#e53935"/>
    </svg>`;
  new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([lng, lat]).addTo(map);
}

function clearHwLayers(map: mapboxgl.Map, prefix: string) {
  for (let i = 0; i < 3; i++) {
    if (map.getLayer(`${prefix}-distance-label-${i}`)) map.removeLayer(`${prefix}-distance-label-${i}`);
    if (map.getLayer(`${prefix}-outline-${i}`)) map.removeLayer(`${prefix}-outline-${i}`);
    if (map.getLayer(`${prefix}-line-${i}`)) map.removeLayer(`${prefix}-line-${i}`);
    if (map.getSource(`${prefix}-src-${i}`)) map.removeSource(`${prefix}-src-${i}`);
  }
}

function drawStraightLines(
  map: mapboxgl.Map,
  prefix: string,
  highways: HighwayInfo[],
  siteLat: number,
  siteLng: number,
  markerStore: mapboxgl.Marker[],
) {
  if (!map.isStyleLoaded()) return;
  clearHwLayers(map, prefix);
  markerStore.forEach((m) => m.remove());
  markerStore.length = 0;

  highways.forEach((hw, i) => {
    map.addSource(`${prefix}-src-${i}`, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [[siteLng, siteLat], [hw.closestPoint.lng, hw.closestPoint.lat]],
        },
      },
    });
    map.addLayer({
      id: `${prefix}-line-${i}`,
      type: "line",
      source: `${prefix}-src-${i}`,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#1a56db", "line-width": 2.5, "line-opacity": 0.9 },
    });

    map.addLayer({
      id: `${prefix}-distance-label-${i}`,
      type: "symbol",
      source: `${prefix}-src-${i}`,
      layout: {
        "symbol-placement": "line",
        "text-field": `${hw.distanceKm} km`,
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-size": 13,
        "text-anchor": "bottom",
        "text-offset": [0, 0.4],
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#1a56db",
        "text-halo-color": "#ffffff",
        "text-halo-width": 3,
      }
    });

    const el = document.createElement("div");
    el.style.cssText = `display:flex;align-items:center;gap:4px;pointer-events:none;`;
    el.innerHTML = `
      <div style="width:16px;height:16px;background:#1a56db;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>
      <div style="color:#1a56db;font-size:12px;font-weight:800;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff;white-space:nowrap;">${hw.ref}</div>
    `;
    const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat([hw.closestPoint.lng, hw.closestPoint.lat])
      .addTo(map);
    markerStore.push(marker);
  });
}

async function drawRoutes(
  map: mapboxgl.Map,
  prefix: string,
  highways: HighwayInfo[],
  siteLat: number,
  siteLng: number,
  token: string,
  markerStore: mapboxgl.Marker[],
): Promise<Record<string, number>> {
  const distances: Record<string, number> = {};
  if (!map.isStyleLoaded()) return distances;
  clearHwLayers(map, prefix);
  markerStore.forEach((m) => m.remove());
  markerStore.length = 0;

  // 1. Draw markers immediately so the user sees highway locations without waiting for the route fetch
  highways.forEach((hw) => {
    const el = document.createElement("div");
    el.style.cssText = `display:flex;align-items:center;gap:4px;pointer-events:none;`;
    el.innerHTML = `
      <div style="width:16px;height:16px;background:#1a56db;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>
      <div style="color:#1a56db;font-size:12px;font-weight:800;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff;white-space:nowrap;">${hw.ref}</div>
    `;
    const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat([hw.closestPoint.lng, hw.closestPoint.lat])
      .addTo(map);
    markerStore.push(marker);
  });

  // 2. Fetch and draw the actual driving paths asynchronously
  await Promise.all(
    highways.map(async (hw, i) => {
      try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${siteLng},${siteLat};${hw.closestPoint.lng},${hw.closestPoint.lat}?geometries=geojson&overview=full&access_token=${token}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json() as { routes?: Array<{ geometry: GeoJSON.Geometry; distance: number }> };
        const route = json.routes?.[0];
        if (!route) return;

        map.addSource(`${prefix}-src-${i}`, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route.geometry as GeoJSON.Geometry },
        });
        map.addLayer({
          id: `${prefix}-outline-${i}`,
          type: "line",
          source: `${prefix}-src-${i}`,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#ffffff", "line-width": 4, "line-opacity": 0.65 },
        });
        map.addLayer({
          id: `${prefix}-line-${i}`,
          type: "line",
          source: `${prefix}-src-${i}`,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#1a56db", "line-width": 2.5, "line-opacity": 0.92 },
        });

        const drivingKm = +(route.distance / 1000).toFixed(1);
        distances[hw.ref] = drivingKm;
        
        map.addLayer({
          id: `${prefix}-distance-label-${i}`,
          type: "symbol",
          source: `${prefix}-src-${i}`,
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 500,
            "text-field": `${drivingKm} km`,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 13,
            "text-anchor": "bottom",
            "text-offset": [0, 0.4],
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": "#1a56db",
            "text-halo-color": "#ffffff",
            "text-halo-width": 3,
          }
        });

      } catch { /* skip */ }
    }),
  );
  return distances;
}

/** Redraw on a map given the current mode */
function applyVizMode(
  map: mapboxgl.Map,
  prefix: string,
  mode: VizMode,
  highways: HighwayInfo[],
  siteLat: number,
  siteLng: number,
  token: string,
  markerStore: mapboxgl.Marker[],
) {
  if (!map.isStyleLoaded()) return;
  if (mode === "none") {
    clearHwLayers(map, prefix);
    markerStore.forEach((m) => m.remove());
    markerStore.length = 0;
  } else if (mode === "straight") {
    drawStraightLines(map, prefix, highways, siteLat, siteLng, markerStore);
    return Promise.resolve({});
  } else {
    return drawRoutes(map, prefix, highways, siteLat, siteLng, token, markerStore);
  }
}

// ── Mini-map component ─────────────────────────────────────────────────────────

export interface HighwayMiniMapProps {
  lat: number;
  lng: number;
  token?: string;
  provider: string;
  highwayInfo: HighwayInfo[];
  highwayLoading: boolean;
}

export function HighwayMiniMap({
  lat, lng, token, provider, highwayInfo, highwayLoading,
}: HighwayMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const isDrawingRef = useRef(false);
  const highwayInfoRef = useRef<HighwayInfo[]>(highwayInfo);
  const [isExpanded, setIsExpanded] = useState(false);
  const [vizMode, setVizMode] = useState<VizMode>("none");
  const [isRouting, setIsRouting] = useState(false);

  useEffect(() => { highwayInfoRef.current = highwayInfo; }, [highwayInfo]);

  const getStyleUrl = (p: string) =>
    MAPBOX_PROVIDER_STYLES[p]?.url ?? MAPBOX_PROVIDER_STYLES["mapbox-v2"].url;

  // ── Init mini-map ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !containerRef.current) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: getStyleUrl(provider),
      center: [lng, lat],
      zoom: MINI_ZOOM,
      interactive: true,
      attributionControl: false,
    });

    map.doubleClickZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    map.dragRotate.disable();
    map.touchPitch.disable();

    mapRef.current = map;

    const hydrateAll = () => {
      addSitePin(map, lng, lat);
      const hwys = highwayInfoRef.current;
      if (hwys.length > 0) {
        fitToHighways(map, lat, lng, hwys, 25);
      }
      // Note: By default we do not draw any routes on the mini-map to keep it clean.
      // We will only draw if vizMode is not "none".
      if (hwys.length > 0 && token && !isDrawingRef.current && vizMode !== "none") {
        isDrawingRef.current = true;
        const apply = () => applyVizMode(map, "mini", vizMode, hwys, lat, lng, token, markersRef.current);
        if (vizMode === "path") {
          setIsRouting(true);
          drawRoutes(map, "mini", hwys, lat, lng, token, markersRef.current)
            .finally(() => { 
              isDrawingRef.current = false; 
              setIsRouting(false); 
            });
        } else {
          apply();
          isDrawingRef.current = false;
        }
      }
    };

    map.on("style.load", hydrateAll);

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, token]);

  // ── Sync style with main map ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(getStyleUrl(provider));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // ── Re-draw when highway data loads ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token || highwayInfo.length === 0) return;
    const draw = () => {
      fitToHighways(map, lat, lng, highwayInfo, 25);
      if (isDrawingRef.current) return;
      if (vizMode === "none") {
        clearHwLayers(map, "mini");
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        return;
      }
      isDrawingRef.current = true;
      if (vizMode === "path") {
        setIsRouting(true);
        drawRoutes(map, "mini", highwayInfo, lat, lng, token, markersRef.current)
          .finally(() => { 
            isDrawingRef.current = false; 
            setIsRouting(false);
          });
      } else if (vizMode === "straight") {
        drawStraightLines(map, "mini", highwayInfo, lat, lng, markersRef.current);
        isDrawingRef.current = false;
      }
    };
    if (map.isStyleLoaded()) draw();
    else map.once("style.load", draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highwayInfo, lat, lng, token, vizMode]);

  // ── Isolate scroll from main map ───────────────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);

  return (
    <>
      {/* ── GTA-style circular mini-map ─────────────────────────────────── */}
      <div
        ref={wrapperRef}
        className="absolute bottom-4 left-4 z-40 group"
        style={{ width: SIZE, height: SIZE }}
        title="Highway Overview — scroll to zoom · click to expand"
      >
        <div
          style={{
            width: SIZE, height: SIZE,
            borderRadius: "50%",
            overflow: "hidden",
            position: "relative",
            boxShadow: "0 0 0 2.5px rgba(255,255,255,0.18), 0 0 0 5px rgba(26,86,219,0.55), 0 8px 28px rgba(0,0,0,0.55)",
            cursor: "pointer",
          }}
          onClick={() => setIsExpanded(true)}
        >
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

          {/* Loading spinner */}
          {(highwayLoading || isRouting) && (
            <div className="absolute inset-0 flex flex-col gap-2 items-center justify-center bg-black/60 backdrop-blur-sm z-[100]">
              <div className="rounded-full animate-spin" style={{ width: 24, height: 24, border: "2.5px solid rgba(255,255,255,0.2)", borderTopColor: "white" }} />
              <div className="text-[9px] font-bold tracking-widest text-white/90 uppercase">{highwayLoading ? "Scanning Highways" : "Routing Paths"}</div>
            </div>
          )}



          {/* Label */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none select-none"
            style={{ background: "rgba(0,0,0,0.58)", color: "rgba(255,255,255,0.82)", fontSize: 8, fontWeight: 700, padding: "1.5px 7px", borderRadius: 3, letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            Highway Map
          </div>

          {/* Expand icon on hover */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
            style={{ background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Maximize2 style={{ width: 10, height: 10, color: "white" }} />
          </div>
        </div>

        {/* N compass on the border */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none select-none z-50">
          <div style={{ background: "#1a56db", color: "white", fontSize: 9, fontWeight: 800, padding: "1px 5.5px", borderRadius: 4, letterSpacing: "0.1em", lineHeight: 1.5, boxShadow: "0 2px 6px rgba(0,0,0,0.4), 0 0 0 1.5px rgba(255,255,255,0.3)" }}>N</div>
        </div>
      </div>

      {/* ── Expanded dialog ────────────────────────────────────────────────── */}
      {isExpanded && (
        <HighwayExpandedDialog
          lat={lat}
          lng={lng}
          token={token}
          provider={provider}
          highwayInfo={highwayInfo}
          vizMode={vizMode}
          onVizModeChange={setVizMode}
          onClose={() => setIsExpanded(false)}
        />
      )}
    </>
  );
}

// ── Expanded Dialog ───────────────────────────────────────────────────────────

interface ExpandedDialogProps {
  lat: number;
  lng: number;
  token?: string;
  provider: string;
  highwayInfo: HighwayInfo[];
  vizMode: VizMode;
  onVizModeChange: (mode: VizMode) => void;
  onClose: () => void;
}

function HighwayExpandedDialog({
  lat, lng, token, provider, highwayInfo, vizMode, onVizModeChange, onClose,
}: ExpandedDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const isDrawingRef = useRef(false);
  const hasMountedRef = useRef(false);
  const [drivingDistances, setDrivingDistances] = useState<Record<string, number>>({});
  const [isRouting, setIsRouting] = useState(false);

  const getStyleUrl = (p: string) =>
    MAPBOX_PROVIDER_STYLES[p]?.url ?? MAPBOX_PROVIDER_STYLES["mapbox-v2"].url;

  // ── Init expanded map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !containerRef.current) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: getStyleUrl(provider),
      center: [lng, lat],
      zoom: 10,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("style.load", () => {
      addSitePin(map, lng, lat);
      if (highwayInfo.length > 0 && token) {
        if (vizMode === "path") {
          setIsRouting(true);
          drawRoutes(map, "exp", highwayInfo, lat, lng, token, markersRef.current)
            .then((dists) => {
              setDrivingDistances(dists);
              fitToHighways(map, lat, lng, highwayInfo);
            })
            .finally(() => setIsRouting(false));
        } else {
          applyVizMode(map, "exp", vizMode, highwayInfo, lat, lng, token, markersRef.current);
          fitToHighways(map, lat, lng, highwayInfo);
        }
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-draw when vizMode changes (from buttons or external main map) ───────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token || highwayInfo.length === 0) return;

    const apply = () => {
      // Skip the very first run — the init effect's style.load handler
      // already draws the initial mode. Only redraw on subsequent changes.
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      if (isDrawingRef.current) return;
      isDrawingRef.current = true;
      if (vizMode === "path") {
        setIsRouting(true);
        drawRoutes(map, "exp", highwayInfo, lat, lng, token, markersRef.current)
          .then((dists) => {
            setDrivingDistances(dists);
          })
          .finally(() => {
            isDrawingRef.current = false;
            setIsRouting(false);
          });
      } else if (vizMode === "straight") {
        drawStraightLines(map, "exp", highwayInfo, lat, lng, markersRef.current);
        isDrawingRef.current = false;
      } else {
        clearHwLayers(map, "exp");
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        isDrawingRef.current = false;
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vizMode]);

  const activeBtn = (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 14px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    letterSpacing: "-0.01em",
    transition: "all 0.2s",
    background: active ? "rgba(26,86,219,0.9)" : "rgba(0,0,0,0.45)",
    color: active ? "white" : "rgba(255,255,255,0.65)",
    boxShadow: active ? "0 2px 10px rgba(26,86,219,0.5)" : "none",
  } as React.CSSProperties);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/15"
        style={{ width: "min(780px, 92vw)", height: "min(560px, 88vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Map */}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

        {/* Loading Spinner */}
        {isRouting && (
          <div className="absolute inset-0 flex flex-col gap-3 items-center justify-center bg-black/50 backdrop-blur-sm z-20">
            <div className="rounded-full animate-spin" style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "white" }} />
            <div className="text-[11px] font-bold tracking-widest text-white uppercase shadow-sm">Routing Paths</div>
          </div>
        )}

        {/* Top gradient + title + toggle buttons */}
        <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-5 pt-4 pb-10 bg-gradient-to-b from-black/60 to-transparent z-10">
          <div className="pointer-events-none">
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 2 }}>
              Highway Connectivity
            </div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
              Nearest Highway Access
            </div>
          </div>

          {/* Straight Line / Path toggle buttons */}
          <div className="flex items-center gap-2 mt-1">
            <button
              id="exp-straight-line-btn"
              style={activeBtn(vizMode === "straight")}
              onClick={() => onVizModeChange(vizMode === "straight" ? "none" : "straight")}
              title="Show straight aerial lines to each highway"
            >
              <Minus style={{ width: 13, height: 13 }} />
              Straight Line
            </button>
            <button
              id="exp-path-btn"
              style={activeBtn(vizMode === "path")}
              onClick={() => onVizModeChange(vizMode === "path" ? "none" : "path")}
              title="Show actual driving route to each highway"
            >
              <Navigation style={{ width: 13, height: 13 }} />
              Driving Path
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex items-center justify-center rounded-full transition-colors hover:bg-black/70 z-10"
          style={{ width: 34, height: 34, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <X style={{ width: 15, height: 15, color: "white" }} />
        </button>

        {/* Bottom gradient + highway badges with distances */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10">
          <div className="flex flex-wrap gap-2">
            {highwayInfo.map((hw) => {
              const displayDist = (vizMode === "path" && drivingDistances[hw.ref]) 
                ? drivingDistances[hw.ref] 
                : hw.distanceKm;
              return (
                <div key={hw.ref} style={{ background: "rgba(26,86,219,0.88)", color: "white", fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 99, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(26,86,219,0.4)" }}>
                  {hw.ref} — {displayDist} km away
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fitToHighways(map: mapboxgl.Map, lat: number, lng: number, highways: HighwayInfo[], padding = 80) {
  if (highways.length === 0) return;
  const bounds = new mapboxgl.LngLatBounds([lng, lat], [lng, lat]);
  highways.forEach((hw) => bounds.extend([hw.closestPoint.lng, hw.closestPoint.lat]));
  map.fitBounds(bounds, { padding, maxZoom: 12, duration: 900 });
}
