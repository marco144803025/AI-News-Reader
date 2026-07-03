import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BRIEF_INPUT_CAP,
  buildBriefPrompt,
  carryForwardBrief,
  parseBriefResponse,
  selectBriefInput,
} from "../lib.ts";
import type { Article, NewsData } from "../../src/types.ts";

function makeArticle(
  url: string,
  publishedAt: string,
  important = false,
  title = `Title ${url}`
): Article {
  return {
    title,
    url,
    source: "src",
    publishedAt,
    snippet: "",
    category: "Research",
    summary: `Summary of ${url}`,
    important,
  };
}

describe("selectBriefInput", () => {
  it("puts important articles first, each group newest-first", () => {
    const a = makeArticle("a", "2026-07-02T09:00:00Z");
    const b = makeArticle("b", "2026-07-02T08:00:00Z", true);
    const c = makeArticle("c", "2026-07-02T10:00:00Z", true);
    const d = makeArticle("d", "2026-07-02T11:00:00Z");
    assert.deepEqual(
      selectBriefInput([a, b, c, d]).map((x) => x.url),
      ["c", "b", "d", "a"]
    );
  });

  it("caps the input while keeping importants visible", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      makeArticle(`u${i}`, `2026-07-02T00:${String(i).padStart(2, "0")}:00Z`, i >= 58)
    );
    const selected = selectBriefInput(many);
    assert.equal(selected.length, BRIEF_INPUT_CAP);
    assert.equal(selected[0].important, true);
    assert.equal(selected[1].important, true);
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
    assert.ok(user.includes("2 new articles"));
    assert.ok(system.includes("JSON array"));
  });
});

describe("parseBriefResponse", () => {
  const inputs = [
    makeArticle("https://x/a", "2026-07-02T09:00:00Z"),
    makeArticle("https://x/b", "2026-07-02T08:00:00Z"),
    makeArticle("https://x/c", "2026-07-02T07:00:00Z"),
  ];

  it("parses bullets and resolves refs to URLs", () => {
    const text =
      'Here is the brief:\n[{"text":"One","refs":[0,2]},{"text":"Two","refs":[1]},{"text":"Three","refs":[]}]';
    const bullets = parseBriefResponse(text, inputs);
    assert.equal(bullets.length, 3);
    assert.deepEqual(bullets[0].refs, ["https://x/a", "https://x/c"]);
    assert.deepEqual(bullets[2].refs, []);
  });

  it("drops out-of-range, duplicate, and non-integer refs", () => {
    const text =
      '[{"text":"One","refs":[0,0,7,-1,1.5]},{"text":"Two","refs":[1]},{"text":"Three","refs":[2]}]';
    const bullets = parseBriefResponse(text, inputs);
    assert.deepEqual(bullets[0].refs, ["https://x/a"]);
  });

  it("skips bullets with empty text, then enforces the 3-5 bound", () => {
    const ok =
      '[{"text":""},{"text":"One","refs":[0]},{"text":"Two"},{"text":"Three"},{"text":"Four"}]';
    assert.equal(parseBriefResponse(ok, inputs).length, 4);

    const tooFew = '[{"text":"One"},{"text":""},{"text":"Two"}]';
    assert.throws(() => parseBriefResponse(tooFew, inputs), /valid bullets/);

    const tooMany =
      '[{"text":"1"},{"text":"2"},{"text":"3"},{"text":"4"},{"text":"5"},{"text":"6"}]';
    assert.throws(() => parseBriefResponse(tooMany, inputs), /valid bullets/);
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
      brief: { generatedAt: "2026-07-01T06:00:00Z", bullets: [] },
    } as unknown as NewsData;
    assert.equal(carryForwardBrief(data), data.brief);
  });
});
