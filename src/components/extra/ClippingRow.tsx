import type { Article } from "../../types";
import { isFresh } from "../../lib/rank";
import { decodeEntities } from "../../lib/text";
import { formatAge, LABELS } from "./copy";

// Whole row is one link. The outer anchor stays unrotated (rectangular
// hit-area + focus ring); the inner strip carries the visual tilt and the
// full black inversion on hover.
export default function ClippingRow({
  article,
  tilt,
  now,
}: {
  article: Article;
  tilt: number;
  now: number;
}) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-press-red-deep"
    >
      <div
        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-[1.5px] border-ink-press bg-paper-bright px-3.5 py-2.5 transition-colors group-hover:bg-ink-press"
        style={tilt ? { rotate: `calc(var(--tilt-unit) * ${tilt})` } : undefined}
      >
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          {article.important ? (
            <span className="border border-press-red-deep px-1 font-poster text-[11px] tracking-[0.1em] text-press-red-deep group-hover:border-press-red-bright group-hover:text-press-red-bright">
              {LABELS.notable}
            </span>
          ) : (
            isFresh(article, now) && (
              <span className="font-wire text-[11px] font-medium tracking-wider text-press-red-deep group-hover:text-press-red-bright">
                {LABELS.fresh}
              </span>
            )
          )}
          <span className="font-wire text-[11px] tracking-wider text-ink-dim group-hover:text-paper/60">
            {article.category.toUpperCase()}
          </span>
          <span className="font-press text-[13px] font-medium uppercase tracking-[0.03em] text-ink-press group-hover:text-paper-bright">
            {decodeEntities(article.title)}
          </span>
        </span>
        <span className="ml-auto shrink-0 font-wire text-[11px] text-ink-dim group-hover:text-paper/60">
          {article.source.toUpperCase()} · {formatAge(article.publishedAt, now)}
        </span>
      </div>
    </a>
  );
}
