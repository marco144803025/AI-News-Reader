import { useMemo } from "react";
import type { NewsData } from "../../types";
import { computeTrends, feedIssues, type TagTrend } from "../../lib/trends";
import Sparkline from "../Sparkline";
import OffsetPanel from "./OffsetPanel";
import Stamp from "./Stamp";

function Band({ label }: { label: string }) {
  return (
    <div className="mt-7 flex items-center gap-3">
      <h2
        className="bg-ink-press px-3 py-0.5 font-poster text-base tracking-[0.14em] text-paper-bright"
        style={{ rotate: "calc(var(--tilt-unit) * -0.8)" }}
      >
        {label}
      </h2>
      <div className="h-0.5 flex-1 bg-ink-press" aria-hidden="true" />
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
      className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-press-red-deep"
    >
      <div className="flex items-baseline justify-between gap-3 border-[1.5px] border-ink-press bg-paper-bright px-3 py-2 transition-colors group-hover:bg-ink-press">
        <span className="font-wire text-[11px] tracking-wide text-ink-press group-hover:text-paper-bright">
          {trend.tag}
        </span>
        <span className="font-wire text-[11px] tabular-nums text-ink-dim group-hover:text-paper/60">
          {trend.previous} → {trend.current}
          <span className="ml-2 font-medium text-press-red-deep group-hover:text-press-red-bright">
            {positive ? "+" : ""}
            {trend.delta}
          </span>
        </span>
      </div>
    </button>
  );
}

export default function PressTrends({
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
      <p className="mt-5 font-wire text-[11px] tracking-[0.08em] text-ink-dim">
        LAST 7 DAYS VS THE 7 BEFORE — PRESSED IN YOUR BROWSER, NO SERVER
      </p>

      {trends.sufficientHistory ? (
        <div className="grid gap-x-6 sm:grid-cols-2">
          <section>
            <Band label="RISING" />
            <div className="mt-2.5 flex flex-col gap-1.5">
              {trends.rising.length === 0 ? (
                <p className="font-wire text-[11px] text-ink-dim">NOTHING GAINING</p>
              ) : (
                trends.rising.map((t) => (
                  <TrendRow key={t.tag} trend={t} onOpen={onOpenTopic} />
                ))
              )}
            </div>
          </section>
          <section>
            <Band label="COOLING" />
            <div className="mt-2.5 flex flex-col gap-1.5">
              {trends.falling.length === 0 ? (
                <p className="font-wire text-[11px] text-ink-dim">NOTHING COOLING</p>
              ) : (
                trends.falling.map((t) => (
                  <TrendRow key={t.tag} trend={t} onOpen={onOpenTopic} />
                ))
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-5">
          <OffsetPanel className="p-4">
            <p className="font-wire text-[11px] leading-relaxed text-ink-dim">
              NOT ENOUGH HISTORY FOR MOMENTUM — THE ARCHIVE SPANS UNDER TWO
              WEEKS. VOLUME AND SECTIONS BELOW STILL COUNT.
            </p>
          </OffsetPanel>
        </div>
      )}

      <Band label="PRESS VOLUME" />
      <div className="mt-2.5">
        <OffsetPanel className="p-4">
          <Sparkline
            values={trends.volume.map((d) => d.count)}
            className="h-16 w-full text-press-red"
            label="Articles per day"
          />
          <p className="mt-2 font-wire text-[11px] text-ink-dim">
            {totalArticles} CLIPPINGS · {trends.volume.length} DAYS ·{" "}
            {trends.volume[0]?.date} → {trends.volume[trends.volume.length - 1]?.date}
          </p>
        </OffsetPanel>
      </div>

      <Band label="SECTIONS" />
      <div className="mt-2.5 flex flex-col gap-1.5">
        {trends.categoryShare.map((c) => (
          <div key={c.category} className="flex items-center gap-3">
            <span className="w-44 shrink-0 truncate font-wire text-[11px] uppercase tracking-wide text-ink-dim">
              {c.category}
            </span>
            <div className="h-2.5 flex-1 border border-ink-press/25 bg-paper-bright">
              <div
                className="h-full bg-ink-press"
                style={{ width: `${(c.count / maxShare) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-wire text-[11px] tabular-nums text-ink-dim">
              {c.count}
            </span>
          </div>
        ))}
      </div>

      <Band label="IN THE NEWS" />
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {trends.entities.map((e) => (
          <button
            key={e.tag}
            type="button"
            onClick={() => onOpenEntity(e.tag)}
            className="group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-press-red-deep"
          >
            <span className="inline-block border border-ink-press bg-paper-bright px-2 py-0.5 font-wire text-[11px] text-ink-press transition-colors group-hover:bg-ink-press group-hover:text-paper-bright">
              {e.tag} <span className="text-ink-dim group-hover:text-paper/60">{e.count}</span>
            </span>
          </button>
        ))}
      </div>

      <Band label="WIRE HEALTH" />
      <div className="mt-2.5">
        {issues.length === 0 ? (
          <p className="font-wire text-[11px] text-ink-dim">
            ALL {feedTotal} WIRES RUNNING CLEAN
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="font-wire text-[11px] text-ink-dim">
              {feedTotal - issues.length}/{feedTotal} WIRES HEALTHY
            </p>
            {issues.map((i) => (
              <OffsetPanel key={i.name} slab="red" className="p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-3">
                    <Stamp label="WIRE DOWN" small />
                    <span className="font-wire text-[12px] font-medium text-ink-press">
                      {i.name}
                    </span>
                  </span>
                  <span className="font-wire text-[11px] text-ink-dim">
                    {i.consecutiveFailures}× FAILED
                  </span>
                </div>
                <p className="mt-1.5 font-wire text-[11px] text-ink-dim">
                  {i.lastError ?? "UNKNOWN ERROR"}
                  {i.lastSuccess
                    ? ` · LAST SUCCESS ${i.lastSuccess.slice(0, 10)}`
                    : " · NEVER SUCCEEDED"}
                </p>
              </OffsetPanel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
