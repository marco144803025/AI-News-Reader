export type Article = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
  category: string;
  summary: string;
  important?: boolean;
};

export type FeedHealth = {
  lastSuccess: string | null;
  lastError: string | null;
  consecutiveFailures: number;
};

export type NewsData = {
  generatedAt: string;
  daysBack: number; // fetch window used in this run
  categories: string[];
  articles: Article[];
  feedHealth?: Record<string, FeedHealth>;
};
