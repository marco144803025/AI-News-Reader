import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSummaryLanguage, selectBrief, selectBriefHeadline, selectSummary, validBriefHeadline, validTranslation } from "../language.ts";
import type { Brief } from "../../types.ts";

describe("summary languages", () => {
  it("selects headlines independently without changing the complete brief's language", () => {
    const brief: Brief = { generatedAt: "2026-09-08T06:00:00Z", headline: "New models arrive",
      bullets: [0, 1, 2].map(i => ({ text: `English ${i}`, textZhHK: `消息 ${i}`, refs: [] })) };
    assert.equal(selectBriefHeadline(brief, selectBrief(brief, "zh-HK").language), "AI 每日摘要");
    assert.equal(selectBriefHeadline(brief, "en"), brief.headline);
    brief.headlineZhHK = "新模型登場";
    assert.equal(selectBriefHeadline(brief, "zh-HK"), brief.headlineZhHK);
    delete brief.bullets[1].textZhHK;
    assert.equal(selectBriefHeadline(brief, selectBrief(brief, "zh-HK").language), brief.headline);
    assert.equal(selectBriefHeadline({ ...brief, headline: "" }, "en"), "The latest in AI.");
    assert.equal(validBriefHeadline("word ".repeat(15), "en"), undefined);
    assert.equal(validBriefHeadline("x".repeat(101), "en"), undefined);
    assert.equal(validBriefHeadline("字".repeat(51), "zh-HK"), undefined);
    assert.equal(validBriefHeadline("🚀".repeat(50), "zh-HK"), "🚀".repeat(50));
  });
  it("accepts only supported locales and nonempty translation strings", () => {
    assert(isSummaryLanguage("en"));
    assert(isSummaryLanguage("zh-HK"));
    for (const value of [undefined, null, "zh", "zh-CN", "", 1, {}]) assert(!isSummaryLanguage(value));
    for (const value of [undefined, null, " \n", 1, [], {}]) assert.equal(validTranslation(value), undefined);
    assert.equal(validTranslation("  API 相容性。 \n"), "API 相容性。");
  });

  it("selects article text without mutating English or losing its fallback language", () => {
    const article = Object.freeze({ summary: "API compatibility.", summaryZhHK: "API 相容性。" });
    assert.deepEqual(selectSummary(article, "zh-HK"), { text: "API 相容性。", language: "zh-HK", fallback: false });
    assert.deepEqual(selectSummary(article, "en"), { text: "API compatibility.", language: "en", fallback: false });
    for (const summaryZhHK of [undefined, " ", 123]) {
      const legacy = { ...article, summaryZhHK } as typeof article;
      assert.deepEqual(selectSummary(legacy, "zh-HK"), { text: article.summary, language: "en", fallback: true });
    }
  });

  it("uses one language for the whole brief, preserving refs, timestamp and canonical text", () => {
    const brief: Brief = {
      generatedAt: "2026-09-06T06:00:00Z",
      bullets: [0, 1, 2].map(i => ({ text: `Item ${i}`, textZhHK: `消息 ${i}`, refs: [`https://example.org/${i}`] })),
    };
    const before = structuredClone(brief);
    const selected = selectBrief(brief, "zh-HK");
    assert.equal(selected.language, "zh-HK");
    assert.equal(selected.fallback, false);
    assert.deepEqual(selected.bullets.map(b => b.text), ["消息 0", "消息 1", "消息 2"]);
    assert.deepEqual(selected.bullets.map(b => b.refs), brief.bullets.map(b => b.refs));
    assert.deepEqual(brief, before);
    delete brief.bullets[1].textZhHK;
    const fallback = selectBrief(brief, "zh-HK");
    assert.equal(fallback.language, "en");
    assert.equal(fallback.fallback, true);
    assert.deepEqual(fallback.bullets.map(b => b.text), before.bullets.map(b => b.text));
    assert.equal(selectBrief(brief, "en").fallback, false);
  });
});
