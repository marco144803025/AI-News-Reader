import { useEffect, useMemo, useState } from "react";
import type { NewsData } from "./types";
import CategorySection from "./components/CategorySection";

const PAGE_SIZE = 8;
const PREVIEW_SIZE = 4;

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function App() {
  const [data, setData] = useState<NewsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showNotableOnly, setShowNotableOnly] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "news.json")
      .then((r) => {
        if (!r.ok) throw new Error("news.json not found — run `npm run ingest` first.");
        return r.json();
      })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    setPage(0);
  }, [activeCategory, query, showNotableOnly]);

  const searchFiltered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.articles;
    return data.articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
    );
  }, [data, query]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    map.set("All", searchFiltered.length);
    for (const a of searchFiltered) {
      map.set(a.category, (map.get(a.category) ?? 0) + 1);
    }
    return map;
  }, [searchFiltered]);

  const filtered = useMemo(() => {
    return searchFiltered.filter((a) => {
      if (activeCategory !== "All" && a.category !== activeCategory) return false;
      if (showNotableOnly && activeCategory === "Research" && !a.important) return false;
      return true;
    });
  }, [searchFiltered, activeCategory, showNotableOnly]);

  const inSingleView = activeCategory !== "All";
  const totalPages = inSingleView ? Math.ceil(filtered.length / PAGE_SIZE) : 0;

  const visibleFiltered = useMemo(() => {
    if (!inSingleView) return filtered;
    return filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [filtered, inSingleView, page]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof visibleFiltered>();
    for (const a of visibleFiltered) {
      const arr = map.get(a.category) ?? [];
      arr.push(a);
      map.set(a.category, arr);
    }
    return [...map.entries()];
  }, [visibleFiltered]);

  if (error) {
    return (
      <div className="min-h-screen bg-canvas p-8">
        <span className="font-mono text-sm font-bold tracking-widest text-ink">AI BRIEFING</span>
        <p className="mt-6 rounded border border-[rgba(227,179,65,0.25)] bg-[rgba(227,179,65,0.07)] p-4 font-mono text-xs text-ember">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <span className="font-mono text-xs text-ink-muted">loading briefing...</span>
      </div>
    );
  }

  const staleness = daysAgo(data.generatedAt);
  const tabs = ["All", ...data.categories];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-ink">
      {/* Top Bar */}
      <header className="flex shrink-0 items-center gap-4 border-b border-[rgba(240,246,252,0.08)] bg-surface-1 px-5 py-3">
        <div className="flex flex-1 items-baseline gap-2.5">
          <span className="font-mono text-sm font-bold tracking-widest text-ink">AI BRIEFING</span>
          <span className="hidden font-mono text-xs text-ink-muted sm:inline">// daily digest</span>
        </div>
        <input
          type="search"
          placeholder="search articles..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-[200px] rounded border border-[rgba(240,246,252,0.1)] bg-surface-2 px-3 py-1.5 font-mono text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <div className="hidden font-mono text-xs text-ink-muted sm:flex sm:items-center sm:gap-1.5">
          <span>{staleness === 0 ? "today" : `${staleness}d ago`}</span>
          <span className="opacity-30">·</span>
          <span>{data.articles.length} articles</span>
        </div>
      </header>

      {/* Tab Rail */}
      <div className="shrink-0 border-b border-[rgba(240,246,252,0.08)] bg-canvas">
        <div className="mx-auto flex max-w-5xl items-stretch overflow-x-auto px-5">
          {tabs.map((cat) => {
            const count = categoryCounts.get(cat) ?? 0;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setShowNotableOnly(false);
                }}
                className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 font-mono text-xs font-medium transition-colors ${
                  isActive
                    ? "text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:content-['']"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                {cat.toUpperCase()}
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] tabular-nums ${
                    isActive
                      ? "bg-[rgba(88,166,255,0.12)] text-accent"
                      : "bg-surface-2 text-ink-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {activeCategory === "Research" && (
            <button
              onClick={() => setShowNotableOnly((v) => !v)}
              className={`ml-auto flex shrink-0 items-center gap-1.5 px-3 py-3 font-mono text-xs transition-colors ${
                showNotableOnly ? "text-ember" : "text-ink-secondary hover:text-ink"
              }`}
            >
              <span>{showNotableOnly ? "★" : "☆"}</span>
              <span>{showNotableOnly ? "notable only" : "show all"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-5 py-6">
          {grouped.length === 0 ? (
            <p className="font-mono text-xs text-ink-muted">// no articles match</p>
          ) : (
            <>
              {grouped.map(([category, articles]) => (
                <CategorySection
                  key={category}
                  category={category}
                  articles={articles}
                  showHeader={!inSingleView}
                  featuredFirst={inSingleView}
                  limit={!inSingleView ? PREVIEW_SIZE : undefined}
                  onSeeAll={!inSingleView ? () => setActiveCategory(category) : undefined}
                />
              ))}

              {inSingleView && totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-8 border-t border-[rgba(240,246,252,0.06)] pt-8">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="font-mono text-xs text-ink-secondary transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    ← prev
                  </button>
                  <span className="font-mono text-xs tabular-nums text-ink-muted">
                    {String(page + 1).padStart(2, "0")} / {String(totalPages).padStart(2, "0")}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="font-mono text-xs text-ink-secondary transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
