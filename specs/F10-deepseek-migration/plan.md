# DeepSeek API Migration — Plan

**Spec:** ./spec.md
**Status:** Done — implementation approved and locally verified
**Spec approval:** Marco requested implementation of the existing migration in
the daily-summary task on 2026-09-06. This advances F10 to planning; production
implementation was approved in the subsequent implementation request.

## Approach

Replace the Anthropic SDK with the official OpenAI JavaScript SDK, configured
only against `https://api.deepseek.com`. Centralize model configuration and
request handling in a small offline provider module. Use `deepseek-v4-flash`
for classification/backfill and `deepseek-v4-pro` for daily synthesis, as in
the existing spec and current DeepSeek documentation.

Keep the existing prompts, article processing, retention, and output schema.
Translate system/user messages and extract completion text; reject empty or
truncated responses before parsing. Explicitly configure the supported
non-thinking mode for this bounded structured-output workload, verifying its
current request shape before implementation. Disable SDK retries so the existing
bounded retry helper remains the sole retry owner. Keep JSON-array prompts;
do not enable a JSON-object response mode that conflicts with those prompts.

Make importing ingestion functions side-effect-free: backfill currently imports
`classifyBatch` from a file that unconditionally runs ingestion. Add an ESM entry
guard so tests and backfill cannot accidentally trigger another ingest.

## Affected files

Existing paths checked in the workspace; proposed files explicitly marked new.

- `ingest/deepseek.ts` (new) — client setup, model constants, bounded text requests,
  safe error descriptions, and transient-error classification.
- `ingest/ingest.ts` — migrate classification and synthesis calls, key validation,
  failure checks, and add a Windows-compatible direct-execution guard.
- `ingest/backfill.ts` — use the shared provider and safe errors; guard entrypoint.
- `ingest/lib.ts` — replace Anthropic-specific retry detection while preserving
  retry limits; bound and validate retry-after delays.
- `ingest/__tests__/lib.test.ts` — migrate retry fixtures to the new SDK errors.
- `ingest/__tests__/deepseek.test.ts` (new) — mocked requests, response validation,
  model selection, secret-safe errors, and missing-key/import-side-effect checks.
- `package.json` — replace `@anthropic-ai/sdk` with `openai`.
- `package-lock.json` — regenerate dependency lock consistently.
- `.env.example` — document `DEEPSEEK_API_KEY` using a placeholder.
- `.github/workflows/ingest.yml` — inject the DeepSeek repository secret.
- `README.md` — update active provider references and local/GitHub setup steps.
- `specs/F10-deepseek-migration/spec.md` — approval and completion tracking.
- `specs/F10-deepseek-migration/plan.md` — task and verification tracking.
- `specs/ROADMAP.md` — phase/status tracking; retain unrelated work.

## Data contracts

- Existing `NewsData`, `Article`, `Tags`, `Brief`, and `BriefBullet` stay unchanged.
- Configuration: `DEEPSEEK_API_KEY`, loaded from ignored `.env` locally or Actions
  repository secrets in CI. Never use a `VITE_` variable for credentials.
- Offline text request accepts model, system text, user text, and output-token
  limit; returns validated completion text. Provider exceptions retain status
  and retry headers internally, while printed errors exclude credentials and
  full request/response objects.
- Provider transport: non-streaming `POST /chat/completions`; system and user
  messages; documented thinking configuration; existing output caps of 4096
  tokens for classification and 2000 for briefs.

## Tasks

- [x] Replace the SDK dependency and implement the shared DeepSeek client.
- [x] Migrate retry handling and add mocked transport/error tests.
- [x] Migrate classification, synthesis, and backfill; guard executable modules.
- [x] Add missing-key, malformed/empty/truncated-output, and import-safety tests.
- [x] Update workflow secret wiring, example configuration, and README.
- [x] Run automated checks; inspect the diff for secrets and unintended changes.
- [x] Record results, distinguish offline verification from live API validation,
      and update completion status only when required checks are satisfied.

## Verification

Codex executes offline checks during implementation, without real credentials:

```cmd
cd /d F:\project\AI-news
npm test
npm run build
```

Expected: test summary has zero failures; TypeScript/Vite build exits 0.
Executed 2026-09-06: 95 tests passed, zero failed; TypeScript/Vite build succeeded.
Live DeepSeek check: three classifications, three cited brief bullets; no files
modified by the live check. Hosted rollout remains pending.

- AC1/AC4: mock the provider and assert official endpoint, chosen model,
  classification/tag outputs, cited brief outputs, and unchanged public schema.
- AC2/AC7/AC8: inspect workflow, environment example, documentation, dependency
  files, and browser assets; no active Anthropic dependency or credential wiring.
- AC3: subprocesses with an isolated environment and no key fail before network
  or writes; assert the existing news file remains unchanged.
- AC5: test transient failures, exhausted retries, non-retryable authentication
  errors, invalid retry headers, brief carry-forward, and truncated completions.
- AC6: inject/mock network access so tests cannot make paid API requests;
  importing ingestion/backfill modules performs no work.
- Optional live check, after Marco stores his key: run `npm run ingest` and
  inspect generated classifications and citations. This uses paid DeepSeek calls
  and updates the local news archive; report separately from offline checks.
- After GitHub secret setup and publication, verify one Actions run. Do not
  claim the hosted migration is live based only on local tests.

## Risks / tradeoffs

- Models may differ in classification/summary quality even with identical
  prompts; a small real-output review is needed before trusting unattended runs.
- Switching SDK error classes can regress retries; cover these with transport
  fixtures rather than only testing hardcoded outputs.
- SDK default retries would multiply requests; explicitly turn them off.
- Missing GitHub secrets prevent daily updates after rollout. Document setup
  before activating the migrated workflow.
- No historical archive rewrite, automatic Anthropic fallback, billing changes,
  schedule changes, or Telegram behavior in F10.

## Sources

- https://api-docs.deepseek.com/ — endpoint, SDK compatibility, current model IDs
  (verified 2026-09-06).
