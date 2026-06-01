# AI Briefing — Interface Design System

## Direction & Feel

**Product:** AI news reader for technical users (developers, researchers) staying current with the AI industry.
**Feel:** Dark academic briefing. Dense, precise, calm. Like a classified intelligence terminal — authoritative, not decorative.
**Who:** Technical person scanning daily at a desk. Wants signal, not chrome.

---

## Depth Strategy

**Borders-only.** No drop shadows anywhere.
- Cards: `border-[rgba(240,246,252,0.07)]` default → `border-[rgba(240,246,252,0.16)]` on hover
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
```tsx
<article className="flex flex-col rounded border border-[rgba(240,246,252,0.07)] bg-surface-1 p-4 transition-colors hover:border-[rgba(240,246,252,0.16)]">
```
- Title: `text-sm font-semibold text-ink hover:text-accent`
- Summary: `text-xs leading-relaxed text-ink-secondary`
- Metadata: `font-mono text-[10px] text-ink-muted`
- Notable badge: ember-bordered pill with `font-mono uppercase tracking-wider`

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
