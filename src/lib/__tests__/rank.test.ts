import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FRESH_WINDOW_MS,
  isFresh,
  rankFrontPage,
  ransomWordIndex,
} from "../rank.ts";
import type { Article } from "../../types.ts";

const NOW = Date.parse("2026-07-02T12:00:00Z");

function makeArticle(
  url: string,
  publishedAt: string,
  important = false
): Article {
  return {
    title: "T",
    url,
    source: "src",
    publishedAt,
    snippet: "",
    category: "Research",
    summary: "S",
    important,
  };
}

describe("rankFrontPage", () => {
  it("returns null lead for an empty set", () => {
    assert.deepEqual(rankFrontPage([]), { lead: null, rest: [] });
  });

  it("picks the first important article as lead", () => {
    const a = makeArticle("a", "2026-07-02T10:00:00Z");
    const b = makeArticle("b", "2026-07-02T09:00:00Z", true);
    const c = makeArticle("c", "2026-07-02T08:00:00Z", true);
    const { lead, rest } = rankFrontPage([a, b, c]);
    assert.equal(lead, b);
    assert.deepEqual(rest, [a, c]);
  });

  it("falls back to the newest (first) article when nothing is important", () => {
    const a = makeArticle("a", "2026-07-02T10:00:00Z");
    const b = makeArticle("b", "2026-07-02T09:00:00Z");
    const { lead, rest } = rankFrontPage([a, b]);
    assert.equal(lead, a);
    assert.deepEqual(rest, [b]);
  });

  it("preserves incoming order in rest", () => {
    const arts = ["a", "b", "c", "d"].map((u, i) =>
      makeArticle(u, `2026-07-02T0${9 - i}:00:00Z`, u === "c")
    );
    const { rest } = rankFrontPage(arts);
    assert.deepEqual(
      rest.map((a) => a.url),
      ["a", "b", "d"]
    );
  });
});

describe("isFresh", () => {
  it("is fresh within the 24h window, inclusive at the boundary", () => {
    const justNow = makeArticle("a", new Date(NOW - 60_000).toISOString());
    const boundary = makeArticle(
      "b",
      new Date(NOW - FRESH_WINDOW_MS).toISOString()
    );
    const stale = makeArticle(
      "c",
      new Date(NOW - FRESH_WINDOW_MS - 1).toISOString()
    );
    assert.equal(isFresh(justNow, NOW), true);
    assert.equal(isFresh(boundary, NOW), true);
    assert.equal(isFresh(stale, NOW), false);
  });

  it("treats slightly-future timestamps (feed clock skew) as fresh", () => {
    const future = makeArticle("a", new Date(NOW + 600_000).toISOString());
    assert.equal(isFresh(future, NOW), true);
  });

  it("rejects unparseable dates", () => {
    assert.equal(isFresh(makeArticle("a", "not-a-date"), NOW), false);
  });
});

describe("ransomWordIndex", () => {
  it("picks the longest word with at least 5 letters", () => {
    assert.equal(ransomWordIndex("EU signals grace period on GPAI rules"), 1);
  });

  it("breaks ties by earliest position", () => {
    assert.equal(ransomWordIndex("alpha bravo charlie"), 2);
    assert.equal(ransomWordIndex("charlie bravos alphas"), 0);
  });

  it("returns -1 when every word is short", () => {
    assert.equal(ransomWordIndex("GPT o4 is out now"), -1);
  });

  it("ignores punctuation when measuring", () => {
    assert.equal(ransomWordIndex('"Agents," said the CEO'), 0);
  });
});
