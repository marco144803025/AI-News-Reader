# SPEC: Daily brief category balance

**ID:** F15-brief-balance
**Status:** Done — published implementation and scheduled hosted verification complete
**Owner:** Marco

## 1. Problem statement

The daily brief input is currently ordered by importance and recency only, so a
burst from one source or category can dominate the entire briefing. The most
visible example is an arXiv burst: the 2026-09-07 archive was 83% Research
(13 of 18 articles), even though the rest of the archive is usually balanced.
F15 should make the brief-input pool more representative while preserving the
existing global brief, citations, bilingual output and delivery contracts.

## 2. Constraints

- The repository is a static React/Vite site; balancing runs only inside the
  existing offline, idempotent GitHub Actions ingest pipeline.
- Use the existing TypeScript/ESM stack, `selectBriefInput()` flow and installed
  dependencies. Add no package and make no client-side network request.
- Preserve the existing last-24-hour input window and maximum input size of 50
  articles. This is a brief-input cap, not a change to F13's ingestion cap or
  arXiv's ingestion sub-cap.
- Preserve the existing `Brief`, `BriefBullet`, `NewsData`, `briefStatus`, F11
  Telegram and F12 English / `zh-HK` contracts. No new persisted JSON field is
  required for the balance statistics.
- Keep notable articles weighted toward inclusion, but apply the diversity
  limits deterministically so identical inputs and timestamps produce identical
  selections.
- Composition and fallback decisions must be logged in the ingest output so a
  degraded or under-filled pool is visible under the Constitution's failure
  rules.

## 3. Non-goals

- No separate per-category or per-source briefs; F15 keeps one global brief.
- No UI controls, reader preferences or category-specific filtering changes.
- No reclassification, article re-ranking outside the brief-input selector, or
  changes to the articles stored in `news.json`.
- No new source feeds, source retirement, model provider change or additional
  model call. The brief still uses one existing synthesis call when eligible.
- No historical brief archive and no persisted analytics dashboard for the
  composition statistics.

## 4. Interfaces & data shapes

The selector keeps the existing article input and returns the selected articles
with diagnostic metadata for the ingest logger. The metadata is internal and is
not written into `news.json`.

```ts
export type BriefInputFallback =
  | "single-category"
  | "single-source"
  | "minimum-input";

export type BriefInputStats = {
  candidateCount: number;       // valid articles in the last 24 hours
  selectedCount: number;        // articles passed to the brief model
  inputCap: number;             // 50 by default
  categoryCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  fallbacks: BriefInputFallback[];
};

export type BriefInputSelection = {
  articles: Article[];          // important-first, then newest-first
  stats: BriefInputStats;
};

export function selectBriefInput(
  articles: Article[],
  now?: number
): BriefInputSelection;
```

Recommended default quotas are calculated from
`targetPool = min(candidateCount, inputCap)`:

- one category may contribute at most `max(1, ceil(targetPool * 0.40))`;
- one source may contribute at most `max(1, ceil(targetPool * 0.30))`.

The selector first keeps the existing last-24-hour filter, then walks the
existing important-first/newest-first order while admitting an article only if
both quotas allow it. It continues through the candidates to fill the pool
with under-quota categories and sources. A candidate's original `category`,
`source`, title, URL and ordering are not mutated.

Example diagnostic record (for a candidate pool of 18 with an arXiv-heavy
burst):

```json
{
  "candidateCount": 18,
  "selectedCount": 12,
  "inputCap": 50,
  "categoryCounts": {"Research": 8, "Applications": 2, "MCP": 2},
  "sourceCounts": {"arXiv cs.AI": 6, "OpenAI Blog": 3, "Simon Willison": 3},
  "fallbacks": []
}
```

The ingest log renders the same information in a compact human-readable line,
for example:
`Brief input: 18 candidates -> 12 selected; categories Research=8,
Applications=2, MCP=2; sources arXiv cs.AI=6, OpenAI Blog=3, Simon
Willison=3; fallbacks none.`

## 5. Edge cases

- **No recent candidates:** return an empty selection, log zero candidates and
  do not call the brief model. Existing `briefStatus: "no-new-material"` and
  carry-forward behavior remain unchanged.
- **One category only:** relax the category quota, select up to the existing
  input cap, add `"single-category"` to `fallbacks`, and log the fallback. Do
  not fabricate diversity or discard the day's only material.
- **One source only:** apply the same explicit fallback for the source quota with
  `"single-source"`; the category quota remains active if other categories are
  genuinely available.
- **A dominant category/source with alternatives:** enforce both quotas and
  continue scanning for under-quota alternatives. Do not let notable status
  bypass a quota; retain the existing rank within the admitted candidates.
- **Quota filtering leaves fewer than three articles while at least three valid
  candidates exist:** relax the smallest number of quotas needed to admit at
  least three, add `"minimum-input"`, and log the relaxation so a valid brief is
  not suppressed silently.
- **Missing or blank category/source on an old article:** count it under an
  explicit `Unknown` bucket for quota accounting, preserve the original article
  unchanged, and emit a warning naming the affected count.
- **Brief generation fails after balanced selection:** retain the existing
  failure isolation and carry-forward behavior; the selection log must still
  show what was submitted.
- **Repeated run with the same archive and timestamp:** return the same ordered
  article URLs and the same statistics; no article or persisted brief data is
  mutated by selection.

## 6. Acceptance criteria

1. Given a deterministic fixture, `selectBriefInput()` considers only valid
   articles published in the last 24 hours and never returns more than 50.
2. With the recommended defaults and enough alternatives, no selected category
   exceeds 40% of `targetPool` and no selected source exceeds 30% of
   `targetPool`, subject only to the documented fallback rules.
3. The selector remains deterministic and preserves important-first/newest-first
   order among candidates that satisfy the quotas.
4. An arXiv-heavy fixture containing alternative categories produces a selected
   pool with the Research quota applied and records no silent fallback.
5. Single-category and single-source fixtures relax only the unavailable quota,
   preserve available articles up to the input cap, and record the matching
   fallback.
6. A fixture where quota filtering would leave fewer than three valid articles
   records `"minimum-input"` and admits at least three whenever three candidates
   exist.
7. The ingest log records candidate count, selected count, category counts,
   source counts and any fallback for every brief-selection attempt.
8. The persisted `Brief`, `BriefBullet`, `NewsData` and Telegram payload shapes
   are unchanged, and no additional model request is made solely for balancing.
9. Existing F8, F11 and F12 tests continue to pass, and new unit tests cover
   quotas, ordering, all fallbacks, malformed labels and deterministic reruns.

## 7. Verification plan

Marco runs these commands in Windows `cmd` after the implementation plan is
approved and the code is written:

```cmd
cd /d F:\project\AI-news
npm test
npx tsc -b
npm run build
```

Expected results:

- `npm test` reports the existing suite plus the new F15 selector/logging tests
  with zero failures.
- `npx tsc -b` exits with code 0 and no TypeScript diagnostics.
- `npm run build` exits with code 0 and produces the normal Vite `dist/` build.

The implementation verification must also run the pure selector fixtures from
§5 and capture the exact composition log for the arXiv-heavy and single-category
cases. A separately authorized hosted ingest should then show the same
`Brief input:` diagnostic line and a generated brief without changing the
persisted `Brief` shape. No hosted paid run is implied by this spec approval.

## 8. Open questions

1. [x] Approve the recommended quota defaults: category 40% and source 30% of
   the target pool, rounded up with a minimum of one.
2. [x] Approve the fallback rule that relaxes only an unavailable quota, and
   relaxes the minimum number of quotas needed to preserve three inputs when
   possible.
3. [x] Approve composition statistics as ingest logs only, with no new
   `news.json` field or UI surface.

Gate 1 approval — 2026-09-16: Marco replied “approve”, accepting all three
recommendations above. Gate 2 was approved on 2026-09-17 when Marco replied
“proceed” to the implementation plan. Production implementation is now
authorized; a hosted paid ingest still requires separate authorization.

## Implementation record — 2026-09-17

The balanced selector and ingest diagnostics were implemented in
`ingest/lib.ts` and `ingest/ingest.ts`. Unit and pipeline coverage was added in
`ingest/__tests__/brief.test.ts` and `ingest/__tests__/pipeline.test.ts`.
The persisted `Brief`, `NewsData`, bilingual and Telegram contracts were not
changed.

Verification completed locally: `npx tsc -b` exited 0; the full suite passed
253 tests with 0 failures; `npm run build` completed successfully with Vite;
and `git diff --check` reported no whitespace errors. The first plain `npm test`
attempt exposed the known Windows Node/tsx `uv_os_get_passwd returned ENOMEM`
host issue before tests started; the suite was then rerun successfully with a
temporary external `os.userInfo()` shim, which was removed afterward.

At this checkpoint F15 remained Build pending hosted verification. Marco later
chose automatic ingestion instead of an additional manual paid dispatch; the
scheduled evidence below closes that requirement.

## Scheduled hosted evidence — 2026-09-20

The scheduled `Daily Ingest & Deploy` run #135 completed successfully against
the published F15 commit. Its ingest, build, deployment and Telegram-send steps
reported success; the deployed page and `news.json` returned HTTP 200, with
`briefStatus: "generated"` and the existing `Brief` keys intact.

Review on 2026-09-21 recovered the exact composition line through the existing
signed-in browser: 32 candidates, 32 selected, nine categories, five sources,
and no fallbacks. Category/source maxima were 8/9, below quotas 13/10. Generation
produced five bullets and the delivery log said `Telegram: sent`. Full evidence
and the run link are in the plan. The prior administrator-only access claim was
incorrect; the earlier attempt was unauthenticated. F15 is Done without another
manual paid ingest. Marco's review/fix request also authorizes strengthening the
quota and exact model-input regression fixtures within the approved test scope.
