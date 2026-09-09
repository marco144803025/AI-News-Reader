export type Tags = {
  topics: string[];
  traits: string[];
  entities: string[];
};

export type Article = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
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
};
