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
  refs: string[]; // URLs of cited articles — validated subset of the run's new articles
};

export type Brief = {
  generatedAt: string; // timestamp of the ingest run that produced it
  bullets: BriefBullet[]; // 3–5 entries
};

export type NewsData = {
  generatedAt: string;
  daysBack: number; // fetch window used in this run
  categories: string[];
  articles: Article[];
  feedHealth?: Record<string, FeedHealth>;
  brief?: Brief;
};
