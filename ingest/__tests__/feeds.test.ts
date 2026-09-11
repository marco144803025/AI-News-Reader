import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { fetchFeed, FeedFetchError } from "../feeds.ts";

const run = promisify(execFile);
const rss = '<rss version="2.0"><channel><title>Test</title><item><title>News</title><link>https://example.org/news</link></item></channel></rss>';

describe("feed request cleanup", () => {
  for (const scenario of ["success", "error", "redirect", "timeout"]) {
    it(`settles and lets the ingest process exit after ${scenario}`, async () => {
      // The server lives in the parent. Only a leaked client connection can
      // keep the child alive after its feed promise has already settled.
      const server = createServer((request, response) => {
        if (request.url === "/success") {
          response.end(rss);
        } else if (request.url === "/redirect") {
          response.writeHead(302, { Location: "/success" });
          response.flushHeaders();
        } else if (request.url === "/error") {
          response.writeHead(429);
          response.write("rate limited");
        } else {
          response.writeHead(200);
          response.write("<rss>");
        }
        // Deliberately leave the other bodies open: production feeds can do
        // this on a redirect, error page, or interrupted response.
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert(address && typeof address !== "string");
      try {
        const script = `
          import { fetchFeed } from './ingest/feeds.ts';
          try {
            const result = await fetchFeed(${JSON.stringify(`http://127.0.0.1:${address.port}/${scenario}`)}, 200);
            console.log('articles=' + result.items.length);
          } catch { console.log('feed rejected'); }
        `;
        const { stdout } = await run(process.execPath,
          ["--import", "tsx", "--input-type=module", "-e", script],
          { timeout: 5_000, env: { ...process.env, DOTENV_CONFIG_PATH: "missing-test-env" } });
        assert.match(stdout, scenario === "success" || scenario === "redirect" ? /articles=1/ : /feed rejected/);
      } finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
      }
    });
  }
});

/** An always-failing transport doubles as proof that fetchFeed never retries. */
function countingFetch(respond: (url: string, init?: RequestInit) => Promise<Response>) {
  const calls: string[] = [];
  const impl: typeof fetch = async (input, init) => {
    calls.push(String(input));
    return respond(String(input), init);
  };
  return { impl, calls };
}

describe("fetchFeed structured failures", () => {
  it("uses the injected transport instead of the global fetch", async () => {
    const { impl, calls } = countingFetch(async () => new Response(rss, { status: 200 }));

    const result = await fetchFeed("https://example.org/feed", 5_000, { fetchImpl: impl });

    assert.deepEqual(calls, ["https://example.org/feed"]);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].title, "News");
  });

  it("reports the caller's cancellation as aborted, not as a transport error", async () => {
    const controller = new AbortController();
    const impl: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("The operation was aborted")), {
          once: true,
        });
      });

    const pending = fetchFeed("https://example.org/feed", 5_000, { fetchImpl: impl, signal: controller.signal });
    controller.abort();

    await assert.rejects(pending, (err: FeedFetchError) => {
      assert.equal(err.kind, "aborted");
      return true;
    });
  });

  it("reports transport failures once, without retrying", async () => {
    const { impl, calls } = countingFetch(async () => {
      throw new TypeError("fetch failed");
    });

    await assert.rejects(fetchFeed("https://example.org/feed", 5_000, { fetchImpl: impl }), (err: FeedFetchError) => {
      assert.equal(err.kind, "transport");
      assert.equal(err.status, undefined);
      return true;
    });
    assert.equal(calls.length, 1, "retry policy belongs to the collector, never here");
  });

  it("reports HTTP failures with status and a valid Retry-After, and releases the body", async () => {
    let cancelled = false;
    const { impl } = countingFetch(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("rate limited"));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { status: 503, headers: { "Retry-After": "30" } },
        ),
    );

    await assert.rejects(fetchFeed("https://example.org/feed", 5_000, { fetchImpl: impl }), (err: FeedFetchError) => {
      assert.equal(err.kind, "http");
      assert.equal(err.status, 503);
      assert.equal(err.retryAfterMs, 30_000);
      assert.equal(err.message, "HTTP 503");
      return true;
    });
    assert.equal(cancelled, true, "an error body must not be left open");
  });

  it("accepts an HTTP-date Retry-After and ignores an unparseable one", async () => {
    const dated = countingFetch(
      async () =>
        new Response("nope", {
          status: 429,
          headers: { "Retry-After": new Date(Date.now() + 10_000).toUTCString() },
        }),
    );
    await assert.rejects(fetchFeed("https://example.org/feed", 5_000, { fetchImpl: dated.impl }), (err: FeedFetchError) => {
      assert.ok(err.retryAfterMs !== undefined && err.retryAfterMs > 8_000 && err.retryAfterMs <= 11_000, `got ${err.retryAfterMs}`);
      return true;
    });

    const junk = countingFetch(async () => new Response("nope", { status: 429, headers: { "Retry-After": "soon" } }));
    await assert.rejects(fetchFeed("https://example.org/feed", 5_000, { fetchImpl: junk.impl }), (err: FeedFetchError) => {
      assert.equal(err.retryAfterMs, undefined, "a header we cannot read is absent, not guessed");
      return true;
    });
  });

  it("reports an unparseable body as a parse failure", async () => {
    const { impl, calls } = countingFetch(async () => new Response("<rss>", { status: 200 }));

    await assert.rejects(fetchFeed("https://example.org/feed", 5_000, { fetchImpl: impl }), (err: FeedFetchError) => {
      assert.equal(err.kind, "parse");
      assert.match(err.message, /^Unparseable feed: /);
      return true;
    });
    assert.equal(calls.length, 1);
  });
});
