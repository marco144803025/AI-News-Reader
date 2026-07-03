import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "../paginate.ts";
import { decodeEntities } from "../text.ts";
import {
  categoryCounts,
  collectTagUniverse,
  EMPTY_FILTER,
} from "../filter.ts";
import type { Article } from "../../types.ts";

describe("paginate", () => {
  const items = [1, 2, 3, 4, 5, 6, 7];

  it("slices full and partial pages", () => {
    assert.deepEqual(paginate(items, 0, 3), {
      pageItems: [1, 2, 3],
      totalPages: 3,
    });
    assert.deepEqual(paginate(items, 2, 3).pageItems, [7]);
  });

  it("returns empty for out-of-range pages and empty input", () => {
    assert.deepEqual(paginate(items, 5, 3).pageItems, []);
    assert.deepEqual(paginate([], 0, 3), { pageItems: [], totalPages: 0 });
  });
});

describe("decodeEntities", () => {
  it("decodes numeric and named entities", () => {
    assert.equal(decodeEntities("Anthropic&#8217;s move"), "Anthropic’s move");
    assert.equal(decodeEntities("A &amp; B &lt;fast&gt;"), "A & B <fast>");
    assert.equal(decodeEntities("&#x27;quoted&#x27;"), "'quoted'");
  });

  it("leaves plain text untouched", () => {
    assert.equal(decodeEntities("No entities here"), "No entities here");
  });
});

function makeArticle(url: string, category: string, title: string): Article {
  return {
    title,
    url,
    source: "src",
    publishedAt: "2026-06-20T00:00:00Z",
    snippet: "",
    category,
    summary: "S",
    tags: {
      topics: ["llm"],
      traits: [],
      entities: url === "a1" ? ["anthropic"] : [],
    },
  };
}

const ARTICLES: Article[] = [
  makeArticle("a1", "Research", "Attention scaling"),
  makeArticle("a2", "Research", "Benchmark results"),
  makeArticle("a3", "MCP", "Registry update"),
];

describe("categoryCounts", () => {
  it("counts All plus each category, ignoring the category constraint", () => {
    const counts = categoryCounts(ARTICLES, {
      ...EMPTY_FILTER,
      category: "MCP",
    });
    assert.equal(counts.get("All"), 3);
    assert.equal(counts.get("Research"), 2);
    assert.equal(counts.get("MCP"), 1);
  });

  it("applies the search filter to the counts", () => {
    const counts = categoryCounts(ARTICLES, {
      ...EMPTY_FILTER,
      query: "registry",
    });
    assert.equal(counts.get("All"), 1);
    assert.equal(counts.get("Research"), undefined);
    assert.equal(counts.get("MCP"), 1);
  });
});

describe("collectTagUniverse", () => {
  it("returns unique sorted values for a group", () => {
    assert.deepEqual(collectTagUniverse(ARTICLES, "topics"), ["llm"]);
    assert.deepEqual(collectTagUniverse(ARTICLES, "entities"), ["anthropic"]);
  });

  it("handles articles without tags", () => {
    const untagged: Article = { ...ARTICLES[0], url: "a4", tags: undefined };
    assert.deepEqual(collectTagUniverse([untagged], "topics"), []);
  });
});
