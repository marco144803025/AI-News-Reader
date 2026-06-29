import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import type { NewsData } from "../../src/types.ts";
import {
  buildFeedHealth,
  computeEffectiveDaysBack,
  computeGeneratedAt,
  normalizeTags,
  parseRetentionDays,
  withRetry,
  type Feed,
} from "../lib.ts";

const DAYS_BACK = 1;

function makeExisting(generatedAt: string): NewsData {
  return {
    generatedAt,
    daysBack: 1,
    categories: [],
    articles: [],
  };
}

function fakeHeaders(map: Record<string, string>): Headers {
  return new Headers(map);
}

describe("computeEffectiveDaysBack", () => {
  const NOW = Date.parse("2026-06-20T12:00:00Z");

  it("AC1: 3-day gap → 4", () => {
    const existing = makeExisting("2026-06-17T12:00:00Z");
    assert.equal(computeEffectiveDaysBack(existing, DAYS_BACK, NOW), 4);
  });

  it("AC2: 30-day gap → 7 (capped)", () => {
    const existing = makeExisting("2026-05-21T12:00:00Z");
    assert.equal(computeEffectiveDaysBack(existing, DAYS_BACK, NOW), 7);
  });

  it("AC3: corrupt generatedAt falls back to daysBack without throwing", () => {
    const existing = makeExisting("not-a-date");
    assert.doesNotThrow(() =>
      computeEffectiveDaysBack(existing, DAYS_BACK, NOW)
    );
    assert.equal(computeEffectiveDaysBack(existing, DAYS_BACK, NOW), DAYS_BACK);
  });

  it("first run (existing === null) returns daysBack", () => {
    assert.equal(computeEffectiveDaysBack(null, DAYS_BACK, NOW), DAYS_BACK);
  });
});

describe("withRetry", () => {
  const fakeSleep = () => Promise.resolve();

  it("AC4: InternalServerError ×2 then resolves — called 3 times, returns value", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) {
          throw new Anthropic.InternalServerError(
            500,
            { error: { message: "boom" } },
            "boom",
            fakeHeaders({})
          );
        }
        return "ok";
      },
      { sleep: fakeSleep }
    );
    assert.equal(calls, 3);
    assert.equal(result, "ok");
  });

  it("AC5: AuthenticationError — called once, rethrows", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(
        async () => {
          calls++;
          throw new Anthropic.AuthenticationError(
            401,
            { error: { message: "bad key" } },
            "bad key",
            fakeHeaders({})
          );
        },
        { sleep: fakeSleep }
      ),
      Anthropic.AuthenticationError
    );
    assert.equal(calls, 1);
  });

  it("AC6: RateLimitError with Retry-After: 2 → delay ≥ 2000ms", async () => {
    const delays: number[] = [];
    let calls = 0;
    await withRetry(
      async () => {
        calls++;
        if (calls === 1) {
          throw new Anthropic.RateLimitError(
            429,
            { error: { message: "slow down" } },
            "slow down",
            fakeHeaders({ "retry-after": "2" })
          );
        }
        return "ok";
      },
      { sleep: fakeSleep, onDelay: (ms) => delays.push(ms) }
    );
    assert.equal(delays.length, 1);
    assert.ok(
      delays[0] >= 2000,
      `expected delay >= 2000, got ${delays[0]}`
    );
  });

  it("AC7: per-batch — transient that exhausts retries throws transient error (caller skips)", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(
        async () => {
          calls++;
          throw new Anthropic.InternalServerError(
            500,
            { error: { message: "down" } },
            "down",
            fakeHeaders({})
          );
        },
        { sleep: fakeSleep, maxRetries: 3 }
      ),
      Anthropic.InternalServerError
    );
    assert.equal(calls, 4); // initial + 3 retries
  });
});

describe("buildFeedHealth", () => {
  it("AC8: three-way branch — succeeded, failed (with prior), not-attempted (carry-forward)", () => {
    const feeds: Feed[] = [
      { name: "alpha", url: "https://a" },
      { name: "beta", url: "https://b" },
      { name: "gamma", url: "https://g" },
    ];
    const successAt = { alpha: "2026-06-20T10:00:00Z" };
    const errors = { beta: "ETIMEDOUT" };
    const prevHealth = {
      beta: {
        lastSuccess: "2026-06-15T10:00:00Z",
        lastError: "ECONNRESET",
        consecutiveFailures: 2,
      },
      gamma: {
        lastSuccess: "2026-06-19T10:00:00Z",
        lastError: null,
        consecutiveFailures: 0,
      },
    };

    const health = buildFeedHealth(feeds, successAt, errors, prevHealth);

    assert.deepEqual(health.alpha, {
      lastSuccess: "2026-06-20T10:00:00Z",
      lastError: null,
      consecutiveFailures: 0,
    });
    assert.deepEqual(health.beta, {
      lastSuccess: "2026-06-15T10:00:00Z",
      lastError: "ETIMEDOUT",
      consecutiveFailures: 3,
    });
    assert.deepEqual(health.gamma, prevHealth.gamma);
  });

  it("not-attempted with no prior health → zero-state entry", () => {
    const feeds: Feed[] = [{ name: "lonely", url: "https://l" }];
    const health = buildFeedHealth(feeds, {}, {}, undefined);
    assert.deepEqual(health.lonely, {
      lastSuccess: null,
      lastError: null,
      consecutiveFailures: 0,
    });
  });
});

describe("computeGeneratedAt", () => {
  const FROZEN_NOW = "2026-06-20T12:00:00Z";
  const now = () => FROZEN_NOW;

  it("AC9: newCount=0 with existing → returns existing.generatedAt", () => {
    const existing = makeExisting("2026-06-19T08:00:00Z");
    assert.equal(computeGeneratedAt(0, existing, now), "2026-06-19T08:00:00Z");
  });

  it("AC10: newCount=0 with existing (dedup-only case) → still returns existing.generatedAt", () => {
    const existing = makeExisting("2026-06-19T08:00:00Z");
    assert.equal(computeGeneratedAt(0, existing, now), "2026-06-19T08:00:00Z");
  });

  it("AC11: newCount>0 → returns now() regardless of existing", () => {
    const existing = makeExisting("2026-06-19T08:00:00Z");
    assert.equal(computeGeneratedAt(5, existing, now), FROZEN_NOW);
    assert.equal(computeGeneratedAt(1, null, now), FROZEN_NOW);
  });

  it("newCount=0 with no existing → returns now()", () => {
    assert.equal(computeGeneratedAt(0, null, now), FROZEN_NOW);
  });
});

describe("normalizeTags", () => {
  it("AC2: caps total tags at 6 across groups in emission order", () => {
    const raw = [
      "llm",          // topic
      "agentic",      // topic
      "reasoning",    // topic
      "commercial",   // trait
      "open-source",  // trait
      "anthropic",    // entity
      "openai",       // entity (should be dropped — 7th)
      "claude",       // entity (should be dropped — 8th)
    ];
    const tags = normalizeTags(raw);
    const total = tags.topics.length + tags.traits.length + tags.entities.length;
    assert.equal(total, 6);
    assert.deepEqual(tags.topics, ["llm", "agentic", "reasoning"]);
    assert.deepEqual(tags.traits, ["commercial", "open-source"]);
    assert.deepEqual(tags.entities, ["anthropic"]);
  });

  it("AC3: LLM / llm / Llm / large-language-model all canonicalize to 'llm'", () => {
    assert.deepEqual(normalizeTags(["LLM"]).topics, ["llm"]);
    assert.deepEqual(normalizeTags(["Llm"]).topics, ["llm"]);
    assert.deepEqual(normalizeTags(["large-language-model"]).topics, ["llm"]);
    assert.deepEqual(normalizeTags(["large language model"]).topics, ["llm"]);
    const dupes = normalizeTags(["LLM", "llm", "large-language-model"]);
    assert.deepEqual(dupes.topics, ["llm"]);
  });

  it("AC4: alias map resolves gpt-4/gpt-5/gpt-4o → gpt", () => {
    const tags = normalizeTags(["gpt-4", "gpt-5", "gpt-4o"]);
    assert.deepEqual(tags.entities, ["gpt"]);
  });

  it("AC5: multi-word tags become lowercase kebab-case", () => {
    const tags = normalizeTags(["Open Source", "Foundation Model"]);
    assert.ok(
      tags.traits.includes("open-source"),
      `expected open-source in traits, got ${JSON.stringify(tags)}`
    );
    assert.ok(
      tags.topics.includes("foundation-model"),
      `expected foundation-model in topics, got ${JSON.stringify(tags)}`
    );
  });

  it("AC6: tags route to their seed group; unknown tags default to topics", () => {
    const tags = normalizeTags([
      "anthropic",       // entity
      "commercial",      // trait
      "agentic",         // topic
      "some-novel-tag",  // unknown → topics
    ]);
    assert.deepEqual(tags.entities, ["anthropic"]);
    assert.deepEqual(tags.traits, ["commercial"]);
    assert.deepEqual(tags.topics, ["agentic", "some-novel-tag"]);
  });

  it("handles empty / non-string input gracefully", () => {
    assert.deepEqual(normalizeTags([]), {
      topics: [],
      traits: [],
      entities: [],
    });
    assert.deepEqual(
      normalizeTags(["", "  ", "!!!"] as string[]),
      { topics: [], traits: [], entities: [] }
    );
    assert.deepEqual(
      normalizeTags([null as unknown as string, undefined as unknown as string, "llm"]),
      { topics: ["llm"], traits: [], entities: [] }
    );
  });
});

describe("parseRetentionDays", () => {
  it("AC12: RETENTION_DAYS=abc → process.exit(1)", () => {
    const exitMock = mock.method(process, "exit", (() => {
      throw new Error("__exit_called__");
    }) as never);
    const errorMock = mock.method(console, "error", () => {});
    const prev = process.env.RETENTION_DAYS;
    process.env.RETENTION_DAYS = "abc";
    try {
      assert.throws(() => parseRetentionDays(), /__exit_called__/);
      assert.equal(exitMock.mock.calls.length, 1);
      assert.equal(exitMock.mock.calls[0].arguments[0], 1);
    } finally {
      if (prev === undefined) delete process.env.RETENTION_DAYS;
      else process.env.RETENTION_DAYS = prev;
      exitMock.mock.restore();
      errorMock.mock.restore();
    }
  });

  it("RETENTION_DAYS unset → default 30", () => {
    const prev = process.env.RETENTION_DAYS;
    delete process.env.RETENTION_DAYS;
    try {
      assert.equal(parseRetentionDays(), 30);
    } finally {
      if (prev !== undefined) process.env.RETENTION_DAYS = prev;
    }
  });

  it("RETENTION_DAYS=7 → 7", () => {
    const prev = process.env.RETENTION_DAYS;
    process.env.RETENTION_DAYS = "7";
    try {
      assert.equal(parseRetentionDays(), 7);
    } finally {
      if (prev === undefined) delete process.env.RETENTION_DAYS;
      else process.env.RETENTION_DAYS = prev;
    }
  });
});
