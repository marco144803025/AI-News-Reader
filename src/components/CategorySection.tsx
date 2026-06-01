import type { Article } from "../types";
import ArticleCard from "./ArticleCard";

export default function CategorySection({
  category,
  articles,
  showHeader,
  featuredFirst = false,
  limit,
  onSeeAll,
}: {
  category: string;
  articles: Article[];
  showHeader: boolean;
  featuredFirst?: boolean;
  limit?: number;
  onSeeAll?: () => void;
}) {
  const displayed = limit ? articles.slice(0, limit) : articles;
  const hiddenCount = limit ? Math.max(0, articles.length - limit) : 0;

  return (
    <section className="mb-8">
      {showHeader && (
        <div className="mb-3 flex items-center gap-3 pb-2">
          <h2 className="shrink-0 font-mono text-xs font-bold uppercase tracking-widest text-ink-secondary">
            {category}
          </h2>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-ink-muted">
            {articles.length}
          </span>
          <div className="h-px flex-1 bg-[rgba(240,246,252,0.06)]" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {displayed.map((a, i) => {
          const featured = featuredFirst && i === 0;
          return (
            <div key={a.url} className={featured ? "sm:col-span-2" : ""}>
              <ArticleCard article={a} featured={featured} />
            </div>
          );
        })}
      </div>

      {onSeeAll && hiddenCount > 0 && (
        <button
          onClick={onSeeAll}
          className="mt-3 font-mono text-xs text-ink-secondary transition-colors hover:text-accent"
        >
          +{hiddenCount} more →
        </button>
      )}
    </section>
  );
}
