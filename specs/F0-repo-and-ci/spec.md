# Repository setup & first push

**ID:** F0-repo-and-ci
**Status:** Done

## Intent

Get the project under version control and pushed to a remote so future features
have a baseline to diff against and a place to track issues / discussions. Also
land the SDD docs (`specs/`) and a top-level `CONTRIBUTING.md` pointing at the
workflow.

## Acceptance criteria

- WHEN the repo is pushed THEN it SHALL be publicly accessible on GitHub.
- WHEN a commit lands on `main` THEN the site SHALL deploy to GitHub Pages automatically.
- WHEN the daily schedule fires THEN the ingest workflow SHALL fetch, classify, and publish new articles.

## Non-goals

- No test suite at this stage.
- No branch protection rules.

## Open questions

- [x] GitHub username: `marco144803025`
- [x] Public repo: `AI-News-Reader`
- [x] No license added yet.

## Completion notes

Shipped in initial commit. CI split into two workflows post-scaffold:
- `deploy.yml` — triggers on push to `main`, build + deploy only, no API cost.
- `ingest.yml` — triggers on schedule (06:00 UTC daily) and `workflow_dispatch`, runs full ingest + build + deploy.

Site live at `https://marco144803025.github.io/AI-News-Reader/`.
