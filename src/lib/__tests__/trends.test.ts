import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeTrends,
  DEFAULT_FAILURE_WARNING_THRESHOLD,
  FAILING_THRESHOLD,
  feedIssues,
  feedWarnings,
  isPersistentFailure,
} from "../trends.ts";
import type { Article, FeedHealth } from "../../types.ts";

const NOW = Date.parse("2026-07-02T12:00:00Z");
const DAY = 86_400_000;

function makeArticle(
  url: string,
  daysAgo: number,
  topics: string[] = [],
  entities: string[] = [],
  category = "Research"
): Article {
  return {
    title: "T",
    url,
    source: "src",
    publishedAt: new Date(NOW - daysAgo * DAY).toISOString(),
    snippet: "",
    category,
    summary: "S",
    tags: { topics, traits: [], entities },
  };
}

describe("computeTrends", () => {
  it("computes rising and falling topics over 7d vs prior 7d", () => {
    const articles = [
      // "agents": 3 this week, 0 last week → rising
      makeArticle("a1", 1, ["agents"]),
      makeArticle("a2", 2, ["agents"]),
      makeArticle("a3", 3, ["agents"]),
      // "vision": 0 this week, 3 last week → falling
      makeArticle("b1", 8, ["vision"]),
      makeArticle("b2", 9, ["vision"]),
      makeArticle("b3", 10, ["vision"]),
      // "llm": 1 vs 1 → flat, and below MIN_TAG_COUNT anyway
      makeArticle("c1", 1, ["llm"]),
      makeArticle("c2", 8, ["llm"]),
      // very old article — outside both windows
      makeArticle("d1", 20, ["agents"]),
    ];
    const t = computeTrends(articles, NOW);
    assert.deepEqual(t.rising, [
      { tag: "agents", current: 3, previous: 0, delta: 3 },
    ]);
    assert.deepEqual(t.falling, [
      { tag: "vision", current: 0, previous: 3, delta: -3 },
    ]);
  });

  it("counts entities over the last 7 days only", () => {
    const t = computeTrends(
      [
        makeArticle("a", 1, [], ["anthropic"]),
        makeArticle("b", 2, [], ["anthropic", "openai"]),
        makeArticle("c", 9, [], ["anthropic"]),
      ],
      NOW
    );
    assert.deepEqual(t.entities, [
      { tag: "anthropic", count: 2 },
      { tag: "openai", count: 1 },
    ]);
  });

  it("buckets volume per UTC day with zero-filled gaps", () => {
    const t = computeTrends(
      [makeArticle("a", 0), makeArticle("b", 2), makeArticle("c", 2)],
      NOW
    );
    assert.equal(t.volume.length, 3);
    assert.deepEqual(
      t.volume.map((v) => v.count),
      [2, 0, 1]
    );
    assert.equal(t.volume[0].date, "2026-06-30");
  });

  it("computes category share sorted by count", () => {
    const t = computeTrends(
      [
        makeArticle("a", 1, [], [], "MCP"),
        makeArticle("b", 1, [], [], "Research"),
        makeArticle("c", 2, [], [], "Research"),
      ],
      NOW
    );
    assert.deepEqual(t.categoryShare, [
      { category: "Research", count: 2 },
      { category: "MCP", count: 1 },
    ]);
  });

  it("flags insufficient history under 14 days and skips bad dates", () => {
    const thin = computeTrends(
      [makeArticle("a", 3), { ...makeArticle("x", 1), publishedAt: "garbage" }],
      NOW
    );
    assert.equal(thin.sufficientHistory, false);
    const deep = computeTrends(
      [makeArticle("a", 1), makeArticle("b", 15)],
      NOW
    );
    assert.equal(deep.sufficientHistory, true);
    assert.equal(computeTrends([], NOW).volume.length, 0);
  });
});

describe("feedIssues", () => {
  const health: Record<string, FeedHealth> = {
    Good: { lastSuccess: "2026-07-02", lastError: null, consecutiveFailures: 0 },
    Flaky: { lastSuccess: "2026-07-01", lastError: "timeout", consecutiveFailures: 1 },
    Dead: { lastSuccess: "2026-06-20", lastError: "404", consecutiveFailures: 5 },
    Dying: { lastSuccess: "2026-06-30", lastError: "500", consecutiveFailures: FAILING_THRESHOLD },
  };

  it("returns only feeds at or above the threshold, worst first", () => {
    assert.deepEqual(
      feedIssues(health).map((i) => i.name),
      ["Dead", "Dying"]
    );
  });

  it("handles missing health records", () => {
    assert.deepEqual(feedIssues(undefined), []);
  });
});

describe("persistent feed failures", () => {
  const health: Record<string, FeedHealth> = {
    Good: { lastSuccess: "2026-07-02", lastError: null, consecutiveFailures: 0 },
    Flaky: { lastSuccess: "2026-07-01", lastError: "timeout", consecutiveFailures: 1 },
    Dead: { lastSuccess: "2026-06-20", lastError: "404", consecutiveFailures: 5 },
    Dying: { lastSuccess: "2026-06-30", lastError: "500", consecutiveFailures: 2 },
  };

  it("is a pure predicate over two numbers", () => {
    assert.equal(isPersistentFailure(3, DEFAULT_FAILURE_WARNING_THRESHOLD), true);
    assert.equal(isPersistentFailure(2, DEFAULT_FAILURE_WARNING_THRESHOLD), false);
    assert.equal(isPersistentFailure(1, 1), true);
    assert.equal(isPersistentFailure(0, 1), false);
    assert.equal(isPersistentFailure(0, 0), false);
    assert.equal(isPersistentFailure(Number.NaN, 3), false);
    assert.equal(isPersistentFailure(3, Number.NaN), false);
  });

  it("labels only the feeds the threshold reaches, at the default of 3", () => {
    const warnings = feedWarnings(health, DEFAULT_FAILURE_WARNING_THRESHOLD);
    assert.deepEqual(warnings.map((w) => w.name), ["Dead", "Dying"]);
    assert.deepEqual(warnings.map((w) => w.persistent), [true, false]);
  });

  it("adds feeds below the legacy bar rather than hiding the ones above it", () => {
    const warnings = feedWarnings(health, 1);
    assert.deepEqual(warnings.map((w) => w.name), ["Dead", "Dying", "Flaky"]);
    assert.deepEqual(warnings.map((w) => w.persistent), [true, true, true]);
    // Nothing feedIssues would have listed may drop out, whatever the threshold.
    for (const threshold of [1, 2, 3, 5, 99]) {
      const names = feedWarnings(health, threshold).map((w) => w.name);
      for (const issue of feedIssues(health)) assert.ok(names.includes(issue.name), `${issue.name} at ${threshold}`);
    }
  });

  it("still lists a failing feed when a high threshold has not been reached", () => {
    const warnings = feedWarnings(health, 5);
    assert.deepEqual(warnings.map((w) => w.name), ["Dead", "Dying"]);
    assert.deepEqual(warnings.map((w) => w.persistent), [true, false]);
    assert.deepEqual(feedWarnings(health, 99).map((w) => w.persistent), [false, false]);
  });

  it("leaves feedIssues and its ordering exactly as they were", () => {
    const before = structuredClone(health);
    assert.equal(FAILING_THRESHOLD, 2);
    assert.deepEqual(feedIssues(health).map((i) => i.name), ["Dead", "Dying"]);
    assert.deepEqual(feedIssues(undefined), []);
    assert.deepEqual(feedWarnings(undefined, 1), []);
    assert.deepEqual(health, before);
  });
});
