import Parser from "rss-parser";

/** Fetch and parse one feed with a bounded request lifetime. */
export async function fetchFeed(url: string, timeoutMs = 20_000): Promise<Parser.Output<Parser.Item>> {
  // rss-parser's parseURL rejects on errors/timeouts without closing sockets.
  // Native fetch owns transport so abort covers headers AND the response body.
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "rss-parser", Accept: "application/rss+xml" },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Status code ${response.status}`);
  }
  const xml = await response.text();
  return new Parser().parseString(xml);
}
