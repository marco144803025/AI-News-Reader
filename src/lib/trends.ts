import type { Article, FeedHealth } from "../types";

// First UI consumer of feedHealth defines the failing bar: two consecutive
// failed runs — one failure is routine feed flakiness.
export const FAILING_THRESHOLD = 2;

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MIN_TAG_COUNT = 3;
const TOP_TAGS = 8;
const TOP_ENTITIES = 10;
export const MIN_HISTORY_DAYS = 14;

export type TagTrend = {
  tag: string;
  current: number; // last 7 days
  previous: number; // the 7 days before that
  delta: number;
};

export type DayBucket = { date: string; count: number }; // UTC yyyy-mm-dd

export type CategoryShare = { category: string; count: number };

export type EntityCount = { tag: string; count: number };

export type FeedIssue = {
  name: string;
  lastError: string | null;
  lastSuccess: string | null;
  consecutiveFailures: number;
};

export type TrendsData = {
  rising: TagTrend[];
  falling: TagTrend[];
  entities: EntityCount[]; // most mentioned, last 7 days
  volume: DayBucket[]; // continuous days, oldest → today
  categoryShare: CategoryShare[];
  sufficientHistory: boolean; // false under MIN_HISTORY_DAYS of archive
};

function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function computeTrends(articles: Article[], now: number): TrendsData {
  const currentStart = now - WEEK_MS;
  const previousStart = now - 2 * WEEK_MS;

  const currentTags = new Map<string, number>();
  const previousTags = new Map<string, number>();
  const entityCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();
  const catCounts = new Map<string, number>();
  let oldest = Infinity;

  for (const a of articles) {
    const ts = Date.parse(a.publishedAt);
    if (!Number.isFinite(ts) || ts > now) continue;
    if (ts < oldest) oldest = ts;
    bump(dayCounts, utcDay(ts));
    bump(catCounts, a.category);
    if (ts >= currentStart) {
      for (const t of a.tags?.topics ?? []) bump(currentTags, t);
      for (const e of a.tags?.entities ?? []) bump(entityCounts, e);
    } else if (ts >= previousStart) {
      for (const t of a.tags?.topics ?? []) bump(previousTags, t);
    }
  }

  const allTags = new Set([...currentTags.keys(), ...previousTags.keys()]);
  const trends: TagTrend[] = [...allTags].map((tag) => {
    const current = currentTags.get(tag) ?? 0;
    const previous = previousTags.get(tag) ?? 0;
    return { tag, current, previous, delta: current - previous };
  });

  const rising = trends
    .filter((t) => t.delta > 0 && t.current >= MIN_TAG_COUNT)
    .sort((a, b) => b.delta - a.delta || b.current - a.current || a.tag.localeCompare(b.tag))
    .slice(0, TOP_TAGS);

  const falling = trends
    .filter((t) => t.delta < 0 && t.previous >= MIN_TAG_COUNT)
    .sort((a, b) => a.delta - b.delta || b.previous - a.previous || a.tag.localeCompare(b.tag))
    .slice(0, TOP_TAGS);

  const entities = [...entityCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, TOP_ENTITIES);

  const volume: DayBucket[] = [];
  if (Number.isFinite(oldest)) {
    for (let ts = Date.parse(utcDay(oldest)); ts <= now; ts += DAY_MS) {
      const date = utcDay(ts);
      volume.push({ date, count: dayCounts.get(date) ?? 0 });
    }
  }

  const categoryShare = [...catCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  const sufficientHistory =
    Number.isFinite(oldest) && now - oldest >= MIN_HISTORY_DAYS * DAY_MS;

  return { rising, falling, entities, volume, categoryShare, sufficientHistory };
}

export function feedIssues(
  feedHealth: Record<string, FeedHealth> | undefined
): FeedIssue[] {
  if (!feedHealth) return [];
  return Object.entries(feedHealth)
    .filter(([, h]) => h.consecutiveFailures >= FAILING_THRESHOLD)
    .map(([name, h]) => ({
      name,
      lastError: h.lastError,
      lastSuccess: h.lastSuccess,
      consecutiveFailures: h.consecutiveFailures,
    }))
    .sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);
}
