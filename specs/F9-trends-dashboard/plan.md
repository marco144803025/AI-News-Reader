# Trends & Pipeline Transparency — Plan

**Spec:** ./spec.md
**Status:** Build (plan approved 2026-07-02)

## Approach

Entirely client-side over the already-fetched `news.json` — no ingest changes,
no new dependencies. A new `src/lib/trends.ts` module holds pure, clock-injected
functions (`now` is a parameter, so tests use a fixed clock): tag momentum
(last 7 days vs the prior 7), articles-per-day buckets (UTC), category share,
top entities, and feed-issue extraction from the existing `feedHealth` records
(`consecutiveFailures ≥ 2` counts as failing — the first UI consumer of this
data, so the threshold is defined here as an exported constant).

The Trends view is reached from a right-aligned item in the existing tab rail
(same `ml-auto` placement pattern as the Research notable filter) and reflected
in the URL as `?view=trends` via an extension of `useUrlState`, keeping the
view shareable like every other filter state. Charts are hand-rolled SVG
components (sparkline + horizontal bars) consistent with the minimal-dependency
ethos and the dark-academic design language. Clicking a trending tag writes the
existing `?tags=` filter state and clears `view`, landing the user in the
normal filtered list.

## Affected files

- `src/lib/trends.ts` — new; pure functions + `FAILING_THRESHOLD` constant.
- `src/lib/__tests__/trends.test.ts` — new; fixed-clock unit tests.
- `src/hooks/useUrlState.ts` — add `view` param (`"trends"` | absent).
- `src/components/TrendsView.tsx` — new; momentum lists, volume chart, category share, entities list, feed-health strip.
- `src/components/Sparkline.tsx` — new; small hand-rolled SVG chart primitives (sparkline + bar row).
- `src/App.tsx` — rail item (right-aligned `TRENDS`), conditional `TrendsView` render, header warning badge when any feed is failing.
- `.interface-design/system.md` — document the trends/chart patterns.

## Data contracts

Internal TypeScript types only — `news.json` is unchanged:

```ts
// src/lib/trends.ts
export type TagTrend = { tag: string; current: number; previous: number; delta: number };
export type DayBucket = { date: string; count: number };      // UTC day, ISO yyyy-mm-dd
export type CategoryShare = { category: string; count: number };
export type FeedIssue = { name: string; lastError: string | null; consecutiveFailures: number; lastSuccess: string | null };

export type TrendsData = {
  rising: TagTrend[];        // top N by positive delta, min current count 3
  falling: TagTrend[];       // top N by negative delta
  entities: { tag: string; count: number }[]; // last 7 days, most mentioned
  volume: DayBucket[];       // full retention window
  categoryShare: CategoryShare[];
  sufficientHistory: boolean; // false when archive spans < 14 days
};
```

## Tasks

- [ ] `src/lib/trends.ts`: `computeTrends(articles, feedHealth, now)` and helpers; export `FAILING_THRESHOLD = 2`.
- [ ] Unit tests with a fixed clock: momentum windows, min-count filtering, UTC day bucketing, entity counting, feed-issue extraction, `sufficientHistory` edge (< 14 days of data).
- [ ] Extend `useUrlState` with the `view` param; selecting a category or tag clears it.
- [ ] SVG chart primitives (`Sparkline`, bar rows) in the design-system palette.
- [ ] `TrendsView` — rising/falling tag lists (clickable → `?tags=`), volume sparkline, category share bars, "in the news" entities, feed-health strip with per-feed detail on expand.
- [ ] `App.tsx` integration: right-aligned rail item, view switch, header warning badge (`N/M feeds failing`) shown only when failures exist.
- [ ] Graceful low-data state: explanatory note instead of momentum lists when `sufficientHistory` is false.
- [ ] Update `.interface-design/system.md`.

## Verification

Maps to acceptance criteria in `spec.md`:

- AC1 (rising/falling, 7d vs prior 7d): unit tests with a fixed clock and synthetic articles; visual check in `npm run dev`.
- AC2 (volume + category share): unit tests for bucketing; charts render over the live archive.
- AC3 (tag click → filtered list, shareable): click a trending tag → URL contains `?tags=…` without `view=trends`, list view shows filtered results; reload the URL to confirm restoration.
- AC4 (feed failure surfaced): hand-edit a local `news.json` feed entry to `consecutiveFailures: 3` → header badge and Trends strip appear with detail on expand.
- AC5 (healthy = unobtrusive): with all feeds healthy, no header badge; Trends shows a single quiet "all feeds healthy" line.
- AC6 (no extra requests): DevTools network tab shows only `news.json` when opening Trends.
- AC7 (low-data degradation): unit test + manual check with a truncated archive shows the explanatory note.
- `npm test` green; CI test gate passes.

## Risks / tradeoffs

- Early weeks after any retention reset have thin history — handled by `sufficientHistory` and min-count thresholds rather than showing misleading ±100% swings.
- Tag noise: free-text tags beyond the seed list could fragment counts; `normalizeTags` at ingest already canonicalizes, and the min-count filter (≥ 3) hides one-offs.
- Rail layout: on the Research tab both the notable filter and the TRENDS item want right alignment — group them in one right-aligned flex container; verify no overflow at 375px width.
- Timezone: day buckets use UTC to match `publishedAt`; the boundary may differ from the reader's local midnight — acceptable and consistent.
