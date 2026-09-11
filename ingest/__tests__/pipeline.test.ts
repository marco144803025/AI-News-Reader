import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import OpenAI from "openai";
import {
  loadExisting,
  loadIngestConfig,
  parsePositiveIntEnv,
  runIngest,
  validateFeeds,
  type ClassifyResult,
  type IngestDeps,
} from "../ingest.ts";
import type { CollectionResult, FeedOutcome } from "../feed-collection.ts";
import type { Article, Brief, NewsData, RawArticle } from "../../src/types.ts";
import type { Feed } from "../lib.ts";

// The whole pipeline, offline. collect/classify/generateBrief are injected, so
// this exercises the real selection, capacity, batching, merge and brief logic
// without an API key, a network call or a filesystem write.

const NOW = new Date("2026-09-11T06:00:00.000Z");

function makeFeeds(count: number): Feed[] {
  return Array.from({ length: count }, (_, i) => ({ name: `Source ${i}`, url: `https://example.com/s${i}/feed` }));
}

/**
 * Titles are deliberately two tokens long. The matcher needs at least six
 * shared tokens to consider a fuzzy merge, so fixtures can never collide by
 * accident and a capacity assertion stays a capacity assertion.
 */
function makeCandidates(feeds: Feed[], perFeed: number): RawArticle[] {
  const out: RawArticle[] = [];
  feeds.forEach((feed, s) => {
    for (let i = 0; i < perFeed; i += 1) {
      const n = s * perFeed + i;
      out.push({
        title: `Zeta${n} bulletin`,
        url: `https://example.com/s${s}/a${i}`,
        source: feed.name,
        publishedAt: new Date(NOW.getTime() - n * 60_000).toISOString(),
        snippet: `Artificial intelligence coverage number ${n}.`,
      });
    }
  });
  return out;
}

function okCollection(feeds: Feed[], candidates: RawArticle[]): CollectionResult {
  const outcomes: FeedOutcome[] = feeds.map((feed) => ({
    feed,
    status: "ok",
    items: candidates.filter((c) => c.source === feed.name),
    attempts: 1,
    fetchedAt: NOW.toISOString(),
  }));
  return { outcomes, counters: {} };
}

function classifyOk(batch: RawArticle[]): ClassifyResult[] {
  return batch.map((a) => ({
    category: "Applications",
    summary: `Summary of ${a.title}.`,
    summaryZhHK: `${a.title} 嘅摘要。`,
    important: false,
    tags: { topics: ["llm"], traits: ["release"], entities: ["openai"] },
  }));
}

function briefFor(input: Article[]): Brief {
  return {
    generatedAt: NOW.toISOString(),
    headline: "Test headline",
    bullets: input.slice(0, 3).map((a) => ({ text: `About ${a.title}.`, refs: [a.url] })),
  };
}

type Harness = {
  deps: IngestDeps;
  classifyCalls: RawArticle[][];
  logs: string[];
};

function harness(overrides: Partial<IngestDeps> & { feeds?: Feed[]; candidates?: RawArticle[] } = {}): Harness {
  const feeds = overrides.feeds ?? makeFeeds(20);
  const candidates = overrides.candidates ?? makeCandidates(feeds, 7);
  const classifyCalls: RawArticle[][] = [];
  const logs: string[] = [];
  const deps: IngestDeps = {
    feeds,
    config: { maxNewArticlesPerRun: 100, feedFailureWarningThreshold: 3 },
    retentionDays: 30,
    existing: null,
    now: NOW,
    collect: async () => okCollection(feeds, candidates),
    classify: async (batch) => {
      classifyCalls.push(batch);
      return classifyOk(batch);
    },
    generateBrief: async (input) => briefFor(input),
    log: {
      info: (line) => logs.push(line),
      warn: (line) => logs.push(line),
      error: (line) => logs.push(line),
    },
    // No real sleeping in tests.
    retry: { sleep: async () => {} },
    ...overrides,
  };
  return { deps, classifyCalls, logs };
}

test("P-1 the cap admits exactly the ceiling and makes no extra classifier call", async () => {
  const { deps, classifyCalls, logs } = harness();

  const out = await runIngest(deps);

  const summary = logs.find((l) => l.includes("admitted="));
  assert.ok(summary, "the run must log its selection summary");
  assert.match(summary!, /admitted=100/);
  assert.match(summary!, /capacitySkipped=40/);

  assert.equal(classifyCalls.length, 4, "100 admitted / 25 per batch = 4 calls, no fifth");
  assert.deepEqual(classifyCalls.map((b) => b.length), [25, 25, 25, 25]);
  assert.equal(out.articles.length, 100);

  const skipWarning = logs.find((l) => l.includes("exceeded MAX_NEW_ARTICLES_PER_RUN"));
  assert.ok(skipWarning, "skipped articles must be visible, not silently dropped");
});

test("P-1b round-robin spans every source when the cap permits", async () => {
  const { deps } = harness();
  const out = await runIngest(deps);
  const sources = new Set(out.articles.map((a) => a.source));
  assert.equal(sources.size, 20, "every non-empty source bucket contributes");
});

test("P-2 the runner constructs no model client and writes nothing", async () => {
  const feeds = makeFeeds(2);
  const { deps } = harness({ feeds, candidates: makeCandidates(feeds, 2) });
  const key = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  try {
    const out = await runIngest(deps);
    assert.equal(out.articles.length, 4);
  } finally {
    if (key !== undefined) process.env.DEEPSEEK_API_KEY = key;
  }
});

test("P-3 a batch that exhausts retries persists nothing from that batch", async () => {
  const feeds = makeFeeds(2);
  const candidates = makeCandidates(feeds, 20); // 40 candidates -> 2 batches
  const { deps, classifyCalls } = harness({ feeds, candidates });
  let call = 0;
  deps.classify = async (batch) => {
    call += 1;
    classifyCalls.push(batch);
    if (call <= 4) throw new OpenAI.APIConnectionError({ message: "upstream down" });
    return classifyOk(batch);
  };

  const out = await runIngest(deps);

  assert.equal(out.articles.length, 15, "the failed batch of 25 is dropped, the other 15 persist");
  assert.ok(
    out.articles.every((a) => a.summary.length > 0),
    "no unclassified representative may be stored"
  );
});

test("P-4 every feed failing leaves the archive intact and does not crash", async () => {
  const feeds = makeFeeds(3);
  const existing: NewsData = {
    generatedAt: "2026-09-10T06:00:00.000Z",
    daysBack: 1,
    categories: ["Applications"],
    articles: [
      {
        title: "Older story",
        url: "https://example.com/old/1",
        source: "Source 0",
        publishedAt: "2026-09-10T05:00:00.000Z",
        snippet: "old",
        category: "Applications",
        summary: "Old summary.",
        summaryZhHK: "舊摘要。",
      },
    ],
    briefStatus: "generated",
  };
  const { deps, classifyCalls } = harness({ feeds, existing });
  deps.collect = async () => ({
    outcomes: feeds.map((feed) => ({ feed, status: "failed" as const, error: "HTTP 503", attempts: 3 })),
    counters: {},
  });

  const out = await runIngest(deps);

  assert.equal(classifyCalls.length, 0, "no model call when nothing was collected");
  assert.equal(out.articles.length, 1, "the existing archive survives");
  assert.equal(out.feedHealth?.["Source 0"]?.consecutiveFailures, 1);
});

test("P-4b a deadline-cancelled feed keeps its previous health", async () => {
  const feeds = makeFeeds(2);
  const existing: NewsData = {
    generatedAt: "2026-09-10T06:00:00.000Z",
    daysBack: 1,
    categories: [],
    articles: [],
    feedHealth: {
      "Source 0": { lastSuccess: "2026-09-10T06:00:00.000Z", lastError: null, consecutiveFailures: 0 },
      "Source 1": { lastSuccess: null, lastError: "HTTP 500", consecutiveFailures: 2 },
    },
  };
  const { deps } = harness({ feeds, existing });
  deps.collect = async () => ({
    outcomes: [
      { feed: feeds[0], status: "cancelled" as const, attempts: 1 },
      { feed: feeds[1], status: "not-attempted" as const },
    ],
    counters: {},
  });

  const out = await runIngest(deps);

  assert.equal(out.feedHealth?.["Source 0"]?.consecutiveFailures, 0, "cancelled is not a failure");
  assert.equal(out.feedHealth?.["Source 1"]?.consecutiveFailures, 2, "not-attempted does not increment");
});

test("P-5 invalid configuration and a corrupt archive fail before any work", async () => {
  process.env.MAX_NEW_ARTICLES_PER_RUN = "0";
  try {
    assert.throws(() => loadIngestConfig(), /positive whole number/);
  } finally {
    delete process.env.MAX_NEW_ARTICLES_PER_RUN;
  }
  assert.equal(parsePositiveIntEnv("F13_UNSET_FOR_TEST", 7), 7, "an unset setting uses its documented default");

  assert.throws(() => validateFeeds([{ name: "a", url: "ftp://x/y" }]), /http or https/);
  assert.throws(() => validateFeeds([{ name: "a", url: "https://u:p@x/y" }]), /credentials/);
  assert.throws(
    () => validateFeeds([{ name: "a", url: "https://x/1" }, { name: "a", url: "https://x/2" }]),
    /duplicate feed name/
  );
  assert.throws(() => validateFeeds([{ name: "a", url: "https://x/1", scope: "weird" }]), /expected "ai" or "general"/);

  const dir = await mkdtemp(join(tmpdir(), "f13-"));
  try {
    const corrupt = join(dir, "news.json");
    await writeFile(corrupt, "{ not json", "utf-8");
    await assert.rejects(() => loadExisting(corrupt), /not valid JSON/);
    assert.equal(await loadExisting(join(dir, "missing.json")), null, "a missing archive is a first run");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("P-6 the same input run twice adds nothing the second time", async () => {
  const feeds = makeFeeds(3);
  const candidates = makeCandidates(feeds, 4);
  const first = harness({ feeds, candidates });
  const out1 = await runIngest(first.deps);

  const second = harness({ feeds, candidates, existing: out1 });
  const out2 = await runIngest(second.deps);

  assert.equal(second.classifyCalls.length, 0, "nothing new to classify on a repeat run");
  assert.equal(out2.articles.length, out1.articles.length, "no duplicated articles");
  const urls = out2.articles.map((a) => a.url);
  assert.equal(new Set(urls).size, urls.length, "no duplicated primary URLs");
  for (const article of out2.articles) {
    const extra = article.additionalSources ?? [];
    assert.equal(new Set(extra.map((s) => s.url)).size, extra.length, "no duplicated attribution");
  }
});

test("P-7 bilingual summaries, brief and status contracts survive the run", async () => {
  const feeds = makeFeeds(2);
  const { deps } = harness({ feeds, candidates: makeCandidates(feeds, 3) });

  const out = await runIngest(deps);

  assert.ok(
    out.articles.every((a) => typeof a.summaryZhHK === "string" && a.summaryZhHK.length > 0),
    "summaryZhHK must survive the shared-type unification"
  );
  assert.equal(out.briefStatus, "generated");
  assert.equal(out.brief?.headline, "Test headline");
  assert.ok(out.brief!.bullets.length >= 3);
  for (const bullet of out.brief!.bullets) {
    for (const ref of bullet.refs) {
      assert.ok(out.articles.some((a) => a.url === ref), "citations point at real archive URLs");
    }
  }
  assert.equal(out.feedFailureWarningThreshold, 3, "the browser needs the threshold in the payload");
  assert.equal(out.daysBack, 1);
});

test("P-7b a quiet day carries the previous brief forward", async () => {
  const feeds = makeFeeds(1);
  const existing: NewsData = {
    generatedAt: "2026-09-10T06:00:00.000Z",
    daysBack: 1,
    categories: [],
    articles: [],
    brief: { generatedAt: "2026-09-10T06:00:00.000Z", bullets: [{ text: "Yesterday.", refs: [] }] },
    briefStatus: "generated",
  };
  const { deps } = harness({ feeds, candidates: [], existing });

  const out = await runIngest(deps);

  assert.equal(out.briefStatus, "no-new-material");
  assert.equal(out.brief?.bullets[0].text, "Yesterday.", "the previous brief is carried, not fabricated");
  assert.equal(out.generatedAt, existing.generatedAt, "a run with no new material keeps its timestamp");
});
