# Trends & Pipeline Transparency

**ID:** F9-trends-dashboard
**Status:** Build (spec & plan approved 2026-07-02)
**Owner:** Marco

## Intent

`news.json` already holds a rolling 30-day archive of classified, tagged,
dated articles plus per-feed health records — but the UI renders only a flat
list of the present. The data to answer "what's gaining momentum this week?"
and "is the pipeline healthy?" is sitting unused in the payload. Add a Trends
view computed entirely client-side from the existing archive: rising/falling
topic tags (this week vs last), article volume over time, and category mix.
Also surface the `feedHealth` data that F1 introduced but never displayed
("2/10 feeds failing"). This turns a link list into a product with an opinion
about the data, and for portfolio purposes demonstrates data-visualization and
product thinking on top of the existing pipeline — with zero new
infrastructure.

## User stories

- As a reader, I want to see which topics are rising or falling this week
  versus last, so that I can spot shifts in the AI landscape without reading
  every article.
- As a reader, I want an at-a-glance view of article volume per day and the
  category mix over the last 30 days, so that I can see the shape of the news
  cycle.
- As a reader, I want to click a trending tag and land in the existing
  filtered list view, so that trends are an entry point into reading, not a
  dead end.
- As the maintainer, I want failing feeds surfaced in the UI, so that pipeline
  problems are visible without opening `news.json` or GitHub Actions logs.

## Acceptance criteria

- WHEN the user opens the Trends view THEN the app SHALL show the top
  rising and falling topic tags, computed client-side by comparing tag
  frequency in the last 7 days against the prior 7 days, each with its counts.
- WHEN the Trends view renders THEN it SHALL show articles-per-day for the
  retention window (sparkline or bar chart) and the per-category share of
  articles.
- WHEN a trending tag is clicked THEN the app SHALL navigate to the existing
  list view with that tag applied via the existing URL filter state
  (`?tags=…`), so the resulting view is shareable.
- WHEN any feed's health record shows consecutive failures at or above the
  existing warning threshold THEN the UI SHALL display a status indicator
  (e.g. "2/10 feeds failing") with per-feed detail available on
  expand/hover.
- WHEN all feeds are healthy THEN the status indicator SHALL be unobtrusive or
  absent — pipeline health must not compete with content for attention.
- WHEN the Trends view computes its data THEN it SHALL make no network
  requests beyond the already-fetched `news.json` and no API calls.
- WHEN the archive contains too little history for a meaningful comparison
  (e.g. under 14 days of data) THEN the trends section SHALL degrade
  gracefully with an explanatory note instead of misleading numbers.

## Non-goals

- No server-side analytics, tracking, or telemetry of any kind.
- No heavyweight charting library — charts are hand-rolled SVG/CSS consistent
  with the minimal-dependency ethos (final call is a plan.md decision).
- No trend data beyond the existing retention window; no separate historical
  store (the SQLite migration on the roadmap would unlock that later).
- No changes to the ingest pipeline — this feature is read-only over existing
  data, except (open question) a possible threshold constant export.

## Open questions

Resolved at Gate 1 (2026-07-02) with recommended defaults — override any of
these at Gate 2 (plan review) if you disagree.

- [x] Placement — **dedicated Trends view** reached from a right-aligned item
      in the existing tab rail (mirrors the notable-filter placement pattern),
      with `?view=trends` in the URL so the view is shareable.
- [x] Dimensions — **both**: topic tags drive rising/falling momentum;
      entities render as a separate "in the news" most-mentioned list.
- [x] Feed health — **status strip inside the Trends view**, plus a small
      warning badge in the header only when at least one feed is failing.
