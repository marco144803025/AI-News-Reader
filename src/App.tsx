import { useEffect, useMemo, useState } from "react";
import type { NewsData } from "./types";
import CategorySection from "./components/CategorySection";

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function App() {
  const [data, setData] = useState<NewsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showNotableOnly, setShowNotableOnly] = useState(false);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "news.json")
      .then((r) => {
        if (!r.ok) throw new Error("news.json not found — run `npm run ingest` first.");
        return r.json();
      })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.articles.filter((a) => {
      if (activeCategory !== "All" && a.category !== activeCategory) return false;
      if (showNotableOnly && activeCategory === "Research" && !a.important) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
      );
    });
  }, [data, query, activeCategory, showNotableOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const arr = map.get(a.category) ?? [];
      arr.push(a);
      map.set(a.category, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-bold text-slate-800">AI News Reader</h1>
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-slate-500">Loading…</div>;
  }

  const staleness = daysAgo(data.generatedAt);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">AI News Reader</h1>
          <p className="mt-1 text-sm text-slate-500">
            Last refreshed {new Date(data.generatedAt).toLocaleString()} (
            {staleness === 0 ? "today" : `${staleness} day${staleness === 1 ? "" : "s"} ago`}
            ) · {data.articles.length} articles
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search articles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
          />
          <select
            value={activeCategory}
            onChange={(e) => {
              setActiveCategory(e.target.value);
              setShowNotableOnly(false);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
          >
            <option value="All">All categories</option>
            {data.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {activeCategory === "Research" && (
            <button
              onClick={() => setShowNotableOnly((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                showNotableOnly
                  ? "border-amber-400 bg-amber-100 text-amber-800"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {showNotableOnly ? "Notable only" : "Show all"}
            </button>
          )}
        </div>

        {grouped.length === 0 ? (
          <p className="text-sm text-slate-500">No articles match your filters.</p>
        ) : (
          grouped.map(([category, articles]) => (
            <CategorySection key={category} category={category} articles={articles} />
          ))
        )}
      </div>
    </div>
  );
}
