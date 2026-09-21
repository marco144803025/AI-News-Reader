import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BRIEF_INPUT_CAP,
  buildBriefPrompt,
  carryForwardBrief,
  formatBriefInputStats,
  parseBriefResponse,
  selectBriefInput,
} from "../lib.ts";
import type { Article, NewsData } from "../../src/types.ts";

function makeArticle(
  url: string,
  publishedAt: string,
  important = false,
  title = `Title ${url}`,
  category = "Research",
  source = "src"
): Article {
  return {
    title,
    url,
    source,
    publishedAt,
    snippet: "",
    category,
    summary: `Summary of ${url}`,
    important,
  };
}

describe("selectBriefInput", () => {
  const NOW = Date.parse("2026-07-02T12:00:00Z");

  it("puts important articles first, each group newest-first", () => {
    const a = makeArticle("a", "2026-07-02T09:00:00Z");
    const b = makeArticle("b", "2026-07-02T08:00:00Z", true);
    const c = makeArticle("c", "2026-07-02T10:00:00Z", true);
    const d = makeArticle("d", "2026-07-02T11:00:00Z");
    assert.deepEqual(
      selectBriefInput([a, b, c, d], NOW).articles.map((x) => x.url),
      ["c", "b", "d", "a"]
    );
  });

  it("caps the input while keeping importants visible", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      makeArticle(`u${i}`, `2026-07-02T00:${String(i).padStart(2, "0")}:00Z`, i >= 58)
    );
    const selected = selectBriefInput(many, NOW);
    assert.equal(selected.articles.length, BRIEF_INPUT_CAP);
    assert.equal(selected.articles[0].important, true);
    assert.equal(selected.articles[1].important, true);
  });

  it("takes the last 24h of the archive, not just this run's arrivals", () => {
    const yesterday = makeArticle("old", "2026-06-30T12:00:00Z", true);
    const edge = makeArticle("edge", "2026-07-01T11:59:00Z");
    const inside = makeArticle("new", "2026-07-02T09:00:00Z");
    assert.deepEqual(
      selectBriefInput([yesterday, edge, inside], NOW).articles.map((x) => x.url),
      ["new"]
    );
    // Unparseable dates are dropped rather than silently treated as recent.
    assert.deepEqual(selectBriefInput([makeArticle("bad", "not-a-date")], NOW).articles, []);
  });

  it("caps a dominant category and source while scanning for alternatives", () => {
    const candidates = [
      ...Array.from({ length: 10 }, (_, i) => makeArticle(`arxiv-${i}`, `2026-07-02T11:${String(59 - i).padStart(2, "0")}:00Z`, false, `Research arxiv ${i}`, "Research", "arXiv cs.AI")),
      ...Array.from({ length: 2 }, (_, i) => makeArticle(`open-research-${i}`, `2026-07-02T11:${String(49 - i).padStart(2, "0")}:00Z`, false, `Research open ${i}`, "Research", "OpenAI Blog")),
      ...Array.from({ length: 3 }, (_, i) => makeArticle(`applications-${i}`, `2026-07-02T11:${String(47 - i).padStart(2, "0")}:00Z`, false, `Applications ${i}`, "Applications", "OpenAI Blog")),
      ...Array.from({ length: 2 }, (_, i) => makeArticle(`mcp-${i}`, `2026-07-02T11:${String(44 - i).padStart(2, "0")}:00Z`, false, `MCP ${i}`, "MCP", "Simon Willison")),
      ...Array.from({ length: 3 }, (_, i) => makeArticle(`policy-${i}`, `2026-07-02T11:${String(42 - i).padStart(2, "0")}:00Z`, false, `Policy ${i}`, "Regulation & Policy", "Computer Weekly")),
    ];
    const selection = selectBriefInput(candidates, NOW);

    assert.equal(selection.stats.candidateCount, 20);
    assert.equal(selection.stats.selectedCount, 16);
    assert.equal(selection.stats.categoryCounts.Research, 8);
    assert.equal(selection.stats.sourceCounts["arXiv cs.AI"], 6);
    assert.equal(selection.stats.fallbacks.length, 0);
    assert.deepEqual(selection.articles.map((article) => article.url), [
      "arxiv-0",
      "arxiv-1",
      "arxiv-2",
      "arxiv-3",
      "arxiv-4",
      "arxiv-5",
      "open-research-0",
      "open-research-1",
      "applications-0",
      "applications-1",
      "applications-2",
      "mcp-0",
      "mcp-1",
      "policy-0",
      "policy-1",
      "policy-2",
    ]);
  });

  it("relaxes only the unavailable category quota", () => {
    const candidates = Array.from({ length: 50 }, (_, i) =>
      makeArticle(`one-category-${i}`, `2026-07-02T${String(11 - Math.floor(i / 5)).padStart(2, "0")}:${String(59 - i % 5).padStart(2, "0")}:00Z`, false, `One category ${i}`, "Research", `source-${i % 5}`)
    );
    const selection = selectBriefInput(candidates, NOW);

    assert.deepEqual(selection.stats.fallbacks, ["single-category"]);
    assert.equal(selection.articles.length, 50);
    assert.equal(Math.max(...Object.values(selection.stats.sourceCounts)), 10);
  });

  it("relaxes only the unavailable source quota", () => {
    const candidates = Array.from({ length: 50 }, (_, i) =>
      makeArticle(`one-source-${i}`, `2026-07-02T${String(11 - Math.floor(i / 5)).padStart(2, "0")}:${String(59 - i % 5).padStart(2, "0")}:00Z`, false, `Category ${i}`, `Category ${i % 5}`, "one-source")
    );
    const selection = selectBriefInput(candidates, NOW);

    assert.deepEqual(selection.stats.fallbacks, ["single-source"]);
    assert.equal(selection.articles.length, 50);
    assert.equal(Math.max(...Object.values(selection.stats.categoryCounts)), 10);
  });

  it("relaxes the minimum number of quotas needed to keep three inputs", () => {
    const candidates = [
      makeArticle("minimum-a", "2026-07-02T11:00:00Z", false, "A", "A", "X"),
      makeArticle("minimum-b", "2026-07-02T10:00:00Z", false, "B", "B", "Y"),
      makeArticle("minimum-c", "2026-07-02T09:00:00Z", false, "A again", "A", "X"),
    ];
    const selection = selectBriefInput(candidates, NOW);

    assert.deepEqual(selection.stats.fallbacks, ["minimum-input"]);
    assert.equal(selection.articles.length, 3);
    assert.deepEqual(selection.articles.map((article) => article.url), [
      "minimum-a",
      "minimum-b",
      "minimum-c",
    ]);
  });

  it("accounts for blank labels without mutating articles", () => {
    const malformed = makeArticle("blank-label", "2026-07-02T11:00:00Z");
    malformed.category = "";
    malformed.source = "";
    const selection = selectBriefInput([
      malformed,
      makeArticle("known-a", "2026-07-02T10:00:00Z", false, "Known A", "Applications", "known"),
      makeArticle("known-b", "2026-07-02T09:00:00Z", false, "Known B", "MCP", "known"),
    ], NOW);

    assert.equal(selection.stats.categoryCounts.Unknown, 1);
    assert.equal(selection.stats.sourceCounts.Unknown, 1);
    assert.equal(malformed.category, "");
    assert.equal(malformed.source, "");
    assert.match(formatBriefInputStats(selection.stats), /categories Applications=1, MCP=1, Unknown=1/);
  });

  it("is deterministic for the same archive and timestamp", () => {
    const candidates = [
      makeArticle("det-a", "2026-07-02T11:00:00Z", true, "A", "Research", "source-a"),
      makeArticle("det-b", "2026-07-02T10:00:00Z", false, "B", "Applications", "source-b"),
      makeArticle("det-c", "2026-07-02T09:00:00Z", false, "C", "MCP", "source-c"),
    ];

    assert.deepEqual(
      selectBriefInput(candidates, NOW),
      selectBriefInput(candidates, NOW)
    );
  });
});

describe("buildBriefPrompt", () => {
  it("lists articles with indices and NOTABLE markers", () => {
    const { system, user } = buildBriefPrompt([
      makeArticle("a", "2026-07-02T09:00:00Z", true),
      makeArticle("b", "2026-07-02T08:00:00Z"),
    ]);
    assert.ok(user.includes("[0] (Research, NOTABLE) Title a"));
    assert.ok(user.includes("[1] (Research) Title b"));
    assert.ok(user.includes("2 articles from the last 24 hours"));
    assert.ok(system.includes("JSON object"));
  });
});

describe("parseBriefResponse", () => {
  const inputs = [
    makeArticle("https://x/a", "2026-07-02T09:00:00Z"),
    makeArticle("https://x/b", "2026-07-02T08:00:00Z"),
    makeArticle("https://x/c", "2026-07-02T07:00:00Z"),
  ];

  it("accepts a fenced envelope and independently discards invalid headlines", () => {
    const bullets = [0, 1, 2].map(i => ({ text: `Item ${i} with [brackets]`, textZhHK: `消息 ${i}`, refs: [i] }));
    const response = { headline: "  Reliability takes centre stage  ", headlineZhHK: "可靠性成為焦點", bullets };
    const result = parseBriefResponse("```json\n" + JSON.stringify(response) + "\n```", inputs);
    assert.equal(result.headline, "Reliability takes centre stage");
    assert.equal(result.headlineZhHK, response.headlineZhHK);
    assert.deepEqual(result.bullets.map(b => b.refs), inputs.map(a => [a.url]));
    for (const headline of [null, 42, {}, "", "x".repeat(101), "word ".repeat(15)]) {
      const invalid = parseBriefResponse(JSON.stringify({ ...response, headline }), inputs);
      assert.equal(invalid.headline, undefined);
      assert.equal(invalid.headlineZhHK, response.headlineZhHK);
      assert.equal(invalid.bullets.length, 3);
    }
    assert.equal(parseBriefResponse(JSON.stringify({ ...response, headlineZhHK: "字".repeat(51) }), inputs).headlineZhHK, undefined);
    assert.throws(() => parseBriefResponse('{"headline":"Bad", "refs":[0,1,2]}', inputs), /bullets array/);
    assert.throws(() => parseBriefResponse('{"headline":"Bad", "bullets":[}', inputs), /not valid JSON/);
  });

  it("parses bullets and resolves refs to URLs", () => {
    const text =
      'Here is the brief:\n[{"text":"One","refs":[0,2]},{"text":"Two","refs":[1]},{"text":"Three","refs":[]}]';
    const { bullets } = parseBriefResponse(text, inputs);
    assert.equal(bullets.length, 3);
    assert.deepEqual(bullets[0].refs, ["https://x/a", "https://x/c"]);
    assert.deepEqual(bullets[2].refs, []);
  });

  it("retains valid paired Chinese and degrades partial translations without losing English refs", (t) => {
    const warnings: string[] = [];
    t.mock.method(console, "warn", (message: string) => warnings.push(message));
    const raw = ["  首則消息。  ", 42, " \n"].map((textZhHK, i) => ({
      text: `English ${i}`, textZhHK, refs: [i, i, 99],
    }));
    const { bullets } = parseBriefResponse(JSON.stringify(raw), inputs);
    assert.equal(bullets[0].textZhHK, "首則消息。");
    assert(!Object.hasOwn(bullets[1], "textZhHK"));
    assert(!Object.hasOwn(bullets[2], "textZhHK"));
    assert.deepEqual(bullets.map(b => b.text), ["English 0", "English 1", "English 2"]);
    assert.deepEqual(bullets.map(b => b.refs), inputs.map(a => [a.url]));
    assert.equal(warnings.length, 1);
  });

  it("drops out-of-range, duplicate, and non-integer refs", () => {
    const text =
      '[{"text":"One","refs":[0,0,7,-1,1.5]},{"text":"Two","refs":[1]},{"text":"Three","refs":[2]}]';
    const { bullets } = parseBriefResponse(text, inputs);
    assert.deepEqual(bullets[0].refs, ["https://x/a"]);
  });

  it("skips bullets with empty text, then enforces the 3-5 bound", () => {
    const ok =
      '[{"text":""},{"text":"One","refs":[0]},{"text":"Two"},{"text":"Three"},{"text":"Four"}]';
    assert.equal(parseBriefResponse(ok, inputs).bullets.length, 4);

    const tooFew = '[{"text":"One"},{"text":""},{"text":"Two"}]';
    assert.throws(() => parseBriefResponse(tooFew, inputs), /valid bullets/);
  });

  it("keeps the first five of an over-long brief instead of losing the day", () => {
    const tooMany =
      '[{"text":"1"},{"text":"2"},{"text":"3"},{"text":"4"},{"text":"5"},{"text":"6"}]';
    const { bullets } = parseBriefResponse(tooMany, inputs);
    assert.deepEqual(bullets.map(bullet => bullet.text), ["1", "2", "3", "4", "5"]);
  });

  it("throws on responses without a JSON array", () => {
    assert.throws(() => parseBriefResponse("no json here", inputs), /No JSON/);
    assert.throws(() => parseBriefResponse("[not json]", inputs), /not valid JSON/);
  });
});

describe("carryForwardBrief", () => {
  it("returns the existing brief or undefined", () => {
    assert.equal(carryForwardBrief(null), undefined);
    const data = {
      brief: { generatedAt: "2026-07-01T06:00:00Z", headline: "Previous edition", headlineZhHK: "上一期摘要", bullets: [] },
    } as unknown as NewsData;
    assert.equal(carryForwardBrief(data), data.brief);
    assert.equal(carryForwardBrief(data)?.headline, "Previous edition");
    assert.equal(carryForwardBrief(data)?.generatedAt, "2026-07-01T06:00:00Z");
  });
});
