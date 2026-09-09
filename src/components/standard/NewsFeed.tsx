import { useEffect, useRef } from "react";
import type { Article, Tags } from "../../types";
import type { FilterState } from "../../lib/filter";
import { EMPTY_FILTER, hasActiveFilters } from "../../lib/filter";
import { paginate } from "../../lib/paginate";
import { newsDate } from "../../lib/news";
import { useLanguage } from "../../hooks/useLanguage";
import { CHINESE_FALLBACK, selectSummary } from "../../lib/language";
import { categoryLabel, tagLabel, uiCopy, uiNumber } from "../../lib/ui";
import FilterBar from "../FilterBar";

type Props = {
  articles: Article[];
  scopedArticles: Article[];
  categories: string[];
  counts: Map<string, number>;
  state: FilterState;
  onChange: (next: FilterState, navigate?: boolean) => void;
  page: number;
  onPage: (page: number) => void;
  notableOnly: boolean;
  onNotable: () => void;
  motion: boolean;
};

export default function NewsFeed({ articles, scopedArticles, categories, counts, state, onChange, page, onPage, notableOnly, onNotable, motion }: Props) {
  const { language } = useLanguage();
  const t = uiCopy(language);
  const container = useRef<HTMLDivElement>(null);
  const { pageItems, totalPages } = paginate(articles, page, 8);
  const groups = ["topics", "traits", "entities"] as const;
  const selectedTags = groups.flatMap(group => state[group].map(value => ({ group, value })));
  useEffect(() => {
    if (!motion || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add("standard-revealed");
        observer.unobserve(entry.target);
      }
    }, { threshold: .08 });
    container.current?.querySelectorAll(".standard-news-row").forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, [pageItems.map(article => article.url).join("|"), motion]);
  const selectTag = (group: keyof Tags, value: string) => onChange({ ...state,
    [group]: state[group].includes(value) ? state[group].filter(tag => tag !== value) : [...state[group], value] }, true);
  return <section className="standard-feed" id="news" aria-labelledby="news-heading">
    <div className="standard-feed-heading"><div><p className="standard-kicker">{t.beyondBrief}</p><h2 id="news-heading" tabIndex={-1}>{t.fullPicture}<span>.</span></h2></div>
      <p className="standard-result-count" role="status">{t.stories(articles.length)} {hasActiveFilters(state) ? t.matching : t.toExplore}</p></div>
    <div className="standard-discovery">
      <label className="standard-category-select">{t.category}<select value={state.category} onChange={event => onChange({ ...state, category: event.target.value }, true)}>
        {["All", ...categories].map(category => <option key={category} value={category}>{categoryLabel(category, language)} ({uiNumber(counts.get(category) ?? 0, language)})</option>)}
      </select></label>
      <label className="standard-search"><span aria-hidden="true">⌕</span><span className="sr-only">{t.searchArticles}</span>
        <input id="news-search" type="search" placeholder={t.searchPlaceholder} value={state.query}
          onChange={event => onChange({ ...state, query: event.target.value })} /></label>
      {state.category === "Research" && <button className="standard-notable-filter" aria-pressed={notableOnly} onClick={onNotable}>{notableOnly ? "★" : "☆"} {t.notableOnly}</button>}
    </div>
    <details className="standard-tag-disclosure"><summary>{t.exploreTopic} <span>{selectedTags.length ? t.selected(selectedTags.length) : t.topicHint}</span><b aria-hidden="true">+</b></summary>
      <FilterBar scopedArticles={scopedArticles} state={state} onChange={next => onChange(next, true)} />
    </details>
    {(selectedTags.length > 0 || hasActiveFilters(state) || state.category !== "All" || notableOnly) && <div className="standard-active-filters" aria-label={t.activeFilters}>
      {state.category !== "All" && <button onClick={() => onChange({ ...state, category: "All" }, true)}>{categoryLabel(state.category, language)} <span aria-hidden="true">×</span></button>}
      {selectedTags.map(({ group, value }) => <button key={`${group}-${value}`} onClick={() => selectTag(group, value)} aria-label={t.removeFilter(t[group], tagLabel(group, value, language))}>{tagLabel(group, value, language)} <span aria-hidden="true">×</span></button>)}
      <button className="standard-clear" onClick={() => { if (notableOnly) onNotable(); onChange({ ...EMPTY_FILTER }, true); }}>{t.clearAll}</button>
    </div>}
    <div ref={container} className="standard-news-list">
      {pageItems.map((article, i) => {
        const summary = selectSummary(article, language);
        return <article className="standard-news-row" key={article.url}>
          <div className="standard-row-index" aria-hidden="true">{String(page * 8 + i + 1).padStart(2, "0")}</div>
          <div className="standard-row-main"><div className="standard-row-meta"><span>{categoryLabel(article.category, language)}</span>{article.important && <span className="standard-notable">{t.notable}</span>}</div>
            <h3><a href={article.url} target="_blank" rel="noreferrer">{article.title}</a></h3>
            <p className="standard-row-summary" lang={summary.text ? summary.language : language}>{summary.text || t.noSummary}</p>
            {summary.fallback && <p className="standard-fallback" lang="zh-HK">{CHINESE_FALLBACK}</p>}
            {article.tags && <div className="standard-article-tags" aria-label={t.storyTopics}>{groups.flatMap(group => article.tags![group].map(value =>
              <button key={`${group}-${value}`} aria-pressed={state[group].includes(value)} onClick={() => selectTag(group, value)}>{tagLabel(group, value, language)}</button>))}</div>}
          </div>
          <div className="standard-row-source"><span>{article.source}</span><time dateTime={article.publishedAt}>{newsDate(article.publishedAt, language)}</time>
            <a href={article.url} target="_blank" rel="noreferrer" aria-label={t.originalLabel(article.title)}>{t.readOriginal} <span aria-hidden="true">↗</span></a></div>
        </article>;
      })}
      {articles.length === 0 && <div className="standard-empty"><h3>{t.noStories}</h3><p>{hasActiveFilters(state) || state.category !== "All" || notableOnly ? t.tryFilters : t.nextUpdate}</p></div>}
    </div>
    {totalPages > 1 && <nav className="standard-pagination" aria-label={t.pages}>
      <button onClick={() => onPage(page - 1)} disabled={page === 0}>← {t.previous}</button>
      <span>{t.page(page + 1, totalPages)}</span>
      <button onClick={() => onPage(page + 1)} disabled={page + 1 >= totalPages}>{t.next} →</button>
    </nav>}
  </section>;
}
