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

export type NewsData = {
  generatedAt: string;
  daysBack: number;
  categories: string[];
  articles: Article[];
};
