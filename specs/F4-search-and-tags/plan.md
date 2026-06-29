# Search & tag filtering — Plan

**Spec:** ./spec.md
**Status:** Plan

## Approach

Two stages, landed in order so the live site is never broken:

**Stage 1 — Ingest.** Extend the schema with a grouped `tags` field
(`{ topics, traits, entities }`), expand the classifier prompt to emit tags
alongside category/summary, add a pure `normalizeTags` helper (seed
vocabulary + alias map + kebab-case + group placement + 6-cap) in
`ingest/lib.ts`, and ship a one-shot `ingest/backfill.ts` script that
re-classifies every article currently in `public/news.json`. The UI tolerates
missing `tags` (forward-compat per AC8) so this stage can ship in its own
commit without touching the frontend.

**Stage 2 — UI.** Add a `TagChips` component used by `ArticleCard`, a
`FilterBar` rendered under the tab rail, a `useUrlState` hook for the
`?q=&topics=&traits=&entities=&category=` parameters, and a pure
`filterArticles` module that implements AND-across / OR-within semantics
(tested in isolation). `App.tsx` swaps its inline filter `useMemo` for the
new module, broadens the search to include tags, and threads URL state
through. The dark-academic design system is preserved; chips use existing
surface/accent tokens.

Backfill is a separate `npm run backfill` invocation — kept out of the
scheduled `ingest.yml` workflow so it can't accidentally re-run. Removed
from `package.json` after launch.

## Affected files

### Stage 1 (ingest)

- `src/types.ts` — add `Tags` type; add required `tags: Tags` field to
  `Article`.
- `ingest/lib.ts` — add `SEED_TAGS` (per-group seed vocabulary), `TAG_ALIASES`
  (alias → canonical map), and `normalizeTags(raw: string[]): Tags`
  (kebab-case, dedupe, alias-resolve, group-assign, 6-cap).
- `ingest/ingest.ts` — update classifier system prompt to instruct tag
  emission; extend parsed response schema; pass classifier output through
  `normalizeTags` before merging into the article record.
- `ingest/backfill.ts` — **new.** Load `public/news.json`, re-classify all
  articles in `BATCH_SIZE` batches via `withRetry(classifyBatch)`, write
  back with `tags` populated.
- `ingest/__tests__/lib.test.ts` — add `describe('normalizeTags')` with
  cases for AC2–AC6.
- `package.json` — add `"backfill": "tsx ingest/backfill.ts"` script;
  broaden `"test"` glob to `**/*.test.ts` so new UI-layer tests are
  picked up.

### Stage 2 (UI)

- `src/lib/filter.ts` — **new.** `filterArticles(articles, state)` pure
  function implementing AND-across-groups / OR-within-group + search
  substring match across title/summary/tags. No React dependency.
- `src/lib/__tests__/filter.test.ts` — **new.** `node:test` cases for
  AC10–AC13 semantics on a fixture array.
- `src/hooks/useUrlState.ts` — **new.** Reads/writes
  `URLSearchParams` for `q`, `topics`, `traits`, `entities`, `category`;
  subscribes to `popstate`; calls `history.pushState` on change.
- `src/components/TagChips.tsx` — **new.** Renders a single article's
  tags as visually grouped chips inside the card.
- `src/components/FilterBar.tsx` — **new.** Three chip rows (Topics /
  Traits / Entities) with available tags computed from the current
  category-scoped article set; multi-select; "clear all" affordance.
- `src/components/ArticleCard.tsx` — render `<TagChips />` below the
  summary when `article.tags` exists.
- `src/App.tsx` — replace inline search/category `useMemo`s with
  `filterArticles`; mount `useUrlState`; render `FilterBar`; render
  empty-state with "clear filters" button (AC16).

## Data contracts

```ts
// src/types.ts

export type Tags = {
  topics: string[];
  traits: string[];
  entities: string[];
};

export type Article = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
  category: string;
  summary: string;
  important?: boolean;
  tags?: Tags; // optional in the type for forward-compat (AC8); ingest always writes it
};
```

```ts
// ingest/lib.ts

export const SEED_TAGS: {
  topics: readonly string[];   // ~10–15 seed entries
  traits: readonly string[];   // ~8–10
  entities: readonly string[]; // ~10–15
};

// Map of any alias (already kebab-cased + lowercased) → canonical tag.
// Examples: 'gpt-4' → 'gpt', 'gpt-5' → 'gpt', 'large-language-model' → 'llm'.
export const TAG_ALIASES: Readonly<Record<string, string>>;

export function normalizeTags(raw: string[]): Tags;
```

```ts
// src/lib/filter.ts

export type FilterState = {
  query: string;
  category: string;       // "All" or a category name
  topics: string[];
  traits: string[];
  entities: string[];
};

export function filterArticles(
  articles: Article[],
  state: FilterState,
): Article[];
```

```ts
// src/hooks/useUrlState.ts

export function useUrlState(): [FilterState, (next: FilterState) => void];
```

## Tasks

### Stage 1 — Ingest

- [ ] Add `Tags` type + optional `tags` field to `src/types.ts`.
- [ ] Add `SEED_TAGS` constant in `ingest/lib.ts` with curated seed lists
      per group (Topics, Traits, Entities).
- [ ] Add `TAG_ALIASES` map in `ingest/lib.ts` covering known variants
      (`gpt-4`/`gpt-5`/`gpt-4o`→`gpt`, `large-language-model`→`llm`,
      `claude-3`/`claude-4`→`claude`, etc.).
- [ ] Implement `normalizeTags(raw)` in `ingest/lib.ts`: lowercase →
      kebab-case → alias-resolve → dedupe → group-assign (seed lookup,
      unknown → `topics`) → cap at 6 total (preserve emission order,
      balance groups where possible).
- [ ] Extend classifier prompt in `ingest/ingest.ts` to instruct: "also
      emit up to 6 tags across Topics/Traits/Entities; prefer these seed
      tags when they fit: …". Update response JSON shape to include
      `"tags": string[]` per item.
- [ ] Update `classifyBatch` return type and the parse loop to surface the
      `tags` array; merge into article via `normalizeTags`.
- [ ] Add tag-normalization tests in `ingest/__tests__/lib.test.ts`
      covering AC2 (cap), AC3 (forced canonical), AC4 (alias), AC5
      (kebab-case), AC6 (group placement / unknown→topics).
- [ ] Create `ingest/backfill.ts` — load `news.json`, batch through
      `classifyBatch` with `withRetry`, write back. Idempotent: skip
      articles that already have `tags` populated unless `--force` is
      passed.
- [ ] Add `"backfill"` script to `package.json`; broaden `"test"` glob to
      `**/*.test.ts`.
- [ ] Run `npm test` (existing F1a tests + new tag tests pass) and
      `npx tsc --noEmit`.
- [ ] **Manual launch step** (not in CI): run `npm run backfill` against
      live `news.json`; verify every article has `tags`; commit the
      regenerated `news.json` (AC7).

### Stage 2 — UI

- [ ] Create `src/lib/filter.ts` with `filterArticles` implementing
      AND-across / OR-within + substring match across title + summary +
      flattened tags.
- [ ] Create `src/lib/__tests__/filter.test.ts` covering AC10–AC13
      semantics (within-group OR, across-group AND, category scoping,
      search substring).
- [ ] Create `src/hooks/useUrlState.ts` — initialize from
      `URLSearchParams`, expose `[state, setState]`, write via
      `history.pushState`, listen for `popstate` to update.
- [ ] Create `src/components/TagChips.tsx` — render three small grouped
      chip rows or inline pills (visual choice during impl); honor
      dark-academic tokens.
- [ ] Render `<TagChips article={article} />` from `ArticleCard.tsx`
      below the summary block, guarded by `article.tags &&
      (topics+traits+entities).length > 0` (AC8/AC9).
- [ ] Create `src/components/FilterBar.tsx` — compute available tag
      universe from the current category-scoped article set; render three
      groups of multi-select chips; "clear filters" button.
- [ ] Wire `App.tsx`: replace search/category `useMemo`s with one call to
      `filterArticles`; use `useUrlState` as source of truth for `query`
      / `activeCategory` / `topics` / `traits` / `entities`; mount
      `<FilterBar />` under the tab rail; render empty state (AC16) when
      filtered list is empty.
- [ ] Verify in the browser via Vite dev server: chips render, filters
      narrow the list correctly, URL updates on each change, reload
      restores state, browser back/forward works (AC9–AC16).
- [ ] Update `specs/ROADMAP.md` F4 row to `Done`; append completion notes
      to `specs/F4-search-and-tags/spec.md`.

## Verification

Per stage. ACs map directly:

### Stage 1

- **AC1, AC8:** `src/types.ts` declares `tags?: Tags`; ingest writes it;
  inspection of post-ingest `news.json` confirms shape.
- **AC2–AC6:** unit tests in `ingest/__tests__/lib.test.ts`
  (`normalizeTags` suite).
- **AC7:** post-backfill, `jq '.articles[] | select(.tags == null)'
  public/news.json` returns empty.

### Stage 2

- **AC9:** browser check on a dev build — cards render chips.
- **AC10–AC13:** unit tests in `src/lib/__tests__/filter.test.ts` against
  a fixture; browser smoke confirms wiring.
- **AC14, AC15:** browser check — change a filter, observe URL update;
  reload, observe state restored; press back/forward, observe state
  transitions.
- **AC16:** browser check — apply impossible filter combo, observe empty
  state with working "clear filters" button.

## Risks / tradeoffs

- **Classifier prompt bloat:** adding tag instructions + seed lists
  enlarges the system prompt. Mitigation: prompt already uses
  `cache_control: ephemeral`, so the seed list is cached after the first
  call in a batch sequence. Token cost is bounded.
- **Tag drift despite normalization:** the alias map is hand-maintained;
  the classifier will invent forms we haven't aliased yet. Mitigation:
  log unknown-tag emissions during ingest (`console.log` only); curate
  the alias map over time. The 6-cap and group-defaulting prevent the
  data from being unusable in the meantime.
- **Backfill cost:** one-shot re-classification of ~500 articles ≈
  $1–2 in API spend. Acceptable. Backfill script is idempotent
  (skip-if-tagged) so a partial failure can be resumed.
- **UI filter universe is dynamic:** the FilterBar shows tags from the
  current category-scoped article set, which means the available chips
  change when the user switches tabs. This is desired (no dead chips)
  but means a previously selected chip can disappear from view; the
  filter still applies, and we render the active chip in a "selected
  but not in current universe" state so the user can clear it.
- **No fuzzy match:** typos in search return zero. Spec non-goal. The
  "clear filters" CTA on the empty state mitigates the dead-end feel.
- **`useUrlState` race:** rapid filter changes could enqueue duplicate
  `pushState` calls. Acceptable — browser coalesces; back/forward stack
  may have stutter entries. Not worth a debouncer for this scale.
- **Two-stage rollout window:** between Stage 1 merge and the manual
  backfill run, new articles get tags but old ones don't. UI handles
  this via the `article.tags &&` guard (AC8). Window closes the moment
  the backfill commit lands.
