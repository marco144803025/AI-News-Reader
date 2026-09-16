# Roadmap

The table preserves feature order; the current recommended work queue is below.
A feature must reach **Done** before the next starts, unless explicitly
parallelized. Existing F10–F12 and F16 workstream exceptions remain recorded below.

| #   | Feature                                                          | Status      | Phase      |
| --- | ---------------------------------------------------------------- | ----------- | ---------- |
| F0  | [Repository setup & CI](./F0-repo-and-ci/)                       | Done        | Foundation |
| F1  | [Smarter ingestion](./F1-smarter-ingestion/)                     | Done        | Backend    |
| F2c | [Dark mode / Reader UI redesign](./F2c-dark-mode/)               | Done        | UX         |
| F2d | [Category taxonomy expansion](./F2d-category-taxonomy/)          | Done        | UX         |
| F4  | [Search & tag filtering](./F4-search-and-tags/)                  | Done        | UX         |
| F6  | [UI redesign — Stop the Presses (A/B flag)](./F6-ui-modernization/) | Build    | UX         |
| F5  | Email subscriptions per tag (not yet specced)                   | Not started | UX         |
| F7  | [Portfolio presentation & shareability](./F7-portfolio-presentation/) | Done   | Portfolio  |
| F8  | [AI Daily Brief](./F8-daily-brief/)                              | Done        | Content    |
| F9  | [Trends & pipeline transparency](./F9-trends-dashboard/)         | Done        | Content    |
| F10 | [DeepSeek API migration](./F10-deepseek-migration/)               | Done        | Backend    |
| F11 | [Personal Telegram morning brief](./F11-telegram-brief/)         | Done        | Delivery   |
| F12 | [English / HK Traditional Chinese summaries](./F12-bilingual-summaries/) | Done  | Content |
| F13 | [Source expansion & dedupe](./F13-source-expansion/)             | Done        | Backend    |
| F14 | [Licensing, attribution & excerpt hygiene](./F14-licensing-and-attribution/) | Spec | Portfolio |
| F15 | [Daily brief category balance](./F15-brief-balance/)             | Plan        | Content    |
| F16 | [Cinematic standard edition](./F16-cinematic-standard/)          | Done        | UX         |

## F13 implemented — 2026-09-11

**Gate 2 approved and F13 is complete.** Marco approved with "ok now that you
created the plan, proceed and implement it", after raising the per-run ceiling to
100. Implementation was delegated as planned — feed collection, pure selection
and UI in disjoint file sets, with `general-purpose` sub-agents substituting for
Luna and Sol (substitution recorded in the plan). F13's code was verified offline,
published on 2026-09-14, and completed with a separately authorized normal hosted
ingest on 2026-09-16.

**Verified:** 246 tests pass (130 before F13), `tsc -b` clean, both
`VITE_ENABLE_EXTRA` builds pass with Extra off in the final state, whitespace
clean. A browser pass against a temporary fixture confirmed attribution on all
four article surfaces in both editions and both languages, zero nested anchors,
malformed entries dropped with a visible warning, and no overflow at 320–1440.
`public/news.json` was never used as a test fixture; its hash is unchanged.

**Integration review found five defects, all fixed.** Two were blocking: feed
item URLs were never validated, so a `mailto:` link would have been classified,
published, and then rejected by the browser parser — blanking the site while the
run reported success; and attribution grew on every re-run because publishers
vary their own query parameters, which also turned short Chinese headlines into
duplicate articles. Both are regression-tested. The full record is in the plan's
§16.

**The two F13 decisions were closed on 2026-09-14.** Marco selected a 0.8
Jaccard threshold. The replacement Hacker News URL
`https://hnrss.org/newest?q=AI+OR+LLM+OR+MCP` returned HTTP 200 and valid XML on
three consecutive read-only probes, so it replaced the prior `&points=50` URL.
Hosted Actions build/test reachability was verified after publication. The
normal paid ingest workflow was then dispatched and completed successfully as
run #131; its deployed payload disclosed Hacker News HTTP 429 and Personnel
Today HTTP 403 as visible source-health failures. F13 is Done, with F15 next.

## Latest work — 2026-09-11, later session

**F16 is Done.** Marco ran the outstanding native 200% browser-zoom check himself
and approved it with "I tested it, approve it". No agent performed the check and
no browser, viewport or screenshot accompanied the approval, so it is recorded as
an owner acceptance rather than a captured measurement; the F16 spec section 13
and the plan's closure note state that limitation explicitly. The zoom paragraph
in the earlier section below is superseded by this entry.

**The checkout caveat is resolved.** This directory was reconciled with the
published remote on Marco's instruction. Every untracked F16 source file here was
first confirmed byte-identical to `origin/main`, so nothing was lost: local
documentation was committed as `625a9f5`, then `origin/main` (`9e6aea8`) was
merged as `5678743`. Three documentation conflicts — `ROADMAP.md` and both F16
files — resolved to the newer local versions, which already contained everything
the remote versions held. `origin/main` is now an ancestor of local `main`, and
the merged tree passed **130 of 130** offline tests. `backup/pre-origin-merge-2026-09-11`
preserves the pre-merge branch state. Nothing was pushed; publication remains a
separate, separately authorized action.

**F13 reached Gate 2.** Marco asked for an explanation of the plan before
deciding, so no approval was recorded at this point. With F16 closed, the
F16 → F13 → F15 order genuinely reached F13; no parallel-workstream exception was
needed or granted. **Superseded later the same day** by the Gate 2 approval and
implementation recorded at the top of this file.

**F13 per-run ceiling raised, plan completed.** After the explanation Marco said
the plan looks good and raised the per-run ceiling from 50 to 100 new articles,
because the F10 DeepSeek migration cut his cost. That scope change is recorded in
the F13 spec, which now carries the consequences: four classification batches at
the ceiling instead of two, at most sixteen request attempts, and a capacity
fixture of 140 candidates → 100 admitted / 40 skipped. `ARXIV_CAP = 15` is
deliberately unchanged — he raised the per-run ceiling, not the arXiv sub-cap.
He then asked for the implementation plan to be filled in completely **with no
code changes**, which is done: [plan.md](./F13-source-expansion/plan.md) now
carries frozen type contracts, the exact 20-entry `feeds.json`, module signatures
and algorithms, configuration wiring, ~40 enumerated test cases, per-agent
delegation briefs and a Constitution-compliance section. Gate 2 was still pending
at that point and no production file had been touched; **superseded** by the
approval and implementation recorded at the top of this file.

## Latest work — 2026-09-11, earlier session

F13 source-expansion direction approved by Marco with “Approved, remember to
delegate approprate agent to perform different task”. F13 moves to Plan:
Luna/xhigh agents inspect pipeline and UI integration independently; the main
agent drafts the plan; Sol/high reviews integration and verification coverage.
Gate 2 remains pending. F16's native-zoom check is still open, F15 follows F13,
and no F13 production code or publication is authorized by this planning approval.

Marco requested inspection of the specs and work on the next task. F16 was still
Build at that point with no native 200% zoom result. **Superseded:** Marco closed
that check himself later the same day, as recorded in the section above. The
standing warning still applies to any future check of this kind — do not repeat
the failed Windows URL-check route and never claim a machine-verified pass.

F13 specification preparation advanced while that check awaits input; implementation
order remains F16 → F13 → F15. The revised F13 spec proposes 20 feeds, a default
50-new-article per-run cap, topical filtering, bounded feed retries, conservative
deduplication and visible additional-source links. Its three grouped approval
choices are in section 8. That initial Gate 1-pending checkpoint is superseded
by the approval above; no production change has been implemented.

Fresh read-only probing: 22 endpoints assessed, 20 parsed (all 12 additions plus
eight retained feeds); Anthropic returned 404 and VentureBeat 429. Hacker News
parsed on this attempt. Exact counts/dates and local-vs-hosted limitations are in
F13 Appendix C. No AI calls, ingestion, backfill, Telegram send or deployment ran.

## Previous status audit — 2026-09-09

- **F16 is published**, including the cinematic standard and full EN / HK Chinese
  interface. Release source is `e1dff25`; `b04bd5f` records successful hosted
  tests/build/Pages and browser verification. Extra is off by default. The latest
  recorded local suite passed 130 tests; both flag builds passed. Build was then
  correct solely because native 200% browser zoom was unverified. **Superseded
  2026-09-11:** that check is now closed and F16 is Done.
- **F6 remains Build** with three older open checks: Lighthouse accessibility
  comparison, Extra reduced-motion behavior and blocked-font fallback. F16 does
  not close these checks; an Extra-enabled build is needed to exercise them.
- **F13, F14 and F15 are Spec**, not approved implementation work. F13/F15 have
  substantive drafts but no plans. F14 has a draft plan, but Gate 1 is pending;
  by `specs/README.md`, that is still Spec. None of their production changes is
  implemented. F5 has no spec folder yet; its former link was a broken placeholder.
- **Completed features remain Done:** F0, F1, F2c, F2d, F4 and F7–F12. Each has
  a spec, plan and no unchecked plan tasks. Relevant history exists, including
  commits older than the recent 40-commit window. No orphaned feature folders or
  unexplained feature commits were found; font/settings edits map to UI/maintenance.
- **Checkout caveat — RESOLVED 2026-09-11.** At the time of this audit the
  directory's `main` was `6b3eb39`, six commits behind cached `origin/main`, and
  publication had used the separate `codex/deploy-cinematic-zh-hk` checkout. That
  branch is fully contained in `origin/main`, and the reconciliation described in
  the latest-work section above has since merged the remote into this checkout.
  No duplicate F16 implementation was committed. This audit itself did not change
  branches, commit or publish.
- **Evidence scope:** inspected local code, files, Git objects and checklists.
  Fresh remote/site access was unavailable; hosted and 130-test results above
  are the existing dated publication record, not new runs. No application tests,
  feed probes, ingestion or Telegram delivery were run for this documentation audit.
- **Documentation validation:** 17 roadmap rows checked; all 11 Done plans have
  no open tasks; spec/plan status headers agree with the roadmap; no orphan feature
  folders. F6 retains 3 open checks, F16 retains 1, and F14 retains 9 draft tasks.
  `git diff --check -- specs` passed. No production files were edited by this audit.

## Recommended next work

Marco requested “help me do F16, F13 and F15 in order” on 2026-09-09. The active
sequence is therefore **F16 → F13 → F15**, ahead of the older F6/F5 queue. This
authorizes the workstream order. F16 and F13 are complete, F15's spec was
approved on 2026-09-16, and F15 is now the active Plan-phase item. The checkout
reconciliation this once required is complete. The remaining rows are
recommendations.

| Priority | Work | Concrete next action / completion condition |
| --- | --- | --- |
| 1 | F15 brief balance | Approve the implementation plan, then implement and verify source/category balancing, the cap and single-category fallback without changing citation/bilingual/delivery contracts. |
| 2 | F14 attribution and excerpt hygiene | Decide data terms, takedown contact and colophon detail; approve spec and revised draft plan. Implement the colophon and a `dist/news.json`-only snippet strip while retaining stored snippets. Resolve before any commercialization work. |
| 3 | F6 remaining Extra checks | In an Extra-enabled build, complete Lighthouse comparison, reduced-motion and blocked-font checks; keep the production flag off unless a separate change is requested. |
| 4 | F5 email subscriptions | First resolve the conflict with the static/no-database constitution and choose a delivery/storage approach; then draft a spec. No implementation exists. |

F13 and F15 are complementary and now explicitly sequenced after F16. F14 moves
earlier only if Marco changes priorities, for example when commercialization
becomes imminent.

## Delivery and approval history

F12 requested 2026-09-06 as the next task after Telegram. A spec and draft
implementation plan are documented together at Marco's request for review.
Both were approved with "approved, proceed" on 2026-09-06. Scope: bilingual article summaries and
daily brief, summary-language switch in both website layouts, and Chinese-default
Telegram delivery. Original article headlines and source links remain unchanged.
Implementation is complete locally: 111 tests passed, production build passed,
and both layouts were checked on desktop/mobile with bilingual and legacy
fixtures. Published as `6d67eca`; full workflow run `34051731622` succeeded with
3 new bilingual articles and a 3-bullet bilingual brief, verified on the hosted
site. Telegram skipped today's already-sent delivery. Marco approved the live
sample's authentic Hong Kong Cantonese tone on 2026-09-07, including `嘅` and
`佢`. The last outstanding item — an actual eligible Telegram delivery — was
satisfied on 2026-09-08 once the F11 delivery fixes landed, completing F12. See
the F12 spec's publication evidence.

Current requested sequence (2026-09-06): F10 followed by F11, authorized as a
separate workstream from the existing F6/F5 queue. Marco approved proceeding
with implementation after the F11 technical walkthrough. F10 is implemented
and verified locally against both live DeepSeek models. F11 code is implemented
and published with offline tests passing. Hosted run #117 delivered the committed
brief through Telegram in 29 seconds, completing F11.

F11 needed a reliability fix on 2026-09-08. The 2026-09-07 scheduled run reported
success and sent nothing: the brief call failed, ingestion carried the previous
day's brief forward, and delivery skipped it while exiting 0. Two root causes were
addressed — the brief was synthesised only from a run's own new articles, so run
timing decided whether one existed (F8's window is now the last 24 hours), and an
undelivered brief was indistinguishable from a working quiet day. `news.json` now
records `briefStatus`, a genuinely quiet day sends a dated status message instead
of silence, and a failed brief call fails the workflow with an annotation. The
original DeepSeek error was never recovered from the Actions log, so that specific
cause remains unconfirmed.

## Phase 0 — Foundation

**F0: Repository setup & first push.** ✓ Done. Repo at
`github.com/marco144803025/AI-News-Reader`. Two GitHub Actions workflows:
`deploy.yml` (build + deploy on push) and `ingest.yml` (full ingest + deploy on
schedule / manual dispatch). Site live at
`https://marco144803025.github.io/AI-News-Reader/`.

## Phase 1 — Backend depth

**F1: Smarter ingestion.** ✓ Done. Incremental classification, bounded retries
for model calls, per-feed health and rolling archive retention are implemented.
The original goals below describe delivered scope; feed-fetch retry is still
separate F13 work.

Delivered scope includes missed-run catch-up, transient model-call retries,
persisted per-feed health and configurable 30-day archive retention. F4 supplied
the follow-up ingest verification harness; F9 surfaces source health in the UI.

## Phase 2 — UX upgrades

**F2c: Dark mode / Reader UI redesign.** ✓ Done; historical UI superseded by F16.
Originally delivered a permanent dark-academic theme
(no toggle — deliberate). Tab rail replaces dropdown. Pagination (8/page),
All-view preview (4/section), featured first card, editorial byline layout,
ember notable border. Design system in `.interface-design/system.md`.
See [spec divergence note](./F2c-dark-mode/spec.md).

**F2d: Category taxonomy expansion.** ✓ Done. Expanded from 6 broad categories
to 12 specific ones. Classifier prompt rewritten with per-category scope
descriptions. 7-day transition window for existing articles.

## Phase 3 — Content depth

**F4: Search & tag filtering.** Client-side keyword search over titles and
summaries; tag/keyword chips as multi-select filters; URL-shareable filter
state (`?q=…&topics=…&traits=…&entities=…&category=…`). Also bundled the ingest verification harness
(originally tracked as F1a) — `node:test` suite over `ingest/lib.ts` plus
CI test gates on PRs and the scheduled ingest workflow.

**F6: UI redesign — Stop the Presses (A/B feature flag).** Full visual
redesign, same content and logic, with the motif commitment of a stylized
game UI (Persona 5 / P3R / Expedition 33 as reference points): punk newsprint
collage — cream paper + ink black + one breaking-news red, Anton poster
display type, offset-print panels, tilted tape-strip nav and clipping rows,
rubber stamps for NOTABLE, a ransom-word highlight in the lead headline.
Ranked front page (bulletin / lead clipping / clippings list) replaces the
uniform card grid; wrapping tape nav replaces the overflow tab rail. Implemented
in `f276298` after approval on 2026-07-02; three verification checks remain open.
F16 now supplies the standard edition and gates Extra behind the default-off
`VITE_ENABLE_EXTRA` build flag. `?theme=extra` and saved preferences only select
Extra when that build flag is enabled.

**F5: Email subscriptions per tag.** Users subscribe to one or more tags and
receive a digest when matching articles are ingested. ⚠️ Conflicts with
Constitution rule #1 (no server runtime / no database). Spec must resolve one
of: third-party form provider (Buttondown / Mailchimp / Resend + tiny
serverless function), GitHub Actions cron digest with externalized storage, or
a constitutional amendment. Path to be chosen during Gate 1.

## Phase 4 — Portfolio & insight

F7–F9 specs and plans were approved on 2026-07-02 and all three features are
complete. F6 was also approved and implemented; its remaining verification is
listed above. The descriptions below distinguish delivered behavior from later
draft features.

**F7: Portfolio presentation & shareability.** ✓ Done. README pitch, screenshot,
live link, badges and architecture notes, MIT code licence, favicon and share
metadata are delivered. Constitution rule #4 was amended to match React + Vite.
F16 subsequently refreshed the screenshot, presentation and stale provider copy.

**F8: AI Daily Brief.** ✓ Done. A cited executive summary generated offline by
DeepSeek (F10), using the last 24 hours of the archive after the 2026-09-08
reliability fix. F12 adds bilingual output; F16 adds optional bilingual headlines
and the cinematic cover. Brief freshness/status and Telegram safeguards remain
in place. Source/category balancing is pending F15.

**F9: Trends & pipeline transparency.** Client-side trends over the existing
30-day archive: rising/falling tags (7d vs prior 7d), volume-per-day chart,
category mix — plus finally surfacing the `feedHealth` data F1 added to
`news.json` but never rendered ("2/10 feeds failing"). No new infrastructure.

**F10: DeepSeek API migration.** Replace the Anthropic/Claude provider used by
the offline ingestion and backfill commands with DeepSeek while preserving the
static site, generated `news.json` contract, retry behavior, and daily GitHub
Actions workflow. Document exactly where the local and GitHub-hosted API key
must be stored without exposing it to the browser or repository.

**F11: Personal Telegram morning brief.** Deliver the existing cited daily brief
to Marco's private Telegram chat after the scheduled site update. Reuse F10's
generated output without another model call. Include a preview command, safe
credential setup, freshness checks, persistent duplicate protection, and visible
delivery failures while retaining the static website architecture.

**F13: Source expansion & dedupe.** `feeds.json` still holds the original 10
sources from F0 — Anglophone, vendor-heavy, thin on policy and applied AI, and
with no Chinese-language input now that F12 produces Traditional Chinese
summaries. Widen the source list *and* add the controls that make a wider list
safe: cross-source deduplication so one story is one card, and a per-run
classified-article ceiling so extra feeds cannot silently multiply the daily
DeepSeek spend. Adding a source must stay a `feeds.json` edit with no code
change; failures keep flowing through the existing `feedHealth` contract that F9
renders. RSS/Atom only — no scraping, per Constitution rules #1 and #2. Also
triages the three feeds currently failing in production, diagnosed 2026-09-08:
Anthropic News is **dead** (404 on six paths, no autodiscovery tag, 58
consecutive failures and never one success), VentureBeat is **blocking us**
(WAF 429 to every User-Agent, on the hosted runner too), and Hacker News is
**our bug** (hnrss is intermittently unreachable and `fetchFeed` has no retry,
unlike the model calls). Spec carries a 71-source verified pick-list in Appendix
A and the triage evidence in Appendix B. **Implemented 2026-09-11** at a 20-feed
list and a 100-article per-run ceiling; see the section at the top of this file.

**F14: Licensing, attribution & excerpt hygiene.** Spec review pending. The
2026-09-08 review proposed separate data terms, a source-attribution colophon and
removing unused publisher excerpts from the deployed artifact. Its record counts
are a dated snapshot. Data terms, takedown contact and colophon detail are still
undecided; the existing draft plan is not approval. The strip must target `dist/`
alone: `ingest/backfill.ts` uses stored snippets for classification. The draft now
points to F16's standard footer and requires an Extra-enabled verification build.

**F15: Daily brief category balance.** Some days the brief reads as an academic
digest. Measured over the 30-day archive, the skew tracks arXiv bursts exactly:
2026-09-07 was 83% arXiv (Research 13 of 18 articles), 2026-08-15 was 100%, and
every non-arXiv day is balanced. `selectBriefInput` has no source or category
term at all — it sorts NOTABLE-first then by recency and slices at 50, which a
15-paper arXiv batch trivially dominates. The existing `ARXIV_CAP = 15` bounds
ingest cost, not brief composition. Cap any one source's or category's share of
the brief input, keep the `Brief` shape untouched so F11 and F12 keep working,
and log the input composition. Complementary to F13, which restores the news
sources that would otherwise dilute the skew; Gate 1 approved and Plan pending.

**F16: Cinematic standard edition.** Marco approved the dark editorial Daily
Brief prototype and requested full adoption on 2026-09-08: a content-led cover,
subtle particle animation, up to two notable stories, then detailed news on
scroll. The new layout becomes standard; Extra is retained behind a build-time
flag that is off by default, including for saved preferences and old links.
Preserve search, categories/tags, Trends, bilingual fallback, and current brief
freshness/delivery behavior. Proposed optional bilingual headlines use the
existing brief generation call. This separately requested UI workstream is
documented alongside F13–F15; their source, licensing, and balance scope remains
separate. Visual direction and Gate 1 technical spec approved; Marco replied
"approved" on 2026-09-08. Gate 2 implementation plan was approved with "approve"
on the same day. The initial implementation passed 124 tests; the approved full
interface-localization extension brought the recorded suite to 130 passing tests.
Both flag builds and desktop/phone, bilingual, keyboard, navigation and motion
checks are recorded in its plan. Published on 2026-09-09 from `e1dff25`, with
hosted evidence committed as `b04bd5f`. **Done as of 2026-09-11:** the native
200% browser-zoom check was performed and approved by Marco, since no available
agent tool could perform it. That closure is an owner acceptance without captured
browser/viewport/screenshot detail, and its spec and plan records say so.
No live ingestion/backfill or Telegram send was dispatched for that publication.
F6's older open checks are unchanged.

## Cross-cutting (planned later)

These don't have a phase yet — they get specced when one of the above forces them:

- Categorization-quality evaluation harness; the existing automated test suite
  and GitHub Actions test/build gates are already delivered.
- Archive scaling beyond ~5 MB remains an unspecced idea. Any SQLite proposal
  needs explicit design review against Constitution rule #1 (no database) before
  it can become approved work.

## F16 localization and publication history

F16 localization extension requested 2026-09-09: translate the entire standard
interface using the existing EN / 繁體中文 preference, independently of content
fallback, while preserving the cinematic design and default-off Extra flag.
Inspection reproduced English controls with Chinese selected in the running local
preview. Marco approved the focused spec with “approve” on 2026-09-09. The
localization implementation plan was approved with “approved” on 2026-09-09;
implementation and offline verification completed locally on 2026-09-09: 130 tests
passed, both Extra flag builds passed, and browser interactions, fallback states,
reload persistence and 320–1440 widths were checked in both languages. Chinese
desktop/mobile screenshots and detailed results are recorded in the F16 plan.
F16 stays Build solely for its open native 200% browser-zoom check. F12 remains Done; its original
summary-only scope is extended by F16 rather than retroactively redefined.


F16 publication completed 2026-09-09 following Marco's “deploy it, its ok”:
source `e1dff25`; hosted tests/build/Pages all succeeded. The public site now serves
the cinematic standard and full shared EN/Chinese interface, with Extra disabled.
Hosted switching/reload, index, Trends and search passed; evidence is in the F16
plan. Native 200% zoom remains the open Build check. This publication did not
include unrelated F13–F15 or older F11/F12 Roadmap edits.

## SDD process note

All features **must** follow the spec → plan → implement workflow documented in
`specs/README.md`. F2c and F2d were implemented without prior specs (retroactively
documented). Starting from F1, specs must be approved before any code is written.
