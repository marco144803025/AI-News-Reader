import type { FilterState } from "../../lib/filter";
import TapeChip from "./TapeChip";
import { LABELS } from "./copy";

const CHIP_TILTS = [-1.2, 0.8, -0.5, 1.1, -0.9, 0.6];

export default function TapeNav({
  tabs,
  counts,
  state,
  onChange,
}: {
  tabs: string[];
  counts: Map<string, number>;
  state: FilterState;
  onChange: (next: FilterState) => void;
}) {
  return (
    <nav
      aria-label="Sections"
      className="mt-5 flex flex-wrap items-start gap-x-3 gap-y-2 border-t-2 border-ink-press pt-4"
    >
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {tabs.map((cat, i) => (
          <TapeChip
            key={cat}
            active={state.category === cat}
            tilt={CHIP_TILTS[i % CHIP_TILTS.length]}
            onClick={() => onChange({ ...state, category: cat, view: undefined })}
          >
            {cat.toUpperCase()} {counts.get(cat) ?? 0}
          </TapeChip>
        ))}
      </div>
      <input
        type="search"
        placeholder={LABELS.searchPlaceholder}
        value={state.query}
        onChange={(e) => onChange({ ...state, query: e.target.value })}
        className="w-40 border-2 border-ink-press bg-paper-bright px-2.5 py-1 font-wire text-[11px] text-ink-press placeholder:text-ink-dim focus:outline-2 focus:outline-press-red-deep"
      />
    </nav>
  );
}
