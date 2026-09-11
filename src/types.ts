export type Tags = {
  topics: string[];
  traits: string[];
  entities: string[];
};

/** One other outlet's coverage of the same story, shown as an extra source link. */
export type AdditionalSource = {
  title: string; // the other outlet's own headline, unmodified
  url: string; // that outlet's article URL; http(s), no credentials
  source: string; // feed name as configured in feeds.json
};

/** An ingested item before classification. Shared by the pipeline and the site. */
export type RawArticle = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
  // NOTE: set by F13 deduplication when several feeds carry the same story.
  // Absent on every article ingested before F13 — that is normal data, not a
  // legacy format, so readers treat it as optional rather than migrating it.
  additionalSources?: AdditionalSource[];
};

export type Article = RawArticle & {
  category: string;
  summary: string;
  summaryZhHK?: string;
  important?: boolean;
  tags?: Tags;
};

export type FeedHealth = {
  lastSuccess: string | null;
  lastError: string | null;
  consecutiveFailures: number;
};

export type BriefBullet = {
  text: string; // ≤ ~40 words, prompt-enforced
  textZhHK?: string; // HK written Traditional Chinese, paired with English text
  refs: string[]; // URLs validated against the selected brief input
};

export type Brief = {
  generatedAt: string; // timestamp of the ingest run that produced it
  headline?: string;
  headlineZhHK?: string;
  bullets: BriefBullet[]; // 3–5 entries
};

/** Lets delivery tell a quiet day apart from a broken brief call. */
export type BriefStatus = "generated" | "no-new-material" | "generation-failed";

export type NewsData = {
  generatedAt: string;
  daysBack: number; // fetch window used in this run
  categories: string[];
  articles: Article[];
  feedHealth?: Record<string, FeedHealth>;
  brief?: Brief;
  briefStatus?: BriefStatus;
  // NOTE: consecutive failures before a feed is labelled persistently failing.
  // Carried in the payload because the browser cannot read the ingest
  // environment. Absent means "not configured by this run", not a valid value.
  feedFailureWarningThreshold?: number;
};
