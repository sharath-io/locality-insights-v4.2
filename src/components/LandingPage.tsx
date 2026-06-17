import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  MapPin,
  Route as RouteIcon,
  Navigation,
  GraduationCap,
  BookOpen,
  Hospital,
  Landmark,
  Camera,
  Trees,
  ShoppingBag,
  Building2,
  UtensilsCrossed,
  Check,
  Train,
  Bus,
  Fuel,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { useReportStore } from "@/stores/reportStore";
import { QUICK_LOCATIONS } from "@/lib/quick-locations";

interface Category {
  id: string;
  label: string;
  Icon: LucideIcon;
}

const TransitIcons = (props: any) => (
  <div className="flex items-center gap-1.5">
    <Train {...props} />
    <span className={props.className} style={{ fontSize: "14px", opacity: 0.4, paddingBottom: "2px" }}>/</span>
    <Bus {...props} />
  </div>
);

const CATEGORIES: Category[] = [
  { id: "hospitals",    label: "HOSPITALS",      Icon: Hospital },
  { id: "business_hubs",label: "BUSINESS HUBS",  Icon: Briefcase },
  { id: "petrol_pumps", label: "PETROL PUMPS",   Icon: Fuel },
  { id: "temples",      label: "TEMPLES",        Icon: Landmark },
  { id: "restaurants",  label: "RESTAURANTS",    Icon: UtensilsCrossed },
  { id: "shopping",     label: "SHOPPING AREAS", Icon: ShoppingBag },
  { id: "education",    label: "EDUCATION",      Icon: GraduationCap },
  { id: "transit",      label: "PUBLIC TRANSIT", Icon: TransitIcons as unknown as LucideIcon },
  { id: "attractions",  label: "ATTRACTIONS",    Icon: Camera },
  { id: "main_roads",   label: "MAIN ROADS",     Icon: Navigation },
];

const ALL_IDS = CATEGORIES.map((c) => c.id);

function parseCoordinates(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  // Prefer !3d<lat>!4d<lng> — these are the actual place coords (vs @ which is viewport center)
  const place = input.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (place) return { lat: parseFloat(place[1]), lng: parseFloat(place[2]) };
  // Then @lat,lng viewport pattern
  const at = input.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  // q=lat,lng or query=lat,lng pattern
  const q = input.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  // Generic: pull all decimal numbers and pick the first valid lat/lng pair
  const nums = input.match(/-?\d+\.\d+/g);
  if (nums && nums.length >= 2) {
    for (let i = 0; i < nums.length - 1; i++) {
      const lat = parseFloat(nums[i]);
      const lng = parseFloat(nums[i + 1]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const {
    inputUrl,
    setInputUrl,
    setCoordinates,
    setSelectedCategories,
    setIsGenerating,
    setLocationReport,
    resetAnalysis,
    setAutoBrochureMode,
  } = useReportStore();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Both CTA buttons are enabled only when the user has typed a location AND
  // selected at least one category.
  const parsedCoords = parseCoordinates(inputUrl);
  const canGenerate = !!parsedCoords && selected.length > 0;

  const handleGenerate = () => {
    const labels = CATEGORIES.filter((c) => selected.includes(c.id)).map((c) => c.label);
    // Wipe any stale analysis state before starting a fresh report
    resetAnalysis();
    setIsGenerating(false);
    setLocationReport(null);
    setSelectedCategories(labels);
    setCoordinates(parsedCoords);
    navigate({ to: "/analysis" });
  };

  const handleGenerateBrochureDirectly = () => {
    const labels = CATEGORIES.filter((c) => selected.includes(c.id)).map((c) => c.label);
    resetAnalysis();
    setIsGenerating(false);
    setLocationReport(null);
    setSelectedCategories(labels);
    setAutoBrochureMode(true);
    setCoordinates(parsedCoords);
    navigate({ to: "/analysis" });
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row font-body">
      {/* LEFT PANEL */}
      <section className="w-full md:w-2/5 bg-[var(--navy)] text-white px-8 md:px-12 py-12 md:py-16 flex flex-col justify-between">
        <div>
          <h1
            className="font-heading font-bold leading-[1.05] text-white"
            style={{ fontSize: "clamp(36px, 5vw, 52px)" }}
          >
            Locality
            <br />
            Analysis
          </h1>
          <p className="mt-6 font-light text-white/70 text-base md:text-lg max-w-md leading-relaxed">
            Generate intelligent vicinity insights from any Google Maps location.
          </p>

          <div className="mt-10">
            <label className="block text-[10px] tracking-[0.2em] text-white/50 uppercase mb-3">
              Source Location
            </label>
            <div className="relative">
              <MapPin
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]"
                size={18}
              />
              <input
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Paste Google Maps link or Lat, Lng..."
                className="w-full bg-white/5 border border-white/15 rounded-lg pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--gold)]/60 transition"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="mt-5 w-full rounded-lg py-4 text-white text-sm font-medium tracking-wide transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: canGenerate ? "#6b7c5e" : "#4a5540" }}
              onMouseEnter={(e) => { if (canGenerate) e.currentTarget.style.backgroundColor = "#5a6a4f"; }}
              onMouseLeave={(e) => { if (canGenerate) e.currentTarget.style.backgroundColor = "#6b7c5e"; }}
            >
              Generate Vicinity Report →
            </button>

            <button
              onClick={handleGenerateBrochureDirectly}
              disabled={!canGenerate}
              className="mt-3 w-full rounded-lg py-4 text-white text-sm font-medium tracking-wide transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: canGenerate
                  ? "linear-gradient(135deg, #c8b97e 0%, #a8975e 100%)"
                  : "rgba(200,185,126,0.25)",
                color: canGenerate ? "#0c1018" : "rgba(200,185,126,0.5)",
              }}
              onMouseEnter={(e) => { if (canGenerate) e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => { if (canGenerate) e.currentTarget.style.opacity = "1"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              Generate Brochure Directly
            </button>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="text-[11px] font-medium tracking-widest text-white/40 uppercase w-full mb-2">
                Quick Select
              </span>
              {QUICK_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => setInputUrl(loc.url)}
                  className="text-xs tracking-wide px-3.5 py-2 bg-white/5 border border-white/10 rounded-md text-white/80 hover:bg-white/10 hover:border-white/20 hover:text-white transition-all cursor-pointer font-medium"
                >
                  {loc.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-12 text-[10px] tracking-[0.2em] text-white/30 uppercase">
          Powered by Google Places &amp; Mapbox
        </p>
      </section>

      {/* RIGHT PANEL */}
      <section className="w-full md:w-3/5 bg-[var(--cream)] px-8 md:px-12 py-12 md:py-16">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <h2 className="font-heading text-xl md:text-2xl text-[var(--navy)] tracking-wide">
            INTELLIGENCE LAYERS
          </h2>
          <div className="flex gap-2">
            {[
              { label: "SELECT ALL", action: () => setSelected(ALL_IDS) },
              { label: "CLEAR", action: () => setSelected([]) },
            ].map((b) => (
              <button
                key={b.label}
                onClick={b.action}
                className="text-[10px] tracking-[0.15em] px-3 py-1.5 border border-[var(--navy)]/20 rounded text-[var(--navy)] hover:border-[var(--navy)] hover:bg-[var(--navy)] hover:text-white transition-colors cursor-pointer"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORIES.map((cat, i) => {
            const isSelected = selected.includes(cat.id);
            const { Icon } = cat;
            return (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3, ease: "easeOut" }}
                onClick={() => toggle(cat.id)}
                whileHover={{ y: -1 }}
                className={`px-4 py-3.5 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  cat.id === "main_roads" ? "sm:col-span-2 lg:col-span-3" : ""
                } ${
                  ["transit", "education", "attractions"].includes(cat.id) ? "row-span-2 flex flex-col justify-center gap-4" : "flex items-center gap-3"
                } ${
                  isSelected
                    ? "border-[var(--gold)] bg-[var(--navy)]/[0.04] shadow-[0_6px_18px_-8px_rgba(15,30,53,0.35)]"
                    : "border-[#e8e2d4] bg-white hover:border-[var(--navy)]/40 hover:shadow-sm"
                }`}
              >
                {cat.id === "transit" ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 transition-colors ${
                          isSelected ? "bg-[var(--navy)] border-[var(--navy)]" : "border-[#cfc7b3] bg-white"
                        }`}
                      >
                        {isSelected && <Check size={12} className="text-[var(--gold)]" strokeWidth={3} />}
                      </span>
                      <span className={`text-[11px] font-semibold tracking-wider ${isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/80"}`}>
                        {cat.label}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 pl-[32px]">
                      <div className="flex items-center gap-2">
                        <Bus size={16} className={isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/70"} strokeWidth={isSelected ? 2.25 : 1.75} />
                        <span className={`text-[11px] font-semibold tracking-wider ${isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/80"}`}>BUS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Train size={16} className={isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/70"} strokeWidth={isSelected ? 2.25 : 1.75} />
                        <span className={`text-[11px] font-semibold tracking-wider ${isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/80"}`}>METRO</span>
                      </div>
                    </div>
                  </>
                ) : cat.id === "education" ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 transition-colors ${
                          isSelected ? "bg-[var(--navy)] border-[var(--navy)]" : "border-[#cfc7b3] bg-white"
                        }`}
                      >
                        {isSelected && <Check size={12} className="text-[var(--gold)]" strokeWidth={3} />}
                      </span>
                      <span className={`text-[11px] font-semibold tracking-wider ${isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/80"}`}>
                        {cat.label}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 pl-[32px]">
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className={isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/70"} strokeWidth={isSelected ? 2.25 : 1.75} />
                        <span className={`text-[11px] font-semibold tracking-wider ${isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/80"}`}>SCHOOL</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <GraduationCap size={16} className={isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/70"} strokeWidth={isSelected ? 2.25 : 1.75} />
                        <span className={`text-[11px] font-semibold tracking-wider ${isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/80"}`}>UNIVERSITY</span>
                      </div>
                    </div>
                  </>
                ) : cat.id === "attractions" ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 transition-colors ${
                          isSelected ? "bg-[var(--navy)] border-[var(--navy)]" : "border-[#cfc7b3] bg-white"
                        }`}
                      >
                        {isSelected && <Check size={12} className="text-[var(--gold)]" strokeWidth={3} />}
                      </span>
                      <span className={`text-[11px] font-semibold tracking-wider ${isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/80"}`}>
                        {cat.label}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 pl-[32px]">
                      <div className="flex items-center gap-2">
                        <Camera size={16} className={isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/70"} strokeWidth={isSelected ? 2.25 : 1.75} />
                        <span className={`text-[11px] font-semibold tracking-wider ${isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/80"}`}>VIEW POINT</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Trees size={16} className={isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/70"} strokeWidth={isSelected ? 2.25 : 1.75} />
                        <span className={`text-[11px] font-semibold tracking-wider ${isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/80"}`}>PARK</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Landmark size={16} className={isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/70"} strokeWidth={isSelected ? 2.25 : 1.75} />
                        <span className={`text-[11px] font-semibold tracking-wider ${isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/80"}`}>MUSEUM</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 transition-colors ${
                        isSelected
                          ? "bg-[var(--navy)] border-[var(--navy)]"
                          : "border-[#cfc7b3] bg-white"
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-[var(--gold)]" strokeWidth={3} />}
                    </span>
                    <Icon
                      size={18}
                      className={isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/70"}
                      strokeWidth={isSelected ? 2.25 : 1.75}
                    />
                    <span
                      className={`text-[11px] font-semibold tracking-wider ${
                        isSelected ? "text-[var(--navy)]" : "text-[var(--navy)]/80"
                      }`}
                    >
                      {cat.label}
                    </span>
                  </>
                )}
              </motion.button>
            );
          })}
        </div>

        <p className="mt-8 italic text-sm text-[var(--muted)]">
          Select layers to prioritize in the professional vicinity assessment.
        </p>
      </section>
    </main>
  );
}
