# Roadmap

Features are listed in execution order. Each row links to its spec folder. A
feature must reach **Done** before the next starts, unless explicitly parallelized.

| #   | Feature                                                  | Status      | Phase    |
| --- | -------------------------------------------------------- | ----------- | -------- |
| F0  | [Repository setup & first push](./F0-repo-and-ci/)       | Not started | Foundation |
| F1  | [Smarter ingestion](./F1-smarter-ingestion/)             | Not started | Backend  |
| F2a | [Trending topics](./F2a-trending-topics/)                | Not started | UX       |
| F2b | [Desktop notifications](./F2b-desktop-notifications/)    | Not started | UX       |
| F2c | [Dark mode](./F2c-dark-mode/)                            | Not started | UX       |
| F3  | [Richer content](./F3-richer-content/)                   | Not started | Content  |

## Phase 0 — Foundation

**F0: Repository setup & first push.** Initialize git, write a project-level
`CONTRIBUTING.md` that points at the SDD workflow, push to GitHub. Establishes
the baseline before any feature work.

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

These three are independent; can run in parallel after F1.

**F2a: Trending topics.** Aggregate entity / category counts across the rolling
archive; surface a "trending this week" panel with deltas vs prior week.

**F2b: Desktop notifications.** When a freshly ingested article matches a
user-defined topic of interest, fire a system notification (Web Notifications API
in PWA mode; fall back to in-app toast).

**F2c: Dark mode.** Tailwind class-based theme toggle, persists in localStorage,
respects `prefers-color-scheme` by default.

## Phase 3 — Content depth

**F3: Richer content.** Move beyond RSS excerpts:
- Fetch full article HTML, run through Mozilla Readability to extract clean text.
- Cluster duplicate stories across outlets (embedding similarity, threshold-based).
- Entity extraction in the same Claude call as categorization: pull model names
  (`GPT-5`, `Claude 4.7`...), companies, products. Surface as filterable chips.

## Cross-cutting (planned later)

These don't have a phase yet — they get specced when one of the above forces them:

- Engineering hardening: test suite, GitHub Actions CI, eval harness for
  categorization quality.
- Migration from `public/news.json` to SQLite (likely triggered by F1's rolling
  archive growing beyond ~5 MB).
