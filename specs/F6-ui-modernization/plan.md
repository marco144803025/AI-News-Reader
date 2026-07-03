# UI Redesign — "Stop the Presses" — Plan

**Spec:** ./spec.md
**Status:** Plan

## Approach

Split presentation from state so the two lineages provably share all business
logic (spec AC). `App.tsx` becomes a thin shell: it resolves the theme, runs
the shared state (data fetch, `useUrlState` filters, category counts,
pagination), and renders either `ClassicApp` — the current JSX extracted
verbatim, zero visual change — or the new `extra/` component tree, both fed by
the same props. Theme resolution is a pure function (`resolveTheme(urlParam,
stored)`: URL wins, localStorage persists, default classic) so it is unit-
testable; a visible toggle in both lineages writes localStorage and syncs the
URL via `history.replaceState`.

The Stop the Presses lineage is pure presentation over existing data. A small
`rank.ts` module derives the front-page hierarchy (lead = first `important`
article in the filtered set, else newest; `FRESH` = published < 24h; rest =
clippings list) — pure and tested. Motif tokens live in Tailwind 4 `@theme`
(paper, ink, press-red) plus plain CSS custom properties for the loudness dial
(`--tilt-unit`, `--stamp-tilt`); every rotation is `calc(var(--tilt-unit) *
n)`, so turning the design down is a one-line change. Rotations apply to inner
visual wrappers only — outer links/buttons stay unrotated rectangles,
satisfying the hit-area AC. Fonts (Anton, Archivo, JetBrains Mono; latin
woff2 subsets) are self-hosted in `public/fonts/` with `font-display: swap`
and OFL license files. The F8 bulletin panel renders only when `data.brief`
exists, and the footer TRENDS block only when the F9 view ships — both slots
degrade to absent, so F6 has no dependency on either feature.

## Affected files

- `src/App.tsx` — becomes the shell: theme resolution + shared state + lineage switch.
- `src/ClassicApp.tsx` — new; current `App.tsx` JSX extracted unchanged.
- `src/hooks/useTheme.ts` — new; `resolveTheme()` pure function + hook (URL param, localStorage, toggle setter).
- `src/lib/rank.ts` — new; `rankFrontPage(articles, now)` → lead / fresh flags / rest; pure.
- `src/lib/__tests__/rank.test.ts`, `src/lib/__tests__/theme.test.ts` — new tests.
- `src/components/extra/` — new lineage: `Masthead.tsx`, `TapeNav.tsx`, `ExtraFilterBar.tsx`, `BulletinPanel.tsx`, `LeadClipping.tsx`, `ClippingRow.tsx`, `ClippingsList.tsx`, `PressFooter.tsx`, primitives `OffsetPanel.tsx`, `Stamp.tsx`, `TapeChip.tsx`.
- `src/components/extra/copy.ts` — new; all diegetic label strings (EXTRA, THE CLIPPINGS, FRESH, BULLETIN…) in one module.
- `src/index.css` — add `@font-face` rules, extra-lineage `@theme` tokens, loudness-dial custom properties, reduced-motion guards.
- `public/fonts/` — new; woff2 files + OFL.txt per family.
- `.interface-design/system.md` — new "Stop the Presses lineage" section (tokens, devices, dial).

## Data contracts

No changes to `news.json`. New internal types only:

```ts
// src/hooks/useTheme.ts
export type Theme = "classic" | "extra";
export function resolveTheme(urlParam: string | null, stored: string | null): Theme;

// src/lib/rank.ts
export type RankedFrontPage = {
  lead: Article | null;          // first important in filtered set, else newest
  rest: Article[];               // remaining articles, filtered order preserved
  isFresh(a: Article): boolean;  // publishedAt within 24h of `now`
};
export function rankFrontPage(articles: Article[], now: number): RankedFrontPage;
```

Ransom-word rule (deterministic, no API call): highlight the longest word of
the lead headline with ≥ 5 letters; ties broken by earliest position.

## Tasks

- [x] Self-host fonts: download latin woff2 subsets for Anton, Archivo (400/500/italic-400), JetBrains Mono (400/500) into `public/fonts/` with OFL licenses; add `@font-face` + `font-display: swap` to `index.css`. (~107KB total.)
- [x] Theme infrastructure: `resolveTheme()` + `useTheme` hook + tests; extract `ClassicApp.tsx` from `App.tsx`; shell renders by theme.
- [x] Extra tokens: `@theme` additions + loudness-dial custom properties + reduced-motion media guards.
- [x] Primitives: `OffsetPanel`, `Stamp`, `TapeChip` — rotation on inner wrapper, rectangular outer hit-area.
- [x] `rank.ts` + fixed-clock tests.
- [x] `Masthead` + `TapeNav` — 375px wrap verified (13 chips, no horizontal scroll).
- [x] `LeadClipping` + `ClippingRow` + `ClippingsList` with shared pagination.
- [x] `ExtraFilterBar` — reuses `lib/filter.ts` + URL state.
- [x] `BulletinPanel` (renders iff `data.brief` — F8 slot) + `PressFooter`.
- [x] Accessibility pass: focus-visible states, aria labels, AA-driven token split (see deviations).
- [x] Update `.interface-design/system.md`; ROADMAP updated.

### Deviations from the original plan (recorded during Build)

- **Extra tokens grew by two reds:** `press-red` (#e5341f) failed AA for small
  text, so `press-red-deep` (#b3220e) carries small red text/stamps on paper
  and `press-red-bright` (#ff6f54) carries red text on ink surfaces. Bright
  red remains for display-size blocks (ransom word, masthead slash).
- **Panels stay unrotated.** To honor the rectangular-hit-area AC to the
  letter, tilt lives on decorative elements (stamps, strips, ghost numerals,
  section label) and on inner visual wrappers of chips/rows; the offset-print
  panels themselves are straight.
- **Filters collapsed by default.** With the live 550-article archive the tag
  universe is 100+ chips, which buried the lead clipping (worst at 375px).
  `ExtraFilterBar` now collapses behind a `FILTERS +` toggle with an active
  count; classic is unchanged.
- **Entity-decode display fix.** Live data exposed raw HTML entities in feed
  titles (`&#8217;`); added `src/lib/text.ts` (`decodeEntities`) applied in
  the extra lineage. Root-cause ingest fix spun off as a separate task.
- **Additional shared modules** beyond the original list: `lib/paginate.ts`
  (used by both lineages), `lib/text.ts`, `categoryCounts`/`collectTagUniverse`
  in `lib/filter.ts` (classic `FilterBar` now imports the shared universe
  helper), and `useUrlState` now preserves non-filter URL params (`theme`,
  future `view`) instead of rebuilding the query string.

## Verification

Status 2026-07-02: 56/56 unit tests pass; `npm run build` clean; live checks
done in the dev preview (flag/toggle/persistence, ranked hierarchy on real
data, 375px wrap measured `scrollWidth === clientWidth` with all 13 chips,
hover inversion, Primer-hex grep = 0 matches, Anton computed as the rendered
font, built CSS carries the `/AI-News-Reader/` base on font URLs).
**Still pending manual runs:** Lighthouse accessibility baseline comparison
(AC10) and `prefers-reduced-motion` emulation (AC8 — the CSS guard is in
place); font-blocked fallback rendering (AC6) not yet exercised.

Maps to acceptance criteria in `spec.md`:

- AC1 (flag behavior): theme tests (`resolveTheme` URL-wins/persistence matrix); manual — `?theme=extra`, toggle, reload, both lineages.
- AC2 (ranked hierarchy from existing data): `rank.ts` unit tests; visual check in `npm run dev`.
- AC3 (375px nav wrap): preview at 375px width — every category visible, no horizontal scroll.
- AC4 (rotation limits + hit areas): grep that reading-copy tilts use ≤ `1 * var(--tilt-unit)` (unit = 1°); DevTools check that link hit-boxes are unrotated.
- AC5/AC9 (contrast + no Primer values): contrast-check final tokens (ink/cream AA, white-on-red only on Anton display sizes); `grep -ri "0d1117\|161b22\|21262d\|58a6ff" src/components/extra src/index.css` scoped to the extra lineage returns nothing.
- AC6 (font fallback): block `public/fonts/` in DevTools → layout intact on Impact/monospace fallbacks.
- AC7 (shared logic): code review — `extra/` imports state exclusively from shared hooks/lib; no forked filter/pagination logic.
- AC8 (reduced motion): emulate `prefers-reduced-motion` in preview → transitions become instant.
- AC10 (Lighthouse): run accessibility audit on classic (baseline) then extra — extra ≥ baseline.
- `npm test` and `npm run build` green; classic lineage pixel-identical spot-check (before/after screenshots of the extraction commit).

## Risks / tradeoffs

- Anton all-caps headlines wrap poorly on very long titles — clamp to 3 lines with `text-wrap: balance`, and step the font size down for titles > ~70 chars.
- Real article titles vary wildly (vs. curated mockup copy) — the ransom-word rule is deterministic but may pick a dull word; acceptable, revisit only if it grates.
- Four font files add weight — latin subsets, woff2 only, `swap` keeps first paint unblocked; budget ≤ ~180KB total.
- The classic-extraction commit is the riskiest step (touching working UI) — it lands alone with a zero-diff screenshot comparison before any new-lineage code.
- Tilted elements can create 1–2px overflow at container edges — canvas padding absorbs it; verify no horizontal scrollbar at 375px.
- Red fatigue in daily use — the dial exists; "Midnight Signal" remains the named fallback direction per the spec.
