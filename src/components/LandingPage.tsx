import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  MapPin,
  Route as RouteIcon,
  Navigation,
  GraduationCap,
  BookOpen,
  Hospital,
  Landmark,
  Camera,
  ShoppingBag,
  Train,
  Bus,
  Building2,
  UtensilsCrossed,
  Trees,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { useReportStore } from '@/stores/reportStore';

interface Category {
  id: string;
  label: string;
  Icon: LucideIcon;
}

const CATEGORIES: Category[] = [
  { id: 'highways', label: 'HIGHWAYS', Icon: RouteIcon },
  { id: 'main_roads', label: 'MAIN ROADS', Icon: Navigation },
  { id: 'schools', label: 'SCHOOLS', Icon: GraduationCap },
  { id: 'colleges', label: 'COLLEGES', Icon: BookOpen },
  { id: 'hospitals', label: 'HOSPITALS', Icon: Hospital },
  { id: 'temples', label: 'TEMPLES', Icon: Landmark },
  { id: 'tourist', label: 'TOURIST ATTRACTIONS', Icon: Camera },
  { id: 'shopping', label: 'SHOPPING AREAS', Icon: ShoppingBag },
  { id: 'metro', label: 'METRO/RAILWAY', Icon: Train },
  { id: 'bus', label: 'BUS STOPS', Icon: Bus },
  { id: 'it_parks', label: 'IT PARKS', Icon: Building2 },
  { id: 'restaurants', label: 'RESTAURANTS', Icon: UtensilsCrossed },
  { id: 'lakes_parks', label: 'LAKES/PARKS', Icon: Trees },
  { id: 'landmarks', label: 'LANDMARKS', Icon: MapPin },
];

const IMPORTANT_IDS = ['highways', 'schools', 'hospitals', 'metro', 'it_parks'];
const ALL_IDS = CATEGORIES.map((c) => c.id);

function parseCoordinates(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  // Try @lat,lng pattern from full google maps URLs
  const at = input.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
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
  const { inputUrl, setInputUrl, setCoordinates, setSelectedCategories } = useReportStore();
  const [selected, setSelected] = useState<string[]>(ALL_IDS);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleGenerate = () => {
    const labels = CATEGORIES.filter((c) => selected.includes(c.id)).map((c) => c.label);
    setSelectedCategories(labels);
    setCoordinates(parseCoordinates(inputUrl));
    navigate({ to: '/analysis' });
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row font-body">
      {/* LEFT PANEL */}
      <section className="w-full md:w-2/5 bg-[var(--navy)] text-white px-8 md:px-12 py-12 md:py-16 flex flex-col justify-between">
        <div>
          <h1
            className="font-heading font-bold leading-[1.05] text-white"
            style={{ fontSize: 'clamp(36px, 5vw, 52px)' }}
          >
            Locality
            <br />
            Analysis
          </h1>
          <p className="mt-6 font-light text-white/70 text-base md:text-lg max-w-md leading-relaxed">
            Generate intelligent vicinity insights from any Google Maps location with
            brochure-ready precision.
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
              className="mt-5 w-full rounded-lg py-4 text-white text-sm font-medium tracking-wide transition-colors"
              style={{ backgroundColor: '#6b7c5e' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5a6a4f')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6b7c5e')}
            >
              Generate Vicinity Report →
            </button>
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
              { label: 'SELECT ALL', action: () => setSelected(ALL_IDS) },
              { label: 'SELECT IMPORTANT', action: () => setSelected(IMPORTANT_IDS) },
              { label: 'CLEAR', action: () => setSelected([]) },
            ].map((b) => (
              <button
                key={b.label}
                onClick={b.action}
                className="text-[10px] tracking-[0.15em] px-3 py-1.5 border border-[var(--navy)]/20 rounded text-[var(--navy)] hover:border-[var(--navy)] hover:bg-[var(--navy)] hover:text-white transition-colors"
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
                transition={{ delay: i * 0.03, duration: 0.3, ease: 'easeOut' }}
                onClick={() => toggle(cat.id)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? 'border-[var(--navy)] bg-[var(--navy)]/5'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${
                    isSelected ? 'bg-[var(--navy)] border-[var(--navy)]' : 'border-gray-300'
                  }`}
                >
                  {isSelected && <Check size={12} className="text-[var(--gold)]" strokeWidth={3} />}
                </span>
                <Icon
                  size={18}
                  className={isSelected ? 'text-[var(--navy)]' : 'text-[var(--muted)]'}
                />
                <span
                  className={`text-[11px] font-semibold tracking-wider ${
                    isSelected ? 'text-[var(--navy)]' : 'text-[var(--muted)]'
                  }`}
                >
                  {cat.label}
                </span>
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
