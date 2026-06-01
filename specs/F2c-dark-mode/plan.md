# Dark mode / Reader UI — Plan

**Spec:** ./spec.md
**Status:** Done

## Approach

Replaced the old `bg-slate-50` / white-card design with a token-based dark system.
All 8 color tokens defined in `src/index.css` via Tailwind 4 `@theme` so they
become first-class utility classes (`bg-canvas`, `text-ink`, etc.) rather than
arbitrary values scattered across components.

Layout changed from a scrolling page to `flex h-screen flex-col` so the top bar
and tab rail are always visible without sticky-position pixel math.

## Affected files

- `src/index.css` — Tailwind 4 `@theme` block with 8 color tokens
- `src/App.tsx` — full restructure: dark layout, tab rail replacing dropdown, pagination state, All-view preview logic
- `src/components/ArticleCard.tsx` — dark surface, editorial byline layout, featured prop, notable left border
- `src/components/CategorySection.tsx` — removed collapsible toggle, added `showHeader`, `featuredFirst`, `limit`, `onSeeAll` props
- `.interface-design/system.md` — design system documentation

## Tasks

- [x] Define color tokens in `src/index.css`
- [x] Restructure `App.tsx` layout to `flex h-screen flex-col`
- [x] Build top bar (brand, search, staleness)
- [x] Build tab rail with live counts, active underline, notable filter
- [x] Add pagination state + reset effect + `01/04` controls
- [x] Add All-view `PREVIEW_SIZE=4` + `+N more →` pattern
- [x] Rewrite `ArticleCard` with dark surface, byline-first layout, featured variant, notable border
- [x] Simplify `CategorySection` — remove collapsible, add new props
- [x] Write `.interface-design/system.md`

## Verification

- AC1 (dark canvas): page background is `#0d1117` — visible in browser devtools computed styles.
- AC2 (tab underline): clicking a tab shows 2px blue bottom border via `after:` pseudo-element.
- AC3 (All-view limit): All tab shows max 4 articles per category section.
- AC4 (pagination): category with >8 articles shows `← prev 01 / 02 next →` at the bottom.
- AC5 (notable border): article with `important: true` has `border-left: 2px solid #e3b341`.
- AC6 (hover): card border and background change on hover.

## Risks / tradeoffs

- No light mode. If the user base widens beyond technical users, this will need revisiting.
- `hover:bg-[#1c2128]` is a hardcoded midpoint value — if surface tokens shift, this won't auto-update.
