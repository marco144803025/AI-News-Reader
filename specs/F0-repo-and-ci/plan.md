# Repository setup & CI — Plan

**Spec:** ./spec.md
**Status:** Done

## Approach

Initialised a Vite + React + TypeScript project, pushed to GitHub, and wired two
GitHub Actions workflows for automated deployment. The ingest pipeline and SDD
scaffold were included in the initial commit so the project was spec-driven from
the start.

CI is intentionally split into two workflows to avoid burning the Anthropic API
on every UI push — `deploy.yml` handles code changes, `ingest.yml` handles data.

## Affected files

- `.github/workflows/deploy.yml` — build + deploy on every push to `main`
- `.github/workflows/ingest.yml` — full ingest + build + deploy on daily schedule and `workflow_dispatch`
- `specs/` — SDD scaffold: README, ROADMAP, templates, feature stub folders
- `CONTRIBUTING.md` — points contributors at the SDD workflow
- `public/news.json` — seed file (empty data shape) so the app loads on first deploy

## Data contracts

None — no new TypeScript types introduced in this feature.

## Tasks

- [x] Initialise git repo and push to `github.com/marco144803025/AI-News-Reader`
- [x] Write `deploy.yml` — triggers on push to `main`, runs `npm ci` + `npm run build` + `peaceiris/actions-gh-pages`
- [x] Write `ingest.yml` — triggers on schedule (`0 6 * * *`) and `workflow_dispatch`, runs ingest + build + deploy
- [x] Configure GitHub Pages to serve from the `gh-pages` branch
- [x] Land `specs/` SDD scaffold with README, ROADMAP, templates, and feature stubs
- [x] Write `CONTRIBUTING.md` referencing the SDD workflow

## Verification

- AC1 (public repo): `https://github.com/marco144803025/AI-News-Reader` is publicly accessible.
- AC2 (auto deploy): push a commit to `main` → `deploy.yml` runs → site updates at `https://marco144803025.github.io/AI-News-Reader/`.
- AC3 (ingest schedule): trigger `ingest.yml` via `workflow_dispatch` → news.json is updated and site redeployed.

## Risks / tradeoffs

- Both workflows use `peaceiris/actions-gh-pages@v3` — pinned to a major version, not a SHA. A breaking change in v3 would affect both.
- `ingest.yml` commits `news.json` back to `main` as part of its run. If two workflow runs overlap (unlikely given daily schedule), a push conflict could fail the run silently.
