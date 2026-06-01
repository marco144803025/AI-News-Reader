import type { Article } from "../types";
import ArticleCard from "./ArticleCard";

export default function CategorySection({
  category,
  articles,
  showHeader,
}: {
  category: string;
  articles: Article[];
  showHeader: boolean;
}) {
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
        {articles.map((a) => (
          <ArticleCard key={a.url} article={a} />
        ))}
      </div>
    </section>
  );
}
