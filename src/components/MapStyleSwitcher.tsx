import { useReportStore } from "@/stores/reportStore";
import { MAP_STYLES } from "@/styles/mapStyles";

export function MapStyleSwitcher() {
  const activeStyleId = useReportStore((s) => s.activeMapStyleId);
  const setActiveStyleId = useReportStore((s) => s.setActiveMapStyleId);

  return (
    <div className="relative group">
      <select
        id="map-style-select"
        value={activeStyleId}
        onChange={(e) => setActiveStyleId(e.target.value)}
        className="appearance-none bg-white/90 hover:bg-white border border-[#e8e2d4] text-[var(--navy)] rounded-full pl-4 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-[var(--gold)]/30 transition-all shadow-sm font-semibold text-[13px] cursor-pointer hover:shadow-md"
      >
        {MAP_STYLES.map((styleOption) => (
          <option key={styleOption.id} value={styleOption.id}>
            {styleOption.label}
          </option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--navy)]/50 group-hover:text-[var(--navy)] transition-colors">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
