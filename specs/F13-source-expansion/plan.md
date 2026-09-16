## Plan: F13 source expansion and ingestion controls

**Spec:** [spec.md](./spec.md). Marco approved the rough source-expansion direction
on 2026-09-11 and explicitly requested delegation. He raised the per-run ceiling
from 50 to 100 on the same day; that scope change is recorded in the spec.

**Status:** Done — implementation, publication, normal hosted ingest and
Telegram delivery are verified in §§18–19. Hacker News (AI) remains visibly
degraded at the upstream endpoint (HTTP 429), which is accepted for this
release.

Sections 0–14 are the plan as approved. They are kept as written so a later
reader can see what was agreed before the code existed; §15 records where the
implementation departed from it and why.

**Goal:** Introduce the approved 20-feed mix with useful coverage, bounded
fetching and classification, conservative deduplication and visible attribution.

---

## 0. Decisions recorded in this plan

| Decision | Value | Source |
| --- | --- | --- |
| Feed count | 20 — eight retained, two retired, twelve added | Spec §2, Gate 1 |
| Per-run new-article ceiling | **100** (was 50) | Marco, 2026-09-11 |
| Classification batches at ceiling | 4 batches of 25; at most 16 request attempts | Derived |
| arXiv sub-cap | **unchanged at 15** | Not part of Marco's change |
| Feed workers | 4 concurrent | This plan |
| Feed collection deadline | 120 s total | This plan |
| Per-attempt feed timeout | 20 s (existing) | `ingest/feeds.ts:4` |
| Feed retries | 3 attempts, 1 s then 2 s, honour `Retry-After` ≤ 30 s | Spec §4 |
| Persistent-failure threshold | 3 consecutive failures | Spec §4 |
| Title similarity | Jaccard ≥ 0.8 and ≥ 6 shared tokens, 72 h window | Marco, 2026-09-14 |
| Hacker News endpoint | `https://hnrss.org/newest?q=AI+OR+LLM+OR+MCP` | Marco, 2026-09-14; 3/3 live probes 200 + valid XML |
| New dependencies | none | Constitution rule 11 |

---

## 1. Constitution compliance

`specs/CONSTITUTION.md` applies in full. The rules that actually bite here, and
how this plan satisfies them:

- **Rule 2 — ingest is idempotent, never destructive.** Deduplication must be
  provably re-runnable: the same input twice must not add a second copy of an
  article or a second identical `additionalSources` entry. This is asserted
  directly in the integrated fixture (§10, case P-6), not assumed.
- **Rule 3 — Node 20+, ESM only.** All new modules are ESM `.ts` with explicit
  `.js`-less relative imports matching the existing files.
- **Rule 7 — no backward compatibility.** Two places look like compatibility
  work and are not, and the distinction must be preserved by whoever implements:
  - Reading archived articles that have no `additionalSources` is **live data
    handling**, not a compatibility shim. Those ~284 records are the current
    production archive; the field is genuinely optional, not a deprecated path.
  - There is **no migration, no dual-read and no legacy branch** to write. Do not
    add a "v1 vs v2 payload" concept. One shape, with one optional field.
  Anything that starts to look like a versioned parser is out of scope; stop and
  raise it rather than building it.
- **Rule 8 — simplest implementation that meets the requirement.** The three new
  ingest modules exist because the current single-file `main` cannot be tested
  without an API key and a real file write. That is a present requirement (spec
  §7), not speculative abstraction. No plugin system, no strategy interfaces, no
  configuration beyond the two documented environment variables.
- **Rule 10 — modular components, separated concerns.** Transport, collection
  policy, selection arithmetic and orchestration are four separate modules with
  one responsibility each. Selection is pure: no clock, no network, no I/O.
- **Rules 13–16 — visible failure over silent fallback.** This is the rule that
  shapes the most decisions here:
  - A feed stopped by the collection deadline is logged as `cancelled` or
    `not-attempted` and **keeps its previous health**. It is never recorded as a
    publisher failure, because that would put a false "feeds failing" count on the
    Trends page the user reads.
  - Invalid configuration and unreadable archive JSON **fail the run** before any
    network call or write. A missing archive file is a legitimate first run; a
    corrupt one is not, and must never be treated as an empty archive.
  - A malformed `additionalSources` entry is dropped **with a logged warning**,
    and never causes an otherwise valid article to vanish.
  - `feedFailureWarningThreshold` absent from `news.json` means "not configured"
    and the UI uses 3 while logging a console warning once. The ingest side
    validates and always writes a valid number, so absence indicates stale data
    rather than normal operation. No value is silently invented.
  - Capacity-skipped articles are counted and logged every run. Silent dropping
    of 40 stories would be exactly the disguised failure rule 15 forbids.

---

## 2. Files

Paths are repository-relative. Existing paths were inspected on 2026-09-11 and
confirmed present; paths marked **new** do not exist yet.

| File | Change | Owner |
| --- | --- | --- |
| `feeds.json` | Replace with the 20 approved entries, `scope` set explicitly on general feeds (§3) | main |
| `.env.example` | Document `MAX_NEW_ARTICLES_PER_RUN=100` and `FEED_FAILURE_WARNING_THRESHOLD=3` | main |
| `.github/workflows/ingest.yml` | Pass both as non-secret repository variables with validated defaults | main |
| `package.json` | Add `"sources:preview": "tsx ingest/preview-sources.ts"`; no dependency change | main |
| `README.md` | Sources, preview command, configuration, capacity skips, dedupe limits | main |
| `src/types.ts` | `AdditionalSource`, `Article.additionalSources?`, `NewsData.feedFailureWarningThreshold?` | main |
| `ingest/lib.ts` | Extend the `Feed` type only. **Do not touch `selectBriefInput` — that is F15.** | main |
| `ingest/feeds.ts` | Optional options argument for injected fetch/signal; structured errors | feed agent |
| `ingest/feed-collection.ts` **new** | Workers, retries, deadline, counters, health outcomes | feed agent |
| `ingest/source-selection.ts` **new** | Pure relevance, canonical keys, clustering, attribution, capacity | selection agent |
| `ingest/preview-sources.ts` **new** | Read-only feed/sample preview | feed agent |
| `ingest/ingest.ts` | Extract `runIngest`; keep `classifyBatch`/`ClassifyResult` exported | main |
| `ingest/__tests__/feeds.test.ts` | Keep the real local-HTTP cleanup tests; add cancellation/retry cases | feed agent |
| `ingest/__tests__/feed-collection.test.ts` **new** | Deadline, concurrency, health, preview safety | feed agent |
| `ingest/__tests__/source-selection.test.ts` **new** | Relevance, matching, capacity properties | selection agent |
| `ingest/__tests__/pipeline.test.ts` **new** | Offline integrated run, batch count, invariants | main |
| `src/lib/news.ts` | Validate and copy optional attribution; carry the threshold | UI agent |
| `src/lib/ui.ts` | EN / zh-HK attribution and persistent-failure labels | UI agent |
| `src/lib/trends.ts` | Pure persistent-failure predicate; existing `feedIssues` unchanged | UI agent |
| `src/components/AdditionalSources.tsx` **new** | Shared localized source links | UI agent |
| `src/components/standard/DailyCover.tsx` | Attribution under both notable presentations | UI agent |
| `src/components/standard/NewsFeed.tsx` | Attribution under news rows | UI agent |
| `src/components/standard/standard.css` | Scoped wrapping/focus styles | UI agent |
| `src/components/extra/LeadClipping.tsx` | Attribution under the lead story | UI agent |
| `src/components/extra/ClippingRow.tsx` | Sibling links — **never** nested anchors | UI agent |
| `src/components/extra/extra.css` | Extra attribution/warning styles | UI agent |
| `src/components/TrendsView.tsx` | Persistent warning beside existing counts | UI agent |
| `src/components/extra/PressTrends.tsx` | Same, with localized labels | UI agent |
| `src/lib/__tests__/news.test.ts` | Optional metadata, unsafe URLs, archived records | UI agent |
| `src/lib/__tests__/ui.test.ts` | New bilingual labels | UI agent |
| `src/lib/__tests__/trends.test.ts` | Threshold behaviour, existing counts unchanged | UI agent |
| `src/lib/__tests__/attribution.test.ts` **new** | Static React rendering. **Must live in `src/lib/__tests__/`** — see §10 | UI agent |
| `specs/F13-source-expansion/spec.md` | Approvals, scope refinements | main |
| `specs/F13-source-expansion/plan.md` | Progress, reviews, verification results | main |
| `specs/ROADMAP.md` | Status and sequencing | main |

**Not touched by F13:** `ingest/backfill.ts`, `ingest/telegram*.ts`,
`ingest/deepseek.ts`, `src/lib/rank.ts`, `src/lib/filter.ts`,
`src/components/ArticleCard.tsx` (unused legacy), and every F15/F14 concern.

---

## 3. `feeds.json` — the exact target configuration

Retire `Anthropic News` (dead, 404 on six paths, 58 consecutive failures) and
`VentureBeat AI` (WAF 429 to every User-Agent including the hosted runner).
Their already-stored articles stay in the archive untouched.

```json
[
  { "name": "The Verge AI",        "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { "name": "TechCrunch AI",       "url": "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { "name": "Ars Technica AI",     "url": "https://arstechnica.com/ai/feed/" },
  { "name": "OpenAI Blog",         "url": "https://openai.com/news/rss.xml" },
  { "name": "Google DeepMind",     "url": "https://deepmind.google/blog/rss.xml" },
  { "name": "MIT Tech Review AI",  "url": "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { "name": "arXiv cs.AI",         "url": "https://rss.arxiv.org/rss/cs.AI" },
  { "name": "Hacker News (AI)",    "url": "https://hnrss.org/newest?q=AI+OR+LLM+OR+MCP" },

  { "name": "AI Business",         "url": "https://aibusiness.com/rss.xml" },
  { "name": "The Decoder",         "url": "https://the-decoder.com/feed/" },
  { "name": "The Register AI/ML",  "url": "https://www.theregister.com/software/ai_ml/headlines.atom" },
  { "name": "Hugging Face blog",   "url": "https://huggingface.co/blog/feed.xml" },
  { "name": "Guardian AI",         "url": "https://www.theguardian.com/technology/artificialintelligenceai/rss" },
  { "name": "Simon Willison",      "url": "https://simonwillison.net/atom/everything/",                          "scope": "general" },
  { "name": "GitHub blog",         "url": "https://github.blog/feed/",                                           "scope": "general" },
  { "name": "Computer Weekly",     "url": "https://www.computerweekly.com/rss/All-Computer-Weekly-content.xml",   "scope": "general" },
  { "name": "Indeed Hiring Lab",   "url": "https://www.hiringlab.org/feed/",                                     "scope": "general" },
  { "name": "Personnel Today",     "url": "https://www.personneltoday.com/feed/",                                "scope": "general" },
  { "name": "SCMP Tech",           "url": "https://www.scmp.com/rss/36/feed",                                    "scope": "general" },
  { "name": "Unwire.hk",           "url": "https://unwire.hk/feed/",                                             "scope": "general" }
]
```

**Rollout order.** Do not stage all twelve at once. Three reviewable groups, each
sampled with `npm run sources:preview` and reported to Marco before the next:

1. **Commercial / developer** — AI Business, The Decoder, The Register AI/ML,
   Hugging Face, Guardian AI, Simon Willison, GitHub blog.
2. **UK / employment** — Computer Weekly, Indeed Hiring Lab, Personnel Today.
3. **Hong Kong / Chinese-language** — SCMP Tech, Unwire.hk.

Ordering inside the file matters: it is the round-robin order when the cap binds,
so retained AI-specific feeds stay first. An addition whose sample is poor is
**reported for a decision, never silently swapped** for something else.

---

## 4. Shared contracts — frozen by the main agent before any delegation

`src/types.ts` is the single source of these shapes. `ingest/ingest.ts:71,79`
currently declares a **private `RawArticle`/`Article` that shadows
`src/types.ts:7`**. Unifying them carelessly drops `summaryZhHK`, which is the
Chinese summary for every article. Remove the local declarations and import the
shared ones; assert `summaryZhHK` survives an integrated run (§10, case P-7).

```ts
// src/types.ts — additive only
export type AdditionalSource = {
  title: string;   // the other outlet's own headline, unmodified
  url: string;     // that outlet's article URL, http(s), no credentials
  source: string;  // feed name as configured
};

export type Article = {
  // ...existing fields unchanged, including summaryZhHK?: string
  additionalSources?: AdditionalSource[];
};

export type NewsData = {
  // ...existing fields unchanged
  feedFailureWarningThreshold?: number;
};
```

```ts
// ingest/lib.ts — Feed gains one optional field
export type Feed = { name: string; url: string; scope?: "ai" | "general" };

// ingest/ingest.ts — run configuration
export type IngestConfig = {
  maxNewArticlesPerRun: number;        // default 100
  feedFailureWarningThreshold: number; // default 3
};
```

The threshold travels inside `news.json` because the browser cannot read the
offline ingest environment. `classifyBatch` and `ClassifyResult` **must stay
exported from `ingest/ingest.ts`** — `ingest/backfill.ts` imports them.

**Validation performed before any network call or write:**

- every feed has a non-empty `name`, names are unique, `scope` is absent or one
  of the two literals, `url` parses as `http:`/`https:` with no username or
  password component;
- both config numbers are positive safe integers;
- the existing archive loads and parses. **Missing file → legitimate first run.
  Present but unreadable or invalid JSON → fail the run**, because dedupe depends
  on the archive and treating it as empty would silently republish everything.

---

## 5. Feed transport and collection

### 5.1 `ingest/feeds.ts` — minimal change

Keep the existing signature and single-attempt behaviour so the current cleanup
tests keep passing:

```ts
export async function fetchFeed(
  url: string,
  timeoutMs = 20_000,
  options?: { fetchImpl?: typeof fetch; signal?: AbortSignal },
): Promise<Parser.Output<Parser.Item>>
```

On failure it throws an error carrying structured fields the caller can classify:
`{ kind: "transport" | "http" | "parse" | "aborted", status?: number,
retryAfterMs?: number }`. `fetchFeed` itself **never retries** — one attempt,
always. Retry policy lives in exactly one place (§5.2) so attempts cannot
multiply across layers.

### 5.2 `ingest/feed-collection.ts` — new

```ts
export type FeedOutcome =
  | { feed: Feed; status: "ok";            items: RawArticle[]; attempts: number }
  | { feed: Feed; status: "failed";        error: string; attempts: number }
  | { feed: Feed; status: "cancelled";     attempts: number }   // deadline hit in flight
  | { feed: Feed; status: "not-attempted" };                    // deadline hit before start

export type CollectionResult = {
  outcomes: FeedOutcome[];           // configuration order, always
  counters: Record<string, {
    fetched: number; eligible: number; excludedTopical: number;
    excludedDate: number; attempts: number;
  }>;
};

export async function collectFeeds(deps: {
  feeds: Feed[];
  now: Date;                         // frozen run clock
  fetchFeed: typeof import("./feeds.js").fetchFeed;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;  // abortable
  log: (line: string) => void;
  workers?: number;                  // default 4
  deadlineMs?: number;               // default 120_000
}): Promise<CollectionResult>
```

**Algorithm.**

1. Start a deadline timer and an `AbortController` for the whole stage.
2. Take a shared index over `feeds`; run `workers` async loops, each pulling the
   next index until the list is exhausted or the deadline fires.
3. Per feed, up to **3 attempts**:
   - call `fetchFeed(url, 20_000, { fetchImpl, signal })`;
   - on `kind: "parse"`, or HTTP 401/403/404, stop immediately — **terminal**;
   - on `kind: "transport"` or HTTP 408/429/5xx, this is transient: wait 1 s then
     2 s, or the server's `Retry-After` when valid; if the required wait exceeds
     the remaining deadline or 30 s, stop retrying this feed for this run;
   - the sleep must be abortable, and the previous response body closed or
     cancelled before the next attempt.
4. If the stage deadline fires, abort in-flight requests and launch nothing new.
   **Parent cancellation must not be classified as a retryable transport error.**
5. Map each feed to exactly one `FeedOutcome`. Health is updated **once** per feed
   per run: `ok` resets the consecutive-failure count, `failed` increments it by
   one, and `cancelled`/`not-attempted` **leave it untouched**. An empty but
   successfully parsed feed is `ok`, not a failure.
6. Results are returned in configuration order regardless of completion order.

Four workers bound network concurrency only. They do not create parallel model
requests and do not change classification batch order.

**Logging (one line per feed, plus one run summary).**

```
feed "SCMP Tech" ok attempts=1 fetched=50 eligible=6 excludedTopical=41 excludedDate=3
feed "Hacker News (AI)" ok attempts=2 (retried after transport error)
feed "Personnel Today" failed attempts=3 error=HTTP 503
feed "Unwire.hk" cancelled attempts=1 (collection deadline, health unchanged)
collection: 20 feeds, 17 ok, 1 failed, 1 cancelled, 1 not-attempted, 118s
```

### 5.3 Freshness and per-feed policy

One frozen run time drives every date decision. Apply the existing catch-up
window and the existing arXiv relevance filter and `ARXIV_CAP = 15` unchanged.
Items with a missing or unparseable date are **skipped**, never dated as now —
dating old content as new is exactly the fabrication rule 16 forbids. Items dated
in the future beyond a small clock-skew allowance are likewise skipped and counted.

### 5.4 Topical filtering for `scope: "general"` feeds

Applied to title plus the existing HTML-stripped 600-character excerpt, before
any model call. English matching is case-insensitive with word boundaries after
Unicode normalization; Chinese terms match as substrings.

Positive signals: `AI`, `artificial intelligence`, `generative AI`,
`machine learning`, `LLM`/`LLMs`, `large language model(s)`, `AI agent(s)`,
`agentic`, `Model Context Protocol`, `OpenAI`, `Anthropic`, `ChatGPT`,
`DeepSeek`, `LangChain`, `Hugging Face`, `GitHub Copilot`, `人工智能`,
`人工智慧`, `生成式AI`, `生成式 AI`, `大語言模型`, `大语言模型`, `智能代理`, `智能體`.

Insufficient alone on a general feed: bare `agent`, `jobs`, `automation`, `MCP`,
`Claude`, `Gemini`, `Copilot`. The word-boundary requirement is what stops
`email` matching `AI` — a named test case, not an incidental property.

`scope: "ai"` feeds skip this filter entirely and keep today's behaviour.

---

## 6. `ingest/source-selection.ts` — pure functions, new

No clock, no network, no filesystem. Every input is an argument.

```ts
export function isTopicallyRelevant(title: string, excerpt: string): boolean;

export function canonicalUrlKey(rawUrl: string): string;

export function normalizeTitle(title: string): string;
export function titleTokens(title: string): { words: Set<string>; numbers: Set<string>; negated: boolean };
export function titlesMatch(a: string, b: string): boolean;

export function clusterCandidates(input: {
  candidates: RawArticle[];          // post-filter, configuration order
  existing: Article[];               // the archive
  windowHours?: number;              // default 72
}): {
  newClusters: { representative: RawArticle; additional: AdditionalSource[] }[];
  existingUpdates: Article[];        // cloned, additive attribution only
  matchedExistingCount: number;
  duplicateReportCount: number;
};

export function applyCapacity(input: {
  clusters: { representative: RawArticle; additional: AdditionalSource[] }[];
  feedOrder: string[];               // feeds.json order
  limit: number;                     // 100
}): { admitted: typeof input.clusters; skipped: number };
```

**`canonicalUrlKey`** — lowercase host, drop the fragment, remove the tracking
allowlist `utm_*`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`, sort remaining query
parameters, preserve path case, preserve meaningful queries, preserve the
http/https distinction. The key is used for comparison only and **must never
appear in output URLs** — stored links stay exactly as published.

**`titlesMatch`** — both titles NFKC-normalized, case-folded, whitespace
collapsed. Then, in order:

1. Identical normalized titles of ≥ 20 characters → match.
2. Any CJK character present in either title → **exact match only**, no fuzzy
   comparison, and never across languages.
3. Otherwise English token-set comparison: Jaccard ≥ 0.8 **and** ≥ 6 shared
   tokens. Numeric and version tokens (`4o`, `v2`, `3.5`, `70B`) must form equal
   sets. Negations (`no`, `not`, `never`, `without`) are retained as tokens and a
   negated title never matches a non-negated one. No stopword removal that could
   erase the meaning of a claim.

**`clusterCandidates`** — build a lookup of every canonical key already present
in the archive, covering **both primary URLs and existing `additionalSources`
URLs**. An incoming URL already recorded as attribution must never re-enter as a
new article just because its title changed. Where several archived records match,
prefer an exact URL match, then a stable primary-URL tie-break; **never
consolidate two already-stored records**. Fuzzy title comparison happens against
primary representatives only, so weak matches cannot chain through attribution
titles. Candidates are compared to the selected representative, not to an
arbitrary cluster member. For a new cluster the representative is the earliest
published member, then configuration order, then original URL. Duplicate
attribution entries are removed by canonical key while the retained entry's
original title and link are preserved verbatim. The caller's archive object is
never mutated: `existingUpdates` are clones.

**`applyCapacity`** — bucket clusters by primary source, sort each bucket newest
first with a URL tie-break, then take one item per source per round in
configuration order until `limit` is reached. Return the skipped count. The
pre-cap new-candidate count is retained separately for the existing `generatedAt`
rule. There is no ranking signal available before classification, so this is
deliberately the only fairness rule.

---

## 7. `ingest/ingest.ts` — the injected runner

```ts
export async function runIngest(deps: {
  feeds: Feed[];                     // validated
  config: IngestConfig;              // validated
  existing: NewsData;                // already parsed
  now: Date;                         // frozen
  collect: (feeds: Feed[], now: Date) => Promise<CollectionResult>;
  classify: typeof classifyBatch;
  generateBrief: (articles: Article[]) => Promise<Brief | null>;
  log: (line: string) => void;
}): Promise<NewsData>;
```

`runIngest` performs **no filesystem writes and never constructs a model client**.
The CLI `main` alone loads `.env`, reads files, validates, builds the production
adapters, calls the runner and writes the normal output path. Keep `dotenv`
loading out of any module the test imports.

Order of operations inside the runner:

1. `collect` → outcomes and counters.
2. Topical and date filtering → candidates (counted per feed).
3. `clusterCandidates` → new clusters, existing attribution updates.
4. `applyCapacity` → admitted clusters, skipped count. Log
   `admitted=<n> capacitySkipped=<m>` **before** classification.
5. Classify admitted clusters in batches of 25 through the existing
   `classifyBatch`, preserving its retry behaviour, its fatal auth and
   invalid-response handling, and its batch ordering.
6. Merge: only successfully classified new clusters are persisted. **A batch that
   exhausts its retries must not persist an unclassified representative, and must
   not lose an existing article's independent attribution additions.**
7. Apply existing retention, then the existing brief step, `briefStatus`,
   freshness and quiet-day contracts — all unchanged.
8. Write `feedFailureWarningThreshold` into the returned `NewsData`.

### `ingest/preview-sources.ts` — read-only, new

`npm run sources:preview` fetches and parses the configured feeds, applies the
topical and date filters, and prints per-source attempted / eligible / excluded
counts with a few bounded sample titles. It constructs **no DeepSeek client**,
loads **no secrets**, and writes **nothing**. Its tests stub the transport and
make any unexpected filesystem write or model call fail the test. It is a
reachability and relevance check, not an end-to-end paid ingest.

---

## 8. Configuration wiring

`.env.example`:

```
# Maximum new canonical articles classified in one ingest run.
# Each admitted article costs one DeepSeek classification slot (batches of 25).
MAX_NEW_ARTICLES_PER_RUN=100

# Consecutive failed runs before a feed is labelled persistently failing in the UI.
FEED_FAILURE_WARNING_THRESHOLD=3
```

`.github/workflows/ingest.yml` passes both as **non-secret repository variables**
(`vars`, not `secrets`) to the ingest step only, each with the default above when
the variable is unset. Workflow timeouts and every other step stay unchanged.

---

## 9. Browser and presentation

**`src/lib/news.ts`.** `parseNewsData` currently reconstructs articles field by
field and would silently discard `additionalSources`. Explicitly validate and
copy each entry: non-empty string `title` and `source`, and a `url` accepted by
the existing `sourceUrl` guard (rejects credentials, `javascript:`, `data:` and
malformed URLs). A malformed entry is dropped with a logged warning; the article
itself still parses. Read `feedFailureWarningThreshold` when it is a positive
safe integer; otherwise treat it as unconfigured, use 3, and warn once.

**`src/components/AdditionalSources.tsx`** — one shared component, explicit
`language` and `edition` props, no implicit context:

- renders nothing when there are no valid entries;
- sits **outside** the article's primary anchor — in `ClippingRow.tsx` the extra
  links are siblings of the row link, because nested anchors are invalid HTML and
  make the click target ambiguous;
- no article click handler may intercept an attribution click;
- opens links with `rel="noreferrer"`;
- shows the other outlet's original title and source name unmodified; only the
  surrounding copy is localized. React escapes both as plain text.

Mount it in `DailyCover.tsx` (both notable presentations), `NewsFeed.tsx` rows,
and Extra's `LeadClipping.tsx` and `ClippingRow.tsx`. Do not modify the unused
legacy `ArticleCard.tsx`, and do not translate unrelated Extra chrome here.

**`src/lib/ui.ts`** — new EN and zh-HK strings for the attribution lead-in and
the persistent-failure label, matching the existing copy-contract test that
requires both languages to stay complete.

**`src/lib/trends.ts`** — add a pure persistent-failure predicate. The existing
`feedIssues` behaviour and the existing header/footer failure counts stay exactly
as they are. The threshold **adds a label**; it is not a filter that hides lesser
failures, and feeds qualifying under the configured threshold are shown even when
that threshold is lower than the legacy failure-list threshold. Nothing may be
relabelled as healthy.

---

## 10. Tests

`npm test` globs exactly `ingest/__tests__/*.test.ts` and
`src/lib/__tests__/*.test.ts`. **A test placed anywhere else does not run.** That
is why `attribution.test.ts` — a static React rendering test — lives in
`src/lib/__tests__/`. Do not "tidy" it into a components directory.

The plan's verification commands use `tsx --test`, matching `package.json`.

**`ingest/__tests__/feeds.test.ts`** (extend) — keep the existing real local-HTTP
child-process cleanup tests; add: injected fetch is used; an abort signal
propagates; structured error fields are populated for transport, HTTP and parse
failures.

**`ingest/__tests__/feed-collection.test.ts`** (new)
- C-1 transient failure then success: 2 attempts, `ok`, health reset.
- C-2 three transient failures: `failed`, health incremented **once**.
- C-3 HTTP 404 and malformed XML: terminal, exactly 1 attempt.
- C-4 `Retry-After: 60`: stops retrying rather than waiting past budget.
- C-5 deadline fires mid-flight: in-flight feed `cancelled`, unstarted feeds
  `not-attempted`, both retain previous health, nothing new launched.
- C-6 parent cancellation is not reclassified as a retryable transport error.
- C-7 outcomes are in configuration order across shuffled completion orders.
- C-8 empty parsed feed counts as `ok`.
- C-9 at most 4 concurrent in-flight requests.

**`ingest/__tests__/source-selection.test.ts`** (new)
- S-1 English and Chinese positives on a general feed; sport, weather, generic
  job posts negative; `email` does not match `AI`.
- S-2 `scope: "ai"` feeds bypass filtering.
- S-3 tracking-parameter variants share a canonical key; meaningful query IDs do not.
- S-4 path case and http/https preserved; canonical key never leaks into output.
- S-5 near-identical titles across sources merge; `4o` vs `4.1` do not; "does not
  ship" vs "ships" do not; identical Chinese titles merge; Chinese never merges
  fuzzily with English.
- S-6 incoming URL already stored as attribution does not become a new article.
- S-7 caller's archive array and objects are not mutated.
- S-8 two already-stored records are never consolidated.
- S-9 capacity: 140 candidates, limit 100 → 100 admitted, 40 skipped; uneven
  buckets still round-robin; limit 3 with 20 sources favours configuration order;
  result identical across input permutations of equal-date items.

**`ingest/__tests__/pipeline.test.ts`** (new, integrated, offline)
- P-1 **the headline case**: 140 distinct eligible candidates, cap 100 → log
  contains `admitted=100 capacitySkipped=40`, exactly **4** classifier calls of
  25 items, and **no fifth call**.
- P-2 no API key present, no filesystem write, no model client constructed.
- P-3 a batch exhausting retries persists nothing from that batch, while other
  batches and existing attribution updates survive.
- P-4 all feeds failing → zero new articles, existing archive intact, brief
  status preserved, run does not crash.
- P-5 invalid config and unreadable archive fail **before** any fetch or write.
- P-6 **idempotence (Constitution rule 2)**: the same input run twice produces
  identical output — no duplicated articles, no duplicated attribution entries.
- P-7 `summaryZhHK` survives the shared-type unification; F16 brief headlines,
  primary citation URLs, freshness and `briefStatus` unchanged.

**UI tests** — `news.test.ts`: optional metadata accepted, unsafe URLs dropped
without losing the article, archived records with no attribution unaffected,
threshold absent/invalid/valid. `ui.test.ts`: both languages complete.
`trends.test.ts`: threshold 1 / 3 / custom, existing failure counts unchanged.
`attribution.test.ts`: renders nothing when empty, links are siblings not nested,
label language correct, unsafe entries never rendered.

---

## 11. Verification

| Spec AC | Evidence required |
| --- | --- |
| 1 | Config fixture asserts the exact 20 names/URLs/scopes; retired sources' archived records still present; samples reviewed per rollout group. |
| 2 | C-1 … C-9 plus the retained local-HTTP cleanup tests. |
| 3 | S-1, S-2. |
| 4–5 | S-3 … S-8. |
| 6 | S-9 and P-1, P-6. |
| 7 | UI tests plus desktop/mobile EN and zh-HK in both builds, all four article surfaces, keyboard order, threshold 1/3/custom. |
| 8 | P-2, P-4, P-5 and preview-safety tests. |
| 9 | P-7 and the existing Telegram, backfill, brief and DeepSeek suites still passing. |

Commands, for cmd, in this checkout:

```bat
cd /d F:\project\AI-news
npx tsx --test ingest/__tests__/pipeline.test.ts
npm test
set VITE_ENABLE_EXTRA=false
npm run build
set VITE_ENABLE_EXTRA=true
npm run build
set VITE_ENABLE_EXTRA=false
npm run build
git diff --check
npm run sources:preview
```

Expected: P-1 passes with its logged values asserted; the full suite reports zero
failures against a total above the current 130; all three builds exit 0; the
final build has Extra disabled; the whitespace check exits 0; `sources:preview`
prints per-source results and samples with no key and no file modification.
**No result above is claimed until it has actually been run.**

For browser QA, generate temporary fixture copies and a temporary Vite
`publicDir` outside the tracked `public/` directory. **Never overwrite
`public/news.json` to seed a browser test.** Check long titles and many
attribution links at 320 / 375 / 768 / 1440, keyboard order, both languages, both
editions. Restore any preview or flag override afterwards, and compare
before/after hashes for the archive, delivery records and unrelated files.

After separately authorized publication, inspect a real hosted ingest/test/deploy
outcome and the resulting source, attribution and capacity logs. **Do not force a
Telegram delivery to obtain evidence.**

---

## 12. Delegation briefs

Implementation agents are Luna/max; investigations are Luna/xhigh; final
integration review is Sol/high. Every brief must state, verbatim: *"`specs/
CONSTITUTION.md` applies in full — read it before writing code."* A sub-agent
knows only what its brief carries.

File ownership is disjoint (§2) and no two agents may edit the same file. Each
brief carries: the relevant spec and plan sections, its exact allowed file list,
its test cases from §10, and the instruction to report rather than expand scope.

| Agent | Brief summary | Definition of done |
| --- | --- | --- |
| **main** | Freeze §4 contracts first. Then orchestrator, config, workflow, docs, feeds staging, integration. | Contracts merged before any delegation starts |
| **feed agent** — Luna/max | §5 only. Transport options, collection, retries, deadline, cancellation, preview command. Must not touch `feeds.json`, shared types or the orchestrator. | C-1 … C-9 plus preview-safety tests pass |
| **selection agent** — Luna/max | §6 only. Pure functions and their tests. Must not touch the orchestrator, shared types or any UI file. | S-1 … S-9 pass; no I/O imported |
| **UI agent** — Luna/max | §9 only, against the frozen contracts. Must not change the Extra default-off flag or unrelated Extra chrome. | UI tests pass; both builds pass |
| **Sol** — high | Review the combined diff and evidence: contract drift, nested anchors, health mislabelling, silent fallbacks, idempotence. | Findings resolved by main, affected checks re-run |

The main agent reviews the actual working-tree diff from each agent. A
sub-agent's claim of success is **not** evidence (AGENTS.md).

---

## 13. Ordered tasks

- [x] Inspect specs/current checkout and record rough source-direction approval.
- [x] Verify this plan's assumptions against the actual code before asking for
  Gate 2 (2026-09-11). Confirmed present as described: `fetchFeed(url, timeoutMs
  = 20_000)` at `ingest/feeds.ts:4`, `parseNewsData` at `src/lib/news.ts:40`,
  `classifyBatch` at `ingest/ingest.ts:185`, `ARXIV_CAP = 15`, `selectBriefInput`
  at `ingest/lib.ts:282`, and every `standard/` and `extra/` component in the file
  table. `feeds.json` holds 10 feeds, consistent with 8 retained + 12 additions.
  The shadowed-type risk is real: `ingest/ingest.ts:71,79` declares a private
  `RawArticle`/`Article` over `src/types.ts:7`. Both corrections found then are
  now folded into this plan (§10, §11).
- [x] Explain the plan to Marco before the gate decision (2026-09-11). He replied
  "I still don't understand, create another HTML artifact for me to explain" when
  asked to approve, so the four mechanisms, the injected-runner architecture, the
  delegation split and the limits of the approval were explained as an artifact.
- [x] Reconcile this checkout (2026-09-11). Local documentation committed as
  `625a9f5`, `origin/main` (`9e6aea8`) merged as `5678743`; `origin/main` is now
  an ancestor of local `main` and the merged tree passed 130 of 130 tests.
  `backup/pre-origin-merge-2026-09-11` preserves the pre-merge state. **A separate
  integration worktree is no longer needed for a current base.**
- [x] Record the raised ceiling and fill this plan in completely (2026-09-11), on
  Marco's instruction to detail the plan and make no code changes.
- [x] **Gate 2 — approved by Marco on 2026-09-11**: "ok now that you created the
  plan, proceed and implement it." Implementation is authorized. Publication,
  pushing and any live paid ingest remain **outside** this approval, per §12.
  **Model substitution (AGENTS.md):** Luna, Sol and Astra are not available in
  this Claude Code environment. Implementation is delegated to `general-purpose`
  sub-agents with the briefs in §12, and the integration review is performed by a
  further `general-purpose` reviewer agent against the Sol/high brief. Stated
  here rather than silently substituted.
- [x] Main freezes the §4 shared contracts and removes the shadowed `Article`.
- [x] Feed agent implements §5 with its tests. 28 tests pass.
- [x] Selection agent implements §6 with its tests. 50 tests pass.
- [x] UI agent implements §9 with its tests. 37 tests pass.
- [x] Main integrates `runIngest`, adds `pipeline.test.ts`, wires configuration
  through the CLI, workflow and `.env.example`. 10 integrated tests pass.
- [x] Main reviews source samples with `sources:preview` and stages the three
  rollout groups, recording sample date, relevant and excluded examples, and any
  unresolved source issue. See §15; Hacker News (AI) is the unresolved issue.
- [x] Run every check in §11 and record the actual output. See §15.
- [x] Sol/high reviews the combined diff and evidence; main resolves findings and
  re-runs only the affected checks. Five defects and three test gaps found and
  fixed; see §16. Suite 234 -> 245 passing.
- [x] Record readiness. Publication and the separately authorized normal hosted
  ingest are recorded in §§18–19; F13 is ready and complete.

---

## 14. Risks and tradeoffs

- Title similarity misses paraphrases and could merge closely related updates.
  Conservative thresholds, version and negation fixtures and no cross-language
  fuzzy matching bound the damage; uncertain cases are reported, not hidden.
- Keyword filtering misses implicit AI references and admits some tangential
  news. Rollout-group sampling is the mitigation, and the limitation is
  documented rather than described as semantic filtering.
- Fixed-order round-robin is reproducible but favours earlier feeds when the cap
  binds. At 100 it binds on fewer days than at 50; no starvation-free backlog is
  promised, and a skipped item can age out of the window entirely.
- A total collection deadline can interrupt or skip sources. Logs distinguish
  that from publisher failure and preserve previous health rather than inventing
  an outcome. It bounds extra RSS work inside the existing 15-minute step; it
  does not guarantee completion during an upstream outage.
- The doubled ceiling doubles the worst-case classification volume per run: four
  batches, up to sixteen request attempts. Token charges still vary and no
  monetary figure is asserted. If cost surprises appear, `MAX_NEW_ARTICLES_PER_RUN`
  is the single lever, and lowering it needs no code change.
- No live reliability claim follows from mocked tests or a single successful
  public probe.

---

## 15. Implementation record — 2026-09-11

Gate 2 was approved with "ok now that you created the plan, proceed and implement
it." Implementation followed the delegated split in §12, with `general-purpose`
sub-agents standing in for Luna and Sol (substitution recorded in §13).

### Source samples, `npm run sources:preview -- --days=3`

Run read-only against the live feeds on 2026-09-11. No API key, no model call, no
write. Columns are attempts / eligible / topically excluded / excluded by date.

**All twelve additions parse and return on-topic material.** Highlights:

- **The Chinese-language gap is closed.** Unwire.hk returned Traditional Chinese
  AI coverage ("Anthropic警告 知識工作失業率近兩成…"), and SCMP Tech returned
  China/HK AI stories (Enflame's Shanghai debut, Huawei optical modules).
- **The topical filter is doing real work on general feeds**, and the ratios look
  sane rather than indiscriminate: Computer Weekly 12 eligible / 8 excluded,
  Unwire.hk 2 / 8, Personnel Today 1 / 14, GitHub blog 1 / 1, Simon Willison 5 / 2.
- **The arXiv controls still hold:** 15 eligible (the cap) against 73 excluded by
  the existing relevance filter.
- **Indeed Hiring Lab returned 0 eligible items** in a three-day window. It is a
  weekly publisher, not a broken feed; this is why the preview command takes a
  `--days` flag. Watch it over a fortnight before judging it.

**Two findings for Marco, neither fixed by this implementation:**

1. **`Hacker News (AI)` failed with HTTP 429 on all three attempts** — one of the
   eight *retained* feeds, and the same rate-limit failure mode that got
   VentureBeat retired. The F13 retry work is what makes this visible and honest
   rather than a silent gap; it does not make hnrss serve us. The archive shows
   it already at 9 consecutive failures. **Decision needed:** retire it, replace
   the hnrss endpoint, or accept it as intermittently failing.
2. **`Guardian AI` carries non-AI items** — a Bayeux tapestry cartoon appeared in
   its AI-tagged feed. It is configured `scope: "ai"` and so bypasses the topical
   filter by design. If this recurs, switching it to `scope: "general"` is a
   one-line `feeds.json` change and needs no code.

### Verification actually run

| Check | Result |
| --- | --- |
| `npm test` | **234 pass, 0 fail** (was 130 before F13) |
| `npx tsc -b` | exit 0, no output |
| `VITE_ENABLE_EXTRA=false` build | exit 0 |
| `VITE_ENABLE_EXTRA=true` build | exit 0 |
| Final build state | Extra disabled, as required |
| `git diff --check` | clean |
| `npm run sources:preview` | 19 of 20 feeds parsed; Hacker News 429 |

Per-workstream: feed collection 28 tests, selection 50, integrated pipeline 10,
UI 37. The integrated cap case asserts the headline arithmetic directly —
140 candidates produce `admitted=100 capacitySkipped=40`, exactly four classifier
calls of 25, and no fifth.

### Browser pass

Run against a temporary fixture served from a scratchpad `publicDir`. **The real
`public/news.json` was never used to seed a test**: its hash was recorded before
and after and is unchanged at `a617c49b`. The fixture carried a 145-character
headline, articles with 5 / 3 / 1 attribution entries, and one article whose
attribution included a `javascript:` URL and an empty title.

- Attribution renders on all four surfaces, in both editions, in both languages
  (`Also reported by` / `其他來源報道`, with `lang="zh-HK"` set).
- **0 nested anchors** across 47 links; the Extra row's credits are siblings of
  the row link, as required. The only non-http href on the page is the existing
  `#standard-content` skip link.
- The two malformed entries were dropped and **both drops were logged as console
  warnings**, while the article and its one valid entry rendered — Constitution
  rule 15, disclosed rather than silent.
- No horizontal page overflow and no clipped attribution block at 320, 375, 768,
  1280 or 1440 CSS pixels.
- Both Trends views show the persistent-failure summary and per-feed labels
  ("4 個來源持續更新失敗（連續 3 次或以上）").

**Limitation, stated rather than glossed:** the browser pane was hidden for most
of the pass, and the standard edition's scroll-reveal animation does not run in a
hidden pane, so the visual screenshots of the standard edition came back blank.
The evidence above is DOM- and console-derived, which proves structure, safety and
overflow but **not** visual polish. A human look at the standard edition with real
attribution data is still worth doing before publication.

### Integration corrections made by the main agent

1. **Archive-loss bug caught before it shipped.** `clusterCandidates` returns
   `existingUpdates` containing only the archived articles that gained
   attribution. The orchestrator had assumed the full archive and concatenated
   the two lists, which would have **deleted every article not mentioned again
   that day**. It now carries the archive forward and swaps updated clones in by
   URL. Covered by pipeline case P-4.
2. **Unconfigured-service regression caught by an existing test.** Reordering
   `main()` meant the run printed "Loading existing data..." and read files before
   noticing a missing `DEEPSEEK_API_KEY`. The client is constructed first again,
   so an unconfigured run still fails with empty stdout (Constitution rule 16).
3. **`dotenv` moved out of module scope** into a dynamic import inside `main()`.
   As written, importing the orchestrator from a test read the developer's real
   `.env` and could silently change the run limits under the tests.
4. **One health rule, not two.** The inline health mapping in `runIngest` was
   replaced by `feedHealthFromOutcomes`, which the collection module already owns.
5. **Trailing-slash normalization** in `canonicalUrlKey`, and **`A.I.`** accepted
   as an AI signal. Both were reported by the selection agent as real-world gaps.

### Open product decisions — not changed, because they are Marco's

- **The 0.9 Jaccard gate is far stricter than it reads.** On set sizes, one
  substituted word scores `(n-1)/(n+1)`, which needs a **19-distinct-token**
  headline to reach 0.9; one added word needs 9. So "OpenAI launches new reasoning
  model" and "OpenAI unveils new reasoning model" will **not** merge, and in
  practice dedupe reduces to canonical-URL plus exact-title matching. That is
  consistent with the spec's "avoiding false merges takes priority", but it is far
  more conservative than the spec's prose implies. **0.8 is the value that
  tolerates one substitution on a ~9-token headline.** Left at the spec's 0.9.
- **The 20-character exact-match floor is long for Chinese**, roughly a
  40-character English headline, so short SCMP/Unwire cross-posts will not merge
  and the HK feeds get little dedupe in practice.
- **The numeric/version gate is nearly unreachable** for the same reason: `4o` vs
  `4.1` is already rejected by Jaccard. It is correct defence-in-depth, not the
  active rule.

### Out of scope, observed in passing

The Extra footer reads "N/M WIRES RUNNING" counting only feeds with zero
consecutive failures, while the Trends view reads "N/M WIRES HEALTHY" counting
feeds at or above the failure threshold, so one page can show 7/12 and 8/12 at
once. This was checked against `git diff`: **pre-existing, not introduced by
F13**, and left alone rather than widened into unrequested scope.

---

## 16. Integration review and fixes — 2026-09-11

A reviewer agent read the combined diff against the Constitution, the spec and
this plan, standing in for the Sol/high role. It confirmed the architecture, the
archive carry-forward, the health mapping, the retry classification, the
concurrency model and the capacity arithmetic as correct, and found **five
defects and three test gaps**. All are fixed below; the suite went from 234 to
**245 passing tests**, and every fix carries a regression test.

### D1 — feed item URLs were never validated *(blocking, fixed)*

`selectItems` admitted any truthy `<link>`, and both the spec ("skip items with
invalid links or unsupported URL schemes") and `canonicalUrlKey`'s own docstring
assumed collection had already done this. Nobody had. Two confirmed failure modes:

- A **relative** link (`/2026/09/story`) made `canonicalUrlKey` throw inside
  `clusterCandidates`, aborting the whole run and discarding nineteen healthy
  feeds' work over one bad item.
- A **parseable non-HTTP** link (`mailto:`, `javascript:`, `tag:`) passed every
  stage, was classified at cost, written into `news.json` as the article's
  primary URL, and committed. `parseNewsData` then rejects the **entire payload**,
  so every reader sees the error state while the ingest run reports success.
  That was the one genuinely silent failure in the change.

Fixed by `isUsableArticleUrl` in `ingest/feed-collection.ts`, applying the same
bar as `validateFeeds`: absolute http(s), no credentials. Skipped items are
counted as `malformed` and logged. Covered by a test with all five bad shapes.

### D2 — attribution grew on every re-run *(blocking, fixed)*

Constitution rule 2 and the spec both require re-runs to be harmless. Canonical
keys are not stable across runs, because only the documented tracking allowlist
is stripped and several publishers append their own varying parameters — SCMP's
RSS links carry `module=` and `pgtype=`. The same article re-seen under a changed
link was credited again each run: an "Also reported by" list growing by one entry
a day, **crediting SCMP Tech on SCMP Tech's own article**.

A worse variant: a 12-character Chinese headline fails the 20-character
exact-title floor, and CJK forbids fuzzy matching, so the same Unwire article
under a changed parameter became a **second article and a second paid
classification**. This was a regression against the pre-F13 code, which compared
on `url.split("?")[0]` and was immune.

Three fixes, all in `ingest/source-selection.ts`:

1. `isRedundantAttribution` — a source never "also reports" its own story.
2. The same outlet is not credited twice for the same normalized headline,
   whatever its link looks like today.
3. `MIN_EXACT_CJK_TITLE_LENGTH = 8`. Twenty characters of Chinese carries roughly
   the information of a forty-character English headline, so the Latin floor
   rejected ordinary Unwire and SCMP headlines. CJK titles are only ever matched
   exactly and only inside the 72-hour window, so a shorter floor is safe. This
   also answers the "20 is long for Chinese" concern raised during implementation.

### D3 — a stale or zero `Retry-After` collapsed the backoff to nothing *(fixed)*

`Retry-After: 0`, or an HTTP date already in the past, produced a delay of `0`,
and `??` does not treat `0` as absent. A 429 therefore produced three
back-to-back requests — the behaviour that got VentureBeat WAF-blocked in the
first place. Fixed in both layers: `parseRetryAfter` reports a non-positive delay
as absent, as its own comment always claimed, and `feed-collection` only lets a
strictly positive value override its own 1s/2s schedule.

### D4 — a total collection failure looked like a quiet day *(fixed)*

A cancelled feed correctly keeps its previous health, but nothing recorded that a
feed was never attempted. If the deadline cut off *every* feed — two hard-failing
feeds on one worker already cost 126 s of a 120 s budget — the run produced zero
new articles, frozen health, "20/20 wires healthy" on Trends, and a brief
regenerated from the archive with `briefStatus: "generated"`. Telegram would
deliver a normal-looking brief. That is rule 15's silent failure in disguise, and
it is the same class of bug as the 2026-09-07 F11 incident.

`runIngest` now **fails the run** when every feed stalled, and warns naming the
feeds when only some did. A payload field exposing stalled feeds to the UI is a
reasonable follow-up but was not added here.

### D5 — a silent catch in the archive index *(fixed)*

`archiveKey` swallowed a parse failure with a bare `catch`, silently dropping a
stored link from the dedupe index. It now warns, matching the UI-side behaviour.

### Test gaps found and closed

- **T1:** `pipeline.test.ts` P-6's attribution assertion was **vacuous**. Its
  fixture titles each carry a unique numeric token, so no two candidates could
  ever match and every article had `additionalSources === undefined` — the
  assertion compared an empty set to an empty array. The property the feature
  cares most about was untested at pipeline level. **P-6b** now drives a real
  cross-source merge through `runIngest` twice and asserts attribution does not
  grow, no duplicate card appears and no second classification is made.
- **T2:** P-3 ran with an empty archive, so "existing attribution survives a
  failed batch" was unasserted. **P-3b** covers it.
- **T3:** P-2 was named "constructs no model client and writes nothing" but
  asserted neither. It now snapshots size and mtime of `public/news.json`,
  `feeds.json` and `.delivery/telegram.json` around the call.

### Accepted without change, confirmed by the reviewer

- The **0.9 Jaccard gate** arithmetic was independently re-derived and matches:
  one substitution needs 19 distinct tokens, one addition needs 9. Dedupe is
  effectively canonical-URL plus exact-title. Left at the spec's value — but D2
  showed the conservatism has an **idempotence** cost as well as a missed-merge
  cost, which is new input for Marco's decision on lowering it to 0.8.
- The **footer vs Trends wire counts** were re-checked: at the default threshold
  of 3, `feedWarnings` returns exactly the same set as `feedIssues`, so F13 does
  not change those numbers at all. Pre-existing, correctly left alone.

### Known minor items, not acted on

- `runIngest` never reads `collection.counters`; only the preview command does.
- `preview-sources.ts` reads `feeds.json` without `validateFeeds`, so the preview
  would accept a config the real run rejects.
- Two cosmetic false positives in the topical filter: "Ai Weiwei opens
  exhibition" matches `\bai\b`, and "Mail: a. I. think so" matches the punctuated
  form. Neither is worth a narrower rule.
- README says the "first" feed becomes the article; it is the earliest *published*.

### Final verification after the fixes

| Check | Result |
| --- | --- |
| `npm test` | **246 pass, 0 fail** |
| `npx tsc -b` | exit 0 |
| Both `VITE_ENABLE_EXTRA` builds | exit 0, final state Extra off |
| `git diff --check` | clean |

## 17. Decision closure — 2026-09-14

Marco selected **Jaccard ≥ 0.8** for English title matching. The source
selection implementation now uses that threshold and the test suite includes a
one-word substitution that passes exactly at 0.8 while retaining the existing
shared-token, numeric/version and negation safeguards.

The requested Hacker News endpoint change was attempted before publication.
`https://hnrss.org/newest?q=AI+OR+LLM+OR+MCP` returned HTTP 200 and valid XML on
three consecutive read-only probes, so it replaced the previous
`&points=50` URL in `feeds.json`. Because the attempt succeeded, the fallback
decision to accept the old endpoint was not used. Hosted Actions reachability
remains a publication verification step.

## 18. Publication evidence — 2026-09-14

The rebased `main` branch was pushed as commit `3633042`. The exact GitHub
Actions runs triggered by that push both completed successfully:

| Run | Result |
| --- | --- |
| [Build & Deploy #22](https://github.com/marco144803025/AI-News-Reader/actions/runs/34858230250) | success |
| [Test #18](https://github.com/marco144803025/AI-News-Reader/actions/runs/34858230253) | success |

The deployed site was checked read-only at
`https://marco144803025.github.io/AI-News-Reader/`: the page returned HTTP 200,
`news.json` returned HTTP 200, and the payload parsed with 291 articles,
`briefStatus: "generated"`, and a Hacker News health record. A normal
`Daily Ingest & Deploy` dispatch was not performed in this publication step,
because it can spend on DeepSeek and may send the personal Telegram brief; the
hosted feed-collection and delivery path therefore remain unclaimed by this
evidence.

## 19. Hosted ingest verification — 2026-09-16

Marco authorized the normal paid workflow dispatch with the retry-only option
disabled. [Daily Ingest & Deploy #131](https://github.com/marco144803025/AI-News-Reader/actions/runs/35141543267)
ran from `main` commit `589aeef9` and completed successfully from 19:36:11Z to
19:37:24Z. The single `ingest-and-deploy` job passed every step: checkout,
Node setup, dependency installation, the 246-test suite, Telegram
configuration check, ingest, generated-data commit, build, Pages deployment and
Telegram delivery. The workflow created commit `9501a264` (`chore: daily news
refresh`).

The deployed payload returned HTTP 200 with 496 articles,
`generatedAt: 2026-09-16T19:36:34.916Z`, and `briefStatus: "generated"`. Its
20-feed health record had 18 feeds with zero consecutive failures. The two
visible failures were Hacker News (AI), two consecutive HTTP 429s, and
Personnel Today, three consecutive HTTP 403s. The changed HN endpoint was
therefore tested in the real hosted path and then accepted as externally rate
limited; no silent fallback or second endpoint change was introduced.
