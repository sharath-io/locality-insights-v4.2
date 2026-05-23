import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useServerFn } from '@tanstack/react-start';
import { GoogleMap, Marker, Polyline, OverlayView, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'sonner';
import { Instagram, MessageCircle, Printer, Download, Link2, Save, MapPin } from 'lucide-react';
import { useReportStore } from '@/stores/reportStore';
import { useMapKeys } from '@/hooks/useMapKeys';
import { fetchRoads } from '@/lib/fetch-roads.functions';
import { useBrochureExport } from '@/hooks/useBrochureExport';
import { CATEGORY_META, ROAD_FOCUS_STYLES, ROAD_TIER_STYLE } from '@/lib/map-styles';
import type { RoadSegment } from '@/types';

type Template = 'connectivity' | 'proximity' | 'investment';
type ExportFormat = 'instagram' | 'whatsapp' | 'print';

const TEMPLATES: Array<{ id: Template; name: string; colors: [string, string, string] }> = [
  { id: 'connectivity', name: 'Connectivity Map', colors: ['#0f1e35', '#b8954a', '#f5f0e8'] },
  { id: 'proximity', name: 'Proximity Cards', colors: ['#3d5a7a', '#e8a87c', '#fbf6ea'] },
  { id: 'investment', name: 'Investment Brief', colors: ['#1a3c2a', '#d4b077', '#f5f0e8'] },
];

const FORMATS: Array<{ id: ExportFormat; label: string; dims: string; Icon: typeof Instagram; aspect: string }> = [
  { id: 'instagram', label: 'Instagram 1:1', dims: '1080 × 1080', Icon: Instagram, aspect: 'aspect-square' },
  { id: 'whatsapp', label: 'WhatsApp 9:16', dims: '1080 × 1920', Icon: MessageCircle, aspect: 'aspect-[9/16]' },
  { id: 'print', label: 'Print A4', dims: '2480 × 3508', Icon: Printer, aspect: 'aspect-[210/297]' },
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
              {/* LEFT — Live styled map canvas (60%) */}
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
                      className="absolute top-0 left-0 right-0 px-5 py-4 pointer-events-none"
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
                    {/* Footer band */}
                    <div
                      className="absolute bottom-0 left-0 right-0 px-5 py-3 pointer-events-none flex items-center justify-between"
                      style={{ background: `linear-gradient(0deg, ${activeTemplate.colors[0]}ee 0%, ${activeTemplate.colors[0]}00 100%)` }}
                    >
                      <div className="text-[10px] tracking-[0.25em] uppercase text-white/90">
                        {selectedPois.length} key destinations
                      </div>
                      <div className="text-[10px] tracking-[0.25em] uppercase" style={{ color: activeTemplate.colors[1] }}>
                        LocateIQ
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* RIGHT — Controls (40%) */}
              <div className="bg-[#f5f0e8] p-6 md:p-8 flex flex-col gap-6 overflow-y-auto">
                <div>
                  <div className="text-[10px] tracking-[0.3em] text-[var(--gold)] uppercase font-semibold">
                    Brochure Studio
                  </div>
                  <h2 className="font-heading text-[22px] text-[#0f1e35] mt-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Customize & Download
                  </h2>
                </div>

                {/* Project name */}
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

                {/* Templates */}
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
                            active
                              ? 'border-[#b8954a] shadow-md'
                              : 'border-[#e8e2d4] hover:border-[#b8954a]/50'
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

                {/* Format */}
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
                            active
                              ? 'border-[#b8954a] bg-white shadow-sm'
                              : 'border-[#e8e2d4] bg-white/60 hover:bg-white'
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

                {/* CTAs */}
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

  const bounds = useMemo(() => {
    if (pois.length === 0) return null;
    let maxDLat = 0;
    let maxDLng = 0;
    for (const p of pois) {
      maxDLat = Math.max(maxDLat, Math.abs(p.lat - lat));
      maxDLng = Math.max(maxDLng, Math.abs(p.lng - lng));
    }
    const padLat = Math.max(maxDLat * 1.25, 0.003);
    const padLng = Math.max(maxDLng * 1.25, 0.003);
    return { padLat, padLng };
  }, [pois, lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    const b = new google.maps.LatLngBounds(
      { lat: lat - bounds.padLat, lng: lng - bounds.padLng },
      { lat: lat + bounds.padLat, lng: lng + bounds.padLng },
    );
    map.fitBounds(b, 30);
    window.setTimeout(() => map.panTo({ lat, lng }), 60);
  }, [bounds, lat, lng]);

  if (!isLoaded || !apiKey) {
    return <div className="w-full h-full bg-[#f5f0e8] flex items-center justify-center text-[#6a6557] text-sm">Loading map…</div>;
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
        styles: ROAD_FOCUS_STYLES,
      }}
    >
      {roads.map((r, i) => (
        <Polyline
          key={i}
          path={r.points.map((p) => ({ lat: p.lat, lng: p.lng }))}
          options={{
            strokeColor: ROAD_TIER_STYLE[r.tier].color,
            strokeWeight: ROAD_TIER_STYLE[r.tier].weight,
            strokeOpacity: ROAD_TIER_STYLE[r.tier].opacity,
            zIndex: ROAD_TIER_STYLE[r.tier].zIndex,
            clickable: false,
          }}
        />
      ))}
      {pois.map((p) => {
        const meta = CATEGORY_META[p.type] ?? { Icon: MapPin, color: '#0f1e35' };
        const color = meta.color;
        return (
          <Fragment key={p.id}>
            <Polyline
              path={[{ lat, lng }, { lat: p.lat, lng: p.lng }]}
              options={{
                strokeColor: color,
                strokeOpacity: 0,
                zIndex: 80,
                clickable: false,
                icons: [{
                  icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                  offset: '0',
                  repeat: '12px',
                }],
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
                scale: 1,
                anchor: new google.maps.Point(0, 0),
              } as google.maps.Symbol}
            />
            <OverlayView position={{ lat: p.lat, lng: p.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div
                style={{ transform: 'translate(-50%, -180%)', borderColor: color }}
                className="px-2 py-1 rounded-md bg-white text-[10px] font-semibold shadow-md border whitespace-nowrap max-w-[140px] truncate"
              >
                <span style={{ color }}>{p.name}</span>
                <span className="text-[#6a6557] ml-1">· {p.distanceKm.toFixed(1)}km</span>
              </div>
            </OverlayView>
          </Fragment>
        );
      })}
      <Marker
        position={{ lat, lng }}
        zIndex={100}
        icon={{
          path: 'M 0,0 m -11,0 a 11,11 0 1,0 22,0 a 11,11 0 1,0 -22,0',
          fillColor: '#d64545',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3.5,
          scale: 1,
          anchor: new google.maps.Point(0, 0),
        } as google.maps.Symbol}
      />
    </GoogleMap>
  );
}
