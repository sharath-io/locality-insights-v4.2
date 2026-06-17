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
  Instagram,
  Facebook,
  FileText,
  Smartphone,
  Palette,
  Type,
  ChevronDown,
  ChevronUp,
  Square,
  IndianRupee,
  BadgeCheck,
  LayoutGrid,
  FileImage,
} from "lucide-react";
import QRCode from "qrcode";
import { CATEGORY_META } from "@/lib/map-styles";

// ── Types ──────────────────────────────────────────────────────────────────────

type TemplateId = "instagram-square" | "instagram-portrait" | "whatsapp" | "facebook" | "a4";

interface TemplateOption {
  id: TemplateId;
  label: string;
  sub: string;
  icon: React.ReactNode;
  pxW: number;
  pxH: number;
  accentColor: string;
}

const TEMPLATES: TemplateOption[] = [
  { id: "instagram-square",   label: "Instagram Square",   sub: "1080 × 1080", icon: <Instagram size={14} />, pxW: 1080, pxH: 1080, accentColor: "#e1306c" },
  { id: "instagram-portrait", label: "Instagram Portrait", sub: "1080 × 1350", icon: <Instagram size={14} />, pxW: 1080, pxH: 1350, accentColor: "#e1306c" },
  { id: "whatsapp",           label: "WhatsApp Status",    sub: "1080 × 1920", icon: <Smartphone size={14} />, pxW: 1080, pxH: 1920, accentColor: "#25d366" },
  { id: "facebook",           label: "Facebook Post",      sub: "1200 × 630",  icon: <Facebook size={14} />,  pxW: 1200, pxH: 630,  accentColor: "#1877f2" },
  { id: "a4",                 label: "A4 Print (PDF)",     sub: "2 Pages", icon: <FileText size={14} />,  pxW: 2480, pxH: 1754, accentColor: "#e53935" },
];

export interface BrochurePOI {
  name: string;
  type: string;
  distanceKm: number;
  color?: string;
}

export interface BrochureGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  reportId?: string;
  mapImageUrl?: string;
  sourceCoordinates?: { lat: number; lng: number };
  nearbyPOIs?: BrochurePOI[];
  propertyDetails?: {
    title?: string;
    subtitle?: string;
    area?: string;
    price?: string;
    pricePerUnit?: string;
    titleStatus?: string;
  };
  agent?: {
    name?: string;
    role?: string;
    phone?: string;
    email?: string;
    location?: string;
    photoUrl?: string;
  };
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEF_COORDS = { lat: 17.71862, lng: 83.33144 };
const DEF_POIS: BrochurePOI[] = [
  { name: "Visakha Museum",      type: "ATTRACTIONS", distanceKm: 0.3 },
  { name: "RK Beach",             type: "ATTRACTIONS", distanceKm: 1.6 },
  { name: "King George Hospital", type: "HOSPITALS",   distanceKm: 2.9 },
  { name: "Tenneti Park",         type: "ATTRACTIONS", distanceKm: 3.8 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateHighlights(pois: BrochurePOI[]): string[] {
  const out: string[] = [];
  const hasAttraction = pois.some((p) =>
    p.type === "ATTRACTIONS" ||
    p.name.toLowerCase().includes("beach")
  );
  if (hasAttraction) out.push("Beach & Tourist attractions close by");

  const hospital = pois.find((p) => p.type === "HOSPITALS");
  if (hospital) out.push(`Hospitals within ${Math.ceil(hospital.distanceKm + 0.5)} km radius`);

  const hasAttractionsOrPark = pois.some((p) => p.type === "ATTRACTIONS");
  if (hasAttractionsOrPark) out.push("Parks & Recreation nearby");

  const hasHighway = pois.some((p) => ["PETROL PUMPS", "MAIN ROADS"].includes(p.type));
  if (hasHighway) out.push("Well connected to National Highway");

  if (out.length < 4) out.push("High appreciation potential in the area");

  return out.slice(0, 4);
}

// ── Google Font injection ─────────────────────────────────────────────────────

function injectDancingScript() {
  if (typeof document === "undefined") return;
  if (document.getElementById("dancing-script-font")) return;
  const link = document.createElement("link");
  link.id = "dancing-script-font";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap";
  document.head.appendChild(link);
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

// ── Spinner ───────────────────────────────────────────────────────────────────

const Spinner = ({ size = 14, color = "white" }: { size?: number; color?: string }) => (
  <div
    style={{
      width: size,
      height: size,
      border: `2px solid ${color}40`,
      borderTopColor: color,
      borderRadius: "50%",
      animation: "brochure-spin 0.8s linear infinite",
      flexShrink: 0,
    }}
  />
);

// ── Template thumbnail ────────────────────────────────────────────────────────

function TemplateThumbnail({ t, active }: { t: TemplateOption; active: boolean }) {
  const w =
    t.id === "facebook" ? 34 :
    t.id === "instagram-square" ? 20 :
    t.id === "whatsapp" || t.id === "a4" ? 13 : 16;
  const h =
    t.id === "facebook" ? 18 :
    t.id === "instagram-square" ? 20 :
    t.id === "whatsapp" ? 26 :
    t.id === "a4" ? 26 : 20;

  return (
    <div style={{
      width: 38, height: 30, borderRadius: 5, overflow: "hidden",
      flexShrink: 0, background: "#f5f0e8",
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "1px solid #ede8de",
    }}>
      <div style={{
        width: w, height: h,
        background: active ? "#FFDE59" : `${t.accentColor}55`,
        borderRadius: 2,
      }} />
    </div>
  );
}

// ── Main BrochureDialog ───────────────────────────────────────────────────────

export function BrochureDialog({
  isOpen,
  onClose,
  reportId = "VIC-2026-E0C8",
  mapImageUrl = "",
  sourceCoordinates,
  nearbyPOIs,
  propertyDetails,
  agent,
}: BrochureGeneratorProps) {

  const coords = sourceCoordinates ?? DEF_COORDS;
  const pois = useMemo(
    () => (nearbyPOIs && nearbyPOIs.length > 0 ? nearbyPOIs : DEF_POIS),
    [nearbyPOIs]
  );
  const sortedPois = useMemo(() => [...pois].sort((a, b) => a.distanceKm - b.distanceKm), [pois]);
  const highlights = useMemo(() => generateHighlights(sortedPois), [sortedPois]);

  // ── Editable state ────────────────────────────────────────────────────────
  const [title, setTitle]               = useState(propertyDetails?.title       ?? "Prime Land for Investment");
  const [subtitle, setSubtitle]         = useState(propertyDetails?.subtitle    ?? "Near RK Beach, Visakhapatnam, Andhra Pradesh");
  const [area, setArea]                 = useState(propertyDetails?.area        ?? "3 Ac 5 G");
  const [price, setPrice]               = useState(propertyDetails?.price       ?? "₹1.56 Cr");
  const [pricePerUnit, setPricePerUnit] = useState(propertyDetails?.pricePerUnit ?? "₹50L / Ac");
  const [titleStatus, setTitleStatus]   = useState(propertyDetails?.titleStatus ?? "Clear");
  const [agentName, setAgentName]       = useState(agent?.name      ?? "John Smith");
  const [agentRole, setAgentRole]       = useState(agent?.role      ?? "Real Estate Consultant");
  const [agentPhone, setAgentPhone]     = useState(agent?.phone     ?? "+91 98765 43210");
  const [agentEmail, setAgentEmail]     = useState(agent?.email     ?? "john.smith@propertyhub.com");
  const [agentLocation, setAgentLocation] = useState(agent?.location ?? "Visakhapatnam, Andhra Pradesh");
  const [agentPhoto]                    = useState(agent?.photoUrl  ?? "https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg");

  // ── Color customization ───────────────────────────────────────────────────
  const [accentColor, setAccentColor] = useState("#FFDE59");
  const [headerBg, setHeaderBg]       = useState("#fdfcf5");

  // ── Format selection ──────────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("instagram-square");
  const template = TEMPLATES.find((t) => t.id === selectedTemplate)!;

  // ── UI expansion states ───────────────────────────────────────────────────
  const [showColors, setShowColors]   = useState(false);
  const [showText, setShowText]       = useState(false);

  // ── Download state ────────────────────────────────────────────────────────
  const [dlState, setDlState] = useState<"idle" | "loading-png" | "loading-jpg" | "loading-pdf" | "done-png" | "done-jpg" | "done-pdf">("idle");

  // ── Canvas ref ────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Scale canvas to fit container ─────────────────────────────────────────
  const [scale, setScale] = useState(1);

  useEffect(() => { injectDancingScript(); }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      const height = containerRef.current.offsetHeight;
      if (template.id === "a4") {
        // Two A4 pages side by side: fit both into the container
        const pageGap = 24; // gap between the two pages
        const a4PageW = 1240; // width of each page
        const a4PageH = 1754; // height of each page
        const scaleX = (width - 40 - pageGap) / (2 * a4PageW);
        const scaleY = (height - 40) / a4PageH;
        setScale(Math.min(scaleX, scaleY, 1));
      } else {
        const scaleX = (width - 40) / template.pxW;
        const scaleY = (height - 40) / template.pxH;
        setScale(Math.min(scaleX, scaleY, 1));
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [template, isOpen]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── Sync prop changes into editable state ────────────────────────────────
  useEffect(() => {
    if (propertyDetails?.title) setTitle(propertyDetails.title);
    if (propertyDetails?.subtitle) setSubtitle(propertyDetails.subtitle);
    if (propertyDetails?.area) setArea(propertyDetails.area);
    if (propertyDetails?.price) setPrice(propertyDetails.price);
    if (propertyDetails?.pricePerUnit) setPricePerUnit(propertyDetails.pricePerUnit);
    if (propertyDetails?.titleStatus) setTitleStatus(propertyDetails.titleStatus);
  }, [propertyDetails]);

  useEffect(() => {
    if (agent?.name) setAgentName(agent.name);
    if (agent?.role) setAgentRole(agent.role);
    if (agent?.phone) setAgentPhone(agent.phone);
    if (agent?.email) setAgentEmail(agent.email);
    if (agent?.location) setAgentLocation(agent.location);
  }, [agent]);

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async (fmt: "png" | "jpg" | "pdf") => {
    if (!canvasRef.current) return;
    setDlState(`loading-${fmt}`);
    try {
      const el = canvasRef.current;
      const pixelRatio = Math.max(template.pxW / el.offsetWidth, 3);
      const opts = {
        width: template.pxW,
        height: template.pxH,
        pixelRatio,
        cacheBust: true,
        skipFonts: false,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
      };

      if (fmt === "jpg") {
        const url = await toJpeg(el, { ...opts, quality: 0.92 });
        triggerDl(url, `brochure-${reportId}.jpg`);
      } else if (fmt === "png") {
        const url = await toPng(el, opts);
        triggerDl(url, `brochure-${reportId}.png`);
      } else {
        const url = await toPng(el, opts);
        const w = window.open();
        if (w) {
          w.document.write(
            `<html><head><title>Brochure — ${reportId}</title><style>body{margin:0}img{width:100%;height:auto}</style></head>` +
            `<body><img src="${url}" /></body></html>`
          );
          w.document.close();
          setTimeout(() => w.print(), 600);
        }
      }
      setDlState(`done-${fmt}`);
      setTimeout(() => setDlState("idle"), 2000);
    } catch (e) {
      console.error("Brochure download error:", e);
      setDlState("idle");
    }
  }, [template, reportId]);

  function triggerDl(dataUrl: string, name: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    a.click();
  }

  // ── Property stat cards ───────────────────────────────────────────────────
  const propCards = [
    { label: "LAND AREA",      value: area,         icon: <Square size={18} color="#7c7467" /> },
    { label: "TOTAL PRICE",    value: price,         icon: <IndianRupee size={18} color="#7c7467" /> },
    { label: "PRICE PER ACRE", value: pricePerUnit,  icon: <LayoutGrid size={18} color="#7c7467" /> },
    { label: "TITLE STATUS",   value: titleStatus,   icon: <BadgeCheck size={18} color="#7c7467" /> },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            style={{
              width: "min(98vw, 1080px)",
              height: "92vh",
              background: "#f5f4ef",
              borderRadius: 20,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 32px 100px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.12)",
            }}
          >
            {/* ── Modal Header ──────────────────────────────────────────── */}
            <div style={{
              flexShrink: 0, height: 56,
              borderBottom: "1px solid #e8e3d8",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0 20px",
              background: "white",
              borderRadius: "20px 20px 0 0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Document icon */}
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: "#f5f4ef",
                  border: "1px solid #e8e3d8",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <FileImage size={16} color="#5a5248" />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1814", letterSpacing: "-0.015em" }}>
                  Brochure Generator
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Close */}
                <button
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: "1px solid #e8e3d8", background: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f4ef")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                >
                  <X size={14} color="#1a1814" />
                </button>
              </div>
            </div>

            {/* ── Body ──────────────────────────────────────────────────── */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

              {/* ── LEFT: Canvas Area ────────────────────────────────────── */}
              <div
                ref={containerRef}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#eceae3",
                  padding: 20,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {/* Dot grid background */}
                <div style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  backgroundImage: "radial-gradient(circle, #a09880 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
                  opacity: 0.25,
                }} />

                {/* The Brochure Canvas — fixed size, scaled */}
                <div
                  id="brochure-canvas"
                  ref={canvasRef}
                  style={{
                    width: template.pxW,
                    height: template.pxH,
                    transform: `scale(${scale})`,
                    transformOrigin: "center center",
                    flexShrink: 0,
                    fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
                    background: "white",
                    overflow: "hidden",
                    borderRadius: 4,
                    boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                  }}
                >
                  {template.id === "whatsapp" && (
                    <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fbf8ef", padding: "48px 48px 24px", boxSizing: "border-box", gap: 16 }}>
                      
                      {/* Premium badge */}
                      <div style={{
                        position: "absolute", top: 0, left: 0, zIndex: 10,
                        background: accentColor, borderRadius: "0 0 20px 0", padding: "12px 24px",
                        fontSize: 16, fontWeight: 800, color: "#1a1814",
                        letterSpacing: "0.12em", textTransform: "uppercase",
                        display: "flex", alignItems: "center", gap: 8
                      }}>
                        <BadgeCheck size={20} />
                        PREMIUM PROPERTY
                      </div>

                      {/* 1. Header (Top) */}
                      <div style={{ flexShrink: 0 }}>
                        {/* Title */}
                        <div style={{ fontSize: 72, fontWeight: 900, color: "#1a1814", lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 12 }}>
                          {title}
                        </div>

                        {/* Location Pill */}
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 10,
                          background: "white", borderRadius: 20, padding: "12px 24px",
                          border: "2px solid #ede8de", boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                          fontSize: 22, fontWeight: 700, color: "#1a1814"
                        }}>
                          <MapPin size={24} color={accentColor} />
                          {subtitle}
                        </div>
                      </div>

                      {/* 2. Map Section */}
                      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                        <div style={{
                          flex: 1, minHeight: 0, position: "relative",
                          borderRadius: 32, overflow: "hidden",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                          border: "4px solid white"
                        }}>
                          {mapImageUrl ? (
                            <img src={mapImageUrl} alt="Property map" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: "#e8e3da" }} />
                          )}
                          
                          {/* Coordinate badge — top-left */}
                          <div style={{
                            position: "absolute", top: 24, left: 24,
                            background: "rgba(255,255,255,0.92)",
                            backdropFilter: "blur(8px)",
                            borderRadius: 12, padding: "8px 16px",
                            fontSize: 18, fontWeight: 700, color: "#1a1814",
                            fontFamily: "monospace",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                            pointerEvents: "none",
                          }}>
                            {coords.lat.toFixed(5)}° N, {coords.lng.toFixed(5)}° E
                          </div>
                        </div>
                      </div>

                      {/* 3. Property Stats */}
                      <div style={{
                        background: "white", borderRadius: 24,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.04)",
                        border: "2px solid #ede8de",
                        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                        padding: "16px 12px", flexShrink: 0
                      }}>
                        {propCards.map(({ label, value, icon }, idx) => (
                          <div key={label} style={{
                            display: "flex", flexDirection: "column", gap: 8,
                            padding: "0 20px", borderRight: idx < 3 ? "2px solid #ede8de" : "none"
                          }}>
                            <div style={{ transform: "scale(1.4)", transformOrigin: "left center", marginBottom: 4 }}>
                              {icon}
                            </div>
                            <div style={{ fontSize: 16, color: "#5a5248", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              {label}
                            </div>
                            <div style={{ fontSize: 36, fontWeight: 900, color: "#1a1814", lineHeight: 1.1 }}>
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 4. Nearby Highlights */}
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, paddingLeft: 8 }}>
                          <MapPin size={24} color="#1a1814" />
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#1a1814", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                            NEARBY HIGHLIGHTS
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {sortedPois.slice(0, 5).map((poi) => {
                            const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: "#666" };
                            const Icon = meta.Icon;
                            return (
                              <div key={poi.name} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                background: "white", borderRadius: 16, padding: "12px 20px",
                                border: "2px solid #ede8de", boxShadow: "0 4px 16px rgba(0,0,0,0.02)"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                                  <div style={{
                                    width: 44, height: 44, borderRadius: 12, 
                                    background: `${meta.color}15`,
                                    display: "flex", alignItems: "center", justifyContent: "center"
                                  }}>
                                    <Icon size={22} color={meta.color} />
                                  </div>
                                  <div style={{ fontSize: 24, fontWeight: 700, color: "#1a1814" }}>
                                    {poi.name}
                                  </div>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: "#5a5248" }}>
                                  {poi.distanceKm.toFixed(1)} km
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: 12, color: "#9e9689", marginTop: 8, paddingLeft: 8 }}>
                          Distances are approximate and may vary based on actual location.
                        </div>
                      </div>

                      {/* 5. Agent CTA Section */}
                      <div style={{
                        background: "#fffbf0", borderRadius: 24,
                        border: `2px solid ${accentColor}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "20px 32px", flexShrink: 0
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                          <img src={agentPhoto} alt={agentName} crossOrigin="anonymous" style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", border: "4px solid white", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }} />
                          <div>
                            <div style={{ fontSize: 32, fontWeight: 900, color: "#1a1814", marginBottom: 6 }}>{agentName}</div>
                            <div style={{ fontSize: 18, color: "#5a5248", marginBottom: 12 }}>{agentRole}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Phone size={20} color={accentColor} />
                              <span style={{ fontSize: 22, fontWeight: 800, color: "#1a1814" }}>{agentPhone}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "center", padding: "0 24px", borderLeft: "2px solid #ede8de", borderRight: "2px solid #ede8de" }}>
                          <div style={{ fontSize: 18, color: "#5a5248", marginBottom: 8, fontStyle: "italic" }}>Interested in this property?</div>
                          <div style={{ fontSize: 56, fontFamily: "'Dancing Script', Georgia, cursive", color: "#1a1814", fontWeight: 700 }}>Let's Connect!</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 120, height: 120, background: "white", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #ede8de", padding: 8 }}>
                            <QRBlock url={`https://locateiq.app/report/${reportId}`} size={104} />
                          </div>
                          <div style={{ fontSize: 14, color: "#5a5248", fontWeight: 600 }}>Scan to view full report</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {template.id === "instagram-square" && (
                    <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fbf8ef", overflow: "hidden" }}>

                      {/* Premium Badge Overlapping Top Left of Brochure */}
                      <div style={{
                        position: "absolute", top: 0, left: 0, zIndex: 10,
                        background: accentColor, borderRadius: "0 0 16px 0", padding: "10px 24px",
                        fontSize: 14, fontWeight: 800, color: "#1a1814",
                        letterSpacing: "0.12em", textTransform: "uppercase",
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <BadgeCheck size={18} />
                        PREMIUM PROPERTY
                      </div>

                      {/* ── 1. MAP (Top-aligned with Overlapping Title/Pill) ── */}
                      <div style={{
                        flexShrink: 0,
                        width: "100%",
                        height: "62%", // Adjusted to 62%
                        position: "relative",
                        overflow: "hidden",
                        background: "#e8e4db"
                      }}>
                        {mapImageUrl ? (
                          <img
                            src={mapImageUrl}
                            alt="Property map"
                            crossOrigin="anonymous"
                            style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "top", display: "block" }}
                          />
                        ) : (
                          <div style={{
                            width: "100%", height: "100%",
                            background: "linear-gradient(135deg, #e8e3da 0%, #d4ccbf 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexDirection: "column", gap: 8,
                          }}>
                            <MapPin size={32} color="#c8b97e" />
                            <span style={{ fontSize: 11, color: "#9e9689" }}>Map capture will appear here</span>
                          </div>
                        )}
                        
                        {/* Coordinate badge */}
                        <div style={{
                          position: "absolute", top: 16, right: 16, // Moved to top-right to avoid any visual collision with top-left badge
                          background: "rgba(255,255,255,0.92)",
                          backdropFilter: "blur(8px)",
                          borderRadius: 10, padding: "6px 12px",
                          fontSize: 14, fontWeight: 700, color: "#1a1814",
                          fontFamily: "monospace",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                          pointerEvents: "none",
                        }}>
                          {coords.lat.toFixed(5)}° N, {coords.lng.toFixed(5)}° E
                        </div>

                        {/* Overlapping Title and Subtitle at Bottom */}
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          padding: "60px 24px 0",
                          background: "linear-gradient(to top, rgba(251,248,239,1) 0%, rgba(251,248,239,0.85) 40%, rgba(251,248,239,0) 100%)", // Fade to transparent
                          display: "flex", flexDirection: "column", alignItems: "flex-start",
                          pointerEvents: "none" // Prevents capturing clicks meant for the map if any
                        }}>
                          <div style={{
                            fontSize: 64, fontWeight: 900, color: "#1a1814",
                            lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 12,
                            textShadow: "0 4px 20px rgba(255,255,255,0.9)"
                          }}>
                            {title}
                          </div>
                          
                          {/* Location Pill */}
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: 10,
                            background: "white", borderRadius: 20, padding: "10px 20px",
                            border: "2px solid #ede8de", boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                            fontSize: 20, fontWeight: 700, color: "#1a1814"
                          }}>
                            <MapPin size={22} color={accentColor} />
                            {subtitle}
                          </div>
                        </div>
                      </div>

                      {/* WRAPPER FOR CONTENT BELOW MAP */}
                      <div style={{ padding: "16px 32px 32px 32px", display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }}>

                      {/* ── 3. NUMBERS ROW — property stat cards ─────────── */}
                      <div style={{
                        flexShrink: 0,
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        background: "white", borderRadius: 20,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.04)",
                        border: "2px solid #ede8de",
                        padding: "12px 8px"
                      }}>
                        {propCards.map(({ label, value, icon }, idx) => (
                          <div key={label} style={{
                            display: "flex", flexDirection: "column", gap: 4,
                            padding: "0 16px",
                            borderRight: idx < 3 ? "2px solid #ede8de" : "none",
                          }}>
                            <div style={{ transform: "scale(1.2)", transformOrigin: "left center", marginBottom: 2 }}>{icon}</div>
                            <div style={{ fontSize: 12, color: "#5a5248", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              {label}
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 900, color: "#1a1814", lineHeight: 1.1 }}>
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* ── 4. HIGHLIGHTS & AGENT DETAILS (Symmetric Layout) ── */}
                      <div style={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}>
                        {/* Full-width Title */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
                          <MapPin size={20} color="#1a1814" />
                          <div style={{ fontSize: 14, fontWeight: 900, color: "#1a1814", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                            NEARBY HIGHLIGHTS
                          </div>
                        </div>

                        {/* Two Columns Container */}
                        <div style={{
                          flex: 1,
                          display: "flex",
                          gap: 20,
                        }}>
                          {/* Left Column: 4 Highlights */}
                          <div style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            overflow: "hidden"
                          }}>
                            {sortedPois.slice(0, 4).map((poi) => {
                              const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: "#666" };
                              const Icon = meta.Icon;
                              return (
                                <div key={poi.name} style={{
                                  display: "flex", alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "8px 12px",
                                  background: "white",
                                  borderRadius: 12, border: "2px solid #ede8de",
                                  boxShadow: "0 4px 16px rgba(0,0,0,0.02)"
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                      width: 28, height: 28, borderRadius: 8, 
                                      background: `${meta.color}15`,
                                      display: "flex", alignItems: "center", justifyContent: "center"
                                    }}>
                                      <Icon size={14} color={meta.color} />
                                    </div>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1814" }}>{poi.name}</span>
                                  </div>
                                  <span style={{ fontSize: 14, fontWeight: 800, color: "#5a5248", whiteSpace: "nowrap" }}>
                                    {poi.distanceKm.toFixed(1)} km
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Right Column: 1 Highlight + Agent Details */}
                          <div style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                          }}>
                            {/* 1 Additional Highlight */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {sortedPois.slice(4, 5).map((poi) => {
                                const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: "#666" };
                                const Icon = meta.Icon;
                                return (
                                  <div key={poi.name} style={{
                                    display: "flex", alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "8px 12px",
                                    background: "white",
                                    borderRadius: 12, border: "2px solid #ede8de",
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.02)"
                                  }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div style={{
                                        width: 28, height: 28, borderRadius: 8, 
                                        background: `${meta.color}15`,
                                        display: "flex", alignItems: "center", justifyContent: "center"
                                      }}>
                                        <Icon size={14} color={meta.color} />
                                      </div>
                                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1814" }}>{poi.name}</span>
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 800, color: "#5a5248", whiteSpace: "nowrap" }}>
                                      {poi.distanceKm.toFixed(1)} km
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                          {/* Agent Details Box (Side-by-Side) */}
                          <div style={{
                            display: "flex",
                            background: "#fffbf0",
                            borderRadius: 20,
                            border: `2px solid ${accentColor}`,
                            padding: "16px",
                            gap: 16
                          }}>
                            {/* Left Side: Agent Info */}
                            <div style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              borderRight: "2px solid #ede8de",
                              paddingRight: 16
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                <img
                                  src={agentPhoto}
                                  alt={agentName}
                                  crossOrigin="anonymous"
                                  style={{
                                    width: 64, height: 64,
                                    borderRadius: "50%", objectFit: "cover",
                                    border: "3px solid white", boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                                    flexShrink: 0,
                                  }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 20, fontWeight: 900, color: "#1a1814", marginBottom: 2 }}>{agentName}</div>
                                  <div style={{ fontSize: 13, color: "#5a5248", fontWeight: 600 }}>{agentRole}</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                                <Phone size={16} color={accentColor} />
                                <span style={{ fontSize: 16, fontWeight: 800, color: "#1a1814", letterSpacing: "0.02em" }}>{agentPhone}</span>
                              </div>
                            </div>

                            {/* Right Side: CTA & QR */}
                            <div style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              textAlign: "center"
                            }}>
                              <div style={{ fontSize: 11, color: "#5a5248", fontStyle: "italic", marginBottom: 4 }}>Interested in this property?</div>
                              <div style={{
                                fontSize: 26,
                                fontFamily: "'Dancing Script', Georgia, cursive",
                                color: "#1a1814", fontWeight: 700, lineHeight: 1.1,
                                marginBottom: 10
                              }}>Let's Connect!</div>
                              <div style={{
                                width: 56, height: 56,
                                background: "white", borderRadius: 8,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                border: "2px solid #ede8de", padding: 4
                              }}>
                                <QRBlock url={`https://locateiq.app/report/${reportId}`} size={48} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      </div>
                      </div>
                    </div>
                  )}

                  {/* ── INSTAGRAM PORTRAIT ──────────────────────────────── */}
                  {template.id === "instagram-portrait" && (
                    <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fbf8ef", overflow: "hidden" }}>

                      {/* Premium badge */}
                      <div style={{
                        position: "absolute", top: 0, left: 0, zIndex: 10,
                        background: accentColor, borderRadius: "0 0 16px 0", padding: "10px 24px",
                        fontSize: 14, fontWeight: 800, color: "#1a1814",
                        letterSpacing: "0.12em", textTransform: "uppercase",
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <BadgeCheck size={18} />
                        PREMIUM PROPERTY
                      </div>

                      {/* 1. MAP & OVERLAPPING HEADING */}
                      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                        <div style={{
                          flex: "0 0 65%", // Increased to 65% since we have extra space below
                          width: "100%",
                          position: "relative",
                          overflow: "hidden",
                          background: "#e8e4db",
                        }}>
                          {mapImageUrl ? (
                            <img
                              src={mapImageUrl}
                              alt="Property map"
                              crossOrigin="anonymous"
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                          ) : (
                            <div style={{
                              width: "100%", height: "100%",
                              background: "linear-gradient(135deg, #e8e3da 0%, #d4ccbf 100%)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexDirection: "column", gap: 8,
                            }}>
                              <MapPin size={32} color="#c8b97e" />
                              <span style={{ fontSize: 11, color: "#9e9689" }}>Map capture will appear here</span>
                            </div>
                          )}
                          
                          {/* Coordinate badge */}
                          <div style={{
                            position: "absolute", top: 16, right: 16, // Moved to right to avoid overlapping premium badge
                            background: "rgba(255,255,255,0.92)",
                            backdropFilter: "blur(8px)",
                            borderRadius: 10, padding: "6px 12px",
                            fontSize: 14, fontWeight: 700, color: "#1a1814",
                            fontFamily: "monospace",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                            pointerEvents: "none",
                          }}>
                            {coords.lat.toFixed(5)}° N, {coords.lng.toFixed(5)}° E
                          </div>

                          {/* Overlapping Title and Subtitle at Bottom */}
                          <div style={{
                            position: "absolute", bottom: 0, left: 0, right: 0,
                            padding: "80px 32px 12px", // Pushed text a little below
                            background: "linear-gradient(to top, rgba(251,248,239,1) 0%, rgba(251,248,239,0.85) 40%, rgba(251,248,239,0) 100%)", // Fade to background
                            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12,
                            pointerEvents: "none"
                          }}>
                            <div style={{
                              fontSize: 64, fontWeight: 900, color: "#1a1814",
                              lineHeight: 1.05, letterSpacing: "-0.03em",
                              textShadow: "0 4px 20px rgba(255,255,255,0.9)"
                            }}>
                              {title}
                            </div>
                            
                            {/* Location Pill */}
                            <div style={{
                              display: "inline-flex", alignItems: "center", gap: 10,
                              background: "white", borderRadius: 20, padding: "10px 20px",
                              border: "2px solid #ede8de", boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                              fontSize: 20, fontWeight: 700, color: "#1a1814"
                            }}>
                              <MapPin size={22} color={accentColor} />
                              {subtitle}
                            </div>
                          </div>
                        </div>

                        {/* 2b. BOTTOM HALF — two columns */}
                        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "row", overflow: "hidden" }}>

                          {/* LEFT COLUMN: Key Highlights */}
                          <div style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            padding: "20px 24px",
                            borderRight: "2px solid #ede8de",
                            background: "#fbf8ef",
                            overflow: "hidden",
                            gap: 12,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                              <MapPin size={20} color="#1a1814" />
                              <div style={{
                                fontSize: 14, fontWeight: 900, color: "#1a1814", letterSpacing: "0.1em", textTransform: "uppercase"
                              }}>
                                NEARBY HIGHLIGHTS
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
                              {sortedPois.slice(0, 7).map((poi) => {
                                const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: "#666" };
                                const Icon = meta.Icon;
                                return (
                                  <div key={poi.name} style={{
                                    display: "flex", alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "8px 14px",
                                    background: "white",
                                    borderRadius: 16, border: "2px solid #ede8de",
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
                                    flexShrink: 0,
                                  }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                      <div style={{
                                        width: 32, height: 32, borderRadius: 10, 
                                        background: `${meta.color}15`,
                                        display: "flex", alignItems: "center", justifyContent: "center"
                                      }}>
                                        <Icon size={16} color={meta.color} />
                                      </div>
                                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1814" }}>{poi.name}</span>
                                    </div>
                                    <span style={{
                                      fontSize: 14, fontWeight: 800, color: "#5a5248",
                                      whiteSpace: "nowrap",
                                    }}>
                                      {poi.distanceKm.toFixed(1)} km
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* RIGHT COLUMN: Data Metrics + Agent Details */}
                          <div style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            padding: "20px 24px",
                            background: "#fbf8ef",
                            overflow: "hidden",
                            gap: 16,
                          }}>

                            {/* Data number metrics — 2×2 grid */}
                            <div style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 10,
                              alignContent: "start",
                              flexShrink: 0,
                            }}>
                              {propCards.map(({ label, value, icon }) => (
                                <div key={label} style={{
                                  background: "white",
                                  border: "2px solid #ede8de",
                                  boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
                                  borderRadius: 16, padding: "12px 16px",
                                  display: "flex", flexDirection: "column", gap: 6,
                                }}>
                                  <div style={{ marginBottom: 2 }}>
                                    <div style={{ transform: "scale(1.2)", transformOrigin: "left center" }}>
                                      {icon}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 26, fontWeight: 900, color: "#1a1814", lineHeight: 1.1 }}>
                                    {value}
                                  </div>
                                  <div style={{ fontSize: 12, color: "#5a5248", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                    {label}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Agent Details */}
                            <div style={{
                              flex: 1,
                              minHeight: 0,
                              background: "#fffbf0",
                              borderRadius: 20,
                              border: `2px solid ${accentColor}`,
                              padding: "20px 24px",
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "stretch",
                            }}>
                              {/* Left Side: Agent Info */}
                              <div style={{
                                flex: 1.5,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                borderRight: "2px solid #ede8de",
                                paddingRight: 16
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                  <img
                                    src={agentPhoto}
                                    alt={agentName}
                                    crossOrigin="anonymous"
                                    style={{
                                      width: 80, height: 80,
                                      borderRadius: "50%", objectFit: "cover",
                                      border: "3px solid white", boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: "#1a1814", marginBottom: 2 }}>{agentName}</div>
                                    <div style={{ fontSize: 13, color: "#5a5248", fontWeight: 600 }}>{agentRole}</div>
                                  </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                                  <Phone size={16} color={accentColor} />
                                  <span style={{ fontSize: 16, fontWeight: 800, color: "#1a1814", letterSpacing: "0.02em" }}>{agentPhone}</span>
                                </div>
                              </div>

                              {/* Right Side: CTA & QR */}
                              <div style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                paddingLeft: 16
                              }}>
                                <div style={{ fontSize: 11, color: "#5a5248", fontStyle: "italic", marginBottom: 4 }}>Interested in this property?</div>
                                <div style={{
                                  fontSize: 26,
                                  fontFamily: "'Dancing Script', Georgia, cursive",
                                  color: "#1a1814", fontWeight: 700, lineHeight: 1.1,
                                  marginBottom: 10
                                }}>Let's Connect!</div>
                                <div style={{
                                  width: 56, height: 56,
                                  background: "white", borderRadius: 8,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  border: "2px solid #ede8de", padding: 4
                                }}>
                                  <QRBlock url={`https://locateiq.app/report/${reportId}`} size={48} />
                                </div>
                              </div>
                            </div>

                          </div>
                          {/* END RIGHT COLUMN */}

                        </div>
                        {/* END BOTTOM HALF */}

                      </div>
                      {/* END MAIN SECTION */}

                    </div>
                  )}

                  {template.id === "facebook" && (
                    <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", background: "#fbf8ef", overflow: "hidden" }}>
                      {/* Left Column */}
                      <div style={{ flex: "0 0 58%", display: "flex", flexDirection: "column", borderRight: "2px solid #ede8de", background: "#fbf8ef", position: "relative" }}>
                        
                        {/* Premium badge */}
                        <div style={{
                          position: "absolute", top: 0, left: 0, zIndex: 10,
                          background: accentColor, borderRadius: "0 0 20px 0", padding: "10px 24px",
                          fontSize: 14, fontWeight: 800, color: "#1a1814",
                          letterSpacing: "0.12em", textTransform: "uppercase",
                          display: "flex", alignItems: "center", gap: 8
                        }}>
                          <BadgeCheck size={18} />
                          PREMIUM PROPERTY
                        </div>

                        {/* Heading Part */}
                        <div style={{ flexShrink: 0, padding: "44px 32px 20px", display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 46, fontWeight: 900, color: "#1a1814", lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 12 }}>
                            {title}
                          </div>
                          
                          {/* Location Pill (Tool Text) */}
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start",
                            background: "white", borderRadius: 20, padding: "8px 16px",
                            border: "2px solid #ede8de", boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                            fontSize: 16, fontWeight: 700, color: "#1a1814"
                          }}>
                            <MapPin size={18} color={accentColor} />
                            {subtitle}
                          </div>
                        </div>

                        {/* Map Image */}
                        <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#e8e4db" }}>
                          {mapImageUrl ? (
                            <img src={mapImageUrl} alt="Property map" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #e8e3da 0%, #d4ccbf 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                              <MapPin size={48} color="#c8b97e" />
                              <span style={{ fontSize: 14, color: "#9e9689" }}>Map capture will appear here</span>
                            </div>
                          )}
                          <div style={{
                            position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.92)",
                            backdropFilter: "blur(8px)", borderRadius: 10, padding: "6px 12px",
                            fontSize: 14, fontWeight: 700, color: "#1a1814", fontFamily: "monospace",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.12)", pointerEvents: "none",
                          }}>
                            {coords.lat.toFixed(5)}° N, {coords.lng.toFixed(5)}° E
                          </div>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fbf8ef", padding: "8px 20px 20px 20px", gap: 16 }}>
                        {/* Data Metrics */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, flexShrink: 0 }}>
                          {propCards.map(({ label, value, icon }) => (
                            <div key={label} style={{
                              background: "white", border: "2px solid #ede8de",
                              borderRadius: 12, padding: "8px 12px",
                              display: "flex", flexDirection: "column", gap: 2,
                              boxShadow: "0 4px 16px rgba(0,0,0,0.02)"
                            }}>
                              <div style={{ marginBottom: 2 }}>
                                <div style={{ transform: "scale(0.9)", transformOrigin: "left center" }}>
                                  {icon}
                                </div>
                              </div>
                              <div style={{ fontSize: 17, fontWeight: 900, color: "#1a1814", lineHeight: 1.1 }}>
                                {value}
                              </div>
                              <div style={{ fontSize: 9, color: "#5a5248", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                {label}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Key Highlights */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <MapPin size={16} color="#1a1814" />
                            <div style={{ fontSize: 13, fontWeight: 900, color: "#1a1814", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                              Nearby Highlights
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, overflow: "hidden" }}>
                            {sortedPois.slice(0, 5).map((poi) => {
                              const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: "#666" };
                              const Icon = meta.Icon;
                              return (
                                <div key={poi.name} style={{
                                  display: "flex", alignItems: "center", justifyContent: "space-between",
                                  padding: "8px 12px", background: "white", borderRadius: 12, border: "2px solid #ede8de",
                                  boxShadow: "0 4px 16px rgba(0,0,0,0.02)"
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${meta.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <Icon size={14} color={meta.color} style={{ flexShrink: 0 }} />
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1814" }}>{poi.name}</span>
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 800, color: "#5a5248", whiteSpace: "nowrap" }}>
                                    {poi.distanceKm.toFixed(1)} km
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Agent Section */}
                        <div style={{
                          flex: 1, background: "#fffbf0", borderRadius: 16,
                          border: `2px solid ${accentColor}`, padding: "16px",
                          display: "flex", flexDirection: "row", alignItems: "stretch",
                        }}>
                          {/* Left Side: Agent Info */}
                          <div style={{
                            flex: 1.5,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            borderRight: "2px solid #ede8de",
                            paddingRight: 16
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <img
                                src={agentPhoto}
                                alt={agentName}
                                crossOrigin="anonymous"
                                style={{
                                  width: 64, height: 64,
                                  borderRadius: "50%", objectFit: "cover",
                                  border: "3px solid white", boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                                  flexShrink: 0,
                                }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 18, fontWeight: 900, color: "#1a1814", marginBottom: 2 }}>{agentName}</div>
                                <div style={{ fontSize: 12, color: "#5a5248", fontWeight: 700 }}>{agentRole}</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                              <Phone size={14} color={accentColor} />
                              <span style={{ fontSize: 14, fontWeight: 800, color: "#1a1814" }}>{agentPhone}</span>
                            </div>
                          </div>

                          {/* Right Side: CTA & QR */}
                          <div style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            paddingLeft: 16
                          }}>
                            <div style={{ fontSize: 10, color: "#5a5248", fontStyle: "italic", marginBottom: 2 }}>Interested in this property?</div>
                            <div style={{
                              fontSize: 22,
                              fontFamily: "'Dancing Script', Georgia, cursive",
                              color: "#1a1814", fontWeight: 700, lineHeight: 1.1,
                              marginBottom: 8
                            }}>Let's Connect!</div>
                            <div style={{
                              width: 48, height: 48,
                              background: "white", borderRadius: 8,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              border: "2px solid #ede8de", padding: 4
                            }}>
                              <QRBlock url={`https://locateiq.app/report/${reportId}`} size={40} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {template.id === "a4" && (
                    <div style={{ position: "relative", display: "flex", flexDirection: "row", width: "100%", height: "100%", background: "#d6d1c9", boxSizing: "border-box", padding: "32px", gap: 24 }}>

                      {/* ── PAGE 1 — Left (Title + Map) ── */}
                      <div style={{ flex: 1, minWidth: 0, height: 1690, display: "flex", flexDirection: "column", position: "relative", padding: "64px 52px 44px", boxSizing: "border-box", gap: 28, background: "#fbf8ef", borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}>
                        {/* Premium badge */}
                        <div style={{
                          position: "absolute", top: 0, left: 0, zIndex: 10,
                          background: accentColor, borderRadius: "0 0 24px 0", padding: "16px 32px",
                          fontSize: 20, fontWeight: 800, color: "#1a1814",
                          letterSpacing: "0.12em", textTransform: "uppercase",
                          display: "flex", alignItems: "center", gap: 10
                        }}>
                          <BadgeCheck size={26} />
                          PREMIUM PROPERTY
                        </div>

                        {/* Title and Location */}
                        <div style={{ flexShrink: 0, paddingTop: 24 }}>
                          <div style={{ fontSize: 80, fontWeight: 900, color: "#1a1814", lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 20 }}>
                            {title}
                          </div>
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: 14,
                            background: "white", borderRadius: 24, padding: "14px 24px",
                            border: "2px solid #ede8de", boxShadow: "0 6px 24px rgba(0,0,0,0.03)",
                            fontSize: 24, fontWeight: 700, color: "#1a1814"
                          }}>
                            <MapPin size={28} color={accentColor} />
                            {subtitle}
                          </div>
                        </div>

                        {/* Map Section — fills the remaining height */}
                        <div style={{ flex: 1, minHeight: 0, position: "relative", borderRadius: 32, overflow: "hidden", boxShadow: "0 12px 48px rgba(0,0,0,0.08)", border: "6px solid white" }}>
                          {mapImageUrl ? (
                            <img src={mapImageUrl} alt="Property map" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #e8e3da 0%, #d4ccbf 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                              <MapPin size={48} color="#c8b97e" />
                              <span style={{ fontSize: 20, color: "#9e9689" }}>Map capture will appear here</span>
                            </div>
                          )}
                          <div style={{
                            position: "absolute", top: 24, left: 24,
                            background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
                            borderRadius: 14, padding: "10px 20px",
                            fontSize: 20, fontWeight: 700, color: "#1a1814", fontFamily: "monospace",
                            boxShadow: "0 6px 24px rgba(0,0,0,0.12)", pointerEvents: "none",
                          }}>
                            {coords.lat.toFixed(5)}° N, {coords.lng.toFixed(5)}° E
                          </div>
                        </div>

                        {/* Agent Section — left page (identical to right page) */}
                        <div style={{
                          background: "#fffbf0", borderRadius: 28,
                          border: `3px solid ${accentColor}`,
                          padding: "36px 40px", flexShrink: 0
                        }}>
                          <div style={{ textAlign: "center", marginBottom: 24, paddingBottom: 24, borderBottom: "2px solid #ede8de" }}>
                            <div style={{ fontSize: 22, color: "#5a5248", marginBottom: 4, fontStyle: "italic" }}>Interested in this property?</div>
                            <div style={{ fontSize: 64, fontFamily: "'Dancing Script', Georgia, cursive", color: "#1a1814", fontWeight: 700, lineHeight: 1.1 }}>Let's Connect!</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                              <img src={agentPhoto} alt={agentName} crossOrigin="anonymous" style={{ width: 140, height: 140, borderRadius: "50%", objectFit: "cover", border: "5px solid white", boxShadow: "0 6px 24px rgba(0,0,0,0.12)", flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 44, fontWeight: 900, color: "#1a1814", marginBottom: 8 }}>{agentName}</div>
                                <div style={{ fontSize: 24, color: "#5a5248", marginBottom: 16 }}>{agentRole}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <Phone size={26} color={accentColor} />
                                  <span style={{ fontSize: 28, fontWeight: 800, color: "#1a1814" }}>{agentPhone}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flexShrink: 0 }}>
                              <div style={{ width: 130, height: 130, background: "white", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #ede8de", padding: 8 }}>
                                <QRBlock url={`https://locateiq.app/report/${reportId}`} size={114} />
                              </div>
                              <div style={{ fontSize: 17, color: "#5a5248", fontWeight: 700 }}>Scan to view report</div>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* ── PAGE 2 — Right (Metrics + Highlights + Agent) ── */}
                      <div style={{ flex: 1, height: 1690, display: "flex", flexDirection: "column", padding: "52px 52px 44px", boxSizing: "border-box", gap: 28, background: "#fbf8ef", borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}>

                        {/* 1. Section label */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                          <MapPin size={26} color="#1a1814" />
                          <div style={{ fontSize: 22, fontWeight: 900, color: "#1a1814", letterSpacing: "0.15em", textTransform: "uppercase" }}>Property Details</div>
                        </div>

                        {/* 2. Property Stats — 2×2 grid with bigger fonts */}
                        <div style={{
                          display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
                          gap: 20, flexShrink: 0
                        }}>
                          {propCards.map(({ label, value, icon }) => (
                            <div key={label} style={{
                              display: "flex", flexDirection: "column", gap: 8,
                              padding: "28px 28px 24px", background: "white", borderRadius: 24, border: "2px solid #ede8de",
                              boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
                            }}>
                              <div style={{ transform: "scale(1.8)", transformOrigin: "left center", marginBottom: 10 }}>
                                {icon}
                              </div>
                              <div style={{ fontSize: 18, color: "#5a5248", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                                {label}
                              </div>
                              <div style={{ fontSize: 52, fontWeight: 900, color: "#1a1814", lineHeight: 1.05 }}>
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* 3. Nearby Highlights — single column list */}
                        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingLeft: 4 }}>
                            <MapPin size={26} color="#1a1814" />
                            <div style={{ fontSize: 22, fontWeight: 900, color: "#1a1814", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                              Nearby Highlights
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
                            {sortedPois.slice(0, 5).map((poi) => {
                              const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: "#666" };
                              const Icon = meta.Icon;
                              return (
                                <div key={poi.name} style={{
                                  display: "flex", alignItems: "center", justifyContent: "space-between",
                                  background: "white", borderRadius: 20, padding: "18px 24px",
                                  border: "2px solid #ede8de", boxShadow: "0 4px 16px rgba(0,0,0,0.02)"
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                                    <div style={{
                                      width: 56, height: 56, borderRadius: 16, 
                                      background: `${meta.color}15`,
                                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                                    }}>
                                      <Icon size={28} color={meta.color} />
                                    </div>
                                    <div style={{ fontSize: 26, fontWeight: 700, color: "#1a1814", lineHeight: 1.2 }}>
                                      {poi.name}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 26, fontWeight: 800, color: "#5a5248", whiteSpace: "nowrap", marginLeft: 12 }}>
                                    {poi.distanceKm.toFixed(1)} km
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 4. Agent Section — Let's Connect on top, agent info below */}
                        <div style={{
                          background: "#fffbf0", borderRadius: 28,
                          border: `3px solid ${accentColor}`,
                          padding: "36px 40px", flexShrink: 0
                        }}>
                          <div style={{ textAlign: "center", marginBottom: 24, paddingBottom: 24, borderBottom: "2px solid #ede8de" }}>
                            <div style={{ fontSize: 22, color: "#5a5248", marginBottom: 4, fontStyle: "italic" }}>Interested in this property?</div>
                            <div style={{ fontSize: 64, fontFamily: "'Dancing Script', Georgia, cursive", color: "#1a1814", fontWeight: 700, lineHeight: 1.1 }}>Let's Connect!</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                              <img src={agentPhoto} alt={agentName} crossOrigin="anonymous" style={{ width: 140, height: 140, borderRadius: "50%", objectFit: "cover", border: "5px solid white", boxShadow: "0 6px 24px rgba(0,0,0,0.12)", flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 44, fontWeight: 900, color: "#1a1814", marginBottom: 8 }}>{agentName}</div>
                                <div style={{ fontSize: 24, color: "#5a5248", marginBottom: 16 }}>{agentRole}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <Phone size={26} color={accentColor} />
                                  <span style={{ fontSize: 28, fontWeight: 800, color: "#1a1814" }}>{agentPhone}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flexShrink: 0 }}>
                              <div style={{ width: 130, height: 130, background: "white", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #ede8de", padding: 8 }}>
                                <QRBlock url={`https://locateiq.app/report/${reportId}`} size={114} />
                              </div>
                              <div style={{ fontSize: 17, color: "#5a5248", fontWeight: 700 }}>Scan to view report</div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {template.id !== "whatsapp" && template.id !== "instagram-square" && template.id !== "instagram-portrait" && template.id !== "facebook" && template.id !== "a4" && (
                    <>
                      {/* ── TITLE ROW ───────────────────────────────────────── */}
                  <div style={{
                    flexShrink: 0,
                    background: headerBg === "#fdfcf5" ? "#fdfcf5" : headerBg,
                    padding: "18px 24px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    borderBottom: "1px solid #f0ece4",
                  }}>
                    {/* Premium badge */}
                    <div style={{
                      flexShrink: 0,
                      background: accentColor,
                      borderRadius: 5,
                      padding: "4px 10px",
                      fontSize: 9,
                      fontWeight: 800,
                      color: "#1a1814",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}>
                      Premium Property
                    </div>
                    <div style={{
                      fontSize: 30, fontWeight: 900, color: "#1a1814",
                      lineHeight: 1.1, letterSpacing: "-0.03em",
                      flex: 1, minWidth: 0,
                    }}>
                      {title}
                    </div>
                  </div>

                  {/* ── MAP + DETAILS ROW ────────────────────────────────── */}
                  <div style={{ 
                    flex: 1, 
                    minHeight: 0, 
                    display: "flex", 
                    overflow: "hidden",
                    flexDirection: "row"
                  }}>

                    {/* Map section */}
                    <div style={{
                      flex: "0 0 58%",
                      position: "relative",
                      overflow: "hidden",
                      borderRight: "1px solid #f0ece4",
                      background: "#e8e4db",
                    }}>
                      {mapImageUrl ? (
                        <img
                          src={mapImageUrl}
                          alt="Property map"
                          crossOrigin="anonymous"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div style={{
                          width: "100%", height: "100%",
                          background: "linear-gradient(135deg, #e8e3da 0%, #d4ccbf 100%)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexDirection: "column", gap: 8,
                        }}>
                          <MapPin size={32} color="#c8b97e" />
                          <span style={{ fontSize: 11, color: "#9e9689" }}>Map capture will appear here</span>
                        </div>
                      )}

                      {/* Coordinate badge — top-left */}
                      <div style={{
                        position: "absolute", top: 10, left: 10,
                        background: "rgba(255,255,255,0.92)",
                        backdropFilter: "blur(4px)",
                        borderRadius: 6, padding: "4px 10px",
                        fontSize: 10, fontWeight: 700, color: "#1a1814",
                        fontFamily: "monospace",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        pointerEvents: "none",
                      }}>
                        {coords.lat.toFixed(5)}° N, {coords.lng.toFixed(5)}° E
                      </div>
                    </div>

                    {/* Details section */}
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      padding: "16px 14px 12px",
                      background: "white",
                      overflow: "hidden",
                      gap: 14,
                    }}>
                      {/* Property stat grid — 2×2 */}
                      <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "1fr 1fr", 
                        gap: 8,
                        alignContent: "start"
                      }}>
                        {propCards.map(({ label, value, icon }) => (
                          <div key={label} style={{
                            background: "#fafaf8",
                            border: "1px solid #ede8de",
                            borderRadius: 10, padding: "10px 12px",
                            display: "flex", flexDirection: "column", gap: 4,
                          }}>
                            <div style={{ marginBottom: 2 }}>
                              <div style={{ transformOrigin: "left center" }}>
                                {icon}
                              </div>
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1814", lineHeight: 1.2 }}>
                              {value}
                            </div>
                            <div style={{ fontSize: 8.5, color: "#9e9689", fontWeight: 600, letterSpacing: "0.08em" }}>
                              {label}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Key Highlights */}
                      <div>
                        <div style={{
                          fontSize: 8.5, letterSpacing: "0.18em", color: "#5a5248",
                          textTransform: "uppercase", fontWeight: 800, marginBottom: 8,
                        }}>
                          Key Highlights
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {sortedPois.slice(0, 8).map((poi) => {
                            const meta = CATEGORY_META[poi.type] ?? { Icon: MapPin, color: "#666" };
                            const Icon = meta.Icon;
                            return (
                              <div key={poi.name} style={{
                                display: "flex", alignItems: "center",
                                justifyContent: "space-between",
                                padding: "6px 8px 6px 6px",
                                background: "#fafaf8",
                                borderRadius: 8, border: "1px solid #ede8de",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <Icon size={11} color={meta.color} style={{ flexShrink: 0 }} />
                                  <span style={{ fontSize: 11, fontWeight: 600, color: "#1a1814" }}>{poi.name}</span>
                                </div>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, color: "#5a5248",
                                  whiteSpace: "nowrap",
                                }}>
                                  {poi.distanceKm.toFixed(1)} km
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── AGENT FOOTER ─────────────────────────────────────── */}
                  <div style={{
                    flexShrink: 0,
                    borderTop: "1px solid #ede8de",
                    background: "white",
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 20px",
                    gap: 0,
                    minHeight: 88,
                  }}>
                    {/* Agent info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                      <img
                        src={agentPhoto}
                        alt={agentName}
                        crossOrigin="anonymous"
                        style={{
                          width: 52, height: 52,
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: `2px solid ${accentColor}`,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1814", lineHeight: 1.2, marginBottom: 2 }}>
                          {agentName}
                        </div>
                        <div style={{ fontSize: 9, color: "#9e9689", marginBottom: 5 }}>{agentRole}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Phone size={9} color={accentColor} />
                            <span style={{ fontSize: 9.5, color: "#5a5248" }}>{agentPhone}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ width: 1, height: 52, background: "#ede8de", margin: "0 18px", flexShrink: 0 }} />

                    {/* CTA text */}
                    <div style={{ flexShrink: 0, textAlign: "center", marginRight: 18 }}>
                      <div style={{ fontSize: 9.5, color: "#9e9689", marginBottom: 3 }}>
                        Interested in this property?
                      </div>
                      <div style={{
                        fontSize: 22,
                        fontFamily: "'Dancing Script', Georgia, cursive",
                        color: "#1a1814",
                        fontWeight: 700,
                        lineHeight: 1.1,
                      }}>
                        Let's Connect!
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ width: 1, height: 52, background: "#ede8de", margin: "0 18px", flexShrink: 0 }} />

                    {/* QR Code */}
                    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 60, height: 60,
                        background: "#1a1814",
                        borderRadius: 6,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        overflow: "hidden",
                      }}>
                        <QRBlock url={`https://locateiq.app/report/${reportId}`} size={60} />
                      </div>
                      <div>
                        <div style={{ fontSize: 8.5, fontWeight: 700, color: "#1a1814", marginBottom: 1 }}>Scan to</div>
                        <div style={{ fontSize: 8, color: "#9e9689", lineHeight: 1.4 }}>Contact or<br />view full report</div>
                      </div>
                    </div>
                  </div>
                    </>
                  )}
                </div>
                {/* End #brochure-canvas */}
              </div>
              {/* End LEFT */}

              {/* ── RIGHT: Template Studio Panel ─────────────────────────── */}
              <div style={{
                width: 260,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                borderLeft: "1px solid #e8e3d8",
                background: "#f5f4ef",
              }}>
                {/* Panel header */}
                <div style={{
                  padding: "18px 18px 14px",
                  borderBottom: "1px solid #e8e3d8",
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1814", marginBottom: 2 }}>
                    Template Studio
                  </div>
                  <div style={{ fontSize: 11, color: "#9e9689" }}>High-fidelity formats</div>
                </div>

                {/* Scrollable content */}
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "14px 14px 0" }}>

                  {/* ── Choose Template ─────────────────────────────────── */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 8.5, letterSpacing: "0.18em", color: "#9e9689",
                      textTransform: "uppercase", fontWeight: 700, marginBottom: 8,
                    }}>
                      Choose Template
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {TEMPLATES.map((t) => {
                        const active = selectedTemplate === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTemplate(t.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "8px 10px", borderRadius: 10,
                              border: active ? `1.5px solid ${accentColor}` : "1.5px solid #e8e3d8",
                              background: active ? "#fef9ec" : "white",
                              cursor: "pointer", textAlign: "left",
                              transition: "all 0.12s",
                              position: "relative",
                            }}
                          >
                            <TemplateThumbnail t={t} active={active} />
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                              <span style={{ color: active ? accentColor : "#9e9689", flexShrink: 0 }}>{t.icon}</span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: active ? "#1a1814" : "#3a3228", lineHeight: 1.2 }}>{t.label}</div>
                                <div style={{ fontSize: 9, color: "#9e9689" }}>{t.sub}</div>
                              </div>
                            </div>
                            {active && (
                              <div style={{
                                width: 18, height: 18, borderRadius: "50%",
                                background: accentColor,
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                              }}>
                                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                  <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ height: 1, background: "#e8e3d8", marginBottom: 14 }} />

                  {/* ── Customize ───────────────────────────────────────── */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => { setShowColors((v) => !v); setShowText(false); }}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                          gap: 5, padding: "8px 6px", borderRadius: 9,
                          border: showColors ? `1.5px solid ${accentColor}` : "1.5px solid #e8e3d8",
                          background: showColors ? "#fef9ec" : "white",
                          cursor: "pointer", fontSize: 10.5, fontWeight: 600,
                          color: showColors ? "#1a1814" : "#5a5248",
                          transition: "all 0.15s",
                        }}
                      >
                        <Palette size={11} color={showColors ? accentColor : "#9e9689"} />
                        Colors
                        {showColors ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                      <button
                        onClick={() => { setShowText((v) => !v); setShowColors(false); }}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                          gap: 5, padding: "8px 6px", borderRadius: 9,
                          border: showText ? `1.5px solid ${accentColor}` : "1.5px solid #e8e3d8",
                          background: showText ? "#fef9ec" : "white",
                          cursor: "pointer", fontSize: 10.5, fontWeight: 600,
                          color: showText ? "#1a1814" : "#5a5248",
                          transition: "all 0.15s",
                        }}
                      >
                        <Type size={11} color={showText ? accentColor : "#9e9689"} />
                        Text
                        {showText ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    </div>

                    {/* Color picker panel */}
                    {showColors && (
                      <div style={{
                        background: "white", borderRadius: 10,
                        border: "1px solid #e8e3d8", padding: "12px",
                        marginTop: 8,
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {[
                            { label: "Accent Color", value: accentColor, onChange: setAccentColor },
                            { label: "Background", value: headerBg, onChange: setHeaderBg },
                          ].map(({ label, value, onChange }) => (
                            <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 10.5, fontWeight: 600, color: "#5a5248" }}>{label}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 18, height: 18, borderRadius: 4, background: value, border: "1px solid #e8e3d8" }} />
                                <input
                                  type="color"
                                  value={value}
                                  onChange={(e) => onChange(e.target.value)}
                                  style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer", borderRadius: 4, background: "transparent" }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Text editing panel */}
                    {showText && (
                      <div style={{
                        background: "white", borderRadius: 10,
                        border: "1px solid #e8e3d8", padding: "12px",
                        display: "flex", flexDirection: "column", gap: 8,
                        marginTop: 8,
                      }}>
                        {[
                          { label: "Property Title", value: title, onChange: setTitle },
                          { label: "Location / Subtitle", value: subtitle, onChange: setSubtitle },
                          { label: "Land Area", value: area, onChange: setArea },
                          { label: "Total Price", value: price, onChange: setPrice },
                          { label: "Price per Acre", value: pricePerUnit, onChange: setPricePerUnit },
                          { label: "Title Status", value: titleStatus, onChange: setTitleStatus },
                        ].map(({ label, value, onChange }) => (
                          <div key={label}>
                            <div style={{ fontSize: 9, color: "#9e9689", marginBottom: 3, fontWeight: 600 }}>{label}</div>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => onChange(e.target.value)}
                              style={{
                                width: "100%", padding: "6px 8px", fontSize: 11,
                                border: "1.5px solid #e8e3d8", borderRadius: 6,
                                background: "#fafaf8", color: "#1a1814",
                                outline: "none", fontFamily: "inherit",
                                boxSizing: "border-box",
                              }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
                              onBlur={(e) => (e.currentTarget.style.borderColor = "#e8e3d8")}
                            />
                          </div>
                        ))}
                        <div style={{ height: 1, background: "#e8e3d8", margin: "2px 0" }} />
                        <div style={{ fontSize: 9, color: accentColor, fontWeight: 700, marginBottom: 2, letterSpacing: "0.1em", textTransform: "uppercase" }}>Agent Info</div>
                        {[
                          { label: "Agent Name", value: agentName, onChange: setAgentName },
                          { label: "Agent Role", value: agentRole, onChange: setAgentRole },
                          { label: "Phone", value: agentPhone, onChange: setAgentPhone },
                          { label: "Email", value: agentEmail, onChange: setAgentEmail },
                          { label: "Location", value: agentLocation, onChange: setAgentLocation },
                        ].map(({ label, value, onChange }) => (
                          <div key={label}>
                            <div style={{ fontSize: 9, color: "#9e9689", marginBottom: 3, fontWeight: 600 }}>{label}</div>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => onChange(e.target.value)}
                              style={{
                                width: "100%", padding: "6px 8px", fontSize: 11,
                                border: "1.5px solid #e8e3d8", borderRadius: 6,
                                background: "#fafaf8", color: "#1a1814",
                                outline: "none", fontFamily: "inherit",
                                boxSizing: "border-box",
                              }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
                              onBlur={(e) => (e.currentTarget.style.borderColor = "#e8e3d8")}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Download Button — fixed at bottom ─────────────────── */}
                <div style={{
                  flexShrink: 0,
                  padding: "14px 14px 16px",
                  borderTop: "1px solid #e8e3d8",
                  background: "#f5f4ef",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}>
                  {/* Primary Download */}
                  <button
                    id="brochure-download-png"
                    onClick={() => handleDownload(template.id === "a4" ? "pdf" : "png")}
                    disabled={dlState.startsWith("loading")}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 8, padding: "13px 16px",
                      borderRadius: 12, border: "none",
                      background: dlState.startsWith("done")
                        ? "linear-gradient(135deg,#22c55e,#16a34a)"
                        : `linear-gradient(135deg, ${accentColor}, #e5ba24)`,
                      color: "#1a1814", cursor: dlState.startsWith("loading") ? "not-allowed" : "pointer",
                      fontSize: 13, fontWeight: 700,
                      boxShadow: `0 4px 16px ${accentColor}55`,
                      opacity: dlState.startsWith("loading") ? 0.8 : 1,
                      transition: "all 0.2s",
                      width: "100%",
                    }}
                    onMouseEnter={(e) => {
                      if (!dlState.startsWith("loading")) e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; }}
                  >
                    {dlState.startsWith("loading") ? <Spinner color="#1a1814" /> : <Download size={15} />}
                    {dlState.startsWith("done") ? "✓ Downloaded!" : "Download"}
                  </button>

                  {/* Secondary format buttons */}
                  <div style={{ display: "flex", gap: 5 }}>
                    {(["jpg", "pdf"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        id={`brochure-download-${fmt}`}
                        onClick={() => handleDownload(fmt)}
                        disabled={dlState.startsWith("loading")}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                          gap: 5, padding: "8px 6px", borderRadius: 9,
                          border: "1.5px solid #e8e3d8", background: "white",
                          cursor: dlState.startsWith("loading") ? "not-allowed" : "pointer",
                          fontSize: 10, fontWeight: 600, color: "#5a5248",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f4ef"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
                      >
                        {dlState === `loading-${fmt}` ? <Spinner size={10} color="#5a5248" /> : <Download size={10} color="#5a5248" />}
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* End RIGHT */}
            </div>
            {/* End Body */}
          </motion.div>

          <style>{`
            @keyframes brochure-spin { to { transform: rotate(360deg); } }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Legacy export alias — keeps the existing usage in analysis.tsx working
export { BrochureDialog as default };
