# SPEC: Source expansion — broader, deduplicated feed coverage

**ID:** F13-source-expansion
**Status:** Plan — source-expansion direction approved 2026-09-11; per-run ceiling raised to 100 the same day; detailed implementation plan pending Gate 2 approval
**Owner:** Marco

## Approval record — 2026-09-11

Marco replied “Approved, remember to delegate approprate agent to perform
different task” to the rough source-expansion plan. Gate 1 approval covers the
20-feed direction (eight retained, two retired, twelve additions), relevance
sampling, free topical filtering, bounded retries, conservative deduplication,
the per-run article ceiling and reviewable rollout groups. Proceed to the
detailed implementation plan; this is not Gate 2 or publication approval.
Numerical matching/retry defaults and data-contract details from the earlier
proposal are carried into that plan for explicit implementation review, not
represented as separately discussed decisions.

Delegation follows AGENTS.md: Luna/xhigh for bounded repository investigation,
Luna/max for implementation after Gate 2, and Sol/high for integration review.
The main agent owns cross-cutting decisions and inspects every delegated result.
F16's outstanding zoom verification remains open; preparing this F13 plan does
not claim its completion or silently waive the recorded feature order.

## Scope change — per-run ceiling doubled, 2026-09-11

Marco raised the per-run ceiling from **50 to 100 new canonical articles**, saying
the DeepSeek migration (F10) has reduced his cost enough to afford the larger
volume. The default `MAX_NEW_ARTICLES_PER_RUN` is therefore **100**. Everything
else about the control is unchanged: it is still configurable, still validated
before any network or output write, and still a per-run volume cap rather than a
monetary or daily-aggregate guarantee.

Consequences carried through this spec and the plan:

- At the default ceiling a full run admits at most **four** classification
  batches of 25, not two. With the existing three-attempt retry policy that is at
  most **16** classification request attempts per run, plus the unchanged brief
  attempts. Filtering and deduplication still add no model calls.
- The capacity fixture changes from 80 candidates → 50 admitted / 30 skipped, to
  **140 candidates → 100 admitted / 40 skipped**, asserting four batches and no
  fifth. Acceptance criterion 6 is restated accordingly.
- A higher ceiling makes the round-robin fairness rule matter less often, because
  the cap binds on fewer days. It does not change the rule, and does not create a
  backlog: overflow items are still skipped for that run, not queued.
- The existing `ARXIV_CAP = 15` is **unchanged**. Marco's decision named the
  per-run new-article ceiling and spend; the arXiv sub-cap is a separate control
  that exists to stop one preprint feed dominating ingestion, and doubling it was
  not requested. Raise it only as an explicit later decision.
- No other limit moves: batch size stays 25, per-attempt timeout stays 20s, feed
  retries stay at three attempts, and the feed-failure warning threshold stays 3.

## Status review — 2026-09-09

The candidate registry and feed triage are documented, but implementation has
not started and no plan has been approved. The current `feeds.json` still has
10 entries; `ingest/feeds.ts` bounds fetch duration but has no fetch retry loop.
Appendices A and B are dated 2026-09-08 evidence, not fresh feed-health checks.
Next: resolve the source shortlist, feed/cost ceiling, topical filtering and
deduplication questions below; approve the spec, then prepare and approve a plan.
This status correction does not approve those choices or authorize feed changes.

**Workstream request — 2026-09-09:** Marco requested F16, F13 and F15 in that
order. F13 is the next feature after F16 verification closes. This confirms its
priority over F6/F5, not approval of the unresolved product choices below.

## Review proposal — initial 2026-09-11 draft

Marco asked to inspect the specs and work on the next task. F16 still lacks its
manual native-zoom confirmation; F13 specification preparation is the next
actionable work. Implementation order remains F16 → F13 → F15. No F16 acceptance
waiver, F13 approval, or permission to publish is inferred. The eight sections
below are the current proposal for Gate 1; the original brief and questions are
retained afterward as historical context. All defaults here are proposed, not
previously agreed.

## 1. Problem statement

Expand the reader beyond the original vendor-heavy feeds to cover commercial
AI and agents, UK AI employment, and Hong Kong. Repair source reliability and
bound classification volume before adding traffic. Reduce high-confidence
duplicate coverage while preserving attribution and keeping distinct reports.

## 2. Constraints

- Windows/cmd development; existing Node/TypeScript offline pipeline, React/Vite
  static site and GitHub Actions. No new dependency is proposed.
- RSS/Atom only, public unauthenticated endpoints. Keep the existing strict XML
  parser; do not bypass publisher blocks or add scraping.
- Start with **20 feeds**: retain eight, remove the two failed endpoints after
  approval, and add the 12 below. This is an initial selection, not a permanent
  schema limit. Appendix C records a fresh parse check for all 22 assessed URLs.
- Default **100 new canonical articles per ingest run** (raised from 50 on
  2026-09-11, see the scope change above), configurable by
  `MAX_NEW_ARTICLES_PER_RUN` as a positive integer, validated before network or
  output writes. This is a volume cap, not a GBP/USD spending guarantee or a
  daily aggregate cap across manual reruns.
- Keep current classification models, bilingual prompts, batches of 25, retry
  policy and single logical brief-generation step. At the default ceiling, at
  most four classification batches are admitted; with the existing three retries,
  that is at most sixteen classification request attempts, plus the existing
  brief attempts. Filtering and deduplication add no model calls. Token-based
  charges still vary; a precise monetary estimate is not asserted by this spec.
- Preserve archive retention, existing article URLs/summaries/snippets, brief
  citation/freshness/status behavior, F12 fallback and Telegram duplicate state.

### Proposed source selection

Retain: The Verge AI, TechCrunch AI, Ars Technica AI, OpenAI Blog, Google DeepMind,
MIT Tech Review AI, arXiv cs.AI and Hacker News (AI). Keep their existing names and
URLs. Remove Anthropic News and VentureBeat AI from future fetching; do not remove
their retained articles. Preserve the existing arXiv relevance filter and cap 15.

| Addition | Purpose | Topical filter | RSS/Atom URL |
| --- | --- | --- | --- |
| AI Business | Enterprise and commercial AI | AI-specific | https://aibusiness.com/rss.xml |
| The Decoder | AI products and model developments | AI-specific | https://the-decoder.com/feed/ |
| The Register AI/ML | Applied AI and industry reporting | AI-specific | https://www.theregister.com/software/ai_ml/headlines.atom |
| Simon Willison | Agents and practical developer work | Required | https://simonwillison.net/atom/everything/ |
| Hugging Face blog | Models, tools and practitioner material | AI-specific | https://huggingface.co/blog/feed.xml |
| GitHub blog | Copilot and AI developer tooling | Required | https://github.blog/feed/ |
| Computer Weekly | UK enterprise technology and work | Required | https://www.computerweekly.com/rss/All-Computer-Weekly-content.xml |
| Guardian AI | UK-facing AI policy and social impact | AI-specific | https://www.theguardian.com/technology/artificialintelligenceai/rss |
| Indeed Hiring Lab | Labour-market research involving AI | Required | https://www.hiringlab.org/feed/ |
| Personnel Today | UK employment and HR reporting involving AI | Required | https://www.personneltoday.com/feed/ |
| SCMP Tech | Hong Kong/China technology perspective | Required | https://www.scmp.com/rss/36/feed |
| Unwire.hk | Hong Kong technology and Chinese-language input | Required | https://unwire.hk/feed/ |

Source location does not make every story UK- or HK-specific. The labour feeds
are proposed for AI employment coverage, not general vacancies. Digest aggregators
such as Techmeme and TLDR AI remain outside the first release.

## 3. Non-goals

- F15 brief-input quotas or category balancing; changing the displayed article
  ranking, taxonomy, number of brief bullets or Telegram delivery rules.
- Semantic or cross-language story matching with a model; guaranteeing one card
  for every differently worded account of an event. Uncertain matches stay separate.
- Retroactive deduplication/deletion of the retained archive, forced backfill,
  changes to stored snippets, or F14 licensing/attribution-page work.
- A durable queue guaranteeing eventual publication of every overflow item,
  paid feeds, authentication, scraping or a new service/database.

## 4. Interfaces & data shapes

**Feed configuration:** existing `{name, url}` entries remain valid and preserve
their current behavior. Add an optional `scope` with values `ai` or `general`;
omission means `ai`. Every general-purpose addition above explicitly sets
`scope: "general"`. Reject invalid scope, duplicate names and non-HTTP(S) feed
URLs before fetching. Example configuration:

```json
{"name":"Unwire.hk","url":"https://unwire.hk/feed/","scope":"general"}
```

**Topical filtering:** apply to title plus the current maximum 600-character,
HTML-stripped excerpt before any model call. Use Unicode normalization and
case-insensitive English matching with word boundaries; Chinese terms use
substring matching. Initial positive signals: AI, artificial intelligence,
generative AI, machine learning, LLM/LLMs, large language model(s), AI agent(s),
agentic, Model Context Protocol, OpenAI, Anthropic, ChatGPT, DeepSeek, LangChain,
Hugging Face, GitHub Copilot, 人工智能, 人工智慧, 生成式AI, 生成式 AI, 大語言模型,
大语言模型, 智能代理 and 智能體. Bare `agent`, `jobs`, `automation`, `MCP`,
`Claude`, `Gemini` or `Copilot` are insufficient on a general feed without an
unambiguous AI signal. A keyword filter can miss implicit references; preserve
that limitation in documentation rather than describing it as semantic filtering.

**Duplicate matching:** compute comparison keys separately from stored URLs.
Normalize URL host case, remove fragments and a documented tracking-parameter
allowlist (`utm_*`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`), and sort remaining
query parameters. Preserve path case, meaningful queries and HTTP/HTTPS distinctions.
Do not follow article redirects or rewrite stored links.

Match identical canonical URLs across the retained archive. For distinct URLs,
only compare reports published within 72 hours of one another: normalized exact
titles of at least 20 characters qualify, or English title token-set Jaccard
similarity at least 0.9 with at least six tokens shared. Preserve numeric/model
version tokens and require matching numeric-token sets; do not merge a title
containing negation (`no`, `not`, `never`, `without`) with one that does not.
Chinese titles use exact matching only. Compare every candidate to the selected
representative, not merely to another member, to prevent chains of weak matches.

For a new cluster, choose the earliest published member, then feed configuration
order and original URL for ties. When matching an existing article, retain its
primary URL and content; do not merge two already-stored records. Add optional
`additionalSources` containing unique original `{title, url, source}` records for
other coverage. Example additive metadata on the retained article:

```json
{"additionalSources":[{"title":"Example AI product launch","url":"https://example.org/story?id=42","source":"Example Publisher"}]}
```

Both layouts display these as source links beneath the article. Existing
articles without metadata render unchanged. Display source names and original
titles unchanged; localize the surrounding label in EN/zh-HK. The primary URL
remains the brief citation target; do not add or rewrite brief refs.

**Capacity selection:** after filtering, archive matching and incoming clustering,
sort each primary-source bucket newest first (URL tie-break), then take one item
per source per round in configuration order until the limit is met. No `important`
or category ranking is available before classification. Keep the current arXiv
cap as a separate constraint. This ingestion fairness rule does not change F15's
brief selector. Items beyond capacity are skipped for this run and not marked
seen; they can return while still within the normal feed/catch-up window, but
eventual inclusion is not guaranteed. Preserve the current `generatedAt` rule
based on the pre-cap new-candidate count.

**Fetch reliability:** retry transport timeouts/network failures and HTTP 408,
429 and 5xx at most twice (three total attempts), with 1s then 2s delay and the
existing 20-second timeout per attempt. Honor valid `Retry-After` seconds or HTTP
dates up to 30s; if the requested delay exceeds that budget, stop retrying that
feed for this run instead of retrying early. Do not retry 401/403/404 or malformed
XML. Use a feed-specific transient-error classification: the existing model retry
helper recognizes OpenAI errors and cannot simply be wrapped around generic fetch.
Record health once per feed/run, resetting failures after eventual success.

Expose the existing consecutive-failure count in source health and flag counts
at or above `FEED_FAILURE_WARNING_THRESHOLD` (default 3, positive integer). Never
automatically delete a feed because its failure threshold is exceeded.

Log per-feed fetched/eligible/topically excluded counts and attempts, plus run
counts for archive matches, duplicate reports, admitted canonical articles and
capacity skips. A deterministic offline fixture with 140 eligible distinct items
must report `admitted=100 capacitySkipped=40` before classification.

## 5. Edge cases

- Zero eligible articles: preserve existing brief/no-new-material processing and
  health/retention behavior; make no classification call.
- One failed feed: finish the remaining feeds and persist its failure once;
  partial success is not a global ingest failure. All-feed failure keeps the
  current freshness/delivery contract; this feature must not fabricate fresh news.
- Missing/invalid publication date or a date in the future: skip that incoming
  item with a count, rather than treating an undated old entry as new today.
  Existing stored timestamps are untouched.
- Malformed items, empty titles, invalid links or unsupported URL schemes: skip
  the item; malformed XML fails the feed. A parsed empty feed still counts as a
  successful fetch and must not be classified as dead merely for having no items.
- Same publisher with different meaningful query IDs, different model versions,
  or opposite claims: retain separate articles. Loose paraphrases and translated
  coverage can remain duplicated; avoiding false merges takes priority.
- A duplicate of an archived article: add unique attribution metadata without
  another classification call or changing its primary content. Rerunning cannot
  multiply the same attribution entry.
- Over-cap news or catch-up burst: admit at most the configured volume, record
  skips, and keep existing archive data. A small cap gives priority to earlier
  configured source buckets; that ordering must be visible in `feeds.json`.
- Invalid environment/configuration: fail with a named actionable error before
  network or data writes. Feed failure text must not leak API keys or credentials.

## 6. Acceptance criteria

1. The approved configuration has the eight retained and twelve added feeds above;
   all feed outcomes flow through `feedHealth`, without deleting historical articles.
2. A mocked temporary transport failure followed by success retries within the
   budget and records success; repeated failure increments once; 404/malformed XML
   does not retry; long Retry-After stops the feed within the stated policy.
3. General-feed fixtures admit explicit English/Chinese AI, agent and AI-employment
   stories while excluding sport, weather, unrelated job posts and `email` as a
   false substring match for `AI`. AI-specific feeds preserve existing behavior.
4. Tracking-only URL variants merge; meaningful query IDs remain distinct.
   Exact/high-similarity title fixtures merge across sources while the negative
   cases and uncertain/translated headlines remain separate.
5. New merged coverage retains a stable primary article and unique attribution;
   existing stored articles never have primary URLs or content rewritten by dedupe.
6. A 140-candidate fixture admits exactly 100, spans every non-empty source bucket
   when the cap permits, records 40 capacity skips and makes no fifth classification
   batch. Repeated inputs do not duplicate stored articles or attribution.
7. Both standard and an explicitly Extra-enabled build show attribution links,
   localized chrome and legacy records correctly; unsafe links cannot be rendered
   from incoming metadata. Source-health threshold/count display works in both.
8. Invalid caps/configuration fail before network/data writes. Dated/undated,
   zero-item and all-failure fixtures behave as defined above.
9. Regression coverage proves bilingual summaries, optional F16 brief headlines,
   primary citation targets, freshness/status and Telegram duplicate guards retain
   their existing contracts. F15's selector remains unchanged.

## 7. Verification plan

Codex runs the offline suite and both production builds after both approval gates,
using mocked feeds/model calls, fixed times and temporary data fixtures. Do not
test caps or dedupe by modifying the real archive. Commands for cmd:

```bat
cd /d F:\project\AI-news
npm test
set VITE_ENABLE_EXTRA=false
npm run build
set VITE_ENABLE_EXTRA=true
npm run build
set VITE_ENABLE_EXTRA=false
npm run build
git diff --check
```

Expected: zero test failures, three successful builds and no whitespace errors.
Codex also previews both layouts in English/Chinese with duplicate attribution,
legacy articles and feed-health fixtures at desktop/mobile sizes. The implementation
plan must provide a safe repeatable fixture runner for the cap/log assertions.
No live model call, backfill, Telegram send or workflow dispatch is needed for
these checks. Publication and a subsequent normal hosted ingest need their own
recorded validation; local feed success alone does not prove hosted reliability.

The 2026-09-11 read-only feed probe below is complete. The proposed application
tests/builds have not run because this feature is not implemented.

## 8. Approval choices — original review presentation

Approve these three grouped decisions, or state changes:

1. **Coverage:** adopt the proposed 20-feed set, including the two removals and
   the requirement that labour/HK general feeds contribute AI-related stories only.
2. **Volume and overflow:** default new canonical articles per run, round-robin
   source admission and no guaranteed backlog. This limits model-request volume;
   it does not promise a fixed monetary daily budget. The default presented here
   was 50; Marco raised it to 100 on 2026-09-11, recorded in the scope change above.
3. **Deduplication and attribution:** conservative local URL/title matching with
   visible additional-source links; accept missed semantic/cross-language matches
   to avoid merging distinct news. Accept skipping invalid/undated incoming items
   rather than dating old content as new.

The remaining concrete defaults in sections 2–7 are part of the same proposed
spec. At this presentation Gate 1 was pending. The later rough-direction approval
is recorded above; the detailed implementation plan still requires Gate 2.

### Rough source-expansion approach requested — 2026-09-11

Marco asked for a rough plan for expanding sources before implementation.
Proposed rollout: confirm the 20-feed shortlist by coverage group; prepare feed
retry, topical filtering, dedupe and the per-run ceiling; inspect a read-only
sample from each proposed source for useful AI coverage; introduce the approved
sources in reviewable groups; verify local/offline behavior and then hosted
behavior after a separately authorized release. A parseable feed alone is not
proof of relevant or geographically specific coverage. Judge the additions by
relevant unique stories contributed, not raw item count. Existing dated probe
results are reused rather than claimed as a new check. This records a proposed
approach only; source choices, Gate 1 and the implementation plan remain pending.

## Original discovery brief — historical context

The sections below describe the 2026-09-08 draft and research history. For the
current Gate 1 proposal, use sections 1–8 above. No historical question has been
marked approved merely because a proposed default is now supplied.

### Original intent

`feeds.json` has carried the same 10 RSS sources since F0. The mix is
Anglophone, vendor-heavy, and thin on policy, applied/enterprise AI, and
Chinese-language coverage — which now matters because F12 ships Traditional
Chinese summaries from English-only inputs. Adding sources naively is not free:
every extra feed multiplies the DeepSeek classification calls per run and
increases the odds that one story appears three times on the front page under
three different headlines. This feature widens coverage *and* adds the
dedupe/cost controls that make a wider source list safe to run daily.

### Original user stories

- As a reader, I want stories that only regional or policy outlets cover, so that
  the feed is not just US vendor announcements.
- As a reader, I want one card per story, so that the same launch reported by
  four outlets does not fill the page.
- As the maintainer, I want a per-run ceiling on classified articles, so that
  adding feeds cannot silently multiply the daily API cost.
- As the maintainer, I want general-news sources filtered before classification,
  so that a Hong Kong or UK news feed contributes its AI stories without paying
  to classify its sport and weather.
- As the maintainer, I want to add a feed by editing one file, so that expanding
  coverage never needs a code change.
- As the maintainer, I want each currently-failing feed diagnosed as *dead*,
  *blocking us*, or *our bug*, so that I repair what is repairable and delete
  what is not, instead of carrying broken entries indefinitely.

### Original acceptance criteria

- WHEN the ingest runs THEN the system SHALL fetch every feed in `feeds.json`
  and record per-source health for each, including any newly added source.
- WHEN two fetched articles describe the same story THEN the system SHALL keep
  one and record the others as additional sources on the kept article, rather
  than emitting duplicate entries in `news.json`.
- WHEN a run's candidate article count exceeds the configured per-run ceiling
  THEN the system SHALL classify only the highest-priority candidates and log
  how many were deferred, without failing the run.
- WHEN a newly added feed fails or returns malformed XML THEN the system SHALL
  complete the run using the remaining feeds and surface the failure through the
  existing `feedHealth` contract rendered by F9.
- WHEN a feed fetch fails with a transient transport error THEN the system SHALL
  retry with backoff before recording the feed as failed for that run.
- WHEN a feed has failed on every run for a configurable number of consecutive
  runs THEN the system SHALL make that visible rather than failing silently, so
  a dead source is noticed without reading the console log.
- WHEN a feed is marked as general-interest rather than AI-specific THEN the
  system SHALL apply a topical pre-filter before classification, so that
  non-AI items are discarded without spending a model call.
- WHEN `feeds.json` gains an entry THEN the system SHALL require no change to
  `ingest/*.ts` for that source to be fetched.
- WHEN the deduplication logic runs THEN it SHALL be covered by `node:test`
  cases in `ingest/__tests__/` including a same-story/different-headline pair
  and a genuinely-distinct pair.

### Original existing-feed triage

Three of the ten current sources are failing. Each was diagnosed on 2026-09-08
(evidence in Appendix B); they need three different responses, which is the point
of triaging rather than bulk-deleting:

| Feed | Verdict | Action |
| --- | --- | --- |
| Anthropic News | **Dead** — feed removed by the source | Delete the entry; Anthropic coverage comes via other sources |
| VentureBeat AI | **Blocking us** — edge/WAF returns 429 to everything | Delete, or find a VentureBeat URL that is not fronted by the block |
| Hacker News (AI) | **Our bug** — host is flaky, we do not retry | Keep the URL; add retry/backoff to `fetchFeed` |

### Original non-goals

- Scraping, HTML parsing, or any non-RSS/Atom source. Constitution rules #1 and
  #2 keep ingestion offline, static, and dependency-light.
- Paid or authenticated feeds.
- Per-user source selection or muting in the UI (that is closer to F5's
  subscription surface).
- Re-ranking or re-scoring existing articles; F13 changes what enters the
  pipeline, not how ranked output is presented.
- Translating source *articles*; F12 already owns bilingual summary generation.

### Original open questions

- [ ] Which sources go in? An 84-URL candidate pool was probed live on
      2026-09-08 against the exact fetch/parse path in `ingest/feeds.ts`; the 71
      that returned parseable items are listed in Appendix A for Marco to tick.
      Selection priorities stated by Marco: commercialized AI / agentic
      features, the UK AI job market, and Hong Kong coverage.
- [ ] Target feed count — is the ceiling ~15, ~20, or uncapped as long as the
      per-run article cap holds?
- [ ] Dedupe signal: title similarity only (cheap, local, no API call), or URL
      canonicalization plus similarity? A model-based judgement is the third
      option but costs a call per candidate pair.
- [ ] Per-run classified-article ceiling and the priority rule used when the cap
      bites (source trust order? recency? existing rank heuristics?).
- [ ] Does a deduped article show "also covered by X, Y" in the UI, or is the
      merge invisible to readers?
- [ ] Expected daily cost delta at the chosen feed count, and whether that is
      acceptable before Gate 1.
- [ ] Topical pre-filter design for general-interest feeds. Probing showed the
      strongest Hong Kong and UK sources are *general* news, not AI news: HK Govt
      press returns 100 items per fetch and Ming Pao 48, of which a handful are
      AI-related. A keyword/regex gate on title+summary is free but blunt; a
      cheap model pass costs money at exactly the volume we are trying to cap.
      Which, and what keyword list?
- [ ] Aggregators (Techmeme) and digest feeds (TLDR AI) behave unlike article
      feeds — one entry can bundle many stories, or restate a story already
      fetched from its origin. Adopt them as dedupe stress-tests, or exclude?


## Appendix A — verified candidate sources

Probed 2026-09-08 with the same request path `ingest/feeds.ts` uses (native
`fetch`, 20s `AbortSignal.timeout`, `rss-parser` `parseString`), so a row here is
known to work in *this* codebase, not merely to exist. 84 URLs tried, 71 returned
parseable items. "Items" is the feed's page size; "Newest" is the most recent
item date at probe time, with the warning marker on anything older than 7 days —
a slow feed is not necessarily dead (essayists publish weekly), but it is a poor
fit for a daily-cadence reader.

Tick the boxes for the ones to adopt, then the plan can size the per-run article
cap around real volume.

**A. Commercial / enterprise AI news**

| Pick | Source | Feed URL | Items | Newest |
| --- | --- | --- | --- | --- |
| [ ] | AI Business | `https://aibusiness.com/rss.xml` | 50 | 2026-09-04 |
| [ ] | Axios | `https://api.axios.com/feed/` | 100 | 2026-09-07 |
| [ ] | Business Insider Tech | `https://feeds.businessinsider.com/custom/all` | 20 | 2026-09-07 |
| [ ] | CIO | `https://www.cio.com/feed/` | 20 | 2026-09-07 |
| [ ] | CNBC Technology | `https://www.cnbc.com/id/19854910/device/rss/rss.html` | 30 | 2026-09-07 |
| [ ] | Fortune Tech | `https://fortune.com/feed/fortune-feeds/?id=3230629` | 10 | 2026-09-07 |
| [ ] | IEEE Spectrum AI | `https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss` | 30 | 2026-09-02 |
| [ ] | InfoWorld | `https://www.infoworld.com/feed/` | 20 | 2026-09-07 |
| [ ] | Platformer | `https://www.platformer.news/rss/` | 15 | 2026-09-04 |
| [ ] | Rest of World | `https://restofworld.org/feed/latest/` | 12 | 2026-09-04 |
| [ ] | Semafor | `https://www.semafor.com/rss.xml` | 178 | 2026-09-07 |
| [ ] | Sifted (EU startups) | `https://sifted.eu/feed` | 24 | 2026-09-07 |
| [ ] | SiliconANGLE AI | `https://siliconangle.com/category/ai/feed/` | 30 | 2026-09-06 |
| [ ] | Stratechery | `https://stratechery.com/feed/` | 10 | 2026-09-04 |
| [ ] | Techmeme | `https://www.techmeme.com/feed.xml` | 15 | 2026-09-07 |
| [ ] | The Decoder | `https://the-decoder.com/feed/` | 10 | 2026-09-07 |
| [ ] | The Register AI/ML | `https://www.theregister.com/software/ai_ml/headlines.atom` | 50 | 2026-09-02 |
| [ ] | Wired AI | `https://www.wired.com/feed/tag/ai/latest/rss` | 10 | 2026-09-07 |

**B. Agentic & practitioner (deep, low-volume)**

| Pick | Source | Feed URL | Items | Newest |
| --- | --- | --- | --- | --- |
| [ ] | AI Snake Oil | `https://www.aisnakeoil.com/feed` | 20 | 2026-08-05 ⚠ 33d |
| [ ] | Gary Marcus | `https://garymarcus.substack.com/feed` | 20 | 2026-09-06 |
| [ ] | HackerNoon AI | `https://hackernoon.com/tagged/ai/feed` | 50 | 2026-09-07 |
| [ ] | Import AI | `https://importai.substack.com/feed` | 20 | 2026-09-07 |
| [ ] | Interconnects | `https://www.interconnects.ai/feed` | 20 | 2026-08-17 ⚠ 21d |
| [ ] | Last Week in AI | `https://lastweekin.ai/feed` | 20 | 2026-09-07 |
| [ ] | Latent Space | `https://www.latent.space/feed` | 20 | 2026-09-07 |
| [ ] | One Useful Thing | `https://www.oneusefulthing.org/feed` | 20 | 2026-08-31 ⚠ 8d |
| [ ] | Sebastian Raschka | `https://magazine.sebastianraschka.com/feed` | 20 | 2026-08-22 ⚠ 17d |
| [ ] | Simon Willison | `https://simonwillison.net/atom/everything/` | 30 | 2026-09-07 |
| [ ] | TLDR AI | `https://tldr.tech/api/rss/ai` | 20 | 2026-09-07 |

**C. Vendor & lab blogs**

| Pick | Source | Feed URL | Items | Newest |
| --- | --- | --- | --- | --- |
| [ ] | AWS Machine Learning | `https://aws.amazon.com/blogs/machine-learning/feed/` | 20 | 2026-09-04 |
| [ ] | Cloudflare blog | `https://blog.cloudflare.com/rss/` | 20 | 2026-09-03 |
| [ ] | Databricks blog | `https://www.databricks.com/feed` | 10 | 2026-09-04 |
| [ ] | GitHub blog | `https://github.blog/feed/` | 10 | 2026-09-04 |
| [ ] | Google AI blog | `https://blog.google/technology/ai/rss/` | 20 | 2026-09-02 |
| [ ] | Hugging Face blog | `https://huggingface.co/blog/feed.xml` | 859 | 2026-09-03 |
| [ ] | Microsoft Research | `https://www.microsoft.com/en-us/research/feed/` | 10 | 2026-08-31 |
| [ ] | Microsoft Source (AI) | `https://news.microsoft.com/source/feed/` | 10 | 2026-09-04 |
| [ ] | Mistral AI news | `https://mistral.ai/news/rss` | 82 | 2026-08-24 ⚠ 14d |
| [ ] | NVIDIA blog | `https://blogs.nvidia.com/feed/` | 18 | 2026-09-03 |
| [ ] | Salesforce news | `https://www.salesforce.com/news/feed/` | 10 | 2026-09-03 |
| [ ] | Stripe blog | `https://stripe.com/blog/feed.rss` | 10 | 2026-08-20 ⚠ 19d |

**D. UK tech & policy**

| Pick | Source | Feed URL | Items | Newest |
| --- | --- | --- | --- | --- |
| [ ] | BBC Technology | `https://feeds.bbci.co.uk/news/technology/rss.xml` | 21 | 2026-09-07 |
| [ ] | Computer Weekly | `https://www.computerweekly.com/rss/All-Computer-Weekly-content.xml` | 20 | 2026-09-07 |
| [ ] | diginomica | `https://diginomica.com/feed` | 10 | 2026-09-07 |
| [ ] | GOV.UK AI search | `https://www.gov.uk/search/all.atom?keywords=artificial+intelligence` | 10 | 2026-09-07 |
| [ ] | GOV.UK DSIT | `https://www.gov.uk/government/organisations/department-for-science-innovation-and-technology.atom` | 20 | 2026-09-07 |
| [ ] | Guardian AI | `https://www.theguardian.com/technology/artificialintelligenceai/rss` | 20 | 2026-09-07 |
| [ ] | ITPro | `https://www.itpro.com/feeds/all` | 50 | 2026-09-07 |
| [ ] | Silicon UK | `https://www.silicon.co.uk/feed` | 50 | 2026-09-07 |
| [ ] | Sky News Technology | `https://feeds.skynews.com/feeds/rss/technology.xml` | 10 | 2026-09-04 |
| [ ] | Tech Monitor | `https://www.techmonitor.ai/feed` | 10 | 2026-09-07 |
| [ ] | UK Parliament POST | `https://post.parliament.uk/feed/` | 10 | 2026-09-02 |
| [ ] | UKTN | `https://www.uktech.news/feed` | 10 | 2026-08-25 ⚠ 14d |

**E. AI job market / labour**

| Pick | Source | Feed URL | Items | Newest |
| --- | --- | --- | --- | --- |
| [ ] | Indeed Hiring Lab | `https://www.hiringlab.org/feed/` | 10 | 2026-09-04 |
| [ ] | Onrec (UK recruitment) | `https://www.onrec.com/rss.xml` | 10 | 2026-09-07 |
| [ ] | Personnel Today | `https://www.personneltoday.com/feed/` | 15 | 2026-09-07 |
| [ ] | Stack Overflow blog | `https://stackoverflow.blog/feed/` | 40 | 2026-09-04 |

**F. Hong Kong**

| Pick | Source | Feed URL | Items | Newest |
| --- | --- | --- | --- | --- |
| [ ] | HK Govt press (EN) | `https://www.info.gov.hk/gia/rss/general_en.xml` | 100 | 2026-09-07 |
| [ ] | HK Govt press (TC) | `https://www.info.gov.hk/gia/rss/general_zh.xml` | 100 | 2026-09-07 |
| [ ] | Hong Kong Free Press | `https://hongkongfp.com/feed/` | 30 | 2026-09-07 |
| [ ] | Ming Pao instant | `https://news.mingpao.com/rss/ins/s00001.xml` | 48 | 2026-09-07 |
| [ ] | RTHK Chinese local | `https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml` | 20 | 2026-09-07 |
| [ ] | RTHK English local | `https://rthk9.rthk.hk/rthk/news/rss/e_expressnews_elocal.xml` | 20 | 2026-09-07 |
| [ ] | SCMP China | `https://www.scmp.com/rss/4/feed` | 50 | 2026-09-07 |
| [ ] | SCMP Hong Kong | `https://www.scmp.com/rss/91/feed` | 50 | 2026-09-07 |
| [ ] | SCMP Tech | `https://www.scmp.com/rss/36/feed` | 50 | 2026-09-07 |
| [ ] | Unwire.hk | `https://unwire.hk/feed/` | 10 | 2026-09-07 |
| [ ] | Yahoo HK News | `https://hk.news.yahoo.com/rss/hong-kong` | 29 | 2026-09-07 |

**G. Asia / China tech**

| Pick | Source | Feed URL | Items | Newest |
| --- | --- | --- | --- | --- |
| [ ] | DigiTimes Asia | `https://www.digitimes.com/rss/daily.xml` | 35 | 2026-09-07 |
| [ ] | Nikkei Asia tech | `https://asia.nikkei.com/rss/feed/nar` | 50 | ⚠ no dates |
| [ ] | TechNode | `https://technode.com/feed/` | 2000 | 2026-09-07 |

### Rejected — probed and failed

Kept so these URLs are not re-litigated later. The 403s are edge/WAF blocks that
also rejected a browser User-Agent on a second pass, so they are not fixable by
changing request headers.

- Ada Lovelace Institute — `https://www.adalovelaceinstitute.org/feed/` — parsed but 0 items
- Alan Turing Institute — `https://www.turing.ac.uk/news/rss.xml` — HTTP 403
- Analytics India Magazine — `https://analyticsindiamag.com/feed/` — Attribute without value
- Axios Technology — `https://api.axios.com/feed/technology` — HTTP 404
- Ben's Bites — `https://bensbites.beehiiv.com/feed` — HTTP 404
- Business Insider Tech — `https://www.businessinsider.com/sai/rss` — HTTP 404
- CNBC Technology — `https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss25&id=19854910` — parsed but 0 items
- Databricks blog — `https://www.databricks.com/blog/rss.xml` — HTTP 404
- Fortune Tech — `https://fortune.com/section/tech/feed/` — HTTP 404
- HK01 — `https://www.hk01.com/rss/channel/1` — HTTP 404
- HN Who is hiring proxy — `https://hnrss.org/newest?q=%22AI+engineer%22+OR+%22ML+engineer%22&points=30` — HTTP 502
- HR Magazine UK — `https://www.hrmagazine.co.uk/rss` — HTTP 403
- Hacker News (agents) — `https://hnrss.org/newest?q=agent+OR+%22AI+agent%22+OR+RAG&points=100` — fetch failed
- IFS / Institute for Fiscal Studies — `https://ifs.org.uk/rss.xml` — HTTP 403
- InfoWorld — `https://www.infoworld.com/index.rss` — HTTP 404 — **fixed** via alternate URL, see table above
- Jiqizhixin — `https://www.jiqizhixin.com/rss` — Unexpected close tag
- KrASIA — `https://kr-asia.com/feed` — Invalid character in entity name
- LangChain blog — `https://blog.langchain.dev/rss/` — Invalid character in entity name
- LangChain blog (alt) — `https://blog.langchain.com/rss/` — Invalid character in entity name
- LlamaIndex blog — `https://www.llamaindex.ai/blog/feed` — HTTP 404
- Meta AI blog — `https://ai.meta.com/blog/rss/` — HTTP 404
- Microsoft AI blog — `https://blogs.microsoft.com/ai/feed/` — HTTP 410
- People Management — `https://www.peoplemanagement.co.uk/rss` — HTTP 404
- Personnel Today AI tag — `https://www.personneltoday.com/tag/artificial-intelligence/feed/` — HTTP 404
- Recruiter UK — `https://www.recruiter.co.uk/rss` — HTTP 403
- The Standard HK — `https://www.thestandard.com.hk/rss/section/4` — Attribute without value
- ZDNet AI — `https://www.zdnet.com/topic/artificial-intelligence/rss.xml` — HTTP 404

Two further notes from probing:

- **The LangChain and LlamaIndex blogs are unreachable for us.** LangChain's feed
  serves XML that `rss-parser`'s strict SAX parse rejects (`Invalid character in
  entity name`), and LlamaIndex returns 404 on every RSS path tried. Awkward for
  an agentic-AI reader; covering that ecosystem means leaning on Latent Space,
  Simon Willison, and the Hugging Face blog instead.
- **Several Chinese-language HK feeds fail on strict XML** (Sing Tao, InvestHK,
  The Standard, HKET). Ming Pao, RTHK Chinese, HK Govt press (TC), and Yahoo HK
  all parse cleanly, so Chinese-language coverage is achievable without
  loosening the parser.


## Appendix B — triage of the three failing feeds

Diagnosed 2026-09-08. Each URL was retried under the current request headers and
under a browser User-Agent, and alternate paths were tried where relevant, so a
"dead" verdict distinguishes *the source removed it* from *the source rejects
us*.

### Anthropic News — dead

`https://www.anthropic.com/rss.xml` returns **404** (Cloudflare-served HTML) under
both the current `rss-parser` User-Agent and a browser one. Five alternate paths
were tried — `/news/rss.xml`, `/feed.xml`, `/rss`, `/news/feed`,
`/engineering/rss.xml` — all 404. RSS autodiscovery on `anthropic.com` and
`anthropic.com/news` finds **no `<link rel="alternate" type="application/rss+xml">`
tag at all**, which is the decisive signal: the site advertises no feed.

`feedHealth` in the committed `public/news.json` corroborates it:
`lastSuccess: null`, `consecutiveFailures: 58`. This feed has never succeeded in
recorded history — it was almost certainly already gone when it was added in F0.

**Action:** remove from `feeds.json`. Anthropic announcements still arrive via
TechCrunch, The Verge, and The Decoder.

### VentureBeat AI — blocking us, not gone

`https://venturebeat.com/category/ai/feed/` returns **429** on every attempt: both
User-Agents, the site-wide `/feed/` as well as the AI category feed, and 5/5 on a
repeat run. The response is `text/html` and arrives in ~65 ms — far too fast to be
genuine rate limiting of our once-a-day request. That is an edge/WAF blanket
block on the client, not a request we are making too often, so backing off will
not fix it.

Committed `feedHealth` shows `lastSuccess: 2026-08-15` with
`consecutiveFailures: 4` across the 6 ingest commits since that date — so the
**GitHub Actions runner is blocked too**, not just a local IP.

**Action:** delete, unless a VentureBeat URL outside the block can be found. Its
enterprise-AI beat is the one worth replacing; AI Business and SiliconANGLE in
Appendix A cover the same ground.

### Hacker News (AI) — our bug

This one is not the source's fault. In a 5× repeat run our exact query URL
`hnrss.org/newest?q=AI+OR+LLM+OR+MCP&points=50` returned **200 five times out of
five**, while the plain `hnrss.org/newest` root failed **twice with
`UND_ERR_CONNECT_TIMEOUT`** in the same batch. Earlier passes saw sporadic 502s on
URLs that later succeeded. The failure is intermittent and host-side; the URL is
correct.

`fetchFeeds` in `ingest/ingest.ts:118` calls `fetchFeed(feed.url)` **once** — there
is no retry, unlike the model calls, which are wrapped in `withRetry`. A single
unlucky connect timeout therefore drops the feed for the entire day, which is
exactly what `lastSuccess: 2026-08-14`, `consecutiveFailures: 5` records.

**Action:** keep the feed; wrap `fetchFeed` in the existing retry/backoff helper.
This also protects every source added by this feature — the wider the feed list,
the likelier one transient failure per run becomes.

## Appendix C — fresh read-only feed checks, 2026-09-11

Checked the ten configured feeds and twelve proposed additions with native fetch,
the production User-Agent/Accept headers, 20-second timeout and installed
`rss-parser`. Four concurrent probe workers; one request per endpoint; no model
calls, environment-secret loading, project data writes or ingestion. The initial
sandbox attempt returned EACCES for all endpoints, an environment restriction,
not evidence of broken feeds. The authorized host-network retry produced the
results below. A successful single probe does not establish long-term reliability
or GitHub Actions reachability. Dates are UTC; items are returned feed size, not
new/classifiable volume.

| Feed | Result | Returned items | Newest item (UTC) |
| --- | --- | --- | --- |
| The Verge AI | Parsed | 10 | 2026-09-10 19:44:20 |
| TechCrunch AI | Parsed | 19 | 2026-09-10 21:51:59 |
| Ars Technica AI | Parsed | 20 | 2026-09-10 18:14:14 |
| VentureBeat AI | HTTP 429 | — | — |
| Anthropic News | HTTP 404 | — | — |
| OpenAI Blog | Parsed | 1189 | 2026-09-10 16:00:00 |
| Google DeepMind | Parsed | 100 | 2026-09-08 14:00:15 |
| MIT Tech Review AI | Parsed | 10 | 2026-09-10 11:00:00 |
| arXiv cs.AI | Parsed | 245 | 2026-09-10 04:00:00 |
| Hacker News (AI) | Parsed | 20 | 2026-09-10 17:23:42 |
| AI Business | Parsed | 50 | 2026-09-10 22:38:37 |
| The Decoder | Parsed | 10 | 2026-09-10 17:47:35 |
| The Register AI/ML | Parsed | 50 | 2026-09-10 04:53:32 |
| Simon Willison | Parsed | 30 | 2026-09-10 23:44:15 |
| Hugging Face blog | Parsed | 861 | 2026-09-10 00:00:00 |
| GitHub blog | Parsed | 10 | 2026-09-10 21:31:19 |
| Computer Weekly | Parsed | 20 | 2026-09-10 12:14:00 |
| Guardian AI | Parsed | 20 | 2026-09-10 22:35:16 |
| Indeed Hiring Lab | Parsed | 10 | 2026-09-10 10:00:00 |
| Personnel Today | Parsed | 15 | 2026-09-10 15:49:09 |
| SCMP Tech | Parsed | 50 | 2026-09-10 13:30:08 |
| Unwire.hk | Parsed | 10 | 2026-09-10 10:02:29 |

Current code inspection also found that `dedupeIncoming` lowercases the entire
URL and discards every query parameter. Section 4 proposes a separate comparison
key that preserves meaningful queries and path case. The generic fetch error
cannot currently be retried by the OpenAI-specific `withRetry` helper without
an appropriate feed error classifier; section 4 supersedes Appendix B's simpler
historical instruction to wrap that helper directly.

Documentation verification on 2026-09-11 passed: all eight proposal sections are
present, 12 additions and 20 successful/2 failed probe results are recorded,
`plan.md` remains absent, `git diff --check -- specs` passes, and `feeds.json`
plus `public/news.json` are unchanged. No application-test pass is claimed.
