import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useServerFn } from '@tanstack/react-start';
import { GoogleMap, Polyline, Circle, OverlayView, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'sonner';
import { Instagram, MessageCircle, Printer, Download, Link2, Save, MapPin, Compass } from 'lucide-react';
import { useReportStore } from '@/stores/reportStore';
import { useMapKeys } from '@/hooks/useMapKeys';
import { fetchRoads } from '@/lib/fetch-roads.functions';
import { useBrochureExport } from '@/hooks/useBrochureExport';
import {
  CATEGORY_META,
  BROCHURE_MAP_STYLES,
  DISTANCE_RINGS,
  ROAD_TIER_STYLE,
} from '@/lib/map-styles';
import type { RoadSegment } from '@/types';

type Template = 'connectivity' | 'proximity' | 'investment';
type ExportFormat = 'instagram' | 'whatsapp' | 'print';

const TEMPLATES: Array<{ id: Template; name: string; colors: [string, string, string] }> = [
  { id: 'connectivity', name: 'Connectivity Map', colors: ['#0f1e35', '#b8954a', '#f5f0e8'] },
  { id: 'proximity', name: 'Proximity Cards', colors: ['#3d5a7a', '#e8a87c', '#fbf6ea'] },
  { id: 'investment', name: 'Investment Brief', colors: ['#1a3c2a', '#d4b077', '#f5f0e8'] },
];

const FORMATS: Array<{ id: ExportFormat; label: string; dims: string; Icon: typeof Instagram }> = [
  { id: 'instagram', label: 'Instagram 1:1', dims: '1080 × 1080', Icon: Instagram },
  { id: 'whatsapp', label: 'WhatsApp 9:16', dims: '1080 × 1920', Icon: MessageCircle },
  { id: 'print', label: 'Print A4', dims: '2480 × 3508', Icon: Printer },
];

const ASPECT_BY_FORMAT: Record<ExportFormat, string> = {
  instagram: 'aspect-square',
  whatsapp: 'aspect-[9/16]',
  print: 'aspect-[210/297]',
};

export default function BrochureModal() {
  const open = useReportStore((s) => s.brochureOpen);
  const setOpen = useReportStore((s) => s.setBrochureOpen);
  const report = useReportStore((s) => s.locationReport);
  const selectedPois = useReportStore((s) => s.selectedPois);
  const keys = useMapKeys();

  const fetchRoadsFn = useServerFn(fetchRoads);
  const [roads, setRoads] = useState<RoadSegment[]>([]);
  const [template, setTemplate] = useState<Template>('connectivity');
  const [projectName, setProjectName] = useState(report?.site.label ?? 'Site Location');
  const [format, setFormat] = useState<ExportFormat>('instagram');
  const canvasRef = useRef<HTMLDivElement>(null);
  const { exportPng } = useBrochureExport(canvasRef, format, report?.reportId ?? 'report');

  useEffect(() => {
    if (report) setProjectName(report.site.label);
  }, [report]);

  useEffect(() => {
    if (!open || !report) return;
    let cancelled = false;
    fetchRoadsFn({ data: { bbox: report.bbox } })
      .then((r) => !cancelled && setRoads(r))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, report, fetchRoadsFn]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  // Active category legend — unique types from selected POIs.
  const activeCategories = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ type: string; color: string }> = [];
    for (const p of selectedPois) {
      if (seen.has(p.type)) continue;
      seen.add(p.type);
      const meta = CATEGORY_META[p.type];
      if (meta) out.push({ type: p.type, color: meta.color });
    }
    return out;
  }, [selectedPois]);

  if (!report) return null;
  const activeTemplate = TEMPLATES.find((t) => t.id === template)!;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 overflow-hidden bg-transparent border-none shadow-none sm:rounded-none">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="grid grid-cols-1 md:grid-cols-[60fr_40fr] bg-white rounded-xl overflow-hidden h-full w-full"
            >
              {/* LEFT — Live styled map canvas */}
              <div className="relative bg-[#1a1a1a] p-6 flex items-center justify-center overflow-hidden">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className={`relative w-auto h-full max-h-full ${ASPECT_BY_FORMAT[format]} shadow-2xl rounded-md overflow-hidden bg-white`}
                  style={{ boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)' }}
                >
                  <div ref={canvasRef} className="relative w-full h-full">
                    <BrochureMap
                      apiKey={keys?.googleMapsKey}
                      site={report.site}
                      pois={selectedPois}
                      roads={roads}
                    />

                    {/* Header band */}
                    <div
                      className="absolute top-0 left-0 right-0 px-5 py-4 pointer-events-none z-10"
                      style={{ background: `linear-gradient(180deg, ${activeTemplate.colors[0]}ee 0%, ${activeTemplate.colors[0]}00 100%)` }}
                    >
                      <div className="text-[10px] tracking-[0.3em] uppercase" style={{ color: activeTemplate.colors[1] }}>
                        {activeTemplate.name}
                      </div>
                      <div
                        className="font-heading text-2xl mt-1 leading-tight"
                        style={{ color: '#fff', fontFamily: 'Playfair Display, serif' }}
                      >
                        {projectName}
                      </div>
                    </div>

                    {/* Category legend strip */}
                    {activeCategories.length > 0 && (
                      <div className="absolute left-3 right-3 bottom-14 pointer-events-none z-10 flex flex-wrap gap-1.5 justify-center">
                        {activeCategories.map((c) => (
                          <div
                            key={c.type}
                            className="flex items-center gap-1.5 bg-white/95 backdrop-blur px-2 py-1 rounded-full shadow text-[9px] tracking-[0.18em] uppercase text-[#0f1e35] font-semibold"
                          >
                            <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                            {c.type}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Branded footer bar */}
                    <div
                      className="absolute bottom-0 left-0 right-0 px-5 py-3 pointer-events-none flex items-center justify-between z-10"
                      style={{ background: `linear-gradient(0deg, ${activeTemplate.colors[0]}f2 0%, ${activeTemplate.colors[0]}00 100%)` }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: activeTemplate.colors[1] }}
                        >
                          <Compass className="w-3.5 h-3.5" style={{ color: activeTemplate.colors[0] }} />
                        </div>
                        <div className="leading-tight">
                          <div className="text-[8px] tracking-[0.3em] uppercase text-white/70">Prepared by</div>
                          <div className="text-[11px] font-semibold text-white tracking-wide">LocateIQ</div>
                        </div>
                      </div>
                      <div className="text-right leading-tight">
                        <div className="text-[8px] tracking-[0.25em] uppercase text-white/70">
                          {selectedPois.length} key destinations
                        </div>
                        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold" style={{ color: activeTemplate.colors[1] }}>
                          {projectName}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* RIGHT — Controls */}
              <div className="bg-[#f5f0e8] p-6 md:p-8 flex flex-col gap-6 overflow-y-auto">
                <div>
                  <div className="text-[10px] tracking-[0.3em] text-[var(--gold)] uppercase font-semibold">
                    Brochure Studio
                  </div>
                  <h2 className="font-heading text-[22px] text-[#0f1e35] mt-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Customize & Download
                  </h2>
                </div>

                <div>
                  <label className="text-[10px] tracking-[0.25em] text-[#b8954a] font-semibold uppercase mb-2 block">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full bg-white border border-[#e8e2d4] rounded-md px-3 py-2.5 text-sm text-[#0f1e35] focus:outline-none focus:border-[#b8954a]"
                  />
                </div>

                <div className="h-px bg-[#d4b077]/40" />

                <div>
                  <div className="text-[10px] tracking-[0.25em] text-[#b8954a] font-semibold uppercase mb-3">
                    Template
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {TEMPLATES.map((t) => {
                      const active = template === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTemplate(t.id)}
                          className={`text-left rounded-lg border-2 overflow-hidden transition ${
                            active ? 'border-[#b8954a] shadow-md' : 'border-[#e8e2d4] hover:border-[#b8954a]/50'
                          }`}
                        >
                          <div className="h-16 flex flex-col">
                            <div className="flex-1 flex">
                              <div className="flex-1" style={{ background: t.colors[0] }} />
                              <div className="w-1/3" style={{ background: t.colors[1] }} />
                            </div>
                            <div className="h-3" style={{ background: t.colors[2] }} />
                          </div>
                          <div className="px-2 py-2 bg-white text-[10px] font-semibold text-[#0f1e35] leading-tight">
                            {t.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-px bg-[#d4b077]/40" />

                <div>
                  <div className="text-[10px] tracking-[0.25em] text-[#b8954a] font-semibold uppercase mb-3">
                    Format
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {FORMATS.map((f) => {
                      const active = format === f.id;
                      const Icon = f.Icon;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setFormat(f.id)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition ${
                            active ? 'border-[#b8954a] bg-white shadow-sm' : 'border-[#e8e2d4] bg-white/60 hover:bg-white'
                          }`}
                        >
                          <Icon className="w-5 h-5 text-[#0f1e35]" />
                          <span className="text-[11px] font-semibold text-[#0f1e35] leading-none">{f.label}</span>
                          <span className="text-[9px] tracking-wider text-[#6a6557] font-mono">{f.dims}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1" />

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={exportPng}
                    className="w-full bg-[#b8954a] text-[#0f1e35] rounded-lg py-3.5 flex items-center justify-center gap-2 hover:brightness-105 transition shadow-sm"
                    style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 600 }}
                  >
                    Download PNG <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="w-full border border-[#0f1e35]/25 text-[#0f1e35] rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-[#0f1e35]/5 transition text-sm font-medium"
                  >
                    <Link2 className="w-4 h-4" /> Copy Link
                  </button>
                  <button
                    onClick={exportPng}
                    className="w-full border border-[#0f1e35]/25 text-[#0f1e35] rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-[#0f1e35]/5 transition text-sm font-medium"
                  >
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Brochure-grade map ----------

function buildCurvedPath(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  stagger: number,
): google.maps.LatLngLiteral[] {
  const steps = 48;
  const mx = (a.lat + b.lat) / 2;
  const my = (a.lng + b.lng) / 2;
  const dx = b.lat - a.lat;
  const dy = b.lng - a.lng;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const curve = len * (0.2 + stagger * 0.08);
  const cx = mx + px * curve;
  const cy = my + py * curve;
  const out: google.maps.LatLngLiteral[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const omt = 1 - t;
    out.push({
      lat: omt * omt * a.lat + 2 * omt * t * cx + t * t * b.lat,
      lng: omt * omt * a.lng + 2 * omt * t * cy + t * t * b.lng,
    });
  }
  return out;
}

// Push label outward from SITE along the radial vector, with collision-aware
// angular nudging so nearby POI chips don't sit on top of each other.
function computeLabelOffsets(
  pois: Array<{ id: string; lat: number; lng: number }>,
  site: { lat: number; lng: number },
) {
  const sorted = [...pois]
    .map((p) => {
      const dx = p.lng - site.lng;
      const dy = p.lat - site.lat;
      return { id: p.id, angle: Math.atan2(dy, dx) };
    })
    .sort((a, b) => a.angle - b.angle);

  const adjusted = new Map<string, number>();
  const minGap = (Math.PI * 2) / Math.max(sorted.length, 6); // dynamic spread
  for (let i = 0; i < sorted.length; i++) {
    let angle = sorted[i].angle;
    if (i > 0) {
      const prev = adjusted.get(sorted[i - 1].id)!;
      if (angle - prev < minGap * 0.6) angle = prev + minGap * 0.6;
    }
    adjusted.set(sorted[i].id, angle);
  }
  // Convert angle → pixel offset direction
  const dirs = new Map<string, { x: number; y: number }>();
  adjusted.forEach((angle, id) => {
    dirs.set(id, { x: Math.cos(angle), y: -Math.sin(angle) });
  });
  return dirs;
}

function BrochureMap({
  apiKey, site, pois, roads,
}: {
  apiKey?: string;
  site: { lat: number; lng: number };
  pois: Array<{ id: string; name: string; type: string; lat: number; lng: number; distanceKm: number }>;
  roads: RoadSegment[];
}) {
  const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: apiKey ?? '' });
  const mapRef = useRef<google.maps.Map | null>(null);
  const { lat, lng } = site;

  // Optimized framing: include rings + all POIs with generous padding.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = new google.maps.LatLngBounds();
    b.extend({ lat, lng });
    // 1km ring approx (~0.009 deg)
    b.extend({ lat: lat + 0.012, lng: lng + 0.012 });
    b.extend({ lat: lat - 0.012, lng: lng - 0.012 });
    pois.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(b, { top: 90, right: 50, bottom: 110, left: 50 });
    window.setTimeout(() => map.panTo({ lat, lng }), 60);
  }, [pois, lat, lng, isLoaded]);

  const labelDirs = useMemo(() => computeLabelOffsets(pois, site), [pois, site]);

  if (!isLoaded || !apiKey) {
    return (
      <div className="w-full h-full bg-[#f5f0e8] flex items-center justify-center text-[#6a6557] text-sm">
        Loading map…
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={{ lat, lng }}
      zoom={14}
      onLoad={(m) => { mapRef.current = m; }}
      onUnmount={() => { mapRef.current = null; }}
      options={{
        disableDefaultUI: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        styles: BROCHURE_MAP_STYLES,
        backgroundColor: '#f5f0e8',
      }}
    >
      {/* Distance rings removed — cleaner editorial canvas */}

      {/* Roads (subdued highways only for context) */}
      {roads.filter((r) => r.tier === 'highway').map((r, i) => (
        <Polyline
          key={`hw-${i}`}
          path={r.points.map((p) => ({ lat: p.lat, lng: p.lng }))}
          options={{
            strokeColor: ROAD_TIER_STYLE[r.tier].color,
            strokeWeight: 3.5,
            strokeOpacity: 0.5,
            zIndex: 10,
            clickable: false,
          }}
        />
      ))}

      {/* POI routes — bezier with glow + dashed colored top */}
      {pois.map((p, idx) => {
        const meta = CATEGORY_META[p.type] ?? { Icon: MapPin, color: '#0f1e35' };
        const color = meta.color;
        const stagger = (idx % 2 === 0 ? 1 : -1) * (0.4 + (idx % 3) * 0.3);
        const path = buildCurvedPath({ lat, lng }, { lat: p.lat, lng: p.lng }, stagger);
        return (
          <Fragment key={`route-${p.id}`}>
            <Polyline
              path={path}
              options={{
                strokeColor: color, strokeOpacity: 0.18, strokeWeight: 18,
                zIndex: 80, clickable: false,
              }}
            />
            <Polyline
              path={path}
              options={{
                strokeColor: '#ffffff', strokeOpacity: 0.8, strokeWeight: 9,
                zIndex: 81, clickable: false,
              }}
            />
            <Polyline
              path={path}
              options={{
                strokeColor: color, strokeOpacity: 0, strokeWeight: 5,
                zIndex: 82, clickable: false,
                icons: [{
                  icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: color, strokeWeight: 5, scale: 5 },
                  offset: '0', repeat: '16px',
                }],
              }}
            />
          </Fragment>
        );
      })}

      {/* POI markers with smart label offset */}
      {pois.map((p) => {
        const meta = CATEGORY_META[p.type] ?? { Icon: MapPin, color: '#0f1e35' };
        const Icon = meta.Icon;
        const color = meta.color;
        const dir = labelDirs.get(p.id) ?? { x: 0, y: -1 };
        const offX = dir.x * 46;
        const offY = dir.y * 46;
        return (
          <OverlayView
            key={`m-${p.id}`}
            position={{ lat: p.lat, lng: p.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{ transform: 'translate(-50%, -50%)' }}
              className="relative"
            >
              {/* connector line to chip */}
              <svg
                className="absolute pointer-events-none"
                width={Math.abs(offX) * 2 + 4}
                height={Math.abs(offY) * 2 + 4}
                style={{ left: -Math.abs(offX) - 2, top: -Math.abs(offY) - 2 }}
              >
                <line
                  x1={Math.abs(offX) + 2}
                  y1={Math.abs(offY) + 2}
                  x2={Math.abs(offX) + 2 + offX}
                  y2={Math.abs(offY) + 2 + offY}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  opacity={0.6}
                />
              </svg>
              {/* infographic marker */}
              <div
                className="relative flex items-center justify-center rounded-full border-[4px] border-white"
                style={{
                  width: 38, height: 38,
                  background: color,
                  boxShadow: `0 6px 16px rgba(15,30,53,0.45), 0 0 0 1px ${color}55`,
                }}
              >
                <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              {/* label chip pushed outward */}
              <div
                className="absolute flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white text-[10px] font-semibold shadow-md whitespace-nowrap"
                style={{
                  left: `calc(50% + ${offX}px)`,
                  top: `calc(50% + ${offY}px)`,
                  transform: 'translate(-50%, -50%)',
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <span className="truncate max-w-[130px]" style={{ color: '#0f1e35' }}>{p.name}</span>
                <span className="font-bold" style={{ color }}>· {p.distanceKm.toFixed(1)}km</span>
              </div>
            </motion.div>
          </OverlayView>
        );
      })}

      {/* Clean SITE pin — no glow, pulse, or heavy shadow. Tip anchors on coordinate. */}
      <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
        <div
          style={{ transform: 'translate(-50%, -100%)', zIndex: 700, position: 'relative' }}
          className="pointer-events-none"
        >
          <svg width="44" height="56" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    </GoogleMap>
  );
}
