# Category taxonomy expansion — Plan

**Spec:** ./spec.md
**Status:** Done

## Approach

Two changes to `ingest/ingest.ts`:

1. Replaced `SEED_CATEGORIES` array with 12 specific entries.
2. Rewrote the Claude system prompt from a vague "prefer these, introduce new if none fit"
   to a structured list with a one-line scope description per category. This prevents
   the model from collapsing distinct topics into broad buckets.

Also removed the `existingCategories` parameter from `classifyBatch()` since categories
are now hardcoded in the prompt rather than dynamically injected from the previous run.

## Affected files

- `ingest/ingest.ts` — `SEED_CATEGORIES` array, `classifyBatch` signature and system prompt

## Tasks

- [x] Replace `SEED_CATEGORIES` with 12-entry array
- [x] Rewrite classifier system prompt with per-category scope descriptions
- [x] Remove unused `existingCategories` parameter from `classifyBatch`
- [x] TypeScript check passes

## Verification

- AC1 (12 categories): after next ingest, `news.json` `.categories` array contains the new names.
- AC2 (correct assignment): spot-check 5 classified articles against expected categories.

## Risks / tradeoffs

- 7-day transition: old category names persist in `news.json` until their articles age out.
  During this window the tab rail will show a mix of old and new category names.
- The hardcoded prompt means adding/removing categories requires an `ingest.ts` edit —
  no admin UI.
