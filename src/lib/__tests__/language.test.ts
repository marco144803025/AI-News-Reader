import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSummaryLanguage, selectBrief, selectSummary, validTranslation } from "../language.ts";
import type { Brief } from "../../types.ts";

describe("summary languages", () => {
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
