import type { Article } from "../types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ArticleCard({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  const notableBorder = article.important
    ? "border border-[rgba(240,246,252,0.07)] border-l-2 border-l-ember hover:border-[rgba(240,246,252,0.15)] hover:border-l-ember"
    : "border border-[rgba(240,246,252,0.07)] hover:border-[rgba(240,246,252,0.15)]";

  return (
    <article
      className={`flex flex-col rounded bg-surface-1 transition-colors hover:bg-[#1c2128] ${notableBorder} ${
        featured ? "p-6" : "p-4"
      }`}
    >
      {/* Byline */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] text-ink-muted">
          {article.source}
          <span className="mx-1 opacity-40">·</span>
          {formatDate(article.publishedAt)}
        </span>
        {article.important && (
          <span className="shrink-0 rounded border border-[rgba(227,179,65,0.25)] bg-[rgba(227,179,65,0.08)] px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-ember">
            notable
          </span>
        )}
      </div>

      {/* Title */}
      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className={`font-semibold leading-snug text-ink hover:text-accent ${
          featured ? "text-base" : "text-sm"
        }`}
      >
        {article.title}
      </a>

      {/* Summary */}
      {article.summary && (
        <p
          className={`mt-2 flex-1 leading-relaxed text-ink-secondary ${
            featured ? "text-sm" : "text-xs"
          }`}
        >
          {article.summary}
        </p>
      )}
    </article>
  );
}
