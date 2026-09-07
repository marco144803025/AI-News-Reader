# SPEC: English / Hong Kong Traditional Chinese summaries

**ID:** F12-bilingual-summaries
**Status:** Build — published; live Chinese Telegram delivery pending
**Owner:** Marco
**Sequence:** After F11, as explicitly requested on 2026-09-06.

Marco approved this spec and the accompanying plan with "approved, proceed"
on 2026-09-06. Implementation and offline verification are authorized.

## 1. Problem statement

Marco wants English source news with a choice of English or Hong Kong
Traditional Chinese summaries. Both website layouts need a visible language
switch, and the personal Telegram brief should default to Traditional Chinese.

User stories:
- As a reader, I want to switch article summaries and the daily brief between
  English and 繁體中文 without waiting for translation.
- As Marco, I want my morning Telegram summary in familiar Hong Kong written
  Chinese, retaining the original source links and English technical names.

## 2. Constraints

- Preserve the static React/Vite website, offline Node/TypeScript ingestion,
  existing DeepSeek integration, and scheduled delivery architecture.
- Generate paired English and Chinese text in the existing classification and
  brief calls. No translation calls on page views, toggles, or Telegram sends.
- Use `en` and `zh-HK`; Traditional Chinese with authentic Hong Kong vocabulary
  and a natural Cantonese-influenced written tone. Particles and pronouns such as
  `嘅` and `佢` are welcome; do not use Simplified Chinese.
- Preserve proper names, product/model identifiers, code terms, numbers, and
  factual qualifications. Both versions express the same claims and citations.
- No new dependencies, secrets, server, or paid services.
- Windows instructions use cmd. Automated checks are offline.

## 3. Non-goals

- No translation of full source articles, headlines, tags, category identifiers,
  or the whole website navigation/settings interface. Label the control
  "Summary language" so its scope is explicit.
- No automatic paid translation of the historical archive.
- No incoming Telegram command listener, per-subscriber preferences, or second
  daily message. Telegram language is an owner configuration option.
- No deployment, live API generation, or live Telegram send in this planning task.

## 4. Interfaces & data shapes

Keep existing English fields, adding optional Chinese siblings. Example fragments:

```json
{
  "summary": "The release improves tool use while retaining API compatibility.",
  "summaryZhHK": "新版本改善工具使用能力，同時維持 API 相容性。"
}
```

```json
{
  "generatedAt": "2026-09-06T06:05:00Z",
  "bullets": [{
    "text": "The release improves tool use while retaining API compatibility.",
    "textZhHK": "新版本改善工具使用能力，同時維持 API 相容性。",
    "refs": ["https://example.org/release"]
  }]
}
```

The second fragment illustrates one bullet; a complete brief still has 3–5.
Chinese text shares its English counterpart's timestamp, identity and references.

- Website: `English | 繁體中文` summary switch in both layout headers. Default
  `en` for first visits; persist selection at `ai-briefing-language` in localStorage.
  No browser-locale detection or URL override in v1. Theme changes retain selection.
- Selected Chinese affects all existing summary surfaces and daily brief bullets.
  It does not add summaries to compact rows that currently only show headlines.
- Missing Chinese: show English and `繁體中文摘要暫未提供，以下顯示英文。`.
  Article fallback is per article; a brief falls back as a whole if any bullet
  lacks Chinese, to avoid an unexpectedly mixed-language digest.
- Search indexes both stored summary languages regardless of display preference.
- `TELEGRAM_LANGUAGE=zh-HK` by default when unset/blank; `en` is the supported
  override. Reject other values with an actionable configuration error.
- Chinese Telegram headings/footer use Traditional Chinese, e.g. `AI 新聞早報`
  and `閱讀完整摘要`. Preserve London dates, numbered links, and shortening notice.
  A missing Chinese brief sends the eligible English brief with the explicit
  fallback notice. Preview and delivery select language identically.

## 5. Edge cases

- Existing archives lack Chinese fields: render successfully with the disclosed
  fallback. No ingestion/backfill is triggered by browsing.
- Missing, blank or non-string Chinese model fields: discard the invalid Chinese
  value, retain otherwise valid English, and log a concise degradation warning.
  Do not retry solely to recover a missing translation.
- Malformed overall model response, truncation, or network failure: preserve
  existing bounded retry/error behavior and carry-forward brief behavior; never
  relabel an old brief as fresh. Optional fields do not weaken English validation.
- Partial Chinese brief: display/send the entire English brief with the notice.
- Reclassification replaces English: replace its Chinese sibling in the same
  operation, or remove the old sibling if the new response lacks valid Chinese.
  Never pair new English with a stale translation.
- Storage unavailable or invalid saved language: continue with in-memory state
  and English default; a storage error must not prevent rendering or switching.
- Oversized Chinese Telegram text: escape markup and shorten within the existing
  4096 limit, retaining source/site links and the translated shortening notice.
- Already-sent/pending/uncertain delivery: existing safeguards still apply;
  changing language must not authorize an extra same-day send or bypass recovery.

## 6. Acceptance criteria

1. WHEN either layout is opened THEN it SHALL offer an accessible Summary language
   switch showing English and 繁體中文 with a clear selected state.
2. WHEN the switch changes THEN all available article summaries and the daily
   brief SHALL change immediately without a network request, preserving filters,
   pagination, source links, titles and theme.
3. WHEN the page reloads or theme changes THEN the selected language SHALL persist
   where storage is available; blocked storage SHALL not break the page.
4. WHEN bilingual ingestion succeeds THEN English and Chinese SHALL be stored
   together using the existing call stages; invalid optional translations SHALL
   trigger the documented fallback without discarding valid English.
5. WHEN Chinese is missing THEN website and Telegram SHALL disclose English
   fallback; old archives SHALL remain readable with unchanged timestamps.
6. WHEN searching in either language THEN matching stored summaries SHALL be
   found in either display mode without changing tag/category semantics.
7. WHEN Telegram language is unset THEN preview/send SHALL use Chinese; explicit
   `en` SHALL use English; invalid values SHALL fail before delivery.
8. WHEN Telegram text is long or contains markup THEN the selected-language
   message SHALL retain safe formatting, links, and length limits.
9. WHEN a delivery is repeated or its language is changed THEN existing
   same-day and pending/uncertain protections SHALL remain effective.
10. WHEN an existing item is reclassified THEN its Chinese sibling SHALL update
    with its English summary or be removed, never silently remain stale.

## 7. Verification plan

After implementation, Codex runs offline checks; Marco reviews Chinese wording:

```cmd
cd /d F:\project\AI-news
npm test
npm run build
npm run telegram:preview
set TELEGRAM_LANGUAGE=en
npm run telegram:preview
set TELEGRAM_LANGUAGE=
npm run dev
```

Expected: zero failing tests, successful static build, preview-only output with
Chinese/default or English/override headings, and the same source references.
An old English-only archive shows the fallback notice; stale/no-brief messages
remain valid outcomes. Preview performs no network requests or state writes.
Use offline bilingual and legacy fixtures for deterministic coverage.

Manually verify both `?theme=classic` and `?theme=extra` on desktop/mobile:
switch summaries, refresh, change theme, search in Chinese, and test keyboard
operation and long Chinese text. Review matched English/Chinese sample output
for HK wording, numbers, named entities and factual equivalence.

Offline implementation checks were completed as recorded below. A live ingestion
and delivery check belongs to rollout; offline tests cannot establish real model
translation quality.

## 8. Open questions

No blocking questions for this draft. Assumptions for review:
- "Summary" includes article summaries and the daily brief, not just Telegram.
- Website first-visit default stays English; Telegram defaults to Chinese.
- Authentic Hong Kong Traditional Chinese may use natural Cantonese vocabulary,
  particles, and pronouns; it should still be concise and easy to scan.
- Explicit English fallback is preferable to skipping a useful morning brief.
- New content becomes bilingual; historical content uses fallback until it ages
  out or a separate archive translation task is approved.

Cost note: paired output increases tokens and potentially generation time even
with the same number of call stages. The previous single-language estimate does
not apply to this larger feature. No exact price or time guarantee is made;
measure representative output and adjust token budgets during implementation.

## Implementation evidence — 2026-09-06

Implemented optional `summaryZhHK` / `textZhHK` fields with paired generation
in the existing DeepSeek call stages (classification cap 8192, brief cap 4000).
Invalid optional Chinese is discarded with a warning; backfill replaces or
removes its translation alongside English. Legacy archive data is unchanged.

Both themes expose the shared persisted Summary language switch. Existing article
and brief surfaces select text without mutating stored English; search indexes
both languages. Telegram defaults to `zh-HK`, supports `en`, validates invalid
configuration, preserves canonical delivery identity, and localizes headings,
footer and shortening notices. Partial Chinese briefs fall back as a whole.

Executed verification:

```text
npm test
ℹ tests 111
ℹ suites 28
ℹ pass 111
ℹ fail 0

npm run build
✓ 62 modules transformed.
✓ built in 835ms

npm run telegram:preview
Telegram preview: fresh brief
AI 新聞早報 — 2026-09-06
更新時間 10:54 BST
繁體中文摘要暫未提供，以下顯示英文。
...
Preview only: no network or state writes. Remote duplicate status: unknown.
```

The initial sandboxed test invocation failed before tests started because Node's
Windows user lookup returned `uv_os_get_passwd ENOMEM`. The approved test and
preview invocations outside that sandbox passed. Tests mock network/state and
cover CLI default/English/invalid locales, canonical identity across language
changes, partial/invalid Chinese, Unicode/HTML limits, and stale backfill removal.

Browser checks used the real legacy archive plus a separate local Vite server
serving synthetic bilingual data, without changing `public/news.json`:
- Classic and extra desktop layouts display Chinese summaries with unchanged
  English titles and citation links; switching back restores English.
- Both layouts visually checked at 390 × 844; header controls and Chinese text
  wrap within the viewport. Temporary viewport override was reset after QA.
- Reload and theme change preserve language; keyboard Enter activates the switch.
- Switching on extra page 02/02 preserves pagination. Searching `相容性` matches
  13 bilingual fixtures in English or Chinese display mode; filter state survives
  switching language/theme. The English-only fixture is correctly excluded.
- Blocked localStorage still permits switching and theme changes; an invalid
  saved locale defaults to English. Partial briefs disclose whole-English fallback
  in both layouts while translated article summaries remain Chinese.
- No browser console errors were recorded on the final fixture check.
- `git diff --check` passed. No dependency or retained-archive changes.

Pending rollout: commit/publish, generate bilingual news in a live run, review
HK wording with Marco, and confirm an eligible Chinese Telegram delivery.
No deployment, paid model requests, credentials changes, archive backfill, or
Telegram messages were made during implementation. F12 remains Build until
live rollout is verified; the local implementation and offline checks are complete.

## Publication evidence — 2026-09-06

At Marco's request, pushed implementation commit `6d67eca` and dispatched the
full Daily Ingest & Deploy workflow. Run
[34051731622](https://github.com/marco144803025/AI-News-Reader/actions/runs/34051731622)
completed successfully. Pre-push tests again passed: 111 tests, zero failures.

Run output:
```text
3 new articles after dedup.
brief ok (3 bullets).
Wrote public/news.json — 270 articles total (3 new), 11 categories.
Telegram: skipped (already sent)
```

Verified the hosted website displays the new Chinese article summaries and all
three Chinese brief bullets, with original English titles and source links.
The workflow generated archive commit `e039642`; it was fast-forwarded into the
local workspace so refreshing the local preview also loads the new archive.
Existing retention logic pruned expired articles; 267 retained older articles
remain English-only. No historical translation/backfill was run.

Today's earlier Telegram delivery prevented a duplicate, as required. Actual
Chinese delivery remains to be verified on a future eligible run. Marco reviewed
the live model sample on 2026-09-07 and approved its authentic Hong Kong tone,
including natural use of `嘅` and `佢`. The prompts now explicitly request that
style while continuing to reject Simplified Chinese and preserve English
technical terms. No extra generation or manual rewriting was performed.
