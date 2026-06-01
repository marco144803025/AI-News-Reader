# Dark mode / Reader UI

**ID:** F2c-dark-mode
**Status:** Done

## Intent

Redesign the reader with a dark theme and improved navigation. The original spec
called for a toggle; what shipped instead was a permanent dark-academic design
system — a deliberate decision made during implementation because the product's
user (a technical person scanning AI news daily) has no use case for light mode.

## Divergence from original spec

Original intent: Tailwind class-based toggle, `prefers-color-scheme` default,
`localStorage` persistence.

Shipped instead: Permanent dark theme with a full token-based design system.
No toggle. Rationale: adding a toggle doubles the visual surface to maintain and
the target user (developer at a desk) prefers dark unconditionally.

If a toggle is needed in future, it should be treated as a new feature, not a
revision of this one.

## Acceptance criteria (as shipped)

- WHEN the app loads THEN it SHALL render on a `#0d1117` canvas with no flash of light background.
- WHEN a user clicks a category tab THEN that tab SHALL show a 2px electric-blue underline and its count badge SHALL switch to accent styling.
- WHEN viewing All tab THEN each category section SHALL show at most 4 articles with a `+N more →` link.
- WHEN viewing a specific category tab THEN articles SHALL paginate at 8 per page with monospace `01 / 04` prev/next controls.
- WHEN an article is marked `important` THEN its card SHALL show a 2px left ember border and a `NOTABLE` badge.
- WHEN the user hovers a card THEN the border SHALL brighten and background SHALL lift subtly.

## Non-goals

- Light mode toggle.
- Per-user theme persistence.

## Design system

Documented in `.interface-design/system.md`. 8 color tokens defined via Tailwind 4
`@theme` in `src/index.css`. Borders-only + subtle surface lift depth strategy.
