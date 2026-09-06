import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import OpenAI from "openai";
import { completeText, createDeepSeekClient, safePipelineError, CLASSIFY_MODEL, BRIEF_MODEL } from "../deepseek.ts";
import { classifyBatch, generateBrief } from "../ingest.ts";
import { withRetry } from "../lib.ts";

function completion(content: unknown, finish = "stop"): Response {
  return Response.json({ choices: [{ finish_reason: finish, message: { content } }] });
}
const article = { title: "Model release", url: "https://example.org/model", source: "Example", publishedAt: "2026-09-06T06:00:00Z", snippet: "Public article excerpt", category: "Model Releases", summary: "A new model." };

describe("DeepSeek provider", () => {
  it("sends correct endpoint, disabled thinking and limits; preserves classification and brief shapes", async () => {
    const bodies: Record<string, unknown>[] = [];
    const client = createDeepSeekClient("fake-test-key", async (input, init) => {
      const request = new Request(input, init);
      assert.equal(request.url, "https://api.deepseek.com/chat/completions");
      assert.equal(request.headers.get("Authorization"), "Bearer fake-test-key");
      const body = await request.json(); bodies.push(body);
      assert.deepEqual(body.thinking, { type: "disabled" });
      assert.equal(body.stream, false);
      assert.equal(body.response_format, undefined);
      return completion(body.model === CLASSIFY_MODEL
        ? JSON.stringify([{ index: 0, category: "Model Releases", summary: "New capability.", important: true, tags: ["open-source", "llm"] }])
        : JSON.stringify([0, 1, 2].map(index => ({ text: `Development ${index}`, refs: [index] }))));
    });
    assert.equal(client.maxRetries, 0);
    const classified = await classifyBatch(client, [article]);
    assert.equal(classified[0].summary, "New capability.");
    assert.deepEqual(classified[0].tags, { topics: ["llm"], traits: ["open-source"], entities: [] });
    const articles = [0, 1, 2].map(index => ({ ...article, url: `https://example.org/${index}` }));
    const brief = await generateBrief(client, articles);
    assert.deepEqual(brief.bullets.map(bullet => bullet.refs), articles.map(item => [item.url]));
    assert.equal(bodies[0].max_tokens, 4096);
    assert.equal(bodies[1].model, BRIEF_MODEL);
    assert.equal(bodies[1].max_tokens, 2000);
  });

  it("rejects empty, truncated and malformed model outputs", async () => {
    for (const [text, finish] of [["", "stop"], [null, "stop"], ["[]", "length"]]) {
      const client = createDeepSeekClient("fake-test-key", async () => completion(text, finish as string));
      await assert.rejects(completeText(client, CLASSIFY_MODEL, "system", "user", 10));
    }
    for (const text of ["not JSON", "[null]", '[{"index":0,"category":42,"summary":"x"}]']) {
      const client = createDeepSeekClient("fake-test-key", async () => completion(text));
      await assert.rejects(classifyBatch(client, [article]));
    }
  });

  it("makes exactly one SDK attempt on a 401 and sanitizes errors", async () => {
    let calls = 0;
    const client = createDeepSeekClient("fake-test-key", async () => {
      calls++;
      return Response.json({ error: { message: "fake-secret-in-remote-error" } }, { status: 401 });
    });
    try { await withRetry(() => completeText(client, CLASSIFY_MODEL, "a", "b", 10)); assert.fail("must reject"); }
    catch (error) {
      assert.match(safePipelineError(error), /DEEPSEEK_API_KEY/);
      assert.doesNotMatch(safePipelineError(error), /fake-secret/);
    }
    assert.equal(calls, 1);
    assert.doesNotMatch(safePipelineError(new Error("fake-secret")), /fake-secret/);
  });

  it("handles invalid and excessive retry-after without unbounded waits", async () => {
    for (const header of ["NaN", "-1", "Infinity", "120"]) {
      const delays: number[] = [];
      let calls = 0;
      const error = new OpenAI.RateLimitError(429, {}, "unsafe remote body", new Headers({ "retry-after": header }));
      await assert.rejects(withRetry(async () => { calls++; throw error; }, {
        maxRetries: 1, sleep: async ms => { delays.push(ms); },
      }));
      assert.equal(calls, header === "120" ? 1 : 2);
      assert(delays.every(ms => Number.isFinite(ms) && ms <= 60_000));
    }
  });

  it("missing key and imports cannot modify the archive or start ingestion", () => {
    const before = readFileSync("public/news.json");
    const env = { ...process.env, DEEPSEEK_API_KEY: "", DOTENV_CONFIG_PATH: "nonexistent-test-env" };
    for (const file of ["ingest/ingest.ts", "ingest/backfill.ts"]) {
      const child = spawnSync(process.execPath, ["--import", "tsx", file], { env, encoding: "utf8" });
      assert.equal(child.status, 1, child.stderr);
      assert.match(child.stderr, /DEEPSEEK_API_KEY/);
      assert.equal(child.stdout, "");
    }
    const imported = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
      "globalThis.fetch=()=>{throw new Error('NETWORK FORBIDDEN')}; await import('./ingest/ingest.ts'); await import('./ingest/backfill.ts'); console.log('imports only');"],
      { env: { ...env, RETENTION_DAYS: "invalid" }, encoding: "utf8" });
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(imported.stdout.trim(), "imports only");
    assert.deepEqual(readFileSync("public/news.json"), before);
  });
});
