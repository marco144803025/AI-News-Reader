import type Parser from "rss-parser";
import type { FeedHealth, RawArticle } from "../src/types.ts";
import { buildFeedHealth, type Feed } from "./lib.ts";
import type { fetchFeed as FetchFeed } from "./feeds.ts";
import { isTopicallyRelevant } from "./source-selection.ts";

/** One feed's verdict for one run. Exactly one outcome per configured feed. */
export type FeedOutcome =
  | { feed: Feed; status: "ok"; items: RawArticle[]; attempts: number; fetchedAt: string }
  | { feed: Feed; status: "failed"; error: string; attempts: number }
  | { feed: Feed; status: "cancelled"; attempts: number } // deadline hit in flight
  | { feed: Feed; status: "not-attempted" }; // deadline hit before start

export type FeedCounters = {
  /** Items present in the parsed feed, before any filter. */
  fetched: number;
  /** Items admitted into `items`, after every filter and the arXiv cap. */
  eligible: number;
  /** Dropped by the arXiv relevance filter or the general-feed topical filter. */
  excludedTopical: number;
  /** Dropped because the publish date is missing, unparseable, stale or future. */
  excludedDate: number;
  /** Fetch attempts spent on this feed in this run. */
  attempts: number;
};

export type CollectionResult = {
  outcomes: FeedOutcome[]; // configuration order, always
  counters: Record<string, FeedCounters>;
};

export type CollectFeedsDeps = {
  feeds: Feed[];
  /** Frozen run clock. Every date decision in this stage reads it, never `Date.now()`. */
  now: Date;
  /**
   * Freshness window in days, already widened by the catch-up rule.
   *
   * NOTE: plan §5.2 omits this from the dependency list, but §5.3 requires the
   * existing catch-up window and the collector has no access to the archive
   * that determines it. The orchestrator computes it and passes it in.
   */
  daysBack: number;
  fetchFeed: typeof FetchFeed;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>; // abortable; defaults to abortableSleep
  log: (line: string) => void;
  workers?: number; // default 4
  deadlineMs?: number; // default 120_000
};

const DEFAULT_WORKERS = 4;
const DEFAULT_DEADLINE_MS = 120_000;
const PER_ATTEMPT_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
/** Backoff before attempt 2 and attempt 3 respectively. */
const BACKOFF_MS = [1_000, 2_000];
const MAX_RETRY_AFTER_MS = 30_000;
const ARXIV_CAP = 15;
/**
 * Publisher clocks and timezone handling are routinely a little ahead. An hour
 * absorbs that while still rejecting dates that cannot be real, which are
 * skipped rather than restamped with the run clock.
 */
const FUTURE_SKEW_MS = 60 * 60 * 1000;

const ARXIV_KEYWORDS = [
  "llm",
  "agent",
  "reasoning",
  "multimodal",
  "benchmark",
  "fine-tun",
  "mcp",
  "alignment",
  "rlhf",
  "transformer",
  "language model",
  "diffusion",
  "foundation model",
  "instruction",
  "prompt",
  "rag",
  "retrieval",
];

/** Production sleep: resolves after `ms`, rejects as soon as `signal` aborts. */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function abortReason(signal: AbortSignal | undefined): Error {
  const reason = signal?.reason;
  return reason instanceof Error ? reason : new Error("Sleep aborted");
}

/**
 * Fetch every configured feed under one collection deadline and return one
 * outcome per feed in configuration order.
 */
export async function collectFeeds(deps: CollectFeedsDeps): Promise<CollectionResult> {
  const workerCount = Math.max(1, deps.workers ?? DEFAULT_WORKERS);
  const deadlineMs = deps.deadlineMs ?? DEFAULT_DEADLINE_MS;

  const counters: Record<string, FeedCounters> = {};
  for (const feed of deps.feeds) {
    counters[feed.name] = {
      fetched: 0,
      eligible: 0,
      excludedTopical: 0,
      excludedDate: 0,
      attempts: 0,
    };
  }

  const controller = new AbortController();
  const startedAt = Date.now();
  const deadlineTimer = setTimeout(() => {
    controller.abort(new Error("Feed collection deadline reached"));
  }, deadlineMs);
  const remainingMs = (): number => Math.max(0, deadlineMs - (Date.now() - startedAt));

  // Sparse until every worker has finished; whatever is still missing was never
  // started because the deadline fired first.
  const outcomes = new Array<FeedOutcome | undefined>(deps.feeds.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    // JavaScript's single-threaded turn semantics make this shared index safe:
    // the read-increment pair cannot be interleaved by another worker.
    while (!controller.signal.aborted) {
      const index = nextIndex++;
      if (index >= deps.feeds.length) return;
      const feed = deps.feeds[index];
      outcomes[index] = await collectOne(feed, counters[feed.name], deps, controller.signal, remainingMs);
    }
  };

  try {
    await Promise.all(Array.from({ length: workerCount }, worker));
  } finally {
    clearTimeout(deadlineTimer);
  }

  const finalOutcomes: FeedOutcome[] = deps.feeds.map((feed, index) => {
    const outcome = outcomes[index];
    if (outcome) return outcome;
    deps.log(`feed "${feed.name}" not-attempted (collection deadline, health unchanged)`);
    return { feed, status: "not-attempted" };
  });

  const tally = { ok: 0, failed: 0, cancelled: 0, "not-attempted": 0 };
  for (const outcome of finalOutcomes) tally[outcome.status]++;
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  deps.log(
    `collection: ${finalOutcomes.length} feeds, ${tally.ok} ok, ${tally.failed} failed, ` +
      `${tally.cancelled} cancelled, ${tally["not-attempted"]} not-attempted, ${elapsedSeconds}s`,
  );

  return { outcomes: finalOutcomes, counters };
}

async function collectOne(
  feed: Feed,
  counters: FeedCounters,
  deps: CollectFeedsDeps,
  signal: AbortSignal,
  remainingMs: () => number,
): Promise<FeedOutcome> {
  let attempts = 0;
  let lastKind = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal.aborted) break;
    attempts++;
    counters.attempts++;

    try {
      const parsed = await deps.fetchFeed(feed.url, PER_ATTEMPT_TIMEOUT_MS, { signal });
      const selection = selectItems(feed, parsed, counters, deps.now, deps.daysBack);
      deps.log(okLine(feed, attempts, counters, selection, lastKind));
      // The frozen run clock timestamps the success too, so one run produces one
      // consistent set of health timestamps rather than a 120s-wide spread.
      return { feed, status: "ok", items: selection.items, attempts, fetchedAt: deps.now.toISOString() };
    } catch (err) {
      const failure = classifyFailure(err);

      // The stage was cancelled. This feed produced no verdict, so it must not
      // be recorded as a publisher failure.
      if (failure.kind === "aborted") break;

      lastKind = failure.kind;

      if (!failure.retryable) {
        return fail(feed, attempts, failure.message, deps.log);
      }
      if (attempt === MAX_ATTEMPTS) {
        return fail(feed, attempts, failure.message, deps.log);
      }

      const sleep = deps.sleep ?? abortableSleep;
      // `??` is not enough here: a server can answer `Retry-After: 0`, and zero
      // is not nullish. Honouring it literally fires three requests back to
      // back at something that just rate-limited us — the behaviour that got a
      // previous source WAF-blocked. Only a positive delay overrides our own.
      const retryAfterMs = failure.retryAfterMs;
      const waitMs =
        retryAfterMs !== undefined && retryAfterMs > 0
          ? retryAfterMs
          : BACKOFF_MS[attempt - 1];
      if (waitMs > MAX_RETRY_AFTER_MS || waitMs > remainingMs()) {
        // The publisher answered with a real error; we simply have no budget to
        // ask again. That is still a failure, not a cancellation.
        return fail(
          feed,
          attempts,
          `${failure.message} (no retry budget for a ${Math.round(waitMs / 1000)}s wait)`,
          deps.log,
        );
      }

      try {
        await sleep(waitMs, signal);
      } catch (sleepErr) {
        if (signal.aborted) break;
        throw sleepErr; // a sleep that fails for any other reason is a bug, not a feed problem
      }
    }
  }

  if (attempts === 0) {
    deps.log(`feed "${feed.name}" not-attempted (collection deadline, health unchanged)`);
    return { feed, status: "not-attempted" };
  }
  deps.log(`feed "${feed.name}" cancelled attempts=${attempts} (collection deadline, health unchanged)`);
  return { feed, status: "cancelled", attempts };
}

function fail(
  feed: Feed,
  attempts: number,
  error: string,
  log: (line: string) => void,
): FeedOutcome {
  log(`feed "${feed.name}" failed attempts=${attempts} error=${error}`);
  return { feed, status: "failed", error, attempts };
}

type Failure = {
  kind: string;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
};

/**
 * Read the structured fields `fetchFeed` attaches. An error without them came
 * from somewhere that is not the transport, so it is treated as terminal: a
 * programming fault must surface immediately rather than hide behind retries.
 */
function classifyFailure(err: unknown): Failure {
  const candidate = err as { kind?: unknown; status?: unknown; retryAfterMs?: unknown };
  const kind = typeof candidate?.kind === "string" ? candidate.kind : "unknown";
  const message = err instanceof Error ? err.message : String(err);
  const retryAfterMs =
    typeof candidate?.retryAfterMs === "number" ? candidate.retryAfterMs : undefined;

  if (kind === "aborted") return { kind, message, retryable: false };
  if (kind === "transport") return { kind, message, retryable: true, retryAfterMs };
  if (kind === "http") {
    const status = typeof candidate?.status === "number" ? candidate.status : 0;
    const transient = status === 408 || status === 429 || status >= 500;
    return { kind, message, retryable: transient, retryAfterMs };
  }
  return { kind, message, retryable: false };
}

type Selection = {
  items: RawArticle[];
  malformed: number;
  arxivTrimmed: number;
};

/**
 * Whether a feed's `<link>` can be used as an article URL.
 *
 * NOTE: this guard is load-bearing, and its absence was a real defect. A feed
 * may publish a relative link, or a `mailto:` / `javascript:` / `tag:` one.
 * A relative link makes canonicalUrlKey throw and aborts the entire run, losing
 * the other nineteen feeds' work; a parseable non-HTTP one survives all the way
 * into news.json, where the browser parser rejects the WHOLE payload and every
 * reader sees an error page while the ingest run still reports success. Same
 * bar as validateFeeds applies to feed URLs: absolute http(s), no credentials.
 */
function isUsableArticleUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return !parsed.username && !parsed.password;
}

function selectItems(
  feed: Feed,
  parsed: Parser.Output<Parser.Item>,
  counters: FeedCounters,
  now: Date,
  daysBack: number,
): Selection {
  const nowMs = now.getTime();
  const cutoff = nowMs - daysBack * 24 * 60 * 60 * 1000;
  const futureLimit = nowMs + FUTURE_SKEW_MS;
  const isArxiv = feed.name.toLowerCase().includes("arxiv");
  const isGeneral = feed.scope === "general";

  const accepted: RawArticle[] = [];
  let malformed = 0;
  counters.fetched += parsed.items.length;

  for (const item of parsed.items) {
    const url = item.link;
    const title = item.title?.trim();
    if (!url || !title || !isUsableArticleUrl(url)) {
      malformed++;
      continue;
    }

    const dateStr = item.isoDate ?? item.pubDate;
    const ts = dateStr ? Date.parse(dateStr) : NaN;
    // NOTE: an item we cannot date is skipped, never stamped with the run clock.
    // Dating old content as new would fabricate a publish date (Constitution 16).
    if (!Number.isFinite(ts) || ts < cutoff || ts > futureLimit) {
      counters.excludedDate++;
      continue;
    }

    const snippet = stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? "").slice(0, 600);

    if (isArxiv && !isArxivRelevant(title, snippet)) {
      counters.excludedTopical++;
      continue;
    }
    if (isGeneral && !isTopicallyRelevant(title, snippet)) {
      counters.excludedTopical++;
      continue;
    }

    accepted.push({
      title,
      url,
      source: feed.name,
      publishedAt: new Date(ts).toISOString(),
      snippet,
    });
  }

  const items = isArxiv ? accepted.slice(0, ARXIV_CAP) : accepted;
  counters.eligible += items.length;
  return { items, malformed, arxivTrimmed: accepted.length - items.length };
}

function okLine(
  feed: Feed,
  attempts: number,
  counters: FeedCounters,
  selection: Selection,
  lastKind: string,
): string {
  let line =
    `feed "${feed.name}" ok attempts=${attempts} fetched=${counters.fetched} ` +
    `eligible=${counters.eligible} excludedTopical=${counters.excludedTopical} ` +
    `excludedDate=${counters.excludedDate}`;
  // Items that are dropped for neither reason still have to be visible; a silent
  // gap between fetched and eligible is the disguised failure rule 15 forbids.
  if (selection.malformed > 0) line += ` malformed=${selection.malformed}`;
  if (selection.arxivTrimmed > 0) line += ` arxivTrimmed=${selection.arxivTrimmed}`;
  if (attempts > 1) line += ` (retried after ${lastKind} error)`;
  return line;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isArxivRelevant(title: string, snippet: string): boolean {
  const text = (title + " " + snippet).toLowerCase();
  return ARXIV_KEYWORDS.some((k) => text.includes(k));
}

/**
 * Turn one run's outcomes into feed health.
 *
 * `ok` resets the consecutive-failure count, `failed` adds exactly one, and
 * `cancelled`/`not-attempted` record neither a success nor an error so the
 * previous entry is carried through untouched. A feed the deadline interrupted
 * has not failed, and must never inflate the failure count the Trends page shows.
 */
export function feedHealthFromOutcomes(
  outcomes: FeedOutcome[],
  prevHealth: Record<string, FeedHealth> | undefined,
): Record<string, FeedHealth> {
  const successAt: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const outcome of outcomes) {
    if (outcome.status === "ok") successAt[outcome.feed.name] = outcome.fetchedAt;
    else if (outcome.status === "failed") errors[outcome.feed.name] = outcome.error;
  }
  return buildFeedHealth(
    outcomes.map((outcome) => outcome.feed),
    successAt,
    errors,
    prevHealth,
  );
}
