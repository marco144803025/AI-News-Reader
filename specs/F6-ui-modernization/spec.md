# UI Redesign — "Stop the Presses" (A/B Feature Flag)

**ID:** F6-ui-modernization
**Status:** Plan (spec approved 2026-07-02)
**Owner:** Marco

## Intent

Full visual redesign — same content, data, and interaction logic — with the
stylistic commitment of a motif-driven game UI (reference points named at
Gate 1 review: Persona 5, Persona 3 Reload, Clair Obscur: Expedition 33).
Those interfaces work because one motif saturates every element; a "theme"
applied on top of a neutral layout is exactly what this feature must not be.
The chosen motif is **punk newsprint collage** — tilted clippings, rubber
stamps, tape-strip labels, one screaming breaking-news red. It is earned, not
pasted on: Persona 5's own visual DNA is cut-up zines and newsprint, this
product *is* news, and its purpose — cutting signal from noise — is literalized
by the cut/slash devices. Ships behind an A/B flag (URL param + localStorage)
with the classic dark theme as instant rollback during a comparison window
(deliberately revisits F2c's "no toggle" stance). Direction mockup reviewed in
conversation 2026-07-02.

Prior direction candidates, reviewed and set aside: "Morning Wire" (dark
editorial broadsheet — handsome but low personality), "Patch Notes" (light
game-menu with rarity tiers — clean but motif too shallow), and a Persona
3-flavored "Midnight Signal" (deep navy + electric aqua, glassy sleek) which
remains the named alternate if Stop the Presses proves too loud in daily use.

## Design direction (feeds plan.md)

- **Motif:** the print room the morning a big story breaks — EXTRA banners,
  clippings, rubber stamps, tape strips, misregistered offset printing.
  Articles are *clippings*; the daily brief is the *bulletin*; new items are
  *fresh ink*.
- **Palette:** newsprint cream canvas `#f2ecdf`, warm paper white `#fffdf7`
  for clippings, ink black `#131210`, and a single screaming accent —
  breaking-news red `#e5341f` — reserved for stamps, the bulletin kicker,
  active states, citations, and one highlighted word per lead headline.
  Muted ink `#5d574c` for metadata. Nothing survives from GitHub Primer.
- **Type:** Anton (poster-heavy display caps) for masthead, headlines, and
  section labels; Archivo for summaries and body; JetBrains Mono for all wire
  metadata (datelines, counts, sources, tags).
- **Signature devices:** offset-print panels (solid ink block offset 6px
  behind each major panel — flat, no blur); tilted composition (tape-strip nav
  chips and clipping rows at alternating small angles, stamps at up to ~6°);
  the ransom word (one key word per lead headline reversed in a tilted red
  block); outlined ghost numerals on the lead; full black-inversion hover on
  clipping rows; NOTABLE as a red rubber stamp.
- **Structure:** masthead with EXTRA strip and black dateline band → wrapping
  tape-strip section nav (all categories always visible) → bulletin panel
  (F8's slot, black with red kicker) → lead clipping → THE CLIPPINGS list →
  footer with red TRENDS block (F9's slot).
- **The loudness dial:** rotation amplitude, red coverage, and stamp density
  are single design tokens so the whole lineage can be turned down ~30%
  without restyling if daily use proves it fatiguing.

## User stories

- As a daily reader, I want the front page ranked (bulletin, lead clipping,
  clippings list), so that one screen gives me the shape of the day.
- As a reader on a phone, I want every category visible in a wrapping nav, so
  that no section hides behind an invisible horizontal scroll.
- As the maintainer, I want to flip between classic and Stop the Presses on
  identical data, so that I can compare and pick a winner with evidence.
- As a portfolio visitor, I want an interface with unmistakable personality,
  so that the project reads as designed, not templated — memorable enough to
  screenshot.
- As a reader with motion sensitivity or reading difficulty, I want the
  loudness to stay out of the way of legibility, so that style never costs me
  usability.

## Acceptance criteria

- WHEN the URL contains `?theme=extra` or localStorage holds that preference
  THEN the app SHALL render the Stop the Presses lineage; WHEN neither is
  present THEN the classic theme SHALL render with zero regression; WHEN both
  exist THEN the URL param SHALL win, and the visible toggle SHALL persist to
  localStorage.
- WHEN the All view renders THEN articles SHALL appear in a ranked hierarchy
  (bulletin slot, one lead clipping, dense clippings list) derived only from
  existing data (`important` flag + recency), with no changes to `news.json`.
- WHEN the viewport is 375px wide THEN every category SHALL be visible in the
  wrapping tape-strip nav without horizontal scrolling.
- WHEN reading copy (headlines, summaries, list rows) is tilted THEN its
  rotation SHALL not exceed ±1°; decorative elements (stamps, tape labels,
  banners) MAY tilt further; hover and focus hit-areas SHALL remain full
  rectangles unaffected by rotation.
- WHEN text renders THEN it SHALL meet WCAG AA contrast — ink on cream/paper
  for reading copy; white-on-red combinations SHALL be restricted to
  large/bold display elements that pass the AA large-text threshold.
- WHEN the display font fails or has not loaded THEN fallbacks (Impact/
  condensed sans, monospace) SHALL keep the layout intact (`font-display:
  swap`).
- WHEN either lineage runs THEN both SHALL share the same data loading,
  filtering, search, URL state, and pagination logic — divergence confined to
  presentation components and styles.
- WHEN `prefers-reduced-motion` is set THEN transitions (hover inversion,
  entrance motion) SHALL reduce to instant state changes; static tilt MAY
  remain.
- WHEN no color token reuses the classic theme's GitHub Primer values
  (`#0d1117`, `#161b22`, `#21262d`, `#58a6ff`) THEN this criterion passes —
  verified by grepping the wire lineage's styles.
- WHEN a Lighthouse accessibility audit runs on the new lineage THEN its
  score SHALL be ≥ the classic theme's baseline.

## Non-goals

- No halftone/paper texture images in v1 — the motif is carried by geometry,
  type, and color (CSS only); textures can be a later polish pass.
- No sound, no gamification mechanics — visual language only.
- No dark variant of this lineage in v1 — the classic theme remains the dark
  option during the A/B window.
- No changes to ingest, data shapes, or `news.json`; no component or
  animation libraries.
- Retiring the losing lineage is a separate post-comparison decision.

## Open questions

Gate 1 approved 2026-07-02 (Stop the Presses direction, per conversation
mockup). Remaining items resolved with defaults — override at Gate 2.

- [x] Direction — **Stop the Presses** approved; "Midnight Signal" stays the
      named fallback if daily use proves the collage too loud.
- [x] Loudness default — **mockup-level**, with the dial implemented as
      design tokens (`--tilt-unit`, red-coverage, stamp density) so a ~30%
      turn-down is a token change, not a restyle.
- [x] UI copy voice — **keep the diegetic labels** (EXTRA, THE CLIPPINGS,
      FRESH, BULLETIN); they are the personality. All label strings live in
      one constants module so a plain-label variant stays a one-file change.
- [x] Webfonts — **self-hosted** woff2 (latin subsets) in `public/fonts/`
      with OFL license files; no third-party font requests.
