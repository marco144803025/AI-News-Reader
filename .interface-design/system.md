# AI Briefing — Interface Design System

## Direction & Feel

**Product:** AI news reader for technical users (developers, researchers) staying current with the AI industry.
**Feel:** Dark academic briefing. Dense, precise, calm. Like a classified intelligence terminal — authoritative, not decorative.
**Who:** Technical person scanning daily at a desk. Wants signal, not chrome.

---

## Depth Strategy

**Borders + subtle surface lift.** No drop shadows anywhere.
- Cards: `border-[rgba(240,246,252,0.07)]` default → `border-[rgba(240,246,252,0.15)]` on hover
- Cards also lift background on hover: `hover:bg-[#1c2128]` (midpoint between surface-1 and surface-2)
- Section dividers: `bg-[rgba(240,246,252,0.06)]` 1px horizontal rule
- No `shadow-*` classes used

---

## Color Tokens

Defined via Tailwind 4 `@theme` in `src/index.css`. Use as standard utility classes (`bg-canvas`, `text-ink`, etc.).

| Token           | Value       | Role                                      |
|-----------------|-------------|-------------------------------------------|
| `canvas`        | `#0d1117`   | Page background                           |
| `surface-1`     | `#161b22`   | Cards, top bar background                 |
| `surface-2`     | `#21262d`   | Inputs, count badges (inactive)           |
| `ink`           | `#e6edf3`   | Primary text, active tab labels           |
| `ink-secondary` | `#8b949e`   | Body text, inactive tab labels, summaries |
| `ink-muted`     | `#484f58`   | Metadata, placeholders, dividers          |
| `accent`        | `#58a6ff`   | Active tab underline, link hover, focus   |
| `ember`         | `#e3b341`   | "Notable" badges, Research star filter    |

**Border colors** (rgba, not tokenized — use arbitrary values):
- Standard: `rgba(240,246,252,0.07)` or `0.08`
- Strong: `rgba(240,246,252,0.16)` or `0.18`
- Accent bg: `rgba(88,166,255,0.12)`
- Ember bg: `rgba(227,179,65,0.08)`, border: `rgba(227,179,65,0.25)`

---

## Typography

- **Body / titles:** system-ui (Tailwind default sans) — readable at density
- **Metadata & UI labels:** `font-mono` — sources, dates, counts, tab labels, brand name
- **Tab labels:** `font-mono text-xs font-medium uppercase tracking-widest`
- **Brand:** `font-mono text-sm font-bold tracking-widest`
- **Card titles:** `text-sm font-semibold leading-snug` (sans, not mono)
- **Summaries:** `text-xs leading-relaxed text-ink-secondary`
- **Metadata line:** `font-mono text-[10px] text-ink-muted`

---

## Spacing Base

Base unit: `4px` (Tailwind default). Common spacings used:
- Card padding: `p-4`
- Section gap: `mb-8`
- Card grid gap: `gap-3`
- Top bar: `px-5 py-3`
- Tab padding: `px-3 py-3`

---

## Layout

```
flex flex-col h-screen overflow-hidden
├── <header>   shrink-0  — top bar, always visible
├── <div>      shrink-0  — tab rail, always visible
└── <main>     flex-1 overflow-y-auto  — scrollable content
    └── div    mx-auto max-w-5xl px-5 py-6
```

This avoids sticky positioning math entirely.

---

## Key Components

### Top Bar
```tsx
<header className="flex shrink-0 items-center gap-4 border-b border-[rgba(240,246,252,0.08)] bg-surface-1 px-5 py-3">
  // brand (mono bold) | search input | staleness + count
```

### Tab Rail
- Horizontal scroll, `overflow-x-auto`, tabs are `shrink-0`
- Active tab: `text-ink` + `after:` 2px bottom underline in `bg-accent`
- Active count badge: `bg-[rgba(88,166,255,0.12)] text-accent`
- Inactive count badge: `bg-surface-2 text-ink-muted`
- Notable filter: far-right `ml-auto` button, only shown on Research tab

### Article Card

Two variants: standard (`p-4`, `text-sm` title) and featured (`p-6`, `text-base` title). Pass via `featured` prop.

```tsx
<article className="flex flex-col rounded bg-surface-1 transition-colors hover:bg-[#1c2128]
  border border-[rgba(240,246,252,0.07)] hover:border-[rgba(240,246,252,0.15)]">
```

Notable articles add a 2px left border accent:
```tsx
border-l-2 border-l-ember hover:border-l-ember
```

Internal layout (editorial — byline above title):
1. Byline row: `font-mono text-[10px] text-ink-muted` — source · date, notable badge right-aligned
2. Title: `text-sm font-semibold leading-snug text-ink hover:text-accent`
3. Summary: `text-xs leading-relaxed text-ink-secondary`

### Featured First Card

In single-category view, the first article (`i === 0`) gets `sm:col-span-2` wrapper + `featured` prop. This spans the full grid width with more padding and a larger title. Applied only in single-category view, not the All-view preview.

### All-View Preview

In All view, each CategorySection receives `limit={4}` and `onSeeAll`. It slices to 4 articles and appends a `+N more →` button that calls `setActiveCategory(category)` to jump to the tab.

### Pagination

Single-category view only. 8 articles per page (`PAGE_SIZE = 8`). Controls rendered below content:
```tsx
← prev   01 / 04   next →
```
All in `font-mono text-xs`, separated by a `border-t border-[rgba(240,246,252,0.06)]`. Page resets to 0 on any filter change (category, search, notable toggle).

### Category Section Header (All-view only)
```tsx
<div className="mb-3 flex items-center gap-3 pb-2">
  <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-ink-secondary">
  <span>  // count badge, bg-surface-2
  <div className="h-px flex-1 bg-[rgba(240,246,252,0.06)]">  // ruled line
```
Hidden when a specific category tab is active — the tab itself provides context.

---

## Signature Element

**Tab rail as intelligence dashboard ticker.** Categories render as monospace uppercase labels with live article counts. The active tab is anchored by a 2px electric-blue underline (`after:` pseudo-element). Counts update in real-time with search. This makes the interface feel like a tuned briefing channel rather than a generic filter.

---

# Lineage 2 — "Stop the Presses" (F6, `?theme=extra`)

## Direction & Feel

**Motif:** punk newsprint collage — the print room the morning a big story
breaks. Clippings, rubber stamps, tape strips, misregistered offset printing.
Persona-5-grade commitment: no element left neutral. Same content and logic as
classic; divergence is presentation-only (components under
`src/components/extra/`).

## Color Tokens (Tailwind `@theme`, `src/index.css`)

| Token              | Value     | Role                                                    |
|--------------------|-----------|---------------------------------------------------------|
| `paper`            | `#f2ecdf` | Page canvas (newsprint cream)                           |
| `paper-bright`     | `#fffdf7` | Clipping/panel surfaces, reversed text on ink/red       |
| `ink-press`        | `#131210` | Text, borders, slabs, inverted hover surfaces           |
| `ink-dim`          | `#5d574c` | Metadata, secondary text (AA on paper)                  |
| `press-red`        | `#e5341f` | Display-size red only: ransom word block, masthead slash |
| `press-red-deep`   | `#b3220e` | Small red text, stamps, active/hover chips (AA on paper) |
| `press-red-bright` | `#ff6f54` | Red text on ink surfaces (bulletin kicker, citations)   |

**Contrast rule:** white-on-`press-red` only at Anton display sizes (AA
large-text); anything smaller uses `press-red-deep` on paper or
`press-red-bright` on ink.

## Typography

- **Display (`font-poster`):** Anton — masthead, headlines, section labels, stamps. Always uppercase.
- **Body (`font-press`):** Archivo — summaries, bulletin text. Row titles: Archivo 500 uppercase 13px.
- **Wire metadata (`font-wire`):** JetBrains Mono — datelines, counts, sources, tags, nav chips, 11px.
- Self-hosted latin woff2 subsets in `public/fonts/` (OFL), `font-display: swap`; fallbacks Impact / system.

## Signature Devices

- **Offset-print panel** (`OffsetPanel`): solid slab (`ink` or `red`) behind the panel, misaligned 6px via margin + translate. Flat color, no shadows. Panels are never rotated (keeps link hit-areas rectangular).
- **The loudness dial:** every rotation derives from `--tilt-unit` (1deg) and `--stamp-tilt` (-5deg) in `:root` — turn the whole design down in one place.
- **Tilt placement:** decorative only (stamps ±5°, tape strips/labels ≤2°, row/chip visuals ≤1.2°) — always on an inner wrapper; the interactive outer element stays unrotated with a `focus-visible` red outline.
- **Ransom word:** longest ≥5-letter word of the lead headline reversed in a tilted `press-red` block (`ransomWordIndex` in `lib/rank.ts`, deterministic).
- **Hover inversion:** clipping rows flip to full black (`group-hover:bg-ink-press`, text to paper).
- **Diegetic copy** lives in `components/extra/copy.ts` (EXTRA · EXTRA, THE CLIPPINGS, FRESH, BULLETIN, wires running).

## Layout

```
Masthead (EXTRA strip · wires status · classic toggle · Anton title · red slash · dateline band)
TapeNav   (wrapping tape chips w/ counts — all categories visible at 375px · search)
Filters   (collapsed by default behind FILTERS + toggle)
Bulletin  (F8 slot — renders iff data.brief)
Lead clipping (offset panel · NOTABLE stamp · ransom headline · ghost 001)
THE CLIPPINGS (tilted rows, 10/page, lead only on page 0)
PressFooter (wires · archive age · page)
```

Front-page ranking: `rankFrontPage` — first `important` article leads, else
newest; `FRESH` = published <24h (`isFresh`). Reduced motion: transitions
zeroed under `prefers-reduced-motion` (guard in `index.css`).

## Daily brief panels (F8)

One `Brief` (3–5 bullets with URL citations, written by Claude at ingest),
rendered per lineage in the All view only:

- **Classic `BriefPanel`:** `surface-1` panel with 2px ember left border, mono
  `// today's brief` header + date right, bullets `text-sm text-ink-secondary`,
  citations as accent mono `[n]` links.
- **Extra `BulletinPanel`:** `OffsetPanel slab="red" surface="ink"` — black
  panel on red slab, `press-red-bright` Anton kicker `TODAY'S BULLETIN`,
  bullets in Archivo on paper text, citations `press-red-bright` mono `[n]`.
