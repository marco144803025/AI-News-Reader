import type { Article, Tags } from "../types";

export type FilterState = {
  query: string;
  category: string;
  topics: string[];
  traits: string[];
  entities: string[];
  view?: "trends"; // non-filter navigation state; ignored by filterArticles
};

export const EMPTY_FILTER: FilterState = {
  query: "",
  category: "All",
  topics: [],
  traits: [],
  entities: [],
};

function flattenTags(tags: Tags | undefined): string[] {
  if (!tags) return [];
  return [...tags.topics, ...tags.traits, ...tags.entities];
}

function matchesQuery(article: Article, q: string): boolean {
  if (!q) return true;
  const haystack = (
    article.title +
    " " +
    article.summary +
    " " +
    flattenTags(article.tags).join(" ")
  ).toLowerCase();
  return haystack.includes(q);
}

function matchesGroup(
  articleTags: string[] | undefined,
  selected: string[]
): boolean {
  if (selected.length === 0) return true;
  if (!articleTags || articleTags.length === 0) return false;
  // OR within group: any selected tag matches.
  for (const sel of selected) {
    if (articleTags.includes(sel)) return true;
  }
  return false;
}

export function filterArticles(
  articles: Article[],
  state: FilterState
): Article[] {
  const q = state.query.trim().toLowerCase();
  return articles.filter((a) => {
    if (state.category !== "All" && a.category !== state.category) return false;
    if (!matchesQuery(a, q)) return false;
    // AND across groups: every group with a selection must match.
    if (!matchesGroup(a.tags?.topics, state.topics)) return false;
    if (!matchesGroup(a.tags?.traits, state.traits)) return false;
    if (!matchesGroup(a.tags?.entities, state.entities)) return false;
    return true;
  });
}

// Counts per category under the current search + tag filter, ignoring the
// category constraint itself — drives navigation counts in both lineages.
export function categoryCounts(
  articles: Article[],
  state: FilterState
): Map<string, number> {
  const base = filterArticles(articles, { ...state, category: "All" });
  const map = new Map<string, number>();
  map.set("All", base.length);
  for (const a of base) {
    map.set(a.category, (map.get(a.category) ?? 0) + 1);
  }
  return map;
}

// Unique, sorted tag values present in the given articles for one tag group.
export function collectTagUniverse(
  articles: Article[],
  group: keyof Tags
): string[] {
  const set = new Set<string>();
  for (const a of articles) {
    const list = a.tags?.[group];
    if (!list) continue;
    for (const t of list) set.add(t);
  }
  return [...set].sort();
}

export function hasActiveFilters(state: FilterState): boolean {
  return (
    state.query.trim() !== "" ||
    state.topics.length > 0 ||
    state.traits.length > 0 ||
    state.entities.length > 0
  );
}
