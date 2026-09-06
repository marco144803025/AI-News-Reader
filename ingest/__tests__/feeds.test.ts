import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";

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
