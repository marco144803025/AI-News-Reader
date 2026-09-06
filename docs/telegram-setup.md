# Personal Telegram morning brief

The website generates its brief once through DeepSeek. Telegram delivery reuses
that brief after deployment; it does not make another model call. The schedule
remains daily at 06:00 UTC (07:00 BST / 06:00 GMT), with possible runner delays.

## 1. Create your bot

1. Open the official [BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`, choose a name and an available username ending in `bot`.
3. Copy the token into your existing local `.env` file as `TELEGRAM_BOT_TOKEN`.
   Do not overwrite the file or remove your DeepSeek key. Do not paste tokens
   into chat, source files, browser URLs, or command arguments.
4. Open the new bot's private conversation and press **Start** or send `/start`.
   This is a delivery bot; it does not respond conversationally.

Open the existing environment file from Windows cmd:

```cmd
cd /d F:\project\AI-news
notepad .env
```

Add these entries, preserving other values:

```dotenv
TELEGRAM_ENABLED=false
TELEGRAM_LANGUAGE=zh-HK
TELEGRAM_BOT_TOKEN=<token-from-BotFather>
TELEGRAM_CHAT_ID=
GITHUB_REPOSITORY=marco144803025/AI-News-Reader
GITHUB_TOKEN=
```

Find your private chat ID:

```cmd
cd /d F:\project\AI-news
npm run telegram:setup
```

Expected: `Private chat found. Confirm this is your new bot and your chat, then
add TELEGRAM_CHAT_ID=... to .env and GitHub secrets.` Copy the ID into `.env`.
The helper prints only a numeric ID, not message contents or your bot token.

If no chat is found, send `/start` again and rerun: Telegram does not retain
pending updates indefinitely. If multiple chats are found, the helper refuses
to guess. Use a dedicated new personal bot whose token only you control, or
identify your own numeric ID through an existing trusted Telegram client/API
workflow before setting `TELEGRAM_CHAT_ID` manually. Do not arbitrarily pick
another person's ID. Existing bots using webhooks cannot use this setup lookup.

## 2. Preview without sending

```cmd
cd /d F:\project\AI-news
npm run telegram:preview
```

Preview works without any credentials or network access. It shows the existing
brief's date, text, source URLs and site link, plus freshness. For example:

```text
Telegram preview: fresh brief
AI 新聞早報 — 2026-09-06
更新時間 07:05 BST
...
Preview only: no network or state writes. Remote duplicate status: unknown.
```

An older archive prints `Telegram preview: stale brief`; it is still useful for
checking appearance, but sending skips it. No brief prints `no brief`.
To generate fresh content, configure DeepSeek as described in the README and
run `npm run ingest` (paid API calls; updates the local news archive).

### Summary language

Telegram defaults to Hong Kong written Traditional Chinese (`zh-HK`) when
`TELEGRAM_LANGUAGE` is unset or blank. Set it to `en` for English. Both versions
use the same source links and timestamp; the website's saved preference does
not change the bot's language. Other values cause a configuration error.

If any Chinese brief bullet is unavailable, the whole brief appears in English
with `繁體中文摘要暫未提供，以下顯示英文。`. The existing archive remains readable;
new ingestion generates both versions. Delivery and preview never translate
content themselves or make an extra model call. Changing language does not
bypass the one-delivery-per-London-day or uncertain-delivery protections.

Preview English temporarily in Windows cmd:

```cmd
cd /d F:\project\AI-news
set TELEGRAM_LANGUAGE=en
npm run telegram:preview
set TELEGRAM_LANGUAGE=
```

The final command clears the temporary override, so subsequent commands use
the value in `.env` or the Chinese default. For a permanent local preference,
edit only the `TELEGRAM_LANGUAGE` line in your existing `.env`.

## 3. Enable scheduled delivery on GitHub

Open the repository's **Settings → Secrets and variables → Actions**.

Under **Secrets → New repository secret**, add:

| Name | Value |
| --- | --- |
| `DEEPSEEK_API_KEY` | Your DeepSeek API key |
| `TELEGRAM_BOT_TOKEN` | The BotFather token |
| `TELEGRAM_CHAT_ID` | Your confirmed numeric private-chat ID |

Under **Variables → New repository variable**, add `TELEGRAM_ENABLED` with
value `true`. If unset or anything other than `true`, delivery is skipped.
Optionally add repository variable `TELEGRAM_LANGUAGE` with value `en` for
English or `zh-HK` for Chinese. No new variable is needed for Chinese by default.
The workflow passes the same language to configuration validation and sending.
GitHub supplies `GITHUB_TOKEN` and `GITHUB_REPOSITORY` automatically; do not add
your personal GitHub token to the workflow. The job requests `contents: write`.

After the code is committed and pushed to the default branch, open
**Actions → Daily Ingest & Deploy → Run workflow**. Leave `telegram_only`
unchecked for an ordinary ingest, build, deploy, and send. The workflow runs
only on the default branch to keep scheduled and manual state consistent.

Expected last step: `Telegram: sent`, and one message in your private chat.
Running again on the same London date skips a completed delivery. A Telegram
failure after deployment makes the workflow visibly fail but leaves the site
published. A stale or missing brief skips without fabricating fresh content.

To retry an explicit rejection after fixing configuration, select
`telegram_only`. It uses the committed archive, rebuilds/deploys that snapshot,
then tries delivery without another paid ingestion. An uncertain delivery
requires recovery below before this can send again.

## 4. Optional local sending and state inspection

Local sending shares the SAME authoritative state as GitHub Actions. It requires
a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
restricted to this repository with **Contents: Read and write**. Put that token
in local `.env` as `GITHUB_TOKEN`; leave it out of public files. This token is
unnecessary if you only preview locally and send through Actions.

Set `TELEGRAM_ENABLED=true` in local `.env` when ready, then:

```cmd
cd /d F:\project\AI-news
npm run telegram:send
npm run telegram:status
```

The send creates/updates `.delivery/telegram.json` on the repository's default
branch through the GitHub API, even when launched locally. Expect small state
commits to appear remotely; pull those before your next source-code push.
State-only commits do not deploy the website. Local test delivery also consumes
that London day's delivery slot, so the scheduled run will skip that day.

State holds dates, random attempt IDs, brief hashes and outcomes. It stores no
bot tokens, chat IDs or message content, and is not included in the Vite build.
GitHub rejects a conditional update if another runner changed the file. Never
delete/reset this file to bypass duplicate protection. Protected branches that
deny state commits cause delivery to stop before sending; resolve repository
permissions deliberately rather than disabling branch protections blindly.

## 5. Recover an uncertain attempt

A timeout cannot tell us whether Telegram received the message. A pending or
uncertain record blocks later deliveries, including on subsequent days.

1. Stop the originating Actions run/local process and wait for it to end.
2. Check your private chat for the message.
3. Run `npm run telegram:status` and copy the exact pending/uncertain attempt ID.
4. Choose ONE recovery action below. The confirmation flag records that you
   performed step 1; the CLI cannot independently verify a local process stopped.

If the message arrived, mark the attempt sent:

```cmd
npm run telegram:recover -- <attempt-id> sent --confirm-run-stopped
```

If it did not arrive and you accept the residual duplicate risk of an uncertain
network outcome, release the attempt for a fresh retry:

```cmd
npm run telegram:recover -- <attempt-id> retry --confirm-run-stopped
```

Expected: `Telegram: recovery recorded (sent)` or `(retry)`. Recovery itself
does not send a message. You can then run delivery again or use `telegram_only`.
A brief from an earlier London date still cannot be sent.

## 6. Verify the code without live services

```cmd
cd /d F:\project\AI-news
npm test
npm run build
npm run telegram:preview
```

Tests use fake HTTP and state storage. They cover escaping, oversized content,
London dates, duplicate protection, overlapping attempts, uncertain delivery,
GitHub conditional writes and recovery. Passing these checks does not verify
your Telegram/GitHub credentials or establish that the hosted schedule is live.

References: [Telegram Bot API](https://core.telegram.org/bots/api),
[GitHub Contents API](https://docs.github.com/en/rest/repos/contents).

## Troubleshooting a failed workflow

- A green **pages build and deployment** means the site was published. Check
  **Daily Ingest & Deploy → Send personal Telegram brief** for delivery results.
- `TELEGRAM_BOT_TOKEN is missing or invalid`: under **Settings → Secrets and
  variables → Actions → Secrets**, create a **repository secret** named exactly
  `TELEGRAM_BOT_TOKEN`. Its value is only the token from BotFather, without quotes
  or `TELEGRAM_BOT_TOKEN=`. A value in local `.env` is not copied to GitHub.
  Keep `TELEGRAM_CHAT_ID` and `DEEPSEEK_API_KEY` as separate repository secrets.
- Under **Variables**, use name `TELEGRAM_ENABLED` and value `true` separately.
- The workflow checks Telegram configuration before paid ingestion. Locally,
  `npm run telegram:check` validates formatting without sending or connecting;
  it does not verify that Telegram accepts the token.
- After fixing a secret, run **Daily Ingest & Deploy → Run workflow** with
  **telegram_only** checked to deliver today's committed brief without another
  paid ingestion. A stale brief is skipped; use a full run if today's is missing.
- A run showing many hours may have been queued behind another run. Open the
  job to see its actual execution time. The daily job now has a 20-minute limit,
  with a 15-minute ingestion limit, so a stalled process cannot block it for six
  hours. Feed HTTP requests have a 20-second deadline and close failed bodies.
