import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { HighwayInfo } from "@/lib/fetch-highways";
import { MAPBOX_PROVIDER_STYLES } from "@/lib/mapbox-utils";

export interface MapboxHighwayImageDialogProps {
  open: boolean;
  lat: number;
  lng: number;
  token?: string;
  provider: string;
  highwayInfo: HighwayInfo[];
  onGenerateHighwayMap: (imageDataUrl: string) => void;
}

export function MapboxHighwayImageDialog({
  open,
  lat,
  lng,
  token,
  provider,
  highwayInfo,
  onGenerateHighwayMap,
}: MapboxHighwayImageDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const capturedRef = useRef(false);

  const getStyleUrl = (p: string) =>
    MAPBOX_PROVIDER_STYLES[p]?.url ?? MAPBOX_PROVIDER_STYLES["mapbox-v2"].url;

  useEffect(() => {
    if (!open || !token || !containerRef.current) return;
    mapboxgl.accessToken = token;

    const darkStyleUrl = MAPBOX_PROVIDER_STYLES["mapbox-v2"].url; // Force dark theme for highway maps

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: darkStyleUrl,
      center: [lng, lat],
      zoom: 10,
      attributionControl: false,
      preserveDrawingBuffer: true, // IMPORTANT for toPng
      interactive: false,
    });
    mapRef.current = map;

    map.on("style.load", async () => {
      // 1. Add site pin (Native WebGL layers instead of HTML markers for capture)
      map.addSource("site-pin", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lng, lat] } }
      });
      map.addLayer({
        id: "site-pin-halo",
        type: "circle",
        source: "site-pin",
        paint: { "circle-radius": 16, "circle-color": "#ffffff", "circle-opacity": 0.9 }
      });
      map.addLayer({
        id: "site-pin-inner",
        type: "circle",
        source: "site-pin",
        paint: { "circle-radius": 12, "circle-color": "#e53935" }
      });

      // 2. Add Highway Markers (Native WebGL layers)
      highwayInfo.forEach((hw, i) => {
        map.addSource(`hw-marker-${i}`, {
          type: "geojson",
          data: { type: "Feature", properties: { ref: hw.ref }, geometry: { type: "Point", coordinates: [hw.closestPoint.lng, hw.closestPoint.lat] } }
        });
        map.addLayer({
          id: `hw-halo-${i}`,
          type: "circle",
          source: `hw-marker-${i}`,
          paint: { "circle-radius": 16, "circle-color": "#ffffff", "circle-opacity": 0.9 }
        });
        map.addLayer({
          id: `hw-inner-${i}`,
          type: "circle",
          source: `hw-marker-${i}`,
          paint: { "circle-radius": 12, "circle-color": "#1a56db" }
        });
        map.addLayer({
          id: `hw-text-${i}`,
          type: "symbol",
          source: `hw-marker-${i}`,
          layout: {
            "text-field": "{ref}",
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 22,
            "text-anchor": "left",
            "text-offset": [1.2, 0],
            "text-allow-overlap": true,
          },
          paint: { 
            "text-color": "#1a56db",
            "text-halo-color": "#ffffff",
            "text-halo-width": 3
          }
        });
      });

      // 3. Initialize Bounds with endpoints
      const bounds = new mapboxgl.LngLatBounds([lng, lat], [lng, lat]);
      if (highwayInfo.length > 0) {
        highwayInfo.forEach((hw) => bounds.extend([hw.closestPoint.lng, hw.closestPoint.lat]));
      }

      // 4. Draw Routes
      if (highwayInfo.length > 0) {
        await Promise.all(
          highwayInfo.map(async (hw, i) => {
            try {
              const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${lng},${lat};${hw.closestPoint.lng},${hw.closestPoint.lat}?geometries=geojson&overview=full&access_token=${token}`;
              const res = await fetch(url);
              if (!res.ok) return;
              const json = await res.json() as { routes?: Array<{ geometry: GeoJSON.Geometry; distance: number }> };
              const route = json.routes?.[0];
              if (!route) return;

              map.addSource(`route-src-${i}`, {
                type: "geojson",
                data: { type: "Feature", properties: {}, geometry: route.geometry as GeoJSON.Geometry },
              });
              map.addLayer({
                id: `route-outline-${i}`,
                type: "line",
                source: `route-src-${i}`,
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.65 },
              });
              map.addLayer({
                id: `route-line-${i}`,
                type: "line",
                source: `route-src-${i}`,
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#1a56db", "line-width": 5, "line-opacity": 0.92 },
              });

              // Extend bounds to include the route path
              if (route.geometry.type === "LineString") {
                route.geometry.coordinates.forEach((coord) => {
                  bounds.extend([coord[0], coord[1]]);
                });
              }

            } catch { /* skip */ }
          })
        );
        
        // Fit map exactly to the new bounds that include routes
        // Padding increased significantly to 280 to ensure the path is fully visible and zoomed out in the PIP lens
        map.fitBounds(bounds, { padding: 280, maxZoom: 13.5, duration: 0 });
      }

      // Wait for all newly added sources/layers to actually render before capturing
      map.once("idle", () => {
        setImgLoaded(true);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [open, lat, lng, token, provider, highwayInfo]);

  useEffect(() => {
    if (imgLoaded && open && !capturedRef.current) {
      // Now that map is idle, capture it immediately
      setTimeout(() => {
        if (!mapRef.current) return;
        try {
          const dataUrl = mapRef.current.getCanvas().toDataURL("image/png");
          onGenerateHighwayMap(dataUrl);
        } catch (e) {
          console.error("Highway map capture failed:", e);
          onGenerateHighwayMap("");
        } finally {
          setIsCapturing(false);
        }
      }, 500); // 500ms buffer just to be absolutely sure WebGL flushed
    }
  }, [imgLoaded, open, onGenerateHighwayMap]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[-1] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="overflow-hidden"
          style={{ width: "1200px", height: "1200px" }}
        >
          {/* Map Image container for capture */}
          <div ref={containerRef} className="w-full h-full" />
        </div>
      </div>
    </AnimatePresence>
  );
}
