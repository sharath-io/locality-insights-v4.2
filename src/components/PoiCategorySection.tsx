/**
 * PoiCategorySection.tsx
 * Renders one category group: icon header + grid of PoiCards.
 * Extracted from analysis.tsx.
 */

import { motion } from "framer-motion";
import { resolvePoiMeta } from "@/lib/map-styles";
import type { SelectedPoiEntry } from "@/stores/reportStore";
import { PoiCard } from "@/components/PoiCard";
import type { PoiRow } from "@/components/PoiCard";

interface PoiCategorySectionProps {
  type: string;
  items: PoiRow[];
  selectedInCategory: SelectedPoiEntry[];
  hoveredPoiId: string | undefined;
  onSelect: (poi: PoiRow) => void;
  onHover: (poi: PoiRow) => void;
  onHoverEnd: () => void;
}

export function PoiCategorySection({
  type,
  items,
  selectedInCategory,
  hoveredPoiId,
  onSelect,
  onHover,
  onHoverEnd,
}: PoiCategorySectionProps) {
  const meta = resolvePoiMeta(type);
  const Icon = meta.Icon;
  const pinnedCount = selectedInCategory.length;

  const nearestPoiId = items.length > 0 
    ? items.reduce((min, p) => p.distanceKm < min.distanceKm ? p : min, items[0]).id 
    : undefined;
    
  // Since items are pre-sorted by quality score in analysis.tsx, the first item is generally the Top Pick
  const topRatedPoiId = items.length > 0 ? items[0].id : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: `${meta.color}18`, color: meta.color }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-[14px] font-bold tracking-[0.12em] text-[var(--navy)] uppercase">
          {meta.label}
        </h3>
      </div>

      {/* Grid of cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((poi) => {
          const isSelected = selectedInCategory.some(
            (s) => s.name === poi.name && s.lat === poi.lat && s.lng === poi.lng
          );
          const isHovered = hoveredPoiId === poi.id;

          return (
            <PoiCard
              key={poi.id}
              poi={poi}
              isSelected={isSelected}
              isHovered={isHovered}
              categoryColor={meta.color}
              isNearest={poi.id === nearestPoiId}
              isTopRated={poi.id === topRatedPoiId}
              onSelect={onSelect}
              onHover={onHover}
              onHoverEnd={onHoverEnd}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
