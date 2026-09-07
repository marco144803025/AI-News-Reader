# Roadmap

Features are listed in execution order. Each row links to its spec folder. A
feature must reach **Done** before the next starts, unless explicitly parallelized.

| #   | Feature                                                          | Status      | Phase      |
| --- | ---------------------------------------------------------------- | ----------- | ---------- |
| F0  | [Repository setup & CI](./F0-repo-and-ci/)                       | Done        | Foundation |
| F1  | [Smarter ingestion](./F1-smarter-ingestion/)                     | Done        | Backend    |
| F2c | [Dark mode / Reader UI redesign](./F2c-dark-mode/)               | Done        | UX         |
| F2d | [Category taxonomy expansion](./F2d-category-taxonomy/)          | Done        | UX         |
| F4  | [Search & tag filtering](./F4-search-and-tags/)                  | Done        | UX         |
| F6  | [UI redesign — Stop the Presses (A/B flag)](./F6-ui-modernization/) | Build    | UX         |
| F5  | [Email subscriptions per tag](./F5-email-subscriptions/)         | Not started | UX         |
| F7  | [Portfolio presentation & shareability](./F7-portfolio-presentation/) | Done   | Portfolio  |
| F8  | [AI Daily Brief](./F8-daily-brief/)                              | Done        | Content    |
| F9  | [Trends & pipeline transparency](./F9-trends-dashboard/)         | Done        | Content    |
| F10 | [DeepSeek API migration](./F10-deepseek-migration/)               | Done        | Backend    |
| F11 | [Personal Telegram morning brief](./F11-telegram-brief/)         | Done        | Delivery   |
| F12 | [English / HK Traditional Chinese summaries](./F12-bilingual-summaries/) | Build | Content |
| F13 | [Source expansion & dedupe](./F13-source-expansion/)             | Not started | Backend    |

F12 requested 2026-09-06 as the next task after Telegram. A spec and draft
implementation plan are documented together at Marco's request for review.
Both were approved with "approved, proceed" on 2026-09-06. Scope: bilingual article summaries and
daily brief, summary-language switch in both website layouts, and Chinese-default
Telegram delivery. Original article headlines and source links remain unchanged.
Implementation is complete locally: 111 tests passed, production build passed,
and both layouts were checked on desktop/mobile with bilingual and legacy
fixtures. Published as `6d67eca`; full workflow run `34051731622` succeeded with
3 new bilingual articles and a 3-bullet bilingual brief, verified on the hosted
site. Telegram skipped today's already-sent delivery. Marco approved the live
sample's authentic Hong Kong Cantonese tone on 2026-09-07, including `嘅` and
`佢`; only an actual eligible Chinese Telegram delivery remains pending. See the
F12 spec's publication evidence.

Current requested sequence (2026-09-06): F10 followed by F11, authorized as a
separate workstream from the existing F6/F5 queue. Marco approved proceeding
with implementation after the F11 technical walkthrough. F10 is implemented
and verified locally against both live DeepSeek models. F11 code is implemented
and published with offline tests passing. Hosted run #117 delivered the committed
brief through Telegram in 29 seconds, completing F11.

## Phase 0 — Foundation

**F0: Repository setup & first push.** ✓ Done. Repo at
`github.com/marco144803025/AI-News-Reader`. Two GitHub Actions workflows:
`deploy.yml` (build + deploy on push) and `ingest.yml` (full ingest + deploy on
schedule / manual dispatch). Site live at
`https://marco144803025.github.io/AI-News-Reader/`.

## Phase 1 — Backend depth

**F1: Smarter ingestion.** The current ingest re-classifies every article on
every run. Goal: cheap, fast, resilient weekly refreshes.

In scope:
- Incremental fetch — track per-feed `lastSeenGuid` / `lastSeenDate`; skip items
  already classified.
- Per-source health — record last-success timestamp, error rate; surface broken
  feeds in the UI ("3 feeds skipped this week").
- Cost-aware batching — group by token budget rather than fixed `BATCH_SIZE`;
  retry on transient API errors with backoff.
- Append-only classification cache (`public/news.json` keeps a rolling 30 days
  of classified articles, not just this week).

## Phase 2 — UX upgrades

**F2c: Dark mode / Reader UI redesign.** ✓ Done. Permanent dark-academic theme
(no toggle — deliberate). Tab rail replaces dropdown. Pagination (8/page),
All-view preview (4/section), featured first card, editorial byline layout,
ember notable border. Design system in `.interface-design/system.md`.
See [spec divergence note](./F2c-dark-mode/spec.md).

**F2d: Category taxonomy expansion.** ✓ Done. Expanded from 6 broad categories
to 12 specific ones. Classifier prompt rewritten with per-category scope
descriptions. 7-day transition window for existing articles.

## Phase 3 — Content depth

**F4: Search & tag filtering.** Client-side keyword search over titles and
summaries; tag/keyword chips as multi-select filters; URL-shareable filter
state (`?q=…&tags=…`). Also bundled the ingest verification harness
(originally tracked as F1a) — `node:test` suite over `ingest/lib.ts` plus
CI test gates on PRs and the scheduled ingest workflow.

**F6: UI redesign — Stop the Presses (A/B feature flag).** Full visual
redesign, same content and logic, with the motif commitment of a stylized
game UI (Persona 5 / P3R / Expedition 33 as reference points): punk newsprint
collage — cream paper + ink black + one breaking-news red, Anton poster
display type, offset-print panels, tilted tape-strip nav and clipping rows,
rubber stamps for NOTABLE, a ransom-word highlight in the lead headline.
Ranked front page (bulletin / lead clipping / clippings list) replaces the
uniform card grid; wrapping tape nav replaces the overflow tab rail. Ships
behind `?theme=extra` + localStorage with the classic dark theme as rollback
(deliberately revisits F2c's "no toggle" stance). Direction mockups iterated
in conversation 2026-07-02 (Morning Wire and Patch Notes directions reviewed
and set aside); Gate 1 pending.

**F5: Email subscriptions per tag.** Users subscribe to one or more tags and
receive a digest when matching articles are ingested. ⚠️ Conflicts with
Constitution rule #1 (no server runtime / no database). Spec must resolve one
of: third-party form provider (Buttondown / Mailchimp / Resend + tiny
serverless function), GitHub Actions cron digest with externalized storage, or
a constitutional amendment. Path to be chosen during Gate 1.

## Phase 4 — Portfolio & insight

Specs and plans drafted 2026-07-02 from a portfolio-readiness review; both
gates approved the same day (open questions resolved with documented defaults —
see each spec). All three are cleared to build; F7 is the cheapest and
highest-impression, so it goes first. The F6 spec was also drafted 2026-07-02
and is being reworked toward a fuller redesign (Gate 1 pending).

**F7: Portfolio presentation & shareability.** The repo is a portfolio piece
but the README still says "local web app" (stale since F0), there is no
LICENSE, and the deployed page has no favicon/meta/OG tags so shared links
unfurl as bare URLs. Overhaul README (pitch, screenshot, live link, badges,
architecture), add LICENSE, add head metadata. Also resolves the
CONSTITUTION.md rule #4 ("no client-side JS frameworks") contradiction with
the React 19 + Vite codebase.

**F8: AI Daily Brief.** A 3–5 bullet executive summary synthesized by Claude
at ingest time from the run's new articles, with per-bullet citations linking
to source articles, rendered above the fold. Cross-article synthesis is the
flagship AI-engineering feature; stays static, costs cents.

**F9: Trends & pipeline transparency.** Client-side trends over the existing
30-day archive: rising/falling tags (7d vs prior 7d), volume-per-day chart,
category mix — plus finally surfacing the `feedHealth` data F1 added to
`news.json` but never rendered ("2/10 feeds failing"). No new infrastructure.

**F10: DeepSeek API migration.** Replace the Anthropic/Claude provider used by
the offline ingestion and backfill commands with DeepSeek while preserving the
static site, generated `news.json` contract, retry behavior, and daily GitHub
Actions workflow. Document exactly where the local and GitHub-hosted API key
must be stored without exposing it to the browser or repository.

**F11: Personal Telegram morning brief.** Deliver the existing cited daily brief
to Marco's private Telegram chat after the scheduled site update. Reuse F10's
generated output without another model call. Include a preview command, safe
credential setup, freshness checks, persistent duplicate protection, and visible
delivery failures while retaining the static website architecture.

**F13: Source expansion & dedupe.** `feeds.json` still holds the original 10
sources from F0 — Anglophone, vendor-heavy, thin on policy and applied AI, and
with no Chinese-language input now that F12 produces Traditional Chinese
summaries. Widen the source list *and* add the controls that make a wider list
safe: cross-source deduplication so one story is one card, and a per-run
classified-article ceiling so extra feeds cannot silently multiply the daily
DeepSeek spend. Adding a source must stay a `feeds.json` edit with no code
change; failures keep flowing through the existing `feedHealth` contract that F9
renders. RSS/Atom only — no scraping, per Constitution rules #1 and #2. Spec is
a stub with open questions on the source shortlist, the dedupe signal, and the
per-run cap; Gate 1 pending.

## Cross-cutting (planned later)

These don't have a phase yet — they get specced when one of the above forces them:

- Engineering hardening: test suite, GitHub Actions CI, eval harness for
  categorization quality.
- Migration from `public/news.json` to SQLite (likely triggered by F1's rolling
  archive growing beyond ~5 MB).

## SDD process note

All features **must** follow the spec → plan → implement workflow documented in
`specs/README.md`. F2c and F2d were implemented without prior specs (retroactively
documented). Starting from F1, specs must be approved before any code is written.
