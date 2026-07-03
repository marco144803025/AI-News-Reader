import type { Article } from "../../types";
import ClippingRow from "./ClippingRow";
import { LABELS } from "./copy";

const ROW_TILTS = [-0.3, 0.25, -0.2, 0.35];

export default function ClippingsList({
  articles,
  totalCount,
  now,
}: {
  articles: Article[];
  totalCount: number;
  now: number;
}) {
  return (
    <section className="mt-7">
      <div className="flex items-center gap-3">
        <h2
          className="bg-ink-press px-3 py-0.5 font-poster text-base tracking-[0.14em] text-paper-bright"
          style={{ rotate: "calc(var(--tilt-unit) * -0.8)" }}
        >
          {LABELS.clippings}
        </h2>
        <div className="h-0.5 flex-1 bg-ink-press" aria-hidden="true" />
        <span className="font-wire text-[11px] text-ink-dim">
          {totalCount} {LABELS.filed}
        </span>
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {articles.map((a, i) => (
          <ClippingRow
            key={a.url}
            article={a}
            now={now}
            tilt={ROW_TILTS[i % ROW_TILTS.length]}
          />
        ))}
      </div>
    </section>
  );
}
