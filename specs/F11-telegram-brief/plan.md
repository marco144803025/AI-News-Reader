# Personal Telegram Morning Brief — Plan

**Spec:** ./spec.md
**Status:** Done
**Authorization:** Marco approved the technical walkthrough and explicitly
requested implementation on 2026-09-06. This plan records the implementation
choices under that authorization before production edits.

## Approach

Keep delivery separate from ingestion. A TypeScript CLI previews, discovers a
private chat, sends, inspects state, or explicitly resolves an interrupted
attempt. The default daily workflow sends only after successful deployment.
Use native fetch for Telegram and GitHub; no Telegram dependency or server.

Use `.delivery/telegram.json` on the repository default branch as authoritative
state, through GitHub's Contents API. Reserve by compare-and-swap using the
file's current blob SHA (create only if absent). A conflicting write never
permits a send. This serializes reservations even across local and hosted
senders. Record pending BEFORE Telegram; sent only after a validated response.
Any unresolved pending/uncertain record blocks later deliveries, including the
next day. Known rejections can become failed; ambiguous errors stay uncertain.
No automatic deletion, expiry, or pruning of state. Records contain only random
attempt IDs, brief hashes, dates, timestamps, and outcomes; no chat IDs, tokens,
or content. The state file is committed in repository history, not site assets.

Use workflow concurrency to reduce collisions; the authoritative conditional
write is still the safety boundary. State commits from local personal tokens
must not trigger redundant website deploys (ignore state-only pushes).
Local sends use the SAME repository state and require a contents-write GitHub
token; preview stays fully offline and labels remote duplicate status unknown.

## Affected files

- `ingest/telegram.ts` (new): pure validation, London dates, formatting, send
  state machine, injectable clock/transport/store.
- `ingest/telegram-state.ts` (new): strict state validation and GitHub Contents
  API adapter with conditional writes and sanitized failures.
- `ingest/telegram-cli.ts` (new): preview, setup, send, status, recover entrypoint.
- `ingest/__tests__/telegram.test.ts` (new): deterministic formatting, clock,
  timeout/rejection/rate-limit, persistence, overlap and recovery checks.
- `ingest/__tests__/telegram-state.test.ts` (new): mocked Contents API contract.
- `package.json`: Telegram command aliases; current test glob already covers files.
- `.env.example`: Telegram and local GitHub configuration placeholders.
- `.github/workflows/ingest.yml`: concurrency, opt-in delivery, retry-only manual
  mode using the committed archive, authenticated state access after deployment.
- `.github/workflows/deploy.yml`: ignore state-only pushes.
- `README.md`: feature and setup entrypoint.
- `docs/telegram-setup.md` (new): BotFather, private chat discovery, local/Actions
  secrets, preview/send, state inspection, and deliberate recovery.
- F11 spec/plan and `specs/ROADMAP.md`: progress and verification evidence.

## Data contracts

Public NewsData is unchanged. Internal state is versioned:
`{version: 1, attempts: [{id, date, briefId, status, updatedAt}]}` where status is
pending, sent, uncertain, failed, or released. Failed/released attempts remain
auditable but permit another try; sent prevents repeat brief/date delivery;
pending/uncertain blocks sends until explicit recovery.

Config: TELEGRAM_ENABLED, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID; local send/state
operations also use GITHUB_REPOSITORY and GITHUB_TOKEN. Workflow supplies its
existing repository context and token (contents: write). No alternate state
backend or configurable arbitrary API endpoint. Bot token URLs never printed.

Message is escaped HTML with numbered HTTP(S) citation links and a fixed site
link. Bound both rendered and raw payload length conservatively; shorten text
and omit excessive citations with a visible shortened-preview disclosure.
Timestamp must be explicit UTC ISO and not in the future; freshness compares
Europe/London calendar dates. Missing brief skips; malformed archive/shape fails.

## Tasks

- [x] Implement formatter, runtime validation and eligibility checks.
- [x] Implement strict GitHub state adapter and atomic reservation.
- [x] Implement bounded Telegram request/retry policy and delivery state machine.
- [x] Implement preview/setup/send/status/recover commands.
- [x] Wire workflow, config examples, setup/recovery documentation.
- [x] Run offline tests, build, real local preview and sanitized config checks.
- [x] Record live prerequisites separately; do not claim hosted delivery before
      credentials, publication and a confirmed live run.

## Verification

Codex runs `npm test`, `npm run build`, `npm run telegram:preview`.
AC1–4: injected transport/store tests cover delivery, duplicate dates/identities,
failed persistence, CAS races, ambiguous errors, explicit rejection, 429 delays,
and recovery against stale attempt IDs. AC5: subprocess preview without secrets
or network, no file writes. AC6/8: both London DST transitions, malformed input,
future/stale timestamps, HTML characters, emoji, URLs and payload limits.
AC7: document account setup and verify CLI error messages offline. Actual live
send and hosted workflow required credentials and publication at this checkpoint;
hosted run #117 subsequently verified successful delivery.

## Risks / tradeoffs

- Contents-write access is required locally; the Actions token is supplied by
  GitHub. Protected default branches may reject state commits; fail closed.
- State commits add a small amount of repository history. No private recipient
  identifiers or message contents are stored there.
- Safe duplicate avoidance can miss a brief when a request outcome is unknown.
  Manual recovery requires first stopping the originating workflow/process and
  checking the chat, then naming the exact attempt ID and choosing sent/retry.
- Sending after publication means a delivery error reports workflow failure but
  leaves the website intact. Retry-only mode avoids unnecessary paid re-ingestion.

## Verification results — 2026-09-06

- Offline suite: 95 tests passed, 0 failed; production build succeeded.
- Local preview: stale brief dated 2026-07-03, correctly labeled and not sent.
- No configured keys/tokens found in built assets; `.env` remains ignored.
- Added a freshness recheck before each rate-limit retry and after reservation
  so crossing London midnight cannot cause another stale send attempt.
- Hosted verification was completed by run #117 after the repair described below.

Sources: https://docs.github.com/en/rest/repos/contents and
https://core.telegram.org/bots/api (checked 2026-09-06).

## Hosted failure repair — 2026-09-06

Marco reported run #114 timing out after six hours and missing Telegram delivery.
The log shows ingestion wrote its output but the process did not exit. A local
HTTP/subprocess regression reproduced rss-parser's unclosed sockets after error,
redirect, and timeout responses: three failures before the fix, all pass after.
Feed transport now uses abortable native fetch and explicitly cancels error bodies;
rss-parser only parses the completed XML. The daily workflow also caps the job at
20 minutes and ingestion at 15 minutes.

Run #115 waited behind #114 and executed for only 24 seconds. Both #115 and #116
failed Telegram token validation. Repository settings inspection found no
TELEGRAM_BOT_TOKEN secret; the other required secrets were present. A new offline
configuration check catches this before paid ingestion. The setup guide now
explains separate secret values and retry-only delivery.

Repair verification: 100 tests passed, 0 failed; production build succeeded.
Hosted run #117 completed successfully in 29 seconds and logged `Telegram: sent`.
The repository delivery state records the attempt as sent. F11 is Done.
