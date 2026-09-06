import { createHash, randomUUID } from "node:crypto";
import type { Brief } from "../src/types.ts";
import { DeliveryError, isRecord, isUtcTimestamp, type Attempt, type AttemptStatus, type StateSnapshot, type StateStore } from "./telegram-state.ts";

export const SITE_URL = "https://marco144803025.github.io/AI-News-Reader/";
export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export function londonDate(time: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(time);
}

export type BriefCheck = { brief?: Brief; reason?: string };

/** Validate at the disk boundary; archive.generatedAt does not prove brief freshness. */
export function checkBrief(data: unknown, now: number): BriefCheck {
  if (!isRecord(data) || !Array.isArray(data.articles)) throw new DeliveryError("Invalid news archive. Check public/news.json.");
  if (data.brief === undefined) return { reason: "no brief" };
  const value = data.brief;
  if (!isRecord(value)) throw new DeliveryError("Invalid brief object in public/news.json.");
  if (!isUtcTimestamp(value.generatedAt)) return { reason: "invalid brief timestamp" };
  if (!Array.isArray(value.bullets) || value.bullets.length < 3 || value.bullets.length > 5) {
    throw new DeliveryError("Invalid brief: expected 3–5 bullets.");
  }
  const bullets = value.bullets.map(item => {
    if (!isRecord(item) || typeof item.text !== "string" || !item.text.trim() ||
        !Array.isArray(item.refs) || item.refs.some(url => typeof url !== "string")) {
      throw new DeliveryError("Invalid brief bullet: expected text and source URLs.");
    }
    return { text: item.text.trim(), refs: item.refs as string[] };
  });
  const brief: Brief = { generatedAt: value.generatedAt, bullets };
  const generated = Date.parse(brief.generatedAt);
  if (generated > now) return { brief, reason: "future brief" };
  if (londonDate(generated) !== londonDate(now)) return { brief, reason: "stale brief" };
  return { brief };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

/** Conservatively cap raw HTML too, so parsed text always fits Telegram's limit. */
export function formatBrief(brief: Brief): { html: string; plain: string; shortened: boolean } {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  }).format(Date.parse(brief.generatedAt));
  let maxText = 1200;
  let maxRefs = 3;
  for (;;) {
    let shortened = false;
    let citation = 0;
    const plain: string[] = [`AI Morning Brief — ${londonDate(Date.parse(brief.generatedAt))}`, `Generated ${time}`, ""];
    const html: string[] = [`<b>${plain[0]}</b>`, escapeHtml(plain[1]), ""];
    for (const bullet of brief.bullets) {
      const points = Array.from(bullet.text);
      const text = points.length > maxText ? points.slice(0, maxText).join("") + "…" : bullet.text;
      if (text !== bullet.text) shortened = true;
      const allUrls = [...new Set(bullet.refs.map(safeUrl).filter((url): url is string => url !== null))];
      const urls = allUrls.filter(url => url.length <= 500).slice(0, maxRefs);
      if (urls.length < bullet.refs.length) shortened = true;
      const links = urls.map(url => ({ url, index: ++citation }));
      html.push(`• ${escapeHtml(text)}${links.map(link => ` <a href="${escapeHtml(link.url)}">[${link.index}]</a>`).join("")}`);
      plain.push(`• ${text}${links.map(link => ` [${link.index}] ${link.url}`).join("")}`);
    }
    if (shortened) { html.push("", "Shortened preview — full brief on the website."); plain.push("", "Shortened preview — full brief on the website."); }
    html.push("", `<a href="${SITE_URL}">Read the full brief</a>`);
    plain.push("", `Read the full brief: ${SITE_URL}`);
    if (html.join("\n").length <= 4096) return { html: html.join("\n"), plain: plain.join("\n"), shortened };
    if (maxRefs > 0) maxRefs--;
    else maxText = Math.floor(maxText / 2);
    if (maxText < 10) throw new DeliveryError("Could not fit the brief in one Telegram message.");
  }
}

export type TelegramConfig = { token: string; chatId: string };
export function telegramConfig(env: NodeJS.ProcessEnv): TelegramConfig {
  const token = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = env.TELEGRAM_CHAT_ID?.trim() ?? "";
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) throw new DeliveryError("TELEGRAM_BOT_TOKEN is missing or invalid. Set the token from BotFather.");
  if (!/^[1-9]\d*$/.test(chatId) || !Number.isSafeInteger(Number(chatId))) throw new DeliveryError("TELEGRAM_CHAT_ID must be your positive numeric private-chat ID. Run telegram:setup.");
  return { token, chatId };
}

export class TelegramRejected extends DeliveryError {}
export class TelegramUncertain extends DeliveryError {}

/** Safe errors omit Telegram's token-bearing URL and any remote response text. */
export async function sendTelegram(
  config: TelegramConfig,
  html: string,
  transport: typeof fetch = fetch,
  delay: (ms: number) => Promise<void> = sleep,
  beforeRequest: () => void = () => {},
): Promise<void> {
  let waited = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    beforeRequest();
    let response: Response;
    let value: unknown;
    try {
      // NOTE: Only explicit rate-limit rejections are repeated. A thrown fetch
      // may occur AFTER Telegram accepted the message, so it is not retryable.
      response = await transport(`https://api.telegram.org/bot${config.token}/sendMessage`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(20_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: config.chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
      });
      value = await response.json();
    } catch { throw new TelegramUncertain("Telegram: delivery uncertain; check your chat before retrying."); }
    if (response.ok && isRecord(value) && value.ok === true && isRecord(value.result) &&
        Number.isSafeInteger(value.result.message_id) && isRecord(value.result.chat) &&
        value.result.chat.type === "private" && String(value.result.chat.id) === config.chatId) return;
    if (isRecord(value) && value.ok === false && value.error_code === 429 && response.status === 429) {
      const seconds = isRecord(value.parameters) ? value.parameters.retry_after : undefined;
      if (attempt < 2 && typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 && waited + seconds <= 60) {
        waited += seconds;
        await delay(seconds * 1000);
        continue;
      }
      throw new TelegramRejected("Telegram rate limit: retry budget exhausted. Try later.");
    }
    if (isRecord(value) && value.ok === false && [400, 401, 403, 404].includes(response.status)) {
      throw new TelegramRejected("Telegram rejected the message. Check the bot token, private chat, and whether the bot is blocked.");
    }
    throw new TelegramUncertain("Telegram: delivery uncertain; check your chat before retrying.");
  }
}

function updatedAttempt(snapshot: StateSnapshot, id: string, status: AttemptStatus, now: number) {
  return { version: 1 as const, attempts: snapshot.state.attempts.map(item => item.id === id ? { ...item, status, updatedAt: new Date(now).toISOString() } : item) };
}

export type DeliverOptions = {
  enabled: boolean; data: unknown; config: TelegramConfig; store: StateStore;
  now?: () => number; send?: (html: string) => Promise<void>;
};

export async function deliverBrief(options: DeliverOptions): Promise<string> {
  if (!options.enabled) return "Telegram: skipped (disabled)";
  const now = options.now ?? Date.now;
  const check = checkBrief(options.data, now());
  if (check.reason || !check.brief) return `Telegram: skipped (${check.reason})`;
  const brief = check.brief;
  const html = formatBrief(brief).html;
  const briefId = createHash("sha256").update(JSON.stringify(brief)).digest("hex");
  const snapshot = await options.store.read();
  const date = londonDate(now());
  if (snapshot.state.attempts.some(item => item.status === "sent" && (item.date === date || item.briefId === briefId))) {
    return "Telegram: skipped (already sent)";
  }
  if (snapshot.state.attempts.some(item => ["pending", "uncertain"].includes(item.status))) {
    throw new DeliveryError("Telegram: pending or uncertain delivery; check status and resolve it before retrying.");
  }
  const attempt: Attempt = { id: randomUUID(), date, briefId, status: "pending", updatedAt: new Date(now()).toISOString() };
  // NOTE: The conditional durable write is the lock. Only its successful owner
  // may send; a conflicting or ambiguous write must exit before Telegram.
  const reserved = await options.store.save(snapshot, { version: 1, attempts: [...snapshot.state.attempts, attempt] });
  const send = options.send ?? (text => sendTelegram(options.config, text, fetch, sleep, () => {
    if (checkBrief(options.data, now()).reason || londonDate(now()) !== date) {
      throw new TelegramRejected("Telegram: brief became stale while waiting; no further send attempted.");
    }
  }));
  try {
    // Recheck after storage/network waits so a run cannot send yesterday's brief
    // across midnight. A reserved but unsent attempt is explicitly released.
    const latest = checkBrief(options.data, now());
    if (latest.reason || londonDate(now()) !== date) {
      await options.store.save(reserved, updatedAttempt(reserved, attempt.id, "released", now()));
      return "Telegram: skipped (stale brief)";
    }
    await send(html);
  } catch (error) {
    const status = error instanceof TelegramRejected ? "failed" : "uncertain";
    try { await options.store.save(reserved, updatedAttempt(reserved, attempt.id, status, now())); }
    catch { throw new DeliveryError("Telegram outcome could not be saved; pending state blocks resend. Check your chat and telegram:status."); }
    if (error instanceof DeliveryError) throw error;
    throw new TelegramUncertain("Telegram: delivery uncertain; check your chat before retrying.");
  }
  try { await options.store.save(reserved, updatedAttempt(reserved, attempt.id, "sent", now())); }
  catch { throw new DeliveryError("Telegram confirmed delivery, but saving sent state failed. Check telegram:status; do not resend."); }
  return "Telegram: sent";
}

/** Human-only recovery uses the exact attempt ID and a conditional write. */
export async function recoverAttempt(store: StateStore, id: string, outcome: "sent" | "retry", now = Date.now()): Promise<string> {
  const snapshot = await store.read();
  const item = snapshot.state.attempts.find(attempt => attempt.id === id);
  if (!item || !["pending", "uncertain"].includes(item.status)) throw new DeliveryError("Recovery requires an existing pending/uncertain attempt ID.");
  await store.save(snapshot, updatedAttempt(snapshot, id, outcome === "sent" ? "sent" : "released", now));
  return `Telegram: recovery recorded (${outcome})`;
}
