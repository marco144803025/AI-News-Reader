import type { Article } from "../types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex flex-wrap items-start gap-2">
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="text-base font-semibold text-slate-900 hover:text-indigo-600"
        >
          {article.title}
        </a>
        {article.important && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Notable
          </span>
        )}
      </div>
      {article.summary && (
        <p className="mt-1.5 text-sm text-slate-600">{article.summary}</p>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <span className="font-medium text-slate-500">{article.source}</span>
        <span>·</span>
        <span>{formatDate(article.publishedAt)}</span>
      </div>
    </article>
  );
}
