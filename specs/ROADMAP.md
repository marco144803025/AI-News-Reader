# Roadmap

Features are listed in execution order. Each row links to its spec folder. A
feature must reach **Done** before the next starts, unless explicitly parallelized.

| #   | Feature                                                          | Status      | Phase      |
| --- | ---------------------------------------------------------------- | ----------- | ---------- |
| F0  | [Repository setup & CI](./F0-repo-and-ci/)                       | Done        | Foundation |
| F1  | [Smarter ingestion](./F1-smarter-ingestion/)                     | Build       | Backend    |
| F2a | [Trending topics](./F2a-trending-topics/)                        | Not started | UX         |
| F2b | [Desktop notifications](./F2b-desktop-notifications/)            | Not started | UX         |
| F2c | [Dark mode / Reader UI redesign](./F2c-dark-mode/)               | Done        | UX         |
| F2d | [Category taxonomy expansion](./F2d-category-taxonomy/)          | Done        | UX         |
| F3  | [Richer content](./F3-richer-content/)                           | Not started | Content    |
| F4  | [Search & tag filtering](./F4-search-and-tags/)                  | Not started | UX         |
| F6  | [UI modernization (A/B flag)](./F6-ui-modernization/)            | Not started | UX         |
| F5  | [Email subscriptions per tag](./F5-email-subscriptions/)         | Not started | UX         |

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

**F2a: Trending topics.** Aggregate entity / category counts across the rolling
archive; surface a "trending this week" panel with deltas vs prior week.

**F2b: Desktop notifications.** When a freshly ingested article matches a
user-defined topic of interest, fire a system notification (Web Notifications API
in PWA mode; fall back to in-app toast).

**F2c: Dark mode / Reader UI redesign.** ✓ Done. Permanent dark-academic theme
(no toggle — deliberate). Tab rail replaces dropdown. Pagination (8/page),
All-view preview (4/section), featured first card, editorial byline layout,
ember notable border. Design system in `.interface-design/system.md`.
See [spec divergence note](./F2c-dark-mode/spec.md).

**F2d: Category taxonomy expansion.** ✓ Done. Expanded from 6 broad categories
to 12 specific ones. Classifier prompt rewritten with per-category scope
descriptions. 7-day transition window for existing articles.

## Phase 3 — Content depth

**F3: Richer content.** Move beyond RSS excerpts:
- Fetch full article HTML, run through Mozilla Readability to extract clean text.
- Cluster duplicate stories across outlets (embedding similarity, threshold-based).
- Entity extraction in the same Claude call as categorization: pull model names
  (`GPT-5`, `Claude 4.7`...), companies, products. Surface as filterable chips.

**F4: Search & tag filtering.** Client-side keyword search over titles and
summaries; tag/keyword chips as multi-select filters; URL-shareable filter state
(`?q=…&tags=…`). Initially uses existing categories and naive keyword tokens;
upgrades automatically once F3 entity extraction lands.

**F6: UI modernization (A/B feature flag).** Build a second "modern/fancy"
design lineage alongside the current dark-academic theme. Specifically targets
the horizontal category scroll (replace with something more modern), card
motion/hover, and typographic accents. Toggle via URL param or localStorage so
both designs can be compared side-by-side before committing. Explicitly revisits
F2c's "no toggle" stance for this experiment.

**F5: Email subscriptions per tag.** Users subscribe to one or more tags and
receive a digest when matching articles are ingested. ⚠️ Conflicts with
Constitution rule #1 (no server runtime / no database). Spec must resolve one
of: third-party form provider (Buttondown / Mailchimp / Resend + tiny
serverless function), GitHub Actions cron digest with externalized storage, or
a constitutional amendment. Path to be chosen during Gate 1.

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
