/**
 * PoiCard.tsx
 * Individual POI card button with checkbox, icon, name, distance, and rating.
 * Extracted from analysis.tsx.
 */

import { motion } from "framer-motion";
import { Pin } from "lucide-react";
import { resolvePoiMeta } from "@/lib/map-styles";

export interface PoiRow {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distanceKm: number;
  minutesDrive: number;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
}

interface PoiCardProps {
  poi: PoiRow;
  /** Whether this card is currently checked/pinned */
  isSelected: boolean;
  /** Whether the mouse is hovering this row in the list (triggers ghost map marker) */
  isHovered: boolean;
  categoryColor: string;
  isNearest?: boolean;
  isTopRated?: boolean;
  onSelect: (poi: PoiRow) => void;
  onHover: (poi: PoiRow) => void;
  onHoverEnd: () => void;
}

export function PoiCard({
  poi,
  isSelected,
  isHovered,
  categoryColor,
  isNearest,
  isTopRated,
  onSelect,
  onHover,
  onHoverEnd,
}: PoiCardProps) {
  const poiMeta = resolvePoiMeta(poi.type, poi.types);
  const PoiIcon = poiMeta.Icon;

  return (
    <motion.button
      onClick={() => onSelect(poi)}
      onMouseEnter={() => onHover(poi)}
      onMouseLeave={onHoverEnd}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={`
        w-full text-left bg-white rounded-xl p-4 border transition-all duration-200
        flex items-start gap-3 cursor-pointer group relative
        ${
          isSelected
            ? "shadow-md"
            : isHovered
              ? "shadow-md border-[#d4cec5]"
              : "shadow-sm border-[#e8e2d4] hover:shadow-md hover:border-[#d4cec5]"
        }
      `}
      style={
        isSelected
          ? {
              borderColor: poiMeta.color,
              boxShadow: `0 0 0 2px ${poiMeta.color}25, 0 4px 12px ${poiMeta.color}15`,
            }
          : {}
      }
    >
      {/* Checkbox indicator */}
      <div className="shrink-0 mt-0.5 flex items-center justify-center">
        <div
          className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200"
          style={{
            borderColor: isSelected ? poiMeta.color : "#d4cec5",
            background: isSelected ? poiMeta.color : "transparent",
          }}
        >
          {isSelected && (
            <svg
              width="11"
              height="8"
              viewBox="0 0 11 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 3.5L4 6.5L10 1"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Category icon */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
        style={{
          background: isSelected ? `${poiMeta.color}20` : "#faf8f4",
          border: `1px solid ${isSelected ? poiMeta.color + "40" : "#f0ebe0"}`,
        }}
      >
        <PoiIcon className="w-4 h-4" style={{ color: poiMeta.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: categoryColor }}>
          {poiMeta.label}
        </div>
        <h4 className="text-[13px] font-semibold text-[var(--navy)] leading-tight mb-1 truncate">
          {poi.name}
        </h4>
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className="font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${categoryColor}15`, color: categoryColor }}
          >
            {poi.distanceKm.toFixed(1)} km
          </span>
          {poi.rating && poi.rating > 0 && (
            <span className="text-[#9ca3af] flex items-center gap-0.5">
              <span className="text-[10px]">★</span> {poi.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Selected badge */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-2 right-2 text-[#9ca3af] drop-shadow-sm"
        >
          <Pin className="w-4 h-4 fill-[#9ca3af]" />
        </motion.div>
      )}

      {/* Feature Badges (Bottom Right) */}
      {(isNearest || isTopRated) && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          {isTopRated && (
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest text-[#c28b00] bg-[#ffb800]/10 border border-[#ffb800]/20 flex items-center gap-1 shadow-sm">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Top Pick
            </div>
          )}
          {isNearest && (
            <div className="text-[8.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest text-[var(--navy)] bg-[var(--navy)]/5 border border-[var(--navy)]/10 flex items-center gap-1 shadow-sm">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              Nearest
            </div>
          )}
        </div>
      )}
    </motion.button>
  );
}
