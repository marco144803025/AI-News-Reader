import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchFeed } from "./feeds.ts";
import type OpenAI from "openai";
import { BRIEF_MODEL, CLASSIFY_MODEL, completeText, createDeepSeekClient, isMainModule, isTransientError, PipelineError, safePipelineError } from "./deepseek.ts";
import "dotenv/config";
import type { Brief, NewsData, FeedHealth } from "../src/types.ts";
import { validTranslation } from "../src/lib/language.ts";
import {
  BRIEF_MIN_BULLETS,
  buildBriefPrompt,
  buildFeedHealth,
  carryForwardBrief,
  computeEffectiveDaysBack,
  computeGeneratedAt,
  DAYS_BACK,
  normalizeTags,
  parseBriefResponse,
  parseRetentionDays,
  SEED_TAGS,
  selectBriefInput,
  withRetry,
  type Feed,
} from "./lib.ts";
import type { Tags } from "../src/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const BATCH_SIZE = 25;
const ARXIV_CAP = 15;


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

type RawArticle = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
};

type Article = RawArticle & {
  category: string;
  summary: string;
  important?: boolean;
  tags?: Tags;
};

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

async function loadExisting(path: string): Promise<NewsData | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as NewsData;
  } catch {
    return null;
  }
}

async function fetchFeeds(
  feeds: Feed[],
  daysBack: number,
  prevHealth: Record<string, FeedHealth> | undefined
): Promise<{ articles: RawArticle[]; health: Record<string, FeedHealth> }> {
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const articles: RawArticle[] = [];
  const successAt: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const feed of feeds) {
    try {
      const parsed = await fetchFeed(feed.url);
      const fetchedAt = new Date().toISOString();
      const isArxiv = feed.name.toLowerCase().includes("arxiv");
      const feedArticles: RawArticle[] = [];

      for (const item of parsed.items) {
        const url = item.link;
        const title = item.title?.trim();
        if (!url || !title) continue;
        const dateStr = item.isoDate ?? item.pubDate;
        const ts = dateStr ? Date.parse(dateStr) : NaN;
        if (Number.isFinite(ts) && ts < cutoff) continue;
        const snippet = stripHtml(
          item.contentSnippet ?? item.content ?? item.summary ?? ""
        ).slice(0, 600);

        if (isArxiv && !isArxivRelevant(title, snippet)) continue;

        feedArticles.push({
          title,
          url,
          source: feed.name,
          publishedAt: Number.isFinite(ts)
            ? new Date(ts).toISOString()
            : new Date().toISOString(),
          snippet,
        });
      }

      const capped = isArxiv ? feedArticles.slice(0, ARXIV_CAP) : feedArticles;
      articles.push(...capped);
      successAt[feed.name] = fetchedAt;
      console.log(`  ok   ${feed.name} (${capped.length} articles)`);
    } catch (err) {
      errors[feed.name] = (err as Error).message;
      console.warn(`  skip ${feed.name}: ${(err as Error).message}`);
    }
  }

  const health = buildFeedHealth(feeds, successAt, errors, prevHealth);
  return { articles, health };
}

function dedupeIncoming(
  incoming: RawArticle[],
  existingUrls: Set<string>
): RawArticle[] {
  const seenThisRun = new Set<string>();
  const out: RawArticle[] = [];
  for (const a of incoming) {
    const key = a.url.split("?")[0].toLowerCase();
    if (existingUrls.has(key) || seenThisRun.has(key)) continue;
    seenThisRun.add(key);
    out.push(a);
  }
  return out;
}

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

// One synthesis call over the run's new articles → 3-5 cited bullets.
// Throws on invalid output; the caller decides what to do (carry forward).
export async function generateBrief(
  client: OpenAI,
  articles: Article[]
): Promise<Brief> {
  const input = selectBriefInput(articles);
  const { system, user } = buildBriefPrompt(input);

  const text = await completeText(client, BRIEF_MODEL, system, user, 4000);

  return {
    generatedAt: new Date().toISOString(),
    bullets: parseBriefResponse(text, input),
  };
}

async function main() {
  const client = createDeepSeekClient();
  const retentionDays = parseRetentionDays();

  const outputPath = join(ROOT, "public", "news.json");

  console.log("Loading existing data...");
  const existing = await loadExisting(outputPath);
  const existingArticles: Article[] = existing?.articles ?? [];
  const existingUrls = new Set(
    existingArticles.map((a) => a.url.split("?")[0].toLowerCase())
  );
  const existingCategories =
    existing?.categories?.length ? existing.categories : SEED_CATEGORIES;

  console.log(
    `Existing: ${existingArticles.length} articles, categories: ${existingCategories.join(", ")}`
  );

  const effectiveDaysBack = computeEffectiveDaysBack(
    existing,
    DAYS_BACK,
    Date.now()
  );
  console.log(`Fetching feeds (last ${effectiveDaysBack}d)...`);

  const feeds: Feed[] = JSON.parse(
    await readFile(join(ROOT, "feeds.json"), "utf-8")
  );
  const { articles: fetched, health: feedHealth } = await fetchFeeds(
    feeds,
    effectiveDaysBack,
    existing?.feedHealth
  );
  const raw = dedupeIncoming(fetched, existingUrls);
  const newCount = raw.length;
  console.log(`${newCount} new articles after dedup.`);

  const retentionCutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const generatedAt = computeGeneratedAt(newCount, existing, () =>
    new Date().toISOString()
  );

  if (newCount === 0) {
    console.log("No new articles — pruning and writing.");
    const pruned = existingArticles.filter(
      (a) => Date.parse(a.publishedAt) > retentionCutoff
    );
    const categories = [...new Set(pruned.map((a) => a.category))];
    await mkdir(join(ROOT, "public"), { recursive: true });
    const carried = carryForwardBrief(existing);
    const output: NewsData = {
      generatedAt,
      daysBack: effectiveDaysBack,
      categories,
      articles: pruned,
      feedHealth,
      ...(carried ? { brief: carried } : {}),
    };
    await writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");
    console.log(`Done. ${pruned.length} articles retained.`);
    return;
  }

  const classified: Article[] = [];
  for (let i = 0; i < raw.length; i += BATCH_SIZE) {
    const batch = raw.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    console.log(`Classifying batch ${batchNum} (${batch.length} articles)...`);
    try {
      const meta = await withRetry(() => classifyBatch(client, batch));
      batch.forEach((a, j) => classified.push({ ...a, ...meta[j] }));
    } catch (err) {
      const transient = isTransientError(err);
      if (transient) {
        console.error(
          `  skip batch ${batchNum}: retries exhausted — ${safePipelineError(err)}`
        );
      } else {
        throw err;
      }
    }
  }

  // Daily brief: one synthesis call over this run's new articles. A brief
  // failure must never fail the run — carry the previous brief forward.
  // Runs with fewer new articles than the bullet minimum can't produce a
  // valid brief, so skip the call instead of predictably failing validation.
  let brief = carryForwardBrief(existing);
  if (classified.length >= BRIEF_MIN_BULLETS) {
    console.log("Generating daily brief...");
    try {
      brief = await withRetry(() => generateBrief(client, classified));
      console.log(`  brief ok (${brief.bullets.length} bullets).`);
    } catch (err) {
      console.error(
        `  brief skipped, carrying previous forward — ${safePipelineError(err)}`
      );
    }
  } else if (classified.length > 0) {
    console.log(
      `Too few new articles for a brief (${classified.length} < ${BRIEF_MIN_BULLETS}) — carrying previous forward.`
    );
  }

  const merged = [...classified, ...existingArticles];
  const pruned = merged.filter(
    (a) => Date.parse(a.publishedAt) > retentionCutoff
  );
  pruned.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const categories = [...new Set(pruned.map((a) => a.category))];

  await mkdir(join(ROOT, "public"), { recursive: true });
  const output: NewsData = {
    generatedAt,
    daysBack: effectiveDaysBack,
    categories,
    articles: pruned,
    feedHealth,
    ...(brief ? { brief } : {}),
  };
  await writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(
    `Wrote public/news.json — ${pruned.length} articles total (${classified.length} new), ${categories.length} categories.`
  );
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(`ERROR: ${safePipelineError(err)}`);
    process.exitCode = 1;
  });
}
