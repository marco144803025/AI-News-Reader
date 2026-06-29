# Project Constitution

Immutable rules. Every change — by human or agent — must respect these.
Updates require a discussion, not a quick edit.

## Architecture

1. **Static site, no server runtime.** The site builds to `public/` and is served
   from GitHub Pages. No database, no API server, no auth. Reason: zero
   operating cost, zero ops burden.

2. **Ingest is offline and idempotent.** The ingest pipeline runs in GitHub
   Actions on a cron schedule. It must be safe to re-run; never destructive.

## Stack

3. **Node 20+ for the build, ESM only.** No CommonJS in new code. Reason:
   matches the GitHub Actions runner; ESM-only avoids dual-package hazards.

4. **No client-side JS frameworks.** Plain HTML + CSS + minimal vanilla JS.
   Reason: the reader UI must work with JS disabled.

## Process

5. **All features follow SDD.** Spec → Plan → Implement, with a human
   approval gate between each. See `specs/README.md`.

6. **No production code without an approved plan.** Exceptions: typo fixes,
   dependency bumps, ROADMAP updates.