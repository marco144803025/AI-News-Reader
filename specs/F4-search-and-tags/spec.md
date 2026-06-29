# Search & tag filtering

**ID:** F4-search-and-tags
**Status:** Done (UI shipped; backfill pending — see notes)
**Owner:** marco14480

## Completion notes

Both stages implemented. 33 unit tests pass (`npm test`), typecheck clean
(`npx tsc --noEmit`), browser smoke through Vite dev confirms AC9–AC16.

- **Stage 1 (ingest):** `Tags` type, `SEED_TAGS`, `TAG_ALIASES`,
  `normalizeTags` in `ingest/lib.ts`; classifier prompt and parser
  extended in `ingest/ingest.ts`; `classifyBatch` now exported so
  `ingest/backfill.ts` can reuse it. `ingest/backfill.ts` is a one-shot
  idempotent re-classifier with `--force`; runs via `npm run backfill`.
- **Stage 2 (UI):** pure `src/lib/filter.ts` with AND-across / OR-within
  semantics; `useUrlState` hook reads/writes
  `?q=&topics=&traits=&entities=&category=` with `pushState` + `popstate`
  listener; `TagChips` grouped by dimension with distinct color tokens
  (topics→neutral, traits→ember, entities→accent); `FilterBar` mounted
  below the tab rail with universe scoped to the current category and
  orphan handling for previously-selected-but-now-unavailable chips;
  `App.tsx` rewired to use `filterArticles` and `useUrlState` as source
  of truth; empty state with clear-filters CTA (AC16).
- **AC14 nuance:** `useUrlState` writes via `pushState` so back/forward
  navigates filter history. Confirmed in browser: pushState + popstate
  round-trips state correctly.
- **AC8 forward-compat:** verified — pre-backfill articles render
  without chips and don't throw. Untagged articles are excluded from
  results once any group filter is active (documented test).
- **Pending operator step:** run `npm run backfill` against live
  `public/news.json` to populate tags for the existing ~185 archived
  articles (AC7). Estimated cost ≈ $1–2. Not done automatically —
  requires API key + spend authorization.
- **Roll-out window:** between this commit and the backfill commit, new
  articles get tags and older ones don't. UI degrades gracefully.

## Bundled work: ingest verification harness (formerly F1a)

Originally tracked as a separate feature `F1a-ingest-verification`; merged
into this spec for cleaner history since the two were committed together.
What shipped:

- `ingest/lib.ts` now hosts pure helpers extracted from `ingest/ingest.ts`:
  `computeEffectiveDaysBack`, `withRetry` (with injectable `sleep` /
  `onDelay`), `buildFeedHealth`, `computeGeneratedAt`,
  `parseRetentionDays`. The orchestrator (`ingest/ingest.ts`) is reduced
  to glue.
- `ingest/__tests__/lib.test.ts` covers the F1 failure modes with
  `node:test` (17 cases pre-F4; 23 after F4's `normalizeTags` was added).
  Anthropic SDK error classes are constructed directly in tests so
  `withRetry`'s `instanceof` checks run against the real types.
- `.github/workflows/test.yml` runs `npm test` on every PR and push to
  `main`.
- `.github/workflows/ingest.yml` gates the scheduled ingest on `npm test`
  passing before the fetch step runs — a regression on `main` cannot
  corrupt `public/news.json`.

Future ingest changes are now defended by automated tests; the original
F1a spec/plan files have been removed.

## Intent

Articles currently have a single category and no secondary classification.
Categories are good for navigation (the tab rail) but bad for cross-cutting
discovery — a Claude 4.8 release is `Model Releases`, but a reader who wants
"everything about Claude" or "everything commercial" or "everything agentic"
has no way to find it without scanning every tab.

This feature adds a **second classification axis — multi-dimensional tags —
alongside the existing category**, plus a client-side search box and a filter
bar so readers can slice the archive in ways the single-category model
cannot. Categories continue to drive the navigation rail unchanged; tags
power filtering and search.

## User stories

- As a reader, I want articles to carry topic/trait/entity tags in addition
  to a category, so that I can find cross-cutting threads (e.g. "all
  agentic-framework news from Anthropic") without scanning every tab.
- As a reader, I want a search box that matches against titles, summaries,
  and tags, so that I can find an article I half-remember by keyword.
- As a reader, I want chip-based filters grouped by tag dimension (Topics /
  Traits / Entities), so that I can combine "any of these topics" with
  "must have this trait" intuitively.
- As a reader, I want my search and filter state in the URL, so that I can
  bookmark a slice or share it with someone.
- As a reader on a category tab, I want filters to apply within that
  category, so that "Topics: agentic" on the `MCP` tab shows MCP articles
  about agents, not every agentic article ever.

## Design decisions (resolved before spec)

- **Schema:** tags live *alongside* categories, not replacing them. Every
  article keeps its single `category`; gains a grouped `tags` object.
- **Vocabulary:** **hybrid.** Seed list of ~25 known-good tags per group in
  the classifier prompt; classifier may emit additional tags; a
  normalization pass (lowercase, kebab-case, alias map) runs at write time
  to prevent `LLM` / `llm` / `large-language-model` drift.
- **Cap:** at most **6 tags total** per article (across all groups
  combined). Classifier instructed to pick the most salient.
- **Groups:** three fixed dimensions.
  - **Topics** — subject matter (`llm`, `agentic`, `multimodal`,
    `reasoning`, `safety`, `inference`, …)
  - **Traits** — nature of the article (`commercial`, `open-source`,
    `research`, `policy`, `funding`, `benchmark`, `tutorial`, …)
  - **Entities** — orgs, models, products (`anthropic`, `openai`,
    `claude`, `gpt`, `gemini`, `meta`, …)
- **Filter semantics:** **AND across groups, OR within group.** Selecting
  `topics=agentic,llm` + `traits=commercial` means
  `(agentic OR llm) AND commercial`.
- **Search scope:** title + summary + tags (all three groups). Source name
  is *not* searched (kept simple; can be added later as a dropdown).
- **URL state:** `?q=<text>&topics=a,b&traits=c&entities=d&category=MCP`.
  Empty params omitted. Browser back/forward navigates filter history.
- **Backfill:** all existing articles in `public/news.json` are
  re-classified once at feature launch to populate tags. One-shot ingest
  run, no migration of historical data otherwise.
- **Delivery:** one spec, **two-stage plan** (ingest first so data exists,
  then UI). Tagged data ships before the UI consumes it — the UI degrades
  to "no tags shown" if a record lacks them, so the two stages can land in
  separate commits without breaking the live site.

## Acceptance criteria

EARS form. AC1–AC8 cover ingest; AC9–AC16 cover UI.

### Ingest

- **AC1 (schema):** WHEN the ingest writes an article to `news.json`, THEN
  the article object SHALL contain a `tags` field of shape
  `{ topics: string[]; traits: string[]; entities: string[] }`.
- **AC2 (cap):** WHEN the classifier returns more than 6 tags total for an
  article (summed across groups), THEN the ingest SHALL truncate to the
  first 6 in classifier-emitted order, preserving group balance where
  possible.
- **AC3 (normalization):** WHEN the classifier emits a tag in any of the
  forms `LLM`, `llm`, `Llm`, `large-language-model`, THEN the written tag
  SHALL be the single canonical form `llm`.
- **AC4 (alias map):** WHEN the classifier emits a tag matching a
  configured alias (e.g. `gpt-4`, `gpt-5`, `gpt-4o` → `gpt`), THEN the
  written tag SHALL be the canonical alias target.
- **AC5 (kebab-case):** WHEN the classifier emits a multi-word tag (e.g.
  `Open Source`, `Foundation Model`), THEN the written tag SHALL be
  lowercase kebab-case (`open-source`, `foundation-model`).
- **AC6 (group placement):** WHEN the classifier emits a tag known to
  belong to a specific group (per seed vocabulary), THEN it SHALL appear in
  that group's array, not another's. Unknown tags default to `topics`.
- **AC7 (backfill):** WHEN the launch ingest run completes, THEN every
  article in `public/news.json` SHALL have a `tags` field populated (no
  article retains the pre-feature shape).
- **AC8 (forward compat):** WHEN the UI reads an article missing the `tags`
  field (e.g. during the brief window before the launch ingest commit
  lands), THEN it SHALL render the article normally with no tag chips and
  not throw.

### UI

- **AC9 (chip rendering):** WHEN an article has tags, THEN its card SHALL
  display the tags as visually distinct chips grouped by dimension
  (Topics / Traits / Entities), respecting the existing dark-academic
  design system.
- **AC10 (search input):** WHEN the user types in the search box, THEN the
  visible article list SHALL filter in real time to articles whose title,
  summary, or any tag (any group) contains the query as a case-insensitive
  substring.
- **AC11 (filter bar — within group):** WHEN the user selects multiple
  chips in a single group (e.g. Topics: `agentic` + `llm`), THEN the
  visible list SHALL include articles matching *any* of those chips
  (OR within group).
- **AC12 (filter bar — across groups):** WHEN the user has selections in
  multiple groups, THEN the visible list SHALL include only articles that
  match the within-group condition for *every* group with a selection
  (AND across groups).
- **AC13 (filter + category):** WHEN the user is on a category tab and
  applies filters, THEN filtering SHALL operate within that category's
  articles only (not the whole archive).
- **AC14 (URL state — write):** WHEN the user changes the search text or
  any chip selection, THEN the URL SHALL update to reflect the new state
  using `?q=…&topics=…&traits=…&entities=…&category=…` (empty params
  omitted), via `history.pushState` (no full reload).
- **AC15 (URL state — read):** WHEN the page loads with filter params in
  the URL, THEN the search box, chip selections, and active category tab
  SHALL initialize from those params.
- **AC16 (empty state):** WHEN search + filter combination matches zero
  articles, THEN the list SHALL render a clear "no matches" empty state
  with a one-click "clear filters" affordance.

## Non-goals

- **Removing categories.** The single-category navigation rail stays;
  tags are additive. Migrating to a tag-only navigation model is out of
  scope.
- **Full-text article fetching.** Search operates on existing
  title/summary/tags only — no Readability extraction, no body indexing.
  (Was previously scoped under F3, now deleted.)
- **Entity/orgs as a separately curated knowledge base.** Entities are
  whatever the classifier extracts, normalized; no canonical-entity-id
  layer.
- **Fuzzy search / typo tolerance / stemming.** Plain substring match is
  enough for an archive this small (~500 articles at 30-day retention).
- **Server-side search or search index files.** Everything runs in the
  browser against the existing `news.json`.
- **Saved searches, search history, or any persistent user state beyond
  the URL.**
- **Cross-category filter UI on the "All" view** beyond what falls out of
  AC13 naturally — i.e. no special "global filter" mode.
- **Backfilling older-than-30-day articles** (none exist; retention is 30
  days).
- **Tag editing UI / manual tag correction.** Tags are model-emitted and
  normalized; no human-in-the-loop edit path.

## Open questions

None — all design decisions resolved above and confirmed by the user.
