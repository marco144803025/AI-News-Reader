import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { categoryLabel, CATEGORY_LABELS, sourceError, tagLabel, uiCopy, uiDay, uiNumber } from "../ui.ts";
import { selectBrief, selectSummary } from "../language.ts";
import { filterArticles, EMPTY_FILTER } from "../filter.ts";
import type { Article } from "../../types.ts";

describe("standard interface languages", () => {
  it("provides matching complete copy and formatter contracts in both languages", () => {
    const en = uiCopy("en"), zh = uiCopy("zh-HK");
    assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      assert.equal(typeof zh[key], typeof en[key], key);
      if (typeof zh[key] === "string") assert.ok((zh[key] as string).trim(), key);
    }
    assert.equal(en.stories(1), "1 story");
    assert.equal(en.stories(0), "0 stories");
    assert.equal(zh.stories(1200), "1,200 則新聞");
    assert.equal(zh.page(2, 35), "第 2 頁，共 35 頁");
    assert.equal(en.sourcesAttention(1), "1 source needs attention");
    assert.equal(uiNumber(-1234, "zh-HK"), "-1,234");
    assert.equal(zh.citation(2, 3), "摘要第 3 項的來源 2");
  });

  it("keeps category and tag filter identities canonical and unfamiliar labels intact", () => {
    const article: Article = { title: "Original title", source: "OpenAI", url: "https://example.org/original",
      publishedAt: "2026-09-09T00:00:00Z", category: "Research", summary: "English only", snippet: "",
      tags: { topics: ["inference"], traits: ["research"], entities: ["OpenAI"] } };
    const before = structuredClone(article);
    assert.equal(categoryLabel(article.category, "zh-HK"), "研究");
    assert.equal(tagLabel("topics", "inference", "zh-HK"), "推論");
    assert.equal(tagLabel("entities", "research", "zh-HK"), "research");
    for (const value of ["Future category", "__proto__", "constructor"]) {
      assert.equal(categoryLabel(value, "zh-HK"), value);
      assert.equal(tagLabel("topics", value, "zh-HK"), value);
    }
    for (const category of Object.keys(CATEGORY_LABELS)) {
      assert.equal(categoryLabel(category, "en"), category === "All" ? "All news" : category);
    }
    const state = { ...EMPTY_FILTER, category: "Research", topics: ["inference"] };
    assert.deepEqual(filterArticles([article], state), [article]);
    assert.deepEqual(article, before);
  });

  it("keeps interface Chinese when article or partial brief content falls back to English", () => {
    const language = "zh-HK";
    const selected = selectSummary({ summary: "Original English summary" }, language);
    const brief = selectBrief({ generatedAt: "2026-09-09T00:00:00Z", bullets: [
      { text: "One", textZhHK: "一", refs: [] }, { text: "Two", refs: [] }, { text: "Three", textZhHK: "三", refs: [] },
    ] }, language);
    assert.equal(selected.language, "en");
    assert.equal(brief.language, "en");
    assert.equal(brief.fallback, true);
    assert.equal(uiCopy(language).readOriginal, "閱讀原文");
    assert.equal(uiCopy(language).dailyBrief, "每日摘要");
    assert.equal(uiCopy("en").readOriginal, "Read original");
  });

  it("formats UTC day buckets without timezone drift and rejects malformed dates", () => {
    const originalZone = process.env.TZ;
    try {
      for (const zone of ["America/Los_Angeles", "Asia/Hong_Kong"]) {
        process.env.TZ = zone;
        assert.equal(uiDay("2026-09-09", "zh-HK"), "2026年9月9日");
        assert.match(uiDay("2026-09-09", "en"), /^9 Sept? 2026$/);
      }
      for (const bad of [undefined, "bad", "2026-02-30", "2026-13-01"]) {
        assert.equal(uiDay(bad, "zh-HK"), "日期不詳");
      }
    } finally {
      if (originalZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalZone;
    }
  });

  it("describes known feed failures without inventing causes or losing unknown diagnostics", () => {
    assert.equal(sourceError("HTTP 429 Too Many Requests", "zh-HK"), "來源回應錯誤（HTTP 429）");
    assert.match(sourceError("ETIMEDOUT", "zh-HK"), /連線逾時.*ETIMEDOUT/);
    assert.match(sourceError("socket hang up", "zh-HK"), /未能連接來源.*socket hang up/);
    assert.match(sourceError("Vendor code X42", "zh-HK"), /來源更新失敗.*Vendor code X42/);
    assert.equal(sourceError(null, "zh-HK"), "不明錯誤");
    assert.equal(sourceError("Vendor code X42", "en"), "Vendor code X42");
    assert.equal(uiCopy("zh-HK").noHealth, "暫未有來源狀態資料。");
  });
});
