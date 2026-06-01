import { useReportStore } from "@/stores/reportStore";
import { MAP_STYLES } from "@/styles/mapStyles";

export function MapStyleSwitcher() {
  const activeStyleId = useReportStore((s) => s.activeMapStyleId);
  const setActiveStyleId = useReportStore((s) => s.setActiveMapStyleId);

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="map-style-select"
        className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium"
      >
        Map Style:
      </label>
      <select
        id="map-style-select"
        value={activeStyleId}
        onChange={(e) => setActiveStyleId(e.target.value)}
        className="text-[12px] bg-white border border-[#e8e2d4] text-[var(--navy)] rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[var(--gold)]/50 transition-shadow shadow-sm font-medium cursor-pointer"
      >
        {MAP_STYLES.map((styleOption) => (
          <option key={styleOption.id} value={styleOption.id}>
            {styleOption.label}
          </option>
        ))}
      </select>
    </div>
  );
}
