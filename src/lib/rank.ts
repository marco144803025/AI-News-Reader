import type { Article } from "../types";

export const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

export type RankedFrontPage = {
  lead: Article | null;
  rest: Article[];
};

// Lead: first `important` article in filtered order (articles arrive
// newest-first from ingest), falling back to the newest article. Rest keeps
// the incoming order.
export function rankFrontPage(articles: Article[]): RankedFrontPage {
  if (articles.length === 0) return { lead: null, rest: [] };
  const lead = articles.find((a) => a.important) ?? articles[0];
  return { lead, rest: articles.filter((a) => a !== lead) };
}

// Published within the last 24 hours (or carrying a slightly future timestamp
// from feed clock skew — still the newest thing on the wire).
export function isFresh(article: Article, now: number): boolean {
  const ts = Date.parse(article.publishedAt);
  if (!Number.isFinite(ts)) return false;
  return now - ts <= FRESH_WINDOW_MS;
}

// Deterministic ransom-word pick: longest word with at least 5 letters,
// earliest position wins ties; -1 when every word is short.
export function ransomWordIndex(title: string): number {
  const words = title.split(/\s+/).filter(Boolean);
  let best = -1;
  let bestLen = 4;
  for (let i = 0; i < words.length; i++) {
    const letters = words[i].replace(/[^\p{L}\p{N}]/gu, "");
    if (letters.length > bestLen) {
      bestLen = letters.length;
      best = i;
    }
  }
  return best;
}
