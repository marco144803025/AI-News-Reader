import type { AdditionalSource, Article, Brief, BriefStatus, FeedHealth, NewsData, Tags } from "../types.ts";
import { DEFAULT_FAILURE_WARNING_THRESHOLD } from "./trends.ts";
import { uiCopy } from "./ui.ts";
import type { SummaryLanguage } from "./language.ts";
import { validBriefHeadline, validTranslation } from "./language.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function sourceUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Attribution added by F13 deduplication. It is optional metadata about OTHER
 * outlets, so a malformed entry is dropped with a warning and never takes an
 * otherwise valid article down with it. The URL guard is the shared sourceUrl
 * one — attribution links must clear exactly the same bar as a primary link.
 */
function readAdditionalSources(value: unknown, articleUrl: string): AdditionalSource[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    console.warn(`news.json: additionalSources on ${articleUrl} is not a list; ignoring it.`);
    return undefined;
  }
  const sources: AdditionalSource[] = [];
  for (const entry of value) {
    const url = isRecord(entry) ? sourceUrl(entry.url) : undefined;
    // The other outlet's own words are stored verbatim; only emptiness is rejected.
    if (!isRecord(entry) || !url || typeof entry.title !== "string" || !entry.title.trim() ||
        typeof entry.source !== "string" || !entry.source.trim()) {
      console.warn(`news.json: dropped a malformed additional source on ${articleUrl}.`);
      continue;
    }
    sources.push({ title: entry.title, url, source: entry.source });
  }
  return sources.length > 0 ? sources : undefined;
}

/**
 * Absence means "this run did not configure a threshold", not a valid value, so
 * the fallback is announced instead of quietly invented (Constitution rule 15).
 */
function readFailureThreshold(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  console.warn(`news.json: feedFailureWarningThreshold is missing or invalid (${JSON.stringify(value) ?? "undefined"}); ` +
    `labelling persistent feed failures at ${DEFAULT_FAILURE_WARNING_THRESHOLD} consecutive runs instead.`);
  return DEFAULT_FAILURE_WARNING_THRESHOLD;
}

function readBrief(value: unknown): Brief | undefined {
  if (!isRecord(value) || typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt)) ||
      !Array.isArray(value.bullets) || value.bullets.length < 3 || value.bullets.length > 5) return undefined;
  const bullets: Brief["bullets"] = [];
  for (const item of value.bullets) {
    if (!isRecord(item) || typeof item.text !== "string" || !item.text.trim() || !Array.isArray(item.refs)) return undefined;
    const textZhHK = validTranslation(item.textZhHK);
    bullets.push({ text: item.text, refs: strings(item.refs).filter(url => sourceUrl(url) !== undefined),
      ...(textZhHK ? { textZhHK } : {}) });
  }
  const headline = validBriefHeadline(value.headline, "en");
  const headlineZhHK = validBriefHeadline(value.headlineZhHK, "zh-HK");
  return { generatedAt: value.generatedAt, bullets, ...(headline ? { headline } : {}), ...(headlineZhHK ? { headlineZhHK } : {}) };
}

/** Validate once at the browser boundary. Optional legacy data never strands the feed. */
export function parseNewsData(value: unknown): NewsData {
  const invalid = () => new Error("The news archive could not be read. Please try again.");
  if (!isRecord(value) || typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt)) ||
      !Array.isArray(value.articles) || !Array.isArray(value.categories) ||
      value.categories.some(category => typeof category !== "string")) throw invalid();
  const articles: Article[] = value.articles.map(item => {
    if (!isRecord(item) || ["title", "source", "publishedAt", "category", "summary"].some(key => typeof item[key] !== "string") ||
        !sourceUrl(item.url)) throw invalid();
    const rawTags = isRecord(item.tags) ? item.tags : {};
    const tags: Tags = { topics: strings(rawTags.topics), traits: strings(rawTags.traits), entities: strings(rawTags.entities) };
    const additionalSources = readAdditionalSources(item.additionalSources, item.url as string);
    return { title: item.title as string, source: item.source as string, url: item.url as string,
      publishedAt: item.publishedAt as string, category: item.category as string, summary: item.summary as string,
      snippet: typeof item.snippet === "string" ? item.snippet : "", summaryZhHK: validTranslation(item.summaryZhHK),
      important: item.important === true, tags, ...(additionalSources ? { additionalSources } : {}) };
  });
  const feedHealth: Record<string, FeedHealth> = {};
  if (isRecord(value.feedHealth)) {
    for (const [name, health] of Object.entries(value.feedHealth)) {
      if (!isRecord(health) || typeof health.consecutiveFailures !== "number" || !Number.isFinite(health.consecutiveFailures)) continue;
      feedHealth[name] = { consecutiveFailures: Math.max(0, health.consecutiveFailures),
        lastError: typeof health.lastError === "string" ? health.lastError : null,
        lastSuccess: typeof health.lastSuccess === "string" ? health.lastSuccess : null };
    }
  }
  const status = value.briefStatus;
  const briefStatus: BriefStatus | undefined = status === "generated" || status === "no-new-material" || status === "generation-failed" ? status : undefined;
  return { generatedAt: value.generatedAt, daysBack: typeof value.daysBack === "number" ? value.daysBack : 0,
    categories: [...new Set(value.categories as string[])], articles, feedHealth, brief: readBrief(value.brief), briefStatus,
    feedFailureWarningThreshold: readFailureThreshold(value.feedFailureWarningThreshold) };
}

/** An edition is deterministic even when opened on a later day or in another timezone. */
export function selectNotableStories(articles: Article[], generatedAt: string): Article[] {
  const end = Date.parse(generatedAt);
  if (!Number.isFinite(end)) return [];
  const start = end - 7 * 86_400_000;
  const candidates = articles.filter(article => {
    const time = Date.parse(article.publishedAt);
    return article.important === true && time >= start && time <= end;
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const seen = new Set<string>();
  return candidates.filter(article => {
    if (seen.has(article.url)) return false;
    seen.add(article.url);
    return true;
  }).slice(0, 2);
}

export function newsDate(iso: string, language: SummaryLanguage = "en"): string {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Intl.DateTimeFormat(language === "en" ? "en-GB" : "zh-HK", { day: "numeric", month: language === "en" ? "short" : "long", year: "numeric" }).format(time) : uiCopy(language).dateUnavailable;
}

export function briefNotice(data: Pick<NewsData, "brief" | "briefStatus">, language: SummaryLanguage = "en"): string | undefined {
  const t = uiCopy(language);
  if (data.briefStatus === "generation-failed") return `${t.failedBrief} ${data.brief ? t.previousEdition : t.stillNews}`;
  if (data.briefStatus === "no-new-material") return t.quietBrief + (data.brief ? ` ${t.previousEdition}` : "");
  return undefined;
}
