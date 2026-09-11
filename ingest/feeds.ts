import Parser from "rss-parser";

/**
 * Why a failure happened, so the caller can decide whether another attempt
 * could plausibly succeed. The transport never decides that itself.
 *
 * - `transport`  — the request never produced a response (DNS, reset, own timeout).
 * - `http`       — a response arrived carrying a non-2xx status.
 * - `parse`      — the body arrived but is not a feed this parser accepts.
 * - `aborted`    — the caller's own signal cancelled the request.
 */
export type FeedErrorKind = "transport" | "http" | "parse" | "aborted";

/** A fetch failure with enough structure to classify without string matching. */
export class FeedFetchError extends Error {
  readonly kind: FeedErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    init: { kind: FeedErrorKind; status?: number; retryAfterMs?: number; cause?: unknown },
  ) {
    super(message, { cause: init.cause });
    this.name = "FeedFetchError";
    this.kind = init.kind;
    this.status = init.status;
    this.retryAfterMs = init.retryAfterMs;
  }
}

export type FetchFeedOptions = {
  /** Injected transport, so collection and preview can run without a network. */
  fetchImpl?: typeof fetch;
  /** Caller-owned cancellation, e.g. a collection-stage deadline. */
  signal?: AbortSignal;
};

/**
 * Fetch and parse one feed with a bounded request lifetime.
 *
 * Exactly one attempt, always. Retry policy lives in the collector so attempts
 * cannot multiply across layers.
 */
export async function fetchFeed(
  url: string,
  timeoutMs = 20_000,
  options?: FetchFeedOptions,
): Promise<Parser.Output<Parser.Item>> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const parentSignal = options?.signal;
  // rss-parser's parseURL rejects on errors/timeouts without closing sockets.
  // Native fetch owns transport so abort covers headers AND the response body.
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = parentSignal
    ? AbortSignal.any([parentSignal, timeoutSignal])
    : timeoutSignal;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal,
      headers: { "User-Agent": "rss-parser", Accept: "application/rss+xml" },
    });
  } catch (err) {
    throw transportFailure(err, parentSignal);
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new FeedFetchError(`HTTP ${response.status}`, {
      kind: "http",
      status: response.status,
      retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
    });
  }

  let xml: string;
  try {
    xml = await response.text();
  } catch (err) {
    throw transportFailure(err, parentSignal);
  }

  try {
    return await new Parser().parseString(xml);
  } catch (err) {
    throw new FeedFetchError(`Unparseable feed: ${errorMessage(err)}`, {
      kind: "parse",
      cause: err,
    });
  }
}

/**
 * A request that ended without a response is a transport failure — unless the
 * caller cancelled it. Reporting a cancellation as a transport error would make
 * the collector retry work it was just told to stop doing.
 */
function transportFailure(err: unknown, parentSignal: AbortSignal | undefined): FeedFetchError {
  if (parentSignal?.aborted) {
    return new FeedFetchError("Request cancelled by caller", { kind: "aborted", cause: err });
  }
  return new FeedFetchError(errorMessage(err), { kind: "transport", cause: err });
}

/**
 * `Retry-After` is either a delay in seconds or an HTTP date. Anything else —
 * including a date already in the past — is reported as absent rather than
 * guessed at, so the collector falls back to its own backoff schedule.
 */
function parseRetryAfter(header: string | null): number | undefined {
  const value = header?.trim();
  if (!value) return undefined;
  // A zero or already-elapsed value is not a usable instruction: honouring it
  // literally collapses the backoff to nothing and fires three requests
  // back-to-back at a server that just rate-limited us. Report it as absent so
  // the collector uses its own 1s/2s schedule, exactly as the comment promises.
  if (/^\d+$/.test(value)) {
    const ms = Number(value) * 1000;
    return ms > 0 ? ms : undefined;
  }
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return undefined;
  const ms = at - Date.now();
  return ms > 0 ? ms : undefined;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
