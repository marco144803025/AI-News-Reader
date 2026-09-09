## Plan: Cinematic standard edition

**Spec:** [spec.md](./spec.md) — approved by Marco on 2026-09-08.
**Status:** Build — implementation complete locally on 2026-09-09; final native
200% browser-zoom check remains open. Approved by Marco with “approve” on 2026-09-08.

**Localization extension (2026-09-09):** focused spec approved by Marco with
“approve”. Gate 2 approved with “approved”; implementation and offline verification
completed locally on 2026-09-09. Native 200% browser zoom remains open for F16.
The original approval still applies to the cinematic work.

**Goal:** Make the approved cinematic Daily Brief design the standard website,
with detailed news below it and Extra retained behind a default-off flag.

**Files:** Existing paths below were checked on 2026-09-08. New files are marked
explicitly; their existing parent directories were checked. Create
`src/components/standard/` for the new presentation components. Paths are relative
to `F:/project/AI-news`.

- `src/App.tsx` — guard edition selection, lazy-load Extra, and add retryable data loading with cancellation and validation.
- `src/ClassicApp.tsx` — replace the standard presentation with the cover, native page scroll, navigation, detailed feed, and existing Trends.
- `src/types.ts` — add optional English/Chinese brief headlines and correct the citation comment to describe the selected brief input.
- `src/lib/lineage.ts` — add shared retry and Extra-availability props without changing ownership of data/filter/page state.
- `src/lib/theme.ts` — add exact-value flag parsing and an explicit availability argument to theme resolution.
- `src/lib/language.ts` — add independent headline validation/selection while preserving existing summary and whole-brief selection results.
- `src/lib/news.ts` **(new)** — validate browser data and derive deterministic notable selections and brief freshness labels.
- `src/hooks/useTheme.ts` — enforce availability on initialization, setters, and browser history changes; retain unrelated URL state.
- `src/hooks/useMotion.ts` **(new)** — manage the motion preference, live reduced-motion changes, and storage fallback.
- `src/components/standard/StandardHeader.tsx` **(new)** — compact header, desktop rail, accessible mobile menu, language/motion controls, and optional edition toggle.
- `src/components/standard/DailyCover.tsx` **(new)** — real headline, all cited bullets, brief status/date, and zero to two notable stories.
- `src/components/standard/ParticleSphere.tsx` **(new)** — decorative canvas sphere with static fallback and visibility-aware lifecycle.
- `src/components/standard/NewsFeed.tsx` **(new)** — detailed article rows, search/categories, expandable existing tag filters, active selections, empty states, and eight-item pagination.
- `src/components/standard/standard.css` **(new)** — scoped editorial tokens, typography, responsive layout, focus treatment, reveals, and reduced-motion rules.
- `src/components/LanguageSwitch.tsx` — add an optional compact presentation; preserve its existing appearance in Extra.
- `src/components/TrendsView.tsx` — add standard-edition presentation hooks and clearer headings while retaining all calculations and drilldowns.
- `src/index.css` — retain shared Tailwind infrastructure/tokens and move Extra-only font declarations and rules into its stylesheet.
- `src/components/extra/ExtraApp.tsx` — import the deferred Extra stylesheet; retain its existing presentation.
- `src/components/extra/extra.css` **(new)** — hold existing Extra fonts, tilts, Chinese typography, and reduced-motion rules.
- `src/vite-env.d.ts` — declare the optional public `VITE_ENABLE_EXTRA` setting.
- `ingest/lib.ts` — request and parse optional bilingual headlines in the existing brief response, retaining legacy arrays and bullet validation.
- `ingest/ingest.ts` — store parsed headline metadata with the generated brief in the existing synthesis call.
- `ingest/__tests__/brief.test.ts` — cover the new envelope, legacy arrays, optional-headline failures, citation validation, clipping, and carry-forward metadata.
- `ingest/__tests__/deepseek.test.ts` — prove the existing mocked call stores both headlines without another provider request or a changed response budget.
- `ingest/__tests__/telegram.test.ts` — prove headline additions do not change message content, delivery identity, or duplicate protection.
- `src/lib/__tests__/theme.test.ts` — cover absent/false/invalid/enabled flags and URL/storage precedence.
- `src/lib/__tests__/language.test.ts` — cover independent headline fallback and unchanged bilingual selection.
- `src/lib/__tests__/news.test.ts` **(new)** — cover invalid data, optional/legacy fields, notable window/order/deduplication, and quiet/failure dates.
- `.env.example` — document `VITE_ENABLE_EXTRA=false` as a public presentation setting.
- `.github/workflows/deploy.yml` — pass the optional repository variable only to the build step, defaulting to false.
- `.github/workflows/ingest.yml` — apply the identical flag to its build step without altering ingestion or delivery steps.
- `README.md` — describe the new default, older-headline fallback, motion, and the exact local/hosted Extra opt-in.
- `index.html` — align browser/share titles and theme colour with the new edition; inspection found stale Claude branding from before the provider migration.
- `docs/screenshot.png` — replace the existing Extra screenshot with the verified standard desktop view using real archive data.
- `.interface-design/system.md` — document the approved standard palette, typography, layout, responsive rules, and motion behavior.
- `specs/F6-ui-modernization/spec.md` — record that F16 supersedes the classic rollback presentation and adds the default-off Extra gate; retain outstanding F6 checks honestly.
- `specs/F16-cinematic-standard/spec.md` — record approvals, any agreed scope refinements, and completion evidence.
- `specs/F16-cinematic-standard/plan.md` — track these tasks and actual verification results.
- `specs/ROADMAP.md` — move F16 through Plan/Build/Done with evidence and preserve other workstreams.

**Approach:**

1. Establish the flag and shared data boundary first. Keep the internal
   `classic` name and existing shared filter/language state; add retry and a
   cancellable fetch. Load Extra through a dynamic import only when enabled and
   selected, with an accessible loading state.
2. Extend brief generation with optional headline metadata in its existing
   request. Parse either the new object or a legacy array, preserve validation
   of bullets/citations, and store the whole result with its generation date.
3. Build the new standard shell and cover with the approved prototype's default
   composition. Feed it the unfiltered edition, selected brief language, actual
   timestamps/status, and deterministic notable stories.
4. Connect the detailed news section and Trends to existing filtering,
   category counts, pagination, language, and URL logic. Use ordinary document
   scrolling and explicit navigation actions so typing does not move focus.
5. Add the decorative sphere and restrained entrance/reveal motion, followed
   by responsive and keyboard refinement. Keep every content path usable with
   animation or canvas disabled.
6. Run focused logic/integration checks, the full suite, and both flag builds;
   inspect desktop/phone interactions, update the screenshot and documentation,
   and present the running standard preview for Marco's review.

**New dependencies:** none. Use React, CSS, Canvas, browser observers, the
existing Node test runner, and the existing browser inspection tools.

**Assumptions I'm making:**

- The approved default composition is the visual reference; production uses
  native page scrolling and naturally growing sections, rather than the
  prototype's embedded viewport and device toolbar.
- Retain the prototype's system fonts: Georgia/Times for editorial English
  headings and system sans fonts with explicit Traditional Chinese fallbacks.
  No new font downloads are needed. Body text may be larger than the preview
  where necessary for reading and touch accessibility.
- The exact palette starts at background `#0c0f12`, panel `#15191d`, primary text
  `#f5f0e8`, secondary text `#afb3b4`, metadata `#8e979c`, and copper `#e6ad7d`;
  refine contrast during verification without changing the direction.
- All-view news preserves the archive's current order while paging eight items;
  the separate cover spotlight applies the approved seven-day notable ranking.
- The new public flag is controlled by `.env`/process environment locally and
  the repository Actions variable `VITE_ENABLE_EXTRA` in both hosted build paths.
  Its absence means disabled. Changing hosted settings or triggering deployment
  is outside this local task.
- Historical briefs render with a neutral headline until a future normal
  ingestion produces metadata. Verification uses fixtures; it does not rewrite
  `public/news.json` to manufacture a polished screenshot.
- Existing F13–F15 changes may land during implementation. Re-read the affected
  files and preserve their changes; if the file list needs adjustment, record
  the reason in this plan before editing.

**What I will NOT do:**

- Delete Extra, create a third edition, or redesign its content/layout.
- Change source selection, balance quotas, provider models, brief scheduling,
  retries, token budget, or Telegram delivery/state behavior.
- Add a motion library, a browser AI service, source scraping, or a paid backfill.
- Commit, push, deploy, run live ingestion, or send messages in this task.
- Mark the older F6 accessibility checks complete merely because Extra is hidden.

**How we'll verify it works:** Codex runs the commands and browser checks below
after implementation, records real results, and leaves a preview for Marco.
No implementation tests have been executed during this planning stage.

```cmd
cd /d F:\project\AI-news
npm test
set VITE_ENABLE_EXTRA=false
npm run build
npm run preview -- --host 127.0.0.1
```

Expected: zero test failures, build exit code 0, and Vite's preview address
normally `http://127.0.0.1:4173/AI-News-Reader/`. The page shows the new standard
and no edition toggle, including with `?theme=extra` or an old Extra preference.
If the port is occupied, use the actual address Vite prints.

Stop preview with Ctrl+C before building/serving the other flag state:

```cmd
set VITE_ENABLE_EXTRA=true
npm run build
npm run preview -- --host 127.0.0.1
```

Expected: the toggle is available, `?theme=extra` opens the preserved Extra
edition, and returning to standard retains filters and the selected language.
After checking it, stop preview and restore the default build:

```cmd
set VITE_ENABLE_EXTRA=false
npm run build
npm run dev -- --host 127.0.0.1
```

Expected: the final build and dev preview use standard with Extra disabled.
The development address normally uses port 5173 and the same base path.

## Data contracts and implementation decisions

### Brief generation and language

- `Brief` gains optional `headline?: string` and `headlineZhHK?: string`.
- `parseBriefResponse(text, inputs)` returns the generated content fields
  (`bullets`, optional `headline`, optional `headlineZhHK`) instead of just the
  bullet array. Update its sole production caller and existing tests together.
  `generateBrief` adds `generatedAt`; no other generation stage is introduced.
- Decode the full new JSON envelope, including fenced output, before inspecting
  `bullets`; do not mistake a nested citation array for the response. Legacy
  bullet arrays and their existing surrounding-text tolerance remain accepted.
  Invalid JSON or unusable bullets still fail into the existing carry-forward
  path; invalid optional headlines are independently omitted.
- Reuse one pure headline validator at ingest and display boundaries. Trim
  whitespace, reject nonstrings/empty values, enforce English 14-word/100-character
  and Chinese 50-character limits. Count Unicode code points for character
  limits. Optional translation problems never trigger another paid request.
- Add a headline selector that receives the language already chosen by
  `selectBrief`; do not change `selectBrief`'s current return shape or behavior.
- Leave Telegram production code untouched. Its current `checkBrief` reconstructs
  only `generatedAt` and canonical bullets before hashing. Test that new fields
  are excluded from the resulting identity and formatted messages.

### Data loading and display

- Keep `NewsData` as the stored/browser input. Validate the top-level object and
  required display fields at the fetch boundary; tolerate absent optional
  translations/tags/headlines/status and legacy data. Do not require `snippet`
  in browser input, so F14's public-build stripping remains compatible.
- Missing/malformed optional brief content produces an unavailable brief state
  with the valid article feed still accessible. An unusable dataset produces a
  load error and retry. Validate collections before the UI iterates them.
- Use `AbortController` and effect cleanup so retries and React StrictMode do
  not leave stale responses overwriting newer state.
- Add `extraEnabled: boolean` and `onRetry: () => void` to shared edition props.
  These are shell concerns; Extra may ignore the new props.
- Derive spotlight candidates without mutation: valid `important === true`,
  timestamp in `[datasetGeneratedAt - 7 days, datasetGeneratedAt]`, descending
  timestamp then lexical URL, deduplicate URLs, take two. An invalid dataset
  timestamp is a load error; no client-clock approximation changes the edition.
- Freshness labels use both the brief's date and existing `briefStatus`. The
  cover never derives “generated today” from the archive update time alone.

### Navigation and styles

- Keep existing `useUrlState`, `filterArticles`, `categoryCounts`, `paginate`,
  `computeTrends`, and language state; no parallel filter engine is introduced.
- `ClassicApp` owns standard-only menu/Research-notable state and section refs.
  `NewsFeed` reuses `FilterBar` inside an expandable area and keeps selected
  chips/reset available outside it, including orphaned tag selections.
- Scroll to results on initial filtered deep links, category/tag navigation,
  Trends drilldown, pagination, and relevant Back/Forward navigation. Search
  changes update results without replacing the input or scrolling per character.
  Apply sticky-header scroll offsets and focus the results heading after
  explicit navigation, but preserve the input focus while typing.
- Use an accessible menu with an explicit open button, Escape dismissal, and
  focus return; if rendered as a modal sheet, contain focus and close before
  focusing its chosen destination. All categories remain available on phones.
- Scope the new palette and component styling under `.theme-standard`; adapt
  shared controls and Trends there. Defer Extra-specific font/style declarations
  with its entry point and verify asset URLs respect `/AI-News-Reader/`.
- Leave old standard-only components on disk if unused; removing dead files is
  not required to replace their entry point and would add unrelated cleanup.

### Motion lifecycle

- `useMotion` stores a best-effort preference under `ai-briefing-motion` using
  `on`/`off`. Effective motion is off whenever reduced motion is requested.
  Keep `import.meta.env` in browser entry points, not pure modules used by tests.
- `ParticleSphere` owns its canvas, deterministic geometry, observers, pointer
  handlers, animation frame, and cleanup. Cap device pixel ratio and particle
  count; use lower counts on narrow screens. The art is decorative/aria-hidden.
- Use `ResizeObserver`, `IntersectionObserver`, `visibilitychange`, and the motion
  preference to control drawing. No animation frame is scheduled while hidden
  or offscreen. Draw a static state when motion is disabled and retain a CSS
  background treatment if canvas initialization fails.
- Pointer response is limited to fine-pointer devices. Reveal effects animate
  already accessible content only; reduced motion or observer failure must not
  leave text hidden. Clean up every observer, listener, and frame on unmount.

## Tasks

- [x] Record Gate 1 approval and move F16 to Plan.
- [x] Inspect current code paths, data contracts, and the approved visual reference.
- [x] Draft the file inventory, implementation decisions, and verification plan.
- [x] Receive explicit Gate 2 approval; record it and move F16 to Build.
- [x] Implement the default-off flag, guarded theme hook, deferred Extra assets,
  and retryable/validated shared data loading.
- [x] Add optional brief headlines, parsing/storage, bilingual selection, and
  focused generation/language/Telegram regression coverage.
- [x] Build standard header/rail/menu and the real-data Daily Cover.
- [x] Connect detailed feed, compact discovery controls, pagination, native
  scroll/navigation, existing Trends, and all unavailable/empty states.
- [x] Finish motion, static fallback, and responsive/keyboard verification
  available in the local browser tool; native 200% zoom is tracked separately below.
- [x] Run tests and both build states, then perform the available browser matrix below.
- [x] Update README, design system, screenshot, F6 integration note, and F16
  completion evidence; leave the final default-off preview available to Marco.
- [ ] Verify native browser zoom at 200%. The in-app browser exposes viewport
  sizing but no zoom control; its keyboard shortcut did not change measured
  scaling. Responsive-width checks are not claimed as a native zoom test.

## Verification matrix

| Spec criteria | Evidence to collect |
| --- | --- |
| AC1–2 | Real archive cover/feed inspection and screenshot; all 3–5 bullets and source links; all articles accessible over eight-item pages. |
| AC3 | Search typing/focus, category/tag combinations, orphan tags, Research notable, clearing, pagination resets, filtered URLs and Back/Forward. Existing filter tests remain green. |
| AC4 | Trends charts/health content and topic/entity drilldowns preserved in the new shell; existing Trends tests remain green. |
| AC5 | Parser tests for envelope/legacy/fenced data, invalid optional headlines, invalid bullets, refs, first-five clipping; mocked generation stores metadata with one synthesis call and unchanged budget. |
| AC6 | English/Chinese/partial/legacy fixtures; missing Chinese headline with complete Chinese bullets; original titles and English fallback notices. |
| AC7 | Dated generated/quiet/failed/legacy cases, with and without a carried brief; dataset update cannot relabel an old brief as new. |
| AC8 | Unit matrix for missing, false, invalid, and true values plus both flag builds; rendered URL/storage behavior, subsequent setters, no Extra asset requests while disabled. False build is left last. |
| AC9 | 320/375/768/1440 widths, a short phone height, 200% zoom, long English/Chinese text, five bullets, zero/one/two notable stories; no horizontal page overflow. |
| AC10–11 | Motion on/off/live reduced-motion changes, offscreen/hidden/unmount lifecycle, blocked storage/fonts, unavailable canvas, keyboard/menu/focus/source links and measured text/control contrast. |
| AC12 | Full `npm test`; new Telegram metadata tests compare canonical identity and messages and prove sent/pending/uncertain guards remain effective. No live sends. |

Use temporary browser fixtures outside the committed archive for edge states;
the final screenshot must use the real archive and its honest fallback headline
if the current record has none. Use the existing test runner rather than adding
a browser-test dependency. Record limitations explicitly if a browser capability
prevents a specific check; an unperformed check stays unchecked.

## Risks / tradeoffs

- Real five-bullet briefs are longer than the mockup: permit natural growth
  and prioritize readable copy over matching its exact initial-screen height.
- A new JSON envelope can fail despite usable content: retain legacy parsing,
  isolate optional-field validation, and exercise malformed/fenced responses.
- Extra shares styles today: isolate only its own declarations and verify both
  build states so default typography changes do not damage the retained edition.
- Headline wording is model-generated and adds some response tokens even though
  the call count and token ceiling stay unchanged; offline tests verify the
  contract, while editorial quality awaits a future normal generated brief.
- Native scrolling changes navigation timing: verify deep links, pagination,
  history, and focus after content loads rather than relying on static anchors.
- Nearby F13–F15 edits can change the same ingestion/docs files: inspect the
  working tree before each affected task and merge only this feature's scope.

## Verification results — 2026-09-08 to 2026-09-09

- Final full project suite on 2026-09-09: `tests 124`, `suites 30`, `pass 124`,
  `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`, `duration_ms 7870.2436`.
  This host's `tsx` startup otherwise fails with `uv_os_get_passwd returned
  ENOMEM`; a temporary external `os.userInfo` fallback shim allowed the normal
  project runner to execute. No project runtime workaround or dependency was added.
- Both flag builds passed after the final keyboard refinement (67 modules).
  Final default-off build: `built in 1.00s`, main JS 232.46 kB (73.03 kB gzip),
  main CSS 47.59 kB (9.95 kB gzip). Extra is deferred into separate JS/CSS chunks.
  The enabled build was isolated under the system temporary directory; the
  repository `dist/` and running development preview are left default-off.
- Real archive inspection: 278 articles, four cited bilingual brief bullets,
  two eligible notable stories, and eight full-summary articles per feed page.
  `docs/screenshot.png` shows the real 8 September archive. It has no headline
  metadata, so the cover honestly uses “The latest in AI.” / “AI 每日摘要”.
  Future normal ingestion requests the headline; no archive rewrite or live
  model call was performed for the screenshot.
- Desktop/phone checks at 320, 375, 768, and 1440 CSS pixels showed no horizontal
  page overflow, including a five-long-bullet Chinese fixture. English and
  Chinese summaries, neutral headline fallback, original article titles, and
  citation/source destinations remain available. Standard uses system fonts;
  it requests no custom fonts, so its typography has no font-download dependency.
- Navigation checks: search for Iris returns one article; an impossible query
  shows zero results and a reset action; typing retains input focus. Research
  gives 48 stories and its notable filter gives six. Pagination starts the next
  page at item 09 and focuses the news heading. Trends retains six sections;
  OpenAI entity drilldown produces 58 matches; Back/Forward restores Trends and
  the filtered result URL. Existing filter, pagination, and Trends tests pass.
- Keyboard refinements verified: the mobile index button has an explicit name;
  Tab/Shift+Tab wrap between the menu's last and first enabled controls; Escape
  closes it and returns focus to Open index. Skip to content targets the main
  landmark in news, Trends, loading, and error states. Explicit navigation moves
  focus to its destination; search navigation focuses the input.
- Fixture checks cover no brief, empty archive, malformed optional brief,
  zero/one/two notable stories, partial Chinese fallback, and failed fetch with
  successful retry. Quiet/failed runs retain a carried brief's 5 September date
  rather than relabeling it with the 8 September archive update.
- Motion verified with local browser simulations: initial/live reduced-motion
  requests override the saved preference; the toggle works; blocked storage and
  missing canvas retain usable content. Instrumented active animation frames
  drop to zero offscreen, while hidden, and after Trends unmounts the sphere;
  frame counts stop advancing. These are local harness simulations, not changes
  to the device's real accessibility setting or hidden-tab lifecycle.
- Text palette contrast against the standard backgrounds measured at least
  5.81:1; copper focus treatment measured 7.75:1. Content remains visible without
  reveal animation. This is targeted verification, not a full accessibility audit.
- Disabled flag ignores saved Extra preferences and `?theme=extra`, exposes no
  edition toggle, and makes zero Extra JS/CSS/font requests. Enabled Extra loads
  its deferred assets from the correct base path and switches both ways while
  preserving `q=Iris` and Chinese language. No hosted setting was changed.
- Telegram regression tests confirm that new headline metadata leaves canonical
  messages, delivery identity, and sent/pending/uncertain protections unchanged.
  Existing clipping, selection, synthesis-call count, and token-budget tests pass.
- Final refinements also give short result lists a viewport minimum height,
  correct the no-notable cover's tablet grid specificity, and remove stale
  Claude text from page/share metadata. The generated TypeScript cache was
  restored; unrelated F13–F15 work and `public/news.json` are preserved.
- Final `git diff --check` exited 0. The temporary test shim was removed.
  The development preview returned HTTP 200 with the new page title. A late
  browser resize/reset request timed out while the app panel was unavailable;
  it did not add new responsive evidence. The existing 320/375/768/1440 results
  above come from the completed earlier checks. Reopening the preview was queued
  in this task's app panel; the direct local URL remains usable.

### Remaining review and boundaries

- Native 200% browser zoom remains unchecked for the tool limitation above;
  retain F16 at Build until that final check is recorded. The implementation
  itself is ready for Marco's visual review in the local preview.
- No commit, push, deployment, live ingestion/backfill, or Telegram send was
  requested or performed. Headline editorial quality awaits normal ingestion.
- F6's older outstanding Lighthouse/font/accessibility baseline is unchanged.
- Preview: `http://127.0.0.1:5176/AI-News-Reader/`, with Extra disabled and motion
  enabled (subject to the reader's reduced-motion setting).

## Localization inspection — 2026-09-09

- Read AGENTS, Constitution, Roadmap, F16 spec/plan and F12 spec/plan. F12's
  original non-goals explicitly exclude whole-interface localization; the new
  request is recorded as a focused F16 scope addendum, pending approval.
- Inspected current working tree: substantial tracked/untracked F16 work and
  unrelated F13/F14/F15 documentation are present. This inspection changes only
  F16 spec/plan and its Roadmap note; no existing implementation was replaced.
- Confirmed preview HTTP `200 OK` at the recorded port 5176. Opened the preview
  in the in-app browser: Chinese was already selected, with translated brief and
  summaries, but English rail, section labels, dates, categories, pagination,
  footer and accessible source-link names. This reproduces the reported gap.
- Verified remaining text ownership: `src/ClassicApp.tsx` (states, Trends shell,
  footer); `src/components/standard/StandardHeader.tsx` (header/rail/index/motion);
  `DailyCover.tsx` (brief/spotlight labels and citations); `NewsFeed.tsx`
  (search/filter/results/articles/pagination); shared `FilterBar.tsx`,
  `LanguageSwitch.tsx`, `TrendsView.tsx`; `src/lib/news.ts` (English-only date and
  brief notices); `src/App.tsx` (fetch error and suspense copy).
- `src/hooks/useLanguage.tsx` already owns safe shared storage. Content selection
  in `src/lib/language.ts` must remain separate from interface selection.
  `Sparkline.tsx` receives its accessible label from TrendsView. ParticleSphere
  contains decorative art, not authored interface text. Old standard-only and
  Extra-only components are not part of the standard render path.
- Implementation planning should inventory an authored locale dictionary, display
  mappings/formatters, affected rendering files, meaningful regression coverage,
  and only necessary Chinese wrapping adjustments after spec approval. Do not
  modify stored category/tag values or the existing filter/Trends calculations.
- No localization tests, builds or completed visual checks are claimed. Earlier
  124-test/build evidence applies only to the pre-localization implementation.
  Native 200% browser zoom remains open. Next gate: review the spec addendum,
  then prepare the focused implementation plan for approval.

## Plan: Full standard-interface localization

**Spec:** Scope extension L1–L8 in `spec.md`, approved 2026-09-09.
**Status:** Build — Gate 2 approved by Marco with “approved” on 2026-09-09.

**Goal:** Make every authored standard-interface label follow EN / 繁體中文,
preserving the cinematic design, canonical filters and content fallback behavior.

**Files:** Existing paths inspected in this session and the preceding inspection.
New paths are explicitly marked; their parent directories exist. Paths are
relative to `F:/project/AI-news`.

- `src/lib/ui.ts` **(new)** — typed English/Chinese copy, category/tag display mappings, number/date-only formatting and source-error descriptions.
- `src/lib/news.ts` — add optional selected language to date and brief-notice presentation helpers; retain existing English defaults.
- `src/App.tsx` — localize the deferred-edition loading component inside the existing language provider; preserve fetch/retry ownership.
- `src/ClassicApp.tsx` — selected interface language, browser title, loading/error/Trends/footer copy and source-health counts.
- `src/components/standard/StandardHeader.tsx` — header, rail, index, category labels, motion settings and accessible names.
- `src/components/standard/DailyCover.tsx` — cover/spotlight metadata, notices, dates, counts and citation labels; preserve content selectors.
- `src/components/standard/NewsFeed.tsx` — search, filters, article metadata, empty states and pagination, retaining canonical values.
- `src/components/FilterBar.tsx` — group labels, descriptive tag displays, selection accessibility and clear action.
- `src/components/TrendsView.tsx` — headings, dates, chart labels, tag/category display, counts and feed-health explanations.
- `src/components/LanguageSwitch.tsx` — website-language accessible label for compact standard mode; retain summary-only wording for Extra.
- `src/components/standard/standard.css` — only necessary Chinese wrapping and control-spacing adjustments, scoped to standard.
- `src/lib/__tests__/ui.test.ts` **(new)** — locale completeness, formatters, canonical display mappings and content-fallback independence.
- `src/lib/__tests__/news.test.ts` — bilingual dates and quiet/failed/carried brief notices with unchanged timestamps.
- `README.md` — explain full standard-interface language versus Extra's summary-language scope.
- `specs/F16-cinematic-standard/spec.md` — record extension approvals, refinements and completion evidence.
- `specs/F16-cinematic-standard/plan.md` — record implementation progress, actual checks, screenshots and any remaining limitations.
- `specs/ROADMAP.md` — track the extension separately from prior cinematic verification and preserve other workstreams.

Temporary offline browser fixtures and Chinese screenshots may be created under
`C:/Users/Marco/.codex/visualizations/2026/09/09/01a083ae-013c-7580-ad04-e54d88e0b32d/`.
They are verification artifacts, not a shipped test mode or archive replacement.
Keep the existing `docs/screenshot.png` intact; present separate Chinese evidence.

**Approach:**
1. Add one typed local copy table with matching keys and parameter signatures
   for English and HK Traditional Chinese. Add display-only category/tag mappings,
   localized number/count/date helpers and conservative source-error descriptions.
2. Connect the existing `useLanguage()` preference to all standard render paths.
   Localize errors at render time so toggling during failure updates the message
   immediately. Set the standard root's language and localized browser title,
   restoring the previous title when switching away from standard.
3. Translate header/rail/index/motion, cover and full feed. Keep article/brief
   selectors unchanged; their returned language applies only to actual content.
   Resolve control labels, date strings, notices and citation names from the
   interface preference, even inside an English fallback content element.
4. Translate FilterBar and Trends labels, known descriptive tags and every known
   category. Keep option values, handler arguments, React identity, filters,
   calculations, page state and history canonical. Leave entity/proper names intact.
5. Add focused regression tests, run the full offline suite and both flag builds,
   then inspect both language directions, reload, navigation and edge states in
   the browser. Fix only localization-related defects and wrapping issues found.
6. Show Chinese desktop/mobile views from the real archive, leave the final
   preview Chinese with Extra disabled, and record actual evidence in the docs.

**New dependencies:** none.

**Assumptions I'm making:**
- The existing `SummaryLanguage`, provider, storage key and content selectors
  remain authoritative and need no schema or API change. No second locale state.
- `AI Briefing`, Extra, original source/title text, entity names and technical
  identifiers retain their spelling. Unknown dynamic tags/categories stay usable
  verbatim; authored mappings cover the current taxonomy and seed topic/trait labels.
- Keep `newsDate`'s existing local-time behavior for timestamps. Format Trends'
  UTC date-only buckets without shifting their calendar day in another time zone.
- The standard root declares the selected language. Explicit content `lang`
  attributes identify English fallback; citation links override inherited content
  language where their accessible name uses the selected Chinese interface.
- Extra-only components stay outside this extension. Its existing noncompact
  language switch remains accurately labeled as summary language.

**What I will NOT do:**
- Redesign the cover or sphere, translate original article titles, change content
  selection/fallback, mutate archive/category/tag values or rewrite URL keys.
- Add dependencies, AI requests, ingestion/backfill, Telegram sends, commit/push,
  deployment, source-health repairs or unrelated F13/F14/F15 changes.
- Treat previous test/build results or responsive widths as proof of this
  localization or of native 200% browser zoom.

**How we'll verify it works:** Codex runs the following after Gate 2 approval;
expected outputs below are not current results.

```cmd
cd /d F:\project\AI-news
npm test
set VITE_ENABLE_EXTRA=false
npm run build
set VITE_ENABLE_EXTRA=true
npm run build
set VITE_ENABLE_EXTRA=false
npm run build
```

Expected: zero failing tests and successful builds; final `dist/` is default-off.
Reuse the running port-5176 preview if healthy. If stopped, start explicitly:

```cmd
cd /d F:\project\AI-news
set VITE_ENABLE_EXTRA=false
npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

Expected: `http://127.0.0.1:5176/AI-News-Reader/`; Chinese interface with original
article titles/source names, and EN restoring all authored English interface copy.
If Windows `tsx` again fails before tests with the documented user-lookup error,
use a temporary external workaround only if needed; record exact commands/results
and remove it afterward. Preserve any pre-existing generated cache changes.

### Presentation contracts

- `uiCopy(language)` returns a type-checked catalog with plain labels and typed
  formatter functions for counts, pagination, source/citation names and notices.
  English/Chinese catalogs must expose the same keys and callable arguments.
- `categoryLabel(value, language)` and `tagLabel(group, value, language)` return
  display strings only. No reverse lookup or translated values enter filter state.
- `newsDate(iso, language = "en")` and
  `briefNotice(data, language = "en")` retain their existing English callers and
  return shapes. Parsing, stored news types and selector logic are unchanged.
- Feed-error presentation classifies only recognized diagnostics (for example
  HTTP statuses/timeouts). Keep original codes and source names; unknown messages
  receive a localized explanation plus verbatim technical detail, not guessed facts.
- Standard uses its own localized generic retry copy whenever the existing error
  prop is set. Fetch effect dependencies must not include language: switching UI
  must not refetch the archive or reset the existing retry/filter/page state.

### Tasks and verification mapping

- [x] Inspect standard render paths and record the scope extension.
- [x] Receive Gate 1 approval and prepare this focused implementation plan.
- [x] Receive Gate 2 approval; record it before production edits.
- [x] Implement typed copy/mappings/formatters and focused regression tests (L1, L5, L7).
- [x] Localize shell/header/cover/feed with independent interface/content language (L1–L3).
- [x] Localize discovery/Trends/source health and necessary responsive CSS (L1, L4–L6).
- [x] Run full tests and both flag builds; restore default-off build (L7–L8).
- [x] Browser-check EN→Chinese→EN, reload each, and invalid/blocked storage (L1–L3).
- [x] Check index/rail/search/category/tag/orphan-filter clearing, Research notable,
  page 2 language switching, Trends drilldown and Back/Forward with unchanged
  canonical URLs and input/menu focus (L4).
- [x] Inspect offline partial/legacy/missing briefs, missing summary, empty archive,
  no results, quiet/failed briefs, load error/retry, zero/failed feeds and unknown
  labels; switch language while these states remain visible (L2, L5).
- [x] Inspect 320/375/768/1440 widths in both languages, expanded menus/filters,
  long Chinese content, motion settings, keyboard names/focus and overflow (L6).
- [x] Check enabled Extra still opens/switches back and retains shared preference;
  default-off rejects Extra URL/storage requests (L7).
- [x] Capture Chinese real-archive desktop/mobile evidence, show preview, record
  actual results and any tool limits. Retain native 200% zoom as open unless
  verified through supported browser controls (L8).

### Risks / tradeoffs

- Generated labels can be open-ended. Cover the canonical taxonomy and authored
  seed labels; preserve unknown values and proper names instead of mistranslating
  them or making filters inaccessible.
- A translated summary can mask an English-only UI defect. Verify with English-only
  content and audit accessible names as well as visible labels in each state.
- Date-only Trends buckets can move a day if treated as local timestamps. Test
  date-only formatting independently of normal article-date formatting.
- Chinese wrapping may alter the cover's rhythm. Restrict CSS to readable line
  breaks, spacing and overflow fixes while preserving composition and motion.
- Browser capabilities may limit native zoom/storage/network-fixture checks.
  Report unavailable checks precisely; tests and fixtures supplement actual
  interactions but do not count as evidence of unperformed browser actions.

### Planning result — 2026-09-09

Only F16 spec/plan and the Roadmap note were updated during this planning turn.
Production localization, regression tests, builds and screenshots remain pending
Gate 2 approval. Previous cinematic implementation and unrelated changes remain.

### Implementation and verification result — 2026-09-09

The planning result above records the earlier gate, not current status. Following
Marco's explicit Gate 2 approval, all localization tasks above are complete locally.

Implemented `src/lib/ui.ts` as the typed English/HK Traditional Chinese catalog,
with display-only taxonomy mappings, number/date formatting and conservative
source diagnostics. Standard shell, header/rail/index, cover, feed, discovery,
Trends, suspense, language controls and browser title now use the existing shared
preference. No new provider, storage key, dependency or translation request.
`news.ts` keeps English defaults for other callers; F12 selectors are unchanged.
Added six focused regression tests across `ui.test.ts` and `news.test.ts`.
README describes the standard/Extra language scope. CSS changes only improve
wrapping of filter controls and long Trends diagnostics.

Actual automated results after the final source changes:

```text
Tests: 130; suites: 31; pass: 130; fail: 0
cancelled: 0; skipped: 0; todo: 0; duration_ms: 9139.832
Extra enabled: tsc -b && vite build --outDir <external artifact directory>/extra-build
68 modules transformed; built in 2.11s
Extra disabled: tsc -b && vite build
68 modules transformed; built in 902ms
git diff --check: exit 0 (only existing CRLF conversion advisories)
```

The ordinary test command initially failed before tests with the host's existing
`uv_os_get_passwd returned ENOMEM` startup problem. For the test run only,
PowerShell set `NODE_OPTIONS` to
`--require=C:/Users/Marco/.codex/visualizations/2026/09/09/01a083ae-013c-7580-ad04-e54d88e0b32d/windows-userinfo.cjs`
and ran `npm test`. This external shim caught only that user-info lookup failure;
it did not change test/application behavior and was removed after verification.
The build's generated `tsconfig.tsbuildinfo` change was restored to its initially
clean version. Final repository `dist/` is the Extra-disabled build.

Actual browser verification using the real archive on port 5176:

- EN → Chinese → EN updates header, rail, index, cover controls, feed and Trends.
  Reload restores both choices. Final preview is Chinese with Extra disabled.
- Index keyboard Tab wraps; Escape closes and restores trigger focus. Motion
  changes On/Off and its accessible pressed state; device reduced-motion state
  shows the localized override and disables the control.
- Research displays 48 stories; notable narrows to 6. Page 2 retains row 09 and
  page 2 of 6 when language changes. Canonical `category=Research` stays intact.
- Search `Iris` gives 1 story while retaining input focus. No-match queries show
  localized empty/reset controls. Topic 推論 uses `topics=inference` and gives 17
  matches; clearing it restores results. Unknown orphan filters remain removable.
- All Trends sections, chart names, categories, dates and source-health messages
  switch language. The real archive shows 7/10 healthy feeds and retains HTTP
  404/429 and source names. The observed openai drilldown gave 58 articles;
  Back/Forward restored Trends/results and the expected heading focus.
- Both languages fit widths 320, 375, 768 and 1440 (document scroll widths
  305, 360, 753 and 1425 respectively, with scrollbar). Checked expanded filters,
  pagination and mobile index. At 320 the rotating disclosure '+' has a transformed
  box extending 10 px internally; visible controls fit and page does not overflow.

Offline fixtures ran in a separate temporary Vite server on port 5178, cloning
the archive in memory. No fixture or test route is shipped and no archive was
overwritten. Verified:

- Partial Chinese brief falls back atomically to English; headline/bullets have
  English content language while interface/citation accessible names stay Chinese.
  Legacy brief, absent brief, missing summary and empty archive render correctly.
- Quiet/failed notices preserve the carried brief's September 5 date. Error and
  loading labels change immediately with language. Retry succeeds on request 3
  after the two StrictMode initial failures. Malformed data gives a localized error.
- Switching languages did not increase the visible archive-request count (2
  initial StrictMode requests). Zero/healthy feeds, unknown diagnostics and tags
  preserve factual details and show localized authored explanations.
- Invalid storage defaults to English. Blocked storage still allows in-memory
  switching; reload correctly returns to English when saving is impossible.
- Five long Chinese brief bullets, long filter text and long unbroken diagnostics
  fit an actual 320 px viewport without page overflow. Long source-health Trends
  was checked in both languages at 320 px. A temporary resize-control issue was
  resolved by selecting the current visible tab and measuring its actual width.
- Disabled Extra ignores URL and saved-theme requests. Enabled production build
  on port 5177 opened Extra and switched both directions while retaining Chinese
  and `q=Iris` (1 result). Extra-only copy remains outside this localization scope.

Chinese visual evidence from the real archive (desktop 1440×1000, phone 375×844):

- `C:/Users/Marco/.codex/visualizations/2026/09/09/01a083ae-013c-7580-ad04-e54d88e0b32d/chinese-desktop.png`
- `C:/Users/Marco/.codex/visualizations/2026/09/09/01a083ae-013c-7580-ad04-e54d88e0b32d/chinese-mobile.png`
- `C:/Users/Marco/.codex/visualizations/2026/09/09/01a083ae-013c-7580-ad04-e54d88e0b32d/chinese-mobile-index.png`

Preserved all pre-existing F16 implementation and F13/F14/F15 documentation.
No changes to archive, package manifests or shared language provider; no commit,
push, deployment, ingestion/backfill or Telegram action. Unknown dynamic tags,
proper names, article titles, source names, URLs and stored filter values remain
verbatim as specified. Native 200% browser zoom remains unverified because the
available in-app browser control provides viewport resizing, not native zoom.
F16 stays Build for that original open check; localization is complete locally.

### Publication plan — approved 2026-09-09

Marco requested “deploy it, its ok”, authorizing publication of the reviewed F16
design and localization. Use an isolated `codex/deploy-cinematic-zh-hk` checkout
based on current remote main; copy only the approved implementation/documentation
paths and F16 Roadmap additions. Exclude unrelated F13–F15 and older F11/F12
Roadmap edits. Preserve the newer remote archive and delivery state byte-for-byte.
Fix the stale summary-only sentence in README to match the localized behavior.
Verify the release checkout, commit explicit paths, push normally to main, wait
for tests and Pages deployment, then check the hosted interface in both languages
and record actual run IDs/URLs. Leave Extra disabled. No live ingestion or Telegram
workflow is dispatched. The original working tree remains available unchanged
apart from this approval/evidence and the README correction.

Release checkout verification: based on remote `75a9f91`; the only newer remote
changes were archive/delivery records, retained unchanged. `npm run build` with
Extra false passed (68 modules, 1.99s), and `npm test` passed 130/130 across 31
suites in 5143.5943 ms. The restricted shell could not resolve the worktree's Vite
config; rerunning under the normal host account passed without a user-info shim.
GitHub Pages uses `gh-pages` at `/`; repository `VITE_ENABLE_EXTRA` is absent,
therefore both build workflows default to false. Release stages 42 approved paths;
no F13–F15 docs, generated cache, archive, delivery state or package changes.
