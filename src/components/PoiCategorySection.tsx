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
          {type}
        </h3>
        {pinnedCount > 0 && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${meta.color}18`, color: meta.color }}
          >
            {pinnedCount} pinned
          </span>
        )}
        <div className="h-px flex-1 bg-gradient-to-r from-[#e8e2d4] to-transparent ml-2" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((poi) => {
          const isSelected = selectedInCategory.some((s) => s.id === poi.id);
          const isHovered = hoveredPoiId === poi.id;
          return (
            <PoiCard
              key={poi.id}
              poi={poi}
              isSelected={isSelected}
              isHovered={isHovered}
              categoryColor={meta.color}
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
