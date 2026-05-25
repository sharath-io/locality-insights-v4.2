import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, Polyline, OverlayView, useJsApiLoader } from '@react-google-maps/api';
import { useServerFn } from '@tanstack/react-start';
import { fetchRoads } from '@/lib/fetch-roads.functions';
import type { RoadSegment } from '@/types';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ArrowLeft, Sparkles, MapPin } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useReportStore } from '@/stores/reportStore';
import { usePlacesSearch } from '@/hooks/usePlacesSearch';
import { useMapKeys } from '@/hooks/useMapKeys';
import { CATEGORY_META, ROAD_FOCUS_STYLES } from '@/lib/map-styles';
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

  const setSelectedPois = useReportStore((s) => s.setSelectedPois);
  useEffect(() => {
    const list = topPois
      .filter((p) => checkedIds.has(p.id))
      .map(({ id, name, type, lat, lng, distanceKm }) => ({ id, name, type, lat, lng, distanceKm }));
    setSelectedPois(list);
  }, [checkedIds, topPois, setSelectedPois]);

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

          {/* Category legend */}
          <AnimatePresence>
            {activePois.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-lg shadow px-3 py-2 flex flex-wrap gap-x-3 gap-y-1.5 max-w-[60%]"
              >
                {Array.from(new Set(activePois.map((p) => p.type))).map((t) => {
                  const meta = CATEGORY_META[t] ?? { color: '#666' };
                  return (
                    <div key={t} className="flex items-center gap-1.5 text-[9px] tracking-[0.2em] uppercase font-semibold text-[var(--navy)]">
                      <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                      {t}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

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
    // Generous padding so POIs/labels sit comfortably inside the frame.
    const padLat = Math.max(maxDLat * 1.6, 0.0035);
    const padLng = Math.max(maxDLng * 1.6, 0.0035);
    const bounds = new google.maps.LatLngBounds(
      { lat: lat - padLat, lng: lng - padLng },
      { lat: lat + padLat, lng: lng + padLng },
    );
    map.fitBounds(bounds, 80);
    // fitBounds may shift center slightly; re-center on site.
    window.setTimeout(() => map.panTo({ lat, lng }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedKey, lat, lng]);

  if (!isLoaded) {
    return <div className="w-full h-full bg-[var(--cream)]" />;
  }


  // Build a curved bezier path between two points with a perpendicular control offset.
  // `stagger` shifts the curve so overlapping routes don't stack on the same path.
  const buildCurvedPath = (
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
    stagger: number,
  ): google.maps.LatLngLiteral[] => {
    const steps = 40;
    const mx = (a.lat + b.lat) / 2;
    const my = (a.lng + b.lng) / 2;
    const dx = b.lat - a.lat;
    const dy = b.lng - a.lng;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const curve = len * (0.18 + stagger * 0.08);
    const cx = mx + px * curve;
    const cy = my + py * curve;
    const pts: google.maps.LatLngLiteral[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const omt = 1 - t;
      pts.push({
        lat: omt * omt * a.lat + 2 * omt * t * cx + t * t * b.lat,
        lng: omt * omt * a.lng + 2 * omt * t * cy + t * t * b.lng,
      });
    }
    return pts;
  };



  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={{ lat, lng }}
      zoom={15}
      mapTypeId="roadmap"
      onLoad={(m) => { mapRef.current = m; }}
      onUnmount={() => { mapRef.current = null; }}
      options={{ disableDefaultUI: true, zoomControl: true, styles: ROAD_FOCUS_STYLES }}
    >
      {/* Distance rings removed for a cleaner brochure-grade canvas. */}
      {/* Road tier overlay suppressed — base map roads + curved POI routes carry the visual weight. */}


      {/* Routes (rendered below markers/labels via zIndex hierarchy) */}
      {activePois.map((p, idx) => {
        const meta = CATEGORY_META[p.type] ?? { Icon: MapPin, color: '#0f1e35' };
        const color = meta.color;
        const stagger = (idx % 2 === 0 ? 1 : -1) * (0.4 + (idx % 3) * 0.3);
        const path = buildCurvedPath({ lat, lng }, { lat: p.lat, lng: p.lng }, stagger);
        return (
          <Fragment key={`route-${p.id}`}>
            {/* soft outer glow */}
            <Polyline path={path} options={{ strokeColor: color, strokeOpacity: 0.10, strokeWeight: 16, zIndex: 100, clickable: false }} />
            {/* inner white cushion to lift the dashed line off the basemap */}
            <Polyline path={path} options={{ strokeColor: '#ffffff', strokeOpacity: 0.75, strokeWeight: 5, zIndex: 101, clickable: false }} />
            {/* crisp coloured dashed top line */}
            <Polyline
              path={path}
              options={{
                strokeOpacity: 0,
                strokeWeight: 3,
                zIndex: 102,
                clickable: false,
                icons: [{
                  icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: color, strokeWeight: 3.2, scale: 3 },
                  offset: '0',
                  repeat: '12px',
                }],
              }}
            />
          </Fragment>
        );
      })}

      {/* POI markers + smart radial labels */}
      {(() => {
        // 1. Compute angle (screen-space; y flipped) for each POI relative to SITE.
        const withAngles = activePois.map((p) => {
          const dx = p.lng - lng;
          const dy = -(p.lat - lat); // negate so + = up on screen
          return { p, angle: Math.atan2(dy, dx) };
        });
        // 2. Sort by angle and compute offset multipliers to relieve angular crowding.
        const sorted = [...withAngles].sort((a, b) => a.angle - b.angle);
        const offsetMap = new Map<string, number>();
        const MIN_GAP = (28 * Math.PI) / 180; // ~28° before we push outward
        sorted.forEach((cur, i) => {
          if (sorted.length === 1) { offsetMap.set(cur.p.id, 1); return; }
          const prev = sorted[(i - 1 + sorted.length) % sorted.length];
          const next = sorted[(i + 1) % sorted.length];
          const gap = (a: number, b: number) => {
            const d = Math.abs(a - b) % (2 * Math.PI);
            return Math.min(d, 2 * Math.PI - d);
          };
          const tightest = Math.min(gap(cur.angle, prev.angle), gap(cur.angle, next.angle));
          let mult = 1;
          if (tightest < MIN_GAP) mult = 1 + (i % 3) * 0.55; // alternate radial distance
          offsetMap.set(cur.p.id, mult);
        });

        return withAngles.map(({ p, angle }) => {
          const meta = CATEGORY_META[p.type] ?? { Icon: MapPin, color: '#0f1e35' };
          const color = meta.color;
          const Icon = meta.Icon;
          const mult = offsetMap.get(p.id) ?? 1;
          // Marker radius 15 + 12px gap + extra per crowding tier.
          const radial = 15 + 14 * mult;
          const lx = Math.cos(angle) * radial;
          const ly = -Math.sin(angle) * radial; // back to screen-y (down positive)
          // Quadrant → translate so label sits OUTWARD from marker.
          const absCos = Math.abs(Math.cos(angle));
          const absSin = Math.abs(Math.sin(angle));
          let tx = '-50%';
          let ty = '-50%';
          if (absCos >= absSin) {
            tx = Math.cos(angle) > 0 ? '0%' : '-100%';
            ty = '-50%';
          } else {
            tx = '-50%';
            ty = Math.sin(angle) > 0 ? '-100%' : '0%'; // sin>0 means up on screen → label above
          }
          return (
            <OverlayView
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{ transform: 'translate(-50%, -50%)', position: 'relative' }}
              >
                {/* connector line from marker to label when offset is large */}
                {mult > 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: radial - 15,
                      height: 1.5,
                      background: `${color}80`,
                      transformOrigin: '0 50%',
                      transform: `rotate(${-angle}rad) translateX(15px)`,
                      zIndex: 300,
                      pointerEvents: 'none',
                    }}
                  />
                )}
                {/* circular icon marker */}
                <div
                  className="relative flex items-center justify-center rounded-full border-[3px] border-white"
                  style={{
                    width: 30,
                    height: 30,
                    background: color,
                    boxShadow: `0 4px 10px rgba(15,30,53,0.35), 0 0 0 1px ${color}40`,
                    transform: !p.checked ? `scale(${1 + bounce * 0.12})` : undefined,
                    transition: 'transform 220ms ease-out',
                    zIndex: 400,
                  }}
                >
                  <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </div>
                {/* label chip placed radially outward */}
                <div
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${lx}px)`,
                    top: `calc(50% + ${ly}px)`,
                    transform: `translate(${tx}, ${ty})`,
                    zIndex: 500,
                  }}
                >
                  <div
                    className="px-2 py-1.5 rounded-md bg-white shadow-md whitespace-nowrap"
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    <div className="text-[10px] font-bold text-[var(--navy)] leading-tight truncate max-w-[150px]">
                      {p.name}
                    </div>
                    <div className="text-[9px] font-bold leading-tight mt-0.5" style={{ color }}>
                      {p.distanceKm.toFixed(1)} km
                    </div>
                  </div>
                </div>
              </motion.div>
            </OverlayView>
          );
        });
      })()}

      {/* Premium SITE marker — layered HTML overlay */}
      <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
        <div
          style={{ transform: 'translate(-50%, -50%)', zIndex: 700, position: 'relative' }}
          className="pointer-events-none"
        >
          {/* outer animated pulse ring */}
          <span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-[#d64545] opacity-25 animate-ping"
            style={{ animationDuration: '2.4s' }}
          />
          {/* soft radial glow */}
          <span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(214,69,69,0.45) 0%, rgba(214,69,69,0) 70%)' }}
          />
          {/* thick white-bordered red circle */}
          <span
            className="relative block w-10 h-10 rounded-full bg-[#d64545] border-[5px] border-white"
            style={{ boxShadow: '0 8px 20px rgba(15,30,53,0.5), 0 2px 4px rgba(0,0,0,0.3)' }}
          >
            {/* strong center core dot */}
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white" />
          </span>
        </div>
      </OverlayView>
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
