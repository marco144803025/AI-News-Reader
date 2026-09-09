# SPEC: Cinematic standard edition

**ID:** F16-cinematic-standard
**Status:** Build — cinematic implementation and approved localization complete locally; native 200% zoom pending
**Owner:** Marco
**Created:** 2026-09-08

## 1. Problem statement

Replace the standard edition's large brand heading and dense controls with an
editorial front page led by the actual Daily Brief and one or two notable
stories. The approved direction uses a warm dark palette, expressive serif
headlines, copper accents, an animated particle sphere, and a natural scroll
into detailed news. It must work on desktop and phone. Preserve Extra as an
optional edition behind a feature flag that is off by default.

Visual reference: the default composition in the approved
[cinematic-daily-brief.html](C:/Users/Marco/.codex/visualizations/2026/09/07/01a07dfd-f651-7840-9207-227d1085cc70/cinematic-daily-brief.html)
prototype. Its authoritative local path is
`C:/Users/Marco/.codex/visualizations/2026/09/07/01a07dfd-f651-7840-9207-227d1085cc70/cinematic-daily-brief.html`.
The visual decisions below are recorded here so implementation does not depend
on access to that local preview.

### User stories

- As a reader, I want the opening screen to tell me what matters in AI, with
  personality and movement that make me want to explore.
- As a reader, I want to scroll into complete summaries and quickly find a
  category, search result, or source article.
- As a phone or keyboard user, I want the same content and navigation without
  cramped controls or animation getting in the way.
- As the owner, I want the new design to be the default and Extra to remain
  available for a future deliberate opt-in.

## 2. Constraints

- Retain React, Vite, Tailwind, the static GitHub Pages deployment, and the
  existing offline Node ingestion. No new dependencies or browser API calls
  to an AI provider. Commands for Marco must work in Windows cmd.
- Use real `news.json` data, native page scrolling, semantic HTML, keyboard
  access, visible focus, and responsive layouts. Cover height may grow to fit
  five bullets, translations, zoom, and short screens.
- Preserve search, category and tag filtering, shareable URL state, browser
  history, language preferences, Trends, and feed health information.
- Preserve F12's per-article English fallback and whole-brief fallback. Keep
  authentic Hong Kong Traditional Chinese; original article titles stay as
  published. Missing headline translation must not invalidate Chinese bullets.
- Preserve the current last-24-hour brief selection, retry behavior, 8,192-token
  response budget, excess-bullet clipping, `briefStatus`, and Telegram delivery
  identity/protection. This feature adds presentation metadata, not a new
  generation schedule or selection policy.
- Respect concurrent F13–F15 work. Keep source expansion, source/category
  balancing, and licensing changes in their own features. Preserve any colophon
  links or build-time data stripping that land before implementation. Never
  render publisher `snippet` excerpts as substitutes for generated summaries.

## 3. Non-goals

- Deleting or redesigning Extra; retaining the old standard as a third edition.
- Full article scraping, accounts, subscriptions, new sources, or new services.
- Historical headline backfills, extra AI calls, or changes to Telegram content.
- Sound, forced scroll sequences, scroll snapping, or a mandatory intro.
- Shipping the prototype's sample news, device selector, design variants,
  replay toolbar, or embedded fixed-height preview viewport.
- Deployment, committing/pushing, live ingestion, or sending Telegram messages
  as part of this local implementation and verification scope.

## 4. Interfaces & data shapes

### Page composition and navigation

1. **Minimal top bar:** compact publication name, date/freshness, summary-language
   selector, access to search/categories and Trends, and a motion control.
   Group secondary controls into an accessible menu on narrow screens.
2. **Desktop rail:** a slim section index for the brief, news, and category
   navigation. On phones, use the top-bar menu and a compact feed category
   control. All existing categories remain reachable; avoid a large tag wall
   ahead of the brief.
3. **Cover:** a small Daily Brief label, large content-led headline, all 3–5
   cited bullets, the restrained particle sphere, and up to two notable
   stories. Use an open editorial composition with fine rules, generous space,
   warm dark surfaces, ivory text, and copper accents. One story is primary;
   the second is compact. The cover leads directly into the news section.
4. **News section:** show full generated summaries, source, original title,
   publication date, category, useful tags, and source links. Use a continuous
   list with eight items per page for All and category views, replacing the
   current All-view four-item category previews. Keep all matching articles
   accessible through pagination and preserve the existing Research notable
   filter and filter/count semantics.
5. **Discovery:** expose keyword search and category selection near the news
   section, with additional tags in a compact expandable filter area. Active
   filters and clear/reset controls must remain visible. Search/category/tag
   deep links open at the results; typing must retain focus and must not trigger
   a new scroll on every keystroke. The cover represents the full edition and
   does not change into a misleading brief of filtered articles.
6. **Trends:** retain its calculations, charts, tag drilldowns, and feed-health
   details in the new standard shell. The news cover is not repeated above the
   Trends view. Preserve the existing `view=trends` URL contract.

### Brief headline and freshness

Add optional `headline` and `headlineZhHK` strings to `Brief`. Existing
`generatedAt`, `bullets`, citation URLs, article fields, and `briefStatus`
remain compatible. Illustrative stored record (example copy, not shipped data):

```json
{
  "generatedAt": "2026-09-08T07:00:00.000Z",
  "headline": "New models put reliability in focus",
  "headlineZhHK": "新模型將可靠性推上焦點",
  "bullets": [
    {"text": "A model release adds reliability checks.", "textZhHK": "有新模型加入可靠性檢查。", "refs": ["https://example.com/model"]},
    {"text": "Researchers publish an evaluation method.", "textZhHK": "研究人員公布咗一套評估方法。", "refs": ["https://example.com/evaluation"]},
    {"text": "A deployment report describes remaining limits.", "textZhHK": "一份部署報告交代咗現時仲有嘅限制。", "refs": ["https://example.com/deployment"]}
  ]
}
```

- Request the headline and its translation in the existing brief generation
  call, grounded in the same selected articles and final bullets. English:
  at most 14 words and 100 characters. Chinese: at most 50 characters. Avoid
  unsupported claims, sensationalism, and generic publication branding.
- The new model-response envelope contains `headline`, `headlineZhHK`, and
  `bullets`; model citation indexes still become validated article URLs. Accept
  the legacy bullet-array response as well. Missing, invalid, or overlong
  headline fields are dropped independently; usable bullets still succeed.
  Preserve the current handling of 3–5 bullets and clipping excess valid bullets.
- Older briefs require no migration. Use a neutral display fallback such as
  “The latest in AI.” or “AI 每日摘要” when a suitable headline is absent.
  Select the headline in the language actually used for the brief bullets.
  Fully translated bullets with no Chinese headline use the neutral Chinese
  headline; they must not fall back to English solely because of that field.
- Show the brief's own generation date separately from the dataset update
  time. Carry its headline and bullets together when an older brief is retained.
  `no-new-material` visibly indicates a quiet update; `generation-failed`
  indicates that the latest brief could not be generated. Neither presents a
  carried brief as freshly generated. Older data without `briefStatus` uses
  its timestamps without inventing a status.
- Telegram continues to format the existing bullets and use its existing
  delivery identity. Adding headline metadata must not resend a delivered brief.

### Notable story selection

Use up to two distinct article URLs already marked `important === true`,
published within the seven days ending at `NewsData.generatedAt`, sorted newest
first with URL as a deterministic tie-break. Exclude invalid or future dates.
Show the actual publication dates and existing summary-language behavior.
With one eligible story, use one; with none, let the brief occupy the space.
Do not promote ordinary articles under a fabricated notable label. Spotlight
articles also remain discoverable in the complete news feed.

### Extra feature flag

`VITE_ENABLE_EXTRA` is a build-time opt-in. Only the exact string `true` enables
it. Missing, `false`, blank, and unrecognized values all mean disabled.

| Flag | Requested theme | Result |
| --- | --- | --- |
| Disabled | Any URL or saved preference, including `extra` | Cinematic standard; no edition toggle |
| Enabled | Valid URL `classic` or `extra` | Requested edition; toggle available |
| Enabled | No valid URL, valid stored theme | Stored edition; toggle available |
| Enabled | Neither is valid | Cinematic standard; toggle available |

Keep `classic` as the internal/URL compatibility name for the new standard.
Enforce the flag for initial resolution and subsequent theme changes, so an
old bookmark or saved preference cannot activate Extra while disabled. Preserve
unrelated URL filters. Avoid loading Extra-only assets into the default
experience. Document how to enable the flag for local builds and both deployment
workflows; rebuilding is required. The default shipped build is disabled.

### Motion

Use a lightweight canvas particle sphere, a brief entrance sequence, gentle
fine-pointer response on desktop, and one-time reveals as news enters view.
Use a calmer, lower-density treatment on phones. Content and links must remain
available when canvas is unavailable or motion is disabled.

Respect `prefers-reduced-motion` on initial load and when it changes; it overrides
any saved animation preference. Provide an accessible motion toggle and retain
the user's choice when storage is available. Stop animation work when the art
is offscreen, the tab is hidden, or the component unmounts. Reduced motion uses
a static composition with no hidden unrevealed text and no animated scrolling.

## 5. Edge cases

- No brief: show an honest unavailable state and direct access to news;
  retain a useful cover without inventing bullets or a content headline.
- Empty archive: show a clear no-news state. Failed/invalid dataset fetch:
  show an actionable load error with retry, rather than an empty finished page.
- Quiet day or failed generation with a carried brief: show its original date
  and the latest run's status. The feed remains usable.
- Five long bullets, long article titles, Chinese text, 200% zoom, or a short
  phone viewport: allow natural vertical growth; no clipping or horizontal
  page overflow. Source links stay reachable.
- Zero matching articles: show the selected filters and a reset action;
  changing filters resets pagination to a valid page.
- No notable articles or only one: adapt the cover without placeholders.
  Missing optional article tags must not break the feed.
- Blocked storage, unavailable canvas, reduced motion, or blocked custom fonts:
  retain usable navigation, readable fallback typography, and visible content.
- Extra preference/bookmark from an earlier visit: resolve to the new standard
  while the flag is off; preserve normal URL/storage precedence when enabled.

## 6. Acceptance criteria

1. WHEN the default site opens THEN it SHALL show the approved editorial cover,
   actual brief content and at most two eligible notable stories before the
   full news section; no oversized brand-only heading or initial tag wall.
2. WHEN a reader scrolls THEN the page SHALL naturally reveal full summaries
   with source links, and every matching article SHALL remain reachable.
3. WHEN search, categories, tags, pagination, history, or shared URLs are used
   THEN the standard edition SHALL retain their functional behavior and focus.
4. WHEN Trends is selected THEN its existing charts, drilldowns, and health
   information SHALL remain available in the standard shell.
5. WHEN headline generation is added THEN it SHALL use the existing brief call;
   both legacy responses/data and new responses SHALL remain usable, and a bad
   optional headline SHALL NOT discard otherwise valid bullets.
6. WHEN Chinese is selected THEN summary and brief fallback SHALL follow F12;
   missing headline translation alone SHALL NOT replace valid Chinese bullets.
7. WHEN a previous brief is carried THEN the cover SHALL show its actual date
   and current quiet/failure status without claiming a new brief was generated.
8. WHEN `VITE_ENABLE_EXTRA` is not exactly `true` THEN no toggle or URL/storage
   path SHALL activate Extra; WHEN enabled THEN both editions SHALL be reachable.
9. WHEN the viewport is 320, 375, 768, or 1440 pixels wide THEN content and
   navigation SHALL remain readable and usable without horizontal page overflow.
10. WHEN reduced motion is requested, storage is blocked, fonts fail, or canvas
    is unavailable THEN all content and controls SHALL remain usable; animation
    SHALL pause offscreen and in hidden tabs and clean up on unmount.
11. WHEN using keyboard navigation THEN controls SHALL have visible focus,
    menus SHALL support dismissal and focus return, and essential information
    SHALL NOT require hover. Text/control contrast SHALL meet WCAG AA targets.
12. WHEN the full existing test suite runs THEN ingestion selection, brief
    clipping/status, bilingual behavior, and Telegram duplicate/pending/uncertain
    protection SHALL still pass alongside the new feature tests.

## 7. Verification plan

After plan approval and implementation, Codex runs local checks and browser
inspection; Marco reviews the visual result. These are planned checks, not
completed verification. No live AI generation or Telegram send is required.

Commands for Windows cmd:

```bat
cd /d F:\project\AI-news
npm test
set VITE_ENABLE_EXTRA=false
npm run build
set VITE_ENABLE_EXTRA=true
npm run build
set VITE_ENABLE_EXTRA=false
npm run build
npm run dev
```

Expected: the test runner reports zero failures; every build completes with
exit code 0; the final build has Extra disabled. Vite prints a local address
under `/AI-News-Reader/` that opens the new standard edition.

- Add focused tests for flag resolution (including invalid values and saved
  Extra preferences), headline parsing/fallback, notable selection, and any
  changed URL or language behavior. Use mocked model responses and dataset
  fixtures for old/new briefs and quiet/failure states.
- Inspect both flag builds in-browser, including `?theme=extra` and stored
  preferences; verify disabled builds never render Extra and enabled builds can
  switch both ways. Inspect the final default asset loading for Extra leakage.
- Inspect desktop, tablet, and phone sizes in criterion 9 with English and
  Chinese, five long bullets, no brief, and zero/one/two notable stories.
- Check native scrolling, menus, keyboard focus, deep links, search typing,
  tag drilldowns, pagination, Trends, retry, and empty results.
- Check reduced motion, the motion toggle, hidden-tab/offscreen suspension,
  font/canvas fallbacks, and readable contrast. Record actual results in the
  implementation plan; do not mark unperformed checks complete.

## 8. Open questions

No blocking design questions. Assumptions for approval:

- Adopt the prototype's default open editorial composition, with two notable
  stories maximum and a seven-day eligibility window.
- “Fully adapt” includes a dynamic brief headline generated in the existing
  call; older records use a neutral fallback without a paid backfill.
- A flat, paginated detailed feed replaces the current All-view grouped
  previews. Existing filtering semantics and Trends remain available.
- “Flag off” disables Extra itself, including old links/preferences, rather
  than only hiding its toggle. Extra code is retained for future opt-in.
- This is an independently requested UI workstream alongside F13–F15, not a
  prerequisite that blocks their separate scope. Implementation remains gated.

### Approval record

- **Visual direction approved:** Marco said, “I want to fully adapt this,”
  referring to the cinematic Daily Brief prototype, and requested Extra be
  retained behind a default-off flag.
- **Gate 1 — technical spec:** approved on 2026-09-08. Marco replied
  “approved” to the presented spec; the scope and assumptions above are accepted.
- **Gate 2 — implementation plan:** approved on 2026-09-08; Marco replied
  “approve” to [plan.md](./plan.md).
- **Production implementation:** complete locally on 2026-09-09. Final suite:
  124 tests passed, zero failures; both flag builds passed. Desktop/phone,
  bilingual, navigation, keyboard, fallback, and simulated motion checks are
  recorded in [plan.md](./plan.md). Native 200% browser zoom remains unchecked
  because the in-app browser offers no working zoom control; F16 stays Build
  until that check is recorded. Preview is ready for Marco's visual review.
- **Implementation refinements:** system-font typography needs no font downloads;
  the optional page/share metadata cleanup removes stale Claude branding. No
  change to source data, provider selection, token budget, or Telegram behavior.
- **Publication:** not requested or performed. Existing archive data has no
  brief headline, so its neutral fallback remains until normal future ingestion.

## Scope extension — Full standard-interface localization (2026-09-09)

**Approval status:** Gate 1 approved by Marco with “approve” on 2026-09-09,
in response to the focused localization spec. The original cinematic design and
implementation-plan approvals remain valid. The focused localization plan is
approved in `plan.md`: Marco replied “approved” on 2026-09-09 to the focused
implementation plan. Gate 2 is complete; localization implementation and offline
verification are authorized. No publication or live pipeline activity is authorized.

### 1. Problem statement

Selecting 繁體中文 currently changes generated summaries and Daily Brief content,
while most standard-interface controls remain English. The standard website must
use one coherent selected interface language, independently of whether individual
content items have a Chinese translation. This extends F12's intentionally
summary-only scope for the F16 standard edition.

### 2. Constraints

- Preserve the implemented dark editorial cover, particle sphere, Daily Brief,
  up to two notable stories, and detailed news below. Only text and necessary
  wrapping adjustments change; Extra stays behind default-off `VITE_ENABLE_EXTRA`.
- Reuse `en` / `zh-HK` and the shared `ai-briefing-language` preference. Keep the
  English first-visit default, reload persistence and safe blocked-storage behavior.
- Use natural Hong Kong Traditional Chinese and authored, local interface copy.
  No AI calls, new dependencies, archive changes or filter-data migrations.
- Preserve original article titles, sources, URLs, proper names, existing content
  translations, article fallback and whole-brief fallback, including headline
  selection by the actual bullet language.
- Preserve all existing uncommitted work. No commit, push, deployment, live
  ingestion/backfill, Telegram send or delivery-state changes.

### 3. Non-goals

- No redesign or full localization of Extra-only components; shared controls may
  receive localized copy without changing Extra's layout or availability.
- No historical content translation, generated headline rewrite, source-health
  repair, taxonomy change, new language preference or URL language parameter.

### 4. Interfaces & data shapes

- The standard switch describes website language, with `EN` and `繁體中文` choices.
  All interface copy follows the preference, including during loading and errors.
- Translate navigation, desktop rail, index menu, section labels, footer, buttons,
  search placeholders, category displays, filter group names, clear/remove actions,
  pagination, counts, dates, status/empty/error copy, motion settings, Trends,
  source-health explanations, tooltips and accessible names.
- Examples: `Research` displays as `研究`; `All news` as `全部新聞`; `Read original`
  as `閱讀原文`; `Trends` as `趨勢`; `Clear all filters` as `清除所有篩選條件`.
- A stored article `{ category: "Research", tags: { topics: ["inference"],
  traits: [], entities: ["OpenAI"] } }` retains these exact values. Display known
  descriptive topic/trait labels in Chinese, retain proper names and technical
  identifiers, and preserve unknown dynamic tags verbatim. Labels are never used
  as filter values: selecting `研究` still produces `category=Research`.
- Locale-aware date/number presentation does not change timestamp values, time
  zone policy, ordering, counts, chart calculations or URL parameter names.
- Interface language and selected-content language remain separate. For example,
  with Chinese selected and an English-only article, `閱讀原文`, dates, category
  labels and the existing Chinese fallback notice remain Chinese; the summary
  stays English. Language attributes identify the actual content language, while
  the standard interface declares the selected language.

### 5. Edge cases

- Partial/legacy briefs: retain whole-English content fallback and the notice;
  surrounding navigation, edition labels, citations and status copy stay Chinese.
- Missing brief, missing summary, empty archive or zero matches: show localized
  authored explanations and usable navigation/reset controls, without inventing news.
- Fetch failure or malformed data: show a localized retry message; changing the
  language while the error is visible updates it immediately without a new fetch.
- Unknown categories/tags: display their canonical value when no authored mapping
  exists, preserving access and filter identity. Known categories are all mapped.
- Feed failures: translate health labels and recognized failure descriptions;
  unknown diagnostic text gets a localized explanation and can remain verbatim as
  technical detail. Never fabricate a translation or lose an HTTP/error code.
- Blocked storage or invalid saved language: preserve F12's English default and
  in-memory switching. Do not claim reload persistence when storage is blocked.
- Long Chinese labels, narrow screens and reduced motion: controls wrap naturally,
  remain keyboard accessible, and retain the existing reduced-motion override.

### 6. Acceptance criteria

L1. WHEN either language is selected THEN all authored standard-interface text,
including accessible names and tooltips, SHALL immediately use that language.
L2. WHEN content falls back to English THEN the interface SHALL still use the
selected language and F12 content selection/fallback notices SHALL remain intact.
L3. WHEN the page reloads THEN the shared saved choice SHALL be restored where
storage works; invalid/blocked storage SHALL not prevent rendering or switching.
L4. WHEN categories/tags, search, pagination, Trends drilldowns or history are used
THEN their existing results, canonical values, URLs and focus behavior SHALL persist.
L5. WHEN counts, dates, empty/error/loading states, quiet/failed briefs or feed
health are displayed THEN their authored labels SHALL use the selected language.
L6. WHEN switching languages on desktop/mobile THEN the approved design SHALL
remain intact with readable wrapping and no horizontal page overflow.
L7. WHEN language changes THEN no translation request, archive mutation, new
dependency, content-title/source rewrite or change to Extra's flag SHALL occur.
L8. WHEN verification finishes THEN actual tests, both flag builds, both language
directions, reload, interaction checks and Chinese visual evidence SHALL be
recorded; old F16 test results SHALL NOT count as localization verification.

### 7. Verification plan

After approval of the extension spec and its implementation plan, Codex runs:

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

Expected: zero failed tests, successful builds in both flag states, final build
default-off. Use offline fixtures for fallback, unknown labels, missing/invalid
data, quiet/failed briefs, feed health and blocked storage. Browser-check EN to
Chinese and back, reload in each language, index/rail navigation, keyboard menu
dismissal/focus, search typing, category/tag filtering, pagination and Trends.
Inspect 320/375/768/1440 widths and Chinese desktop/mobile wrapping; show the
Chinese real-archive preview and record screenshots outside the source archive.
Reattempt native 200% zoom only through a supported browser control; keep the
existing open check if it cannot be verified. No tests/builds have been run for
this extension yet.

### 8. Open questions

No blocking product questions. Assumptions for approval: retain `AI Briefing` as
the publication's proper name; use concise HK interface wording; preserve unknown
dynamic labels/technical identifiers; localize all authored standard copy while
leaving Extra-only copy outside this focused scope.

### 9. Localization completion — 2026-09-09

Following the recorded spec and plan approvals, the focused extension is complete
locally. The selected shared language now controls all authored standard-interface
copy independently of content fallback, without AI calls or new dependencies.
Original article titles, source/proper names, URLs, data values and F12 content
selection remain intact. Both language directions, persistence, navigation and
filters/Trends, error/empty/fallback fixtures, accessibility names and desktop/
mobile wrapping were checked. All 130 tests and both Extra flag builds passed.
See the plan's dated implementation result for exact evidence, external Chinese
screenshots and the temporary Windows test-startup workaround. Native 200% zoom
remains the original open F16 check; it is not claimed by the responsive tests.

### 10. Publication approval — 2026-09-09

Marco explicitly requested “deploy it, its ok” after reviewing the completed
localization. This authorizes committing and publishing the approved F16 design
and localization through the existing GitHub Pages deployment workflow. The
earlier local-only boundary is superseded for publication; no manual ingestion,
backfill, archive rewrite or Telegram send is requested. Native 200% zoom remains
an acknowledged open check, not a claimed pass. Publish from the latest remote
main while preserving newer news/delivery records and unrelated local F13–F15 work.
