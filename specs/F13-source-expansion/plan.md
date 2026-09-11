## Plan: F13 source expansion and ingestion controls

**Spec:** [spec.md](./spec.md). Marco approved the rough source-expansion direction
on 2026-09-11 and explicitly requested delegation.
**Status:** Plan — Gate 2 pending; no implementation has started.

**Goal:** Introduce the approved 20-feed mix with useful coverage, bounded fetching
and classification, conservative deduplication and visible attribution.

**Files:** Paths are repository-relative. Existing paths were inspected during
planning; paths marked **new** are proposed files, not files already present.

| File | Change / owner |
| --- | --- |
| `feeds.json` | Approved eight retained plus twelve additions, explicit general-feed scope; main agent stages groups after sample review. |
| `.env.example` | Document the article cap and persistent-failure threshold; main agent. |
| `.github/workflows/ingest.yml` | Pass non-secret repository variables for both settings with validated defaults; main agent. |
| `package.json` | Add the read-only `sources:preview` command, no dependency changes; main agent. |
| `README.md` | Explain sources, preview, configuration, skipped capacity and dedupe limitations; main agent. |
| `src/types.ts` | Shared raw article/source-attribution types and optional threshold metadata; main agent freezes interfaces before delegation. |
| `ingest/lib.ts` | Extend Feed configuration type only; preserve brief selection and model retries; main agent. |
| `ingest/feeds.ts` | Injectable single-attempt transport, structured errors and cancellation, preserving the existing function call; feed agent. |
| `ingest/feed-collection.ts` **new** | Four-worker collection, bounded retries/global deadline, validation/filter counters and health outcomes; feed agent. |
| `ingest/source-selection.ts` **new** | Pure config, relevance, canonical-key, clustering, attribution and capacity functions; selection agent. |
| `ingest/preview-sources.ts` **new** | Read-only feed/sample preview, no model/client/archive writes; feed agent. |
| `ingest/ingest.ts` | Integrate collection/selection through injectable runIngest, retain classifyBatch/backfill exports; main agent. |
| `ingest/__tests__/feeds.test.ts` | Retain real local-HTTP child-process cleanup tests; extend cancellation/retry coverage; feed agent. |
| `ingest/__tests__/feed-collection.test.ts` **new** | Deadline, concurrency, health and preview safety fixtures; feed agent. |
| `ingest/__tests__/source-selection.test.ts` **new** | Relevance, URL/title matching, archive metadata and cap properties; selection agent. |
| `ingest/__tests__/pipeline.test.ts` **new** | Offline integrated run, batch count, archive/brief invariants, fatal paths; main agent. |
| `src/lib/news.ts` | Normalize optional attribution safely and retain threshold; UI agent. |
| `src/lib/ui.ts` | EN/zh-HK attribution and persistent-failure labels; UI agent. |
| `src/lib/trends.ts` | Pure persistent-failure predicate while preserving existing feedIssues behavior; UI agent. |
| `src/components/AdditionalSources.tsx` **new** | Shared safe, localized source links, explicit language and edition props; UI agent. |
| `src/components/standard/DailyCover.tsx` | Attribution under both notable-story presentations; UI agent. |
| `src/components/standard/NewsFeed.tsx` | Attribution under news rows; UI agent. |
| `src/components/standard/standard.css` | Scoped wrapping/focus styles for attribution and health warning; UI agent. |
| `src/components/extra/LeadClipping.tsx` | Attribution under lead story; UI agent. |
| `src/components/extra/ClippingRow.tsx` | Keep primary row link and place extra source links as siblings, never nested anchors; UI agent. |
| `src/components/extra/extra.css` | Extra-edition attribution/warning styles; UI agent. |
| `src/components/TrendsView.tsx` | Display configurable persistent warning alongside existing health counts; UI agent. |
| `src/components/extra/PressTrends.tsx` | Same persistent-warning/count behavior and localized new labels; UI agent. |
| `src/lib/__tests__/news.test.ts` | Optional metadata, unsafe URLs and legacy payload parsing; UI agent. |
| `src/lib/__tests__/ui.test.ts` | New bilingual labels; UI agent. |
| `src/lib/__tests__/trends.test.ts` | Persistent threshold behavior without changing existing failure counts; UI agent. |
| `src/lib/__tests__/attribution.test.ts` **new** | Static React rendering: safe sibling links, label language, empty state; UI agent. |
| `specs/F13-source-expansion/spec.md` | Approvals and scope refinements; main agent. |
| `specs/F13-source-expansion/plan.md` | Work progress, reviews and verification; main agent. |
| `specs/ROADMAP.md` | Status and cross-feature sequencing; main agent. |

**Approach:**

1. Record Gate 2 approval, freeze shared interfaces and establish a current,
   isolated integration checkout while preserving all existing local work.
2. Implement pure relevance/deduplication/cap functions and bounded feed fetching
   in independent Luna/max tasks; use mocks and local fixtures for verification.
3. Integrate an injectable ingestion runner so the complete pipeline can be
   exercised without an API key, real archive writes or Telegram delivery.
4. Add safe attribution and persistent-health warnings in both layouts through
   one focused UI agent; preserve standard/Extra flag and language contracts.
5. Review source samples with the read-only preview, then add the approved
   commercial/developer, UK/employment and HK groups in reviewable changes.
6. Run the full offline suite, both build configurations and fixture-based browser
   checks; send combined results/diff to Sol/high for integration review, resolve
   findings, and record status. Publication is a separate action.

**New dependencies:** None. Use existing rss-parser, node:test, React/ReactDOM,
tsx, TypeScript and Vite; no DOM-testing library or model-based dedupe service.

**Assumptions I'm making:**

- The rough-plan approval covers the source mix and control objectives. Gate 2
  reviews the specific APIs, comparison thresholds, deadline and metadata below.
- F16's zoom check remains open. Planning F13 does not mark F16 complete. Before
  implementing, record whether Gate 2 authorizes F13 as an independent workstream
  or F16 is closed; do not silently change the earlier ordered feature sequence.
- The 50-article ceiling bounds new canonical input per run, not daily money or
  a guaranteed delivery backlog. A skipped item can age out before another run.
- Existing source ranking/brief selection is unchanged; preclassification source
  round-robin only controls which new items receive classification.
- Historical duplicate records stay intact. Incoming matches may add attribution
  to an existing record, but may not replace its primary URL/content.
- Source sample quality is assessed before activation; an unsuitable approved
  source is reported for a choice, not silently substituted by an agent.

**What I will NOT do:** Change F15's brief selector, F14 licensing/snippet policy,
models, stored primary content, archive retention, Telegram state or Extra's
default-off flag. No live paid ingest, backfill, workflow dispatch, commit/push or
deployment is included in Gate 2 implementation. No edits to AGENTS.md or unrelated
working changes are included.

**How we'll verify it works:** The exact commands and scenario matrix below use
offline fixtures; expected results are not claimed passes until executed.

## Architecture and data contracts

### Shared boundary, owned by the main agent

Keep `classifyBatch` and `ClassifyResult` exported from `ingest/ingest.ts` so
`ingest/backfill.ts` continues to import them. Define `RawArticle` centrally as
the existing title/url/source/publishedAt/snippet fields plus optional
`additionalSources`; `Article` extends it with existing classification fields.
Do not lose `summaryZhHK` through the older local duplicate Article declaration.

```ts
type AdditionalSource = { title: string; url: string; source: string };
type Feed = { name: string; url: string; scope?: "ai" | "general" };
type IngestConfig = {
  maxNewArticlesPerRun: number;           // default 50
  feedFailureWarningThreshold: number;   // default 3
};
// Additive optional properties only:
// Article.additionalSources?: AdditionalSource[]
// NewsData.feedFailureWarningThreshold?: number
```

The warning threshold travels in news.json because a browser cannot read the
offline ingest environment. Legacy/malformed optional threshold values fall back
to 3 at the browser boundary. The existing feedIssues rule for currently failing
feeds and header/footer counts is preserved. The configured threshold adds a
persistent-failure label, not a filter hiding lesser failures. The UI additionally
shows threshold-qualified feeds even if a configured threshold is lower than the
legacy failure-list threshold; do not mislabel other feeds as newly healthy.

Validate non-empty feed names, unique names, scope, positive safe-integer config
and HTTP(S) URLs without username/password before fetching or writing. Load and
validate the existing archive before any network call; a missing file can mean
first run, but invalid JSON/unreadable data must fail rather than silently become
an empty archive. This is required to preserve data when dedupe depends on it.

### Feed collection and timing

Preserve `fetchFeed(url, timeoutMs = 20000)` compatibility with the existing
cleanup tests and its single-attempt behavior; add an optional options argument
for fetch/signal and structured error information retaining status/Retry-After.
Only feed-collection owns retries, injected sleep/clock and reporting. It makes
at most three attempts for transient HTTP/transport failures, delays 1s then 2s
(honoring Retry-After as in the spec), closes/cancels bodies before retry and
makes malformed XML/non-transient statuses terminal. Parent cancellation must
not become a retryable transport error; retries must not multiply across layers.

Use four asynchronous workers and a **120-second total feed-collection deadline**.
Each attempt observes both its 20-second timeout and the collection deadline;
sleep is abortable. On deadline, cancel in-flight requests and stop launching
new work. Preserve deterministic results in configuration order regardless of
completion order. Four workers limit network concurrency; they do not introduce
parallel model requests or change classification batch order.

Feeds stopped solely by the global deadline, whether in flight or not yet
attempted, retain their previous health and are explicitly logged as cancelled
or not attempted. They are not publisher failures. Completed retry exhaustion
or terminal HTTP/XML failure increments health once; empty parsed feeds count
as success. Completed results before cancellation retain their genuine outcomes.
The deadline limits extra RSS work within the existing 15-minute ingest step;
it does not guarantee completion during model outages. Keep workflow timeouts
unchanged and exercise cancellation/process-exit tests rather than assuming
resolved promises mean every socket is closed.

One frozen run time drives freshness/date filtering. Apply the existing catch-up
window and arXiv controls plus the spec's invalid-date and general-feed policies.
Return candidates, per-feed counters and health once, without classifying anything.

### Matching, stable attribution and selection

Implement the URL/title comparisons in spec section 4 as pure functions. Explicit
rules to pin in fixtures: NFKC/case/whitespace title normalization; English tokens
retain negations and model/version numbers; no stopword deletion that erases claim
meaning; Jaccard >= 0.9 with six shared tokens; equal numeric/version-token sets;
72-hour distinct-URL time window; exact Chinese title matching only. Preserve
meaningful query parameters and path case. Never put normalized keys in output URLs.

Build a lookup of both primary and existing additional-source canonical URLs.
An incoming URL already present as attribution must never reappear as a new article
when its title changes. If multiple archived records match, prefer an exact URL
match, then a stable primary URL tie-break; do not consolidate existing records.
Fuzzy title matching compares primary representatives only. Do not chain matches
through attribution titles. Canonical duplicate attribution entries are removed
while original links and titles remain unchanged on the retained entries.

Return newly clustered candidates and a separately cloned existing-article list
with additive attribution. Do not mutate the caller's archive object or reset
existing summary/headline fields. Round-robin primary-source buckets until the
configured cap, after clustering; retain pre-cap new count for generatedAt.
Only successfully classified new clusters are persisted. If a batch exhausts
retries, do not persist its unclassified representative or lose an existing
article's independent attribution additions. Normal retention still applies.

### Orchestrator and offline runner

Export `runIngest` taking validated feeds/config, parsed existing data, frozen
clock and explicit collection/classification/brief/log dependencies, returning
the resulting NewsData. It performs no filesystem writes and never constructs a
model client. The CLI `main` alone loads config/files, creates production adapters
after validation, invokes the runner and writes the normal output path. Keep
dotenv loading out of the imported test runner path. Preserve fatal auth/invalid
model-response behavior and existing retry/briefStatus/quiet-day contracts.

An offline integrated test supplies parsed RSS fixtures, fake delays/fetch/model
responses and an in-memory log sink. This exercises collection→selection→batches→
archive merge→brief behavior rather than testing isolated helpers only. The cap
fixture's required summary is `admitted=50 capacitySkipped=30`, with two classifier
calls for 25 items each. Same input run twice cannot multiply primary/extra URLs.

`npm run sources:preview` is a separate read-only command over the configured
feeds: fetch/parse/filter and show bounded samples plus attempted/eligible/excluded
counts, with no DeepSeek client, secret loading or archive write. Tests stub the
transport and make unexpected filesystem writes/model calls fail. Its real
execution is a feed reachability/relevance check, not end-to-end paid ingest.

### Browser data and article presentation

`parseNewsData` currently reconstructs articles and would discard attribution;
explicitly validate/copy optional entries, dropping malformed/unsafe entries
without rejecting an otherwise valid legacy article. Reuse `sourceUrl` to reject
credentials, javascript/data and malformed URLs. Defensive checks at rendering
also cover directly supplied fixtures. React escapes titles/names as plain text.

Use AdditionalSources with explicit language/edition props, outside primary
anchors. It returns nothing for no valid additional entries, uses localized
surrounding copy and original titles/source names, and opens safe source links
with noreferrer. No article click handler may intercept an attribution click.
Mount it in both standard surfaces and Extra lead/list. Do not modify unused
legacy ArticleCard or translate unrelated Extra chrome as part of this change.

## Delegation and ordered tasks

Planning investigations are read-only Luna/xhigh tasks. Implementation agents
will be Luna/max; final integration review will be Sol/high. Do not send unapproved
production work to any agent. Assign disjoint file ownership from the table;
main owns shared types, integration, configuration and documentation.

- [x] Inspect specs/current checkout and record rough source-direction approval.
- [x] Verify this plan's assumptions against the actual code before asking for
  Gate 2 (2026-09-11). Confirmed present as described: `fetchFeed(url, timeoutMs
  = 20_000)` at `ingest/feeds.ts:4`, `parseNewsData` at `src/lib/news.ts:40`,
  `classifyBatch` at `ingest/ingest.ts:185`, `ARXIV_CAP = 15`, `selectBriefInput`
  at `ingest/lib.ts:282`, and every `standard/` and `extra/` component in the file
  table. `feeds.json` holds 10 feeds, consistent with 8 retained + 12 additions.
  The shadowed-type risk is real: `ingest/ingest.ts:71,79` declares a private
  `RawArticle`/`Article` over `src/types.ts:7`. Two corrections to apply when
  implementing: the verification block below should use `tsx --test` to match
  `package.json`, and `src/lib/__tests__/attribution.test.ts` must stay in that
  directory because `npm test` globs only `ingest/__tests__/` and
  `src/lib/__tests__/` — relocating it to a components directory would drop it
  from the suite silently.
- [x] Explain the plan to Marco before the gate decision (2026-09-11). He replied
  "I still don't understand, create another HTML artifact for me to explain" when
  asked to approve, so an explanation of the four mechanisms, the injected-runner
  architecture, the delegation split and the limits of the approval was produced
  as an HTML artifact. **Gate 2 is still pending; no approval is recorded.**
- [x] Reconcile this checkout before implementation (2026-09-11). Done ahead of
  the ordered task below: local documentation committed as `625a9f5`, then
  `origin/main` (`9e6aea8`) merged as `5678743`, with `origin/main` now an
  ancestor of local `main` and 130 of 130 offline tests passing on the merged
  tree. `backup/pre-origin-merge-2026-09-11` preserves the pre-merge state. A
  separate integration worktree is therefore no longer required for a current
  base; the ordered task below stands only if Gate 2 prefers isolation anyway.
- [ ] Complete pipeline/UI investigations and Sol/high review of this plan.
- [ ] Receive explicit Gate 2 approval and record any F16 sequencing decision.
- [ ] Prepare a fresh integration worktree from verified current origin/main;
  preserve the original checkout and copy only the reviewed F13 documentation.
  Audit differences before carrying any local production file into that checkout;
  already-published F16 changes must not be recommitted. Record base commit/path.
- [ ] Main freezes shared interfaces and optional metadata contract.
- [ ] Feed agent implements bounded transport/collection and read-only preview,
  with its owned tests and no source-list changes.
- [ ] Selection agent implements pure relevance, dedupe/attribution and cap logic,
  with its owned tests and no shared type/orchestrator edits.
- [ ] UI agent implements safe parsing, attribution and health warning display,
  styles and tests against the frozen interface.
- [ ] Main reviews actual diffs/tests, integrates runIngest and its offline suite,
  and wires validated config through CLI/workflow/example env.
- [ ] Main reviews content samples and introduces the approved source groups;
  record sample date, relevant/excluded examples and any unresolved source issue.
- [ ] Run all verification below in the integration checkout; record actual output.
- [ ] Sol/high reviews combined diff and evidence; main resolves findings and
  repeats only affected checks. Record readiness; keep Done pending publication
  and hosted verification under the repository's status definition.

## Verification matrix

| Spec AC | Evidence required |
| --- | --- |
| 1 | Config fixture checks exact 20 names/URLs/scopes; removed sources' archived records remain; source samples reviewed. |
| 2 | Local HTTP cleanup plus mock transient→success, terminal XML/404, Retry-After bounds, parent cancellation, no new work after deadline and one health update. |
| 3 | English/Chinese positives and irrelevant jobs/weather/sport negatives; email false-positive; missing/future dates and no-AI general-feed results. |
| 4–5 | Tracking variants vs meaningful queries/path case; versions/negation/CJK; primary-only clustering; incoming match to prior attribution; no mutation; archived duplicates retained; stable reruns. |
| 6 | Integrated 80 distinct candidates→50 admitted/30 skipped/two classifier batches; uneven buckets; small cap; deterministic result across feed completion orders. |
| 7 | Parser safety and static rendering; desktop/mobile EN/zh-HK in both builds, all four article surfaces, keyboard/source-link destinations, legacy/invalid metadata, threshold 1/3/custom. |
| 8 | Bad config/archive stops before network/write; all-feed failure, zero articles and malformed item counters; no writes or model calls from preview. |
| 9 | Integrated fixture retains Chinese summaries, brief headline pair, primary citation URLs, old-brief status/freshness and skipped/failed batches; existing Telegram/backfill/model suites remain passing. |

Commands for cmd, in the implementation checkout (replace the first path with
the recorded integration path if different):

```bat
cd /d F:\project\AI-news
node --import tsx --test ingest/__tests__/pipeline.test.ts
npm test
set VITE_ENABLE_EXTRA=false
npm run build
set VITE_ENABLE_EXTRA=true
npm run build
set VITE_ENABLE_EXTRA=false
npm run build
git diff --check
```

Expected: focused cap scenario passes with its logged values asserted; full suite
has zero failures; all builds exit 0; final build has Extra disabled; whitespace
check exits 0. Application tests have not run during planning.

For browser QA, generate temporary fixture copies and a temporary Vite publicDir
outside the tracked public directory; use the actual app and parser against these
copies. Never overwrite `public/news.json` to seed browser tests. Restore fixture
preview/flag overrides after verification. Preserve before/after hashes for source
archive, delivery records and unrelated files. Test long titles/many attribution
links at 320/375/768/1440 widths, keyboard order, both languages and both editions.
F13 responsive checks do not count as F16 native 200% zoom evidence.

After implementation, `npm run sources:preview` must print per-source results and
bounded content samples without a key or data modification. Record the public
feed checks separately from offline regression tests. After separately authorized
publication, inspect a real hosted ingest/test/deploy outcome and the resulting
source/attribution/cap logs; do not force Telegram delivery to obtain evidence.

## Risks / tradeoffs

- Title similarity may miss paraphrases or merge related updates. Conservative
  thresholds, version/negation fixtures and no cross-language fuzzy matching limit
  risk; uncertain source quality or matching cases are reported, not hidden.
- Keyword filtering misses implicit AI references and can admit tangential news.
  Source samples and excluded examples are reviewed before activation.
- Fixed source-order round-robin is reproducible but favors earlier feeds when
  the cap is below feed count; no starvation-free backlog is promised.
- A total feed deadline can interrupt sources or leave them unattempted. Logs
  distinguish that from publisher failures and preserve previous health rather
  than inventing a successful or failed fetch. Later normal runs provide fresh
  opportunities.
- An all-request-timeout worst case can still approach CI's existing deadline;
  avoid expanding that deadline or retry counts silently. No live reliability
  claim follows from local mocks or a single successful public probe.
- The original checkout contains published F16 code mixed with unrelated work.
  Integration uses a fresh base and explicit changes; no reset or blanket staging.
