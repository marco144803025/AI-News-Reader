import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Parser from "rss-parser";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const MODEL = "claude-haiku-4-5-20251001";
const DAYS_BACK = 1;
const RETENTION_DAYS = 7;
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

type Feed = { name: string; url: string };

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
};

type NewsData = {
  generatedAt: string;
  daysBack: number;
  categories: string[];
  articles: Article[];
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

async function fetchFeeds(feeds: Feed[]): Promise<RawArticle[]> {
  const parser = new Parser({ timeout: 20000 });
  const cutoff = Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000;
  const articles: RawArticle[] = [];

  for (const feed of feeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
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
      console.log(`  ok   ${feed.name} (${capped.length} articles)`);
    } catch (err) {
      console.warn(`  skip ${feed.name}: ${(err as Error).message}`);
    }
  }
  return articles;
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

async function classifyBatch(
  client: Anthropic,
  batch: RawArticle[]
): Promise<{ category: string; summary: string; important: boolean }[]> {
  const list = batch
    .map(
      (a, i) =>
        `[${i}] TITLE: ${a.title}\nSOURCE: ${a.source}\nEXCERPT: ${a.snippet}`
    )
    .join("\n\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text:
          "You categorize and summarize AI-related news articles.\n\n" +
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
          "Write a concise 1-2 sentence summary for each article. " +
          "Set important: true only for a significant research finding, major new model/capability, funding round $100M+, or landmark policy decision. Default to false.\n" +
          'Respond ONLY with a JSON array: [{"index": number, "category": string, "summary": string, "important": boolean}]',
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Categorize and summarize these ${batch.length} articles:\n\n${list}`,
      },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array in model response");
  const parsed = JSON.parse(jsonMatch[0]) as {
    index: number;
    category: string;
    summary: string;
    important: boolean;
  }[];

  const result: { category: string; summary: string; important: boolean }[] =
    batch.map(() => ({ category: "Other", summary: "", important: false }));
  for (const r of parsed) {
    if (r.index >= 0 && r.index < batch.length) {
      result[r.index] = {
        category: r.category?.trim() || "Other",
        summary: r.summary?.trim() || "",
        important: r.important === true,
      };
    }
  }
  return result;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ERROR: ANTHROPIC_API_KEY not set. Copy .env.example to .env.");
    process.exit(1);
  }

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

  console.log("Fetching feeds (last 24h)...");
  const feeds: Feed[] = JSON.parse(
    await readFile(join(ROOT, "feeds.json"), "utf-8")
  );
  const raw = dedupeIncoming(await fetchFeeds(feeds), existingUrls);
  console.log(`${raw.length} new articles after dedup.`);

  const retentionCutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  if (raw.length === 0) {
    console.log("No new articles — pruning and updating timestamp.");
    const pruned = existingArticles.filter(
      (a) => Date.parse(a.publishedAt) > retentionCutoff
    );
    const categories = [...new Set(pruned.map((a) => a.category))];
    await mkdir(join(ROOT, "public"), { recursive: true });
    await writeFile(
      outputPath,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), daysBack: DAYS_BACK, categories, articles: pruned },
        null,
        2
      ),
      "utf-8"
    );
    console.log(`Done. ${pruned.length} articles retained.`);
    return;
  }

  const client = new Anthropic({ apiKey });
  const classified: Article[] = [];
  for (let i = 0; i < raw.length; i += BATCH_SIZE) {
    const batch = raw.slice(i, i + BATCH_SIZE);
    console.log(
      `Classifying batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} articles)...`
    );
    const meta = await classifyBatch(client, batch);
    batch.forEach((a, j) => classified.push({ ...a, ...meta[j] }));
  }

  const merged = [...classified, ...existingArticles];
  const pruned = merged.filter(
    (a) => Date.parse(a.publishedAt) > retentionCutoff
  );
  pruned.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const categories = [...new Set(pruned.map((a) => a.category))];

  await mkdir(join(ROOT, "public"), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), daysBack: DAYS_BACK, categories, articles: pruned },
      null,
      2
    ),
    "utf-8"
  );
  console.log(
    `Wrote public/news.json — ${pruned.length} articles total (${classified.length} new), ${categories.length} categories.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
