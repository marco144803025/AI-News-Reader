import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { checkBrief, deliverBrief, formatBrief, londonDate, recoverAttempt, sendTelegram, telegramConfig, telegramLanguage, TelegramRejected, TelegramUncertain } from "../telegram.ts";
import { CHINESE_FALLBACK, type SummaryLanguage } from "../../src/lib/language.ts";
import { delivered, discoverPrivateChats } from "../telegram-cli.ts";
import { StateConflict, type DeliveryState, type StateSnapshot, type StateStore } from "../telegram-state.ts";

const NOW = Date.parse("2026-09-06T07:00:00Z");
const config = { token: "123456:abcdefghijklmnopqrstuvwxyz", chatId: "12345" };
const brief = { generatedAt: "2026-09-06T06:00:00Z", bullets: [0, 1, 2].map(i => ({ text: `Development ${i}`, refs: [`https://example.org/${i}`] })) };
const data = { articles: [], brief };
const bilingualBrief = { ...brief, bullets: brief.bullets.map((bullet, i) => ({ ...bullet, textZhHK: `新消息 ${i}。` })) };

class MemoryStore implements StateStore {
  state: DeliveryState = { version: 1, attempts: [] };
  revision = 0;
  failAt = -1;
  async read(): Promise<StateSnapshot> { return { sha: String(this.revision), state: structuredClone(this.state) }; }
  async save(previous: StateSnapshot, next: DeliveryState): Promise<StateSnapshot> {
    if (this.revision === this.failAt) throw new Error("persistence failure");
    if (previous.sha !== String(this.revision)) throw new StateConflict("conflict");
    this.state = structuredClone(next); this.revision++;
    return this.read();
  }
}
const options = (store: MemoryStore) => ({ enabled: true, config, data, store, now: () => NOW });

describe("Telegram content", () => {
  it("defaults to HK Chinese, validates overrides, and preserves Chinese at the archive boundary", () => {
    for (const value of [undefined, "", " "]) assert.equal(telegramLanguage(value), "zh-HK");
    assert.equal(telegramLanguage(" en "), "en");
    for (const value of [null, 123, "zh-CN", "zh", "EN"]) assert.throws(() => telegramLanguage(value), /TELEGRAM_LANGUAGE/);
    const validated = checkBrief({ ...data, brief: bilingualBrief }, NOW).brief!;
    assert.deepEqual(validated, bilingualBrief);
    const chinese = formatBrief(validated).plain;
    assert.match(chinese, /AI 新聞早報/);
    assert.match(chinese, /新消息 0。/);
    assert.doesNotMatch(chinese, /Development|暫未提供/);
    const english = formatBrief(validated, "en").plain;
    assert.match(english, /AI Morning Brief/);
    assert.match(english, /Development 0/);
    assert.doesNotMatch(english, /新消息/);
    for (const bullet of brief.bullets) {
      assert(chinese.includes(bullet.refs[0]));
      assert(english.includes(bullet.refs[0]));
    }
  });

  it("falls back as a whole on old, partial and malformed Chinese briefs", () => {
    for (const textZhHK of [undefined, " ", 42]) {
      const partial = { ...bilingualBrief, bullets: bilingualBrief.bullets.map((b, i) => i === 1 ? { ...b, textZhHK } : b) };
      const validated = checkBrief({ ...data, brief: partial }, NOW).brief!;
      const result = formatBrief(validated).plain;
      assert(result.includes(CHINESE_FALLBACK));
      for (const bullet of brief.bullets) assert(result.includes(bullet.text));
      assert.doesNotMatch(result, /新消息/);
    }
    assert(formatBrief(brief).plain.includes(CHINESE_FALLBACK));
  });

  it("escapes and caps long Chinese with translated shortening and fallback notices", () => {
    const long = { ...bilingualBrief, bullets: bilingualBrief.bullets.map(b => ({ ...b, textZhHK: '新功能🚀<&"'.repeat(2000) })) };
    const result = formatBrief(long);
    assert(result.html.length <= 4096);
    assert(result.shortened);
    assert.match(result.html, /內容已節錄/);
    assert.match(result.html, /&lt;&amp;&quot;/);
    assert.match(result.html, /閱讀完整摘要/);
    assert(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(result.html));
  });
  it("checks configuration before any network or archive work, and detects the missing repository token", () => {
    const env = { ...process.env, DOTENV_CONFIG_PATH: "missing-test-env", TELEGRAM_ENABLED: "true",
      TELEGRAM_BOT_TOKEN: config.token, TELEGRAM_CHAT_ID: config.chatId, GITHUB_TOKEN: "", TELEGRAM_LANGUAGE: "" };
    const args = ["--import", "tsx", "ingest/telegram-cli.ts", "check"];
    const valid = spawnSync(process.execPath, args, { env, encoding: "utf8", timeout: 5_000 });
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /valid format. No network, state writes, or messages sent/);
    for (const overrides of [{ TELEGRAM_BOT_TOKEN: "" }, { TELEGRAM_CHAT_ID: "-123" }]) {
      const invalid = spawnSync(process.execPath, args, { env: { ...env, ...overrides }, encoding: "utf8", timeout: 5_000 });
      assert.equal(invalid.status, 1, invalid.stderr);
      assert.match(invalid.stderr, /TELEGRAM_BOT_TOKEN|private-chat/);
      assert.doesNotMatch(invalid.stderr, /abcdefghijklmnopqrstuvwxyz/);
    }
    const disabled = spawnSync(process.execPath, args, {
      env: { ...env, TELEGRAM_ENABLED: "false", TELEGRAM_BOT_TOKEN: "" }, encoding: "utf8", timeout: 5_000,
    });
    assert.equal(disabled.status, 0, disabled.stderr);
    assert.match(disabled.stdout, /skipped \(disabled\)/);
  });

  it("checks the brief timestamp, not the archive's; rejects invalid shapes", () => {
    assert.equal(checkBrief(data, NOW).reason, undefined);
    for (const [generatedAt, reason] of [["2026-09-05T06:00:00Z", "stale brief"], ["2026-09-07T06:00:00Z", "future brief"], ["bad", "invalid brief timestamp"], ["2026-02-30T00:00:00Z", "invalid brief timestamp"]]) {
      assert.equal(checkBrief({ ...data, generatedAt: new Date(NOW).toISOString(), brief: { ...brief, generatedAt } }, NOW).reason, reason);
    }
    assert.equal(checkBrief({ articles: [] }, NOW).reason, "no brief");
    for (const invalid of [null, {}, { articles: [], brief: null }, { ...data, brief: { ...brief, bullets: [] } }, { ...data, brief: { ...brief, bullets: [null, null, null] } }]) assert.throws(() => checkBrief(invalid, NOW));
  });

  it("uses London dates through both DST changes and summer midnight", () => {
    assert.equal(londonDate(Date.parse("2026-09-05T23:30:00Z")), "2026-09-06");
    for (const date of ["2026-03-29", "2026-10-25"]) {
      for (const hour of ["00", "01", "02"]) assert.equal(londonDate(Date.parse(`${date}T${hour}:30:00Z`)), date);
    }
    assert.equal(checkBrief({ ...data, brief: { ...brief, generatedAt: "2026-09-05T23:30:00Z" } }, NOW).reason, undefined);
  });

  it("escapes HTML, rejects unsafe URLs, and fits huge Unicode payloads in one message", () => {
    const result = formatBrief({ ...brief, bullets: brief.bullets.map(item => ({ ...item, text: '<b>Safe & "quoted"</b>', refs: ['javascript:alert(1)', 'https://user:password@example.org', 'https://example.org/?a=1&b=2'] })) });
    assert(result.html.includes("&lt;b&gt;Safe &amp; &quot;"));
    assert.doesNotMatch(result.html, /javascript:|password/);
    assert(result.html.includes("a=1&amp;b=2"));
    const huge = formatBrief({ ...brief, bullets: Array.from({ length: 5 }, () => ({ text: "🚀<&".repeat(8000), refs: ["https://example.org/" + "x".repeat(1000)] })) }, "en");
    assert(huge.html.length <= 4096); assert(huge.shortened);
    assert(huge.html.includes("Shortened preview"));
    assert(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(huge.html));
  });

  it("preview is offline without credentials, and disabled send performs no work", () => {
    const env = { ...process.env, DOTENV_CONFIG_PATH: "missing-test-env", TELEGRAM_ENABLED: "false", TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "", GITHUB_TOKEN: "", TELEGRAM_LANGUAGE: "" };
    const preview = spawnSync(process.execPath, ["--import", "tsx", "ingest/telegram-cli.ts", "preview"], { env, encoding: "utf8" });
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /no network or state writes/);
    const disabled = spawnSync(process.execPath, ["--import", "tsx", "ingest/telegram-cli.ts", "send"], { env, encoding: "utf8" });
    assert.equal(disabled.status, 0, disabled.stderr);
    assert.match(disabled.stdout, /skipped \(disabled\)/);
    assert.throws(() => telegramConfig({}), /BOT_TOKEN/);
    assert.throws(() => telegramConfig({ TELEGRAM_BOT_TOKEN: config.token, TELEGRAM_CHAT_ID: "-123" }), /private-chat/);
  });

  it("CLI preview honors both locales offline and rejects invalid locale before credential checks", () => {
    const env = { ...process.env, DOTENV_CONFIG_PATH: "missing-test-env", TELEGRAM_ENABLED: "true",
      TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "", GITHUB_TOKEN: "" };
    for (const [language, heading] of [["", "AI 新聞早報"], ["en", "AI Morning Brief"]]) {
      const preview = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
        "globalThis.fetch=()=>{throw new Error('NETWORK FORBIDDEN')}; process.argv=[process.execPath,'ingest/telegram-cli.ts','preview']; await import('./ingest/telegram-cli.ts');"],
        { env: { ...env, TELEGRAM_LANGUAGE: language }, encoding: "utf8", timeout: 10_000 });
      assert.equal(preview.status, 0, preview.stderr);
      assert.match(preview.stdout, /Preview only: no network or state writes/);
      if (!preview.stdout.includes("Telegram preview: no brief")) assert(preview.stdout.includes(heading));
    }
    for (const command of ["check", "preview", "send"]) {
      const invalid = spawnSync(process.execPath, ["--import", "tsx", "ingest/telegram-cli.ts", command],
        { env: { ...env, TELEGRAM_LANGUAGE: "zh-CN" }, encoding: "utf8", timeout: 10_000 });
      assert.equal(invalid.status, 1, invalid.stderr);
      assert.match(invalid.stderr, /TELEGRAM_LANGUAGE must be zh-HK or en/);
      assert.doesNotMatch(invalid.stderr, /BOT_TOKEN/);
    }
  });
});

describe("Telegram transport", () => {
  const ok = () => Response.json({ ok: true, result: { message_id: 1, chat: { id: 12345, type: "private" } } });
  it("sends one HTML request to the selected private chat", async () => {
    await sendTelegram(config, "message", async (input, init) => {
      const req = new Request(input, init);
      const body = await req.json();
      assert(req.url.endsWith("/sendMessage")); assert.equal(body.chat_id, config.chatId);
      assert.equal(body.parse_mode, "HTML"); assert.equal(body.link_preview_options.is_disabled, true);
      return ok();
    });
  });
  it("retries only explicit rate limits with bounded waits", async () => {
    let calls = 0; const delays: number[] = [];
    await sendTelegram(config, "message", async () => ++calls === 1
      ? Response.json({ ok: false, error_code: 429, parameters: { retry_after: 2 } }, { status: 429 }) : ok(), async ms => { delays.push(ms); });
    assert.equal(calls, 2); assert.deepEqual(delays, [2000]);
    for (const wait of [120, -1, "2", null]) {
      await assert.rejects(sendTelegram(config, "message", async () => Response.json({ ok: false, error_code: 429, parameters: { retry_after: wait } }, { status: 429 })), TelegramRejected);
    }
  });
  it("does not repeat ambiguous errors or print token-bearing remote errors", async () => {
    for (const response of [() => { throw new Error(config.token); }, () => new Response("invalid", { status: 502 }), () => Response.json({ ok: false }, { status: 500 }), () => Response.json({ ok: true })]) {
      let calls = 0;
      await assert.rejects(sendTelegram(config, "message", async () => { calls++; return response(); }), error => {
        assert(error instanceof TelegramUncertain); assert(!String(error).includes(config.token)); return true;
      });
      assert.equal(calls, 1);
    }
    await assert.rejects(sendTelegram(config, "message", async () => Response.json({ ok: false }, { status: 403 })), TelegramRejected);
  });
  it("rechecks freshness before retrying after a rate-limit wait", async () => {
    let calls = 0;
    let stale = false;
    await assert.rejects(sendTelegram(config, "message", async () => {
      calls++;
      return Response.json({ ok: false, error_code: 429, parameters: { retry_after: 1 } }, { status: 429 });
    }, async () => { stale = true; }, () => {
      if (stale) throw new TelegramRejected("stale after midnight");
    }), /stale after midnight/);
    assert.equal(calls, 1);
  });
  it("discovers only private chat IDs without exposing message contents", async () => {
    const ids = await discoverPrivateChats(config.token, async () => Response.json({ ok: true, result: [
      { message: { text: "private content", chat: { id: 12345, type: "private" } } },
      { message: { chat: { id: -10, type: "group" } } },
      { message: { chat: { id: 67890, type: "private" } } },
    ] }));
    assert.deepEqual(ids, ["12345", "67890"]);
  });
});

describe("Telegram durable delivery", () => {
  it("language changes cannot bypass sent or unresolved state; identity is canonical", async () => {
    const identities: string[] = [];
    for (const language of ["en", "zh-HK"] as const) {
      const store = new MemoryStore();
      const settings = { ...options(store), data: { ...data, brief: bilingualBrief }, language };
      await deliverBrief({ ...settings, send: async html => assert.equal(html, formatBrief(bilingualBrief, language).html) });
      identities.push(store.state.attempts[0].briefId);
      const changed = language === "en" ? "zh-HK" : "en";
      assert.match(await deliverBrief({ ...settings, language: changed, send: async () => assert.fail("duplicate") }), /already sent/);
      for (const status of ["pending", "uncertain"] as const) {
        store.state.attempts[0].status = status;
        await assert.rejects(deliverBrief({ ...settings, language: changed, send: async () => assert.fail("duplicate") }), /pending or uncertain/);
      }
    }
    assert.equal(identities[0], identities[1]);
    const store = new MemoryStore();
    await assert.rejects(deliverBrief({ ...options(store), language: "zh-CN" as SummaryLanguage }), /TELEGRAM_LANGUAGE/);
    assert.equal(store.revision, 0);
  });
  it("records pending before sending, then prevents repeat brief and same-day sends", async () => {
    const store = new MemoryStore(); let sends = 0;
    const send = async () => { sends++; assert.equal(store.state.attempts.at(-1)?.status, "pending"); };
    assert.equal(await deliverBrief({ ...options(store), send }), "Telegram: sent");
    assert.equal(await deliverBrief({ ...options(store), send }), "Telegram: skipped (already sent)");
    const different = { ...data, brief: { ...brief, generatedAt: "2026-09-06T06:30:00Z" } };
    assert.equal(await deliverBrief({ ...options(store), data: different, send }), "Telegram: skipped (already sent)");
    assert.equal(sends, 1);
  });
  it("skips disabled/stale before state writes or Telegram calls", async () => {
    const store = new MemoryStore(); store.failAt = 0;
    const send = async () => assert.fail("must not send");
    assert.match(await deliverBrief({ ...options(store), enabled: false, send }), /disabled/);
    assert.match(await deliverBrief({ ...options(store), now: () => NOW + 86400000, send }), /stale/);
    assert.equal(store.revision, 0);
  });
  it("treats a stale skip as a failed run, but a real or unnecessary send as success", async () => {
    const store = new MemoryStore();
    const send = async () => {};
    assert.equal(delivered(await deliverBrief({ ...options(store), send })), true);
    assert.equal(delivered(await deliverBrief({ ...options(store), send })), true, "already sent");
    assert.equal(delivered(await deliverBrief({ ...options(store), enabled: false, send })), true, "disabled");
    // The Sep 2026 silent failure: ingestion carried yesterday's brief forward,
    // delivery skipped it, and the run still exited 0.
    const stale = await deliverBrief({ ...options(new MemoryStore()), now: () => NOW + 86400000, send });
    assert.equal(delivered(stale), false, stale);
    for (const reason of ["no brief", "invalid brief timestamp", "stale brief", "future brief"]) {
      assert.equal(delivered(`Telegram: not sent (${reason})`), false);
    }
  });
  it("reports a quiet day instead of going silent, without restating old bullets", async () => {
    const store = new MemoryStore();
    const quiet = { ...data, briefStatus: "no-new-material" };
    const tomorrow = NOW + 86400000;
    let sent = "";
    const send = async (html: string) => { sent = html; };
    const outcome = await deliverBrief({ ...options(store), data: quiet, now: () => tomorrow, send });
    assert.equal(outcome, "Telegram: sent (no new brief)");
    assert.equal(delivered(outcome), true);
    assert.match(sent, /2026-09-07/, "dated today, not the carried brief's day");
    assert.doesNotMatch(sent, /Development 0/, "never restates yesterday's bullets as today's");
    assert.match(sent, /上一份摘要: 2026-09-06/);
    assert.equal(store.state.attempts.at(-1)?.status, "sent");
    assert.equal(
      await deliverBrief({ ...options(store), data: quiet, now: () => tomorrow, send }),
      "Telegram: skipped (already sent)",
    );
  });
  it("stays silent and fails when the brief call itself broke", async () => {
    const store = new MemoryStore();
    const broken = { ...data, briefStatus: "generation-failed" };
    const send = async () => assert.fail("must not send");
    const outcome = await deliverBrief({ ...options(store), data: broken, now: () => NOW + 86400000, send });
    assert.equal(outcome, "Telegram: skipped (stale brief)");
    assert.equal(delivered(outcome), false);
    assert.equal(store.revision, 0, "no state written for a failed run");
  });
  it("only one overlapping reservation can send", async () => {
    const store = new MemoryStore(); let calls = 0;
    const send = async () => { calls++; };
    const results = await Promise.allSettled([deliverBrief({ ...options(store), send }), deliverBrief({ ...options(store), send })]);
    assert.equal(calls, 1); assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(store.state.attempts[0].status, "sent");
  });
  it("reservation failure never sends; completion-write failure leaves pending", async () => {
    for (const revision of [0, 1]) {
      const store = new MemoryStore(); store.failAt = revision; let sends = 0;
      await assert.rejects(deliverBrief({ ...options(store), send: async () => { sends++; } }));
      assert.equal(sends, revision);
      if (revision === 1) {
        assert.equal(store.state.attempts[0].status, "pending");
        await assert.rejects(deliverBrief({ ...options(store), send: async () => assert.fail("duplicate") }), /pending/);
      }
    }
  });
  it("ambiguous delivery blocks subsequent days until exact-attempt recovery", async () => {
    const store = new MemoryStore();
    await assert.rejects(deliverBrief({ ...options(store), send: async () => { throw new TelegramUncertain("uncertain"); } }));
    assert.equal(store.state.attempts[0].status, "uncertain");
    const tomorrow = { ...data, brief: { ...brief, generatedAt: "2026-09-07T06:00:00Z" } };
    await assert.rejects(deliverBrief({ ...options(store), data: tomorrow, now: () => NOW + 86400000, send: async () => assert.fail("must wait") }), /pending or uncertain/);
    await assert.rejects(recoverAttempt(store, "wrong-id", "retry"));
    await recoverAttempt(store, store.state.attempts[0].id, "retry", NOW);
    assert.equal(store.state.attempts[0].status, "released");
    assert.equal(await deliverBrief({ ...options(store), send: async () => {} }), "Telegram: sent");
    await assert.rejects(recoverAttempt(store, store.state.attempts[1].id, "retry"));
  });
  it("known rejections become failed; recovery can confirm delivery", async () => {
    const store = new MemoryStore();
    await assert.rejects(deliverBrief({ ...options(store), send: async () => { throw new TelegramRejected("blocked"); } }));
    assert.equal(store.state.attempts[0].status, "failed");
    await assert.rejects(deliverBrief({ ...options(store), send: async () => { throw new Error("unknown"); } }));
    await recoverAttempt(store, store.state.attempts[1].id, "sent", NOW);
    assert.match(await deliverBrief({ ...options(store), send: async () => assert.fail("duplicate") }), /already sent/);
  });
  it("releases a reservation if midnight passes before sending", async () => {
    const store = new MemoryStore();
    let clock = Date.parse("2026-09-06T22:59:59Z");
    const save = store.save.bind(store);
    store.save = async (previous, next) => {
      const result = await save(previous, next);
      clock = Date.parse("2026-09-06T23:00:01Z");
      return result;
    };
    const result = await deliverBrief({ ...options(store), now: () => clock, send: async () => assert.fail("stale send") });
    assert.match(result, /stale/);
    assert.equal(store.state.attempts[0].status, "released");
  });
});
