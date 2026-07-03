import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveTheme } from "../theme.ts";

describe("resolveTheme", () => {
  it("defaults to classic with no signals", () => {
    assert.equal(resolveTheme(null, null), "classic");
  });

  it("reads the stored preference", () => {
    assert.equal(resolveTheme(null, "extra"), "extra");
    assert.equal(resolveTheme(null, "classic"), "classic");
  });

  it("lets the URL param win over the stored preference", () => {
    assert.equal(resolveTheme("classic", "extra"), "classic");
    assert.equal(resolveTheme("extra", "classic"), "extra");
  });

  it("ignores unrecognized values at each level", () => {
    assert.equal(resolveTheme("neon", null), "classic");
    assert.equal(resolveTheme("neon", "extra"), "extra");
    assert.equal(resolveTheme(null, "garbage"), "classic");
    assert.equal(resolveTheme("", ""), "classic");
  });
});
