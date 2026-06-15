# Smarter ingestion — Plan

**Spec:** ./spec.md
**Status:** Plan

## Approach

Three independent improvements to `ingest/ingest.ts`, one type update in `src/types.ts`,
and a `.env.example` addition. Each change is self-contained enough to be its own commit.

**Catch-up window:** `news.json` already stores `generatedAt`. When `existing` is non-null,
parse `existing.generatedAt` via `Date.parse`. If the result is not a finite number (corrupt
or missing), fall back to `effectiveDaysBack = DAYS_BACK`. Otherwise compute
`gapDays = Math.ceil((Date.now() - parsedAt) / 86400000)` and
`effectiveDaysBack = Math.min(7, Math.max(DAYS_BACK, gapDays + 1))`. When `existing` is null
(first run), short-circuit to `effectiveDaysBack = DAYS_BACK`. `effectiveDaysBack` is passed as
a parameter to `fetchFeeds` (replacing the module-level `DAYS_BACK` constant inside that function)
and written as `daysBack` in output JSON (meaning: the fetch window used in this run).

`generatedAt` is advanced to `new Date().toISOString()` when `newArticles.length > 0` where
`newArticles` are articles that passed dedup (genuinely not in the existing archive), regardless
of whether classification succeeded. Three cases:
- `rawCount === 0` (all feeds empty or failed) → do NOT advance; gap accumulates
- `rawCount > 0` but `newCount === 0` (all fetched items already in archive) → do NOT advance; gap accumulates
- `rawCount > 0` and `newCount > 0` (genuinely new items existed, even if batches were skipped) → advance

This prevents two failure modes: (a) a perpetual stall where all batches fail API calls but feeds
are healthy (without advancing, the window grows to 7 days every run); (b) masking a real gap by
advancing when only cached articles were re-fetched. When `existing` is null and no new articles,
fall back to `new Date().toISOString()`.

Known limitation: catch-up cannot recover articles that have rotated out of RSS feed item lists.
Fast-publishing feeds lose items during multi-day outages even within the 7-day window.

**Retry wrapper:** A small `withRetry<T>(fn, maxAttempts=3)` helper retries with exponential
backoff using `delays = [1000, 2000, 4000]`. Delay index is clamped:
`delays[Math.min(attempt, delays.length - 1)]` (0-based `attempt`). For transient errors, uses
the Anthropic SDK error class hierarchy:
- `instanceof Anthropic.RateLimitError` → retry; read `err.headers?.get('retry-after')` and use
  `Math.max(delays[Math.min(attempt, delays.length - 1)], parseFloat(retryAfter ?? "0") * 1000)`
- `instanceof Anthropic.InternalServerError` → retry (5xx)
- `instanceof Anthropic.APIConnectionError` → retry (network, includes timeouts)
- All other errors (including `Anthropic.AuthenticationError`) → rethrow immediately

Each batch is wrapped individually — exhausted retries logs an error and skips the batch;
rethrown auth/permanent errors propagate to `main()` which exits 1.

**Feed health:** `fetchFeeds` returns `{ articles, health }` where `health` is a
`Record<string, FeedHealth>` keyed by feed name. Inside the fetch loop, immediately after a feed
succeeds, capture `const fetchedAt = new Date().toISOString()` and store per-feed. Build the health
record by iterating every feed name in `feeds.json`, three-way branch:
1. Succeeded → `consecutiveFailures: 0`, `lastSuccess: fetchedAt` (captured at fetch time), `lastError: null`
2. Failed (threw) → `consecutiveFailures: (existing?.feedHealth?.[feed.name]?.consecutiveFailures ?? 0) + 1`, `lastError: err.message`
3. In `feeds.json` but not attempted this run → carry forward `existing?.feedHealth?.[feed.name]` unchanged (or `{ lastSuccess: null, lastError: null, consecutiveFailures: 0 }` if no prior)

All three branches must be explicit in the implementation (not relying on fallthrough or default).
Feeds removed from `feeds.json` are dropped from `feedHealth` — intentional.

Written on both zero-new-articles path and main path.

**Retention:** `RETENTION_DAYS` becomes an env-driven value defaulting to 30. The value is
validated immediately after parsing: if `NaN` or `< 1`, log a clear error and `process.exit(1)`
before reading or writing any files.

**Single source of truth for types:** `ingest/ingest.ts` currently re-declares `NewsData` at
lines 68-73, identical to `src/types.ts:12`. The duplication is unjustified — ingest runs via
`tsx` (transpile-only) and the frontend's `tsc -b` doesn't include `ingest/`, so a type-only
import has zero runtime cost and no build coupling. Replace the local declaration with
`import type { NewsData, FeedHealth } from '../src/types.ts'`. No `satisfies` guard needed
because there is no longer a second definition to drift from.

## Affected files

- `ingest/ingest.ts` — catch-up window, retry wrapper, feed health tracking, env-driven retention
- `src/types.ts` — add `FeedHealth` type, add `feedHealth` field to `NewsData`
- `.env.example` — document `RETENTION_DAYS` with default value

## Data contracts

```ts
// src/types.ts additions

export type FeedHealth = {
  lastSuccess: string | null;   // ISO timestamp of last successful fetch
  lastError: string | null;     // error message from last failure, null if none
  consecutiveFailures: number;  // resets to 0 on any success
};

// Updated NewsData — feedHealth is optional for backwards compat with old news.json
export type NewsData = {
  generatedAt: string;
  daysBack: number;             // fetch window used in this run (not next)
  categories: string[];
  articles: Article[];
  feedHealth?: Record<string, FeedHealth>;  // key = feed name
};
```

```ts
// ingest/ingest.ts — local NewsData declaration deleted; imported from src/types.ts:
import type { NewsData, FeedHealth } from '../src/types.ts';
```

## Tasks

- [ ] Add `FeedHealth` type and `feedHealth?: Record<string, FeedHealth>` to `NewsData` in `src/types.ts`; add comment to `daysBack`: "fetch window used in this run"
- [ ] Parse `RETENTION_DAYS` from env; validate `Number.isFinite && >= 1`; else `console.error` + `process.exit(1)` before any file I/O
- [ ] Add `withRetry<T>` helper: `delays = [1000, 2000, 4000]`; 0-based attempt index clamped via `Math.min(attempt, delays.length - 1)`; SDK class hierarchy for transient; `Retry-After` header on `RateLimitError` using `Math.max(delay, parseFloat(retryAfter ?? "0") * 1000)`; rethrow all non-transient immediately
- [ ] Wrap each batch's `classifyBatch` call in `withRetry`; exhausted retries → log + skip; rethrown permanent errors → propagate to `main()` which exits 1
- [ ] Catch-up: if `existing !== null`, compute `parsedAt = Date.parse(existing.generatedAt)`; if `Number.isFinite(parsedAt)`, compute `effectiveDaysBack = Math.min(7, Math.max(DAYS_BACK, Math.ceil((Date.now() - parsedAt) / 86400000) + 1))`; else `effectiveDaysBack = DAYS_BACK`; if `existing === null`, use `DAYS_BACK`
- [ ] Pass `effectiveDaysBack` as a parameter to `fetchFeeds`; replace the `DAYS_BACK` constant inside the function with this parameter for the cutoff calculation
- [ ] Delete local `NewsData` declaration at `ingest/ingest.ts:68-73`; add `import type { NewsData, FeedHealth } from '../src/types.ts'`
- [ ] Update `fetchFeeds` to return `{ articles: RawArticle[], health: Record<string, FeedHealth> }`; inside fetch loop capture `fetchedAt` at success time; build health with explicit three-way branch (succeeded / failed / not-attempted carry-forward)
- [ ] Determine `generatedAt`: count `newCount` as items passing dedup (before classification); if `newCount > 0` → `new Date().toISOString()`; else → `existing?.generatedAt ?? new Date().toISOString()`
- [ ] Write merged `feedHealth`, computed `generatedAt`, and `effectiveDaysBack` as `daysBack` in both paths (typed via the imported `NewsData`)
- [ ] Add `RETENTION_DAYS=30` to `.env.example` with a comment
- [ ] Run `npx tsc --noEmit` — confirm zero errors
- [ ] Update `specs/ROADMAP.md` F1 row to `Done` and add completion notes to `spec.md`

## Verification

- AC1 (catch-up): Set `generatedAt` 3 days ago; confirm `effectiveDaysBack=4` logged and `"daysBack": 4` in output.
- AC2 (retry — transient): Mock HTTP 500 ×2 then success → 3 attempts, succeeds. Bad API key → exit(1) after single attempt.
- AC3 (batch skip): Mock permanent error on one batch; other batches complete; output contains their articles.
- AC4 (feed health): After run, `feedHealth` has entry for each of the 10 feeds.
- AC5 (30-day default): Articles up to 30 days old are retained with no `RETENTION_DAYS` set.
- AC6 (env override): `RETENTION_DAYS=3` → only last 3 days retained.
- AC7 (NaN guard): `RETENTION_DAYS=abc` → exit(1) with clear error; `news.json` not modified.
- AC8 (zero-article feeds): All feeds empty → `generatedAt` NOT advanced; `daysBack` widens next run.
- AC9 (dedup-only): Feeds return articles, all already in archive (`newCount === 0`) → `generatedAt` NOT advanced.
- AC10 (retry-after): Mock 429 with `Retry-After: 2` header → delay ≥ 2000ms before retry.
- AC11 (batch-skip advance): Feeds return new articles (`newCount > 0`) but all classification batches fail → `generatedAt` IS advanced; next run uses `DAYS_BACK = 1`.

## Risks / tradeoffs

- **Catch-up cap at 7 days:** If CI is down for more than 7 days, older articles are still missed.
- **RSS feed depth:** Catch-up cannot recover articles rotated out of a feed's item list. Fast-publishing feeds lose items during multi-day outages even within the 7-day window. This is an inherent RSS limitation.
- **news.json size:** Extending retention from 7 to 30 days means the file could grow to ~4× its current size. Still well within GitHub Pages limits.
- **Type definition centralized:** Local `NewsData` re-declaration in `ingest/ingest.ts` removed; types imported from `src/types.ts`. Drift impossible by construction.
- **feedHealth is optional in the type:** Existing `news.json` files have no `feedHealth` field. The optional field ensures the frontend does not break on old data.
- **Feed removal drops health history:** Intentional — health object covers currently configured feeds only.
- **Fail-fast on bad env:** `RETENTION_DAYS` validation exits before any file I/O. Intentional.
