/**
 * MapboxMap.tsx
 * Live interactive Mapbox GL map component.
 * Handles marker sync, hovered POI preview, zoom-to-fit, and distance rings.
 * Extracted from analysis.tsx.
 */

import { useMemo, useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useReportStore } from "@/stores/reportStore";
import type { SelectedPoiEntry } from "@/stores/reportStore";
import {
  MAPBOX_PROVIDER_STYLES,
  CINEMATIC_PITCH,
  CINEMATIC_BEARING,
  CINEMATIC_ZOOM,
  applyCinematicLayerOverrides,
  createPoiMarkerEl,
  renderDistanceRings,
} from "@/lib/mapbox-utils";

interface CustomMarker extends mapboxgl.Marker {
  __poiId?: string;
}

interface MapboxMapProps {
  lat: number;
  lng: number;
  token?: string;
  showDistanceRings?: boolean;
  provider: string;
}

export function MapboxMap({ lat, lng, token, showDistanceRings, provider }: MapboxMapProps) {
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
    const flat: Record<string, SelectedPoiEntry> = {};
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
    const styleUrl = MAPBOX_PROVIDER_STYLES[mapProvider]?.url ?? MAPBOX_PROVIDER_STYLES["mapbox-v2"].url;
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
      const flatPois: Record<string, SelectedPoiEntry> = {};
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
    const styleUrl = MAPBOX_PROVIDER_STYLES[provider]?.url ?? MAPBOX_PROVIDER_STYLES["mapbox-v2"].url;
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

    const handleRings = () => renderDistanceRings(map, lat, lng, !!showDistanceRings);

    // Attempt to render immediately
    handleRings();

    // Also attach a listener so it correctly re-renders if the style is re-loaded
    map.on("style.load", handleRings);

    return () => {
      map.off("style.load", handleRings);
    };
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
