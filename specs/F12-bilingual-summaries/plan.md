# English / Hong Kong Traditional Chinese summaries — Plan

**Spec:** [spec.md](./spec.md)
**Status:** Build — published; actual Chinese delivery and wording review pending
**Approval:** "approved, proceed" on 2026-09-06
**Requested:** 2026-09-06; document the plan before coding.

## Plan: Website summary switch and Chinese Telegram default

**Goal:** Offer English/HK Traditional Chinese article summaries and daily briefs
in both website layouts, and default the personal Telegram brief to Chinese.

**Files:**

Documentation changed in this planning task:
- `specs/F12-bilingual-summaries/spec.md` — new behavior and acceptance contract.
- `specs/F12-bilingual-summaries/plan.md` — this new implementation plan.
- `specs/ROADMAP.md` — register F12 as Spec, with draft plan available.

Existing files verified during planning; proposed implementation modifications:
- `src/types.ts` — optional `summaryZhHK` and `textZhHK` fields.
- `ingest/ingest.ts` — paired summary generation, validation and output budgets.
- `ingest/lib.ts` — paired brief prompt and optional Chinese parsing.
- `ingest/backfill.ts` — keep reclassified English/Chinese pairs consistent.
- `src/App.tsx` — mount shared summary-language provider around both layouts.
- `src/ClassicApp.tsx` — place the shared language control in classic header.
- `src/components/extra/Masthead.tsx` — place it in the extra header.
- `src/components/ArticleCard.tsx` — select article summary and show fallback.
- `src/components/BriefPanel.tsx` — select complete brief language and labels.
- `src/components/extra/LeadClipping.tsx` — select lead summary and fallback.
- `src/components/extra/BulletinPanel.tsx` — select brief language and labels.
- `src/lib/filter.ts` — search both stored summary languages.
- `ingest/telegram.ts` — preserve optional fields at validation, select content,
  localize message labels, preserve delivery protection and length handling.
- `ingest/telegram-cli.ts` — resolve and validate language for check/preview/send.
- `.env.example` — document `TELEGRAM_LANGUAGE=zh-HK`.
- `.github/workflows/ingest.yml` — pass optional repository language variable to
  both Telegram configuration check and send; unset remains Chinese.
- `docs/telegram-setup.md` — default, override, fallback and preview instructions.
- `README.md` — explain summary switch, archive transition and generation cost.
- `ingest/__tests__/brief.test.ts` — bilingual parsing and legacy fixtures.
- `ingest/__tests__/deepseek.test.ts` — paired output, invalid Chinese and budgets.
- `ingest/__tests__/telegram.test.ts` — language selection, fallback, limits and
  language-change duplicate/recovery regression cases.
- `src/lib/__tests__/filter.test.ts` — search across both summary languages.

New implementation files (explicitly proposed, not existing):
- `src/lib/language.ts` — locale validation and pure text/brief selection helpers.
- `src/hooks/useLanguage.tsx` — React context/provider with safe localStorage.
- `src/components/LanguageSwitch.tsx` — accessible reusable summary-language control.
- `src/lib/__tests__/language.test.ts` — locale and whole-brief fallback tests.

`public/news.json` receives additive fields only on a subsequent ingestion run;
this task does not hand-edit, regenerate or translate the retained archive.
The unrelated existing `tsconfig.tsbuildinfo` modification is preserved.

Verification addition (2026-09-06): use a temporary Vite fixture server outside
the repository under the task's visualization directory. It serves synthetic
bilingual/partial content and simulates blocked/invalid localStorage for browser
checks, without modifying `public/news.json` or shipping a test mode in the app.
`applyClassification` is exported from the existing backfill module so the
paired-update regression can be tested without running paid backfill.

**Approach:**
1. Extend the existing English-first records with optional Chinese fields and
   implement shared language selection/fallback helpers.
2. Request both versions together in classification/brief calls; validate Chinese
   independently and persist corresponding pairs, including backfill updates.
3. Add a small React context for summary language and a shared switch in both
   headers; update the four existing content surfaces and bilingual search.
4. Default Telegram to `zh-HK`, add `en` configuration override, localize message
   copy, and keep preview selection consistent with actual delivery.
5. Cover legacy data, malformed Chinese, same-day/recovery protections and text
   limits with offline tests; inspect both layouts with bilingual fixtures.
6. Update operator documentation and record verification evidence before rollout.

**New dependencies:** none.

**Assumptions I'm making:**
- The toggle covers both article summaries and daily brief, with English headlines.
- Website defaults to English; persisted explicit choice wins on return visits.
- Telegram uses HK written Traditional Chinese, with disclosed English fallback.
- Navigation/category/tag translation and historical translation are separate work.

**What I will NOT do:**
- Implement before review approval, deploy during planning, send a bot message,
  call paid APIs during planning, or translate the whole archive automatically.
- Change the schedule, recipient model, durable state schema or recovery rules.

**How we'll verify it works:**

```cmd
cd /d F:\project\AI-news
npm test
npm run build
npm run telegram:preview
npm run dev
```

Expected: zero failures, successful build, a preview-only Chinese message or
explicit English fallback, and working switches in both themes. These are future
verification commands, not claims of execution in this documentation task.

## Data contracts

```ts
type SummaryLanguage = "en" | "zh-HK";
// Add to Article: summaryZhHK?: string;
// Add to BriefBullet: textZhHK?: string;
// Existing English summary/text and shared refs remain required as before.
type SelectedText = {
  text: string;
  language: SummaryLanguage;
  fallback: boolean;
};
```

Keep stored data canonical: components select displayed text; do not overwrite
English fields to render Chinese. Search reads both originals. Use element-level
`lang` attributes on selected summary text; the whole page remains mixed-language.
The shared helper must be pure and usable by Node and React, without browser
globals at import time. The provider alone owns localStorage access and catches
read/write exceptions. Use React context to avoid passing language through every
article list and layout prop type.

For Telegram, validate locale before network/state operations. Select a complete
brief language for rendering, but derive delivery identity from the canonical
brief, never the selected display language. Retain the existing same-London-date
guard and durable pending/uncertain lock. No state migration is planned: prior
successful same-day records already prevent resends across deployment.

## Tasks

- [x] Obtain approval of the draft spec and plan; record it and advance status.
- [x] Add optional fields and pure selectors with legacy/fallback tests.
- [x] Extend classifier and brief prompts/parsers, preserving existing English
  validation and citation index-to-URL resolution. Trim/discard invalid Chinese.
- [x] Set bounded larger output allowances (classification
  8192, brief 4000 tokens versus current 4096/2000). Keep existing batch/input
  caps and fail on truncated responses; adjust based on representative output.
  Instruct 1–2 concise sentences per article and at most 120 Chinese characters
  per brief bullet, with equivalent meaning. Do not use English word counts for Chinese.
- [x] Update backfill assignment so replacement English never retains old Chinese
  when new Chinese is missing; no automatic archive backfill is introduced.
- [x] Add provider/switch, selected-content labels and disclosed fallbacks to both
  themes. Verify keyboard focus, mobile wrapping, and CJK font fallback visually.
- [x] Expand search to both languages while preserving counts/ranking/filter state.
- [x] Add Telegram locale parsing and localized formatting; preserve optional
  fields in `checkBrief` (it currently reconstructs and would drop them).
- [x] Extend workflow/environment/setup docs for optional language override.
- [x] Run offline checks and manual UI/preview review against spec AC1–10.
- [x] Record implementation evidence in the spec.
- [x] Publish and run the full workflow at Marco's request; verified three new
  bilingual articles and a complete bilingual brief on the hosted site.
- [ ] Review live wording with Marco: current output uses some colloquial
  Cantonese despite the written-HK prompt. Confirm a future eligible Chinese
  Telegram delivery; the rollout run correctly skipped today's duplicate.

## Verification mapping

- AC1–3: inspect classic/extra desktop and mobile layouts; keyboard switch,
  refresh, theme change, blocked storage, and unchanged filters/page. Provider
  behavior is verified manually without adding a browser-test dependency.
- AC4–5: `npm test`, with paired/legacy/partial/invalid/truncated mocked model
  outputs, and whole-brief English fallback. Confirm request counts do not grow
  solely to translate and brief timestamps/citations remain intact.
- AC6: `npm test` bilingual filter fixtures, then search a Chinese phrase in both
  display modes and verify the same matching article/counts.
- AC7: default/`en`/invalid environment fixtures and CLI preview; no credentials
  required for preview, no network/state writes. Check workflow passes preference
  consistently to validation and send.
- AC8: long CJK, emoji, markup and URLs in Telegram formatter fixtures; include
  fallback notice in the final length calculation.
- AC9: existing delivery/recovery tests plus language changes on sent/pending
  state. Assert no second request and no state-schema change.
- AC10: exercise reclassification assignments with missing and updated Chinese
  using offline fixtures; confirm old translations cannot survive English changes.
- `npm run build`: catches all React/TypeScript integration errors.
- Human language review: compare English/Chinese fixture pairs; real model
  wording quality remains unverified until a live sample is reviewed by Marco.

## Risks / tradeoffs

- Same call count does not mean same bill: bilingual text increases output tokens
  and may increase duration. No precise currency estimate is included; larger
  output ceilings are limits, not guaranteed billed usage. Do not inherit the
  prior 2–4 hour single-language estimate for this broader feature.
- Optional Chinese fields enable gradual rollout, but older content can remain
  English. Fallback labels make that visible without incurring backfill charges.
- Structural validation cannot prove Traditional Chinese quality or factual
  equivalence. HK-specific prompting and human sample review are required;
  avoid brittle character-only rules that reject legitimate English names.
- Generating paired text in one response couples both versions if the overall
  response truncates. Bounded larger budgets and truncation tests reduce this
  risk; preserve existing failure/carry-forward behavior.
- Compact extra-layout rows intentionally remain headline-only. All existing
  summary surfaces change language; this feature does not redesign those rows.
