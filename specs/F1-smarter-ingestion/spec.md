# Smarter ingestion

**ID:** F1-smarter-ingestion
**Status:** Spec
**Owner:** marco144803025

## Intent

The current ingest fetches the last 24 hours of articles every run. If a daily run
is delayed or skipped — a CI outage, a missed schedule tick — articles published
in that window are silently lost. If the Claude API returns a transient error,
the whole run fails and nothing is classified. Feed failures are logged to console
but never persisted, so there is no record of which sources are consistently broken.

This feature makes ingestion reliable and observable: it detects missed runs and
widens the fetch window to catch up; it retries transient API failures with backoff;
it records per-feed health in `news.json`; and it extends the rolling archive to
30 days — a prerequisite for the trending topics feature (F2a).

## User stories

- As the system, I want to detect how long since the last successful run so that I
  can widen the fetch window and avoid losing articles when a run is delayed.
- As the system, I want to retry Claude API calls on transient errors so that a
  momentary outage does not fail the entire classification batch.
- As a developer, I want to see which feeds succeeded and failed in the last run
  so that I can identify broken sources without reading CI logs.
- As a reader, I want 30 days of articles available so that I can find older notable
  pieces and so that F2a has enough history for meaningful trending counts.

## Acceptance criteria

A **transient error** is defined as an Anthropic SDK `RateLimitError` (HTTP 429),
`InternalServerError` (HTTP 5xx), or `APIConnectionError` (network / timeout). All
other error classes — including `AuthenticationError` — are **permanent**.

1. WHEN the ingest runs and `news.json` exists THEN the fetch window SHALL be
   `max(DAYS_BACK, ceil((now − generatedAt) / 1 day) + 1)` days, so articles published
   since the last successful run are not missed.
2. WHEN the computed catch-up window exceeds 7 days THEN the fetch window SHALL be
   capped at 7 days, even if `generatedAt` is older. Articles older than 7 days from
   a long outage are accepted as lost.
3. WHEN a `classifyBatch` call fails with a transient error THEN the system SHALL
   retry up to 3 times with exponential backoff (1s, 2s, 4s) before giving up.
4. WHEN a `classifyBatch` call fails with a permanent error THEN the system SHALL
   propagate the error without retry.
5. WHEN a batch fails after all retries THEN the system SHALL skip that batch, log
   the error clearly, and continue classifying remaining batches.
6. WHEN ingest completes THEN `news.json` SHALL contain a `feedHealth` field: a map
   of feed name → `{ lastSuccess: ISO | null, lastError: string | null, consecutiveFailures: number }`.
7. WHEN ingest completes THEN articles SHALL be retained for 30 days by default.
8. WHEN the `RETENTION_DAYS` environment variable is set THEN it SHALL override the
   default retention period.

## Non-goals

- Surfacing feed health in the UI — deferred to a later feature.
- Per-feed rate limiting or custom scheduling.
- Full-text article fetching — deferred to F3.
- Token-budget batching or cost tracking.
- Re-queuing permanently-failed batches across runs — the catch-up window will
  re-fetch those articles naturally on the next run if they are still recent enough.

## Open questions

- [x] Rolling window: 30 days default, configurable via `RETENTION_DAYS` env var. Resolved.
- [x] Feed health storage: top-level `feedHealth` field in `news.json` — keeps it
      one file, same commit cycle as articles. Resolved.
- [x] Failed batch handling: skip after retries, log clearly, continue. The catch-up
      window recovers them on the next run. Resolved.
