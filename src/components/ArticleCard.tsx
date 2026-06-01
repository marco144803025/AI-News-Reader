import type { Article } from "../types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="flex flex-col rounded border border-[rgba(240,246,252,0.07)] bg-surface-1 p-4 transition-colors hover:border-[rgba(240,246,252,0.16)]">
      <div className="flex flex-wrap items-start gap-2">
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold leading-snug text-ink hover:text-accent"
        >
          {article.title}
        </a>
        {article.important && (
          <span className="shrink-0 rounded border border-[rgba(227,179,65,0.25)] bg-[rgba(227,179,65,0.08)] px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-ember">
            notable
          </span>
        )}
      </div>

      {article.summary && (
        <p className="mt-2 flex-1 text-xs leading-relaxed text-ink-secondary">
          {article.summary}
        </p>
      )}

      <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-ink-muted">
        <span>{article.source}</span>
        <span className="opacity-30">·</span>
        <span>{formatDate(article.publishedAt)}</span>
      </div>
    </article>
  );
}
