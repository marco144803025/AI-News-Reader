# Smarter ingestion

**ID:** F1-smarter-ingestion
**Status:** Not started

## Intent

Make `npm run ingest` cheap, fast, and resilient: only classify new articles,
track per-feed health, retry transient errors, and keep a rolling 30-day archive
instead of overwriting weekly.

## Open questions

- [ ] Rolling window: 30 days, or configurable via env?
- [ ] Where to store per-feed health: same `news.json` or a separate
      `public/feed-health.json`?
- [ ] Surface broken feeds in the UI now, or defer to F2a?

> Full spec drafted when this feature is picked up.
