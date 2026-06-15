# Ingest verification harness

**ID:** F1a-ingest-verification
**Status:** Not started

## Intent

F1 (Smarter ingestion) shipped with only one acceptance criterion verified
locally (AC7, the `RETENTION_DAYS` guard). The rest — catch-up math, retry
backoff, batch-skip behavior, `generatedAt` advancement rule, `feedHealth`
shape — were validated by type-check and code review only. The next CI ingest
will exercise the happy path in production, but the failure modes (transient
errors, NaN env, empty feeds, dedup-only runs) are not covered.

This feature adds a thin test harness so future ingest changes don't have to
re-rely on review-by-eye.

## Open questions

- [ ] Framework: vitest (matches Vite tooling) or node:test (zero deps)?
- [ ] Scope: only the verification ACs from F1's plan, or aim for general
      coverage of `ingest/ingest.ts`?
- [ ] Where to mock the Anthropic SDK — module-level mock, dependency injection,
      or a recorded-cassette pattern?
- [ ] Run on CI: gate `ingest.yml` on tests passing, or run only on PRs?

> Full spec drafted when this feature is picked up.
