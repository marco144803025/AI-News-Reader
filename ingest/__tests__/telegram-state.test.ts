import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GitHubStateStore, parseState, StateConflict, type DeliveryState } from "../telegram-state.ts";

const state: DeliveryState = { version: 1, attempts: [{ id: "11111111-1111-4111-8111-111111111111", date: "2026-09-06", briefId: "a".repeat(64), status: "pending", updatedAt: "2026-09-06T06:00:00.000Z" }] };
const sha = "b".repeat(40);

describe("GitHub delivery-state adapter", () => {
  it("reserves only against the current file SHA and excludes secrets from state", async () => {
    let puts = 0;
    const store = new GitHubStateStore("owner/repo", "test-github-secret", async (input, init) => {
      const req = new Request(input, init);
      assert.equal(req.url, "https://api.github.com/repos/owner/repo/contents/.delivery/telegram.json");
      assert.equal(req.headers.get("Authorization"), "Bearer test-github-secret");
      if (req.method === "GET") return Response.json({ type: "file", sha, encoding: "base64", content: Buffer.from(JSON.stringify({ version: 1, attempts: [] })).toString("base64") });
      puts++;
      const body = await req.json();
      assert.equal(body.sha, sha);
      assert.deepEqual(JSON.parse(Buffer.from(body.content, "base64").toString()), state);
      assert.doesNotMatch(JSON.stringify(body), /test-github-secret|chat_id|BOT_TOKEN/);
      return Response.json({ content: { sha: "c".repeat(40) } });
    });
    const saved = await store.save(await store.read(), state);
    assert.equal(saved.sha, "c".repeat(40)); assert.equal(puts, 1);
  });

  it("initial creation has no SHA, and conflicts never masquerade as success", async () => {
    for (const code of [409, 422]) {
      const store = new GitHubStateStore("owner/repo", "test", async (_input, init) => {
        if (init?.method === "GET") return new Response("", { status: 404 });
        assert.equal(JSON.parse(init?.body as string).sha, undefined);
        return new Response("", { status: code });
      });
      await assert.rejects(store.save(await store.read(), state), StateConflict);
    }
  });

  it("fails closed on malformed state, schemas and ambiguous network writes", async () => {
    for (const value of [{}, { ...state, version: 2 }, { ...state, token: "secret" }, { version: 1, attempts: [{ ...state.attempts[0], status: "unknown" }] }, { version: 1, attempts: [state.attempts[0], state.attempts[0]] }]) {
      assert.throws(() => parseState(value));
    }
    const store = new GitHubStateStore("owner/repo", "secret", async () => { throw new Error("https://secret-url"); });
    await assert.rejects(store.save({ sha: null, state: { version: 1, attempts: [] } }, state), error => {
      assert.doesNotMatch(String(error), /secret-url/); return true;
    });
    const bad = new GitHubStateStore("owner/repo", "test", async () => Response.json({ type: "file", sha, encoding: "base64", content: Buffer.from("corrupt").toString("base64") }));
    await assert.rejects(bad.read(), /not valid JSON/);
    const missingAck = new GitHubStateStore("owner/repo", "test", async () => Response.json({}));
    await assert.rejects(missingAck.save({ sha: null, state: { version: 1, attempts: [] } }, state), /uncertain/);
  });
});
