import type { NewsData } from "../../types";
import { formatDateline, LABELS } from "./copy";

export default function Masthead({
  data,
  onClassic,
}: {
  data: NewsData;
  onClassic: () => void;
}) {
  const health = data.feedHealth ?? {};
  const feedNames = Object.keys(health);
  const okFeeds = feedNames.filter(
    (n) => health[n].consecutiveFailures === 0
  ).length;

  return (
    <header className="pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className="inline-block bg-press-red-deep px-2.5 py-0.5 font-wire text-[11px] tracking-[0.18em] text-paper-bright"
          style={{ rotate: "calc(var(--tilt-unit) * -2)" }}
        >
          {LABELS.extraStrip}
        </span>
        <div className="flex items-center gap-4">
          {feedNames.length > 0 && (
            <span className="font-wire text-[11px] tracking-wider text-ink-dim">
              {LABELS.wiresRunning(okFeeds, feedNames.length)}
            </span>
          )}
          <button
            type="button"
            onClick={onClassic}
            className="font-wire text-[11px] tracking-wider text-ink-dim underline decoration-dotted underline-offset-4 transition-colors hover:text-ink-press focus-visible:outline-2 focus-visible:outline-press-red-deep"
          >
            {LABELS.toClassic}
          </button>
        </div>
      </div>

      <div className="mt-4 text-center">
        <h1 className="font-poster text-5xl uppercase tracking-[0.06em] text-ink-press sm:text-6xl">
          {LABELS.masthead}
        </h1>
        <div
          className="mx-auto mt-2.5 h-1.5 w-36 bg-press-red"
          style={{ transform: "skewX(-35deg)" }}
          aria-hidden="true"
        />
        <p
          className="mt-3.5 inline-block bg-ink-press px-3.5 py-1 font-wire text-[11px] tracking-[0.12em] text-paper-bright"
          style={{ rotate: "calc(var(--tilt-unit) * -0.8)" }}
        >
          {formatDateline(data.generatedAt)} — {LABELS.clippingsFiled(data.articles.length)}
        </p>
      </div>
    </header>
  );
}
