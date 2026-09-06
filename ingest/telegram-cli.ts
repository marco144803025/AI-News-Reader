import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import "dotenv/config";
import { checkBrief, deliverBrief, formatBrief, recoverAttempt, telegramConfig } from "./telegram.ts";
import { DeliveryError, GitHubStateStore, isRecord } from "./telegram-state.ts";

const NEWS_PATH = fileURLToPath(new URL("../public/news.json", import.meta.url));

async function readNews(): Promise<unknown> {
  try { return JSON.parse(await readFile(NEWS_PATH, "utf8")); }
  catch { throw new DeliveryError("Cannot read valid public/news.json. Run ingestion or restore the archive first."); }
}

function stateStore(): GitHubStateStore {
  return new GitHubStateStore(process.env.GITHUB_REPOSITORY ?? "", process.env.GITHUB_TOKEN ?? "");
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
      if (process.env.TELEGRAM_ENABLED !== "true") { console.log("Telegram: skipped (disabled)"); return; }
      telegramConfig(process.env);
      console.log("Telegram configuration: valid format. No network, state writes, or messages sent.");
      return;
    }
    case "preview": {
      const checked = checkBrief(await readNews(), Date.now());
      console.log(`Telegram preview: ${checked.reason ?? "fresh brief"}`);
      if (checked.brief) console.log(formatBrief(checked.brief).plain);
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
      const config = telegramConfig(process.env);
      const data = await readNews();
      const check = checkBrief(data, Date.now());
      if (check.reason) { console.log(`Telegram: skipped (${check.reason})`); return; }
      console.log(await deliverBrief({ enabled: true, data, config, store: stateStore() }));
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
