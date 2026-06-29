import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FILTER, filterArticles, type FilterState } from "../filter.ts";
import type { Article } from "../../types.ts";

function makeArticle(
  url: string,
  category: string,
  tags: Article["tags"],
  title = "T",
  summary = "S"
): Article {
  return {
    title,
    url,
    source: "src",
    publishedAt: "2026-06-20T00:00:00Z",
    snippet: "",
    category,
    summary,
    tags,
  };
}

const ARTICLES: Article[] = [
  makeArticle("a1", "Model Releases", {
    topics: ["llm", "agentic"],
    traits: ["commercial"],
    entities: ["anthropic", "claude"],
  }),
  makeArticle("a2", "Research", {
    topics: ["llm"],
    traits: ["research"],
    entities: ["openai"],
  }),
  makeArticle("a3", "MCP", {
    topics: ["agentic"],
    traits: ["open-source"],
    entities: ["anthropic"],
  }),
  makeArticle("a4", "Open Source", {
    topics: ["multimodal"],
    traits: ["open-source"],
    entities: ["meta"],
  }),
  makeArticle(
    "a5",
    "Research",
    {
      topics: ["llm"],
      traits: ["benchmark"],
      entities: ["gpt"],
    },
    "GPT smashes benchmark",
    "A new evaluation result on a popular leaderboard."
  ),
];

function withState(patch: Partial<FilterState>): FilterState {
  return { ...EMPTY_FILTER, ...patch };
}

describe("filterArticles", () => {
  it("returns all articles when state is empty", () => {
    assert.equal(filterArticles(ARTICLES, EMPTY_FILTER).length, ARTICLES.length);
  });

  it("AC10: substring search matches title", () => {
    const res = filterArticles(ARTICLES, withState({ query: "GPT smashes" }));
    assert.deepEqual(
      res.map((a) => a.url),
      ["a5"]
    );
  });

  it("AC10: substring search matches summary case-insensitively", () => {
    const res = filterArticles(ARTICLES, withState({ query: "EVALUATION" }));
    assert.deepEqual(
      res.map((a) => a.url),
      ["a5"]
    );
  });

  it("AC10: substring search matches a tag value", () => {
    const res = filterArticles(ARTICLES, withState({ query: "multimodal" }));
    assert.deepEqual(
      res.map((a) => a.url),
      ["a4"]
    );
  });

  it("AC11: OR within group — multiple topics broaden the set", () => {
    const res = filterArticles(
      ARTICLES,
      withState({ topics: ["llm", "multimodal"] })
    );
    assert.deepEqual(
      res.map((a) => a.url).sort(),
      ["a1", "a2", "a4", "a5"]
    );
  });

  it("AC12: AND across groups — narrows the intersection", () => {
    // topics: agentic OR llm  AND  traits: commercial  AND  entities: anthropic
    const res = filterArticles(
      ARTICLES,
      withState({
        topics: ["agentic", "llm"],
        traits: ["commercial"],
        entities: ["anthropic"],
      })
    );
    assert.deepEqual(
      res.map((a) => a.url),
      ["a1"]
    );
  });

  it("AC12: empty group is a no-op (does not block)", () => {
    const res = filterArticles(
      ARTICLES,
      withState({ entities: ["anthropic"] })
    );
    assert.deepEqual(
      res.map((a) => a.url).sort(),
      ["a1", "a3"]
    );
  });

  it("AC13: category scopes filtering", () => {
    const res = filterArticles(
      ARTICLES,
      withState({ category: "Research", topics: ["llm"] })
    );
    assert.deepEqual(
      res.map((a) => a.url).sort(),
      ["a2", "a5"]
    );
  });

  it("article without tags is excluded when any group filter is active", () => {
    const tagless = makeArticle("tagless", "Research", undefined);
    const res = filterArticles(
      [...ARTICLES, tagless],
      withState({ topics: ["llm"] })
    );
    assert.ok(!res.some((a) => a.url === "tagless"));
  });

  it("article without tags is included when no group filter is active", () => {
    const tagless = makeArticle("tagless", "Research", undefined);
    const res = filterArticles([...ARTICLES, tagless], EMPTY_FILTER);
    assert.ok(res.some((a) => a.url === "tagless"));
  });
});
