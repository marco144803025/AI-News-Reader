/**
 * Pure selection arithmetic for ingestion (F13 plan §6).
 *
 * Every function here is pure: no clock, no network, no filesystem, no
 * randomness. Each input arrives as an argument so that ingestion's judgement —
 * what is on topic, what is the same story, what fits inside one run — can be
 * exercised offline without an API key, which is exactly what the current
 * single-file pipeline cannot do.
 */

import type { AdditionalSource, Article, RawArticle } from "../src/types.ts";

const HOUR_MS = 60 * 60 * 1000;

/** Titles this short are too generic to trust as an exact-match signal. */
const MIN_EXACT_TITLE_LENGTH = 20;
/**
 * The same floor, for titles written in CJK script.
 *
 * NOTE: 20 characters of Chinese carries roughly the information of a
 * 40-character English headline, so the Latin floor rejected ordinary Unwire
 * and SCMP headlines outright. Since CJK titles are only ever matched exactly,
 * and only inside the 72-hour window, a shorter floor costs little: two
 * byte-identical 8-character Chinese headlines published within three days are
 * the same story. Without this, a short Chinese article re-seen under a changed
 * query parameter became a second article and a second paid classification.
 */
const MIN_EXACT_CJK_TITLE_LENGTH = 8;
/** Both gates must pass before two differently-worded titles are merged. */
const MIN_SHARED_TOKENS = 6;
const TITLE_JACCARD_THRESHOLD = 0.8;
/** Reports further apart than this are never compared by title. */
const DEFAULT_WINDOW_HOURS = 72;

// ---------------------------------------------------------------------------
// Topical filtering (plan §5.4, spec §4)
// ---------------------------------------------------------------------------

/**
 * Unambiguous AI signals. Deliberately absent: bare `agent`, `jobs`,
 * `automation`, `MCP`, `Claude`, `Gemini` and `Copilot` — each of those has a
 * common non-AI meaning, so on a general news feed they are not evidence on
 * their own. `GitHub Copilot` and `Model Context Protocol` are listed in full
 * because the expanded forms are unambiguous where the short ones are not.
 */
const ENGLISH_SIGNALS = [
  "ai",
  "artificial intelligence",
  "generative ai",
  "machine learning",
  "llm",
  "llms",
  "large language model",
  "large language models",
  "ai agent",
  "ai agents",
  "agentic",
  "model context protocol",
  "openai",
  "anthropic",
  "chatgpt",
  "deepseek",
  "langchain",
  "hugging face",
  "github copilot",
];

/** Chinese has no word delimiters, so these match as substrings. */
const CHINESE_SIGNALS = [
  "人工智能",
  "人工智慧",
  "生成式ai",
  "生成式 ai",
  "大語言模型",
  "大语言模型",
  "智能代理",
  "智能體",
];

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One word-bounded pattern per English signal. The `\b` anchors are the whole
 * point of this filter: without them `AI` matches inside `email`, `Dubai` and
 * `said`, and a general feed would pour unrelated news into the classifier.
 */
const ENGLISH_SIGNAL_PATTERNS = ENGLISH_SIGNALS.map(
  (phrase) =>
    new RegExp(`\\b${phrase.split(" ").map(escapeRegExp).join("\\s+")}\\b`, "i"),
);

/**
 * `A.I.` is house style at several outlets and cannot join the list above: the
 * generic builder ends every pattern with `\b`, which can never match after a
 * trailing period. Anchored on the left and guarded on the right instead.
 */
const PUNCTUATED_AI = /\ba\.\s?i\.(?!\p{L}|\p{N})/u;

/** NFKC folds fullwidth Latin (`ＡＩ`) onto plain ASCII before matching. */
function normalizeForMatching(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * True when the title plus excerpt carries an explicit AI signal.
 *
 * Applied only to feeds configured `scope: "general"`; `scope: "ai"` feeds
 * bypass it entirely, because this is a keyword filter and would discard their
 * implicitly-AI coverage. It cannot recognise an implicit reference — that
 * limitation is documented rather than described as semantic filtering.
 */
export function isTopicallyRelevant(title: string, excerpt: string): boolean {
  const haystack = normalizeForMatching(`${title} ${excerpt}`);
  if (!haystack) return false;
  if (CHINESE_SIGNALS.some((term) => haystack.includes(term))) return true;
  if (PUNCTUATED_AI.test(haystack)) return true;
  return ENGLISH_SIGNAL_PATTERNS.some((pattern) => pattern.test(haystack));
}

// ---------------------------------------------------------------------------
// Canonical URL keys (plan §6, spec §4)
// ---------------------------------------------------------------------------

const TRACKING_PARAMS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);

function isTrackingParam(name: string): boolean {
  const lowered = name.toLowerCase();
  return lowered.startsWith("utm_") || TRACKING_PARAMS.has(lowered);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * A comparison key for one article URL.
 *
 * Lowercases the host, drops the fragment, removes the documented tracking
 * allowlist and sorts what remains. Path case, meaningful query parameters and
 * the http/https distinction are all preserved, because each of those can
 * address a genuinely different document.
 *
 * The key exists for comparison only and must never reach an output URL:
 * stored links stay exactly as the publisher wrote them.
 *
 * Throws when the URL cannot be parsed — a visible failure rather than a
 * silently unmatched article. Collection is responsible for skipping malformed
 * links before they reach selection.
 */
export function canonicalUrlKey(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(
      `canonicalUrlKey: cannot parse URL ${JSON.stringify(rawUrl)}`,
    );
  }

  const params = [...parsed.searchParams.entries()].filter(
    ([name]) => !isTrackingParam(name),
  );
  params.sort(([nameA, valueA], [nameB, valueB]) =>
    nameA === nameB
      ? compareStrings(valueA, valueB)
      : compareStrings(nameA, nameB),
  );
  const query = params
    .map(
      ([name, value]) =>
        `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    )
    .join("&");

  // `protocol` and `host` are already lowercased by the URL parser; `pathname`
  // is not, and must not be — many CMS paths are case-sensitive.
  //
  // NOTE: a single trailing slash is dropped. `/story` and `/story/` are the
  // same document everywhere in practice, and different feeds for one story
  // routinely disagree about it — leaving them distinct was the likeliest
  // source of a duplicate card slipping through. Only the slash is normalized;
  // AMP paths are left alone, since `/amp/x` can be a genuinely different URL.
  const path = parsed.pathname.length > 1 ? parsed.pathname.replace(/\/$/, "") : parsed.pathname;
  return `${parsed.protocol}//${parsed.host}${path}${query ? `?${query}` : ""}`;
}

/**
 * Archived links are stored data we do not get to reject, so an unusable one is
 * left out of the index rather than failing the whole run over one bad record.
 */
function archiveKey(rawUrl: string): string | null {
  try {
    return canonicalUrlKey(rawUrl);
  } catch {
    // Disclosed, not swallowed (Constitution rule 14). Dropping a stored link
    // from the dedupe index silently would let that article be re-ingested as
    // a duplicate with no trace of why.
    console.warn(
      `source-selection: archived link could not be indexed for deduplication: ${rawUrl}`,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Title matching (plan §6, spec §4)
// ---------------------------------------------------------------------------

const CJK_PATTERN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** Keeps version-like tokens whole: `4o`, `v2`, `3.5`, `70b`. */
const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:\.[\p{L}\p{N}]+)*/gu;
const DIGIT_PATTERN = /\p{N}/u;

const NEGATION_WORDS = new Set(["no", "not", "never", "without", "cannot"]);
/** `doesn't`, `won't`, `can't` — the same claim reversed, written short. */
const CONTRACTED_NEGATION = /\p{L}n['’]t\b/u;

/**
 * NFKC, case-folded, whitespace collapsed. Punctuation is kept: this string is
 * the exact-match key, and token comparison strips punctuation separately.
 */
export function normalizeTitle(title: string): string {
  return title.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Splits a title into comparable tokens.
 *
 * `numbers` is separated from `words` because a version bump (`4o` vs `4.1`) is
 * a different story, not a rewording, so those sets are required to be equal
 * before a merge. `negated` is tracked because dropping a negation as a
 * stopword would erase the meaning of the claim the headline is making.
 */
export function titleTokens(title: string): {
  words: Set<string>;
  numbers: Set<string>;
  negated: boolean;
} {
  const normalized = normalizeTitle(title);
  const words = new Set<string>();
  const numbers = new Set<string>();

  for (const match of normalized.matchAll(TOKEN_PATTERN)) {
    const token = match[0];
    if (DIGIT_PATTERN.test(token)) numbers.add(token);
    else words.add(token);
  }

  const negated =
    [...words].some((word) => NEGATION_WORDS.has(word)) ||
    CONTRACTED_NEGATION.test(normalized);

  return { words, numbers, negated };
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/**
 * True when two headlines are confidently the same story.
 *
 * In order:
 *   1. identical normalized titles of at least 20 characters match;
 *   2. if either title contains a CJK character, exact matching is the only
 *      rule — no fuzzy comparison, and never across languages;
 *   3. otherwise English token sets must share at least 6 tokens at a Jaccard
 *      similarity of at least 0.8, with equal numeric/version sets and the same
 *      negation polarity.
 *
 * Deliberately conservative: a missed merge leaves two cards on the page, a
 * false merge hides a story the reader never sees.
 */
export function titlesMatch(a: string, b: string): boolean {
  const normalizedA = normalizeTitle(a);
  const normalizedB = normalizeTitle(b);
  if (!normalizedA || !normalizedB) return false;

  if (normalizedA === normalizedB) {
    const floor = CJK_PATTERN.test(normalizedA)
      ? MIN_EXACT_CJK_TITLE_LENGTH
      : MIN_EXACT_TITLE_LENGTH;
    return normalizedA.length >= floor;
  }
  if (CJK_PATTERN.test(normalizedA) || CJK_PATTERN.test(normalizedB)) {
    return false;
  }

  const tokensA = titleTokens(normalizedA);
  const tokensB = titleTokens(normalizedB);
  if (tokensA.negated !== tokensB.negated) return false;
  if (!setsEqual(tokensA.numbers, tokensB.numbers)) return false;

  const setA = new Set([...tokensA.words, ...tokensA.numbers]);
  const setB = new Set([...tokensB.words, ...tokensB.numbers]);
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  if (shared < MIN_SHARED_TOKENS) return false;

  const unionSize = setA.size + setB.size - shared;
  if (unionSize === 0) return false;
  return shared / unionSize >= TITLE_JACCARD_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Clustering (plan §6, spec §4)
// ---------------------------------------------------------------------------

export type Cluster = {
  representative: RawArticle;
  additional: AdditionalSource[];
};

export type ClusterResult = {
  newClusters: Cluster[];
  /**
   * Clones of archived articles that gained attribution. Never the whole
   * archive, and never a rewritten primary URL, title or summary.
   */
  existingUpdates: Article[];
  /** Candidates folded into an archived article. */
  matchedExistingCount: number;
  /** Candidates folded into another candidate from this same run. */
  duplicateReportCount: number;
};

type ArchiveEntry = {
  article: Article;
  /** Attribution gained during this run, appended to a clone at the end. */
  added: AdditionalSource[];
  publishedAt: number;
};

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function withinWindow(a: number, b: number, windowMs: number): boolean {
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) <= windowMs;
}

/**
 * Whether crediting this candidate would add nothing, or repeat what is already
 * credited.
 *
 * NOTE: this exists because canonical keys are not stable across runs. Several
 * publishers append their own varying parameters to their RSS links (SCMP sends
 * `module=` and `pgtype=`), and only the documented tracking allowlist is
 * stripped. Without these two guards the same article, re-seen on consecutive
 * days under a slightly different link, was credited again every run:
 *
 *   1. A source never "also reports" its own story. If the candidate comes from
 *      the same feed as the article itself, there is nothing to credit.
 *   2. Otherwise the same outlet is not credited twice for the same headline,
 *      whatever the link looks like today.
 *
 * The ingest is required to be safe to re-run (Constitution rule 2), and an
 * "Also reported by" list that grows by one entry a day is not.
 */
function isRedundantAttribution(entry: ArchiveEntry, candidate: RawArticle): boolean {
  if (candidate.source === entry.article.source) return true;
  const title = normalizeTitle(candidate.title);
  const credited = [...(entry.article.additionalSources ?? []), ...entry.added];
  return credited.some(
    (source) =>
      source.source === candidate.source && normalizeTitle(source.title) === title,
  );
}

function toAdditionalSource(candidate: RawArticle): AdditionalSource {
  // Title and URL verbatim: attribution shows the other outlet's own words.
  return {
    title: candidate.title,
    url: candidate.url,
    source: candidate.source,
  };
}

/**
 * Decides which incoming candidates are new articles and which are extra
 * coverage of something already known.
 *
 * The archive lookup covers both primary URLs *and* URLs already stored as
 * attribution, so a link credited yesterday can never re-enter as a fresh
 * article today merely because its headline changed. Two already-stored records
 * are never compared with each other, so this can never consolidate the
 * archive; it only ever adds attribution to it.
 *
 * Candidates are sorted by publication time before clustering, so the first
 * member of a cluster is the earliest published one and stays the
 * representative. Every later candidate is compared to that representative and
 * never to another member, which stops weak matches chaining into a pile.
 */
export function clusterCandidates(input: {
  candidates: RawArticle[];
  existing: Article[];
  windowHours?: number;
}): ClusterResult {
  const windowMs = (input.windowHours ?? DEFAULT_WINDOW_HOURS) * HOUR_MS;

  const entries: ArchiveEntry[] = input.existing.map((article) => ({
    article,
    added: [],
    publishedAt: timestamp(article.publishedAt),
  }));

  // Primary URLs win over attribution URLs; between two records of equal
  // standing the lexicographically smaller primary URL wins, so the result does
  // not depend on the order the archive happens to be stored in.
  const keyOwner = new Map<string, { entry: ArchiveEntry; primary: boolean }>();
  const claim = (key: string, entry: ArchiveEntry, primary: boolean): void => {
    const held = keyOwner.get(key);
    if (
      !held ||
      (primary && !held.primary) ||
      (primary === held.primary &&
        compareStrings(entry.article.url, held.entry.article.url) < 0)
    ) {
      keyOwner.set(key, { entry, primary });
    }
  };

  for (const entry of entries) {
    const primaryKey = archiveKey(entry.article.url);
    if (primaryKey) claim(primaryKey, entry, true);
    for (const source of entry.article.additionalSources ?? []) {
      const key = archiveKey(source.url);
      if (key) claim(key, entry, false);
    }
  }

  // Earliest published first, then configuration order. The plan also lists the
  // original URL as a final tie-break; array position is already unique, so
  // that comparison is unreachable here and is not written as dead code.
  const ordered = input.candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      const timeA = timestamp(a.candidate.publishedAt);
      const timeB = timestamp(b.candidate.publishedAt);
      // Undated candidates sort last rather than pretending to be oldest.
      const sortA = Number.isNaN(timeA) ? Number.POSITIVE_INFINITY : timeA;
      const sortB = Number.isNaN(timeB) ? Number.POSITIVE_INFINITY : timeB;
      if (sortA !== sortB) return sortA - sortB;
      return a.index - b.index;
    });

  const newClusters: Cluster[] = [];
  const clusterOf = new Map<string, number>();
  let matchedExistingCount = 0;
  let duplicateReportCount = 0;

  for (const { candidate } of ordered) {
    const key = canonicalUrlKey(candidate.url);
    const candidateTime = timestamp(candidate.publishedAt);

    // 1. Already in the archive, as a primary link or as attribution. Nothing
    //    to add — this is what makes a re-run idempotent.
    if (keyOwner.has(key)) {
      matchedExistingCount += 1;
      continue;
    }

    // 2. Same story as an archived article, published under a different link.
    //    Compared against archived primaries only, never through attribution
    //    titles, so a weak match cannot travel via a credited headline.
    const archiveMatch = bestArchiveMatch(
      entries,
      candidate,
      candidateTime,
      windowMs,
    );
    if (archiveMatch) {
      // Always claim the key, so this exact link is recognised next run even
      // when the entry below is rejected as a duplicate.
      claim(key, archiveMatch, false);
      matchedExistingCount += 1;
      if (!isRedundantAttribution(archiveMatch, candidate)) {
        archiveMatch.added.push(toAdditionalSource(candidate));
      }
      continue;
    }

    // 3. A link this run has already taken, as a representative or as
    //    attribution. The entry already held keeps its original title and link.
    if (clusterOf.has(key)) {
      duplicateReportCount += 1;
      continue;
    }

    // 4. Same story as a cluster already formed in this run.
    const clusterIndex = bestClusterMatch(
      newClusters,
      candidate,
      candidateTime,
      windowMs,
    );
    if (clusterIndex >= 0) {
      newClusters[clusterIndex].additional.push(toAdditionalSource(candidate));
      clusterOf.set(key, clusterIndex);
      duplicateReportCount += 1;
      continue;
    }

    // 5. Genuinely new.
    clusterOf.set(key, newClusters.length);
    newClusters.push({ representative: candidate, additional: [] });
  }

  const existingUpdates = entries
    .filter((entry) => entry.added.length > 0)
    .map((entry) => {
      // Deep clone: the caller's archive objects are never touched.
      const clone = structuredClone(entry.article);
      clone.additionalSources = [
        ...(clone.additionalSources ?? []),
        ...entry.added,
      ];
      return clone;
    });

  return {
    newClusters,
    existingUpdates,
    matchedExistingCount,
    duplicateReportCount,
  };
}

function bestArchiveMatch(
  entries: ArchiveEntry[],
  candidate: RawArticle,
  candidateTime: number,
  windowMs: number,
): ArchiveEntry | null {
  let best: ArchiveEntry | null = null;
  for (const entry of entries) {
    if (!withinWindow(candidateTime, entry.publishedAt, windowMs)) continue;
    if (!titlesMatch(candidate.title, entry.article.title)) continue;
    if (!best || compareStrings(entry.article.url, best.article.url) < 0) {
      best = entry;
    }
  }
  return best;
}

function bestClusterMatch(
  clusters: Cluster[],
  candidate: RawArticle,
  candidateTime: number,
  windowMs: number,
): number {
  let bestIndex = -1;
  for (let index = 0; index < clusters.length; index += 1) {
    const representative = clusters[index].representative;
    const representativeTime = timestamp(representative.publishedAt);
    if (!withinWindow(candidateTime, representativeTime, windowMs)) continue;
    if (!titlesMatch(candidate.title, representative.title)) continue;
    if (
      bestIndex === -1 ||
      compareStrings(
        representative.url,
        clusters[bestIndex].representative.url,
      ) < 0
    ) {
      bestIndex = index;
    }
  }
  return bestIndex;
}

// ---------------------------------------------------------------------------
// Capacity (plan §6, spec §4)
// ---------------------------------------------------------------------------

/**
 * Admits at most `limit` clusters, one source at a time.
 *
 * Each source keeps its own bucket sorted newest first, and rounds are taken in
 * `feedOrder` order. No ranking signal exists before classification — this runs
 * before any model call — so round-robin fairness plus configuration order is
 * deliberately the only rule. When the cap binds, earlier feeds win; that is
 * why the ordering inside `feeds.json` is meaningful.
 *
 * Overflow is skipped for this run and reported, never queued and never
 * silently dropped.
 */
export function applyCapacity(input: {
  clusters: Cluster[];
  feedOrder: string[];
  limit: number;
}): { admitted: Cluster[]; skipped: number } {
  const { clusters, feedOrder, limit } = input;
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new Error(
      `applyCapacity: limit must be a non-negative safe integer, received ${String(limit)}`,
    );
  }

  const buckets = new Map<string, Cluster[]>();
  for (const cluster of clusters) {
    const source = cluster.representative.source;
    const bucket = buckets.get(source);
    if (bucket) bucket.push(cluster);
    else buckets.set(source, [cluster]);
  }
  for (const bucket of buckets.values()) bucket.sort(newestFirstThenUrl);

  // Configured sources first, in configuration order. A bucket whose source is
  // not configured still has to land somewhere deterministic; it goes last, by
  // name, so the outcome never depends on the order of the input array.
  const order = feedOrder.filter(
    (name, index) => buckets.has(name) && feedOrder.indexOf(name) === index,
  );
  const configured = new Set(order);
  order.push(
    ...[...buckets.keys()].filter((name) => !configured.has(name)).sort(),
  );

  const cursors = new Map<string, number>(order.map((name) => [name, 0]));
  const admitted: Cluster[] = [];
  let tookOne = true;
  while (admitted.length < limit && tookOne) {
    tookOne = false;
    for (const name of order) {
      if (admitted.length >= limit) break;
      const bucket = buckets.get(name);
      const cursor = cursors.get(name);
      if (!bucket || cursor === undefined || cursor >= bucket.length) continue;
      admitted.push(bucket[cursor]);
      cursors.set(name, cursor + 1);
      tookOne = true;
    }
  }

  return { admitted, skipped: clusters.length - admitted.length };
}

/**
 * Newest first; equal timestamps fall back to the URL so the result is stable
 * however the caller happened to order its input.
 */
function newestFirstThenUrl(a: Cluster, b: Cluster): number {
  const timeA = timestamp(a.representative.publishedAt);
  const timeB = timestamp(b.representative.publishedAt);
  const sortA = Number.isNaN(timeA) ? Number.NEGATIVE_INFINITY : timeA;
  const sortB = Number.isNaN(timeB) ? Number.NEGATIVE_INFINITY : timeB;
  if (sortA !== sortB) return sortB - sortA;
  return compareStrings(a.representative.url, b.representative.url);
}
