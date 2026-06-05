import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toPng, toJpeg } from "html-to-image";
import {
  X,
  Download,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Sparkles,
  Instagram,
  Facebook,
  FileText,
  Smartphone,
  Palette,
  Type,
} from "lucide-react";
import QRCode from "qrcode";
import { useReportStore } from "@/stores/reportStore";
import { CATEGORY_META } from "@/lib/map-styles";
import { useMapKeys } from "@/hooks/useMapKeys";

// ── Custom Mapbox style ───────────────────────────────────────────────────────
const MAPBOX_STYLE_ID = "sharath-io/cmq02f0dc000o01qw8c2edjor";

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateId = "instagram-square" | "instagram-portrait" | "whatsapp" | "facebook" | "a4";

interface TemplateOption {
  id: TemplateId;
  label: string;
  sub: string;
  icon: React.ReactNode;
  pxW: number;
  pxH: number;
  aspectColor: string;
}

const TEMPLATES: TemplateOption[] = [
  { id: "instagram-square",   label: "Instagram Square",   sub: "1080 × 1080", icon: <Instagram size={14} />, pxW: 1080, pxH: 1080, aspectColor: "#e1306c" },
  { id: "instagram-portrait", label: "Instagram Portrait", sub: "1080 × 1350", icon: <Instagram size={14} />, pxW: 1080, pxH: 1350, aspectColor: "#e1306c" },
  { id: "whatsapp",           label: "WhatsApp Status",    sub: "1080 × 1920", icon: <Smartphone size={14} />, pxW: 1080, pxH: 1920, aspectColor: "#25d366" },
  { id: "facebook",           label: "Facebook Post",      sub: "1200 × 630",  icon: <Facebook size={14} />,  pxW: 1200, pxH: 630,  aspectColor: "#1877f2" },
  { id: "a4",                 label: "A4 Print PDF",       sub: "210 × 297 mm", icon: <FileText size={14} />,  pxW: 2480, pxH: 3508, aspectColor: "#e53935" },
];

// ── Dummy / fallback data ─────────────────────────────────────────────────────

const DUMMY = {
  title: "Prime Land for Investment",
  location: "Near RK Beach, Visakhapatnam",
  state: "Andhra Pradesh",
  coords: { lat: 17.71862, lng: 83.33144 },
  landArea: "3 Acres 5 Guntas",
  pricePerAcre: "₹50 Lakhs / Acre",
  totalPrice: "₹1.56 Crores",
  ownership: "Clear Title",
  propertyType: "Residential Land",
  roadFacing: "60 Feet Road",
  facing: "East Facing",
};

const DUMMY_AGENT = {
  name: "John Smith",
  role: "Real Estate Consultant",
  phone: "+91 98765 43210",
  email: "john.smith@propertyhub.com",
  location: "Visakhapatnam, Andhra Pradesh",
  photo: "https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg",
};

const DUMMY_POIS_OFFSETS = [
  { name: "Visakha Museum",      distanceKm: 0.3, type: "TOURIST ATTRACTIONS", dlat:  0.003, dlng: -0.001 },
  { name: "RK Beach",             distanceKm: 1.6, type: "LAKES/PARKS",         dlat: -0.005, dlng:  0.012 },
  { name: "King George Hospital", distanceKm: 2.9, type: "HOSPITALS",           dlat: -0.015, dlng: -0.018 },
  { name: "Tenneti Park",         distanceKm: 3.8, type: "LAKES/PARKS",         dlat: -0.022, dlng:  0.025 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function generateHighlights(pois: { name: string; distanceKm: number; type: string }[]): string[] {
  const byType = new Map<string, number>();
  pois.forEach((p) => {
    const ex = byType.get(p.type);
    if (!ex || p.distanceKm < ex) byType.set(p.type, p.distanceKm);
  });
  const out: string[] = [];
  const hasBeach = pois.some((p) => p.name.toLowerCase().includes("beach") || p.type === "LAKES/PARKS");
  if (hasBeach) out.push("Beach & Tourist attractions close by");
  if (byType.has("HOSPITALS")) out.push(`Hospitals within ${Math.ceil(byType.get("HOSPITALS")! * 1.1)} km radius`);
  if (byType.has("LAKES/PARKS")) out.push("Parks & Recreation nearby");
  out.push("Well connected to National Highway");
  out.push("High appreciation potential");
  return out.slice(0, 4);
}

// ── Mapbox Static Image URL builder ──────────────────────────────────────────

type BrochurePoi = { name: string; distanceKm: number; type: string; lat: number; lng: number };

/**
 * Computes the zoom level needed to fit all the given lat/lng points
 * into a viewport of the given pixel dimensions.
 */
function fitZoom(
  center: { lat: number; lng: number },
  points: { lat: number; lng: number }[],
  widthPx: number,
  heightPx: number,
): number {
  if (points.length === 0) return 13;

  let maxDLat = 0;
  let maxDLng = 0;
  for (const p of points) {
    maxDLat = Math.max(maxDLat, Math.abs(p.lat - center.lat));
    maxDLng = Math.max(maxDLng, Math.abs(p.lng - center.lng));
  }

  // Add 35% padding
  const latSpan = maxDLat * 2 * 1.35;
  const lngSpan = maxDLng * 2 * 1.35;

  // Mapbox tiles are 512px
  const TILE = 512;
  const latZoom = Math.log2((heightPx / TILE) * (360 / latSpan));
  const lngZoom = Math.log2((widthPx / TILE) * (360 / lngSpan));
  const zoom = Math.min(latZoom, lngZoom);
  return Math.max(10, Math.min(15, +zoom.toFixed(2)));
}


/**
 * Build the Mapbox Static Images URL.
 * Uses the custom Mapbox style for the basemap.
 * Markers: property pin (red) + selected POI pins (category color).
 * Radius circle is drawn as an SVG overlay in React (not in the URL).
 */
function buildMapboxStaticUrl(
  center: { lat: number; lng: number },
  pois: BrochurePoi[],
  token: string,
  widthPx = 640,
  heightPx = 480,
): string {
  const zoom = fitZoom(center, pois.map((p) => ({ lat: p.lat, lng: p.lng })), widthPx, heightPx);

  // Build overlay string — property pin first
  const overlays: string[] = [];

  // Property pin — red, large
  overlays.push(`pin-l+e53935(${center.lng},${center.lat})`);

  const overlayStr = overlays.join(",");
  const centerStr = `${center.lng},${center.lat},${zoom},0`;
  const sizeStr = `${widthPx}x${heightPx}@2x`;

  return (
    `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE_ID}/static/` +
    `${overlayStr}/${centerStr}/${sizeStr}` +
    `?access_token=${token}`
  );
}

// ── Lat/Lng → pixel projection (for SVG overlay — radius circle) ─────────────

function latLngToPixel(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  zoom: number,
  widthPx: number,
  heightPx: number,
): { x: number; y: number } {
  // Web Mercator projection (Mapbox uses 512px tiles)
  const TILE = 512;
  const scale = TILE * Math.pow(2, zoom) / 360;

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

// ── Brochure Map Component (Mapbox Static Image + SVG overlays) ───────────────

function BrochureMapStatic({
  center,
  pois,
  radiusKm,
  token,
}: {
  center: { lat: number; lng: number };
  pois: BrochurePoi[];
  radiusKm: number;
  token: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 640, h: 400 });

  // Observe actual container size so we request the right resolution from Mapbox
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDims({ w: Math.round(width), h: Math.round(height) });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const zoom = fitZoom(center, pois.map((p) => ({ lat: p.lat, lng: p.lng })), dims.w, dims.h);
  const imgUrl = token
    ? buildMapboxStaticUrl(center, pois, token, Math.min(dims.w, 1280), Math.min(dims.h, 1280))
    : null;

  // Compute radius circle in pixel space for SVG overlay
  const circleOverlay = useMemo(() => {
    if (radiusKm <= 0 || !loaded) return null;

    const { w, h } = dims;
    // Center pixel (always the midpoint since Mapbox centers on `center`)
    const cx = w / 2;
    const cy = h / 2;

    // A point directly north at radiusKm distance from center
    const northLat = center.lat + (radiusKm / 111.32);
    const northPx = latLngToPixel(northLat, center.lng, center.lat, center.lng, zoom, w, h);
    const radiusPx = Math.abs(cy - northPx.y);

    return { cx, cy, r: radiusPx };
  }, [center, radiusKm, zoom, dims, loaded]);

  // Labels for radius
  const radiusLabelPos = useMemo(() => {
    if (!circleOverlay) return null;
    const { cx, cy, r } = circleOverlay;
    // Place label at top-right of circle
    const angle = -Math.PI / 4; // 45° up-right
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }, [circleOverlay]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", background: "#e8e3da", overflow: "hidden" }}>
      {/* Mapbox Static Image */}
      {imgUrl && (
        <img
          src={imgUrl}
          alt="Map"
          crossOrigin="anonymous"
          onLoad={() => { setLoaded(true); setError(false); }}
          onError={() => setError(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}

      {/* Loading state */}
      {!loaded && !error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0ede6" }}>
          <div style={{ width: 20, height: 20, border: "2px solid #0f1e35", borderTopColor: "transparent", borderRadius: "50%", animation: "brochure-spin 0.8s linear infinite" }} />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f0e8", fontSize: 11, color: "#9e9689" }}>
          Map unavailable
        </div>
      )}

      {/* SVG overlay: radius circle + label */}
      {loaded && circleOverlay && (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Dashed radius circle */}
          <circle
            cx={circleOverlay.cx}
            cy={circleOverlay.cy}
            r={circleOverlay.r}
            fill="rgba(26,86,219,0.05)"
            stroke="#1a56db"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          {/* Radius label pill */}
          {radiusLabelPos && (
            <g>
              <rect
                x={radiusLabelPos.x - 26}
                y={radiusLabelPos.y - 9}
                width={52}
                height={18}
                rx={9}
                fill="#1a56db"
                opacity={0.92}
              />
              <text
                x={radiusLabelPos.x}
                y={radiusLabelPos.y + 3.5}
                textAnchor="middle"
                fontSize={9}
                fontWeight="700"
                fill="white"
                fontFamily="Inter,system-ui,sans-serif"
              >
                {radiusKm.toFixed(1)} km
              </text>
            </g>
          )}
        </svg>
      )}

      {/* Coordinate overlay — top left */}
      {loaded && (
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)", borderRadius: 5, padding: "3px 8px", fontSize: 9, fontWeight: 600, color: "#0f1e35", fontFamily: "monospace", pointerEvents: "none", zIndex: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}>
          {center.lat.toFixed(5)}° N, {center.lng.toFixed(5)}° E
        </div>
      )}

      {/* Legend — bottom left */}
      {loaded && (
        <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "5px 8px", zIndex: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.12)", pointerEvents: "none" }}>
          {[
            { color: "#E53935", label: "Property Location" },
            { color: "#22c55e", label: "Selected POIs" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 8, color: "#3a3228", fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* HTML Overlays for POIs (Custom Icons + Text Cards) */}
      {loaded && pois.map((poi, i) => {
        const pos = latLngToPixel(poi.lat, poi.lng, center.lat, center.lng, zoom, dims.w, dims.h);
        const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: "#666" };
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

            {/* The Label Card */}
            <div style={{
              position: "absolute", top: 16, left: -6,
              background: "white", borderRadius: 5, padding: "3px 6px", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)", borderLeft: `3px solid ${meta.color}`,
              display: "flex", flexDirection: "column", whiteSpace: "nowrap"
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>{poi.name}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: meta.color, lineHeight: 1.2 }}>{poi.distanceKm.toFixed(1)} km</span>
            </div>
          </div>
        );
      })}

      {/* Compass — bottom right */}
      {loaded && (
        <div style={{ position: "absolute", bottom: 8, right: 8, width: 28, height: 28, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", pointerEvents: "none", zIndex: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L14.5 9.5H17L12 22L7 9.5H9.5L12 2Z" fill="#E53935" opacity="0.9" />
            <path d="M12 22L9.5 9.5H7L12 2L17 9.5H14.5L12 22Z" fill="#888" opacity="0.5" />
            <circle cx="12" cy="12" r="2" fill="white" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ── QR Code ───────────────────────────────────────────────────────────────────

function QRBlock({ url, size = 72 }: { url: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, url || "https://locateiq.app", {
      width: size,
      margin: 1,
      color: { dark: "#0f1e35", light: "#ffffff" },
    }).catch(() => {});
  }, [url, size]);
  return <canvas ref={ref} style={{ borderRadius: 4, display: "block" }} />;
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

export function BrochureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const coordinates = useReportStore((s) => s.coordinates);
  const selectedPoisStore = useReportStore((s) => s.selectedPois);
  const keys = useMapKeys();

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("instagram-square");
  const [isDownloading, setIsDownloading] = useState(false);
  const [dlFmt, setDlFmt] = useState<"png" | "jpg" | "pdf" | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Derived data ─────────────────────────────────────────────────────────

  const coords = coordinates ?? DUMMY.coords;
  const mapboxToken = keys?.mapboxToken ?? "";

  const poisForBrochure = useMemo((): BrochurePoi[] => {
    const flat = Object.values(selectedPoisStore).flat();
    if (flat.length > 0) {
      return flat.map((p) => ({ name: p.name, distanceKm: p.distanceKm, type: p.type, lat: p.lat, lng: p.lng }));
    }
    return DUMMY_POIS_OFFSETS.map((p) => ({
      name: p.name, distanceKm: p.distanceKm, type: p.type,
      lat: DUMMY.coords.lat + p.dlat, lng: DUMMY.coords.lng + p.dlng,
    }));
  }, [selectedPoisStore]);

  const sortedPois = useMemo(() => [...poisForBrochure].sort((a, b) => a.distanceKm - b.distanceKm), [poisForBrochure]);

  const radiusKm = useMemo(() => {
    if (!poisForBrochure.length) return 0;
    return Math.max(...poisForBrochure.map((p) => haversineKm(coords, p)));
  }, [poisForBrochure, coords]);

  const highlights = useMemo(() => generateHighlights(sortedPois), [sortedPois]);

  const template = TEMPLATES.find((t) => t.id === selectedTemplate)!;

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = useCallback(async (fmt: "png" | "jpg" | "pdf") => {
    if (!canvasRef.current) return;
    setIsDownloading(true); setDlFmt(fmt);
    try {
      const el = canvasRef.current;
      const scale = template.pxW / el.offsetWidth;
      const opts = {
        width: template.pxW,
        height: Math.round(el.offsetHeight * scale),
        pixelRatio: Math.max(scale, 3),
        cacheBust: true,
        skipFonts: false,
      };
      if (fmt === "jpg") {
        triggerDl(await toJpeg(el, { ...opts, quality: 0.95 }), `brochure-${selectedTemplate}.jpg`);
      } else {
        const url = await toPng(el, opts);
        if (fmt === "pdf") {
          const w = window.open();
          if (w) { w.document.write(`<html><body style="margin:0"><img src="${url}" style="width:100%" /></body></html>`); w.document.close(); setTimeout(() => w.print(), 500); }
        } else {
          triggerDl(url, `brochure-${selectedTemplate}.png`);
        }
      }
    } catch (e) { console.error(e); } finally { setIsDownloading(false); setDlFmt(null); }
  }, [template, selectedTemplate]);

  function triggerDl(dataUrl: string, name: string) {
    const a = document.createElement("a"); a.href = dataUrl; a.download = name; a.click();
  }

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Property detail cards
  const propCards = [
    { label: "Land Area",      value: DUMMY.landArea,    icon: "📐" },
    { label: "Total Price",    value: DUMMY.totalPrice,   icon: "₹"  },
    { label: "Price per Acre", value: DUMMY.pricePerAcre, icon: "💰" },
    { label: "Ownership",      value: DUMMY.ownership,    icon: "📋" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.58)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            style={{ width: "98vw", height: "97vh", background: "white", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div style={{ flexShrink: 0, height: 52, borderBottom: "1px solid #f0ece4", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#0f1e35,#1d3558)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={14} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f1e35", letterSpacing: "-0.02em", lineHeight: 1 }}>Brochure Generator</div>
                  <div style={{ fontSize: 10, color: "#9e9689", marginTop: 1 }}>Create & download marketing brochure for this property</div>
                </div>
              </div>
              <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #e8e2d4", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={14} color="#0f1e35" />
              </button>
            </div>

            {/* ── Body ───────────────────────────────────────────────────── */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

              {/* ── LEFT: Brochure Canvas (72%) ─────────────────────────── */}
              <div
                ref={canvasRef}
                style={{ flex: "0 0 72%", borderRight: "1px solid #ede8de", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", background: "white" }}
              >
                {/* === BANNER === */}
                <div style={{ flexShrink: 0, background: "#0f1e35", display: "flex", alignItems: "center", gap: 14, padding: "10px 18px" }}>
                  <div style={{ background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 5, padding: "3px 10px", fontSize: 9, fontWeight: 800, color: "white", letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    Premium Property
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "white", lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 2 }}>{DUMMY.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(255,255,255,0.6)", fontSize: 10.5 }}>
                      <MapPin size={10} />
                      <span>{DUMMY.location}, {DUMMY.state}</span>
                    </div>
                  </div>
                </div>

                {/* === MAP + RIGHT PANEL === */}
                <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

                  {/* Map — Mapbox Static Image */}
                  <div style={{ flex: "0 0 60%", overflow: "hidden", position: "relative", borderRight: "1px solid #ede8de" }}>
                    <BrochureMapStatic
                      center={coords}
                      pois={sortedPois}
                      radiusKm={radiusKm}
                      token={mapboxToken}
                    />
                  </div>

                  {/* Right info panel */}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 12px 10px" }}>

                    {/* Property Details */}
                    <div style={{ flexShrink: 0, marginBottom: 10 }}>
                      <div style={{ fontSize: 7.5, letterSpacing: "0.2em", color: "#c8b97e", textTransform: "uppercase", fontWeight: 700, marginBottom: 7 }}>Property Details</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                        {propCards.map(({ label, value, icon }) => (
                          <div key={label} style={{ background: "#f9f7f4", border: "1px solid #ede8de", borderRadius: 8, padding: "7px 9px" }}>
                            <div style={{ fontSize: 7.5, color: "#9e9689", fontWeight: 600, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 10 }}>{icon}</span>{label}
                            </div>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#0f1e35", lineHeight: 1.2 }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Key Highlights */}
                    <div style={{ flexShrink: 0, marginBottom: 10 }}>
                      <div style={{ fontSize: 7.5, letterSpacing: "0.2em", color: "#c8b97e", textTransform: "uppercase", fontWeight: 700, marginBottom: 7 }}>Key Highlights</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {sortedPois.slice(0, 4).map((poi) => {
                          const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: "#666" };
                          const Icon = meta.Icon;
                          return (
                            <div key={poi.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 4px 6px", background: "#f9f7f4", borderRadius: 6, border: "1px solid #ede8de" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <Icon size={9} color={meta.color} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: 9.5, fontWeight: 600, color: "#0f1e35" }}>{poi.name}</span>
                              </div>
                              <span style={{ fontSize: 8.5, fontWeight: 700, color: meta.color, background: `${meta.color}18`, padding: "1px 5px", borderRadius: 8, whiteSpace: "nowrap" }}>
                                {poi.distanceKm.toFixed(1)} km
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Why This Location */}
                    <div style={{ flex: 1, minHeight: 0, background: "#f0f6ff", border: "1px solid #c5d9f8", borderRadius: 9, padding: "9px 10px", overflow: "hidden" }}>
                      <div style={{ fontSize: 7.5, letterSpacing: "0.2em", color: "#1d6fe8", textTransform: "uppercase", fontWeight: 700, marginBottom: 7 }}>Why This Location?</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {highlights.map((h) => (
                          <div key={h} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <CheckCircle2 size={10} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
                            <span style={{ fontSize: 9.5, color: "#1a2e4a", lineHeight: 1.35 }}>{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* === AGENT FOOTER === */}
                <div style={{ flexShrink: 0, borderTop: "1px solid #ede8de", background: "#fafaf8", display: "flex", alignItems: "center", padding: "10px 16px", gap: 0, height: 88 }}>
                  {/* Agent info */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    <img
                      src={DUMMY_AGENT.photo}
                      alt={DUMMY_AGENT.name}
                      crossOrigin="anonymous"
                      style={{ width: 58, height: 58, borderRadius: "50%", objectFit: "cover", border: "2px solid #c8b97e", flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f1e35", lineHeight: 1.2, marginBottom: 2 }}>{DUMMY_AGENT.name}</div>
                      <div style={{ fontSize: 8.5, color: "#9e9689", marginBottom: 5 }}>{DUMMY_AGENT.role}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {[{ Icon: Phone, text: DUMMY_AGENT.phone }, { Icon: Mail, text: DUMMY_AGENT.email }, { Icon: MapPin, text: DUMMY_AGENT.location }].map(({ Icon, text }) => (
                          <div key={text} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Icon size={8} color="#c8b97e" />
                            <span style={{ fontSize: 8.5, color: "#5a5248" }}>{text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ width: 1, height: 60, background: "#ede8de", margin: "0 18px", flexShrink: 0 }} />

                  {/* CTA text */}
                  <div style={{ flexShrink: 0, textAlign: "center", marginRight: 18 }}>
                    <div style={{ fontSize: 9, color: "#9e9689", marginBottom: 4 }}>Interested in this property?</div>
                    <div style={{ fontSize: 22, fontStyle: "italic", fontFamily: "Georgia, 'Times New Roman', serif", color: "#0f1e35", fontWeight: 600, lineHeight: 1.1 }}>Let's Connect!</div>
                    <div style={{ fontSize: 8.5, color: "#c8b97e", marginTop: 3, letterSpacing: "0.06em" }}>→</div>
                  </div>

                  {/* Divider */}
                  <div style={{ width: 1, height: 60, background: "#ede8de", margin: "0 18px", flexShrink: 0 }} />

                  {/* QR */}
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <QRBlock url={typeof window !== "undefined" ? window.location.href : ""} size={72} />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 7.5, fontWeight: 700, color: "#0f1e35" }}>Scan to Contact</div>
                      <div style={{ fontSize: 7, color: "#9e9689" }}>or view full report</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT: Sidebar (28%) ────────────────────────────────── */}
              <div style={{ flex: "0 0 28%", display: "flex", flexDirection: "column", padding: "14px 14px 12px", gap: 12, overflow: "hidden", background: "white" }}>

                {/* Template picker */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: "#aaa", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Choose Template / Format</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {TEMPLATES.map((t) => {
                      const active = selectedTemplate === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplate(t.id)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 9, border: active ? "2px solid #1d6fe8" : "1.5px solid #e8e2d4", background: active ? "#f0f6ff" : "white", cursor: "pointer", textAlign: "left", transition: "all 0.12s", boxShadow: active ? "0 2px 8px rgba(29,111,232,0.1)" : "none" }}
                        >
                          <div style={{ width: 38, height: 30, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: "#f5f0e8", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #ede8de" }}>
                            <div style={{ width: t.id === "facebook" ? 34 : t.id === "instagram-square" ? 22 : t.id === "whatsapp" || t.id === "a4" ? 16 : 18, height: t.id === "facebook" ? 18 : t.id === "instagram-square" ? 22 : t.id === "whatsapp" ? 28 : t.id === "a4" ? 28 : 24, background: active ? "#1d6fe8" : t.aspectColor + "55", borderRadius: 2 }} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                            <span style={{ color: active ? "#1d6fe8" : "#9e9689", flexShrink: 0 }}>{t.icon}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: active ? "#1d6fe8" : "#0f1e35", lineHeight: 1.2 }}>{t.label}</div>
                              <div style={{ fontSize: 9, color: "#9e9689" }}>{t.sub}</div>
                            </div>
                          </div>
                          {active && (
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#1d6fe8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ height: 1, background: "#f0ece4", flexShrink: 0 }} />

                {/* Customize */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: "#aaa", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Customize (Optional)</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[{ Icon: Palette, label: "Edit Colors" }, { Icon: Type, label: "Edit Text / Branding" }].map(({ Icon, label }) => (
                      <button key={label} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 6px", borderRadius: 8, border: "1.5px solid #e8e2d4", background: "white", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#5a5248" }}>
                        <Icon size={11} color="#9e9689" />{label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: 1, background: "#f0ece4", flexShrink: 0 }} />

                {/* Download */}
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    id="brochure-download-png"
                    onClick={() => handleDownload("png")}
                    disabled={isDownloading}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1d6fe8,#1452bb)", color: "white", cursor: isDownloading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 14px rgba(29,111,232,0.28)", opacity: isDownloading && dlFmt !== "png" ? 0.6 : 1 }}
                  >
                    {isDownloading && dlFmt === "png"
                      ? <div style={{ width: 13, height: 13, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "brochure-spin 0.8s linear infinite" }} />
                      : <Download size={14} />}
                    Download PNG
                    <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(255,255,255,0.65)" }}>High Quality</span>
                  </button>

                  <button
                    id="brochure-download-jpg"
                    onClick={() => handleDownload("jpg")}
                    disabled={isDownloading}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e8e2d4", background: "white", cursor: isDownloading ? "not-allowed" : "pointer", fontSize: 11.5, fontWeight: 600, color: "#0f1e35", opacity: isDownloading && dlFmt !== "jpg" ? 0.6 : 1 }}
                  >
                    {isDownloading && dlFmt === "jpg"
                      ? <div style={{ width: 12, height: 12, border: "2px solid #0f1e35", borderTopColor: "transparent", borderRadius: "50%", animation: "brochure-spin 0.8s linear infinite" }} />
                      : <Download size={12} color="#1d6fe8" />}
                    Download JPG
                    <span style={{ fontSize: 9, color: "#9e9689", marginLeft: "auto" }}>Medium Quality</span>
                  </button>

                  <button
                    id="brochure-download-pdf"
                    onClick={() => handleDownload("pdf")}
                    disabled={isDownloading}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e8e2d4", background: "white", cursor: isDownloading ? "not-allowed" : "pointer", fontSize: 11.5, fontWeight: 600, color: "#0f1e35", opacity: isDownloading && dlFmt !== "pdf" ? 0.6 : 1 }}
                  >
                    {isDownloading && dlFmt === "pdf"
                      ? <div style={{ width: 12, height: 12, border: "2px solid #0f1e35", borderTopColor: "transparent", borderRadius: "50%", animation: "brochure-spin 0.8s linear infinite" }} />
                      : <Download size={12} color="#e53935" />}
                    Download PDF
                    <span style={{ fontSize: 9, color: "#9e9689", marginLeft: "auto" }}>Print Ready</span>
                  </button>
                </div>

                {/* Tip */}
                <div style={{ flexShrink: 0, padding: "8px 10px", borderRadius: 8, background: "#fafaf8", border: "1px solid #ede8de", fontSize: 9, color: "#7a7568", lineHeight: 1.5, marginTop: "auto" }}>
                  <span style={{ color: "#c8b97e", fontWeight: 700 }}>ⓘ Tip:</span>{" "}
                  You can change template, customize and download the brochure in your preferred format.
                </div>
              </div>
            </div>
          </motion.div>

          <style>{`@keyframes brochure-spin { to { transform: rotate(360deg); } }`}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
