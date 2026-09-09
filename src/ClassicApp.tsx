import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LineageProps } from "./lib/lineage";
import { categoryCounts, EMPTY_FILTER, filterArticles, hasActiveFilters, type FilterState } from "./lib/filter";
import { feedIssues } from "./lib/trends";
import { newsDate } from "./lib/news";
import { useLanguage } from "./hooks/useLanguage";
import { uiCopy } from "./lib/ui";
import { useMotion } from "./hooks/useMotion";
import StandardHeader, { type StandardSection } from "./components/standard/StandardHeader";
import DailyCover from "./components/standard/DailyCover";
import NewsFeed from "./components/standard/NewsFeed";
import TrendsView from "./components/TrendsView";
import "./components/standard/standard.css";

export default function ClassicApp({ data, error, onRetry, extraEnabled, filterState, setFilterState, page, setPage, setTheme }: LineageProps) {
  const { language } = useLanguage();
  const t = uiCopy(language);
  useEffect(() => {
    const originalTitle = document.title;
    document.title = t.pageTitle;
    return () => { document.title = originalTitle; };
  }, [t.pageTitle]);
  const motion = useMotion();
  const [notableOnly, setNotableOnly] = useState(false);
  const [section, setSection] = useState<StandardSection>("brief");
  const [navigation, setNavigation] = useState(0);
  const pendingSection = useRef<StandardSection | null>(null);
  const initialNavigation = useRef(false);
  const isTrends = filterState.view === "trends";
  const counts = useMemo(() => categoryCounts(data?.articles ?? [], filterState), [data, filterState]);
  const scopedArticles = useMemo(() => (data?.articles ?? []).filter(article => filterState.category === "All" || article.category === filterState.category), [data, filterState.category]);
  const filtered = useMemo(() => filterArticles(data?.articles ?? [], filterState)
    .filter(article => !notableOnly || filterState.category !== "Research" || article.important), [data, filterState, notableOnly]);
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 8) - 1));
  useEffect(() => { setNotableOnly(false); }, [filterState.category]);
  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage, setPage]);

  const requestNavigation = useCallback((next: StandardSection) => {
    pendingSection.current = next;
    setNavigation(value => value + 1);
  }, []);
  const navigate = (next: StandardSection) => {
    setFilterState({ ...filterState, view: next === "trends" ? "trends" : undefined });
    requestNavigation(next);
  };
  const updateFilters = (next: FilterState, move = false) => {
    setFilterState({ ...next, view: undefined });
    if (move) requestNavigation("news");
  };
  useEffect(() => {
    const onHistory = () => {
      const params = new URLSearchParams(window.location.search);
      requestNavigation(params.get("view") === "trends" ? "trends" :
        ["q", "category", "topics", "traits", "entities"].some(key => params.has(key)) ? "news" : "brief");
    };
    window.addEventListener("popstate", onHistory);
    return () => window.removeEventListener("popstate", onHistory);
  }, [requestNavigation]);
  useEffect(() => {
    if (!data) return;
    if (!initialNavigation.current) {
      initialNavigation.current = true;
      if (!pendingSection.current) pendingSection.current = isTrends ? "trends" :
        hasActiveFilters(filterState) || filterState.category !== "All" ? "news" : null;
    }
    const next = pendingSection.current;
    if (!next) return;
    const frame = requestAnimationFrame(() => {
      const heading = document.getElementById(next === "trends" ? "trends-heading" : next === "brief" ? "brief-heading" : "news-heading");
      if (!heading) return;
      heading.scrollIntoView({ behavior: motion.enabled ? "smooth" : "instant", block: "start" });
      const target = next === "search" ? document.getElementById("news-search") : heading;
      target?.focus({ preventScroll: true });
      setSection(next === "search" ? "news" : next);
      pendingSection.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [data, isTrends, navigation, motion.enabled, filterState]);
  useEffect(() => {
    if (!data || isTrends || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setSection(entry.target.id === "news" ? "news" : "brief");
    }, { rootMargin: "-65px 0px -55% 0px", threshold: 0 });
    for (const id of ["daily-brief", "news"]) { const node = document.getElementById(id); if (node) observer.observe(node); }
    return () => observer.disconnect();
  }, [data, isTrends]);

  const issues = feedIssues(data?.feedHealth);
  return <div className="theme-standard" lang={language} data-motion={motion.enabled ? "on" : "off"}>
    <StandardHeader generatedAt={data?.generatedAt} categories={data?.categories ?? []} category={filterState.category}
      counts={counts} section={isTrends ? "trends" : section} onNavigate={navigate}
      onCategory={category => updateFilters({ ...filterState, category }, true)} extraEnabled={extraEnabled}
      onExtra={() => setTheme("extra")} motion={motion} />
    <main className="standard-main" id="standard-content" tabIndex={-1}>
      {error ? <div className="standard-state" role="alert"><p className="standard-kicker">{t.interruption}</p><h1>{t.backSoon}</h1><p>{t.loadError}</p><button className="standard-action" onClick={onRetry}>{t.retry} ↗</button></div>
        : !data ? <div className="standard-state" role="status"><p className="standard-kicker">AI Briefing</p><h1>{t.opening}<span>…</span></h1><p>{t.gathering}</p></div>
        : <>{isTrends ? <section className="standard-trends"><p className="standard-kicker">{t.biggerPicture}</p><h1 id="trends-heading" tabIndex={-1}>{t.signals}<span>.</span></h1>
            <TrendsView data={data} now={Date.now()} onOpenTopic={tag => updateFilters({ ...EMPTY_FILTER, topics: [tag] }, true)}
              onOpenEntity={tag => updateFilters({ ...EMPTY_FILTER, entities: [tag] }, true)} />
          </section> : <>
            <DailyCover data={data} motion={motion.enabled} onNews={() => navigate("news")} />
            <NewsFeed articles={filtered} scopedArticles={scopedArticles} categories={data.categories} counts={counts} state={filterState}
              onChange={updateFilters} page={safePage} onPage={next => { setPage(next); requestNavigation("news"); }}
              notableOnly={notableOnly} onNotable={() => { setNotableOnly(value => !value); setPage(0); }} motion={motion.enabled} />
          </>}
          <footer className="standard-footer"><div><span className="standard-footer-brand">AI Briefing<span aria-hidden="true">●</span></span><p>{t.footer}</p></div>
            <div className="standard-footer-status"><span>{t.archiveUpdated} <time dateTime={data.generatedAt}>{newsDate(data.generatedAt, language)}</time></span>
              <button onClick={() => navigate("trends")}>{issues.length ? t.sourcesAttention(issues.length) : t.exploreHealth} ↗</button></div>
          </footer>
        </>}
    </main>
  </div>;
}
