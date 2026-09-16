import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
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

  // Snapshot every file the pipeline could plausibly touch, so "writes nothing"
  // is asserted rather than merely claimed.
  const watched = ["public/news.json", "feeds.json", ".delivery/telegram.json"];
  const snapshot = async () =>
    Promise.all(
      watched.map(async (rel) => {
        try {
          const s = await stat(join(ROOT, rel));
          return `${rel}:${s.size}:${s.mtimeMs}`;
        } catch {
          return `${rel}:absent`;
        }
      })
    );
  const before = await snapshot();

  const key = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  try {
    const out = await runIngest(deps);
    assert.equal(out.articles.length, 4, "the run completes with no key present");
  } finally {
    if (key !== undefined) process.env.DEEPSEEK_API_KEY = key;
  }

  assert.deepEqual(await snapshot(), before, "runIngest must not touch any file");
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
  // Three feeds, one of which completes: a run where EVERY feed stalls is a
  // total collection failure and is asserted separately in P-4c.
  const feeds = makeFeeds(3);
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
      { feed: feeds[2], status: "ok" as const, items: [], attempts: 1, fetchedAt: NOW.toISOString() },
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

test("F15 logs balanced brief composition and makes one synthesis call", async () => {
  const feeds = makeFeeds(2);
  const candidates = makeCandidates(feeds, 4);
  const briefInputs: Article[][] = [];
  const { deps, logs } = harness({ feeds, candidates });

  deps.classify = async (batch) => batch.map((article) => ({
    category: article.url.endsWith("a0") || article.url.endsWith("a1") || article.url.endsWith("a2")
      ? "Research"
      : article.url.endsWith("a3")
        ? "Applications"
        : "MCP",
    summary: `Summary of ${article.title}.`,
    summaryZhHK: `${article.title} 嘅摘要。`,
    important: false,
    tags: { topics: ["llm"], traits: ["release"], entities: ["openai"] },
  }));
  deps.generateBrief = async (input) => {
    briefInputs.push(input);
    return briefFor(input);
  };

  const out = await runIngest(deps);

  const compositionIndex = logs.findIndex((line) => line.startsWith("Brief input:"));
  const generationIndex = logs.findIndex((line) => line.startsWith("Generating daily brief"));
  assert.notEqual(compositionIndex, -1, "brief composition must be logged");
  assert.ok(compositionIndex < generationIndex, "composition must be logged before generation");
  assert.match(logs[compositionIndex], /candidates -> \d+ selected/);
  assert.match(logs[compositionIndex], /categories .*Research=/);
  assert.match(logs[compositionIndex], /sources .*Source/);
  assert.equal(briefInputs.length, 1, "balancing must not add a model call");
  assert.ok(briefInputs[0].length >= 3, "the model receives a valid minimum input");
  assert.ok(
    briefInputs[0].every((selected) => out.articles.some((article) => article.url === selected.url)),
    "the model receives articles from the output archive"
  );
  assert.equal(out.briefStatus, "generated");
});

// ---------------------------------------------------------------------------
// Integration-review follow-ups. The reviewer showed that P-6's attribution
// assertion was vacuous: its fixture titles each carry a unique numeric token,
// so no two candidates can ever match and every article had no attribution at
// all. These exercise the merge path P-6 was meant to cover.
// ---------------------------------------------------------------------------

test("P-6b an archived article that gains attribution does not gain it twice", async () => {
  const feeds: Feed[] = [
    { name: "Source A", url: "https://a.example/feed" },
    { name: "Source B", url: "https://b.example/feed" },
  ];
  const shared = "Regulators open a formal consultation into frontier model evaluation duties";
  const archived: Article = {
    title: shared,
    url: "https://a.example/story/1",
    source: "Source A",
    publishedAt: "2026-09-11T05:00:00.000Z",
    snippet: "",
    category: "Regulation & Policy",
    summary: "Summary.",
    summaryZhHK: "摘要。",
  };
  const existing: NewsData = {
    generatedAt: "2026-09-11T05:30:00.000Z",
    daysBack: 1,
    categories: ["Regulation & Policy"],
    articles: [archived],
    briefStatus: "generated",
  };
  // Source B reports the same story, under a link that varies between runs.
  const candidate = (param: string): RawArticle => ({
    title: shared,
    url: `https://b.example/story/1?${param}`,
    source: "Source B",
    publishedAt: "2026-09-11T05:15:00.000Z",
    snippet: "",
  });

  const run1 = harness({ feeds, candidates: [candidate("ref=home")], existing });
  const out1 = await runIngest(run1.deps);
  const merged1 = out1.articles.find((a) => a.url === archived.url);
  assert.ok(merged1, "the archived article survives the merge");
  assert.equal(merged1!.additionalSources?.length, 1, "Source B is credited once");
  assert.equal(merged1!.summaryZhHK, "摘要。", "its Chinese summary is untouched");

  const run2 = harness({ feeds, candidates: [candidate("ref=newsletter")], existing: out1 });
  const out2 = await runIngest(run2.deps);
  const merged2 = out2.articles.find((a) => a.url === archived.url);
  assert.equal(out2.articles.length, 1, "no duplicate card on the second run");
  assert.equal(run2.classifyCalls.length, 0, "and no second paid classification");
  assert.equal(
    merged2!.additionalSources?.length,
    1,
    "attribution must not grow on a re-run (Constitution rule 2)"
  );
});

test("P-3b a failed batch does not discard attribution added to existing articles", async () => {
  const feeds: Feed[] = [
    { name: "Source A", url: "https://a.example/feed" },
    { name: "Source B", url: "https://b.example/feed" },
  ];
  const shared = "Regulators open a formal consultation into frontier model evaluation duties";
  const existing: NewsData = {
    generatedAt: "2026-09-11T05:30:00.000Z",
    daysBack: 1,
    categories: ["Regulation & Policy"],
    articles: [
      {
        title: shared,
        url: "https://a.example/story/1",
        source: "Source A",
        publishedAt: "2026-09-11T05:00:00.000Z",
        snippet: "",
        category: "Regulation & Policy",
        summary: "Summary.",
      },
    ],
    briefStatus: "generated",
  };
  const candidates: RawArticle[] = [
    { title: shared, url: "https://b.example/story/1", source: "Source B", publishedAt: "2026-09-11T05:15:00.000Z", snippet: "" },
    { title: "Zeta900 bulletin", url: "https://b.example/story/2", source: "Source B", publishedAt: "2026-09-11T05:20:00.000Z", snippet: "" },
  ];
  const { deps } = harness({ feeds, candidates, existing });
  deps.classify = async () => {
    throw new OpenAI.APIConnectionError({ message: "upstream down" });
  };

  const out = await runIngest(deps);

  assert.equal(out.articles.length, 1, "the unclassified new article is not persisted");
  assert.equal(
    out.articles[0].additionalSources?.length,
    1,
    "but attribution earned by an existing article survives the failed batch"
  );
});

test("P-4c a collection that stalls entirely fails the run instead of looking quiet", async () => {
  const feeds = makeFeeds(3);
  const { deps } = harness({ feeds });
  deps.collect = async () => ({
    outcomes: [
      { feed: feeds[0], status: "cancelled" as const, attempts: 1 },
      { feed: feeds[1], status: "not-attempted" as const },
      { feed: feeds[2], status: "not-attempted" as const },
    ],
    counters: {},
  });

  await assert.rejects(
    () => runIngest(deps),
    /deadline before any feed completed/,
    "a total collection failure must be visible, not a quiet day"
  );
});

test("P-4d a partial stall is warned about but does not fail the run", async () => {
  const feeds = makeFeeds(2);
  const candidates = makeCandidates(feeds, 2);
  const { deps, logs } = harness({ feeds, candidates });
  deps.collect = async () => ({
    outcomes: [
      { feed: feeds[0], status: "ok" as const, items: candidates.filter((c) => c.source === feeds[0].name), attempts: 1, fetchedAt: NOW.toISOString() },
      { feed: feeds[1], status: "cancelled" as const, attempts: 1 },
    ],
    counters: {},
  });

  const out = await runIngest(deps);

  assert.equal(out.articles.length, 2, "the feed that did complete still contributes");
  assert.ok(
    logs.some((l) => l.includes("cut short by the collection")),
    "the stalled feed is disclosed, not silently frozen"
  );
});
