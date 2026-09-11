import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchFeed } from "./feeds.ts";
import { collectFeeds, feedHealthFromOutcomes, type CollectionResult } from "./feed-collection.ts";
import { applyCapacity, clusterCandidates } from "./source-selection.ts";
import type OpenAI from "openai";
import { BRIEF_MODEL, CLASSIFY_MODEL, completeText, createDeepSeekClient, isMainModule, isTransientError, PipelineError, safePipelineError } from "./deepseek.ts";
import type { Article, Brief, BriefStatus, NewsData, RawArticle } from "../src/types.ts";
import { validTranslation } from "../src/lib/language.ts";
import {
  BRIEF_MAX_TOKENS,
  BRIEF_MIN_BULLETS,
  buildBriefPrompt,
  carryForwardBrief,
  computeEffectiveDaysBack,
  computeGeneratedAt,
  DAYS_BACK,
  DEFAULT_FEED_FAILURE_WARNING_THRESHOLD,
  DEFAULT_MAX_NEW_ARTICLES_PER_RUN,
  normalizeTags,
  parseBriefResponse,
  parseRetentionDays,
  SEED_TAGS,
  selectBriefInput,
  withRetry,
  type Feed,
  type IngestConfig,
  type RetryOptions,
} from "./lib.ts";
import type { Tags } from "../src/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const BATCH_SIZE = 25;

const SEED_CATEGORIES = [
  "MCP",
  "Model Releases",
  "Research",
  "AI Safety & Alignment",
  "Developer Tools",
  "Agent Frameworks",
  "Business & Funding",
  "Applications",
  "Regulation & Policy",
  "Open Source",
  "Hardware & Compute",
  "Other",
];

// ---------------------------------------------------------------------------
// Configuration and input validation (F13)
//
// Everything here runs BEFORE the first network call or output write. A bad
// config or a corrupt archive must stop the run outright: deduplication is
// decided against the archive, so treating an unreadable one as empty would
// silently republish the entire backlog. Constitution rules 13-14.

/** Read a positive-integer setting, or fail with a message naming the fix. */
export function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new PipelineError(
      `${name} must be a positive whole number; got "${raw}". Fix it in .env or the repository variable.`
    );
  }
  return value;
}

export function loadIngestConfig(): IngestConfig {
  return {
    maxNewArticlesPerRun: parsePositiveIntEnv(
      "MAX_NEW_ARTICLES_PER_RUN",
      DEFAULT_MAX_NEW_ARTICLES_PER_RUN
    ),
    feedFailureWarningThreshold: parsePositiveIntEnv(
      "FEED_FAILURE_WARNING_THRESHOLD",
      DEFAULT_FEED_FAILURE_WARNING_THRESHOLD
    ),
  };
}

/** Validate feeds.json before any fetch: names unique, scope known, URL safe. */
export function validateFeeds(value: unknown): Feed[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PipelineError("feeds.json must be a non-empty array of feeds.");
  }
  const seen = new Set<string>();
  return value.map((entry, i) => {
    if (!entry || typeof entry !== "object") {
      throw new PipelineError(`feeds.json entry ${i} is not an object.`);
    }
    const { name, url, scope } = entry as Record<string, unknown>;
    if (typeof name !== "string" || name.trim() === "") {
      throw new PipelineError(`feeds.json entry ${i} needs a non-empty name.`);
    }
    if (seen.has(name)) {
      throw new PipelineError(`feeds.json has duplicate feed name "${name}"; names key feed health.`);
    }
    seen.add(name);
    if (typeof url !== "string") {
      throw new PipelineError(`Feed "${name}" needs a url string.`);
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new PipelineError(`Feed "${name}" has an unparseable url: ${url}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new PipelineError(`Feed "${name}" must use http or https; got ${parsed.protocol}`);
    }
    if (parsed.username || parsed.password) {
      throw new PipelineError(`Feed "${name}" must not embed credentials in its url.`);
    }
    if (scope !== undefined && scope !== "ai" && scope !== "general") {
      throw new PipelineError(`Feed "${name}" has scope "${String(scope)}"; expected "ai" or "general".`);
    }
    return scope === undefined ? { name, url } : { name, url, scope };
  });
}

/**
 * Load the archive. A missing file is a legitimate first run; a present but
 * unreadable or invalid one is a hard failure, never an empty archive.
 */
export async function loadExisting(path: string): Promise<NewsData | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new PipelineError(
      `Could not read ${path}: ${(err as Error).message}. Check file permissions.`
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new PipelineError(
      `${path} is not valid JSON (${(err as Error).message}). Refusing to run: ` +
        `deduplication needs the archive, and treating it as empty would republish everything.`
    );
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as NewsData).articles)) {
    throw new PipelineError(`${path} has no articles array; refusing to overwrite it.`);
  }
  return parsed as NewsData;
}

// ---------------------------------------------------------------------------
// Classification (unchanged contract — ingest/backfill.ts imports both of these)

export type ClassifyResult = {
  category: string;
  summary: string;
  summaryZhHK?: string;
  important: boolean;
  tags: Tags;
};

export async function classifyBatch(
  client: OpenAI,
  batch: RawArticle[]
): Promise<ClassifyResult[]> {
  const list = batch
    .map(
      (a, i) =>
        `[${i}] TITLE: ${a.title}\nSOURCE: ${a.source}\nEXCERPT: ${a.snippet}`
    )
    .join("\n\n");

  const seedTagList =
    `Topics: ${SEED_TAGS.topics.join(", ")}\n` +
    `Traits: ${SEED_TAGS.traits.join(", ")}\n` +
    `Entities: ${SEED_TAGS.entities.join(", ")}`;

  const system =
          "You categorize, summarize, and tag AI-related news articles.\n\n" +
          "Use exactly these categories — do not invent new ones:\n" +
          "- MCP: Model Context Protocol specs, integrations, server/client implementations\n" +
          "- Model Releases: New model launches, capability announcements, model comparisons and benchmarks (GPT, Claude, Gemini, Llama, Mistral, etc.)\n" +
          "- Research: arXiv papers, academic studies, technical findings not tied to a specific product launch\n" +
          "- AI Safety & Alignment: Safety research, RLHF, red-teaming, alignment techniques, interpretability\n" +
          "- Developer Tools: APIs, SDKs, IDE plugins, coding assistants, developer infrastructure\n" +
          "- Agent Frameworks: Agent orchestration, multi-agent systems, planning, autonomous agents (LangChain, AutoGPT, CrewAI, etc.)\n" +
          "- Business & Funding: Investment rounds, acquisitions, valuations, company launches, partnerships\n" +
          "- Applications: Consumer or enterprise products built on AI, real-world deployments, use cases\n" +
          "- Regulation & Policy: Government AI policy, legislation, EU AI Act, compliance, ethics boards\n" +
          "- Open Source: Open-weight model releases, community projects, open-source tooling\n" +
          "- Hardware & Compute: AI chips, GPUs, data centers, inference infrastructure, energy\n" +
          "- Other: Only if nothing above fits\n\n" +
          "Write a concise 1-2 sentence English summary for each article in summary, " +
          "and an equivalent summaryZhHK in Hong Kong Traditional Chinese (zh-HK). " +
          "Use authentic Hong Kong vocabulary and a natural Cantonese-influenced written tone; " +
          "particles and pronouns such as 嘅 and 佢 are welcome. Do not use Simplified Chinese. " +
          "Preserve all claims, qualifications, numbers, proper names, model identifiers and English technical terms in both versions. " +
          "Set important: true only for a significant research finding, major new model/capability, funding round $100M+, or landmark policy decision. Default to false.\n\n" +
          "Also emit up to 6 short tags across three dimensions — topics (subject matter), traits (nature of the article), and entities (orgs, products, models). " +
          "Prefer these seed tags when they fit; you may emit additional tags only when nothing in the seed list applies. " +
          "Tags must be short (1-3 words). Aim for at most 3 topic tags, 2 trait tags, and 2 entity tags; the total across all dimensions must not exceed 6.\n" +
          `${seedTagList}\n\n` +
          'Respond ONLY with a JSON array: [{"index": number, "category": string, "summary": string, "summaryZhHK": string, "important": boolean, "tags": string[]}]';
  const text = await completeText(client, CLASSIFY_MODEL, system,
    `Categorize, summarize, and tag these ${batch.length} articles:\n\n${list}`, 8192);

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new PipelineError("No JSON array in model response");
  const parsed = JSON.parse(jsonMatch[0]) as {
    index: number;
    category: string;
    summary: string;
    summaryZhHK?: unknown;
    important: boolean;
    tags?: string[];
  }[];

  const result: ClassifyResult[] = batch.map(() => ({
    category: "Other",
    summary: "",
    important: false,
    tags: { topics: [], traits: [], entities: [] },
  }));
  if (!Array.isArray(parsed)) throw new PipelineError("Classification response must be an array.");
  for (const r of parsed) {
    if (!r || typeof r !== "object") throw new PipelineError("Invalid classification record.");
    if (Number.isInteger(r.index) && r.index >= 0 && r.index < batch.length) {
      if (typeof r.category !== "string" || typeof r.summary !== "string") {
        throw new PipelineError("Classification category and summary must be strings.");
      }
      const summaryZhHK = validTranslation(r.summaryZhHK);
      result[r.index] = {
        category: r.category?.trim() || "Other",
        summary: r.summary?.trim() || "",
        ...(summaryZhHK ? { summaryZhHK } : {}),
        important: r.important === true,
        tags: normalizeTags(Array.isArray(r.tags) ? r.tags : []),
      };
    }
  }
  const missingChinese = result.filter(item => item.summary && !item.summaryZhHK).length;
  if (missingChinese) console.warn(`Classification: ${missingChinese} Chinese summaries unavailable; retaining English.`);
  return result;
}

// One synthesis call over an already-selected set of articles → 3-5 cited
// bullets. The caller picks the window (see selectBriefInput) so one selection
// decides both whether a brief is possible and what it is written from.
// Throws on invalid output; the caller decides what to do (carry forward).
export async function generateBrief(
  client: OpenAI,
  input: Article[],
  now: Date = new Date()
): Promise<Brief> {
  const { system, user } = buildBriefPrompt(input);

  const text = await completeText(client, BRIEF_MODEL, system, user, BRIEF_MAX_TOKENS);

  return {
    generatedAt: now.toISOString(),
    ...parseBriefResponse(text, input),
  };
}

// ---------------------------------------------------------------------------
// The run itself (F13)
//
// NOTE: dependency injection. runIngest receives every effect as an argument —
// no filesystem, no model client, no wall clock of its own. That is what lets
// the whole pipeline be exercised offline in ingest/__tests__/pipeline.test.ts
// with RSS fixtures and fake model responses, instead of only testing helpers.
// main() below is the single place that touches the outside world.

export type RunLogger = {
  info: (line: string) => void;
  warn: (line: string) => void;
  error: (line: string) => void;
};

export type IngestDeps = {
  feeds: Feed[];
  config: IngestConfig;
  retentionDays: number;
  existing: NewsData | null;
  now: Date;
  collect: (feeds: Feed[], daysBack: number, now: Date) => Promise<CollectionResult>;
  classify: (batch: RawArticle[]) => Promise<ClassifyResult[]>;
  generateBrief: (input: Article[]) => Promise<Brief>;
  log: RunLogger;
  /** Injected so offline tests exercise retry behaviour without real delays. */
  retry?: RetryOptions;
};

export async function runIngest(deps: IngestDeps): Promise<NewsData> {
  const { feeds, config, retentionDays, existing, now, collect, classify, log } = deps;

  const existingArticles: Article[] = existing?.articles ?? [];
  const existingCategories =
    existing?.categories?.length ? existing.categories : SEED_CATEGORIES;
  log.info(
    `Existing: ${existingArticles.length} articles, categories: ${existingCategories.join(", ")}`
  );

  const effectiveDaysBack = computeEffectiveDaysBack(existing, DAYS_BACK, now.getTime());
  log.info(`Fetching ${feeds.length} feeds (last ${effectiveDaysBack}d)...`);

  const collection = await collect(feeds, effectiveDaysBack, now);

  // The health rule lives in feed-collection, which owns the outcome states:
  // only `ok` and `failed` move a feed's record, while a feed the deadline
  // cancelled or never reached keeps its previous one. It has not failed, so
  // it must not be counted as failing on the Trends page the reader sees.
  const feedHealth = feedHealthFromOutcomes(collection.outcomes, existing?.feedHealth);
  const candidates: RawArticle[] = collection.outcomes.flatMap((outcome) =>
    outcome.status === "ok" ? outcome.items : []
  );

  const { newClusters, existingUpdates, matchedExistingCount, duplicateReportCount } =
    clusterCandidates({ candidates, existing: existingArticles });

  // generatedAt still keys off the pre-cap candidate count: a run that found
  // new material has run, whether or not capacity admitted all of it.
  const preCapNewCount = newClusters.length;

  const { admitted, skipped } = applyCapacity({
    clusters: newClusters,
    feedOrder: feeds.map((f) => f.name),
    limit: config.maxNewArticlesPerRun,
  });
  log.info(
    `selection: candidates=${candidates.length} matchedExisting=${matchedExistingCount} ` +
      `duplicateReports=${duplicateReportCount} admitted=${admitted.length} capacitySkipped=${skipped}`
  );
  if (skipped > 0) {
    log.warn(
      `${skipped} eligible articles exceeded MAX_NEW_ARTICLES_PER_RUN=${config.maxNewArticlesPerRun} ` +
        `and were skipped for this run. They are not queued; they may age out.`
    );
  }

  const generatedAt = computeGeneratedAt(preCapNewCount, existing, () => now.toISOString());
  if (preCapNewCount === 0) log.info("No new articles — refreshing the brief and pruning.");

  const classified: Article[] = [];
  for (let i = 0; i < admitted.length; i += BATCH_SIZE) {
    const slice = admitted.slice(i, i + BATCH_SIZE);
    const batch = slice.map((cluster) => cluster.representative);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    log.info(`Classifying batch ${batchNum} (${batch.length} articles)...`);
    try {
      const meta = await withRetry(() => classify(batch), deps.retry);
      slice.forEach((cluster, j) => {
        classified.push({
          ...cluster.representative,
          ...(cluster.additional.length > 0
            ? { additionalSources: cluster.additional }
            : {}),
          ...meta[j],
        });
      });
    } catch (err) {
      // A batch that exhausted its retries persists nothing: an unclassified
      // representative would surface as an article with no summary. Other
      // batches and the attribution added to existing articles still stand.
      if (isTransientError(err)) {
        log.error(`  skip batch ${batchNum}: retries exhausted — ${safePipelineError(err)}`);
      } else {
        throw err;
      }
    }
  }

  const retentionCutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  // existingUpdates holds ONLY the archived articles that gained attribution
  // this run, so the archive is carried forward here and those clones are
  // swapped in by URL. Concatenating the two lists instead would drop every
  // article that happened not to be mentioned again today.
  const updatedByUrl = new Map(existingUpdates.map((a) => [a.url, a]));
  const carried = existingArticles.map((a) => updatedByUrl.get(a.url) ?? a);
  const merged = [...classified, ...carried];
  const pruned = merged.filter((a) => Date.parse(a.publishedAt) > retentionCutoff);
  pruned.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const categories = [...new Set(pruned.map((a) => a.category))];

  // Daily brief: one synthesis call over the last 24 hours of the archive, not
  // over this run's arrivals, so a late or closely spaced run still writes one.
  // A brief failure must never fail the run — carry the previous brief forward
  // and record why, so delivery can tell a quiet day from a broken pipeline.
  const briefInput = selectBriefInput(pruned);
  let brief = carryForwardBrief(existing);
  let briefStatus: BriefStatus;
  if (briefInput.length >= BRIEF_MIN_BULLETS) {
    log.info(`Generating daily brief from ${briefInput.length} recent articles...`);
    try {
      brief = await withRetry(() => deps.generateBrief(briefInput), deps.retry);
      briefStatus = "generated";
      log.info(`  brief ok (${brief.bullets.length} bullets).`);
    } catch (err) {
      briefStatus = "generation-failed";
      log.error(`  brief skipped, carrying previous forward — ${safePipelineError(err)}`);
    }
  } else {
    briefStatus = "no-new-material";
    log.info(
      `Too few articles in the last 24h for a brief (${briefInput.length} < ${BRIEF_MIN_BULLETS}) — carrying previous forward.`
    );
  }

  return {
    generatedAt,
    daysBack: effectiveDaysBack,
    categories,
    articles: pruned,
    feedHealth,
    briefStatus,
    feedFailureWarningThreshold: config.feedFailureWarningThreshold,
    ...(brief ? { brief } : {}),
  };
}

async function main() {
  // NOTE: loaded here, not at module scope. Importing this file from a test
  // must not read the developer's real .env and silently change run limits.
  await import("dotenv/config");

  // Validate everything before the first network call, write or log line.
  // The client comes first: an unconfigured service must say so and stop
  // without having appeared to start work (Constitution rule 16), which
  // ingest/__tests__/deepseek.test.ts asserts by requiring empty stdout.
  const config = loadIngestConfig();
  const retentionDays = parseRetentionDays();
  const client = createDeepSeekClient();

  const outputPath = join(ROOT, "public", "news.json");
  const feeds = validateFeeds(
    JSON.parse(await readFile(join(ROOT, "feeds.json"), "utf-8"))
  );

  console.log("Loading existing data...");
  const existing = await loadExisting(outputPath);
  const now = new Date();

  const output = await runIngest({
    feeds,
    config,
    retentionDays,
    existing,
    now,
    collect: (configuredFeeds, daysBack, runNow) =>
      collectFeeds({
        feeds: configuredFeeds,
        daysBack,
        now: runNow,
        fetchFeed,
        log: (line) => console.log(line),
      }),
    classify: (batch) => classifyBatch(client, batch),
    generateBrief: (input) => generateBrief(client, input, now),
    log: {
      info: (line) => console.log(line),
      warn: (line) => console.warn(line),
      error: (line) => console.error(line),
    },
  });

  await mkdir(join(ROOT, "public"), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");
  const newCount = output.articles.filter((a) => !existing?.articles?.some((e) => e.url === a.url)).length;
  console.log(
    `Wrote public/news.json — ${output.articles.length} articles total (${newCount} new), ${output.categories.length} categories.`
  );
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(`ERROR: ${safePipelineError(err)}`);
    process.exitCode = 1;
  });
}
