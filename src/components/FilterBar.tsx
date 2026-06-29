import { useMemo, type ReactElement } from "react";
import type { Article, Tags } from "../types";
import { hasActiveFilters, type FilterState } from "../lib/filter";

type GroupKey = keyof Tags;

const GROUP_LABELS: Record<GroupKey, string> = {
  topics: "Topics",
  traits: "Traits",
  entities: "Entities",
};

const GROUP_STYLES: Record<
  GroupKey,
  { active: string; idle: string; orphan: string }
> = {
  topics: {
    active:
      "border-ink bg-ink text-canvas",
    idle:
      "border-[rgba(240,246,252,0.08)] bg-surface-2 text-ink-secondary hover:text-ink hover:border-[rgba(240,246,252,0.16)]",
    orphan:
      "border-dashed border-[rgba(240,246,252,0.2)] bg-transparent text-ink-secondary",
  },
  traits: {
    active:
      "border-ember bg-ember text-canvas",
    idle:
      "border-[rgba(227,179,65,0.18)] bg-[rgba(227,179,65,0.06)] text-ember hover:border-[rgba(227,179,65,0.4)]",
    orphan:
      "border-dashed border-[rgba(227,179,65,0.35)] bg-transparent text-ember",
  },
  entities: {
    active:
      "border-accent bg-accent text-canvas",
    idle:
      "border-[rgba(88,166,255,0.18)] bg-[rgba(88,166,255,0.08)] text-accent hover:border-[rgba(88,166,255,0.4)]",
    orphan:
      "border-dashed border-[rgba(88,166,255,0.35)] bg-transparent text-accent",
  },
};

function collectUniverse(
  articles: Article[],
  group: GroupKey
): string[] {
  const set = new Set<string>();
  for (const a of articles) {
    const list = a.tags?.[group];
    if (!list) continue;
    for (const t of list) set.add(t);
  }
  return [...set].sort();
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export default function FilterBar({
  scopedArticles,
  state,
  onChange,
}: {
  scopedArticles: Article[];
  state: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const universes = useMemo(
    () => ({
      topics: collectUniverse(scopedArticles, "topics"),
      traits: collectUniverse(scopedArticles, "traits"),
      entities: collectUniverse(scopedArticles, "entities"),
    }),
    [scopedArticles]
  );

  const renderGroup = (group: GroupKey) => {
    const universe = universes[group];
    const selected = state[group];
    // Selected chips that are no longer in the universe (e.g. category switch) — keep them visible so user can clear.
    const orphans = selected.filter((s) => !universe.includes(s));
    const displayed = [...universe, ...orphans];

    if (displayed.length === 0) return null;

    const styles = GROUP_STYLES[group];

    return (
      <div key={group} className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          {GROUP_LABELS[group]}
        </span>
        <div className="flex flex-wrap gap-1">
          {displayed.map((tag) => {
            const isSelected = selected.includes(tag);
            const isOrphan = isSelected && orphans.includes(tag);
            const cls = isSelected
              ? isOrphan
                ? styles.orphan
                : styles.active
              : styles.idle;
            return (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  onChange({ ...state, [group]: toggle(selected, tag) })
                }
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wide transition-colors ${cls}`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const groupsToRender = (["topics", "traits", "entities"] as GroupKey[])
    .map(renderGroup)
    .filter((node): node is ReactElement => node !== null);

  if (groupsToRender.length === 0) return null;

  const showClear = hasActiveFilters(state);

  return (
    <div className="border-b border-[rgba(240,246,252,0.06)] bg-canvas">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-3">
        {groupsToRender}
        {showClear && (
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
            className="self-start font-mono text-[10px] uppercase tracking-widest text-ink-muted transition-colors hover:text-ink"
          >
            clear filters
          </button>
        )}
      </div>
    </div>
  );
}
