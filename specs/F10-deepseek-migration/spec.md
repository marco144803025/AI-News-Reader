# DeepSeek API Migration

**ID:** F10-deepseek-migration
**Status:** Done — local and hosted rollout verified
**Owner:** Marco

## Intent

The offline ingestion pipeline currently depends on an Anthropic API key and
Claude model identifiers for article classification, tagging, summarization,
and daily-brief synthesis. Migrate those model calls to the official DeepSeek
API so that one DeepSeek key funds the complete content pipeline, while the
published website remains a static GitHub Pages application and no secret is
ever sent to browser code or committed to the repository.

## User stories

- As the maintainer, I want to configure one DeepSeek API key locally, so that
  I can run ingestion and backfill from my computer.
- As the maintainer, I want the scheduled GitHub Actions job to use a DeepSeek
  repository secret, so that daily updates continue unattended.
- As a reader, I want classification, tags, summaries, and the daily brief to
  retain their existing data shape and behavior, so that the provider change
  does not alter how the website works.
- As the maintainer, I want clear setup and failure messages, so that I can
  identify a missing or invalid key without risking disclosure of the key.

## Acceptance criteria

- WHEN local ingestion or backfill starts with a valid `DEEPSEEK_API_KEY` THEN
  every model request SHALL be sent to the official DeepSeek API and SHALL use
  supported DeepSeek model identifiers.
- WHEN the scheduled ingestion workflow runs THEN it SHALL obtain
  `DEEPSEEK_API_KEY` from GitHub Actions repository secrets and SHALL not expose
  that value in source files, generated website assets, or logs.
- WHEN the DeepSeek key is missing THEN ingestion and backfill SHALL stop with
  an actionable message naming `DEEPSEEK_API_KEY` and SHALL not modify
  `public/news.json`.
- WHEN DeepSeek returns valid classification or brief output THEN the pipeline
  SHALL preserve the existing `NewsData`, article, tag, and brief contracts
  consumed by the static website.
- WHEN DeepSeek returns a transient connection, rate-limit, or server error
  THEN classification SHALL retain the existing bounded retry behavior and
  brief generation SHALL retain its existing failure isolation behavior.
- WHEN the automated test suite runs without an API key THEN it SHALL exercise
  the provider-facing parsing and error paths without making paid network
  requests.
- WHEN a maintainer reads the setup documentation THEN it SHALL give exact,
  Windows-cmd-compatible steps for placing the key in local `.env` and exact
  GitHub UI steps for creating the `DEEPSEEK_API_KEY` Actions secret.
- WHEN the migration is complete THEN the active pipeline, example environment
  file, workflow, dependency manifest, lockfile, tests, and README SHALL no
  longer require `ANTHROPIC_API_KEY`, Claude model identifiers, or the
  Anthropic SDK.

## Non-goals

- No model calls from the React/Vite browser application.
- No API-key entry form, authentication system, server runtime, or database.
- No redesign of the site, taxonomy, prompts, generated JSON schema, ingestion
  schedule, or feed list.
- No automatic transfer, cancellation, or deletion of Anthropic billing or
  credentials.
- No live paid DeepSeek call during automated tests.

## Open questions

Resolved at Gate 1 with cost-conscious defaults; these can be changed during
spec review.

- [x] Provider interface — use DeepSeek's official OpenAI-compatible API rather
      than retaining an Anthropic-branded SDK in a DeepSeek-only project.
- [x] Classification model — use `deepseek-v4-flash` for the high-volume batch
      calls.
- [x] Daily brief model — use `deepseek-v4-pro` for the single higher-value
      synthesis call, preserving the existing fast/bulk versus quality/brief
      split.
- [x] Secret name — standardize on `DEEPSEEK_API_KEY` locally and in GitHub
      Actions; do not support the old Anthropic variable as a fallback.

## Completion notes — 2026-09-06

Implemented the shared DeepSeek client, migrated ingestion/backfill/retries,
removed the Anthropic SDK, and updated environment/workflow/docs. Importing
ingestion or backfill no longer starts an unintended ingestion run.

Verification: `npm test` passed 95/95 tests; `npm run build` succeeded. A live
check using the configured local key returned three classifications and three
cited brief bullets, using Flash then Pro. It made no archive changes. Built
assets were checked against configured secret values; none were found.

Hosted activation still requires the GitHub `DEEPSEEK_API_KEY` repository secret
and publishing this code. No live GitHub Actions run was performed in this task.
