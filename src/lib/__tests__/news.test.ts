import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { briefNotice, newsDate, parseNewsData, selectNotableStories } from "../news.ts";
import type { Article } from "../../types.ts";

const date = "2026-09-08T06:00:00Z";
const article: Article = { title: "A model", source: "Source", url: "https://example.org/a", publishedAt: date,
  category: "Model Releases", summary: "A useful summary.", snippet: "" };
const brief = { generatedAt: "2026-09-07T06:00:00Z", bullets: [0, 1, 2].map(i => ({ text: `Item ${i}`, refs: [article.url] })) };
const data = { generatedAt: date, categories: [article.category], articles: [article], brief };

describe("browser news data", () => {
  it("accepts old and stripped archives, normalizing optional collections without mutation", () => {
    const { snippet: _snippet, ...stripped } = article;
    const input = { ...data, articles: [{ ...stripped, tags: { topics: ["llm", 42] } }],
      brief: { ...brief, headline: "New possibilities", headlineZhHK: 42 }, feedHealth: { broken: null } };
    const before = structuredClone(input);
    const parsed = parseNewsData(input);
    assert.deepEqual(input, before);
    assert.equal(parsed.articles[0].snippet, "");
    assert.deepEqual(parsed.articles[0].tags, { topics: ["llm"], traits: [], entities: [] });
    assert.equal(parsed.brief?.headline, "New possibilities");
    assert.equal(parsed.brief?.headlineZhHK, undefined);
    assert.deepEqual(parsed.feedHealth, {});
  });
  it("rejects an unusable dataset but keeps news when only the brief is malformed", () => {
    for (const bad of [null, [], {}, { ...data, generatedAt: "bad" }, { ...data, articles: [null] },
      { ...data, categories: [42] }, { ...data, articles: [{ ...article, url: "javascript:alert(1)" }] }]) {
      assert.throws(() => parseNewsData(bad), /archive/);
    }
    for (const badBrief of [null, {}, { ...brief, bullets: [null, null, null] }, { ...brief, generatedAt: "bad" }]) {
      const result = parseNewsData({ ...data, brief: badBrief });
      assert.equal(result.brief, undefined);
      assert.equal(result.articles.length, 1);
    }
    assert.equal(parseNewsData({ ...data, articles: [], brief: undefined }).articles.length, 0);
  });
  it("labels quiet and failed updates without changing the old brief date", () => {
    for (const briefStatus of ["no-new-material", "generation-failed"] as const) {
      const parsed = parseNewsData({ ...data, briefStatus });
      assert.equal(parsed.brief?.generatedAt, brief.generatedAt);
      assert.match(briefNotice(parsed)!, /previous edition/);
    }
    assert.equal(briefNotice({ brief }), undefined);
    assert.equal(briefNotice({ brief, briefStatus: "generated" }), undefined);
    assert.equal(newsDate("invalid"), "Date unavailable");
  });
  it("localizes dates and status independently of a carried English brief", () => {
    const before = structuredClone(brief);
    assert.equal(newsDate("invalid", "zh-HK"), "日期不詳");
    assert.match(newsDate(date, "zh-HK"), /2026年9月8日/);
    for (const briefStatus of ["generation-failed", "no-new-material"] as const) {
      assert.match(briefNotice({ brief, briefStatus }, "zh-HK")!, /以下顯示上一期摘要/);
      assert.match(briefNotice({ brief, briefStatus }, "en")!, /previous edition/);
    }
    assert.match(briefNotice({ briefStatus: "generation-failed" }, "zh-HK")!, /你仍可瀏覽/);
    assert.doesNotMatch(briefNotice({ briefStatus: "no-new-material" }, "zh-HK")!, /上一期/);
    assert.equal(briefNotice({ briefStatus: "generated" }, "zh-HK"), undefined);
    assert.deepEqual(brief, before);
  });
});

describe("notable cover stories", () => {
  it("uses an inclusive seven-day window, unique URLs, and stable ordering without mutating", () => {
    const row = (url: string, publishedAt: string, important = true) => ({ ...article, url, publishedAt, important });
    const rows = [row("z", date), row("a", date), row("a", date), row("future", "2026-09-09T06:00:00Z"),
      row("old", "2026-09-01T05:59:59Z"), row("bad", "bad"), row("ordinary", date, false)];
    const before = structuredClone(rows);
    assert.deepEqual(selectNotableStories(rows, date).map(a => a.url), ["a", "z"]);
    assert.deepEqual(rows, before);
    assert.equal(selectNotableStories([row("edge", "2026-09-01T06:00:00Z")], date).length, 1);
    assert.deepEqual(selectNotableStories(rows, "bad"), []);
    assert.deepEqual(selectNotableStories([], date), []);
  });
});
