import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdditionalSource, Article, NewsData } from "../../types.ts";
import { EMPTY_FILTER } from "../filter.ts";
import { LanguageProvider } from "../../hooks/useLanguage.tsx";
import AdditionalSources from "../../components/AdditionalSources.tsx";
import DailyCover from "../../components/standard/DailyCover.tsx";
import NewsFeed from "../../components/standard/NewsFeed.tsx";
import ClippingRow from "../../components/extra/ClippingRow.tsx";
import LeadClipping from "../../components/extra/LeadClipping.tsx";

// This file lives in src/lib/__tests__ on purpose: `npm test` globs exactly
// ingest/__tests__/*.test.ts and src/lib/__tests__/*.test.ts, so a component
// test filed under a components directory would silently stop running.

const NOW = Date.parse("2026-09-08T06:00:00Z");

const OTHER: AdditionalSource = {
  title: "The Same Launch, Reported Elsewhere",
  url: "https://other.example/story?id=42",
  source: "Other Publisher",
};
const THIRD: AdditionalSource = {
  title: "第三家傳媒的報道",
  url: "https://third.example/hk",
  source: "Third Wire",
};
const UNSAFE: AdditionalSource[] = [
  { title: "Script", url: "javascript:alert(1)", source: "Bad" },
  { title: "Inline", url: "data:text/html,<b>x</b>", source: "Bad" },
  { title: "Credentials", url: "https://user:pass@other.example/story", source: "Bad" },
  { title: "Nonsense", url: "not a url", source: "Bad" },
];

function article(url: string, extras?: AdditionalSource[]): Article {
  return {
    title: "A model ships", url, source: "Source", publishedAt: "2026-09-08T05:00:00Z",
    category: "Model Releases", summary: "A useful summary.", snippet: "", important: true,
    tags: { topics: ["llm"], traits: [], entities: [] },
    ...(extras ? { additionalSources: extras } : {}),
  };
}

function render(element: ReactElement): string {
  return renderToStaticMarkup(createElement(LanguageProvider, null, element));
}

/** Anchors inside anchors are invalid HTML and make one click mean two links. */
function hasNestedAnchor(html: string): boolean {
  let depth = 0;
  for (const token of html.match(/<a[\s>]|<\/a>/g) ?? []) {
    if (token === "</a>") depth = Math.max(0, depth - 1);
    else if (++depth > 1) return true;
  }
  return false;
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("AdditionalSources", () => {
  it("renders nothing when there is nothing safe to credit", () => {
    for (const sources of [undefined, [], UNSAFE]) {
      const html = renderToStaticMarkup(
        createElement(AdditionalSources, { sources, language: "en", edition: "standard" }));
      assert.equal(html, "");
    }
  });

  it("shows the other outlet's own title and name unmodified, localizing only the lead-in", () => {
    const english = renderToStaticMarkup(
      createElement(AdditionalSources, { sources: [OTHER, THIRD], language: "en", edition: "standard" }));
    assert.ok(english.includes("Also reported by"));
    assert.ok(english.includes(OTHER.title) && english.includes(OTHER.source));
    assert.ok(english.includes(THIRD.title) && english.includes(THIRD.source));
    assert.ok(english.includes(`href="${OTHER.url}"`));
    assert.equal(count(english, 'rel="noreferrer"'), 2);
    assert.equal(count(english, 'target="_blank"'), 2);

    const chinese = renderToStaticMarkup(
      createElement(AdditionalSources, { sources: [OTHER], language: "zh-HK", edition: "extra" }));
    assert.ok(chinese.includes("其他來源報道"));
    assert.ok(!chinese.includes("Also reported by"));
    // The English headline is still the publisher's own words, untranslated.
    assert.ok(chinese.includes(OTHER.title));
    assert.ok(chinese.includes("extra-attribution"));
  });

  it("never renders an entry the shared URL guard rejects", () => {
    const html = renderToStaticMarkup(
      createElement(AdditionalSources, { sources: [...UNSAFE, OTHER], language: "en", edition: "standard" }));
    assert.equal(count(html, "<a "), 1);
    for (const bad of UNSAFE) assert.ok(!html.includes(bad.url), bad.url);
  });

  it("escapes publisher text rather than trusting it as markup", () => {
    const html = renderToStaticMarkup(createElement(AdditionalSources, {
      sources: [{ ...OTHER, title: "<script>alert(1)</script>" }], language: "en", edition: "standard" }));
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
  });
});

describe("attribution on the four article surfaces", () => {
  it("credits both notable presentations on the standard cover", () => {
    const data: NewsData = {
      generatedAt: "2026-09-08T06:00:00Z", daysBack: 2, categories: ["Model Releases"],
      articles: [article("https://example.org/a", [OTHER]), article("https://example.org/b", [THIRD])],
    };
    const html = render(createElement(DailyCover, { data, motion: false, onNews: () => {} }));
    assert.equal(count(html, "standard-attribution-label"), 2, "primary and compact spotlight");
    assert.ok(html.includes(OTHER.url) && html.includes(THIRD.url));
    assert.equal(hasNestedAnchor(html), false);
  });

  it("credits standard news rows without nesting the links in the headline link", () => {
    const articles = [article("https://example.org/a", [OTHER, THIRD]), article("https://example.org/b")];
    const html = render(createElement(NewsFeed, {
      articles, scopedArticles: articles, categories: ["Model Releases"],
      counts: new Map([["All", 2]]), state: { ...EMPTY_FILTER }, onChange: () => {},
      page: 0, onPage: () => {}, notableOnly: false, onNotable: () => {}, motion: false,
    }));
    assert.equal(count(html, "standard-attribution-label"), 1, "only the row that has attribution");
    assert.ok(html.includes(OTHER.url) && html.includes(THIRD.url));
    assert.equal(hasNestedAnchor(html), false);
  });

  it("credits the Extra lead clipping", () => {
    const html = render(createElement(LeadClipping, { article: article("https://example.org/a", [OTHER]), now: NOW }));
    assert.equal(count(html, "extra-attribution-label"), 1);
    assert.ok(html.includes(OTHER.url));
    assert.equal(hasNestedAnchor(html), false);
  });

  it("keeps Extra clipping-row credits as siblings of the row link, never inside it", () => {
    const html = render(createElement(ClippingRow, {
      article: article("https://example.org/a", [OTHER, ...UNSAFE]), tilt: 0, now: NOW }));
    assert.equal(hasNestedAnchor(html), false);
    // The row link must close before the first attribution link opens.
    const rowLinkEnd = html.indexOf("</a>");
    assert.ok(rowLinkEnd > 0);
    assert.ok(html.indexOf(OTHER.url) > rowLinkEnd, "attribution follows the row link");
    assert.equal(count(html, "<a "), 2, "the row link plus one safe credit");
    for (const bad of UNSAFE) assert.ok(!html.includes(bad.url), bad.url);
  });

  it("leaves an archived article without attribution exactly as it was", () => {
    for (const element of [
      createElement(ClippingRow, { article: article("https://example.org/a"), tilt: 0, now: NOW }),
      createElement(LeadClipping, { article: article("https://example.org/a"), now: NOW }),
    ]) {
      const html = render(element);
      assert.ok(!html.includes("attribution"), html.slice(0, 120));
    }
  });
});
