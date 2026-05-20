import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Parser from "rss-parser";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const MODEL = "claude-haiku-4-5-20251001";
const DAYS_BACK = 7;
const BATCH_SIZE = 25;

const SEED_CATEGORIES = [
  "MCP",
  "AI Models",
  "Agent Harness / Features",
  "Research",
  "Industry / Business",
  "Other",
];

type Feed = { name: string; url: string };

type RawArticle = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
};

type Article = RawArticle & { category: string; summary: string };

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFeeds(feeds: Feed[]): Promise<RawArticle[]> {
  const parser = new Parser({ timeout: 20000 });
  const cutoff = Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000;
  const articles: RawArticle[] = [];

  for (const feed of feeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of parsed.items) {
        const url = item.link;
        const title = item.title?.trim();
        if (!url || !title) continue;
        const dateStr = item.isoDate ?? item.pubDate;
        const ts = dateStr ? Date.parse(dateStr) : NaN;
        if (Number.isFinite(ts) && ts < cutoff) continue;
        articles.push({
          title,
          url,
          source: feed.name,
          publishedAt: Number.isFinite(ts)
            ? new Date(ts).toISOString()
            : new Date().toISOString(),
          snippet: stripHtml(
            item.contentSnippet ?? item.content ?? item.summary ?? ""
          ).slice(0, 600),
        });
      }
      console.log(`  ok   ${feed.name}`);
    } catch (err) {
      console.warn(`  skip ${feed.name}: ${(err as Error).message}`);
    }
  }
  return articles;
}

function dedupe(articles: RawArticle[]): RawArticle[] {
  const seen = new Set<string>();
  const out: RawArticle[] = [];
  for (const a of articles) {
    const key = a.url.split("?")[0].toLowerCase();
    const titleKey = a.title.toLowerCase();
    if (seen.has(key) || seen.has(titleKey)) continue;
    seen.add(key);
    seen.add(titleKey);
    out.push(a);
  }
  return out;
}

async function classifyBatch(
  client: Anthropic,
  batch: RawArticle[]
): Promise<{ category: string; summary: string }[]> {
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
          "You categorize and summarize AI-related news articles. " +
          "For each article assign exactly one category. Prefer these categories: " +
          SEED_CATEGORIES.join(", ") +
          ". You may introduce a new short category only if none fit well. " +
          "Write a concise 1-2 sentence summary for each article. " +
          'Respond ONLY with a JSON array of objects {"index": number, "category": string, "summary": string}, no other text.',
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
  }[];

  const result: { category: string; summary: string }[] = batch.map(() => ({
    category: "Other",
    summary: "",
  }));
  for (const r of parsed) {
    if (r.index >= 0 && r.index < batch.length) {
      result[r.index] = {
        category: r.category?.trim() || "Other",
        summary: r.summary?.trim() || "",
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

  console.log("Fetching feeds...");
  const feeds: Feed[] = JSON.parse(
    await readFile(join(ROOT, "feeds.json"), "utf-8")
  );
  const raw = dedupe(await fetchFeeds(feeds));
  console.log(`Collected ${raw.length} unique articles from the last ${DAYS_BACK} days.`);

  if (raw.length === 0) {
    console.warn("No articles found — nothing to write.");
    return;
  }

  const client = new Anthropic({ apiKey });
  const articles: Article[] = [];
  for (let i = 0; i < raw.length; i += BATCH_SIZE) {
    const batch = raw.slice(i, i + BATCH_SIZE);
    console.log(
      `Classifying batch ${i / BATCH_SIZE + 1} (${batch.length} articles)...`
    );
    const meta = await classifyBatch(client, batch);
    batch.forEach((a, j) => articles.push({ ...a, ...meta[j] }));
  }

  articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const categories = [...new Set(articles.map((a) => a.category))];

  const output = {
    generatedAt: new Date().toISOString(),
    daysBack: DAYS_BACK,
    categories,
    articles,
  };

  await mkdir(join(ROOT, "public"), { recursive: true });
  await writeFile(
    join(ROOT, "public", "news.json"),
    JSON.stringify(output, null, 2),
    "utf-8"
  );
  console.log(
    `Wrote public/news.json — ${articles.length} articles, ${categories.length} categories.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
