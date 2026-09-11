import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { abortableSleep, collectFeeds, type CollectionResult, type FeedOutcome } from "./feed-collection.ts";
import { fetchFeed } from "./feeds.ts";
import { DAYS_BACK, type Feed } from "./lib.ts";

/**
 * `npm run sources:preview` — a reachability and relevance check.
 *
 * Read-only by construction: this module imports no secret loader, no model
 * client and no filesystem write API. It fetches the configured feeds, applies
 * the same date and topical filters the pipeline applies, and prints what each
 * source would have contributed. It is not an end-to-end paid ingest.
 */

const SAMPLES_PER_SOURCE = 3;
const NAME_COLUMN = 24;

export type PreviewDeps = {
  feeds: Feed[];
  now: Date;
  daysBack: number;
  fetchFeed: typeof fetchFeed;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  log: (line: string) => void;
  samplesPerSource?: number;
};

export async function previewSources(deps: PreviewDeps): Promise<CollectionResult> {
  const result = await collectFeeds({
    feeds: deps.feeds,
    now: deps.now,
    daysBack: deps.daysBack,
    fetchFeed: deps.fetchFeed,
    sleep: deps.sleep,
    log: deps.log,
  });

  const samples = deps.samplesPerSource ?? SAMPLES_PER_SOURCE;
  deps.log("");
  deps.log(
    `preview window: ${deps.daysBack} day(s) back from ${deps.now.toISOString()}`,
  );
  deps.log(
    `${"source".padEnd(NAME_COLUMN)} status         attempted eligible excludedTopical excludedDate`,
  );

  for (const outcome of result.outcomes) {
    const counters = result.counters[outcome.feed.name];
    deps.log(
      `${outcome.feed.name.padEnd(NAME_COLUMN)} ${outcome.status.padEnd(14)} ` +
        `${String(counters.attempts).padStart(9)} ${String(counters.eligible).padStart(8)} ` +
        `${String(counters.excludedTopical).padStart(15)} ${String(counters.excludedDate).padStart(12)}`,
    );
    for (const line of sampleLines(outcome, samples)) deps.log(line);
  }

  return result;
}

function sampleLines(outcome: FeedOutcome, samples: number): string[] {
  if (outcome.status === "failed") return [`    error: ${outcome.error}`];
  if (outcome.status !== "ok") return [];
  if (outcome.items.length === 0) return ["    (no eligible items in this window)"];
  return outcome.items
    .slice(0, samples)
    .map((item) => `    - ${item.title}`);
}

/**
 * Optional `--days=N` widens the sample window. Low-volume sources publish
 * nothing on most days, so the production one-day window alone cannot show
 * whether a feed is reachable and topical.
 */
function parseDaysBack(argv: string[]): number {
  const flag = argv.find((arg) => arg.startsWith("--days="));
  if (!flag) return DAYS_BACK;
  const value = Number(flag.slice("--days=".length));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid --days value: ${flag.slice("--days=".length)}. Expected a positive integer.`);
  }
  return value;
}

async function main(): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const feeds = JSON.parse(await readFile(join(root, "feeds.json"), "utf-8")) as Feed[];
  await previewSources({
    feeds,
    now: new Date(),
    daysBack: parseDaysBack(process.argv.slice(2)),
    fetchFeed,
    sleep: abortableSleep,
    log: (line) => console.log(line),
  });
}

// NOTE: the main-module check is inlined rather than imported from deepseek.ts
// so that nothing in this command's import graph can reach a model client.
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
