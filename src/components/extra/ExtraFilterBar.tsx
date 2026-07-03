import { useMemo, useState } from "react";
import type { Article, Tags } from "../../types";
import {
  collectTagUniverse,
  hasActiveFilters,
  type FilterState,
} from "../../lib/filter";
import { LABELS } from "./copy";

type GroupKey = keyof Tags;

const GROUP_LABELS: Record<GroupKey, string> = {
  topics: "TOPICS",
  traits: "TRAITS",
  entities: "ENTITIES",
};

export default function ExtraFilterBar({
  scopedArticles,
  state,
  onChange,
}: {
  scopedArticles: Article[];
  state: FilterState;
  onChange: (next: FilterState) => void;
}) {
  // Collapsed by default: with a full archive the tag universe runs to 100+
  // chips, which would bury the lead clipping. The front page leads with news.
  const [open, setOpen] = useState(false);

  const universes = useMemo(
    () => ({
      topics: collectTagUniverse(scopedArticles, "topics"),
      traits: collectTagUniverse(scopedArticles, "traits"),
      entities: collectTagUniverse(scopedArticles, "entities"),
    }),
    [scopedArticles]
  );

  const groups = (Object.keys(GROUP_LABELS) as GroupKey[])
    .map((group) => {
      const universe = universes[group];
      const selected = state[group];
      // Selected chips no longer in the universe stay visible so they can be cleared.
      const orphans = selected.filter((s) => !universe.includes(s));
      const displayed = [...universe, ...orphans];
      if (displayed.length === 0) return null;

      return (
        <div key={group} className="flex items-baseline gap-2.5">
          <span className="shrink-0 font-wire text-[11px] tracking-[0.14em] text-ink-dim">
            {GROUP_LABELS[group]}
          </span>
          <div className="flex flex-wrap gap-1">
            {displayed.map((tag) => {
              const isSelected = selected.includes(tag);
              const next = isSelected
                ? selected.filter((v) => v !== tag)
                : [...selected, tag];
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onChange({ ...state, [group]: next })}
                  className={`border px-1.5 py-0.5 font-wire text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-press-red-deep ${
                    isSelected
                      ? "border-ink-press bg-ink-press text-paper-bright"
                      : "border-ink-press/30 bg-paper-bright text-ink-dim hover:border-ink-press hover:text-ink-press"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      );
    })
    .filter((node) => node !== null);

  if (groups.length === 0) return null;

  const selectedCount =
    state.topics.length + state.traits.length + state.entities.length;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-baseline gap-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-wire text-[11px] tracking-[0.14em] text-ink-dim transition-colors hover:text-ink-press focus-visible:outline-2 focus-visible:outline-press-red-deep"
        >
          FILTERS {open ? "−" : "+"}
          {selectedCount > 0 ? ` (${selectedCount} ON)` : ""}
        </button>
        {hasActiveFilters(state) && (
          <button
            type="button"
            onClick={() =>
              onChange({
                query: "",
                category: state.category,
                topics: [],
                traits: [],
                entities: [],
              })
            }
            className="font-wire text-[11px] tracking-[0.14em] text-press-red-deep underline decoration-dotted underline-offset-4 transition-colors hover:text-ink-press focus-visible:outline-2 focus-visible:outline-press-red-deep"
          >
            {LABELS.clearFilters}
          </button>
        )}
      </div>
      {open && <div className="flex flex-col gap-1.5">{groups}</div>}
    </div>
  );
}
