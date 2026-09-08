import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import "dotenv/config";
import { archiveBriefStatus, checkBrief, deliverBrief, formatBrief, recoverAttempt, telegramConfig, telegramLanguage } from "./telegram.ts";
import { DeliveryError, GitHubStateStore, isRecord } from "./telegram-state.ts";

const NEWS_PATH = fileURLToPath(new URL("../public/news.json", import.meta.url));

async function readNews(): Promise<unknown> {
  try { return JSON.parse(await readFile(NEWS_PATH, "utf8")); }
  catch { throw new DeliveryError("Cannot read valid public/news.json. Run ingestion or restore the archive first."); }
}

function stateStore(): GitHubStateStore {
  return new GitHubStateStore(process.env.GITHUB_REPOSITORY ?? "", process.env.GITHUB_TOKEN ?? "");
}

/** Surfaced on the GitHub Actions run summary; a no-op anywhere else. */
function annotate(kind: "error" | "warning", message: string): void {
  if (process.env.GITHUB_ACTIONS === "true") console.log(`::${kind} title=Telegram brief::${message}`);
}

const BENIGN_OUTCOMES = new Set([
  "Telegram: sent",
  "Telegram: sent (no new brief)",
  "Telegram: skipped (already sent)",
  "Telegram: skipped (disabled)",
]);

/** True when the brief reached the chat, or deliberately did not need to. */
export function delivered(outcome: string): boolean {
  return BENIGN_OUTCOMES.has(outcome);
}

/** Every other outcome means today's brief is missing, so fail the run loudly. */
function failSend(outcome: string): never {
  annotate("error", `${outcome}. Check the ingest step for "brief skipped, carrying previous forward".`);
  throw new DeliveryError(`${outcome}. No brief was delivered today.`);
}

/** A one-off lookup, not a listener; never print token-bearing URLs or messages. */
export async function discoverPrivateChats(token: string, transport: typeof fetch = fetch): Promise<string[]> {
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) throw new DeliveryError("Set TELEGRAM_BOT_TOKEN from BotFather in .env first.");
  let value: unknown;
  try {
    const response = await transport(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeout: 0, limit: 100, allowed_updates: ["message"] }),
    });
    if (!response.ok) throw new Error("rejected");
    value = await response.json();
  } catch { throw new DeliveryError("Telegram setup failed. Check token, connection, and whether this bot has an existing webhook."); }
  if (!isRecord(value) || value.ok !== true || !Array.isArray(value.result)) throw new DeliveryError("Telegram setup returned invalid data.");
  const ids = new Set<string>();
  for (const update of value.result) {
    if (!isRecord(update) || !isRecord(update.message)) continue;
    const chat = update.message.chat;
    if (isRecord(chat) && chat.type === "private" && Number.isSafeInteger(chat.id) && Number(chat.id) > 0) ids.add(String(chat.id));
  }
  return [...ids];
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command !== "recover" && args.length) throw new DeliveryError("Unexpected arguments. See docs/telegram-setup.md.");
  switch (command) {
    case "check": {
      if (process.env.TELEGRAM_ENABLED !== "true") {
        console.log("Telegram: skipped (disabled)");
        annotate("warning", "TELEGRAM_ENABLED is not \"true\", so this run will not send a brief.");
        return;
      }
      telegramLanguage(process.env.TELEGRAM_LANGUAGE);
      telegramConfig(process.env);
      console.log("Telegram configuration: valid format. No network, state writes, or messages sent.");
      return;
    }
    case "preview": {
      const language = telegramLanguage(process.env.TELEGRAM_LANGUAGE);
      const checked = checkBrief(await readNews(), Date.now());
      console.log(`Telegram preview: ${checked.reason ?? "fresh brief"}`);
      if (checked.brief) console.log(formatBrief(checked.brief, language).plain);
      console.log("Preview only: no network or state writes. Remote duplicate status: unknown.");
      return;
    }
    case "setup": {
      const ids = await discoverPrivateChats(process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "");
      if (ids.length === 0) throw new DeliveryError("No private chat found. Open your bot, send /start now, then run telegram:setup again.");
      if (ids.length > 1) throw new DeliveryError("Multiple private chats found. Choose your own numeric ID in Telegram; no recipient was selected. See the setup guide.");
      console.log(`Private chat found. Confirm this is your new bot and your chat, then add TELEGRAM_CHAT_ID=${ids[0]} to .env and GitHub secrets.`);
      return;
    }
    case "send": {
      if (process.env.TELEGRAM_ENABLED !== "true") { console.log("Telegram: skipped (disabled)"); return; }
      const language = telegramLanguage(process.env.TELEGRAM_LANGUAGE);
      const config = telegramConfig(process.env);
      const data = await readNews();
      // A missing, stale or misdated brief means ingestion failed to regenerate
      // it. Exiting 0 here is what let the pipeline stay green while the brief
      // silently stopped arriving, so these outcomes now fail the run. This step
      // runs after the deploy, so failing it never blocks the site update.
      // A quiet day still has a message to send, so it goes through to delivery.
      const check = checkBrief(data, Date.now());
      if (check.reason && archiveBriefStatus(data) !== "no-new-material") {
        failSend(`Telegram: not sent (${check.reason})`);
      }
      const outcome = await deliverBrief({ enabled: true, data, config, store: stateStore(), language });
      console.log(outcome);
      if (!delivered(outcome)) failSend(outcome);
      return;
    }
    case "status": {
      const snapshot = await stateStore().read();
      if (!snapshot.state.attempts.length) console.log("Telegram: no recorded attempts");
      for (const attempt of snapshot.state.attempts) console.log(`${attempt.date} ${attempt.status} ${attempt.id}`);
      return;
    }
    case "recover": {
      const [id, outcome, confirmation] = args;
      if (args.length !== 3 || !/^[a-f0-9-]{36}$/.test(id ?? "") ||
          !["sent", "retry"].includes(outcome) || confirmation !== "--confirm-run-stopped") {
        throw new DeliveryError("Recovery: telegram:recover -- <attempt-id> sent|retry --confirm-run-stopped. First stop the originating run and check your chat.");
      }
      console.log(await recoverAttempt(stateStore(), id, outcome as "sent" | "retry"));
      return;
    }
    default: throw new DeliveryError("Use telegram:check, telegram:preview, telegram:setup, telegram:send, telegram:status, or telegram:recover.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof DeliveryError ? error.message : "Telegram command failed. Check configuration, input files, and permissions.");
    process.exitCode = 1;
  });
}
