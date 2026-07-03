# AI Daily Brief — Plan

**Spec:** ./spec.md
**Status:** Build (plan approved 2026-07-02)

## Approach

Extend the ingest pipeline with one additional Claude call after
classification. The run's newly classified articles (capped, important-first)
are serialized into a synthesis prompt for **`claude-opus-4-8`**, which returns
3–5 bullets that cite the *indices* of their source articles; indices are
resolved to article URLs and validated before the brief is written into
`news.json` as a `brief` object. All prompt-building, response
parsing/validation, and carry-forward logic lives in `ingest/lib.ts` as pure
functions so it is testable without network access — `ingest.ts` only wires
them to the API client, inside `withRetry` plus a catch-all so a brief failure
can never fail the run (spec AC5).

Model rationale: Opus 4.8 is the current recommended default model and this is
a single small call per run (~20–50K input tokens ≈ $0.10–0.25, a few
dollars/month at the daily cadence) where synthesis quality is the whole
feature. Haiku 4.5 stays for bulk classification; downgrading the brief call is
a one-line change if cost ever matters. Response parsing reuses the same
JSON-extraction pattern as `classifyBatch` (works on the pinned SDK version);
structured outputs (`output_config.format`) is a possible refinement after an
SDK bump. No sampling parameters are sent (`temperature`/`top_p` are rejected
on Opus 4.8).

UI: a `BriefPanel` rendered above the article sections in the All view only,
in the dark-academic language — mono `// today's brief` header with the brief
date, bullet text in body sans, numbered citation links (`[1]`, `[2]`) in
accent mono opening the cited articles.

## Affected files

- `src/types.ts` — add `Brief` / `BriefBullet`; `brief?: Brief` on `NewsData`.
- `ingest/lib.ts` — `selectBriefInput()`, `buildBriefPrompt()`, `parseBriefResponse()`, `carryForwardBrief()` (all pure).
- `ingest/ingest.ts` — `generateBrief()` wiring after classification; carry-forward on zero-new-article runs and on failure.
- `ingest/__tests__/lib.test.ts` — tests for the four pure functions.
- `src/components/BriefPanel.tsx` — new component.
- `src/App.tsx` — render `BriefPanel` when `data.brief` exists and the All view is active.
- `.interface-design/system.md` — document the brief-panel pattern.

## Data contracts

```ts
// src/types.ts
export type BriefBullet = {
  text: string;   // ≤ ~40 words
  refs: string[]; // URLs of cited articles — validated subset of the run's new articles
};

export type Brief = {
  generatedAt: string;    // ISO timestamp of the run that produced it
  bullets: BriefBullet[]; // 3–5 entries
};

// NewsData gains:  brief?: Brief
```

Model response contract (enforced by `parseBriefResponse`):
`[{"text": string, "refs": number[]}]` where `refs` index into the submitted
article list. Out-of-range indices are dropped; a bullet with empty text is
rejected; a response with fewer than 3 or more than 5 valid bullets fails
validation, in which case the previous brief is carried forward.

## Tasks

- [ ] Add `Brief` / `BriefBullet` types to `src/types.ts`.
- [ ] `ingest/lib.ts`: implement `selectBriefInput` (cap ~50 articles, important first then newest), `buildBriefPrompt`, `parseBriefResponse` (shape + ref validation, index → URL resolution), `carryForwardBrief`.
- [ ] Tests: valid response, malformed JSON, out-of-range refs dropped, bullet-count bounds enforced, carry-forward on empty run and on failure.
- [ ] Wire `generateBrief` into `ingest/ingest.ts` (after classification, `withRetry` + try/catch); write `brief` on both output paths (new articles / no new articles).
- [ ] `BriefPanel.tsx` + All-view integration in `App.tsx`; citation links open the cited article in a new tab.
- [ ] Update `.interface-design/system.md` with the panel pattern.

## Verification

Maps to acceptance criteria in `spec.md`:

- AC1 (generated + stored): `npm run ingest` on a run with new articles → `public/news.json` contains `brief` with 3–5 bullets and a fresh `generatedAt`.
- AC2 (citations): unit test proves every ref resolves to a submitted article URL; in the UI, citation links open the article.
- AC3 (carry-forward): unit test + immediate ingest re-run (0 new articles) leaves `brief` unchanged with its original date shown in the UI.
- AC4 (placement/styling): `npm run dev` — panel appears above sections in All view, absent on category tabs, matches the design system.
- AC5 (failure isolation): unit test with malformed model output — validation fails, run completes, previous brief retained.
- AC6 (importance weighting): prompt contains the weighting instruction; spot-check one live run's bullets against that day's notable articles.
- `npm test` green; CI test gate passes.

## Risks / tradeoffs

- The model may cite wrong or fabricated indices — mitigated by strict validation against the submitted batch; a bullet whose refs are all dropped still renders (refs are supporting evidence, not a hard requirement).
- Cost is per scheduled run (~$0.10–0.25/run → a few dollars/month at daily cadence). Accepted at Gate 1 for the flagship feature; the Haiku downgrade path is documented above.
- Article titles/snippets are untrusted prompt input — bullets render as plain text (React escapes by default) and refs are URLs from our own fetch, so the injection surface is negligible.
- `max_tokens` ≈ 2000 is ample for 5 bullets; the response is small, so no streaming is needed.
