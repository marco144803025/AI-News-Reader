# Source expansion — broader, deduplicated feed coverage

**ID:** F13-source-expansion
**Status:** Not started
**Owner:** Marco

## Intent

`feeds.json` has carried the same 10 RSS sources since F0. The mix is
Anglophone, vendor-heavy, and thin on policy, applied/enterprise AI, and
Chinese-language coverage — which now matters because F12 ships Traditional
Chinese summaries from English-only inputs. Adding sources naively is not free:
every extra feed multiplies the DeepSeek classification calls per run and
increases the odds that one story appears three times on the front page under
three different headlines. This feature widens coverage *and* adds the
dedupe/cost controls that make a wider source list safe to run daily.

## User stories

- As a reader, I want stories that only regional or policy outlets cover, so that
  the feed is not just US vendor announcements.
- As a reader, I want one card per story, so that the same launch reported by
  four outlets does not fill the page.
- As the maintainer, I want a per-run ceiling on classified articles, so that
  adding feeds cannot silently multiply the daily API cost.
- As the maintainer, I want to add a feed by editing one file, so that expanding
  coverage never needs a code change.

## Acceptance criteria

- WHEN the ingest runs THEN the system SHALL fetch every feed in `feeds.json`
  and record per-source health for each, including any newly added source.
- WHEN two fetched articles describe the same story THEN the system SHALL keep
  one and record the others as additional sources on the kept article, rather
  than emitting duplicate entries in `news.json`.
- WHEN a run's candidate article count exceeds the configured per-run ceiling
  THEN the system SHALL classify only the highest-priority candidates and log
  how many were deferred, without failing the run.
- WHEN a newly added feed fails or returns malformed XML THEN the system SHALL
  complete the run using the remaining feeds and surface the failure through the
  existing `feedHealth` contract rendered by F9.
- WHEN `feeds.json` gains an entry THEN the system SHALL require no change to
  `ingest/*.ts` for that source to be fetched.
- WHEN the deduplication logic runs THEN it SHALL be covered by `node:test`
  cases in `ingest/__tests__/` including a same-story/different-headline pair
  and a genuinely-distinct pair.

## Non-goals

- Scraping, HTML parsing, or any non-RSS/Atom source. Constitution rules #1 and
  #2 keep ingestion offline, static, and dependency-light.
- Paid or authenticated feeds.
- Per-user source selection or muting in the UI (that is closer to F5's
  subscription surface).
- Re-ranking or re-scoring existing articles; F13 changes what enters the
  pipeline, not how ranked output is presented.
- Translating source *articles*; F12 already owns bilingual summary generation.

## Open questions

- [ ] Which sources go in? Candidate pool to confirm: Meta AI / Microsoft
      Research / NVIDIA blogs, Hugging Face blog, Simon Willison, Import AI,
      EU AI Act & UK AISI policy feeds, The Register AI, and one or two
      Traditional Chinese / HK-relevant tech outlets.
- [ ] Target feed count — is the ceiling ~15, ~20, or uncapped as long as the
      per-run article cap holds?
- [ ] Dedupe signal: title similarity only (cheap, local, no API call), or URL
      canonicalization plus similarity? A model-based judgement is the third
      option but costs a call per candidate pair.
- [ ] Per-run classified-article ceiling and the priority rule used when the cap
      bites (source trust order? recency? existing rank heuristics?).
- [ ] Does a deduped article show "also covered by X, Y" in the UI, or is the
      merge invisible to readers?
- [ ] Expected daily cost delta at the chosen feed count, and whether that is
      acceptable before Gate 1.
