import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, Marker, Polyline, OverlayView, useJsApiLoader } from '@react-google-maps/api';
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
import { Checkbox } from '@/components/ui/checkbox';
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
  const setBrochureOpen = useReportStore((s) => s.setBrochureOpen);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  usePlacesSearch();

  useEffect(() => {
    if (!coordinates) navigate({ to: '/' });
  }, [coordinates, navigate]);

  const serial = locationReport?.reportId.replace(/-/g, '').slice(0, 4).toUpperCase() ?? '----';

  const topPois: PoiRow[] = useMemo(() => {
    if (!locationReport) return [];
    const flat: PoiRow[] = locationReport.pois.flatMap((g) =>
      g.items.map((it) => ({
        ...it,
        type: g.type,
        id: `${g.type}|${it.name}|${it.lat.toFixed(5)}|${it.lng.toFixed(5)}`,
      }))
    );
    return flat.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 15);
  }, [locationReport]);

  const poiById = useMemo(() => {
    const m = new Map<string, PoiRow>();
    topPois.forEach((p) => m.set(p.id, p));
    return m;
  }, [topPois]);

  const activePois = useMemo(() => {
    const set = new Map<string, PoiRow>();
    checkedIds.forEach((id) => {
      const p = poiById.get(id);
      if (p) set.set(id, p);
    });
    if (hoveredId && poiById.has(hoveredId)) {
      set.set(hoveredId, poiById.get(hoveredId)!);
    }
    return Array.from(set.values()).map((p) => ({
      ...p,
      checked: checkedIds.has(p.id),
    }));
  }, [hoveredId, checkedIds, poiById]);

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

      <section className="px-6 md:px-10 pt-6">
        <div
          className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-[#e8e2d4]"
          style={{ height: '45vh' }}
        >
          <MapView activePois={activePois} />

          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-md shadow font-mono text-[11px] text-[var(--navy)]">
            {coordinates.lat.toFixed(5)}° N, {coordinates.lng.toFixed(5)}° E
          </div>

          <div className="absolute bottom-4 right-4 flex gap-1 bg-white/95 backdrop-blur rounded-full p-1 shadow">
            {(['google', 'mapbox'] as const).map((p) => {
              const active = mapProvider === p;
              return (
                <button
                  key={p}
                  onClick={() => setMapProvider(p)}
                  className={`text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full transition ${
                    active ? 'bg-[var(--navy)] text-white' : 'text-[var(--navy)] hover:bg-[var(--cream)]'
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

      <section className="px-6 md:px-10 pt-12">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] tracking-[0.25em] text-[var(--gold)] uppercase font-medium">
              Proximity Matrix
            </div>
            <h2 className="font-heading text-[22px] text-[var(--navy)] mt-1">Nearby Intelligence</h2>
          </div>
          <AnimatePresence>
            {checkedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                className="flex items-center gap-2 bg-[var(--navy)] text-white text-[11px] tracking-[0.15em] uppercase px-3 py-1.5 rounded-full shadow"
              >
                <Sparkles className="w-3 h-3 text-[var(--gold)]" />
                {checkedIds.size} selected for brochure
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
          {topPois.map((p, i) => {
            const meta = CATEGORY_META[p.type] ?? { Icon: MapPin, color: '#666' };
            const Icon = meta.Icon;
            const isChecked = checkedIds.has(p.id);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onMouseEnter={() => setHoveredId(p.id)}
                onMouseLeave={() => setHoveredId((h) => (h === p.id ? null : h))}
                className={`group flex items-center gap-3 bg-white border rounded-lg pl-3 pr-4 py-3 cursor-pointer transition-all hover:shadow-md ${
                  isChecked
                    ? 'border-l-[3px] border-l-[var(--gold)] border-[#e8e2d4] bg-[#fbf6ea]'
                    : 'border-[#e8e2d4]'
                }`}
                onClick={() => toggleChecked(p.id)}
                style={isChecked ? { borderLeftColor: meta.color } : undefined}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggleChecked(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                />
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

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          onClick={() => setBrochureOpen(true)}
          className="relative bg-[var(--gold)] text-[var(--navy)] font-medium rounded-full px-8 py-3 shadow-lg flex items-center gap-2 hover:scale-[1.02] transition"
        >
          <span className="absolute inset-0 rounded-full bg-[var(--gold)] animate-ping opacity-30" />
          <Sparkles className="w-4 h-4 relative" />
          <span className="relative">Create Brochure</span>
          {checkedIds.size > 0 && (
            <span className="relative ml-1 text-[11px] bg-[var(--navy)] text-white rounded-full px-2 py-0.5">
              {checkedIds.size}
            </span>
          )}
        </button>
      </div>
      <BrochureModal />
    </main>
  );
}

type ActivePoi = PoiRow & { checked: boolean };

function MapView({ activePois }: { activePois: ActivePoi[] }) {
  const coordinates = useReportStore((s) => s.coordinates)!;
  const mapProvider = useReportStore((s) => s.mapProvider);
  const keys = useMapKeys();
  const loadRoads = useServerFn(fetchRoads);
  const [roads, setRoads] = useState<RoadSegment[]>([]);

  useEffect(() => {
    let cancelled = false;
    const d = 0.025;
    loadRoads({
      data: {
        bbox: {
          minLat: coordinates.lat - d,
          maxLat: coordinates.lat + d,
          minLng: coordinates.lng - d,
          maxLng: coordinates.lng + d,
        },
      },
    })
      .then((r) => !cancelled && setRoads(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coordinates, loadRoads]);

  if (mapProvider === 'mapbox') {
    return <MapboxMap lat={coordinates.lat} lng={coordinates.lng} token={keys?.mapboxToken} />;
  }
  return (
    <GoogleMapView
      lat={coordinates.lat}
      lng={coordinates.lng}
      apiKey={keys?.googleMapsKey}
      roads={roads}
      activePois={activePois}
    />
  );
}

function GoogleMapView({
  lat, lng, apiKey, roads, activePois,
}: { lat: number; lng: number; apiKey?: string; roads: RoadSegment[]; activePois: ActivePoi[] }) {
  if (!apiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--cream)] text-[var(--muted)] text-sm">
        Loading map…
      </div>
    );
  }
  return <GoogleMapInner lat={lat} lng={lng} apiKey={apiKey} roads={roads} activePois={activePois} />;
}

const ROAD_FOCUS_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#f2b441' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#8a5a17' }, { weight: 1.5 }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#3a2a10' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#0f1e35' }, { weight: 1.2 }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#0f1e35' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ color: '#b8b2a3' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#6a6557' }] },
];

function GoogleMapInner({
  lat, lng, apiKey, roads, activePois,
}: { lat: number; lng: number; apiKey: string; roads: RoadSegment[]; activePois: ActivePoi[] }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });
  const [bounce, setBounce] = useState(0);
  const mapRef = useRef<google.maps.Map | null>(null);

  // tick to animate POI markers (CSS-like bounce via re-render of scale)
  useEffect(() => {
    if (!isLoaded) return;
    const id = window.setInterval(() => setBounce((b) => (b + 1) % 2), 450);
    return () => window.clearInterval(id);
  }, [isLoaded]);

  // Auto-fit zoom when checked POIs change, keeping the site centered.
  const checkedPois = activePois.filter((p) => p.checked);
  const checkedKey = checkedPois.map((p) => p.id).sort().join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || checkedPois.length === 0) return;
    let maxDLat = 0;
    let maxDLng = 0;
    for (const p of checkedPois) {
      maxDLat = Math.max(maxDLat, Math.abs(p.lat - lat));
      maxDLng = Math.max(maxDLng, Math.abs(p.lng - lng));
    }
    // Pad ~20% so points aren't on the edge
    const padLat = Math.max(maxDLat * 1.2, 0.002);
    const padLng = Math.max(maxDLng * 1.2, 0.002);
    const bounds = new google.maps.LatLngBounds(
      { lat: lat - padLat, lng: lng - padLng },
      { lat: lat + padLat, lng: lng + padLng },
    );
    // Only zoom out — don't override the user's closer zoom unnecessarily.
    const currentBounds = map.getBounds();
    if (currentBounds && currentBounds.contains({ lat: lat + padLat, lng: lng + padLng } as google.maps.LatLngLiteral)
      && currentBounds.contains({ lat: lat - padLat, lng: lng - padLng } as google.maps.LatLngLiteral)) {
      return;
    }
    map.fitBounds(bounds, 40);
    // fitBounds may shift center slightly; re-center on site.
    window.setTimeout(() => map.panTo({ lat, lng }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedKey, lat, lng]);

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

  const tierStyle: Record<RoadSegment['tier'], { color: string; weight: number; opacity: number; zIndex: number }> = {
    highway: { color: '#ff6a1f', weight: 6, opacity: 0.95, zIndex: 30 },
    main: { color: '#1e7fd6', weight: 4, opacity: 0.85, zIndex: 20 },
    local: { color: '#6a6557', weight: 1.5, opacity: 0.35, zIndex: 10 },
  };

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={{ lat, lng }}
      zoom={15}
      mapTypeId="roadmap"
      options={{ disableDefaultUI: true, zoomControl: true, styles: ROAD_FOCUS_STYLES }}
    >
      {roads.map((r, i) => (
        <Polyline
          key={i}
          path={r.points.map((p) => ({ lat: p.lat, lng: p.lng }))}
          options={{
            strokeColor: tierStyle[r.tier].color,
            strokeWeight: tierStyle[r.tier].weight,
            strokeOpacity: tierStyle[r.tier].opacity,
            zIndex: tierStyle[r.tier].zIndex,
            clickable: false,
          }}
        />
      ))}

      {activePois.map((p) => {
        const meta = CATEGORY_META[p.type] ?? { Icon: MapPin, color: '#0f1e35' };
        const color = meta.color;
        const mid = { lat: (lat + p.lat) / 2, lng: (lng + p.lng) / 2 };
        return (
          <Fragment key={p.id}>
            <Polyline
              path={[{ lat, lng }, { lat: p.lat, lng: p.lng }]}
              options={{
                strokeColor: color,
                strokeOpacity: 0,
                strokeWeight: 3,
                zIndex: 80,
                clickable: false,
                icons: [
                  {
                    icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                    offset: '0',
                    repeat: '12px',
                  },
                ],
              }}
            />
            <Marker
              position={{ lat: p.lat, lng: p.lng }}
              zIndex={90}
              icon={{
                path: 'M 0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0',
                fillColor: color,
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2.5,
                scale: p.checked ? 1 : 1 + bounce * 0.25,
                anchor: new google.maps.Point(0, 0),
              } as google.maps.Symbol}
            />
            <OverlayView
              position={mid}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                style={{ transform: 'translate(-50%, -50%)' }}
                className="px-2 py-0.5 rounded-full bg-white text-[10px] font-semibold shadow border whitespace-nowrap"
              >
                <span style={{ color }}>{p.distanceKm.toFixed(1)} km</span>
              </div>
            </OverlayView>
          </Fragment>
        );
      })}

      <Marker position={{ lat, lng }} icon={markerIcon as google.maps.Symbol} zIndex={100} />
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
