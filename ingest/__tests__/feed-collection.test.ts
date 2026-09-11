import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type Parser from "rss-parser";
import type { FeedHealth } from "../../src/types.ts";
import type { Feed } from "../lib.ts";
import { FeedFetchError, type fetchFeed } from "../feeds.ts";
import { abortableSleep, collectFeeds, feedHealthFromOutcomes } from "../feed-collection.ts";
import { previewSources } from "../preview-sources.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const NOW = new Date("2026-09-11T12:00:00.000Z");
const FRESH = "2026-09-11T10:00:00.000Z";

function feedItem(title: string, link: string, isoDate = FRESH): Parser.Item {
  return { title, link, isoDate, contentSnippet: "An AI model release from OpenAI." };
}

function output(items: Parser.Item[]): Parser.Output<Parser.Item> {
  return { items } as Parser.Output<Parser.Item>;
}

/** One scripted response per attempt; the last entry repeats. */
type Step =
  | { ok: Parser.Output<Parser.Item> }
  | { throws: unknown }
  | { hangs: true };

type Harness = {
  fetchFeed: typeof fetchFeed;
  sleeps: number[];
  logs: string[];
  calls: string[];
  maxConcurrent: number;
};

function harness(script: Record<string, Step[]>, holdMs = 0): Harness {
  const attempts: Record<string, number> = {};
  const state: Harness = {
    sleeps: [],
    logs: [],
    calls: [],
    maxConcurrent: 0,
    fetchFeed: undefined as unknown as typeof fetchFeed,
  };
  let inFlight = 0;

  state.fetchFeed = async (url, _timeoutMs, options) => {
    const steps = script[url];
    assert.ok(steps, `no scripted response for ${url}`);
    const index = attempts[url] ?? 0;
    attempts[url] = index + 1;
    state.calls.push(url);
    inFlight++;
    state.maxConcurrent = Math.max(state.maxConcurrent, inFlight);
    try {
      const step = steps[Math.min(index, steps.length - 1)];
      if ("hangs" in step) {
        return await new Promise<Parser.Output<Parser.Item>>((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new FeedFetchError("Request cancelled by caller", { kind: "aborted" })),
            { once: true },
          );
        });
      }
      if (holdMs > 0) await new Promise((r) => setTimeout(r, holdMs));
      if ("throws" in step) throw step.throws;
      return step.ok;
    } finally {
      inFlight--;
    }
  };
  return state;
}

function collect(feeds: Feed[], state: Harness, extra: { workers?: number; deadlineMs?: number } = {}) {
  return collectFeeds({
    feeds,
    now: NOW,
    daysBack: 1,
    fetchFeed: state.fetchFeed,
    sleep: async (ms: number) => {
      state.sleeps.push(ms);
    },
    log: (line) => state.logs.push(line),
    ...extra,
  });
}

const transportError = (): FeedFetchError => new FeedFetchError("fetch failed", { kind: "transport" });
const httpError = (status: number, retryAfterMs?: number): FeedFetchError =>
  new FeedFetchError(`HTTP ${status}`, { kind: "http", status, retryAfterMs });

const priorHealth = (consecutiveFailures: number): Record<string, FeedHealth> => ({
  A: { lastSuccess: "2026-09-09T00:00:00.000Z", lastError: "HTTP 503", consecutiveFailures },
});

describe("collectFeeds retries and outcomes", () => {
  it("C-1 retries a transient failure, succeeds, and resets health", async () => {
    const feeds: Feed[] = [{ name: "A", url: "https://a.test/feed" }];
    const state = harness({
      "https://a.test/feed": [{ throws: transportError() }, { ok: output([feedItem("One", "https://a.test/1")]) }],
    });

    const result = await collect(feeds, state);
    const outcome = result.outcomes[0];

    assert.equal(outcome.status, "ok");
    assert.equal(outcome.attempts, 2);
    assert.deepEqual(state.sleeps, [1_000]);
    assert.equal(result.counters.A.eligible, 1);
    assert.equal(result.counters.A.attempts, 2);

    const health = feedHealthFromOutcomes(result.outcomes, priorHealth(2));
    assert.deepEqual(health.A, {
      lastSuccess: NOW.toISOString(),
      lastError: null,
      consecutiveFailures: 0,
    });
    assert.match(state.logs[0], /^feed "A" ok attempts=2 fetched=1 eligible=1 /);
    assert.match(state.logs[0], /\(retried after transport error\)$/);
  });

  it("C-2 gives up after three transient failures and increments health exactly once", async () => {
    const feeds: Feed[] = [{ name: "A", url: "https://a.test/feed" }];
    const state = harness({ "https://a.test/feed": [{ throws: httpError(503) }] });

    const result = await collect(feeds, state);
    const outcome = result.outcomes[0];

    assert.equal(outcome.status, "failed");
    assert.equal(outcome.attempts, 3);
    assert.deepEqual(state.sleeps, [1_000, 2_000]);

    const health = feedHealthFromOutcomes(result.outcomes, priorHealth(2));
    assert.equal(health.A.consecutiveFailures, 3, "three attempts are one run, so health moves by one");
    assert.equal(health.A.lastError, "HTTP 503");
    assert.equal(health.A.lastSuccess, "2026-09-09T00:00:00.000Z");
    assert.deepEqual(state.logs.slice(0, 1), ['feed "A" failed attempts=3 error=HTTP 503']);
  });

  it("C-3 treats HTTP 404, 401, 403 and unparseable bodies as terminal after one attempt", async () => {
    const feeds: Feed[] = [
      { name: "A", url: "https://a.test/feed" },
      { name: "B", url: "https://b.test/feed" },
      { name: "C", url: "https://c.test/feed" },
      { name: "D", url: "https://d.test/feed" },
    ];
    const state = harness({
      "https://a.test/feed": [{ throws: httpError(404) }],
      "https://b.test/feed": [{ throws: httpError(401) }],
      "https://c.test/feed": [{ throws: httpError(403) }],
      "https://d.test/feed": [{ throws: new FeedFetchError("Unparseable feed: bad XML", { kind: "parse" }) }],
    });

    const result = await collect(feeds, state);

    for (const outcome of result.outcomes) {
      assert.equal(outcome.status, "failed", `${outcome.feed.name} should fail terminally`);
      assert.equal(outcome.attempts, 1, `${outcome.feed.name} must not be retried`);
    }
    assert.deepEqual(state.sleeps, []);
  });

  it("C-4 stops retrying when Retry-After exceeds the budget instead of waiting", async () => {
    const feeds: Feed[] = [{ name: "A", url: "https://a.test/feed" }];
    const state = harness({ "https://a.test/feed": [{ throws: httpError(429, 60_000) }] });

    const result = await collect(feeds, state);
    const outcome = result.outcomes[0];

    assert.equal(outcome.status, "failed");
    assert.equal(outcome.attempts, 1);
    assert.deepEqual(state.sleeps, [], "a 60s Retry-After is past the 30s cap, so nothing is slept");
    assert.equal(outcome.status === "failed" && outcome.error, "HTTP 429 (no retry budget for a 60s wait)");
  });

  it("C-4b honours a Retry-After inside the cap", async () => {
    const feeds: Feed[] = [{ name: "A", url: "https://a.test/feed" }];
    const state = harness({
      "https://a.test/feed": [{ throws: httpError(429, 5_000) }, { ok: output([]) }],
    });

    const result = await collect(feeds, state);

    assert.equal(result.outcomes[0].status, "ok");
    assert.deepEqual(state.sleeps, [5_000], "the server's own delay replaces the default backoff");
  });

  it("C-5 marks in-flight feeds cancelled and unstarted feeds not-attempted, leaving health untouched", async () => {
    const feeds: Feed[] = [
      { name: "A", url: "https://a.test/feed" },
      { name: "B", url: "https://b.test/feed" },
      { name: "C", url: "https://c.test/feed" },
      { name: "D", url: "https://d.test/feed" },
    ];
    const state = harness({
      "https://a.test/feed": [{ hangs: true }],
      "https://b.test/feed": [{ hangs: true }],
      "https://c.test/feed": [{ ok: output([]) }],
      "https://d.test/feed": [{ ok: output([]) }],
    });

    const result = await collect(feeds, state, { workers: 2, deadlineMs: 30 });

    assert.deepEqual(
      result.outcomes.map((o) => o.status),
      ["cancelled", "cancelled", "not-attempted", "not-attempted"],
    );
    assert.deepEqual(state.calls.sort(), ["https://a.test/feed", "https://b.test/feed"], "nothing new is launched");

    const previous: Record<string, FeedHealth> = {
      A: { lastSuccess: "2026-09-10T00:00:00.000Z", lastError: null, consecutiveFailures: 0 },
      B: { lastSuccess: null, lastError: "HTTP 500", consecutiveFailures: 2 },
      C: { lastSuccess: "2026-09-08T00:00:00.000Z", lastError: null, consecutiveFailures: 0 },
      D: { lastSuccess: null, lastError: "boom", consecutiveFailures: 1 },
    };
    const health = feedHealthFromOutcomes(result.outcomes, previous);
    assert.deepEqual(health, previous, "a deadline is not a publisher failure");
    assert.ok(state.logs.some((l) => l.includes('feed "A" cancelled attempts=1 (collection deadline, health unchanged)')));
    assert.ok(state.logs.some((l) => l.includes('feed "C" not-attempted (collection deadline, health unchanged)')));
  });

  it("C-6 does not reclassify parent cancellation as a retryable transport error", async () => {
    const feeds: Feed[] = [{ name: "A", url: "https://a.test/feed" }];
    const state = harness({ "https://a.test/feed": [{ hangs: true }] });

    const result = await collect(feeds, state, { workers: 1, deadlineMs: 20 });
    const outcome = result.outcomes[0];

    assert.equal(outcome.status, "cancelled");
    assert.equal(outcome.attempts, 1, "cancellation must not spend the retry budget");
    assert.deepEqual(state.sleeps, [], "no backoff is scheduled for a cancellation");
    assert.equal(state.calls.length, 1);
    assert.equal(
      feedHealthFromOutcomes(result.outcomes, priorHealth(2)).A.consecutiveFailures,
      2,
    );
  });

  it("C-7 returns outcomes in configuration order whatever the completion order", async () => {
    const feeds: Feed[] = ["A", "B", "C", "D", "E", "F"].map((name) => ({
      name,
      url: `https://${name.toLowerCase()}.test/feed`,
    }));
    const logs: string[] = [];
    const delays: Record<string, number> = { A: 25, B: 5, C: 15, D: 0, E: 20, F: 10 };

    const result = await collectFeeds({
      feeds,
      now: NOW,
      daysBack: 1,
      fetchFeed: async (url) => {
        const name = url.slice("https://".length, url.indexOf(".test"));
        await new Promise((r) => setTimeout(r, delays[name.toUpperCase()]));
        return output([feedItem(`${name} story`, `${url}/1`)]);
      },
      sleep: async () => {},
      log: (line) => logs.push(line),
    });

    assert.deepEqual(
      result.outcomes.map((o) => o.feed.name),
      ["A", "B", "C", "D", "E", "F"],
    );
    assert.ok(result.outcomes.every((o) => o.status === "ok"));
  });

  it("C-8 counts an empty but successfully parsed feed as ok", async () => {
    const feeds: Feed[] = [{ name: "A", url: "https://a.test/feed" }];
    const state = harness({ "https://a.test/feed": [{ ok: output([]) }] });

    const result = await collect(feeds, state);

    assert.equal(result.outcomes[0].status, "ok");
    assert.equal(result.counters.A.eligible, 0);
    assert.equal(
      feedHealthFromOutcomes(result.outcomes, priorHealth(4)).A.consecutiveFailures,
      0,
    );
  });

  it("C-9 keeps at most four requests in flight", async () => {
    const feeds: Feed[] = Array.from({ length: 12 }, (_v, i) => ({
      name: `F${i}`,
      url: `https://f${i}.test/feed`,
    }));
    const script: Record<string, Step[]> = {};
    for (const feed of feeds) script[feed.url] = [{ ok: output([]) }];
    const state = harness(script, 5);

    await collect(feeds, state, { deadlineMs: 10_000 });

    assert.equal(state.maxConcurrent, 4);
    assert.equal(state.calls.length, 12);
  });

  it("logs one summary line for the whole stage", async () => {
    const feeds: Feed[] = [
      { name: "A", url: "https://a.test/feed" },
      { name: "B", url: "https://b.test/feed" },
    ];
    const state = harness({
      "https://a.test/feed": [{ ok: output([]) }],
      "https://b.test/feed": [{ throws: httpError(404) }],
    });

    await collect(feeds, state);

    assert.match(
      state.logs.at(-1) ?? "",
      /^collection: 2 feeds, 1 ok, 1 failed, 0 cancelled, 0 not-attempted, \d+s$/,
    );
  });
});

describe("collectFeeds item filtering", () => {
  it("skips items that are missing, unparseable or far-future dated instead of restamping them", async () => {
    const feeds: Feed[] = [{ name: "A", url: "https://a.test/feed" }];
    const state = harness({
      "https://a.test/feed": [
        {
          ok: output([
            feedItem("Fresh", "https://a.test/1"),
            { title: "No date", link: "https://a.test/2" },
            { title: "Junk date", link: "https://a.test/3", isoDate: "not a date" },
            feedItem("Stale", "https://a.test/4", "2026-09-01T00:00:00.000Z"),
            feedItem("From the future", "https://a.test/5", "2026-09-12T12:00:00.000Z"),
            { title: "", link: "https://a.test/6", isoDate: FRESH },
          ]),
        },
      ],
    });

    const result = await collect(feeds, state);
    const outcome = result.outcomes[0];

    assert.equal(outcome.status, "ok");
    assert.deepEqual(outcome.status === "ok" && outcome.items.map((i) => i.title), ["Fresh"]);
    assert.equal(result.counters.A.excludedDate, 4);
    assert.equal(result.counters.A.fetched, 6);
    assert.match(state.logs[0], /malformed=1/);
    assert.equal(
      outcome.status === "ok" && outcome.items[0].publishedAt,
      FRESH,
      "the item keeps its own publish date",
    );
  });

  it("applies the topical filter to general feeds only", async () => {
    const feeds: Feed[] = [
      { name: "General", url: "https://g.test/feed", scope: "general" },
      { name: "AI Desk", url: "https://ai.test/feed" },
    ];
    const offTopic: Parser.Item = {
      title: "Rain expected across the north on Tuesday",
      link: "https://g.test/2",
      isoDate: FRESH,
      contentSnippet: "The weather service issued a yellow warning for travel.",
    };
    const state = harness({
      "https://g.test/feed": [
        {
          ok: output([
            {
              title: "OpenAI ships a new large language model",
              link: "https://g.test/1",
              isoDate: FRESH,
              contentSnippet: "The company says the model is faster.",
            },
            offTopic,
          ]),
        },
      ],
      "https://ai.test/feed": [{ ok: output([{ ...offTopic, link: "https://ai.test/2" }]) }],
    });

    const result = await collect(feeds, state);

    assert.equal(result.counters.General.eligible, 1);
    assert.equal(result.counters.General.excludedTopical, 1);
    assert.equal(result.counters["AI Desk"].eligible, 1, "an ai-scope feed bypasses the topical filter");
    assert.equal(result.counters["AI Desk"].excludedTopical, 0);
  });

  it("keeps the arXiv relevance filter and the cap of 15", async () => {
    const feeds: Feed[] = [{ name: "arXiv cs.AI", url: "https://arxiv.test/feed" }];
    const items: Parser.Item[] = [
      {
        title: "A study of soil composition",
        link: "https://arxiv.test/soil",
        isoDate: FRESH,
        contentSnippet: "Field samples from three regions.",
      },
    ];
    for (let i = 0; i < 20; i++) {
      items.push({
        title: `Agent reasoning benchmark ${i}`,
        link: `https://arxiv.test/${i}`,
        isoDate: FRESH,
        contentSnippet: "We evaluate an llm agent.",
      });
    }
    const state = harness({ "https://arxiv.test/feed": [{ ok: output(items) }] });

    const result = await collect(feeds, state);
    const outcome = result.outcomes[0];

    assert.equal(outcome.status === "ok" && outcome.items.length, 15);
    assert.equal(result.counters["arXiv cs.AI"].excludedTopical, 1);
    assert.match(state.logs[0], /arxivTrimmed=5/);
  });
});

describe("abortableSleep", () => {
  it("resolves after the delay and rejects as soon as the signal aborts", async () => {
    await abortableSleep(1);

    const controller = new AbortController();
    const pending = abortableSleep(10_000, controller.signal);
    controller.abort(new Error("deadline"));
    await assert.rejects(pending, /deadline/);

    await assert.rejects(abortableSleep(1, AbortSignal.abort(new Error("already gone"))), /already gone/);
  });
});

describe("preview-sources safety", () => {
  const previewFeeds: Feed[] = [
    { name: "Alpha", url: "https://alpha.test/feed" },
    { name: "Beta", url: "https://beta.test/feed" },
  ];

  function previewHarness(): Harness {
    return harness({
      "https://alpha.test/feed": [
        {
          ok: output([
            feedItem("Alpha one", "https://alpha.test/1"),
            feedItem("Alpha two", "https://alpha.test/2"),
          ]),
        },
      ],
      "https://beta.test/feed": [{ throws: httpError(404) }],
    });
  }

  it("prints per-source counts and bounded samples without a key or a model client", async () => {
    const saved = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    const state = previewHarness();
    try {
      // A model client cannot be built without a key, so completing the run at
      // all is proof that the preview never tried.
      const result = await previewSources({
        feeds: previewFeeds,
        now: NOW,
        daysBack: 1,
        fetchFeed: state.fetchFeed,
        sleep: async (ms: number) => {
          state.sleeps.push(ms);
        },
        log: (line) => state.logs.push(line),
        samplesPerSource: 1,
      });
      assert.equal(result.counters.Alpha.eligible, 2);
    } finally {
      if (saved !== undefined) process.env.DEEPSEEK_API_KEY = saved;
    }

    const report = state.logs.join("\n");
    assert.match(report, /Alpha\s+ok\s+1\s+2\s+0\s+0/);
    assert.match(report, /Beta\s+failed/);
    assert.match(report, /- Alpha one/);
    assert.doesNotMatch(report, /- Alpha two/, "samples are bounded");
    assert.match(report, /error: HTTP 404/);
  });

  it("writes nothing to disk", async () => {
    const before = await manifest();
    const state = previewHarness();
    await previewSources({
      feeds: previewFeeds,
      now: NOW,
      daysBack: 1,
      fetchFeed: state.fetchFeed,
      sleep: async () => {},
      log: () => {},
    });
    assert.deepEqual(await manifest(), before);
  });

  it("loads no secrets and imports no filesystem write API anywhere in its graph", async () => {
    const graph = await moduleGraph(join(ROOT, "ingest", "preview-sources.ts"));
    assert.ok(graph.size > 3, "the graph walk must actually follow relative imports");

    for (const [file, source] of graph) {
      assert.doesNotMatch(source, /["']dotenv/, `${file} must not load secrets`);
      assert.doesNotMatch(
        source,
        /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdir|mkdirSync|unlink|rename)\s*\(/,
        `${file} must not write to disk`,
      );
    }

    const entry = graph.get(join(ROOT, "ingest", "preview-sources.ts")) ?? "";
    assert.doesNotMatch(entry, /createDeepSeekClient|new OpenAI|DEEPSEEK_API_KEY|\.\/ingest\.ts/);
  });
});

/**
 * Size and mtime of the outputs an ingest run owns, plus the listing of the
 * published directory so a newly created file is caught too.
 */
async function manifest(): Promise<string[]> {
  const targets = [join(ROOT, "feeds.json"), join(ROOT, "public", "news.json")];
  const entries: string[] = [];
  for (const path of targets.sort()) {
    try {
      const info = await stat(path);
      entries.push(`${path} ${info.size} ${info.mtimeMs}`);
    } catch {
      entries.push(`${path} missing`);
    }
  }
  entries.push((await readdir(join(ROOT, "public")).catch(() => [])).sort().join(","));
  return entries;
}

/** Every local module reachable from `entry`, mapped to its source text. */
async function moduleGraph(entry: string): Promise<Map<string, string>> {
  const seen = new Map<string, string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    const source = await readFile(file, "utf-8");
    seen.set(file, source);
    for (const match of source.matchAll(/from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g)) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith(".")) continue;
      queue.push(resolve(dirname(file), specifier));
    }
  }
  return seen;
}
