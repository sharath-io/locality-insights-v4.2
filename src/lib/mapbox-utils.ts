/**
 * mapbox-utils.ts
 * Pure Mapbox utility functions, constants, and helpers.
 * Extracted from analysis.tsx — no React, no Zustand state.
 */

import * as turf from "@turf/turf";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import mapboxgl from "mapbox-gl";
import { resolvePoiMeta } from "@/lib/map-styles";
import type { SelectedPoiEntry } from "@/stores/reportStore";

// ── Provider style map ────────────────────────────────────────────────────────

export const MAPBOX_PROVIDER_STYLES: Record<string, { url: string; staticId: string }> = {
  "mapbox-v1":       { url: "mapbox://styles/sharath-io/cmq02f0dc000o01qw8c2edjor", staticId: "sharath-io/cmq02f0dc000o01qw8c2edjor" },
  "mapbox-v2":       { url: "mapbox://styles/sharath-io/cmq9itt8r002801s911meehvf", staticId: "sharath-io/cmq9itt8r002801s911meehvf" },
  "mapbox-v3":       { url: "mapbox://styles/sharath-io/cmqcb7oh1008j01qxheqi92cb", staticId: "sharath-io/cmqcb7oh1008j01qxheqi92cb" },
  "mapbox-coast":    { url: "mapbox://styles/sharath-io/cmqax8azk003b01qz8dt520di", staticId: "sharath-io/cmqax8azk003b01qz8dt520di" },
  "mapbox-skeleton": { url: "mapbox://styles/sharath-io/cmqb95m8a000i01shbkcuhzcb", staticId: "sharath-io/cmqb95m8a000i01shbkcuhzcb" },
};

// ── Camera defaults ───────────────────────────────────────────────────────────

// Flat 2D camera settings
export const CINEMATIC_PITCH = 0;
export const CINEMATIC_BEARING = 0;
export const CINEMATIC_ZOOM = 12;

// ── Layer lists ───────────────────────────────────────────────────────────────

// Layer IDs to hide: business POIs, transit labels, dense icons
export const LAYERS_TO_HIDE = [
  "poi-label",
  "transit-label",
  "road-label",
  "airport-label",
  "settlement-minor-label",
  "natural-point-label",
];

// Layers to reduce opacity (subtle, not hidden)
export const ROAD_LAYERS_TO_MUTE = [
  "road-minor",
  "road-minor-case",
  "road-service",
  "road-service-case",
  "road-path",
];

// ── Ring constants ────────────────────────────────────────────────────────────

export const RING_DISTANCES_KM = [1, 3, 5];
export const RING_COLOR = "#1a56db";

// ── Layer overrides ───────────────────────────────────────────────────────────

/**
 * Apply cinematic layer overrides after a Mapbox style loads.
 * Hides noisy POI/transit layers and mutes minor road opacity.
 */
export function applyCinematicLayerOverrides(map: mapboxgl.Map, _isDark: boolean) {
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

// ── POI marker element factory ────────────────────────────────────────────────

/**
 * Build a DOM element for a POI map marker.
 * Returns `{ el, meta }` — caller attaches event listeners and adds to map.
 */
export function createPoiMarkerEl(
  poi: SelectedPoiEntry,
  options: { opacity?: number } = {},
) {
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

// ── Static image helpers ──────────────────────────────────────────────────────

/**
 * Calculate an appropriate zoom level to fit all points within the viewport.
 */
export function fitZoom(
  center: { lat: number; lng: number },
  points: { lat: number; lng: number }[],
  widthPx: number,
  heightPx: number,
) {
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

/**
 * Project a lat/lng coordinate to pixel position within a static map image.
 */
export function latLngToPixel(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  zoom: number,
  widthPx: number,
  heightPx: number,
) {
  const TILE = 512;
  const scale = (TILE * Math.pow(2, zoom)) / 360;
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

/**
 * Build a Mapbox Static Images API URL for the current view.
 * Returns `{ url, zoom }`.
 */
export function buildStaticMapUrl(opts: {
  token: string;
  lng: number;
  lat: number;
  mapProvider: string;
  selectedPois: Record<string, SelectedPoiEntry[]>;
  width?: number;
  height?: number;
  showDistanceRings?: boolean;
}): { url: string; zoom: number } {
  const { token, lng, lat, mapProvider, selectedPois, width = 1200, height = 700, showDistanceRings } = opts;

  const staticStyle =
    MAPBOX_PROVIDER_STYLES[mapProvider]?.staticId ?? MAPBOX_PROVIDER_STYLES["mapbox-v2"].staticId;
  const overlays: string[] = [];
  overlays.push(`pin-l+e53935(${lng.toFixed(6)},${lat.toFixed(6)})`);

  const poiList = Object.values(selectedPois).flat().map((p) => ({ lat: p.lat, lng: p.lng }));
  if (showDistanceRings) {
    const maxRingKm = Math.max(...RING_DISTANCES_KM);
    const dLat = maxRingKm / 111.32;
    const dLng = maxRingKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    poiList.push({ lat: lat + dLat, lng: lng });
    poiList.push({ lat: lat - dLat, lng: lng });
    poiList.push({ lat: lat, lng: lng + dLng });
    poiList.push({ lat: lat, lng: lng - dLng });
  }
  const zoom = fitZoom({ lat, lng }, poiList, width, height);

  const overlayStr = overlays.join(",");
  const url =
    `https://api.mapbox.com/styles/v1/${staticStyle}/static/` +
    `${overlayStr}/` +
    `${lng},${lat},${zoom},0/` +
    `${width}x${height}@2x` +
    `?access_token=${token}`;

  return { url, zoom };
}

// ── Distance ring helpers ─────────────────────────────────────────────────────

/**
 * Add/remove Turf.js GeoJSON distance ring layers on a Mapbox map.
 * Called both imperatively and via style.load listener.
 */
export function renderDistanceRings(
  map: mapboxgl.Map,
  lat: number,
  lng: number,
  show: boolean,
) {
  if (!map.isStyleLoaded()) return;

  const center: [number, number] = [lng, lat];

  if (show) {
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

      // Dashed stroke — thickness decreases outward (proximity hierarchy)
      // i=0 → 1km (boldest), i=1 → 3km, i=2 → 5km (lightest)
      const ringLineWidth = i === 0 ? 2.5 : i === 1 ? 2 : 1.5;
      map.addLayer({
        id: strokeId,
        type: "line",
        source: srcId,
        paint: {
          "line-color": RING_COLOR,
          "line-width": ringLineWidth,
          "line-dasharray": [6, 4],
          "line-opacity": 0.7,
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
}
