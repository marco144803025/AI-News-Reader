import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";
import type { NewsData } from "../src/types.ts";
import { withRetry } from "./lib.ts";
import { classifyBatch } from "./ingest.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BATCH_SIZE = 25;

function hasTags(a: NewsData["articles"][number]): boolean {
  const t = a.tags;
  if (!t) return false;
  return (
    (t.topics?.length ?? 0) +
      (t.traits?.length ?? 0) +
      (t.entities?.length ?? 0) >
    0
  );
}

async function main() {
  const force = process.argv.includes("--force");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ERROR: ANTHROPIC_API_KEY not set.");
    process.exit(1);
  }

  const outputPath = join(ROOT, "public", "news.json");
  const raw = await readFile(outputPath, "utf-8");
  const data = JSON.parse(raw) as NewsData;

  const targets = force
    ? data.articles
    : data.articles.filter((a) => !hasTags(a));

  console.log(
    `${data.articles.length} total articles; ${targets.length} need re-classification${force ? " (--force)" : ""}.`
  );
  if (targets.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const client = new Anthropic({ apiKey });
  const byUrl = new Map(data.articles.map((a) => [a.url, a]));

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(targets.length / BATCH_SIZE);
    console.log(
      `Batch ${batchNum}/${totalBatches} (${batch.length} articles)...`
    );
    try {
      const meta = await withRetry(() => classifyBatch(client, batch));
      batch.forEach((a, j) => {
        const m = meta[j];
        const existing = byUrl.get(a.url);
        if (!existing) return;
        existing.category = m.category;
        existing.summary = m.summary;
        existing.important = m.important;
        existing.tags = m.tags;
      });
      // Persist progress after every batch so a crash doesn't lose work.
      await writeFile(outputPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error(`  skip batch ${batchNum}: ${(err as Error).message}`);
    }
  }

  const tagged = data.articles.filter(hasTags).length;
  console.log(
    `Done. ${tagged}/${data.articles.length} articles have tags.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
