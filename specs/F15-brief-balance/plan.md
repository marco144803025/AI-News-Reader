# F15 daily brief category balance — Plan

**Spec:** [spec.md](./spec.md)
**Status:** Done — published implementation and scheduled hosted verification complete

Gate 2 approval — 2026-09-17: Marco replied “proceed” to this plan. The
implementation tasks below are authorized. No hosted paid ingest is implied.

## Approach

Keep balancing inside the existing pure `selectBriefInput()` stage in
`ingest/lib.ts`. The selector will retain the current last-24-hour filter,
important-first ordering and 50-article maximum, then admit candidates in that
stable order while enforcing the approved category and source quotas. Quotas are
calculated from `targetPool = min(recentCandidateCount, 50)`: category at 40%
and source at 30%, rounded up with a minimum of one.

The selector will return the articles plus internal statistics. `runIngest()`
will log those statistics before the existing brief call and pass only the
selected articles to `generateBrief()`. The persisted `Brief`, `NewsData`,
Telegram payload and client code remain unchanged. If diversity is unavailable,
or two active quotas would leave fewer than three candidates, the selector will
apply the smallest approved fallback and record it in the log.

## Affected files

- `ingest/lib.ts` — add the internal selection/statistics types, quota constants,
  deterministic balanced selector and human-readable statistics formatter.
- `ingest/ingest.ts` — consume the selector result, log composition/fallbacks,
  warn for selected `Unknown` labels, and keep existing brief generation and
  carry-forward behavior.
- `ingest/__tests__/brief.test.ts` — cover quota arithmetic, ordering, source and
  category fallbacks, minimum-input recovery, malformed labels and determinism.
- `ingest/__tests__/pipeline.test.ts` — prove the integrated log is emitted and
  the balanced articles are passed to exactly one brief-generation call.
- `specs/F15-brief-balance/spec.md` — retain the Gate 1 approval record and add
  implementation/verification results as work completes.
- `specs/F15-brief-balance/plan.md` — track implementation tasks, deviations and
  verification evidence.
- `specs/ROADMAP.md` — move F15 from Plan to Build before code, then Done only
  after the required verification is complete.

No new dependency is required. `src/types.ts`, `src/components/`,
`.github/workflows/`, F11 delivery code and F12 language code are deliberately
not modified.

## Data contracts

The approved internal types are defined alongside the existing brief helpers in
`ingest/lib.ts`:

```ts
export type BriefInputFallback =
  | "single-category"
  | "single-source"
  | "minimum-input";

export type BriefInputStats = {
  candidateCount: number;
  selectedCount: number;
  inputCap: number;
  categoryCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  fallbacks: BriefInputFallback[];
};

export type BriefInputSelection = {
  articles: Article[];
  stats: BriefInputStats;
};

export function selectBriefInput(
  articles: Article[],
  now?: number
): BriefInputSelection;
```

The `Brief` and `NewsData` JSON shapes are unchanged. `categoryCounts` and
`sourceCounts` describe only the selected input; the logger sorts their keys for
stable output. Blank labels use the accounting key `Unknown` without mutating
the source article. The formatter emits one line in this form:

```text
Brief input: 18 candidates -> 12 selected; categories Applications=2, MCP=2, Research=8;
sources OpenAI Blog=3, The Verge AI=3, arXiv cs.AI=6; fallbacks none.
```

## Tasks

- [x] Record Gate 1 approval in `spec.md`, set the F15 roadmap row to `Plan`,
  and freeze the approved quota/fallback/logging decisions in this plan.
- [x] Add `BriefInputFallback`, `BriefInputStats`, `BriefInputSelection`,
  `BRIEF_CATEGORY_SHARE = 0.40` and `BRIEF_SOURCE_SHARE = 0.30` to the brief
  helper module without changing persisted types.
- [x] Refactor `selectBriefInput()` to produce the existing 24-hour,
  important-first/newest-first candidate order and calculate the target pool
  and rounded-up category/source quotas.
- [x] Implement deterministic quota admission: scan candidates in order,
  enforce both active quotas, continue scanning for under-quota alternatives,
  stop at the target pool, and count selected categories/sources.
- [x] Implement explicit fallback detection. Disable only a category or source
  quota when all candidates share that bucket; when at least three candidates
  exist but quota admission selects fewer than three, try one-quota relaxation
  before two-quota relaxation and record `minimum-input`.
- [x] Add `Unknown` accounting for blank category/source labels and expose the
  counts through the normal composition line/warning without mutating articles.
- [x] Update `runIngest()` for the selection object, emit composition diagnostics
  before model generation, and preserve `briefStatus`, carry-forward and the
  single existing `generateBrief()` call.
- [x] Update the existing brief unit tests for the new return shape and add
  deterministic fixtures for balanced, arXiv-heavy, single-category,
  single-source, minimum-input and malformed-label cases.
- [x] Add a pipeline fixture that asserts the composition log, the selected
  article URLs passed to the fake brief generator, and exactly one brief call;
  retain the existing no-new-material and failure-isolation assertions.
- [x] Run the local verification commands in §Verification, inspect the staged
  diff and record actual outputs in this plan.
- [x] Use the owner-selected scheduled hosted ingest, verify the
  `Brief input:` log, successful deployment and unchanged persisted brief shape,
  then record the hosted evidence and move F15 to `Done`.

## Verification

Maps to acceptance criteria in `spec.md`:

- **AC1–AC3:** `npm test` exercises the 24-hour filter, 50-item cap,
  quota arithmetic, deterministic ordering and repeat selection.
- **AC4:** the arXiv-heavy unit fixture proves Research is capped when
  alternative category/source candidates exist and no fallback is recorded.
- **AC5:** single-category and single-source fixtures prove only the unavailable
  quota is relaxed and the corresponding fallback is logged.
- **AC6:** the minimum-input fixture proves a two-quota admission shortfall is
  recovered to at least three candidates when three exist.
- **AC7:** the pipeline test asserts candidate/selected counts, category/source
  composition and fallback text are logged before generation.
- **AC8:** TypeScript type-checking plus the existing pipeline/F11/F12 tests
  prove no persisted `Brief`, `NewsData` or delivery shape changed and no extra
  model call was added.
- **AC9:** the complete test suite and build are the regression gate.

Marco runs these commands in Windows `cmd` after Gate 2 approval and
implementation:

```cmd
cd /d F:\project\AI-news
npm test
npx tsc -b
npm run build
git diff --check
```

Expected output is zero test failures, `npx tsc -b` exit code 0 with no
diagnostics, a successful Vite build, and no whitespace errors. Because the
hosted ingest can spend on DeepSeek and send the personal Telegram brief, it is
not part of the local default commands. After Marco authorizes it, the hosted
run must complete successfully, expose the `Brief input:` diagnostic, return
HTTP 200 for the deployed page and `news.json`, and retain the existing Brief
fields and bilingual/delivery behavior.

## Verification record — 2026-09-17

- `npx tsc -b` — exit 0 with no diagnostics.
- `npm test` — **253 tests passed, 0 failed**. This includes the seven new F15
  selector and pipeline assertions. The plain Windows invocation first stopped
  before test discovery with `uv_os_get_passwd returned ENOMEM`; rerunning with
  a temporary external `os.userInfo()` shim passed, and the shim was removed.
- `npm run build` — Vite completed successfully after transforming 69 modules.
- `git diff --check` — no whitespace errors; only expected CRLF conversion
  warnings from Git on this Windows checkout.

At this checkpoint the hosted task remained unchecked. Marco subsequently chose
to leave verification to automatic ingestion; the scheduled evidence below
supersedes that pending status. No additional paid run was dispatched.

## Scheduled hosted evidence — 2026-09-20

- Scheduled `Daily Ingest & Deploy` run **#135** (`35504591394`) ran against
  commit `5616b0a20b524e89de41e85a08c0be5ec008a930` and completed successfully.
- The hosted job's ingest, build, Pages deployment and Telegram-send steps all
  reported success.
- The deployed page and `news.json` returned HTTP 200. The live payload had
  `briefStatus: "generated"`, retained the existing `brief` keys
  (`bullets`, `generatedAt`, `headline`, `headlineZhHK`), and retained bullet
  keys (`refs`, `text`, `textZhHK`).
- On 2026-09-21 the existing signed-in browser exposed the job logs. The earlier
  unauthenticated API/page failure did not establish an administrator-only
  requirement. The exact line in step 7 was:

```text
Brief input: 32 candidates -> 32 selected; categories AI Safety & Alignment=7, Applications=4, Business & Funding=3, Developer Tools=1, Model Releases=1, Other=3, Regulation & Policy=8, Research=4, Robotics=1; sources Guardian AI=8, TechCrunch AI=7, The Decoder=9, The Verge AI=4, Unwire.hk=4; fallbacks none.
```

- Category quota was 13 and source quota 10; observed maxima were 8 and 9.
  The following lines confirmed generation from 32 inputs and `brief ok (5 bullets).`
  Step 11 confirmed `Telegram: sent`, not merely a successful skipped step.
- Evidence: [job log](https://github.com/marco144803025/AI-News-Reader/actions/runs/35504591394/job/106062146236).
  Personnel Today 403 and Hacker News 429 were visible feed failures (18/20
  feeds succeeded), not F15 failures; no feed configuration was changed.

## Review follow-up — 2026-09-21

Marco requested review, fixes and continuation of Luna's F6/F15 work. A Sol
`high` review found no selector/integration defect, but the dominant-category
fixture did not exceed either quota and the pipeline assertion did not specify
exact input. The follow-up strengthens those existing approved test tasks;
it does not change the published quota policy or add a model call.

- Strengthened selector fixture: 20 candidates, exactly 16 selected; Research=8,
  arXiv=6, skipped dominant inputs excluded, later alternatives included by URL.
- Strengthened pipeline fixture: exactly five expected URLs reach the sole
  synthesis call from eight candidates; exact composition line is asserted.
- Main-agent final `npm test`: 253 tests, 57 suites, 253 pass, 0 fail, 0 skipped.
  Executed outside the Windows sandbox without a shim after its userInfo error.
- Both flag builds passed (`npm run build`, including `tsc -b`); final build
  used `VITE_ENABLE_EXTRA=false`. One intermediate default build overlapped the
  reviewer's temporary quota mutation and reported TS18048; after restoring
  `ingest/lib.ts` unchanged, the default build passed. No production selector
  change or temporary mutation remains.

## Risks / tradeoffs

- Two simultaneous quotas can under-fill the input even when articles exist;
  the minimum-input fallback preserves a valid brief and discloses the
  relaxation.
- A notable article can be skipped when its category or source is already at
  quota. This deliberately prioritizes a representative brief over the old
  notable-first-only behavior; the original order remains the tie-breaker.
- Category and source values are classifier/feed strings rather than closed
  enums. `Unknown` accounting and a warning keep malformed labels visible
  without corrupting the original article.
- The 40%/30% defaults are based on the available target pool, so a small pool
  can still be under-filled. This is explicit in the stats and is not presented
  as a full day's coverage.
- Selection changes the model's input, not the article archive. The integration
  test must verify that only one existing synthesis call is made and that
  carry-forward behavior is untouched.
