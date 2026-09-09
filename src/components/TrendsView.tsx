import { useMemo } from "react";
import type { NewsData } from "../types";
import { computeTrends, feedIssues, type TagTrend } from "../lib/trends";
import { useLanguage } from "../hooks/useLanguage";
import { categoryLabel, tagLabel, sourceError, uiCopy, uiDay, uiNumber } from "../lib/ui";
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
  const { language } = useLanguage();
  const t = uiCopy(language);
  const label = tagLabel("topics", trend.tag, language);
  const positive = trend.delta > 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(trend.tag)}
      aria-label={t.trendLabel(label, trend.previous, trend.current)}
      className="flex w-full items-baseline justify-between gap-3 rounded border border-[rgba(240,246,252,0.07)] bg-surface-1 px-3 py-2 text-left transition-colors hover:border-[rgba(240,246,252,0.15)]"
    >
      <span className="font-mono text-xs text-ink">{label}</span>
      <span className="font-mono text-[10px] tabular-nums text-ink-muted">
        {uiNumber(trend.previous, language)} → {uiNumber(trend.current, language)}
        <span className={`ml-2 ${positive ? "text-accent" : "text-ember"}`}>
          {positive ? "+" : ""}
          {uiNumber(trend.delta, language)}
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
  const { language } = useLanguage();
  const t = uiCopy(language);
  const trends = useMemo(() => computeTrends(data.articles, now), [data, now]);
  const issues = feedIssues(data.feedHealth);
  const feedTotal = Object.keys(data.feedHealth ?? {}).length;
  const totalArticles = trends.volume.reduce((s, d) => s + d.count, 0);
  const maxShare = trends.categoryShare[0]?.count ?? 1;

  return (
    <div className="trends-content">
      <p className="mb-6 font-mono text-xs text-ink-muted">
        {t.comparison}
      </p>

      {trends.sufficientHistory ? (
        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          <section>
            <SectionHeader title={t.rising} />
            <div className="flex flex-col gap-1.5">
              {trends.rising.length === 0 ? (
                <p className="font-mono text-xs text-ink-muted">{t.noRising}</p>
              ) : (
                trends.rising.map((t) => (
                  <TrendRow key={t.tag} trend={t} onOpen={onOpenTopic} />
                ))
              )}
            </div>
          </section>
          <section>
            <SectionHeader title={t.falling} />
            <div className="flex flex-col gap-1.5">
              {trends.falling.length === 0 ? (
                <p className="font-mono text-xs text-ink-muted">{t.noFalling}</p>
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
          {t.shortHistory}
        </p>
      )}

      <section className="mb-8">
        <SectionHeader title={t.volume} />
        <div className="rounded border border-[rgba(240,246,252,0.07)] bg-surface-1 p-4">
          <Sparkline
            values={trends.volume.map((d) => d.count)}
            className="h-16 w-full text-accent"
            label={t.perDay}
          />
          <p className="mt-2 font-mono text-[10px] text-ink-muted">
            {t.volumeCount(totalArticles, trends.volume.length)} ·{" "}
            {uiDay(trends.volume[0]?.date, language)} → {uiDay(trends.volume[trends.volume.length - 1]?.date, language)}
          </p>
        </div>
      </section>

      <section className="mb-8">
        <SectionHeader title={t.categoryShare} />
        <div className="flex flex-col gap-1.5">
          {trends.categoryShare.length === 0 && <p className="font-mono text-xs text-ink-muted">{t.noCategories}</p>}
          {trends.categoryShare.map((c) => (
            <div key={categoryLabel(c.category, language)} className="flex items-center gap-3">
              <span className="w-44 shrink-0 truncate font-mono text-[10px] uppercase tracking-wide text-ink-secondary">
                {categoryLabel(c.category, language)}
              </span>
              <div className="h-2 flex-1 rounded-sm bg-surface-1">
                <div
                  className="h-2 rounded-sm bg-[rgba(88,166,255,0.45)]"
                  style={{ width: `${(c.count / maxShare) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-ink-muted">
                {uiNumber(c.count, language)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <SectionHeader title={t.inNews} />
        <div className="flex flex-wrap gap-1.5">
          {trends.entities.length === 0 && <p className="font-mono text-xs text-ink-muted">{t.noEntities}</p>}
          {trends.entities.map((e) => (
            <button
              key={e.tag}
              type="button"
              onClick={() => onOpenEntity(e.tag)}
              className="rounded border border-[rgba(88,166,255,0.18)] bg-[rgba(88,166,255,0.08)] px-2 py-1 font-mono text-[10px] tracking-wide text-accent transition-colors hover:border-[rgba(88,166,255,0.4)]"
            >
              {e.tag} <span className="opacity-60">{uiNumber(e.count, language)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <SectionHeader title={t.wireHealth} />
        {issues.length === 0 ? (
          <p className="font-mono text-xs text-ink-muted">
            {feedTotal ? t.allHealthy(feedTotal) : t.noHealth}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-xs text-ink-secondary">
              {t.healthy(feedTotal - issues.length, feedTotal)}
            </p>
            {issues.map((i) => (
              <div
                key={i.name}
                className="rounded border border-[rgba(227,179,65,0.25)] bg-[rgba(227,179,65,0.05)] p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-xs text-ember">{i.name}</span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    {t.failures(i.consecutiveFailures)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-ink-secondary">
                  {sourceError(i.lastError, language)}
                  {i.lastSuccess
                    ? ` · ${t.lastSuccess} ${uiDay(i.lastSuccess, language)}`
                    : ` · ${t.neverSucceeded}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
