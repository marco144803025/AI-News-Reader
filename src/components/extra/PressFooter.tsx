import type { NewsData } from "../../types";
import { LABELS } from "./copy";

export default function PressFooter({
  data,
  page,
  totalPages,
  now,
  trendsActive,
  onToggleTrends,
}: {
  data: NewsData;
  page: number;
  totalPages: number;
  now: number;
  trendsActive: boolean;
  onToggleTrends: () => void;
}) {
  const health = data.feedHealth ?? {};
  const feedNames = Object.keys(health);
  const okFeeds = feedNames.filter(
    (n) => health[n].consecutiveFailures === 0
  ).length;

  let oldestTs = Infinity;
  for (const a of data.articles) {
    const ts = Date.parse(a.publishedAt);
    if (Number.isFinite(ts) && ts < oldestTs) oldestTs = ts;
  }
  const archiveDays = Number.isFinite(oldestTs)
    ? Math.max(1, Math.round((now - oldestTs) / 86_400_000))
    : 0;

  const parts: string[] = [];
  if (feedNames.length > 0) parts.push(LABELS.wiresRunning(okFeeds, feedNames.length));
  if (archiveDays > 0) parts.push(LABELS.archive(archiveDays));
  if (totalPages > 1 && !trendsActive) parts.push(LABELS.pageOf(page + 1, totalPages));
  parts.push(LABELS.curatedBy);

  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink-press pb-6 pt-3">
      <span className="font-wire text-[11px] tracking-wider text-ink-dim">
        {parts.join(" · ")}
      </span>
      <button
        type="button"
        onClick={onToggleTrends}
        className="group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-press-red-deep"
      >
        <span
          className="inline-block bg-press-red-deep px-3 py-0.5 font-poster text-sm tracking-[0.1em] text-paper-bright transition-colors group-hover:bg-ink-press"
          style={{ rotate: "calc(var(--tilt-unit) * -1.5)" }}
        >
          {trendsActive ? LABELS.frontPage : LABELS.trends}
        </span>
      </button>
    </footer>
  );
}
