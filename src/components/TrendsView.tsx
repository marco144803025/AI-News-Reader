import { useMemo } from "react";
import type { NewsData } from "../types";
import { computeTrends, feedIssues, type TagTrend } from "../lib/trends";
import Sparkline from "./Sparkline";

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3 pb-2">
      <h2 className="shrink-0 font-mono text-xs font-bold uppercase tracking-widest text-ink-secondary">
        {title}
      </h2>
      <div className="h-px flex-1 bg-[rgba(240,246,252,0.06)]" />
    </div>
  );
}

function TrendRow({
  trend,
  onOpen,
}: {
  trend: TagTrend;
  onOpen: (tag: string) => void;
}) {
  const positive = trend.delta > 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(trend.tag)}
      className="flex w-full items-baseline justify-between gap-3 rounded border border-[rgba(240,246,252,0.07)] bg-surface-1 px-3 py-2 text-left transition-colors hover:border-[rgba(240,246,252,0.15)]"
    >
      <span className="font-mono text-xs text-ink">{trend.tag}</span>
      <span className="font-mono text-[10px] tabular-nums text-ink-muted">
        {trend.previous} → {trend.current}
        <span className={`ml-2 ${positive ? "text-accent" : "text-ember"}`}>
          {positive ? "+" : ""}
          {trend.delta}
        </span>
      </span>
    </button>
  );
}

export default function TrendsView({
  data,
  now,
  onOpenTopic,
  onOpenEntity,
}: {
  data: NewsData;
  now: number;
  onOpenTopic: (tag: string) => void;
  onOpenEntity: (tag: string) => void;
}) {
  const trends = useMemo(() => computeTrends(data.articles, now), [data, now]);
  const issues = feedIssues(data.feedHealth);
  const feedTotal = Object.keys(data.feedHealth ?? {}).length;
  const totalArticles = trends.volume.reduce((s, d) => s + d.count, 0);
  const maxShare = trends.categoryShare[0]?.count ?? 1;

  return (
    <div>
      <p className="mb-6 font-mono text-xs text-ink-muted">
        {"// trends — last 7 days vs the 7 before · computed in your browser"}
      </p>

      {trends.sufficientHistory ? (
        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          <section>
            <SectionHeader title="rising" />
            <div className="flex flex-col gap-1.5">
              {trends.rising.length === 0 ? (
                <p className="font-mono text-xs text-ink-muted">nothing gaining momentum</p>
              ) : (
                trends.rising.map((t) => (
                  <TrendRow key={t.tag} trend={t} onOpen={onOpenTopic} />
                ))
              )}
            </div>
          </section>
          <section>
            <SectionHeader title="falling" />
            <div className="flex flex-col gap-1.5">
              {trends.falling.length === 0 ? (
                <p className="font-mono text-xs text-ink-muted">nothing cooling off</p>
              ) : (
                trends.falling.map((t) => (
                  <TrendRow key={t.tag} trend={t} onOpen={onOpenTopic} />
                ))
              )}
            </div>
          </section>
        </div>
      ) : (
        <p className="mb-8 rounded border border-[rgba(240,246,252,0.07)] bg-surface-1 p-4 font-mono text-xs text-ink-secondary">
          not enough history for momentum yet — the archive spans under two
          weeks, so week-over-week comparisons would mislead. volume and
          category share below still reflect what's here.
        </p>
      )}

      <section className="mb-8">
        <SectionHeader title="volume" />
        <div className="rounded border border-[rgba(240,246,252,0.07)] bg-surface-1 p-4">
          <Sparkline
            values={trends.volume.map((d) => d.count)}
            className="h-16 w-full text-accent"
            label="Articles per day"
          />
          <p className="mt-2 font-mono text-[10px] text-ink-muted">
            {totalArticles} articles · {trends.volume.length} days ·{" "}
            {trends.volume[0]?.date} → {trends.volume[trends.volume.length - 1]?.date}
          </p>
        </div>
      </section>

      <section className="mb-8">
        <SectionHeader title="category share" />
        <div className="flex flex-col gap-1.5">
          {trends.categoryShare.map((c) => (
            <div key={c.category} className="flex items-center gap-3">
              <span className="w-44 shrink-0 truncate font-mono text-[10px] uppercase tracking-wide text-ink-secondary">
                {c.category}
              </span>
              <div className="h-2 flex-1 rounded-sm bg-surface-1">
                <div
                  className="h-2 rounded-sm bg-[rgba(88,166,255,0.45)]"
                  style={{ width: `${(c.count / maxShare) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-ink-muted">
                {c.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <SectionHeader title="in the news — 7 days" />
        <div className="flex flex-wrap gap-1.5">
          {trends.entities.map((e) => (
            <button
              key={e.tag}
              type="button"
              onClick={() => onOpenEntity(e.tag)}
              className="rounded border border-[rgba(88,166,255,0.18)] bg-[rgba(88,166,255,0.08)] px-2 py-1 font-mono text-[10px] tracking-wide text-accent transition-colors hover:border-[rgba(88,166,255,0.4)]"
            >
              {e.tag} <span className="opacity-60">{e.count}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <SectionHeader title="wire health" />
        {issues.length === 0 ? (
          <p className="font-mono text-xs text-ink-muted">
            all {feedTotal} feeds healthy
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-xs text-ink-secondary">
              {feedTotal - issues.length}/{feedTotal} feeds healthy
            </p>
            {issues.map((i) => (
              <div
                key={i.name}
                className="rounded border border-[rgba(227,179,65,0.25)] bg-[rgba(227,179,65,0.05)] p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-xs text-ember">{i.name}</span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    {i.consecutiveFailures} consecutive failures
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-ink-secondary">
                  {i.lastError ?? "unknown error"}
                  {i.lastSuccess
                    ? ` · last success ${i.lastSuccess.slice(0, 10)}`
                    : " · never succeeded"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
