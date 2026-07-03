import Anthropic from "@anthropic-ai/sdk";
import type {
  Article,
  Brief,
  BriefBullet,
  NewsData,
  FeedHealth,
  Tags,
} from "../src/types.ts";

export type Feed = { name: string; url: string };

export const DAYS_BACK = 1;
const CATCH_UP_CAP_DAYS = 7;
export const MAX_TAGS_PER_ARTICLE = 6;

export const SEED_TAGS = {
  topics: [
    "llm",
    "agentic",
    "multimodal",
    "reasoning",
    "inference",
    "training",
    "safety",
    "alignment",
    "interpretability",
    "rag",
    "fine-tuning",
    "evaluation",
    "robotics",
    "vision",
    "audio",
  ],
  traits: [
    "commercial",
    "open-source",
    "research",
    "policy",
    "funding",
    "benchmark",
    "tutorial",
    "release",
    "incident",
  ],
  entities: [
    "anthropic",
    "openai",
    "google",
    "meta",
    "microsoft",
    "nvidia",
    "deepmind",
    "mistral",
    "claude",
    "gpt",
    "gemini",
    "llama",
    "qwen",
  ],
} as const;

export const TAG_ALIASES: Readonly<Record<string, string>> = {
  "large-language-model": "llm",
  "large-language-models": "llm",
  llms: "llm",
  agent: "agentic",
  agents: "agentic",
  "ai-agent": "agentic",
  "ai-agents": "agentic",
  "open-source-software": "open-source",
  oss: "open-source",
  opensource: "open-source",
  "open-weights": "open-source",
  "open-weight": "open-source",
  "gpt-3": "gpt",
  "gpt-4": "gpt",
  "gpt-4o": "gpt",
  "gpt-4-turbo": "gpt",
  "gpt-5": "gpt",
  "gpt-5-mini": "gpt",
  "claude-2": "claude",
  "claude-3": "claude",
  "claude-3-5": "claude",
  "claude-3-7": "claude",
  "claude-4": "claude",
  "claude-4-5": "claude",
  "claude-4-7": "claude",
  "claude-4-8": "claude",
  "gemini-1-5": "gemini",
  "gemini-2": "gemini",
  "gemini-2-5": "gemini",
  "llama-3": "llama",
  "llama-4": "llama",
  "google-deepmind": "deepmind",
  "openai-inc": "openai",
  "anthropic-pbc": "anthropic",
  funded: "funding",
  fundraise: "funding",
  "series-a": "funding",
  "series-b": "funding",
  "series-c": "funding",
  regulation: "policy",
  legislation: "policy",
  "eu-ai-act": "policy",
  benchmarks: "benchmark",
  evaluations: "evaluation",
  evals: "evaluation",
  "rl-from-human-feedback": "alignment",
  rlhf: "alignment",
  "red-team": "safety",
  "red-teaming": "safety",
};

function toKebab(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function groupFor(tag: string): keyof Tags {
  if ((SEED_TAGS.traits as readonly string[]).includes(tag)) return "traits";
  if ((SEED_TAGS.entities as readonly string[]).includes(tag))
    return "entities";
  return "topics";
}

export function normalizeTags(raw: string[]): Tags {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const r of raw) {
    if (typeof r !== "string") continue;
    const kebab = toKebab(r);
    if (!kebab) continue;
    const canonical = TAG_ALIASES[kebab] ?? kebab;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    ordered.push(canonical);
  }

  const buckets: Tags = { topics: [], traits: [], entities: [] };
  let total = 0;
  for (const tag of ordered) {
    if (total >= MAX_TAGS_PER_ARTICLE) break;
    buckets[groupFor(tag)].push(tag);
    total++;
  }
  return buckets;
}

export function parseRetentionDays(): number {
  const raw = process.env.RETENTION_DAYS;
  if (raw === undefined || raw === "") return 30;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    console.error(
      `ERROR: RETENTION_DAYS must be a finite number >= 1, got: ${JSON.stringify(raw)}`
    );
    process.exit(1);
  }
  return n;
}

export function computeEffectiveDaysBack(
  existing: NewsData | null,
  daysBack: number,
  now: number
): number {
  if (existing === null) return daysBack;
  const parsedAt = Date.parse(existing.generatedAt);
  if (!Number.isFinite(parsedAt)) return daysBack;
  const gapDays = Math.ceil((now - parsedAt) / 86400000);
  return Math.min(CATCH_UP_CAP_DAYS, Math.max(daysBack, gapDays + 1));
}

export type RetryOptions = {
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  onDelay?: (ms: number) => void;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3;
  const sleep = opts.sleep ?? defaultSleep;
  const delays = [1000, 2000, 4000];
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const isTransient =
        err instanceof Anthropic.RateLimitError ||
        err instanceof Anthropic.InternalServerError ||
        err instanceof Anthropic.APIConnectionError;
      if (!isTransient || attempt >= maxRetries) throw err;
      const baseDelay = delays[Math.min(attempt, delays.length - 1)];
      let delay = baseDelay;
      if (err instanceof Anthropic.RateLimitError) {
        const retryAfter = err.headers?.get?.("retry-after");
        delay = Math.max(baseDelay, parseFloat(retryAfter ?? "0") * 1000);
      }
      opts.onDelay?.(delay);
      await sleep(delay);
      attempt++;
    }
  }
}

export function buildFeedHealth(
  feeds: Feed[],
  successAt: Record<string, string>,
  errors: Record<string, string>,
  prevHealth: Record<string, FeedHealth> | undefined
): Record<string, FeedHealth> {
  const health: Record<string, FeedHealth> = {};
  for (const feed of feeds) {
    if (successAt[feed.name]) {
      health[feed.name] = {
        lastSuccess: successAt[feed.name],
        lastError: null,
        consecutiveFailures: 0,
      };
    } else if (errors[feed.name]) {
      const prev = prevHealth?.[feed.name];
      health[feed.name] = {
        lastSuccess: prev?.lastSuccess ?? null,
        lastError: errors[feed.name],
        consecutiveFailures: (prev?.consecutiveFailures ?? 0) + 1,
      };
    } else {
      const prev = prevHealth?.[feed.name];
      health[feed.name] = prev ?? {
        lastSuccess: null,
        lastError: null,
        consecutiveFailures: 0,
      };
    }
  }
  return health;
}

export function computeGeneratedAt(
  newCount: number,
  existing: NewsData | null,
  now: () => string
): string {
  if (newCount > 0) return now();
  return existing?.generatedAt ?? now();
}

// ---------------------------------------------------------------------------
// Daily brief (F8)

export const BRIEF_INPUT_CAP = 50;
export const BRIEF_MIN_BULLETS = 3;
export const BRIEF_MAX_BULLETS = 5;

// Important articles first (they must be visible to the model even on huge
// runs), then everything else newest-first, capped so the prompt stays small.
export function selectBriefInput(articles: Article[]): Article[] {
  const byRecency = (a: Article, b: Article) =>
    b.publishedAt.localeCompare(a.publishedAt);
  const important = articles.filter((a) => a.important).sort(byRecency);
  const rest = articles.filter((a) => !a.important).sort(byRecency);
  return [...important, ...rest].slice(0, BRIEF_INPUT_CAP);
}

export function buildBriefPrompt(articles: Article[]): {
  system: string;
  user: string;
} {
  const list = articles
    .map(
      (a, i) =>
        `[${i}] (${a.category}${a.important ? ", NOTABLE" : ""}) ${a.title} — ${a.summary}`
    )
    .join("\n");

  const system =
    "You are the editor of a daily AI-industry briefing. From today's newly " +
    "ingested articles you write the executive brief: 3 to 5 bullets, each at " +
    "most 40 words, synthesizing the day's most significant developments. " +
    "Connect related articles into one bullet where they tell a single story. " +
    "Weight NOTABLE articles toward inclusion, but lead with whatever is " +
    "genuinely the day's biggest story. Each bullet cites the indices of the " +
    "articles it draws from.\n\n" +
    'Respond ONLY with a JSON array: [{"text": string, "refs": number[]}]';

  const user = `Today's ${articles.length} new articles:\n\n${list}`;

  return { system, user };
}

// Validates the model response and resolves cited indices to article URLs.
// Throws on anything unusable — the caller carries the previous brief forward.
export function parseBriefResponse(
  text: string,
  inputs: Article[]
): BriefBullet[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array in brief response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Brief response is not valid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("Brief response is not an array");

  const bullets: BriefBullet[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const { text: bulletText, refs } = item as {
      text?: unknown;
      refs?: unknown;
    };
    if (typeof bulletText !== "string" || bulletText.trim() === "") continue;
    const urls: string[] = [];
    if (Array.isArray(refs)) {
      for (const r of refs) {
        if (
          typeof r === "number" &&
          Number.isInteger(r) &&
          r >= 0 &&
          r < inputs.length
        ) {
          const url = inputs[r].url;
          if (!urls.includes(url)) urls.push(url);
        }
      }
    }
    bullets.push({ text: bulletText.trim(), refs: urls });
  }

  if (bullets.length < BRIEF_MIN_BULLETS || bullets.length > BRIEF_MAX_BULLETS) {
    throw new Error(
      `Brief has ${bullets.length} valid bullets (need ${BRIEF_MIN_BULLETS}-${BRIEF_MAX_BULLETS})`
    );
  }
  return bullets;
}

export function carryForwardBrief(existing: NewsData | null): Brief | undefined {
  return existing?.brief;
}
