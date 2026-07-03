# Portfolio Presentation & Shareability — Plan

**Spec:** ./spec.md
**Status:** Build (plan approved 2026-07-02)

## Approach

Pure documentation and static-asset work — no app logic changes. The README is
rewritten around the live GitHub Pages deployment (pitch → screenshot → badges
→ architecture → setup), a LICENSE and favicon/OG metadata are added, and
CONSTITUTION.md rule #4 is amended to match the shipped React stack. The
screenshot is captured from the local dev server and doubles (cropped to
1200×630) as the Open Graph image. All URLs in the meta tags are absolute
against the deployed origin (`https://marco144803025.github.io/AI-News-Reader/`)
because link unfurlers do not resolve relative URLs.

Proposed amendment to CONSTITUTION.md rule #4 — approving this plan is the
discussion the constitution requires for amendments:

> **4. Lean client stack.** The UI is a React + Vite static SPA (adopted with
> the F2c redesign) styled with Tailwind. No SSR, and no additional client
> frameworks, state-management, or component libraries; the build must remain
> plain static files servable from GitHub Pages. *(Amended 2026-07-02 — the
> original rule mandated vanilla JS and predated the F2c implementation.)*

## Affected files

- `README.md` — full rewrite: pitch, live demo link, screenshot, CI badges, feature list, architecture, tech stack, setup, SDD-process pointer.
- `LICENSE` — new; MIT, © 2026 marco144803025.
- `index.html` — descriptive `<title>`, meta description, OG + Twitter Card tags, favicon link.
- `public/favicon.svg` — new; simple terminal-style mark in the design system's canvas/accent palette.
- `public/og-image.png` — new; 1200×630 crop of the UI screenshot.
- `docs/screenshot.png` — new; full screenshot referenced by the README.
- `specs/CONSTITUTION.md` — rule #4 amendment (text above).

## Data contracts

None — no code paths or JSON shapes change.

## Tasks

- [x] Add `LICENSE` (MIT).
- [x] Create `public/favicon.svg`; wire favicon link, `<title>`, and meta description into `index.html`.
- [x] Capture `docs/screenshot.png` (1280×800) and `public/og-image.png` (1200×630) via headless Chrome against the dev server.
- [x] Add OG/Twitter meta tags to `index.html` with absolute URLs.
- [x] Rewrite `README.md` per the spec's acceptance criteria (badges reference `test.yml` and `ingest.yml` workflows).
- [x] Amend `CONSTITUTION.md` rule #4 with the text proposed above.
- [ ] (Stretch) Record an animated GIF of search/tag filtering for the README.

### Deviations (recorded during Build)

- Screenshots show the **Stop the Presses edition** (`?theme=extra`), not the
  classic All view — F6 landed first and the new identity is the repo's face;
  the README caption explains the two-edition flag. Favicon follows the same
  identity (paper/ink/red mark).

### Verification status 2026-07-02

Local checks done: build clean; built `index.html` carries the rebased favicon
path and absolute OG URLs; live preview confirms title, meta description,
7 OG/Twitter tags, favicon served as `image/svg+xml`; README follows the AC
order. **Pending the next push/deploy:** badge rendering on GitHub (AC1) and
the social-card unfurl against the live origin (AC2).

## Verification

Maps to acceptance criteria in `spec.md`:

- AC1 (README contents & order): view the README on GitHub; confirm section order and that both CI badges render.
- AC2 (link unfurl): after the next deploy, validate with an OG debugger (e.g. opengraph.xyz) or paste the URL into Discord/Slack and check the card.
- AC3 (favicon/title/description): load the deployed site — tab icon and title visible; page source contains `<meta name="description">`.
- AC4 (LICENSE): file at repo root; GitHub sidebar shows "MIT license".
- AC5 (setup accuracy): in a clean clone, follow the README: `npm install`, `npm test`, `npm run dev` — all work; no stale Task Scheduler / "local web app" references remain.
- AC6 (constitution consistency): amended rule #4 read against `package.json` shows no contradiction.
- `npm run build` passes (the `index.html` head changes must not break the Vite build).

## Risks / tradeoffs

- The OG unfurl only works once `og-image.png` is live on the deployed origin — verification is post-deploy, not local.
- The site is served from a sub-path (`/AI-News-Reader/`); confirm in the built `dist/index.html` that Vite rebased the favicon URL correctly with the configured `base`.
- The README screenshot will go stale as the UI evolves — acceptable; retake on major UI changes (landing F6 would warrant a retake).
