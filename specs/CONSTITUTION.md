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

4. **Lean client stack.** The UI is a React + Vite static SPA (adopted with
   the F2c redesign) styled with Tailwind. No SSR, and no additional client
   frameworks, state-management, or component libraries; the build must remain
   plain static files servable from GitHub Pages. *(Amended 2026-07-02 via the
   approved F7 plan — the original rule mandated vanilla JS and predated the
   F2c implementation.)*

## Process

5. **All features follow SDD.** Spec → Plan → Implement, with a human
   approval gate between each. See `specs/README.md`.

6. **No production code without an approved plan.** Exceptions: typo fixes,
   dependency bumps, ROADMAP updates.

## Engineering principles

7. **No backward compatibility.** Remove obsolete paths outright instead of
   adding compatibility layers, fallbacks, or migrations. Reason: this is a
   single-deployment static site with no external consumers — there is nobody
   to stay compatible with, and dead paths only obscure which code is live.

8. **The simplest implementation that fully meets the current requirements.**
   No speculative abstraction, configuration or indirection for needs that have
   not arrived.

9. **Grow the system in layers.** Start from the smallest version that works
   end to end, and add each new capability on top of a product that already
   works. Never trade a working product for unfinished complexity.

10. **Modular components, clearly separated concerns.**

11. **Prefer established libraries; lean on what is already installed.** Reach
    for a well-maintained library when it reduces overall complexity or
    improves reliability, and use the project's existing dependencies before
    writing your own implementation or adding a package. Do not assume a
    library lacks a capability without checking its documentation and types.

12. **Architectural decisions are made for the long term.** Do not accept a
    stopgap that only works for now and is meant to be replaced later.

## Failure behaviour

13. **Prefer a visible failure over a silent fallback.** This is the soul of
    the product. In priority order:

    1. Works correctly with real data.
    2. Falls back visibly and clearly signals degraded mode.
    3. Fails with a clear error message.
    4. Silently degrades to look fine — never do this.

    Design for debuggability, not cosmetic stability.

14. **Never swallow an error to keep things "working."** Surface it, and do not
    substitute placeholder data in its place. No catch that continues as though
    nothing happened.

15. **Fallbacks are acceptable only when disclosed.** Show a banner in the UI,
    log a warning in the pipeline, or annotate the output. An undisclosed
    fallback is a silent failure wearing a disguise.

16. **An unconfigured service means the feature says it is unavailable.** If a
    key, feed or model is missing, the affected surface states that plainly. It
    must never present a fabricated headline, summary, translation, source URL,
    publish date or trend count as though it were real ingested data.
