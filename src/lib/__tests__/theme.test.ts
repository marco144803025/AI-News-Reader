import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isExtraEnabled, resolveTheme } from "../theme.ts";

describe("resolveTheme", () => {
  it("disables Extra for every value except the exact public true string", () => {
    for (const flag of [undefined, null, false, true, "false", "", "TRUE", " true ", "1"]) {
      assert.equal(isExtraEnabled(flag), false);
      for (const url of [null, "classic", "extra", "unknown"]) {
        assert.equal(resolveTheme(url, "extra", isExtraEnabled(flag)), "classic");
      }
    }
    assert.equal(isExtraEnabled("true"), true);
    assert.equal(resolveTheme("extra", "extra"), "classic");
  });
  it("defaults to classic with no signals", () => {
    assert.equal(resolveTheme(null, null), "classic");
  });

  it("reads the stored preference", () => {
    assert.equal(resolveTheme(null, "extra", true), "extra");
    assert.equal(resolveTheme(null, "classic", true), "classic");
  });

  it("lets the URL param win over the stored preference", () => {
    assert.equal(resolveTheme("classic", "extra", true), "classic");
    assert.equal(resolveTheme("extra", "classic", true), "extra");
  });

  it("ignores unrecognized values at each level", () => {
    assert.equal(resolveTheme("neon", null, true), "classic");
    assert.equal(resolveTheme("neon", "extra", true), "extra");
    assert.equal(resolveTheme(null, "garbage", true), "classic");
    assert.equal(resolveTheme("", "", true), "classic");
  });
});
